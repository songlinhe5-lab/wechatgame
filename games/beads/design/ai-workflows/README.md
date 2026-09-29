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
| `README.md` | 本文件 |
