from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class GateResult:
    name: str
    passed: bool
    detail: str


THEME_NAME_PREFIXES = {
    "forest": ("forest_",),
    "snow": ("snow_", "snowman_", "frozen_", "frosted_", "ice_"),
    "volcano": ("volcano_", "lava_", "magma_", "obsidian_", "ember_", "charred_", "steam_"),
    "base": ("base_",),
}


def parse_bool(value: object) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"true", "yes", "1"}


def expected_file_exists(repo_root: Path, relative_path: str | None) -> bool:
    if not relative_path:
        return False
    return (repo_root / relative_path).is_file()


def theme_name_compatible(asset_name: str, biome: str) -> bool:
    prefixes = THEME_NAME_PREFIXES.get(biome)
    if not prefixes:
        return False
    return asset_name.startswith(prefixes)


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
            "theme_name_compatible",
            theme_name_compatible(asset_name, biome),
            f"{asset_name} / {biome}",
        ),
        GateResult(
            "unity_diff_scope",
            source_dir.startswith("Assets/_PalReskin/MeshyImported/"),
            source_dir,
        ),
    ]
    return results
