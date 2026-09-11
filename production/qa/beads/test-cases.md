# 《拼豆填色消除》(beads) 测试用例 · Test Cases

- 任务号：WXG-T-011 ｜ 作者：严守真 ｜ 版本 v1.0 ｜ 日期 2026-09-11
- **判据来源**：`games/beads/design/gdd/{core-loop,bead-grid,tray-spawner,input-control,timer-gameover}.md` 各 §8（每份 10 条，**合计 50 条**）+ `systems-index.md §3` + `art/accessibility.md`。**全部逐条标注来源，零自造数值。**
- 常量速查（来源 `systems-index §3`）：`TRAY_BASE_SLOTS=12`、`SPAWN_INTERVAL_DEFAULT=4.0s`（区间 [2.0,6.0]）、`NEEDED:DECOY=3:1`、`LEVEL_TIME_DEFAULT=300s`（区间 [180,420]）、`TIMER_URGENT_T=10s`、`TIMER_TICK=1.0s`、`GRID_MAX=13×12`、`STAR3_RATIO=0.50`、`STAR2_RATIO=0.20`、`DEMO_LEVEL_COUNT=8`、`POWERUP_FREE_USES=1`、`REGION_CLEAR_SLOTS=6`、`RANDOM_CLEAR_COUNT=5`、命中区外扩 8px（66²/62²）。

**图例**：`[Node]` vitest ｜ `[Harness]` 浏览器 ｜ `[DevTools]` 开发者工具（需编辑器）｜ `[Device]` 真机。
**状态**：本轮 beads 实现 0 行 → 全部标 **`待实现`**（判据已冻结，WXG-T-001 流水线落地后回归）。

---

# §A 硬判据用例（50 条 = 5 组 × 10，判据 1:1 映射）

## A1 · 核心循环（S1）— 来源 `core-loop.md §8.1..10`

| ID | 判据 # | 用例 | 环境 | 预期 / 判据 | 状态 |
|---|---|---|---|---|---|
| TC-LOOP-01 | §8.1 | 冷启动分流 | `[Node]` | 无存档→第 1 关 PLAYING，**无主菜单**；有存档→续进已解锁最远关 | 待实现 |
| TC-LOOP-02 | §8.2 | 供料节律 | `[Node]` | 默认间隔下 PLAYING 60s 托盘恰 +15 颗（±1）；来源 §3.4 `SPAWN_INTERVAL_DEFAULT` | 待实现 |
| TC-LOOP-03 | §8.3 | **满槽跳过不判负** | `[Node]` | 12 槽全占→停止供料 + `tray:full`，**不触发失败**（决策 D7）；任一清槽道具后供料恢复 | 待实现 |
| TC-LOOP-04 | §8.4 | 落子双路反馈 | `[Node]` | 匹配→珠离托盘/格 `filled`/`bead:placed` 恰 1 次；不匹配→珠留原槽/格 `empty`/`bead:rejected` 恰 1 次 | 待实现 |
| TC-LOOP-05 | §8.5 | **cleared/failed 同帧 → cleared 优先** | `[Node]` | 构造剩余 0.01s 放最后一颗 → 必进 LEVEL_CLEAR；只发 `level:cleared` 不发 `level:failed` | 待实现 |
| TC-LOOP-06 | §8.6 | 归零判负 + 整关重置 | `[Node]` | 归零未满图→GAME_OVER；重试后倒计时回满/图案全清/托盘全清/扩展重置/道具次数重置 | 待实现 |
| TC-LOOP-07 | §8.7 | 暂停冻结 | `[Node]` | PAUSED 期间剩余时间不变、不供料；继续后从暂停值恢复 | 待实现 |
| TC-LOOP-08 | §8.8 | 解锁推进 | `[Node]` | 过第 n 关（n<8）→第 n+1 关解锁可进；过第 8 关→FINISH；FINISH 可重玩第 1 关 | 待实现 |
| TC-LOOP-09 | §8.9 | 关卡数据校验拒绝 | `[Node]` | 含 `BEAD_CHARSET` 之外字符或全锁定格 → BOOT 拒入，错误含关卡 id+行列 | 待实现 |
| TC-LOOP-10 | §8.10 | **存档越界降级** | `[Node]` | `unlockedLevel=99`、stars 非法 → 降级进第 1 关，不崩溃、不中断启动 | 待实现 |

## A2 · 拼图网格与填色（S3）— 来源 `bead-grid.md §8.1..10`

| ID | 判据 # | 用例 | 环境 | 预期 / 判据 | 状态 |
|---|---|---|---|---|---|
| TC-GRID-01 | §8.1 | 装配不变量 | `[Node]` | `empty`+`locked` === cols×rows，且 ≥1 格 `empty` | 待实现 |
| TC-GRID-02 | §8.2 | 匹配落座 | `[Node]` | 格变 `filled` 且 colorIdx 与图案一致；`bead:placed` 恰 1 次，payload 含 row/col/colorIdx/slot | 待实现 |
| TC-GRID-03 | §8.3 | 不匹配拒绝 | `[Node]` | 格保持 `empty`；`bead:rejected` 恰 1 次；托盘珠未移除 | 待实现 |
| TC-GRID-04 | §8.4 | **锁定/已填格零事件** | `[Node]` | 对 `locked`/`filled` 落子：事件计数器 =0，零反馈 | 待实现 |
| TC-GRID-05 | §8.5 | 最后一格即通关 | `[Node]` | 仅剩 1 可填格填满 → S1 收 cleared 前置信号 ≤1 帧；`filled` 数 === 可填格总数 | 待实现 |
| TC-GRID-06 | §8.6 | **`filled` 不可回退** | `[Node]` | 三种道具指令各命中 `filled` 格 1 次 ×3 → 状态均不变（来源 §3.6 道具仅作用托盘） | 待实现 |
| TC-GRID-07 | §8.7 | **同帧双落子串行化** | `[Node]` | 同帧两条同格请求：第 1 条生效，第 2 条忽略；`bead:placed` 总数 =1 | 待实现 |
| TC-GRID-08 | §8.8 | 13×12 极端定位 | `[Node]` | 156 格抽样四角+中心共 5 格，坐标符合 §2.4 公式，误差 ≤0.5px | 待实现 |
| TC-GRID-09 | §8.9 | colorIdx 越界防御 | `[Node]` | colorIdx=0 或 99 → 按 `bead:rejected` 处理 + 警告日志，不崩溃 | 待实现 |
| TC-GRID-10 | §8.10 | 黑白可辨（联合用例） | `[DevTools]` | 灰度下 `filled` 凭符号+明度与 10 色可区分（对照 `assets-spec §6` 验收 2） | 待实现 |

## A3 · 供料与托盘（S4）— 来源 `tray-spawner.md §8.1..10`

| ID | 判据 # | 用例 | 环境 | 预期 / 判据 | 状态 |
|---|---|---|---|---|---|
| TC-TRAY-01 | §8.1 | 供料间隔 | `[Node]` | 默认下 60s `tray:spawned` 恰 15 次（±1），间隔 4.0s ±0.1s | 待实现 |
| TC-TRAY-02 | §8.2 | 落槽均匀性 | `[Node]` | 200 次供料，任一槽频次与均匀分布偏差 ≤±20% | 待实现 |
| TC-TRAY-03 | §8.3 | 抽色加权 3:1 | `[Node]` | "仍需 1 色 + 1 杂色"关卡 100 次供料，所需色占比 ≈75%（±10pp） | 待实现 |
| TC-TRAY-04 | §8.4 | **满槽跳过/恢复** | `[Node]` | 满槽→`tray:full` 恰 1 次且满槽期间不重复；腾 1 槽后 ≤1 间隔恢复供料 | 待实现 |
| TC-TRAY-05 | §8.5 | 扩展容量与重置 | `[Node]` | 扩展后 =12+12；失败重试回基线且需重新解锁（A1：不跨关） | 待实现 |
| TC-TRAY-06 | §8.6 | **换选/双击幂等** | `[Node]` | 同帧点两不同槽→仅 1 槽 `selected`；双击同槽→`tray:selected` 仅 1 次 | 待实现 |
| TC-TRAY-07 | §8.7 | 落子回执离槽 | `[Node]` | `bead:placed` 计数与 `free` 槽增量 1:1 断言 | 待实现 |
| TC-TRAY-08 | §8.8 | 暂停零供料 | `[Node]` | PAUSED 期间 `tray:spawned` =0；恢复后首个供料 ≥"暂停剩余间隔+1 帧" | 待实现 |
| TC-TRAY-09 | §8.9 | 0 杂色关卡 | `[Node]` | 关卡声明 0 杂色 → 供料 100% 为仍需颜色 | 待实现 |
| TC-TRAY-10 | §8.10 | 道具清 6 槽 | `[Node]` | 清 6 槽（含选中槽）→选中清除、6 槽全 `free`、`powerup:used.affectedSlots` 与实际一致 | 待实现 |

## A4 · 输入与操控（S2）— 来源 `input-control.md §8.1..10`

| ID | 判据 # | 用例 | 环境 | 预期 / 判据 | 状态 |
|---|---|---|---|---|---|
| TC-INP-01 | §8.1 | 五类路由 | `[Node]` | 暂停→S9；道具卡→S6；扩展→S4；托盘珠→`tray:selected`；空格(有选中)→S3 收请求 | 待实现 |
| TC-INP-02 | §8.2 | 热区边界 | `[DevTools]` | 格心偏移 ≤ 外扩边界内必命中；带间隙处点击零事件 | 待实现 |
| TC-INP-03 | §8.3 | 单触摸单指令 | `[Node]` | 监听计数总和 =1；面板打开时玩法区点击 =0（门禁屏蔽） | 待实现 |
| TC-INP-04 | §8.4 | **重叠区最近格心** | `[Node]` | 13 列满密度下，相邻两格中点 ±1px 用例 → 命中格心更近者（平局取 row 小者，§6） | 待实现 |
| TC-INP-05 | §8.5 | 非法格零反馈 | `[Node]` | 锁定/已填格点击：S2 与 S3 事件计数均 =0，无反馈帧 | 待实现 |
| TC-INP-06 | §8.6 | **双击幂等/换选** | `[Node]` | 双击同珠→`tray:selected` 1 次；双击不同珠→2 次、后者 selected | 待实现 |
| TC-INP-07 | §8.7 | 无选中点网格 | `[Node]` | 不发落子请求（S3 计数 =0），有轻提示 | 待实现 |
| TC-INP-08 | §8.8 | PAUSED 门禁 | `[Node]` | PAUSED 点托盘/网格/道具全忽略；仅面板按钮响应 | 待实现 |
| TC-INP-09 | §8.9 | 多点触控 | `[Device]` | 双指同帧仅第一触点生效，指令数 =1 | 待实现 |
| TC-INP-10 | §8.10 | 指令洪泛 | `[Node]` | 注入 20 触摸/帧 → 仅 1 条入路由，无崩溃、无事件错序 | 待实现 |

## A5 · 倒计时与失败（S5）— 来源 `timer-gameover.md §8.1..10`

| ID | 判据 # | 用例 | 环境 | 预期 / 判据 | 状态 |
|---|---|---|---|---|---|
| TC-TIMER-01 | §8.1 | 计时精度 | `[Node]` | 从 `LEVEL_TIME_DEFAULT` 递减；60s 实测误差 ≤±0.5s（dt 累计 vs 墙钟） | 待实现 |
| TC-TIMER-02 | §8.2 | tick 粒度 | `[Node]` | 每 1.0s 恰 1 次 `timer:tick`，payload 与 HUD mm:ss 取整一致 | 待实现 |
| TC-TIMER-03 | §8.3 | 告急触发 | `[Node]` | 降穿 `TIMER_URGENT_T` 瞬间 `timer:urgent` 恰 1 次，HUD 切 danger+脉冲（用 LEVEL_TIME=180 快进） | 待实现 |
| TC-TIMER-04 | §8.4 | **归零/同帧 cleared 优先** | `[Node]` | 归零→GAME_OVER 且 `level:failed` 恰 1 次；同帧填满最后格用例**仅** `level:cleared` | 待实现 |
| TC-TIMER-05 | §8.5 | **暂停 300s 冻结** | `[Node]` | 恢复后 remaining 与暂停前一致（≤1 帧 dt）；期间 `timer:tick` 计数 =0 | 待实现 |
| TC-TIMER-06 | §8.6 | **重置五项逐一断言** | `[Node]` | 倒计时回满/图案全空(locked 保持)/托盘全空/扩展回基线/道具次数回 `POWERUP_FREE_USES` | 待实现 |
| TC-TIMER-07 | §8.7 | LEVEL_TIME 区间 | `[Node]` | 181 与 419 正常运行；100 与 999 被 BOOT 校验拒绝、不进 PLAYING（区间 [180,420]） | 待实现 |
| TC-TIMER-08 | §8.8 | 0.4s 暂停恢复 | `[Node]` | 不判负、从 0.4s 继续；自然流到 0 才判负（取整显示错位仅 <1s 区间） | 待实现 |
| TC-TIMER-09 | §8.9 | 重复暂停幂等 | `[Node]` | 已暂停再 `game:paused` → 保存值不被覆盖，恢复后 remaining 正确 | 待实现 |
| TC-TIMER-10 | §8.10 | 告急脉冲频率 | `[DevTools]` | 脉冲周期 1000ms ±50ms，≤3Hz；与满槽告警同屏叠加无 >3Hz 闪烁（§3.8 红线） | 待实现 |

---

# §B 派生用例（来源 systems-index §3 / accessibility.md，无 §8 编号，标注来源）

| ID | 用例 | 环境 | 预期 / 判据 | 来源 | 状态 |
|---|---|---|---|---|---|
| TC-CONST-01 | 扩展槽规格 | `[Node]` | 扩展容量 = `TRAY_EXPAND_SLOTS`(12)，虚线→实线；仅本关有效 | §3.4 | 待实现 |
| TC-CONST-02 | 供料间隔关卡覆盖区间 | `[Node]` | 覆盖值 ∈[2.0,6.0] 合法，越界被 BOOT 拒 | §3.4（A2） | 待实现 |
| TC-CONST-03 | 杂色上限 | `[Node]` | 关卡 `DECOY_COLORS_MAX`=2 上限，超出被拒 | §3.2（A3） | 待实现 |
| TC-CONST-04 | 网格尺寸上限 | `[Node]` | cols ≤13、rows ≤12（pitch 52；674≤690、622≤640） | §3.3 | 待实现 |
| TC-CONST-05 | 星级阈值 | `[Node]` | ratio≥0.50→3★；≥0.20→2★；否则 1★；过关至少 1★；扩展不扣星 | §3.7（A7）⚠️ 无 S7 GDD | 待实现 |
| TC-CONST-06 | 解锁线性推进 | `[Node]` | 过 n 关解锁 n+1；星级只记录不设门槛 | §3.7 | 待实现 |
| TC-CONST-07 | 道具规格 | `[Node]` | region=连续 6 槽；random=随机 5 颗；每道具免费 1 次（超出角标引导） | §3.6（A5/A6） | 待实现 |
| TC-CONST-08 | 道具不清网格 | `[Node]` | 三道具均不改 `filled` 格（已填=玩家进度） | §3.6 | 待实现 |
| TC-A11Y-01 | 减弱动效开关 | `[DevTools]` | 关停：落座回弹/溶解缩放/错误抖动/波浪弹跳/告急脉冲；保留：颜色符号变化/面板淡入淡出/hint 静态描边 | `accessibility.md D1` | 待实现 |
| TC-A11Y-02 | 扩展按钮热区修正 | `[Device]` | `btn_expand` 视觉 132×48 但热区 **132×88** | `accessibility.md C1` | 待实现 |
| TC-A11Y-03 | 三重编码 | `[Device]` | 10 色绑唯一矢量符号 + 明度 5 档；6 状态各有非颜色通道 | `accessibility.md A1/A2` | 待实现 |
| TC-A11Y-04 | 错误反馈频率 | `[Node]` | `wrong` 抖动+描边闪 ≤2 次/秒；无 >3Hz 闪烁、无全屏白闪、不屏震 | §3.8 / D2 | 待实现 |

---

## 统计与覆盖矩阵

| 分组 | 判据条数 | 用例数 | 环境分布 |
|---|---|---|---|
| A1 core-loop | 10 | 10 | 9×Node + 1×Node(存档) |
| A2 bead-grid | 10 | 10 | 9×Node + 1×DevTools |
| A3 tray-spawner | 10 | 10 | 全 Node |
| A4 input-control | 10 | 10 | 7×Node + 1×DevTools + 1×Device + 1×Node |
| A5 timer-gameover | 10 | 10 | 9×Node + 1×DevTools |
| §B 派生 | — | 12 | 7×Node + 4×DevTools/Device + 1×Node |
| **合计** | **50（判据 100% 覆盖）** | **62** | Node 56 / Harness+DevTools 4 / Device 2 |

**指定边界例落点**：cleared/failed 同帧 → TC-LOOP-05 + TC-TIMER-04；满槽跳过 → TC-LOOP-03 + TC-TRAY-04；双击幂等 → TC-TRAY-06 + TC-INP-06；存档越界降级 → TC-LOOP-10。

> **R1 缺口**：S6 道具行为细节、S7 星级计算、S8 存档结构、S9 面板细节的 GDD 未写，§3 常量仅支撑 §B 派生层判据；G4 完整判定须待四份 GDD 补齐（已回报主理人）。
