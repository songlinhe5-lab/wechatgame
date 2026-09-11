# GDD · S5 倒计时与失败（Timer / GameOver）· beads

- 项目：`games/beads` · 版本 v1.0 · 任务号 WXG-T-009
- 数值纪律：只引用 `systems-index §3` 常量名（本篇主要 §3.5）。
- 依赖锚点：`core-loop.md` §2.1 状态机（PLAYING/GAME_OVER 转移）与 §6 同帧裁决（cleared 优先）。

---

## 1. 目标

提供关卡倒计时的唯一时间真源：驱动 HUD 显示与告急表现，归零时触发唯一失败条件，并定义整关重置的完整语义。

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

### 2.4 整关重置清单（来源 §3.5 末行，五项，S1 调度、各系统执行）

失败重试 / 暂停重玩 / 换关时按序执行：
1. 倒计时回满（`remaining = LEVEL_TIME`，告急态解除）；
2. 图案清空（S3 全部 `filled` → `empty`，`locked` 不动）；
3. 托盘清空（S4 全槽 `free`，选中清除）；
4. 扩展重置（S4 回基线容量，扩展需重新解锁）；
5. 道具免费次数重置（S6 回 `POWERUP_FREE_USES`）。

## 3. 输入

| 来源 | 内容 |
|---|---|
| S1 | 状态切换（PLAYING 进入即启动；离开即停表）、整关重置指令 |
| S9 | `game:paused` / `game:resumed` |
| 关卡数据 | `LEVEL_TIME` 覆盖值（BOOT 期已完成区间校验） |

## 4. 输出与反馈

| 事件/表现 | 条件 | 对齐 |
|---|---|---|
| `timer:tick {remaining}` | PLAYING 中每 `TIMER_TICK` | HUD 数字刷新 |
| `timer:urgent {remaining}` | `remaining` 降穿 `TIMER_URGENT_T` | 告急双通道启动 |
| 失败信号 → S1 `level:failed {levelId}` | `remaining` 钳 0 | 唯一失败条件（决策 D7） |
| HUD 显示 | mm:ss，取整 | `hud_timer_capsule`（assets-spec §1.5） |

## 5. 数值

全部引用 `systems-index §3.5`：`LEVEL_TIME_DEFAULT`（[180, 420]）、`TIMER_URGENT_T`、`TIMER_TICK`、失败唯一条件、重置五项；告急表现参数引 assets-spec §1.5。

## 6. 边界条件

**极端值**
- `LEVEL_TIME` 覆盖值越界（<180 或 >420）：BOOT 期校验拒绝该关（归关卡校验器，S5 防御性钳到最近合法端点并记警告）。
- 归零瞬间恰好填满最后格：S1 按 **cleared 优先**裁决（core-loop §6）；S5 收到状态已切 LEVEL_CLEAR 后丢弃失败信号。
- 剩余 0.4s 时暂停：恢复后从 0.4s 继续，显示仍为 00:00 但未判负（取整显示与内部精度的合法错位，仅存在于 <1s 区间）。

**并发 / 竞态**
- 暂停请求与归零同帧：**先结算归零再暂停**——若 dt 累计已穿 0，失败生效，暂停请求转为无效（GAME_OVER 面板顶替）。
- `timer:urgent` 与 `tray:full` 告警同帧叠加：两个视觉告警频率各自独立且均 ≤3Hz 红线；S5 不合并、不去重他人事件。
- 恢复（resumed）瞬间与归零同帧：恢复先应用保存的 dt，再判定是否穿 0。

**非法输入**
- 未进 PLAYING 收到启动指令：忽略。
- 重复 `game:paused`（已暂停再暂停）：幂等，不重置保存值。
- `remaining` 被外部写为负数：钳 0 并走失败流程。

## 7. 依赖

- **上游**：S1（状态机启停/重置）、S9（暂停/恢复）、关卡数据（LEVEL_TIME）。
- **下游**：S1（失败信号触发 GAME_OVER）、S7（`level:cleared` 所需 remaining/ratio，由 S1 转交）、HUD/视觉/音频（tick/urgent 消费）。

## 8. 验收标准（可测试硬判据，QA 直接造用例）

1. 默认关卡进 PLAYING 后 `remaining` 从 `LEVEL_TIME_DEFAULT` 递减；60 秒实测误差 ≤ ±0.5s（dt 累计 vs 墙钟）。
2. `timer:tick` 每 1.0s 恰广播 1 次，payload remaining 与 HUD 显示一致（取整规则 mm:ss）。
3. `remaining` 降穿 `TIMER_URGENT_T` 瞬间：`timer:urgent` 恰广播 1 次，HUD 切 danger + 脉冲；用 `LEVEL_TIME=180` 关卡快进验证。
4. 归零 → S1 切 GAME_OVER 且 `level:failed` 恰 1 次；同帧填满最后格的构造用例中**仅** `level:cleared` 发生（cleared 优先）。
5. PAUSED 300 秒后恢复：remaining 与暂停前一致（误差 ≤1 帧 dt）；期间 `timer:tick` 计数 =0。
6. 失败重试后五项重置逐一断言：倒计时回满 / 图案全空（locked 保持）/ 托盘全空 / 扩展回基线 / 道具免费次数回 `POWERUP_FREE_USES`。
7. `LEVEL_TIME=181` 与 `=419` 关卡正常运行；`=100` 与 `=999` 的关卡被 BOOT 校验拒绝，不进入 PLAYING。
8. 剩余 0.4s 暂停再恢复：不判负、从 0.4s 继续；自然流到 0 才判负。
9. 已暂停状态下重复发 `game:paused`：保存值不被覆盖（remaining 恢复后仍正确）。
10. 告急脉冲周期实测 1000ms ±50ms，频率 ≤3Hz；与托盘满槽告警同屏叠加时无 >3Hz 闪烁（§3.8 红线）。
