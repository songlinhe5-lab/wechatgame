#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P09 鲸之王 v2 确定性修复链（0 次 Token Plan 调用）。

输入：a03p09-v2-s42-rgba.png（qwen-image-3.0-pro seed42 母版抠图）
输出：a03p09-v2fix4-s42-rgba.png（送 studio 48×48 量化的定稿底图）

步骤（全确定性，同一输入必得同一输出）：
  1. bbox 拉到 78%×78%（NEAREST，居中贴全透明 2048²）——G9 要求 70–82%，
     原始 v2 实测 W 87.45% / H 87.60% 超上限。
  2. 吞噪点：v2 量化后残留 5 个炭黑孤格（背脊/尾/浪带）+ 2 个蓝色孤格 → 按邻色重涂。
  3. 喷柱补宽：48 格下原喷柱有 2 格宽的段（违 G4 ≥3 格），补到 3 格。
  4. 双眼：模型自带眼在 48 格下退化成 2 格细线 → 按 3×3 格心重画两只，
     近眼 rows14-16 cols13-15、远眼 rows15-17 cols18-20（间隔 2 格，均落在纯蓝头区）。

量化口径（studio，非本脚本）：48×48 / palette=10 / colors=0（全色板投票；
⛔ colors=6 的 k-means 会把湖蓝整簇并进丁香紫，colorError 47.5）/
colorsmode=error / cellmode=mode / smooth=0 / swaps=0 / noframe=1 / notrim=1 / mis=max。
"""
import numpy as np
from PIL import Image, ImageDraw

SRC = 'a03p09-v2-s42-rgba.png'
DST = 'a03p09-v2fix4-s42-rgba.png'
BLUE = (0x41, 0x89, 0xE5, 255)
CREAM = (0xFD, 0xF6, 0xE9, 255)
YELLOW = (0xFF, 0xD2, 0x3F, 255)
INK = (0x33, 0x33, 0x3D, 255)

# 1) G9 归一：bbox → 78%×78%
im = np.asarray(Image.open(SRC)).copy()
fg = im[:, :, 3] == 255
ys, xs = np.where(fg)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
side = int(0.78 * 2048)
crop = Image.fromarray(im[y0:y1, x0:x1], 'RGBA').resize((side, side), Image.NEAREST)
canvas = Image.new('RGBA', (2048, 2048), (0, 0, 0, 0))  # ⚠ 必须全透明
canvas.paste(crop, ((2048 - side) // 2, (2048 - side) // 2))
src = canvas
C = 2048 / 48


def frame(c, r):
    return (int(round(c * C)), int(round(r * C)), int(round((c + 1) * C)) - 1, int(round((r + 1) * C)) - 1)


dr = ImageDraw.Draw(src)

# 2) 吞噪点（坐标为 48 格 row,col）
for (r, c), to in {(13, 23): BLUE, (23, 32): BLUE, (28, 34): BLUE, (30, 11): CREAM, (31, 32): CREAM}.items():
    dr.rectangle(frame(c, r), fill=to)
for (r, c) in [(15, 6), (18, 8)]:
    dr.rectangle(frame(c, r), fill=CREAM)

# 3) 喷柱补到 3 格宽
dr.rectangle(frame(15, 7), fill=YELLOW)
dr.rectangle(frame(13, 9), fill=YELLOW)

# 4) 双眼（先清掉模型自带的炭黑细线，再画 3×3×2）
arr = np.asarray(src)[..., :3].astype(np.int32)
for r in range(12, 20):
    for c in range(10, 22):
        x0, y0, x1, y1 = frame(c, r)
        med = np.median(arr[y0:y1 + 1, x0:x1 + 1].reshape(-1, 3), axis=0)
        if ((med - np.array(INK[:3])) ** 2).sum() < 900:
            dr.rectangle((x0, y0, x1, y1), fill=BLUE)
dr.rectangle(frame(13, 14)[:2] + frame(15, 16)[2:], fill=INK)
dr.rectangle(frame(18, 15)[:2] + frame(20, 17)[2:], fill=INK)

src.save(DST)
print(f'{DST}: 78.0×78.0% · 噪点 7 格已吞 · 喷柱 3 格 · 双眼 3×3（rows14-16/15-17）')
