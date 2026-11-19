#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性：A01-P04 五色均衡版（用户 2026-11-18 令：色数不够+面积不均→全错豆不可达）。
全错豆(F=0)充要条件=主导色<=50%；v2 修复版红 88% ⇒ M_max=2(N-max)=106、F=332。
对策：外 8 瓣红/活力橙(#F59B23 板色3)交替染（双色玫瑰栽培种特征），只染外区红像素，绿萼/奶白/黄芯不动。
瓣界=轮廓半径 r(θ) 的 8 个局部极小（缺口角）；扇区交替指派。0 次模型调用。
产物覆盖 a01p04-v2-s42-rgba.png（染前留 -rgba-pre5.png）；面积占比落 -recolor-metrics.json。"""
import json
import os

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P04-rose")
SRC = os.path.join(BATCH, "a01p04-v2-s42-rgba.png")
PRE = SRC.replace(".png", "-pre5.png")
a = np.asarray(Image.open(SRC).convert("RGBA")).copy()
h, w = a.shape[:2]
if not os.path.exists(PRE):
    Image.fromarray(a, "RGBA").save(PRE)
fg = a[:, :, 3] == 255
CX, CY = 1030.0, 982.0  # 修复后芯中心（orig(1031,975) 经统缩 0.8483 关于 bbox 中心(1024,1024)）
R_OUT = 390.0          # 外区界 = T3(454.8)×0.8483

yy, xx = np.mgrid[0:h, 0:w]
rr = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
th = (np.degrees(np.arctan2(yy - CY, xx - CX)) + 360) % 360

# 轮廓半径剖面 r(θ)：1°  bin 取 fg 最大半径
prof = np.zeros(360)
b = th[fg].astype(int) % 360
np.maximum.at(prof, b, rr[fg])
# 环形平滑 ±3°
sm = np.array([np.mean([prof[(i + d) % 360] for d in range(-3, 4)]) for i in range(360)])
mins = [i for i in range(360) if sm[i] == min(sm[(i + d) % 360] for d in range(-20, 21))
        and sm[i] < np.mean(sm) - 20]
# 合并相邻极小为 8 个缺口角
groups = []
for i in mins:
    if groups and (i - groups[-1][-1]) % 360 <= 6:
        groups[-1].append(i)
    else:
        groups.append([i])
if len(groups) > 1 and (groups[0][0] - groups[-1][-1]) % 360 <= 6:
    groups[0] = groups.pop() + groups[0]
notches = [int(np.mean(g)) % 360 for g in groups]
# 绿萼填平底部缺口／顶瓣偏宽 ⇒ 检测数可 <8；>80° 的扇区在中点补界（90°=底双瓣缝）
bounds = sorted(notches)
extra = []
for k in range(len(bounds)):
    lo, hi = bounds[k], bounds[(k + 1) % len(bounds)]
    span = (hi - lo) % 360
    if span > 80:
        extra.append((lo + span // 2) % 360)
bounds = sorted(bounds + extra)
print("notch angles:", notches, "bounds:", bounds)
assert 6 <= len(bounds) <= 9, f"瓣界数 {len(bounds)} 异常"

# 扇区交替：相邻缺口间为一瓣；只染外区红像素
RED = (232, 76, 61)
ORANGE = (245, 155, 35)
red_mask = fg & (a[:, :, 0] == RED[0]) & (a[:, :, 1] == RED[1]) & (a[:, :, 2] == RED[2])
outer_red = red_mask & (rr > R_OUT)
sector = np.zeros((h, w), int)
for k in range(len(bounds)):
    lo, hi = bounds[k], bounds[(k + 1) % len(bounds)]
    m = (th >= lo) & (th < hi) if lo < hi else (th >= lo) | (th < hi)
    sector[m] = k
# 两种交替parity取主导色占比更小者（全错豆充要条件 max<=50%）
best = None
for parity in (0, 1):
    cand = outer_red & (sector % 2 == parity)
    n_o = int(cand.sum())
    n_r = int(outer_red.sum()) - n_o
    mx = max(n_o, n_r)
    if best is None or mx < best[0]:
        best = (mx, parity, cand)
_, parity, to_orange = best
a[:, :, :3][to_orange] = ORANGE

fg = a[:, :, 3] == 255
cols, cnts = np.unique(a[fg][:, :3], axis=0, return_counts=True)
share = {("#%02X%02X%02X" % tuple(c)): round(n / fg.sum() * 100, 2) for c, n in zip(cols, cnts)}
Image.fromarray(a, "RGBA").save(SRC)
info = {"notches": notches, "bounds": bounds, "parity": parity, "orange_px": int(to_orange.sum()),
        "area_share_pct": share, "max_share_pct": max(share.values())}
json.dump(info, open(os.path.join(BATCH, "a01p04-v2-recolor-metrics.json"), "w"), ensure_ascii=False, indent=2)
print(json.dumps(info, ensure_ascii=False, indent=2))