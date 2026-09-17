# 《打砖块》可访问性 · 代码符号锚点表（`check:a11y` 机检面）

> 规则与诚实边界同 `beads/art/a11y-anchors.md` 首注（正本：`tools/scripts/check-a11y-anchors.mjs` 头注）。
> **首面对账发现（WXG-T-155，诚实登记）**：矩阵 B2 声称值 `#FFFFFF/#A6AEC8 on #0C0B1E` 与实现 `palette.ts`（background `#0b1021`）**不一致**——文档 hex 在 src 零命中，属示例游戏文档陈旧漂移。本表 B2 暂以键名锚定 + 挂待办（不 whitewash：漂移已在此显式化，矩阵数值订正归 breakout 域后续单，backlog 有账）。

| id | 状态 | 锚点（`;` 分隔，字面量：符号名/键名/hex） | 备注（锚点语义） |
|---|---|---|---|
| A1 | ✅ | `brickDamagedTint` | 砖块非颜色通道底座（`view/view-model.ts` 受损调暗 + hp pips） |
| A2 | ✅ | `damaged` | 受损态读数分支（view-model `drawBricks`） |
| A3 | ✅ | `drawHud` | 状态「图标 + 文字」并行（view-model HUD） |
| A4 | ✅ | `drawPowerups` | 道具胶囊形状为主线索（view-model §1.4 注释自证） |
| B1 | ✅ | `shade` | 明度调暗函数（灰度可辨的机制底座） |
| B2 | ✅ | `textDim` | ⚠️ 键名锚定；文档 hex 与实现漂移见首注（矩阵订正待 breakout 域后续单） |
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
