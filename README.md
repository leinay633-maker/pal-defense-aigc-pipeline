# Pal Defense AIGC Pipeline

这是一个 AIGC 游戏资产生产 Pipeline 项目。项目背景是 Unity 塔防 Demo《帕鲁保卫战》：我把资产清单、LLM Prompt、Meshy、Blender、Unity Editor 脚本、质量门槛、人工 Review 和 Git 追溯串成一条可验证的工程流程。

公开仓库不上传完整 Unity 工程和大体积第三方模型，而是上传能验证 Pipeline 事实的轻量证据：53 个 Meshy task summary、资产预览图、source inventory hash、Review Dashboard，以及一个可本地运行的 dry-run orchestrator。

## 核心结果

| 指标 | 当前公开证据口径 |
| --- | --- |
| 入库资产 | 53 个 |
| 主题覆盖 | forest 25 / snow 18 / volcano 10 |
| Meshy credits | 1575 |
| 平均 credits | 29.7 / asset |
| 状态 | 53 个 Meshy summary 均为 SUCCEEDED |
| 展示方式 | React Review Dashboard + evidence map + dry-run Pipeline |

## 仓库内容

| 路径 | 作用 |
| --- | --- |
| `src/` | React + TypeScript Review Dashboard |
| `public/pipeline-assets/` | Dashboard 使用的 concept / preview 图 |
| `evidence/meshy-summaries/` | 53 个原始 Meshy task summary |
| `evidence/previews/` | 公开预览图证据 |
| `evidence/source-file-inventory.json` | 本地 Unity 源资产文件清单、大小和 hash |
| `pipeline/config/` | 资产清单、预算、Prompt 模板、Unity 禁止清单 |
| `pipeline/orchestrator.py` | 公开版 dry-run 状态机 |
| `pipeline/gates.py` | 自动质量门槛检查 |
| `docs/evidence-map.md` | 知识库主张到公开文件的映射 |

## 本地验证

```powershell
npm install
npm run pipeline:dry-run
npm run build
npm run dev
```

打开 `http://127.0.0.1:5174/` 查看 Dashboard。

如需从 Unity 工程重新导出证据：

```powershell
npm run refresh:evidence -- --unity-root "D:\OneDrive\GameEXE\新建文件夹\AVZ_YesterdayNight_86abe3b"
```

## Pipeline 设计

```text
asset manifest
  -> task record
  -> prompt evidence
  -> Meshy summary
  -> Blender/Unity dry-run gate
  -> human review state
  -> artifact manifest
  -> report
```

公开版 `pipeline/orchestrator.py` 不调用外部 API，也不写 Unity 工程。它只用公开证据复现 Pipeline 的状态机、预算守卫、artifact manifest 和自动 gate，方便在本地快速验证架构。

## 表述边界

- 这是个人 Demo / 技术验证，不是商业发行项目。
- 我没有训练 3D 生成模型，重点是把现成 AIGC 能力工程化接入工具链。
- 公开仓库里的 dry-run Pipeline 是 public dry-run sample，用来验证架构和数据流，不伪装成原始生产脚本。
- 完整 Unity 工程、大体积 build、视频素材和第三方模型源文件不放入公开仓库。
