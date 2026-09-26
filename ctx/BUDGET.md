# 上下文预算报表（ctx/BUDGET.md）

> 生成：2026-09-26 · 由 `tools/scripts/build-context-index.mjs` 自动生成，**请勿手改**。
> token 为**估算值**（CJK≈1/字、ASCII≈1/4 字符；非精确 tokenizer），仅用于排行与阈值护栏。
> 面向 agent 的阅读入口是 `ctx/ROUTES.md`；本表用于**人**复核预算与超限。

## 1. 常驻层体积（always-on）

| 文件 | 估算 tokens | 行数 | 上限 | 状态 |
|---|---:|---:|---:|:--:|
| `AGENTS.md` | 1989 | 123 | 2000 | ✅ |
| `my-rules/INDEX.md` | 254 | 20 | 500 | ✅ |
| `my-rules/agents-md.md` | 467 | 26 | 500 | ✅ |
| `ctx/hot-files.md` | 4788 | 82 | 4900 | ✅ |
| `ctx/ROUTES.md` | 6897 | 227 | 7500 | ✅ |

> AGENTS.md 常驻阈值 **2000**（CJK 口径校准，WXG-T-024）：原 3000 疑似 bytes/4 口径，与本表 token 估算公式（CJK≈1/字、ASCII≈1/4 字符）不一致；3200 在现状之上留 ≈7% 余量。
> `ctx/ROUTES.md` 常驻阈值 **7500**（WXG-T-039 R5）：现值 6235 之上留 ≈20% 余量，且低于 B 项通用单文件上限 8000——ROUTES 是手维护路由表（非生成物、无生成器控量），本门与门禁 A 项是其唯一硬护栏。
> **常驻总量**（AGENTS.md + my-rules/* + ctx/hot-files.md + ctx/ROUTES.md，每次会话固定开销）= **14395** 估算 tokens（观察哨软阈值 ≤ 13500，⚠️ 已超——请评估瘦身）：单文件上限各自为政时总量仍可漂移，本行仅观察提示、不阻断；硬阻断只挂各单文件门。

## 2. Top 20 大文件（估算 tokens）

| # | 文件 | tokens | 行数 | tier |
|---:|---|---:|---:|:--:|
| 1 | `games/beads/art/assets-spec.md` | 106974 | 1904 | normal |
| 2 | `production/qa/beads/g4-regression-report.md` | 86807 | 2201 | normal |
| 3 | `production/qa/beads/test-cases.md` | 62579 | 810 | hot |
| 4 | `production/TASKS-DETAIL.md` | 54609 | 906 | normal |
| 5 | `games/beads/art/accessibility.md` | 35669 | 200 | normal |
| 6 | `games/beads/design/ux/ux-spec.md` | 35334 | 422 | normal |
| 7 | `games/beads/art/art-bible.md` | 32288 | 492 | normal |
| 8 | `games/beads/design/gdd/systems-index-changelog.md` | 30390 | 69 | normal |
| 9 | `games/beads/design/proposals/bead-visual-style-spec.md` | 26098 | 764 | normal |
| 10 | `games/beads/design/levels/levels-spec.md` | 22859 | 527 | normal |
| 11 | `games/beads/design/gdd/systems-index.md` | 22263 | 297 | hot |
| 12 | `docs/architecture/adr/IMPACT-0020a-beads-unit-5mm32-vs-render-50-52.md` | 16757 | 487 | normal |
| 13 | `production/qa/beads/render-perf-device-baseline.md` | 16703 | 423 | normal |
| 14 | `games/beads/design/gdd/input-control.md` | 16339 | 197 | normal |
| 15 | `games/beads/design/proposals/beads-studio-density-tiers.md` | 15894 | 452 | normal |
| 16 | `games/beads/design/proposals/sec3-5mm32-render-base-change.md` | 15461 | 364 | normal |
| 17 | `docs/architecture/adr/ADR-0020-beads-board-debug-zoom-focus.md` | 15152 | 357 | normal |
| 18 | `games/beads/design/audio/audio-spec.md` | 13867 | 381 | normal |
| 19 | `docs/architecture/adr/ADR-0022-beads-custom-material-shader-feasibility.md` | 13644 | 344 | normal |
| 20 | `docs/architecture/adr/ADR-0023-beads-procedural-bead-style-plugin.md` | 13563 | 283 | normal |

## 3. 超限清单（> 8000 tokens = 单文件上限）

| 文件 | tokens | 处置 |
|---|---:|:--:|
| `games/beads/art/assets-spec.md` | 106974 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `production/qa/beads/g4-regression-report.md` | 86807 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `production/qa/beads/test-cases.md` | 62579 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `production/TASKS-DETAIL.md` | 54609 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/art/accessibility.md` | 35669 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/ux/ux-spec.md` | 35334 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/art/art-bible.md` | 32288 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/systems-index-changelog.md` | 30390 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/proposals/bead-visual-style-spec.md` | 26098 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/levels/levels-spec.md` | 22859 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/systems-index.md` | 22263 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/IMPACT-0020a-beads-unit-5mm32-vs-render-50-52.md` | 16757 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `production/qa/beads/render-perf-device-baseline.md` | 16703 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/input-control.md` | 16339 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/proposals/beads-studio-density-tiers.md` | 15894 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/proposals/sec3-5mm32-render-base-change.md` | 15461 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/ADR-0020-beads-board-debug-zoom-focus.md` | 15152 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/audio/audio-spec.md` | 13867 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/ADR-0022-beads-custom-material-shader-feasibility.md` | 13644 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/ADR-0023-beads-procedural-bead-style-plugin.md` | 13563 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/proposals/sec3-5mm32-render-base-change-final.md` | 13335 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/cocos/extensions/cocos-mcp-server/README.ru.md` | 12627 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.ru.md` | 12627 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/ADR-0015-beads-board-zoom-pan-input.md` | 12530 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/engine-reference/cocos/VERSION.md` | 12203 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/bead-grid.md` | 12184 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/proposals/bead-style-16-19-semantics.md` | 11661 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `my-skills/writing-skills/anthropic-best-practices.md` | 11532 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/ADR-0024-render-model-polygon-value-copy.md` | 11422 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/cocos/extensions/cocos-mcp-server/README.ja.md` | 11289 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.ja.md` | 11289 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/pause-settings.md` | 11149 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/proposals/sec3-color-max-35-and-mis-max.md` | 10521 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/cocos/extensions/cocos-mcp-server/README.ko.md` | 9487 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.ko.md` | 9487 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/audio/audio-events.md` | 9482 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `production/TASKS.md` | 9285 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/cocos/extensions/cocos-mcp-server/README.fr.md` | 8986 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.fr.md` | 8986 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/cocos/extensions/cocos-mcp-server/README.es.md` | 8764 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.es.md` | 8764 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/core-loop.md` | 8681 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/cocos/extensions/cocos-mcp-server/README.pt.md` | 8518 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/audio/bgm-main-composition.md` | 8518 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.pt.md` | 8518 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `memory/INDEX.md` | 8490 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/ADR-0011-screen-coordinate-space-contract.md` | 8446 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/cocos/extensions/cocos-mcp-server/README.vi.md` | 8335 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.vi.md` | 8335 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/cocos/extensions/cocos-mcp-server/README.de.md` | 8150 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.de.md` | 8150 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `production/qa/beads/playtest-plan.md` | 8100 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/proposals/level-content-pipeline.md` | 8076 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `my-skills/subagent-driven-development/SKILL.md` | 8058 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |

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
