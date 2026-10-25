> **本片 = `production/qa/beads/test-cases.md` 的分片（WXG-T-225，2026-10-25）。**
> 判据**零改动、零删除**，原文逐字搬迁（K-051/K-053）；差异仅限标题标记与本头注。
> 本片 = §B–§F（派生 / 冲刺 / 道具 / 帧序 / 结算）；§G 起在下一片。
> 上片 `test-cases-a-input.md` ← 本片 → 下片 `test-cases-g-perceptual.md`｜总索引 `test-cases.md#§分片索引（WXG-T-225 · 13 片，先看这张表）`

# §B 派生用例（来源 systems-index §3 / accessibility.md，无 §8 编号，标注来源）

| ID | 用例 | 环境 | 预期 / 判据 | 来源 | 状态 |
|---|---|---|---|---|---|
| TC-CONST-01 | 扩展槽规格 | `[Node]` | 扩展容量 = `TRAY_EXPAND_SLOTS`(12)，虚线→实线；仅本关有效 | §3.4 | 待实现 |
| TC-CONST-02 | 供料间隔关卡覆盖区间 | `[Node]` | 覆盖值 ∈[2.0,6.0] 合法，越界被 BOOT 拒 | §3.4（A2） | 待实现 |
| TC-CONST-03 | 杂色上限 | `[Node]` | 关卡 `DECOY_COLORS_MAX`=~~2~~ **0**（`systems-index §3` **v1.17** 冻结，U8=D）上限，超出被 BOOT 拒收。**⚠️ 文档同步残留（报告 §20.7 O4，不占缺陷号）**：`levels-spec.md:23 / :42` 仍写 `=2`，属 `design/**` 待回写（本 QA 不改笔）；实现与实测均按 **0** 执行 | §3.2（A3） | **✅ 已验（v1.5 / P26-N：`decoys=['4']` → `phase=boot`、`tray:spawned=0`，多推 2 s 不进 PLAYING）** |
| TC-CONST-04 | 网格尺寸上限 | `[Node]` | cols ≤13、rows ≤12（pitch 52；674≤690、622≤640） | §3.3 | 待实现 |
| TC-CONST-05 | 星级阈值 | `[Node]` | ratio≥0.32→3★；≥0.12→2★；否则 1★；过关至少 1★；扩展不扣星 | §3.7（A7）⚠️ 无 S7 GDD | 待实现 |
| TC-CONST-06 | 解锁线性推进 | `[Node]` | 过 n 关解锁 n+1；星级只记录不设门槛 | §3.7 | 待实现 |
| TC-CONST-07 | 道具规格 | `[Node]` | region=连续 6 槽；random=随机 5 颗；每道具免费 1 次（超出角标引导） | §3.6（A5/A6） | 待实现 |
| TC-CONST-08 | 道具不清网格 | `[Node]` | 三道具均不改 `filled` 格（已填=玩家进度） | §3.6 | 待实现 |
| TC-A11Y-01 | 减弱动效开关 | `[DevTools]` | 关停：落座回弹/溶解缩放/错误抖动/波浪弹跳/告急脉冲；保留：颜色符号变化/面板淡入淡出/hint 静态描边 | `accessibility.md D1` | 待实现 |
| TC-A11Y-02 | 扩展按钮热区修正 | `[Device]` | `btn_expand` 视觉 132×48 但热区 **132×88** | `accessibility.md C1` | 待实现 |
| TC-A11Y-03 | 三重编码 | `[Device]` | 10 色绑唯一矢量符号 + 明度 5 档；6 状态各有非颜色通道 | `accessibility.md A1/A2` | 待实现 |
| TC-A11Y-04 | 错误反馈频率 | `[Node]` | ~~`wrong` 抖动+描边闪 ≤2 次/秒；无 >3Hz 闪烁、无全屏白闪、不屏震~~ → **v1.5 按 `ux-spec §5`「放错拒绝」现文的可测化**：danger 描边 **单次脉冲**（α 0→1 淡入 60 / 峰值保持 80 / 淡出 60 = 200 ms ⇒ **一个 fx 窗口内 α 极值点 ≤1、不往复**）+ 连续拒绝 **视觉脉冲重启门 500 ms** ⇒ 有效 ≤2 次/秒；`±3px 抖动 ×2` **属位移、不在闪烁通道**（不计入频率判据）；无全屏白闪、不屏震 | §3.8 / D2 + `ux-spec §5`（WXG-T-098 回写） | **❌ FAIL（v1.5 / P4：实测一个 fx 窗口内 α 峰点数 = 2 ⇒ 10 Hz（判据 ≤1）；连续拒绝脉冲起点最小间隔 = 100 ms（判据 ≥500 ms））⇒ BD-29 由「规格互斥」转态为「实现落差」，改码已立项 WXG-T-102；`reduceMotion` 半边（P22）已成立，不重复计** |

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
| §D 道具（powerups §8） | 10 | 10 | 全 Node（末句角标视觉项 DevTools） |
| §E 帧内执行序（基准条款） | — | 4 | 全 Node |
| §F 结算·过关面板（ux-spec） | — | **8**（F1–F8） | 全 Node（面板几何可转 Cocos 复核） |
| **§G 可感知性判据（v1.3 新增）** | —（规格层四件套） | **20**（8 主条 + 12 取证细化） | Probe 9 / Cocos 8 / Harness 3 / Node 6 / Device 4（多条多道次） |
| **§H 未映射判据补编（v1.3 新增）** | **22** | 22 | 全 Node（含 2 条需替身注入） |
| **§I 宿主坐标归一化（v1.6 新增）** | —（非 §8；来源 `ADR-0011 §3(e)`） | **3**（TC-COORD-01..03） | 全 `[N]`（3 条可执行全绿；另 DEV-01/DEV-02 两条 `[R]/[⛔]` 道次未测） |
| **§A4b 真链口径 + 三相位 + 次按钮（v1.7 新增；v1.8 补次按钮）** | **§8-8b/8c/8d（v1.8 定稿，WXG-T-115）** | **11**（01R/07R/08R + 11/12/13 + **11b/12b/12c/12d/13b**） | 全 `[Probe]`（真链，经 `InputManager`；11 条—主按钮 3 + 次按钮 5 全绿，12b 记 PASS\*）。**v1.13 注：其中 2 条棋盘区腿（01R 腿⑤ / 07R）已降为 `待复核`，其余 9 条属未翻清单、读数仍有效** |
| **§A4c 棋盘缩放/平移 + 抬起才提交（v1.13 / WXG-T-169 新增）** | `input-control v2.5 §2.1/§6/§8-2·4·9·10` + `core-loop v2.1` + `ADR-0015 §3.6`（**不新增 §8 判据条数**，均为已冻结条文的取证拆层） | **21** = A4c.1 **9**（Node 已验）+ A4c.2 **7**（已冻结、无落点 ⇒ 待执行）+ A4c.3 **5**（屏幕/真机 ⇒ ⛔） | `[Node]` 16（含框架 11 例）/ `[R]``[B]``[C]` 5 条全 ⛔（**禁写 PASS**） |
| **合计** | **§8 判据 93（50+11+10+22，100% 映射）+ 三相位定稿 3（8b/8c/8d）** | **174**（v1.12 基线 153 + 本轮回填 21） | 以 Node/Probe 为主；Cocos 8 条被 **BD-20** 阻塞、Device 4 条被**无真机**阻塞；**v1.13 另增 5 条屏幕/真机 ⛔ 挂账** |

> **v1.2 合计行为「61 判据 / 73 用例」，漏计 §D(10)+§E(4)+§F(8)** ⇒ 实际 95 用例（**BD-21②**）；v1.3 重算并补 §G/§H 后为 **137 用例 / 93 条 §8 判据**。

**指定边界例落点**：cleared/failed 同帧 → TC-LOOP-05 + TC-TIMER-04；满槽跳过 → TC-LOOP-03 + TC-TRAY-04；托盘同色组选/整组取消（WXG-T-158 后口径，原「双击幂等」）→ TC-TRAY-06 + TC-INP-06；存档越界降级 → TC-LOOP-10；sprint 加时/归零同帧（C8）→ TC-SPRINT-07；模式互窜注入 → TC-SPRINT-10。

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
| D4 | random 唯一随机源 | S6§8-4 | 同 seed 两次逐槽相同；固定 seed 200 次（1000 次抽取）经**卡方检验**（df=11、α=0.01、临界 24.725）与均匀分布无显著差异（WXG-T-062 由「±20% 偏差」修订——原容差约一半概率误报）；`check:arch` 断言零 `Math.random` |
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

---

# §F 结算·过关面板用例（**8 条**，v1.3 修正标题计数（v1.2 写「7 条」而表内 8 行，BD-21③）；来源 `ux-spec §3.4 / §4 / §5`，无独立 §8 编号）— WXG-T-063；自动化见 `games/beads/tests/clear-panel.test.ts`

> 背景：`ux-spec §4` 流转表要求 `LEVEL_CLEAR` **等按钮**（下一关 / 去冲刺 U1），而实现曾是「1.4s 自动进下一关」占位。本组用例第一条即为**回归闸门**。

| # | 用例 | 来源 | 自动化断言要点 |
|---|---|---|---|
| F1 | 过关后**不自动推进** | §4 流转表 | 填空整盘 → 相位 LEVEL_CLEAR 且面板可见；`advance(3)` 后**仍在 level-clear、`levelIndex` 不变**（旧实现 1.4s 即翻页） |
| F2 | 主钮出口 → 下一关 | §3.4 + §4 | 2 关表：点主钮中心（真实 tap 路由）→ 相位 playing、`levelIndex` = 1 |
| F3 | 副钮出口 → 去冲刺（U1） | §3.4 + §4 | 点「▶ 去冲刺」→ 相位 playing、`mode === 'sprint'` |
| F4 | 面板几何 | §3.4（`panel_dialog`） | 底板 560×480 且画布居中；双钮各 = `PANEL_BUTTON_H` 且 ≥ `TOUCH_MIN`、落在底板内、**不重叠且主钮在左**；标题 → 星 → 信息三行自上而下 |
| F5 | 命中范围 | §3.4 | 双钮中心各自解析为 `next` / `sprint`；**两钮间隙与画布任意处 → 无命中**（不推进） |
| F6 | 入/出与淡出期门禁 | §5（入 200 / 出 150ms） | `progress` 0→1→0；`close()` 后 `interactive === false` ⇒ **淡出期点按钮无命中**，150ms 后 `visible === false` |
| F7 | 星入场节奏与弹跳 | §5（逐颗 150ms / scale 0→1.2→1） | 第 1 颗 t=0 入场，其后每 150ms 一颗，封顶 = 星级；`starScale` 0 → 1.2（75ms）→ 1（150ms） |
| F8 | 结算数据装配 | `score-combo §8-2`（C7） | 不推进时钟填空 ⇒ ratio = 1 ⇒ 3★；`lastSettleScore === normalSettleScore(3, 1, 0, false)` 且**恰为 4200**（3×1000 + 1000 − 0 + 200）；快照带 `clearStars` / `clearLastLevel` |

---

