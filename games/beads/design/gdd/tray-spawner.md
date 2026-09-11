# GDD · S4 供料与槽位托盘（Tray Spawner）· beads

- 项目：`games/beads` · 版本 v1.0 · 任务号 WXG-T-009
- 数值纪律：只引用 `systems-index §3` 常量名（本篇主要 §3.4，颜色加权 §3.2）。
- 依赖锚点：`core-loop.md` §2.2 第 1/2 步（供料心跳与选珠）。

---

## 1. 目标

按节律向有限槽位持续供料，制造"空间压力"；管理 12+12 槽的占用、选中与扩展，并 向 S3/S7 提供珠子持有与颜色的唯一事实。

## 2. 机制

### 2.1 托盘模型

- 槽位数组，容量 = `TRAY_BASE_SLOTS`（1 行实线）；扩展后 +`TRAY_EXPAND_SLOTS`（1 行虚线）。
- 每槽 ∈ `free | holding(colorIdx) | selected`；`selected` 至多 1 槽（换选即转移，不叠选）。
- 绘制参数：`tray_panel/tray_slot/tray_slot_dashed/btn_expand` 见 `art/assets-spec.md` §1.3；`selected` 态视觉见 §1.2。

### 2.2 供料节律（PLAYING 驱动）

1. S5/S1 心跳累计 dt ≥ 当前 `SPAWN_INTERVAL`（默认 `SPAWN_INTERVAL_DEFAULT`，关卡可覆盖，区间 [2.0, 6.0]）→ 触发 1 次供料。
2. 抽色：按 §3.2 加权——从"仍需颜色集合"（S3 可填格中未填的颜色，经事件同步）以 `NEEDED_WEIGHT` 抽取；杂色以 `DECOY_WEIGHT` 抽取（杂色数 ≤ `DECOY_COLORS_MAX`，由关卡数据声明）。
3. 落槽：**随机空闲槽**放入 1 颗，广播 `tray:spawned {slot, colorIdx}`。
4. 无空闲槽 → **跳过本次供料**（不排队、不补发）并广播 `tray:full`（A2 已确认）。

### 2.3 扩展行

- 入口 `btn_expand`（激励视频位，MVP 仅角标占位；拉起逻辑 `[待用户确认]`，`AD_PLACEMENTS` 见 §3.6）。
- 解锁后本关内永久生效；**重开/换关重置为未扩展**（A1 已确认不跨关保留）。
- 解锁成功广播 `tray:expanded`；扩容瞬间已持有的珠不动，仅新增空槽。

### 2.4 珠子离槽（三个出口）

| 出口 | 触发 | 槽位去向 |
|---|---|---|
| 落子成功 | S3 `bead:placed` 回执含 slot | 置 `free`，若为 selected 同时清除选中 |
| 道具清除 | S6 `powerup:used {affectedSlots}` | 置 `free` |
| 整关重置 | S1（失败重试/重玩/换关） | 全清 + 扩展重置 |

## 3. 输入

| 来源 | 内容 |
|---|---|
| S1 | PLAYING 进入/退出（启停供料心跳）、整关重置指令 |
| S2 | 槽位点击（选中/换选请求） |
| S3 | "仍需颜色集合"变更（经 `bead:placed` 间接）、落子成功的 slot 回执 |
| S6 | `powerup:used`（清除指定槽） |
| S9 | PAUSED → 冻结供料心跳 |

## 4. 输出与反馈

| 事件/表现 | 条件 | 对齐 |
|---|---|---|
| `tray:spawned {slot, colorIdx}` | 每次供料成功 | 新珠入槽轻入场动效（表现层） |
| `tray:full {}` | 供料时无空闲槽 | 托盘边缘告警（视觉层消费；与倒计时告急叠加不超 ≤3Hz 红线，§3.8） |
| `tray:expanded {}` | 扩展解锁 | 虚线槽 → 实线槽过渡动效 |
| `tray:selected {slot, colorIdx}` | S2 换选 | `selected` 态：上移 4px + 圆点指示（assets-spec §1.2） |

## 5. 数值

全部引用 `systems-index §3`：§3.4（`TRAY_BASE_SLOTS`、`TRAY_EXPAND_SLOTS`、`TRAY_COLS`、`TRAY_SLOT`、`TRAY_GAP`、`SPAWN_INTERVAL_DEFAULT` 及区间、随机槽规则）、§3.2（`NEEDED_WEIGHT:DECOY_WEIGHT = 3:1`、`DECOY_COLORS_MAX`）、§3.1（`TRAY_BAND` 定位）、§3.6（`AD_PLACEMENTS`）。

## 6. 边界条件

**极端值**
- 关卡"仍需颜色集合"为空（只剩杂色可抽）：仍按 3:1 权重退化——所需色抽不到时全部抽杂色；理论上此局面意味可填格已满（cleared 已触发），仅作防御。
- 供料间隔被关卡压到区间下限且托盘长期满：连续跳过供料，`tray:full` 允许去重（满槽期间不重复广播，恢复空闲后再次触发才重播）。
- 扩展解锁瞬间正处满槽：解锁后下一 tick 恢复供料，**不补发**满槽期间跳过的次数。

**并发 / 竞态**
- 供料与换选同帧：先结算选中转移，再落新珠（新珠落 selected 槽则落其他空闲槽——随机槽避让选中槽）。
- 供料与道具清除同帧：事件按到达序串行；清除先到则该槽可作供料目标，供料先到则清除不影响新珠。
- 落子回执与换选同帧争同一槽：以先到为准，后到者按槽位最新状态重新解释（free 则选中失效，holding 则重选）。
- PAUSED 帧内 dt 累计：暂停期间 dt 不累计（冻结语义对齐 S5），恢复后从原累计值继续。

**非法输入**
- 选中不存在的槽 / 双击同槽：幂等——保持该槽选中，不重复广播 `tray:selected`（core-loop §6）。
- 对 `free` 槽发起"落子到网格"：S2 层拦截（无选中珠），不达 S4。

## 7. 依赖

- **上游**：S1（状态机启停/重置）、S2（槽位点击）、S3（仍需颜色集合）、S6（道具清除）、S9（暂停冻结）。
- **下游**：S3（落子校验需持有状态）、S6（道具作用对象）、S7（spawned/used 统计）、视觉/音频层。

## 8. 验收标准（可测试硬判据，QA 直接造用例）

1. `SPAWN_INTERVAL` 未覆盖时，PLAYING 60 秒内 `tray:spawned` 恰 15 次（±1），每次间隔 4.0s ±0.1s。
2. 每次供料的落槽为 uniformly 随机空闲槽（统计 200 次供料，任一槽被选中频次与均匀分布偏差 ≤ ±20%）。
3. 抽色权重：构造"仍需 1 色 + 1 杂色"关卡，100 次供料中所需色占比 ≈ 75%（3:1，允许 ±10 个百分点）。
4. 托盘满时供料被跳过：`tray:full` 广播 1 次且满槽期间不重复；腾出 1 槽后 ≤1 个间隔内恢复供料。
5. 扩展后槽位数 = `TRAY_BASE_SLOTS` + `TRAY_EXPAND_SLOTS`；失败重试后回到基线容量且扩展需重新解锁。
6. 换选：同帧两次点击不同槽，最终仅 1 槽处于 `selected`；双击同槽只广播 1 次 `tray:selected`。
7. 落子成功回执后对应槽变 `free`；用 `bead:placed` 计数与 `free` 槽增量做 1:1 断言。
8. PAUSED 期间零 `tray:spawned`；恢复后首个供料不早于"暂停剩余间隔 + 1 帧"。
9. 关卡仅声明 0 杂色时，供料 100% 为仍需颜色（无 `DECOY_WEIGHT` 参与的统计断言）。
10. 道具清除 6 槽（含选中槽）后：选中态清除、6 槽全 `free`、`powerup:used` payload 的 affectedSlots 与实际清空槽一致。
