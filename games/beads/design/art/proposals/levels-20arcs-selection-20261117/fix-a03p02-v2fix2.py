#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P02 小鲸 v2fix2 → v2fix3 收口（0 次 Token Plan）。

v2fix2 读数：黄 35.5%（越 0.5）、深棕杂珠 1 颗（row25 col16）。
本脚本：① (25,16) 深棕→柠黄；② rows19 cols21–23 黄→奶白（黄 113→111=34.9%，奶白 104→107=33.6%）。
用法：python3 fix-a03p02-v2fix2.py
"""
import os

import numpy as np
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
SUB = os.path.join(D, "A03-P02-whale")

im = Image.open(os.path.join(SUB, "a03p02-v2fix2-s42-rgba.png")).convert("RGBA")
arr = np.asarray(im).copy()
alpha = arr[:, :, 3]
cell = arr.shape[1] // 32


def fill(r, c, hexv):
    rgb = np.array([int(hexv[i:i + 2], 16) for i in (0, 2, 4)])
    blk = arr[r * cell:(r + 1) * cell, c * cell:(c + 1) * cell]
    a = alpha[r * cell:(r + 1) * cell, c * cell:(c + 1) * cell]
    blk[a > 0, :3] = rgb


fill(25, 16, "FFD23F")
for c in (21, 22, 23):
    fill(19, c, "FDF6E9")
print("已改：深棕珠→黄；rows19 cols21–23→奶白")

out = Image.fromarray(arr, "RGBA")
flat = Image.new("RGB", out.size, (0, 0, 0))
flat.paste(out, (0, 0), out)
flat.save(os.path.join(SUB, "a03p02-v2fix3-flat.png"))
print("→ a03p02-v2fix3-flat.png")
