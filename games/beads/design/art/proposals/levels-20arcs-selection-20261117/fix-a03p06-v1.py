#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P06 海龟 v1 修正（0 次 Token Plan）：清杂色、头加宽落双 2×2 眼、蓝压回 35%。

输入：a03p06-v1-s42-rgba.png + studio-full-response-v1-max-32-c0.json
输出：a03p06-v1fix-s42-rgba.png
"""
import json
import os
from collections import Counter, deque

import numpy as np
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "A03-P06-turtle")
SRC = os.path.join(D, "a03p06-v1-s42-rgba.png")
DST = os.path.join(D, "a03p06-v1fix-s42-rgba.png")
RESP = os.path.join(D, "studio-full-response-v1-max-32-c0.json")

CH = "123456789ABCDEFGH"
d = json.load(open(RESP))
pal = d["paletteHex"]
rows = d["pattern"] if isinstance(d["pattern"], list) else d["pattern"].splitlines()
G = [list(r) for r in rows]
H, W = len(G), len(G[0])
HEX = {CH[i]: h for i, h in enumerate(pal)}
IDX = {h: CH[i] for i, h in enumerate(pal)}
CREAM, BROWN, BLUE, BLACK = (IDX[h] for h in ("#FDF6E9", "#A5652C", "#3D7BF5", "#33333D"))
MAIN = {CREAM, BROWN, BLUE, BLACK}
EYES = [(x, y) for y in (25, 26) for x in (13, 14, 17, 18)]


def nb(x, y):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < W and 0 <= ny < H:
            yield nx, ny


def majority(x, y, deny):
    c = Counter(G[ny][nx] for nx, ny in nb(x, y) if G[ny][nx] in MAIN and G[ny][nx] not in deny)
    return c.most_common(1)[0][0] if c else CREAM


# 1) 杂色（#6B3E1E）与眼外黑点并邻色
for y in range(H):
    for x in range(W):
        if G[y][x] == "." or (x, y) in EYES:
            continue
        if G[y][x] not in MAIN or G[y][x] == BLACK:
            G[y][x] = majority(x, y, {G[y][x]})

# 2) 头加宽到 6 格（rows 25–26 × cols 13–18），为双 2×2 眼留中间 2 格缺口
for y in (25, 26):
    for x in (13, 18):
        G[y][x] = BLUE

# 3) 双 2×2 眼
for x, y in EYES:
    G[y][x] = BLACK

# 4) 蓝压回 ≤35%：把最外侧的蓝鳍尖让给奶白
total = sum(1 for row in G for c in row if c != ".")
blues = [(x, y) for y in range(H) for x in range(W) if G[y][x] == BLUE]
need = max(0, len(blues) - int(total * 0.35) + 3)
for _, _, x, y in sorted([(-abs(x - 15.5), y, x, y) for x, y in blues])[:need]:
    G[y][x] = CREAM

# 5) 碎块（<4 格，眼除外）并邻色：清掉模型多画的漂浮鳍尖
for _ in range(6):
    seen = set()
    moved = 0
    for y in range(H):
        for x in range(W):
            if G[y][x] == "." or (x, y) in seen:
                continue
            col = G[y][x]
            q = deque([(x, y)])
            seen.add((x, y))
            comp = []
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                for nx, ny in nb(cx, cy):
                    if (nx, ny) not in seen and G[ny][nx] == col:
                        seen.add((nx, ny))
                        q.append((nx, ny))
            if col != BLACK and len(comp) < 4:
                for cx, cy in comp:
                    G[cy][cx] = majority(cx, cy, {col})
                moved += 1
    if not moved:
        break

# ── 落回母版（64px/格）──
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
# 新长出的格子（原母版 alpha=0，如加宽的头）从邻格拷 alpha 再上色
for y in range(H):
    for x in range(W):
        if G[y][x] == ".":
            continue
        cell = im[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL]
        if not (cell[..., 3] > 0).any():
            for nx, ny in nb(x, y):
                src = im[ny * CELL:(ny + 1) * CELL, nx * CELL:(nx + 1) * CELL]
                if (src[..., 3] > 0).any():
                    cell[..., 3] = src[..., 3]
                    cell[..., :3] = tuple(int(HEX[G[y][x]][i:i + 2], 16) for i in (1, 3, 5))
                    break
        im[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = cell
Image.fromarray(im, "RGBA").save(DST)
# 用户 2026-11-25 令「头朝上，翻转整张盘」：整幅上下翻转另存一版
Image.fromarray(np.flipud(im), "RGBA").save(DST.replace("v1fix-s42", "v1fix2-s42"))

cnt = Counter(c for row in G for c in row if c != ".")
tot = sum(cnt.values())
print("total", tot, "colors", len(cnt))
for c, n in cnt.items():
    print(f"  {HEX[c]} {n} = {n / tot * 100:.1f}%")
print("changed cells:", sum(1 for y in range(H) for x in range(W) if G[y][x] != rows[y][x]))
