#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P08 贝壳 珠格重排（方案 A，0 次 Token Plan，用户 2026-11-26 拍板）。

v1 母版玫红 61.2%、F=119（单色过半 ⇒ 错位无解）。保留 v1 的扇贝轮廓，重排内部：
- 珍珠放大到约 12 珠格直径（r≈5.6）⇒ 奶白 ≈1/3；
- 4 条蓝纹加宽成放射楔形 ⇒ 湖蓝 ≈1/3；
- 其余留玫红 ⇒ ≈1/3；黑铰合块收小。
输出 a03p08-v1fix-s42-rgba.png。
"""
import json
import math
import os
from collections import Counter

import numpy as np
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "A03-P08-shell")
SRC = os.path.join(D, "a03p08-v1-s42-rgba.png")
DST = os.path.join(D, "a03p08-v1fix-s42-rgba.png")
RESP = os.path.join(D, "studio-full-response-v1-max-32-c0.json")

CH = "123456789ABCDEFGH"
d = json.load(open(RESP))
pal = d["paletteHex"]
rows = d["pattern"] if isinstance(d["pattern"], list) else d["pattern"].splitlines()
H = len(rows)
W = len(rows[0])
HEX = {CH[i]: h for i, h in enumerate(pal)}
IDX = {h: CH[i] for i, h in enumerate(pal)}
PINK, BLUE, CREAM, BLACK = (IDX[h] for h in ("#E84C3D", "#3D7BF5", "#FDF6E9", "#33333D"))

# 扇贝轮廓（v1 的非空单元）
shape = {(x, y) for y in range(H) for x in range(W) if rows[y][x] != ".".replace(".", rows[y][x]) and rows[y][x] != "."}
shape = {(x, y) for y in range(H) for x in range(W) if rows[y][x] != "."}

G = [["." for _ in range(W)] for _ in range(H)]
for x, y in shape:
    G[y][x] = PINK

# 珍珠：圆心 (15.5, 18.5)，r=5.6
PX, PY, PR = 15.5, 18.5, 6.8
pearl = set()
for x, y in shape:
    if (x - PX) ** 2 + (y - PY) ** 2 <= PR ** 2:
        G[y][x] = CREAM
        pearl.add((x, y))

# 蓝纹：自扇底中心 (15.5, 26.5) 的 4 条放射楔形（±18°、±48°，半宽 9°）
BX, BY = 15.5, 26.5
stripes = set()
for x, y in shape:
    if (x, y) in pearl:
        continue
    ang = math.degrees(math.atan2(x - BX, BY - y))
    for a in (-48, -18, 18, 48):
        if abs(ang - a) <= 8:
            G[y][x] = BLUE
            stripes.add((x, y))
            break

# 铰合块：黑（rows 26–28 × cols 13–18）
for y in (26, 27, 28):
    for x in range(13, 19):
        G[y][x] = BLACK

# ── 落回母版 ──
im = np.array(Image.open(SRC).convert("RGBA"))
CELL = im.shape[0] // H
for y in range(H):
    for x in range(W):
        blk = im[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL]
        c = G[y][x]
        if c == ".":
            blk[..., 3] = 0
        else:
            blk[..., 3] = 255
            blk[..., :3] = tuple(int(HEX[c][i:i + 2], 16) for i in (1, 3, 5))
Image.fromarray(im, "RGBA").save(DST)

cnt = Counter(c for row in G for c in row if c != ".")
tot = sum(cnt.values())
NAME = {PINK: "玫红", BLUE: "湖蓝", CREAM: "奶白", BLACK: "炭黑"}
for c, n in cnt.most_common():
    print(f"  {NAME[c]} {n} = {n / tot * 100:.1f}%")
for y in range(H):
    print(f"{y:2} " + "".join({PINK: "R", BLUE: "B", CREAM: "c", BLACK: "K", ".": "."}[G[y][x]] for x in range(W)))
