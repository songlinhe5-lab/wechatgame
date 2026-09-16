# 《拼豆填色消除》(beads) 测试用例 · Test Cases

- 任务号：WXG-T-011 / WXG-T-028 / **WXG-T-084** / **WXG-T-092（复验轮）** / **WXG-T-098** / **WXG-T-109** / **WXG-T-114（真链口径轮）** / **WXG-T-116（§A4b 去「拟」+ 次按钮真链孪生）** ｜ 作者：严守真 ｜ 版本 **v1.8** ｜ 日期 **2026-09-15**
- **判据来源（v1.3 校正）**：9 份系统 GDD 各 §8 —— `core-loop / bead-grid / tray-spawner / input-control / timer-gameover / powerups / save-progress / pause-settings`（timer 12 条、其余各 10 条）+ `score-combo` §8（冲刺 11 条）⇒ **合计 93 条**（`awk '/^## 8\./,0' | grep -cE '^[0-9]+\.'` 逐文件 = 12/11/10/10/10/10/10/10/10）。**v1.2 头部写「合计 61 条」已过期，实际只映射 71 条、22 条零映射**（缺陷 **BD-21**，v1.3 由 §H 补齐）。常量引 `systems-index.md §3`（含 §3.10 冲刺 / §3.11 续时）+ `art/accessibility.md`。
- **v1.3 新增判据来源（§G 可感知层）**：`design/ux/ux-spec.md §1-3 / §4 尾注 / §5 动效毫秒表 / §6.1–6.2 / §8 裁决表`（WXG-T-081）、`art/assets-spec.md §1.2`（`empty`/`wrong`/`hint` 三态规格）、`art/accessibility.md A2/A2b/A3/B3/C1/D1/E2`、`design/audio/audio-events.md §1 + §4 A05-01..27`（WXG-T-083，该文件明文「**供 WXG-T-084 引用**」）。**全部逐条标注来源，零自造数值。**
- 常量速查（来源 `systems-index §3`，**v1.4 按 v1.17 现文校正**）：`TRAY_BASE_SLOTS=12`、`SPAWN_INTERVAL_DEFAULT=4.0s`（区间 [2.0,6.0]）、~~`NEEDED:DECOY=3:1`~~ → **v1.17 冻结 `DECOY_COLORS_MAX=0`（D 方案，杂色池关闭）** ⇒ 凡依赖 3:1 抽色的判据（**S4 §8-3**）现属**不可构造**，见 **BD-28**（本文不擅自删条，只标注）；`LEVEL_TIME_DEFAULT=300s`（区间 [180,420]）、`TIMER_URGENT_T=10s`、`TIMER_TICK=1.0s`、`GRID_MAX=13×12`、`STAR3_RATIO=0.32`、`STAR2_RATIO=0.12`、`DEMO_LEVEL_COUNT=8`、`POWERUP_FREE_USES=1`、`REGION_CLEAR_SLOTS=6`、`RANDOM_CLEAR_COUNT=5`、命中区外扩 8px（66²/62²，**重叠区归属以 §8-4 最近格心为准**，v1.4 按已裁口径补注）。
- 常量速查·冲刺（来源 `systems-index §3.10`，2026-09-12 冻结）：`SPRINT_TIME_DEFAULT=120s`（区间 [90,120]，越界回退默认）、`COMBO_WINDOW_S=5.0s`、`COMBO_STREAK_TIERS=[2,4,7]`→倍率 ×2/×3/×5（上限 ×5）、`SCORE_PER_BEAD=10`、`STAGE_BONUS_TIME=+15s`、`STAGE_CLEAR_BONUS=200+50×stageIndex`、C7 结算分 `stars×1000+round(ratio×1000)−powerupsUsed×50+(未用扩展?200:0)`、C8 裁决（stage 切换不断连；stage 加时与归零同帧 stage 优先）、伪震屏 scale 1.00→1.015→1.00 / 150ms。

**图例（v1.3 扩展，v1.4 更新阻塞现状）**：`[Node]` vitest ｜ `[Probe]` **G4 探针脚本**（复验轮 = `production/qa/beads/g4-probe-v1.1.mjs`；v1.0 基线 = `g4-probe.mjs`。Node 装配真实 `BeadsGame` + `NodePlatform`，可读渲染指令流/事件流/存档）｜ `[Harness]` 浏览器（✅ **v1.4：坐标污染已解除**——BD-07 已修（ADR-0011），本轮已可驱动真实 `InputManager`；唯 **BD-08 文字镜像仍不可验**（无像素通路）与 BD-19 `preview:frames` 不支持 beads）｜ `[Cocos]` 构建产物 + 浏览器截图（~~BD-20~~ **已关**；现被**屏幕层取证通路缺失**阻塞：无无头截图 / 无调色滤镜脚本，见报告 v1.1 §18.2 B1）｜ `[DevTools]` 微信开发者工具（**未装、无 AppID**）｜ `[Device]` 真机（**本轮不可执行**）。
**v1.6 追加（WXG-T-109）**：§I 三条用例改用 T-108 探针 `cocos-input-probe.mjs` 的 lane 标记 —— `[N]` 无头浏览器逻辑层（≈ 本图例 `[Node]` 族的产物道次）/ `[B]` 浏览器真实渲染像素级（≈ `[Cocos]` 已解锁像素道次）/ `[R]` 真机 · 微信宿主（= `[Device]`）；等价关系见 **§I** 节首。
**状态（v1.3 改为四态，废除「一律待实现」）**：`已验` ＝ 本轮实测成立 ｜ `FAIL(BD-nn)` ＝ 本轮实测不成立 ｜ `待执行` ＝ 判据已冻结但本轮未跑 ｜ `⛔不可测(原因)` ＝ 环境/实现阻塞，**禁止标绿**。逐条实跑结论：v1.0 基线见 `g4-regression-report.md §4`（19 组探针）；**复验轮（v1.1，26 组）见该报告 §13 改判表 + §14 处置状 + §17 §G 逐条可验道次**（本文各表原结论行按**追加不覆盖**纪律保留，其现态以 §G.4 与报告 §13 为准）。

---

# §A 硬判据用例（50 条 = 5 组 × 10，判据 1:1 映射）

> **v1.7 追加**：**§A4b**（真链口径补充 `TC-INP-01R/07R/08R` + 三相位门禁判据 `TC-INP-11/12/13`）挂在 A4 与 A5 之间，
> **不计入上方「5 组 × 10 = 50」**（它是输入域的**真链口径补件 + 三相位门禁**，非 §8 现文 1:1 映射的既有十条）。
> **v1.8 更新（WXG-T-116）**：三相位判据已随 `input-control §8-8b/8c/8d` **定稿去「拟」**；并补 **5 条次按钮真链孪生**
> `TC-INP-11b/12b/12c/12d/13b`（对应条文新增的次按钮子句，含 `8c` 冲刺局子分支）。

## A.0 本轮（WXG-T-084）实测状态回填表

> 只回填**本轮真正执行过**的行；未列出者一律为 `待执行`，**不得读作 PASS**。

| 用例 ID | 判据 | 道次 | 本轮结论 | 缺陷 / 备注 |
|---|---|---|---|---|
| TC-INP-01 | `input-control §8-1` | `[Probe]` | ❌ FAIL | **BD-15**（五类路由缺第 3 类：扩展入口 UI 层不存在） |
| TC-INP-02 / TC-INP-04 | `§8-2 / §8-4` | `[Probe]` | ⚠️ PASS\* | **BD-23**（§8-2 与 §8-4 在 `BEAD_PITCH < GRID_HIT_SIZE` 时互斥，实现遵循 §8-4） |
| TC-INP-06 / 08 / 10 | `§8-6 / §8-8 / §8-10` | `[Probe]` | ⚠️ PASS\* | `tapDesign` 绕过 `InputManager`，§8-10 为弱化通过 |
| TC-INP-07 | `§8-7` | `[Probe]` | ❌ FAIL | **BD-16**（「有轻提示」零实现，反馈帧增量为 0） |
| TC-INP-09 | `§8-9` | `[Device]` | ⛔ 不可测 | 无真机 + 无 AppID |
| TC-TRAY-02 / 04 / 05 | `tray-spawner §8-2 / §8-4 / §8-5` | `[Probe]` | ✅ PASS（§8-2 口径存疑） | **BD-22**（最大偏差 32.0% 字面 FAIL，卡方 11.20 < 临界 24.725；建议 §8-2 改卡方，同 `powerups §8-4` 判例） |
| TC-GRID-08 | `bead-grid §8-8` | `[Probe]` | ⚠️ PASS\* | 156 格装载 + 五格中心公式复算通过；「误差 ≤0.5px」像素级判定待 `[Cocos]` |
| TC-TIMER-07 | `timer-gameover §8-7` | `[Probe]` | ✅ PASS | 181/419/180/420 → playing；100/999 → BOOT 拒并报错含关卡 id |
| TC-SAVE-07 | `save-progress §8-7` | `[Probe]` | ❌ FAIL | **BD-12**（`meta.winStreak*` 无字段位，src 命中 0） |
| TC-SAVE-09 | `save-progress §8-9` | `[Probe]` | ⚠️ PASS\* | **BD-24**（「200 次落子」不可构造：`GRID_MAX_COLS×GRID_MAX_ROWS=156`；按 150 次验其实质通过） |
| TC-A11Y-01 | `accessibility D1` | `[DevTools]` | ⛔ 不可测 | **BD-09d**（`reduceMotion` src/tests/framework 0 命中）+ D1/E2 三文档冲突待裁 |
| TC-A11Y-02 | `accessibility C1` | `[Device]` | ⛔ 不可测 | 双重阻塞：无真机 + `btn_expand` 本体不存在（**BD-09e/BD-15**） |
| TC-A11Y-03 / TC-GRID-10 | `accessibility A1/A2/A3` | `[Device]` | ⛔ 不可测 | 无真机；且 `empty`/`hint`/`wrong` 三态非颜色通道缺失（**BD-01/BD-11/BD-04**）⇒ 6 状态仅 3 态可辨 |
| TC-TIMER-10 | `timer-gameover §8-10` | `[DevTools]` | ⛔ 不可测 | **BD-10**（脉冲与满槽告警双主体缺失，无物可帧检） |
| TC-SPRINT-09 | `score-combo §8-9` | `[DevTools]` | ⛔ 不可测 | Lv2 伪震屏已登记平台缺口（WXG-T-074：渲染管线无全局变换通道） |
| TC-LOOP-02 / TC-TRAY-01 | `core-loop §8-2 / tray §8-1` | `[Node]` | 待执行（**期望已改**） | **BD-25**：BD-02 修复后语义变为 1 首供 + 15 周期 = **16 颗**，旧容差 ±1 会恰好吞掉变更 ⇒ v1.3 显式改 16（±0） |

### A.0b WXG-T-109 轮回填（**增量；上方 16 行为 WXG-T-084 轮，不改**）

> 规矩同 §A.0 表头：**只列本轮真正执行过的行**；未列出者一律 `待执行`，**不得读作 PASS**。本轮执行 = `node production/qa/beads/cocos-input-probe.mjs`（**退出码 0 ｜ PASS 18 ｜ FAIL 0 ｜ ⛔ 2**）。

| 用例 ID | 判据 | 道次 | 本轮结论 | 缺陷 / 备注 |
|---|---|---|---|---|
| TC-COORD-01（=R1） | `ADR-0011 §3(e)-1` / `T-104·A4-R1` | `[N]` | ✅ PASS | 详 **§I.1**；探针 `R1-01+R1-02` / `R1-03+R1-04` / `R3-02` / `R3-03` |
| TC-COORD-02（=R2） | `ADR-0011 §3(e)-2` / `T-104·A4-R2` | `[N]` | ✅ PASS | 详 **§I.1**；探针 `R2-01` |
| TC-COORD-03（=R3） | `ADR-0011 §3(e)-3` / `T-104·A4-R3` | `[N]` | ✅ PASS | 详 **§I.1**；探针 `R3-01` |
| DEV-01 | 微信小游戏宿主复取 | `[R]` | ⛔ 不可测 | 无 AppID + 无真机；解除条件见 **§I.2** |
| DEV-02 | wechatgame 平台构建 | `[⛔]` | ⛔ 不可测 | 缺有效 AppID；解除条件见 **§I.2** |

## A1 · 核心循环（S1）— 来源 `core-loop.md §8.1..10`

| ID | 判据 # | 用例 | 环境 | 预期 / 判据 | 状态 |
|---|---|---|---|---|---|
| TC-LOOP-01 | §8.1 | 冷启动分流 | `[Node]` | 无存档→第 1 关 PLAYING，**无主菜单**；有存档→续进已解锁最远关 | 待实现 |
| TC-LOOP-02 | §8.2 | 供料节律 | `[Node]` | ~~默认间隔下 PLAYING 60s 托盘恰 +15 颗（±1）~~ → **v1.3 改：PLAYING 首帧即 1 颗首供（U7），其后 60s 内周期供料 15 颗 ⇒ 合计恰 16 颗（±0）**；来源 §3.4 `SPAWN_INTERVAL_DEFAULT` + `ux-spec §6.2` U7 裁定。**改判依据 BD-25**：旧 ±1 容差区间 `[14,16]` 会恰好吞掉首供变更 ⇒ 修复后自动假绿 | 待执行（期望已改） |
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
| TC-TRAY-01 | §8.1 | 供料间隔 | `[Node]` | ~~默认下 60s `tray:spawned` 恰 15 次（±1）~~ → **v1.3 改：默认下 60s `tray:spawned` 恰 16 次（±0）＝1 次首供 + 15 次周期供料**，周期间隔 `SPAWN_INTERVAL_DEFAULT` ±0.1s，**首供不计入间隔断言**（`ux-spec §6.2` U7）。**改判依据 BD-25**（同 TC-LOOP-02）。~~注：§8-3 抽色加权 3:1 受首供影响恰 1/100 样本，可忽略~~（v1.5：§8-3 已作废，本注失效）
　→ **v1.5 再按 WXG-T-098 回写后的 `tray-spawner §8-1` 现文两轴分列**：窗口 **t ∈ [0,60] 秒闭区间**（含两端；t = 进入 PLAYING 起算的**模拟时间**，非墙钟）内**恰 16 次（次数轴 ±0）**；**「±0」只约束事件次数**（缺任一次 = FAIL；出现名义第 17 次 = FAIL），**不约束时刻**；次数按**调度名义时刻**计（第 i 次名义 = 4×(i−1) s ⇒ 第 16 次名义 60.0 s 恰落在闭区间上界内 ⇒ **计入**，即 **BD-27 的开/闭区间裁定**）；**时刻轴单列**：`0 ≤ t_actual − 4×(i−1) ≤ 2 帧`（帧 = `GameLoop.fixedDt` 1/60 s ⇒ 33.4 ms；**负偏差（提前）= FAIL**；「帧」的定义正本 = `systems-index §3 前言「使用约定」第 4 条`，**帧量化不得出现在次数轴**）；相邻间隔仍 `4.0 s ±0.1 s`；**用例前提 = 供料不被满槽截断**（否则与 §8-4 混测）。**改判依据 BD-27（已裁）** | **✅ 已验（v1.5 / P20 = PASS：闭区间按名义计数 16/16、最大滞后 2.00 帧压线、零负偏差、间隔偏差 0.0167 s。旧字面严格读法仍 15≠16 ⇒ 两读并列，见报告 §20.3）** |
| TC-TRAY-02 | §8.2 | 落槽均匀性 | `[Node]` | 200 次供料，任一槽频次与均匀分布偏差 ≤±20% | 待实现 |
| TC-TRAY-03 | §8.3 | ~~抽色加权 3:1~~ → **v1.5：判据已作废** | `[Node]` | ~~"仍需 1 色 + 1 杂色"关卡 100 次供料，所需色占比 ≈75%（±10pp）~~ → `tray-spawner §8-3` 现文首行即 **「作废（v1.17 D 方案；WXG-T-098，BD-28）」**。作废依据：`DECOY_COLORS_MAX = 0` 已由 `systems-index §3`（v1.17）冻结 ⇒ 前置「1 杂色关卡」**不可构造**。采「作废」而**不采「decoys 恒空 ⇒ 平凡真」**：本条主体是加权比例 3:1，杂色集恒空时比例**无从观测**，记 PASS = **伪绿**。⇒ 本用例固定为 **⛔ 不可验（不得记 PASS、亦不得记 FAIL）**；⛔（无从判定、不产绿）≠ 平凡真（判定成立但恒真）。**复活条件**：§3 若将 `DECOY_COLORS_MAX` 改回 ≥1 ⇒ 即时复活为硬判据（3:1、100 样本、±10 pp 沿用）。**保留形式只可作负向用例 TC-TRAY-03N**：`decoys` 非空关卡 ⇒ BOOT 拒收、`phase=boot`、不进 PLAYING（**属 `levels-spec §2` / `levels.ts:184` 校验，不属 S4 §8 ⇒ 不得回填成 §8 的绿**） | **⛔（v1.5，随判据作废，不再排执行）**；TC-TRAY-03N **✅ 已验（P26-N PASS）** |
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

## A4b · 真链口径补充 + 三相位门禁判据 + 次按钮真链孪生（v1.7 / WXG-T-114 新增；**v1.8 / WXG-T-116 去「拟」+ 次按钮**）— 来源 `input-control §8-8b/8c/8d`（**已定稿**）+ `§2.3` + `§8` 现文

> **本节补什么窟窿（两个洞，K-038 / BD-34 同源）**：
> ① **探针口径洞**：P8 / P10 / P22 长期用 `game.tapDesign()` **旁路**驱动（直调 `_handleTap`，绕开
>    `InputManager`）⇒ **旁路恒绿、真链恒断**，这正是**三轮回归都没测到 BD-34** 的原因。WXG-T-114 已把
>    三组探针切到**真链口径**（`P8R/P10R/P22R`），本节为其门控条目。
> ② **判据覆盖洞**：`input-control §8` 现文十条中**仅判据 8 覆盖 `PAUSED`**；`LEVEL_CLEAR`/`GAME_OVER`/`FINISH`
>    三相位**仅由 §2.3 状态门禁表覆盖、§8 无独立可测条目** ⇒ QA 无法 1:1 造用例。WXG-T-114 先产出拟增条文
>    `8b/8c/8d`；**WXG-T-115 已由设计侧（文策渊）定稿落盘** `input-control §8-8b/8c/8d`（含**完整按钮集**；`8c`
>    另补**冲刺局子分支**「再来一局 / 返回关卡」）⇒ 本表 v1.8 **去「拟」**，判据引用改用正式编号。
>    **v1.8 追加次按钮真链孪生**：`8b/8c/8d` 的按钮集**不止主按钮**（`8b`「去冲刺」/ `8c`「续时」与冲刺局子分支 /
>    `8d`「去冲刺」）⇒ 补 `TC-INP-11b/12b/12c/12d/13b`（逐条对应条文新增的次按钮子句）。
>    ⚠️ **`games/beads/design/**` 属设计域，QA 未改笔**；本表只改**引用与状态**，**判据 / 阈值零改动**。

| ID | 判据 # | 用例 | 环境 | 预期 / 判据 | 状态 |
|---|---|---|---|---|---|
| **TC-INP-01R** | `§8-1`（真链口径补充） | 五类路由（经 `InputManager`） | `[Probe]` | 真链（`beginFrame→push(down/up)→update→endFrame`）逐条：① 齿轮→`game:paused`=1 且 `phase=paused`；② 道具卡→`powerup:used`=1；③ 扩展入口→`tapHintAnchor='expand'`（S4 出口仍 ⛔ BD-37）；④ 托盘珠→`tray:selected`=1；⑤ 有选中点空格→`bead:placed`=1/`rejected`=0 | ✅ 已验（WXG-T-114 / P8R；与 TC-INP-01 旁路口径**逐条一致**） |
| **TC-INP-07R** | `§8-7`（真链口径补充） | 无选中点网格（经 `InputManager`） | `[Probe]` | 真链点空格中心 ⇒ `bead:placed`/`rejected`/`tray:selected` 全 0 + `tapHintText` 锚点=被点格 + text 签名配对差分为真 | ✅ 已验（WXG-T-114 / P10R；与 TC-INP-07 一致） |
| **TC-INP-08R** | `§8-8`（真链口径补充） | PAUSED 面板按钮经真链可达 | `[Probe]` | PLAYING 真链点齿轮⇒`paused`；PAUSED 真链点面板行 3「toggle-reduce-motion」⇒ `snapshot.reduceMotion` 翻转 + `"reduceMotion":true` 落档 + 二次装配回显 | ✅ 已验（WXG-T-114 / P22R；补证「开关本身经真链可达」） |
| **TC-INP-11** | `§8-8b` | LEVEL_CLEAR 真链门禁（**主按钮**） | `[Probe]`＋`[Harness]` | 真链点「下一关」⇒ `playing`、`levelIndex n→n+1`；真链点面板外死区 `(30,53)` ⇒ 事件增量 **0**、相位与关卡号不变 | ✅ 已验（WXG-T-114 / P27b）**条文已定稿（`input-control §8-8b`，WXG-T-115）** |
| **TC-INP-12** | `§8-8c` | GAME_OVER 真链门禁（**普通局主按钮**） | `[Probe]`＋`[Harness]` | 真链点「重试」⇒ `playing`、`filled=0`（整关重置）；真链点面板外 ⇒ 事件增量 **0**、相位不变 | ✅ 已验（WXG-T-114 / P27c）**条文已定稿（`input-control §8-8c`，WXG-T-115）** |
| **TC-INP-13** | `§8-8d` | FINISH 真链门禁（**主按钮**） | `[Probe]`＋`[Harness]` | 真链点「重玩第 1 关」⇒ `playing`、`levelIndex=0`；真链点面板外 ⇒ 事件增量 **0**、相位不变 | ✅ 已验（WXG-T-114 / P27d）**条文已定稿（`input-control §8-8d`，WXG-T-115）** |
| **TC-INP-11b** | `§8-8b` | LEVEL_CLEAR **次按钮「去冲刺」** | `[Probe]`＋`[Harness]` | 真链点结算面板副钮「▶ 去冲刺」⇒ `playing`、`mode normal→sprint`；真链点面板外 ⇒ 事件增量 **0**、相位/模式不变 | ✅ 已验（WXG-T-116 / P27e） |
| **TC-INP-12b** | `§8-8c` | GAME_OVER 普通局 **次按钮「续时」** | `[Probe]`＋`[Harness]` | 真链点「▶ +N 秒 继续本关」⇒ `watchingAd=true`、相位仍 `game-over`（等回调）；经 `MockRewardedAdProvider.settle('complete')` 发奖 ⇒ `playing`、`remaining += REVIVE_BONUS_SEC`、`revived=true`。⚠️ **发奖腿由 harness 替身驱动，非真机广告** | ✅ 已验（WXG-T-116 / P27f）**PASS\***（真机激励视频 `[R]` ⛔，见备注） |
| **TC-INP-12c** | `§8-8c` | GAME_OVER **冲刺局子分支「再来一局」** | `[Probe]`＋`[Harness]` | 冲刺结算（`mode=sprint`）真链点主钮「再来一局」⇒ `playing`、`mode=sprint`；真链点面板外 ⇒ 事件增量 **0**、相位/模式不变 | ✅ 已验（WXG-T-116 / P27g） |
| **TC-INP-12d** | `§8-8c` | GAME_OVER **冲刺局子分支「返回关卡」** | `[Probe]`＋`[Harness]` | 冲刺结算（`mode=sprint`）真链点副钮「返回关卡」⇒ `playing`、`mode=normal`；真链点面板外 ⇒ 事件增量 **0**、相位/模式不变 | ✅ 已验（WXG-T-116 / P27h） |
| **TC-INP-13b** | `§8-8d` | FINISH **次按钮「去冲刺」** | `[Probe]`＋`[Harness]` | 真链点通关画面副钮「▶ 去冲刺」⇒ `playing`、`mode normal→sprint`；真链点面板外 ⇒ 事件增量 **0**、相位不变 | ✅ 已验（WXG-T-116 / P27i） |

> **口径（必读）**：以上 **11 条**一律走**真链**（`input.beginFrame` → `push(down/up)` → `game.update(dt)` →
> `input.endFrame(dt)`，与 `App._fixedUpdate` 同形），**不得用 `game.tapDesign()` 旁路** —— 旁路直调
> `_handleTap`、绕开 `InputManager`，**恒绿而无判别力**（K-038；BD-34 即在 225 例连绿下漏网）。
> 旁路例**未删除**（`tapDesign` 仍是合法装配前置），两组并列呈报，任一方断链都可见（对照见报告 §22.3）。
> **主 / 次按钮孪生**：`TC-INP-11/12/13` = 各相位**主按钮**腿；`TC-INP-11b/12b/12c/12d/13b` = 同判据的
> **次按钮**腿（`8b`「去冲刺」/ `8c`「续时」与冲刺局子分支「再来一局·返回关卡」/ `8d`「去冲刺」）。
> **道次**：`[Device]`/`[R]` 真机 **⛔**（无 AppID / 无真机，不记 PASS 亦不记 FAIL）；`[B]/[C]` 像素道次未执行。
> **`TC-INP-12b` 特别声明（防假绿）**：**按钮腿**（真链点「续时」⇒ `watchingAd=true`）经真链可达且成立；
> **发奖腿**由 harness 替身 `MockRewardedAdProvider.settle('complete')` 驱动 ⇒ 只证**结构链路**，
> **不等于真机广告行为**（`[R]` ⛔；「未看完 / skip / error」三分支未测，须替身注入）⇒ 该条记 **PASS\***（见 TC-TIMER-12 取证纪律）。
> **边界**：**丢帧多子步下「一次 touch 多指令」属 `WXG-T-113`，不属本节** —— 本节只测正常 60fps 单步
> （直接 `game.update(dt)`，不经 `App.tick` 多子步）。

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
| **§A4b 真链口径 + 三相位 + 次按钮（v1.7 新增；v1.8 补次按钮）** | **§8-8b/8c/8d（v1.8 定稿，WXG-T-115）** | **11**（01R/07R/08R + 11/12/13 + **11b/12b/12c/12d/13b**） | 全 `[Probe]`（真链，经 `InputManager`；11 条—主按钮 3 + 次按钮 5 全绿，12b 记 PASS\*） |
| **合计** | **§8 判据 93（50+11+10+22，100% 映射）＋三相位定稿 3（8b/8c/8d）** | **151** | 以 Node/Probe 为主；Cocos 8 条被 **BD-20** 阻塞、Device 4 条被**无真机**阻塞 |

> **v1.2 合计行为「61 判据 / 73 用例」，漏计 §D(10)+§E(4)+§F(8)** ⇒ 实际 95 用例（**BD-21②**）；v1.3 重算并补 §G/§H 后为 **137 用例 / 93 条 §8 判据**。

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

# §G 可感知性判据（20 条，v1.3 新增）—— **GAP-14 / BD-14 根治项**

## G.0 为何需要 §G + 判据谱系声明

> **根因**：§A–§F 共 95 条用例、映射 71 条 §8 判据，**全为「逻辑可断言型」（事件计数 / 状态机 / 公式复算）**——在 184 个 vitest 全绿的前提下，BD-01（空槽无目标色）/ BD-02（开局 6s 无珠）/ BD-03（零引导）/ BD-04（四类 VFX 全缺）/ BD-05（零音效）/ BD-10（告急不可辨）**结构上无法被任何一道门禁捕获**。§G 就是补这一类：**画面 / 音效 / 手感**判据。
>
> **判据谱系（诚实声明）**：9 份 GDD §8 共 93 条中**零条**为玩家可感知型（这正是 BD-14）。因此 §G 的判据来源**上移到规格层四件套**：`ux-spec §5`（动效毫秒表 21 行权威值）、`ux-spec §6.1–6.2`（首 10 秒时间轴 + U7 首供裁定）、`assets-spec §1.2`（`empty`/`wrong`/`hint` 三态规格）、`accessibility A2/A2b/A3/B3/C1/D1/E2`、`audio-events §1 + §4 A05-01..27`（该文件明文「**供 WXG-T-084 引用**」）。**所有毫秒 / 颜色 / 尺寸 / 频率均引规格层冻结值，零自造**；每条并回指其所服务的 §8 逻辑判据（例：TC-PER-01 是 TC-GRID-02「匹配落座」的**可辨识前提**，TC-PER-02 是 TC-TRAY-01「供料节律」的**首屏约束**）。
>
> **执行分轮**：§G 的**执行**依赖波次 2（T-085/086/087）落地 ⇒ 本轮只出「现状基线」（见「本轮结论」列，详证 `g4-regression-report.md §4`）；修复后出「复验 G4」。

## G.1 主判据（8 条，1:1 对应 `g4-regression-report.md` 探针 P1–P7 / P19）

| ID | 缺口 / 缺陷 | 可感知判据（画面 / 音效 / 手感） | 判据来源（规格层冻结值） | 取证手段 | 取证前置依赖 | 本轮结论 |
|---|---|---|---|---|---|---|
| **TC-PER-01** | GAP-01 / **BD-01** | **空槽可辨识目标色**：每个 `empty` 格须呈现「该格应填颜色」的**淡化色底**（E1）+ **内上阴影**（E3）+ **幽灵符号**（E4），使玩家在**不落子**的情况下即可判断「哪格填什么色」；同关使用的 3–8 色两两可辨 | `assets-spec §1.2` `empty` 行（`mixWith(slot_fill, beadColor(colorIdx), EMPTY_TINT_MIX)`、`EMPTY_GHOST_ALPHA`）；`accessibility A2`（每态有非颜色通道）；`ux-spec §1-3` 裁定 (a) 引导通道 ① | `[Probe]` 渲染指令流：统计拼图带内 `BEAD_CELL` 矩形的**填充色去重数 ≥ 该关色数**；`[Cocos]` web-mobile 产物截图**肉眼比对** | 实现：**T-085**（`drawEmptySocket` 补 `colorIdx` 形参）；`[Cocos]` 道次：**R1 + R2** | ❌ **FAIL**：22 个空槽填充色去重后**仅 1 种 `#EDE7DA`**；`bead-render.ts:159` 签名无 `colorIdx`；`EMPTY_TINT_MIX`/`EMPTY_GHOST_ALPHA` src 命中 **0** |
| **TC-PER-02** | GAP-02 / **BD-02** | **开局 ≤1.5s 托盘已有珠**：BOOT 完成即 PLAYING 第 1 帧，托盘**已有 ≥1 颗珠**且该槽带 600ms 脉冲引导 ⇒ 玩家在第一屏内即有**可操作对象** | `ux-spec §6.1` 首 10 秒时间轴（「≤1.5s BOOT 完成；1.5s 首颗珠已在托盘 + 该槽 600ms 脉冲」）；`§6.2` **U7** 裁定（`reset()` → 赋 `interval` → **最后**置 `_acc = interval`） | `[Probe]` 逐帧读 `snapshot.tray` 持有数，断言 **t=1.5s（第 90 帧 @`fixedDt=1/60`）≥1 颗**；`[Cocos]` 产物**首屏截图**（load 后 1.5s） | 实现：**T-085** 落 U7；脉冲半边：**T-086**（BD-10）；`[Cocos]`：**R1 + R2** | ❌ **FAIL**：t=0 / 1.5s / 3.0s 持有 **0 / 0 / 0**；L1 首颗珠第 **361** 帧 = **6.02s**；对照组（`SPAWN_INTERVAL_DEFAULT`）第 241 帧 = 4.02s |
| **TC-PER-03** | GAP-03 / **BD-03** | **无文字下引导可被理解**：玩家不需读任何文字，仅凭 ① 空槽目标色底+幽灵符号 ② 单一 `hint` 目标格（行主序最前 1 格）③ 首珠槽脉冲 三通道，即可在 3 秒内明白「把珠拖到同色格」；引导在**首次 `bead:placed` 即清**、`runs>0` **永不重现** | `ux-spec §1-3` 裁定 **(a) 0 文字教学** + 依赖登记；`§5` 教学引导三行（首珠脉冲 **600ms/循环 = 1.67Hz**、目标格 hint **600ms/循环**、引导终止条件） | `[Probe]` 断言开局 8s 渲染**文本去重集合不含任何教学句** + 三通道图元均存在；`[Cocos]` 首屏**连续 3 帧截图**交非作者观察者做**盲测复述**；`[Device]` 真人 FTUE | **三通道分别依赖 BD-01（T-085）/ BD-11（T-086）/ BD-10（T-086）⇒ 三缺一即整条不成立**；盲测：**R2**；真人：**M1-6 真机** | ❌ **FAIL**：开局 8s 文本去重 **14** 条全为 HUD/道具标签（`05:00`/`LV 1/8`/`×1`/三道具名/倒计时）；`banner`/`subBanner`/`powerupHint`/`failHint` 全空；三通道 ①②③ **全缺** |
| **TC-PER-04** | GAP-04 / **BD-04** | **四类 VFX 各自可观察**（逐条见 TC-PER-09..12）：落座回弹 / 放错抖动 / 消除溶解 / 完成波浪——玩家在**每次操作后都能看到画面在动**，据此判断操作是否生效 | `ux-spec §5` 动效毫秒表；`assets-spec §1.2` `wrong` 行；`systems-index §3.8` 红线 | `[Probe]` **帧间渲染指令签名差分**：事件后连续 12 帧（200ms）指令序列须**逐帧变化**（恒定 ⇒ 无动效）；`[Cocos]` 产物**逐帧截图 6–12 张**视觉确认 | 实现：**T-086**（且需先扩 `CellState`，现无 `wrong`/`hint` 承载体）；`[Cocos]` 逐帧：**R2** | ❌ **FAIL**：落子后 12 帧 `[76×12]` **恒定**；拒绝后增量 `[8×12]` **恒定**；`entities/grid.ts:12` `CellState='empty'｜'filled'｜'locked'` |
| **TC-PER-05** | GAP-05 / **BD-05** | **关键事件有音效且与动效同帧**：「同帧」= 同一次 `App.tick(frameDt)` 内事件广播 → `AudioScheduler._pending` → 帧末 `flush()`（**1 帧 = 16.67ms** @`fixedDt=1/60`）；19 个 clip **清单闭合**；两开关全关时**静音可通关** | `audio-events §4` **A05-01/04/05/07/11/14/16**（同帧派发）、**A05-23**（静音可玩）、**A05-24**（`tuning.ts` 音频常量集合 == §1 的 **19 个 id**）、**A05-25**（构建产物音频文件数=0、占用=0KB）；道次标记 `[N]/[B]/[C]/[R]/[P]` | `[Node]` 替身 backend 记 `played` 序列 + **帧号对齐**断言（A05-* 中 `[N]` 项**今天即可断言**）；`[Cocos]` 产物音频文件数（A05-25）；`[Device]`+**人耳**（`[R]/[P]`） | `[N]` 项无前置；`[B]/[P]/[R]` 项依赖 **BD-05b 三平台 `NullAudioBackend` 落地**（⚠️ **真机到位也不解除此阻塞**）；A05-25 依赖 **R1** | ❌ **FAIL**：脚本化全程 `audio.play` clip 去重**仅 2 种**（`bgm_main`/`sfx_ui_tap`）；`tuning.ts` 只 **3** 个 clip vs 要求 **19**；`_sfx()` 9 处调用全在 UI 按钮(7)+星入场(2) |
| **TC-PER-06** | GAP-06 / **BD-06** | **手感·韧性**：尾盘（图案近满 + 托盘满 + 三道具免费次数用尽 + 无可落子色）时，画面上**存在 ≥1 条非「整关重置」出口**且玩家**能看见并点到**它；不得只能等归零判负 | `ux-spec §4` 尾注（「满槽+死珠=软锁死…**这是判负，不是兜底**」）；`§8` **U8 ⏳ 待用户拍板**（A′/B/C/D）；`tray-spawner §2.4` 出口表；`systems-index §3.11`（**`REVIVE_BONUS_SEC` 只加时间不清托盘 ⇒ 续时不能解此局**） | `[Probe]` 构造死局（灌满非需色珠 + 耗尽道具）→ **6px 栅格全盘扫描 750×1334** 统计可点出口数；再推 60s 看是否仍 `phase=playing` 满槽；`[Cocos]` 死局截图交观察者问「你现在能做什么」 | **判据刻意写成方案中立**（U8 任一方案落地均可验）；依赖**用户拍板 U8** → **T-085** 落码；扫描道次无前置 | ❌ **FAIL**：灌满 12/12 后 8s 仍满槽、`tray:full=1`；三道具第二轮全 `false` + `powerupHint=「即将开放」`（纯占位零效果）；全盘扫描命中 `tray:expanded`=**0 个点**；60s 仍满槽 → 归零 `game-over` ⇒ **0 条出口**（判据要求 ≥1） |
| **TC-PER-07** | GAP-10 / **BD-10** | **告急脉冲与满槽告警可观察**：倒计时穿 `TIMER_URGENT_T` 后 HUD 呈 danger 色 **+ 1000ms α 脉冲循环**（≤3Hz 红线）；满槽时托盘**描边呼吸 500ms 循环 + 轻提示音 1 次**；色盲玩家**不单靠红色**也能辨告急 | `ux-spec §5`（倒计时告急 danger + **1000ms α 脉冲循环**；满槽告警 **托盘描边呼吸 500ms 循环 + 轻提示音 1 次**）；`timer-gameover §8-10`（周期 **1000ms±50ms**、同屏叠加无 >3Hz）；`accessibility B3`（**已诚实标 ⚠️「仅色变、脉冲未实现」**） | `[Probe]` 事件后连续 **60 帧**（=1.0s 一个完整周期）取 HUD 带**非文本指令签名去重数须 ≥2**；`[Cocos]` 连拍 **≥8 帧**（跨 1 周期）比对 α/描边变化 | 实现：**T-086**；`[Cocos]` 连拍：**R2** | ❌ **FAIL**：`urgent=true`、`timer:urgent=1` ✓，但 60 帧 HUD 非文本签名去重 **1 种**；`view-model.ts:374-375` 仅色切换；灌满前后托盘带内 13→49（增量**全为珠体**）⇒ **零告警图元** |
| **TC-PER-08** | GAP-11 / **BD-11** | **`hint` 态可见**：目标格呈 `accent_blue` **2px 描边 + 600ms α0.5↔1.0 呼吸**；D1「减弱动效」开启后须**保留 hint 静态描边**（不因关停动效而丢引导） | `assets-spec §1.2` `hint` 行；`accessibility A2`（hint 蓝描边呼吸）+ **D1 保留清单**「hint 静态描边」；`ux-spec §1-3` 引导通道 ② + `§5` | `[Probe]` 断言 `CellState` 定义域含 `hint` + 使用 `accent_blue(#3D7BF5)` 的图元数 **>0** + 跨 600ms 的 α 变化；`[Cocos]` 连拍 4 帧 | 实现：**T-086** 扩 `CellState`；D1 分支依赖 **§6.3 三文档冲突裁定** | ❌ **FAIL**：`cellStates` 去重 `[locked, empty]`；`BeadsGame` hint 公开成员命中**（无）**；`accent_blue` 图元数 **0** ⇒ 数据模型/API/渲染层**三处均无承载体** |

## G.2 取证细化子条（12 条）

| ID | 判据 | 来源（冻结值） | 取证手段 | 前置依赖 | 本轮结论 |
|---|---|---|---|---|---|
| **TC-PER-09** | VFX-1 落座回弹：scale **1.06 → 1.0 / 120ms** | `ux-spec §5` `vfx_fill_pop` | `[Probe]` 落子后 7–8 帧（120ms@60fps）该格图元 scale 须单调 1.06→1.0；`[Cocos]` 连拍 3 帧 | T-086 | ❌ FAIL（主体缺失，同 TC-PER-04） |
| **TC-PER-10** | VFX-2 放错抖动：~~±3px ×2 + **danger 闪 2 次 / 200ms**，且 ≤2 次/秒~~ → **v1.5 按 WXG-T-098 回写后的 `ux-spec §5`「放错拒绝」现文**：danger 描边 **单次脉冲**（淡入 60 / 峰值保持 80 / 淡出 60 = 200 ms ⇒ **一个 fx 窗口内 α 极值点 ≤1、不往复**）+ 连续拒绝 **视觉脉冲重启门 500 ms** ⇒ 有效 **≤2 次/秒**；`±3px 抖动 ×2` **属位移通道、不在闪烁通道**（不计入频率判据）；无全屏白闪、不屏震。**旧字面「闪 2 次」与 §3.8 红线的互斥（BD-29）已由裁定消除**，判据现可测 | `ux-spec §5`（v1.2 正文，WXG-T-098 回写）；`systems-index §3.8` 红线；`accessibility D2` | `[Probe]` `bead:rejected` 后 12–14 帧：位移通道取该格 `cx` 峰偏离 ≤ ±3px；**闪烁通道两条结构断言**（替代旧的「danger 色出现 2 次」计数）：① 一个 fx 窗口内 **α 峰点数 ≤1**（helper `countPeaks`，plateau 合并）② 连续拒绝时**相邻脉冲起点间隔 ≥500 ms** | T-086 + `CellState` 扩 `wrong`；改码 **WXG-T-102** | **❌ FAIL（v1.5 / P4）**：峰点数 **2 ⇒ 10.0 Hz**（判据 ≤1）、连续拒绝起点最小间隔 **100 ms**（判据 ≥500 ms）。~~旧结论「❌ FAIL（拒绝后增量 `[8×12]` 恒定）」已被 v1.3 的「有反馈但频率错」替代~~。**非新回归**：BD-29 由「规格互斥」转态为「实现落差」；`reduceMotion` 半边（P22）已成立，不重复计 |
| **TC-PER-11** | VFX-3 消除溶解：scale → **0.6 / 200ms** | `ux-spec §5` `vfx_clear_dissolve` | `[Probe]` 区域/随机消除生效后 12 帧，被清珠 scale 递减至 0.6 且 α 衰减 | T-086 | ❌ FAIL（现实现为**瞬时移除**、无过渡） |
| **TC-PER-12** | VFX-4 完成波浪：逐列 **20ms/列** · 总 **800ms**，≤3Hz | `ux-spec §5` `vfx_complete_wave`；`§3.8` | `[Probe]` 通关帧起按列序记录每列首次 scale 变化的帧号，**列间差 ≈1.2 帧（20ms）**、末列 ≈800ms；`[Cocos]` 连拍 | T-086 | ❌ FAIL（无 clear-wave 代码路径） |
| **TC-PER-13** | **色盲模拟可辨**：色底色相差异在 **deuteranopia / protanopia** 模拟下仍可区分同关使用的 **3–8 色** | `accessibility A2b`（⚠️ 当前标「✅ 随 T-085 实现」= **自相矛盾型假绿，BD-09b**） | `[Cocos]` 产物截图 + **色盲滤镜**（Chrome DevTools rendering 面板 / Playwright `emulateMedia` / CSS filter 三选一）→ 逐色对**灰度明度差 + 符号差**双通道确认 | **R1 + R2 + R3**（色盲模拟取证手段）；实现侧 BD-01 | ⛔ **不可测**（三重阻塞：实现缺失 + 构建阻塞 + 无滤镜手段） |
| **TC-PER-14** | **灰度下 6 状态可辨**：`empty`/`filled`/`locked`/`hint`/`wrong`/`selected` 凭符号+明度 100% 可区分 | `accessibility A3`（**部分假绿**：仅 `filled`/`locked`/`selected` 有非颜色通道）；`assets-spec §6` 验收 2 | `[Cocos]` 灰度截图（`filter: grayscale(1)`）+ **6 状态同屏构造** | R1 + R2 + **BD-01/BD-04/BD-11** | ⛔ **不可测**（6 状态中仅 3 态可构造） |
| **TC-PER-15** | **音频清单闭合**：`tuning.ts` 音频常量集合 **==** `audio-events §1` 的 **19 个 id** | `audio-events §4` **A05-24** `[N]` | `[Node]` 静态导入 `tuning.ts` 集合比对（**无需音频后端，今天可跑**） | 无（可立即执行） | ❌ **FAIL**：实测 **3** 个 vs 要求 **19** |
| **TC-PER-16** | **静音可玩**：`bgmMuted`+`sfxMuted` 全关时全流程**可通关** | `audio-events §4` **A05-23** `[N]` | `[Probe]` 预置存档两开关 true → 走完 L1 通关 | 无（今天可跑） | 待执行。⚠️ **本条即使 PASS 也不得作为「音频已落地」的证据**——当前为 `NullAudioBackend`，**静音与无声不可区分** |
| **TC-PER-17** | **告急脉冲周期**：**1000ms ±50ms**、**≤3Hz** | `timer-gameover §8-10` + `ux-spec §5` | `[Probe]` 采 180 帧（3s）记录 α 极值帧号 → 相邻峰间隔须 **60±3 帧**；`[Cocos]` 连拍 8 帧 | T-086 | ⛔ **不可测**（无脉冲主体，BD-10） |
| **TC-PER-18** | **满槽告警可观察**：托盘**描边呼吸 500ms 循环** + **轻提示音恰 1 次** | `ux-spec §5` 满槽告警行 | `[Probe]` `tray:full` 后 30 帧（500ms）托盘带描边图元须存在且 α 变化；音频侧断言该 tick 入队 `sfx_tray_full` **恰 1 次** | T-086 + BD-05 | ⛔ **不可测**（零告警图元） |
| **TC-PER-19** | **引导终止条件**：首次 `bead:placed` 即清引导；**`runs>0` 永不重现** | `ux-spec §5` 引导终止行 | `[Probe]` ① 首落子后**下一帧** hint/脉冲图元数归 0；② 预置 `runs=1` 存档冷启 → 开局 5s 引导图元数**恒 0** | T-086（引导落地后） | 待执行 |
| **TC-PER-20** | **首屏时间轴两锚点**：≤**1.5s** BOOT 完成并进 L1（首珠已在托盘 + 槽脉冲 + 单一目标格 hint）；**~5s** 首颗珠落座 = **首个爽点** | `ux-spec §6.1` | `[Probe]` 帧号锚点断言（**90 帧 / 300 帧**）；`[Cocos]` 产物 **load→1.5s→5s 三张截图**作为 FTUE 证据包 | R1 + R2 + BD-01/02/10/11 | ❌ **FAIL**：1.5s 锚点 **0** 颗珠；5s 锚点仍 **0** 颗（L1 首珠 6.02s） |

## G.3 取证前置依赖汇总（gating，交主理人做 sequencing）

| 前置 | 阻塞的 §G 用例 | 归属 |
|---|---|---|
| **R1** `pnpm run framework:sync` → G1 转绿 → `build:cocos:web` 通过 | 全部 `[Cocos]` 道次（TC-PER-01/02/03/04/07/13/14/17/18/20） | T-082 / 主理人 |
| **R2** Cocos 取证基础设施 + 截图方法（无头截图、产物运行时坐标换算、命名约定 `evidence/shots/<case-id>-<frame>.png`） | 同上 | T-082 |
| **R3** 色盲模拟 + 灰度滤镜取证手段 | TC-PER-13 / 14 | T-082 |
| **T-085**（BD-01 空槽目标色 / BD-02 首供 U7 / BD-06 U8 泄压阀 / BD-15 扩展入口） | TC-PER-01 / 02 / 03① / 06 / 20 | T-085 |
| **T-086**（BD-04 四类 VFX / BD-10 告急脉冲+满槽告警 / BD-11 hint / BD-16 轻提示） | TC-PER-03②③ / 04 / 07 / 08 / 09..12 / 17 / 18 / 19 | T-086 |
| **T-087**（BD-07 DPR / BD-08 镜像 / BD-13 跳关键位） | 全部 `[Harness]` 道次 | T-087 |
| **BD-05b** 音频后端（框架侧，三平台均 `NullAudioBackend`） | TC-PER-05 的 `[B]/[P]/[R]` 项、TC-PER-18 音频半边 | 框架 + T-085 |
| **真机 + AppID** | TC-PER-03 真人 FTUE、TC-PER-13/14 的 `[Device]` 复核 | 用户 / 主理人 |
| **用户拍板 U8**（GAP-06 泄压阀 A′/B/C/D） | TC-PER-06（判据已写成方案中立，拍板后可直接验） | 用户 |

---

## G.4 复验轮回填（**v1.4 / WXG-T-092**）——逐条「本轮可验道次」结论

> 取证工具：`node production/qa/beads/g4-probe-v1.1.mjs`（26 组，EXIT=0，时间戳 2026-09-15T01:24:22Z）；原始输出 `evidence/g4-reverify-v1.1.log §1`。**预期值一律取 T-091 回写后的 §8 现文**。详证（含代码锚点与实测数字）在 `g4-regression-report.md` v1.1 **§13 / §17**，本表只给状态行以免两处真相。
>
> 图例：**✅** 本轮实跑道次全过｜**⚠️** 部分过（弱化通过，条件见表右）｜**❌** 不成立｜**⛔** 不可验（通路/环境阻塞，**不得标绿**）。

| ID | v1.3 基线 | **v1.4 复验** | 本轮实跑道次 / 仍缺道次 |
|---|---|---|---|
| TC-PER-01 | ❌ FAIL | ✅ **已验**（`[Probe]`） | 三色逐格独立复算 + 22/22 幽灵 α0.2；⛔ `[Cocos]` 肉眼/色盲 |
| TC-PER-02 | ❌ FAIL | ✅ **已验**（`[Probe]`） | 第 **1 帧**即供料且首珠可落子；⛔ `[Cocos]` 首屏截图 |
| TC-PER-03 | ❌ FAIL | ⚠️ **部分**（`[Probe]`） | 三通道图元均存在；⛔ `[Cocos]` 盲测 + `[Device]` FTUE；附 **BD-32** 待裁 |
| TC-PER-04 | ❌ FAIL | ⚠️ **部分**（2/4 类可观察） | 落座 + 放错✓；溶解/波浪仍缺（→ PER-11/12） |
| TC-PER-05 | ❌ FAIL | ❌ **FAIL（维持，BD-05/05b）** | `[Node]` 复跑：clip 去重仍 2 种；⛔ `[B]/[P]/[R]`（`NullAudioBackend`） |
| TC-PER-06 | ❌ FAIL | ✅ **已验**（判据形态随 U8 拍板 A′+D 改写） | 合法供料 7933 采样死珠 **0** / 违规 **0**；满槽瞬间可落子 12/12 |
| TC-PER-07 | ❌ FAIL | ⚠️ **部分**（告急半边 ✅） | 1000ms / 1.00Hz / 三通道；**满槽描边呼吸零通道**（→ PER-18） |
| TC-PER-08 | ❌ FAIL | ✅ **已验**（含 D1 保留静态描边） | `accent_blue` 2px 环×2；D1 开启后呼吸停、描边仍在（P22） |
| TC-PER-09 | ❌ FAIL | ⚠️ **部分** | 剔 text 签名去重 2 ⇒ 有时间轴；**未逐值断言 scale 曲线**（需 `[Cocos]`） |
| TC-PER-10 | ❌ FAIL | ⚠️ **部分** | 位移峰得 ±2.6px（帧采样相位低估，**不作 FAIL**）+ danger α 4 档；**BD-29** 红线互斥待裁 |
| TC-PER-11 | ❌ FAIL | ❌ **FAIL（维持）** | 无 `vfx_clear_dissolve` 常量与代码路径（瞬时移除） |
| TC-PER-12 | ❌ FAIL | ❌ **FAIL（维持）** | 无 clear-wave 代码路径 |
| TC-PER-13 | ⛔ 不可测 | ⛔ **不可验（但阻塞从三重降为一重）** | 实现半边已具备；缺 `[Cocos]` + 色盲滤镜（报告 §18.2 B1） |
| TC-PER-14 | ⛔ 不可测 | ⛔ **不可验（前置已解除）** | `empty/filled/locked/hint/wrong/selected` **六态本轮均可构造**（v1.0 仅 3 态）；缺灰度截图 |
| TC-PER-15 | ❌ FAIL | ❌ **FAIL（维持）** | `[Node]` 今天可跑：3 vs 19，A05-24 不闭合 |
| TC-PER-16 | 待执行 | ⛔ **本轮未排**（且无意义） | `NullAudioBackend` 下「静音与无声不可区分」；待音频后端落地后随 `[N]` 补跑 |
| TC-PER-17 | ⛔ 不可测 | ✅ **已验**（主体已存在） | 实测 **1000ms = 1.00Hz**；⛔ `[Cocos]` 连拍 8 帧 |
| TC-PER-18 | ⛔ 不可测 | ❌ **FAIL（可验了但不成立）** | `tray:full=1` 去重✓，然描边呼吸签名去重 = **1**；音频半边 ⛔ |
| TC-PER-19 | 待执行 | ✅ **已验** | ① 首落子即清 ② 预置 `runs=1` 冷启后引导图元恒 0（`evidence/diag-p3-onboarding.mjs`）；**但判据意图受 BD-32 质疑** |
| TC-PER-20 | ❌ FAIL | ⚠️ **部分** | 1.5s 锚点✓（第 1 帧）；~5s 首落座在自动落子夹具下成立（P20）；⛔ 三张首屏截图 |

**计数**：✅ **6**・⚠️ **6**・❌ **5**（PER-05/11/12/15/18）・⛔ **3**（PER-13/14/16）= 20。

> **与 §G.3 gating 表的差异（必须同步给主理人）**：G.3 的 **R1**（framework:sync → 构建）已关；**R2/R3（截图与滤镜）本轮仍未交付** ⇒ 所有 `[Cocos]` 道次继续 ⛔；**T-085 / T-086 / T-087 的实现前置已全部落地并经探针他证**（唯 BD-04 余两类 VFX、BD-10 满槽告警半边、BD-15/BD-16 属波次 2 未列范围）；**U8 已拍板 A′+D**；**真机 + AppID 仍缺**。

## G.5 裁定后增量回填（**v1.5 / WXG-T-098**）——只动受三条改判影响的行

> 写入规矩：**不改写 §G.4（v1.4）历史表**，只在此追加增量行；预期值一律取 **T-098 回写后的 §8 / §5 现文**，且**先改预期值、后重跑**（顺序自证见报告 §20.1、证据 `evidence/g4-reverify-v1.3-t098.log §0`）。证品：`g4-probe-v1.1.mjs` 修订 38。

| ID | v1.4 基线 | **v1.5 改判后** | 口径来源 / 实测（本单只动这三条） |
|---|---|---|---|
| TC-PER-04 | ⚠️ 部分（2/4 类可观察） | ⚠️ **仍部分（但拒绝反馈子类由⚠️降为 ❌）** | 放错类从「有增量」收紧为「增量形状不合」⇒ 见 TC-PER-10；溶解 / 波浪仍缺（本单未重判） |
| TC-PER-10 | ⚠️ 部分（位移 ±2.6px + danger α 4 档，BD-29 待裁） | ❌ **FAIL（判据已可测且已收紧）** | `ux-spec §5` 现文⇒两条结构断言：① 一个 fx 窗口内 **α 峰点数 ≤1**→实测 **2**（10.0 Hz）；② 连续拒绝脉冲起点间隔 **≥500 ms**→实测 **100 ms**。**非新回归**：BD-29 由「规格互斥」转态为「实现落差」，改码立项 **WXG-T-102**（`production/TASKS.md:43`）；`reduceMotion` 半边（P22）不重复开缺陷 |
| TC-PER-20 | ⚠️ 部分（1.5s 锚点✓；~5s 首落座在自动落子夹具下成立，P20） | ✅ **已验（仅 [N] 模拟时间层）** | P20 由 PASS\* 转 **PASS**：`tray-spawner §8-1` 现文两轴分列 ⇒ 闭区间 [0,60] 按**名义时刻**计数 **16/16**、最大滞后 **2.00 帧**（= 上界压线）、零负偏差、间隔偏差 **0.0167 s**；**旧字面严格读法仍 15≠16**（第 16 次落 60.033 s）⇒ 两读并列。**⛔ 三张首屏截图仍未交（R2 未解除）**，故本条不得读作像素层已验 |
| （新增）TC-TRAY-03N | — | ✅ **已验（P26-N）** | 负向用例：`decoys` 非空关卡 → BOOT 拒收、`phase=boot`、`tray:spawned=0`（多推 2 s 仍不进 PLAYING）。**归属 `levels-spec §2` / `levels.ts:184`，不属 S4 §8 ⇒ 不得回填成 §8 的绿** |

**计数变化**：§G 20 条中本单改判 **2 条**（PER-10 ⚠️→❌、PER-20 ⚠️→✅）+ **1 条新增负向用例**（不在 20 条内，归 §A3/§B）。本单未重跑的 17 条维持 §G.4。⚠️ **注意方框效应**：PER-10 变红是因为**判据变严且变可测**，不是新回归；若只看总数会变难看而结论变干净，勿据此误判。

---

# §H 未映射判据补编（22 条，v1.3 新增）—— **BD-21① 修复项**

> 背景：9 份 GDD §8 共 **93** 条，v1.2 只映射 **71** 条 ⇒ **22 条零映射**（`save-progress §8` 10 + `pause-settings §8` 10 + `timer-gameover §8-11/12` 2）。本节逐条补齐，使 §8 判据映射率达 **100%**。

## H1 · 存档与进度（S8）— 来源 `save-progress.md §8.1..10`

| ID | 判据 # | 用例 | 环境 | 预期 / 判据 | 状态 |
|---|---|---|---|---|---|
| TC-SAVE-01 | §8-1 | 首启/二启 `runs` 与续进 | `[Node]` | 无存档 → `runs=1`、`unlockedLevel=1`、进 L1；二次启动 `runs=2` 且续进 `unlockedLevel` 最远关 | 待执行 |
| TC-SAVE-02 | §8-2 | 解锁落档 + 星级取 max | `[Node]` | 过第 n 关（n<`DEMO_LEVEL_COUNT`）→ `unlockedLevel=n+1` 落档且**重启保留**；`stars[n-1] = max(旧, 新)`，**历史最高星不被低星覆盖** | 待执行 |
| TC-SAVE-03 | §8-3 | 篡改矩阵逐条复现 §2.4 | `[Node]` | 解析失败 → 出厂默认进 L1；`unlockedLevel=99` → 钳 8；`=0` → 钳 1；`stars` 长度 3 → 重置全 0；**全部不中断启动**（联合 TC-LOOP-10 / `core-loop §8-10`） | 待执行 |
| TC-SAVE-04 | §8-4 | 高版本档前向兼容 | `[Node]` | 注入 `version=2` 档 → 可读字段保留、照常启动、**无异常抛出**（SaveManager 永不抛异常契约） | 待执行 |
| TC-SAVE-05 | §8-5 | v1 → v1.1 升级读取 | `[Node]` | 旧 v1 档直接升级读取，`sprint`/`meta` 字段取默认值、**v1 字段值无损**；新档写 v1.1 完整字段 | 待执行 |
| TC-SAVE-06 | §8-6 | `sprint.bestScore` 写入条件 | `[Node]` | 新分 > 旧最佳 → 写入 + S7 NEW BEST 显示；≤ → **不写**（联合 TC-SPRINT-11 / `score-combo §8-11`） | 待执行 |
| TC-SAVE-07 | §8-7 | 连胜字段 | `[Node]` | 连续过关 3 次 → `winStreakCurrent=3`、`Best=3`；第 4 关失败 → `Current=0`、`Best` 仍 3 | ❌ **FAIL(BD-12)**（本轮已实测，见 §A.0） |
| TC-SAVE-08 | §8-8 | 设置开关即档 + 双通道独立 | `[Node]` | 切换音乐/音效 → **即档**、重启回显一致；两通道互不影响（双 AudioScheduler，`architecture §2`） | 待执行（⚠️ **回显可断言，实际静音效果依赖 BD-05b**） |
| TC-SAVE-09 | §8-9 | PLAYING 零写档 / 结算帧恰 1 次 | `[Node]` | ~~注入 200 次落子~~ → **v1.3 改：注入 ≤`GRID_MAX_COLS×GRID_MAX_ROWS` 的最大可构造量（156；本轮取 150、留 6 格避免通关）**，PLAYING 全程写档 **0** 次；结算帧写档**恰 1** 次。**改判依据 BD-24**（200 不可构造） | ⚠️ **PASS\***（本轮已实测） |
| TC-SAVE-10 | §8-10 | 整关重置不写档 | `[Node]` | 五项重置（`timer-gameover §2.4`）**均未**触发写档（关内态不入档） | 待执行 |

## H2 · 暂停与设置面板（S9）— 来源 `pause-settings.md §8.1..10`

| ID | 判据 # | 用例 | 环境 | 预期 / 判据 | 状态 |
|---|---|---|---|---|---|
| TC-PAUSE-01 | §8-1 | 齿轮 → 暂停 + 遮罩门禁 | `[Node]` | PLAYING 点齿轮 → `game:paused` 恰 1 次、S1=PAUSED、面板可见、**遮罩覆盖棋盘与托盘**；PAUSED 中点遮罩/棋盘/托盘/道具卡**全部零响应**（联合 TC-INP-08） | 待执行 |
| TC-PAUSE-02 | §8-2 | PAUSED 300s 冻结 | `[Node]` | 300s 后继续 → `remaining` 与暂停前一致（≤1 帧 dt）；首个供料**不早于「暂停剩余间隔 +1 帧」**（联合 TC-TIMER-05 / TC-TRAY-08） | 待执行 |
| TC-PAUSE-03 | §8-3 | 重玩本关五项重置 + 无中转 | `[Node]` | 五项逐一断言（倒计时回满 / 图案清空 / 托盘清空 / 扩展重置 / 道具次数回 `POWERUP_FREE_USES`）；S1 **直接回 PLAYING、无 GAME_OVER 中转**。GDD 原注记：第五项在 S6 落地前为「待 S6」真空项、**不得发明伪状态充数** ⇒ S6 已落地（`powerups.test.ts`），本条**现可全断言** | 待执行 |
| TC-PAUSE-04 | §8-4 | 音乐/音效开关即档 + 互不影响 | `[Node]` | 各切 2 次：`settings.*` 即档、重启回显一致；**关音乐仍有音效、反之亦然** | 待执行（`tests/pause-settings.test.ts` 已部分覆盖，需核对是否含「互不影响」断言） |
| TC-PAUSE-05 | §8-5 | 齿轮热区 + 胶囊避让 | `[Node]` | 齿轮热区 **≥88×88** 且**不侵入** `CAPSULE_AVOID`；面板任何元素**不与胶囊重叠**（布局断言） | 待执行 |
| TC-PAUSE-06 | §8-6 | 归零 vs 齿轮（**帧内序**基准） | `[Node]` | 基准 = **帧内序：输入（段内序 状态指令 → 玩法事件）→ 连击窗 → 供料 → 计时**。**同帧** → 暂停生效、本帧 dt 不再累计、恢复前不判负；**跨帧**（此前帧已借归零进 GAME_OVER）→ GAME_OVER 生效、无暂停（联合 §E 帧内序用例组） | 待执行 |
| TC-PAUSE-07 | §8-7 | 非 PLAYING 五状态门禁 | `[Node]` | BOOT / LEVEL_CLEAR / GAME_OVER / FINISH / PAUSED 注入齿轮请求 → **零事件零状态变化** | 待执行 |
| TC-PAUSE-08 | §8-8 | 重复暂停幂等 | `[Node]` | PAUSED 中注入 `game:paused` → S5 保存值不变、恢复后 `remaining` 正确（联合 TC-TIMER-09） | 待执行 |
| TC-PAUSE-09 | §8-9 | sprint 暂停冻结连击窗 | `[Node]` | 连击窗口计时冻结，恢复后从暂停值续算、**不追溯断连**（联合 TC-SPRINT-10 / C8） | 待执行 |
| TC-PAUSE-10 | §8-10 | 面板入/出动效帧检 | `[Node]` + `[Cocos]` | 面板**入 ≤200ms** / **出 ≤150ms**（权威 `ux-spec §5`）；红线 ≤3Hz 闪烁。**Node 侧**可断言 `progress` 时间轴（已由 §F F6 覆盖淡出期门禁）；**像素级帧检须 `[Cocos]`** | 待执行（F6 已覆盖逻辑半边） |

## H3 · 失败续时（S5 v1.2 增补）— 来源 `timer-gameover.md §8-11/12` + `systems-index §3.11`

| ID | 判据 # | 用例 | 环境 | 预期 / 判据 | 状态 |
|---|---|---|---|---|---|
| TC-TIMER-11 | §8-11 | 续时同局续打 | `[Node]` | 构造普通关 GAME_OVER（格已填若干、托盘非空）→ 注入 `onRewarded` → `remaining = REVIVE_BONUS_SEC`、`reviveBonusSec = REVIVE_BONUS_SEC`、`revived=true`、S1 回 PLAYING；**网格 `filled` 计数与托盘槽态与失败前逐一相等**（不走 §2.4 整关重置） | 待执行 |
| TC-TIMER-12 | §8-12 | 次数上限与未看完 | `[Node]`（需替身注入） | 同尝试第二次续时指令**被忽略**、`remaining` 不增加（`REVIVE_MAX_PER_LEVEL`）；未看完 / 错误回调 → `remaining` 仍为 0、停在 GAME_OVER；**冲刺归零注入续时 → 零加时**（`systems-index §3.10` 末注「冲刺不续时」） | 待执行 |

> **TC-TIMER-12 取证纪律（重要，防假绿）**：harness 当前装的是 `MockRewardedAdProvider('complete')` ⇒ **「看完」分支必然成功**，该路径**不可作为真机广告行为证据**；「未看完 / 错误回调」分支**必须靠替身注入**（构造 `onError` / 不回调），**不得因替身总是 complete 就把该分支标绿**。同理：**续时不能解 BD-06 死局**（`REVIVE_BONUS_SEC` 只加时间不清托盘），验 TC-PER-06 时勿把「续时成功」误读为「已修复」（`ux-spec §4` 尾注已明文警示）。

---

# §I 宿主坐标归一化判据（缺陷 C1 回归闸门，**v1.6 / WXG-T-109 新增**）— 来源 `ADR-0011 §3(e)` + `T-104·A4`

> **归属理由（为何单开 §I，不并入 §A / §G）**：本文件的组织法是**「每一节 = 一个判据来源家族」** —— §A = 9 份 GDD §8 的 1:1 映射（50 条 = 5 组 × 10，头部与合计表按此计数）；§B = `systems-index §3` / accessibility；§C = `score-combo §8`；§D = `powerups §8`；§E = `core-loop §2.2.2` 帧内序；§F = `ux-spec`；§G = 可感知性规格层四件套；§H = 未映射 §8 补编。R1/R2/R3 的来源是 **`ADR-0011 §3(e)`「宿主归一化契约」+ `WXG-T-104·A4` 实测判据** —— **既非 GDD §8、也非 §G 的规格层**（ux / assets / audio / accessibility）⇒ 并入任一既有组都会**污染该组的来源谱系**，故**新开 §I**。
>
> **ID 选号**：取 `TC-COORD-*`（坐标契约），**不取 `TC-HOST-*`** —— 探针里 `HOST-01/02/03` 是「宿主 **accessor 级**」断言的**另一组 ID**，同名会混。T-104 A4 的代号 **R1 / R2 / R3 保留在「判据代号」列**，与探针判定函数 `judgeR1 / judgeR2 / judgeR3` 同名，使三方（`T-104 A4` ↔ 探针用例 ID ↔ 本表）**可对**。
>
> **本节补什么窟窿**：缺陷 C1（Cocos 宿主输入 **y 轴镜像 + ×dpr**；真机两轴全错）在 **184 例 vitest 全绿**下仍然发生 —— 正是 §G.0 所述「逻辑可断言型判据对画面 / 坐标类缺陷判别力为零」的同族。WXG-T-108 已把它固化为**可复跑探针**；本节把它**升为门控用例**，使「只跑用例表」的回归也能覆盖此类（本仓已因此重复踩过四次同族坑）。
>
> **道次图例（本节用 T-108 探针的 lane 标记，映到文首图例）**：`[N]` = **无头浏览器逻辑层**（真实 Chromium 载 Cocos web-mobile 产物 + 打桩 `input.push` + 读 snapshot）≈ 文首 `[Node]` 族产物道次 ｜ `[B]` = **浏览器真实渲染像素级**（截图 + PNG 解码）≈ 文首 `[Cocos]` 已解锁像素道次 ｜ `[R]` = **真机 / 微信小游戏宿主** = 文首 `[Device]`。
>
> **本轮（WXG-T-109）取证**：`node production/qa/beads/cocos-input-probe.mjs` ⇒ **退出码 0 ｜ PASS 18 ｜ FAIL 0 ｜ ⛔ 2**（2026-09-15T14:03:12Z，耗时 23.2s）；证据 `evidence/t109/cocos-input-probe-t109.log` + `evidence/t109/*.png`（本轮用独立 `--out=evidence/t109` 落盘，**不覆盖** T-108 的冻结证据 `evidence/cocos-input-probe.log`）。探针 `SELF-01` 以 T-104 记录的**修复前**数字为反例，四个判定函数**全部返回不通过** ⇒ **判别力有反例证明，非恒真**。

## I.1 主判据（3 条）

| ID | 判据代号 | 用例 | 环境 | 判据原文 / 预期 | 预期值来源（`T-104` 实测 · `ADR-0011 §3(e)` · 探针用例 ID） | 状态 |
|---|---|---|---|---|---|---|
| **TC-COORD-01** | **R1** | **端到端命中 + 反证** | `[N]` | 点托盘槽 0 的**可见屏幕位置** ⇒ `traySelected===0` 且 `slot0.state==='selected'`、`_pointer` 回读 ≈ 槽心（±6 设计px）；点其**上下镜像位置** ⇒ `traySelected===-1`；**判别力 guard**：可见 y 与镜像 y 相差 ≥100px | **`T-104·A4-R1` 实测**（1280×720）：可见点 `(478.6,496.6)` ⇒ `traySelected=0`、`_pointer=(76.70,413.17)` vs 槽心 `(76,414)`；镜像点 `(478.6,223.4)` ⇒ `traySelected=-1`、`_pointer=(76.70,920.83)`（离槽心 **506.8** 设计px）；guard **273.1px**。**修复前恰好相反** · `ADR-0011 §3(e)-1`（adapter 再翻一次 y 是**必需**、非「双重翻转」——早期理解反了才产生 C1） · 探针 **`R1-01+R1-02`**（信箱档 `R1-03+R1-04`；dsf2/3 端到端 `R3-02`/`R3-03`） | ✅ **已验**（WXG-T-109 复跑 / `R1-01+R1-02`+`R1-03+R1-04`+`R3-02`+`R3-03` 全 PASS） |
| **TC-COORD-02** | **R2** | **数据流：push ≈ 页面坐标** | `[N]` | 每次点击 `InputManager.push(down)` 收到的 `push.x ≈ pageX−rect.x`、`push.y ≈ pageY−rect.y`（±1.5px，**镜像点与可见点两次都要成立**）；且 `push.y` **不等于**旧口径 `canvasHeightCss − pageY`（差 ≥100px ⇒ 证非镜像值） | **`T-104·A4-R2` 实测**：两次点击 `push(down)=(479,223)`/`(479,497)` vs 页面相对 Δ=**(0.4,0.4)**；反镜像 guard：与旧式 `canvasH−pageY` 相差 **273.6px** · `ADR-0011 §3(e)-2`（必须**同时** ÷dpr 与 y 翻转） · 探针 **`R2-01`**（宿主 accessor 同族 `HOST-01/02/03`、封顶口径反证 `HOST-03b`；breakout 数据流 `BR-01`） | ✅ **已验**（WXG-T-109 复跑 / `R2-01` PASS） |
| **TC-COORD-03** | **R3** | **dpr 不变性（封顶 2）** | `[N]` | dpr=1/2/3（引擎封顶 2）三档下点**同一可见点** ⇒ 落点一致（`push` 三档两两差 ≤1.5px）；且 dsf≥2 时 `raw.x ≈ page × dpr`（证明 ÷dpr 真被行使，**排除恒等退化**） | **`T-104·A4-R3` 实测**：三档同一页面点 ⇒ `push=(479,497)` **完全一致**（两两差 **0.0px**）；`raw.x`=479/958/958 = `page×dpr`（修前 dsf≥2 为 `(958,994)`） · `ADR-0011 §3(e)-3`（dpr 必须与输入源同源：`cc.screen.devicePixelRatio`，web 封顶 2 / 小游戏无封顶）与 **§4.2(0)**（DPR 须**显式注入**，否则无头 CI 下断言退化为恒真而静默失效） · 探针 **`R3-01`** | ✅ **已验**（WXG-T-109 复跑 / `R3-01` PASS） |

## I.2 ⛔ 未测道次（**不得记 PASS，亦不得记 FAIL**）

| ID | 道次 | 环境 | 阻塞原因 | 解除条件 |
|---|---|---|---|---|
| **DEV-01** | 微信小游戏宿主 `getLocation()` / `push` 复取 | `[R]` | **无真机、无 AppID ⇒ 未实测**。源码 `pal/input/minigame/touch-input.ts:86-90` 与 web **同形**（左下原点 + ×pixelRatio），但 `pal/screen-adapter/minigame` **无 2 封顶** —— 属**读源码**、非实测，**不得写为已验证** | ① 有效 **AppID**；② `pnpm --filter @wxgame/{beads,breakout} run build:cocos:wx` 出包；③ 微信开发者工具 / 真机可跑；④ 用同一探针在 `wx` 宿主复取三个 accessor 与 `push` 值；**真机首验须把「点击落点 / 托盘选中 / dpr 缩放」列 P0**（`ADR-0011 §4.2(10)`） |
| **DEV-02** | wechatgame 平台构建（`build:cocos:wx`） | `[⛔]` | 缺有效 **AppID** ⇒ 无法出包 ⇒ 上条 `[R]` 的前置亦不成立 | 同上 ①；解除后方可执行 **DEV-01** |

> **口径纪律**：`DEV-01 / DEV-02` 属**环境阻塞**，**严禁**读作 PASS（无真机时任何「真机已验」均为假绿）；亦**不记 FAIL**（未测 ≠ 不成立）。本节 3 条 `[N]` 可执行用例**已全绿**，唯此 2 条 `[R] / [⛔]` 未测 ⇒ **门控时须按「未测」处理，不得当「已过」**（见文末门禁建议）。

## I.3 自证：三条判据 ↔ 探针对应用例（一一对上）

| 本节用例 | 探针 `cocos-input-probe.mjs` 用例 ID | 判定函数 | 本轮探针结论 |
|---|---|---|---|
| TC-COORD-01（R1） | `R1-01+R1-02`（主）/ `R1-03+R1-04`（500×1000 信箱）/ `R3-02`+`R3-03`（dsf2/3 端到端） | `judgeR1` | 全 ✅ PASS |
| TC-COORD-02（R2） | `R2-01`（主）/ `HOST-01`+`HOST-02`+`HOST-03`+`HOST-03b`（accessor 同族+封顶反证）/ `BR-01`（breakout 数据流） | `judgeR2` / `judgeHost` | 全 ✅ PASS |
| TC-COORD-03（R3） | `R3-01` | `judgeR3` | ✅ PASS |
| DEV-01 / DEV-02（⛔） | `DEV-01` / `DEV-02`（脚本内 `DECLARED_BLOCKED`） | —（不判定，仅登记） | ⛔（预期阻塞，不计退出码） |

> **复跑命令**：`export PATH="$HOME/.workbuddy/binaries/node/workspace/node_modules/.bin:$PATH"` → `node production/qa/beads/cocos-input-probe.mjs`（前置：产物须为当前代码所建，脚本 `ENV-*` 门会拦陈旧产物）。**退出码语义**：`0` 全绿 ｜ `1` 有 FAIL（真回归）｜ `2` 无 FAIL 但有**未预期**阻塞 / 探针无效（**不得当绿**）｜ `3` 脚本级环境错误。

---

## 变更记录

| 版本 | 日期 | 变更 | 作者 |
|---|---|---|---|
| v1.0 | 2026-09-11 | 初版：§A 50 条（5 组 × 10，§8 判据 1:1）+ §B 派生 12 条 | 严守真 |
| v1.2 | 2026-09-12 | 增 §C 冲刺 11 条（WXG-T-028）+ 冲刺常量速查（`systems-index §3.10`） | 严守真 |
| **v1.3** | **2026-09-14** | **WXG-T-084（GAP-14 / BD-14 根治）**：① **新增 §G 可感知性判据 20 条**（8 主条 TC-PER-01..08 + 12 取证细化 TC-PER-09..20），覆盖 GAP-01/02/03/04/05/06/10/11，每条标**取证手段**与**取证前置依赖**，并附 §G.3 gating 表；② **新增 §H 未映射判据补编 22 条**（TC-SAVE-01..10 / TC-PAUSE-01..10 / TC-TIMER-11..12）⇒ §8 判据映射率 71/93 → **93/93 = 100%**；③ **新增 §A.0 实测状态回填表**（本轮真正执行过的 16 行）+ 状态列改**四态**（废除「一律待实现」）；④ 图例扩展 `[Probe]` / `[Cocos]` 并标注 harness 污染与 Cocos 阻塞；⑤ **修 BD-21 四处**：头部「61 条」→ **93 条**、合计表补 §D/§E/§F 并重算为 **137 用例**、§F 标题「7 条」→ **8 条**；⑥ **承接 BD-25**：TC-LOOP-02 / TC-TRAY-01 期望由「15（±1）」显式改为 **16（±0）**（U7 首供语义）；⑦ **承接 BD-24**：TC-SAVE-09 「200 次落子」改为「≤`GRID_MAX_COLS×GRID_MAX_ROWS` 的最大可构造量」；⑧ §H3 补 **TC-TIMER-12 取证纪律**（`MockRewardedAdProvider('complete')` 不得作真机证据、续时不解 BD-06）。**判据全部引规格层冻结值，零自造。** | 严守真 |
| **v1.4** | **2026-09-15** | **WXG-T-092（G4 复验轮回填，追加不覆盖）**：① 新增 **§G.4 复验回填表**——§G 20 条逐条给「本轮可验道次」结论（✅ 6 / ⚠️ 6 / ❌ 5 / ⛔ 3），并显式区分「实现缺失」与「取证通路缺失」（v1.0 的 **12 条「取证主体不存在」现降为 0**）；② 头部**图例校正**：`[Harness]` 坐标污染已解除（BD-07 关，ADR-0011）、`[Cocos]` 阻塞由「BD-20 构建不通」改写为「屏幕层取证通路缺失」（**不得混读为已解除**）、`[Probe]` 工具指向 `g4-probe-v1.1.mjs`；③ **常量速查按 v1.17 现文校正**：~~`NEEDED:DECOY=3:1`~~ → `DECOY_COLORS_MAX=0`（D 方案）⇒ 标 **S4 §8-3 不可构造（BD-28）**，并补注「重叠区归属以 §8-4 为准」（BD-23 已裁）；④ 状态行指向报告 v1.1 §13/§14/§17。**本轮新增待裁缺陷：BD-27（§8-1 窗口口径）・BD-28〜BD-32（均属判据/规格/文档侧，见报告 §15）。** | 严守真 |
| **v1.5** | **2026-09-15** | **WXG-T-098（B7 裁定包回写后的 QA 侧同步，追加不覆盖）**：① **§A3 TC-TRAY-01** 按 `tray-spawner §8-1` 现文重写为**两轴分列**（窗口 **t∈[0,60] 闭区间** / **次数轴 ±0 只约束次数**、按调度**名义时刻**计数⇒第 16 次名义 60.0 s 计入 = **BD-27 的开/闭区间裁定** / **时刻轴 0≤滞后≤2 帧**（帧 = `GameLoop.fixedDt` 1/60 s，正本 = `systems-index §3 前言「使用约定」第 4 条`；**帧量化不得进次数轴**）/ **负偏差提前 = FAIL** / 间隔 ±0.1 s / **前提不被满槽截断**），状态 → ✅ P20 = **PASS**（与旧字面严格读法 15≠16 **两读并列**）；② **§A3 TC-TRAY-03** 改为 **⛔ 不可验**（§8-3 判为**作废**而非平凡真：比例不可观测 ⇒ 记 PASS = 伪绿），附**复活条件**，并拆出**负向用例 TC-TRAY-03N**（已验 P26-N）；③ **§B TC-CONST-03** 常量 2 → **0（§3 v1.17）**并登记 **O4 文档同步残留**（`levels-spec.md:23/:42` 仍写 =2，属 `design/**` 待回写，本 QA 不改笔）；④ **§B TC-A11Y-04 / §G.2 TC-PER-10** 按 `ux-spec §5` 现文改写为可测的**单次脉冲（α 极值点 ≤1）+ 500 ms 重启门**，状态 → ❌ **FAIL**（P4：峰点 2 ⇒ 10 Hz、起点间隔 100 ms）⇒ **BD-29 转态不关单**，改码立项 **WXG-T-102**；⑤ 新增 **§G.5 增量回填表**（PER-04/10/20 三行 + 负向用例；**不改写 §G.4 历史表**）；⑥ **§G.2 TC-PER-10 定义行**就地更新（旧「闪 2 次 / 200ms」划线保留）。**本轮零自造判据，全部引用 T-098 回写后的规格现文**；详证 `g4-regression-report.md §20`。 | 严守真 |
| **v1.6** | **2026-09-15** | **WXG-T-109（Cocos 输入 R1/R2/R3 回写为硬判据）**：① **新增 §I「宿主坐标归一化判据」3 条**（`TC-COORD-01/02/03` = T-104 A4 的 R1/R2/R3），来源 = `ADR-0011 §3(e)` + `T-104·A4`，**每条标判据原文 / 环境道次 / 预期值来源（T-104 实测 + §3(e) 条号 + 探针用例 ID）/ 当前状态**；选号理由与「为何不并入 §A/§G」见 §I 节首；② **§I.3 自证表**：三条判据 ↔ 探针 `R1-01+R1-02` / `R2-01` / `R3-01`（含信箱档、dsf2/3、accessor 同族）**一一对上**；③ **§I.2 ⛔ 未测道次**：`DEV-01`（微信宿主，无真机）／`DEV-02`（wechatgame 构建，缺 AppID）记 **⛔ + 解除条件**，**不记 PASS 亦不记 FAIL**；④ **同步 §A.0**：新增 `A.0b` 增量块（本轮真正执行过的 5 行；上方 16 行 WXG-T-084 轮**不改**）；⑤ 文首图例追加 `[N]/[B]/[R]` lane 映射；分组汇总表新增 §I 行、合计用例数 **137 → 140**。**本轮零自造判据**：三条全部逐字引 T-104 A4 与 `ADR-0011 §3(e)`；取证 = 复跑 `cocos-input-probe.mjs`（退出码 0｜PASS 18｜FAIL 0｜⛔ 2，`evidence/t109/`）。 | 严守真 |
| **v1.7** | **2026-09-15** | **WXG-T-114（真链口径轮 · BD-34 回归闸门）**：① **新增 §A4b**——`TC-INP-01R/07R/08R`（P8/P10/P22 的**真链口径**补充：`beginFrame→push(down/up)→update→endFrame`，经 `InputManager`，补 K-038 缺失的「旁路 ≡ 真链」断言）＋ `TC-INP-11/12/13`（`LEVEL_CLEAR`/`GAME_OVER`/`FINISH` 三相位真链门禁，对应 `input-control §8` **拟增条文 8b/8c/8d**，**待设计中转文策渊确认**）。**6 条本轮全绿**（探针 `P8R/P10R/P22R/P27a..d`）。② 头部任务号 + 版本 v1.6→**v1.7**；合计表新增 §A4b 行、总用例 **140→146**（另 §8 判据列注明「＋拟增 3」）。③ **判据/阈值零改动、旁路例零删除**：本轮只把探针**驱动口径**从旁路切真链并补三相位门禁；旁路口径读数（`P8`=PASS\* / `P10`=PASS / `P22`=PASS\*）与真链口径**逐条一致（差异=0）**。④ 详证与 §8 拟改条文全文见 `g4-regression-report.md §22`（v1.5）；证据 `evidence/g4-probe-v1.1-t114{,-rerun,-baseline}.log`。⑤ **`[R]` 真机 ⛔**（无 AppID/无真机，不记 PASS 亦不记 FAIL）；**丢帧多子步多指令属 WXG-T-113，不属本节**。 | 严守真 |
| **v1.8** | **2026-09-15** | **WXG-T-116（§A4b 去「拟」+ 次按钮真链孪生）**：① **去「拟」**——`TC-INP-11/12/13` 的判据引用由「`§8-8b/8c/8d`（**拟增**，待设计侧确认）」改为正式编号 **`input-control §8-8b / 8c / 8d`**（**WXG-T-115 已由文策渊定稿落盘**），状态串同步；**判据 / 阈值零改动**，本条只改**引用与状态**。② **补 5 条次按钮真链孪生**：`TC-INP-11b`（`8b`「去冲刺」⇒ `mode normal→sprint`）／`TC-INP-12b`（`8c` 普通局「续时」⇒ `watchingAd` + `MockRewardedAdProvider` 发奖腿 ⇒ `remaining += REVIVE_BONUS_SEC`，**记 PASS\***）／`TC-INP-12c`（`8c` 冲刺局「再来一局」⇒ `mode=sprint`）／`TC-INP-12d`（`8c` 冲刺局「返回关卡」⇒ `mode=normal`）／`TC-INP-13b`（`8d`「去冲刺」⇒ `mode normal→sprint`）。**5 条本轮全绿**（探针 `P27e..i`：PASS 4 ｜ PASS\* 1 ｜ FAIL 0 ｜ ⛔ 0）。③ 头部任务号 + 版本 v1.7→**v1.8**；§A4b 行「6→**11** 条」、合计总用例 **146→151**（§8 判据列「＋拟增 3」→「＋三相位定稿 3」）。④ **旁路例零删除、不加宽断言**；主/次按钮腿 1:1 孪生。⑤ **⛔ 边界**：真机激励视频拉起/发奖（`[R]`）与「未看完 / skip / error」三分支**未测**（不记 PASS 亦不记 FAIL，解除条件见 §A4b 注）；证据 `evidence/g4-probe-v1.1-t116{,-rerun}.log`。 | 严守真 |
