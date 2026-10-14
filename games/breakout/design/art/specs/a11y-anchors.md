# 《打砖块》可访问性 · 代码符号锚点表（`check:a11y` 机检面）

> 规则与诚实边界同 `beads/art/a11y-anchors.md` 首注（正本：`tools/scripts/check-a11y-anchors.mjs` 头注）。
> **首面对账发现（WXG-T-155 登记 → **WXG-T-159** 定性订正）**：矩阵 B2 声称值 `#FFFFFF/#A6AEC8 on #0C0B1E` 与实现 `palette.ts`（background `#0b1021`）**不一致**。T-159 全量对账**更正原单向定性**：① 砖块色 `src/config/levels.ts` 与文档**逐值全对齐**（`N #35C2F0`/`T #A96BFF`/`S #8892A6`/`B #FF6B3D`/`G #FFCB3D`）；② 漂移面**仅** `palette.ts` 的 UI 场景色（与 `art-bible §3.1` 13 色**零重合**，实现 13 个自有 hex 在 `art/`、`design/` 逐个零命中）；③ §3.1 的 `bg_grid`/`bg_vignette`/`wall_border` 在实现侧**无对应绘制** ⇒ 不止换色值。两侧同出自提交 `6c02732`，无时间序权威 ⇒ 原注「文档陈旧」定性**不成立**；用户 2026-09-18 裁定 **C 维持登记 ⛔**（两侧均不动，解除条件见 `## WXG-T-159`）。实测读数：`#e8f1ff` on `#0b1021` = **16.62:1**、`#8b98b8` = **6.56:1**（实现侧最低 6.43:1）⇒ B2「≥4.5:1」**两侧口径均达标**，判据 ✅ 不变、变的是读数。本表 B2 暂以键名锚定（不 whitewash，漂移已显式化）。

| id | 状态 | 锚点（`;` 分隔，字面量：符号名/键名/hex） | 备注（锚点语义） |
|---|---|---|---|
| A1 | ✅ | `brickDamagedTint` | 砖块非颜色通道底座（`view/view-model.ts` 受损调暗 + hp pips） |
| A2 | ✅ | `damaged` | 受损态读数分支（view-model `drawBricks`） |
| A3 | ✅ | `drawHud` | 状态「图标 + 文字」并行（view-model HUD） |
| A4 | ✅ | `drawPowerups` | 道具胶囊形状为主线索（view-model §1.4 注释自证） |
| B1 | ✅ | `shade` | 明度调暗函数（灰度可辨的机制底座） |
| B2 | ✅ | `textDim` | ⚠️ 键名锚定；定性订正见首注（WXG-T-159）：实现口径 16.62:1／6.56:1 仍达标，矩阵数值订正待 A/B 方向拍板 |
| B3 | ✅ | `drawBall` | 球高对比追踪渲染 |
| B4 | ✅ | `drawBanners` | 文字 banner 非颜色信息通道 |
| C1 | ✅ | `PADDLE_W` | 挡板宽度 = 主触控目标（`config/tuning.ts`） |
| C2 | ✅ | `BRICK_GAP_X` | 砖间距（`config/tuning.ts`，误触缓解） |
| D1 | ✅ | `reduceMotion` | 减弱动效开关（`systems/motion.ts` 关停/保留清单） |
| D2 | ✅ | `shakeAmplitudePx` | 屏震 ≤6px/≤120ms 红线常量（motion.ts） |
| E1 | ✅ | `hudSmall` | 字号 floor 键（view-model FONT） |
| E2 | 🔶 | `-` | 部分（基础版）——无「✅ 落地」声称可检 |
| F1 | ✅ | `paused` | 暂停相位机（`game/breakout-game.ts`） |
| F2 | ⏸ | `-` | 已裁定延后 |
| G1 | N/A | `-` | 无语音内容 |
| G2 | ⏸ | `-` | 平台限制延后 |
| H1 | ⏸ | `-` | 主理人裁定延后 |
