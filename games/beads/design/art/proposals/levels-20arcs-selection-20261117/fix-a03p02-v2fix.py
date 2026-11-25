#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P02 小鲸 v2fix → v2fix2 珠格级修复（0 次 Token Plan）。

v2fix 读数：几何已达标（bbox 76.3%×71.8%、均值 74.0、四边留白 11.8/12.5/11.9/15.7）；
但黄 40.3%（>35%）、炭黑仅 0.9%、眼睛 2 珠、4 颗杂色珠（紫/赭/深棕/炭黑各 1）。
本脚本在母版 64px 格上——① 眼重画 3×3（rows12–14 × cols6–8，全落湖蓝区）；
② 旧眼 2 珠并黄；③ 杂珠并邻色（紫→蓝、炭黑→蓝、深棕→黄）；
④ 黄带底行 rows19 cols3–20 改奶白（黄 40.3→34.6，奶白 27.0→32.7）。
用法：python3 fix-a03p02-v2fix.py
"""
import json
import os

import numpy as np
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
SUB = os.path.join(D, "A03-P02-whale")
C = {"cream": "FDF6E9", "yellow": "FFD23F", "blue": "3D7BF5", "dark": "33333D"}

pat = json.load(open(os.path.join(SUB, "studio-full-response-v2fix-max-32-c0.json")))
pal = pat["paletteHex"]
rows = pat["pattern"]
idxs = {hexv.upper(): i for i, hexv in enumerate(pal)}

im = Image.open(os.path.join(SUB, "a03p02-v2fix-s42-rgba.png")).convert("RGBA")
arr = np.asarray(im).copy()
h, w = arr.shape[:2]
cell = w // 32
alpha = arr[:, :, 3]


def fill(r, c, hexv):
    rgb = np.array([int(hexv[i:i + 2], 16) for i in (0, 2, 4)])
    blk = arr[r * cell:(r + 1) * cell, c * cell:(c + 1) * cell]
    a = alpha[r * cell:(r + 1) * cell, c * cell:(c + 1) * cell]
    blk[a > 0, :3] = rgb


# ① 新眼 3×3
for r in range(12, 15):
    for c in range(6, 9):
        fill(r, c, C["dark"])
# ② 旧眼 2 珠并黄
for r in (17, 18):
    fill(r, 7, C["yellow"])
# ③ 杂珠并邻色
fill(14, 19, C["blue"])   # 紫
fill(11, 17, C["blue"])   # 炭黑杂珠
fill(25, 17, C["yellow"])  # 深棕
# ④ 黄带底行（躯干段 cols3–20）改奶白；(19,3) 赭珠一并覆盖
for c in range(3, 21):
    fill(19, c, C["cream"])

print("已改：眼3×3、旧眼→黄、紫/炭黑→蓝、深棕→黄、rows19 cols3–20→奶白")

out = Image.fromarray(arr, "RGBA")
flat = Image.new("RGB", out.size, (0, 0, 0))
flat.paste(out, (0, 0), out)
flat.save(os.path.join(SUB, "a03p02-v2fix2-flat.png"))
print("→ a03p02-v2fix2-flat.png")
