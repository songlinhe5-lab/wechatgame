#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性：A01-P03 郁金香回溯 v2（用户 2026-11-18 批准本地修复表＋三参数确认，0 模型调用）。
输入 = v1 锁定版（不动不删），输出 = a01p03-v2-s42-rgba.png（重跑幂等）。
六步：① 四色硬 snap＋描边清理（深棕保最大连通域=杯底带，其余深棕按叶顶上下归奶白/草绿；
头区绿描边归奶白）② 茎叶弱化：旧茎全删（含杯底与叶带间 147px 上段——P02 无此段，P03 实测有，
不删则头高比仅 74.5%）＋叶带纵×0.15 横×0.55 上移嵌杯底 8px＋草绿萼桩 160×112px 顶嵌 16px
③ 去噪 <1 格 ④ 第五色：右侧瓣玫红→活力橙（左红右橙双色栽培种，P04 同族；中央奶白瓣/棕底带保留）
⑤ 各向异性统缩 74×78%＋居中 50% ⑥ metrics＋单连通 assert。
判据正本 ../series-spec.md §2 G1–G12；三瓣杯＋顶双缺口＝花瓣语法保留不重生。"""
import json
import os
from collections import deque

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P03-tulip")
SRC = os.path.join(BATCH, "a01p03-v1-s42-rgba.png")
OUT = os.path.join(BATCH, "a01p03-v2-s42-rgba.png")
a = np.asarray(Image.open(SRC).convert("RGBA")).copy()
h, w = a.shape[:2]
PAL = {"cream": (253, 246, 233), "red": (232, 76, 61), "green": (63, 191, 107),
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
# 杯底带＝深棕行宽>100 连续带（⛔ 最大连通域：杯缘描边环与带连通会把 band_top 推到杯顶）
brow = (lab == names.index("brown")).sum(axis=1)
band_rows = np.where(brow > 100)[0]
band_top, band_bot = int(band_rows[0]), int(band_rows[-1])
# 绿描边清理只限杯区（⛔ leaf_top-40 会把旧茎上段绿体误转奶白污染 head_bot，首跑实证脱连）
frg = fg & (lab == names.index("green")) & (np.arange(h)[:, None] < band_top)
a[:, :, :3][frg] = PAL["cream"]
lab[frg] = names.index("cream")
# 深棕描边清理：带外深棕＝描边残，带上归奶白/带下归草绿（⛔ leaf_top 界：旧茎上段描边会转奶白污染 head_bot）
fb = (lab == names.index("brown")) & ((np.arange(h)[:, None] < band_top) | (np.arange(h)[:, None] > band_bot))
fy = np.arange(h)[:, None] < band_top
sel = fb & fy
a[:, :, :3][sel] = PAL["cream"]
lab[sel] = names.index("cream")
sel = fb & ~fy
a[:, :, :3][sel] = PAL["green"]
lab[sel] = names.index("green")

# ② 茎叶弱化：head=杯＋棕底带；旧茎全删（head_bot 以下全清，⛔ +200 魔数余量首跑漏茎尾 19 行）；薄叶上移嵌杯底 8px；萼桩
bm = lab == names.index("brown")
head = fg & ((lab == names.index("cream")) | (lab == names.index("red")) | bm)
hy = np.where(head.any(axis=1))[0]
head_top, head_bot = int(hy[0]), int(hy[-1])
cx0 = int(np.where(head[head_bot - 8])[0].mean())
gm = lab == names.index("green")
gw = gm.sum(axis=1)
ys = np.where(gw > 0)[0]
stem_top = int(ys[ys > leaf_top][np.where(gw[ys[ys > leaf_top]] <= 300)[0][0]])
leaf = gm & (np.arange(h)[:, None] >= leaf_top) & (np.arange(h)[:, None] < stem_top)
ly, lx = np.where(leaf)
lcx = float(lx.mean())
sub = a[leaf_top:stem_top].copy()
sl, sw = sub.shape[0], sub.shape[1]
nw, nh = int(round(sw * 0.55)), int(round(sl * 0.15))
rs = np.asarray(Image.fromarray(sub, "RGBA").resize((nw, nh), Image.NEAREST))
a[head_bot + 1:] = 0  # 清旧茎上段+叶带+下段全清（含描边残）
lab[head_bot + 1:] = -1
leaf_new_top = head_bot - 7  # 嵌杯底 8px 保单连通（P03 杯底与叶带间有旧茎上段，⛔ 原位锚叶）
x0 = int(round(lcx - nw / 2))
a[leaf_new_top:leaf_new_top + nh, x0:x0 + nw] = rs
lab[leaf_new_top:leaf_new_top + nh, x0:x0 + nw] = np.where(rs[:, :, 3] == 255, names.index("green"), -1)
# 薄叶实底化：逐行首末绿像素间填绿（v1 右叶内缘与茎缘 3px 竖缝致 rs 右半脱连，首跑实证；
# P02 珠面双叶本就收敛为横绿带，形态同系列先例）
for ry in range(nh):
    xs = np.where(rs[ry, :, 3] == 255)[0]
    if len(xs):
        a[leaf_new_top + ry, x0 + xs[0]:x0 + xs[-1] + 1, :3] = PAL["green"]
        a[leaf_new_top + ry, x0 + xs[0]:x0 + xs[-1] + 1, 3] = 255
        lab[leaf_new_top + ry, x0 + xs[0]:x0 + xs[-1] + 1] = names.index("green")
leaf_bot = leaf_new_top + nh
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

# ③.5 杯外廓奶白描边清理：腐蚀2轮取瓣体→膨胀2轮还原→薄突＝描边残→透明
# （首跑珠面 3 孤奶白格实证；描边在杯外廓＝多余 1px，⛔ P02 染瓣色法——那是瓣缘内侧）
cm = lab == names.index("cream")
er = cm.copy()
for _ in range(2):
    er = er & np.roll(er, 1, 0) & np.roll(er, -1, 0) & np.roll(er, 1, 1) & np.roll(er, -1, 1)
dl = er.copy()
for _ in range(2):
    dl = dl | np.roll(dl, 1, 0) | np.roll(dl, -1, 0) | np.roll(dl, 1, 1) | np.roll(dl, -1, 1)
fringe = cm & ~dl
a[:, :, 3][fringe] = 0
lab[fringe] = -1
fringe_px = int(fringe.sum())
fg = a[:, :, 3] == 255

# ④ 第五色：杯区右侧瓣玫红→活力橙（杯质心 x 为界；中央奶白瓣不受影响）
cup = (lab == names.index("red")) | (lab == names.index("cream"))
cup &= np.arange(h)[:, None] < band_top
cy, cx = np.where(cup)
CX = float(cx.mean())
to_orange = (lab == names.index("red")) & (np.arange(w)[None, :] >= CX) & (np.arange(h)[:, None] < band_top)
a[:, :, :3][to_orange] = PAL["orange"]
lab[to_orange] = names.index("orange")

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
        "head_top": head_top, "head_bot": head_bot, "leaf_top_old": leaf_top, "stem_top_old": stem_top,
        "leaf_new_px": [nw, nh], "leaf_new_top": leaf_new_top, "orange_px": int(to_orange.sum()),
        "fringe_cream_px": fringe_px,
        "scale": [round(sx, 4), round(sy, 4)],
        "bbox_pct": [round(bw / w * 100, 2), round(bh / h * 100, 2)],
        "margins_pct": [round(xs4.min() / w * 100, 2), round(ys4.min() / h * 100, 2),
                        round((w - 1 - xs4.max()) / w * 100, 2), round((h - 1 - ys4.max()) / h * 100, 2)],
        "area_share_pct": share, "max_share_pct": max(share.values())}
assert set(map(tuple, cols)) <= set(PAL.values()), "色值越板"
json.dump(info, open(os.path.join(BATCH, "a01p03-v2-fix-metrics.json"), "w"), ensure_ascii=False, indent=2)
print(json.dumps(info, ensure_ascii=False, indent=1))