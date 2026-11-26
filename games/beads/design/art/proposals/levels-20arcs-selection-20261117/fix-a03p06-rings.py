#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P06 海龟 壳面改环状（用户 2026-11-26，0 次 Token Plan）。

壳内按到壳心的归一化半径上色：外圈湖蓝 → 中环奶白 → 壳心赭棕（同心环，读作龟甲鳞片）。
壳外（头、四鳍）保持锁版 v1fix2 原色。输出 a03p06-v1fix3-s42-rgba.png。
"""
import json
import math
import os
from collections import Counter

import numpy as np
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "A03-P06-turtle")
SRC = os.path.join(D, "a03p06-v1fix2-s42-rgba.png")
DST = os.path.join(D, "a03p06-v1fix3-s42-rgba.png")
RESP = os.path.join(D, "studio-full-response-v1fix2-max-32-c0.json")

CH = "123456789ABCDEFGH"
d = json.load(open(RESP))
pal = d["paletteHex"]
rows = d["pattern"] if isinstance(d["pattern"], list) else d["pattern"].splitlines()
H, W = len(rows), len(rows[0])
G = [list(r) for r in rows]
HEX = {CH[i]: h for i, h in enumerate(pal)}
IDX = {h: CH[i] for i, h in enumerate(pal)}
CREAM, BLUE, BROWN, BLACK = (IDX[h] for h in ("#FDF6E9", "#3D7BF5", "#A5652C", "#33333D"))

CX, CY, RX, RY = 15.5, 16.0, 9.3, 8.2
for y in range(H):
    for x in range(W):
        if G[y][x] == ".":
            continue
        nx, ny = (x - CX) / RX, (y - CY) / RY
        r = math.hypot(nx, ny)
        if r <= 1.0:  # 壳内才改
            if r > 0.84:
                G[y][x] = BLUE
            elif r > 0.52:
                G[y][x] = CREAM
            else:
                G[y][x] = BROWN

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
NAME = {CREAM: "奶白", BLUE: "湖蓝", BROWN: "赭棕", BLACK: "炭黑"}
for c, n in cnt.most_common():
    print(f"  {NAME[c]} {n} = {n / tot * 100:.1f}%")
for y in range(H):
    print(f"{y:2} " + "".join({CREAM: "c", BLUE: "B", BROWN: "n", BLACK: "K", ".": "."}[G[y][x]] for x in range(W)))
