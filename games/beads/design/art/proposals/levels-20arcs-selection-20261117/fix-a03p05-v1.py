#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P05 水母 v1 修正（0 次 Token Plan）：三带重排、单眼 3×3、清杂黑、触手收短到 G9。

输入：a03p05-v1-s42-rgba.png + studio-full-response-v1-max-32-c0.json
输出：a03p05-v1fix-s42-rgba.png

改动依据（G12 色占比 / G9 包围盒）：
- 树莓/草绿均 >35%（38.9/38.6）、蓝仅 19.9% ⇒ 伞盖色带改为 蓝 1–8 行 / 奶白 9–10 / 草绿 11–12；
- 触手伸到第 29 行（高 87.5%）⇒ 截到第 26 行（81.3%）；
- 眼只 2×2 且伞盖有 6 颗杂黑 ⇒ 清杂黑、眼重画 3×3（rows 4–6 × cols 14–16）。
"""
import json
import os
from collections import Counter

import numpy as np
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "A03-P05-jellyfish")
SRC = os.path.join(D, "a03p05-v1-s42-rgba.png")
DST = os.path.join(D, "a03p05-v1fix-s42-rgba.png")
RESP = os.path.join(D, "studio-full-response-v1-max-32-c0.json")

CH = "123456789ABCDEFGH"
d = json.load(open(RESP))
pal = d["paletteHex"]
rows = d["pattern"] if isinstance(d["pattern"], list) else d["pattern"].splitlines()
G = [list(r) for r in rows]
H, W = len(G), len(G[0])
HEX = {CH[i]: h for i, h in enumerate(pal)}
IDX = {h: CH[i] for i, h in enumerate(pal)}
CREAM, GREEN, BLUE, BLACK = (IDX[h] for h in ("#FDF6E9", "#3FBF6B", "#3D7BF5", "#33333D"))


def nb(x, y):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < W and 0 <= ny < H:
            yield nx, ny


def majority(x, y):
    c = Counter(G[ny][nx] for nx, ny in nb(x, y) if G[ny][nx] != ".")
    return c.most_common(1)[0][0] if c else CREAM


# 1) 杂黑（全部）先并邻色；眼后面统一重画
for y in range(H):
    for x in range(W):
        if G[y][x] == BLACK:
            G[y][x] = majority(x, y)

# 2) 伞盖三带重排：蓝 1–8 / 奶白 9–10 / 草绿 11–12
for y in range(1, 9):
    for x in range(W):
        if G[y][x] != ".":
            G[y][x] = BLUE
for y in (9, 10):
    for x in range(W):
        if G[y][x] != ".":
            G[y][x] = CREAM
for y in (11, 12):
    for x in range(W):
        if G[y][x] != ".":
            G[y][x] = GREEN

# 3) 单眼 3×3（rows 4–6 × cols 14–16）
for y in (4, 5, 6):
    for x in (14, 15, 16):
        G[y][x] = BLACK

# 4) 触手截到第 26 行（G9：包围盒高 81.3%）
for y in (27, 28, 29, 30, 31):
    for x in range(W):
        G[y][x] = "."

# ── 落回母版（64px/格，只改 alpha>0 像素）──
im = np.array(Image.open(SRC).convert("RGBA"))
CELL = im.shape[0] // H
for y in range(H):
    for x in range(W):
        if G[y][x] == ".":
            continue
        rgb = tuple(int(HEX[G[y][x]][i:i + 2], 16) for i in (1, 3, 5))
        cell = im[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL]
        cell[cell[..., 3] > 0, :3] = rgb
        im[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = cell
# 真正截断：第 27 行起清空 alpha（否则母版残留触手，量化仍取到 29 行）
im[27 * CELL:, :, 3] = 0
Image.fromarray(im, "RGBA").save(DST)

cnt = Counter(c for row in G for c in row if c != ".")
tot = sum(cnt.values())
print("total", tot, "colors", len(cnt))
for c, n in cnt.items():
    print(f"  {HEX[c]} {n} = {n / tot * 100:.1f}%")
print("changed cells:", sum(1 for y in range(H) for x in range(W) if G[y][x] != rows[y][x]))
