# 上下文预算报表（ctx/BUDGET.md）

> 生成：2026-09-12 · 由 `tools/scripts/build-context-index.mjs` 自动生成，**请勿手改**。
> token 为**估算值**（CJK≈1/字、ASCII≈1/4 字符；非精确 tokenizer），仅用于排行与阈值护栏。
> 面向 agent 的阅读入口是 `ctx/ROUTES.md`；本表用于**人**复核预算与超限。

## 1. 常驻层体积（always-on）

| 文件 | 估算 tokens | 行数 | 上限 | 状态 |
|---|---:|---:|---:|:--:|
| `AGENTS.md` | 2980 | 195 | 3200 | ✅ |
| `my-rules/INDEX.md` | 254 | 20 | 500 | ✅ |
| `my-rules/agents-md.md` | 327 | 23 | 500 | ✅ |

> AGENTS.md 常驻阈值 **3200**（CJK 口径校准，WXG-T-024）：原 3000 疑似 bytes/4 口径，与本表 token 估算公式（CJK≈1/字、ASCII≈1/4 字符）不一致；3200 在现状之上留 ≈7% 余量。

## 2. Top 20 大文件（估算 tokens）

| # | 文件 | tokens | 行数 | tier |
|---:|---|---:|---:|:--:|
| 1 | `production/epics/epics-breakout.md` | 7135 | 316 | normal |
| 2 | `production/qa/test-cases.md` | 7097 | 296 | normal |
| 3 | `production/epics/epics-beads.md` | 7034 | 268 | normal |
| 4 | `games/beads/design/gdd/systems-index.md` | 5909 | 227 | hot |
| 5 | `memory/2026-09-12.md` | 5877 | 60 | normal |
| 6 | `memory/2026-09-11.md` | 5617 | 115 | normal |
| 7 | `games/breakout/design/design-review.md` | 5081 | 257 | normal |
| 8 | `games/beads/design/gdd/powerups.md` | 5036 | 141 | normal |
| 9 | `games/breakout/art/assets-spec.md` | 4993 | 252 | normal |
| 10 | `games/breakout/art/art-bible.md` | 4852 | 229 | normal |
| 11 | `games/beads/design/proposals/daily-challenge.md` | 4657 | 174 | normal |
| 12 | `games/breakout/design/gdd/systems-index.md` | 4600 | 232 | normal |
| 13 | `games/beads/art/art-bible.md` | 4511 | 220 | normal |
| 14 | `production/qa/test-plan.md` | 4334 | 195 | normal |
| 15 | `docs/architecture/architecture.md` | 4322 | 239 | normal |
| 16 | `docs/architecture/adr/ADR-0009-cocos-mcp-editor-integration.md` | 4220 | 142 | normal |
| 17 | `my-skills/game-dev-tool-free/SKILL.md` | 4153 | 488 | normal |
| 18 | `games/breakout/design/levels/levels-spec.md` | 3964 | 244 | normal |
| 19 | `production/release/release-checklist.md` | 3853 | 202 | normal |
| 20 | `games/breakout/design/ux/ux-spec.md` | 3836 | 225 | normal |

## 3. 超限清单（> 8000 tokens = 单文件上限）

无超限文件。

## 4. hot 层章节可节省量（全文 vs 最常用章节）

| 文件 | 全文 tokens | 常用章节 | 章节 tokens | 节省 |
|---|---:|---|---:|---:|
| `docs/architecture/architecture-beads.md` | 3819 | `§5 事件装配图（systems-index §4 全部 13 事件）` | 505 | 87% |
| `docs/architecture/control-manifest.md` | 3013 | `§0 五条铁律（违反 = 直接打回）` | 253 | 92% |
| `games/beads/design/gdd/systems-index.md` | 5909 | `§3.7 星级与结算` | 137 | 98% |
| `memory/MEMORY.md` | 1190 | `§已知限制` | 80 | 93% |
| `production/TASKS.md` | 1499 | —（整文件即最小单元） | — | — |
| `production/qa/beads/test-cases.md` | 3697 | `§A 硬判据用例（50 条 = 5 组 × 10，判据 1:1 映射）` | 2507 | 32% |

> 「最常用章节」由 `build-context-index.mjs` 的 `COMMON_SECTION_PREFIX` 指定，与 `ctx/ROUTES.md` 的路由一致。
