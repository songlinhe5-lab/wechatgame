#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P07 螃蟹 珠格重排 v3（0 次 Token Plan，用户 2026-11-26 令）。

用户令：身子小一点、腿大一点粗一点、身子颜色图案改变一下。
做法：壳缩到 16×11 并改为「奶白上 / 湖蓝下 + 两枚蓝色 2×2 圆斑」；腿加粗到 3 格宽 × 3 步；
钳沿用 v2 位置内收贴壳。输出 a03p07-v3-s42-rgba.png。
"""
import json
import os
from collections import Counter

import numpy as np
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "A03-P07-crab")
SRC = os.path.join(D, "a03p07-v2-s42-rgba.png")
DST = os.path.join(D, "a03p07-v3-s42-rgba.png")

HM = {"#FDF6E9": 1, "#3D7BF5": 2, "#6B3E1E": 3, "#33333D": 4}
CREAM, BLUE, BROWN, BLACK = 1, 2, 3, 4
H = W = 32
G = [["." for _ in range(W)] for _ in range(H)]


def put(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        G[y][x] = c


def mirror(x):
    return 31 - x


# 1) 壳：椭圆（rows 11–21，cols 8–23），奶白上 / 湖蓝下
cx, cy, rx, ry = 15.5, 16.0, 8.0, 5.4
for y in range(H):
    for x in range(W):
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
            put(x, y, CREAM if y <= 16 else BLUE)
# 壳底再落一行蓝，保证蓝带厚度
for x in range(9, 23):
    put(x, 21, BLUE)

# 2) 蓝斑：奶白区上两枚 2×2（rows 14–15 × cols 10–11 / 20–21）
for y in (14, 15):
    for x in (10, 11, 20, 21):
        put(x, y, BLUE)

# 3) 双 2×2 眼（rows 12–13 × cols 13–14 / 17–18）
for y in (12, 13):
    for x in (13, 14, 17, 18):
        put(x, y, BLACK)

# 4) 钳：贴壳的上侧大块（rows 5–12，cols 5–9 / 22–26），内侧留缺口
CLAW = [(5, 6), (6, 6), (7, 6), (8, 6),
        (5, 7), (6, 7), (7, 7), (8, 7), (9, 7),
        (5, 8), (6, 8), (7, 8), (8, 8), (9, 8),
        (5, 9), (6, 9), (7, 9), (8, 9),
        (6, 10), (7, 10),
        (6, 11), (7, 11),
        (7, 12)]
for x, y in CLAW:
    put(x, y, BROWN)
    put(mirror(x), y, BROWN)
# 钳与壳的接脖：补两格到壳的上侧边缘（否则钳悬空）
for x, y in ((7, 12), (7, 13), (8, 13)):
    put(x, y, BROWN)
    put(mirror(x), y, BROWN)

# 5) 腿：左右各 3 条，3 格宽 × 3 步
LEGS = [
    [(7, 17), (8, 18), (9, 19)],
    [(7, 19), (8, 20), (9, 21)],
    [(8, 21), (9, 22), (10, 23)],
]
for leg in LEGS:
    for x, y in leg:
        for k in range(3):
            put(x - k, y, BROWN)
            put(mirror(x) + k, y, BROWN)

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
            hexv = [h for h, idx in HM.items() if idx == c][0]
            blk[..., :3] = tuple(int(hexv[i:i + 2], 16) for i in (1, 3, 5))
Image.fromarray(im, "RGBA").save(DST)

cnt = Counter(c for row in G for c in row if c != ".")
tot = sum(cnt.values())
NAME = {1: "奶白", 2: "湖蓝", 3: "赭棕", 4: "炭黑"}
for c, n in cnt.items():
    print(f"  {NAME[c]} {n} = {n / tot * 100:.1f}%")
for y in range(H):
    print(f"{y:2} " + "".join({1: "c", 2: "B", 3: "n", 4: "K", ".": "."}[G[y][x]] for x in range(W)))
