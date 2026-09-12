# 《拼豆填色消除》(beads) 冒烟测试清单 · Smoke Test Suite

- 任务号：WXG-T-011 / WXG-T-028 ｜ 作者：严守真 ｜ 版本 v1.1 ｜ 日期 2026-09-12
- 判据来源：`games/beads/design/gdd/*.md` §8、`systems-index §3`、`concept.md §7`（MVP 验收线）；v1.1 新增冲刺段：`score-combo.md §8` + `systems-index §3.10` + `ux-spec §5`（动效毫秒）

**图例**：`[Node]` vitest 可覆盖（本轮环境具备）｜ `[DevTools]` 微信开发者工具（**待 Cocos 编辑器**，场景装配/渲染类）｜ `[Device]` 真机。

> beads 实现 0 行 → 本清单全部为"**就绪待执行**"。`[Node]` 条目实现落地即可自动化；`[DevTools]/[Device]` 条目需编辑器与真机。任一步 FAIL 即停并开 Bug。

## 冒烟主链路

### SC-01 冷启动（首次，无存档）`[Node]`（分流逻辑）/ `[DevTools]`（画面）
- **步骤**：清存档启动。
- **预期**：直接进**第 1 关 PLAYING**，无主菜单（`core-loop §2.1`）；HUD 带（左设置齿轮/中倒计时胶囊/右胶囊避让）、拼图区、托盘 12 槽、道具栏 3 卡就位（`§3.1` 布局带）。
- **判定**：无菜单、无白屏、布局四带不重叠。

### SC-02 供料心跳 `[Node]`
- **预期**：默认间隔下每 4.0s ±0.1s 入 1 颗随机空闲槽，`tray:spawned` 逐次广播（`tray-spawner §2.2/§8.1`）。

### SC-03 选珠 → 落子 → 拒绝（微循环闭环）`[Node]` / `[DevTools]`（动画）
- **步骤**：点托盘珠（选中）→ 点匹配空格 → 再点不匹配空格。
- **预期**：匹配→珠离槽、格 `filled`、`bead:placed` 恰 1 次；不匹配→珠留槽、格 `empty`、`bead:rejected` 恰 1 次（抖动+描边闪 ≤2 次/秒）（`core-loop §2.2`、`bead-grid §2.3`）。

### SC-04 暂停冻结（计时 + 供料）`[Node]` / `[DevTools]`（面板）
- **预期**：PAUSED 期间 remaining 不变、零供料（`core-loop §8.7`、`tray-spawner §8.8`）；面板含「继续/重玩本关/音量开关」；玩法区点击全忽略（`input-control §2.3`）。
- **判定**：恢复后从暂停值继续，无 3-2-1（沿用 breakout 低摩擦判例）。

### SC-05 满槽 → 清槽恢复 `[Node]`
- **预期**：12 槽满→跳过供料 + `tray:full` 恰 1 次，**不判负**（D7）；用"区域消除"清 6 槽后 ≤1 间隔恢复供料（`core-loop §8.3`、`tray-spawner §8.4`）。

### SC-06 道具三种 + 扩展占位 `[Node]` / `[DevTools]`（角标）
- **预期**：region 清连续 6 槽 / clearAll 清全槽 / random 清 5 颗，均仅作用托盘、`powerup:used.affectedSlots` 一致；每道具免费 1 次，第二次点击出现激励视频**角标占位**且**不误拉起**（`§3.6`、AD `[待用户确认]`）。

### SC-07 扩展行 `[Node]`
- **预期**：解锁后 12+12 槽；重开/换关重置为未扩展（A1）；满槽期间解锁不补发跳过的供料（`tray-spawner §6`）。

### SC-08 过关 LEVEL_CLEAR `[Node]` / `[DevTools]`（庆祝表现）
- **预期**：最后一格填满瞬间 → LEVEL_CLEAR（即使剩余 0.01s，cleared 优先）；下一关 1.2s 级自动或点击进入（`core-loop §2.1`）；波浪庆祝 ≤3Hz（`§3.8`）。

### SC-09 通关 FINISH `[Node]`
- **预期**：第 8 关通过 → FINISH 通关画面；「重玩第 1 关」→ 整关重置回第 1 关（`core-loop §8.8`）。

### SC-10 倒计时归零 GAME_OVER + 整关重置 `[Node]`
- **预期**：归零未满图 → GAME_OVER（温和提示，不红闪不屏震）；重试后**五项重置**逐一生效（`timer-gameover §2.4/§8.6`）。

### SC-11 杀进程重启续进 `[Device]`
- **预期**：L3 进行中杀进程 → 重启直接续进已解锁最远关，无菜单（`core-loop §8.1`、S8 判例沿用 breakout）。

### SC-12 存档降级 `[Node]`
- **预期**：`unlockedLevel=99`/stars 非法/损坏 JSON → 降级进第 1 关，不崩溃、不中断（`core-loop §8.10`）；存档键名归代码（`wxgame.beads.*`，`systems-index §3` 刻意例外）。

### SC-13 后台切换 `[Device]`
- **预期**：`onHide` 自动暂停，`onShow` 停留 PAUSED 不自动继续（F1 冻结补偿，沿用 breakout 判例）。

## 冲刺模式冒烟段（v1.1 新增，WXG-T-028）

### SC-SP-01 冲刺单局最短通关链路 `[Node]`（逻辑断言归 TC-SPRINT-01..11）/ `[Harness]`（人工操作）/ `[DevTools]`（帧检/特效）

**前置**：清存档或预置已通关 1 关；DevTools 可用注入面板控制 `mode` 与计时。

**步骤（[Harness] 操作 → 预期观察点）**：
1. **进 sprint**：完成 L1 → LEVEL_CLEAR 面板点「去冲刺」（`ux-spec §4` U1 入口）→ 起局。
   - 观察：倒计时自 **120s** 起跳（`systems-index §3.10` `SPRINT_TIME_DEFAULT`）；HUD 出现 分数+倍率+连击数（`score-combo §2.1`）；stage 1 图案已装载；倍率角标此刻**不显示**（streak<2 零噪声，`score-combo §4`）。
2. **起连击升档**：连续正确落子 2 次 → 倍率 ×2 角标出现 + Lv1 星光粒子（ux-spec §5 200ms）；streak=4 → ×3 伪震屏（scale 1.00→1.015→1.00 / 150ms）；streak=7 → ×5 全屏爆发（350ms）。
   - 观察：每档切换恰 1 次；HUD 分数增量 = **10 × 当前倍率**（`§3.10` C4）。
3. **stage 切换不断连**：保持 ×3+ 连击填满 stage 1 图案。
   - 观察：立即换 stage 2、**不弹结算窗**（`score-combo §2.3`）；连击数/倍率不变（C8：stage 切换不断连）；倒计时 **+15s**（`§3.10` C5）；分数跳增 **200**（200+50×0）。
4. **故意超窗断连**：×3 档下停手 >**5.0s**（`§3.10` `COMBO_WINDOW_S`）。
   - 观察：倍率角标灰缩消失（150ms）、streak 清零回 ×1；分数**不清零不扣分**（`score-combo §2.4`）。
5. **单局结束 + 破纪录判定**：等倒计时归零（或 DevTools 快进）。
   - 观察：进结算 → 显示 单局分 + 最佳梯位 + `sprint:ended{score, bestStage, settleScore}` 广播（`systems-index §4`）；本次分 > S8 存档最佳 → **NEW BEST** 角标且存档写入；随后再开一局故意低分 → 无 NEW BEST、存档值不变（`score-combo §8.11`）。

**判定**：任一观察点 FAIL 即停、按复现步骤开 Bug（严重度参照 qa 计划分级）。逻辑层断言（事件恰次/公式复算/同帧裁决）由 §C 用例 `[Node]` 自动化，本段为人工链路验收。

## 冒烟汇总表

| ID | 链路 | 环境 | 本轮 |
|---|---|---|---|
| SC-01 | 冷启动无菜单 | Node 分流 + DevTools 画面 | 就绪待执行 |
| SC-02 | 供料心跳 | Node | 就绪待执行 |
| SC-03 | 选珠→落子→拒绝 | Node + DevTools | 就绪待执行 |
| SC-04 | 暂停冻结 | Node + DevTools | 就绪待执行 |
| SC-05 | 满槽→清槽恢复 | Node | 就绪待执行 |
| SC-06 | 道具×3 + 扩展占位 | Node + DevTools | 就绪待执行 |
| SC-07 | 扩展行重置 | Node | 就绪待执行 |
| SC-08 | 过关 | Node + DevTools | 就绪待执行 |
| SC-09 | FINISH | Node | 就绪待执行 |
| SC-10 | 归零 + 五项重置 | Node | 就绪待执行 |
| SC-11 | 杀进程续进 | Device | DEFERRED |
| SC-12 | 存档降级 | Node | 就绪待执行 |
| SC-13 | 后台切换 | Device | DEFERRED |
| SC-SP-01 | 冲刺单局全链路（进局→升档→跨 stage→断连→结算/破纪录） | Node + Harness + DevTools | 就绪待执行 |

> **本轮可执行口径**：14 条中 12 条的判定逻辑可由 vitest 覆盖（实现落地后）；SC-11/SC-13 及各条的画面断言、SC-SP-01 的特效帧检需 Cocos 编辑器/真机。
