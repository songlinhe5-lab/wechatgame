#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性测量：A01-P04 v2 花瓣版玫瑰的内部特征几何（黄芯/奶白螺旋/内瓣/外瓣/绿萼）。
四族参考色最近邻 dist<=30 干净掩膜（P02 确诊方法论）；径向剖面取 360 射线平均。"""
import json
import os
from collections import Counter

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P04-rose")
a = np.asarray(Image.open(os.path.join(BATCH, "a01p04-v2-s42-rgba.png")).convert("RGBA"))
h, w = a.shape[:2]
fg = a[:, :, 3] == 255
rgb = a[:, :, :3].astype(int)

REF = {"red": (232, 76, 61), "cream": (253, 246, 233), "yellow": (255, 210, 63), "green": (63, 191, 107)}
d = np.stack([np.sqrt(((rgb - np.array(c)) ** 2).sum(2)) for c in REF.values()])
lab = d.argmin(0)
clean = d.min(0) <= 30
names = list(REF)
masks = {n: fg & clean & (lab == i) for i, n in enumerate(names)}
unc = fg & ~clean
cnt = Counter(map(tuple, a[unc][:, :3]))
print("unclassified px:", int(unc.sum()), "top:", cnt.most_common(6))
for n in names:
    ys, xs = np.where(masks[n])
    print(n, "px:", int(masks[n].sum()), "bbox:", [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if len(xs) else None)

ys, xs = np.where(masks["yellow"])
cx, cy = xs.mean(), ys.mean()
r_yellow = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
print("heart center:", round(cx, 1), round(cy, 1), "R max/median:", round(r_yellow.max(), 1), round(np.median(r_yellow), 1))

# 径向剖面：360 射线，每 4px 采样，族序列
angs = np.linspace(0, 2 * np.pi, 360, endpoint=False)
prof = []
for t in angs:
    seq = []
    for r in range(0, 900, 4):
        x, y = int(round(cx + r * np.cos(t))), int(round(cy + r * np.sin(t)))
        if not (0 <= x < w and 0 <= y < h) or not fg[y, x]:
            seq.append(".")
            continue
        seq.append(names[lab[y, x]] if clean[y, x] else "?")
    prof.append(seq)
# 压缩游程后统计常见模式
runs = Counter()
for seq in prof:
    out = []
    for s in seq:
        if not out or out[-1][0] != s:
            out.append([s, 1])
        else:
            out[-1][1] += 1
    runs[tuple((s, n * 4) for s, n in out if s != "." and n * 4 >= 12)] += 1
for pat, c in runs.most_common(8):
    print(c, pat)

# 奶白螺旋带厚度：cream 掩膜逐像素到 red 的距离近似（用径向游程中 cream 段长）
th = []
for seq in prof:
    run = 0
    for s in seq:
        if s == "cream":
            run += 4
        else:
            if run:
                th.append(run)
            run = 0
print("cream radial run px: median", float(np.median(th)) if th else None, "p90", float(np.percentile(th, 90)) if th else None)

ys, xs = np.where(masks["green"])
print("green stub w/h px:", int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1), "= cells", round((xs.max() - xs.min() + 1) / 128, 2), round((ys.max() - ys.min() + 1) / 128, 2))
ys, xs = np.where(fg)
print("bbox pct:", round((xs.max() - xs.min() + 1) / w * 100, 2), round((ys.max() - ys.min() + 1) / h * 100, 2),
      "margins:", round(xs.min() / w * 100, 2), round(ys.min() / h * 100, 2), round((w - 1 - xs.max()) / w * 100, 2), round((h - 1 - ys.max()) / h * 100, 2))