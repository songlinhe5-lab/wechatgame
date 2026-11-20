# studio 侧 `difficulty` / `tier` 命名语义对账裁定候选单

> **正本** = 本文件（WXG-T-1000，2026-11-20 立）。
> **上位真源** = `games/beads/design/levels/levels-spec.md` §5（D 值定义）· `games/beads/design/gdd/systems-index.md` §3（冻结常量）· `games/beads/design/art/proposals/ui-style-redesign/level-difficulty.md` §2.1 / §3 / §10.5 · `games/beads/design/proposals/difficulty-rewrite-stage0-20261119.md` §3 / §6.1 / §6.2。
> **⛔ 纪律**（承本仓裁定单体例）：本单**只交实测语义占用表 + 候选方案 + 代价**，⛔ **不代裁命名**、不落码、不改任何键名、不改任何常量、不改 §3、不改门禁、不回改史证行。
> **性质** = 命名对账裁定**候选**单（待用户拍板）。**零代码 / 零数据契约 / 零 UI 改动**。

| 项 | 值 |
|---|---|
| 文档性质 | 命名对账裁定候选单（proposal / ruling candidate），只交证据与候选 |
| 作者 | 主理人（CodeBuddy） |
| 日期 | 2026-11-20 |
| 任务号 | WXG-T-1000 |
| 议题 | studio 与游戏侧的 `difficulty` / `tier` 同名多义；四档标签接界面前须先定名 |
| 触发 | 用户令「3」＝ WXG-T-999 收尾选项 ③「先做命名对账裁定单」 |
| 状态 | **已裁定：方案①**（2026-11-20 用户拍板，见 §7；接线另立单，前置清单 §3 仍有效） |
| 前置交付 | WXG-T-997（方案 C 落码）· WXG-T-999（四档标签真源；UI 接线因并发 WIP 阻塞） |

---

## §0 一句话现状

`difficulty` 在仓内至少指 **5 件不同的东西**，`tier` 至少指 **6 件**；其中 studio 生成页同一行已有一个「难度 D…」（实际是 1★ 时长占满档时长的比例），若把方案 C 的四档标签也显示为「难度」，用户会在同一处看到两个量纲完全不同的「难度」。这不是命名偏好问题，是**读数会被误读**的问题。

---

## §1 实测语义占用基线

### 1.1 `difficulty` 的五义

| # | 实际指什么 | 定义与值域 | 真源 / 出处 | 消费面（实测） |
|---|---|---|---|---|
| **D1** | **难度分 D ＝ 估时占比** | 0–100 整数，1★ 档时长占满档时长的比例（取整）。`levels-spec.md §5` 原文写「难度分 0–100（占满档时长比例）」，并警示分母不可跨档比较 | [`levels-spec.md:294-306`](../../levels/levels-spec.md) · `src/game/level-import.ts::measuredLevelTime` · [`beads-bot.ts:189,247`](../../../../tools/scripts/beads-bot.ts) | `report.difficulty.score`（[`beads-bot.ts:354-360`](../../../../tools/scripts/beads-bot.ts) 的写回契约）· `resultEval().difficulty`（[`server.mjs:189-200`](../../../beads-studio/server.mjs)）· 生成页「难度 D…（1★ 预算占比）」（[`generate.html:765-768`](../../../beads-studio/public/generate.html)）· 列表 `D${e.difficulty}`（[`generate.html:867`](../../../beads-studio/public/generate.html)、[`manage.html:349`](../../../beads-studio/public/manage.html)） |
| **D2** | **评估对象容器 `report.difficulty`** | 一个对象，装 `score` / `timeEst` / `misplaced` / `steps` / `taps` / `bMed` / `split` / `blockers` / `formula` / `secPerStep` / `error` | `beads-bot.ts:354` 注释逐字写「**前端契约**：beads-studio `index.html` 读 `report.difficulty.{score,timeEst,misplaced}`」 | [`generate.html:742`](../../../beads-studio/public/generate.html)（`const df = rp.difficulty`）· [`generate.html:1016-1018`](../../../beads-studio/public/generate.html)（步数回退取数）· `server.mjs:192` |
| **D3** | **载入关卡 / 结果列表自带的评估记号** | 数值，显示为 `D${number}` | `generate.html:753` 的 `levelInfo.cells[levelCell].difficulty`；`generate.html:867` / `manage.html:349` 的 `e.difficulty` | 载入关卡的「真源评估」行与结果列表「评估信息」行。⚠ `games/beads/design/levels/` 下 `"difficulty"` 字面**零命中** ⇒ 该字段由 studio 侧结果索引 / 评估轻投影注入，不是关卡 JSON 字段；本单标 **`[待核]`**，不臆断来源 |
| **D4** | **旧连续式 DI（史证）** | 一位小数的结构难度分，旧式为错位珠数乘两个连续因子 | [`level-difficulty.md §3 / §5.1`](../ui-style-redesign/level-difficulty.md) · WXG-T-997 前的 `difficulty.ts` | 门禁⑥ 陈列序、九关逐值史证表；**WXG-T-997 后已退居史证读数**，不参与新主序 |
| **D5** | **方案 C 四档主序** | `difficultyOf()` 返回 `tier`（0–3）、`label`（中文）、`di`（整数确定性主键） | [`src/game/difficulty.ts`](../../src/game/difficulty.ts) · [`tuning/gameplay.ts::DIFFICULTY_TIERS`](../../src/config/tuning/gameplay.ts) | 门禁⑥ 严格递增 · 陈列序 · [`difficulty.test.ts`](../../tests/difficulty.test.ts) 17 例 |

### 1.2 `tier` 的六义

| # | 实际指什么 | 值域 | 真源 / 出处 |
|---|---|---|---|
| **T1** | **切片档（甲乙丙）** | 中文 `'甲'|'乙'|'丙'` | `server.mjs:807-854`（`init.tier` / `tierCounts`）、`:967`、`:1043`。⚠ `server.mjs:835` 注释逐字写「旧写死四键，新 tier 会被算成 `NaN`」⇒ 该键**对未知取值敏感** |
| **T2** | **星级档 1 / 2 / 3** | 1–3 | `STAR_TIER_K`（[`tuning/gameplay.ts:319`](../../src/config/tuning/gameplay.ts)）· `tierSecondsFor` / `tierStepBudget`（[`levels-spec.md:331`](../../levels/levels-spec.md)）· `tests/stars-tier.test.ts` |
| **T3** | **托盘容量档 12 / 24 / 48 槽** | 12 / 24 / 48 | `DIFFICULTY_TIERS.T_REFS` · `systems-index §3.4` |
| **T4** | **方案 C 难度四档** | 0–3 | `difficultyOf().tier`（WXG-T-997 新落码） |
| **T5** | **内容分档（N 边界，选图指导）** | 三档（WXG-T-981 已把锚点由名义盘面尺寸改判为可填珠数 N） | [`level-difficulty.md §2.1`](../ui-style-redesign/level-difficulty.md)；与 T4 正交，属史证 |
| **T6** | **密度档 1x / 2x / 3x** | 1x / 2x / 3x | [`beads-studio-density-tiers.md`](./beads-studio-density-tiers.md)；**搁置留档、未施工** |

补充：`grade` 在 `apps/beads-studio/` 与 `games/beads/src/` 的 `.mjs` / `.html` / `.ts` 中**零命中** ⇒ 该词目前未被占用（本单不据此提议用它，仅登记事实）。

### 1.3 两个具体冲突场景（不是抽象洁癖）

1. **同屏双「难度」**：WXG-T-999 的接线方案要在生成页统计行显示四档中文标签；该行现有文案是「难度 D45（1★ 预算占比）」。若新标签写作「难度：简单」，用户会同时看到离散档与 0–100 占比两种量纲，且无从分辨 —— D1 的注释已自认「`df.score` … **不是难度等级**」。
2. **同名键静默产出坏统计**：若 API 直接新增 `tier: 0..3`，它与 `server.mjs` 的 `init.tier`（甲乙丙）同名；`server.mjs:835` 已注明动态计数对未知键会算出 `NaN`。同名遮蔽在编译期不报错、替身测试也照绿，与 **K-197**（同名类型遮蔽 + 吞异常 ⇒ 1928 例照绿而真宿主静默哑掉）同族。

---

## §2 硬约束（任何方案都不得破）

- ⛔ **`systems-index §3` 冻结常量零改**；门禁⑥ / ⑦ / ⑧、`checkStepsGate`、`check:frozen-values` 三方对账零改。
- ⛔ **史证行不回改**（K-053）：§5.1 九关旧 DI 表、§10.5 快照、WXG-T-997 / 999 台账行一律只加指针、不改原文。
- ⛔ **他轨 WIP 零碰**（K-045 / K-188）：`generate.html` 3 处未提交 hunk（含难度行邻区删除）、`server.mjs` 6 处、`src/view/**` 8 件，均属并发会话在制。
- ⛔ **不动历史 report JSON 与 `beads-bot.ts` 写回契约**，除非用户显式裁定；若裁定要动，须按 **K-084** 先 grep 全部派生消费口（渲染条件分支、命中区、快照字段）并同批登记封箱复评。
- ⛔ 本单**零落码、零改名**；四档中文仍只从 `DIFFICULTY_TIERS.LABELS` 读，UI 不得硬编第二份。

---

## §3 接线前置清单（与命名裁定正交，先记住）

1. 并发会话把 `generate.html` / `server.mjs` / `src/view/**` 入库，或改用隔离 `git worktree`（用户上一轮选项 2）。
2. UI 文案一律带限定词，禁止裸写「难度」；估时占比与难度档分行或分标签。
3. 四档中文只读 `DIFFICULTY_TIERS.LABELS`；`difficultyOf` 的输入不含 `steps` / `pricing`，接线不得把它们混进同一读数。
4. 若裁任何键名，按 K-084 同批登记派生消费口与封箱复评，并复核 `server.mjs:835` 的动态计数分支。

---

## §4 三个候选方案（只列事实与代价，⛔ 不代裁）

| | **方案 ①：新字段带限定名，旧键零改** | **方案 ②：本会话自己的新体系改名** | **方案 ③：studio 侧旧名根治** |
|---|---|---|---|
| 做法 | 保留全部现名；接线时新增 `difficultyBand`（含 `tier` + `label`）或只加 `bandLabel` 字段；UI 写「难度档：简单」与「估时占比 D45」并列 | `difficultyOf().tier` → `band`、`label` → `bandLabel`、`DIFFICULTY_TIERS` → `DIFFICULTY_BANDS`、`di` → `bandKey` | `report.difficulty.score` → `timeBudgetPct`、`resultEval().difficulty` 同步、`init.tier` / `tierCounts` → `sliceGrade` / `sliceGradeCounts`、前端文案「难度 D…」→「估时占比 D…」 |
| 现有文件影响面 | **0 件**（只在新接线处新增字段） | 约 12 件：4 源码 + 2 件 Cocos 镜像 + `difficulty.test.ts` + 3 件文档 + 台账指针；全部是 WXG-T-997 / 999 本会话产物，**无他轨冲突** | `beads-bot.ts` 写回契约、`server.mjs`、`generate.html`、`manage.html`、历史 report JSON 兼容层 —— **几乎全部含并发会话 WIP**，且动数据契约 |
| 数据契约 | 零变 | 零变（游戏侧内部） | **变**：历史 report 需兼容别名或全量迁移 |
| 重验证成本 | 无（旧契约不动） | 中：门禁⑥ 注释、九关主键表、§10.5 快照同步改名；17 例测试、`framework:sync`、`levels:check`、`check:frozen-values` 复跑 | 高：按 K-084 全消费口 grep + 封箱复评 + 金样本归因 |
| 残留歧义 | 代码层 `difficulty` / `tier` 仍是多义词，靠本单术语词典 + 一条静态守卫防误用 | studio 侧两个旧名仍在（D1 / T1），游戏侧干净 | 根上消歧 |
| 前置条件 | 无，可立即为接线铺路 | 无，可立即执行 | **须等并发会话入库后另起单** |

---

## §5 建议（**不代裁**，仅供拍板）

建议 **方案 ①**：零碰他轨 WIP、零动数据契约、零改史证，且给后续接线一个不含歧义的新键名；方案 ② 可作为「游戏侧单独清爽化」的后续升级，方案 ③ 留到并发会话收敛后按 K-084 单独立项。

⛔ 本建议不是裁定。**待用户拍板**：① / ② / ③ / 另给命名。拍板前不落码、不改名、不接线。

> **2026-11-20 已裁定：方案①**（用户拍板，登记见 §7）。本节建议原文保留作史证。

---

## §6 出处与纪律

- 语义实测：[`levels-spec.md §5`](../../levels/levels-spec.md) · [`level-difficulty.md §2.1 / §10.5 / §10.5.1`](../ui-style-redesign/level-difficulty.md) · [`difficulty-rewrite-stage0-20261119.md §6.1 / §6.2`](./difficulty-rewrite-stage0-20261119.md) · [`difficulty.ts`](../../src/game/difficulty.ts) · [`tuning/gameplay.ts`](../../src/config/tuning/gameplay.ts) · [`beads-bot.ts`](../../../../tools/scripts/beads-bot.ts) · [`server.mjs`](../../../beads-studio/server.mjs) · [`generate.html`](../../../beads-studio/public/generate.html) · [`manage.html`](../../../beads-studio/public/manage.html)。
- 知识条目：**K-045**（整文件暂存捎带他人 WIP）· **K-053**（语义反转走反转批、不静默改写旧裁定）· **K-084**（标量换源须 grep 全部派生消费口并同批登记封箱复评）· **K-188**（跨轮续接先复核世界是否已变）· **K-197**（同名遮蔽不报错、替身全绿掩盖真宿主问题）。
- 本单为**只读对账产物**：未修改任何代码、常量、门禁、测试、关卡数据或 UI；`ctx:check` / `check:links` / `check:tasks` 由提交钩子复核。

---

## §7 裁定登记（2026-11-20 · 用户拍板）

- **用户原话**：「B 轨 WXG-T-1000 命名候选单：1」（Qoder 会话，2026-11-20）⇒ 裁定 = **方案①：新字段带限定名，旧键零改**。
- **裁定含义**：保留全部现名（D1–D5 / T1–T6 语义占用不变）；后续接线时新增带限定名新字段（`difficultyBand`〔含 `tier` + `label`〕或只加 `bandLabel`，接线单内定）；UI 文案写「难度档：简单」与「估时占比 D45」并列，⛔ 禁止裸写「难度」；四档中文仍只读 `DIFFICULTY_TIERS.LABELS`。
- **边界**：本单仍零落码；接线另立单，§3 前置清单仍有效。生成页半前置已部分解除（`generate.html` / `server.mjs` 的 982 静默回退已由 Qoder 会话经用户授权还原至 HEAD，两件现与 HEAD 一致）；选关页半仍候 `src/view/**` 他轨 WIP 入库（K-045 / K-188）。
- **方案② / ③ 去向**：②（游戏侧改名）留作后续升级候选、③（studio 旧名根治）留到并发收敛后按 K-084 另立单；两者均**未被本次裁定授权**。
- **登记**：本单由 Qoder 会话补登台账 WXG-T-1000（候选单原作者 = CodeBuddy 主理人会话，未及入库；登记不改变其只读对账性质）。
