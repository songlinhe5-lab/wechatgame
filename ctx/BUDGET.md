# 上下文预算报表（ctx/BUDGET.md）

> 生成：2026-10-26 · 由 `tools/scripts/build-context-index.mjs` 自动生成，**请勿手改**。
> token 为**估算值**（CJK≈1/字、ASCII≈1/4 字符；非精确 tokenizer），仅用于排行与阈值护栏。
> 面向 agent 的阅读入口是 `ctx/ROUTES.md`；本表用于**人**复核预算与超限。

## 1. 常驻层体积（always-on）

| 文件 | 估算 tokens | 行数 | 上限 | 状态 |
|---|---:|---:|---:|:--:|
| `AGENTS.md` | 1837 | 107 | 2000 | ✅ |
| `my-rules/INDEX.md` | 254 | 20 | 500 | ✅ |
| `my-rules/agents-md.md` | 483 | 27 | 500 | ✅ |
| `ctx/hot-files.md` | 5185 | 164 | 5600 | ✅ |
| `ctx/ROUTES.md` | 5165 | 177 | 7500 | ✅ |

> AGENTS.md 常驻阈值 **2000**（CJK 口径校准，WXG-T-024）：原 3000 疑似 bytes/4 口径，与本表 token 估算公式（CJK≈1/字、ASCII≈1/4 字符）不一致；3200 在现状之上留 ≈7% 余量。
> `ctx/ROUTES.md` 常驻阈值 **7500**（WXG-T-039 R5）：现值 6235 之上留 ≈20% 余量，且低于 B 项默认单文件上限 8000（spec 档）——ROUTES 是手维护路由表（非生成物、无生成器控量），本门与门禁 A 项是其唯一硬护栏。
> **常驻总量**（AGENTS.md + my-rules/* + ctx/hot-files.md + ctx/ROUTES.md，每次会话固定开销）= **12924** 估算 tokens（观察哨软阈值 ≤ 13500）：单文件上限各自为政时总量仍可漂移，本行仅观察提示、不阻断；硬阻断只挂各单文件门。

## 2. Top 20 大文件（估算 tokens）

| # | 文件 | tokens | 行数 | tier |
|---:|---|---:|---:|:--:|
| 1 | `production/TASKS-DETAIL.md` | 146821 | 4533 | normal |
| 2 | `games/beads/design/art/specs/assets-spec.md` | 120024 | 2105 | normal |
| 3 | `production/qa/beads/g4-regression-report.md` | 86807 | 2201 | normal |
| 4 | `production/TASKS.md` | 65579 | 124 | hot |
| 5 | `games/beads/design/gdd/systems-index-changelog.md` | 48836 | 101 | normal |
| 6 | `games/beads/design/ux/ux-spec.md` | 48138 | 518 | normal |
| 7 | `docs/architecture/adr/ADR-0030-beads-cocos-production-blit-carrier.md` | 45150 | 1307 | normal |
| 8 | `games/beads/design/proposals/bead-visual-style-spec.md` | 43650 | 1206 | normal |
| 9 | `docs/architecture/adr/ADR-0034-beads-save-uid-index-flatten.md` | 41181 | 502 | normal |
| 10 | `games/beads/design/levels/levels-spec.md` | 39215 | 900 | normal |
| 11 | `games/beads/design/art/specs/art-bible.md` | 37416 | 528 | normal |
| 12 | `games/beads/design/art/specs/accessibility.md` | 36455 | 200 | normal |
| 13 | `games/beads/design/gdd/systems-index.md` | 36357 | 307 | hot |
| 14 | `games/beads/design/art/proposals/ui-style-redesign/menu-architecture.md` | 36027 | 947 | normal |
| 15 | `memory/2026-10-04.md` | 28255 | 930 | normal |
| 16 | `games/beads/design/gdd/save-progress.md` | 25764 | 304 | normal |
| 17 | `games/beads/design/gdd/input-control.md` | 19568 | 206 | normal |
| 18 | `games/beads/design/ux/arc-level-select-spec.md` | 18524 | 269 | normal |
| 19 | `memory/details/2026-10-03-s01-t226.md` | 17901 | 548 | normal |
| 20 | `production/qa/beads/wxg-t-228-tint-criteria.md` | 16868 | 444 | normal |

## 3. 超限清单（超过所属类别上限）

> 上限按文档类别分档（WXG-T-377）：**spec 8000**（判据/规格/提案/ADR/GDD/UX/skill，未放松）/ **ledger 16000**（追加型台账：Epic·QA·发布·计划·引擎版本记录）/ **generated 24000**（生成物）/ **TASKS.md 80000**、**TASKS-DETAIL.md 205000**（由 `archive-tasks.mjs` 治理）/ **vendor 免检**（`cocos-mcp-server` 目录，⛔ 不可改写）。

| 文件 | tokens | 类别 · 上限 | 处置 |
|---|---:|---:|:--:|
| `games/beads/design/art/specs/assets-spec.md` | 120024 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `production/qa/beads/g4-regression-report.md` | 86807 | ledger · 16000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/systems-index-changelog.md` | 48836 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/ux/ux-spec.md` | 48138 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/ADR-0030-beads-cocos-production-blit-carrier.md` | 45150 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/proposals/bead-visual-style-spec.md` | 43650 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/ADR-0034-beads-save-uid-index-flatten.md` | 41181 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/levels/levels-spec.md` | 39215 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/art/specs/art-bible.md` | 37416 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/art/specs/accessibility.md` | 36455 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/systems-index.md` | 36357 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/art/proposals/ui-style-redesign/menu-architecture.md` | 36027 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `memory/2026-10-04.md` | 28255 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/save-progress.md` | 25764 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/input-control.md` | 19568 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/ux/arc-level-select-spec.md` | 18524 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `memory/details/2026-10-03-s01-t226.md` | 17901 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `production/qa/beads/wxg-t-228-tint-criteria.md` | 16868 | ledger · 16000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/IMPACT-0020a-beads-unit-5mm32-vs-render-50-52.md` | 16757 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `production/qa/beads/render-perf-device-baseline.md` | 16703 | ledger · 16000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/proposals/beads-studio-density-tiers.md` | 15894 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/proposals/sec3-5mm32-render-base-change.md` | 15465 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/ADR-0020-beads-board-debug-zoom-focus.md` | 15152 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/art/specs/menu-wall-signage-spec.md` | 14763 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/proposals/level-content-pipeline.md` | 14559 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/art/proposals/ui-style-redesign/level-difficulty.md` | 14300 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/audio/audio-spec.md` | 14272 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/proposals/star-economy-and-retention.md` | 14094 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/ui-architecture-beads.md` | 13872 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/ADR-0022-beads-custom-material-shader-feasibility.md` | 13644 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/ADR-0023-beads-procedural-bead-style-plugin.md` | 13563 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/proposals/sec3-5mm32-render-base-change-final.md` | 13335 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/ADR-0015-beads-board-zoom-pan-input.md` | 12909 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/bead-grid.md` | 12184 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/proposals/bead-style-16-19-semantics.md` | 11661 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `my-skills/writing-skills/anthropic-best-practices.md` | 11532 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/ADR-0024-render-model-polygon-value-copy.md` | 11422 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/pause-settings.md` | 11162 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/proposals/sec3-color-max-35-and-mis-max.md` | 10521 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/art/specs/tint-mask-asset-spec.md` | 10247 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/meta-ui.md` | 10203 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/core-loop.md` | 9516 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/control-manifest.md` | 9486 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/audio/audio-events.md` | 9482 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/art/specs/menu-showcase-asset-spec.md` | 9148 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/art/specs/menu-layout-implementation-spec.md` | 8836 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/art/proposals/ui-style-redesign/risks.md` | 8560 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/audio/bgm-main-composition.md` | 8518 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/ADR-0011-screen-coordinate-space-contract.md` | 8446 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/ADR-0018-beads-board-size-playability.md` | 8414 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `my-skills/subagent-driven-development/SKILL.md` | 8058 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/art/proposals/ui-style-redesign/art-bible-proposal.md` | 8023 | spec · 8000 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |

## 4. 真实最常用章节与分布加权节省率（估算）

> 数据源：`ctx/usage-distribution.json`（真实读事件账本），样本 **457** 次读取 / 20 会话；token 一律为**估算**。

| # | 锚点 | 文件 | 命中读数 | 归属估算 tokens |
|---:|---|---|---:|---:|
| 1 | `§系统清单与依赖索引（Systems Index）` | `games/breakout/design/gdd/systems-index.md` | 16 | 73360 |
| 2 | `§系统清单与依赖索引（Systems Index）· beads` | `games/beads/design/gdd/systems-index.md` | 15 | 94560 |
| 3 | `§《弹球打砖块》一页纸概念（Concept One-Pager）` | `games/breakout/design/concept.md` | 15 | 46365 |
| 4 | `§3 全局数值基线（Global Constants）· ❄️ 冻结令` | `games/breakout/design/gdd/systems-index.md` | 15 | 39840 |
| 5 | `§AGENTS.md — wechatgame 项目级 Agent 指引` | `AGENTS.md` | 14 | 24206 |
| 6 | `§3 全局数值基线（Global Constants）· ❄️ 冻结令` | `games/beads/design/gdd/systems-index.md` | 13 | 39455 |
| 7 | `§wxgame GDD 编写法（工作室验证过的四件套流程）` | `my-skills/wxgame-gdd-writer/SKILL.md` | 13 | 14599 |
| 8 | `§7 范围分层（Scope Layering）` | `games/breakout/design/concept.md` | 13 | 8112 |
| 9 | `§3.1 画布、坐标与安全区` | `games/breakout/design/gdd/systems-index.md` | 13 | 5005 |
| 10 | `§6 心流与难度曲线思路` | `games/breakout/design/concept.md` | 13 | 4251 |
| 11 | `§MVP（必须，Demo 验收线）` | `games/breakout/design/concept.md` | 13 | 3757 |
| 12 | `§3.3 砖块网格（Brick Grid）` | `games/breakout/design/gdd/systems-index.md` | 13 | 2886 |
| 13 | `§总流程（顺序执行，前一步是后一步的输入）` | `my-skills/wxgame-gdd-writer/SKILL.md` | 13 | 1092 |
| 14 | `§4 MDA 分析（Mechanics → Dynamics → Aesthetics）` | `games/breakout/design/concept.md` | 12 | 6432 |
| 15 | `§3.4 挡板与球` | `games/breakout/design/gdd/systems-index.md` | 12 | 2760 |

**真实分布加权节省率**（估算）：Σ 实际读入 **721893** ÷ Σ 全文 **1189148** = **39.3%**（样本 456 次读取）

> 单次节省率：含整文件读的整体中位数 0.0%、仅局部读中位数 75.8%、仅局部读 P10 45.4%——护栏与阈值见 `pnpm run ctx:check` E 项。
