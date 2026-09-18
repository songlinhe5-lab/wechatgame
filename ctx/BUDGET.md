# 上下文预算报表（ctx/BUDGET.md）

> 生成：2026-09-18 · 由 `tools/scripts/build-context-index.mjs` 自动生成，**请勿手改**。
> token 为**估算值**（CJK≈1/字、ASCII≈1/4 字符；非精确 tokenizer），仅用于排行与阈值护栏。
> 面向 agent 的阅读入口是 `ctx/ROUTES.md`；本表用于**人**复核预算与超限。

## 1. 常驻层体积（always-on）

| 文件 | 估算 tokens | 行数 | 上限 | 状态 |
|---|---:|---:|---:|:--:|
| `AGENTS.md` | 1960 | 123 | 2000 | ✅ |
| `my-rules/INDEX.md` | 254 | 20 | 500 | ✅ |
| `my-rules/agents-md.md` | 467 | 26 | 500 | ✅ |
| `ctx/hot-files.md` | 4509 | 82 | 4700 | ✅ |
| `ctx/ROUTES.md` | 6897 | 227 | 7500 | ✅ |

> AGENTS.md 常驻阈值 **2000**（CJK 口径校准，WXG-T-024）：原 3000 疑似 bytes/4 口径，与本表 token 估算公式（CJK≈1/字、ASCII≈1/4 字符）不一致；3200 在现状之上留 ≈7% 余量。
> `ctx/ROUTES.md` 常驻阈值 **7500**（WXG-T-039 R5）：现值 6235 之上留 ≈20% 余量，且低于 B 项通用单文件上限 8000——ROUTES 是手维护路由表（非生成物、无生成器控量），本门与门禁 A 项是其唯一硬护栏。
> **常驻总量**（AGENTS.md + my-rules/* + ctx/hot-files.md + ctx/ROUTES.md，每次会话固定开销）= **14087** 估算 tokens（观察哨软阈值 ≤ 13500，⚠️ 已超——请评估瘦身）：单文件上限各自为政时总量仍可漂移，本行仅观察提示、不阻断；硬阻断只挂各单文件门。

## 2. Top 20 大文件（估算 tokens）

| # | 文件 | tokens | 行数 | tier |
|---:|---|---:|---:|:--:|
| 1 | `production/qa/beads/g4-regression-report.md` | 86807 | 2201 | normal |
| 2 | `games/beads/art/assets-spec.md` | 70465 | 1439 | normal |
| 3 | `production/TASKS-DETAIL.md` | 45316 | 733 | normal |
| 4 | `production/qa/beads/test-cases.md` | 32798 | 563 | hot |
| 5 | `games/beads/art/art-bible.md` | 32288 | 492 | normal |
| 6 | `games/beads/art/accessibility.md` | 27120 | 185 | normal |
| 7 | `my-skills/_repos/superpowers/RELEASE-NOTES.md` | 23461 | 1400 | normal |
| 8 | `my-skills/_repos/superpowers/docs/superpowers/plans/2026-07-15-sdd-fix-loop-redesign.md` | 19356 | 1649 | normal |
| 9 | `games/beads/design/ux/ux-spec.md` | 13828 | 305 | normal |
| 10 | `my-skills/_repos/superpowers/docs/superpowers/plans/2026-07-30-codex-efficiency-fixes.md` | 13107 | 1009 | normal |
| 11 | `my-skills/_repos/superpowers/docs/porting-to-a-new-harness.md` | 12631 | 827 | normal |
| 12 | `games/beads/cocos/extensions/cocos-mcp-server/README.ru.md` | 12627 | 525 | normal |
| 13 | `games/breakout/cocos/extensions/cocos-mcp-server/README.ru.md` | 12627 | 525 | normal |
| 14 | `docs/engine-reference/cocos/VERSION.md` | 12203 | 456 | normal |
| 15 | `my-skills/_repos/superpowers/docs/superpowers/plans/2026-07-06-sdd-plan-scoped-workspace.md` | 12140 | 1134 | normal |
| 16 | `my-skills/_repos/superpowers/docs/superpowers/plans/2026-05-06-lift-drill-into-evals.md` | 12045 | 1374 | normal |
| 17 | `my-skills/_repos/superpowers/skills/writing-skills/anthropic-best-practices.md` | 11532 | 1150 | normal |
| 18 | `my-skills/writing-skills/anthropic-best-practices.md` | 11532 | 1150 | normal |
| 19 | `games/beads/design/gdd/systems-index.md` | 11407 | 284 | hot |
| 20 | `games/beads/cocos/extensions/cocos-mcp-server/README.ja.md` | 11289 | 525 | normal |

## 3. 超限清单（> 8000 tokens = 单文件上限）

| 文件 | tokens | 处置 |
|---|---:|:--:|
| `production/qa/beads/g4-regression-report.md` | 86807 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/art/assets-spec.md` | 70465 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `production/TASKS-DETAIL.md` | 45316 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `production/qa/beads/test-cases.md` | 32798 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/art/art-bible.md` | 32288 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/art/accessibility.md` | 27120 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `my-skills/_repos/superpowers/RELEASE-NOTES.md` | 23461 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `my-skills/_repos/superpowers/docs/superpowers/plans/2026-07-15-sdd-fix-loop-redesign.md` | 19356 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/ux/ux-spec.md` | 13828 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `my-skills/_repos/superpowers/docs/superpowers/plans/2026-07-30-codex-efficiency-fixes.md` | 13107 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `my-skills/_repos/superpowers/docs/porting-to-a-new-harness.md` | 12631 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/cocos/extensions/cocos-mcp-server/README.ru.md` | 12627 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.ru.md` | 12627 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/engine-reference/cocos/VERSION.md` | 12203 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `my-skills/_repos/superpowers/docs/superpowers/plans/2026-07-06-sdd-plan-scoped-workspace.md` | 12140 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `my-skills/_repos/superpowers/docs/superpowers/plans/2026-05-06-lift-drill-into-evals.md` | 12045 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `my-skills/_repos/superpowers/skills/writing-skills/anthropic-best-practices.md` | 11532 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `my-skills/writing-skills/anthropic-best-practices.md` | 11532 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/systems-index.md` | 11407 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/cocos/extensions/cocos-mcp-server/README.ja.md` | 11289 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.ja.md` | 11289 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `my-skills/_repos/mattpocock-skills/CHANGELOG.md` | 11071 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/audio/audio-spec.md` | 11064 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/input-control.md` | 10001 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/cocos/extensions/cocos-mcp-server/README.ko.md` | 9487 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.ko.md` | 9487 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `my-skills/_repos/superpowers/docs/superpowers/plans/2026-06-11-visual-companion-final-hardening-fixup.md` | 9038 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/cocos/extensions/cocos-mcp-server/README.fr.md` | 8986 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.fr.md` | 8986 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/gdd/systems-index-changelog.md` | 8900 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/design/audio/audio-events.md` | 8885 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/cocos/extensions/cocos-mcp-server/README.es.md` | 8764 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.es.md` | 8764 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/cocos/extensions/cocos-mcp-server/README.pt.md` | 8518 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.pt.md` | 8518 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `docs/architecture/adr/ADR-0011-screen-coordinate-space-contract.md` | 8446 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `memory/INDEX.md` | 8346 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/cocos/extensions/cocos-mcp-server/README.vi.md` | 8335 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.vi.md` | 8335 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/beads/cocos/extensions/cocos-mcp-server/README.de.md` | 8150 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.de.md` | 8150 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `my-skills/_repos/superpowers/skills/subagent-driven-development/SKILL.md` | 8058 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
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
