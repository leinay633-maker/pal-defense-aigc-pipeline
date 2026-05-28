from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class GateResult:
    name: str
    passed: bool
    detail: str


def parse_bool(value: object) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"true", "yes", "1"}


def expected_file_exists(repo_root: Path, relative_path: str | None) -> bool:
    if not relative_path:
        return False
    return (repo_root / relative_path).is_file()


def run_asset_gates(asset: dict[str, object], repo_root: Path) -> list[GateResult]:
    asset_name = str(asset.get("asset_name", ""))
    biome = str(asset.get("biome", ""))
    source_dir = str(asset.get("source_dir", ""))
    credits_used = int(asset.get("credits_used", 0))

    results = [
        GateResult(
            "summary_exists",
            expected_file_exists(repo_root, str(asset.get("source_summary", ""))),
            str(asset.get("source_summary", "")),
        ),
        GateResult(
            "status_succeeded",
            str(asset.get("status_expected", "")) == "SUCCEEDED",
            str(asset.get("status_expected", "")),
        ),
        GateResult(
            "credits_recorded",
            credits_used > 0,
            f"{credits_used} credits",
        ),
        GateResult(
            "visual_evidence",
            expected_file_exists(repo_root, str(asset.get("concept", "")))
            or expected_file_exists(repo_root, str(asset.get("preview", ""))),
            "concept or preview image copied",
        ),
        GateResult(
            "source_inventory_flags",
            parse_bool(asset.get("has_fbx")) and parse_bool(asset.get("has_glb")) and parse_bool(asset.get("has_material")),
            f"fbx={asset.get('has_fbx')} glb={asset.get('has_glb')} material={asset.get('has_material')}",
        ),
        GateResult(
            "name_matches_biome",
            asset_name.startswith(f"{biome}_") or biome in {"base", "snow", "volcano"},
            f"{asset_name} / {biome}",
        ),
        GateResult(
            "unity_diff_scope",
            source_dir.startswith("Assets/_PalReskin/MeshyImported/"),
            source_dir,
        ),
    ]
    return results

