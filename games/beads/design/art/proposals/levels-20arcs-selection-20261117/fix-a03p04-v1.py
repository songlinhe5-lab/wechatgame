#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P04 章鱼 v1 修正（0 次 Token Plan）：双 3×3 眼、清杂散棕、并碎块、橙压回 35%。

输入：a03p04-v1-s42-rgba.png + studio-full-response-v1-max-32-c0.json
输出：a03p04-v1fix-s42-rgba.png
"""
import json
import os
from collections import Counter, deque

import numpy as np
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "A03-P04-octopus")
SRC = os.path.join(D, "a03p04-v1-s42-rgba.png")
DST = os.path.join(D, "a03p04-v1fix-s42-rgba.png")
RESP = os.path.join(D, "studio-full-response-v1-max-32-c0.json")

CH = "123456789ABCDEFGH"
d = json.load(open(RESP))
pal = d["paletteHex"]
rows = d["pattern"] if isinstance(d["pattern"], list) else d["pattern"].splitlines()
G = [list(r) for r in rows]
H, W = len(G), len(G[0])
HEX = {CH[i]: h for i, h in enumerate(pal)}
IDX = {h: CH[i] for i, h in enumerate(pal)}
CREAM, ORANGE, BLUE, BLACK = (IDX[h] for h in ("#FDF6E9", "#F59B23", "#3D7BF5", "#33333D"))
MAIN = {CREAM, ORANGE, BLUE, BLACK}
EYES = [(x, y) for y in (14, 15) for x in (12, 13, 18, 19)]


def nb(x, y):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < W and 0 <= ny < H:
            yield nx, ny


def majority(x, y, allowed):
    c = Counter(G[ny][nx] for nx, ny in nb(x, y) if G[ny][nx] in allowed and G[ny][nx] != ".")
    return c.most_common(1)[0][0] if c else CREAM


# 1) 杂散色（不在四主色内）与眼外黑点并邻色
for y in range(H):
    for x in range(W):
        if G[y][x] == ".":
            continue
        if G[y][x] not in MAIN or (G[y][x] == BLACK and (x, y) not in EYES):
            G[y][x] = majority(x, y, MAIN - {G[y][x]})

# 2) 小连通块（<3 格）并入邻色，直到稳定
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
            if col != BLACK and len(comp) < 3:
                for cx, cy in comp:
                    G[cy][cx] = majority(cx, cy, MAIN - {col})
                moved += 1
    if not moved:
        break

# 3) 双 2×2 小眼（用户 2026-11-25「眼小一点」）：先抹回奶白，再落新眼
for y in (13, 14, 15):
    for x in (12, 13, 14, 17, 18, 19):
        G[y][x] = CREAM
for y in (14, 15):
    for x in (12, 13, 18, 19):
        G[y][x] = BLACK

# 4) 橙压回 ≤35%：优先把靠中线的橙格并给奶白（恢复「中央 2 条奶白腕」意图）
total = sum(1 for row in G for c in row if c != ".")
cap = int(total * 0.35) - 8
oranges = [(x, y) for y in range(H) for x in range(W) if G[y][x] == ORANGE]
need = max(0, len(oranges) - cap)
for _ in range(need):
    cand = [(abs(x - 15.5), -y, x, y) for y in range(H) for x in range(W)
            if G[y][x] == ORANGE and any(G[ny][nx] == CREAM for nx, ny in nb(x, y))]
    if not cand:
        break
    cand.sort()
    _, _, x, y = cand[0]
    G[y][x] = CREAM

# 4b) 奶白因缩眼冲到 35% 上方 ⇒ 沿腕基边界让给橙（保持两主色都 ≤35%）
creams = [(x, y) for y in range(H) for x in range(W) if G[y][x] == CREAM]
need_c = max(0, len(creams) - int(total * 0.35) + 2)
for _ in range(need_c):
    cand = sorted([(-y, -abs(x - 15.5), x, y) for y in range(H) for x in range(W)
                   if G[y][x] == CREAM and any(G[ny][nx] == ORANGE for nx, ny in nb(x, y))])
    if not cand:
        break
    _, _, x, y = cand[0]
    G[y][x] = ORANGE

# 5) 腕细分（用户 2026-11-25「腕再细分一点」）：左右镜像各切 2 道 2 格深槽
NOTCHES = [(6, 18), (7, 18), (8, 21), (9, 22)]
NOTCHES += [(31 - x, y) for x, y in NOTCHES]
for x, y in NOTCHES:
    if G[y][x] == ORANGE:
        G[y][x] = "."

# 6) 填封闭洞
seen = [[False] * W for _ in range(H)]
stack = [(x, y) for x in range(W) for y in (0, H - 1) if G[y][x] == "."]
stack += [(x, y) for y in range(H) for x in (0, W - 1) if G[y][x] == "."]
for x, y in stack:
    seen[y][x] = True
while stack:
    x, y = stack.pop()
    for nx, ny in nb(x, y):
        if not seen[ny][nx] and G[ny][nx] == ".":
            seen[ny][nx] = True
            stack.append((nx, ny))
for y in range(H):
    for x in range(W):
        if G[y][x] == "." and not seen[y][x]:
            G[y][x] = majority(x, y, MAIN)

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
