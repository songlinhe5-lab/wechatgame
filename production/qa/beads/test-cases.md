# 《拼豆填色消除》(beads) 测试用例 · Test Cases

- 任务号：WXG-T-011 / WXG-T-028 ｜ 作者：严守真 ｜ 版本 v1.2 ｜ 日期 2026-09-12
- **判据来源**：`games/beads/design/gdd/{core-loop,bead-grid,tray-spawner,input-control,timer-gameover}.md` 各 §8（每份 10 条）+ `games/beads/design/gdd/score-combo.md` §8（冲刺 11 条，v1.2 新增）——**合计 61 条**；常量引 `systems-index.md §3`（含 §3.10）+ `art/accessibility.md`。**全部逐条标注来源，零自造数值。**
- 常量速查（来源 `systems-index §3`）：`TRAY_BASE_SLOTS=12`、`SPAWN_INTERVAL_DEFAULT=4.0s`（区间 [2.0,6.0]）、`NEEDED:DECOY=3:1`、`LEVEL_TIME_DEFAULT=300s`（区间 [180,420]）、`TIMER_URGENT_T=10s`、`TIMER_TICK=1.0s`、`GRID_MAX=13×12`、`STAR3_RATIO=0.32`、`STAR2_RATIO=0.12`、`DEMO_LEVEL_COUNT=8`、`POWERUP_FREE_USES=1`、`REGION_CLEAR_SLOTS=6`、`RANDOM_CLEAR_COUNT=5`、命中区外扩 8px（66²/62²）。
- 常量速查·冲刺（来源 `systems-index §3.10`，2026-09-12 冻结）：`SPRINT_TIME_DEFAULT=120s`（区间 [90,120]，越界回退默认）、`COMBO_WINDOW_S=5.0s`、`COMBO_STREAK_TIERS=[2,4,7]`→倍率 ×2/×3/×5（上限 ×5）、`SCORE_PER_BEAD=10`、`STAGE_BONUS_TIME=+15s`、`STAGE_CLEAR_BONUS=200+50×stageIndex`、C7 结算分 `stars×1000+round(ratio×1000)−powerupsUsed×50+(未用扩展?200:0)`、C8 裁决（stage 切换不断连；stage 加时与归零同帧 stage 优先）、伪震屏 scale 1.00→1.015→1.00 / 150ms。

**图例**：`[Node]` vitest ｜ `[Harness]` 浏览器 ｜ `[DevTools]` 开发者工具（需编辑器）｜ `[Device]` 真机。
**状态**：本轮 beads 实现 0 行 → 全部标 **`待实现`**（判据已冻结，WXG-T-001 流水线落地后回归；v1.2 注：冲刺侧工程实现由 WXG-T-027 进行中）。

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
| TC-CONST-05 | 星级阈值 | `[Node]` | ratio≥0.32→3★；≥0.12→2★；否则 1★；过关至少 1★；扩展不扣星 | §3.7（A7）⚠️ 无 S7 GDD | 待实现 |
| TC-CONST-06 | 解锁线性推进 | `[Node]` | 过 n 关解锁 n+1；星级只记录不设门槛 | §3.7 | 待实现 |
| TC-CONST-07 | 道具规格 | `[Node]` | region=连续 6 槽；random=随机 5 颗；每道具免费 1 次（超出角标引导） | §3.6（A5/A6） | 待实现 |
| TC-CONST-08 | 道具不清网格 | `[Node]` | 三道具均不改 `filled` 格（已填=玩家进度） | §3.6 | 待实现 |
| TC-A11Y-01 | 减弱动效开关 | `[DevTools]` | 关停：落座回弹/溶解缩放/错误抖动/波浪弹跳/告急脉冲；保留：颜色符号变化/面板淡入淡出/hint 静态描边 | `accessibility.md D1` | 待实现 |
| TC-A11Y-02 | 扩展按钮热区修正 | `[Device]` | `btn_expand` 视觉 132×48 但热区 **132×88** | `accessibility.md C1` | 待实现 |
| TC-A11Y-03 | 三重编码 | `[Device]` | 10 色绑唯一矢量符号 + 明度 5 档；6 状态各有非颜色通道 | `accessibility.md A1/A2` | 待实现 |
| TC-A11Y-04 | 错误反馈频率 | `[Node]` | `wrong` 抖动+描边闪 ≤2 次/秒；无 >3Hz 闪烁、无全屏白闪、不屏震 | §3.8 / D2 | 待实现 |

---

# §C 冲刺模式判据用例（11 条，判据 1:1 映射）— 来源 `score-combo.md §8.1..11`（v1.2 新增，WXG-T-028）

> 事件 payload 以 `systems-index §4` 登记定稿为准（`combo:up {streak, multiplier, tier}`、`combo:break {reason}`、`sprint:stage {stageIndex, nextParams}`、`sprint:ended {score, bestStage, settleScore}`）。

| ID | 判据 # | 用例 | 环境 | 预期 / 判据 | 状态 |
|---|---|---|---|---|---|
| TC-SPRINT-01 | §8.1 | 普通模式零计分 HUD + 星级四点采样 | `[Node]` + `[DevTools]` | 普通模式（mode='normal'）局内全程 DOM 中**零分数 HUD 元素**；构造 ratio=0.32→3★ / 0.319→2★ / 0.12→2★ / 0.119→1★，`level:cleared.stars` 四点逐一吻合（来源 `systems-index §3.7`，`STAR3_RATIO=0.32`/`STAR2_RATIO=0.12`） | 待实现 |
| TC-SPRINT-02 | §8.2 | 结算分 C7 四因子各 1 例复算 | `[Node]` | 构造 4 组（stars/ratio/powerupsUsed/扩展组合各 1 例）：例 ①stars=3, ratio=0.50, powerupsUsed=2, 用扩展 → 3000+500−100+0=3400；例 ②stars=1, ratio=0.10, powerupsUsed=0, 未用扩展 → 1000+100+0+200=1300（公式来源 `systems-index §3.10` C7；局内不显示，仅结算/排行消费） | 待实现 |
| TC-SPRINT-03 | §8.3 | sprint 单局时长 = 默认值 | `[Node]` | 未覆盖 `SPRINT_TIME` 起局，计时实测 =120s，误差 ≤±0.5s（联合 `timer-gameover §8.1` 口径；来源 `systems-index §3.10` `SPRINT_TIME_DEFAULT`）；越界覆盖（<90 或 >120）→ BOOT 拒绝回退默认（`score-combo §6`） | 待实现 |
| TC-SPRINT-04 | §8.4 | streak 阈值升档恰一次 + 封顶 | `[Node]` | 正确落子 streak 依次达 2/4/7（`systems-index §3.10` `COMBO_STREAK_TIERS=[2,4,7]`）→ 倍率切 ×2/×3/×5，`combo:up` 恰各 1 次（总计 3 次）；streak 8/9/10… 继续增长但倍率封顶 ×5、`combo:up` 不再发出 | 待实现 |
| TC-SPRINT-05 | §8.5 | 断连三分支 | `[Node]` | ①放错：`bead:rejected` 后 streak=0、倍率回 ×1、`combo:break{reason:'wrong'}` 恰 1 次；②超窗：正确落子后间隔 >`COMBO_WINDOW_S`(5.0s) 无落子 → `combo:break{reason:'timeout'}` 恰 1 次；③无第三分支误触发：stage 切换、`game:paused/resumed`、`powerup:used`（清槽）均**不发** `combo:break`（stage 不断连 = C8 裁决，`systems-index §3.10`） | 待实现 |
| TC-SPRINT-06 | §8.6 | stage 切换三断言 | `[Node]` | 填满 stage n → `sprint:stage{stageIndex:n+1}` 恰 1 次（含 `nextParams`）；新图案 ≤1 帧装载完成；**连击跨 stage 延续**：streak 值不变、倍率不变、无 `combo:break`（C8 条款，`systems-index §3.10`） | 待实现 |
| TC-SPRINT-07 | §8.7 | stage 加时 + 同帧 C8 裁决 | `[Node]` | stage 完成加时后 remaining = 原值 + `STAGE_BONUS_TIME`(15s)，钳单局上限 120s（`systems-index §3.10`）；构造 stage 填满与倒计时归零**同帧** → **stage 优先结算再加时**：加时后 >0 继续爬梯不判负，仍 ≤0 才判负（C8，`score-combo §6`） | 待实现 |
| TC-SPRINT-08 | §8.8 | 单局得分 20 落子序列逐步复算 | `[Node]` | 注入 20 次落子序列（含升档/断连/至少 1 次 stage 切换），逐步断言：每次正确落子增量 = `SCORE_PER_BEAD`(10)×当前倍率；stage 完成增量 = `STAGE_CLEAR_BONUS`(200+50×stageIndex)；单局总分 = Σ(10×倍率) + Σ stage 奖励（`systems-index §3.10` C4/C5） | 待实现 |
| TC-SPRINT-09 | §8.9 | 特效三档对应 + 红线帧检 | `[DevTools]` | ×2 → 珠面星光粒子（ux-spec §5 200ms）；×3 → 伪震屏 scale 1.00→1.015→1.00 / 150ms（`systems-index §3.10` U3）；×5 → 全屏爆发（边缘径向光+珠面波浪，ux-spec §5 350ms）——档位与倍率一一对应、无错档；全程帧检：无 >3Hz 闪烁、**无真位移震屏**（`systems-index §3.8` 红线） | 待实现 |
| TC-SPRINT-10 | §8.10 | PAUSED 冻结窗口 + 模式互窜防御 | `[Node]` | ①连击进行中 `game:paused` → 窗口计时冻结（复用 S5 冻结语义），恢复后从暂停值续算、不追溯断连（`score-combo §6`）；②sprint 中注入 `level:cleared`（stage 完成不走该事件）→ 防御忽略 + 警告日志，状态机无变化；反向：普通模式连击计数恒 0（mode 从 S1 单向读取） | 待实现 |
| TC-SPRINT-11 | §8.11 | 破纪录判定 | `[Node]` + `[DevTools]` | 预置 S8 冲刺最佳分 B：①结算分 >B → NEW BEST 角标显示（结算面板，ux-spec §3）且 `sprint:ended` 后 S8 写入新值；②结算分 ≤B → 不写不显示、S8 值不变（`score-combo §8.11`） | 待实现 |

---

| 分组 | 判据条数 | 用例数 | 环境分布 |
|---|---|---|---|
| A1 core-loop | 10 | 10 | 9×Node + 1×Node(存档) |
| A2 bead-grid | 10 | 10 | 9×Node + 1×DevTools |
| A3 tray-spawner | 10 | 10 | 全 Node |
| A4 input-control | 10 | 10 | 7×Node + 1×DevTools + 1×Device + 1×Node |
| A5 timer-gameover | 10 | 10 | 9×Node + 1×DevTools |
| §B 派生 | — | 12 | 7×Node + 4×DevTools/Device + 1×Node |
| §C 冲刺（score-combo §8） | 11 | 11 | 9×Node + 2×DevTools（含 1 条 Node+DevTools 联合） |
| **合计** | **61（判据 100% 覆盖）** | **73** | Node 65 / DevTools 6 / Device 2 |

**指定边界例落点**：cleared/failed 同帧 → TC-LOOP-05 + TC-TIMER-04；满槽跳过 → TC-LOOP-03 + TC-TRAY-04；双击幂等 → TC-TRAY-06 + TC-INP-06；存档越界降级 → TC-LOOP-10；sprint 加时/归零同帧（C8）→ TC-SPRINT-07；模式互窜注入 → TC-SPRINT-10。

> **R1 缺口**：S6 道具行为细节、S7 星级计算、S8 存档结构、S9 面板细节的 GDD 未写，§3 常量仅支撑 §B 派生层判据；G4 完整判定须待四份 GDD 补齐（已回报主理人）。
>
> **v1.2 注（WXG-T-028，2026-09-12）**：R1 缺口中 **S7 GDD 已交付并冻结**（`score-combo.md` v1.0，冲刺常量 C1–C8 回写 `systems-index §3.10`），冲刺判据以 §C 11 条覆盖。§B `TC-CONST-05` 的「⚠️ 无 S7 GDD」标注已过期，按"追加不覆盖"纪律 v1.1 原文保留不改，仅在此登记。

---

# §D 道具系统判据用例（10 条 = 判据 1:1）— 来源 `powerups.md §8.1..10`（WXG-T-060 落码；实现与自动化见 `games/beads/tests/powerups.test.ts`）

| # | 用例 | 判据 | 自动化断言要点 |
|---|---|---|---|
| D1 | region 窗口恒长与集合正确 | S6§8-1 | 无选中、8 颗持有 → `affectedSlots = [0..5]`（恒 `REGION_CLEAR_SLOTS`），窗口外 6/7 不动；`powerup:used` 恰 1 次且与 S4 实际清空 1:1 |
| D2 | region 锚点规则 | S6§8-2 | 有选中（槽 6）→ `[4,5,6,7]`；无选中 → 最小持有槽为锚；选中槽被清后选中态归 `-1` |
| D3 | region 钳制与跨行 | S6§8-3 | 锚点 0 → `[0..5]`；锚点 11 → 末 6 槽、零越界；扩展态锚点 11 → `[9..13]` **跨 11\|12 行界不截断** |
| D4 | random 唯一随机源 | S6§8-4 | 同 seed 两次逐槽相同；固定 seed 200 次抽样偏差 ≤ ±20%（**判据容差偏紧，见 backlog**）；`check:arch` 断言零 `Math.random` |
| D5 | random 不足数不补抽 | S6§8-5 | 持有 3 颗 → 清 3 颗、事件恰 1 次；持有 1 颗 → 清 1 颗；不复活任何珠 |
| D6 | clearAll 全容量清槽 | S6§8-6 | 满 12 槽 → 全 free + 选中态清除；≤1 个 `SPAWN_INTERVAL` 后供料恢复（联合 S1§8-3）；扩展态 14 颗全清 |
| D7 | 零网格写入 | S6§8-7 | 三道具各用 1 次前后 `filled/empty/locked` 计数逐一相等；`bead:placed`+`bead:rejected` 增量为 0（对齐 S3§8-6） |
| D8 | 免费次数、超限占位与重置 | S6§8-8 | 三计数独立（各 1 次 = 3 次效果）；第 2 次点击 → 零事件/零槽变/零扣次 + 占位轻提示；**全程零 `load`/`show` 广告调用**（替身计数）；失败重试后回 `POWERUP_FREE_USES` 且扩展复位 |
| D9 | 空作用 / 非法 type / 状态门禁 | S6§8-9 | 空托盘 → 零事件且**不扣次**；非法 type → 忽略 + 警告不崩溃；PAUSED / LEVEL_CLEAR / GAME_OVER / FINISH 四态注入 → 事件 0、计数不扣 |
| D10 | 同帧竞态守恒 | S6§8-10 | 道具 vs 供料同帧 → 新珠按到达序一并清除（6 槽）；落子先到 → 该槽空作用不扣次；`tray:expanded` 同帧 → 窗口按新容量解释、零越界、无同槽二次清除 |

> 角标视觉项（§8-8 末句）标 `[DevTools]`；本表断言的是其**事件学**（零事件 / 零扣次 / 零广告调用），观感随 EP10-S3 真机复核。

---

# §E 帧内执行序用例（4 条；基准条款，无独立 §8 编号）— 来源 `core-loop.md §2.2.2`（WXG-T-061 换基准；自动化见 `games/beads/tests/frame-order.test.ts`）

> 背景：原 `core-loop §6` / `tray-spawner §6` / `powerups §6` / `score-combo §6` 中以「事件**到达序** / 以**先到**为准」为基准的「同帧」条款，在单线程固定步长循环里**不可观测**（一帧内只有代码执行序）⇒ **不可测**。现统一基准为帧内序：**输入（段内序：状态指令 → 玩法事件）→ 连击窗（仅冲刺）→ 供料 → 计时**。

| # | 用例 | 判据来源 | 自动化断言要点 |
|---|---|---|---|
| E1 | 暂停请求 vs 供料同帧 | `core-loop §6`（供料 tick 与暂停同帧） | 齿轮点击注入在**供料帧**内 ⇒ 相位 PAUSED、`game:paused` 恰 1 次、**本帧零 `tray:spawned`**；对照组（不注入）同帧确实供料 |
| E2 | 道具 vs 供料同帧 | `powerups §6`（与供料同帧） | 道具卡同帧注入 ⇒ `powerup:used` 先于 `tray:spawned`（事件序）、清的是**旧**珠、供料新珠**存活**（帧末恰 1 颗且不在旧槽） |
| E3 | 最后一格 vs 同帧归零 | `core-loop §6`（cleared 优先）+ §2.2.2 | 逼到「下一帧必归零」后在同帧点下最后一格 ⇒ 相位 LEVEL_CLEAR、`level:cleared`=1、**`level:failed`=0**、**本帧零 `timer:tick` 与零 `tray:spawned`**（输入段离开 PLAYING ⇒ 本帧直接返回） |
| E4 | 玩法事件段内序 | `core-loop §2.2.2`（本轮补齐） | `bead:placed` 在事件日志中**先于** `level:cleared`；供料帧内 `tray:spawned` 先于 `timer:tick`（供料段先于计时段） |

> 标定纪律（写进用例以防复发）：① 供料帧号由**探针实测**，不写死常数——累计 `1/60` 有浮点漂移，`240×1/60` 略小于 4.0，供料实际落在**第 241 帧**；② **`giveTrayBead()` 自身会发 `tray:spawned`**，计数断言必须用增量或对照组。
