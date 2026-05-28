import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const defaultUnityRoot = path.resolve(repoRoot, '..', 'AVZ_YesterdayNight_86abe3b');

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const item = process.argv[i];
  if (item.startsWith('--')) {
    args.set(item.slice(2), process.argv[i + 1]);
    i += 1;
  }
}

const unityRoot = path.resolve(args.get('unity-root') ?? defaultUnityRoot);
const meshyRoot = path.join(unityRoot, 'Assets', '_PalReskin', 'MeshyImported');
const evidenceRoot = path.join(repoRoot, 'evidence');
const summariesRoot = path.join(evidenceRoot, 'meshy-summaries');
const previewsRoot = path.join(evidenceRoot, 'previews');
const publicAssetRoot = path.join(repoRoot, 'public', 'pipeline-assets');
const publicEvidenceRoot = path.join(repoRoot, 'public', 'evidence');
const dataPath = path.join(repoRoot, 'src', 'data', 'generatedAssets.ts');
const manifestPath = path.join(repoRoot, 'pipeline', 'config', 'asset_manifest.yaml');
const budgetPath = path.join(repoRoot, 'pipeline', 'config', 'budget_config.yaml');
const templatesPath = path.join(repoRoot, 'pipeline', 'config', 'prompt_templates.yaml');
const forbiddenPath = path.join(repoRoot, 'pipeline', 'config', 'forbidden_unity_paths.yaml');

const themeOrder = ['forest', 'snow', 'volcano', 'base'];

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function yamlValue(value) {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const text = String(value ?? '');
  return `"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function detectTheme(relativeDir, assetName) {
  const text = `${relativeDir}/${assetName}`.toLowerCase();
  if (text.includes('forest')) return 'forest';
  if (text.includes('snow') || text.includes('ice') || text.includes('frozen') || text.includes('frost')) return 'snow';
  if (text.includes('volcano') || text.includes('lava') || text.includes('magma') || text.includes('obsidian') || text.includes('ember')) return 'volcano';
  return 'base';
}

function detectCategory(assetName) {
  const name = assetName.toLowerCase();
  if (name.includes('terminal') || name.includes('relay')) return 'infrastructure';
  if (name.includes('gate') || name.includes('shrine') || name.includes('forge') || name.includes('outpost') || name.includes('landmark')) return 'landmark';
  if (name.includes('tree') || name.includes('fern') || name.includes('mushroom') || name.includes('flower') || name.includes('clover') || name.includes('shrub') || name.includes('pine')) return 'foliage';
  if (name.includes('rock') || name.includes('boulder') || name.includes('crystal') || name.includes('obsidian') || name.includes('ice') || name.includes('lava')) return 'terrain';
  if (name.includes('chest') || name.includes('camp') || name.includes('lodge') || name.includes('well') || name.includes('cache') || name.includes('totem')) return 'prop';
  return 'asset';
}

function detectScaleTier(category, assetName) {
  const name = assetName.toLowerCase();
  if (category === 'landmark' || name.includes('gate') || name.includes('outpost') || name.includes('waterfall')) return 'large';
  if (category === 'foliage' && !name.includes('giant')) return 'small';
  return 'medium';
}

function displayName(assetName) {
  return assetName
    .replace(/^(forest|snow|volcano|base)_/, '')
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function sha256(filePath) {
  const data = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function copyImage(assetDir, assetName, kind, targetRoots) {
  const entries = await fs.readdir(assetDir);
  const exact = `${assetName}_${kind}.png`;
  const candidate = entries.find((entry) => entry.toLowerCase() === exact.toLowerCase())
    ?? entries.find((entry) => entry.toLowerCase().includes(kind) && entry.toLowerCase().endsWith('.png'));

  if (!candidate) return undefined;

  for (const root of targetRoots) {
    const targetDir = path.join(root, assetName);
    await fs.mkdir(targetDir, { recursive: true });
    await fs.copyFile(path.join(assetDir, candidate), path.join(targetDir, candidate));
  }

  return {
    fileName: candidate,
    publicUrl: `pipeline-assets/${encodeURIComponent(assetName)}/${encodeURIComponent(candidate)}`,
    evidencePath: `evidence/previews/${assetName}/${candidate}`,
  };
}

async function readAsset(summaryPath) {
  const assetDir = path.dirname(summaryPath);
  const relativeDir = path.relative(meshyRoot, assetDir);
  const raw = await fs.readFile(summaryPath, 'utf8');
  const summary = JSON.parse(raw);
  const assetName = String(summary.asset ?? path.basename(assetDir));
  const entries = await fs.readdir(assetDir);
  const theme = detectTheme(relativeDir, assetName);
  const category = detectCategory(assetName);
  const concept = await copyImage(assetDir, assetName, 'concept', [previewsRoot, publicAssetRoot]);
  const preview = await copyImage(assetDir, assetName, 'preview', [previewsRoot, publicAssetRoot]);

  await fs.copyFile(summaryPath, path.join(summariesRoot, `${assetName}.json`));

  const sourceFiles = [];
  for (const entry of entries) {
    const fullPath = path.join(assetDir, entry);
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) continue;
    const extension = path.extname(entry).toLowerCase();
    if (!['.json', '.png', '.fbx', '.glb', '.mat'].includes(extension)) continue;
    sourceFiles.push({
      path: toPosix(path.relative(unityRoot, fullPath)),
      bytes: stat.size,
      sha256: await sha256(fullPath),
      publishPolicy: extension === '.json' || entry === concept?.fileName || entry === preview?.fileName
        ? 'copied'
        : 'inventory-only',
    });
  }

  return {
    id: assetName,
    asset: assetName,
    displayName: displayName(assetName),
    theme,
    category,
    scaleTier: detectScaleTier(category, assetName),
    status: summary.status ?? 'UNKNOWN',
    consumedCredits: Number(summary.consumed_credits ?? 0),
    prompt: summary.prompt ?? '',
    textToImageTask: summary.text_to_image_task,
    imageTo3dTask: summary.image_to_3d_task,
    conceptUrl: concept?.publicUrl,
    previewUrl: preview?.publicUrl,
    sourceDir: toPosix(path.relative(unityRoot, assetDir)),
    sourceSummary: `evidence/meshy-summaries/${assetName}.json`,
    evidencePreview: preview?.evidencePath,
    evidenceConcept: concept?.evidencePath,
    hasFbx: entries.some((entry) => entry.toLowerCase().endsWith('.fbx')),
    hasGlb: entries.some((entry) => entry.toLowerCase().endsWith('.glb')),
    hasMaterial: entries.some((entry) => entry.toLowerCase().endsWith('.mat')),
    sourceFiles,
    generatedAt: new Date().toISOString(),
  };
}

function renderManifest(assets) {
  const lines = [
    '# Generated from the local Unity project by scripts/export-evidence.mjs.',
    '# This is portfolio evidence, not a commercial production manifest.',
  ];
  for (const asset of assets) {
    lines.push(`- task_id: ${yamlValue(asset.id)}`);
    lines.push(`  asset_name: ${yamlValue(asset.asset)}`);
    lines.push(`  biome: ${yamlValue(asset.theme)}`);
    lines.push(`  category: ${yamlValue(asset.category)}`);
    lines.push(`  scale_tier: ${yamlValue(asset.scaleTier)}`);
    lines.push(`  prompt_template: ${yamlValue(`${asset.theme}_v3`)}`);
    lines.push(`  status_expected: ${yamlValue(asset.status)}`);
    lines.push(`  credits_used: ${yamlValue(asset.consumedCredits)}`);
    lines.push(`  source_dir: ${yamlValue(asset.sourceDir)}`);
    lines.push(`  source_summary: ${yamlValue(asset.sourceSummary)}`);
    lines.push(`  concept: ${yamlValue(asset.evidenceConcept ?? '')}`);
    lines.push(`  preview: ${yamlValue(asset.evidencePreview ?? '')}`);
    lines.push(`  has_fbx: ${yamlValue(asset.hasFbx)}`);
    lines.push(`  has_glb: ${yamlValue(asset.hasGlb)}`);
    lines.push(`  has_material: ${yamlValue(asset.hasMaterial)}`);
  }
  return `${lines.join('\n')}\n`;
}

function renderPromptTemplates() {
  return `# Prompt template boundaries used for the portfolio dry-run.
forest_v3: "single game-ready 3D asset concept, stylized low-poly {descriptor}, forest palette, readable silhouette, no text, no people, no logo"
snow_v3: "single game-ready 3D asset concept, stylized low-poly {descriptor}, snow biome, cool palette, thick silhouette, no text, no people, no logo"
volcano_v3: "single game-ready 3D asset concept, stylized low-poly {descriptor}, volcano biome, lava glow, high contrast, no text, no people, no logo"
`;
}

function renderForbiddenPaths() {
  return `# Paths protected by the Unity integration quality gate.
forbidden:
  - "ProjectSettings/TagManager.asset"
  - "Assets/AnimatorController/"
  - "Assets/Scripts/Assembly-CSharp/MonsterType.cs"
  - "Assets/GameObject/"
allowed_prefix:
  - "Assets/_PalReskin/MeshyImported/"
  - "Assets/_PalReskin/GeneratedMaterials/"
`;
}

async function main() {
  if (!await exists(meshyRoot)) {
    throw new Error(`MeshyImported directory not found: ${meshyRoot}`);
  }

  for (const dir of [summariesRoot, previewsRoot, publicAssetRoot, publicEvidenceRoot, path.dirname(manifestPath)]) {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
  }

  const summaryPaths = (await walk(meshyRoot))
    .filter((filePath) => path.basename(filePath) === 'meshy_task_summary.json')
    .sort((a, b) => a.localeCompare(b));

  const assets = [];
  for (const summaryPath of summaryPaths) {
    assets.push(await readAsset(summaryPath));
  }

  assets.sort((a, b) => {
    const themeDelta = themeOrder.indexOf(a.theme) - themeOrder.indexOf(b.theme);
    return themeDelta || a.asset.localeCompare(b.asset);
  });

  const totalCredits = assets.reduce((sum, asset) => sum + asset.consumedCredits, 0);
  const summary = {
    totalAssets: assets.length,
    succeededAssets: assets.filter((asset) => asset.status === 'SUCCEEDED').length,
    failedAssets: assets.filter((asset) => asset.status === 'FAILED').length,
    totalCredits,
    averageCredits: assets.length ? Number((totalCredits / assets.length).toFixed(1)) : 0,
    byTheme: assets.reduce((acc, asset) => {
      acc[asset.theme] = (acc[asset.theme] ?? 0) + 1;
      return acc;
    }, {}),
    generatedAt: new Date().toISOString(),
  };

  const tsAssets = assets.map(({ sourceFiles, scaleTier, sourceSummary, evidencePreview, evidenceConcept, ...asset }) => asset);
  const typeScript = `import type { PipelineAsset, PipelineSummary } from '../types';\n\n`
    + `export const pipelineAssets: PipelineAsset[] = ${JSON.stringify(tsAssets, null, 2)};\n\n`
    + `export const pipelineSummary: PipelineSummary = ${JSON.stringify(summary, null, 2)};\n`;

  await fs.writeFile(dataPath, typeScript, 'utf8');
  await fs.writeFile(manifestPath, renderManifest(assets), 'utf8');
  await fs.writeFile(budgetPath, `total_credit_limit: 1800\nobserved_total_credits: ${totalCredits}\nretry_cap_per_asset: 3\nforest_credit_limit: 800\nsnow_credit_limit: 600\nvolcano_credit_limit: 400\n`, 'utf8');
  await fs.writeFile(templatesPath, renderPromptTemplates(), 'utf8');
  await fs.writeFile(forbiddenPath, renderForbiddenPaths(), 'utf8');
  await fs.writeFile(path.join(evidenceRoot, 'metrics.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(evidenceRoot, 'source-file-inventory.json'), `${JSON.stringify({
    unityRoot: path.basename(unityRoot),
    generatedAt: summary.generatedAt,
    assets: assets.map(({ sourceFiles, ...asset }) => ({
      asset: asset.asset,
      theme: asset.theme,
      sourceDir: asset.sourceDir,
      copiedSummary: asset.sourceSummary,
      copiedConcept: asset.evidenceConcept,
      copiedPreview: asset.evidencePreview,
      sourceFiles,
    })),
  }, null, 2)}\n`, 'utf8');
  await fs.copyFile(path.join(evidenceRoot, 'metrics.json'), path.join(publicEvidenceRoot, 'metrics.json'));

  console.log(`Exported ${summary.totalAssets} assets, ${summary.totalCredits} credits from ${meshyRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
