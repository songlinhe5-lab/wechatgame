#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性：A01-P01 v5 本地确定性修复（用户 2026-11-18 批准的路线，0 次模型调用）。
两步：① 去噪——<1 格（128²px）的漂浮连通域置透明（v5 实测 5 个噪点共 5px，花瓣间隙模型噪点）；
     ② G9 兜底——双轴 bbox 任一 >82% 时按画布中心 NEAREST 统缩，使最大轴落 78%（70–82% 中值）；
        色值逐像素原值搬运、背景精确纯黑 alpha=0，不改任何色值、不 warp。
产物覆盖 a01p01-v5-s42-rgba.png（原件留 -rgba-orig.png），metrics 落 -fix-metrics.json。
判据正本：../series-spec.md §2 G3/G7/G9；v4fix warp 路线已判无效（本脚本不含 warp）。"""
import json
import os
from collections import deque

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P01-daisy")
SRC = os.path.join(BATCH, "a01p01-v5-s42-rgba.png")
CELL_PX = 128 ** 2  # 16×16 盘一格 = 128×128px
TARGET = 0.78

a = np.asarray(Image.open(SRC).convert("RGBA")).copy()
h, w = a.shape[:2]
Image.fromarray(a, "RGBA").save(SRC.replace(".png", "-orig.png"))
fg = a[:, :, 3] == 255

# ① 去噪：全量 4 连通 BFS，<1 格的域置透明
seen = np.zeros((h, w), bool)
removed = []
for sy in range(h):
    for sx in np.where(fg[sy] & ~seen[sy])[0]:
        if seen[sy, sx]:
            continue
        q = deque([(sy, sx)])
        seen[sy, sx] = True
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

# ② G9 自适应统缩（仅超差时触发）
ys, xs = np.where(fg)
bw, bh = (xs.max() - xs.min() + 1) / w, (ys.max() - ys.min() + 1) / h
scale = 1.0
if max(bw, bh) > 0.82:
    scale = TARGET / max(bw, bh)
    yy, xx = np.mgrid[0:h, 0:w]
    sx = np.round(w / 2 + (xx - w / 2) / scale).astype(int)
    sy = np.round(h / 2 + (yy - h / 2) / scale).astype(int)
    ok = (sx >= 0) & (sx < w) & (sy >= 0) & (sy < h)
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[ok] = a[sy[ok], sx[ok]]
    out[:, :, :3][out[:, :, 3] == 0] = 0
    a = out
    fg = a[:, :, 3] == 255

Image.fromarray(a, "RGBA").save(SRC)
ys, xs = np.where(fg)
info = {
    "noise_components_removed": removed,
    "scale": round(scale, 4),
    "bbox_pct": [round((xs.max() - xs.min() + 1) / w * 100, 2), round((ys.max() - ys.min() + 1) / h * 100, 2)],
    "margins_pct": [round(xs.min() / w * 100, 2), round(ys.min() / h * 100, 2),
                    round((w - 1 - xs.max()) / w * 100, 2), round((h - 1 - ys.max()) / h * 100, 2)],
    "fg_px": int(fg.sum()),
}
json.dump(info, open(os.path.join(BATCH, "a01p01-v5-fix-metrics.json"), "w"), ensure_ascii=False, indent=2)
print(json.dumps(info, ensure_ascii=False, indent=2))