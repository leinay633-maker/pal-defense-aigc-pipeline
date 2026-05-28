# Runbook

## Fresh Clone

```powershell
npm ci
npm run verify
npm run dev
```

The dashboard runs at `http://127.0.0.1:5174/` by default.

## Verification Chain

`npm run verify` runs four checks:

| Step | Command | Purpose |
| --- | --- | --- |
| Evidence check | `node scripts/check-evidence.mjs` | Confirms metrics, manifest, summaries, public images, and wording boundaries match. |
| Python tests | `python -m unittest discover -s tests` | Tests manifest loading, budget limits, gates, and dry-run report writing. |
| Pipeline dry-run | `python -m pipeline.orchestrator --dry-run ...` | Generates batch, artifact, and gate reports. |
| Build | `tsc -b && vite build` | Validates the dashboard TypeScript build. |

## Refresh Evidence From The Local Unity Project

```powershell
npm run refresh:evidence -- --unity-root "D:\OneDrive\GameEXE\新建文件夹\AVZ_YesterdayNight_86abe3b"
npm run verify
```

The export script regenerates:

- `evidence/meshy-summaries/`
- `evidence/previews/`
- `public/pipeline-assets/`
- `public/evidence/metrics.json`
- `src/data/generatedAssets.ts`
- `pipeline/config/asset_manifest.yaml`
- `pipeline/config/budget_config.yaml`

## Generated Files

`pipeline/reports/` is ignored by Git. Remove it any time you want a clean dry-run output:

```powershell
Remove-Item -Recurse -Force pipeline\reports
npm run pipeline:dry-run
```

## CI

GitHub Actions runs `npm run verify` before publishing the dashboard to GitHub Pages. A deployment should only happen after evidence checks, Python tests, dry-run, and TypeScript build all pass.
