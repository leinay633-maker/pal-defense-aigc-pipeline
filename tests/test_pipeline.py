import json
import tempfile
import unittest
from pathlib import Path

from pipeline.gates import run_asset_gates
from pipeline.orchestrator import load_budget, load_manifest, run


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "pipeline" / "config" / "asset_manifest.yaml"
BUDGET = ROOT / "pipeline" / "config" / "budget_config.yaml"
METRICS = ROOT / "evidence" / "metrics.json"


class PipelineDryRunTests(unittest.TestCase):
    def test_manifest_matches_metrics(self):
        assets = load_manifest(MANIFEST)
        metrics = json.loads(METRICS.read_text(encoding="utf-8"))

        self.assertEqual(len(assets), metrics["totalAssets"])
        self.assertEqual(sum(int(asset["credits_used"]) for asset in assets), metrics["totalCredits"])
        self.assertEqual(len({asset["task_id"] for asset in assets}), len(assets))

    def test_budget_config_tracks_observed_credits(self):
        assets = load_manifest(MANIFEST)
        budget = load_budget(BUDGET)

        self.assertEqual(sum(int(asset["credits_used"]) for asset in assets), budget["observed_total_credits"])
        self.assertLessEqual(budget["observed_total_credits"], budget["total_credit_limit"])
        self.assertEqual(budget["retry_cap_per_asset"], 3)

    def test_asset_gates_pass_for_manifest(self):
        assets = load_manifest(MANIFEST)
        for asset in assets:
            with self.subTest(asset=asset["task_id"]):
                gates = run_asset_gates(asset, ROOT)
                self.assertTrue(all(gate.passed for gate in gates), [gate for gate in gates if not gate.passed])

    def test_dry_run_writes_reports(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            report_path = Path(temp_dir) / "run_report.json"
            exit_code = run(MANIFEST, BUDGET, report_path)

            self.assertEqual(exit_code, 0)
            report = json.loads(report_path.read_text(encoding="utf-8"))
            artifacts = json.loads((report_path.parent / "asset_artifacts.json").read_text(encoding="utf-8"))
            gate_report = json.loads((report_path.parent / "quality_gate_report.json").read_text(encoding="utf-8"))

            self.assertEqual(report["mode"], "dry-run")
            self.assertEqual(report["total_assets"], 53)
            self.assertEqual(report["manual_queue_assets"], 0)
            self.assertTrue(report["budget_passed"])
            self.assertEqual(len(artifacts), report["total_assets"])
            self.assertEqual(len(gate_report), report["total_assets"])


if __name__ == "__main__":
    unittest.main()
