# GDD · S3 拼图网格与填色（Bead Grid）· beads

- 项目：`games/beads` · 版本 v1.0 · 任务号 WXG-T-009
- 数值纪律：只引用 `systems-index §3` 常量名，不写死数值（来源标注见各节）。
- 依赖锚点：挂在 `gdd/core-loop.md` §2.2 关内微循环第 3/4 步（落子校验与判定）。

---

## 1. 目标

持有图案矩阵（唯一进度真源），裁决每次落子的合法性（空位 × 颜色匹配），维护格子六状态机，并在可填格全满时广播通关信号。

## 2. 机制

### 2.1 数据结构（关卡 JSON → 运行时矩阵）

- 关卡以**行字符串数组**描述图案，字符集 = `BEAD_CHARSET`（来源 §3.2）：`.`=空位（**无图案位**：不可填、不计完成、渲染为空白）、`x`=锁定格（不可填、不计完成，渲染为斜纹收边，见 levels-spec §6 图例）——`.` 与 `x` 运行时语义同为 `locked`，差异仅在表现层；`1-9`+`A`=色板索引 1–10（索引对应 `BEAD_PALETTE` 顺序，`A` 即第 10 色）。
- BOOT 期静态校验（字符集、行宽 === 声明 cols、行数 ≤ `GRID_MAX_ROWS`、≥1 可填格）归关卡校验器，形态沿用 breakout `validateLevel()` 判例；**S3 运行时不再重复字符集校验，但保留防御性断言**。
- 运行时矩阵每格状态 ∈ `empty | filled | locked`，`filled` 格附带 colorIdx。

### 2.2 格子状态机

```
empty ──(落子: 空位 且 颜色匹配)──► filled（终态，不可回退）
empty ──(落子: 空位 但 颜色不匹配)──► empty（播 wrong 态，状态不变）
locked：恒定，不参与任何转移与完成计数
```

- `filled` 为终态：道具不可消除、无回退（来源 §3.6 道具目标行）。
- `hint` / `wrong` / `selected` 为**表现层态**（绘制参数见 `art/assets-spec.md` §1.2），不改逻辑态；S3 只广播事件，由视觉层驱动。
- 图案字符 `.` 与 `x` 在矩阵初始化时**均映射为 `locked`**（§3.2 语义澄清，2026-09-12：`.` 不可填、不计完成，与 `x` 语义相同、仅表现层不同——空白 vs 斜纹收边）。

### 2.3 落子裁决（核心规则）

输入：`(row, col, colorIdx)`——来自 S2，colorIdx 为托盘选中珠颜色。
1. 目标格非 `empty` → 忽略（不广播、无反馈噪声，core-loop §6）。
2. 目标格 `empty` 且 `gridColor(row,col) === colorIdx` → 置 `filled`，广播 `bead:placed {row, col, colorIdx, slot}`。
3. `empty` 但颜色不匹配 → 广播 `bead:rejected {row, col, colorIdx}`，珠**留在托盘**（无惩罚，A4 已确认）。
4. 每次 `bead:placed` 后执行完成判定：可填格（`empty + filled` 总数）中 `filled` 占比 100% → 广播 `level:cleared` 前置信号给 S1。

### 2.4 定位派生（来源 §3.3 公式，本文只引用）

- `colCenterX(j) = gridLeft + BEAD_CELL/2 + 52 * j`
- `rowCenterY(i) = gridTop − BEAD_CELL/2 − 52 * i`（第 0 行在最上，y 向上）
- 网格在 `PUZZLE_BAND` 内垂直+水平居中；`gridLeft ≥ 30`、`gridTop ≤ 1120`、`gridBottom ≥ 480`。

## 3. 输入

| 来源 | 内容 | 说明 |
|---|---|---|
| S2 | `(row, col, colorIdx)` 落子请求 | 每次最多 1 个在途请求（见 §6 并发） |
| S4 | `tray:spawned` | 仅用于统计"仍需颜色集合"刷新（供 S4 下次加权） |
| S1 | 关卡装配指令 | BOOT → PLAYING 时装入矩阵并初始化全 `empty/locked` |
| 关卡数据 | 矩阵 + cols/rows | BOOT 期已过静态校验 |

## 4. 输出与反馈

| 事件/表现 | 条件 | 对齐 |
|---|---|---|
| `bead:placed` | 裁决通过 | 落座动画 `vfx_fill_pop`（assets-spec §1.6）+ 音效 |
| `bead:rejected` | 颜色不匹配 | `vfx_wrong_shake` ±3px ×2 + `danger` 描边闪 ≤2 次/秒（§3.8） |
| 完成前置信号 → `level:cleared` | 可填格全满 | 庆祝 `vfx_complete_wave`（按列延迟 20ms） |
| 格子绘制 | `filled/empty/locked` | assets-spec §1.2 六状态参数卡 |

## 5. 数值

全部引用 `systems-index §3`：§3.2（`BEAD_CHARSET`、`BEAD_COLOR_MAX`、`BEAD_PALETTE` 索引映射）、§3.3（`BEAD_CELL`、pitch 52、`GRID_MAX_COLS/ROWS`、`GRID_MIN_COLS/ROWS`、定位公式）、§3.8（错误反馈频率红线）。

## 6. 边界条件

**极端值**
- 矩阵无可填格（全 `x`/预填）：关卡硬约束（core-loop §6），静态校验拒绝，运行时断言兜底 → BOOT 拒入。
- `colorIdx` 越界（> `BEAD_COLOR_MAX` 或 0）：防御性拒绝，按 `bead:rejected` 处理并记警告日志。
- 最后一颗可填格与失败同帧：S1 按 cleared 优先裁决（`core-loop §6`，机制见 §2.2.2：cleared 属输入段、failed 属计时段），S3 照常广播 `bead:placed` —— 且该回执**先于** `level:cleared`（玩法事件段内序，WXG-T-061 补齐）。

**并发 / 竞态**
- 同一帧多次落子请求：**串行化**——S3 逐条裁决，第一条生效后第二条的目标格若已被占则走"忽略"分支；禁止批量原子合并。
- 落子请求与 `level:cleared` 广播同帧：两者同属**输入段**、每帧最多 1 条指令 ⇒ 本帧内**不可能**发生「cleared 后再落子」；跨帧时 cleared 之后的请求一律忽略（状态机已离开 PLAYING）。WXG-T-061 换基准，结论不变。
- 托盘珠被 S6 道具移除瞬间其落子请求在途：S3 裁决前向 S4 复核该 slot 仍持有同色珠，否则忽略。

**非法输入**
- `(row, col)` 越界：忽略 + 警告日志。
- 对 `locked`/`filled` 格落子：静默忽略（core-loop §2.2/§6）。
- BOOT 未装配即收到落子请求：忽略（状态机保护）。

## 7. 依赖

- **上游**：S1（装配/状态机）、S2（落子请求）、S4（托盘持有状态复核）、关卡数据（BOOT 静态校验后输入）。
- **下游**：S1（cleared 前置信号）、S4（仍需颜色集合，经事件间接）、S7（placed/cleared 计数）、视觉/音频层（事件消费）。

## 8. 验收标准（可测试硬判据，QA 直接造用例）

1. 装载合法关卡后，`empty` 格数 + `locked` 格数 === cols×rows，且 ≥1 格为 `empty`。
2. 匹配落子：目标格变 `filled` 且 colorIdx 与图案一致；`bead:placed` 恰广播 1 次，payload 含 row/col/colorIdx/slot。
3. 不匹配落子：目标格保持 `empty`；`bead:rejected` 恰广播 1 次；对应托盘珠未被移除。
4. 对 `locked` 格与 `filled` 格落子：**零事件、零反馈**（用事件监听计数器断言 =0）。
5. 将图案仅剩的 1 个可填格填满 → S1 收到 cleared 前置信号 ≤ 1 帧内；`filled` 数 === 可填格总数。
6. `filled` 格被道具指令命中 → 状态不变（不可回退），用例重复 3 种道具各 1 次。
7. 同帧双落子同格：仅第 1 条生效，第 2 条走忽略分支，`bead:placed` 总数 =1。
8. 全部 13×12 = 156 格极端关卡：格中心坐标逐格符合 §2.4 公式（抽样四角 + 中心共 5 格断言，误差 ≤0.5px）。
9. colorIdx = 0 或 99 的落子请求：按 `bead:rejected` 处理且记警告，不崩溃。
10. 黑白模式下 `filled` 格仅凭符号+明度可与全部 10 色区分（对照 assets-spec §6 验收第 2 条联合用例）。
