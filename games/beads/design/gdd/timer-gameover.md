# GDD · S5 倒计时与失败（Timer / GameOver）· beads

- 项目：`games/beads` · 版本 v1.3 · 任务号 WXG-T-130（v1.3 = 重置清单第 2 项改「恢复初始错位布置」；v1.2 = 续时 WXG-T-057）
- 数值纪律：只引用 `systems-index §3` 常量名（本篇主要 §3.5 / §3.11，星级口径 §3.7）。
- 依赖锚点：`core-loop.md` §2.1 状态机（PLAYING/GAME_OVER 转移）与 §6 同帧裁决（cleared 优先）；失败续时提案 `proposals/ads-revive.md`（已拍板）。

---

## 1. 目标

提供关卡倒计时的唯一时间真源：驱动 HUD 显示与告急表现，归零时触发唯一失败条件，定义整关重置，并在普通模式失败页提供**同局续时**（不改失败唯一条件）。

## 2. 机制

### 2.1 计时模型

- 每关初始化 `remaining = LEVEL_TIME`（默认 `LEVEL_TIME_DEFAULT`，关卡可覆盖，区间 [180, 420]）。
- 仅在 S1 `PLAYING` 状态累计 dt：`remaining -= dt`；**内部按 dt 连续累计**，显示按 `TIMER_TICK` 粒度取整刷新（内部精度 ≠ 显示精度）。
- `remaining ≤ 0` → 钳到 0 → 广播失败信号给 S1（S1 切 GAME_OVER 并发 `level:failed`）。

### 2.2 告急双通道（`remaining ≤ TIMER_URGENT_T` 时激活）

| 通道 | 表现 | 对齐 |
|---|---|---|
| 视觉 | 倒计时数字与图标切 `danger` 色 + 1000ms 周期 α 脉冲 | `hud_timer_danger`（assets-spec §1.5） |
| 听觉 | 告急音效/心跳节拍（节拍周期 = 脉冲周期） | §3.8 告急表达：图标+颜色+脉冲，不单靠颜色 |

- 激活与解除按 `remaining` 单调判定，**无迟滞回差**（边界抖动由显示取整吸收，见 §6）。

### 2.3 PAUSED 冻结语义

- `game:paused` → 计时器保存剩余 dt 累计值，停止累计；`game:resumed` → 从保存值继续。
- 冻结范围**仅计时与 S4 供料**；表现层（脉冲动画帧）不冻结，但 PAUSED 中倒计时胶囊被面板遮挡，不产生误导。

### 2.4 整关重置清单（来源 §3.5 末行，S1 调度、各系统执行）

失败重试 / 暂停重玩 / 换关时按序执行（**续时成功不走本清单**）：
1. 倒计时回满（`remaining = LEVEL_TIME`，告急态解除）；
2. **恢复初始错位布置**（v1.3 改写，原「图案清空：S3 全部 `filled` → `empty`」**作废**）：S3 全格回到关卡 JSON 声明的初始态——错位珠与就位珠**逐格复位**到 `swaps` 装配结果（`systems-index §3.5` / §3.13；新玩法下棋盘开局全满，「清空后玩家重填」不复存在）。**供料累加器重置**随供料关停失去意义，字段保留（供料复活时恢复生效，§3.11 续打保留条款同步适用）；
3. 托盘清空（S4 全槽 `free`，选中清除）；
4. 扩展重置（S4 回基线容量，扩展需重新解锁）；
5. 道具免费次数重置（S6 回 `POWERUP_FREE_USES`）；
6. 续时记账清零（`reviveBonusSec=0`、`revived=false`；来源 §3.11）。

### 2.5 失败续时（普通模式，来源 §3.11）

- **失败唯一条件仍是归零**（§2.1 / D7）。续时不是新的失败条件，只是 GAME_OVER 上的一条**可选挽回**。
- 仅 `mode: 'normal'`。冲刺归零不进本分支，走冲刺结算。
- 记账（S5 持有，与 `remaining` 同真源）：`reviveBonusSec`（秒，累加）、`revived`（布尔）。进关 / §2.4 重置后均为 0 / false。
- 次数门：本尝试已成功次数 ≥ `REVIVE_MAX_PER_LEVEL` → 失败面板不渲染续时主钮，只留重试。
- 玩家在 GAME_OVER **主动**点「看视频 +`REVIVE_BONUS_SEC` 秒继续本关」→ 激励视频（实现另排；未接 SDK 时零 `wx` 调用、零加时）。
  - `onRewarded`（看完）：`remaining += REVIVE_BONUS_SEC`（从 0 起则 `= REVIVE_BONUS_SEC`）；`reviveBonusSec += REVIVE_BONUS_SEC`；`revived=true`；**不走 §2.4**；S1 `GAME_OVER → PLAYING`（同一次尝试：网格 / 托盘 / 扩展 / 道具次数 / 供料累加器全部保留）。
  - 中途关 / 加载失败 / `onError` / 未看完：**零加时**，留在 GAME_OVER。
- HUD 显示 `remaining`（可玩钟，含续时）。星级分子 `starRemaining = max(0, remaining − reviveBonusSec)` 归 S7（§3.7），本系统不画第二条钟。
- 加时通道唯一：S6 道具永不写 `remaining`（powerups §2.3）。

## 3. 输入

| 来源 | 内容 |
|---|---|
| S1 | 状态切换（PLAYING 进入即启动；离开即停表）、整关重置指令、**续时成功指令**（GAME_OVER → PLAYING，不重置） |
| S9 | `game:paused` / `game:resumed` |
| 关卡数据 | `LEVEL_TIME` 覆盖值（BOOT 期已完成区间校验） |
| 失败面板（经 S2） | 「续时」主钮 / 「重试本关」次钮；冲刺态不路由续时 |

## 4. 输出与反馈

| 事件/表现 | 条件 | 对齐 |
|---|---|---|
| `timer:tick {remaining}` | PLAYING 中每 `TIMER_TICK` | HUD 数字刷新 |
| `timer:urgent {remaining}` | `remaining` 降穿 `TIMER_URGENT_T` | 告急双通道启动 |
| 失败信号 → S1 `level:failed {levelId}` | `remaining` 钳 0 | 唯一失败条件（决策 D7） |
| HUD 显示 | mm:ss，取整；用 `remaining`（含续时） | `hud_timer_capsule`（assets-spec §1.5）；星级不用此值（§3.7） |

## 5. 数值

全部引用 `systems-index §3.5` 与 **§3.11**：`LEVEL_TIME_DEFAULT`（[180, 420]）、`TIMER_URGENT_T`、`TIMER_TICK`、失败唯一条件、整关重置（含续时记账清零）、`REVIVE_BONUS_SEC`、`REVIVE_MAX_PER_LEVEL`、冲刺不续时；星级口径引 §3.7；告急表现参数引 assets-spec §1.5。

## 6. 边界条件

**极端值**
- `LEVEL_TIME` 覆盖值越界（<180 或 >420）：BOOT 期校验拒绝该关（归关卡校验器，S5 防御性钳到最近合法端点并记警告）。
- 归零瞬间恰好填满最后格：S1 按 **cleared 优先**裁决（core-loop §6）；S5 收到状态已切 LEVEL_CLEAR 后丢弃失败信号。
- 剩余 0.4s 时暂停：恢复后从 0.4s 继续，显示仍为 00:00 但未判负（取整显示与内部精度的合法错位，仅存在于 <1s 区间）。

**并发 / 竞态**
- 暂停请求与归零：判定基准为**帧内序 = 输入 → 连击窗 → 供料 → 计时**（**规范定义 `core-loop §2.2.2`**，WXG-T-061 归口；原出自 `pause-settings.md` §6，2026-09-12 裁定，WXG-T-030 实现确认），齿轮属输入、先于计时处理 ——
  - **同帧**（归零与暂停请求同帧到达）→ **同帧暂停优先**：暂停生效、本帧 dt 不再累计、归零不触发；
  - **跨帧**（此前帧已借归零切进 GAME_OVER）→ **无暂停**：非 PLAYING 入口走门禁忽略（pause-settings §6「非法输入」第一条）。
  - 注：「事件到达序」在单线程固定步长循环内**不可观测**（一帧内没有先后事件，只有代码执行序），本条原表述「先结算归零再暂停」作废。
- `timer:urgent` 与 `tray:full` 告警同帧叠加：两个视觉告警频率各自独立且均 ≤3Hz 红线；S5 不合并、不去重他人事件。
- 恢复（resumed）瞬间与归零同帧：恢复先应用保存的 dt，再判定是否穿 0。

**非法输入**
- 未进 PLAYING 收到启动指令：忽略。
- 重复 `game:paused`（已暂停再暂停）：幂等，不重置保存值。
- `remaining` 被外部写为负数：钳 0 并走失败流程。
- GAME_OVER 下未看完视频 / 加载失败：`remaining` 保持 0，`reviveBonusSec` 不变，不离开 GAME_OVER。
- 已 `revived` 再点续时：忽略（面板应已无主钮）；不得把 `remaining` 再加一次。
- 冲刺 `mode: 'sprint'` 归零：不接受续时指令。
- 续时成功后 `remaining = REVIVE_BONUS_SEC`（> `TIMER_URGENT_T`）→ 告急解除；再降穿再告急。

## 7. 依赖

- **上游**：S1（状态机启停/重置/续时成功指令）、S9（暂停/恢复）、关卡数据（LEVEL_TIME）、失败面板输入（经 S2）。
- **下游**：S1（失败信号触发 GAME_OVER；续时成功切回 PLAYING）、S7（`level:cleared` 所需 remaining / `starRemaining` / `revived`，由 S1 转交）、HUD/视觉/音频（tick/urgent 消费）。
- **明确边界**：S6 永不写 `remaining`；续时不是道具。框架未接广告 API 前，续时钮不得调用任何 `wx` 广告接口（零加时轻提示）。

## 8. 验收标准（可测试硬判据，QA 直接造用例）

1. 默认关卡进 PLAYING 后 `remaining` 从 `LEVEL_TIME_DEFAULT` 递减；60 秒实测误差 ≤ ±0.5s（dt 累计 vs 墙钟）。
2. `timer:tick` 每 1.0s 恰广播 1 次，payload remaining 与 HUD 显示一致（取整规则 mm:ss）。
3. `remaining` 降穿 `TIMER_URGENT_T` 瞬间：`timer:urgent` 恰广播 1 次，HUD 切 danger + 脉冲；用 `LEVEL_TIME=180` 关卡快进验证。
4. 归零 → S1 切 GAME_OVER 且 `level:failed` 恰 1 次；同帧填满最后格的构造用例中**仅** `level:cleared` 发生（cleared 优先）。
5. PAUSED 300 秒后恢复：remaining 与暂停前一致（误差 ≤1 帧 dt）；期间 `timer:tick` 计数 =0。
6. **改写（v1.3）**：失败重试后重置逐一断言：倒计时回满 / **恢复初始错位布置**（每格 colorIdx 与 `swaps` 装配态逐一相等、`misplaced` 计数 === 2 × `swaps.length`，非「全空」——QA 不得按旧文把「格未清空」判成缺陷）/ 托盘全空 / 扩展回基线 / 道具免费次数回 `POWERUP_FREE_USES` / `reviveBonusSec=0` 且 `revived=false`。
7. `LEVEL_TIME=181` 与 `=419` 关卡正常运行；`=100` 与 `=999` 的关卡被 BOOT 校验拒绝，不进入 PLAYING。
8. 剩余 0.4s 暂停再恢复：不判负、从 0.4s 继续；自然流到 0 才判负。
9. 已暂停状态下重复发 `game:paused`：保存值不被覆盖（remaining 恢复后仍正确）。
10. 告急脉冲周期实测 1000ms ±50ms，频率 ≤3Hz；与托盘满槽告警同屏叠加时无 >3Hz 闪烁（§3.8 红线）。
11. **续时同局续打** `[Node]`：构造普通关 GAME_OVER（格已填若干、托盘非空）→ 注入 `onRewarded` → `remaining = REVIVE_BONUS_SEC`、`reviveBonusSec = REVIVE_BONUS_SEC`、`revived=true`、S1 为 PLAYING；网格 filled 计数与托盘槽态与失败前逐一相等（不走 §2.4）。
12. **次数上限与未看完** `[Node]`：同尝试第二次续时指令被忽略、`remaining` 不增加；未看完 / 错误回调 → `remaining` 仍为 0、停在 GAME_OVER。冲刺归零注入续时指令 → 零加时。

---

## 9. 变更记录

| 版本 | 日期 | 变更 | 依据 |
|---|---|---|---|
| v1.0 | WXG-T-009 交付 | 初版八节定稿：计时模型 / 告急双通道 / PAUSED 冻结语义 / 整关重置五项 / 边界 / 十条判据 | WXG-T-009 |
| v1.1 | 2026-09-12 | §6「暂停请求与归零」判定基准改写：**帧内序 = 输入 → 连击窗 → 供料 → 计时**（齿轮属输入、先于计时）——**同帧** → 同帧暂停优先（暂停生效、本帧 dt 不累计、归零不触发）；**跨帧**（此前帧已借归零进 GAME_OVER）→ 无暂停。原「先结算归零再暂停」作废。**零数值变更、§8 判据未动** | WXG-T-030 实现确认（帧内序）+ WXG-T-031 主理人裁定（单线程固定步长下"事件到达序"不可观测） |
| v1.2 | 2026-09-14 | 增 §2.5 失败续时：GAME_OVER 可经 `onRewarded` 回 PLAYING（同局续打、不走整关重置）；重置清单第 6 项续时记账清零；§8 增判据 11–12。失败唯一条件仍=归零。常量只引用 §3.11，本篇不抄写秒数。spec_only，无 src | WXG-T-057，用户 2026-09-14 拍板 T-B |
| v1.3 | 2026-09-16 | **重置清单第 2 项改「恢复初始错位布置」**（WXG-T-130 第二批，用户 2026-09-16 裁定「错位归位」核心循环 + 倒计时失败不变）：原「图案清空（S3 全部 `filled` → `empty`）」**作废**——新玩法棋盘开局全满（错位装配），重试 = S3 逐格复位到 `swaps` 装配态（§3.5/§3.13）。§8-6 同步改写（附 QA 不得按旧文判缺陷注记）。失败条件、续时语义、其余判据**零改动** | WXG-T-130，用户 2026-09-16 四项裁定 |
