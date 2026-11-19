# EP15 · 机器人 / 回放验收追溯（`gdd/bot-replay.md §8-1…§8-14`）

> 判据正文只引用这 **14 条**（⛔ 新造第 15 条）。级别口径：
> **自动** = 可在 Node/CI 机械复现（`npx vitest run …`）；**DEFERRED** = 需真机 / 编辑器 / 未建 UI 入口，⛔ 记 PASS。
> 金样本来源：`games/beads/design/levels/singles/*.json` 的 `pricing`（S1 抽取前的现网金样本）。

| # | 判据 | 证据（测试文件 → 用例） | 级别 |
|---|---|---|---|
| §8-1 | 金样本逐字一致 | `tests/bot-policy.test.ts`「11 张 single 关 pricing.actions 逐字一致」 | 自动 |
| §8-2 | 无头确定性 N=3 + `bot/**` 零随机 | `tests/bot-policy.test.ts`「N=3 确定性」；`tests/bot-driver.test.ts`「同 seed 两局托管动作数/终局/星级一致」；`tests/replay-facility.test.ts`「§21 架构门 · replay/** 不手搓随机」 | 自动 |
| §8-3 | 回放终局一致（含续时局） | `tests/replay-facility.test.ts`「经典局：影子终局 = 录制终局（格色逐格 / 托盘逐槽 / 时间 / 动作）」 | 自动；续时局腿 **DEFERRED**（需先人工造续时录像，`revive` 注入逻辑已有 `tests/bot-driver` 外的单测覆盖于 recorder 防呆） |
| §8-4 | seek 3 目标 + 暂停/倍速不改变终局 | `tests/replay-facility.test.ts`「seek(0/1/3) 后播完」「暂停 / 4x 倍速切换后终局逐字段一致」 | 自动 |
| §8-5 | 计星/存档矩阵（演示/回放零写；托管同手动） | `tests/replay-facility.test.ts`「重演期间真实 storage 零写入」；`tests/bot-driver.test.ts`「托管过关正常计星/解锁」 | 自动（storage 腿）；钱包 / 体力 / 发豆 spy 腿 **DEFERRED**（需 harness 注入调用计数器） |
| §8-6 | 入口唯一性（仅 `LEVEL_CLEAR`） | `tests/replay-page.test.ts`「独立 160×96 小钮：有录像可点、无录像零响应」；`tests/clear-panel.test.ts` 双钮 + 回放钮 | 自动（ClearPanel 显隐）；`GAME_OVER`/冲刺/FINISH 逐相位命中矩阵 **DEFERRED** |
| §8-7 | 回放页零玩法输入（公开命令调用数 0） | `tests/replay-page.test.ts`「棋盘区 = 零响应」「无录像 tapReplay = false」 | 部分自动；公开命令 spy 腿 **DEFERRED** |
| §8-8 | 溢出降级（`truncated` 整份作废） | `tests/replay-facility.test.ts`「事件数超限 ⇒ truncated=true、整份作废、不崩」 | 自动 |
| §8-9 | 退出回源（回结算无二次结算；演示回菜单） | `tests/replay-page.test.ts`「托管过关→回放→…→退出回结算（相位不变、星级/豆未动）」 | 自动（结算腿）；主菜单演示入口 **DEFERRED**（S4 尾巴未接） |
| §8-10 | 托管卡死/接管/轻提示/齿轮 | `tests/bot-driver.test.ts`「stuck」「exhausted」「玩家点棋盘 ⇒ 取消托管且零玩法事件」；`tests/pause-settings.test.ts` 齿轮暂停全链 | 自动（卡死/接管）；轻提示 **DEFERRED**（未做） |
| §8-11 | 托管结算同手动 / 失败走正常 GAME_OVER | `tests/bot-driver.test.ts`「托管过关正常计星/解锁」 | 自动（通关腿）；托管失败+续时 **DEFERRED** |
| §8-12 | 数据防呆（指纹/seed/步序/参数） | `tests/replay-facility.test.ts`「数据防呆」8 类非法数据 + 关表缺失 | 自动 |
| §8-13 | 架构门（`bot/**`、`replay/**` 无 cc/DOM/wx；UI 不 import 策略） | `tests/bot-policy.test.ts` 架构门；`tests/replay-facility.test.ts` 架构门；`check:arch` §21-a…d + `--selftest`（31/31）；L3 扫描 | 自动 |
| §8-14 | 内存与生命周期（重启无残留 / 下一局替换 / demo 释放） | `tests/replay-facility.test.ts`「第二次过关替换上一局」「discard 清空」；`tests/bot-driver.test.ts` 演示预计算 dispose | 自动（替换/释放）；应用重启 **DEFERRED**（结构上仅内存，需真机冷启验证） |

## 真机 / UI 遗留（⛔ 记 PASS）

- §8-3 续时录像终局一致（需真实续时局录音）。
- §8-5 钱包/体力/发豆 spy 计数器。
- §8-6 逐相位入口矩阵、§8-7 公开命令 spy、§8-9 主菜单演示入口、§8-10 轻提示、§8-11 托管失败+续时。
- §8-14 冷启动无残留。
- 体感/内存/seek 停顿：需 playtest（`BOT_STEP_INTERVAL_MS=450` 亦在此定档）。
