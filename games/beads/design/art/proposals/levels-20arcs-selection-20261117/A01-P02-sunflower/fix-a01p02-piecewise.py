#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性：A01-P02 v3 分段确定性修复（用户 2026-11-18 批准路线，0 次模型调用）。
实测几何（干净掩膜 dist<=30）：盘R 13.94% / 白环外 16.8% / 黄瓣外 23.4%，
花心 (50%, 28.25%)，叶带 y1051..1459 span60.5%，茎段 y1460..1921 宽6.0%。
批准表 + 两条必要几何修正（已向用户披露）：
  ① 花心下移到 38.4% 高（否则扩到黄外R37.4%时头顶裁切到画布外）；
     叶带随新花头底平移（形状不变），保持 头→叶→茎尾 原结构；
  ② 统缩自适应（P01 同款：最大轴>82% 时缩到78%，关于 bbox 中心并居中）；
     叶 span 目标 90%（保证终值>=70% 过 G9）。
分段径向（头区）：盘×1.113 / 白环×3.32 / 瓣带×1.87 → 盘R15.5/白外24.9/黄外37.4%；
叶带横向×1.488、茎列带横向×2.66（|dx|<=8% 分支，与叶内缘重叠保连接）。
NEAREST、色值逐像素搬运、背景纯黑 alpha0；去噪 <1 格漂浮域。
产物覆盖 a01p02-v3-s42-rgba.png（原件留 -rgba-orig.png），metrics 落 -fix-metrics.json。
判据正本：../series-spec.md §2 G3/G7/G9 + G11；P01 已判无效的是单因子 warp，本脚本为分段保存在。"""
import json
import os
from collections import deque

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P02-sunflower")
SRC = os.path.join(BATCH, "a01p02-v3-s42-rgba.png")
CELL_PX = 128 ** 2
TARGET = 0.78

a = np.asarray(Image.open(SRC).convert("RGBA")).copy()
h, w = a.shape[:2]
Image.fromarray(a, "RGBA").save(SRC.replace(".png", "-orig.png"))
colors_before = set(map(tuple, a[a[:, :, 3] == 255][:, :3]))

# ---- 实测常量（px，2048 画布）----
CX = 1024.0
CY_OLD = 578.7                     # 原花心 y（28.25%）
R1, R2, R3 = 285.0, 343.0, 480.0   # 原 盘/白外/黄外 半径
CY_NEW = 0.384 * h                 # 新花心 y（头顶留 1%）
T1, T2, T3 = 0.155 * w, 0.249 * w, 0.374 * w  # 目标半径
K1 = T1 / R1
K2 = (T2 - T1) / (R2 - R1)
K3 = (T3 - T2) / (R3 - R2)
LEAF_Y0, LEAF_Y1 = 1051, 1459      # 原叶带
LEAF_TOP = CY_NEW + T3             # 新叶带顶 = 新花头底
DLEAF = LEAF_TOP - LEAF_Y0
LEAF_BOT = LEAF_TOP + (LEAF_Y1 - LEAF_Y0)
LEAF_K = 90.0 / 60.5               # 叶 span 60.5→90%
STEM_HALF = 0.08 * w               # 新茎半宽（16% 宽）
STEM_K = 16.0 / 6.01               # 茎宽 6.01→16%
STEM_Y0, STEM_Y1 = 1460, 1921      # 原纯茎段
BOTTOM = 0.997 * h                 # 茎尾底（留 0.3% 防触边）

yy, xx = np.mgrid[0:h, 0:w]
dx = xx - CX
dy = yy - CY_NEW
rp = np.hypot(dx, dy)
sx = xx.astype(float)
sy = yy.astype(float)
bg = np.ones((h, w), bool)         # 默认背景

# ① 头区：分段径向逆映射（r' → r），角度不变
head = rp <= T3
r = np.where(rp <= T1, rp / K1,
             np.where(rp <= T2, R1 + (rp - T1) / K2, R2 + (rp - T2) / K3))
ratio = np.divide(r, rp, out=np.zeros_like(r), where=rp > 0)
sx[head] = CX + dx[head] * ratio[head]
sy[head] = CY_OLD + dy[head] * ratio[head]
bg[head] = False

# ② 叶带（头区外）：平移 + 横向拉伸；中心列走茎分支保 2 格宽
leaf = (~head) & (yy >= LEAF_TOP) & (yy <= LEAF_BOT)
stem_col = np.abs(dx) <= STEM_HALF
lf = leaf & ~stem_col
sx[lf] = CX + dx[lf] / LEAF_K
sy[lf] = yy[lf] - DLEAF
bg[lf] = False
ls = leaf & stem_col
sx[ls] = CX + dx[ls] / STEM_K
sy[ls] = yy[ls] - DLEAF
bg[ls] = False

# ③ 茎尾（叶带底以下）：横向拉伸 + 纵向线性映射回原茎段
tail = (~head) & (yy > LEAF_BOT) & (yy <= BOTTOM) & stem_col
sx[tail] = CX + dx[tail] / STEM_K
sy[tail] = STEM_Y0 + (yy[tail] - LEAF_BOT) / (BOTTOM - LEAF_BOT) * (STEM_Y1 - STEM_Y0)
bg[tail] = False

sxi = np.round(sx).astype(int)
syi = np.round(sy).astype(int)
ok = (~bg) & (sxi >= 0) & (sxi < w) & (syi >= 0) & (syi < h)
out = np.zeros((h, w, 4), dtype=np.uint8)
out[ok] = a[syi[ok], sxi[ok]]
out[:, :, :3][out[:, :, 3] == 0] = 0
a = out
fg = a[:, :, 3] == 255

# ④ 去噪：<1 格漂浮连通域置透明（P01 同款全量 BFS）
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

# ⑤ 自适应统缩：最大轴>82% 时缩到 78%，关于 bbox 中心缩放并居中画布
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

# 自检：色值只搬运不新增（NEAREST 采样必为原色子集）
colors_after = set(map(tuple, a[fg][:, :3]))
assert colors_after <= colors_before, f"出现新色值: {colors_after - colors_before}"

Image.fromarray(a, "RGBA").save(SRC)
ys, xs = np.where(fg)
info = {
    "piecewise_k": [round(K1, 4), round(K2, 4), round(K3, 4)],
    "head_center_shift_px": round(CY_NEW - CY_OLD, 1),
    "leaf_shift_px": round(DLEAF, 1),
    "leaf_k": round(LEAF_K, 4),
    "stem_k": round(STEM_K, 4),
    "noise_components_removed": removed,
    "scale": round(scale, 4),
    "bbox_pct": [round((xs.max() - xs.min() + 1) / w * 100, 2), round((ys.max() - ys.min() + 1) / h * 100, 2)],
    "margins_pct": [round(xs.min() / w * 100, 2), round(ys.min() / h * 100, 2),
                    round((w - 1 - xs.max()) / w * 100, 2), round((h - 1 - ys.max()) / h * 100, 2)],
    "fg_px": int(fg.sum()),
    "colors_kept": len(colors_after),
}
json.dump(info, open(os.path.join(BATCH, "a01p02-v3-fix-metrics.json"), "w"), ensure_ascii=False, indent=2)
print(json.dumps(info, ensure_ascii=False, indent=2))