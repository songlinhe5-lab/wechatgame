#!/usr/bin/env python3
"""
从 layers.json 生成 Cocos 探针用的**形状图**（RGB=白 + alpha=珠/格轮廓）。

为什么需要它：Cocos 的 Sprite 没有 SpriteFrame 就不渲染，且 tint-mask.effect 的 alpha
取自 `cc_spriteTexture.a` ⇒ SpriteFrame 的**唯一作用 = 形状遮罩**（RGB 不参与合成，
因为 shader 只读 alpha、颜色全由 baseColor × mask 算）。

⛔ 别再拿 `tint-128-base_c8.png`（烤好的棕色成品，alpha 全 255）顶替：它 alpha 满幅
⇒ 珠外/孔区也被按 d 画出来（珠外糊暗底、孔变黑块），形状裁剪完全失效。

B15：孔族 live ⇒ 珠形状图**跳过 circle 层**（孔区 alpha=0，由运行时画孔底 pit）。

USAGE: python3 tools/mask-preview/export-shapes.py
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).parent
OUT_SIZE = 128  # ADR-0028 资产规格（32dp × 4 texel/dp）

data = json.load(open(HERE / "layers.json"))
SIZE = data["SIZE"]
WHITE = (255, 255, 255, 255)


def draw_shape(layers, size, skip_circle: bool) -> Image.Image:
    img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    d = ImageDraw.Draw(img)
    for layer in layers:
        kind = layer["kind"]
        if skip_circle and kind == "circle":
            continue  # B15：孔 live
        if kind == "rect":
            x, y, w, h = layer["x"], layer["y"], layer["w"], layer["h"]
            y = size - y - h
            r = layer.get("r", 0)
            if r > 0:
                d.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=WHITE)
            else:
                d.rectangle([x, y, x + w, y + h], fill=WHITE)
        elif kind == "polygon":
            pts = layer["pts"]
            pts = [pts[i] if i % 2 == 0 else size - pts[i] for i in range(len(pts))]
            d.polygon(pts, fill=WHITE)
        elif kind == "circle":
            cx, cy, r = layer["cx"], layer["cy"], layer["r"]
            cy = size - cy
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
        elif kind == "line":
            x1, y1, x2, y2 = layer["x1"], layer["y1"], layer["x2"], layer["y2"]
            y1, y2 = size - y1, size - y2
            d.line([x1, y1, x2, y2], fill=WHITE, width=max(1, round(layer.get("lw", 1))))
    return img


outdir = HERE / "cocos-assets"
outdir.mkdir(exist_ok=True)
for name, key, skip in (
    ("shape-bead-128.png", "beadLayers", True),
    ("shape-cell-128.png", "cellLayers", False),
):
    img = draw_shape(data[key], SIZE, skip)
    if SIZE != OUT_SIZE:
        img = img.resize((OUT_SIZE, OUT_SIZE), Image.NEAREST)  # 64→128，硬边不插值
    out = outdir / name
    img.save(out)
    alpha = img.split()[3]
    print(f"✅ {out}  {img.size}  不透明像素 {sum(1 for p in alpha.getdata() if p > 0)}")
