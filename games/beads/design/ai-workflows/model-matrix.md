# AI 生图选型矩阵（四方向 · 云/本地分工）

> **本文件是「哪个方向用哪个模型 / 哪条通路」的裁定正本。**数值类冻结常量仍以
> `games/beads/design/gdd/systems-index.md` §3 为准，本文件只管**生图工具与模型选型**。
> 改判条件：同一判据需 **≥2 个 seed** 复测且结论一致，单轮单 seed 不得翻案。

- 生效：2026-10-12｜依据：三轮反漂移复测（云 40 张 + 本地 17 次 + inpaint 7 次）+ 竖屏档与量化对照
- 候选池：云 qwen-image-3.0 / 2.1-pro / 2.1-turbo / wan2.7-image（**两个 pro 已按用户指示排除**）+ 本地 qwen-image-2.1
  ⚠ 本行与下文 §2 价目**只适用按量付费通道**；2026-10-31 开通的 Token Plan 在册集不同，见 §2.1
- 复现脚本：本目录 `dashscope-generate.py`（`--profile maas|token-plan`）/ `submit-comfyui.py`；一次性批跑与判据脚本在 `temp/`（不入库，口径见 §4/§5）

## §1 四方向首选矩阵

| 方向 | 首选 | 备选 | 理由（只收跨 seed 不漂的机制性判据） |
|---|---|---|---|
| **① 原型设计**（新页面首稿、版面探索） | 云 **qwen-image-2.1-turbo** `--size 1152*2048` | 云 qwen-image-3.0（要更贴成品平涂时） | 0.10 元/张、RPM 120、实测 8.1s；版面三轮 6/6 全绿（全屏 UI、无手机壳） |
| **② 固定风格二级页面**（新版面 + 延续首页身份） | 云 **qwen-image-3.0** | — | 平涂度两轮唯一最贴首页基线（26.66 / 27.03 vs 27.10，缩略口径）；版面 6/6。⚠ RPM 20，批量请串行。⛔ 不认 `color_palette` |
| **③ 资源文件**（单元素切图） | **本地 qwen-image-2.1 t2i 1:1** | 云 3.0（要背景最纯时 std 0.1–0.3） | 0 元、无按次费、无 RPM；出图干净（背景 std 1.3–1.4、bbox 14–16%）。**一律 bbox 自动裁**，别指望模型留标准白边 |
| **④ 局部微调**（定稿上擦 / 换） | **本地 qwen-image-2.1 + mask inpaint** | — | 三轮 7/7 `mask 外 maxdiff=0 / 外溢=0`，像素锁最硬 |
| **⑤ 定稿结构重写**（擦掉结构件 / 改灯光数 / 换陈列物 —— mask 内要先"看懂"再改） | 云 **qwen-image-3.0**（**基准稿产线**） | 本地 qwen-image-2.1 整图 `edit`（备选参考） | 本地 masked 只会"填平"不会"改结构"（中层横板被原样照抄回来）；两路 5/5 命中语义指令，但 3.0 保住玻璃反光与侧壁纵深，材质更贴基准稿。⇒ 用户 2026-10-31 裁定：**云为基准，本地降级为备选参考** |

**⑤ 的几何回正**（整图重生成必带漂移，回贴前先过 §4「锚点位移」门）：

- 云 3.0 输出固定 **1520×2736**（比例 0.5556 ≠ 752/1344），先缩回设计稿尺寸，再按锚点求仿射平移。
- 同一条指令、同一底图，**seed 决定漂移量级**：长指令 seed42 名牌 901→960（**+59px**，构图整体重排 → 弃）；短指令 seed42 +56px；短指令 **seed7 +3px**（顶轨 +6）→ 采用，回正＝`y_src=y+3 / x_src=x+2`。
- 本地整图 `edit` 输出尺寸与输入严格一致（752×1344→752×1344），**零几何校正**，框外漂移仅 VAE 往返（mean 8~9）—— 这是它当「备选参考」时比云 3.0 省事的点，但输在材质还原，不足以翻案。
- 回贴纪律不变：只贴编辑区并羽化，框外逐像素锁基准稿。⑤ 的下边界必须停在**结构线之后**（本轮取名牌上沿 y=898），停在结构中途中切就会把“台板前缘那条亮木横边”切断 —— 上一轮 v2 被否的“橱窗底下少一条”即此因（当时切在 y=888）。

**④ 的两条附加裁定**（本轮新增，勿再走回头路）：

- **加法贴章不走 AI**：素材带 alpha 直接程序化叠放。轮廓外 3px 环亮度超出：叠放 **−10.8 / 偏亮 0.0%**，让模型画接触阴影 **+18.4 / 44.3%**，旧椭圆 mask **+5.1 / 42.9%。**只要让模型重绘边界，它就刷一圈更亮的奶油色。**
  ⚠ 2026-10-31 反面复现：「贴切图 + 手工画接触阴影」在 752×1344 定稿上刷出**双底托 + 底托下沿毛边**，被用户退回；要「一个干净的底托」就得让模型画（走 ⑤），别叠图。
- **小字分两种情形**（2026-10-12 修正，原「一律运行时绘制」过宽）：
  - **整屏多标签 → 一律运行时程序化绘制**。竖屏 4/4 主标题「拼豆小铺」与按钮「开始游戏」全对，**小标签 4/4 全乱**（2.1 系出伪汉字，3.0 写成拉丁字母，wan 系留空）；本地 25 步整屏同样不行（a2 探针 9 条标签**目视 0/9 成真词**；VLM 报的「2–3 条 REAL」偏松——把「万丄 / 牛二 / 奈土」这类常见部件当字了，只能当粗筛，定稿仍需目视），还混出繁体「開始」。⚠ 与 qwen-image-3.0 官方页「10px 小字、界面直接可用」宣传冲突，以实测为准。
  - **该判负有字号边界，[TODO] 待复测**：2026-11-01 在 1152×2048 档、标签约 36–48 px 下，
    pro 与 2.1-turbo 各 2 seed **11 条标签逐字全对** ⇒ 「必乱」成立在小字档，⛔ 别拿它否掉大标签原型稿。
  - **单元素图标上的固定短文案 → 可烧进图里**：本地 25 步 t2i 实测 **4/4 全对**（c2「正在闯关」×2 seed、c3「第 12 关 / 剩 3 步」×2 seed，含数字）。代价：改文案＝重出图，且每张仍需目检（可让本地 VLM 裁判代跑，但**期望串只填图里真有的字符**，否则它会把「第 12 关 和 剩 3 步」这类拼接串判 NO）。

## §2 候选池 · 价目 · 限流（2026-10-12 官方页核实）

| 模型 | 输入 | 输出 | RPM | 免费额度 | 实测均耗时 |
|---|---|---|---|---|---|
| qwen-image-3.0 | 0.02 元/张 | **0.18 元/张（1K=2K 同价，竖屏不加价）** | **20** | 输入输出共 10 张 | 26.1s |
| qwen-image-2.1-pro | — | 0.25 元/张 | **20** | 未见条目 | 30.5s |
| qwen-image-2.1-turbo | — | 0.10 元/张 | 120 | 未见条目 | 13.8s |
| wan2.7-image | 输入不计费 | 0.20 元/张 | 300 | 50 张 | 12.0s |
| ~~qwen-image-3.0-pro~~ | 0.02 | 0.25（1K）/ 0.5（2K） | — | — | 36.7s |
| ~~wan2.7-image-pro~~ | — | 0.50 | — | 50 张 | 21.3s |

- 两个 pro 于 2026-10-12 按用户指示**明确排除**，不再进候选；本矩阵最差价由此封顶在 0.25 元/张。
- 本地：0 元，单张 30–150s（2080 Ti / 11GB），实测一轮 21 次 ≈ 55min GPU。

### §2.1 Token Plan 通道（2026-10-31 开通，**不改本矩阵任何选型裁定**）

第二条云端腿，**Credits 计量** ⇒ 上表元/张口径不适用；key 与 base_url 与按量付费**完全隔离**，
混用会 401 或走错计费通道。在册 21 模型：**无 qwen-image-2.1 系、无非 pro 3.0**（⇒ §1 ① 首选
2.1-turbo 在本通道调不到），只有 `qwen-image-3.0-pro` / `wan2.7-image[-pro]`，另多三条腿：
TTS `qwen-audio-3.0-tts-plus`、视频 `wan3.0-video`（只异步）、**领域模型
`decision-model-preview`**（免费，结构化判定而非对话）。

⇒ 端点/参数/实测值的事实单：本目录 **`backend-token-plan.md`**；领域模型接线裁定：
`production/qa/decision-model-calibration-20261031.md`。**pro 排除仅按量通道维持**；Token Plan
通道内两 pro 已解禁（2026-11-01 用户裁定），§1 首选未变。

> **2026-11-01 `qwen-image-3.0-pro` 实测**（两 seed 一致）：**无 mask 输入**
> （`mask_image_url` 被静默忽略）⇒ 框外锁不住，只能配程序化回贴；**无 alpha 输出**且把**透明棋盘格画进 RGB**
> ⇒ ③ 切图首选不变。→ `production/qa/pro30-edit-cut-20261101.md`
>
> **同日 pro 续测 ①②**：现首选均维持——② 目测无优势且机检反向；① 仅「数量词」2/2 vs 0/2，
> 代价「无实物道具」0/2 vs 2/2。→ `production/qa/pro30-proto-bench-20261101.md`（⚠ 通道与模型未分离）
>
> **同日 `wan2.7-image` 实测**：补上千问缺的半条腿，补不上透明。`bbox_list` 是**指引不是像素锁**⇒ ④ 单发不达标
> （回贴仍必需）；短文案 3/3 ⇒「单元素可烧字」成立、**整屏多标签不翻**；续测 ①②：**② 判负**（`--ref` 只取色板不取场景）、① 与 pro 打平。
> → `production/qa/wan27-token-plan-20261101.md`
>
> **同日 `color_palette` 实测（wan2.7 线 · 三条件 + 6 色板跨页面批）**：本仓首个**可脚本化的色彩开关**——
> 跨 seed 平均色 ΔE **10.6 → 0.6 / 1.1**，**跨页面 × 跨 seed ≤ 3.5**（批量出稿成立）。四条边界：色板须手挑
> （⛔ 自动切分板拖深底色）；≤ 4% 高饱和 accent 会归零或乱长 ⇒ 只喂大面积色（6 色优于 8 色）；
> **不排他**（⛔ 禁色闸门）；**只锁色彩不锁版面**。qwen 线不认此参数、wan2.7 在 ② 已判负 ⇒ **② 首选不变**。
> 读数 → 上一注 §9/§10

**本地 vs 云盈亏平衡点**（换算值，非实测）：本地花的是**单卡排队 + 守候时间**；云 2.1-turbo 一张 0.10 元、8–14s。切图一轮 20–30 张：云 ≈ 2–5.4 元（3.0 受 RPM 20 串行），本地 ≈ 0 元但 ≈ 10–75min 且只能跑一个任务。→ **批量迭代（≥10 张/轮）走本地；少量要「版面 / 文案语义正确」的定稿张走云**。但选型判据不是价格，而是 §1 的机制性判据。

## §3 排除项（含理由，勿重走）

| 路线 | 排除理由 |
|---|---|
| 本地 **i2i 做单元素资产** | 构图污染：把参考图整个橱窗画进来（背景 std 4.1、bbox 77%） |
| 本地 **i2i 做固定风格** | 锚不动版式，像素漂移 16.0–16.9 两轮垫底 |
| 整图 `denoise=0.85` 当局部编辑 | 结构锁死，只会往原图上贴字，出不了新版面 |
| SDXL 写中文 | 必乱 |
| 矩形 / 椭圆 mask 贴章 | 把背景一起重绘 → 白边接缝（3/3 复现） |
| **本地 8 步档做 t2i** | 见 §5：本地图像权重只有 2.1，8 步是**欠采样**，高光溢出 73–80% |
| 云 2.1 系做资产（i2i 路线） | 偶发构图污染（非稳定复现，降级为「不优先」而非「禁用」） |

## §4 判据纪律（哪些能排序，哪些不能）

**已作废**（种子噪声 > 模型差，换 seed 后排序洗牌，不得用于选型）：

- 像素漂移均值（B1）：轮 1 wan2.7 最优 11.8 → 轮 3 变 2.1-pro 最优 11.7，Δ3.9 > 模型差 ≈2
- 色板 Lab 距离（B2）：3.0 从 1.55 漂到 2.84
- 主体 bbox 占比 / 画布利用率：噪声 ±20pt；「本地方形利用率 50% > 云 15%」系单样本，已撤

**可用**（跨 seed 稳定的机制性判据）：

| 判据 | 口径 | 用途 |
|---|---|---|
| 平涂度 | `|梯度| ∈ (2,25)` 的中调像素占比，对首页基线比贴近度 | 风格延续（②）⚠ **两种假指标**：过曝图刷出漂亮值；**背景被刷平同样拉低该值**（最低值＝最差结果）⇒ 仅同页面类型内作辅助，**必须配目测** |
| mask 外 maxdiff | 遮罩外像素与原件逐通道差最大值，**必须为 0** | 局部编辑（④）⚠ `bbox_list` 非像素锁；判**原始出图**非回贴后产物；**回贴 maxdiff=0 必要非充分**（对任意区域恒成立，须配目测 + 内容尺寸） |
| **alpha 分布** | `alpha==0` 占比，**⛔ 只查 `Image.mode` 会漏**（假透明三形态 → `backend-token-plan.md §3.2`） | 透明底资产（③） |
| 背景环 std | 四边 4% 环的中位色标准差 | 资产可切性（③） |
| 版面正确率 | 是否全屏 UI / 无手机壳 / 无实物道具，按 n/n 计 | 原型（①） |
| 语义正确率 | 指定文案是否逐字写对 | 小字裁定（一律运行时绘制） |
| **锚点位移** | 取 ≥3 个**不参与编辑**的固定结构边（本轮＝橱窗顶轨 / 名牌上沿 / 名牌下沿），按行均值梯度极值定位，比对设计稿坐标 | 整图重生成类（②⑤）回贴前的几何门：**>10px 必须先仿射回正，>30px 判弃用** |

**元规则**：同 seed 重跑只测流水线确定性，测不出抽样运气 → 反漂移复测**必须换 seed**。

## §5 本地 ComfyUI 能力边界（2026-10-12 权重清单实证）

服务：`192.168.1.16:8188`（RTX 2080 Ti 11GB，ComfyUI 0.39.0）。断言能力前查各 Loader 的 options 列表，**节点存在 ≠ 权重存在**。

| 项 | 实况 |
|---|---|
| 图像 DiT | **只有 qwen-image-2.1**：`qwen_image_2.1_int8_convrot.safetensors`（UNETLoader）／`qwen_image_2.1_Q5_K_M.gguf`（UnetLoaderGGUF）。**没有 Turbo 图像权重** |
| 目录别名（实测） | 下拉选不到 ≠ 文件不存在，很可能只是**放进了另一个 folder key 的目录**：`unet` 键同时扫 `models/unet/` 与 `models/diffusion_models/`；`clip` 键同时扫 `models/clip/` 与 `models/text_encoders/`。→ 图像 DiT 放 `diffusion_models/` **正确**；编码器放 `diffusion_models/` 就永远进不了 `CLIPLoader*` |
| 采样档 | t2i 用 **25 步 euler/simple**；8 步 euler/normal 只可用于**有底图约束的 i2i/inpaint**。8 步做 t2i = 欠采样 → 高光>250 占比 73%（int8）/ 80%（Q5_K），首页基线 2.9%、云 4.7–11.6%；**换量化救不了** |
| 历史称呼 | 「本地 qwen-image-2.1-turbo」**作废**——那是采样档不是模型，一律改称「本地 qwen-image-2.1（8 步档）」 |
| 文本编码器 | `qwen3vl_8b_int8_convrot.safetensors`（type `qwen_image`）+ PE `qwen3.5_9b_qwen_image_2.1_pe_i2i` |
| ❌ `Qwen-Image-2.1-Turbo-*.gguf` | **两个位置都试过，均不可用**：当 CLIP → KSampler rms_norm 报 `normalized_shape=[4096]` vs 输入 `12288`（它吐 3× 宽度）；当 PE → `ComfySwitchNode switch=false` 走原文分支，换它**像素零差**。移文件已生效（`CLIPLoaderGGUF` 可见，**无需重启**） |
| **本地 VLM 看图裁判** | ✅ **可用（零下载）**：同一 qwen3vl 权重接 `TextGenerate(prompt=提问, image=LoadImage)` 即成裁判。实测 4/4 判对（过曝图判"washed out"、云 3.0 小标签判"corrupted"、首页定稿无误报）。⚠ 判文字时「是否像真词」有假阳性（乱码碰巧成词），须改判「是否等于期望文案」 |
| LoRA | 7 个在盘：`flat-illus-flux-v1`、`Flat style-000014`、`StickersRedmond`、`SDXL-StickerSheet`、`lineartSDXL`、`STICKER_FLUX`、`EnvyFluxKawaiiSticker01`（**均为 SDXL/Flux 系**，配 `flux1-dev-Q5_K_S.gguf`）；云侧 6 模型**都不吃 LoRA** |
| 本地 Flux-dev（**已测，2 seed**） | 全套在盘零下载（`flux1-dev-Q5_K_S` + t5xxl/clip_l + ae VAE，`workflows/flux-dev-sticker.api.json`）。**结构 prior 确实强于 SDXL**（两 seed 均零空心/零多主体），但**背景与边距随 seed 漂**：同配方同题 heart，seed 4201 黑底留白但多一圈模切白边，seed 4211 直接**白底 + 撑满触边**→ 底图产线**不切换**（详见 §6）|
| 分割 / 抠图（**已实测**） | SAM2 权重在盘（`DownloadAndLoadSAM2Model` 列 8 个 hiera 变体，零下载）**能跑**，但三条路都不合用：① `Sam2AutoSegmentation` 在扁平 UI 只出**合并单 mask**（按钮只圈细环、面板整体被当背景）；② 点提示 `coordinates_positive` **不吃字面串**（直塞 predictor 报 `numpy.str_`），能产坐标串的 `Florence2toCoordinates` 需 Florence2 权重；③ 核心节点 `SAM3_Detect` **只缺权重**——其 `MODEL` 可由通用 `CheckpointLoaderSimple` 产出（SAM3.1 fp16 是完整 checkpoint，非适配器），上一版「无加载器」系错记。→ 债改由本地洪水填充还（见 §6），下钻见 §6.1；三路逐条故障原文 → `model-matrix-changelog.md` §7.3 |
| ❌ 指令式 edit（文字指令改图） | `TextEncodeQwenImageEdit(Plus)` 节点在，**edit 专用权重无** → 本地不能吃「把 X 换成 Y」这类指令。⚠ 区别于**遮罩式 inpaint**：`InpaintModelConditioning` + 2.1 底座可用，本会话已实测出图（`temp/menu-states/pt-cta-qwen-f0.png`） |
| ❌ 原生透明分层（**已实测，2026-10-12**） | `EmptyQwenImageLayeredLatentImage` + `LayeredNoiseToLatent` 节点在，**Layered 专用权重无**。实测现有权重的 alpha 路（本地 qwen-image-2.1 t2i，512²、seed 4321，提示词要「transparent background / no backdrop」）：输出**确为 RGBA**（`qwen_image_2.1_vae_bf16` 就是 RGBA VAE，通道能力已端到端打通），但 alpha **无语义**：`alpha=0` 占比 **0.00%**、`alpha>128` 占比 **100%**、四边均值 255、底面 RGB≈(251,253,254) 纯白 → **底座 2.1 画不出真透明**（与 §2 云侧 P0「带 alpha 但无有效透明」一致）。→ ③ 透明底资产不能靠现有权重零下载拿到；平色 UI 继续用 §6 的 `shape=point` 轮廓直接当 alpha |
| ❌ ControlNet | 节点全套，`control_net_name: []`（`style-brief-for-lora.md` §6 重启条件 1 卡在此） |
| ❌ 超分 | `ImageUpscaleWithModel` 在，`UpscaleModelLoader.model_name: []` |
| ✅ 确定性（**推翻本日上一版**） | 同 seed **像素级可复现**：三对实测 `ImageChops.difference().getbbox() is None`（seed 23 跨三个 filename_prefix、seed 7 改了 PE CLIP）→ 重要产物可靠 seed 回归。⚠ **别拿 md5 当像素判据**：ComfyUI 把 `prompt` 元数据写进 PNG，改 `filename_prefix` 必改 md5（上一版“可同可不同”就是这么误判的）。要比像素用 `getbbox()` / `maxdiff` |

**参数透传已支持**：`dashscope-generate.py --size '宽*高'`（不给则 qwen 线恒 2048 方图）、`--seed N`（同时置 `prompt_extend=False`）；`submit-comfyui.py --ratio` 已加枚举守卫（非法值红字退出，挡住服务端「静默 success 零产物」）；同文件已支持**无文本节点工作流**（旧版对不含 `CLIPTextEncode` 也不含 qwen 开关节点的图会 `KeyError: '459:474'`，现改为静默跳过并在传了 `--prompt/--seed/--ratio/--mp` 时红字提醒，不静默失效）。

### §5.x 图生图 denoise 分档（2026-10-17 用户令，按图生图类型调整）

| 图生图类型 | denoise | 说明 |
|---|---|---|
| **参考风格**（取画风/配色/质感，允许重排版面，如选关原型） | **高；本地 2.1（25 步）当前推荐 0.8（待定稿）** | 高 denoise 才会放开构图；结构锁死的 0.65 只会复刻参考版面。0.8 下 4 个种子中 3 个硬规则干净通过，1 个（种子 11）把 0★ 未锁格画成锁格，定稿需程序化重画格状态 |
| **形态变体**（同结构换态，如草莓→草莓变体） | 0.5 | 见 `README.md` i2i 实测 |
| **局部修改**（擦/换/小区域 inpaint） | **低，0.3–0.5** | 低 denoise 保住参考图其余像素；整图高 denoise 只会贴字（见 §3 禁忌） |
| 默认（未指定类型） | 0.65 | 结构锁死，仅作兜底，不得拿来做参考风格 |

- 工作流参数入口：本地 `qwen-image-2.1-turbo-i2i.api.json` 的 KSampler 节点 `8`，经 `submit-comfyui.py --override "8:denoise=0.9"` 临时改；云端 `--ref` 无 denoise 参数，走服务端默认。
- 实证对照（同参考图、同种子 23、同描述体提示词）：见 §7 变更记录 2026-10-17 条。
- 第三轮逐格读数（0.7 / **0.8** / 0.9 × 种子 23 / 7 / 11 / 42、风格变化量级）→ `model-matrix-changelog.md` §7.3；
  0.7 与 0.9 仅测 2 个种子，只作方向。图与明细：`bench/i2i-denoise-20261017/README.md` 第三、四节。

### §5.y 区域约束（box / mask）判定 —— 2026-11-01 六线探针

**只有 `wan2.7-image` / `wan2.7-image-pro` 真认 `--bbox`**（框外均差 6.9 / 5.7）；
`qwen-image-3.0` / `3.0-pro` / `2.1-pro` **静默忽略**（42.5 / 41.7 / 25.1，比不传框的整图重绘 19–21 还差）
⇒ `dashscope-generate.py::bbox_guard` 已对 qwen 线硬拦。本地 2.1 masked 框外均差 1.1 不越界，但框内不执行。

不论哪条线，出货都走**贴回三步**：`α = blur(M)×M`（只向内羽化）→ 合成 → `C[~M] = A[~M]` 硬拷回，
区外 maxdiff 必须 = 0（漏硬拷回残留几十像素 Δ1）。六线读数与证据 → `model-matrix-changelog.md` §7.3。

## §6 未决与下一步

| 事项 | 状态 | 影响 |
|---|---|---|
| Flux-dev + 平涂 LoRA 冒烟（heart 单题） | **已测毕·不改判**（2026-10-09 九关 + 2026-10-12 二 seed） | 底图产线维持 qwen-image 2.1 v5：结构 prior 强（零空心/零多主体）**但背景/边距随 seed 跑**（4201 多一圈模切白边 + 双层心叠影；4211 白底撑满触边）⇒ 未过「≥2 seed 一致」改判门。配方 `temp/comfy-flux-batch.sh`（steps 28、max_shift 1.6）；能力行见 §5，全量读数 → `model-matrix-changelog.md` 2026-10-12（同日第 4 次）。⚠ `README.md` §workflows「9/9 达标」＝单 seed 结论，已就地标注；黑底产线**不需也不应要求黑色描边**（`style-brief-for-lora.md` §1 那条硬指标属白底时代）|
| SAM 自动出 mask → 喂本地 inpaint | **已测毕·路线改道（债已还，零下载）** | SAM 三条路都不合用（详见 §5 分割行）→ 改 `temp/menu-states/inpaint-add.py` 的 `shape=point`（种子点 + 搜索半径代替手输矩形，自动填字洞）。实测两元素少刷 43%/62% 背景，端到端轮廓外 maxdiff=0。**口径与参数正本** = skill `wxgame-image-gen` §3 + `model-matrix-changelog.md` 2026-10-12（同日第 5 次）。天花板：只适用背景与元素色差明显的平色 UI；照片级/渐变背景等 SAM3.1（§6.1）|
| Turbo 编码器 A/B | **已测毕·路线关闭**（文件已移入 `clip` 键，`CLIPLoaderGGUF` 可见且无需重启） | 两个位置都不通（CLIP 位维度 12288≠4096 报错、PE 位 `switch=false` 不进图，机理见 §5 该行）→ **本地换文本编码器不影响小字/版面**，该轴不要再投入；要改 PE 得先改接线（属另一变量，不是编码器变量） |
| 待授权重下载 | **清单已定（§6.1），本批只建议 1 项** | 本端无 SSH/无写接口，权重只能用户在服务端下；SAM3.1 以外均建议不下或先零下载实测 |
| **判据证据目录 `temp/model-bench/out/` 已丢** | **本日发现·本地不可恢** | 该目录存着本文件正文引用的全部对比图（v4/v5 对、out-b1/b2、Flux・SDXL 对比张）。`temp/` 被 gitignore → 无版本兜底；本地 `8188` 从未生成过它们，云端 `8143` 当时 **503** ⇒ 暂捞不回。数字已记录在表，**目视复核需重跑**（v4/v5 对 = ¥6.84）或待云端实例恢复。教训：判据证据不得只存 `temp/` |
| 判据脚本入库（`style-metrics.py` / `c-metrics.py` / `badge-contour.py` / `vlm-check.py`）+ **局部重绘入口** | 暂留 `temp/`（不入库） | 口径已抄录本文件 §4/§5；要长期复测建议提到本目录。⚠ 但 skill `wxgame-image-gen` 的④命令入口就是 `temp/menu-states/inpaint-add.py`（连其 qwen 后端 `temp/menu-states/qwen-turbo-inpaint.api.json`，10 节点：UNETLoader + CLIPLoader + VAELoader，`LoadImage → VAEEncodeForInpaint → KSampler(8 步) → VAEDecode → SaveImage`；mask 极性＝`putalpha(invert(hard))`，透明＝重绘）⇒ **temp 一清即断**。重建口径：以已入库的 `workflows/sdxl-inpaint.api.json` 为骨架换回 qwen 三 Loader + `VAEEncodeForInpaint`，尺寸档走 `--ratio/--mp` |
| 选关原型生图锁态错格（0.7 种子 7、0.8 种子 11） | **未决** | 0★ 未锁格被画成带小锁的彩色格，生图无法保证格状态。定稿路线：格状态由 `levelselect-proto-coords.py` 的 CELLS 数据程序化重画，生图只出风格底 |

### 6.1 待授权下载清单（本端无 SSH/无写接口，只能用户在服务端下）

显存天花板：**11.8GB**（`/system_stats` 实测）；本地 ComfyUI **0.39.0**。选型铁规：新模型必须能塞进 11.8GB（或可 CPU offload），否则下了也跑不动。

| 候选 | 体积 | 加载方式（已核） | 解锁什么 | 建议 |
|---|---|---|---|---|
| **SAM3.1 fp16**（`sam3.1_multiplex_fp16.safetensors`） | **<2GB** | 通用 `CheckpointLoaderSimple`（产 MODEL+CLIP，不需 VAE）→ `SAM3_Detect` | 文本/框/点三模态语义分割；提示词可写 `button:4` 一次出 4 个**独立** mask（`individual_objects`）→ 把 `shape=point` 的天花板（照片级/渐变背景）直接消掉，顺带替掉 GroundingDINO 那条路 | ✅ **本批唯一建议下**。放 `models/checkpoints/`（下拉必可见；教程说的 `diffusion_models/sam3/` 要先回查可见性，即 §5 「目录别名」那条课）。来源：HF `facebook/sam3` **需填表申请**（通过率低），ModelScope 有镜像；Comfy-Org 重打包仓库名**尚未核实** [待核实]。风险：分割链单独跑，不与 qwen 共存 → 11.8GB 应够，OOM 则失败免费 |
| GroundingDINO Swin-T + SAM 权重 | ≈1GB | `GroundingDinoSAMSegment` | 文本→框→mask | ❌ **不建议**：能力被上一行覆盖且更弱；平色 UI 的债已由 `shape=point` 还掉 |
| Qwen-Image-Layered（透明分层） | 未核（同级主干 bf16 ≈13GB / int8 ≈7.3GB） | `EmptyQwenImageLayeredLatentImage` 等节点在位 | 原生分层透明底资产 | ⚠ **先别下**：§5 已实测现有底座输出 RGBA 但 **alpha 无语义**（全图 >128）；真要用得先确认 Layered 主干有能塞进 11.8GB 的 int8/量化档，否则下了也跑不动 |
| ControlNet（Flux / SDXL / QwenImage-Diffsynth） | 1.2–4.7GB（diffsynth 档未核） | `ControlNetLoader`（现 `[]`） | 按线稿/色块锁结构重绘（`style-brief-for-lora.md` §6 重启条件 1） | ❌ **暂不建议**：底图产线已定 qwen v5、Flux 不改判；条件图本身可**零下载**本地出（`TextImageCanny` / `TextImageColor` 在位），真要锁结构先拿它们跑通再下权重 |
| 超分（RealESRGAN / 4x-UltraSharp） | ≈64MB | `UpscaleModelLoader`（现 `[]`） | 放大 | ⚠ **最低优先**：体积最小但平涂素材放大易引纹理，且包体预算是反方向；要下顺手下，不单独开任务 |

下完的验收命令（不下就别说能用，§5 铁律的反向应用）：

```bash
curl -s http://192.168.1.16:8188/object_info/CheckpointLoaderSimple \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['CheckpointLoaderSimple']['input']['required']['checkpoint_name'][0])"
```

## §7 变更记录

变更史（§7.1）、外移明细（§7.3）、擦除/抠图判据（§7.4）已移至 `model-matrix-changelog.md`（WXG-T-523；动机 = 本文件受 `ctx:check` B 项 8000 token 上限，追加式历史会把选型判据挤出预算）。**新轮次写进那份，不要写回本节。**
