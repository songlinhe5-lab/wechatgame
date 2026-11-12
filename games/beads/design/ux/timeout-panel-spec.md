# UX 规格 · 倒计时结束弹窗（Timeout Dialog）· beads

- 项目：`games/beads` · 版本 **v1.0（2026-11-11 · WXG-T-614）**：首版。**Figma 单源重排** —— 普通模式 GAME_OVER 的失败弹窗由「纸面板 + 480×88 双钮」换成稿面**木牌 + 双木质钮**；本文只写「稿面读数 + 落地映射 + 偏差」，几何单源在代码侧 `src/config/tuning/timeout-panel.ts::TIMEOUT_GEO`（绘制与热区共读，⛔ 本文不另抄一份数字表当第二真源）。
- **设计真源**：Figma 文件 `PBIK3RbfGlfzFsAnd97ZsP` · 页 `225:126 倒计时结束弹窗` · 帧 **`231:281 抠图层`**（750×1334）。2026-11-11 全量子树实读（`temp/figma/timeout/node.json` + 两枚组件集 `btn-continue.json` / `btn-retry.json`）。木牌可见面 IMAGE ref = **`f886360b…`**（同节点另一枚 `c405970e…` 已 `visible:false`，⛔ 不取）。
- **坐标口径**：帧原点在画布 `(1124,−532)` ⇒ 下文坐标已扣除该偏移，口径 = **帧内 750×1334、y 向下**。代码口径 = y 向上、`box.y` = 下缘；`TIMEOUT_GEO` 存**牌内相对锚**（原点 = 木牌左上角），换算 `yUp = plate.yMin + plateH − yDown(− h)`。逐机位移只加在牌框（`dialogShiftY()`，**WXG-T-323 中心不变式**：两档牌中心恒 = 屏中心 + 位移），内容锚一律相对牌顶 ⇒ 换屏不撕裂。
- **本文射程**：普通模式倒计时归零弹窗的版面、文案、资产、数据映射与热区。**不射程**：冲刺结算（`ux-spec §3.5` 左列，无续时）、重试扣心与广告加心闸门（`systems-index §3.14`）、激励位接入（`§3.11`）、暂停 / 过关 / 购买确认三面板（仍走纸面板族）。
- **上位正本**：交互与文案口径 = `ux-spec §3.5`（**v1.45** 已按本批回写）；续时秒数 = `systems-index §3.11` **`REVIVE_BONUS_SEC = 180`**（v1.25 冻结）；每关续时次数 = `REVIVE_MAX_PER_LEVEL`；三契约 = `docs/architecture/ui-architecture-beads.md §5`；机械门 = `control-manifest §20`。兄弟页同语言规格 = `level-detail-spec.md`（木牌容器 / 标题投影 / 缺图元素级换皮）。
- **判据**：`tests/timeout-view.test.ts` 5 例（VM 复用与命中同引用 / 位图腿三枚 blit + 文字让位 / 缺图零 blit / 广告在播禁用双通道 / 仅重试档牌高与中心不变式）+ `tests/revive.test.ts`（几何与文案）+ `tests/bead-style-settings.test.ts`（§20 静态门穷尽到本文件）。

---

## 1. 设计原则

1. **一屏一决定**：弹窗只承担「续时接着打，还是重开这一关」，⛔ 不放选关 / 商店 / 设置等第二任务，⛔ 不做倒计时强迫选择（`ux-spec §3.5` Won't）。
2. **木牌即容器**：牌体、两钮同属详情 / 选关页那套木作语言；缺图时**逐元素**回退到同几何程序化档（元素级换皮，⛔ 不做第二套版式）。
3. **数据不进视图**：View 是纯函数 `(builder, vm, palette)`，⛔ 不 import 快照 / shell / 游戏对象，⛔ 不出现 `overlay ===` / `phase ===`（L5 + §5）。
4. **绘制与命中同源**：钮框由 VM **直接引用** `failPanelLayout()` 的缓存 `PanelRect`（不复制坐标、不新建框）⇒「画 A 位按 B 位」结构性不可能。

## 2. 界面流

```
玩法（playing）倒计时归零
   ▼
失败弹窗（GAME_OVER · mode=normal · 模态遮罩 UI_SCRIM.canvas）
   ├ 主钮「继续本关」 revive  → 激励视频 → onRewarded ⇒ 钟 +180 秒、盘面进度保留、关窗续打
   │                          （未看完 / 跳过 ⇒ 停在本弹窗，钟不加）
   ├ 次钮「重试本关」 retry   → 一次新局开局，扣 STAMINA_START_COST 心（0 心 ⇒ 广告加心闸门，§3.14）
   └ 续时已用尽（reviveAvailable=false）⇒ 只画次钮 + 说明行「本关已续时」，牌高 586 → 404
```

- **无关闭出口**：稿面无 ✕，失败态也不允许「点牌外空白 dismiss」—— 弹窗必须由两钮之一收口（⛔ 与选关 / 详情页的双出口口径不同，那两页可退回菜单，本页退回菜单会丢失「这一关还没打完」的语义）。
- 冲刺归零**不走本弹窗**（无续时），只走冲刺结算。
- 框架未接广告 API（Noop Provider）：主钮可画，点击 = 牌底一次性提示「即将开放」，**面板不关、钟不加、零 `wx` 调用**。

## 3. 稿面版式（帧内坐标 · y 向下）

| 件 | Figma 节点 | x | y | w | h | 落地 |
|---|---|---|---|---|---|---|
| 对话框背景（矩形） | `231:283` | 85 | 145 | 581 | 1044 | ⚠ 只是空矩形，**图内木牌仅占 alpha bbox** (16,211)–(565,797) |
| 木牌可见面 | 同上（alpha 裁切） | **101** | **356** | **549** | **586** | 整张烘图（木框 + 四角铆钉 + 标题横带 + 底留白），九宫格纵向可压 |
| 板标题「时间到」 | `231:284` | 185 | 400 | 380 | 96 | 文字层（牌内中线 cyDown **92**） |
| 续时主钮 | `233:54`（组件集 `233:36`） | 163 | 533 | 426 | 154 | 整枚烘图**只含左侧胶片 ▶ 图标**，文字运行时画 |
| ↳ 主行「继续本关」 | `I233:54;233:39` | 293.5 | 561 | 260 | 53 | 文字层（钮内 cx **260.5** / cy **54.5**） |
| ↳ 副行「看广告能增加60秒时间」 | `I233:54;233:40` | 293.5 | 629 | 260 | 24 | 文字层（钮内 cx 260.5 / cy **108**）；**秒数改 180**，见 §5 |
| 重试次钮 | `233:58`（组件集 `233:46`） | 168 | 715 | 417 | 137 | 整枚烘图只含左侧循环箭头图标 |
| ↳ 主行「重试本关」 | `I233:58;233:49` | 292 | 757 | 260 | 50 | 文字层（钮内 cx **254** / cy **67**） |
| 说明行「本关已续时」 | —（产品补） | 牌中轴 | cyDown 158 | — | — | 仅重试档；落在标题横带下缘 139 与钮上缘 177 之间的 38px 净空 |
| 一次性提示（`failHint`） | —（产品补） | 牌中轴 | 距牌底 45 | — | — | 牌底留白带中线（586 档 yDown 541） |

- **两钮水平居中于牌**：稿左余 62 / 67 vs 右余 61 / 65，差 ≤2px 属生成图容差 ⇒ 落地统一居中（⛔ 不抄那 2px 偏差）。
- **文字让开烘入图标**：主行槽中心比钮心右偏 **47.5 / 45.5**（实测图标占钮内 0–153.5 / 0–136.5）⇒ 位图腿用稿面 `textCx`；**回退与禁用腿无图标 ⇒ 文字回钮心**（⛔ 不留一段莫名左偏）。
- **仅重试档**：牌高 `586 − 154（主钮）− 28（净距）= 404`，重试钮**上移进主钮槽**（yDown 177），牌底留白 90 不变 ⇒ 不出现「一大块空木面」；两档共用同一张位图，靠九宫格压中段（§6）。
- 稿面**无遮罩层**（背景是整屏场景图）⇒ 运行时沿用弹窗通用浓度 `UI_SCRIM.canvas`（与暂停 / 结算同档，⛔ 不用菜单 overlay 黑）。

## 4. 字体与颜色（稿面 → 运行时）

| 件 | 稿面 | 运行时 | 说明 |
|---|---|---|---|
| 板标题 | Chiron GoRound TC **800 / 64** · `#F9D8A7` | `UI_FONT.detailTitle`（bold 64 系统字）/ `palette.woodText` | canvas 无 Chiron 字族；墨**不沿用**兄弟页 `plateSubInk`（对比不足，§4.3） |
| 续时主行 | Noto Sans SC **700 / 44** · `#F7EBC4` | `UI_FONT.timeoutAction`（bold 44）/ `woodText` | 新增语义键（⛔ 不复用 `button` 30） |
| 重试主行 | Noto Sans SC **700 / 42** · `#F7EBC4` | `UI_FONT.timeoutRetry`（bold 42）/ `woodText` | 同上 |
| 续时副行 | Noto Sans SC **700 / 20** · `#F5E23C` | `UI_FONT.plateSub`（**22** bold）/ `STAR_GOLD` | 20 → 22 = 可读地板档（同 `T-599` 口径）；金墨 ≈ 稿亮黄 |
| 说明行 / 一次性提示 | —（产品补） | `bodyFont(largeText,'sub')`（22 / 28 bold）/ `woodText` | 属说明类 ⇒ 随 `largeText`；钮内字**不随**（按钮族固定档） |
| 主行 / 说明行描边 | SOLID `#5A2E08`（`strokeWeight` 缺省 **1**） | `palette.plateTitleInk` `#563113` | RGB 最大差 11/255，肉眼不可辨 ⇒ 零新增 hex |
| 副行描边 | SOLID `#3B2A05` | `palette.shadowInk` `#3D2E1E` | RGB 最大差 25/255 |
| 钮内文字投影 | DROP_SHADOW `#3B1E05` **α0.80** · (0,+3) · blur **0** | `withAlpha(shadowInk,0.8)` · offsetY **−3** | y 向下 → 视图取负；三枚文字同参 |
| 禁用态（广告在播） | —（稿无此态） | 面 `woodFaceDisabled` + 字 `woodText`@**60%**，无描边无投影 | `screens.md §4` 矩阵 T3「禁用」列 = 可点性消失双通道 |

- **色表锁零改动**：本批**零新增 hex**（53 条 / sha1 `248d326a306c` 不变）；稿面 `#F7EBC4` / `#F9D8A7` 一律近似到既有 `woodText #FFF6E8`（最大差 36 / 65 于蓝通道，属「暖奶油 ↔ 米白」同族），⛔ 不为 2 个近似色开新令牌。
- 两枚组件集各带 `State=Normal / Highlight` 两态，但**稿面弹窗实例只用 Normal**；Highlight 的差是滤镜提亮 ⇒ 落地按下态走既有 `pressOffset()` 位移（`reduceMotion` 时归零），⛔ 不导第二套位图（省体积、与全站按下口径一致）。

### 4.1 描边术式（`TextCommand` 无 stroke ⇒ 5 pass 复刻）

稿面三枚钮内文字均带 SOLID 描边，而框架 `TextCommand` 只有 `shadow` 没有 `stroke` ⇒ 用**四向深墨垫底 + 面字带硬投影**复刻（术式同 `drawCloseInset` 的双 pass 嵌线）：

| pass | 偏移（设计 px） | 墨 | 备注 |
|---|---|---|---|
| 1–4 | (−2,0) / (+2,0) / (0,−2) / (0,+2) | 主行·说明行 `plateTitleInk`；副行 `shadowInk` | 等效 ≈2px 描边（稿 1px，见 §10-3） |
| 5 | (0,0) | 面墨（`woodText` / `STAR_GOLD`） | 带 `shadow` = `shadowInk`@0.8 · (0,−3) · blur 0 |

- **这不只是像稿**：绿钮面自带高光渐变，奶油墨压亮部实测只有 **2.13:1**（§4.3）；垫底后字对深墨恒 **10.63:1** ⇒ 描边是**可读性构件**，不是装饰。
- 每行 5 条 text 命令（主行 2 + 副行 1 = 15 条 / 双钮档）；命令数已进金样本 `fail` 态读数（§10-6）。

### 4.2 板标题文字效果（`231:284.effects`）

| # | 类型 | 颜色 | 位移（x, y↓） | 模糊 | 落地 |
|---|---|---|---|---|---|
| ① | INNER_SHADOW | `#FFF4D6` α0.902 | (0,+3) | 2 | ⛔ 未实现（文字管线单色填充，无内阴影） |
| ② | INNER_SHADOW | `#8A4B1A` α0.702 | (0,−2) | 2 | ⛔ 未实现（同上） |
| ③ | DROP_SHADOW | `#5A2F0D` α0.80 | (+9,+7) | 3 | ✅ 已落：`TextCommand.shadow`，参数复用 `LEVEL_DETAIL_TITLE_SHADOW`（与详情页逐字同参 ⇒ 零新常量） |

- 三端分差沿用详情页口径：Canvas 原生含 blur 3 / Cocos 双 `Label` 只落偏移副本 / SVG 双 `text` 不含 blur。
- 令牌色差：稿 `#5A2F0D` ↔ `plateTitleInk #563113`，RGB 最大差 6/255。

### 4.3 对比度实测（可复算）

**方法**：PIL 读 `final/assets/detail/` 三枚 @2x 正本 → 取**字形矩形**（设计 px ×2；矩形 = 文案字数 × 字号 宽、字身 0.88×字号 高，中心 = §3 的文字锚）内 `α>200` 的像素 → WCAG 相对亮度 → 逐像素对比取 min / mean。
**⛔ 不用整条横带取样**：整带会混入木框高光与铆钉（同带 min 掉到 **1.16**），那是取样污染，不是文字实际落位 —— 本批一度按整带读数判「标题不可读」，改字形矩形后结论反转。

| 件 | 墨 | 底（取样区） | min | mean | 门 | 判 |
|---|---|---|---|---|---|---|
| 板标题「时间到」 | `woodText` | 木牌标题横带 192×56 | **3.78** | 4.81 | 3:1（64 bold） | ✓ |
| ↳ 若沿用兄弟页墨 | `plateSubInk` | 同区 | 2.68 | 3.41 | 3:1 | ✗ ⇒ 本页改 `woodText` |
| 说明行「本关已续时」 | `woodText` | 亮木面 110×20（large 140×24） | 2.73 | 3.21 | 3:1 | ✗ 单墨 ⇒ **描边垫底** |
| 垫底后（说明行 / 主行） | `woodText` | `plateTitleInk` | **10.63** | — | 4.5:1 | ✓ |
| 续时主行 | `woodText` | 绿钮面 176×38 | **2.13** | 3.07 | 3:1（44 bold） | ✗ 亮部 ⇒ **描边垫底** |
| 重试主行 | `woodText` | 蓝钮面 168×36 | 3.73 | 5.04 | 3:1（42 bold） | ✓（仍描边，同族一致） |
| 续时副行 | `STAR_GOLD` | 绿钮面 234×20 | **4.37** | 4.77 | 3:1（22 bold ≥18.66px bold = 大字号档） | ✓（垫底后对 `shadowInk` 9.04） |
| 一次性提示 | `woodText` | 牌底留白 88×20 / large 112×24 | 3.26 / **3.04** | 3.71 / 3.68 | 3:1（22 / 28 bold） | ✓ |
| 回退主行 | `text #2A2E43` | `success #3FBF6B` / `hintBlue #3D7BF5` | **5.65 / 3.41** | — | 3:1（44 / 42 bold） | ✓ |
| 回退副行 | `text` | `success` | 5.65 | — | 3:1（22 bold） | ✓ |
| 禁用主行 | `woodText`@0.6 → 混色 `(232,218,200)` | `woodFaceDisabled #C7B299` | 1.50 | — | — | **R-8 登记豁免**（禁用态刻意低对比 = 可点性消失双通道，`screens.md §4` T3） |

## 5. 文案与漂移登记

| 位 | 稿面 | 落地 | 依据 |
|---|---|---|---|
| 板标题 | 「时间到」 | `FAIL_PANEL_TITLE = '时间到'` | 逐字取稿（旧实现的 ⏰ emoji 退场） |
| 续时主行 | 「继续本关」 | `failPanelLabel('revive')` | 逐字取稿；**旧 `+180秒 继续本关` 退场** —— 稿面主行无时长，时长落副行 |
| 重试主行 | 「重试本关」 | `failPanelLabel('retry')` | 逐字取稿 |
| 续时副行 | 「看广告能增加**60**秒时间」 | **`看广告能增加180秒时间`** | ⚠ **漂移登记**：`systems-index §3.11` **v1.25（WXG-T-149）** 已把 `REVIVE_BONUS_SEC` 60 → **180**，稿面文案是过期值 ⇒ 按 AGENTS §4「代码与 §3 冲突以 §3 为准」取 180；文案由 `failPanelHint()` **从常量派生**（模块级一次成串 ⇒ 逐帧同一引用、零分配），⛔ 不散落字面秒数。**待设计侧回稿**（§11） |
| 说明行 | —（稿无） | `FAIL_PANEL_SUBTITLE = '本关已续时'` | 产品补文案，`ux-spec §3.5` 原文即允许「可加一句『本关已续时』」 |
| 一次性提示 | —（稿无） | `snap.failHint`（如 Noop 广告「即将开放」） | 既有字段，落牌底留白带 |

- 文案**全部**收在 `systems/fail-panel.ts`（与命中侧同一文件）⇒ VM 只做引用透传，View 零字面文案。
- 本节四条上屏文案属弹窗内文本，未进 `COPY_TOKENS`（与暂停 / 结算面板同口径：面板文案由 systems 侧常量持有）；⛔ 不新增第二份副本。

## 6. 资产台账

| 件（`final/assets/detail/`） | 规格 | 来源 | Cocos 投放件（`cocos/assets/textures/detail/`） |
|---|---|---|---|
| `ui_timeout_plaque@2x.png` | 1098×1172 · 883.3 KiB | Figma `231:283` @2x 导出 → **alpha bbox 裁切**（零透明边） | `ui_timeout_plaque.png` **74.7 KiB** |
| `ui_timeout_continue@2x.png` | 852×308 · 263.3 KiB | Figma `233:54` @2x（含 ▶ 图标，**不含文字**） | `ui_timeout_continue.png` **23.0 KiB** |
| `ui_timeout_retry@2x.png` | 834×274 · 236.8 KiB | Figma `233:58` @2x（含循环箭头，**不含文字**） | `ui_timeout_retry.png` **27.2 KiB** |

- **投放件配方 = `ship_rgba_octree()`**（`games/beads/design/ai-workflows/quantize-cocos-textures.py`，按 `menu-v2-ship.py` 的 exec 去尾行 `main()` 术式调用）：三件均**单态**（无同族两态）⇒ 走 octree；实测对照 `ship()` = 246.6 / 127.6 / 111.6 KiB（**3.6×** 体积，且 `ship()` 保 α 逐像素同）⇒ 按仓约定（BD-61：有同族两态才必须 `ship()`；先例 T-584 §10 / T-585）取 octree。⚠ **口径披露**：该脚本 docstring 把 octree 注为「只用于对照、⛔ 不再作为产出」—— 那是 **BD-61 菜单按钮批**的口径（防同族按下暗边被并色），本批无同族态故不适用；选型理由与对照读数已入 `production/qa/asset-provenance.md §12`。
- **质量读数（可复算）**：共同可见区（双方 α>0）RGB mean/max 差 = **2.932/51**（牌）、**3.090/39**（续时）、**3.276/44**（重试）；alpha mean/max 差 = **1.03/39**、**1.28/38**、**1.18/45**，α 误差 >8 只占 **0.356% / 1.001% / 1.012%**、>32 占 **≤0.0114%**（均在边缘抗锯齿带）；牌 96.5% 像素 α255、partial 2.52%，两钮 α 主峰 **252–255**（近不透明）⇒ octree 对 alpha 的扰动不影响边缘观感。写盘后**回读逐位一致**已断言。
- **包体**：`textures/` 目录 1900 → **2028 KiB（+125 KiB）**。
- **九宫格**：`nineSliceFx(capX 120, capY 300)`（**源纹 @2x px** 口径）⇒ capY 300 = 150 设计 px，上端帽盖住整条标题横带（牌内 44..140）、下端帽盖住底角铆钉；capX 120 = 60 设计 px 盖住左右角铆钉；中段纯木纹 ⇒ 404 档纵向压缩不撕裂任何结构件。原高档（586）两轴均为**恒等拉伸**（1172 − 600 = 572 = 586×2 − 300×2）。canvas2d 预烘、Cocos 走 `Sprite.Type.SLICED`（carrier 已通用支持，**零新宿主代码**）。
- **`.meta` 已签发且进包核验（WXG-T-615 追闭 · 2026-11-12）**：并发 Trae CN 会话的 Cocos 编辑器已为三枚 PNG 签真 `.meta`（`importer:image` ver 1.0.27）；今晨 09:26 `build:cocos` 产物 `assets/textures/config.json` 三枚 **9 条 paths 全在**（image/texture/spriteFrame），native/import 实体齐备，uuid 压缩形对撞命中（`bd9662bc…`→`bdlmK8Vwp…`），carrier 注册路径与 paths 逐字一致；微信包总 **3700 KiB < 4MB** 红线（无分包）。`.meta` 仍属并发产物，本批⛔ 不代提（K-045 / K-137），待其会话自登。
- 来源与量化口径另记 `production/qa/asset-provenance.md **§12**`（含复现命令、云端原图节点与 α 误差分布）。

## 7. View / ViewModel / Presenter 落点（§5 三契约）

| 层 | 文件 | 职责 | 硬约束 |
|---|---|---|---|
| **Presenter** | `view/view-model.ts::drawFailPanel` | 判 `usesFailOverlay(snap)`（`phase==='game-over' && mode==='normal'`）→ 投影 → 调 View；**三行门面** | 导航判断只在这一层 |
| **ViewModel** | `view/timeout-view-model.ts` | `createTimeoutViewModel()` 预分配一张（2 钮槽）+ `updateTimeoutViewModel(vm, snap)` 逐帧覆写 | 只含展示字段；View 侧类型 `readonly`；**零数组 / 零字符串分配**（文案全为模块级常量或同一引用） |
| **View** | `view/timeout-view.ts` | `drawTimeoutView(builder, vm, palette)` 纯函数 | ⛔ 不 import 快照 / shell；⛔ 无 `overlay===` / `phase===`；⛔ 无 `rgba(` 字面量（§20-2，色串一律 `withAlpha`） |
| **布局 / 命中** | `systems/fail-panel.ts` | `failPanelLayout(reviveAvailable)` 双档缓存 + `hitFailPanel()` | 两侧读**同一** `PanelRect` 引用（§20-4：`hit*()` 必须调 `*Layout()`） |
| **几何单源** | `config/tuning/timeout-panel.ts` | `TIMEOUT_GEO`（牌内锚）+ `TIMEOUT_TEXTURES`（只存 id） | 资产路径属宿主，⛔ 不进 tuning |

**数据映射（`BeadsSnapshot` → VM）**

| VM 字段 | 来源 | 缺失 / 边界 |
|---|---|---|
| `plate` / `buttons[i].rect` | `failPanelLayout(snap.reviveAvailable)` | **直接引用**缓存框（含 `dialogShiftY()`） |
| `title` / `subtitle` | `FAIL_PANEL_TITLE` / `layout.subtitle` | 双钮档 subtitle = `''` ⇒ 不画 |
| `buttons[i].label` / `hint` | `failPanelLabel(id)` / `failPanelHint()` | 副行只续时钮有 |
| `buttons[i].disabled` | `id==='revive' && snap.watchingAd` | 禁用腿：面 `woodFaceDisabled` + 字 60%，位图退场 |
| `buttons[i].pressDy` | `pressOffset(snap.pressedButton===id, snap.reduceMotion)` | 投影时算好，View ⛔ 不读全局设置 |
| `hint` | `snap.failHint` | `''` ⇒ 不画 |
| `largeText` | `snap.largeText` | 只作用说明行 / 一次性提示 |
| `buttonCount` | `layout.buttons.length` | 预分配 2 槽但只画 `buttonCount` 个（⛔ 不画陈旧槽） |

**宿主注册**：harness `dev/harness/main.ts` 资产表三条（`/detail-assets/ui_timeout_*@2x.png`，白名单已覆盖）；Cocos `host/beads-blit-carrier.ts` 三条 path（`detail/ui_timeout_*`）。任一枚未注册 ⇒ 该元素走 §9 回退。

## 8. 交互与热区

| 钮 | 热区 | 提交 | 结果 |
|---|---|---|---|
| `revive` | **= 视觉框** 426×154（牌内 yDown 177） | 抬起且同钮（`input-control.md`） | 激励视频 → `onRewarded` ⇒ 钟 +`REVIVE_BONUS_SEC`、进度保留 |
| `retry` | **= 视觉框** 417×137（双钮档 yDown 359 / 仅重试档 yDown 177） | 同上 | 新局开局，扣 `STAMINA_START_COST` 心（0 心 ⇒ 广告加心闸门） |

- **不做 `TOUCH_MIN` 扩张**：两框最小边 137 ≫ 88 ⇒ 视觉即热区（与 v2 主菜单 `hitAt = max(视觉, TOUCH_MIN)` 同口径，此处 max 取视觉）。
- **按下态只动绘制不动命中**：`pressDy` 只加在 blit / rect 的 y，`rect` 引用不变 ⇒ 手指按住时判定框不跟着沉（判据已钉）。
- 广告在播（`watchingAd`）：主钮禁用（面 + 字双通道），**次钮仍可点**（重试不依赖广告）。
- 牌内 / 牌外空白**均不关窗**（§2）。

## 9. 缺图回退（元素级换皮 · 同几何）

| 元素 | 有位图 | 缺位图 |
|---|---|---|
| 木牌 | `blit(plaque, fx=nineSlice)` | `drawPaperPanel(同框, r=28, UI_CONTAINER.shadowAlphaPanel)` |
| 续时钮 | `blit(continueBtn)` | `rect(同框, r=24, fill=palette.success)` |
| 重试钮 | `blit(retryBtn)` | `rect(同框, r=24, fill=palette.hintBlue)` |
| 钮内文字 | 稿面 `textCx`（让开图标）+ `woodText` / `STAR_GOLD` | **回钮心** + `palette.text`（亮面换深藏青，5.65 / 3.41:1 ✓） |
| 遮罩 / 标题 / 说明行 / 提示 | 程序化（无位图腿） | 同左 |

- 回退腿**零 blit**、命令流仍带描边 5 pass（单一代码路径，⛔ 不为回退另写一套画法）。
- 三件**逐枚独立判定**（`menuBitmapReady`）⇒ 只缺钮图时牌仍是木牌，⛔ 不整窗降级。

## 10. 偏差登记（有意为之，非缺陷）

1. **副行秒数 60 → 180**：稿面文案过期，以 `§3.11` v1.25 冻结值为准（§5）。**这是本批唯一与稿面文字不一致处**，待设计侧回稿。
2. **主行去掉 `+180秒` 前缀**：旧实现把时长塞主行，稿面主行只有动作 ⇒ 时长落副行（信息层级更清，且副行本就是稿面件）。
3. **描边 1px → 四向 ±2px**：稿 `strokeWeight` 缺省 1；落地等效 ≈2px。理由 = ① 亮部对比 2.13:1 不足，细描边兜不住；② 1px 在 dpr3 下碎成虚线（同 `T-511` 判例）。
4. **副行字号 20 → 22**：可读地板档（同 `T-599`）；22 bold 属 WCAG 大字号 ⇒ 门 3:1，实测 min 4.37 ✓。
5. **标题墨不沿用兄弟页**：详情 / 选关页标题用 `plateSubInk`，本页同带实测 2.68 ✗ ⇒ 改 `woodText`（3.78 ✓）。**同族不同墨属对比度驱动，非漂移**。
6. **两枚 INNER_SHADOW 不实现**：文字管线单色填充（同详情页规格 §4.1 缺口）；投影已承担立体感。
7. **说明行 / 一次性提示 / 禁用态为产品补件**：稿面无，依 `ux-spec §3.5` 与 `screens.md §4` 矩阵落位。
8. **金样本影响（已实测）**：`fail` 态 **total 574 → 585（+11）**，逐类 `text 13 → 26`（描边 15 条替旧 2 条主行）、`line 103 → 101`（旧 `drawButton('wood')` 每钮受光 + 承重两线退场，回退腿改纯 rect）、`rect/circle/polygon` 计数逐字不变；**其余十态逐字未变**（对拍 12/13 过，唯一红即 `fail`）。由 `tests/ui-golden-capture.ts` 在干净锚重抓（⛔ 不手改夹具，K-051 / K-053）。登记 = `ui-architecture-beads §12`。

## 11. 开放项

- [x] Cocos 编辑器导入三枚投放件（生成 `.meta` 并挂 `textures` Bundle）——**WXG-T-615 追闭**：并发会话编辑器已签发 + 今晨构建进包核验通过（§6）；harness 已可用。
- [ ] 设计侧回稿：副行「60秒」改「180秒」（或把 `REVIVE_BONUS_SEC` 变更同步到 Figma 组件集 `233:36`）。
- [x] **位图腿像素证据（WXG-T-615 追闭 · 2026-11-12）**：IDE 内置视图仍 hidden（K-215），改走**系统 Chrome headless + CDP 直驱**（`tools/scripts/harness-bitmap-shot.mjs`，零依赖）：探针 `visibilityState=visible` / rAF 31×500ms / 三枚位图 complete（852/834/1098px）⇒ 双钮档与仅重试档实帧截图并**亲读目视通过**（`temp/ui-shot/fail-615-bitmap-two-button.png` / `fail-615-bitmap-retry-only.png`）：九宫格 404 档标题带/铆钉不撕裂、文字让位烘入图标、副行 180 秒金墨、说明行落位均与稿一致。道次 = **harness Canvas2D 位图腿**，⛔ 仍非真机。
- [ ] 真机目视（含 404 档九宫格压缩后的铆钉 / 标题带完整性）`[待真机]`。
- [ ] 大字号档钮内字是否随 `largeText`（现固定 44 / 42 / 22，属按钮族）—— 归后续无障碍批。