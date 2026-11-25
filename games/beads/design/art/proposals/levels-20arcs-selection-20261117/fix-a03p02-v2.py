#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P02 小鲸 v2 → v2fix 几何修复（0 次 Token Plan）。

v2 读数：bbox 84.8%×57.4%，右留白 6.4%（<8% 硬门）；32×32 后眼睛仅 1 珠、
黄 39.4%（>35%）、底空 8 行、喷柱 2 珠宽。
本脚本：主体 bbox 裁切 → NEAREST 横压 0.90 / 纵拉 1.25 → 原位贴回（上留白 12.5%）
        → 喷柱加宽到 192px（3 珠格）→ 合成纯黑底交 extract-alpha.py 重取 alpha。
用法：python3 fix-a03p02-v2.py
"""
import os

import numpy as np
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
SUB = os.path.join(D, "A03-P02-whale")
SX, SY = 0.90, 1.25
TOP = 0.125
SPOUT_W = 192  # 3 珠格

im = Image.open(os.path.join(SUB, "a03p02-v2-s42-rgba.png")).convert("RGBA")
arr = np.asarray(im)
alpha = arr[:, :, 3]
ys, xs = np.where(alpha > 0)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
crop = im.crop((x0, y0, x1, y1))
cw, ch = crop.size
nw, nh = round(cw * SX), round(ch * SY)
small = crop.resize((nw, nh), Image.NEAREST)

canvas = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
px, py = round((2048 - nw) / 2), round(TOP * 2048)
canvas.paste(small, (px, py))
out = np.asarray(canvas).copy()
rgb = out[:, :, :3].astype(int)

BLUE = np.array([0x3D, 0x7B, 0xF5])
CREAM = np.array([0xFD, 0xF6, 0xE9])
blue = (np.abs(rgb - BLUE).sum(2) < 30) & (out[:, :, 3] > 0)
cream = (np.abs(rgb - CREAM).sum(2) < 30) & (out[:, :, 3] > 0)
blue_top = np.where(blue)[0].min()
subj_top = np.where(out[:, :, 3] > 0)[0].min()
spout = cream.copy()
spout[blue_top:, :] = False
sy_, sx_ = np.where(spout)
cx = int((sx_.min() + sx_.max()) / 2)
half = SPOUT_W // 2
for y in range(subj_top, blue_top):
    out[y, cx - half:cx + half, :3] = CREAM
    out[y, cx - half:cx + half, 3] = 255
print(f"主体 {cw}x{ch} → {nw}x{nh}；贴 (x={px}, y={py})；喷柱蓝顶 y={blue_top} 顶 y={subj_top} 中心 x={cx} 宽 {SPOUT_W}")

rgba = Image.fromarray(out, "RGBA")
flat = Image.new("RGB", rgba.size, (0, 0, 0))
flat.paste(rgba, (0, 0), rgba)
flat.save(os.path.join(SUB, "a03p02-v2fix-flat.png"))
print("→ a03p02-v2fix-flat.png（纯黑底，待 extract-alpha）")
