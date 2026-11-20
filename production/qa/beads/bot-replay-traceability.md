# EP15 · 机器人 / 回放验收追溯（`gdd/bot-replay.md §8-1…§8-14`）

> 判据正文只引用这 **14 条**（⛔ 新造第 15 条）。级别口径：
> **自动** = 可在 Node/CI 机械复现（`npx vitest run …`）；**DEFERRED** = 需真机 / 编辑器 / 未建 UI 入口，⛔ 记 PASS。
> 金样本来源：`games/beads/design/levels/singles/*.json` 的 `pricing`（S1 抽取前的现网金样本）。

| # | 判据 | 证据（测试文件 → 用例） | 级别 |
|---|---|---|---|
| §8-1 | 金样本逐字一致 | `tests/bot-policy.test.ts`「11 张 single 关 pricing.actions 逐字一致」 | 自动 |
| §8-2 | 无头确定性 N=3 + `bot/**` 零随机 | `tests/bot-policy.test.ts`「N=3 确定性」；`tests/bot-driver.test.ts`「同 seed 两局托管动作数/终局/星级一致」；`tests/replay-facility.test.ts`「§21 架构门 · replay/** 不手搓随机」 | 自动 |
| §8-3 | 回放终局一致（含续时局） | `tests/replay-facility.test.ts`「经典局：影子终局 = 录制终局（格色逐格 / 托盘逐槽 / 时间 / 动作）」；`tests/bot-driver.test.ts`「失败 → 广告续时 → 托管过关：录像带 `revive` 事件，影子重演终局逐字段一致」（remaining 按 ±1 步量化容差，见 `player.ts::_checkFinal`） | 自动 |
| §8-4 | seek 3 目标 + 暂停/倍速不改变终局 | `tests/replay-facility.test.ts`「seek(0/1/3) 后播完」「暂停 / 4x 倍速切换后终局逐字段一致」 | 自动 |
| §8-5 | 计星/存档矩阵（演示/回放零写；托管同手动） | `tests/replay-facility.test.ts`「重演期间真实 storage 零写入」；`tests/bot-driver.test.ts`「托管过关正常计星/解锁」；`tests/replay-page.test.ts`「演示进入 + 播完：真实 meta 四腿零调用（`addCoins`/`addStamina`/`grantClearCoins`/`spendStamina`）、金币/体力不变、影子用私有 storage + 未注入 `onClearCoins`」 | 自动 |
| §8-6 | 入口唯一性（仅 `LEVEL_CLEAR`） | `tests/replay-page.test.ts`「独立 160×96 小钮：有录像可点、无录像零响应」；「逐相位入口矩阵：ClearPanel 显隐归命中腿 / GAME_OVER・冲刺・FINISH 零视频回放入口（FINISH `replay` = 重玩关卡）」；「play 相位点回放坐标零动作」 | 自动 |
| §8-7 | 回放页零玩法输入（公开命令调用数 0） | `tests/replay-page.test.ts`「棋盘区 = 零响应」「无录像 tapReplay = false」；「回放页点棋盘 / 托盘 / 道具位：影子六条公开命令 spy 调用数恒 0」 | 自动 |
| §8-8 | 溢出降级（`truncated` 整份作废） | `tests/replay-facility.test.ts`「事件数超限 ⇒ truncated=true、整份作废、不崩」 | 自动 |
| §8-9 | 退出回源（回结算无二次结算；演示回菜单） | `tests/replay-page.test.ts`「托管过关→回放→…→退出回结算（相位不变、星级/豆未动）」；「主菜单『看演示』→ `bot-demo` 回放页 → 退出回菜单（不占上一局槽、不扣心、零 `meta:overlay`）」；「无可用演示 ⇒ 零事件留菜单」 | 自动 |
| §8-10 | 托管卡死/接管/轻提示/齿轮 | `tests/bot-driver.test.ts`「stuck」「exhausted」「玩家点棋盘 ⇒ 取消托管且零玩法事件（含『已接管』轻提示 + ≤400ms 自动清）」「停机 ⇒ 自动暂停 + 『托管已停止』（2s 自动清）」「壳层驱动报 stuck ⇒ 托管关、自动暂停、轻提示上屏」；`tests/pause-settings.test.ts` 齿轮暂停全链 | 自动 |
| §8-11 | 托管结算同手动 / 失败走正常 GAME_OVER | `tests/bot-driver.test.ts`「托管过关正常计星/解锁」；「失败 → 广告续时 → 托管过关」（真实 GAME_OVER + 广告发奖腿） | 自动 |
| §8-12 | 数据防呆（指纹/seed/步序/参数） | `tests/replay-facility.test.ts`「数据防呆」8 类非法数据 + 关表缺失 | 自动 |
| §8-13 | 架构门（`bot/**`、`replay/**` 无 cc/DOM/wx；UI 不 import 策略） | `tests/bot-policy.test.ts` 架构门；`tests/replay-facility.test.ts` 架构门；`check:arch` §21-a…d + `--selftest`（31/31）；L3 扫描 | 自动 |
| §8-14 | 内存与生命周期（重启无残留 / 下一局替换 / demo 释放） | `tests/replay-facility.test.ts`「第二次过关替换上一局」「discard 清空」；`tests/bot-driver.test.ts` 演示预计算 dispose；`tests/replay-page.test.ts`「会话 1 进回放页 → dispose → 同存档冷启新壳：无录像 / 无回放态 / 可正常开局」 | 自动（替换/释放/Node 冷启）；真机进程冷启体感并入 playtest P8 |

## 回放页静态文案核对（ux §3.2 / §3.3，WXG-T-995）

> 纯核查：逐条比对规格原文与实现（`view/replay-page.ts`），**本单不改视觉**。判定 = PASS（逐字同）/ CONCERNS（有偏差，待 art/UX 拍板）。

| # | 位置 | 规格原文 | 实现 | 判定 |
|---|---|---|---|---|
| C1 | 标题 | 「回放 · 第 N 关」，40px ExtraBold | `回放 · 第 ${level.id} 关`；`UI_FONT.panelTitle` = bold 40 | PASS |
| C2 | 副标来源 | 「我的上一局 / 机器人演示」 | 同串（`source==='bot-demo'` ⇒ 机器人演示） | PASS |
| C3 | 状态词 | 「▶ 回放中 / ⏸ 已暂停 / 已结束」 | 同串（含 ▶ / ⏸ 前缀；priority = ended > playing > paused） | PASS |
| C4 | 退出钮 | 「←退出」 | 「←退出」（28px 文字腿） | **PASS**（WXG-T-996 已修；独立图标资产未做，箭头随字） |
| C5 | 播放/暂停钮 | 图标随状态切换（▶ / ⏸；播完 = 重播） | 程序化图标：播放中 = 双竖条（⏸）/ 暂停・播完 = 三角（▶） | **PASS**（WXG-T-996 已修） |
| C6 | 时间标签 | `已播 / 总长`（如 `00:12 / 01:45`） | `formatTime(floor(atMs/1000)) / formatTime(floor(durationMs/1000))` | PASS |
| C7 | 倍速钮 | `1x / 2x / 4x` 循环，文案即状态 | `${speed}x` | PASS |
| C8 | 结束条标题 | own-last「回放结束」/ bot-demo「演示结束」 | 同串（三元分支） | PASS |
| C9 | 结束条主钮 | own-last「重播」/ bot-demo「再看一遍」 | 同串 | PASS |
| C10 | 结束条次钮 | 「退出」 | 同串 | PASS |
| C11 | 演示结束条副文案 | 「机器人完成了第 1 关」 | `机器人完成了第 ${关号} 关`（(375,590)，28px） | **PASS**（WXG-T-996 已修） |
| C12 | seek 静态提示 | 「定位中…」（`REPLAY_SEEK_HINT_MS` 已定档 250ms） | seek 后 250ms 内以提示替换时间标签 | **PASS**（WXG-T-996；阈值待真机回填） |
| C13 | 副标 / 时间标签字号 | ~~24px~~ ⇒ v1.2 改 **28px**（E1 地板） | `UI_FONT.hudSmall` = 28 | **PASS**（WXG-T-996；规格同步 v1.2） |
| C14 | 不显示元素 | 星级 / 豆 / 心 / 齿轮 / 道具卡 | 上下覆盖带（`REPLAY_COVER_TOP/BOTTOM`） | PASS（机制核对） |
| C15 | 页面动效 | 进入淡入 + 上移 12px 200ms / 退出淡出 + 下移 150ms | 壳层 `_replayFx`（200/150 + 12px）；`reduceMotion` 整段关停 | **PASS**（WXG-T-996 已修；棋盘为复用整页层不位移） |

**汇总（WXG-T-996 后）**：15 项 **PASS 15**（C4/C5/C11/C12/C13/C15 已修；C13 按 E1 地板 28 落码并同步规格 v1.2）。后续真机项：C12 阈值回填、C15 动效体感，并入 playtest。

## 真机 / UI 遗留（⛔ 记 PASS）

- §8-10 轻提示的**真机体感**（400ms / 2s 停留是否可读）并入下方 playtest P6。
- 体感/内存/seek 停顿：需 playtest（`BOT_STEP_INTERVAL_MS=450` 亦在此定档）。

## 真机 playtest 清单（状态 **DEFERRED**）

> **阻塞**：本仓无真机 / 无正式 AppID 与上传密钥 ⇒ 无法在微信开发者工具真机预览或提审包上实测。
> **解除条件**：具备 AppID + 真机（iOS / Android 各一台）后，按本清单执行并在回填列记录机型号与版本号；通过前 ⛔ 记 PASS。

| # | 步骤 | 观测指标 | 通过口径 |
|---|---|---|---|
| P1 | 主菜单点「看演示」→ 回放页自动播放 → 播完 → 退出 | 首帧出现时延；`BOT_STEP_INTERVAL_MS=450` 的演示节奏体感；退出回菜单无闪烁 | 首帧 ≤ 1s（演示预计算含跑完整局，允许首次 2s 内）；节奏可读不拖沓；退出无黑帧 / 无残留遮罩 |
| P2 | 回放页拖动进度条（含 50% / 90% / 末端） | seek 停顿（从头重演）时长；画面跳变 | 松手后 ≤ 300ms 出目标帧；无中途闪回起点以外的旧帧 |
| P3 | 回放页连点倍速（1x→2x→4x）、暂停/恢复 | 时钟推进与暂停冻结 | 暂停后画面完全冻结；倍速切换无时间跳变 |
| P4 | 播放 → 播完结束条 →「重播」/「退出」 | 结束条双钮命中与文案 | 双钮各 88+ 高可点；「重播」从 0 重演、不退出回放页 |
| P5 | 结算面板（ClearPanel）有录像 / 无录像两态 | 回放钮显隐、命中 | 有录像显示且可进；无录像不显示、原双钮布局不位移 |
| P6 | 托管打一局（暂停面板开托管）→ 过关 → 结算；托管中点棋盘/托盘/道具卡 | 托管徽标、接管（点棋盘）取消托管、卡死自动停；轻提示可读性 | 徽标只在 PLAYING 显示；接管即取消且零玩法事件；卡死停托管并给轻提示；「已接管」≤400ms 可辨、「托管已停止」2s 内可读 |
| P7 | 全程监控内存 | 演示预计算峰值、回放页稳态、退出后回落 | 演示峰值 ≤ 平台档预算（见包体内存基线）；退出回放后内存回落到进入前 ±5% 内 |
| P8 | 冷启动 | 上次回放 / 演示痕迹 | 冷启后无回放页残留、无「上一局」录像、菜单可正常开局 |

