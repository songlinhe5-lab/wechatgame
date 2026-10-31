# 主界面布局落地单 · §5 资源文件需求（WXG-T-524 · 2026-10-31 整节逐字节外移）

> 本件 = `menu-layout-implementation-spec.md` **§5 整节原文**逐字节外移（外移动因 = 该件 B 项豁免条目 `WXG-T-346` 已登记的撤销条件：「下次增补前把 §5 资源文件需求外移为同目录 `menu-layout-assets-requirement.md`、正文只留指针，顶回 ≤8000 即撤销本豁免」）。
> **在册坐标 / 落位 / 尺寸仍归正本**（正本 §3 / §4 / §8 / §10，另木牌两行文字口径见拆册件 `menu-plate-text-control-spec.md`）；本件只管**资产台账与消费路线**。改资产口径写这里，改几何写正本。

## 5. 资源文件需求（对齐 `final/README.md` assets/menu 台账）

**已入库可直接用**（`games/beads/cocos/assets/menu/`，台账状态为准）：

| 文件 | 用途 | 状态 |
|---|---|---|
| `ui_menu_logo.png`（960×772） | 招牌整块（含蝴蝶结+木牌+字；v3.9 绳加长 150px） | ✅ 已接；✅ 2026-10-18 已裁 = PNG 为现役（距投放件 1.98 vs webp 4.67），webp 已退役（判据与旧值留档 `production/qa/webp-png-duality-20261018.md` B-1） |
| `asset-icon-coin.png` / `asset-icon-stamina.png` | 资源条币/心 | ✅ 已接（2026-10-15 双端；按目标位图框缩）；2026-10-18 由 webp 逐位一致转码，harness `MENU_FILE` 同批改指 PNG |
| `ui_btn_circle_normal/pressed.png` + `ui_icon_settings/rank/mail/skin/calendar.png` | 顶栏钮（四枚 2×2） | ✅ 已接（2026-10-15 双端；`calendar` = WXG-T-497 新增，`sound` / `mail` 现为零消费者） |
| `ui_btn_start_9s(_pressed).png` | CTA | ✅ 已接（2026-10-15 双端；9-slice：harness 预烘 / Cocos SLICED） |
| `ui_showcase_plate.png`（422×172@2x） | 橱窗内木牌 | ✅ 已接（2026-10-15 双端；C2/C5 选型史证保留，实现形态以 carrier/harness 为准） |
| `ui_showcase_frame.png`（1188×1892 RGBA） | 橱窗框体 | ✅ 已接（2026-10-15 双端；高清原图按框目标尺寸消费） |
| `ui_menu_badge_pushing.png`（128² @2x） | 三态徽标·推关中 | ❌ **件已删**（2026-10-16 用户裁「改沙漏」，见 `../final/README.md` 台账行）；现役 = `ui_menu_badge_progress.png`（沙漏章）。本行旧记「资产已出 / 已登记」**与盘面对不上**，订正于 2026-10-18 |
| `ui_menu_badge_locked.png`（128² @2x） | 三态徽标·未开启 | ✅ 在用；harness/Cocos 已登记；Cocos 已由编辑器导入（`.meta` 为编辑器生成）；同名 webp 已于 2026-10-18 退役 |
| `ui_menu_badge_done.png`（320² @2x，Ø160dp） | 三态徽标·完成章 | ❌ **件已删**（2026-10-16 用户裁「改飘带」）；现役 = `ui_menu_seal_cleared.png`（金章飘带）。旧记同样订正于 2026-10-18 |
| `ui_btn_arrow_bg_normal/pressed.png` + `ui_icon_arrow_left/right.png` | ◀▶ | ✅ 已接（2026-10-15 双端；转正曾标待拍板，接线随 16 件纹理集一次性接入；B21 ① pressed 盘体违规登记不变）。⚠ **2026-10-18 新开 BD-61**：Cocos 投放件 `ui_btn_arrow_bg_pressed.png` **看不出按下态**（同族两态互异保持率仅 0.13，投放件距自己正本 16.39、反而距 normal 正本 3.16）；根因 = **RGBA 八叉树量化把 alpha 算进色距 ⇒ 按下暗边被塌缩**（⛔ 不是文件装错：`octree(正本)` 与在册投放件逐像素相等）。设计正本 PNG 本身正确（≡ shots 1010 逐像素等值），已用 `../../ai-workflows/quantize-cocos-textures.py` 重出两件（保持率 0.98）并经编辑器 CLI **release 档重建** ⇒ **BD-61 已闭（2026-10-18，用户裁维持 P2）**；**harness 腿看不出本缺陷**（同 K-110 型双端不一致）。详见 `production/qa/beads/test-cases-m-gate.md §M.11` |

**缺口（需新产或待裁）**：
- C1 **公告喇叭图标**：现只有 `ui_icon_sound`，mock 画的是喇叭——转正时确认复用 sound 还是新切。
- C2 **橱窗框体**（楣+木框 544×871）：用户 2026-10-14 令「去牌然后归到 final」⇒ 位图件 `ui_showcase_frame.png` 已入库转正（去牌版，牌由 `ui_showcase_plate` 运行时叠），**位图路线已有正本**；运行时最终用位图还是维持程序化占位，接线时确认即可（不阻塞其余元素落码）；旧 9-slice 规格（`menu-showcase-asset-spec §5.1`）仅对 @2x 切图版有意义，现件为高清原图需重缩。⚠ **v3.4 条窗一体后**：现件框从 y294 起、**不含棕色条体** ⇒ 接线时条体（程序化 plaque 或另切片）零间隙叠于件顶，或重出含条整件（待接线批拍板）。**✅ 已裁（用户 2026-10-15 P3）：条体 = 程序化 plaque 定稿**（`drawResourceBar`，零间隙坐窗顶），不另切片、不重出含条整件。
- C3 **蝴蝶结不单独切**：招牌走 logo 原件整块 ⇒ mock 的 bow/board 分件只是标注辅助，运行时零需求。
- C4 **带绳招牌整块（新供 2026-10-14）**：`final/assets/menu/ui_menu_signboard.png`（707×459 RGBA，绳+结+板+珠字一体，用户令入库）——与第十四批「绳不随切图走、绳程序化自 y=0 垂下」旧裁口径不同 ⇒ **双轨并存**：runtime 选型（logo 无绳块+程序化绳 vs signboard 带绳整块）待拍板；若选带绳整块：锚仍 = 结顶 `bow0 = st+16`，件顶（绳头）= `bow0 −` 结在件内的 offset（待入库判据实测），绳向上延伸入带 ⇒「只许绳入带」豁免**仍成立**，只是绳改由本件位图承担、程序化绳退役（件未转正未接线）。**✅ 已裁（用户 2026-10-15 P3：「ui_menu_logo 是带绳子的，与 ui_menu_signboard 基本一致」）**：现接线的 `ui_menu_logo` 本身即带绳整块 ⇒ 双轨并存前提不成立；**运行时 = `ui_menu_logo`（不变）**，`ui_menu_signboard` 判为重复件、不接线（文件留 `final/` 史证，删除与否另由用户令）。
- C6 **橱窗三态徽标图形**（§3「图形资产待裁」）：**✅ 已裁（用户 2026-10-15 P3）= 位图**，程序化（推/锁 chip、Ø160 ✓ 圆）留作缺资产腿。落码：`MENU_TEXTURES.badgePushing/badgeLocked/badgeDone` + `meta-view` 位图腿。**✅ 资产已出（2026-10-15，云端 qwen-image-3.0，seed 7，抠图为本地洪泛）**：`ui_menu_badge_pushing` / `ui_menu_badge_locked` 为 **128² @2x**（64dp）；`ui_menu_badge_done` 为 **320² @2x**（Ø160dp，完成章按 `MENU_DONE_ICON.d = 160` 需 320 px 才不糊；用户 2026-10-15 确认维持 320 px，与口头「三件 128²」的偏差已裁定）。`final/` 留 PNG 正本 + WebP 发布件；Cocos 侧 WebP 已拷入 `assets/textures/`，Cocos 侧已通过编辑器 MCP `import` 导入 `textures` bundle，`.meta` 由编辑器生成（不手写）；harness `MENU_FILE` 与 Cocos `BITMAP_ASSETS` 已登记。完成章 320 px 已由用户确认。
- C5 **橱窗内木牌消费端路线**（已转正待接线）：件 = `ui_showcase_plate.png`（影层三段式随牌宽，B25 定稿）；二选一待裁 = Cocos `SLICED`（border 64/73/4/168 @2x，⛔ 不走整图 setContentSize）vs ADR-0031 blit 预切三段（`b25-shadow-slice/plate-{left,mid,right}.png`），需 ADR 增补才落码（spec §8.6）；另有 §8.7 牌宽口径对账（实测 190×80 vs D1/C3 行）。
- **C7（WXG-T-525 新开）v2 换代件·木牌**：用户 2026-10-31 裁 §5-B 甲 ⇒ 新牌位图须**自带深木胶囊**（设计px：牌 304×83、胶囊 130×26 r13 居中偏下；@2x 交付 ≈608×166 + 8% 安全边），且**牌面不得有画死文字**（两行均运行时程序化：行1 关名 30 `woodEdge` / 行2 关序 28 `woodText`，口径见 `menu-plate-text-control-spec.md`）。出图并入 v2 分层素材批（`menu-3d-asset-brief.md`），⛔ 不从整屏基准稿裁（三条硬伤实测 = WXG-T-517 / 519 / 520）；现网 `ui_showcase_plate.png` 标 **待换代**。

**程序化零资源**：背景（墙带 `WALL_*`）、楣窗灯光斑、走马灯内容与豆画、slogan、Home 条避让（锚已含 inset，无需画）。
> ⚠ **WXG-T-525 口径待改口**：用户 2026-10-31 新清单要求「**背景图 = 木屋背景 + 橱窗一体件，玻璃内图形剔除后程序化添加**」⇒ 与本行旧裁（背景程序化、橱窗 = `ui_showcase_frame` 单件）不同，升为**新一件需求**（台账 C8）；因分辨率路线待拍板（brief §1 实测整屏稿 @2x 不足），本件暂不落新行。
