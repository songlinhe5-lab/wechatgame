# final —— 资源定稿区（开发统一取用）

> 2026-10-14 用户裁定：资源定稿分**三类**；shots 只按日期存每日结论证据，本区是验收后的归集面（复制入库，原件留批次）。开发接线一律从 `final/assets/<页面>/` 取，文件名 = 运行时资产名。

## 三类目录

| 目录 | 放什么 | 现有件 |
|---|---|---|
| `prototypes/` | **原型设计**：整屏视觉原型（定稿版面） | **现行（v3.8，2026-10-16）= `proto-v3-{pushing,locked,done}-750x1334-at2x.webp` 三态 + 走马灯示意帧 `proto-v3-swipe-750x1334-at2x.webp`**（进行中 = 原色+沙漏章居中于花心；未开启 = 置灰+大锁居中于花心；通关 = 原色+金章飘带「通关」收在玻璃裁切区右上角、随内容滑动；CTA 艺术字按重心居中；示意帧 = 通关项左滑出 35%，橱窗固定、内容裁到玻璃内壁、木牌字淡出。脚本 `../../ai-workflows/menu-proto-coords.py`；关名「曼陀罗」为占位）；`proto-v2-full-750x1334-at2x.webp` 留作素材源（资源条、豆画切件）。以下为史： 4：全屏定稿 / squash47 压橱窗方案（二代）/ proto-v2 顶栏拆件版 / 1014 topbar-split / ~~**bg3 三代底图**~~（第十四批 b″ 产物；同日用户裁「不需要了」**作废且本目录件已物理删除**（2026-10-14 用户二令点名文件），史证留 `shots/menu-showcase-20261014/`；版面真源 = proto-v2 + 布局落地单 v3.3） |
| `coordinates/` | **坐标规格图**：全元素总图 + 五档机型 mock 贴装图 | **现行（v3.8，2026-10-16）**：6 张同由 `../../ai-workflows/menu-proto-coords.py` 重出，底图 = 原型 v3 进行中态，标注 = 落地单 v3.8（链是 v3.9：招牌 370×298（绳加长）· 链 165 · 窗 871；三态盖章与 CTA 纹理见落地单；青框 = 走马灯裁切区 422×528 @x168，红框 = 通关飘带，见落地单 §8）；五档柜隙 38/75 · 130/259 · 95/191 · 94/188 · 101/203（脚本断言对 `menu-anchors.test.ts`）。旧脚本 `temp/menu-mock-tiers.py`/`temp/menu-master-coords.py` 作废。以下为史： 6：`menu-master-coords.png`（总图）+ `menu-coords-{se375,android360,iphonex375,island393,max440}.png`（用户 2026-10-14 令：proto-v2 切 mock 件（`temp/menu-mock-elements/` 10 件，脚本 `temp/menu-mock-tiers.py`）按规范 v3 链在五档**真实分辨率**（dp×dpr 画布）贴装；**同日裁定改 750dp 宽基准标注（v3.1 = rpx 语义）**：全设计件尺寸/横坐标/链常量逐机恒定（顶隙16/底隙32/Δ12/链180/组917），逐机只变纵向入系锚（safeTop·胶囊底·Home×k）；平台件标入系折算值并注「近似/折算非接口」；SE 档恒等系与总图链位逐字互校；头部记型号/长宽/px/dpr+入系读数。**同日补遮挡件标注**：挖孔/刘海/灵动岛形状（总图在册近似÷k，图上声明「近似非接口」——接口只给 safeArea.top 线）、微信胶囊 87×32dp 右边距 10（框内坐标）、Home 条 inset。**同日再裁 v3.3 柜隙分配**：高屏「橱窗拉伸吃余量」案（v3.2，纹理实测立柱 0.17 平移不变可拉）被用户否「太长」→ **橱窗 871 恒定不拉伸**，条底↔CTA顶自由区按**上:下 = 1:2** 分柜隙（SE 自然落 16/32≈Δ12+地板值，And 106/213 · X-14 72/144 · 岛 71/141 · 16PM 78/156）；橱窗 mock 同步**空柜化**（用户裁定豆画不在资源里、是程序化贴图；逐行白板中位数回填 + 托盘存底贴回，原件留 `showcase-raw.png`）；脚本 `temp/menu-mock-tiers.py`）。**落码施工件已立**：`../specs/menu-layout-implementation-spec.md`（v3.3 定稿落地单：四锚/链式/元素清单/资源清单/五档验收账/改动面/悬案）。顶/底安全区·胶囊区·设备示例·热区 88/视觉圆·招牌板体+蝴蝶结+绳·资源条·橱窗·CTA·◀▶ + 净空箭头；脚本 `temp/menu-master-coords.py`。2026-10-14 用户令散件合一，原 8 张留 shots 证据流；同第十四批 b″ 重出，并订正旧图 CTA 画低 88；⚠ 同日用户两令再改：**底图换 proto-v2 全屏定稿，标注全改底图画面实测**（板体 y[1096,1234]·资源条 y[1043,1086]·橱窗 y[169,1008]·◀▶ 圆心 y644.5·CTA y[44,136]·顶栏钮中心 y1116），slogan/字带/位图腿/卡移除不再标；bg3 已作废删除（史证在 shots）/ squash47 仍在 prototypes 留档。**同日第三版（现行）= 布局规范 v3 标注图**：链 = 结顶 safeTop+8dp → 招牌链 180（结/板交叠 30 订正）→ Δ12 → 条+楣+窗组 917 → 地面余量沉底 → CTA底 safeBottom−16dp；钮行对齐胶囊底不占预算；标注 = 设计px（dp@375），本底图即 SE 档（667dp·k=2）链精确落位示例，逐机地面余量 SE17/And145/X-14 101/岛104/16PM 132 dp；运行时落码已为锚定链（WXG-T-280）；⚠ **总图 `menu-master-coords.png` 已过期**（v3 口径：含 slogan、顶隙 +8、CTA 离底 16），现行口径 = 落地单 v3.5 + 五档图，总图待重出） |
| `assets/<页面>/` | **资源图片**（分页面归类），开发接线的直接素材 | `menu/` 18 件，台账见下 |

## assets/menu 台账（来源 → 接线状态）

| 件 | 来源批次 | 接线状态 |
|---|---|---|
| `ui_menu_logo.png/webp`（960×772） | 招牌原件（v3.9 绳加长 150px；位图走原件） | ✅ 已接 `assets/menu/` 运行时 |
| `ui_menu_signboard.png`（707×459 RGBA） | 用户 2026-10-14 供带绳整块版（绳+结+板+珠字一体，透明底），令「资源落 final」 | ⏳ 未转正未接线；⚠ 与第十四批「绳不随切图走」旧裁口径不同，双轨并存待 runtime 选型拍板（真源登记在落地单 §5-C4） |
| `asset-icon-coin/stamina.webp`（948×946 / 734×690 RGBA） | shots/20261013 `l4-resource-bar/` | ✅ **已转正（2026-10-14 用户令「落 final」，与 shots 源像素级 maxΔ0 验过）**；✅ 已接运行时（WXG-T-280/281）（接线时按目标尺寸重缩，⚠ 现尺寸为原图非 @2x 切图规格） |
| `ui_btn_circle_normal/pressed` + `ui_icon_sound/mail/settings` | shots/20261010 `btn-circle/` | ✅ **已转正（2026-10-14 用户令「组件落 final」，与 shots 源逐字节一致 cmp 验过）**；✅ 已接运行时（WXG-T-280/281） |
| `ui_btn_start_9s(_pressed)` | shots/20261010 `btn-cta/`（9-slice cap=96/mid=8） | ✅ **已转正（同上，逐字节一致）**；✅ 已接运行时（WXG-T-280/281） |
| `ui_showcase_plate.png`（422×172 RGBA @2x，牌体 161×381 稿px） | 第十四批 B25 定稿 `production/qa/menu-b19/asset/plate-shadow@2x.png`（与用户 2026-10-14 供图 maxΔ 0 验同），令「转到 final」转入 | ✅ **已转正**；✅ 已接运行时（WXG-T-280/281）；⚠ 消费端路线待二选一（Cocos `SLICED` border 64/73/4/168 vs blit 预切三段 `b25-shadow-slice/plate-{left,mid,right}.png`，spec §8.6）；§8.7 牌宽口径待对账 |
| `ui_showcase_frame.png`（1188×1892 RGBA） | 用户 2026-10-14 供高清橱窗正本（含牌），令「去牌然后归到 final」⇒ 牌区 x[370,845] y[1420,1645]（含投影）逐行左侧干净带中位数回填（白板/层板同法，实测两带全宽近均匀），alpha 随行复制 | ✅ **已转正（去牌版）**；✅ 已接运行时（WXG-T-280/281）；⚠ 现尺寸为高清原图非 @2x 544×871 切图规格，接线时重缩；与 C2 程序化路线的关系见落地单 §5-C2 |
| `ui_btn_arrow_bg_normal/pressed` + `ui_icon_arrow_left/right` | shots/20261010 `btn-arrow/`（v14c 环槽裁法） | ⏳ 待接（同上口径注记） |
| `ui_menu_badge_locked.png/.webp`（128² @2x） | 2026-10-15 P3 未开启锁（云端 qwen-image-3.0，seed 7） | ✅ 在用。播放钮 `ui_menu_badge_pushing` 与完成章 `ui_menu_badge_done` 已删（2026-10-16，改沙漏 / 飘带） |

## 入库判据

1. 用户已对屏稿/规格拍板（引用 shots 批次或 spec 节号）；
2. 尺寸/格式合 `../specs/menu-showcase-asset-spec.md`；
3. 台账三要素：来源、定稿日期、接线目标（运行时 `assets/` 路径）。
