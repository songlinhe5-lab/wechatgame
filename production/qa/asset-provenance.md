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

| `ui_btn_circle_normal` / `ui_btn_circle_pressed` 各 160×160 RGBA<br>（`final/assets/menu/` 美术真源 + `cocos/assets/textures/` 投放件两份同名） | **2026-11-02 替换**（原为「白圆盘 + 宽柔投影」，按下 = 投影变窄）：底托取 T-539 共用木牌 `btn-base-2x-160.png`。常态 = 盘体上移 4px 后叠投影（盘体 alpha 下移 7px → 高斯模糊 4 → 40% 深棕黑）；按下 = 同盘体亮度 ×0.90、**无投影**（木牌本身无内投影，故不再沿用白盘版「投影紧贴变窄」的口径） | `ai-workflows/gen-circle-base-2state.py`（本批新入库，原 `temp/m10-base-gen.py` 原样搬运） | ✅ 底托原图在册：`proposals/menu-3d-style-20261030/btn-topbar-layered-20261102/btn-base-2x-160.png`（来源见 T-539 批次说明；该件本身是从模型出图抽取的共用底托） | WXG-T-539（底托）+ WXG-T-546（接入运行时） |

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
