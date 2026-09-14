# 上下文预算报表（ctx/BUDGET.md）

> 生成：2026-09-14 · 由 `tools/scripts/build-context-index.mjs` 自动生成，**请勿手改**。
> token 为**估算值**（CJK≈1/字、ASCII≈1/4 字符；非精确 tokenizer），仅用于排行与阈值护栏。
> 面向 agent 的阅读入口是 `ctx/ROUTES.md`；本表用于**人**复核预算与超限。

## 1. 常驻层体积（always-on）

| 文件 | 估算 tokens | 行数 | 上限 | 状态 |
|---|---:|---:|---:|:--:|
| `AGENTS.md` | 1743 | 120 | 2000 | ✅ |
| `my-rules/INDEX.md` | 254 | 20 | 500 | ✅ |
| `my-rules/agents-md.md` | 374 | 24 | 500 | ✅ |
| `ctx/hot-files.md` | 3779 | 90 | 4000 | ✅ |
| `ctx/ROUTES.md` | 6654 | 226 | 7500 | ✅ |

> AGENTS.md 常驻阈值 **2000**（CJK 口径校准，WXG-T-024）：原 3000 疑似 bytes/4 口径，与本表 token 估算公式（CJK≈1/字、ASCII≈1/4 字符）不一致；3200 在现状之上留 ≈7% 余量。
> `ctx/ROUTES.md` 常驻阈值 **7500**（WXG-T-039 R5）：现值 6235 之上留 ≈20% 余量，且低于 B 项通用单文件上限 8000——ROUTES 是手维护路由表（非生成物、无生成器控量），本门与门禁 A 项是其唯一硬护栏。
> **常驻总量**（AGENTS.md + my-rules/* + ctx/hot-files.md + ctx/ROUTES.md，每次会话固定开销）= **12804** 估算 tokens（观察哨软阈值 ≤ 13500）：单文件上限各自为政时总量仍可漂移，本行仅观察提示、不阻断；硬阻断只挂各单文件门。

## 2. Top 20 大文件（估算 tokens）

| # | 文件 | tokens | 行数 | tier |
|---:|---|---:|---:|:--:|
| 1 | `games/breakout/cocos/extensions/cocos-mcp-server/README.ru.md` | 12627 | 525 | normal |
| 2 | `games/breakout/cocos/extensions/cocos-mcp-server/README.ja.md` | 11289 | 525 | normal |
| 3 | `memory/2026-09-12.md` | 10141 | 151 | normal |
| 4 | `games/breakout/cocos/extensions/cocos-mcp-server/README.ko.md` | 9487 | 525 | normal |
| 5 | `games/breakout/cocos/extensions/cocos-mcp-server/README.fr.md` | 8986 | 525 | normal |
| 6 | `games/breakout/cocos/extensions/cocos-mcp-server/README.es.md` | 8764 | 525 | normal |
| 7 | `games/breakout/cocos/extensions/cocos-mcp-server/README.pt.md` | 8518 | 525 | normal |
| 8 | `memory/2026-09-14.md` | 8345 | 202 | normal |
| 9 | `games/breakout/cocos/extensions/cocos-mcp-server/README.vi.md` | 8335 | 525 | normal |
| 10 | `games/breakout/cocos/extensions/cocos-mcp-server/README.de.md` | 8150 | 525 | normal |
| 11 | `production/TASKS-DETAIL.md` | 7863 | 165 | normal |
| 12 | `production/epics/epics-beads.md` | 7854 | 292 | normal |
| 13 | `games/breakout/cocos/extensions/cocos-mcp-server/README.zh-TW.md` | 7579 | 525 | normal |
| 14 | `games/breakout/cocos/extensions/cocos-mcp-server/README.md` | 7524 | 525 | normal |
| 15 | `games/beads/design/proposals/star-level-rebalance.md` | 7487 | 387 | normal |
| 16 | `docs/agent/cocos-setup.md` | 7341 | 372 | normal |
| 17 | `production/qa/beads/test-cases.md` | 7282 | 197 | hot |
| 18 | `games/breakout/cocos/extensions/cocos-mcp-server/README.EN.md` | 7240 | 525 | normal |
| 19 | `docs/architecture/adr/ADR-0010-weixin-minigame-helper-integration.md` | 7166 | 212 | normal |
| 20 | `production/epics/epics-breakout.md` | 7135 | 316 | normal |

## 3. 超限清单（> 8000 tokens = 单文件上限）

| 文件 | tokens | 处置 |
|---|---:|:--:|
| `games/breakout/cocos/extensions/cocos-mcp-server/README.ru.md` | 12627 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.ja.md` | 11289 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `memory/2026-09-12.md` | 10141 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.ko.md` | 9487 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.fr.md` | 8986 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.es.md` | 8764 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.pt.md` | 8518 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `memory/2026-09-14.md` | 8345 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.vi.md` | 8335 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |
| `games/breakout/cocos/extensions/cocos-mcp-server/README.de.md` | 8150 | 见 `ctx/budget-exempt.json`（无豁免则 ❌ 需报告主理人） |

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
