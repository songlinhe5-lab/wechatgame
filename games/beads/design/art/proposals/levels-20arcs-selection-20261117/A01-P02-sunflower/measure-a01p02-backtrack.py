#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性：回溯 P01 雏菊 v5 锁定版按系列五令测量（0 模型调用）。
v5 未硬 snap（云图色值非精确板色）⇒ 按十色板最近邻归组统计（与修复族第①步同口径）。
读数：① 归组色面占比（G12 主导≤50%）② 逐行宽度剖面→花头/茎分界 ③ 头高占整株高（令1 ≥85%）
④ 茎宽（格=64px，令1 ≥2格宽×1–2行短桩）。输出 temp/a01p02-backtrack-measure.json。"""
import json
import os

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P02-sunflower/a01p02-v3-s42-rgba.png")
PAL = {"奶白": (253, 246, 233), "柠黄": (255, 210, 63), "活力橙": (245, 155, 35),
       "草绿": (63, 191, 107), "玫红": (232, 76, 61), "丁香紫": (142, 111, 217),
       "湖蓝": (61, 123, 245), "赭棕": (165, 101, 44), "深棕": (107, 62, 30), "炭黑": (51, 51, 61)}
a = np.asarray(Image.open(SRC).convert("RGBA"))
h, w = a.shape[:2]
fg = a[:, :, 3] == 255
rgb = a[:, :, :3].astype(np.int32)
# 精确色数（1D pack，快）
packed = (rgb[:, :, 0] << 16 | rgb[:, :, 1] << 8 | rgb[:, :, 2])[fg]
n_exact = len(np.unique(packed))
# 十色板最近邻归组
names = list(PAL)
pc = np.array([PAL[n] for n in names], np.int32)
d = ((rgb[fg][:, None, :] - pc[None, :, :]) ** 2).sum(2)
idx = d.argmin(1)
cnt = np.bincount(idx, minlength=10)
share = {names[i]: round(cnt[i] / fg.sum() * 100, 2) for i in np.argsort(-cnt) if cnt[i]}
lab = np.full((h, w), -1, np.int8)
lab[fg] = idx

rows_w = fg.sum(axis=1)
ys = np.where(rows_w > 0)[0]
y0, y1 = int(ys[0]), int(ys[-1])
prof = []
for y in range(y0, y1 + 1, 32):
    row_lab = lab[y][fg[y]]
    c2 = np.bincount(row_lab, minlength=10)
    xs = np.where(fg[y])[0]
    prof.append({"y": y, "w_px": int(rows_w[y]), "span": [int(xs[0]), int(xs[-1])],
                 "dom": names[int(c2.argmax())]})
ranges = {}
for i in range(10):
    if not cnt[i]:
        continue
    m = lab == i
    yy = np.where(m.any(axis=1))[0]
    ranges[names[i]] = {"y": [int(yy[0]), int(yy[-1])], "px": int(cnt[i]),
                        "max_row_w": int(m.sum(axis=1).max())}
info = {"src": os.path.basename(SRC), "exact_unique_colors": n_exact,
        "plant_bbox_y": [y0, y1], "plant_h_px": y1 - y0 + 1,
        "area_share_pct": share, "max_share_pct": max(share.values()),
        "color_y_ranges": ranges, "row_profile_32px": prof}
json.dump(info, open(os.path.join(REPO, "temp/a01p02-backtrack-measure.json"), "w"), ensure_ascii=False, indent=2)
print("exact_unique_colors:", n_exact)
print("area_share_pct:", json.dumps(share, ensure_ascii=False))
print("plant y:", y0, y1, "h:", y1 - y0 + 1)
print("color_y_ranges:", json.dumps(ranges, ensure_ascii=False))
print("row profile (y, w_px, dom):")
for p in prof:
    print(f"  {p['y']:4d} {p['w_px']:4d} {p['dom']}")