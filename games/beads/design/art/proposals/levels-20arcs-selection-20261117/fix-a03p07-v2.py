#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P07 螃蟹 v2 珠格收口（0 次 Token Plan）。

v1 珠格重画版钳像触角 ⇒ 用户选 A 重抽 v2。v2 母版结构好（大壳 + 贴壳钳），
但棕仍 50.3%（腿多且碎、钳偏大、眼浮在壳顶）。本脚本：
- 钳：保留 rows 4–14 / cols 6–10（右 21–25），削掉最外一列；
- 腿：清掉 v2 的全部碎腿，重画左右各 3 条 2 格宽 × 3 步；
- 眼：2×2 移进蓝壳（rows 11–12 × cols 11–12 / 19–20）；
- 空格清 alpha。
输出 a03p07-v2fix-s42-rgba.png。
"""
import json
import os
from collections import Counter, deque

import numpy as np
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "A03-P07-crab")
SRC = os.path.join(D, "a03p07-v2-s42-rgba.png")
DST = os.path.join(D, "a03p07-v2fix-s42-rgba.png")
RESP = os.path.join(D, "studio-full-response-v2-max-32-c0.json")

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


# 1) 清黑（眼重画）与全部碎腿（rows 19 以下、以及 15–18 行的贴边碎块）
for y in range(H):
    for x in range(W):
        if G[y][x] == BLACK:
            G[y][x] = "."
for y in range(15, H):
    for x in range(W):
        if G[y][x] == BROWN:
            G[y][x] = "."

# 2) 钳收边：削掉最外一列（cols 5 / 26）
for y in range(4, 15):
    for x in (5, 26):
        if G[y][x] == BROWN:
            G[y][x] = "."

# 3) 眼移进蓝壳：rows 11–12 × cols 11–12 / 19–20
for y in (11, 12):
    for x in (11, 12, 19, 20):
        put(x, y, BLACK)

# 4) 左右各 3 条腿：2 格宽、3 步
LEGS = [
    [(8, 17), (7, 18), (6, 19), (9, 17), (8, 18), (7, 19)],
    [(7, 19), (6, 20), (5, 21), (8, 19), (7, 20), (6, 21)],
    [(8, 21), (7, 22), (6, 23), (9, 21), (8, 22), (7, 23)],
]
for leg in LEGS:
    for x, y in leg:
        put(x, y, BROWN)
        put(mirror(x), y, BROWN)

# 5) 比例收口：钳顶削平（row 4 全去、row 14 外角各去 1），腹部下延一行
for x in range(W):
    if G[4][x] == BROWN:
        G[4][x] = "."
for x, y in ((6, 14), (25, 14)):
    if G[y][x] == BROWN:
        G[y][x] = "."
for x in range(9, 23):
    put(x, 23, CREAM)

# 6) 清掉 <4 格的棕色碎块（v2 钳根残留的单格）
seen = set()
for y in range(H):
    for x in range(W):
        if G[y][x] != BROWN or (x, y) in seen:
            continue
        q = deque([(x, y)])
        seen.add((x, y))
        comp = []
        while q:
            cx, cy = q.popleft()
            comp.append((cx, cy))
            for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and G[ny][nx] == BROWN:
                    seen.add((nx, ny))
                    q.append((nx, ny))
        if len(comp) < 4:
            for cx, cy in comp:
                G[cy][cx] = "."

# ── 落回母版 ──
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
