# AI 美术工作流

拼豆项目本地 AI 生图 → 编码 → 接入 Cocos Creator 的自动化工具集。

> **选型裁定正本：[`model-matrix.md`](./model-matrix.md)**（四方向用哪个模型 / 云还是本地、排除项、价目与限流、判据纪律、本地 ComfyUI 能力边界）。
> 本 README 只讲**脚本怎么用**；要回答「这批产物该走哪条通路」先读那份矩阵。

## 环境要求

- Python 3.10+，依赖：`Pillow`、`NumPy`（已装则跳过）
- ComfyUI（本地生图，可选）：https://github.com/comfyanonymous/ComfyUI
- Krita（后精修，可选）：`brew install krita`

## 产线 A：换肤 Mask 纹理

### 流程

```
AI 生成光照参考 → 精修抠图 → encode-mask.py 编码 → 放入 Cocos assets/
```

### 1. AI 生成参考图（ComfyUI）

推荐模型：**SDXL + RealVisXL**（写实光影）或 **Flux.1 Schnell**（快速概念）

Prompt 模板：

```
top-down view of a single round perler bead, studio lighting,
white background, soft shadow bottom-right, specular highlight top-left,
clean isolated object, no background, 3d render
```

风格变体关键词替换：

| 风格 | 追加关键词 |
|---|---|
| 四棱刻面 | `faceted gem shading, 4 flat planes, geometric` |
| 双色对角 | `diagonal split, two-tone, half-lit` |
| 线稿描边 | `clean outline, cel-shading, minimal shadow` |
| 珐琅质感 | `glossy enamel, strong specular, soft ambient` |

输出：256x256 或 512x512 PNG（RGBA，透明背景）。

### 2. 精修（Krita）

- 去除背景杂色
- 确认珠子轮廓干净、光照方向一致
- 导出为 RGBA PNG

### 3. 通道编码

```bash
python3 games/beads/design/ai-workflows/encode-mask.py \
    path/to/bead-ref.png \
    -o games/beads/cocos/assets/textures/bead-tint-128-mask_styleX.png \
    --size 128
```

输出格式（ADR-0028）：
- **RGB** = `d`（暗系数，灰度，0=全暗 255=全亮）
- **A** = `l`（亮系数/高光，0=无 255=最强）

调参：`--highlight-threshold 0.80` 降低阈值 → 更多高光区域。

### 4. 验证

在 Cocos Creator 里：
1. 创建材质 → Effect 选 `tint-mask`
2. `maskTexture` 拖入编码后的 PNG
3. `baseColor` 设红/蓝/绿，确认主体色正确（C12 不变式）
4. Sprite Frame 使用 base 纹理（提供珠子形状 alpha）

## 产线 B：游戏 UI 资产

### 流程

```
AI 生成风格参考 → 逐件生成 → 矢量化/精修 → 切图 → 接入 Cocos
```

### 外部 ComfyUI API 出图（192.168.1.16，qwen-image 2.1）

```bash
python3 games/beads/design/ai-workflows/submit-comfyui.py \
  --workflow games/beads/design/ai-workflows/workflows/qwen-image-2.1-t2i.api.json \
  --prompt '<英文提示词>' --seed 42 --ratio '1:1 (Square)' --mp 4 \
  --out temp/comfyui-out/
```

- 尺寸由 `--mp`（megapixels）× `--ratio` 决定：1:1 时 `--mp 1` → 1024×1024（现行产线统一用此档），`--mp 4` → 2048×2048（已废，见下铁规）。
- `--ratio` 走 `ResolutionSelector` 的 COMBO 枚举，脚本已加本地守卫：非法值直接红字退出并打印合法值（服务端对非法值照样返回 `execution_success` 但**零产物**，静默失败极难查；拿不到 `/object_info` 时只 WARN 不拦）。
- ❗ **关卡图定位铁规：生成「拼豆转化·平面限色原画」，⛔ 不直接画拼豆面板、⛔ 不出立体渲染**（prompt 零 `bead / pegboard / pixel grid` 类词，拼豆化交给 studio 换肤/限色管线）：
  - 造型：单一主体居中、剪影大胆清晰；细节少到缩到目标格数仍可辨——**原画全 1024 直出（含 boss；2026-10-09 换制：格数由转化器采样决定，1024 对 32×32 档每格仍有 32px 采样余量；⛔ 2048 直出废——SDXL 易崩构图、Flux 实测 shift 错配劣化，旧 boss=2048 规作废）**。
  - 风格：**flat 2D 矢量插画口径——大色块平涂（solid flat fills）+ 锐利边缘**；⛔ 禁 `glossy / sheen / highlight / soft lighting / realistic material / 3D render / gradient / shadow` 类词（v3 实测教训：写「柔和光影/真实材质」出成立体产品渲染，高光渐变被 k-means 压出碎色，用色过多过碎不可拆解）。
  - 线条（2026-10-09 用户换政 v6，措辞修正 v6d）：**以色块为主、不要多线条**；⛔ 不是「零描边」——描边/线条/分隔带**允许存在，但宽度必须 ≥32×32 珠面单珠宽（一档 ≈ 1/32 图宽）**，否则生不成线条的珠子集合（细线等于没画）；色块区域间分隔白带同样须单珠宽；线条**禁纯黑**（与黑底抠图/选色避黑冲突）。
  - 边缘与杂色（2026-10-09 用户换政 v6e，据 boss 拆珠盘面反馈）：① 轮廓**尽量规则几何形**（大圆弧/直线），⛔ 锯齿/波浪/扇贝边——珠面网格上必锯齿；② 每色区**单一精确平涂色、边界干净**，否则拆珠出现原图没有的 1–2 颗**孤立杂色豆**（根因：边界混色/色区微差被 k-means 单独成档；prompt 端减源即可，转化器端不加过滤）。
  - 色彩：主题性、克制、**以大色块计**（16×16 档 ≤8 色、32×32 档 ≤16 色；2026-10-09 用户换制，旧 ≤5/≤7 作废）；每区域一块平涂色，禁细碎纹理/噪点；**选色避开纯黑**（黑只当背景用），主体内不得出现黑/深色；**除黑底外选色均匀**（每色区内部色调一致，无斑驳渐变）；**色数只设上限不设下限**（2026-10-09 v6f 修正，原 v6c「至少三种」作废；转化器 colors 参数为上限，原图 3 色就输出 3 色，不凭空撑色）。
  - 背景（2026-10-09 用户换政 v6b）：**纯黑底**——主体剪影与黑底对比最强，转化时按黑底抠图去除（生豆阶段黑底不参与选色）。旧「纯白底」规作废。批跑例：`temp/comfy-teaching-batch.sh`（v6b 色块黑底版，全 1024，seed 连续序列）。
- `--enhance` 可走 workflow 自带的 qwen3.5 PE 扩写分支（短提示词补全成描述长段）；⚠ 扩写后需人工检查是否引入违反原画铁规的内容（如又画出珠格/繁复纹理）。
- 出图落 `temp/comfyui-out/`（不入库），下游同本产线：精修 → 命名规范 → 接入；⚠ 生成图只当**参考/底稿**，logo 终稿仍走 Figma 矢量（既有裁定）。
- 机器不可达时先查：ARP 能解析但 TCP 超时 ⇒ 服务端监听/防火墙问题（需 `--listen 0.0.0.0`），不是本侧脚本问题。

### 云端模型横比与 Boss 连贯度调优（2026-10-10 定稿留档）

> 现流程仍走**本地 ComfyUI qwen-image 2.1（开源）**跑通产线；云端为后续可能切用的定稿备选，本节留档结论与调优法。

**三后端生图脚本（均已留存于本目录）**：

| 后端 | 脚本 | 用法 |
|---|---|---|
| 本地 qwen-image 2.1（ComfyUI 192.168.1.16） | `submit-comfyui.py` + `workflows/qwen-image-2.1-t2i.api.json` | `--prompt '<正向>' --seed N --ratio '1:1 (Square)' --mp 1`（详上「外部 ComfyUI API 出图」） |
| 云端 qwen-image-3.0-pro / wan2.7-image（DashScope） | `dashscope-generate.py` | `--model qwen-image-3.0-pro --level boss`（或 `--level 1..8` / `--text '<正向>'`）；提示词取 `temp/beads-positive.sh` 正本（PRE+SUBJ_n+S / BOSS），与本地逐字一致；不给 `--model` 则跑已注册 4 模型横比 |

**云端调用细节**（阿里云百炼 DashScope，`DASHSCOPE_API_KEY` 在 `.env.local`）：`POST …/api/v1/services/aigc/multimodal-generation/generation`，body `{model, input.messages[].content[].text, parameters:{prompt_extend:true}}`，同步返回 `output.choices[].message.content[].image` URL；出图落 `temp/dashscope-out/<level>/<model>.png`（不入库）。

- `--size '宽*高'`（如 `1152*2048`）透传 `parameters.size`：不给则服务端默认，qwen 线恒为 2048 方图。实测 4 模型竖屏档均正常出图；qwen-image-3.0 **1K/2K 同价**（0.18 元/张），竖屏不加价。
- `--seed N` 同时置 `prompt_extend=False`（服务端提示词改写是主要漂移源）。

**boss 关横比**（同走 studio boss 档 32×32 / noframe 0 / mis=full，全部 cleared；speckle = 孤立豆占比，越低越连贯）：

| 模型 | 色数 | 主导% | speckle% | 出图耗时 | 观感 |
|---|---|---|---|---|---|
| 本地 qwen-image 2.1（基准） | 6 | 31 | — | 产线 | 8 瓣柔彩、白带≈1 格 |
| qwen-image-3.0-pro | 7 | 24 | 8.8 | 48s | 最忠实 8 瓣+粉彩，但豆偏碎 |
| wan2.7-image | 6 | 32 | 2.8 | **6s** | 最快、大色块连贯、指标≈本地 |
| qwen-image-2.1-turbo | 7 | 28 | — | 18s | 快但偏离瓣数/粉彩（~12 瓣高饱和） |
| qwen-image-2.1-pro | 8 | 21 | — | 36s | 色最丰、中心有黑缝（背景透出） |

**连贯度双杠杆**（实测把 3.0-pro 从碎豆调到大色块，脚本 `games/beads/design/ai-workflows/boss-tune.py`）：
1. **生图端提示词**：`BOSS` 里 `white bands … as wide as one cell` → `two cells`（白带更粗→更多 void、可填格 568→469）+ 追加 `using only five distinct flat colors, each forming one large solid contiguous block, no scattered single beads` → speckle 8.8%→**2.6%**（追平 wan2.7）。
2. **转化端 studio `smooth`**（众数滤波轮数）0→2 → speckle **0.0%**（整块）。
两杠杆可叠加：调优后 3.0-pro 兼得「连贯大色块 + 严格 8 瓣对称」。证据 `temp/boss-tune/`、`temp/dashscope-boss-report/`。

**模型定位**（官方文档口径；非「谁更新」，两条并行产品线均 2026 当前代）：qwen-image-3.0-pro＝旗舰（复杂版面/小字渲染/长指令/摄影级细节，中国第 1、全球第 2 仅次 GPT-Image-2）；wan2.7-image＝万相线，快、大色块、多图一致性（pro 版 4K/品牌色/9 参考图）。**拼豆扁平矢量·无文字场景 → wan2.7 更对口（快 8×、天然大色块）；要严格结构/文字 → 3.0-pro**。未来切云端定稿推荐「3.0-pro + 调优提示词」或「wan2.7（量产占位）」。

**接口自动导出 + 自检链**（本轮一并验证，`games/beads/design/ai-workflows/studio-batch-report.py`）：`POST /api/generate`（限色+错位+服务端 `--patch` 回填真引擎 `report.difficulty`）→ 自检主导色/色数/derangement/cleared/time；`POST /api/results/:id/ingest` 真写 `design/levels` + `levels:sync` + `framework:sync`，**sync 失败自动原子回滚**（实测撞门禁⑤ `DEMO_LEVEL_COUNT` 硬红 → 回滚，真源零污染）。默认档＝普通关 2x/16×16、boss 1x/32×32，`noframe 0`（扣背景）。

**换盘：`--rebuild` 整表重建**（`python3 studio-batch-report.py --rebuild --dir temp/comfyui-out/teaching-set`）：与默认**追加**语义互斥——先 `resetLevels` 一次性清空真源关表（`manifest.entries=[]` + 删 `singles/plates` + contentVersion++ + 常量归零，可 `git checkout` 还原），再逐张 generate→bot 实测→ingest；**每入一张前自动把 `tuning.ts::DEMO_LEVEL_COUNT` 设为「当前关数 + 1」以守门禁⑤**（否则第 2 张起 ingest 撞「声明值 ≠ manifest 关数」硬红），末态净关数 = 实入关数。⚠ **pre-release 专用**：换盘会复用 uid 号段（5 位零填充、区间 5–10），仅未上架阶段可用；换盘后 DI/陈列序/Spearman 会变，须同步重校准下游（difficulty/meta-menu-wall/beads-shell 测试 + k6 台账 + level-difficulty/menu-architecture/TASKS-DETAIL 文档），判据见 `levels-spec.md §10 v1.14`（2026-10-10 teaching-set 换盘）。

### Prompt 模板

```
game UI element, perler beads theme, rounded corners,
pastel colors, flat design, isolated on white background,
mobile game interface, clean style
```

### 命名规范

```
ui_<类别>_<名称>_<状态>.png
例: ui_button_confirm_normal.png
    ui_panel_settings_bg.png
    ui_icon_settings_128.png
```

### 接入

- 放入 `games/beads/cocos/assets/ui/`
- 配置 Auto Atlas（assets 右键 → Create → Auto Atlas）
- 按钮/面板用 9-slice（Sprite Type → SLICED）减少资产数量
- 导出 @2x 为主，高端机加 @3x；主包 UI 预算 ~200KB

## 包体预算参考

| 资产类型 | 单张大小 | 数量 | 总计 |
|---|---|---|---|
| Mask 128x128 | ~4-6KB | 8 张（4 风格 x 2 变体） | ~40KB |
| Base 128x128 | ~5-8KB | 2 张 | ~15KB |
| UI 元素 | ~2-10KB | ~30 件 | ~150KB |
| **合计** | | | **~200KB** |

## 文件清单

| 文件 | 用途 |
|---|---|
| `encode-mask.py` | 光照参考图 → tint-mask 格式转换 |
| `submit-comfyui.py` | 向远端 ComfyUI Server API 提交 workflow 并取回出图（标准库；qwen 钉节点 id，含标准 CLIPTextEncode 的 workflow 走通用探测；`--override NODE:KEY=VAL` 可临时改任意节点输入） |
| `workflows/qwen-image-2.1-t2i.api.json` | qwen-image 2.1 t2i workflow（API 格式正本，192.168.1.16 机器导出） |
| `workflows/qwen-image-2.1-turbo.api.json` | qwen-image 2.1 **turbo** t2i（8 步蒸馏 / cfg=1 / euler；标准 `KSampler`+`CLIPTextEncode`，走 `submit-comfyui.py` 通用分支：正/负=n4/n5、种子=KSampler、尺寸=EmptyLatentImage）。✅ **实测（2026-10-11，seed 42 / mp 1）：平涂达标**——单主体草莓出纯平涂两大色块、锐边、白底隔离、零渐变/阴影/高光/3D，正中 §「平面限色原画」口径（比 qwen v5 更干净）。⚠ cfg=1 → `--negative` 被忽略。**⚠ 2026-10-12 更正（本条只胜一半）**：多 seed 复测确诊 8 步做 t2i 属**欠采样**（高光 >250 占比 73–80%，首页基线 2.9%），换量化救不了 → 以 `model-matrix.md` §5 为准：**8 步档禁用于 t2i**，只可用于有底图约束的 inpaint/i2i；本条当时系单 seed 单题。证据：`temp/comfyui-out/turbo-test/Qwen_Turbo_00002_.png` |
| `workflows/qwen-image-2.1-turbo-i2i.api.json` | qwen-image 2.1 **turbo 图生图**（`LoadImage`→`VAEEncode`→`KSampler(denoise)`，无 EmptyLatentImage，出图尺寸=输入）。⚠ **denoise 语义（实测）**：默认 0.65 结构锁得死（草莓→草莓，压不成苹果）；降到 0.5 可保形做态变体。⚠ **产物是整颗按钮贴奶油底的渲染图**，非切图：外缘柔光/AA 融进背景难抠净、几何与源 9-slice 不逐像素对齐 → 宜当 hover/高亮的**构图参照**，运行时换档资产仍走确定性更干净（色准实测中心 (254,156,162) vs 源 (253,150,158)，ΔG≈6；中段横向 max\|Δ\|=1 尚可拉伸）。证据：`temp/btn-cta/_i2i-out/Qwen_I2I_00002_.png` |
| `workflows/sdxl-sticker.api.json` | SDXL 贴纸描边 workflow（sd_xl_base + StickerSheet/lineart 双 LoRA，cfg=7 负面词生效）。⚠ **实测挂起（2026-10-09，9 轮冒烟确诊）**：两 LoRA 的风格先验与「单主体平涂图标」根本冲突——StickerSheet 出贴纸合集/平铺图案（降权 0.35、负面词均压不住）；关它后 lineart 0.8 带街景/人物（`1solo` 是 danbooru 人物词，禁用）；裸 base 画空心/涂鸦心。换装候选亦否：**Flat style**→空心 logo 环+灰底+装饰心；**StickersRedmond**→白心红徽章+缝线扇贝边+灰底投影（均 seed 4201 同题对照 FAIL，证据 00019/00020）。根因：sd_xl_base 对简单实心图形结构 prior 太弱。**裁定：关卡底图产线维持 qwen-image 2.1 v5（同题 PASS），SDXL 线搁笔**；重启条件＝出现带结构约束（ControlNet/canny）的方案或更强图标底模。证据图：`temp/comfyui-out/sdxl-test/` 00010–00022（00021/00022 为同题复测，结论一致） |
| `workflows/flux-dev-sticker.api.json` | Flux-dev GGUF 贴纸 workflow（flux1-dev-Q5_K_S + flat-illus-flux-v1/EnvyFluxKawaiiSticker01 双 LoRA；无负面入口，种子在 RandomNoise）。⚠ 实测（2026-10-09，7 轮冒烟 00006–00012）：**结构 prior 强于 SDXL**（零空心/零多主体），但默认采样参数出图柔糊（steps20/simple/shift1.15 太弱）；steps=28+max_shift=1.6 恢复锐度。风格侧：48 kawaii=柔边高光元凶、47 flat-illus=模切白边+投影；最优形态＝**双 LoRA 全关裸 flux**（闭合粗描边+平涂，00011），残留病＝flat-design 长投影（prompt 压不住，00012 反增纸艺纹理）。✅ **2026-10-09 晚突破**：48 换挂 `STICKER_FLUX.safetensors`（47 flat-illus 保留 + steps28/shift1.6）→ 黑闭合粗描边+填实+白底全达标（00013 PASS，CONCERNS：左上 4 点粉高光+右侧暗红阴影略多算）；待全套验证 → ✅ **全套已跑（9/9，`temp/comfy-flux-batch.sh` → `teaching-set-flux/`）**：零崩图、描边优于 qwen v5；butterfly/smiley/star PASS，flower 触边/apple/house CONCERNS，rainbow 5 带与 boss ~9 档超色预算＝与 qwen v5 同病（自然语言限色约束两模型均不服，留给转化器 k-means 强限色）。⚠ **2026-10-12 补第二 seed 后推翻**：同配方 heart @seed 4211 出**白底 + 撑满触边**（4201 虽黑底但多一圈模切白边与双层心叠影）→ 「9/9 达标」属**单 seed 结论**，不满足矩阵 §1 顶部「≥2 seed 一致才可翻案」门槛。**裁定：底图产线维持 qwen-image 2.1 v5**，正本见 `model-matrix.md` §6 |
| `style-brief-for-lora.md` | 关卡底图美术风格规格书（LoRA 选型需求单：四硬指标/限色预算/禁词表/SDXL 失败根因/验收流程） |
| `studio-batch-report.py` | 批量「导出+自检+效果对比」驱动：起 beads-studio 服务 → 逐张 `POST /api/generate`（限色/错位/服务端 `--patch` 回填真引擎 report）→ PIL 渲染对位/错位珠盘 → 可选 `--ingest`（真写 design/levels + sync，失败原子回滚）→ HTML 报告。默认档对齐 UI（普通关 16×16、boss 32×32、noframe 0）。零第三方依赖（urllib+Pillow） |
| `dashscope-generate.py` | 阿里云百炼 DashScope 云端生图驱动（本地 qwen2.1 之外的云端后端）：`--model`选模型（qwen-image-3.0-pro/2.1-pro/2.1-turbo、wan2.7-image）、`--level boss|1..8` 或 `--text` 选提示词（取 `temp/beads-positive.sh` 正本）。读 `.env.local` 的 `DASHSCOPE_API_KEY`。仅标准库 |
| `boss-tune.py` | Boss 连贯度调优实验：复用上述两脚本，重生 3.0-pro（白带 2 格+限色 5 大色块），以 speckle（孤立豆占比）量化「提示词端 + studio smooth 端」双杠杆效果 |
| `README.md` | 本文件 |
