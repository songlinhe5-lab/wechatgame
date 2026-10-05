#!/usr/bin/env python3
"""
合并预览：把 bead/grid 两张 mask（R=d / G=l / B=shape）按 ADR-0028 §2.1 数学
直接合成「有珠的完整格」PNG，并排多个 base 色（含暗端验证）。

合成公式：out = base·d + (1−base)·l；alpha = shape；bead over grid（预乘 over）。
⚠ 这是 CPU 精确合成（float），与 shader 结果一致——用于设计判读，非运行时产物。

USAGE: python3 tools/mask-preview/preview-combined.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).parent
SRC = HERE / "cocos-assets"
OUT_DIR = HERE / "cocos-assets"

# 预览 base 色：红（用户调试色）/ 奶白（demo 亮端）/ 炭黑 / 纯黑（暗端退化验证）
BASES = [
    ("red", (0xAA, 0x41, 0x41)),
    ("cream", (0xFD, 0xF6, 0xE9)),
    ("charcoal", (0x33, 0x33, 0x3D)),
    ("black", (0x00, 0x00, 0x00)),
]


def composite(mask_png: Path, base) -> np.ndarray:
    """单张 mask × base ⇒ float RGB（0..1）+ shape alpha。"""
    a = np.array(Image.open(mask_png).convert("RGB")).astype(np.float32) / 255.0
    d, l, shape = a[..., 0], a[..., 1], a[..., 2]
    b = np.array(base, np.float32) / 255.0
    out = b * d[..., None] + (1.0 - b) * l[..., None]      # [WXG-T-259] l ⛔ 不乘 shape（与 shader / TS 同式）
    alpha = shape
    return out, alpha


def over(fg_rgb, fg_a, bg_rgb, bg_a):
    """预乘 over。"""
    fa = fg_a[..., None]
    return fg_rgb * fa + bg_rgb * bg_a[..., None] * (1.0 - fa), fg_a + bg_a * (1.0 - fa)


grid_rgb, grid_a = composite(SRC / "grid-hole-tint-128-mask.png", (255, 255, 255))  # 先白合成，逐色再算
rows = []
for name, base in BASES:
    g_rgb, g_a = composite(SRC / "grid-hole-tint-128-mask.png", base)
    b_rgb, b_a = composite(SRC / "bead-hole-tint-128-mask.png", base)
    cell, _ = over(b_rgb, b_a, g_rgb, g_a)                     # 珠叠格 = 有珠的完整格
    empty, _ = over(np.zeros_like(g_rgb), np.zeros_like(g_a), g_rgb, g_a)  # 空格对照
    pair = np.concatenate([empty, cell], axis=1)               # [空格 | 有珠格] 256×128
    rows.append(pair)
strip = np.concatenate(rows, axis=0)                           # 4 色 × 256×128 = 256×512
img = Image.fromarray((np.clip(strip, 0, 1) * 255).astype(np.uint8), "RGB")
img.save(OUT_DIR / "preview-combined-128.png")
big = img.resize((1024, 2048), Image.NEAREST)
big.save(OUT_DIR / "preview-combined-1024.png")
print(f"✅ {OUT_DIR / 'preview-combined-128.png'}（256×512：4 色 × [空格|有珠格]）")
print(f"✅ {OUT_DIR / 'preview-combined-1024.png'}（4× 放大）")
print("色序（上→下）：red / cream / charcoal / black——最下行看暗端退化")
