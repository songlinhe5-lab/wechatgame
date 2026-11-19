#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性：A01-P01 雏菊 v6 回溯修复（用户 2026-11-18 批准修复表，0 模型调用）。
六步：① 五色硬 snap（描边 1px 级杂色最近邻吸收）② 萼短桩重塑（head 取奶白/柠黄瓣体掩膜，
⛔ 不用非绿掩膜——旧桩底描边棕 1px 会污染 head_bot，首跑实证脱连）
（宽 160px=2.5 格 × 高 112px=1.75 行，顶嵌 16px 入头底瓣保单连通；头高占比≥85%）
③ 去噪 <1 格连通域（桩重塑后跑，清旧桩描边残环）④ G12 交替染：奶白瓣按角剖面缺口扇区交替染柠黄，
parity 取主导占比更小者（⛔ balance）⑤ 各向异性统缩至 74×78% ＋平移居中 (50%,50%)
（G7 留白≥8%；提示词 40% 中心让位 G7 已登记）⑥ metrics＋单连通 assert 落盘。原件备份 -rgba-orig.png，重跑幂等。"""
import json
import os
from collections import deque

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P01-daisy")
SRC = os.path.join(BATCH, "a01p01-v6-s42-rgba.png")
ORIG = SRC.replace(".png", "-orig.png")
if not os.path.exists(ORIG):
    Image.open(SRC).save(ORIG)
a = np.asarray(Image.open(ORIG).convert("RGBA")).copy()
h, w = a.shape[:2]
PAL = {"cream": (253, 246, 233), "yellow": (255, 210, 63), "ochre": (165, 101, 44),
       "brown": (107, 62, 30), "green": (63, 191, 107)}
names = list(PAL)
pc = np.array([PAL[n] for n in names], np.int32)

# ① 硬 snap（只减色到五色板）
fg = a[:, :, 3] == 255
rgb = a[:, :, :3].astype(np.int32)
d = ((rgb[fg][:, None, :] - pc[None, :, :]) ** 2).sum(2)
a[:, :, :3][fg] = pc[d.argmin(1)]
lab = np.full((h, w), -1, np.int8)
lab[fg] = d.argmin(1)

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

# ② 萼短桩重塑：头底 = 奶白/柠黄瓣体掩膜最大 y；描边绿杂色(头底以上)归奶白；旧桩删除重画
head = fg & ((lab == names.index("cream")) | (lab == names.index("yellow")))
hy = np.where(head.any(axis=1))[0]
head_top, head_bot = int(hy[0]), int(hy[-1])
fringe = fg & (lab == names.index("green")) & (np.arange(h)[:, None] < head_bot - 40)
a[:, :, :3][fringe] = PAL["cream"]
lab[fringe] = names.index("cream")
old_stub = fg & (lab == names.index("green"))
a[:, :, 3][old_stub] = 0
lab[old_stub] = -1
cx0 = int(np.where(head[head_bot - 8])[0].mean())  # 头底瓣中心 x
STUB_W, STUB_H, EMBED = 160, 112, 16
y0 = head_bot - EMBED
a[y0:y0 + STUB_H, cx0 - STUB_W // 2:cx0 + STUB_W // 2, :3] = PAL["green"]
a[y0:y0 + STUB_H, cx0 - STUB_W // 2:cx0 + STUB_W // 2, 3] = 255
lab[y0:y0 + STUB_H, cx0 - STUB_W // 2:cx0 + STUB_W // 2] = names.index("green")
fg = a[:, :, 3] == 255
head_h = head_bot - head_top + 1
plant_h = head_h + STUB_H - EMBED
head_ratio = round(head_h / plant_h * 100, 2)

# ③ 去噪：<1 格(4096px) 连通域置透明（桩重塑后跑，清旧桩描边残环）
removed = []
for comp in comps(fg):
    if len(comp) < 4096:
        removed.append(len(comp))
        for cy, cx in comp:
            a[cy, cx, 3] = 0
            lab[cy, cx] = -1
fg = a[:, :, 3] == 255

# ③.5 描边深棕清理：黄盘半径+40 外的深棕 = 瓣尖描边残（首跑珠面右上孤棕格实证）→ 奶白
# （必须在去噪后跑：旧桩描边残环先被去噪清掉，否则转奶白会再污染 head_bot）
ym0 = lab == names.index("yellow")
yy0, xx0 = np.where(ym0)
CX0, CY0 = float(xx0.mean()), float(yy0.mean())
dr0 = float(np.sqrt((xx0 - CX0) ** 2 + (yy0 - CY0) ** 2).max())
gy, gx = np.mgrid[0:h, 0:w]
rr0 = np.sqrt((gx - CX0) ** 2 + (gy - CY0) ** 2)
fb = (lab == names.index("brown")) & (rr0 > dr0 + 40)
a[:, :, :3][fb] = PAL["cream"]
lab[fb] = names.index("cream")

# ④ G12 交替染：黄盘质心为心；奶白角剖面空 bin = 瓣隙 → 扇区界
ym = lab == names.index("yellow")
yy, xx = np.where(ym)
CX, CY = float(xx.mean()), float(yy.mean())
disc_r = float(np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2).max())
yy, xx = np.mgrid[0:h, 0:w]
rr = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
th = (np.degrees(np.arctan2(yy - CY, xx - CX)) + 360) % 360
cm = (lab == names.index("cream")) & (rr > disc_r + 60)
hist = np.bincount(th[cm].astype(int) % 360, minlength=360)
empty = hist == 0
bounds = []
for i in range(360):
    if empty[i] and not empty[i - 1]:
        j = i
        while empty[j % 360]:
            j += 1
        bounds.append(((i + j - 1) // 2) % 360)
bounds = sorted(set(bounds))
assert 12 <= len(bounds) <= 24, f"瓣界数 {len(bounds)} 异常"
sector = np.zeros((h, w), int)
for k in range(len(bounds)):
    lo, hi = bounds[k], bounds[(k + 1) % len(bounds)]
    m = (th >= lo) & (th < hi) if lo < hi else (th >= lo) | (th < hi)
    sector[m] = k
cream_all = lab == names.index("cream")
best = None
for parity in (0, 1):
    cand = cream_all & (sector % 2 == parity)
    n_y = int(cand.sum())
    n_c = int(cream_all.sum()) - n_y
    mx = max(n_c, n_y + int(ym.sum()))
    if best is None or mx < best[0]:
        best = (mx, parity, cand)
_, parity, to_yellow = best
a[:, :, :3][to_yellow] = PAL["yellow"]
lab[to_yellow] = names.index("yellow")

# ⑤ 各向异性统缩 74×78% ＋居中 (50%,50%)
ys, xs = np.where(fg)
bx0, bx1, by0, by1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
w0, h0 = bx1 - bx0 + 1, by1 - by0 + 1
sx, sy = 0.74 * w / w0, 0.78 * h / h0
im = Image.fromarray(a, "RGBA").resize((int(round(w * sx)), int(round(h * sy))), Image.NEAREST)
b = np.asarray(im).copy()
fg2 = b[:, :, 3] == 255
ys2, xs2 = np.where(fg2)
cx2, cy2 = (xs2.min() + xs2.max()) / 2, (ys2.min() + ys2.max()) / 2
out = np.zeros((h, w, 4), np.uint8)
ox, oy = int(round(w / 2 - cx2)), int(round(h / 2 - cy2))
H2, W2 = b.shape[:2]
ty0, tx0 = max(0, oy), max(0, ox)
ty1, tx1 = min(h, oy + H2), min(w, ox + W2)
out[ty0:ty1, tx0:tx1] = b[ty0 - oy:ty1 - oy, tx0 - ox:tx1 - ox]
Image.fromarray(out, "RGBA").save(SRC)

# ⑥ metrics
fg3 = out[:, :, 3] == 255
ncomp = sum(1 for _ in comps(fg3))
assert ncomp == 1, f"单连通 FAIL：{ncomp} 域"
ys3, xs3 = np.where(fg3)
bw, bh = xs3.max() - xs3.min() + 1, ys3.max() - ys3.min() + 1
cols, cnts = np.unique(out[fg3][:, :3], axis=0, return_counts=True)
share = {("#%02X%02X%02X" % tuple(c)): round(n / fg3.sum() * 100, 2) for c, n in zip(cols, cnts)}
info = {"noise_removed": removed, "single_connected": True, "head_ratio_pct": head_ratio, "stub_px": [STUB_W, STUB_H],
        "petal_bounds": bounds, "parity": parity, "scale": [round(sx, 4), round(sy, 4)],
        "bbox_pct": [round(bw / w * 100, 2), round(bh / h * 100, 2)],
        "margins_pct": [round(xs3.min() / w * 100, 2), round(ys3.min() / h * 100, 2),
                        round((w - 1 - xs3.max()) / w * 100, 2), round((h - 1 - ys3.max()) / h * 100, 2)],
        "area_share_pct": share, "max_share_pct": max(share.values())}
assert set(map(tuple, cols)) <= set(PAL.values()), "色值越板"
json.dump(info, open(os.path.join(BATCH, "a01p01-v6-fix-metrics.json"), "w"), ensure_ascii=False, indent=2)
print(json.dumps(info, ensure_ascii=False, indent=1))