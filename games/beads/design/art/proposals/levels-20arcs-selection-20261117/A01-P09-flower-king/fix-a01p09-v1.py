#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A01-P09 花之王 boss v1 确定性修复（零模型调用）。
v1 问题：G9 70.95%×**90.28%**（萼桩过长，戳到 y=1928）｜单连通 false（4 px 4-连通孤点）
｜近黑 1659 px（冠带下方一块暗红阴影，max(rgb)≤24，破 G8）。
修复：
  1) 4 连通只留主分量（与 extract-alpha 的 PIL floodfill 同口径）；
  2) 近黑/深色（max<60）用最近非深色主体 RGB 就地填补（不删，避免体内空洞）；
  3) 萼桩裁到花底 +180 px（短桩口径），H 96.5% → 86.2%；
  4) 横纵独立拉伸到 W 72.5% / H 79.5%，4× 放大再 LANCZOS 缩回；
  5) α≥128 统一 255 + 深色 halo 再填补；
  6) 4 连通主分量复检。
输入：a01p09-v1-s42-rgba.png（extract-alpha 抠图产物）。"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage

BATCH = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BATCH, "a01p09-v1-s42-rgba.png")
DST = os.path.join(BATCH, "a01p09-v1-s42-rgba-fixed.png")

im = Image.open(SRC).convert("RGBA")
w, h = im.size
arr = np.asarray(im).copy()


def keep_main_component(a, min_px=10000):
    """4 连通（PIL floodfill 同口径）只留最大分量。"""
    lbl, n = ndimage.label(a)
    if n == 0:
        return a, 0
    sizes = ndimage.sum(a, lbl, range(1, n + 1))
    main = int(np.argmax(sizes)) + 1
    out = lbl == main
    return out if sizes[main - 1] >= min_px else np.zeros_like(a), n


def inpaint_dark(rgba, dark_thr=60):
    """深色像素用最近非深色主体 RGB 就地填补。"""
    fg = rgba[:, :, 3] > 0
    donor = fg & (rgba[:, :, :3].max(2) >= dark_thr)
    dark = fg & ~donor
    if dark.any() and donor.any():
        idx = ndimage.distance_transform_edt(~donor, return_distances=False, return_indices=True)
        rgba[:, :, :3] = rgba[idx[0], idx[1], :3]
    return int(dark.sum())


# ── 1) 4 连通主分量 ──
fg = arr[:, :, 3] > 128
main, n0 = keep_main_component(fg)
arr[~main] = 0
print(f"4-conn comps before: {n0} -> kept main only")

# ── 2) 近黑/深色就地填补 ──
print("dark px inpainted:", inpaint_dark(arr, 60))

# ── 3) 萼桩截短 ──
rows = (arr[:, :, 3] > 128).sum(1)
flower_bottom = max(y for y in range(h) if rows[y] > 300)
cut = flower_bottom + 180
arr[cut:, :, 3] = 0
print(f"flower_bottom={flower_bottom}  stem cut at y={cut}")

# ── 4) 横纵独立拉伸 ──
a2 = arr[:, :, 3] > 128
ys, xs = np.where(a2)
cur_w = xs.max() - xs.min() + 1
cur_h = ys.max() - ys.min() + 1
k_x = (w * 0.725) / cur_w
k_y = (h * 0.795) / cur_h
print(f"content {cur_w}×{cur_h}  k_x={k_x:.3f} k_y={k_y:.3f}")

tmp = Image.fromarray(arr)
S = 4
hi = tmp.resize((int(w * k_x * S), int(h * k_y * S)), Image.LANCZOS)
shrunk = hi.resize((int(w * k_x), int(h * k_y)), Image.LANCZOS)
canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
canvas.paste(shrunk, ((w - shrunk.size[0]) // 2, (h - shrunk.size[1]) // 2))

# ── 5) α 二值化 + halo 填补 ──
arr_out = np.asarray(canvas).copy()
arr_out[:, :, 3] = np.where(arr_out[:, :, 3] >= 128, 255, 0).astype(np.uint8)
print("halo px inpainted:", inpaint_dark(arr_out, 60))

# ── 5b) 边缘暗色抗锯齿压平（花瓣尖的暗红抗锯齿会量化为孤立深棕格） ──
fg2 = arr_out[:, :, 3] > 0
dist = ndimage.distance_transform_edt(fg2)
edge = fg2 & (dist <= 2.5)
donor2 = fg2 & (dist > 3.5)
if edge.any() and donor2.any():
    idx2 = ndimage.distance_transform_edt(~donor2, return_distances=False, return_indices=True)
    arr_out[:, :, :3] = np.where(edge[:, :, None], arr_out[idx2[0], idx2[1], :3], arr_out[:, :, :3])
    print("edge px flattened:", int(edge.sum()))

# ── 6) 4 连通主分量复检 ──
final = arr_out[:, :, 3] > 0
main2, n2 = keep_main_component(final, 10000)
arr_out[~main2] = 0
print(f"4-conn comps after: {n2} -> main only")

lf, nf = ndimage.label(arr_out[:, :, 3] > 0)
ys, xs = np.where(arr_out[:, :, 3] > 0)
print(f"final 4-conn comps: {nf} (expect 1)")
print(f"final bbox W% {(xs.max()-xs.min()+1)/w*100:.2f}  H% {(ys.max()-ys.min()+1)/h*100:.2f}")
print(f"final dark px (max<=24): {int(((arr_out[:, :, :3].max(2) <= 24) & (arr_out[:, :, 3] > 0)).sum())}")

Image.fromarray(arr_out).save(DST)
print("OK ->", DST)
