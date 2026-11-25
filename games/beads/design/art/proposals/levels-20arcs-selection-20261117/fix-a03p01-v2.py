#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P01 小鱼 v2 修正：眼睛 2×2→3×3、清尾巴杂散炭黑珠、紫带顶边 8 格拉蓝。

输入：a03p01-v2-s42-rgba.png + studio-full-response-v2-max-32-c0.json
输出：a03p01-v2fix-s42-rgba.png（其余像素不动）
用法：python3 fix-a03p01-v2.py
"""
import json
import os

import numpy as np
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "A03-P01-fish")
SRC = os.path.join(D, "a03p01-v2-s42-rgba.png")
DST = os.path.join(D, "a03p01-v2fix-s42-rgba.png")
RESP = os.path.join(D, "studio-full-response-v2-max-32-c0.json")

PURPLE, BLUE, BLACK = (0x8E, 0x6F, 0xD9), (0x3D, 0x7B, 0xF5), (0x33, 0x33, 0x3D)

im = np.array(Image.open(SRC).convert("RGBA"))
resp = json.load(open(RESP))
pal = resp["paletteHex"]
rows = resp["pattern"] if isinstance(resp["pattern"], list) else resp["pattern"].splitlines()
idx = {h: str(i + 1) for i, h in enumerate(pal)}
black_ch = idx["#33333D"]


def paint(gx, gy, rgb, only_dark=False):
    cell = im[gy * 64:(gy + 1) * 64, gx * 64:(gx + 1) * 64]
    m = cell[..., 3] > 0
    if only_dark:
        m &= cell[..., :3].max(2) < 120
    cell[m, :3] = rgb
    im[gy * 64:(gy + 1) * 64, gx * 64:(gx + 1) * 64] = cell


# 1) 新眼 3×3：cols 6–8 × rows 11–13
EYE = {(x, y) for x in (6, 7, 8) for y in (11, 12, 13)}
for gx, gy in EYE:
    paint(gx, gy, BLACK)

# 2) 旧眼下半两格回填紫带
for gx, gy in ((6, 14), (7, 14)):
    paint(gx, gy, PURPLE)

# 3) 杂散炭黑珠 → 取 4 邻非黑多数色（并列取紫）
blacks = [(x, y) for y in range(len(rows)) for x, ch in enumerate(rows[y]) if ch == black_ch]
for gx, gy in blacks:
    if (gx, gy) in EYE:
        continue
    nb = {}
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        x, y = gx + dx, gy + dy
        if 0 <= y < len(rows) and 0 <= x < len(rows[y]) and rows[y][x] not in (".", black_ch):
            h = pal[int(rows[y][x]) - 1]
            nb[h] = nb.get(h, 0) + 1
    h = max(nb, key=nb.get) if nb else "#8E6FD9"
    paint(gx, gy, tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)), only_dark=True)
    print("清杂珠", (gx, gy), "→", h)

# 4) 紫带顶行（row 14）中上方为蓝的格，均匀取 8 格改蓝
cands = [x for x in range(32) if rows[14][x] == idx["#8E6FD9"] and 0 < x < 31
         and rows[13][x] == idx["#3D7BF5"]]
picked = [cands[round(i * (len(cands) - 1) / 7)] for i in range(8)] if len(cands) >= 8 else cands
for gx in picked:
    paint(gx, 14, BLUE)
print("紫→蓝", picked, f"({len(cands)} 候选)")

Image.fromarray(im, "RGBA").save(DST)
print("saved", DST)
