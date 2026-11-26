#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P07 螃蟹 v4（用户 2026-11-26「腿改蓝/奶白」⇒ 收回 G12 例外，0 次 Token Plan）。

相对 v3：
- 腿改色：上腿奶白、中腿湖蓝、下腿奶白（左右镜像）；
- 壳面改三横带（奶白 11–14 / 湖蓝 15–17 / 赭棕 18–21），撤掉两枚蓝斑；
- 眼、钳、接脖不动。输出 a03p07-v4-s42-rgba.png。
"""
import os
from collections import Counter

import numpy as np
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "A03-P07-crab")
SRC = os.path.join(D, "a03p07-v2-s42-rgba.png")
DST = os.path.join(D, "a03p07-v4-s42-rgba.png")

HEX = {1: "#FDF6E9", 2: "#3D7BF5", 3: "#6B3E1E", 4: "#33333D"}
CREAM, BLUE, BROWN, BLACK = 1, 2, 3, 4
NAME = {1: "奶白", 2: "湖蓝", 3: "赭棕", 4: "炭黑"}
H = W = 32
G = [["." for _ in range(W)] for _ in range(H)]


def put(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        G[y][x] = c


def mirror(x):
    return 31 - x


# 1) 壳：椭圆（16×11），三横带 奶白/湖蓝/赭棕
cx, cy, rx, ry = 15.5, 16.0, 8.0, 5.4
for y in range(H):
    for x in range(W):
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
            put(x, y, CREAM if y <= 14 else BLUE if y <= 19 else BROWN)
for x in range(9, 23):
    put(x, 21, BROWN)
# 口部奶白小块（同时把湖蓝压回 ≤35%）
for x, y in ((15, 15), (16, 15), (15, 16)):
    put(x, y, CREAM)

# 2) 双 2×2 眼（奶白带上）
for y in (12, 13):
    for x in (13, 14, 17, 18):
        put(x, y, BLACK)

# 3) 钳 + 接脖（同 v3）
CLAW = [(5, 6), (6, 6), (7, 6), (8, 6),
        (5, 7), (6, 7), (7, 7), (8, 7), (9, 7),
        (5, 8), (6, 8), (7, 8), (8, 8), (9, 8),
        (5, 9), (6, 9), (7, 9), (8, 9),
        (6, 10), (7, 10),
        (6, 11), (7, 11),
        (7, 12), (7, 13), (8, 13)]
for x, y in CLAW:
    put(x, y, BROWN)
    put(mirror(x), y, BROWN)

# 4) 六条腿：上奶白 / 中湖蓝 / 下奶白，3 格宽 × 3 步
LEGS = [
    ([(7, 17), (8, 18), (9, 19)], CREAM),
    ([(7, 19), (8, 20), (9, 21)], BLUE),
    ([(8, 21), (9, 22), (10, 23)], CREAM),
]
for path, color in LEGS:
    if color == BLUE:
        path = path[:2]  # 中腿收一步，把湖蓝压回 ≤35%
    for x, y in path:
        for k in range(3):
            put(x - k, y, color)
            put(mirror(x) + k, y, color)

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
for c, n in cnt.items():
    print(f"  {NAME[c]} {n} = {n / tot * 100:.1f}%")
for y in range(H):
    print(f"{y:2} " + "".join({1: "c", 2: "B", 3: "n", 4: "K", ".": "."}[G[y][x]] for x in range(W)))
