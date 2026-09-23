# 《拼豆》可访问性 · 代码符号锚点表（`check:a11y` 机检面）

> 正本矩阵 = `accessibility.md §2`（本表不重复其判据正文，预算注记 WXG-T-130 指引「再增判据拆独立文件」）。
> **规则**（`tools/scripts/check-a11y-anchors.mjs` 机械强制）：
> ① 本表 id 集合必须与 `accessibility.md §2` 矩阵行 id 集合**相等**（缺行/多行 = FAIL）；
> ② 状态列为 `✅` 的行 ⇒ 锚点**非空**，且每个锚点在 `games/beads/src/**/*.ts` **字面命中 ≥1**，零命中 = FAIL；
> ③ 非 ✅ 行锚点填 `-`（声明不受检）。
> **防的就是**（K-035）：矩阵状态列写「✅ 落地」而代码根本没实现 = 假绿。锚点行是「声称落地」的**可机检凭证**。
> **诚实边界**：本表状态列与矩阵状态列的**一致性**仍靠 QA 评审（脚本不解析矩阵长文本状态列——行内嵌 `|` 公式致切分不可靠）；把矩阵 ✅ 抹成本表 `-` 可躲脚本但躲不过 §3 小结对账。

| id | 状态 | 锚点（`;` 分隔，字面量：符号名/键名/hex） | 备注（锚点语义） |
|---|---|---|---|
| A1 | ⚠️ | `padColorIdx` | **`[v1.5-r8]` 降档（用户 2026-09-23 拍板）**：三重编码 → **二重**（色相 + 明度），L5 矢量符号整层删除（`view/symbols.ts` 已删）。锚点改指 `padColorIdx` = 新承载「这一格要什么色」的**连续目标色底图**入参（`view/bead-render.ts`）|
| A2 | ⚠️ | `drawLockedBead` | 部分落地行：锚点仅证**已落地半边**（locked X 斜纹）；empty/hint 降档见矩阵行 |
| A2b | ⚠️ | `-` | v1.5 降档登记行（E4 移除，Basic 通道收窄）——无「落地」声称可检 |
| A3 | ⚠️ | `luminance` | 部分降级行：锚点 = 明度计算函数（`view/palette.ts`，6 档量化底座） |
| A4 | ✅ | `drawPowerupGlyph` | 3 道具形状互异图标（`view/view-model.ts`，不靠颜色） |
| A5 | ✅ | `glow_warm` | 暖光 band 低饱和色（`view/palette.ts`，层次不破坏三重编码） |
| A6 | ✅ | `hintAlpha` | 动画不承载独占信息：hint 呼吸在 reduceMotion 下退**静态**描边仍有信息（`view/view-model.ts`） |
| B1 | ✅ | `#2A2E43` | `text_primary` 值锚（`view/palette.ts:71`，对比度 ≥4.5:1 的底色对） |
| B2 | ⛔ | `-` | **`[v1.5-r8]` 判据作废**：符号层已删 ⇒ 「符号对珠面 ≥3:1」不再有任何实现对象（`symbolInk` / `SYMBOL_INK_*` 一并删除）。不得复活为死常量 |
| B3 | ✅ | `dangerAlpha` | 倒计时三通道之脉冲 α（`view/view-model.ts`，WXG-T-087 GAP-10） |
| C1 | ✅ | `btn_expand; GEAR_HIT_SIZE` | 扩热区常量（`config/tuning.ts`；齿轮/扩展键 ≥88 设计 px） |
| C2 | ✅ | `POWERUP_CARD_GAP` | 卡间距 60px 真值（`config/tuning.ts`，BD-26 回写后与文档一致） |
| D1 | ✅ | `reduceMotion` | 减弱动效开关全通道（`view/`+`config/` 多命中；矩阵行自证接通清单） |
| D2 | ✅ | `FILL_POP_RESTART_GATE_MS` | 闪烁安全重启门常量（`config/tuning.ts`，往复量核算底座） |
| E1 | ✅ | `hudSmall` | 最小字号 28 floor 键（`view/view-model.ts:155`，v1.3 F7⑤ 修正后） |
| E2 | ✅ | `largeText` | 大字号开关状态位（`game/state.ts`，`bodyFont` 消费） |
| F1 | ✅ | `_stepPlaying` | 暂停冻结倒计时机制（`game/beads-game.ts`：计时只在 playing 步进 ⇒ PAUSED 自然冻结） |
| F2 | ✅ | `GRID_HIT_SIZE; TRAY_HIT_SIZE` | 命中区外扩常量（`config/tuning.ts`，误触缓解） |
| G1 | N/A | `-` | 无语音内容 |
| G2 | ⏸ | `-` | 平台限制延后 |
| H1 | ⏸ | `-` | 待用户拍板（矩阵 §5） |
