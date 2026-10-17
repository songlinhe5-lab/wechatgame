# EP13-S5 · 选关格按下态取证（2026-10-17）

> 结论：**位移腿已用命令级快照证实**（目标格整格下沉 2px、其余格零位移；`reduceMotion` 位移归零但换面仍在）；
> **harness 按住截图与真机签署未做** ⇒ 本文状态 = **ADVISORY 未闭**，登记挂账，解除条件见 §4。

## 1. 判据与读数

| 判据 | 来源 | 读数 | 证据落点 |
|---|---|---|---|
| 任意格按下态 = −`UI_PRESS_SINK`（2px），对象身份比对 | `arc-level-select-spec.md §4-R6` | ✅ 仅目标格位移，12 槽其余零位移 | `tests/arc-cell-pressed.test.ts` 臂 1 |
| 按下换面（`slot` → `cardPressed`，零新色） | 同文 §4 矩阵「按下」列 + `pressDy` 既有机制 | ✅ 常态 `#F7F6FB` / 按下 `#F4EAD7` | 同文件臂 2 |
| `reduceMotion` ⇒ 位移归零、只换面 | 同文 §4-R6 尾句 / §5「格按下态」行 | ✅ 位移 0、fill 仍为 `cardPressed` | 同文件臂 3 |
| 其他钮按下不波及格 | 对象身份比对口径推论 | ✅ `pressed = back` 时全格原位 | 同文件臂 4 |
| 已通关 = 符号串 `★/☆` 通道 + 同形同尺（C-3② **只核对不建设**） | 同文 §7 非色相通道 / `STAR_LABELS` | ✅ `★★★` + `text` / `☆☆☆` + `textDim`；两格宽高一致 | 同文件臂 5 |
| 格按下无时长（逐帧态，不占 §5 红线） | 同文 §5「格按下态」行 | ✅ 零动画命令，纯当帧坐标位移 | 同上（命令流无 tween/时长字段） |

命令：`cd games/beads && npx vitest run tests/arc-cell-pressed.test.ts` ⇒ **5 passed**；
全量 `npx vitest run` ⇒ **1024 passed / 2 skipped**（本批 +5）。

## 2. 落码面

- `games/beads/src/view/meta-view.ts::drawWallCell`：新增 `pressed = data.pressed === b` + `pressDy`；
  格底 rect、星带文本、缩略图三者同 `y` 偏移（整格下沉，不拆件）；按下 fill 换 `palette.cardPressed`。
- 同文件 `MetaButton.slot` 注释订正：「陈列序 = DI 升序」为陈旧口径（EP12-S6 已退役），
  现码 = 配置文件顺序、仍经 `wallSlots` 映射。
- 未解锁 / 越界槽：保持虚线空槽原样（零热区 ⇒ 永不进入按下态），未新增消费。

## 3. 口径声明

- Out 未碰：页头大关名（`TODO-1`）、`levelsLayout` 几何、`WALL_*` 数值、未解锁合形（`TODO-5`）。
- 零新数值：2px 取自既有 `UI_PRESS_SINK`，按压面色取自既有 `palette.cardPressed`。

## 4. 未闭项与解除条件（ADVISORY）

| 未做 | 原因 | 解除条件 |
|---|---|---|
| harness 按住截图（常态 vs 按下的同帧对照） | 需在浏览器中按住格位后截图，本轮以命令级快照替代；截图流程未固化为脚本 | 跑 harness → 按住任一已解锁格 → 截图 → 附本文 §1 表下 |
| 真机签署 | 无真机环境（沿用 EP13 各批同一阻塞口径） | 真机走查时补签一行（日期 + 机型 + 结论） |

> 路径说明：Story 条目写 `production/qa/evidence/…`，本仓既有证据统一落
> `production/qa/beads/evidence/`（同族 = `wxg-t-271-boss-thumb-layer.md`）⇒ 本文按仓内惯例落位，登记为路径偏差。
