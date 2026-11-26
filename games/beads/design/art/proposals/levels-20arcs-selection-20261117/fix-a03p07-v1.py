#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P07 螃蟹 珠格重画（0 次 Token Plan）。

v1 母版不可用：棕 62.2%（>35）、F=110（棕色过半导致错位无解）、眼悬在壳外。
做法：保留 AI 的蓝/奶白壳形，清空全部棕，按设计重画「4×4 小钳 + 2 格宽臂 + 3 条 2 格宽腿」，
眼改 2×2 落在蓝壳内。输出 a03p07-v1fix-s42-rgba.png（未覆盖区域 alpha 清零）。
"""
import json
import os
from collections import Counter

import numpy as np
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "A03-P07-crab")
SRC = os.path.join(D, "a03p07-v1-s42-rgba.png")
DST = os.path.join(D, "a03p07-v1fix-s42-rgba.png")
RESP = os.path.join(D, "studio-full-response-v1-max-32-c0.json")

CH = "123456789ABCDEFGH"
d = json.load(open(RESP))
pal = d["paletteHex"]
rows = d["pattern"] if isinstance(d["pattern"], list) else d["pattern"].splitlines()
G = [list(r) for r in rows]
H, W = len(G), len(G[0])
HEX = {CH[i]: h for i, h in enumerate(pal)}
IDX = {h: CH[i] for i, h in enumerate(pal)}
CREAM, BLUE, BROWN, BLACK = (IDX[h] for h in ("#FDF6E9", "#3D7BF5", "#6B3E1E", "#33333D"))


def put(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        G[y][x] = c


def mirror(x):
    return 31 - x


# 1) 清空全部棕色与黑（保留 AI 的蓝/奶白壳形）
for y in range(H):
    for x in range(W):
        if G[y][x] in (BROWN, BLACK):
            G[y][x] = "."

# 2) 双 2×2 眼（蓝壳内，rows 12–13 × cols 11–12 / 19–20）
for y in (12, 13):
    for x in (11, 12, 19, 20):
        put(x, y, BLACK)

# 3) 钳：4×4 小钳（带 1 格缺口）+ 2 格宽臂，左右镜像
CLAW = [(3, 5), (4, 5), (5, 5), (6, 5),
        (3, 6), (4, 6), (5, 6),
        (4, 7), (5, 7), (6, 7),
        (5, 8), (6, 8)]
ARM = [(5, 9), (6, 9), (7, 9), (7, 10), (8, 10), (8, 11), (9, 11), (9, 12)]
for group in (CLAW, ARM):
    for x, y in group:
        put(x, y, BROWN)
        put(mirror(x), y, BROWN)

# 4) 六条腿：2 格宽、4 步，向下外张，基部贴壳
LEGS = [
    [(8, 17), (7, 18), (6, 19), (5, 20), (9, 17), (8, 18), (7, 19), (6, 20)],
    [(8, 19), (7, 20), (6, 21), (5, 22), (9, 19), (8, 20), (7, 21), (6, 22)],
    [(9, 21), (8, 22), (7, 23), (6, 24), (10, 21), (9, 22), (8, 23), (7, 24)],
]
for leg in LEGS:
    for x, y in leg:
        put(x, y, BROWN)
        put(mirror(x), y, BROWN)

# 5) 比例收口：腹部下延一行（奶白 9–22），并削掉钳的最外上角 2 格
for x in range(9, 23):
    put(x, 24, CREAM)
for x, y in ((3, 5), (mirror(3), 5)):
    put(x, y, ".")

# ── 落回母版：非空格整格涂色并置 alpha=255；空格清 alpha ──
im = np.array(Image.open(SRC).convert("RGBA"))
CELL = im.shape[0] // H
for y in range(H):
    for x in range(W):
        blk = im[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL]
        if G[y][x] == ".":
            blk[..., 3] = 0
        else:
            blk[..., 3] = 255
            blk[..., :3] = tuple(int(HEX[G[y][x]][i:i + 2], 16) for i in (1, 3, 5))
Image.fromarray(im, "RGBA").save(DST)

cnt = Counter(c for row in G for c in row if c != ".")
tot = sum(cnt.values())
print("total", tot, "colors", len(cnt))
for c, n in cnt.items():
    print(f"  {HEX[c]} {n} = {n / tot * 100:.1f}%")
