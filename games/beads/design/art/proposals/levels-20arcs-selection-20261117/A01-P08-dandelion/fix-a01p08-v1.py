#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A01-P08 v1 确定性修复（零模型调用）。
v1 问题：主体 G9 61.72% × 93.36%（球宽窄、茎戳到底 H 爆）+ 15 颗 1–4 px 孤点（破单连通）+
LANCZOS 抗锯齿产生深色 halo（max<60 伪像素，破 G8 近黑禁）。
修复：
  1) 保留主连通分量（≥100 px），擦除所有孤点 → 单连通；
  2) 茎底裁到 y=1570（画布 76.6% 处），使 H 由 93% 降到 ~76%；
  3) 行级横纵独立拉伸到目标 W=1515 / H=1597（G9 74% × 78%），水平 / 纵向各算各自比例；
  4) LANCZOS 后 α≥128 统一 255，再擦除 RGB.max()<40 的深色 halo（G8 合规）；
  5) 再次 label + 只留主分量防残留漂点。
输入：a01p08-v1-s42-rgba.png（extract-alpha 抠图产物）。"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage

BATCH = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BATCH, "a01p08-v1-s42-rgba.png")
DST = os.path.join(BATCH, "a01p08-v1-s42-rgba-fixed.png")

im = Image.open(SRC).convert("RGBA")
w, h = im.size
arr = np.asarray(im).copy()
a = arr[:, :, 3] > 128

# ── 1) 保留主连通分量（≥100 px），擦除所有 ≤10 px 孤点 ──
labeled, n = ndimage.label(a, structure=np.ones((3, 3), dtype=int))
for i in range(1, n + 1):
    c = int((labeled == i).sum())
    if c < 100:
        arr[labeled == i] = 0

# ── 2) 茎底裁到 y=1570（画布 76.6% 处），H≈76% ──
arr[1570:, :, 3] = 0

# ── 3) 横纵独立拉伸到 G9 目标 ──
a2 = arr[:, :, 3] > 128
ys, xs = np.where(a2)
cur_w = xs.max() - xs.min() + 1
cur_h = ys.max() - ys.min() + 1
tgt_w = int(w * 0.74)   # 74%
tgt_h = int(h * 0.78)   # 78%
k_x, k_y = tgt_w / cur_w, tgt_h / cur_h
print(f"content before scale: {cur_w}×{cur_h}  scale x={k_x:.3f} y={k_y:.3f}")

tmp = Image.fromarray(arr)
S = 4
hi = tmp.resize((int(w * k_x * S), int(h * k_y * S)), Image.LANCZOS)
shrunk = hi.resize((int(w * k_x), int(h * k_y)), Image.LANCZOS)
canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
canvas.paste(shrunk, ((w - shrunk.size[0]) // 2, (h - shrunk.size[1]) // 2))

# ── 4) α≥128 统一 255 + 擦除深色 halo（G8：主体禁近黑伪像素；置 α=0，非 RGB） ──
arr_out = np.asarray(canvas).copy()
arr_out[:, :, 3] = np.where(arr_out[:, :, 3] >= 128, 255, 0).astype(np.uint8)
halo = (arr_out[:, :, 3] > 128) & (arr_out[:, :, :3].max(2) < 60)  # 只在原主体 alpha 内擦 halo，别吃黑 bg
arr_out[halo, 3] = 0

# ── 5) 再次 label + 只留主分量 ──
a3 = arr_out[:, :, 3] > 128
lbl3, n3 = ndimage.label(a3, structure=np.ones((3, 3), dtype=int))
for i in range(1, n3 + 1):
    if int((lbl3 == i).sum()) < 10000:
        arr_out[lbl3 == i] = 0

Image.fromarray(arr_out).save(DST)
print("OK ->", DST)
