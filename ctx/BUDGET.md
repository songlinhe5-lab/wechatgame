# 上下文预算报表（ctx/BUDGET.md）

> 生成：2026-09-13 · 由 `tools/scripts/build-context-index.mjs` 自动生成，**请勿手改**。
> token 为**估算值**（CJK≈1/字、ASCII≈1/4 字符；非精确 tokenizer），仅用于排行与阈值护栏。
> 面向 agent 的阅读入口是 `ctx/ROUTES.md`；本表用于**人**复核预算与超限。

## 1. 常驻层体积（always-on）

| 文件 | 估算 tokens | 行数 | 上限 | 状态 |
|---|---:|---:|---:|:--:|
| `AGENTS.md` | 1699 | 120 | 2000 | ✅ |
| `my-rules/INDEX.md` | 254 | 20 | 500 | ✅ |
| `my-rules/agents-md.md` | 327 | 23 | 500 | ✅ |

> AGENTS.md 常驻阈值 **2000**（CJK 口径校准，WXG-T-024）：原 3000 疑似 bytes/4 口径，与本表 token 估算公式（CJK≈1/字、ASCII≈1/4 字符）不一致；3200 在现状之上留 ≈7% 余量。

## 2. Top 20 大文件（估算 tokens）

| # | 文件 | tokens | 行数 | tier |
|---:|---|---:|---:|:--:|
| 1 | `memory/2026-09-12.md` | 10141 | 151 | normal |
| 2 | `production/epics/epics-breakout.md` | 7135 | 316 | normal |
| 3 | `production/qa/test-cases.md` | 7097 | 296 | normal |
| 4 | `production/epics/epics-beads.md` | 7034 | 268 | normal |
| 5 | `games/beads/design/gdd/systems-index.md` | 6321 | 228 | hot |
| 6 | `memory/2026-09-11.md` | 5617 | 115 | normal |
| 7 | `production/qa/beads/test-cases.md` | 5372 | 146 | hot |
| 8 | `games/breakout/design/design-review.md` | 5081 | 257 | normal |
| 9 | `games/beads/design/gdd/powerups.md` | 5036 | 141 | normal |
| 10 | `games/breakout/art/assets-spec.md` | 4993 | 252 | normal |
| 11 | `games/breakout/art/art-bible.md` | 4852 | 229 | normal |
| 12 | `games/beads/design/proposals/daily-challenge.md` | 4657 | 174 | normal |
| 13 | `ctx/ROUTES.md` | 4656 | 177 | normal |
| 14 | `games/breakout/design/gdd/systems-index.md` | 4600 | 232 | normal |
| 15 | `my-skills/weixin-minigame-helper/SKILL.md` | 4543 | 251 | normal |
| 16 | `games/beads/art/art-bible.md` | 4511 | 220 | normal |
| 17 | `production/qa/test-plan.md` | 4334 | 195 | normal |
| 18 | `docs/architecture/architecture.md` | 4322 | 239 | normal |
| 19 | `games/beads/design/gdd/score-combo.md` | 4248 | 137 | normal |
| 20 | `docs/architecture/adr/ADR-0009-cocos-mcp-editor-integration.md` | 4220 | 142 | normal |

## 3. 超限清单（> 8000 tokens = 单文件上限）

| 文件 | tokens | 处置 |
|---|---:|:--:|
| `memory/2026-09-12.md` | 10141 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |

## 4. 真实最常用章节与分布加权节省率（估算）

> 数据源：`ctx/usage-distribution.json`（真实读事件账本），样本 **457** 次读取 / 20 会话；token 一律为**估算**。

| # | 锚点 | 文件 | 命中读数 | 归属估算 tokens |
|---:|---|---|---:|---:|
| 1 | `§系统清单与依赖索引（Systems Index）` | `games/breakout/design/gdd/systems-index.md` | 16 | 73360 |
| 2 | `§AGENTS.md — wechatgame 项目级 Agent 指引` | `AGENTS.md` | 16 | 47472 |
| 3 | `§系统清单与依赖索引（Systems Index）· beads` | `games/beads/design/gdd/systems-index.md` | 15 | 88380 |
| 4 | `§《弹球打砖块》一页纸概念（Concept One-Pager）` | `games/breakout/design/concept.md` | 15 | 46365 |
| 5 | `§3 全局数值基线（Global Constants）· ❄️ 冻结令` | `games/breakout/design/gdd/systems-index.md` | 15 | 39840 |
| 6 | `§3 全局数值基线（Global Constants）· ❄️ 冻结令` | `games/beads/design/gdd/systems-index.md` | 13 | 37323 |
| 7 | `§wxgame GDD 编写法（工作室验证过的四件套流程）` | `my-skills/wxgame-gdd-writer/SKILL.md` | 13 | 14599 |
| 8 | `§7 范围分层（Scope Layering）` | `games/breakout/design/concept.md` | 13 | 8112 |
| 9 | `§3.1 画布、坐标与安全区` | `games/breakout/design/gdd/systems-index.md` | 13 | 5005 |
| 10 | `§6 心流与难度曲线思路` | `games/breakout/design/concept.md` | 13 | 4251 |
| 11 | `§MVP（必须，Demo 验收线）` | `games/breakout/design/concept.md` | 13 | 3757 |
| 12 | `§3.3 砖块网格（Brick Grid）` | `games/breakout/design/gdd/systems-index.md` | 13 | 2886 |
| 13 | `§总流程（顺序执行，前一步是后一步的输入）` | `my-skills/wxgame-gdd-writer/SKILL.md` | 13 | 1092 |
| 14 | `§4 MDA 分析（Mechanics → Dynamics → Aesthetics）` | `games/breakout/design/concept.md` | 12 | 6432 |
| 15 | `§3.4 挡板与球` | `games/breakout/design/gdd/systems-index.md` | 12 | 2760 |

**真实分布加权节省率**（估算）：Σ 实际读入 **721893** ÷ Σ 全文 **1173387** = **38.5%**（样本 456 次读取）

> 单次节省率：含整文件读的整体中位数 0.0%、仅局部读中位数 75.1%、仅局部读 P10 30.0%——护栏与阈值见 `pnpm run ctx:check` E 项。
