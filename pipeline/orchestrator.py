from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .gates import GateResult, run_asset_gates


PIPELINE_STATES = [
    "PENDING",
    "PROMPT_READY",
    "MESHY_RUNNING",
    "MODEL_READY",
    "BLENDER_CHECKED",
    "UNITY_STAGED",
    "AUTO_GATE_PASSED",
    "HUMAN_REVIEW_PENDING",
    "APPROVED",
    "COMMITTED",
]


def parse_scalar(value: str) -> Any:
    text = value.strip()
    if not text:
        return ""
    if text.startswith('"') and text.endswith('"'):
        return text[1:-1].replace('\\"', '"').replace("\\\\", "\\")
    if text.lower() == "true":
        return True
    if text.lower() == "false":
        return False
    try:
        return int(text)
    except ValueError:
        return text


def load_manifest(path: Path) -> list[dict[str, Any]]:
    assets: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("- "):
            if current is not None:
                assets.append(current)
            current = {}
            key, value = stripped[2:].split(":", 1)
            current[key.strip()] = parse_scalar(value)
            continue
        if current is None or ":" not in stripped:
            continue
        key, value = stripped.split(":", 1)
        current[key.strip()] = parse_scalar(value)

    if current is not None:
        assets.append(current)
    return assets


def load_budget(path: Path) -> dict[str, Any]:
    budget: dict[str, Any] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#") or ":" not in stripped:
            continue
        key, value = stripped.split(":", 1)
        budget[key.strip()] = parse_scalar(value)
    return budget


def gate_payload(results: list[GateResult]) -> list[dict[str, Any]]:
    return [
        {
            "name": item.name,
            "passed": item.passed,
            "detail": item.detail,
        }
        for item in results
    ]


def task_record(asset: dict[str, Any], gates: list[GateResult], retry_cap: int) -> dict[str, Any]:
    passed = all(item.passed for item in gates)
    status = "COMMITTED" if passed else "MANUAL_QUEUE"
    states = PIPELINE_STATES if passed else ["PENDING", "PROMPT_READY", "MESHY_RUNNING", "MODEL_READY", "AUTO_GATE_FAILED"]

    return {
        "task_id": asset["task_id"],
        "asset_name": asset["asset_name"],
        "biome": asset["biome"],
        "category": asset["category"],
        "scale_tier": asset["scale_tier"],
        "prompt_template_version": asset["prompt_template"],
        "status": status,
        "attempt": 1 if passed else retry_cap,
        "retry_cap": retry_cap,
        "credits_used": asset["credits_used"],
        "states_visited": states,
        "artifacts": {
            "source_summary": asset["source_summary"],
            "concept": asset.get("concept", ""),
            "preview": asset.get("preview", ""),
            "unity_source_dir": asset["source_dir"],
        },
        "quality_report": {
            "auto_gate_passed": passed,
            "blocked_diff": not any(item.name == "unity_diff_scope" and item.passed for item in gates),
            "gates": gate_payload(gates),
        },
    }


def run(manifest_path: Path, budget_path: Path, out_path: Path) -> int:
    repo_root = manifest_path.resolve().parents[2]
    assets = load_manifest(manifest_path)
    budget = load_budget(budget_path)
    retry_cap = int(budget.get("retry_cap_per_asset", 3))

    task_records = []
    gate_reports = []
    for asset in assets:
        gates = run_asset_gates(asset, repo_root)
        task_records.append(task_record(asset, gates, retry_cap))
        gate_reports.append({
            "task_id": asset["task_id"],
            "asset_name": asset["asset_name"],
            "passed": all(item.passed for item in gates),
            "gates": gate_payload(gates),
        })

    total_credits = sum(int(asset["credits_used"]) for asset in assets)
    credit_limit = int(budget.get("total_credit_limit", 0))
    budget_passed = credit_limit == 0 or total_credits <= credit_limit
    committed = sum(1 for task in task_records if task["status"] == "COMMITTED")

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "dry-run",
        "total_assets": len(assets),
        "committed_assets": committed,
        "manual_queue_assets": len(assets) - committed,
        "total_credits": total_credits,
        "budget_limit": credit_limit,
        "budget_passed": budget_passed,
        "retry_cap_per_asset": retry_cap,
        "by_biome": {},
        "state_machine": PIPELINE_STATES,
    }
    for asset in assets:
        report["by_biome"][asset["biome"]] = report["by_biome"].get(asset["biome"], 0) + 1

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    (out_path.parent / "asset_artifacts.json").write_text(json.dumps(task_records, indent=2), encoding="utf-8")
    (out_path.parent / "quality_gate_report.json").write_text(json.dumps(gate_reports, indent=2), encoding="utf-8")

    print(f"Dry-run complete: {committed}/{len(assets)} assets committed, {total_credits}/{credit_limit} credits.")
    return 0 if committed == len(assets) and budget_passed else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the public AIGC Pipeline dry-run.")
    parser.add_argument("--dry-run", action="store_true", help="Required marker: this sample does not call external APIs.")
    parser.add_argument("--manifest", default="pipeline/config/asset_manifest.yaml")
    parser.add_argument("--budget", default="pipeline/config/budget_config.yaml")
    parser.add_argument("--out", default="pipeline/reports/run_report.json")
    args = parser.parse_args()

    if not args.dry_run:
        parser.error("Only --dry-run mode is implemented in the public sample.")

    return run(Path(args.manifest), Path(args.budget), Path(args.out))


if __name__ == "__main__":
    raise SystemExit(main())
