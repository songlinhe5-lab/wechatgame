#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A01-P07 v4 确定性几何修复（零模型调用）。
v4 原图 G9 = 51.1% × 88.1%，模型把球体/花盆画窄、花盆画深。按批准方案复原几何：
  1) 球体行级横向拉伸 1.33（y<500 花不动，500–760 平滑过渡）⇒ 球宽≈68%；
  2) 旧花盆整体擦除，程序化重绘宽口浅盆（盆口 76%、盆底 62%、盆高 15%、盆沿 22%）；
  3) 整图下移使主体垂直居中；
  4) 花冠内盘按方案放大：奶白盘径 52%、柠黄花心径 32%（原模型只画到 39%/18%，
     32×32 取样黄只剩 2 格，低于 G4 最小特征）。
目标 G9 ≈76% × 74%，五色板不变。输入 a01p07-v4-s42-rgba.png（extract-alpha 产物）。"""
import os

import numpy as np
from PIL import Image, ImageDraw

BATCH = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BATCH, "a01p07-v4-s42-rgba.png")
DST = os.path.join(BATCH, "a01p07-v4-s42-rgba-fixed.png")

POT = (107, 62, 30, 255)          # #6B3E1E 深棕（§3 十色板）
CX = 1024
POT_TOP, RIM_H, POT_H = 1325, 68, 307
TOP_W, BOT_W, RIM_W = 1556, 1270, 1580
DY = 148

im = Image.open(SRC).convert("RGBA")
w, h = im.size
a = np.asarray(im).copy()

# ── 1) 行级横向拉伸：球体撑到 68%，花冠保持正圆 ──
out = np.zeros_like(a)
for y in range(h):
    if y < 500:
        k = 1.0
    elif y < 760:
        k = 1.0 + 0.33 * (y - 500) / 260
    else:
        k = 1.33
    xs = np.round(CX + (np.arange(w) - CX) / k).astype(np.int32)
    ok = (xs >= 0) & (xs < w)
    out[y, ok] = a[y, xs[ok]]
a = out

# ── 2) 擦除旧盆，重绘宽口浅盆（4× 超采样抗锯齿） ──
a[POT_TOP + 7:, :, 3] = 0
S = 4
layer = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
d = ImageDraw.Draw(layer)
d.rectangle([(CX - RIM_W // 2) * S, POT_TOP * S, (CX + RIM_W // 2) * S,
             (POT_TOP + RIM_H) * S], fill=POT)
d.polygon([((CX - TOP_W // 2) * S, (POT_TOP + RIM_H) * S),
           ((CX + TOP_W // 2) * S, (POT_TOP + RIM_H) * S),
           ((CX + BOT_W // 2) * S, (POT_TOP + POT_H) * S),
           ((CX - BOT_W // 2) * S, (POT_TOP + POT_H) * S)], fill=POT)
layer = layer.resize((w, h), Image.LANCZOS)
im2 = Image.alpha_composite(Image.fromarray(a), layer)

# ── 3) 垂直居中 ──
canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
canvas.paste(im2, (0, DY))

# ── 4) 花冠内盘放大（白 52% / 黄 32%，原图 39% / 18%） ──
S = 4
flower = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
fd = ImageDraw.Draw(flower)
FCX, FCY = 1022, 543
for r, c in ((160, (253, 246, 233, 255)), (98, (255, 210, 63, 255))):
    fd.ellipse([(FCX - r) * S, (FCY - r) * S, (FCX + r) * S, (FCY + r) * S], fill=c)
canvas = Image.alpha_composite(canvas, flower.resize((w, h), Image.LANCZOS))

canvas.save(DST)
print("OK ->", DST)
