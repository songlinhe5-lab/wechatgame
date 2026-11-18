#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性：A01-P03 v1 分段仿射确定性修复（用户 2026-11-18 批准，0 次模型调用）。
v1 形态完美（三瓣杯/双缺口/棕底带/上挑双叶）但整体过窄：杯34.2%/叶span31.4%/茎3.32%/高87.3%。
实测边界：杯顶y135、杯/带界y800、带底y861、叶带y1040..1600（含叶基并茎合并区）、株底y1923、cx=1022。
分段仿射逆映射（NEAREST 色值搬运）：
  杯区  纵×1.3（顶锚定）横×1.23；棕带区 纵×3 横×1.23（保≥1格防色数3被拦）；
  下段  纵×0.81；叶带行 横×2.56（叶分支锚定茎缘 src34 保零缝）、茎列(|dx|<=8.3%) 横×5；非叶行仅茎列。
去噪 <1 格漂浮域；自适应统缩（最大轴>82%→78%，关于 bbox 中心并居中）。
产物覆盖 a01p03-v1-s42-rgba.png（原件留 -rgba-orig.png），metrics 落 -fix-metrics.json。
判据正本：../series-spec.md §2 G3/G7/G9 + G11；P02 分段修复同族（fix-a01p02-piecewise.py）。"""
import json
import os
from collections import deque

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P03-tulip")
SRC = os.path.join(BATCH, "a01p03-v1-s42-rgba.png")
CELL_PX = 128 ** 2
TARGET = 0.78

a = np.asarray(Image.open(SRC).convert("RGBA")).copy()
h, w = a.shape[:2]
Image.fromarray(a, "RGBA").save(SRC.replace(".png", "-orig.png"))
colors_before = set(map(tuple, a[a[:, :, 3] == 255][:, :3]))

CX = 1022.0
Y_TOP, Y_CUP, Y_BAND = 135.0, 800.0, 861.0
LEAF_Y0, LEAF_Y1 = 1040.0, 1600.0  # 1600 = 叶基并茎合并区终点（1525 会切断连接致单连通 False）
KV_CUP, KV_BAND, KV_LOW = 1.3, 3.0, 0.81
KH_CUP, KH_LEAF, KH_STEM = 1.23, 2.56, 5.0
STEM_HALF = 0.083 * w
STEM_HALF_SRC = 34.0  # 原茎半宽实测；叶分支锚定茎缘保零缝连接
B1 = Y_TOP + (Y_CUP - Y_TOP) * KV_CUP          # 杯/带界（输出空间）
B2 = B1 + (Y_BAND - Y_CUP) * KV_BAND           # 带/下段界

yy, xx = np.mgrid[0:h, 0:w]
dx = xx - CX
sx = np.full((h, w), -1.0)
sy = np.full((h, w), -1.0)

cup = yy < B1
sx[cup] = CX + dx[cup] / KH_CUP
sy[cup] = Y_TOP + (yy[cup] - Y_TOP) / KV_CUP
band = (yy >= B1) & (yy < B2)
sx[band] = CX + dx[band] / KH_CUP
sy[band] = Y_CUP + (yy[band] - B1) / KV_BAND
low = yy >= B2
src_y = Y_BAND + (yy - B2) / KV_LOW
stem_col = np.abs(dx) <= STEM_HALF
leaf_row = (src_y >= LEAF_Y0) & (src_y <= LEAF_Y1)
m = low & leaf_row & ~stem_col
adx = np.abs(dx[m])
sx[m] = CX + np.sign(dx[m]) * (STEM_HALF_SRC + (adx - STEM_HALF) / KH_LEAF)
sy[m] = src_y[m]
m = low & leaf_row & stem_col
sx[m] = CX + dx[m] / KH_STEM
sy[m] = src_y[m]
m = low & ~leaf_row & stem_col
sx[m] = CX + dx[m] / KH_STEM
sy[m] = src_y[m]

ok = (sx >= 0) & (sy >= 0)
sxi = np.round(np.where(ok, sx, 0)).astype(int)
syi = np.round(np.where(ok, sy, 0)).astype(int)
ok &= (sxi < w) & (syi < h)
out = np.zeros((h, w, 4), dtype=np.uint8)
out[ok] = a[syi[ok], sxi[ok]]
out[:, :, :3][out[:, :, 3] == 0] = 0
a = out
fg = a[:, :, 3] == 255

# 去噪：<1 格漂浮连通域置透明
seen = np.zeros((h, w), bool)
removed = []
for sy0 in range(h):
    for sx0 in np.where(fg[sy0] & ~seen[sy0])[0]:
        if seen[sy0, sx0]:
            continue
        q = deque([(sy0, sx0)])
        seen[sy0, sx0] = True
        pix = []
        while q:
            y, x = q.popleft()
            pix.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and fg[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        if len(pix) < CELL_PX:
            for y, x in pix:
                a[y, x] = (0, 0, 0, 0)
            removed.append(len(pix))
fg = a[:, :, 3] == 255

# 自适应统缩 + 居中
ys, xs = np.where(fg)
bcx, bcy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
bw, bh = (xs.max() - xs.min() + 1) / w, (ys.max() - ys.min() + 1) / h
scale = 1.0
if max(bw, bh) > 0.82:
    scale = TARGET / max(bw, bh)
    sxf = np.round(bcx + (xx - w / 2) / scale).astype(int)
    syf = np.round(bcy + (yy - h / 2) / scale).astype(int)
    ok2 = (sxf >= 0) & (sxf < w) & (syf >= 0) & (syf < h)
    out2 = np.zeros((h, w, 4), dtype=np.uint8)
    out2[ok2] = a[syf[ok2], sxf[ok2]]
    out2[:, :, :3][out2[:, :, 3] == 0] = 0
    a = out2
    fg = a[:, :, 3] == 255

colors_after = set(map(tuple, a[fg][:, :3]))
assert colors_after <= colors_before, f"出现新色值: {colors_after - colors_before}"

Image.fromarray(a, "RGBA").save(SRC)
ys, xs = np.where(fg)
info = {
    "kv": [KV_CUP, KV_BAND, KV_LOW],
    "kh": [KH_CUP, KH_LEAF, KH_STEM],
    "noise_components_removed": removed,
    "scale": round(scale, 4),
    "bbox_pct": [round((xs.max() - xs.min() + 1) / w * 100, 2), round((ys.max() - ys.min() + 1) / h * 100, 2)],
    "margins_pct": [round(xs.min() / w * 100, 2), round(ys.min() / h * 100, 2),
                    round((w - 1 - xs.max()) / w * 100, 2), round((h - 1 - ys.max()) / h * 100, 2)],
    "fg_px": int(fg.sum()),
    "colors_kept": len(colors_after),
}
json.dump(info, open(os.path.join(BATCH, "a01p03-v1-fix-metrics.json"), "w"), ensure_ascii=False, indent=2)
print(json.dumps(info, ensure_ascii=False, indent=2))