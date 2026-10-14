#!/usr/bin/env python3
"""B19 贴回台面目检：把资产放回牌位，背景用**台面逐行均色**（抹掉原牌与原影）。

为什么不用原稿直接当底：原稿牌位上本来就带影，叠上去会二次变暗，判不出新影的强弱。
为什么不用纯色底：台面本身从上到下有明显明暗渐变（背板接缝 190 → 台面 220），
平涂底会让影看起来比实际重/轻。取牌右侧干净台面 x[1000,1080] 的逐行中位色当底，
既保住渐变又没有牌和影。
"""
import numpy as np
from PIL import Image, ImageFilter

import b19_cutlib as lib

P = lib.DRAFT_PLATE
im = Image.open(lib.REF).convert('RGB')
A = np.asarray(im).astype(np.float32)
row_med = np.median(A[:, 1000:1080], 1)              # 逐行台面均色（干净区，无牌无影）
bg = np.repeat(row_med[:, None, :], A.shape[1], axis=1)
# 只在牌位附近抹，远处保留原稿（看图时仍有环境参照）
mask = np.zeros(A.shape[:2], dtype=np.float32)
mask[P[2] - 30:P[3] + 40, P[0] - 30:P[1] + 40] = 1.0
# ⚠ 必须羽化：硬边矩形会在图上留一条可见接缝，看图像时会被误读成资产的边
mask = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(
    ImageFilter.GaussianBlur(24))).astype(np.float32) / 255.0
base = (A * (1 - mask[:, :, None]) + bg * mask[:, :, None]).astype(np.uint8)

rows = [('v1 hard edge  shadow x1.0', 'temp/b19-local/source.png'),
        ('v3 straight-quad  shadow x1.0', 'temp/b19-local3a/source.png'),
        ('v3 straight-quad  shadow x1.6', 'temp/b19-local3b/source.png'),
        ('cloud leg (reference)', 'temp/b19-cloud/source.png')]

tiles = []
for tag, path in rows:
    a = np.asarray(Image.open(path).convert('RGBA'))
    # 各腿都按牌体重建到牌位（云端 2048 尺度要缩回稿尺度）
    yy, xx = np.where(a[:, :, 3] == 255)
    bw, bh = xx.max() - xx.min() + 1, yy.max() - yy.min() + 1
    k = (P[1] - P[0] + 1) / bw
    src = Image.fromarray(a).resize((int(round(a.shape[1] * k)), int(round(a.shape[0] * k))), Image.LANCZOS)
    s = np.asarray(src).astype(np.float32)
    sy, sx = np.where(s[:, :, 3] == 255)
    ox = P[0] - int(sx.min())
    oy = P[2] - int(sy.min())
    canvas = base.astype(np.float32).copy()
    sa = s[:, :, 3:4] / 255.0
    canvas[oy:oy + s.shape[0], ox:ox + s.shape[1]] = \
        canvas[oy:oy + s.shape[0], ox:ox + s.shape[1]] * (1 - sa) + s[:, :, :3] * sa
    crop = Image.fromarray(canvas.astype(np.uint8)).crop((P[0] - 110, P[2] - 70, P[1] + 150, P[3] + 70))
    crop = crop.resize((int(crop.size[0] * 1.5), int(crop.size[1] * 1.5)), Image.LANCZOS)
    tiles.append((tag, crop))

gap, lab = 12, 20
out = Image.new('RGB', (max(t[1].size[0] for t in tiles) + 20,
                        sum(t[1].size[1] for t in tiles) + gap * len(tiles) + lab * len(tiles) + 26),
                (246, 241, 231))
from PIL import ImageDraw
d = ImageDraw.Draw(out)
d.text((10, 6), 'B19 back on the shelf (bg = per-row shelf mean, plate & its original shadow removed)  1.5x',
       fill=(60, 45, 25))
y = 26
for tag, crop in tiles:
    d.text((10, y + 2), tag, fill=(60, 45, 25))
    out.paste(crop, (10, y + lab))
    y += crop.size[1] + lab + gap
out.save('temp/b19-onsheet.png')
print(f'贴回图 temp/b19-onsheet.png {out.size}')
