#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A02-P02 棕熊 v3 本地确定性修复（0 次模型调用）。

问题（2026-11-24 实测）：
  1) G9 高 88.3% 超 82% 上限（宽 79.0% 已达标）；
  2) 前腿间一条 1924px 近黑暗缝（max≤24，非宪法规格色，32×32 量化会出脏格）；
     眼鼻炭黑点睛为宪法规格色，不动。
修复：
  ① 暗缝填补：max≤30 且分量 ≥100px 的暗域 → 就地填最近非暗（max>60）主体色
     （口径沿 A01-P09 v1 修复；<100px 的眼鼻抗锯齿小碎屑保留，交 studio mode 投票）；
  ② 纵向统缩：bbox 高 88.3%→78%（ky=0.883，kx=1.0），NEAREST，居中贴纯黑 2048²。
输出 a02p02-v3fix-s42.png（供 extract-alpha 复跑六道）。
"""
import json

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = "a02p02-v3-s42-rgba.png"
DST = "a02p02-v3fix-s42.png"

im = np.asarray(Image.open(SRC)).copy()
rgb = im[:, :, :3].astype(int)
fg = im[:, :, 3] == 255
dark = fg & (rgb.max(2) <= 30)
lab, n = ndimage.label(dark)
filled = 0
for i in range(1, n + 1):
    m = lab == i
    if m.sum() < 100:
        continue
    good = fg & (rgb.max(2) > 60)
    idx = ndimage.distance_transform_edt(~good, return_distances=False, return_indices=True)
    rgb[m] = rgb[idx[0][m], idx[1][m]]
    filled += int(m.sum())
print(f"① 暗缝填补 {filled}px（≥100px 分量）")

rgb8 = rgb.astype(np.uint8)
ys, xs = np.where(fg)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
h0, w0 = y1 - y0, x1 - x0
ky = int(0.78 * 2048) / h0
kx = 1.0
tw, th = int(w0 * kx), int(h0 * ky)
crop = Image.fromarray(rgb8[y0:y1, x0:x1], "RGB").resize((tw, th), Image.NEAREST)
canvas = Image.new("RGB", (2048, 2048), "#000000")
canvas.paste(crop, ((2048 - tw) // 2, (2048 - th) // 2))
canvas.save(DST)
print(f"② 统缩 ky={ky:.4f} → bbox {tw/2048*100:.1f}×{th/2048*100:.1f}%")
json.dump({"filled_dark_px": filled, "kx": kx, "ky": round(ky, 4)},
          open("a02p02-v3fix-meta.json", "w"), ensure_ascii=False, indent=1)
