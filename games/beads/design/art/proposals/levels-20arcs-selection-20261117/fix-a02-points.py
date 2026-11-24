#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A02 批 1 点睛放大修复 v3（0 次模型调用）。

v1/v2 教训：容差捕斑不稳（深棕腿/蹄误入耳斑集；小鹿抗锯齿捕不全）；耳斑误填炭黑。
v3 对策：主体暗色斑（max<110）按**斑均色**二分类（炭黑 #33333D / 深棕 #6B3E1E，
均色 sum-abs <90），耳斑再加「位于主体 bbox 上部 35% 且面积 ≤16000px」判据
（腿/蹄在底部被排除）。2026-11-24 实测指认：
  狐 v3  耳 (413,447)/(908,472)·眼 (436,748)/(700,757)·鼻 (444,959)
  熊 v3fix 耳 (383,311)/(969,344)·眼 (418,593)/(712,607)·鼻 (527,704)
  鹿 v4fix 眼 (434,787)/(635,792)·鼻 (401,896)（耳为赭棕色，无耳斑；鹿角=深棕大件不重画）
修复动作：抹原斑（填最近非暗主体色）→ 狐狸赭棕杂色 snap 活力橙 → 重画：
  眼 d=104 / 鼻 d=112 / 耳 d=104，圆心对齐 64px 格中心（≥1 整格，mode 投票必赢）。
用法：python3 fix-a02-points.py <dir> <src_rgba> <dst_rgba> [--fox] [--ears]
"""
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

CHARCOAL = np.array([51, 51, 61])    # #33333D
DKBROWN = np.array([107, 62, 30])    # #6B3E1E
ORANGE = np.array([245, 155, 35])    # #F59B23
OCHRE = np.array([165, 101, 44])     # #A5652C
EYE_D, NOSE_D, EAR_D, CELL = 104, 112, 104, 64
# k-means 对小质量簇初始化敏感（狐狸 3 圆 2.2% 像素没成簇、熊/鹿成了）：
# 追加质量时用 --eye-d/--nose-d 加大直径（140/150 ≈ 4.5% 像素量，必成簇）。
for _i, _a in enumerate(sys.argv):
    if _a == "--eye-d":
        EYE_D = int(sys.argv[_i + 1])
    if _a == "--nose-d":
        NOSE_D = int(sys.argv[_i + 1])

d, src, dst = sys.argv[1], sys.argv[2], sys.argv[3]
fox, ears = "--fox" in sys.argv, "--ears" in sys.argv
nose_fill = ORANGE if "--nose-orange" in sys.argv else CHARCOAL

im = np.asarray(Image.open(f"{d}/{src}")).copy()
rgb = im[:, :, :3].astype(int)
fg = im[:, :, 3] == 255
dist_bg = ndimage.distance_transform_edt(fg)
ys, xs = np.where(fg)
cy0, cx0 = ys.mean(), xs.mean()
y_top, y_bot = ys.min(), ys.max()

# ── 斑清单：暗色（max<110）连通域 ≥300px，按均色二分类 ──
dark = fg & (rgb.max(2) < 110)
lab, n = ndimage.label(dark)
char_blobs, brown_blobs = [], []
for i in range(1, n + 1):
    mm = lab == i
    if mm.sum() < 300:
        continue
    ys2, xs2 = np.where(mm)
    mean = rgb[mm].mean(0)
    # 炭黑 iff B≥26 且 R<75：眼/鼻均色 B 32–46、R 45–51；深棕系 B 18–20、R 70–97
    kind = "char" if (mean[2] >= 26 and mean[0] < 75) else "brown"
    (char_blobs if kind == "char" else brown_blobs).append(
        (xs2.mean(), ys2.mean(), mm, int(mm.sum())))

assert 2 <= len(char_blobs) <= 3, f"{d}: 炭黑斑 {len(char_blobs)} 个（预期眼2+鼻1 或 眼2）"
if len(char_blobs) == 3:
    nose = max(char_blobs, key=lambda b: b[3])
    eye_blobs = [b for b in char_blobs if b is not nose]
else:
    nose = None  # 兔子等橙色鼻：炭黑仅眼×2，鼻保持原样（橙色已是调色板主色）
    eye_blobs = char_blobs
assert len(eye_blobs) == 2, f"{d}: 眼 {len(eye_blobs)} 颗"

ear_blobs = []
if ears:
    lim = y_top + (y_bot - y_top) * 0.35
    ear_blobs = [b for b in brown_blobs if b[1] < lim and b[3] <= 16000]
    assert len(ear_blobs) <= 2, f"{d}: 耳斑 {len(ear_blobs)} 个（预期 ≤2）"

# ── 抹所有要重画的斑（填最近非暗主体色，统一在 snap 前做） ──
good = fg & (rgb.max(2) > 110)
idx = ndimage.distance_transform_edt(~good, return_distances=False, return_indices=True)
for _, _, mm, _ in [*char_blobs, *ear_blobs]:
    rgb[mm] = rgb[idx[0][mm], idx[1][mm]]

if fox:  # 宪法外赭棕 shading → 活力橙（容差 90：清残留杂格；距橙 143/距深棕 111，安全）
    och = fg & (np.abs(rgb - OCHRE).sum(2) < 90)
    rgb[och] = ORANGE
    print(f"snap：赭棕杂色→活力橙 {int(och.sum())}px")

img8 = rgb.astype(np.uint8)


def draw_circle(cx, cy, diam, fill):
    cx = CELL / 2 + CELL * int(cx // CELL)   # 圆心对齐所在 64px 格中心
    cy = CELL / 2 + CELL * int(cy // CELL)
    r = diam / 2
    # 触轮廓则沿主体质心方向整格平移（保持格心对齐；v2 教训：4px 微移破坏对齐→跨格稀释）
    for _ in range(20):
        if dist_bg[int(cy), int(cx)] >= r + 4:
            break
        cx += np.sign(cx0 - cx) * CELL
        cy += np.sign(cy0 - cy) * CELL
    assert dist_bg[int(cy), int(cx)] >= r + 4, f"圆 ({cx:.0f},{cy:.0f}) 放不进主体"
    # ⚠ numpy 直写 rgb：v1-v3 用 PIL Draw 画在另一份缓冲上，保存时全部丢失（已踩坑）
    yy, xx = np.ogrid[:2048, :2048]
    m = (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r
    rgb[m] = fill


for cx, cy, _, _ in eye_blobs:
    draw_circle(cx, cy, EYE_D, CHARCOAL)
if nose is not None:
    draw_circle(nose[0], nose[1], NOSE_D, nose_fill)
for cx, cy, _, _ in ear_blobs:
    draw_circle(cx, cy, EAR_D, DKBROWN)
print(f"眼×2 d={EYE_D}（炭黑）｜鼻 {'d=%d ' % NOSE_D if nose else '保留原样'}｜耳×{len(ear_blobs)} d={EAR_D}（深棕）｜格心对齐")

Image.fromarray(np.dstack([rgb.astype(np.uint8), im[:, :, 3]]), "RGBA").save(f"{d}/{dst}")
print(f"→ {d}/{dst}")
