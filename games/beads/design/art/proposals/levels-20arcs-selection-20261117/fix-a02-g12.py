#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A02 G12 主导色 pattern 引导染色器。

读最新 studio 响应 pattern → 找「主导色格 且 4 邻有目标色格」的边界格
→ 按选取规则取 N 格 → 母版对应 64px 格整格 from→to 染色 → 存回。
用法：python3 fix-a02-g12.py <dir> <master_rgba> <response_json> <n_cells>
      <from_hex> <to_hex> [top|bottom|spread]
"""
import json
import sys

import numpy as np
from PIL import Image

d, master, resp, n_cells, from_hex, to_hex, mode = (
    sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]),
    sys.argv[5].lstrip("#"), sys.argv[6].lstrip("#"), sys.argv[7] if len(sys.argv) > 7 else "spread")

r = json.load(open(f"{d}/{resp}"))
pal = r["paletteHex"]
rows = r["pattern"] if isinstance(r["pattern"], list) else r["pattern"].splitlines()
fi, ti = pal.index("#" + from_hex) + 1, pal.index("#" + to_hex) + 1
N = len(rows)
grid = [[1 if ch == str(fi) else 2 if ch == str(ti) else 0 for ch in row] for row in rows]
cands = []
for gy in range(N):
    for gx in range(N):
        if grid[gy][gx] != 1:
            continue
        if any(0 <= gy+dy < N and 0 <= gx+dx < N and grid[gy+dy][gx+dx] == 2
               for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            cands.append((gx, gy))
print(f"{d}: 边界格 {len(cands)}，取 {n_cells}")
if mode == "bottom":
    cands.sort(key=lambda c: (-c[1], c[0]))
else:  # spread：沿边界均匀取样
    step = max(1, len(cands) // n_cells)
    picked = cands[::step][:n_cells]
    cands = picked
picked = cands[:n_cells]

FROM = np.array([int(from_hex[i:i+2], 16) for i in (0, 2, 4)])
TO = np.array([int(to_hex[i:i+2], 16) for i in (0, 2, 4)])
im = np.asarray(Image.open(f"{d}/{master}")).copy()
rgb = im[:, :, :3]
for gx, gy in picked:
    cell = rgb[gy*64:(gy+1)*64, gx*64:(gx+1)*64]
    m = np.abs(cell.astype(int) - FROM).sum(2) < 120
    cell[m] = TO
Image.fromarray(im, "RGBA").save(f"{d}/{master}")
print("染格", picked)
