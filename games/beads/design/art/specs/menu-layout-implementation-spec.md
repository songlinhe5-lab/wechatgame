# 主界面布局落地单 · 「拼豆小铺」菜单屏（规范 v3.4 定稿）

> **用途**：UI 布局落码的唯一施工依据。规则正本 = 本件；取证图 = `../coordinates/menu-coords-*.png` 五档 mock 贴装图（脚本 `temp/menu-mock-tiers.py`，图与本文同源可重出）。
> **裁定链**：v3（88/16dp 物理锚 + 余量沉底）→ v3.1（用户 2026-10-14 裁「750dp 宽基准标注」= rpx 语义，顶/底隙迁系内 16/32）→ v3.3（用户同日否「橱窗拉伸」案，裁**柜隙上:下 = 1:2**）→ **v3.4（用户 2026-10-15 裁：资源条与橱窗一体成组按 1:2 分隙；资源条改棕色圆角矩形本体实测框；补 boss 关图位/木牌/三态徽标坐标，徽标钉玻璃区右上角）**。
> 层序 / 交互语义不在本件重写，沿用 `menu-architecture.md §5.2`；本件只管**落位与尺寸**。

## 1. 坐标系与锚（全部设计 px = 750 宽基准，与 `DESIGN_W` 同域）

- **k = 750 / windowWidth(dp)**（`getWindowInfo().windowWidth`）。微信 `rpx` 即本系，可直填。
- **纵向四锚（逐机唯一变化的量，全部走接口，fallback 只在接口无效时生效）**：

| 锚 | 定义（设计 px） | 接口源 | 无接口 fallback |
|---|---|---|---|
| `st` | safeTop 换算 | `safeArea.top × k` | `SAFE_TOP_H = 120` |
| `cap` | 胶囊底换算 | `getMenuButtonBoundingClientRect().bottom × k` | `SAFE_TOP_H = 120` |
| `sb` | 底部 inset 换算 | `(screenH − safeArea.bottom) × k` | `SAFE_BOTTOM_H = 68` |
| `H` | 系高 | `screenHeight × k` | `DESIGN_H = 1334` |

- ⚠ **接口优先语义沿用 v1.75**（`safeEdgeInset` 判例 K-124）：接口 > 0 就只信接口，⛔ 不 `max` 静态宏。现函数带 `SAFE_EDGE_MARGIN=4` 加数，本链隙值（16/32/4）**已含边距语义** ⇒ 落码二选一：裸换算（`round(dp×k)`）或复用函数后把隙值各减 4，**不许双重加 4**。
- ⚠ 现 `DESIGN_H = 1334` 假设 SE 档，本规范下**系高逐机变**（五档实测 1625~1630 不等）⇒ 底锚计算禁用 `DESIGN_H` 常量，走 `H` 锚。

## 2. 纵向链（自顶，全常量恒定，逐机只随锚平移）

```
bow0   = st + 16                    # 蝴蝶结顶（顶隙 16）
board0 = bow0 + 42                  # 招牌板顶（结/板画面交叠 30 ⇒ 视觉链 180）
sign1  = bow0 + 180                 # 招牌板底
cta1   = H − sb − 32                # CTA 底锚（底隙 32）
cta0   = cta1 − CTA_H
zone   = cta0 − sign1               # 板底↔CTA顶 自由区
G      = 46 + 871 = 917             # **条窗一体组**（v3.4：资源条 46 + 缝 0 + 橱窗 871，定稿图直接相接）
gap_top = (zone − G) / 3            # 组隙 上:下 = 1:2（下隙 = 2×gap_top；v3.3 裁定迁到整组口径）
bar0   = sign1 + gap_top            # 资源条顶（棕色圆角矩形本体；Δ12 只作下限，五档 gap_top 19~109 ✓）
bar1   = bar0 + 46
case0  = bar1                       # 橱窗顶（**与条一体，缝 0**，v3.4）
case1  = case0 + 871                # 橱窗底（**恒定不拉伸**，v3.3 裁定）
bt     = cap + 4                    # 顶栏钮顶（对齐胶囊底，不占布局预算）
```

- 橱窗**不拉伸**（v3.2 三段式拉伸案被否留史：立柱纹理实测可拉 0.17 平移不变，但观感「太长」）。
- **v3.4 条窗一体**：旧链「条钉招牌下 Δ12 + 窗在条底另分隙」作废（五档图上条窗拉开 106~213 ⇒ 与底图实物相接矛盾）；现整组（917）在自由区内按 1:2 分隙，组内零间隙。
- **SE 档自洽**：st=40 系时 zone = 974，减组 917 得 57 ⇒ gap_top = 19（≥Δ12 下限 ✓）、gap_bot = 38；条 156,255 / 窗 107,301（定稿图实物框 条 156,248 / 窗 107,294，SE 档平移 +7/+7 保持组内相接）。
- 常量表：顶隙 16 · 底隙 32 · Δ12（只作组隙下限）· 招牌链 180 · 条 46 · 窗（含楣）871 · **组 917 = 条 46 + 缝 0 + 窗 871** · 钮行 bt=cap+4。旧口径「条 43 + 缝 3」（mock 旧框含两侧木楣面）作废。

## 3. 元素清单（尺寸 / 横坐标逐机恒定 · 层序沿用 §5.2）

| 元素 | 尺寸（750系） | x | 纵向锚 | 层 | 可点 | 资源 |
|---|---|---|---|---|---|---|
| 招牌（结+板一体） | 视觉 474×180 @x[140,614]（结 187×72 @x280 含内交叠） | 居中 | `bow0` | L2 | ✗ | `ui_menu_logo` 整块；候选 = `ui_menu_signboard`（带绳整块，§5-C4 待选） |
| slogan 字带 | 带高 88（`TEXT_BAND`） | 居中 | 板底 −12 起带 | L2 | ✗ | 程序化文字 |
| 顶栏三钮 | 视觉 64²，热区 88²（`TOUCH_MIN`）同心 | 热区左缘 24 / 560 / 648（`MENU_TOPBAR_X`，与 mock 框互校 ✓） | `bt` | L6 | ✓（现仅设置） | `ui_btn_circle_*` + `ui_icon_settings/sound/mail`（喇叭暂代公告） |
| 资源条（棕色圆角矩形本体） | **439×46 @x156**（定稿实测 x[156,595] y[248,294)；旧标 549×43 含两侧木楣面 ⇒ 作废） | x156（中心 375.5≈居中） | `bar0`；**底缘 = 橱窗顶缘（一体，缝 0）** | L4 | ✗ 只读 | 程序化木牌 + `asset-icon-stamina/coin`（plaque_* 令牌沿用第十一批；mock 切图仅标注用） |
| 橱窗（含楣·与条一体） | 544×871 @x107（mock 实测框） | x107 | `case0 = bar0 + 46`（v3.4 零间隙钉条底） | L1 | 仅格 | `ui_showcase_frame.png`（去牌版已转正，§5-C2）；程序化备选 |
| Boss 关图位（玻璃白板区） | **468×528 @x[146,614]**，窗内偏移 y[130,658]（定稿实测） | x146（中心 380） | `case0 + 130` 起带 | L1 | ✓（`open-levels`，[WXG-T-281]） | 内容程序化贴图（豆画不在资源里，2026-10-14 裁定）；[WXG-T-281] 对账已裁：白卡退场 ⇒ 图位 = 选关入口热区（点图进选关），内容 = Boss 关**原生阵**豆画，未通关 ⇒ 置灰（`palette.beadGrayInksFor`） |
| 状态徽标（三态） | **64² @x[538,602]**，窗内偏移 y[142,206]（玻璃区右上角、内缩 12） | x538 | `case0 + 142` | L1 | ✗ | 三态：推关中 / 未开启 = 本徽标；完成 = 另亮中央 icon（下一行）；图形资产待裁 |
| 完成态 boss icon | **Ø160 居中于 Boss 图位**（cx380，窗内偏移 y[314,474]） | 居中 | `case0 + 394` 圆心 | L1 | ✗ | 完成推关时叠在 boss 图上（用户 2026-10-15 令「中间显示 boss 关 icon」） |
| ~~走马灯卡~~ | **退场**（`[WXG-T-281]` 用户 2026-10-15 裁：「走马灯中间只展示Boss图，未通关置灰，点击Boss图进入选关页面」） | — | — | — | — | `CAROUSEL_W/H/THUMB_N/THUMB_AREA/TEXT_BAND` 常量组与 `carouselCleared`/`carouselTotal` 字段已删（历史坐标读 git 史）；◀▶ 锚 `caseCenterY` 不变 |
| ◀▶ 翻页钮 | 视觉 64² @x26 / x668，热区 88² | 26 / 668 | 圆心 = `case0 + 0.42×871` | L1 | ✓ | `ui_btn_arrow_bg_*` + `ui_icon_arrow_left/right` |
| 橱窗内木牌（名称牌） | 定稿资产 211×86 系（@2x 422×172）；牌体实测 190×80 系（§8.7 口径待对账）；**定稿含影实测框 x[274,488] y[946,1046] = 214×100，窗内偏移 y[652,752]** | 居中（中心 381） | `case0 + 652` 起（层板位，随橱窗底段） | L1 | ✗ | `ui_showcase_plate.png`（已转正；消费端路线二选一待裁，§5-C5） |
| CTA | mock 框 324×92 @x218；**落码以 `MENU_PRIMARY_W=320` 为准，高 92 或维持 88 开工时定**（差 4 登记漂移） | 218 | 底锚 `cta1` | L3 | ✓ | `ui_btn_start_9s(_pressed)`（9-slice cap=96/mid=8） |

## 4. 五档验收账（gap_top / gap_bot，**组隙**（条窗一体组上:下）必须落此表，v3.4 重出）

| 档 | st | cap | sb | H | 组隙 上/下 |
|---|---|---|---|---|---|
| SE 375×667@2x | 40 | 112 | 0 | 1334 | 19 / 38 |
| Android 挖孔 360×780@3x | 60 | 133 | 0 | 1625 | 109 / 219 |
| iPhone X–14 刘海 375×812@3x | 94 | 163 | 68 | 1624 | 75 / 150 |
| 灵动岛 393×852@3x | 103 | 172 | 65 | 1626 | 74 / 147 |
| 16 Pro Max 440×956@3x | 92 | 153 | 58 | 1630 | 81 / 162 |

不变式（入 P-6 测试）：① `case1 + gap_bot + CTA_H + 32 + sb == H`（gap_bot = cta0 − case1）；② `gap_bot == 2×gap_top`；③ 招牌/橱窗全档在 safeTop 线下、CTA 底在 Home 条上；④ 钮行 `bt ≥ cap`（不占预算）；⑤ **v3.4 新增**：`case0 == bar0 + 46`（条窗一体缝 0）且 `bar0 ≥ sign1 + 12`（Δ12 下限，五档最小 19 ✓）。⇒ 与 `temp/menu-mock-tiers.py` 同源：本链式即脚本实算，五档输出 19/38 · 109/219 · 75/150 · 74/147 · 81/162 逐项复核过。

## 5. 资源文件需求（对齐 `final/README.md` assets/menu 台账）

**已入库可直接用**（`games/beads/cocos/assets/menu/`，台账状态为准）：

| 文件 | 用途 | 状态 |
|---|---|---|
| `ui_menu_logo.png/webp`（960×622@2x） | 招牌整块（含蝴蝶结+木牌+字） | ✅ 已接 |
| `asset-icon-coin.webp` / `asset-icon-stamina.webp` | 资源条币/心 | ✅ 已接（2026-10-15 双端；按目标位图框缩） |
| `ui_btn_circle_normal/pressed.png` + `ui_icon_settings/sound/mail.png` | 顶栏钮 | ✅ 已接（2026-10-15 双端） |
| `ui_btn_start_9s(_pressed).png` | CTA | ✅ 已接（2026-10-15 双端；9-slice：harness 预烘 / Cocos SLICED） |
| `ui_showcase_plate.png`（422×172@2x） | 橱窗内木牌 | ✅ 已接（2026-10-15 双端；C2/C5 选型史证保留，实现形态以 carrier/harness 为准） |
| `ui_showcase_frame.png`（1188×1892 RGBA） | 橱窗框体 | ✅ 已接（2026-10-15 双端；高清原图按框目标尺寸消费） |
| `ui_btn_arrow_bg_normal/pressed.png` + `ui_icon_arrow_left/right.png` | ◀▶ | ✅ 已接（2026-10-15 双端；转正曾标待拍板，接线随 16 件纹理集一次性接入；B21 ① pressed 盘体违规登记不变） |

**缺口（需新产或待裁）**：
- C1 **公告喇叭图标**：现只有 `ui_icon_sound`，mock 画的是喇叭——转正时确认复用 sound 还是新切。
- C2 **橱窗框体**（楣+木框 544×871）：用户 2026-10-14 令「去牌然后归到 final」⇒ 位图件 `ui_showcase_frame.png` 已入库转正（去牌版，牌由 `ui_showcase_plate` 运行时叠），**位图路线已有正本**；运行时最终用位图还是维持程序化占位，接线时确认即可（不阻塞其余元素落码）；旧 9-slice 规格（`menu-showcase-asset-spec §5.1`）仅对 @2x 切图版有意义，现件为高清原图需重缩。⚠ **v3.4 条窗一体后**：现件框从 y294 起、**不含棕色条体** ⇒ 接线时条体（程序化 plaque 或另切片）零间隙叠于件顶，或重出含条整件（待接线批拍板）。
- C3 **蝴蝶结不单独切**：招牌走 logo 原件整块 ⇒ mock 的 bow/board 分件只是标注辅助，运行时零需求。
- C4 **带绳招牌整块（新供 2026-10-14）**：`final/assets/menu/ui_menu_signboard.png`（707×459 RGBA，绳+结+板+珠字一体，用户令入库）——与第十四批「绳不随切图走、绳程序化自 y=0 垂下」旧裁口径不同 ⇒ **双轨并存**：runtime 选型（logo 无绳块+程序化绳 vs signboard 带绳整块）待拍板；若选带绳整块：锚仍 = 结顶 `bow0 = st+16`，件顶（绳头）= `bow0 −` 结在件内的 offset（待入库判据实测），绳向上延伸入带 ⇒「只许绳入带」豁免**仍成立**，只是绳改由本件位图承担、程序化绳退役（件未转正未接线）。
- C5 **橱窗内木牌消费端路线**（已转正待接线）：件 = `ui_showcase_plate.png`（影层三段式随牌宽，B25 定稿）；二选一待裁 = Cocos `SLICED`（border 64/73/4/168 @2x，⛔ 不走整图 setContentSize）vs ADR-0031 blit 预切三段（`b25-shadow-slice/plate-{left,mid,right}.png`），需 ADR 增补才落码（spec §8.6）；另有 §8.7 牌宽口径对账（实测 190×80 vs D1/C3 行）。

**程序化零资源**：背景（墙带 `WALL_*`）、楣窗灯光斑、走马灯内容与豆画、slogan、Home 条避让（锚已含 inset，无需画）。

## 6. 落码改动面（开工清单）

1. `tuning.ts`：新增链常量组（16/32/12/180/46/871/0.42）+ 四锚纯函数（裸换算版，与 `safeEdgeInset` 的 +4 关系统一，防双加）；✅ 已完（§7）。
2. `meta-view.ts`：绘制链改读锚函数；热区 `box()` 同步。✅ 已完（§7）。
3. P-6 测试：§4 不变式①–⑤ + 五档验收账表驱动。✅ 已完（`tests/menu-anchors.test.ts`）。
4. `framework:sync` 镜像重封（cp + diff 老路，脚本化仍欠账）。✅ 已完（脚本重跑，3 写入）。
5. 文档：systems-index 登记一行指针（真源 = 本件；菜单屏不入 §3.1 带表，判例沿用）；`menu-architecture.md` 补「落位规则移交布局落地单」指针；changelog。⏳ 本批未做（随收尾批）。

**悬案（开工前需拍板，本单不代裁）**：
- **热区 44dp 触控下限**：热区 88系 在 360 屏物理 42.2dp < 44（三案 A 补 92系 / B 功能件钉物理 dp / C 全 dp 已给，日记 91）；—— **仍未裁**（接线按本单 88系 落码，裁后只需改 tuning 一颗）；
- 位图路线转正：**btn-circle / btn-cta 已裁转正（2026-10-14 用户令）**；btn-arrow 套仍待拍板（含 B21 ① pressed 盘体三选一违规）；—— 实物已随 16 件纹理集接入，拍板对象剩「pressed 盘体是否换件」；
- ~~bg3 是否入库为运行时背景~~ **已裁（2026-10-14 用户「bg3 不需要了」）**：bg3 及招牌位图贴装预览作废，件留 `shots/menu-showcase-20261014/` 史证；版面真源 = proto-v2 + 本单。proto-v2 整图是否入库仍悬（现运行时背景程序化，底图 CTA 位与运行时本就不同位）。

## 7. 施工状态（WXG-T-280 · 2026-10-15）

**已落码（双端 harness + Cocos，MVVM：shell 算 anchors 一次→ VM 数据→ meta-view 只读绘制）**：

- framework：`Viewport` 动态设计高（H=max(1334, round(750×screenH/screenW))）；nineSlice fx helper（canvas2d 预烘 / Cocos SLICED）。
- `tuning.ts`：`menuAnchors` 四锚纯函数 + 链常量组（接口优先语义：`number|null`，0 合法，仅 null 走 SAFE 常量）。
- `meta-view.ts`：锚定档版面（`anchoredGeo` 绘制/热区同一对象，WeakMap 缓存零分配）+ 全量位图 blit + 三态徽标 + ◀▶ 热区；位图 resolver 缺省 false ⇒ 程序化腿优雅回退（保留）。
- harness：`/menu-assets` 路由 + 16 件纹理注册；Cocos：资产入 bundle + carrier 位图/9-slice 腿。
- 验收：`tests/menu-anchors.test.ts` 五档表驱动 + 不变式①②⑤a⑤b（fallback 档只钉 `ctaBotY≥0`，退化态 gapBot 允负为在册行为）；`pnpm run verify` 22/22、harness smoke 绿（node 环境位图臂回退属预期）。

**退场裁定（2026-10-15 用户令「旧菜单相关逻辑，资源，测试，门禁等，尽量删除」）**：

- 第十四批静态档版面**整体退场**（推翻此前「保留作 fallback 档」方案）：菜单几何唯一 = 锚函数链；无 anchors 直调 ⇒ 模块级 `DEFAULT_MENU_ANCHORS`（全 null 入参 ⇒ 走 SAFE 常量兜底）。`MetaViewData.topbarTop` 字段、`metaLayout/hitTestMeta` 的 topbarTop 参、静态锚常量（`MENU_TITLE_Y`/`MENU_SLOGAN_Y`/`MENU_PRIMARY_Y`/`MENU_VERSION_Y`/`CAROUSEL_TOP`/`MENU_PLAQUE_W/H/X/Y`）已删（历史坐标读 git 史）。
- K-6 台账门禁退役：`menu-primitives-k6.test.ts` + `menu-primitives-lib.ts` + `menu-primitives-capture.ts` + `wxg-t-269-s6-k6-ledger.json`（旧带匹配器按静态坐标带筛圆，与锚定档结构性不相容）。`meta-menu-wall.test.ts` 同步删 §5.1b 顶栏逐机坐标钉、§5.1b-2 门楣静态坐标、验收⑦旧扫描面、图元族闭集「无 blit」旧钉（新菜单走位图 blit）；口径③/`beads-shell` 热区恰等集刷新为锚定档五颗（+carousel-prev/next）。
- `menu-signage-beadtext.test.ts` 去静态锚依赖（中心降为局部测试档值 SIGN_CY，纯函数判据不变）。

**留置登记（不阻塞）**：pressed 态视觉切换与重缩精度待真机验收；旧「图元族闭集/无 blit」判据若需重建，应改按锚定档几何另写新钉（本批不代写）。

**[WXG-T-281] 实跑排障补丁（2026-10-15 当日，用户截图「实际效果问题很多」）**：

- **退化档误用**：shell 对非小游戏宿主（浏览器 harness / node）改传**真值 0**（无刘海 / 无 Home 条），不再传 null 走 120/68 悲观兜底（旧档在 1334 系高即落退化态 ⇒ 橱窗压 CTA / slogan 骑资源条 / CTA 贴屏底）；null 兜底档仅留「未知宿主」直调（`DEFAULT_MENU_ANCHORS`）。
- **Boss 图位**：468×528 走关卡**原生阵**（`max(rows, cols)`），⛔ 选关墙小格的 5 档（巨型豆根因）。
- **卡片对账（用户裁定）**：白卡 300×220 退场（`drawCarouselCard`/`cardBox`/`CAROUSEL_*` 常量组/`carouselCleared`/`Total` 字段全删）；`open-levels` 热区 = `bossBox`；置灰墨单源 `palette.ts::beadGrayInksFor`（亮度→中灰带 64..176，WeakMap 缓存，`drawLevelThumb` 新增 `inkOverride` 参 ⇒ 灰度不走位图臂）；shell 陈列集 =「下一未通关」（置灰、默认第 0 项）+ 已通集反序，`carouselState` 随项下发；白板底 = 程序化腿 slot/slot_border 纸格（位图腿 ⇒ 橱窗框资产自带白板 ⇒ 不叠平涂面）。
- **测试同步**：验收⑥ 尺寸改钉 `MENU_BOSS_SLOT`；菜单帧不再出现选关/进度字面；零新 hex 门把在册灰度墨集纳入珠体通道扫面；level-import 改钉「命中不是导入钮」（大图位副产物）；shell 新增 `menuAnchors` getter ⇒ 测试与热区同源（⛔ 混用两档坐标）。
- **连带红（非本批引入·已处置）**：`check:size` 红 = 16:31 Cocos 构建产物把 16 件菜单纹理进主包（4520KB > 平台红线 4096KB）；真机调试同因报「source size 4373KB exceed max limit 4MB」。**元凶单件**：`ui_showcase_frame.png`（1188×1892 手绘 RGBA PNG = 1188KB，占主包 26%；AI 噪点渐变对 PNG 极不友好）。处置（用户 2026-10-15 裁「选 1/2」）：11 件菜单 PNG 经 Cocos 编辑器 MCP 换入 **WebP q90**（alpha 加权 vRMS≤4.8；合计 1392KB→89KB；两枚 2KB 箭头当时暂留 PNG（后由下方「统一 WebP 标准追加批」覆盖转入）；meta 全由编辑器生成，无 SLICED 定制⇒九宫格走代码 `nineSliceFx` 通道零风险）；转码件按 `ui_menu_logo.webp` 先例并放 `final/assets/menu/` 正本旁。release 重建后主包 **3206.6KB < 平台红线** ✅（verify 22/22 全绿）；**内部目标 2000KB 仍超 ⇒ 分包/远程包归发布批拍板**（关卡美术分包 + BGM 704KB 远程包是既登记的两个大头）。

- **统一 WebP 标准追加批（用户 2026-10-15 裁「这些都转，统一标准使用 webp」）**：全工程纹理入库档收敛为 WebP ⇒ ① 菜单余两件（箭头 ×2）+ Boss 缩略 `l9-boss-mandala-256`（37.5→5.8KB）转 q90（路径装载零引用影响）；② **4 张 tint-mask 转无损 WebP**（编码输入只允许 lossless，已验逐位一致；共省 6.6KB）⇒ 全链同步：carrier `MASK_ASSETS` 四 uuid、`tint-mask.mtl`/`tint-mask-001.mtl` 的 maskTexture 引用（磁盘改 + 编辑器 reimport）、`check-cocos-mask.mjs` 放宽 `.png|.webp` 且定稿等值腿改**解码像素比对**（跨格式 md5 不可比）。release 重建后主包 **3166.3KB**，verify 22/22 全绿（含 mask 门禁 4/4 进包 + 像素等值 4/4）。**已接一处（当日闭环）**：`tint-probe.scene` 两处 maskTexture 曾指旧 uuid——插件工具开关面板（扩展 → cocos-mcp-server → 工具管理）默认禁用 `scene_management` / `set_component_property`，用户开启后由 MCP 完成：open(probe) → set_component_property（BeadProbe→`24f09d0c…@6c48a`、GridProbe→`837889c8…@6c48a`，changeVerified）→ save → 切回 Main；磁盘复核新 uuid ×2 在、旧 uuid 全工程 0 残留（编辑器正规写场景，未碰 L1 红线）。mask 定稿正本（`tools/mask-preview/cocos-assets/*.png`）保持 PNG 格式不变，门禁已支持跨格式像素比。

未 commit。
