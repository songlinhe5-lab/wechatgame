#!/usr/bin/env python3
"""B19 汇总：三条腿同尺对比 —— 稿上原样（SAM2 直出未平整）/ 本地腿 / 云端腿。

第一行是**锚点**：稿本身的边缘抖动有多少。没有它，"RMS 0.5" 和 "RMS 19" 都无意义。
"""
import os
import numpy as np
from PIL import Image, ImageDraw

import b19_cutlib as lib

OUT = 'temp/b19-compare'
os.makedirs(OUT, exist_ok=True)
P = lib.DRAFT_PLATE
OFF = (505, 1855)

# 锚点：SAM2 直出 mask ∩ 牌框，不做任何平整化
src = Image.open(lib.REF).convert('RGB')
crop = src.crop((OFF[0], OFF[1], OFF[0] + 530, OFF[1] + 300))
m = np.asarray(Image.open('temp/b19-sam2/6-b19_00001_.png').convert('L')) > 127
x0l, x1l = P[0] - OFF[0], P[1] - OFF[0] + 1
y0l, y1l = P[2] - OFF[1], P[3] - OFF[1] + 1
raw = np.zeros_like(m)
raw[y0l:y1l, x0l:x1l] = m[y0l:y1l, x0l:x1l]
raw &= np.asarray(crop.convert('L')) < 246
rgba_raw = crop.convert('RGBA').copy()
rgba_raw.putalpha(Image.fromarray(raw.astype(np.uint8) * 255))
ys, xs = np.where(raw)
rgba_raw = rgba_raw.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))

rows = [('A draft raw (SAM2, no flatten)', rgba_raw, raw[ys.min():ys.max() + 1, xs.min():xs.max() + 1], None),
        ('B local leg (SAM2+flatten+shadow)', None, None, 'temp/b19-local'),
        ('C cloud leg (qwen white-bg + colorkey)', None, None, 'temp/b19-cloud')]

# B/C 读各腿落盘时同存的 source.png + plate-mask.png；用 at2x 反推会把重采样
# 弄出的半透边当成影（实测阴影均值 12.5% → 虚高 25.9%）。
labels = []
for tag, im, pl, code in rows:
    if im is None:
        im = Image.open(f'{code}/source.png').convert('RGBA')
        pl = np.asarray(Image.open(f'{code}/plate-mask.png').convert('L')) > 127
    sub = f'{OUT}/{tag[0]}'
    os.makedirs(sub, exist_ok=True)
    labels.append(lib.report(tag, im, pl, sub))

# ---------- 并排目检图（统一到牌高 160 px，洋红底看 alpha）----------
H = 160
tiles = []
for (tag, _i, _p, _c), _m in zip(rows, labels):
    im = Image.open(f'temp/b19-{"local" if tag[0] == "B" else "cloud"}/source.png').convert('RGBA') \
        if _c else _i
    a = np.asarray(im.split()[3])
    yy, xx = np.where(a == 255)
    body = im.crop((int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1))
    k = H / body.size[1]
    body = body.resize((int(round(body.size[0] * k)), H), Image.LANCZOS)
    full = im.resize((int(round(im.size[0] * k)), int(round(im.size[1] * k))), Image.LANCZOS)
    c = Image.new('RGBA', (full.size[0], full.size[1]), (255, 0, 255, 255))
    c.paste(full, (0, 0), full)
    tiles.append((tag, c.convert('RGB')))

W = max(t[1].size[0] for t in tiles)
gap, lab = 18, 26
out = Image.new('RGB', (W + 20, sum(t[1].size[1] for t in tiles) + gap * len(tiles) + lab * len(tiles) + 40),
                (246, 241, 231))
d = ImageDraw.Draw(out)
d.text((10, 8), 'B19 cabinet plaque: draft-raw vs local SAM2 leg vs cloud qwen leg'
                '  (magenta = transparent; body height normalized to 160 px)', fill=(60, 45, 25))
y = 40
for tag, im in tiles:
    d.text((10, y + 4), tag, fill=(60, 45, 25))
    out.paste(im, (10, y + lab))
    y += im.size[1] + lab + gap
out.save(f'{OUT}/b19-compare.webp', quality=86)
print(f'\n对比图 {OUT}/b19-compare.webp（{out.size[0]}x{out.size[1]}）')
