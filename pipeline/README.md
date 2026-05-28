# Pipeline Module

`pipeline/` contains the public dry-run version of the Pal Defense AIGC asset workflow. It does not call Meshy, Blender, Unity, or Git. Instead, it replays the same task shape from exported evidence so the state machine, gates, budget guard, and artifact reports can be checked quickly.

## Layout

| Path | Purpose |
| --- | --- |
| `orchestrator.py` | Reads the manifest, applies gates, writes run and artifact reports. |
| `gates.py` | Deterministic checks for summaries, credits, visual evidence, source inventory flags, naming, and Unity diff scope. |
| `config/asset_manifest.yaml` | Exported asset task records. |
| `config/budget_config.yaml` | Credit limit and retry cap used by dry-run validation. |
| `config/prompt_templates.yaml` | Prompt boundary examples used for the three biome batches. |
| `config/forbidden_unity_paths.yaml` | Protected Unity paths used by the diff-scope gate. |
| `reports/` | Generated output directory, ignored by Git. |

## Run

```powershell
python -m pipeline.orchestrator --dry-run --manifest pipeline/config/asset_manifest.yaml --budget pipeline/config/budget_config.yaml --out pipeline/reports/run_report.json
```

Expected result:

```text
Dry-run complete: 53/53 assets committed, 1575/1800 credits.
```

Generated reports:

| Report | Content |
| --- | --- |
| `pipeline/reports/run_report.json` | Batch-level state, credit, biome, and pass/fail summary. |
| `pipeline/reports/asset_artifacts.json` | Per-asset task record and artifact manifest. |
| `pipeline/reports/quality_gate_report.json` | Per-asset gate results. |
