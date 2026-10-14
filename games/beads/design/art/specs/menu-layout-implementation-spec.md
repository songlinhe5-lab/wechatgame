# 主界面布局落地单 · 「拼豆小铺」菜单屏（规范 v3.3 定稿）

> **用途**：UI 布局落码的唯一施工依据。规则正本 = 本件；取证图 = `../coordinates/menu-coords-*.png` 五档 mock 贴装图（脚本 `temp/menu-mock-tiers.py`，图与本文同源可重出）。
> **裁定链**：v3（88/16dp 物理锚 + 余量沉底）→ v3.1（用户 2026-10-14 裁「750dp 宽基准标注」= rpx 语义，顶/底隙迁系内 16/32）→ v3.3（用户同日否「橱窗拉伸」案，裁**柜隙上:下 = 1:2**）。
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
bar0   = bow0 + 180 + 12            # 资源条顶（招牌链 180 → Δ12）
bar1   = bar0 + 43
case0  = bar1 + gap_top             # 橱窗顶（窗件含楣，顶缘 = mock 实测框 107,307 系）
case1  = case0 + 871                # 橱窗底（**恒定不拉伸**，v3.3 裁定）
cta1   = H − sb − 32                # CTA 底锚（底隙 32）
cta0   = cta1 − CTA_H
zone   = cta0 − bar1                # 条底↔CTA顶 自由区
gap_top = (zone − 871) / 3          # 柜隙 上:下 = 1:2（下隙 = 2×gap_top = cta0 − case1）
bt     = cap + 4                    # 顶栏钮顶（对齐胶囊底，不占布局预算）
```

- 橱窗**不拉伸**（v3.2 三段式拉伸案被否留史：立柱纹理实测可拉 0.17 平移不变，但观感「太长」）。
- **SE 档自洽**：st=40 系时 zone = 919，减窗 871 得 48 ⇒ gap_top = 16 = 旧 Δ12+地板值，与 `menu-master-coords.png` 总图逐字互校（结 280,56 / 条 106,248 / 窗 107,307）。
- 常量表：顶隙 16 · 底隙 32 · Δ12 · 招牌链 180 · 条 43 · 窗（含楣）871 · 钮行 bt=cap+4。历史口径「组 917」（= 缝3+楣35+窗833 的 v3 拆分）在本式下不再作链常量，窗件统一按 mock 实测框 **高 871** 计。

## 3. 元素清单（尺寸 / 横坐标逐机恒定 · 层序沿用 §5.2）

| 元素 | 尺寸（750系） | x | 纵向锚 | 层 | 可点 | 资源 |
|---|---|---|---|---|---|---|
| 招牌（结+板一体） | 视觉 474×180 @x[140,614]（结 187×72 @x280 含内交叠） | 居中 | `bow0` | L2 | ✗ | `ui_menu_logo` 整块；候选 = `ui_menu_signboard`（带绳整块，§5-C4 待选） |
| slogan 字带 | 带高 88（`TEXT_BAND`） | 居中 | 板底 −12 起带 | L2 | ✗ | 程序化文字 |
| 顶栏三钮 | 视觉 64²，热区 88²（`TOUCH_MIN`）同心 | 热区左缘 24 / 560 / 648（`MENU_TOPBAR_X`，与 mock 框互校 ✓） | `bt` | L6 | ✓（现仅设置） | `ui_btn_circle_*` + `ui_icon_settings/sound/mail`（喇叭暂代公告） |
| 资源条（门楣价目牌） | 549×43 @x106 | x106 | `bar0` | L4 | ✗ 只读 | 程序化木牌 + `asset-icon-stamina/coin`（plaque_* 令牌沿用第十一批） |
| 橱窗（含楣一体） | 544×871 @x107（mock 实测框） | x107 | `case0` | L1 | 仅格 | `ui_showcase_frame.png`（去牌版已转正，§5-C2）；程序化备选 |
| 走马灯卡 | 300×220（`CAROUSEL_W/H`） | 居中 | 与 ◀▶ 同心：顶 = `case0 + 0.42×871 + 110` | L1 | ✓ | 内容程序化（豆画**不在资源里**，2026-10-14 裁定） |
| ◀▶ 翻页钮 | 视觉 64² @x26 / x668，热区 88² | 26 / 668 | 圆心 = `case0 + 0.42×871` | L1 | ✓ | `ui_btn_arrow_bg_*` + `ui_icon_arrow_left/right` |
| 橱窗内木牌（名称牌） | 定稿资产 211×86 系（@2x 422×172）；牌体实测 190×80 系（§8.7 口径待对账） | 居中 | 随橱窗底段（层板位，待实装定锚） | L1 | ✗ | `ui_showcase_plate.png`（已转正；消费端路线二选一待裁，§5-C5） |
| CTA | mock 框 324×92 @x218；**落码以 `MENU_PRIMARY_W=320` 为准，高 92 或维持 88 开工时定**（差 4 登记漂移） | 218 | 底锚 `cta1` | L3 | ✓ | `ui_btn_start_9s(_pressed)`（9-slice cap=96/mid=8） |

## 4. 五档验收账（gap_top / gap_bot，柜隙必须落此表）

| 档 | st | cap | sb | H | 柜隙 上/下 |
|---|---|---|---|---|---|
| SE 375×667@2x | 40 | 112 | 0 | 1334 | 16 / 32 |
| Android 挖孔 360×780@3x | 60 | 133 | 0 | 1625 | 106 / 213 |
| iPhone X–14 刘海 375×812@3x | 94 | 163 | 68 | 1624 | 72 / 144 |
| 灵动岛 393×852@3x | 103 | 172 | 65 | 1626 | 71 / 141 |
| 16 Pro Max 440×956@3x | 92 | 153 | 58 | 1630 | 78 / 156 |

不变式（入 P-6 测试）：① `case1 + gap_bot + CTA_H + 32 + sb == H`（gap_bot = cta0 − case1）；② `gap_bot == 2×gap_top`；③ 招牌/橱窗全档在 safeTop 线下、CTA 底在 Home 条上；④ 钮行 `bt ≥ cap`（不占预算）。⇒ 与 `temp/menu-mock-tiers.py` 同源：本链式即脚本实算，五档输出 16/32 · 106/213 · 72/144 · 71/141 · 78/156 逐项复核过。

## 5. 资源文件需求（对齐 `final/README.md` assets/menu 台账）

**已入库可直接用**（`games/beads/cocos/assets/menu/`，台账状态为准）：

| 文件 | 用途 | 状态 |
|---|---|---|
| `ui_menu_logo.png/webp`（960×622@2x） | 招牌整块（含蝴蝶结+木牌+字） | ✅ 已接 |
| `asset-icon-coin.webp` / `asset-icon-stamina.webp` | 资源条币/心 | ✅ 已转正（2026-10-14 用户令），⏳ 待接线（接线时按目标尺寸重缩） |
| `ui_btn_circle_normal/pressed.png` + `ui_icon_settings/sound/mail.png` | 顶栏钮 | ✅ 已转正（2026-10-14 用户令），⏳ 待接线 |
| `ui_btn_start_9s(_pressed).png` | CTA | ✅ 已转正（同上），⏳ 待接线 |
| `ui_showcase_plate.png`（422×172@2x） | 橱窗内木牌 | ✅ 已转正（2026-10-14 用户令「转到 final」，与 B25 定稿 maxΔ 0 验同），⏳ 待接线 |
| `ui_showcase_frame.png`（1188×1892 RGBA） | 橱窗框体 | ✅ 已转正（2026-10-14 用户令「去牌然后归到 final」，牌区已中位数回填），⏳ 待接线（高清原图非 @2x 规格，接线时重缩） |
| `ui_btn_arrow_bg_normal/pressed.png` + `ui_icon_arrow_left/right.png` | ◀▶ |  待接（转正待拍板；B21 两项 ⚠ 未清，见 shots README） |

**缺口（需新产或待裁）**：
- C1 **公告喇叭图标**：现只有 `ui_icon_sound`，mock 画的是喇叭——转正时确认复用 sound 还是新切。
- C2 **橱窗框体**（楣+木框 544×871）：用户 2026-10-14 令「去牌然后归到 final」⇒ 位图件 `ui_showcase_frame.png` 已入库转正（去牌版，牌由 `ui_showcase_plate` 运行时叠），**位图路线已有正本**；运行时最终用位图还是维持程序化占位，接线时确认即可（不阻塞其余元素落码）；旧 9-slice 规格（`menu-showcase-asset-spec §5.1`）仅对 @2x 切图版有意义，现件为高清原图需重缩。
- C3 **蝴蝶结不单独切**：招牌走 logo 原件整块 ⇒ mock 的 bow/board 分件只是标注辅助，运行时零需求。
- C4 **带绳招牌整块（新供 2026-10-14）**：`final/assets/menu/ui_menu_signboard.png`（707×459 RGBA，绳+结+板+珠字一体，用户令入库）——与第十四批「绳不随切图走、绳程序化自 y=0 垂下」旧裁口径不同 ⇒ **双轨并存**：runtime 选型（logo 无绳块+程序化绳 vs signboard 带绳整块）待拍板；若选带绳整块：锚仍 = 结顶 `bow0 = st+16`，件顶（绳头）= `bow0 −` 结在件内的 offset（待入库判据实测），绳向上延伸入带 ⇒「只许绳入带」豁免**仍成立**，只是绳改由本件位图承担、程序化绳退役（件未转正未接线）。
- C5 **橱窗内木牌消费端路线**（已转正待接线）：件 = `ui_showcase_plate.png`（影层三段式随牌宽，B25 定稿）；二选一待裁 = Cocos `SLICED`（border 64/73/4/168 @2x，⛔ 不走整图 setContentSize）vs ADR-0031 blit 预切三段（`b25-shadow-slice/plate-{left,mid,right}.png`），需 ADR 增补才落码（spec §8.6）；另有 §8.7 牌宽口径对账（实测 190×80 vs D1/C3 行）。

**程序化零资源**：背景（墙带 `WALL_*`）、楣窗灯光斑、走马灯内容与豆画、slogan、Home 条避让（锚已含 inset，无需画）。

## 6. 落码改动面（开工清单）

1. `tuning.ts`：新增链常量组（16/32/12/180/43/871/0.42）+ 四锚纯函数（裸换算版，与 `safeEdgeInset` 的 +4 关系统一，防双加）；`MENU_TITLE_Y`/`MENU_SLOGAN_Y`/`CAROUSEL_TOP`/`MENU_PRIMARY_Y` 静态值改**运行时锚函数输出**（第十四批静态值 = SE 档快照，保留为 fallback 档）。
2. `meta-view.ts`：绘制链改读锚函数；热区 `box()` 同步。
3. P-6 测试：§4 不变式①–④ + 五档验收账表驱动。
4. `framework:sync` 镜像重封（cp + diff 老路，脚本化仍欠账）。
5. 文档：systems-index 登记一行指针（真源 = 本件；菜单屏不入 §3.1 带表，判例沿用）；`menu-architecture.md` 补「落位规则移交布局落地单」指针；changelog。

**悬案（开工前需拍板，本单不代裁）**：
- **热区 44dp 触控下限**：热区 88系 在 360 屏物理 42.2dp < 44（三案 A 补 92系 / B 功能件钉物理 dp / C 全 dp 已给，日记 91）；
- 位图路线转正：**btn-circle / btn-cta 已裁转正（2026-10-14 用户令）**；btn-arrow 套仍待拍板（含 B21 ① pressed 盘体三选一违规）；
- ~~bg3 是否入库为运行时背景~~ **已裁（2026-10-14 用户「bg3 不需要了」）**：bg3 及招牌位图贴装预览作废，件留 `shots/menu-showcase-20261014/` 史证；版面真源 = proto-v2 + 本单。proto-v2 整图是否入库仍悬（现运行时背景程序化，底图 CTA 位与运行时本就不同位）。

未 commit。
