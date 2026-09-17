# GDD · S3 拼图网格与填色（Bead Grid）· beads

- 项目：`games/beads` · 版本 v2.0 · 任务号 WXG-T-130（v2.0 = 「错位归位」状态机改写；v1.0 见 §9）
- 数值纪律：只引用 `systems-index §3` 常量名，不写死数值（来源标注见各节）。
- 依赖锚点：挂在 `gdd/core-loop.md` §2.2 关内微循环第 1–4 步（错位判定、取回/归位裁决与完成判定）。

---

## 1. 目标

持有图案矩阵（唯一进度真源），裁决每次**取回（retrieve）**与**归位（placed）**的合法性，维护格子状态机（v2.0：`filled(错位) ⇄ empty` 双向），并在错位珠全部归位时广播通关信号。

## 2. 机制

### 2.1 数据结构（关卡 JSON → 运行时矩阵；v2.0 加错位装配）

- 关卡以**行字符串数组**描述图案，字符集 = `BEAD_CHARSET`（来源 §3.2）：`.`=空位（**无图案位**：不可填、不计完成、渲染为空白）、`x`=锁定格（不可填、不计完成，渲染为斜纹收边，见 levels-spec §6 图例）——`.` 与 `x` 运行时语义同为 `locked`，差异仅在表现层；`1-9`+`A`=色板索引 1–10（索引对应 `BEAD_PALETTE` 顺序，`A` 即第 10 色）。
- BOOT 期静态校验（字符集、行宽 === 声明 cols、行数 ≤ `GRID_MAX_ROWS`、≥1 可填格、**`swaps` 合法性**——坐标可填、每对珠色不同、对数 ∈ [`MISPLACED_PAIRS_MIN`, `MISPLACED_PAIRS_MAX`]，§3.13）归关卡校验器，形态沿用 breakout `validateLevel()` 判例；**S3 运行时不再重复字符集校验，但保留防御性断言**。
- **初始装配（v2.0）**：BOOT 按 `swaps` 顺序对可填格珠**两两交换**得初始布置——棋盘开局**全满**；pattern 字符 = 格**底色**（目标色）。装配后托盘为空（供料关停，§3.4 作废标注）。
- 运行时矩阵每格状态 ∈ `empty | filled | locked`，`filled` 格附带 colorIdx。
- **错位判定（v2.0）**：`misplaced(cell) = (state === filled) 且 (cell.colorIdx ≠ pattern(row,col))`。**已就位珠** = 非 misplaced 的 `filled`（珠色 = 底色，不可选）。

### 2.2 格子状态机（v2.0 改写：`filled` 不再是终态）

```
empty ──(归位: 空位 且 颜色匹配，珠来自托盘)──► filled(就位)【终态】
filled(错位) ──(取回: 托盘有空槽)──► empty        ← v2.0 新增转移
empty ──(归位: 空位 但 颜色不匹配)──► empty（播 wrong 态，状态不变）
locked：恒定，不参与任何转移与完成计数
```

- **`filled(就位)` 为终态**：珠色 = 底色，不可选中、无转移（v2.0 原文「`filled` 为终态：道具不可消除、无回退」**被本版推翻**——`filled(错位)` 可经取回回到 `empty`，也可被解环器归位/交换）。
- **`filled(错位)` 是可转移态**：唯一回退通道 = 取回（`tray:stored`，托盘有空槽为前提，§3.13）；唯一正向通道 = 解环器（S6 → S3 写入，§3.6）或该珠被取回后由托盘重新归位。道具/取回以外的任何指令不得改变 `filled(就位)`。
- `hint` / `wrong` / `selected` 为**表现层态**（绘制参数见 `art/assets-spec.md` §1.2），不改逻辑态；S3 只广播事件，由视觉层驱动。v2.0 起 `selected` 态可属于错位珠（`board:selected`）或托盘珠（`tray:selected`），两者互斥（选择锚，`input-control §2.1`）。
- 图案字符 `.` 与 `x` 在矩阵初始化时**均映射为 `locked`**（§3.2 语义澄清，2026-09-12，不变）。

### 2.3 裁决（核心规则；v2.0 = 取回 + 归位两条路径）

**路径 A · 取回（retrieve）**——输入：`(row, col, targetSlot)`，来自 S2，锚 = `board`（`board:selected` 的错位珠）：
1. 目标格非 `filled(错位)`（即 `locked` / `empty` / 已就位珠）→ 请求不成立（S2 层拦截；已就位珠/锁定格点击走极轻非惩罚反馈，裁定 4）。
2. 托盘无空槽 → **满槽禁取珠**（§3.13）：拒绝，极轻非惩罚反馈、**零事件、零状态写**。
3. 通过 → **同帧原子写入**：格 `filled(错位)` → `empty`，槽 `free` → `holding(colorIdx)`，广播 `tray:stored {slot, colorIdx, fromRow, fromCol}`。取回**不触发完成判定**（`filled` 只减不增）。

**路径 B · 归位（placed）**——输入：`(row, col, colorIdx, slot?)`，来自 S2（锚 = `tray`）或 S6（解环器，无 `slot`）：
1. 目标格非 `empty` → 忽略（不广播、无反馈噪声，core-loop §6）。
2. 目标格 `empty` 且 `pattern(row,col) === colorIdx` → 置 `filled(就位)`，广播 `bead:placed {row, col, colorIdx, slot?}`（`slot` 托盘路径必带、解环器路径不带，§4 payload 变更）。
3. `empty` 但颜色不匹配 → 广播 `bead:rejected {row, col, colorIdx}`，珠**留在托盘**（无惩罚，A4 已确认；仅托盘路径可达——解环器按构造必匹配）。
4. 每次 `bead:placed` 后执行完成判定：可填格（`empty + filled` 总数）中 `filled` 占比 100%（= **错位珠全部归位**）→ 广播 `level:cleared` 前置信号给 S1。

### 2.4 定位派生（来源 §3.3 公式，本文只引用）

- `colCenterX(j) = gridLeft + BEAD_CELL/2 + 52 * j`
- `rowCenterY(i) = gridTop − BEAD_CELL/2 − 52 * i`（第 0 行在最上，y 向上）
- 网格在 `PUZZLE_BAND` 内垂直+水平居中；`gridLeft ≥ 30`、`gridTop ≤ 1120`、`gridBottom ≥ 480`。

## 3. 输入

| 来源 | 内容 | 说明 |
|---|---|---|
| S2 | 取回请求 `(row, col, targetSlot)` / 归位请求 `(row, col, colorIdx, slot?)` | 每次最多 1 个在途请求（见 §6 并发） |
| S6 | `powerup:used {type, affectedCells}`（解环器） | S3 执行网格写入（v2.0：S3 是解环器写入的执行方），逐格发 `bead:placed`（无 `slot`） |
| S1 | 关卡装配指令 | BOOT → PLAYING 时装入矩阵、按 `swaps` 执行错位装配（全 `filled/locked`，托盘侧为空） |
| 关卡数据 | 矩阵 + cols/rows + swaps | BOOT 期已过静态校验（含 §3.13 错位校验） |

## 4. 输出与反馈

| 事件/表现 | 条件 | 对齐 |
|---|---|---|
| `tray:stored` | 取回裁决通过（v2.0 新增） | 错位珠离格飞入托盘槽（`ux-spec §5`「取回入槽」行）；S3 格写入与 S4 槽写入同帧原子（`core-loop §2.2.2`） |
| `bead:placed` | 归位裁决通过 | 落座动画 `vfx_fill_pop`（assets-spec §1.6）+ 音效 |
| `bead:rejected` | 颜色不匹配（仅托盘归位路径） | `vfx_wrong_shake` ±3px ×2 + `danger` 描边闪 ≤2 次/秒（§3.8） |
| 完成前置信号 → `level:cleared` | 可填格全满（= 错位珠全部归位） | 庆祝 `vfx_complete_wave`（按列延迟 20ms）。**层序裁定（WXG-T-128，2026-09-16 用户拍板）**：庆祝 800ms **先行放完**、结算面板**延迟 800ms 开**——否则同帧开面板会使全屏 scrim α0.5 把庆祝完全遮死（真源：`ux-spec §5`「过关庆祝」行） |
| **（无事件）表现层轻压**（WXG-T-128 新增；v2.0 适用对象扩展） | 对 `locked` 格或**已就位珠**（`filled` 且珠色=底色，v2.0 语义）点击被忽略（`verdict = ignored`）；**错位珠不适用本行**（错位珠可选中，走 `board:selected`） | `vfx_denied_press` scale 1.00→0.96→1.00（120ms，`art-bible §7.3.7` / `assets-spec §1.6.7`）+ `sfx_denied` 极轻闷「哒」（待原子落码，见 `audio-events §5` Q-A05-5）。**零事件、零扣次、零状态写**；`reduceMotion` 开 ⇒ 1px `slot_border` 静态描边环 |
| 格子绘制 | `filled(就位)/filled(错位)/empty/locked` | assets-spec §1.2 参数卡。**⚠️ 错位/就位的形态区分（2026-09-17 更正，WXG-T-140）**：本行原文「珠色≠底色即可辨」**属循环论证**——珠 50px = 格 50px、坑底色被珠体零露出，玩家在 filled 态**看不到底色**，该句不可用于证明「找错位珠」谜面可读（`assets-spec` L945 自认同款缺陷）。**更正后的真实现**：渲染层加 **L11 目标色垫（B′ 垫色显缝，`assets-spec §1.1`）**——每颗棋盘 filled 格在珠层下画全格垫（ink = 该格 `pattern` 目标色暗一档 `mix(target,#000,0.30)`），珠视觉内缩 2px/边露垫成缝；**垫色 = 珠色 ⇒ 就位，垫色 ≠ 珠色 ⇒ 错位**（用户 2026-09-17 拍板 `accessibility.md §5.4`，先 (b) 描边环后切 B′，WXG-T-140→142）。托盘珠 / `locked` / `empty` 三态不带垫。逻辑态（`misplaced` 判定 `colorIdx ≠ pattern(row,col)`）**不变**，本条只改可读性载体 |

## 5. 数值

全部引用 `systems-index §3`：§3.2（`BEAD_CHARSET`、`BEAD_COLOR_MAX`、`BEAD_PALETTE` 索引映射）、§3.3（`BEAD_CELL`、pitch 52、`GRID_MAX_COLS/ROWS`、`GRID_MIN_COLS/ROWS`、定位公式）、§3.8（错误反馈频率红线）。

## 6. 边界条件

**极端值**
- 矩阵无可填格（全 `x`/预填）：关卡硬约束（core-loop §6），静态校验拒绝，运行时断言兜底 → BOOT 拒入。
- `colorIdx` 越界（> `BEAD_COLOR_MAX` 或 0）：防御性拒绝，按 `bead:rejected`（归位路径）处理并记警告日志；取回路径的越界格不可能存在（`swaps` 只在合法色板索引内交换，BOOT 已校验）。
- 最后一颗错位珠归位与失败同帧：S1 按 cleared 优先裁决（`core-loop §6`，机制见 §2.2.2：cleared 属输入段、failed 属计时段），S3 照常广播 `bead:placed` —— 且该回执**先于** `level:cleared`（玩法事件段内序，WXG-T-061 补齐）。
- 托盘满 + 多颗错位珠：取回被拒（§3.13 满槽禁取珠）但不死锁——已持有托盘珠总可归位或由解环器腾挪；不存在「珠既回不了格也进不了盘」的状态（错位珠原格被占仅在交换构造中瞬时出现，装配期不落盘）。

**并发 / 竞态**
- 同一帧多次取回/归位请求：**不可能**（每帧最多 1 条输入指令，`input-control §2.4`）；测试/harness 程序化注入须显式排序并按 `core-loop §2.2.2` 解释。
- 归位请求与 `level:cleared` 广播同帧：两者同属**输入段**、每帧最多 1 条指令 ⇒ 本帧内**不可能**发生「cleared 后再归位」；跨帧时 cleared 之后的请求一律忽略（状态机已离开 PLAYING）。WXG-T-061 换基准，结论不变。
- 取回请求与 S4 槽态竞态：S3 裁决前向 S4 复核目标槽仍为 `free`（满槽禁取珠在 S4 侧兜底），否则走拒绝分支（零事件）。
- 解环器写入与托盘归位争用同一格：同属输入段 ⇒ 不可能同帧；跨帧后到者按最新格态重解释（格已 `filled` 则走忽略/交换规则，`powerups §2.3`）。

**非法输入**
- `(row, col)` 越界：忽略 + 警告日志。
- 对 `locked` 格或**已就位珠**点击：**零事件忽略**（core-loop §2.2/§6，裁定 4）+ 极轻非惩罚反馈（WXG-T-128 形态，见 §4 表末行与 §8-4）。**v2.0 语义收窄**：原「对 `filled` 格」→ 现「对 `filled(就位)`」——错位珠（`filled(错位)`）**可选**，不属本条。
- 托盘满时取回请求：拒绝，零事件零状态写 + 极轻反馈（§2.3 路径 A 第 2 步）。
- BOOT 未装配即收到取回/归位请求：忽略（状态机保护）。

## 7. 依赖

- **上游**：S1（装配/状态机/错位装配）、S2（取回/归位请求）、S4（空槽复核）、S6（解环器请求，经 `powerup:used`）、关卡数据（BOOT 静态校验后输入，含 `swaps`）。
- **下游**：S1（cleared 前置信号）、S4（`tray:stored` 的槽位写入对端，同帧原子）、S7（placed/cleared 计数）、视觉/音频层（事件消费）。
- **明确边界（v2.0）**：~~S4 依赖 S3 的"仍需颜色集合"~~ 已随供料关停作废（§3.4）；S3 对托盘的唯一写入 = 取回路径的槽位变更（经 S4 执行、同帧原子）。

## 8. 验收标准（可测试硬判据，QA 直接造用例）

1. **初始装配（v2.0 改写）**：装载合法关卡后，`filled` 格数 === 可填格总数、`locked` 格数 === cols×rows − 可填格总数、托盘全 `free`；`misplaced` 计数 === 2 × `swaps.length` 且每颗错位珠满足 `colorIdx ≠ pattern(row,col)`、每颗就位珠满足 `colorIdx === pattern(row,col)`。
2. **取回（v2.0 新增）**：`board` 锚点空槽取回 → 目标格变 `empty`、目标槽变 `holding(colorIdx)`；`tray:stored` 恰广播 1 次，payload 含 slot/fromRow/fromCol/colorIdx；取回后 `misplaced` 计数 −1、`filled` 总数 −1。
3. **归位**：匹配归位 → 目标格变 `filled(就位)` 且 colorIdx 与图案一致；`bead:placed` 恰广播 1 次，托盘路径 payload 含 slot、解环器路径不带；不匹配归位 → 目标格保持 `empty`；`bead:rejected` 恰广播 1 次；对应托盘珠未被移除。
4. 对 `locked` 格与**已就位珠**点击：**零事件**（用事件监听计数器断言 =0）。**判据改写（WXG-T-128，2026-09-16 用户裁定；WXG-T-130 v2.0 语义收窄为「已就位珠」）**：原文为「零事件、**零反馈**」，后半已推翻——现行为「零事件 + 极轻非惩罚反馈」（被点格 120ms 内出现 scale < 1.00 的绘制命令；`reduceMotion` 开 ⇒ 1px `slot_border` 静态描边环）。**QA 不得再按旧文把轻压判成缺陷**；不可放宽的红线仍是「事件计数 =0」（不进状态机、不扣道具次数）。与 `input-control §8-5` 同批改写（两文互为镜像，不得只改一侧）。**错位珠不适用本条**（可选中）。
5. 将最后一颗错位珠归位 → S1 收到 cleared 前置信号 ≤ 1 帧内；`filled` 数 === 可填格总数、`misplaced` 数 === 0。
6. **`filled(错位) ⇄ empty` 双向性（v2.0 改写，原「不可回退」判据作废）**：对 `filled(错位)` 格执行取回 → 变 `empty` 且可再被归位（构造「取回后重新归位到原格」用例，终态回到 `filled(就位)`）；**`filled(就位)` 仍不可转移**——非取回指令（解环器/任何事件）命中就位珠 → 状态不变。
7. 同帧双归位同格（程序化注入）：仅第 1 条生效，第 2 条走忽略分支，`bead:placed` 总数 =1。
8. 全部 13×12 = 156 格极端关卡：格中心坐标逐格符合 §2.4 公式（抽样四角 + 中心共 5 格断言，误差 ≤0.5px）。
9. colorIdx = 0 或 99 的归位请求：按 `bead:rejected` 处理且记警告，不崩溃。
10. 黑白模式下 `filled` 格（就位与错位）仅凭符号+明度可与全部 10 色区分（对照 assets-spec §6 验收第 2 条联合用例）。**v2.0 范围注记**：本条只覆盖 `filled` 态——空槽 `empty` 的灰度可辨性已随 E4 移除**降档**（降级登记正本 = `art/accessibility.md` A2b/A3，用户签字 2026-09-16），**不得把空槽灰度判据算进本条**。

## 9. 变更记录

| 版本 | 日期 | 变更 | 任务 |
|---|---|---|---|
| v1.0 | 2026-09-12 | 建档八节定稿；后续 v1.0 内回写：WXG-T-061 到达序换基准（§6）、WXG-T-128 轻压改写（§4/§6/§8-4，零事件 + 极轻非惩罚反馈） | WXG-T-009 |
| v2.0 | 2026-09-16 | **「错位归位」状态机改写（WXG-T-130 第二批，用户 2026-09-16 裁定）**：① **`filled` 终态被推翻**——状态机改为 `filled(就位)【终态】` + `filled(错位) ⇄ empty` 双向（唯一回退通道 = 取回，前提托盘有空槽）；② §2.3 改双路径裁决（取回 retrieve / 归位 placed），取回 = S3/S4 同帧原子写入、`tray:stored`、不触发完成判定；③ §2.1 加 `swaps` 错位装配与 `misplaced` 判定（§3.13）；④ **与 `powerups.md`「零网格写入」判据同批镜像改写**——道具反转为解环器后 S3 接受 S6 写入请求（`powerup:used {affectedCells}`），S3 仍是网格唯一真源；⑤ §6/§8 改写：判据 1（初始装配）、2（取回，新增）、6（双向性 + 就位珠仍不可转移）、4（适用对象收窄为已就位珠）、10（空槽灰度判据范围注记，E4 降档见 `art/accessibility.md`）。裁定依据：供料关停（案 A）/ 已就位珠与锁定格静默忽略（极轻反馈，维持 G7 形态） | WXG-T-130，用户 2026-09-16 四项裁定 |
