#!/usr/bin/env python3
"""B18 补：把 W3（原稿直抠）与 W4（inpaint 后抠）拼到 280 设计 px 贴回橱窗位，看穿帮。"""
import numpy as np
from PIL import Image

REF = 'games/beads/design/art/shots/menu-showcase-20261010/v1-mainmenu-final.png'
S = 750 / 1520
DEV_H = 160
END_DEV, MID_DEV = 48, 80
BOX = (400, 1830, 1150, 2170)          # 橱窗下半段（含牌与搁板）
PLAQUE = (576, 1933)                   # 牌外框左上（稿 px）


def dev(im):
    return im.resize((int(round(im.size[0] * S * 2)), int(round(im.size[1] * S * 2))),
                     Image.LANCZOS)


def compose(src, wd_dev):
    d = dev(src)
    b = d.resize((int(round(d.size[0] * DEV_H / d.size[1])), DEV_H), Image.LANCZOS)
    cols = np.where(np.asarray(b)[:, :, 3].max(0) > 200)[0]
    b = b.crop((int(cols.min()), 0, int(cols.max()) + 1, DEV_H))
    W = b.size[0]
    L = b.crop((0, 0, END_DEV, DEV_H))
    M = b.crop(((W - MID_DEV) // 2, 0, (W + MID_DEV) // 2, DEV_H))
    R = b.crop((W - END_DEV, 0, W, DEV_H))
    o = Image.new('RGBA', (wd_dev, DEV_H), (0, 0, 0, 0))
    m2 = M.resize((wd_dev - 2 * END_DEV, DEV_H), Image.LANCZOS)
    o.paste(L, (0, 0), L); o.paste(m2, (END_DEV, 0), m2.split()[3])
    o.paste(R, (wd_dev - END_DEV, 0), R)
    return o


base = Image.open(REF).convert('RGB').crop(BOX)
rows = [('draft (as-is)', base)]
for tag, f, wd in [('W3 crop-from-draft', 'temp/b18-ways/w3-sam2.png', 560),
                   ('W4 inpaint+crop', 'temp/b18-ways/w4-inpaint-sam2.png', 560),
                   ('W3 @ natural width', 'temp/b18-ways/w3-sam2.png', 380),
                   ('W4 @ natural width', 'temp/b18-ways/w4-inpaint-sam2.png', 380)]:
    c = compose(Image.open(f).convert('RGBA'), wd)
    # 设备 px -> 稿 px（贴回原位，牌中心对齐）
    gw = int(round(wd / 2 / S))
    gh = int(round(c.size[1] / 2 / S))
    c = c.resize((gw, gh), Image.LANCZOS)
    im = base.copy()
    cx = int(round((576 + 961) / 2)) - BOX[0]
    im.paste(c, (cx - gw // 2, PLAQUE[1] - BOX[1]), c)
    rows.append((tag, im))

from PIL import ImageDraw, ImageFont
LAb = 26
out = Image.new('RGB', (base.size[0] + 20, (base.size[1] + LAb) * len(rows)), (246, 241, 231))
d = ImageDraw.Draw(out)
y = 0
for label, im in rows:
    d.text((10, y + 6), label, fill=(60, 45, 25))
    out.paste(im, (10, y + LAb))
    y += base.size[1] + LAb
out.save('temp/b18-ways/b18-pasteback.webp', quality=86)
print(f'贴回对比 temp/b18-ways/b18-pasteback.webp（{out.size[0]}x{out.size[1]}）'
      f'  560 设备 px = 280 设计 px 拉伸；380 = 原宽')
