# AI 生图选型矩阵（四方向 · 云/本地分工）

> **本文件是「哪个方向用哪个模型 / 哪条通路」的裁定正本。**数值类冻结常量仍以
> `games/beads/design/gdd/systems-index.md` §3 为准，本文件只管**生图工具与模型选型**。
> 改判条件：同一判据需 **≥2 个 seed** 复测且结论一致，单轮单 seed 不得翻案。

- 生效：2026-10-12｜依据：三轮反漂移复测（云 40 张 + 本地 17 次 + inpaint 7 次）+ 竖屏档与量化对照
- 候选池：云 qwen-image-3.0 / 2.1-pro / 2.1-turbo / wan2.7-image（**两个 pro 已按用户指示排除**）+ 本地 qwen-image-2.1
- 复现脚本：本目录 `dashscope-generate.py` / `submit-comfyui.py`；一次性批跑与判据脚本在 `temp/`（**不入库**，口径已抄录于 §4、§5）

## §1 四方向首选矩阵

| 方向 | 首选 | 备选 | 理由（只收跨 seed 不漂的机制性判据） |
|---|---|---|---|
| **① 原型设计**（新页面首稿、版面探索） | 云 **qwen-image-2.1-turbo** `--size 1152*2048` | 云 qwen-image-3.0（要更贴成品平涂时） | 0.10 元/张、RPM 120、实测 8.1s；版面三轮 6/6 全绿（全屏 UI、无手机壳） |
| **② 固定风格二级页面**（新版面 + 延续首页身份） | 云 **qwen-image-3.0** | — | 平涂度两轮唯一最贴首页基线（26.66 / 27.03 vs 27.10，缩略口径）；版面 6/6。⚠ RPM 20，批量请串行 |
| **③ 资源文件**（单元素切图） | **本地 qwen-image-2.1 t2i 1:1** | 云 3.0（要背景最纯时 std 0.1–0.3） | 0 元、无按次费、无 RPM；出图干净（背景 std 1.3–1.4、bbox 14–16%）。**一律 bbox 自动裁**，别指望模型留标准白边 |
| **④ 局部微调**（定稿上擦 / 换） | **本地 qwen-image-2.1 + mask inpaint** | — | 三轮 7/7 `mask 外 maxdiff=0 / 外溢=0`，像素锁最硬 |

**④ 的两条附加裁定**（本轮新增，勿再走回头路）：

- **加法贴章不走 AI**：素材带 alpha 直接程序化叠放。轮廓外 3px 环亮度超出：叠放 **−10.8 / 偏亮 0.0%**，让模型画接触阴影 **+18.4 / 44.3%**，旧椭圆 mask **+5.1 / 42.9%。**只要让模型重绘边界，它就刷一圈更亮的奶油色。**
- **小字分两种情形**（2026-10-12 修正，原「一律运行时绘制」过宽）：
  - **整屏多标签 → 一律运行时程序化绘制**。竖屏 4/4 主标题「拼豆小铺」与按钮「开始游戏」全对，**小标签 4/4 全乱**（2.1 系出伪汉字，3.0 写成拉丁字母，wan 系留空）；本地 25 步整屏同样不行（a2 探针 9 条标签**目视 0/9 成真词**；VLM 报的「2–3 条 REAL」偏松——把「万丄 / 牛二 / 奈土」这类常见部件当字了，只能当粗筛，定稿仍需目视），还混出繁体「開始」。⚠ 与 qwen-image-3.0 官方页「10px 小字、界面直接可用」宣传冲突，以实测为准。
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

**本地 vs 云盈亏平衡点**（换算值，不是实测）：本地不花钱，花的是**单卡排队 + 守候时间**；云 2.1-turbo 一张 0.10 元、8–14s。按切图一轮 20–30 张算：云 ≈ 2–5.4 元（3.0 受 RPM 20 串行），本地 ≈ 0 元但 ≈ 10–75min 且同时只能跑一个任务。→ **批量迭代（≥10 张/轮）走本地；少量需「版面 / 文案语义正确」的定稿张走云**。但选型真正的判据不是价格，而是 §1 的机制性判据。

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
| 平涂度 | `|梯度| ∈ (2,25)` 的中调像素占比，对首页基线比贴近度 | 风格延续（②）⚠ 过曝图会刷出漂亮假指标，**必须配目测** |
| mask 外 maxdiff | 遮罩外像素与原件逐通道差最大值，**必须为 0** | 局部编辑（④） |
| 背景环 std | 四边 4% 环的中位色标准差 | 资产可切性（③） |
| 版面正确率 | 是否全屏 UI / 无手机壳 / 无实物道具，按 n/n 计 | 原型（①） |
| 语义正确率 | 指定文案是否逐字写对 | 小字裁定（一律运行时绘制） |

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
| ❌ `Qwen-Image-2.1-Turbo-*.gguf` | **两个位置都试过，均不可用**：当 CLIP → KSampler 内 rms_norm 报 `normalized_shape=[4096]` vs 输入 `12288`（它吐 3× 宽度，2.1 的 DiT 只吃 4096）；当 PE → 现役 t2i 的 `ComfySwitchNode switch=false` 走原文分支，换它**像素零差**。移文件本身已生效（`CLIPLoaderGGUF` 可见，**无需重启**） |
| **本地 VLM 看图裁判** | ✅ **可用（零下载）**：同一 qwen3vl 权重接 `TextGenerate(prompt=提问, image=LoadImage)` 即成裁判。实测 4/4 判对（过曝图判"washed out"、云 3.0 小标签判"corrupted"、首页定稿无误报）。⚠ 判文字时「是否像真词」有假阳性（乱码碰巧成词），须改判「是否等于期望文案」 |
| LoRA | 7 个在盘：`flat-illus-flux-v1`、`Flat style-000014`、`StickersRedmond`、`SDXL-StickerSheet`、`lineartSDXL`、`STICKER_FLUX`、`EnvyFluxKawaiiSticker01`（**均为 SDXL/Flux 系**，配 `flux1-dev-Q5_K_S.gguf`）；云侧 6 模型**都不吃 LoRA** |
| 本地 Flux-dev（**已测，2 seed**） | 全套在盘零下载（`flux1-dev-Q5_K_S` + t5xxl/clip_l + ae VAE，`workflows/flux-dev-sticker.api.json`）。**结构 prior 确实强于 SDXL**（两 seed 均零空心/零多主体），但**背景与边距随 seed 漂**：同配方同题 heart，seed 4201 黑底留白但多一圈模切白边，seed 4211 直接**白底 + 撑满触边**→ 底图产线**不切换**（详见 §6）|
| 分割 / 抠图（**已实测**） | SAM2 权重在盘（`DownloadAndLoadSAM2Model` 列 8 个 hiera 变体，零下载）**能跑**，但三条路都不合用：① `Sam2AutoSegmentation` 在这类扁平 UI 上出的是**合并单 mask**（服务端 history 就返 1 张），按钮只圈出细环、面板整体被当背景 → 不能当元素轮廓；② 点提示 `Sam2Segmentation.coordinates_positive` **不吃字面串**（原样塞给 predictor → `can't convert np.ndarray of type numpy.str_`），全服务唯一能产坐标串的节点是需 Florence2 权重的 `Florence2toCoordinates`；③ 最合用的核心节点 `SAM3_Detect`（文本 conditioning + JSON 点提示 + `individual_masks`，返 MASK/BOUNDING_BOX）**只缺权重**——上一版我记的「无加载器」**错了一半**：它吃的 `MODEL` 可由通用 `CheckpointLoaderSimple` 产出（SAM3.1 fp16 是完整 checkpoint，非适配器），只是当时盘上无文件所以 Loader 选项里看不到。→ 债改由本地洪水填充还（见 §6），下钻路线见 §6.1 |
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
- 第三轮（以修过沙漏章的云 2.1-turbo s23 为基底，本地 2.1 25 步，种子 23 / 7 / 11 / 42）：

| denoise | 种子 23 | 种子 7 | 种子 11 | 种子 42 | 风格变化 |
|---|---|---|---|---|---|
| 0.7 | 硬规则通过 | 锁格错（0★ 带锁） | 未测 | 未测 | 小 |
| **0.8** | 通过 | 通过 | 0★ 格被画成锁格 | 通过 | 中 |
| 0.9 | 返回钮丢失 | 通过，背景换成实景 | 未测 | 未测 | 大 |

  0.7 与 0.9 仅测 2 个种子，结论只作方向。图与明细：`bench/i2i-denoise-20261017/README.md` 第三、四节。

## §6 未决与下一步

| 事项 | 状态 | 影响 |
|---|---|---|
| Flux-dev + 平涂 LoRA 冒烟（heart 单题） | **已测毕·不改判**（2026-10-09 全套 9 关 + 2026-10-12 补第二 seed） | 结论：**底图产线维持 qwen-image 2.1 v5**。两 seed 实测（配方＝`temp/comfy-flux-batch.sh`：48→`STICKER_FLUX`、47→0.5、steps 28、max_shift 1.6）：结构 prior 强（零空心/零多主体）**但背景/边距会跟 seed 跑**（4201 黑底但多一圈模切白边 + 双层心叠影；4211 白底 + 撑满触边）→ 不满足 §1 顶部「≥2 seed 结论一致」改判门槛。⚠ `README.md` §workflows 旧条「9/9 达标、描边优于 qwen v5」是**单 seed 结论**，已就地标注。另记：黑底产线上**不需要也不应该要求黑色描边**（锚点 qwen v5 heart 零描边、纯色块压黑底），`style-brief-for-lora.md` §1 那条硬指标是白底时代写的 |
| SAM 自动出 mask → 喂本地 inpaint | **已测毕·路线改道（债已还，零下载）** | SAM 三条路都不合用（详见 §5 分割行），改用 `temp/menu-states/inpaint-add.py` 新增 `shape=point`：argv 语义切换为「种子点 + 搜索半径」（半径只需包住元素、不必贴合），mask = 种子洪水填充轮廓 ∪ 自动填内部孔洞（文字/图标）+ 半径 3px 膨胀吃抗锯齿边。实测两元素：CTA 胶囊 110,745px = 手输矩形 56.8%、左侧箭头钮 15,276px = 38.2%（即少刷 43%/62% 背景）；端到端 qwen inpaint 一张：**轮廓外 maxdiff=0 / 外溢 0**，边界无矩形补丁感。旧 rect/ellipse/round 三档回归通过（面积序与「含边界」语义未变）。天花板：只适用背景与元素色差明显的平色 UI；照片级/渐变背景要等 GroundingDINO（694MB）或 SAM3 权重入库 |
| Turbo 编码器 A/B | **已测毕·路线关闭**（文件已移入 `clip` 键，`CLIPLoaderGGUF` 可见且无需重启） | 两个位置都不通：当 CLIP → 维度 12288 vs 4096，KSampler 直接 RuntimeError；当 PE → 现役工作流 PE 分支 `switch=false` 不进图（换它像素零差，兼作确定性第三样本）。→ **本地换文本编码器不影响小字/版面**，该轴不要再投入；要改 PE 得先改接线（属另一变量，不是编码器变量） |
| 待授权重下载 | **清单已定（§6.1），本批只建议 1 项** | 本端无 SSH/无写接口，权重只能用户在服务端下；SAM3.1 以外均建议不下或先零下载实测 |
| **判据证据目录 `temp/model-bench/out/` 已丢** | **本日发现·本地不可恢** | 该目录存着本文件正文引用的全部对比图（`out-v4-s0000{1,2}` / `out-v5-s0000{1,2}` / `out-b1/b2` / Flux・SDXL 对比张 等）。`temp/` 被 gitignore → 无版本兜底；本地 `8188` 无这些文件（从未在本机生成），云端 `8143` 当时 **503**（服务未起）→ 暂捞不回。数字已记录在表，**目视复核需重跑**（v4/v5 对 = ¥6.84）或待云端实例恢复后捞回。教训：判据证据不得只存 `temp/` |
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

| 日期 | 变更 |
|---|---|
| 2026-10-12 | 首版（三轮复测 + 竖屏/量化对照后定稿）。同日两处改判：① 「本地 turbo t2i 过曝＝模型特性」→ 更正为「2.1 权重跑 8 步＝欠采样」；② 「轮廓 alpha 可消除贴图接缝」→ 更正为「别让模型画边界，直接程序化叠放」。同日按用户指示排除 3.0-pro / wan2.7-image-pro。 |
| 2026-10-12（同日第 2 次） | 三处按实测收窄：§1 小字裁定拆为「整屏多标签＝运行时绘制」与「单元素短文案＝可烧进图（4/4 实测）」；§5 确定性改为「同 seed 可同可不同」（两组实测相反）；§6 编码器 A/B 状态改为「卡访问」（无 SSH/无写接口）并记下可用探针。 |
| 2026-10-12（同日第 3 次） | **自纠两处 + 关一条路线**：① §5 确定性翻回「同 seed 像素级可复现」——上一版拿 md5 当像素判据，而 md5 含 PNG 内嵌 `prompt` 元数据（含 `filename_prefix`），实际三对像素零差；② §1 a2 探针改按目视 0/9，记下 VLM 的 REAL 判定偏松；③ §5/§6 编码器 A/B 收尾：CLIP 位维度不通（12288≠4096）、PE 位不进图，**本地换文本编码器这条路作废**（目录别名规则另记 §5）。 |
| 2026-10-12（同日第 4 次） | §6 「Flux-dev 冒烟」原记「未做」**过期**——2026-10-09 已跑全套 9 关。补第二 seed 后裁定：**不改判**，底图产线维持 qwen v5（背景/边距随 seed 漂，4211 白底触边）；§5 新增 Flux 能力行；顺手记下黑底产线不需黑色描边（旧硬指标属白底时代）。本轮本地共 1 张（seed 4211）、云 0 张。 |
| 2026-10-12（同日第 5 次） | §6「SAM 自动出 mask」收尾：SAM2 权重在盘能跑，但 auto 在扁平 UI 只出合并环、点提示不可脚本化（字面串直塞 predictor 报 `numpy.str_`）、`SAM3_Detect` 无权重 → **不走 SAM**，改本地洪水填充轮廓（`inpaint-add.py shape=point`：种子点 + 搜索半径代替手输矩形，自动填字洞）。两元素实测少刷 43%/62% 背景，端到端轮廓外 maxdiff=0；旧三档回归 OK。顺带修 `submit-comfyui.py` 对非 qwen 结构（无 `CLIPTextEncode`）的 `KeyError`。本轮本地共 1 张（inpaint）、云 0 张；另记 Pillow `Image.fromarray` readonly 陷阱（属工具链，不进 §5）。 |
| 2026-10-12（同日第 6 次） | §6「待授权重下载」收为 **§6.1 清单**（体积/加载方式/建议逐项定），只建议 **SAM3.1 fp16 <2GB**（`CheckpointLoaderSimple` 可驱动 `SAM3_Detect`，同时修正 §5 上一版「无加载器」的错记）；GD/ControlNet/Layered/超分 均判为不下或先零下载实测。**Layered 当场实测掉**：本地 qwen-image-2.1 t2i（512²、seed 4321）输出确为 RGBA，但 `alpha=0` 占比 0.00% / `alpha>128` 占比 100% → **底座画不出真透明**（§5 透明行改「已实测」）。另发现 **`temp/model-bench/out/` 整目录已丢**（temp 不入库、云端 `8143` 当时 503）→ §2/§4 引用图只剩数字，目视复核需重跑。本轮本地共 1 张（alpha 探针）、云 0 张。 |
| 2026-10-17 | **i2i denoise 分档**（用户令：参考风格调高、局部修改调低）入 §5.x。同参考图（主界面 proto-v3）、同种子 23、描述体提示词，本地 denoise 0.9 对照：① 2.1-turbo（8 步）：面板/返回/BOSS 位置对，但整体发白、对比低、珠阵淡、主界面几乎看不见；② 2.1（25 步）：3×3 结构与星级（通关有星、锁格无星）基本对，风格接近参考，无遮罩、背景换成框景，格子偏小留白大；⇒ 参考风格类本地优先取 **2.1 25 步 + denoise 0.9**（单种子，待 ≥2 seed 复测后定版；局部修改档未测）。耗时：turbo ≈108s、2.1 ≈654s（单卡排队）。成本 0 元。 |
| 2026-10-17（第二次） | **denoise 0.7 / 0.8 / 0.9 三档对照**（以修过沙漏章的云 2.1-turbo s23 为基底，本地 2.1 25 步）。0.8 四个种子（23 / 7 / 11 / 42）：3 个硬规则干净通过，种子 11 把 0★ 未锁格画成锁格。§5.x 参考风格推荐档由 0.9 改为 0.8（待定稿）。0.9 两个种子都把遮罩外背景换成实景或云纹，种子 23 丢返回钮，不稳。§6 新增「选关原型锁态错格」未决项。单张约 5–7 min（单卡排队）。成本 0 元。明细：`bench/i2i-denoise-20261017/README.md` 第三、四节。 |
