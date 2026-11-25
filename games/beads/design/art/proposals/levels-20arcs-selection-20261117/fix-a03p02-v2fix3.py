#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P02 小鲸 v2fix3 → v2fix4：清旧眼残弧（0 次 Token Plan）。

v2fix3 珠阵已达标（奶白33.6/柠黄34.9/湖蓝28.6/炭黑2.8，blocks6 tiny0 F0），
但母版目视发现旧眼左侧残弧未清尽（原眼横跨 cols6–7，前一轮只并了 col7）。
本脚本：rows17–18 × col6 并柠黄。珠阵应保持不变。
用法：python3 fix-a03p02-v2fix3.py
"""
import os

import numpy as np
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
SUB = os.path.join(D, "A03-P02-whale")

im = Image.open(os.path.join(SUB, "a03p02-v2fix3-s42-rgba.png")).convert("RGBA")
arr = np.asarray(im).copy()
alpha = arr[:, :, 3]
cell = arr.shape[1] // 32
rgb = np.array([0xFF, 0xD2, 0x3F])

for r in (17, 18):
    blk = arr[r * cell:(r + 1) * cell, 6 * cell:7 * cell]
    a = alpha[r * cell:(r + 1) * cell, 6 * cell:7 * cell]
    blk[a > 0, :3] = rgb
print("已改：rows17–18 col6 → 柠黄")

out = Image.fromarray(arr, "RGBA")
flat = Image.new("RGB", out.size, (0, 0, 0))
flat.paste(out, (0, 0), out)
flat.save(os.path.join(SUB, "a03p02-v2fix4-flat.png"))
print("→ a03p02-v2fix4-flat.png")
