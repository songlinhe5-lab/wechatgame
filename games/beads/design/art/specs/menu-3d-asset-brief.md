# 主菜单 3D 木屋风 · 分层素材交付规格

> v0.2 · 2026-10-31 · 关联 WXG-T-517（切图提案）/ WXG-T-518（本规格）/ **WXG-T-525（三项裁定，见 §9）**
> v0.1 · 2026-10-30 · 初版。
> **状态：提案**。`art-bible.md` 尚未更新；本规格只约束「怎么出图」，不改变现有已上线资产。
> **用途**：交给外部生图平台（Midjourney / 即梦 / 通义万相 / Seedream / LibLib 等）的交付说明。

---

## 0. 一句话

**一件一张，@2x，透明底，无投影**；「无文字」自 v0.2 起有**两件例外**（顶板 + 开始钮，用户 2026-10-31 裁 §9-②）。

不要出整页图再切——这一条仍是整份文档最重要的约束（理由见 §1）；v0.2 只把**两个大件**改走整屏稿切，因为它俩的上采样实测落在合格线内（§9-①）。

---

## 1. 为什么不能出整页再切（2026-10-30 实测）

拿两张 AI 整页稿试切，三条硬伤全部撞上：

| 硬伤 | 实测数据 | 后果 |
|---|---|---|
| **分辨率不够** | 图稿 720 宽，切出的招牌 526 px，@2x 需 1095 px | 覆盖率 48%，要放大 **2.08×**；参照 2026-10-13 判例（1.36× 上采样边缘必软判不合格），2.08× 必糊 |
| **相邻元素咬合** | 箭头压在橱窗框上、猫坐在层板上 | 切框必然带箭头残片，切猫必然带层板；单图层出图无法分离 |
| **玻璃内无法透明** | 玻璃内是不透明木墙 `(172,118,82)` S=0.52；白珠 `(234,205,184)` S=0.21 | 饱和度只差 0.3，四种分割法（形态学闭+开 / 区域生长 / 逐行边缘中位色 / 开运算去细条）全留毛边 |

**结论**：让模型一件一件单独出，每件都是 2x、透明底、四周无邻居。

---

## 2. 画风锚

### 2.1 正向提示词（每件都必须带这一段）

```
3D cartoon illustration, handcrafted wooden toy, thick painterly rendering,
warm caramel-brown wood with visible grain, soft rounded bevels and chamfers,
warm key light from upper-left with soft falloff, gentle bounce light at bottom,
slightly saturated, candy-warm palette, no outline, no cel shading,
single isolated object, centered, generous transparent margin on all sides,
flat clean transparent background, high detail, soft edges
```

### 2.2 负向提示词

```
text, letters, logo, watermark, ground shadow, cast shadow, drop shadow,
background scene, multiple objects, overlapping objects, outline, ink line,
photorealistic, 3d render, octane, harsh specular, mirror reflection,
cropped, cut off, frame border, checkerboard
```

> ⚠ **「无投影」是硬要求**：投影由程序化统一绘制（`drawCaseShadow` 等），素材自带投影会在换背景时出现双影。
> ⚠ **「无文字」是默认硬要求**：其余各件的文字一律走 `tokens.md` 文本层，不进图。**例外（§9-②）** = #1 招牌「拼豆小铺」与 #4/#5 开始钮「开始游戏」⇒ 这两件出图时**不加** `text, letters, logo` 负向词，改在正向词里钉死文案；**代价 = 文案一改必重出**（能烧字的前提 = 单元素短文案，模型写得出；整屏多标签仍必乱，见 `wxgame-image-gen` §5）。

### 2.3 色板（从两张参考稿实测）

| 档 | 3D 稿实测 | 项目现用 | 差异 |
|---|---|---|---|
| 木·暗 | `#461902` | `#5E3B1E`（wood_edge） | 3D 更红更暗 |
| 木·中 | `#662D0A` | `#8A5B34`（wood_face） | **3D R−G 差 73，项目 47** |
| 木·亮 | `#91481B` | `#B98A5C`（wood_sheen） | 3D 饱和度 0.81，项目 0.62 |

**这不是"同一色系深浅不同"，是红棕焦糖 vs 灰褐胡桃两个色系。**
换版必须同步更新 `tokens.md` 的 wood 族并复验文字对比度（`wood_text` 对 `wood_face` 现为 5.4:1）。

### 2.4 参考图

用本目录上级的两张稿做风格参考（只给风格，不要给版式）：

- `proposals/menu-3d-style-20261030/reassemble.png`（单橱窗，元素最清晰）
- 整版木屋稿（用户在会话中提供，未入库）

---

## 3. 资产清单

设计基准 **750×1334**，交付像素 = 绘制尺寸 × 2。

### 批 1 · 主菜单骨架（9 件，先做这批）

| # | 资产 | 绘制（设计 px） | 交付（@2x） | 透明区要求 |
|---|---|---|---|---|
| 1 | `menu_signboard` 招牌（板 + 蝴蝶结 + 双绳）**含「拼豆小铺」珠字（§9-② 例外件）** | 370×298 @x190 | **740×596** | 绳顶端到图边留 ≥24px；文案逐字目检 |
| 2 | `menu_case` 橱窗（拱顶 + 框 + 底座） | 544×871 @x107 | **1088×1742** | **玻璃区必须真透明**（中心镂空） |
| 3 | `case_plate` 名牌（**无文字**、**自带深木胶囊**） | **304×83**（v0.2 订正，旧 214×100 作废 = 基准稿 v2 实测，拆册件 §2） | **608×166** | 胶囊 130×26 r13 烘焙于牌内（⛔ 不程序化、⛔ 不进 palette）；四周 8% 透明边；两行字均运行时绘制 |
| 4 | `btn_start` 开始按钮·常态 | 324×92 | **648×184** | 四周 8% 透明边，两端可切 |
| 5 | `btn_start_pressed` 开始按钮·按下 | 324×92 | **648×184** | 同上，整体下沉观感 |
| 6 | `btn_arrow` 左右箭头钮（一对） | Ø80 | **160×160** ×2 | 圆形，四角全透明 |
| 7 | `btn_circle` 顶栏圆钮·常态 | Ø80 | **160×160** | 圆形，四角全透明，**无图标** |
| 8 | `btn_circle_pressed` 顶栏圆钮·按下 | Ø80 | **160×160** | 同上 |
| 9 | `menu_pot` 陶盆（左下角装饰） | 105×207 | **210×414** | 已有一版，可重出更清晰的 |

### 批 2 · 图标（6 件，第二批）

| # | 资产 | 交付 | 说明 |
|---|---|---|---|
| 10 | `icon_settings` 齿轮 | **120×120** | 绘制 Ø40 |
| 11 | `icon_calendar` 日历 + 对勾 | **120×120** | 签到入口 |
| 12 | `icon_rank` 奖杯 / 领奖台 | **120×120** | 好友榜入口 |
| 13 | `icon_skin` 衣架 + 圆领衫 | **120×120** | 装扮馆入口 |
| 14 | `icon_coin` 金币 | **120×120** | 资源条 |
| 15 | `icon_stamina` 爱心 / 体力 | **120×120** | 资源条 |

### 批 3 · 暂不做

9-slice 面板（`ui_panel_*` / `ui_btn_wood_*` / `ui_btn_paper_*`）服务结算弹窗，等主菜单定稿后再统一。

---

## 4. 每件的提示词

前缀统一用 §2.1，下面只给「主体描述」——拼成 `§2.1 + 主体描述`。

| # | 主体描述 |
|---|---|
| 1 | `a hanging wooden shop signboard, arched plank with carved border, a pink ribbon bow on top center, two twisted hemp ropes going up out of frame, blank plank area in the middle (no text), small heart carving` |
| 2 | `a wooden display cabinet seen from the front, arched crown with a carved heart in the center, thick rounded frame, four glass panes, **the glass area fully transparent / hollowed out**, warm wooden base, small feet` |
| 3 | `a small wooden name plate, rounded rectangle plank, four tiny rivets at corners, blank center (no text)` |
| 4 | `a large rounded wooden button, caramel wood, glossy top highlight, thick bottom edge, blank face (no text)` |
| 5 | `a large rounded wooden button pressed down, caramel wood, highlight reduced, bottom edge compressed` |
| 6 | `a round wooden button, thick rounded rim, a cream-colored chevron arrow in the center pointing left` |
| 7 | `a round wooden button, thin rounded rim, blank cream face, soft inner shadow` |
| 8 | `a round wooden button pressed, thin rounded rim, blank cream face, slightly darker` |
| 9 | `a small terracotta flower pot with a cluster of pink and white blossoms and green leaves` |
| 10 | `a small cream-and-wood gear icon, eight teeth, warm white face` |
| 11 | `a calendar icon, cream paper with a wooden top bar, a green check mark` |
| 12 | `a trophy icon on a three-step podium, warm cream and wood` |
| 13 | `a clothes hanger with a small round-neck shirt, cream and wood` |
| 14 | `a gold coin with a bead pattern embossed, warm gold` |
| 15 | `a heart icon made of tiny beads, warm pink` |

---

## 5. 硬性交付要求

1. **格式**：PNG，RGBA，真 alpha（不是画上去的棋盘格）。
   > 判据：`alpha` 通道必须有 `=0` 的像素；全图 `alpha=255` 一律退回。
2. **分辨率**：按 §3 表给足，**只许多不许少**。宁大勿小（大图我可以缩，小图补不回来）。
3. **四周留白**：每件四周留 **8% 透明安全边**，不要贴边裁切。
4. **单一物件**：一张图只放一件，不要"套装图"。
5. **无投影 / 无边框 / 无背景场景**；**无文字** = 默认硬要求，仅 #1 招牌与 #4/#5 开始钮两件例外（§9-②）。
6. **命名**：按 §3 表的文件名，扩展名 `.png`。

---

## 6. 验收标准（可机械判）

| 项 | 判据 | 不过怎么办 |
|---|---|---|
| 真透明 | `alpha.min() == 0` 且 `(alpha==0).mean() > 5%` | 退回重出 |
| 无贴边 | 四边 8% 区域内 `alpha` 全为 0 | 退回重出 |
| 尺寸达标 | 宽 ≥ 表中值 × 0.98 | 退回重出 |
| 单一物件 | 连通域数量 = 1（箭头/双子件除外） | 退回重出 |
| 无投影 | 底部 12% 区域内无"落地渐变灰" | 人工判，见下 |
| 无文字 | 目检无字符（**两件例外**按 §9-② 反向校：文案逐字必对、无伪汉字） | 退回重出 |
| 风格一致 | 与参考稿并排目检，色相/体积/光向一致 | 人工判 |

**「无投影」的机检近似**：取底部 12% 区域，计算 `alpha` 的 5% 分位；若该区域存在连续的低 alpha（0.05–0.35）横带，即为投影残留。

**机检入口（已入库）** = `games/beads/design/ai-workflows/cut-single-local.py`（一件一图原图 → 去底 → 五道判据，`--check` 跑内置合成自检）。三条口径在此说清，免得后人以为是放水：

1. **背景判定用投影法**（沿用 `cut-sprites-local.py` 的 `KEEP_SHADOW=0` 口径：`perp<thresh 且 t∈[cn-90,cn+2]`）——⛔ 不能用「与背景色欧氏距离够远就算前景」，实测那条会把中性灰落地投影一起吃进 alpha（底部 6 行不透明率 85–94%，换背景即双影）。
2. **四边 8% 安全边 = 切图器合成**（加的是全透明像素，⛔ 不重绘）；源图主体贴画框时另打 `⚠ 源图主体贴画框` 提醒——那才是真风险信号（物体被裁 = 件不可用）。
3. **长宽比容差 10%**：交付件由运行时按**设计框非等比绘制**，无烧字的木件上 9% 拉伸不可见；含字件不适用本条（字体会变形），须逐字目检。

---

## 7. 包体结论：换版反而省空间

现有 menu 位图**没做调色板量化**，量化后能省 81–98%（实测）：

| 资产 | 现状 | 256 色 | 省 |
|---|---|---|---|
| `ui_showcase_frame` | 1187.1 KB | 102.9 KB | 91% |
| `ui_wood_frame` | 614.8 KB | 10.6 KB | 98% |
| `ui_menu_logo` | 594.9 KB | 112.6 KB | 81% |
| `ui_wood_grain` | 329.6 KB | 29.1 KB | 91% |
| `ui_showcase_plate` | 66.0 KB | 6.1 KB | 91% |
| `ui_btn_start_9s` | 38.8 KB | 5.5 KB | 86% |
| **合计** | **2831 KB** | **267 KB** | **91%** |

批 1 九件按 @2x + 256 色估算 **约 400–500 KB**。

⇒ **净变化约 −2.3 MB**。beads 主包现 3700.8 / 4096 KB（余 395.2 KB），换版后有充裕空间。
⇒ 但**前提是新素材也做 256 色量化**，且现有大件同步量化——这一条本身就该单独做一次，与换版解耦。

---

## 8. 待办与风险

- [ ] 用户在外部平台按 §3/§4 出图，回传 `批 1` 九件
- [ ] 我这边接：`MENU_TEXTURES` 增 id → harness / cocos carrier 注册 → `drawMenuBackdrop` / `drawMenuAnchored` 换 blit
- [ ] **9-slice 一致**：`btn_start` 两端端帽要能被 `MENU_CTA_SLICE`（capX 76 / capY 96）切，出图时两端保持纯色木纹、不要放装饰
- [ ] **色板变更**：wood 族换红棕后，`tokens.md` 与所有 `wood_text` 对比度需复验（现 5.4:1）
- [ ] **金样本**：菜单族六态命令数会变，须由 `ui-golden-capture.ts` 在提交锚重抓（K-051/K-053）
- ⚠ **Cocos `.meta`**：新图投放 `textures/` 后需编辑器导入生成，L1 禁止手建

---

## 9. v0.2 三项裁定（用户 2026-10-31 · WXG-T-525）

### ① 分辨率路线 = 丙（混合）

| 路 | 适用件 | 口径与实测 |
|---|---|---|
| **整屏稿切**（云 `qwen-image-3.0` `--size 1152*2048`）| 仅 **#1 招牌** + **#4/#5 开始钮**（= 要烧字的两件，得靠整屏版面保证与背景一致）| 缩放 = 1152/750 = **1.536×**，@2x 需 2.0 ⇒ 上采样 **1.30×** ⇒ 低于 1.36× 判废线（2026-10-13 判例）**但属边界**⇒ 必配平涂度 + 目测（`wxgame-image-gen` §4），边缘发虚即退回改走逐件 |
| **逐件 2× 独立出**（本地 t2i 平色底 + bbox 自裁）| **#6–#15** 全部小件（4 图标 / 箭头×2 / 顶栏圆钮×2 / 双图标 / **木牌**）| 单件直接出到目标尺以上（宁大勿小），不吃整屏的上采样；平色底走洪泛/键出，⛔ 不上模型抠图 |
| **以旧件 i2i 直出 @2x** | **#2 橱窗框** | 先例在册 = WXG-T-522（旧窗框 i2i → 1088×1742）；玻璃内保持**空镂空** |
| **同名覆盖** | **背景件** | 全屏背板腿**已在册已接线**（`src/view/meta-menu.ts:552-554` `builder.blit(backdrop, 0, 0, DESIGN_W, a.H)`，双分支回落），⛔ 不新建纹理位、不改代码，只换位图内容（L1 允同名覆盖）|

### ② 含字例外（两件）

招牌烧「拼豆小铺」、开始钮烧「开始游戏」（其余各件仍 ⛔ 无字）。依据 = 单元素短文案可烧图（本地 25 步实测 4/4 全对），整屏多标签仍必乱。**代价 = 文案一改必重出该件** ⇒ 两件文案已锁为稳定串（游戏名 / 固定按钮词），可变文案一律走运行时 `builder.text`。

### ③ 背景与橱窗 = 视觉一体、绘制分件

用户要「背景图包括橱窗」⇒ 采 **观感一体、绘制仍分两件**（背景件 + 橱窗件）。
**硬理由**（不是懒）：现背板腿 blit 到 `DESIGN_W × a.H`，而系高逐机 1334→1630 变 ⇒ **背板必被纵向拉伸至 1.22×**。烘进背板的家具必变型，而「橱窗拉伸」案已被用户于 v3.3 当面否掉。分件后：橱窗尺寸恒定、落位仍走 `case0`（组隙 1:2）、**五档验收账与落位链一条不用重算**；玻璃内图形（豆画 / 木牌 / 徽标 / 飘带）全部运行时程序化叠加，与现有走马灯裁切区口径一致。
