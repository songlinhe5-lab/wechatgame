#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性：A01-P01 雏菊 v7 对称化收尾（WXG-T-1064 · 0 模型调用）。

v7 出图读数：墨形格化镜像差 4/512（v6 = 78）、像素级 2.43 %、色层 3.19 % ⇒ 构图已对称；
但① 模型画了细长茎（bbox 高 94.3 % 超 G9 70–82 %、违 §A01 P01「无细长茎无叶」令）
② 未硬 snap（29148 色）③ 色层仍有 3 % 抖动。
六步收尾（沿 fix-a01p01-v6.py 口径，对称性优先）：
  ① 硬 snap 五色  ② 去茎：自下而上找「仅一列窄于 3 格」的连续段截断
  ③ 萼短桩重塑 160×112px 居中（复用 v6 尺寸令）  ④ 去噪 <1 格连通域
  ⑤ 强制镜像：右半 = 左半按 bbox 中轴镜像（消 3 % 色层抖动 ⇒ 严格镜像）
  ⑥ G12 交替染按 |扇区序号| 奇偶（⛔ 沿圆周序号——那会让左右镜像侧异色）＋统缩居中
落盘 a01p01-v7-s42-rgba.png，末行打印格化镜像差（必须 = 0）。
用法：python3 fix-a01p01-v7.py
"""
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "a01p01-v7-s42.png")
OUT = os.path.join(HERE, "a01p01-v7-s42-rgba.png")
PAL = {"cream": (253, 246, 233), "yellow": (255, 210, 63), "ochre": (165, 101, 44),
       "brown": (107, 62, 30), "green": (63, 191, 107)}
names = list(PAL)
pc = np.array([PAL[n] for n in names], np.int32)
CELL = 2048 // 32

a = np.asarray(Image.open(SRC).convert("RGBA")).copy()
h, w = a.shape[:2]
rgb = a[:, :, :3].astype(np.int32)
# 黑底 mask 件：非黑即主体
fg = (rgb.sum(2) > 90)


def comps(mask):
    """连通域尺寸列表（scipy label，⛔ 纯 Python BFS 跑 4M px 分钟级）。"""
    lab_, n = ndimage.label(mask)
    if n == 0:
        return []
    return [(i + 1, int((lab_ == i + 1).sum())) for i in range(n)]


# ① 硬 snap 五色
d = ((rgb[fg][:, None, :] - pc[None, :, :]) ** 2).sum(2)
a[:, :, :3][fg] = pc[d.argmin(1)]
# v7-s42.png 是黑底 RGB 件（转 RGBA 后 alpha 全 255）⇒ 必须按 mask 落 alpha，⛔ 背景黑会混进后续判据
a[:, :, 3] = np.where(fg, 255, 0).astype(np.uint8)
lab = np.full((h, w), -1, np.int8)
lab[fg] = d.argmin(1)

# ② 去茎：逐行统计墨宽，自底向上把「连续窄条（<3 格）」整段抹掉，直到遇到花头宽体
rowspan = np.array([np.where(fg[y])[0] for y in range(h)], dtype=object)
width = np.array([0 if len(x) == 0 else x[-1] - x[0] + 1 for x in rowspan])
ys = np.where(fg.any(axis=1))[0]
bottom = int(ys.max())
cut = bottom
while cut > 0:
    if width[cut] <= 3 * CELL:
        cut -= 1
    else:
        break
stem_end = cut  # 此行之下的细条 = 茎
if stem_end < bottom:
    a[stem_end + 1:, :, 3] = 0
    lab[stem_end + 1:, :] = -1
    print(f"② 去茎：截断 y>{stem_end}（原底 {bottom}，茎长 {bottom-stem_end}px = {(bottom-stem_end)/CELL:.1f} 格）")

# ③ 萼短桩重塑（花头底 = 奶白/柠黄瓣体最下行；桩 160×112 居中、顶嵌 16px）
fg = a[:, :, 3] == 255
head = fg & ((lab == names.index("cream")) | (lab == names.index("yellow")))
hy = np.where(head.any(axis=1))[0]
head_top, head_bot = int(hy[0]), int(hy[-1])
a[stem_end + 1:, :, 3] = 0
lab[stem_end + 1:, :] = -1
fg = a[:, :, 3] == 255
cx0 = int(np.where(head[head_bot - 8])[0].mean())
STUB_W, STUB_H, EMBED = 160, 112, 16
y0 = head_bot - EMBED
a[y0:y0 + STUB_H, cx0 - STUB_W // 2:cx0 + STUB_W // 2, :3] = PAL["green"]
a[y0:y0 + STUB_H, cx0 - STUB_W // 2:cx0 + STUB_W // 2, 3] = 255
lab[y0:y0 + STUB_H, cx0 - STUB_W // 2:cx0 + STUB_W // 2] = names.index("green")
fg = a[:, :, 3] == 255
print(f"③ 萼桩 {STUB_W}x{STUB_H} @cx={cx0}（桩中心偏差 {(cx0 - 1024):+d}px）")

# ④ 去噪 <1 格（连通域必须在②去茎③加桩**之后**重算，①的标签已过期）
removed = []
lab_c, ncc = ndimage.label(fg)
for i in range(1, ncc + 1):
    mm = lab_c == i
    sz = int(mm.sum())
    if sz < CELL * CELL:
        removed.append(sz)
        a[mm, 3] = 0
        lab[mm] = -1
fg = a[:, :, 3] == 255

# ⑤ 强制镜像：按墨形 bbox 中轴，右半 = 左半镜像（以左半为准，色与墨一并镜像）
ys2, xs2 = np.where(fg)
bx0, bx1 = int(xs2.min()), int(xs2.max())
mid = (bx0 + bx1 + 1) // 2
left = a[:, bx0:mid].copy()
a[:, mid:mid + (mid - bx0)] = left[:, ::-1]
# 中轴右侧残留的旧像素清掉（宽度不等时）
if mid + (mid - bx0) <= 2047:
    a[:, mid + (mid - bx0):, 3] = 0
lab = np.full((h, w), -1, np.int8)
fg = a[:, :, 3] == 255
rgb2 = a[:, :, :3].astype(np.int32)
for k, n in enumerate(names):
    lab[fg & (rgb2 == np.array(PAL[n])).all(2)] = k
print(f"⑤ 强制镜像：轴 x={mid}（bbox {bx0}–{bx1}）")

# ⑥ G12 交替染：|扇区序号| 奇偶（左右镜像侧同色）
ym = lab == names.index("yellow")
yy, xx = np.where(ym)
CX, CY = float(xx.mean()), float(yy.mean())
disc_r = float(np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2).max())
gy, gx = np.mgrid[0:h, 0:w]
rr = np.sqrt((gx - CX) ** 2 + (gy - CY) ** 2)
th = (np.degrees(np.arctan2(gy - CY, gx - CX)) + 360) % 360
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
print(f"⑥ 瓣界数（= 瓣数）{len(bounds)}：{bounds}")
# 以正上（90° 在图像坐标＝270）为 0 号，取到最近瓣界的带符号序，用 |k| 奇偶染
ref = bounds[0]
sector = np.zeros((h, w), int)
for k in range(len(bounds)):
    lo, hi = bounds[k], bounds[(k + 1) % len(bounds)]
    m = (th >= lo) & (th < hi) if lo < hi else (th >= lo) | (th < hi)
    sector[m] = k
ksym = np.minimum(sector, len(bounds) - sector)  # |k| 关于 0 号轴对称
cream_all = lab == names.index("cream")
n_cream0, n_yellow0 = int(cream_all.sum()), int(ym.sum())
scores = {}
for parity in (0, 1):
    painted = int((cream_all & (ksym % 2 == parity)).sum())
    ny = n_yellow0 + painted
    nc = n_cream0 - painted
    scores[parity] = max(ny, nc)
    print(f"   parity {parity}: 染 {painted}px → 黄 {ny}({ny/n_cream0:.0%}) 奶白 {nc}({nc/n_cream0:.0%}) max={max(ny, nc)}")
best = min(scores, key=scores.get)
to_yellow = cream_all & (ksym % 2 == best)
a[:, :, :3][to_yellow] = PAL["yellow"]
lab[to_yellow] = names.index("yellow")
print(f"   选 parity={best}（主导占比更小者，G12 硬顶 ≤50 %）")

# ⑦ 统缩至 74×78 % ＋居中
fg = a[:, :, 3] == 255
ys3, xs3 = np.where(fg)
bw0, bh0 = int(xs3.max()) - int(xs3.min()) + 1, int(ys3.max()) - int(ys3.min()) + 1
sx, sy = 0.74 * w / bw0, 0.78 * h / bh0
im = Image.fromarray(a, "RGBA").resize((int(round(w * sx)), int(round(h * sy))), Image.NEAREST)
b = np.asarray(im).copy()
fg2 = b[:, :, 3] == 255
ys4, xs4 = np.where(fg2)
cx2, cy2 = (xs4.min() + xs4.max()) / 2, (ys4.min() + ys4.max()) / 2
out = np.zeros((h, w, 4), np.uint8)
ox, oy = int(round(w / 2 - cx2)), int(round(h / 2 - cy2))
H2, W2 = b.shape[:2]
ty0, tx0 = max(0, oy), max(0, ox)
ty1, tx1 = min(h, oy + H2), min(w, ox + W2)
out[ty0:ty1, tx0:tx1] = b[ty0 - oy:ty1 - oy, tx0 - ox:tx1 - ox]

# ⑦.5 缩后再镜一次：⑤ 的镜像被 ⑦ 的 NEAREST 缩放 + 取整平移破掉（整像素偏半格⇒量化两侧异色）
# ⚠ 轴必须 = 画布中心 1024（= 32 列网格中线），⛔ 用 bbox 中心（偏 1px 仍破格对称）
_, fxs = np.where(out[:, :, 3] == 255)
halfw = 1024 - int(fxs.min())
out[:, 1024:, :] = 0
out[:, 1024:1024 + halfw] = out[:, 1024 - halfw:1024][:, ::-1]
Image.fromarray(out, "RGBA").save(OUT)

# ⑧ 门：单连通 + 格化严格镜像 + bbox/留白
fg3 = out[:, :, 3] == 255
ncomp = len(comps(fg3))
g = np.array([[fg3[r * CELL:(r + 1) * CELL, x * CELL:(x + 1) * CELL].mean() > 0.5
              for x in range(32)] for r in range(32)])
mirror = sum(1 for r in range(32) for x in range(16) if g[r][x] != g[r][31 - x])
ys5, xs5 = np.where(fg3)
bw, bh = xs5.max() - xs5.min() + 1, ys5.max() - ys5.min() + 1
cols, cnts = np.unique(out[fg3][:, :3], axis=0, return_counts=True)
share = {("#%02X%02X%02X" % tuple(c)): round(n / fg3.sum() * 100, 2) for c, n in zip(cols, cnts)}
assert set(map(tuple, cols)) <= set(PAL.values()), "色值越板"
info = {"noise_removed": removed, "single_connected": ncomp == 1, "ncomp": ncomp,
        "petals": len(bounds), "parity": int(best), "stub_px": [STUB_W, STUB_H],
        "area_share_pct": share, "max_share_pct": max(share.values()),
        "grid_mirror_diff": mirror, "bbox_pct": [round(bw / w * 100, 2), round(bh / h * 100, 2)],
        "margins_pct": [round(xs5.min() / w * 100, 2), round(ys5.min() / h * 100, 2),
                        round((w - 1 - xs5.max()) / w * 100, 2), round((h - 1 - ys5.max()) / h * 100, 2)],
        "scale": [round(sx, 4), round(sy, 4)]}
json.dump(info, open(os.path.join(HERE, "a01p01-v7-fix-metrics.json"), "w"), ensure_ascii=False, indent=2)
print(json.dumps(info, ensure_ascii=False, indent=1))
assert ncomp == 1, f"单连通 FAIL：{ncomp} 域"
assert mirror == 0, f"镜像门 FAIL：格化差 {mirror} 格"
print(f"→ {OUT}")
