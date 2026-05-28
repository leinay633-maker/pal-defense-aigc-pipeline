# Evidence Map

这份文件把面试知识库里的关键主张映射到公开仓库中可检查的证据。公开仓库只保留轻量证据和可运行样例，不上传完整 Unity 工程。

| 知识库主张 | 公开证据 |
| --- | --- |
| 约 53 个资产进入 Unity 工程 | `evidence/meshy-summaries/` 下 53 个 summary；`evidence/metrics.json` 的 `totalAssets` |
| 覆盖 forest / snow / volcano 三个 biome | `pipeline/config/asset_manifest.yaml` 的 `biome` 字段；Dashboard 的 theme filter |
| Meshy 生成链路真实存在 | 每个 `meshy_task_summary.json` 保存 `text_to_image_task`、`image_to_3d_task`、`prompt`、`status`、`consumed_credits` |
| 当前 credits 统计为 1575 | `evidence/metrics.json` 与 `src/data/generatedAssets.ts` 的 `totalCredits` |
| Prompt 由模板约束风格边界 | `pipeline/config/prompt_templates.yaml` 和每个 summary 中的真实 prompt |
| 每个资产有 artifact manifest 思路 | `npm run pipeline:dry-run` 生成 `pipeline/reports/asset_artifacts.json` |
| 自动质量门槛 | `pipeline/gates.py` 检查 summary、status、credits、预览图、FBX/GLB/material 标记和 Unity diff scope |
| 预算守卫 | `pipeline/config/budget_config.yaml` 和 `pipeline/reports/run_report.json` |
| Unity 工程禁止清单 | `pipeline/config/forbidden_unity_paths.yaml` |
| 人工 Review | Dashboard 中的 approve / reject / retry 状态和资产详情面板 |
| 不公开完整 Unity / 第三方模型 | `.gitignore`、`evidence/source-file-inventory.json` 只记录 hash 和大小，FBX/GLB 原文件不复制到公开证据目录 |

## 本地验证步骤

```powershell
npm install
npm run pipeline:dry-run
npm run build
```

`pipeline:dry-run` 应输出：

```text
Dry-run complete: 53/53 assets committed, 1575/1800 credits.
```

生成的 `pipeline/reports/quality_gate_report.json` 可以逐资产检查每一道自动 gate。

