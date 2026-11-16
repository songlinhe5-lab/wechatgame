# gpt-image「九宫格背板」提示词套件（用户自验）

输入基准：`backplate-geo.png`（1012×1194 @2x，四边金线 + 24dp 圆角，几何已正确）—— 由同目录 `make-grid-backplate.py` 从 Figma 节点 `164:63` 的 @2x 导出件生成（零模型）：
`python3 games/beads/design/ai-workflows/make-grid-backplate.py --src <figma 164-63 @2x.png> --out backplate-geo.png`
目的：只换材质，不动几何。若模型改了几何，说明它没遵守硬约束，见 §4 验证判据。

---

## 1. API 版（有 mask，成功率最高）

`POST /v1/images/edits`

- `model`: 你手上的 gpt-image 版本
- `size`: `1024x1536`（最接近的竖版；生成后按 1012:1194 比例中心裁切）
- `quality`: `high`
- `input_fidelity`: `high`（若该版本支持）
- `n`: 2

**image**: `backplate-geo.png`
**mask**: 只把「金线以内的木纹区」设为透明（alpha=0），金线带与四角保持不透明。
> gpt-image 的 mask 语义是**透明区 = 允许重绘**，与常见 inpainting 相反。搞反就是"边框被改、木纹没动"。

**prompt（英文，逐字）**：

```
Use the input image as an exact geometric template. Keep the composition pixel-aligned.

Change ONLY the wood surface material inside the gold border.

Hard constraints — all must hold:
- Gold border: same position on all four edges, same inset, same width, same color and highlights.
- Corner radius: identical to the input, all four corners.
- Outside the rounded corners: remain fully transparent.
- Canvas size, aspect ratio, crop and framing: unchanged.
- Do not redraw, move, or restyle the border.
- No new elements: no rivets, no screws, no ornament, no engraving, no text, no logo,
  no glare spots, no drop shadow, no vignette.

Material target:
- Continuous horizontal walnut grain, fine and dense, no tiling, no visible repetition.
- Soft top-down light falloff: slightly brighter near the top edge, slightly darker near the bottom.
- A very subtle warm inner shadow just inside the gold border, so the panel reads as a solid slab.
- Photorealistic, low contrast, no specular hotspots.

Output the same framing, photorealistic.
```

---

## 2. 网页版 / ChatGPT 版（无 mask）

先上传 `backplate-geo.png`，再发下面这段（英文遵从度更高）：

```
Edit this image. Keep the geometry exactly as it is.

Keep unchanged:
- the gold border on all four edges (same inset, same width, same color)
- the rounded corners (same radius)
- the transparent area outside the corners
- the overall size, aspect ratio and crop

Change only the brown wood surface:
- make it a continuous horizontal walnut grain, fine and dense, no repeating pattern
- soft top-down light: slightly brighter at the top, slightly darker at the bottom
- a very subtle warm inner shadow just inside the border, so it reads as a solid wooden slab

Do not add rivets, ornament, text, logos, glare spots or drop shadows.
Do not move, thicken or restyle the border.
```

若第一次仍"几乎不变"：把 `Change only...` 改成更强制的说法，并给出可量化的验收：
`The output MUST differ from the input in the interior region. A pixel-identical copy is a failure.`

---

## 3. 从零生成版（模型死活不肯改时的兜底）

```
A single vertical wooden panel asset for a mobile game UI, isolated on a transparent background.

- Shape: rectangle, aspect ratio 506:597, four rounded corners with radius 24 dp.
- Border: one continuous thin gold rim inset 6 dp from the edge on all four sides,
  following the corner curve, with a bright top-left highlight and a darker lower-right side.
- Surface: warm walnut wood, fine horizontal grain, matte, low contrast.
- Lighting: soft top-down, slightly brighter at the top, slightly darker at the bottom.
- No rivets, no screws, no ornament, no text, no logo, no shadow, no background.
- Flat front view, orthographic, centered, fills the frame.

Transparent PNG.
```

---

## 4. 验证判据（别靠肉眼）

```python
from PIL import Image, ImageChops
import numpy as np

ref = Image.open("backplate-geo.png").convert("RGBA")
out = Image.open("gpt-out.png").convert("RGBA").resize(ref.size, Image.LANCZOS)

d = np.abs(np.array(out).astype(int) - np.array(ref).astype(int))[..., :3]
print("interior maxdiff", d[60:-60, 60:-60].max())   # 应 > 0（材质变了）
print("border  maxdiff", d[0:40, :, :].max())         # 应较小（几何没动）

L = np.array(out).astype(float)[..., :3].mean(-1)
h, w = L.shape
print("peaks L/R/T/B", np.argmax(L[h//2, :60]), w-1-np.argmax(L[h//2, ::-1][:60]),
      np.argmax(L[:60, w//2]), h-1-np.argmax(L[::-1][:60, w//2]))
# 基准值（@2x）：L=11 R=1000 T=11 B=1182，漂移 >2px 视为几何失守
```

判负条件（任一命中即判负）：
1. 内部 maxdiff = 0 → 模型原样复制，没执行
2. 边框峰值漂移 > 2px → 几何失守
3. 输出无 alpha 或四角不透明 → 透明丢失（模型线常态，需程序化回切 alpha）
