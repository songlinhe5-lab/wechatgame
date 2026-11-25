#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P09 鲸之王 v2 · 40×40 定稿修复链（0 次 Token Plan 调用）。

背景：用户 2026-11-24 裁定「难度靠增加颜色来处理，珠面不用 48×48 那么宽」⇒
      BOSS 板面改 40×40（C≥6 的 +1 升档生效，G(12) 不降档，实测 tier 3）。
      48×48 那条链（fix-a03p09-v2.py）留作弃档对照，不再是交付口径。

输入：a03p09-v2-s42-rgba.png（qwen-image-3.0-pro seed42 母版抠图）
输出：a03p09-v2-g40fix-s42-rgba.png（送 studio 40×40 量化的定稿底图）

步骤：
  1. bbox 归一 78%×78%（NEAREST，居中贴全透明 2048²）——G9 要求 70–82%。
  2. 清掉模型自带的炭黑细线眼（48 格位置在 40 格上会糊成一块），
     按 40 格格心重画 3×3×2：近眼 rows11-13 cols11-13、远眼 rows12-14 cols16-18。
  3. 修复 7 个孤格（喷柱左侧 2 个赭棕/深棕边、背脊/尾/浪带 5 个炭黑）。
  4. 喷柱在 40 格下已 ≥3 格宽，不再补。

量化口径（studio，非本脚本）：40×40 / palette=10 / colors=0（全色板投票；
⛔ colors=6 的 k-means 会把湖蓝整簇并进丁香紫）/ colorsmode=error /
cellmode=mode / smooth=0 / swaps=0 / noframe=1 / notrim=1 / mis=max。
"""
import numpy as np
from PIL import Image, ImageDraw

SRC = 'a03p09-v2-s42-rgba.png'
DST = 'a03p09-v2-g40fix-s42-rgba.png'
GRID = 40
BLUE = (0x41, 0x89, 0xE5, 255)
CREAM = (0xFD, 0xF6, 0xE9, 255)
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
C = 2048 / GRID


def frame(c, r):
    return (int(round(c * C)), int(round(r * C)), int(round((c + 1) * C)) - 1, int(round((r + 1) * C)) - 1)


dr = ImageDraw.Draw(src)

# 2) 先清掉模型自带眼（头部区域内的炭黑格全部召回孤蓝）
arr = np.asarray(src)[..., :3].astype(np.int32)
for r in range(int(0.25 * GRID), int(0.55 * GRID)):
    for c in range(int(0.15 * GRID), int(0.55 * GRID)):
        x0, y0, x1, y1 = frame(c, r)
        med = np.median(arr[y0:y1 + 1, x0:x1 + 1].reshape(-1, 3), axis=0)
        if ((med - np.array(INK[:3])) ** 2).sum() < 900:
            dr.rectangle((x0, y0, x1, y1), fill=BLUE)

# 3) 孤格修复（40 格 row,col；按邻色重涂）
for (r, c), to in {
    (5, 10): BLUE, (6, 10): BLUE,          # 喷柱左缘的深棕/赭棕边
    (8, 4): CREAM, (9, 3): BLUE,           # 头左侧的奶油/蓝孤格
    (20, 11): BLUE, (21, 9): CREAM,        # 腹下/浪带孤格
    (22, 24): BLUE,                        # 尾柄孤格
}.items():
    dr.rectangle(frame(c, r), fill=to)

# 4) 双眼：3×3×2，落在纯蓝头区
dr.rectangle(frame(11, 11)[:2] + frame(13, 13)[2:], fill=INK)
dr.rectangle(frame(16, 12)[:2] + frame(18, 14)[2:], fill=INK)

src.save(DST)
print(f'{DST}: 78%×78% · 双眼 3×3（rows11-13 / rows12-14）· 孤格 7 处已修')
