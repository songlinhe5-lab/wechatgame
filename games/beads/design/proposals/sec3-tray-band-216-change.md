# §3 变更单：`TRAY_BAND` 下沿 230 → 216（带高 220 → 234）

| 项 | 值 |
|---|---|
| 文档性质 | **§3 变更单**（设计轨）。§3 行 + changelog + 落码三件套的文档半边；代码本已符合，本单补表 |
| 作者 | 主理人（Trae） |
| 日期 | 2026-10-27 |
| 任务号 | **WXG-T-459** |
| 状态 | **已采纳**（用户 2026-10-27 裁定「选项 A：承认代码现状」） |
| 上游 | `design/gdd/review-2026-10-27.md §2-8`（P1，`wxgame-gdd-review` 首跑发现）；推导正本 `design/proposals/tray-24-layout-derivation.md §2` 方案 A |
| 落表 | `systems-index.md` §3.1（`TRAY_BAND` 行、`SAFE_BOTTOM_H` 行例证）、§3.4（`TRAY_TIER_SLOTS` 行注、`btn_expand` 几何行）；`systems-index-changelog.md` **v1.97** |
| 代码 | **无需改动** —— `src/config/tuning/layout.ts::TRAY_BAND` 自 WXG-T-143 落码即 `{yMin:216, yMax:450}`；`expandButtonLayout()` 以 `TRAY_BAND.yMin` 为锚自动跟随 |
| 权威来源 | §3 数值唯一真源；推导见 `tray-24-layout-derivation.md §2`（`panelH` 与方案 A/B 比较）；代码真值 `layout.ts:158-161`、`board.ts:615-640` |

## §1 变更内容

| 项 | 旧（§3 v1.96） | 新（§3 v1.97） | 依据 |
|---|---|---|---|
| `TRAY_BAND` | y∈[230,450]（带高 220） | **y∈[216,450]（带高 234）** | `panelH(4) = 4×54 − 6 + 2×12 = 234`；4 行扩展态须完整落带 |
| `btn_expand` 热区 | y∈[230,318] | **y∈[216,304]** | 锚 `TRAY_BAND.yMin`（`expandButtonLayout().hitBottom`），带下沿 −14 ⇒ 整体 −14 |
| `btn_expand` 视觉 | y∈[250,298] | **y∈[236,284]** | 同心：`bottom = yMin + (88−48)/2 = 216+20 = 236` |
| 与 `POWERUP_BAND`（顶 200）净空 | 30 px | **16 px** | 216 − 200 |
| 与基础态 row1 槽热区净空 | 11 px（62 口径实测） | **25 px**（同口径 +14）；公式化 60 口径 13 → **27 px** | 按钮下移 14；两侧均未重测 `[待真机]` |

**零改动项（本单明确不动）**：`TRAY_TIER_SLOTS`（12 / 24 / 48）、`TRAY_AD_EXPAND_COUNT`（2）、`TRAY_COLS` 12、`TRAY_SLOT` 48、`TRAY_GAP` 6、`TRAY_PANEL_PAD` 12、`TRAY_HIT_SIZE` 公式、`PUZZLE_BAND`、`HUD_BAND`、`POWERUP_BAND`、`SAFE_BOTTOM_H` 68。

## §2 推导（可重算）

- 面板高：`panelH(rows) = rows × 54 − 6 + 2×12` ⇒ 2 行 **120** / 3 行 **180** / 4 行 **234**。
- 面板贴带上沿（`TRAY_BAND.yMax = 450`）⇒ 4 行面板 y∈**[216,450]**。
- 完整落带要求 `yMin ≤ 450 − 234 = 216`；取 **216** 恰为等式边界（零溢出、零余量）。
- 方案 B（压 pitch / pad 使 234 ≤ 220）数学不可行：pitch 51 ⇒ 222、pad 9 ⇒ 231，均超带高 ⇒ 只可能动带位（见上游 §2）。
- 下探边界：216 > `POWERUP_BAND.yMax 200` ⇒ 净空 16 px，不压道具卡。

## §3 连带影响

1. **`btn_expand` 两行几何（§3.4）整体 −14**：热区 [216,304] / 视觉 [236,284]；与道具带净空 30→16。
2. **`SAFE_BOTTOM_H` 行例证**：「现落码最贴底元素 = `TRAY_BAND.yMin`」由 230 改 **216**（仍 ≫ 68，原结论不变）。
3. **`TRAY_TIER_SLOTS` 行自述消解**：「48 = `panelH(4) = 234` 恰好等于托盘带高」在旧带高 220 下自相矛盾；带高 234 落定后自 v1.97 起成立（v1.24 定带高即为此口径，v1.84 三档制沿用）。
4. **下游现行文档回写**：`design/gdd/input-control.md §2.2`（并订正「扩展态最上排」措辞 ⇒ 基础态 row1）、`design/art/specs/assets-spec.md §1.3 + 常量速查`、`src/config/tuning/layout.ts` / `board.ts` 注释；`pnpm run framework:sync` 同步 Cocos 镜像。
5. **3 行态压按钮的负面后果不因本单消失**：v1.62 登记的「3 行展开态面板底压 `btn_expand` 视觉框 ≈14dp」属 3 行态；顶档 4 行态按钮隐藏（`canExpand=false`）⇒ 重叠不可达（v1.84 已登记）。

## §4 本单不改什么

- 不改 `TRAY_TIER_SLOTS` / `TRAY_AD_EXPAND_COUNT` / `TRAY_SLOT` / `TRAY_GAP` / `TRAY_COLS` / `TRAY_PANEL_PAD`。
- 不改 `PUZZLE_BAND`（v1.58 换尺结论）与 `POWERUP_BAND`。
- 不改 `SAFE_BOTTOM_H` 值（68；v1.74 新增、v1.75 角色改 fallback）。
- 不重跑真机净空测量：25 / 27 px 为算术值，实测仍挂 `[待真机]`（E2 同批）。
- 不回填历史版本行（v1.20 / v1.24 / v1.62 等原文保留，K-053）。

## §5 验证

| 项 | 结果 |
|---|---|
| `pnpm run check:frozen-values` | OK（区间值进 SKIP；人工核 = §3 与代码同值 216/450，`SKIP ≠ 已验`） |
| `pnpm run check:arch` / `check:tasks` / `check:links` | OK |
| `pnpm --filter @wxgame/beads test` | **115 文件 / 1380 passed / 2 skipped**（代码值未动 ⇒ 零回归） |
| `ctx:build` + `ctx:check` | OK（新变更单由 pre-commit 重建索引时入册） |
| 三面一致性 | A 面区间不可解析 ⇒ SKIP；B 面下游无该常量等式；**人工核** §3 / 代码 / 下游现行文档三处同值 |

## §6 风险与欠账

1. **净空收窄**：`btn_expand` 与道具带只剩 16 px（旧 30）；与基础态 row1 槽热区反而放宽到 25 px（旧 11）⇒ 误触风险 `[待真机]`。
2. **带高 234 零余量**：4 行面板恰等于带高 ⇒ 后续任何 `TRAY_PANEL_PAD` / `TRAY_GAP` 上调都会立刻越带，改托盘族常量前须先重算本条。
3. **版本号勘误**：代码注释曾写「§3.1 v1.25」，但 v1.25 号位已被 `REVIVE_BONUS_SEC` 变更占用（`systems-index-changelog.md` v1.25 行）⇒ 本单落 **v1.97** 并同批订正注释。
4. **门禁不持续守区间值**（K-192）⇒ 本条须在下次 `wxgame-gdd-review` 的 SKIP 人工判读里复查。
5. **存量欠账（本单不碰）**：`design/ux/ux-spec.md:78` 线框图的带值标签整体滞后（`TRAY_BAND y∈[230,420]`、`PUZZLE_BAND y∈[480,1120]` 均早于各自现行 §3 值，属 v1.20 / v1.58 之前的老图）⇒ 需另开 UX 图刷新批，本单只登记不改（避免单改一处反而误导为「已同步」）。
