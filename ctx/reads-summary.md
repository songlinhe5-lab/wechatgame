# 读入使用分布报告（ctx/reads-summary.md）

> 生成：2026-09-12 · 由 `tools/scripts/analyze-context-usage.mjs` 生成，**请勿手改**。
> 全部 token 为**估算值**（CJK≈1/字、ASCII≈1/4 字符；非精确 tokenizer），仅用于排行与取舍。
> 数据源：本机 IDE 会话转录 → `ctx/reads-ledger.jsonl`（仅元数据，无正文）。

## ① 样本量与覆盖

| 指标 | 值 |
|---|---:|
| 会话数（账本保留行口径） | 20 |
| 会话数（采集期有读事件口径，含读全被丢弃者） | 21 |
| 去重后账本行数（读事件） | 457 |
| 采集识别读事件（去重前） | 552 |
| 覆盖仓库内文件数 | 146 |
| 仓库外丢弃 | 53 |
| 未识别记录 | 0 |
| schema 无效（分析期丢弃） | 0 |
| stale（文件已不存在）读事件 | 1 |

**按 IDE**：

| IDE | 读事件 |
|---|---:|
| cursor | 163 |
| workbuddy | 294 |

**按会话**：

| 会话 | 读事件 |
|---|---:|
| `6f7a9a03-9571-408d-9fdc-f1c7c879f464/6f7a9a03-9571-408d-9fdc-f1c7c879f464` | 97 |
| `6f7a9a03-9571-408d-9fdc-f1c7c879f464/subagents/243742bd-725c-47b7-9dcc-7922028f8989` | 9 |
| `6f7a9a03-9571-408d-9fdc-f1c7c879f464/subagents/36b04f9d-da1b-4e1e-913c-2c0cadfa5f25` | 6 |
| `6f7a9a03-9571-408d-9fdc-f1c7c879f464/subagents/5b4b99ea-2c99-4ea9-a1ac-87821508f6f7` | 6 |
| `6f7a9a03-9571-408d-9fdc-f1c7c879f464/subagents/5f1ba605-e5eb-49fe-9925-2ffb04a8ec52` | 4 |
| `6f7a9a03-9571-408d-9fdc-f1c7c879f464/subagents/687bd1ce-e530-4ebf-aa87-626262fe04fa` | 6 |
| `6f7a9a03-9571-408d-9fdc-f1c7c879f464/subagents/7ed2874d-0cc6-4a0d-8aa3-7950d220ca4b` | 7 |
| `6f7a9a03-9571-408d-9fdc-f1c7c879f464/subagents/c557bba0-8237-48fa-bdcf-4526231c6e0d` | 4 |
| `6f7a9a03-9571-408d-9fdc-f1c7c879f464/subagents/cecd6423-3a49-4d36-bfa6-6e7a4b1db0fc` | 3 |
| `6f7a9a03-9571-408d-9fdc-f1c7c879f464/subagents/daef8855-14d3-49d0-84c4-0d42f0b4c7b1` | 11 |
| `6f7a9a03-9571-408d-9fdc-f1c7c879f464/subagents/f15440f8-7692-4438-b25e-e12986a97c9d` | 10 |
| `d2983589-5929-4ae7-8766-93377384382e` | 76 |
| `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-02cb0791` | 31 |
| `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-08c7bd79` | 5 |
| `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-3366cb1d` | 47 |
| `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-38e6af01` | 6 |
| `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-45bb201c` | 54 |
| `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-6fd11320` | 30 |
| `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-9aaf6185` | 25 |
| `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-fe766a3b` | 20 |

> **会话口径二义（WXG-T-026 复验 F-03）**：上表两行「会话数」定义不同——**「有读事件」** = 采集期识别到 ≥1 次读调用的会话（含读路径全在仓库外、丢弃后 0 行入账者）；**「账本保留行」** = 去重后仍留有读事件的会话。本样本前者 21、后者 20，差值即「读全被丢弃」的会话数。采集侧车 `ctx/reads-ledger.meta.json` 的 `sessionsWithReadEvents` / `sessionsInLedger` 同此口径。

## ② 真实分布加权节省率（核心结论）

仅按**真实读入量**计算：`Σ(实际读入估算 tokens)` vs `Σ(对应文件全文估算 tokens)`。

| 指标 | 值 |
|---|---:|
| 样本读数 | 456（文件已不存在者不计） |
| Σ 实际读入（估算） | 721893 |
| Σ 全文（估算） | 1173387 |
| **整体节省率** | **38.5%** |
| 单次节省率 中位数 | 0.0% |
| 单次节省率 P10 | 0.0% |
| 仅**局部读**单次节省率 中位数 | 75.1%（样本 197） |

> 中位数/P10 为 0% 说明样本里**整文件读**占比高（见 §③）——这正是本装置要继续压降的对象。

**最差 10 次读（节省率最低，最接近全文）**：

| # | 路径 | 归属 | 实际读入 | 全文 | 节省率 |
|---:|---|---|---:|---:|---:|
| 1 | `.codebuddy/rules/agents-md/RULE.mdc` | 整文件 | 327 | 327 | 0.0% |
| 2 | `.cursor/rules/agents-md.mdc` | 整文件 | 327 | 327 | 0.0% |
| 3 | `.githooks/commit-msg` | 整文件 | 363 | 363 | 0.0% |
| 4 | `.github/workflows/pr-review.yml` | 整文件 | 705 | 705 | 0.0% |
| 5 | `.github/workflows/pr-review.yml` | 整文件 | 705 | 705 | 0.0% |
| 6 | `.gitignore` | 整文件 | 212 | 212 | 0.0% |
| 7 | `.gitignore` | 整文件 | 212 | 212 | 0.0% |
| 8 | `.qoder/rules/agents-md.md` | 整文件 | 327 | 327 | 0.0% |
| 9 | `.workbuddy/memory/2026-09-11.md` | 整文件 | 5617 | 5617 | 0.0% |
| 10 | `.workbuddy/memory/MEMORY.md` | 整文件 | 1190 | 1190 | 0.0% |

## ③ 锚点直达率

| 指标 | 值 |
|---|---:|
| 总读数 | 457 |
| 整文件读取 | 259（占 56.7%） |
| 局部（带区间）读取 | 198 |
| 读取完整落在单一章节行区间内（锚点直达） | 140（占局部读 70.7%） |
| 其中严格等于某 sections 区间 | 0 |
| 未归属到索引（文件不在 ctx/index.json） | 128 |

## ④ 反模式指标

- ①「同一会话同一文件小读（≤150 行）> 3 次」抖动：**9** 组，累计超限 **26** 次（判据出处 `ctx/ROUTES.md §0`）。
- ② 对大文件（≥ 3000 估算 tokens）的整文件读取：**65** 次。

| 文件 | 估算 tokens | 会话 |
|---|---:|---|
| `games/breakout/src/game/breakout-game.ts` | 10707 | `d2983589-5929-4ae7-8766-93377384382e` |
| `games/breakout/src/game/breakout-game.ts` | 10707 | `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-02cb0791` |
| `games/breakout/src/game/breakout-game.ts` | 10707 | `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-3366cb1d` |
| `games/breakout/src/game/breakout-game.ts` | 10707 | `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-9aaf6185` |
| `.workbuddy/memory/2026-09-12.md` | 7212 | `d2983589-5929-4ae7-8766-93377384382e` |
| `production/epics/epics-beads.md` | 7034 | `d2983589-5929-4ae7-8766-93377384382e` |
| `games/beads/design/gdd/systems-index.md` | 5909 | `6f7a9a03-9571-408d-9fdc-f1c7c879f464/subagents/7ed2874d-0cc6-4a0d-8aa3-7950d220ca4b` |
| `games/beads/design/gdd/systems-index.md` | 5909 | `6f7a9a03-9571-408d-9fdc-f1c7c879f464/subagents/daef8855-14d3-49d0-84c4-0d42f0b4c7b1` |
| `games/beads/design/gdd/systems-index.md` | 5909 | `d2983589-5929-4ae7-8766-93377384382e` |
| `games/beads/design/gdd/systems-index.md` | 5909 | `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-02cb0791` |
| `games/beads/design/gdd/systems-index.md` | 5909 | `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-08c7bd79` |
| `games/beads/design/gdd/systems-index.md` | 5909 | `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-3366cb1d` |
| `games/beads/design/gdd/systems-index.md` | 5909 | `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-45bb201c` |
| `games/beads/design/gdd/systems-index.md` | 5909 | `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-6fd11320` |
| `.workbuddy/memory/2026-09-11.md` | 5617 | `d2983589-5929-4ae7-8766-93377384382e` |
| `production/qa/beads/test-cases.md` | 5372 | `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-08c7bd79` |
| `games/breakout/design/design-review.md` | 5081 | `6f7a9a03-9571-408d-9fdc-f1c7c879f464/subagents/36b04f9d-da1b-4e1e-913c-2c0cadfa5f25` |
| `games/beads/design/gdd/powerups.md` | 5036 | `d2983589-5929-4ae7-8766-93377384382e` |
| `games/beads/design/gdd/powerups.md` | 5036 | `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-45bb201c` |
| `games/breakout/art/assets-spec.md` | 4993 | `d2983589-5929-4ae7-8766-93377384382e/subagents/agent-3366cb1d` |

## ⑤ 最常用章节 Top 15（供替换硬编码前缀消费）

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

## ⑥ 样本代表性边界（可外推性 · F-01，WXG-T-026 复验补）

**实测事实（本账本）**：全部读事件**仅来自 2 个根会话**（及其子代理）：

| 根会话（会话树，含其子代理） | IDE | 读事件 | 占比 |
|---|---|---:|---:|
| `d2983589-5929-4ae7-8766-93377384382e` | workbuddy | 294 | 64.3% |
| `6f7a9a03-9571-408d-9fdc-f1c7c879f464` | cursor | 163 | 35.7% |

其余 **18** 条会话均为上述根会话的**子代理**（非独立根）。

⚠️ 其中 **`d2983589-5929-4ae7-8766-93377384382e`（workbuddy） 为进行中的活动会话**：采集时仍在写入，属「边写边采」，样本**非平稳**——**重跑 `ctx:reads` 即漂移**（正是 F-02 把抖动/大文件判定改为**比率口径**的原因）。

**明确声明**：本样本为**单仓库、单机、非独立重复采样**（同一批会话的历史读事件），
**不可外推**到「一般 agent 工作流」或任何普遍结论；数字仅供本仓库自身的护栏与趋势参考。
