#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P03 海豚 v2 修正（0 次 Token Plan）：眼 3×3、清杂散深棕/炭黑、玫红压回 35% 内、填内部空洞。

输入：a03p03-v2-s42-rgba.png + studio-full-response-v2-max-32-c0.json
输出：a03p03-v2fix-s42-rgba.png（其余像素不动）
用法：python3 fix-a03p03-v2.py
"""
import json
import os
from collections import Counter

import numpy as np
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "A03-P03-dolphin")
SRC = os.path.join(D, "a03p03-v2-s42-rgba.png")
DST = os.path.join(D, "a03p03-v2fix-s42-rgba.png")
RESP = os.path.join(D, "studio-full-response-v2-max-32-c0.json")

CH = "123456789ABCDEFGH"
d = json.load(open(RESP))
pal = d["paletteHex"]
rows = d["pattern"] if isinstance(d["pattern"], list) else d["pattern"].splitlines()
G = [list(r) for r in rows]
H, W = len(G), len(G[0])
HEX = {CH[i]: h for i, h in enumerate(pal)}
IDX = {h: CH[i] for i, h in enumerate(pal)}
CREAM, RED, BLUE, BROWN, BLACK = (IDX[h] for h in ("#FDF6E9", "#E84C3D", "#3D7BF5", "#6B3E1E", "#33333D"))
EYE = {(x, y) for y in (7, 8, 9) for x in (20, 21, 22)}


def neighbors(x, y):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < W and 0 <= ny < H:
            yield nx, ny


def majority(x, y):
    c = Counter(G[ny][nx] for nx, ny in neighbors(x, y) if G[ny][nx] not in (".", BROWN, BLACK))
    return c.most_common(1)[0][0] if c else CREAM


# 0) 填内部空洞：从边界灌 '.'，灌不到的 '.' 即封闭洞 ⇒ 并邻色
seen = [[False] * W for _ in range(H)]
stack = [(x, y) for x in range(W) for y in (0, H - 1) if G[y][x] == "."]
stack += [(x, y) for y in range(H) for x in (0, W - 1) if G[y][x] == "."]
for x, y in stack:
    seen[y][x] = True
while stack:
    x, y = stack.pop()
    for nx, ny in neighbors(x, y):
        if not seen[ny][nx] and G[ny][nx] == ".":
            seen[ny][nx] = True
            stack.append((nx, ny))
holes = [(x, y) for y in range(H) for x in range(W) if G[y][x] == "." and not seen[y][x]]

# 1) 眼 3×3
for x, y in EYE:
    G[y][x] = BLACK

# 2) 杂散深棕 / 炭黑（眼外）并邻色
for y in range(H):
    for x in range(W):
        if G[y][x] in (BROWN, BLACK) and (x, y) not in EYE:
            G[y][x] = majority(x, y)

# 3) 封闭洞并邻色
for x, y in holes:
    G[y][x] = majority(x, y)

# 4) 玫红压回 ≤35%：沿 R/B 边界把红色格改蓝（自小行优先），超出的再改奶白
total = sum(1 for row in G for c in row if c != ".")
cap = int(total * 0.35)
reds = [(x, y) for y in range(H) for x in range(W) if G[y][x] == RED]

def boundary_red(cells):
    return sorted([(x, y) for x, y in cells if any(G[ny][nx] == BLUE for nx, ny in neighbors(x, y))],
                  key=lambda p: (p[1], p[0]))

need = max(0, len(reds) - cap)
for x, y in boundary_red(reds)[:need]:
    G[y][x] = BLUE

# 5) 主色若因让位越过 35%，把蓝/奶白边界格让给另一色（对称互压）
def over(c):
    n = sum(1 for row in G for v in row if v == c)
    return max(0, n - int(total * 0.35))

for src, dstc in ((BLUE, CREAM), (CREAM, BLUE)):
    for _ in range(over(src)):
        cand = sorted([(x, y) for y in range(H) for x in range(W) if G[y][x] == src
                       and any(G[ny][nx] == dstc for nx, ny in neighbors(x, y))], key=lambda p: (p[1], p[0]))
        if not cand:
            break
        x, y = cand[0]
        G[y][x] = dstc

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
Image.fromarray(im, "RGBA").save(DST)

cnt = Counter(c for row in G for c in row if c != ".")
tot = sum(cnt.values())
print("total", tot, "colors", len(cnt))
for c, n in cnt.items():
    print(f"  {HEX[c]} {n} = {n / tot * 100:.1f}%")
print("changed cells:", sum(1 for y in range(H) for x in range(W) if G[y][x] != rows[y][x]))
