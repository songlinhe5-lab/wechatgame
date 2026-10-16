# 菜单布局落地单 · §7 施工状态史证（WXG-T-280 · 2026-10-15）

> 本件 = `menu-layout-implementation-spec.md` **§7 整节逐字节外移**（WXG-T-282 提交时因 B 预算门 9414>8000 tok 拆分；主件 §7 留指针，⛔ 号位不复用）。规则真源仍在主件 §1–§6/§8–§9。

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

**v3.7 批（2026-10-16，用户裁：原型修正 + 缩招牌 + 未开启淡化 + 木牌标题）**：

- 原型 v3 三态（推关中 / 未开启 / 已通过）由脚本按本单链合成：顶栏三钮改正本圆钮+图标（proto-v2 设置钮重影作废）、CTA 改正本 `ui_btn_start_9s` 横向三段 + 文案「开始游戏」34 白；坐标总图与五档图同脚本重出（五档图此前停在 v3.4，本批起与总图同口径）。
- `tuning.ts`：`MENU_SIGN_FRAME` → `{ x: 190, w: 370, h: 240, bowYOff: 61, boardCyOff: 158 }`、`MENU_SIGN_CHAIN_H` 214 → 165；新增 `MENU_PLATE_TITLE`。
- `palette.ts`：新增 `beadFadedInksFor`（未开启淡灰墨）；`meta-view.ts` 按态取墨、木牌位图就绪时画标题（无底面不写字）。
- 关卡接口 `BeadsLevelRaw.title?`（`levels-data.header.txt`；生成器透传，零脚本改动）。
- 测试：`menu-anchors.test.ts` 五档账重钉；`menu-layout-v35.test.ts` 新增「招牌板体不压顶栏钮」；新增 `menu-plate-title.test.ts`（标题两腿 + 淡墨逐色更浅）。

未 commit。

