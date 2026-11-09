# UX 规格 · 关卡详情弹窗（Level Detail Dialog）· beads

- 项目：`games/beads` · 版本 **v1.0（2026-11-08 · WXG-T-604）**：首版。**Figma 单源重排**——稿面数据全量取回后，替换旧「纸面板 600×720」版式；本文只写「稿面读数 + 落地映射 + 偏差」，几何单源在代码侧 `src/config/tuning/level-detail.ts`（绘制与热区共读，⛔ 本文不另抄一份数字表当第二真源）。
- **设计真源**：Figma 文件 `PBIK3RbfGlfzFsAnd97ZsP` · 页 `84:36 关卡详情弹窗 v25b` · 帧 `92:36 抠图层`（750×1334）。稿面导出于 2026-11-08 复验（`node 92:36` 重取一遍，几何零漂移）。
- **坐标口径**：帧原点在画布 `(−63,+22)` ⇒ 下文所有坐标已扣除该偏移，口径 = **帧内 750×1334、y 向下**。代码口径 = y 向上、`box.y` = 下缘，换算 `yUpBottom = 1334 − yDown − h`；逐机位移只加在木牌下缘（`dialogShiftY()`），内容偏移一律相对牌下缘。
- **本文射程**：选关页点格 → 关卡详情弹窗（`level-detail` overlay）的版面、文案、资产、数据与热区。**不射程**：选关页本体（`arc-level-select-spec.md`）、玩法开局扣心语义（`systems-index §3.14`）、菜单弹窗通用壳（`gdd/meta-ui.md`）。
- **上位正本**：交互流程 = `arc-level-select-spec.md §2`（点格开详情 → 开始 / 关闭）；体力扣减 = `systems-index §3.14`（开详情不扣、开始扣 `STAMINA_START_COST`）；美术容器语言 = `design/art/proposals/level-detail-dialog-20261107/`（对话框壳提案）与 `…/powerup-icons-20261108/`（道具框图）。判据钉在 `tests/meta-level-detail.test.ts`（流程 / 几何不变式 / 双绘制腿）。

---

## 1. 设计原则

1. **一屏一决定**：弹窗只承担「看清这一关 + 决定开不开」，不放置选关、商店、设置等第二任务。
2. **木牌即容器**：面板、橱窗、星级、道具、开始钮同属一套木作语言；缺图时逐元素回退到同几何程序化档（元素级换皮，⛔ 不做第二套版式）。
3. **数据不进视图**：关卡名、章名、星数、道具存量、时限全部由 shell 投影到 `MetaViewData`，视图只读（L5）。

## 2. 界面流

```
选关页（levels）
   │ 点已解锁格 pick-level（不扣心；只置详情态）
   ▼
关卡详情（level-detail overlay，叠在选关页上）
   ├ 「开始」 start-detail → 玩法（扣 1 心，收弹窗）
   └ 右上 ✕ close-detail / 点木牌外空白 dismiss-detail → 选关页（不扣心，清详情态）
```

- 弹窗必须由「已解锁格」进入；未解锁格零事件（`arc-level-select-spec §4-注 A`）。
- 「关闭」是本仓产品补钮：稿面只有「开始」，但弹窗不能无出口（裁定见 §7）。

## 3. 稿面版式（帧内坐标 · y 向下）

| 件 | Figma 节点 | x | y | w | h | 落地 |
|---|---|---|---|---|---|---|
| 木牌面板 | `95:116` | 89 | 166 | 581 | 1044 | 整张烘图（木框 + 四角铆钉 + 空橱窗 + 底座） |
| 板标题「关卡详情」 | `95:59` | 190 | 230 | 380 | 96 | 文字层（中心 380,278） |
| 副标题「曼陀罗·第5关」 | `95:104` | 300 | 350 | 167 | 34 | 文字层（中心 383,367） |
| 玻璃橱窗 | `123:3` | 245 | 520 | 295 | 285 | 运行时画关卡缩略（⛔ 不吃稿内占位猫图） |
| 星级组 | `147:36` | 279 | 858 | 283 | 60 | 3 × 58×60，净距 9 |
| 时限 | `145:36` | 482 | 880 | 80 | 17 | 文字层（左缘 482 / 中线 888.5；见 §9-3） |
| 道具组 | `148:36` | 240 | 912 | 270 | 84 | 3 × 84×84，净距 9（中轴 375） |
| 可用数角标 | `137:37/40/43` | tile.x+60 | tile.y | 24 | 24 | 贴每枚道具**右上角**，r8，⛔ 不留内缩 |
| 「开始」钮 | `119:36` | 212 | 1027 | 326 | 154 | 整枚烘字（含木纹 / 高光 / 四角铆钉） |
| 关闭 ✕ | —（产品补） | 588 | 186 | 24 | 24 | 木牌右上框带**刻入浅槽**（中心 600,198，臂长 12）；无底板 |

- 木牌**不是**垂直居中：底缘距屏底 124（居中应为 145），按稿保留 21px 上偏。
- 内容净距（牌内 y 向下）：标题 64 → 副标题 121 → 橱窗 354 → 星 692 → 道具 746 → 开始 861；道具下缘与开始顶缘净距 29。

## 4. 字体与颜色（稿面 → 运行时）

| 件 | 稿面 | 运行时 | 说明 |
|---|---|---|---|
| 板标题 | Chiron GoRound TC ExtraBold 64 / `#F9D8A7` | `UI_FONT.detailTitle`（bold 64 系统字）/ `palette.plateSubInk` | canvas 无 Chiron 字族；色值近似到既有令牌 |
| 副标题 | Inter Bold 28 / `#1A1D3F` | `UI_FONT.labelBold`（大字号档 `bodyLarge`）/ `palette.text` | 文案 = `${大关名}·第 N 关`；章名缺省只显关序 |
| 时限 | Noto Sans SC Bold 14 / `#3A1C07` | `UI_FONT.cell`（22）/ `palette.plateTitleInk` | 14px 低于可读地板 ⇒ 升到 22 |
| 角标数字 | Inter Bold 14 / 白 | `UI_FONT.badge`（14）/ `palette.woodText` | 底 = `palette.text`（`#2A2E43`，稿面同值）；0 档转 `palette.textDim` |
| 星 | 58×60 位图 | `LEVEL_DETAIL_TEXTURES.starFilled/starEmpty` | 缺图回退 `STAR_LABELS` 文字档 |
| 开始钮 | 326×154 整枚烘字 | `LEVEL_DETAIL_TEXTURES.start` | 缺图回退 `drawButton('accent', label('start-detail'))` |
| 关闭钮 | — | 程序化刻槽（§4.2） | 24² ✕，热区 88，按下只压深不位移 |

### 4.1 板标题文字效果（Figma `95:59.effects`，2026-11-09 回读）

> 这是本页**唯一**带 `effects` 的节点；其余文字（副标题 / 时限 / 角标）无效果。

| # | 类型 | 颜色 | 位移（x, y↓） | 模糊 | 落地 |
|---|---|---|---|---|---|
| ① | INNER_SHADOW | `#FFF4D6` α0.90 | (0, +3) | 2 | ⛔ 未实现（文字管线单色填充，无内阴影） |
| ② | INNER_SHADOW | `#8A4B1A` α0.70 | (0, −2) | 2 | ⛔ 未实现（同上） |
| ③ | DROP_SHADOW | `#5A2F0D` α0.80 | (+9, +7) | 3 | ✅ 已落：`TextCommand.shadow`（Canvas 原生阴影含 blur / Cocos 双 `Label`（blur 忽略）/ SVG 双 `text`），色取 `withAlpha(palette.plateTitleInk, 0.80)` |

- 参数单源：`LEVEL_DETAIL_TITLE_SHADOW`（`config/tuning/level-detail.ts`）；契约：`TextShadow`（`packages/framework/src/core/render/render-model.ts`）。
- 为什么内阴影仍不落：Canvas `fillText` 只有单色填充，内阴影需要字形裁剪 + 反向偏移，超出最小契约；投影已是本页最显眼的立体感来源。
- 令牌色差：稿 `#5A2F0D` ↔ `plateTitleInk #563113`，RGB 最大差 6/255（肉眼不可辨），不新增令牌。

### 4.2 关闭刻槽（程序化 · 零资产）

> 设计口径：关闭是**低权重出口**，不做按钮底板；直接把 ✕ 刻进木牌右上框带，视觉 24²、热区仍 88。云 qwen-image-3.0 两 seed 对照（`design/art/proposals/close-engraved-20261109/close-compare.png`）确认「浅刻」方向后落程序化。

| # | 层 | 画法（设计坐标，y 向上） | 令牌 / 值 |
|---|---|---|---|
| 1 | 深槽 | 两条对角线，臂长 12、线宽 3px | `woodEdge #5E3B1E`；按下 `shadowInk #3D2E1E` |
| 2 | 上缘受光 | 同两条线各向 +2y 偏移，线宽 1px（按下隐去） | `woodSheen #B98A5C` |

- 位置：(600, y_up 1136)，即牌顶 1168 与标题板顶 1104 之间的框带；⛔ 不压牌角铆钉（约 640,215，留 ≥20px）。
- 状态：正常 / 按下（槽色压深、受光线消失；刻入件不位移）。
- 对比度：槽线对木面为**结构线**，不承载文字语义；✕ 形状本身即关闭语义（不靠颜色）。
- 零新增 hex、零位图；`MENU_TEXTURES.btnCircle` 不参与本钮。

## 5. 资产台账

| 件（`final/assets/detail/`） | 规格 | 来源 | Cocos 投放件 |
|---|---|---|---|
| `ui_detail_plaque@2x.png` | 1162×2088 · 911 KB | Figma `95:116` 导出（@2x） | `cocos/assets/textures/detail/ui_detail_plaque.png` 108 KB（256 色量化） |
| `ui_detail_start@2x.png` | 652×308 · 284 KB | Figma `119:36` 导出（@2x） | 同名 `ui_detail_start.png` 35 KB |
| `ui_detail_star_filled@2x.png` | 116×120 · 9 KB | Figma `133:37` 导出（@2x） | 同名 `ui_detail_star_filled.png` 2 KB |
| `ui_detail_star_empty@2x.png` | 116×120 · 9 KB | Figma `134:409` 导出（@2x） | 同名 `ui_detail_star_empty.png` 2 KB |

- 道具框图不复用本表：三枚 `84×84` 来自 `final/assets/powerup/tiles/`（WXG-T-601，`POWERUP_TILE_TEXTURES`）。
- Cocos 侧为**同名无 `@2x`** 投放件（Bundle 内扁平静图）；`.meta` 由编辑器导入生成，⛔ 手写。来源与量化口径记 `production/qa/asset-provenance.md`。

## 6. 数据映射（shell → `MetaViewData` → 绘制）

| 稿面件 | 字段 | 缺失时 |
|---|---|---|
| 副标题 | `detailChapterTitle` + `detailLevelIndex` | 章名缺 ⇒ 只显「第 N 关」；无 `detailLevel` ⇒ 整页不画 |
| 橱窗缩略 | `detailLevel`（`drawLevelThumb` 按关卡 pattern） | — |
| 星级 | `starsByLevel[detailLevelIndex]` | 0 ⇒ 三枚空心 |
| 时限 | `detailLevel.time` | — |
| 道具角标 | `powerupStocks`（顺序 = `POWERUP_TYPES`） | 缺省三枚全 1 |
| 开始文案 | `label('start-detail')` | 走 `COPY_TOKENS` |

## 7. 交互与热区

| 钮 | 热区（设计坐标） | 提交 | 结果 |
|---|---|---|---|
| `start-detail` | `{x:212, y_up:153, w:326, h:154}`（= 稿面钮） | 抬起且同钮（`input-control.md`） | 扣 `STAMINA_START_COST` 心 → 玩法·该关 |
| `close-detail` | 刻槽中心 = (600, y_up 1136)，视觉 24² / 热区 `TOUCH_MIN 88` | 同上 | 回选关页，详情态清零 |
| `dismiss-detail` | 木牌外四条贴边带（上 / 下 / 左 / 右，⛔ 不含牌内） | 同上 | 同 `close-detail` |

- ✕ 刻在木牌**右上框带**（牌顶 1168 与标题板顶 1104 之间，中心 1136）；点牌内空白**不关**，点牌外空白才关。
- 开详情本身不扣心、不写存档；扣心只发生在「开始」。

## 8. 缺图回退（元素级换皮）

| 元素 | 有位图 | 缺位图（同几何） |
|---|---|---|
| 面板 | `blit(plaque)` | `rect(panel, r=UI_CONTAINER.radiusPanel 24)` |
| 星 | 3 次 `blit`（实心 / 空心按得星） | `STAR_LABELS` 文字（`★★☆` / `☆☆☆`，居中于星行） |
| 道具 | `blit(POWERUP_TILE_TEXTURES[t])` | `circle(r=42)` + 单字（`POWERUP_LABELS` 首字） |
| 开始 | `blit(start)` | `drawButton('accent', 文案)` |
| 关闭 | 程序化刻槽（§4.2，无位图腿） | 同左 |

## 9. 偏差登记（有意为之，非缺陷）

1. **「关闭」为产品补钮**：稿面无出口。直接把 ✕ 浅刻在木牌右上框带（§4.2，无底板），并支持点木牌外空白关闭；不动稿面其它件。
2. **橱窗不吃稿内猫图**：`123:3` 是设计稿占位素材，运行时按关卡 pattern 画缩略（数据驱动 + 省 190 KB）。
3. **标题字族 / 时限字号**：系统字替代 Chiron；时限 14 → 22（可读地板）。22 档字宽超过稿面 80 槽，**取左缘锚 x=482**（不再居中），否则会压到第三枚星。
4. **角标贴边统一**：稿中第三枚角标比另两枚高 2px（`137:43` y=910），实现统一贴 tile 顶缘（`y=912`）。
5. **弹窗无独立遮罩层**：稿面背景是整屏场景图；运行时沿用弹窗通用遮罩浓度（`UI_SCRIM`）。
6. **标题内阴影未落、投影 blur 分端**：稿面两枚 `INNER_SHADOW`（内高光 / 内暗边）不实现；`DROP_SHADOW` 走 `TextCommand.shadow` —— Canvas 含 blur 3，Cocos `Label` 无阴影 API 只落偏移副本，SVG 双 text 不含 blur（参数见 §4.1）。

## 10. 开放项

- [ ] Cocos 编辑器导入 `cocos/assets/textures/detail/` 四枚 PNG（生成 `.meta` 并挂 `textures` Bundle）；harness 已可用。
- [ ] 木牌背板若再换纹理（`proposals/plaque-texture-20261108/`），需重导 `ui_detail_plaque@2x.png` 并同步投放件。
- [ ] 大字号 / 减弱动效档的弹窗字号与进场（现仅副标题读 `largeText`）——归后续无障碍批。
