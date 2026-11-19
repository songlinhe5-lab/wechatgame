#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性：A01-P02 向日葵回溯 v4（用户 2026-11-18 批准本地修复表，0 模型调用）。
输入 = v3 锁定版（不动不删），输出 = a01p02-v4-s42-rgba.png（重跑幂等）。
六步：① 四色硬 snap＋描边清理（深棕保最大连通域=花盘，其余深棕按叶顶上下归奶白/草绿；
头区绿描边归奶白）② 叶带弱化（纵×0.22 横×0.55 锚叶顶）＋旧茎删→草绿萼桩 160×112px 顶嵌 16px
③ 去噪 <1 格 ④ 柠黄瓣角扇区交替染活力橙（parity 取主导更小者，⛔ balance）
⑤ 各向异性统缩 74×78%＋居中 50% ⑥ metrics＋单连通 assert。
判据正本 ../series-spec.md §2 G1–G12；P02 花心例外（深棕盘＋奶白环）保留不动。"""
import json
import os
from collections import deque

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P02-sunflower")
SRC = os.path.join(BATCH, "a01p02-v3-s42-rgba.png")
OUT = os.path.join(BATCH, "a01p02-v4-s42-rgba.png")
a = np.asarray(Image.open(SRC).convert("RGBA")).copy()
h, w = a.shape[:2]
PAL = {"cream": (253, 246, 233), "yellow": (255, 210, 63), "green": (63, 191, 107),
       "brown": (107, 62, 30), "orange": (245, 155, 35)}
names = list(PAL)
pc4 = np.array([PAL[n] for n in names[:4]], np.int32)

def comps(mask):
    seen = np.zeros_like(mask, bool)
    H, W = mask.shape
    for y in range(H):
        for x in range(W):
            if mask[y, x] and not seen[y, x]:
                q = deque([(y, x)])
                seen[y, x] = True
                comp = []
                while q:
                    cy, cx = q.popleft()
                    comp.append((cy, cx))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            q.append((ny, nx))
                yield comp

# ① 硬 snap 四色＋描边清理
fg = a[:, :, 3] == 255
rgb = a[:, :, :3].astype(np.int32)
d = ((rgb[fg][:, None, :] - pc4[None, :, :]) ** 2).sum(2)
a[:, :, :3][fg] = pc4[d.argmin(1)]
lab = np.full((h, w), -1, np.int8)
lab[fg] = d.argmin(1)
gw = (lab == names.index("green")).sum(axis=1)
leaf_top = int(np.where(gw > 300)[0][0])
frg = fg & (lab == names.index("green")) & (np.arange(h)[:, None] < leaf_top - 40)
a[:, :, :3][frg] = PAL["cream"]
lab[frg] = names.index("cream")
bc = sorted(comps(lab == names.index("brown")), key=len, reverse=True)
for comp in bc[1:]:
    for cy, cx in comp:
        tgt = "cream" if cy < leaf_top else "green"
        a[cy, cx, :3] = PAL[tgt]
        lab[cy, cx] = names.index(tgt)

# ② 叶带弱化＋茎→萼桩
gm = lab == names.index("green")
gw = gm.sum(axis=1)
ys = np.where(gw > 0)[0]
stem_top = int(ys[ys > leaf_top][np.where(gw[ys[ys > leaf_top]] <= 300)[0][0]])
leaf = gm & (np.arange(h)[:, None] >= leaf_top) & (np.arange(h)[:, None] < stem_top)
ly, lx = np.where(leaf)
lcx = float(lx.mean())
sub = a[leaf_top:stem_top].copy()
sl, sw = sub.shape[0], sub.shape[1]
nw, nh = int(round(sw * 0.55)), int(round(sl * 0.22))
rs = np.asarray(Image.fromarray(sub, "RGBA").resize((nw, nh), Image.NEAREST))
a[leaf_top:stem_top + 200] = 0  # 清叶带+旧茎区（含描边残）
lab[leaf_top:stem_top + 200] = -1
x0 = int(round(lcx - nw / 2))
a[leaf_top:leaf_top + nh, x0:x0 + nw] = rs
lab[leaf_top:leaf_top + nh, x0:x0 + nw] = np.where(rs[:, :, 3] == 255, names.index("green"), -1)
fg = a[:, :, 3] == 255
head = fg & ((lab == names.index("cream")) | (lab == names.index("yellow")))
hy = np.where(head.any(axis=1))[0]
head_top, head_bot = int(hy[0]), int(hy[-1])
cx0 = int(np.where(head[head_bot - 8])[0].mean())
leaf_bot = leaf_top + nh
STUB_W, STUB_H, EMBED = 160, 112, 16
y0 = leaf_bot - EMBED
a[y0:y0 + STUB_H, cx0 - STUB_W // 2:cx0 + STUB_W // 2, :3] = PAL["green"]
a[y0:y0 + STUB_H, cx0 - STUB_W // 2:cx0 + STUB_W // 2, 3] = 255
lab[y0:y0 + STUB_H, cx0 - STUB_W // 2:cx0 + STUB_W // 2] = names.index("green")
fg = a[:, :, 3] == 255
head_h = head_bot - head_top + 1
plant_h = (y0 + STUB_H) - head_top
head_ratio = round(head_h / plant_h * 100, 2)

# ③ 去噪
removed = []
for comp in comps(fg):
    if len(comp) < 4096:
        removed.append(len(comp))
        for cy, cx in comp:
            a[cy, cx, 3] = 0
            lab[cy, cx] = -1
fg = a[:, :, 3] == 255

# ④ 活力橙交替染：花盘质心为心；奶白环外半径为瓣界
bm = lab == names.index("brown")
by, bx = np.where(bm)
CX, CY = float(bx.mean()), float(by.mean())
cm = lab == names.index("cream")
gy, gx = np.mgrid[0:h, 0:w]
rr = np.sqrt((gx - CX) ** 2 + (gy - CY) ** 2)
th = (np.degrees(np.arctan2(gy - CY, gx - CX)) + 360) % 360
# 环外半径 = 奶白径向直方图末个 >500 计数半径（⛔ 腐蚀+最大半径：瓣尖描边奶白把半径推到 580，
# 首跑实证 pet 只剩 15620px、橙 0.9%；环主体带止于 r≈440，hist 阈值法不受描边尾影响）
rbin = np.bincount(rr[cm].astype(int), minlength=1500)
ring_outer = float(np.where(rbin > 500)[0][-1])
pet = (lab == names.index("yellow")) & (rr > ring_outer + 10)
hist = np.bincount(th[pet].astype(int) % 360, minlength=360)
empty = hist == 0
bounds = []
for i in range(360):
    if empty[i] and not empty[i - 1]:
        j = i
        while empty[j % 360]:
            j += 1
        bounds.append(((i + j - 1) // 2) % 360)
bounds = sorted(set(bounds))
assert 8 <= len(bounds) <= 24, f"瓣界数 {len(bounds)} 异常"
sector = np.zeros((h, w), int)
for k in range(len(bounds)):
    lo, hi = bounds[k], bounds[(k + 1) % len(bounds)]
    m = (th >= lo) & (th < hi) if lo < hi else (th >= lo) | (th < hi)
    sector[m] = k
best = None
for parity in (0, 1):
    cand = pet & (sector % 2 == parity)
    n_o = int(cand.sum())
    n_y = int(pet.sum()) - n_o
    mx = max(n_y, n_o)
    if best is None or mx < best[0]:
        best = (mx, parity, cand)
_, parity, to_orange = best
a[:, :, :3][to_orange] = PAL["orange"]
lab[to_orange] = names.index("orange")
# ④.5 瓣缘奶白描边清理：环外奶白→所属扇区 parity 色（首跑珠面瓣尖孤奶白格实证，P01 ③.5 同族）
fr = cm & (rr > ring_outer + 10)
sel = fr & (sector % 2 == parity)
a[:, :, :3][sel] = PAL["orange"]
lab[sel] = names.index("orange")
sel2 = fr & (sector % 2 != parity)
a[:, :, :3][sel2] = PAL["yellow"]
lab[sel2] = names.index("yellow")
fringe_px = int(fr.sum())

# ⑤ 各向异性统缩＋居中
ys3, xs3 = np.where(fg)
w0, h0 = xs3.max() - xs3.min() + 1, ys3.max() - ys3.min() + 1
sx, sy = 0.74 * w / w0, 0.78 * h / h0
im = Image.fromarray(a, "RGBA").resize((int(round(w * sx)), int(round(h * sy))), Image.NEAREST)
b = np.asarray(im).copy()
fg2 = b[:, :, 3] == 255
ys2, xs2 = np.where(fg2)
ox = int(round(w / 2 - (xs2.min() + xs2.max()) / 2))
oy = int(round(h / 2 - (ys2.min() + ys2.max()) / 2))
out = np.zeros((h, w, 4), np.uint8)
H2, W2 = b.shape[:2]
ty0, tx0 = max(0, oy), max(0, ox)
ty1, tx1 = min(h, oy + H2), min(w, ox + W2)
out[ty0:ty1, tx0:tx1] = b[ty0 - oy:ty1 - oy, tx0 - ox:tx1 - ox]
Image.fromarray(out, "RGBA").save(OUT)

# ⑥ metrics
fg3 = out[:, :, 3] == 255
ncomp = sum(1 for _ in comps(fg3))
assert ncomp == 1, f"单连通 FAIL：{ncomp} 域"
ys4, xs4 = np.where(fg3)
bw, bh = xs4.max() - xs4.min() + 1, ys4.max() - ys4.min() + 1
cols, cnts = np.unique(out[fg3][:, :3], axis=0, return_counts=True)
share = {("#%02X%02X%02X" % tuple(c)): round(n / fg3.sum() * 100, 2) for c, n in zip(cols, cnts)}
info = {"noise_removed": removed, "single_connected": True, "head_ratio_pct": head_ratio,
        "leaf_top": leaf_top, "stem_top": stem_top, "leaf_new_px": [nw, nh],
        "ring_outer_px": round(ring_outer, 1), "pet_px": int(pet.sum()), "fringe_cream_px": fringe_px,
        "petal_bounds": bounds, "parity": parity, "scale": [round(sx, 4), round(sy, 4)],
        "bbox_pct": [round(bw / w * 100, 2), round(bh / h * 100, 2)],
        "margins_pct": [round(xs4.min() / w * 100, 2), round(ys4.min() / h * 100, 2),
                        round((w - 1 - xs4.max()) / w * 100, 2), round((h - 1 - ys4.max()) / h * 100, 2)],
        "area_share_pct": share, "max_share_pct": max(share.values())}
assert set(map(tuple, cols)) <= set(PAL.values()), "色值越板"
json.dump(info, open(os.path.join(BATCH, "a01p02-v4-fix-metrics.json"), "w"), ensure_ascii=False, indent=2)
print(json.dumps(info, ensure_ascii=False, indent=1))