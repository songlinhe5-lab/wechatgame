# 《拼豆填色消除》(beads) 冒烟测试清单 · Smoke Test Suite

- 任务号：WXG-T-011 ｜ 作者：严守真 ｜ 版本 v1.0 ｜ 日期 2026-09-11
- 判据来源：`games/beads/design/gdd/*.md` §8、`systems-index §3`、`concept.md §7`（MVP 验收线）

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

> **本轮可执行口径**：13 条中 11 条的判定逻辑可由 vitest 覆盖（实现落地后）；SC-11/SC-13 及各条的画面断言需 Cocos 编辑器/真机。
