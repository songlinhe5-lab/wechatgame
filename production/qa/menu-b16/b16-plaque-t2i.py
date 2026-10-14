"""第十六批 · 本地 t2i 木牌纹理 → 去背 → 9-slice 三段 + 判据。

源图 = temp/b16-t2i/Qwen_image_2.1_00141.png（qwen-image-2.1 t2i / 21:9 / mp1 / seed42，本地 0 元）
去背 = 四角洪水填充找白底（skill §3 平色 UI 口径，⛔ 全局色键会啃掉浅色木纹高光）
产物 = temp/b16-asset/plaque-{left,mid,right}.png（@2x，带 alpha）
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = sys.argv[1] if len(sys.argv) > 1 else 'temp/b16-t2i/Qwen_image_2.1_00141.png'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'a'
BASE = 'games/beads/design/art/shots/menu-showcase-20261010/v1-mainmenu-final.png'
OUT = 'temp/b16-asset'
os.makedirs(OUT, exist_ok=True)

DEV_H = 160            # 牌高 @2x：稿实测外轮廓 y[1932,2094] = 162 src = 80 设计 px（含描边）
END_DEV, MID_DEV = 48, 80      # 两端固定 24 设计 px / 中段取样 40 设计 px
S = 750 / 1520.0

im = Image.open(SRC).convert('RGB')
W0, H0 = im.size
ff = im.copy()
MAG = (255, 0, 255)
for c in ((0, 0), (W0 - 1, 0), (0, H0 - 1), (W0 - 1, H0 - 1)):
    ImageDraw.floodfill(ff, c, MAG, thresh=24)
bg = (np.asarray(ff) == np.array(MAG)).all(axis=2)   # ⛔ 不 .all(axis=2) 会得到三维逐通道图
alpha = np.where(bg, 0, 255).astype(np.uint8)
alpha = np.asarray(Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)))  # 吃白边 1px
ys, xs = np.where(alpha > 0)
bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
plate = im.crop((bx0, by0, bx1, by1))
pa = Image.fromarray(alpha[by0:by1, bx0:bx1]).crop((0, 0, plate.width, plate.height))
plate = plate.convert('RGBA')
plate.putalpha(pa)
print(f'原图 {im.size}  白底占比 {bg.mean() * 100:.1f}%  牌体 bbox {plate.size}  长宽比 {plate.width / plate.height:.3f}（目标 {189 / 74:.3f}）')

# 描边色 / 宽度 / 平涂度（在牌体 bbox 坐标内量）
a = np.asarray(plate.convert('RGB')).astype(np.int16)
lum = a.mean(2)
dark = lum < 150
rows = [int(dark[y].mean()) for y in range(plate.height)]
top = int(np.argmax(np.asarray(rows) > 0.5))
bot = plate.height - 1 - int(np.argmax(np.asarray(rows[::-1]) > 0.5))
print(f'描边：顶边行 {top}  底边行 {bot}  ->  缩到 @2x 高 {DEV_H} 后为 {top * DEV_H / plate.height:.1f}/{(plate.height - 1 - bot) * DEV_H / plate.height:.1f} 设备 px')
face = a[top + 6:bot - 6, 40:plate.width - 40]
print(f'牌面均色 {face.reshape(-1, 3).mean(0).round(0)}（稿 [241 194 136]）  横向梯度 {np.abs(np.diff(face, axis=1)).mean():.2f}  纵向 {np.abs(np.diff(face, axis=0)).mean():.2f}')
print(f'描边均色 {a[dark].reshape(-1, 3).mean(0).round(0)}（稿 [160 120 74]）')

# 缩到 @2x 口径并切三段
sc = DEV_H / plate.height
NW = int(round(plate.width * sc))
plate2 = plate.resize((NW, DEV_H), Image.LANCZOS)
plate2.save(f'{OUT}/plaque-{TAG}-full.png')
print(f'整板 @2x {plate2.size} = 设计 {NW / 2:.1f} x {DEV_H / 2:.1f} px')
left = plate2.crop((0, 0, END_DEV, DEV_H))
right = plate2.crop((NW - END_DEV, 0, NW, DEV_H))
mid = plate2.crop(((NW - MID_DEV) // 2, 0, (NW + MID_DEV) // 2, DEV_H))
for n, x in (('left', left), ('mid', mid), ('right', right)):
    x.save(f'{OUT}/plaque-{TAG}-{n}.png')
    print(f'  plaque-{TAG}-{n}.png {x.size}')


def compose(wd):
    w = int(round(wd * 2))
    out = Image.new('RGBA', (w, DEV_H), (250, 247, 240, 255))
    m = mid.resize((w - 2 * END_DEV, DEV_H), Image.LANCZOS)
    out.paste(left, (0, 0), left)
    out.paste(m, (END_DEV, 0), m)
    out.paste(right, (w - END_DEV, 0), right)
    return out


for wd in (140.0, 189.0, 280.0):
    c = compose(wd)
    arr = np.asarray(c.convert('RGB')).astype(np.int16)
    w = int(round(wd * 2))
    print(f'  宽 {wd:6.1f} 设计 px -> 接缝 maxdiff 左 {np.abs(arr[:, END_DEV - 1] - arr[:, END_DEV]).max():3d}'
          f' / 右 {np.abs(arr[:, w - END_DEV - 1] - arr[:, w - END_DEV]).max():3d}（<12 连续）')
strip = Image.new('RGBA', (640, 3 * (DEV_H + 30)), (255, 255, 255, 255))
d = ImageDraw.Draw(strip)
for i, wd in enumerate((140.0, 189.0, 280.0)):
    c = compose(wd)
    strip.paste(c, (20, i * (DEV_H + 30) + 26), c)
    d.text((20, i * (DEV_H + 30) + 4), f'{wd} design px @2x {int(wd * 2)}', fill=(60, 50, 40))
strip.save(f'temp/b16-slice-check-{TAG}.png')

# 叠回稿位目检（覆盖稿上带透视的旧牌）
b = Image.open(BASE).convert('RGB')
x0, y0 = 575, 1932          # 稿牌体外轮廓 x[575,963] y[1932,2094] = 191.4 x 80 设计 px
c = compose(191.5)
big = b.copy()
big.paste(c.convert('RGB'), (x0, y0), c)
box = (x0 - 70, y0 - 70, x0 + 460, y0 + 250)
o, n = b.crop(box), big.crop(box)
ab = Image.new('RGB', (box[2] - box[0], (box[3] - box[1]) * 2 + 12), (255, 255, 255))
ab.paste(o, (0, 0))
ab.paste(n, (0, box[3] - box[1] + 12))
ab.resize((ab.width * 2, ab.height * 2), Image.LANCZOS).save(f'temp/b16-plate-ab-{TAG}.png')
compose(191.5).save(f'temp/b16-plate-189-{TAG}.png')
print(f'目检图 temp/b16-plate-ab-{TAG}.png（上=稿原样 下=贴新板） / temp/b16-slice-check-{TAG}.png')
