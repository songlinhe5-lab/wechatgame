# 归档资源生成史（Asset Provenance）

> **本件是「每张进 `final/` 的图从哪来」的唯一正本。** 建件 = 用户 2026-11-01 令「统一使用图片生成文档，记录生成历史，包括每张归档资源的生成来源（如有生成脚本需要归档），如果有原图需要指明原图是哪个并归档」。
>
> 与其它件的分工（⛔ 不重复对方内容）：
> 调用次数/出图张数/花费 → `token-plan-usage-ledger.md` · 选型与判据 → `games/beads/design/ai-workflows/model-matrix.md`
> · 端点与参数 → `backend-token-plan.md` · 接线状态与运行时路径 → `games/beads/design/art/final/README.md` 台账
> · 本文只管三件事：**生成方式 · 生成脚本 · 原图**。

## 0. 统一口径（每批四件，缺一即来源断链）

| # | 要求 | 为什么 |
|---|---|---|
| 1 | **每批出图落一份 `generation-record.txt`**，随批放在该批目录（`design/art/proposals/<批>/…`），格式 = 基准图 → 逐步（模型/通道/mask/seed/steps/cfg/denoise）→ 产出路径 → 合成脚本 | 先例两份在册：`proposals/menu-design-v2-20261031/edit-20261031/generation-record.txt`、`…/v3-20261031/generation-record-v3.txt`。本档就是把这套就地升级为全仓统一 |
| 2 | **每个入库件在本文档占一行**，三要素齐备 | 入库判据 `final/README.md` §入库判据 3 只要求「来源批次」，查不到模型/seed/脚本 |
| 3 | **一次性生成脚本必须提副本进 `games/beads/design/ai-workflows/`**（⛔ 只留 `temp/`） | `temp/` 被 gitignore、无版本兜底；本仓已因此丢过整个对比图目录（`wxgame-image-gen §6.2`）。入库副本**原样搬运**，只在 docstring 里把用法路径改指新位置，⛔ 不改算法 |
| 4 | **原图必须指到一张仓内图**；指不到就写「⚠ 原图不可得」+ 复现配方 | 判据复算与二次改件都吃原图。入库件多为 256/32 色量化 PNG，⛔ 不能拿来当母版 |

## 0.1 补充批次：关卡详情弹窗（2026-11-08 · WXG-T-602）逐件来源账

> 本批件**不是生图**，而是 **Figma 稿面切件**（设计与版式正本 = `games/beads/design/ux/level-detail-spec.md`）。设计源稿的上游生成史见 `design/art/proposals/level-detail-dialog-20261107/`（对话框壳）与 `design/art/proposals/plaque-texture-20261108/`（木牌背板纹理）。导出工具 = 仓内在册 `my-skills/wxgame-figma/scripts/figma.mjs img … --scale 2`（⛔ 无一次性脚本）。

| 件（实测规格） | 生成方式 | 生成脚本（入库路径） | 原图（入库路径 / 状态） | 批次出处 |
|---|---|---|---|---|
| `final/assets/detail/ui_detail_plaque@2x.png` 1162×2088 · 911 KB | **零生图**：Figma REST 节点 `95:116` @2x 导出；上游木牌纹理 = AI 高频木纹重铺（`plaque-texture-20261108` S3 定稿） | `my-skills/wxgame-figma/scripts/figma.mjs img` | ✅ 设计正本在册：`proposals/plaque-texture-20261108/source/dialog-v25b-750x1334-rgb.png` + 定稿 `out/ai-grain-plate4.png`；Figma 文件 `PBIK3RbfGlfzFsAnd97ZsP` 帧 `92:36` 为长期可重导源 | WXG-T-604 |
| `final/assets/detail/ui_detail_start@2x.png` 652×308 · 284 KB | 同上：节点 `119:36` @2x 导出（木钮含烘字「开始」） | 同上 | ✅ 稿面截图 `proposals/level-detail-dialog-20261107/dialog-v25b-detail-s42.png`（seed 42 定稿对照）+ Figma 帧 `92:36` | WXG-T-604 |
| `final/assets/detail/ui_detail_star_filled@2x.png` 116×120 · 9 KB<br>`ui_detail_star_empty@2x.png` 116×120 · 9 KB | 同上：节点 `133:37` / `134:409` @2x 导出 | 同上 | ✅ 同上（Figma 帧 `92:36`） | WXG-T-604 |

- **Cocos 投放件**：`games/beads/cocos/assets/textures/detail/` 四枚**同名无 `@2x`** PNG，按在册脚本 `ai-workflows/quantize-cocos-textures.py` 做 256 色 OCTREE + Floyd 抖动（911+284+9+9 KB → 108+35+2+2 KB = 147 KB，主包红线 4 MB 内）。`.meta` 由 Cocos 编辑器导入生成，⛔ 手写。
- **harness 不走投放件**：`dev/harness` 直读 `final/assets/detail/` 的 `@2x` 原件（`/detail-assets/` 白名单）。

## 0.2 派生批次：设置弹窗按钮（2026-11-13 · WXG-T-938）

> 本批**不是生图**，是既有定稿件的**无字派生**（用户令「设置页面的按钮不是选关页面的按钮设计」；UX 正本 = `ux-spec` v1.50 §2）。

| 件（实测规格） | 生成方式 | 生成脚本（入库路径） | 原图（入库路径 / 状态） | 批次出处 |
|---|---|---|---|---|
| `final/assets/menu/buttons/ui_btn_settings_9s@2x.png` 235×210 RGBA<br>`cocos/assets/textures/ui_btn_settings_9s.png` 同名同尺寸投放件 | **零模型 / 零重绘**：取选关「关闭」烘图的左右端帽（各 70px）+ 两条无字木面（x80–175 / x415–510）横向线性交叉淡化作中段；9-slice capX 70，⛔ 不传 capY | `ai-workflows/derive-settings-btn-9slice.py`（本批新入库） | ✅ `final/assets/detail/ui_level_select_close@2x.png` 602×210（Figma `160:48` @2x，来源见 §0.1 同族切件口径） | WXG-T-938 |

- **Cocos 投放件**：由派生脚本同时输出 `games/beads/cocos/assets/textures/ui_btn_settings_9s.png`；本批**暂不入库**（`.meta` 与重构建受本机 CLI `browser_1.init` 阻塞，同 `production/qa/menu-tri-state-gray-20261102.md`）⇒ 当前设置腿走已进包的 `btnWood` 过渡，待 GUI 导入后补 `.meta` + 注册，⛔ 不手写 `.meta`。
- **harness**：`dev/harness` 直读 `final/assets/menu/buttons/` 的 `@2x` 原件（`/menu-assets/` 白名单），无需投放件。
- **WXG-T-939 复用件**：设置弹窗底部「关闭」钮直接读 `final/assets/detail/ui_level_select_close@2x.png`（来源见 §0.1），**无新增资产**；本批只改绘制接线。

## 0.3 Figma 切件批次：设置项 cell 图标 / 开关（2026-11-14 · WXG-T-941）

> 本批**不是生图**：设置页新版 UI 的 6 枚 Figma 图像填充（`temp/figma/settings/images.json` + `urls.txt` 导出记录，2026-11-14），⛔ 无模型 / 无 prompt。

| 件（实测规格） | 生成方式 | 生成脚本（入库路径） | 原图（入库路径 / 状态） | 批次出处 |
|---|---|---|---|---|
| `final/assets/menu/settings/icons/ui_icon_music@2x.png` 109×115<br>`ui_icon_sound_settings@2x.png` 116×105<br>`ui_icon_motion@2x.png` 114×125<br>`ui_icon_vibrate@2x.png` 125×127 | **Figma REST 图像填充原图导出**（`figma.mjs` 图像填充腿；RGBA）+ **WXG-T-942 补投影烘焙** | 补投影：`ai-workflows/bake-settings-icon-shadow.py`（Figma 导出件为入参，画布 +12、深棕投影） | ✅ Figma 文件 `PBIK3RbfGlfzFsAnd97ZsP` · 「设置页面」抠图层（节点 id 未记录 `[TODO]`；导出原件 `temp/figma/settings/ui_icon_*.png`，临时不入库） | WXG-T-941 / 942 |
| `final/assets/menu/settings/toggles/ui_toggle_on@2x.png` 168×95<br>`ui_toggle_off@2x.png` 168×95 | 同上 | 同上 | ✅ 同上（`temp/figma/settings/ui_toggle_*.png`） | WXG-T-941 |

- **运行时接线**：`MENU_TEXTURES.settingsIcon* / settingsToggle*`（`config/tuning/menu.ts`）；harness `MENU_FILE` 已注册（`/menu-assets/settings/...`）。Cocos 投放件 / `.meta` / 构建 **待 GUI 导入**（同 §0.2 环境阻塞）⇒ 当前 Cocos 缺图腿 = 不画图标 + 程序化开关。

## 1. 本批（2026-10-30 → 11-01）逐件来源账

范围 = `final/assets/menu/` 中 `mtime ≥ 2026-10-30` 的 12 件（其余件来源见 `final/README.md` 台账与 `shots/` 证据流）。**在册 11 件**，第 12 件 `ui_menu_env` 已于 2026-11-01 裁定移出（本表保留该行作为出处账，⛔ 不当在册件用）。

| 件（实测规格） | 生成方式 | 生成脚本（入库路径） | 原图（入库路径 / 状态） | 批次出处 |
|---|---|---|---|---|
| `ui_panel_frame_9s` 520×470 RGBA<br>`ui_panel_face_9s` 520×470 RGBA<br>`ui_btn_wood_9s(_pressed)` 300×92 RGBA<br>`ui_btn_paper_9s` 150×88 RGBA | **零模型**，PIL 程序化合成九宫格（cap 60/36/76/52；装饰线只允许走角落与单边直线） | `ai-workflows/gen-settle-9slice.py`（本批新入库；脚本自述「定稿后移入 design/ai-workflows」已兑现） | ✅ 两张输入都在册：`final/assets/menu/ui_wood_grain.png`（木纹条，本身来源见 `final/README.md`：云 `qwen-image-3.0` seed 511）+ `final/prototypes/proto-v3-pushing-750x1334-at2x.png` | WXG-T-515（结算面板 9-slice） |
| `ui_menu_beam` 400×650 RGBA 3.3 KB | 程序化：光照场提取 → **强度写进 alpha 通道**（峰值 0.857，0–219 级 ⇒ 无 banding、不需抖动） | 产出脚本**未留档**；方法论正本 = 入库副本 `ai-workflows/param-env.py`（六参复现 lock-s88 光照）与 `ai-workflows/bake-env.py`（亮度场 × `bg_base`） | ⚠ 原图不可得：底图 `temp/menu-atlas/lock-s88.png`（本地 Qwen-Image-2.1 整屏稿）**已随 2026-11-01 temp 清理删除**。复现配方见 §3-① | WXG-T-516 §2/§3 |
| `ui_menu_pot` 210×415 P(256) 21.3 KB | 同上批：环境件（左上斜射光 + 左下陶盆），alpha 承载 | 同 Beam（产出脚本未留档） | ⚠ 同 Beam（`lock-s88.png` 已删） | WXG-T-516 §3 |
| ~~`ui_menu_env`~~ 192×341 **RGB（无 alpha）** 60.4 KB | **已裁移出 `final/`（2026-11-01 用户令）**：全仓零引用（文档 / `MENU_TEXTURES` / harness `MENU_FILE` / 测试均无），且 RGB 无 alpha ⇒ 不可作贴章件，判为该批中间切件误留 | 未确诊 ⇒ 随移出结案，不再考古 | ⚠ **非在册件**：物理副本 `temp/retired-20261101/ui_menu_env.png`（`.gitignore:97 temp/` ⇒ **不入库**，下轮 temp 清理会带走）；像素真要回来看 `git show afb05b35:games/beads/design/art/final/assets/menu/ui_menu_env.png`（该笔曾误随 5 张 9s 一并补入库，本批移出） | 疑似 WXG-T-516 同批 |
| `ui_menu_backdrop` 677×1210 P(128) 178.6 KB | 整屏木屋生图（三母版对照：本地 Qwen-2.1 / 云 `qwen-image-3.0` / 云 `wan2.7-image-pro`）→ 0.9× 缩放 → **k-means 加权调色板 128 色**（按饱和度 + 局部梯度分配色槽；PIL 中位切分会让占屏 70% 的木墙吃掉配额、细节区塌到 22 dB） | `ai-workflows/quantize-kmeans-weighted.py`（本批新入库，原 `temp/t521-color-sweep/weighted.py`）；Cocos 投放量化另用 `ai-workflows/quantize-cocos-textures.py`（已在册） | ⚠ 母版不可得：`temp/online-inpaint/bg_qwen-3.0_rgb.png` 等三张 RGB 母版**已随清理删除**；在册仅剩三态对照 `temp/online-inpaint/cmp_backdrop_3way.png`（⚠ 仍无版本兜底）。复现配方见 §3-② | WXG-T-521 §2 + §5 二轮 |
| `ui_showcase_frame` 1088×1742 P(32) 188.4 KB | 云 `qwen-image-3.0` **i2i**：以旧窗框为参考，`size=1088*1742`、seed 88；后处理三步 = 裁到柜体 bbox → 四角色键转 alpha → **去光**（σ=90 低频模糊场相除，除同心色带；光晕改由引擎 `drawCaseLight` 画） | 处理脚本**未留档**（三步口径完整记在 WXG-T-522 §2，可按其重建）；抠件工具另见 `ai-workflows/cut-single-local.py` | ⚠ 参考原图 = 旧 `ui_showcase_frame.png`（1188×1892，用户 2026-10-14 供高清正本，已被本版覆盖；史证在 `final/README.md` 台账行与 `art/shots/`）；同链正本 `master-single-bg.png` **本批已入库** → `proposals/menu-3d-style-20261030/plate-cut-20261031/` | WXG-T-522 §2 |
| `ui_btn_arrow_left` / `ui_btn_arrow_right` 129×129 P(256) 4.3 KB | 从整版 AI 稿切件（256 色量化）；`parts/` 八件里**仅此两件切净**（四缘各 1px 切点），其余六件 2026-10-31 用户裁定删除作废 | 切件脚本**未留档**（`parts/` 与 `sam2-parts/` 均已清空）；2026-11-01 复切走在册 `ai-workflows/cut-single-local.py --mode shape --shape disc,72,661,55` → 110×110，⛔ 未达 @2x（分辨率墙，见 `production/qa/menu-small-parts-cut-20261101.md`） | ⚠ 原图不可得：用户 2026-10-30 所供「整版木屋场景稿」（宽 720）**从未入库**，temp 副本已随清理删除 ⇒ 复现须重新取得原件，判据法见 WXG-T-517 §2（假透明双峰 ±5 + 5px 闭运算）。同批**抠件源稿**已入库：`proposals/menu-3d-style-20261030/menu-design-master-20261031.png`（752×1344 RGBA） | WXG-T-517 §2/§3 || `ui_icon_settings` / `ui_icon_rank` / `ui_icon_calendar` / `ui_icon_skin` 各 160×160 RGBA<br>（`final/assets/menu/` 美术真源 + `cocos/assets/textures/` 投放件两份同名；`.meta` 的 trim 由 Cocos 重算、uuid 未变） | **2026-11-02 替换**（原为彩色扁平图标，灰齿轮/紫奖杯/橙日历/绿T恤）：本地 ComfyUI `Qwen_image_2.1`（int8，25 步 / cfg 1.0 / euler-simple / 1024²，seed 11 或 222）出线稿底图 → **位图追踪转矢量**（crack-following → Chaikin(2) → RDP(0.9) → 按外接圆归一 35.0/100 → SVG 单 path `evenodd`）→ 栅格化 160² | `ai-workflows/trace-icon-lineart.py`（本批新入库，原 `temp/m8-trace.py` 原样搬运） | ⚠ 原图不可得：底图在 `temp/comfyui-out/m8-{rank-v2-s11,calendar-s11,skin-v2-s222}/`（`temp/` 不入库）。复现配方（逐字提示词 + seed + 参数 + 择优理由）见 `proposals/menu-3d-style-20261030/btn-topbar-traced-v2-20261102/p-btn-traced-v2.txt`；同族云端横比对照片见 `…/btn-topbar-traced-cloud-20261102/p-btn-traced-cloud.txt` | WXG-T-541/542/543（出图与定稿）+ WXG-T-545（接入运行时） |

| `ui_btn_circle_normal` / `ui_btn_circle_pressed` 各 160×160 RGBA<br>（`final/assets/menu/` 美术真源 + `cocos/assets/textures/` 投放件两份同名） | **2026-11-02 替换**（原为「白圆盘 + 宽柔投影」，按下 = 投影变窄）：底托取 T-539 共用木牌 `btn-base-2x-160.png`，**满幅不缩不位移**（⛔ 源 bbox 占满 0..159：上移会把盘顶切平＝T-546 首版；加外投影会溢出被裁＝T-547 版）。立体感改由**内缘刻印**表达：内缘环 = 盘体 alpha 减 `MinFilter(7)` 腐蚀版，上缘深、下缘浅，叠 28% 深棕黑；按下 = 整体亮度 ×0.90 + 内缘加深到 44%。⛔ 不缩盘体（缩到 0.90 才能容纳完整外投影，但 `MENU_TOPBAR_VISUAL_D = 80` 按满幅铺满绘制 ⇒ 盘体实显只剩 Ø72，四钮会明显小于其他 UI） | `ai-workflows/gen-circle-base-2state.py`（本批新入库，原 `temp/m10-base-gen.py` 原样搬运） | ✅ 底托原图在册：`proposals/menu-3d-style-20261030/btn-topbar-layered-20261102/btn-base-2x-160.png`（来源见 T-539 批次说明；该件本身是从模型出图抽取的共用底托） | WXG-T-539（底托）+ WXG-T-546（接入运行时） |

| `final/v1/assets/menu/`（**归档快照**，现 **32 件** / 初封 41 件，非现役件） | 2026-11-02 用户令「把现在老的一套设计资源归档 v1」：以 `21a8e52d` 为基准提交，逐件 `cp -a` 复制成品 41 件 + 当时 `README.md` 台账副本（`v1/README-v1.md`）；`coordinates/`（7 件 9.5 MB）与 `prototypes/`（7 件 9.6 MB）属中间稿、体积大**不入快照**，回看走 `git show 21a8e52d:games/beads/design/art/final/<dir>/<file>`。**2026-11-02 用户二次裁定（WXG-T-551）**：初封误把 v2 起步件当 v1 ⇒ 撤出 9 件（`ui_menu_backdrop` · `ui_icon_{skin,rank,settings,calendar}` · `ui_btn_circle_{normal,pressed}` · `ui_btn_arrow_{left,right}`），只留现役 `assets/menu/` 一份，41→32 件；旧版（白盘底圆/旧四图标）仅存于不入库的 `temp/backup-ui-*-20261102/` | 无（纯复制归档 + 撤件，不涉生成） | ✅ 原图即所列各批次原件（本表上述各行） | WXG-T-550（v1 归档）→ WXG-T-551（撤 9 件）；初封一致性校验：`v1/assets/menu` 与 `assets/menu` 的 md5 集合同为 `bfa3f01b3859a98d7f46c6c03c95f83d`，**T-551 后 v1 为 32 件子集、两者不再相同** |

### 累计状态

- 12 件按件数分档：**三项齐备（生成方式 + 脚本 + 原图都在册）= 5 件**（9-slice 族）；**原图已失 = 5 件**（`beam` / `pot` / `backdrop` / 箭头两件）；**脚本未留档 = 3 件**（beam+pot 共一条、showcase_frame、箭头两件）；**已裁移出 = 1 件**（`ui_menu_env`，零引用且无 alpha ⇒ 2026-11-01 用户令移出 `final/`，故本批在册件为 11）。
- ⇒ 没有任何一件是「四项全缺」，也没有一件能直接重跑复现：**要重跑必须先补 §3 的 seed/提示词**。
- 本批新入库：**6 个脚本** + **3 张原图/正本**（含 1 份指令文本）。
- **2026-11-02 补录 4 件**（`ui_icon_{settings,rank,calendar,skin}`，替换原有彩色扁平图标）：属**范围外补录**（mtime 晚于本批统计窗），三项里「原图」= ⚠ 不可得、「脚本」= 已入库、「生成方式」= 齐备。
- **2026-11-02 再补录 2 件**（`ui_btn_circle_normal/pressed`，白圆盘换木质圆牌）：三项**齐备**（生成方式 + 脚本 + 原图均在册），是本档少见的可直接重跑件。

## 2. 本批归档动作清单（可核对）

| 入库件 | 来源（temp 原件，保留不删） |
|---|---|
| `ai-workflows/gen-settle-9slice.py` | `temp/gen-settle-9slice.py` |
| `ai-workflows/local-qwen-masked.py` | `temp/online-inpaint/local_qwen.py`（本地 Qwen-Image-2.1 指令/masked 编辑入口，SKILL §2 长期缺兜底的正是这条腿） |
| `ai-workflows/inpaint-add.py` | `temp/menu-states/inpaint-add.py`（局部重绘入口，SKILL §2 明文警告「temp 一清即断」） |
| `ai-workflows/bake-env.py` / `param-env.py` | `temp/menu-atlas/{bake_env,param_env}.py` |
| `ai-workflows/quantize-kmeans-weighted.py` | `temp/t521-color-sweep/weighted.py` |
| `proposals/menu-3d-style-20261030/menu-design-master-20261031.png` | 原已在工作树（**未 commit**），本批补入库 = 全部抠件批的源稿 |
| `proposals/menu-3d-style-20261030/plate-cut-20261031/master-single-bg.png` | `temp/…/master-single-bg.png`（752×1344 RGB，单橱窗正本；台账 §6 记的「尚未入库正本」之一） |
| `…/plate-cut-20261031/hero2x-e1.png` | `temp/…/hero2x-e1.png`（752×1344 RGB，@2x 试验件；另一张「尚未入库正本」） |
| `…/plate-cut-20261031/p-master-single.txt` | 同批**编辑指令正本**（单层空柜 + 只留中间一盏射灯 + 背板锐度不得虚化），与 `master-single-bg.png` 同目录 |
| `final/assets/menu/{ui_panel_frame_9s,ui_panel_face_9s,ui_btn_wood_9s,ui_btn_wood_9s_pressed,ui_btn_paper_9s}.png` | 原已在磁盘**未 commit**（WXG-T-521 §4 就记着「工作树里未提交的 5 张 9s 图」），本批补入库 ×5。⚠ 同日曾一并补入 `ui_menu_env.png`，随即被用户裁定移出（见 §1 该行）⇒ 计数按 5 件计 |

⚠ 未随本批入库：`proposals/menu-style-candidates-20261030/` 5 张（8.6 MB，`opt-{a,b}-t2i-s{42,7}` / `opt-c-i2i-s42` / `menu-baseline` / `menu-current`）—— 属**风格候选**而非在册件的母版，是否长期入库待用户另裁（否则应从工作树清出）。

## 3. 原图缺口的复现配方（重跑时照此，⛔ 凭记忆）

**① `ui_menu_{beam,pot}` 的底图 `lock-s88.png`**（WXG-T-516）
本地 ComfyUI `192.168.1.16:8188` · `qwen-image-2.1` t2i，白名单法提示词（「独立物体数量与参考图完全一致 + 唯一允许新增一处」，实测视觉密度 2.49x 为六版最低）；控件占 68% 画面，⛔ 不试图 inpaint 回原像素——只要它的**光照结构**，色相 100% 由 `bg_base` 决定（`param-env.py` 六参法 / `bake-env.py` 亮度场法）。⚠ 提示词正本 `temp/menu-atlas/p5-whitelist.txt`、`p6-lock.txt`（temp 内，未入库）。

**② `ui_menu_backdrop` 的三张母版**（WXG-T-521 §5）
`bg_qwen-3.0_rgb.png` = 云 `qwen-image-3.0` 整屏木屋（RGB 996.3 KB，三母版里最小）；另两张 = 本地 Qwen-2.1（1086.8 KB）、`wan2.7-image-pro`（1144.7 KB）。入库走「0.9× → 677×1210 + k-means 128 色」（细节区 PSNR 33.2 vs 中位切分 32 色 22.2）。⚠ 三条 seed 与提示词**未登记**，重跑需先补记。

**③ 箭头两件的整版源稿**（WXG-T-517）
用户提供、宽 720、**从未入库**。要重切必须先重新取得原件；`cut-single-local.py` 的 `--check` 与内容尺寸判据已在册，源稿到手即可复切，但 @2x 分辨率墙（1.36× 判废线）仍未解 → 见「小件抠稿两道墙」（`wxgame-image-gen §3`）与待拍板的四条出路。

## 4. 缺口与纪律（本档欠的账）

1. ~~`ui_menu_env` 待裁~~ **已闭（2026-11-01 用户令：移出 `final/`）**，隔离于 `temp/retired-20261101/`；来源不再考古（零引用 + 无 alpha + 中间切件，转正无收益）。
2. **5 条 seed/提示词未登记**：backdrop 三母版、`lock-s88` 的 t2i seed。以后按 §0-1 当场写进 `generation-record.txt`，⛔ 事后考古。
3. **原图缺口 3 处**（§3）根因同一个：temp 无版本兜底 + 归档动作滞后。⇒ 立为硬纪律：**「图入 `final/` 的同一批内，脚本与原件必须一起入库或写明配方」**，已同步进 `my-skills/wxgame-image-gen/SKILL.md §6`。
4. `shots/` 与 `production/qa/menu-b*/` 的 53 件取证快照**保持原格式**（含 `.webp`），换格式会破坏当时读数的逐字节复现（K-131），⛔ 不迁。
5. 追加方式：新批次**在本表上方追加一节**（按日期倒序），⛔ 不回改历史行；用量仍记 `token-plan-usage-ledger.md`。

## 5. 2026-11-04 批（WXG-T-574 · 原型 v3 三态 + Figma 坐标图）

| 件 | 生成方式 | 产出脚本 | 原图 |
|---|---|---|---|
| `final/prototypes/menu-design-figma-v2-20261104.png` | Figma REST 下载（`img`），零重绘 | `my-skills/wxgame-figma/scripts/figma.mjs` | Figma `PBIK3RbfGlfzFsAnd97ZsP` · `2:81` |
| `final/coordinates/menu-master-coords-v2-20261104.png` | 同上 | 同上 | 同上 · `50:113` |
| `final/prototypes/proto-menu-v3-{locked,pushing,cleared,fullstar}-752x1344.png` | 程序化像素变换（贴回三步 + 磨砂 / 竖向揭彩 / 满星行），零模型 | `games/beads/design/ai-workflows/proto-from-figma.py` | 既有基准图 + `proposals/menu-3d-style-20261030/figma-elements-20261104/` 四件（Figma `46:21` / `47:19` / `47:20` / `44:64`）+ 木刻沙漏章 |
| `proposals/.../figma-elements-20261104/*.png` | Figma REST 切图（`@scale 2`，真 alpha） | 同上 `figma.mjs` | 同上四个节点（`ui_menu_art_cat.png` 新增，供豆画 alpha 重心计算） |

判据：四次贴回**区外 maxdiff = 0**（脚本 assert）；接线目标 = 原型设计，**不进运行时 assets**。基准图 `menu-design-baseline-cat-topbar-final-slotbar-20261102.png` 未改动；v2 三态按用户令从目录移除（git 历史可取回）。

**追加令（同日）**：`cleared` 去框、去底座三颗星（只留通关圆章）；新增 `fullstar` = 珠圈框 + 三颗金星，框 bbox 平移到 `44:64` 豆画 alpha 重心（dx −13.8 / dy +38.5 设计 px），金星随框同步下移仍落圆台。方案按用户令在「移框对齐 / 移框不带星 / 重贴豆画」三法中选**移框对齐**（零抠图、零擦除、零模型）。

⚠ **上段口径已被第二次追加令覆盖**：`fullstar` 框改为放大到 488×455 并居中于豆画 **bbox**（不再用 alpha 重心）、三颗星退场；`cleared` 通关章移到豆画 bbox 右上内缩 8px；`locked` 去蒙版去框、只灰小猫、锁贴 bbox 正中。方法仍在「放大框·bbox 居中 / 保持 426² / 缩到同尺寸」与「bbox 右上 / 裁切区右上 / 外挂」中由用户选了两项推荐。

**模板匹配实测（本批关键）**：`44:64` 切图与基准图豆画 RGB 逐点匹配 ⇒ 位移 **(+26,+7)**、scale 1.0、MAE 5.38；脚本以 `ART_SHIFT` 常量固定，置灰 mask / 框 / 章 / 锁全部按真实图案位置落位。零新依赖（numpy）。五次贴回与合成区外 maxdiff = 0。运行时接线差异见 `final/README.md §1b`（WXG-T-566 三态标记已退场，本批原型属设计示意，未改代码）。

**第三次追加令（同日）**：`pushing` 去框、去中间沙漏、小猫图案本身上半置灰。方法 = 程序化局部置灰（零模型）：`art_mask()` 真 alpha 抽为共用函数，`gray_art_top()` 给 mask 乘竖向揭彩 ramp（灰自上而下 / 彩自下而上，彩高度 `PROGRESS=0.40`，柔带 `WIPE_SOFT=0.08`）；`FRAME_BOX` 常量与整个 `framed` / `fade` / `pb.stamp` 沙漏分支**删除**。判据：区外 maxdiff=0，改动 4.5% 且包围盒止于 y=742（豆画中线之上）；豆画饱和度基准上/下 95.8/75.8 → 46.2/64.4。灰/彩分界沿用既有 0.40 推关口径（未改成精确 1:1）。

## 6. 2026-11-04 批（WXG-T-575 · Figma v2 菜单切图 16 件）

| 件 | 生成方式 | 产出脚本 | 原图 |
|---|---|---|---|
| `final/assets/menu/ui_menu_backdrop_figma.png` | Figma REST `img` 节点导出（`@scale 2` / PNG），**纯下载、零重绘、零模型**；高亮态直接取现成 `State=Highlight` 组件，⛔ 无滤镜二次生成、无合成 | `my-skills/wxgame-figma/scripts/figma.mjs`（`me` 验凭证 → `tree --depth 6` 定位 → `img --ids` 导出） | ⚠ **原图不在仓内**：Figma 云端文件 `PBIK3RbfGlfzFsAnd97ZsP` 节点 `2:98`；复现配方见下 |
| `final/assets/menu/ui_menu_signboard_figma.png` | 同上 | 同上 | ⚠ 同上 · `2:82` |
| `final/assets/menu/ui_btn_{settings,rank}_{normal,highlight}.png`（4 件） | 同上 | 同上 | ⚠ 同上 · `23:4` / `23:11` / `23:7` / `23:14` |
| `final/assets/menu/ui_btn_{calendar,skin}_{normal,highlight}.png`（4 件） | 同上 | 同上 | ⚠ 同上 · `23:18` / `23:25` / `23:21` / `23:28` |
| `final/assets/menu/ui_btn_prev_{normal,highlight}.png`（2 件） | 同上 | 同上 | ⚠ 同上 · `23:32` / `23:34` |
| `final/assets/menu/ui_btn_next_{normal,highlight}.png`（2 件） | 同上 | 同上 | ⚠ 同上 · `23:37` / `23:39` |
| `final/assets/menu/ui_btn_start_{normal,highlight}.png`（2 件） | 同上 | 同上 | ⚠ 同上 · `23:42` / `23:44` |

**复现配方（逐字，⛔ 凭记忆）**：凭证 `FIGMA_API_KEY`（环境变量或仓根 `.env.local`，`figd_` 开头）；工作目录 = 仓根。

```bash
node my-skills/wxgame-figma/scripts/figma.mjs me
node my-skills/wxgame-figma/scripts/figma.mjs img "https://www.figma.com/design/PBIK3RbfGlfzFsAnd97ZsP/x" \
  --ids "2:98,2:82,23:4,23:7,23:11,23:14,23:18,23:21,23:25,23:28,23:32,23:34,23:37,23:39,23:42,23:44" \
  --out temp/figma/assets-probe --format png --scale 2
```

导出件文件名形如 `23-7.png`（`:` → `-`），按 `final/README.md §1c` 的映射表改名复制进 `final/assets/menu/`。本批中间导出件留在 `temp/figma/assets-probe/`（`temp/` 不入库）。

**三要素自证**：生成方式 / 产出脚本齐备；**原图 = ⚠ 云端不可得**（这是本批按 `§0` 第 4 条与 `final/README.md §入库判据 3` 判为「候选、未转正」的硬理由）。入库件本身即 Figma 导出的逐字节副本（16/16 md5 与 `temp/figma/assets-probe/` 源件一致），可作复现对照，但按 §0 口径「入库件不能拿来当母版」，故不冒充原图。

**零改动判据**：复制时对每个目标路径先 `assert not exists`（硬拒覆盖），复制后 16/16 md5 相等；现役 9 件未被读写。尺寸/模式/alpha 读数：背景 1500×2668 alpha 恒 255，其余 15 件均 RGBA 且 alpha 覆盖 0–255（真透明）；全部 `@scale 2`，设计 px = 尺寸 ÷ 2。

**接线目标**：无（候选件）。`19:*` 派生副本、`29:*` 设计稿实例、`50:*` 坐标标注区均未入库，理由见 `final/README.md §1c`。

## 7. 2026-11-04 二次令（WXG-T-575 · 分层底托 + 真矢量图标）

用户令「重新拉一套背景/高亮图替代圆牌两态，按钮图中 icon 做为矢量图」；四组选项拍板 = 追踪转真 SVG / 设计+Cocos 同步覆盖 / 高亮照 Figma 原样 / 删 8 张整钮。

| 件 | 生成方式 | 产出脚本 | 原图 |
|---|---|---|---|
| `final/assets/menu/ui_btn_circle_{normal,pressed}.png` + `cocos/assets/textures/` 同名两件 | Figma REST `img` 分层节点导出（@2x），纯下载零重绘 | `my-skills/wxgame-figma/scripts/figma.mjs` | ⚠ 云端 `23:19` / `19:7`；配方见下 |
| `proposals/.../btn-topbar-figma-20261104/icon-{settings,rank,calendar,skin}.svg` | 位图追踪转真矢量（白底合成 → crack-following 轮廓 → Chaikin(2) → RDP(0.9) → 外接圆归一 → `evenodd` path） | `games/beads/design/ai-workflows/trace-figma-icons.py`（复用 `trace-icon-lineart.py` 函数段，⛔ 不改历史脚本） | ✅ 在仓内：同目录 `icon-*-source-white.png`（Figma `23:6/13/20/27` 透明底位图合成白底） |
| 同目录 `icon-*-2x-160.png` | SVG 扫描线栅格预览 | 同上 | 同上 |

**复现配方**：

```bash
node my-skills/wxgame-figma/scripts/figma.mjs img "https://www.figma.com/design/PBIK3RbfGlfzFsAnd97ZsP/x" --ids "23:19,19:7,23:6,23:13,23:20,23:27" --out temp/figma/layered-20261104 --format png --scale 2
python3 games/beads/design/ai-workflows/trace-figma-icons.py
```

**实测**：四个 `base` 共用同一 `imageRef ffe4b37c…`，高亮仅 `exposure +0.12` ⇒ 无独立第二套图；四个 `icon` 是 IMAGE 填充（⛔ 非矢量），故必须追踪；`23:19` / `19:7` 为 80×80 设计 px ⇒ @2x 恰 160×160，与现役圆牌同尺寸。4/4 SVG 无内嵌位图；两态底托 4 个文件 md5 与导出件相等、`.meta` uuid 未改。8 张整钮 `git rm`，历史可取回。构建与门禁读数见 `production/TASKS-DETAIL.md §WXG-T-575 §8`。

## 8. 2026-11-04 批（WXG-T-576 · 2x 重组）

| 件 | 生成方式 | 产出脚本 | 原图 |
|---|---|---|---|
| `assets/menu/{background,buttons,icons,badges}/*@2x.png` 共 15 件 | 纯文件重组（`rename`），零像素改动 | `games/beads/design/ai-workflows/reorg-menu-assets.py` | ✅ 各自前一版同名 PNG（git 历史 + 本档 §6/§7） |
| `badges/ui_menu_badge_progress@2x.png` 342×420 | PIL `LANCZOS` 降采样（820×1008 → 342×420），零模型零重绘 | 同上 | ✅ `proposals/menu-3d-style-20261030/badge-source-20261104/ui_menu_badge_progress-source.png` |
| `badges/ui_menu_seal_cleared@2x.png` 202×280 | 同上（441×610 → 202×280） | 同上 | ✅ 同目录 `ui_menu_seal_cleared-source.png` |
| `assets/menu/asset-map.json` | 脚本按分组生成（17 条：Cocos 扁平原名 → 子目录/`@2x` 路径） | 同上 | — |

**目标尺寸依据**：`badge_progress` = 最后一次在册 `MENU_PROGRESS {w:171,h:210}` ×2（比例 0.814 vs 源图 0.813）；`seal_cleared` = 现行 `MENU_SEAL {w:101,h:140}` ×2（0.721 vs 0.723）。台账里「v2 方图 210×210 / 3:4 120×160」写明是「**若日后恢复三态腿**才改」的未落地口径，本批不适用。

**复现**：`python3 games/beads/design/ai-workflows/reorg-menu-assets.py`（可续跑，已处理件幂等跳过）。

**接线**：`dev/harness/main.ts::MENU_FILE` 在册 9 件改指子目录路径；`check-cocos-mask.mjs` 归属腿改读 `asset-map.json`，缺映射或路径不存在即 fail loud；Cocos 投放侧保持扁平原名。⚠ 两件重采样后与 Cocos 侧旧高清件尺寸不同，门禁以显式 SKIP 清单列出（⛔ 非已验，K-036），详见 `production/TASKS-DETAIL.md §WXG-T-576`。

## 9. 2026-11-04 批（WXG-T-577 · badges 三件套替换）

| 件 | 生成方式 | 产出脚本 | 原图 |
|---|---|---|---|
| `badges/ui_menu_lock@2x.png` 192×260 | Figma `@scale 2` 切图 + 右补 1px 全透明边（零缩放零重采样） | `games/beads/design/ai-workflows/replace-menu-badges.py` | ✅ `proposals/.../figma-elements-20261104/ui_menu_badge_locked_figma.png`（Figma `47:19`，191×260） |
| `badges/ui_menu_frame@2x.png` 854×854 | 同上（右下各补 1px） | 同上 | ✅ 同目录 `ui_menu_frame_pearls.png`（`46:21`，853×853；中空真透明、75% alpha=0，⛔ 无需抠图） |
| `badges/ui_menu_seal@2x.png` 180×180 | 同上（下补 1px） | 同上 | ✅ 同目录 `ui_menu_seal_cleared_figma.png`（`47:20`，180×179） |
| `proposals/.../badges-retired-20261104/*.png` | `git mv` 归档老三件（白盘锁 / 沙漏 / 通关飘带），零像素改动 | 无 | ✅ 即所列三件自身 |

**自证**：三件原内容逐像素不变（`numpy` 断言 `new[:h,:w] == src`），新增边 RGBA 全 0（全透明）；偶数尺寸符合 2x 口径。

**改名与接线**：`MENU_TEXTURES.badgeLocked/badgeProgress/sealCleared` → `lock/frame/seal`（textureId 同步改 `bitmap__menu_lock/frame/seal`），连动 `src/view/meta-widgets.ts`、5 个测试文件、`dev/harness/main.ts`、`beads-blit-carrier.ts` 的键；Cocos 镜像由 `pnpm run framework:sync` 生成（⛔ 未手改）。`asset-map.json` 键仍为 Cocos 扁原名、值改指新三件；Cocos `textures/` 文件名与内容保持旧值（用户拍板只改设计真源侧）。

**门禁**：`check:cocos-mask` 三件尺寸与投放件不同，进显式 SKIP 清单（⛔ 非已验，K-036）；其余归属 6/9、互异保持率 2 对、33 件源↔产物等值全绿。详见 `production/TASKS-DETAIL.md §WXG-T-577`。

## 10. 2026-11-05 批（WXG-T-584 ③a · 顶板 logo 改名重出）

| 件（实测规格） | 生成方式 | 生成脚本（入库路径） | 原图（入库路径 / 状态） | 批次出处 |
|---|---|---|---|---|
| `final/v1/assets/menu/ui_menu_logo.png` 960×772 RGBA | Token Plan `wan2.7-image` i2i + `bbox_list` 框选，**3 次调用 / 3 张 / 零浪费**（seed 4201 弃件、4202 全字区、4203 仅首字）→ 确定性合成（框外逐像素取原图 + 蝴蝶结矩形回取） | `games/beads/design/ai-workflows/logo-rename-compose.py` | ✅ 底图 = 同路径旧版（git `HEAD` 前一版可取，已入库）；三张云图原样留档 | `design/art/proposals/logo-rename-20261105/`（`generation-record.txt` + `s4201/4202/4203.png`） |
| `cocos/assets/textures/ui_menu_logo.png` 960×772 P256 107.1 KB | 现役 octree 配方（`quantize-cocos-textures.py::ship_rgba_octree`），⛔ 不用 `ship()`（存 RGBA 多花 225 KB，而它防的同族态抹平对本件不适用） | 同上脚本（`--apply` 一并写） | ✅ 即上行 RGBA 正本 | 同上 |

**自证**：保留区被改动像素 = 0（木牌 / 双绳 / 蝴蝶结逐像素不变）；真透明自证 = alpha=0 占比 48.56%、极值 0..255（⛔ 只查 mode 会被 RGBA 假透明骗过）；投放件回读逐位一致。

**读数**：投放件 117.3 → 107.1 KB（−10.2）；重建后主包 2755.5 → **2745.3 KB**（引擎分离档，余量 1350.7 KB）；版本 v1.0.33 → **v1.0.34**；`check:cocos-mask` 由 FAIL（产物陈旧）转 **OK**；`verify` 23/23。

---

### 分享卡配图（WXG-T-590 · 2026-11-07）

| 资产 | 生成/处理 | 脚本 | 可复现锚 | 生成史 |
|---|---|---|---|---|
| `design/art/proposals/share-card-20261107/s74.png` 1280×1024 RGB | 云 **`qwen-image-3.0`** t2i（按量通道 maas），**4 次调用 / 4 张 / 浪费 0**（s41 实物感强且珠阵不可辨、s52 单色备选、s63 心形未成形、s74 定稿） | `games/beads/design/ai-workflows/dashscope-generate.py` | ✅ 四张原样留档 + 提示词与 seed 全留 | `design/art/proposals/share-card-20261107/`（`generation-record.txt` + `s41/s52/s63/s74.png`） |
| `games/beads/share/share-card.jpg` 640×512 baseline JPEG 48.2 KB | PIL `convert('RGB').resize((640,512), LANCZOS)` + `quality=85, optimize=True`；⛔ 不用 PNG（同图 PNG-P256 = 178.8 KB，而分享卡不需要透明） | 无（一次性确定性缩放，完整命令写进生成史） | ✅ 即上行正本 | 同上 |

**自证**：四张均**无文字**（目视复核，⛔ 未出伪汉字）；发布件尺寸 640×512 恰为 **5:4**（微信分享卡建议比例）；
编码为 **baseline JPEG**（非 progressive，解码兼容面最广）。

**读数**：装配后主包 2638.4 → **2686.7 KB**（137 文件，距 4096 红线余量 **1409.3 KB**）；
版本 v1.0.41 → **v1.0.42**；产物体积 **49365 字节**，与仓内正本逐字节一致。

## 11. 2026-11-08 批（道具图标 · 熨贴片 / 抖豆筛 / 扫豆刷）

| 件（实测规格） | 生成方式 | 生成脚本（入库路径） | 原图（入库路径 / 状态） | 批次出处 |
|---|---|---|---|---|
| `final/assets/powerup/powerup_window_restore.png` 512×512 RGBA | Token Plan `qwen-image-3.0-pro` t2i（1024×1024，seed 42）→ 白底边缘连通抠图 | `games/beads/design/ai-workflows/powerup-icon-key-rgba.py` | ✅ `proposals/powerup-icons-20261108/raw/window_restore-qwen3pro-s42.png` | `proposals/powerup-icons-20261108/generation-record.txt` |
| `final/assets/powerup/powerup_random_restore.png` 512×512 RGBA | 同上 | 同上 | ✅ `raw/random_restore-qwen3pro-s42.png` | 同上 |
| `final/assets/powerup/powerup_tray_restore.png` 512×512 RGBA | 同上 | 同上 | ✅ `raw/tray_restore-qwen3pro-s42.png` | 同上 |
| `proposals/powerup-icons-20261108/panel-rgb-erased-v5-tiles-removed.png` 581×1044 RGB | 面板 v4 底图上擦除三个道具格（多尺度底色 + 木纹高通补回） | `games/beads/design/ai-workflows/powerup-panel-tile-erase.py`（⚠ 输入为 temp 底图 v4，未入库） | ✅ 即本件（已上 Figma `95:116`） | 同上 |
| `final/assets/powerup/tiles/powerup_{window,random,tray}_restore_tile.png` 各 336² RGBA（设计尺度 84×84，`[WXG-T-601]` 关卡详情道具行消费） | **零模型**，PIL 程序化合成：木棕圆角框（84² 画布内 (12,12)-(72,72)、r14、3px 内缘）+ 米底 (245,230,200) + 图标 44² LANCZOS 居中；外投影 (55,28,8) y+4 / blur 3 / α0.45（与星级同参），4× 超采样后缩到 336² | `games/beads/design/ai-workflows/powerup-tile-frame-render.py` | ✅ 输入图标三件即上一行 512² keyed 件；矩阵正本 = Figma 节点 `92-36`（file `PBIK3RbfGlfzFsAnd97ZsP`） | 同批（生成史 `proposals/powerup-icons-20261108/generation-record.txt`）；运行时接线 = WXG-T-601 |

## 12. 2026-11-11 批（WXG-T-614 · 倒计时结束弹窗三件）

| 件（实测规格） | 生成方式 | 产出脚本 | 原图 | 批次出处 |
|---|---|---|---|---|
| `final/assets/detail/ui_timeout_plaque@2x.png` **1098×1172** RGBA / 904,481 B | Figma REST `img` `--scale 2`（节点 `231:283`，导出 1162×2088）→ **alpha bbox 裁切**（设计 px (16,211)–(565,797) ⇒ 源纹 (32,422)–(1130,1594)），**零模型零重绘零重采样** | `my-skills/wxgame-figma/scripts/figma.mjs` + PIL `crop`（一次性 inline，本批未固化脚本） | ⚠ **原图不在仓内**：Figma 云端 `PBIK3RbfGlfzFsAnd97ZsP` 节点 `231:283`（页 `225:126` / 帧 `231:281`）；中间导出件留 `temp/figma/timeout/231-283.png`（`temp/` 不入库） | 规格正本 `games/beads/design/ux/timeout-panel-spec.md` §6；登记 `docs/architecture/ui-architecture-beads.md §12` |
| `final/assets/detail/ui_timeout_continue@2x.png` **852×308** RGBA / 269,668 B | 同上（节点 `233:54`，**无裁切**）；图内**只含左侧 ▶ 图标不含文字**（文字运行时画） | 同上 | ⚠ 同上 · `233:54`；`temp/figma/timeout/233-38.png` | 同上 |
| `final/assets/detail/ui_timeout_retry@2x.png` **834×274** RGBA / 242,523 B | 同上（节点 `233:58`，**无裁切**）；只含左侧循环箭头 | 同上 | ⚠ 同上 · `233:58`；`temp/figma/timeout/233-48.png` | 同上 |
| `cocos/assets/textures/detail/ui_timeout_{plaque,continue,retry}.png` 各 **@2x 同尺寸** P256 / **76,493 / 23,566 / 27,872 B** | `ship_rgba_octree()` = PIL **RGBA** `FASTOCTREE(256)`（尺寸不变 ⇒ 九宫格 cap 按源纹 px 口径）；写盘后回读逐位一致已断言 | `games/beads/design/ai-workflows/quantize-cocos-textures.py::ship_rgba_octree`（按 `menu-v2-ship.py` 的 exec 去尾行 `main()` 术式 inline 调用） | ✅ 即上三行正本 | 同上 |

**配方选型与披露（⚠ 与脚本 docstring 口径不一致，此处显式对齐）**：`quantize-cocos-textures.py` 把 `ship_rgba_octree` 注为「只用于对照/自测，⛔ 不再作为产出」—— 那是 **BD-61 菜单按钮批**的口径（病灶 = 同族两态的按下暗边被并色）。本批三件**均单态无同族兄弟**，按 **T-584 §10 / T-585** 已入库先例（无同族态 ⇒ octree；有两态 ⇒ `ship()`）取 octree。实测对照 `ship()` = **246.6 / 127.6 / 111.6 KiB（3.6×）**且本批不存在它要防的同族抹平 ⇒ 取 octree。

**质量读数（可复算，2026-11-11 实测）**：共同可见区（双方 α>0）RGB mean/max = **2.932/51**（牌）、**3.090/39**（续时）、**3.276/44**（重试）；alpha mean/max 差 = **1.03/39**、**1.28/38**、**1.18/45**，α 误差 >8 的像素只占 **0.356% / 1.001% / 1.012%**、>32 只占 **≤0.0114%**（均落在边缘抗锯齿带）。源图 α 主峰：牌 **255**（96.5%，partial 2.52%）、两钮 **252–255**（近不透明；technical partial 占 64.88% / 71.63% 但均在 252–254）⇒ octree 对 alpha 的扰动不影响边缘观感。

**包体**：`cocos/assets/textures/` 1900 → **2028 KiB（+125 KiB）**。

**⚠ `.meta` 未签发**（L1 ⛔ 不伪造）：本机无 Cocos 编辑器 ⇒ 三件暂不进 `textures` Bundle，真机自动走规格 §9 的**元素级回退腿**（同几何、零功能回归）；解除条件 = 编辑器 reimport `cocos/assets/textures/detail/`。
