# Architecture

This project keeps the public repository small while preserving the core shape of the AIGC asset Pipeline.

```text
Unity source export
  -> evidence summaries and preview images
  -> asset manifest
  -> dry-run orchestrator
  -> deterministic gates
  -> React review dashboard
  -> GitHub Pages deployment
```

## Components

| Component | Role |
| --- | --- |
| Evidence export | `scripts/export-evidence.mjs` copies Meshy summaries and preview images from the local Unity project, then generates metrics, manifest, and dashboard data. |
| Manifest | `pipeline/config/asset_manifest.yaml` is the replayable task list for the public dry-run. |
| Orchestrator | `pipeline/orchestrator.py` replays task state transitions, applies gates, checks budget limits, and writes reports. |
| Gates | `pipeline/gates.py` checks evidence existence, Meshy status, credits, visual proof, source inventory flags, naming, and Unity diff scope. |
| Dashboard | `src/` renders a local review surface over the generated asset data. |
| Verification | `npm run verify` runs evidence consistency checks, Python unit tests, the dry-run, and the TypeScript build. |

## Data Boundary

The repository includes lightweight evidence:

- Meshy task summaries.
- Concept and preview images.
- Source file inventory with sizes and hashes.
- Config files needed by the dry-run.

The repository excludes the full Unity project, large model binaries, Unity Library output, editor caches, and generated dry-run reports.

## Execution Boundary

The public dry-run is intentionally deterministic. External systems are represented by exported evidence:

| Original system | Public replacement |
| --- | --- |
| LLM prompt generation | Prompt text in Meshy summaries and prompt template config. |
| Meshy API | Exported task summaries. |
| Blender CLI | Source inventory flags and visual evidence checks. |
| Unity batchmode | Diff-scope and source directory gates. |
| Git commit per asset | `COMMITTED` dry-run terminal state. |

This keeps the public project runnable without credentials or Unity installation while still validating the project data flow.
