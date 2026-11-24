#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A02-P06 刺猬 v1fix2 确定性扩色（G12：主导 214/418=51% → ≤50%）。

做法：master 里按 64px 格统计深棕覆盖；取「深棕过半 且 4 邻有赭棕过半格」的
边界格中最靠后（x 大）的 7 格，整格深棕→赭棕（刺背下缘后段微升，视觉不可察）。
⇒ 主导 214→207 ≤ floor(418/2)=209，mis=max 下 F=0 可达。
"""
import numpy as np
from PIL import Image

DKBROWN = np.array([107, 62, 30])
OCHRE = np.array([165, 101, 44])
p = "a02p06-v1fix2-s42-rgba.png"
im = np.asarray(Image.open(p)).copy()
rgb = im[:, :, :3]  # ⚠ 直写视图（astype 会复制导致染色不落盘，已踩坑）
rgbint = rgb.astype(int)
fg = im[:, :, 3] == 255
dk = (np.abs(rgb - DKBROWN).sum(2) < 90) & fg
oc = (np.abs(rgb - OCHRE).sum(2) < 90) & fg
CELL = 64
N = 32
grid_dk = np.zeros((N, N), int)
grid_oc = np.zeros((N, N), int)
for gy in range(N):
    for gx in range(N):
        grid_dk[gy, gx] = dk[gy*64:(gy+1)*64, gx*64:(gx+1)*64].sum()
        grid_oc[gy, gx] = oc[gy*64:(gy+1)*64, gx*64:(gx+1)*64].sum()
dk_cells = grid_dk > 2048
oc_cells = grid_oc > 2048
cands = []
for gy in range(N):
    for gx in range(N):
        if not dk_cells[gy, gx]:
            continue
        neigh_oc = any(0 <= gy+dy < N and 0 <= gx+dx < N and oc_cells[gy+dy, gx+dx]
                       for dx, dy in ((1, 0), (-1, 0), (0, 1)))
        if neigh_oc:
            cands.append((gx, gy))
cands.sort(key=lambda c: (-c[0], c[1]))  # 最靠后优先
picked = cands[:7]
print("染赭棕格：", picked)
for gx, gy in picked:
    cell = rgb[gy*64:(gy+1)*64, gx*64:(gx+1)*64]
    m = (np.abs(cell - DKBROWN).sum(2) < 90)
    cell[m] = OCHRE
Image.fromarray(im, "RGBA").save(p)
print("→ 已写回", p)
