# AI 美术工作流

拼豆项目本地 AI 生图 → 编码 → 接入 Cocos Creator 的自动化工具集。

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
- ❗ **关卡图定位铁规：生成「拼豆转化·平面限色原画」，⛔ 不直接画拼豆面板、⛔ 不出立体渲染**（prompt 零 `bead / pegboard / pixel grid` 类词，拼豆化交给 studio 换肤/限色管线）：
  - 造型：单一主体居中、剪影大胆清晰；细节少到缩到目标格数仍可辨——**原画全 1024 直出（含 boss；2026-10-09 换制：格数由转化器采样决定，1024 对 32×32 档每格仍有 32px 采样余量；⛔ 2048 直出废——SDXL 易崩构图、Flux 实测 shift 错配劣化，旧 boss=2048 规作废）**。
  - 风格：**flat 2D 矢量插画口径——大色块平涂（solid flat fills）+ 锐利边缘**；⛔ 禁 `glossy / sheen / highlight / soft lighting / realistic material / 3D render / gradient / shadow` 类词（v3 实测教训：写「柔和光影/真实材质」出成立体产品渲染，高光渐变被 k-means 压出碎色，用色过多过碎不可拆解）。
  - 线条（2026-10-09 用户换政 v6）：**以色块为主、不要多线条**，零描边，色块区域间用**宽白带**分隔；如需描边/分隔线，宽度必须 **≥一颗珠（目标格一档）**且**禁纯黑**——细线在格采样中被邻色吞掉，纯黑描边与黑底/选色避黑冲突。
  - 色彩：主题性、克制、**以大色块计**（16×16 档 ≤8 色、32×32 档 ≤16 色；2026-10-09 用户换制，旧 ≤5/≤7 作废）；每区域一块平涂色，禁细碎纹理/噪点；**选色避开纯黑**（黑只当背景用），主体内不得出现黑/深色。
  - 背景（2026-10-09 用户换政 v6b）：**纯黑底**——主体剪影与黑底对比最强，转化时按黑底抠图去除（生豆阶段黑底不参与选色）。旧「纯白底」规作废。批跑例：`temp/comfy-teaching-batch.sh`（v6b 色块黑底版，全 1024，seed 连续序列）。
- `--enhance` 可走 workflow 自带的 qwen3.5 PE 扩写分支（短提示词补全成描述长段）；⚠ 扩写后需人工检查是否引入违反原画铁规的内容（如又画出珠格/繁复纹理）。
- 出图落 `temp/comfyui-out/`（不入库），下游同本产线：精修 → 命名规范 → 接入；⚠ 生成图只当**参考/底稿**，logo 终稿仍走 Figma 矢量（既有裁定）。
- 机器不可达时先查：ARP 能解析但 TCP 超时 ⇒ 服务端监听/防火墙问题（需 `--listen 0.0.0.0`），不是本侧脚本问题。

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
| `workflows/sdxl-sticker.api.json` | SDXL 贴纸描边 workflow（sd_xl_base + StickerSheet/lineart 双 LoRA，cfg=7 负面词生效）。⚠ **实测挂起（2026-10-09，9 轮冒烟确诊）**：两 LoRA 的风格先验与「单主体平涂图标」根本冲突——StickerSheet 出贴纸合集/平铺图案（降权 0.35、负面词均压不住）；关它后 lineart 0.8 带街景/人物（`1solo` 是 danbooru 人物词，禁用）；裸 base 画空心/涂鸦心。换装候选亦否：**Flat style**→空心 logo 环+灰底+装饰心；**StickersRedmond**→白心红徽章+缝线扇贝边+灰底投影（均 seed 4201 同题对照 FAIL，证据 00019/00020）。根因：sd_xl_base 对简单实心图形结构 prior 太弱。**裁定：关卡底图产线维持 qwen-image 2.1 v5（同题 PASS），SDXL 线搁笔**；重启条件＝出现带结构约束（ControlNet/canny）的方案或更强图标底模。证据图：`temp/comfyui-out/sdxl-test/` 00010–00022（00021/00022 为同题复测，结论一致） |
| `workflows/flux-dev-sticker.api.json` | Flux-dev GGUF 贴纸 workflow（flux1-dev-Q5_K_S + flat-illus-flux-v1/EnvyFluxKawaiiSticker01 双 LoRA；无负面入口，种子在 RandomNoise）。⚠ 实测（2026-10-09，7 轮冒烟 00006–00012）：**结构 prior 强于 SDXL**（零空心/零多主体），但默认采样参数出图柔糊（steps20/simple/shift1.15 太弱）；steps=28+max_shift=1.6 恢复锐度。风格侧：48 kawaii=柔边高光元凶、47 flat-illus=模切白边+投影；最优形态＝**双 LoRA 全关裸 flux**（闭合粗描边+平涂，00011），残留病＝flat-design 长投影（prompt 压不住，00012 反增纸艺纹理）。✅ **2026-10-09 晚突破**：48 换挂 `STICKER_FLUX.safetensors`（47 flat-illus 保留 + steps28/shift1.6）→ 黑闭合粗描边+填实+白底全达标（00013 PASS，CONCERNS：左上 4 点粉高光+右侧暗红阴影略多算）；待全套验证 → ✅ **全套已跑（9/9，`temp/comfy-flux-batch.sh` → `teaching-set-flux/`）**：零崩图、描边优于 qwen v5；butterfly/smiley/star PASS，flower 触边/apple/house CONCERNS，rainbow 5 带与 boss ~9 档超色预算＝与 qwen v5 同病（自然语言限色约束两模型均不服，留给转化器 k-means 强限色） |
| `style-brief-for-lora.md` | 关卡底图美术风格规格书（LoRA 选型需求单：四硬指标/限色预算/禁词表/SDXL 失败根因/验收流程） |
| `README.md` | 本文件 |
