#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A01-P08 v1 确定性修复（零模型调用）。
v1 问题：G9 61.72% × 93.36%（球宽窄、茎戳到底 H 爆）+ 15 颗 1–4 px 孤点（破单连通）+
LANCZOS 抗锯齿产生深色 halo（max<60 伪像素，破 G8 近黑禁）。
修复：
  1) 擦除 <100 px 孤点；
  2) 茎底裁到 y=1570（画布 76.6% 处）；
  3) 横纵独立拉伸到 G9 目标（W 74% / H 78%），4× 放大再 LANCZOS 缩回；
  4) α≥128 统一 255；深色 halo（max<60）用最近非 halo 像素 RGB 就地填补
     —— 不置 α=0（会在体内造空洞，平铺黑底后成近黑孤岛，破 G8）；
  5) 4 连通 label，只留主分量（≥10000 px）⇒ G3 与 extract-alpha 的 PIL floodfill 同口径。
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

# ── 1) 擦除 <100 px 孤点（模型飞絮碎点） ──
a = arr[:, :, 3] > 128
labeled, n = ndimage.label(a, structure=np.ones((3, 3), dtype=int))
removed = 0
for i in range(1, n + 1):
    c = int((labeled == i).sum())
    if c < 100:
        arr[labeled == i] = 0
        removed += 1
print(f"speck components removed: {removed}")

# ── 2) 茎底裁到 y=1570（画布 76.6% 处） ──
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

# ── 4) α≥128 统一 255；深色 halo 用最近非 halo 主体 RGB 填补 ──
arr_out = np.asarray(canvas).copy()
arr_out[:, :, 3] = np.where(arr_out[:, :, 3] >= 128, 255, 0).astype(np.uint8)
keep = arr_out[:, :, 3] > 0
donor = keep & (arr_out[:, :, :3].max(2) >= 60)
halo = keep & ~donor
print(f"halo px (max<60, alpha>0): {int(halo.sum())}")
if halo.any() and donor.any():
    idx = ndimage.distance_transform_edt(~donor, return_distances=False, return_indices=True)
    arr_out[:, :, :3] = arr_out[idx[0], idx[1], :3]

# ── 5) 4 连通 label（与 PIL floodfill 同口径），只留主分量 ──
a3 = arr_out[:, :, 3] > 0
lbl3, n3 = ndimage.label(a3)  # 默认 cross = 4 连通
sizes = ndimage.sum(a3, lbl3, range(1, n3 + 1))
kept = int((sizes >= 10000).sum())
for i in range(1, n3 + 1):
    if sizes[i - 1] < 10000:
        arr_out[lbl3 == i] = 0
print(f"4-conn components: {n3}, kept: {kept}")

# 自检
final = arr_out[:, :, 3] > 0
lf, nf = ndimage.label(final)
print(f"final 4-conn components: {nf} (expect 1)")
ys, xs = np.where(final)
print(f"final bbox W% {(xs.max()-xs.min()+1)/w*100:.2f}  H% {(ys.max()-ys.min()+1)/h*100:.2f}")
print(f"final near-black (max<=24 & alpha>0): "
      f"{int((final & (arr_out[:, :, :3].max(2) <= 24)).sum())}")

Image.fromarray(arr_out).save(DST)
print("OK ->", DST)
