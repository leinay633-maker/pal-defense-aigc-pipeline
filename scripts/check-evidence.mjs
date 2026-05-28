import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const manifestPath = path.join(repoRoot, 'pipeline', 'config', 'asset_manifest.yaml');
const metricsPath = path.join(repoRoot, 'evidence', 'metrics.json');
const inventoryPath = path.join(repoRoot, 'evidence', 'source-file-inventory.json');
const generatedDataPath = path.join(repoRoot, 'src', 'data', 'generatedAssets.ts');
const summariesRoot = path.join(repoRoot, 'evidence', 'meshy-summaries');

const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
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

function parseScalar(value) {
  const text = value.trim();
  if (!text) return '';
  if (text.startsWith('"') && text.endsWith('"')) {
    return JSON.parse(text);
  }
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+$/.test(text)) return Number(text);
  return text;
}

function loadManifest(text) {
  const assets = [];
  let current;

  for (const rawLine of text.split(/\r?\n/)) {
    const stripped = rawLine.trim();
    if (!stripped || stripped.startsWith('#')) continue;

    if (stripped.startsWith('- ')) {
      if (current) assets.push(current);
      current = {};
      const [key, ...rest] = stripped.slice(2).split(':');
      current[key.trim()] = parseScalar(rest.join(':'));
      continue;
    }

    if (!current || !stripped.includes(':')) continue;
    const [key, ...rest] = stripped.split(':');
    current[key.trim()] = parseScalar(rest.join(':'));
  }

  if (current) assets.push(current);
  return assets;
}

function extractExport(source, name) {
  const marker = `export const ${name}`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Missing export: ${name}`);
  }

  const equalsIndex = source.indexOf('=', markerIndex);
  const endIndex = source.indexOf(';\n', equalsIndex);
  return JSON.parse(source.slice(equalsIndex + 1, endIndex).trim());
}

function repoPath(relativePath) {
  return path.join(repoRoot, String(relativePath).split('/').join(path.sep));
}

function publicAssetPath(urlPath) {
  const parts = String(urlPath).split('/').map((part) => decodeURIComponent(part));
  return path.join(repoRoot, 'public', ...parts);
}

async function assertNoPositioningTerms() {
  const blocked = [
    'port' + 'folio',
    'One' + 'Drive',
    'AVZ' + '_YesterdayNight',
    String.fromCodePoint(0x4f5c, 0x54c1, 0x96c6),
    String.fromCodePoint(0x6c42, 0x804c),
    String.fromCodePoint(0x6280, 0x672f, 0x9762, 0x8bd5),
    String.fromCodePoint(0x62db, 0x8058),
    String.fromCodePoint(0x9762, 0x8bd5, 0x5b98),
    String.fromCodePoint(0x9762, 0x8bd5, 0x77e5, 0x8bc6, 0x5e93),
  ];
  const roots = [
    path.join(repoRoot, 'README.md'),
    path.join(repoRoot, 'NOTICE.md'),
    path.join(repoRoot, 'docs'),
    path.join(repoRoot, 'pipeline'),
    path.join(repoRoot, 'scripts', 'export-evidence.mjs'),
    path.join(repoRoot, 'src'),
    path.join(repoRoot, 'package.json'),
    path.join(repoRoot, '.github'),
  ];
  const textExtensions = new Set(['.md', '.py', '.mjs', '.ts', '.tsx', '.json', '.yaml', '.yml']);

  const files = [];
  for (const root of roots) {
    const stat = await fs.stat(root);
    files.push(...(stat.isDirectory() ? await walk(root) : [root]));
  }

  for (const file of files) {
    if (!textExtensions.has(path.extname(file))) continue;
    const text = await fs.readFile(file, 'utf8');
    const normalized = text.toLowerCase();
    for (const phrase of blocked) {
      if (normalized.includes(phrase.toLowerCase())) {
        fail(`Blocked positioning term "${phrase}" found in ${path.relative(repoRoot, file)}`);
      }
    }
  }
}

async function main() {
  const manifest = loadManifest(await fs.readFile(manifestPath, 'utf8'));
  const metrics = await readJson(metricsPath);
  const inventory = await readJson(inventoryPath);
  const generatedSource = await fs.readFile(generatedDataPath, 'utf8');
  const generatedAssets = extractExport(generatedSource, 'pipelineAssets');
  const generatedSummary = extractExport(generatedSource, 'pipelineSummary');
  const summaryFiles = (await fs.readdir(summariesRoot)).filter((file) => file.endsWith('.json'));

  assert(manifest.length === metrics.totalAssets, `manifest has ${manifest.length} assets, metrics has ${metrics.totalAssets}`);
  assert(summaryFiles.length === metrics.totalAssets, `summary count ${summaryFiles.length} does not match metrics`);
  assert(generatedAssets.length === metrics.totalAssets, `generated TS has ${generatedAssets.length} assets`);
  assert(inventory.assets.length === metrics.totalAssets, `source inventory has ${inventory.assets.length} assets`);
  assert(inventory.sourceRootLabel === 'local-unity-export', 'source inventory should use a portable sourceRootLabel');
  assert(generatedSummary.totalCredits === metrics.totalCredits, 'generated summary credits diverge from metrics');

  const ids = new Set();
  let creditTotal = 0;
  const byTheme = {};

  for (const asset of manifest) {
    ids.add(asset.task_id);
    creditTotal += Number(asset.credits_used);
    byTheme[asset.biome] = (byTheme[asset.biome] ?? 0) + 1;

    assert(await exists(repoPath(asset.source_summary)), `missing summary: ${asset.source_summary}`);
    assert(
      await exists(repoPath(asset.concept)) || await exists(repoPath(asset.preview)),
      `missing visual evidence for ${asset.task_id}`,
    );

    const summary = await readJson(repoPath(asset.source_summary));
    assert(summary.asset === asset.asset_name, `summary asset mismatch for ${asset.task_id}`);
    assert(summary.status === asset.status_expected, `summary status mismatch for ${asset.task_id}`);
    assert(Number(summary.consumed_credits) === Number(asset.credits_used), `credits mismatch for ${asset.task_id}`);
    assert(String(summary.prompt ?? '').length > 40, `prompt is too short for ${asset.task_id}`);
  }

  assert(ids.size === manifest.length, 'task_id values must be unique');
  assert(creditTotal === metrics.totalCredits, `manifest credits ${creditTotal} do not match metrics ${metrics.totalCredits}`);

  for (const [theme, count] of Object.entries(byTheme)) {
    assert(metrics.byTheme[theme] === count, `theme count mismatch for ${theme}`);
  }

  for (const asset of generatedAssets) {
    if (asset.conceptUrl) assert(await exists(publicAssetPath(asset.conceptUrl)), `missing public concept image for ${asset.id}`);
    if (asset.previewUrl) assert(await exists(publicAssetPath(asset.previewUrl)), `missing public preview image for ${asset.id}`);
  }

  await assertNoPositioningTerms();

  if (failures.length) {
    console.error(failures.map((message) => `- ${message}`).join('\n'));
    process.exitCode = 1;
    return;
  }

  console.log(`Evidence check passed: ${manifest.length} assets, ${metrics.totalCredits} credits, ${summaryFiles.length} summaries.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
