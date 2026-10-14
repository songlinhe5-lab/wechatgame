#!/usr/bin/env python3
"""B19 v2 目检图：四条（v1 硬边 / v2a 软边 / v2b 软边+影加强 / 云端腿）
外加**右下角 6x 放大**——用户说的两处（边缘不平、右下无影）只有放大才看得出来。
"""
import numpy as np
from PIL import Image, ImageDraw

import b19_cutlib as lib

H = 170
rows = [
    ('B3a v3 straight-quad r5 + shadow x1.0', 'temp/b19-local3a/source.png'),
    ('B3b v3 straight-quad r5 + shadow x1.6', 'temp/b19-local3b/source.png'),
    ('B1 v1 hard edge (binary + 0.6px feather)', 'temp/b19-local/source.png'),
    ('B2a v2 soft edge + shadow x1.0', 'temp/b19-local2a/source.png'),
    ('B2b v2 soft edge + shadow x1.6', 'temp/b19-local2b/source.png'),
    ('C  cloud leg (qwen white-bg + colorkey)', 'temp/b19-cloud/source.png'),
]

tiles, zooms = [], []
for tag, path in rows:
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im.split()[3])
    yy, xx = np.where(a == 255)
    k = H / (int(yy.max()) - int(yy.min()) + 1)
    full = im.resize((int(round(im.size[0] * k)), int(round(im.size[1] * k))), Image.LANCZOS)
    c = Image.new('RGBA', full.size, (255, 0, 255, 255))
    c.paste(full, (0, 0), full)
    tiles.append((tag, c.convert('RGB')))
    # 右下角放大：从已归一到 H 的图上取块再 7x（直接按各自原尺寸取会不可比）
    bx, by = int(round(xx.max() * k)), int(round(yy.max() * k))
    crop = full.crop((max(0, bx - 14), max(0, by - 16), min(full.size[0], bx + 22), min(full.size[1], by + 12)))
    z = Image.new('RGBA', crop.size, (255, 0, 255, 255))
    z.paste(crop, (0, 0), crop)
    z = z.resize((z.size[0] * 7, z.size[1] * 7), Image.NEAREST).convert('RGB')
    zooms.append((tag, z))

W = max(t[1].size[0] for t in tiles)
ZW = max(z[1].size[0] for z in zooms)
gap, lab = 14, 22
out = Image.new('RGB', (W + ZW + 50, lab + sum(max(t[1].size[1], z[1].size[1])
                                               for t, z in zip(tiles, zooms)) + gap * 4 + 30),
                (246, 241, 231))
d = ImageDraw.Draw(out)
d.text((10, 6), 'B19 v2  ·  left: full plate on magenta (body h = 170px)   |   right: bottom-right corner 7x NEAREST',
       fill=(60, 45, 25))
y = lab + 6
for t, z in zip(tiles, zooms):
    d.text((10, y + 2), t[0], fill=(60, 45, 25))
    out.paste(t[1], (10, y + lab))
    out.paste(z[1], (W + 30, y))
    y += max(t[1].size[1], z[1].size[1]) + gap
out.save('temp/b19-v2-compare.png')
print(f'目检图 temp/b19-v2-compare.png {out.size}')
