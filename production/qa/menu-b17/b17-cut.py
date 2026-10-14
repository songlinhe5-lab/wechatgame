"""B17 · 用 SAM2 出的 mask 从「inpaint 后的稿」抠出木牌 → 9-slice 三段 + 判据。

mask = temp/b17-sam2-pt/6-sam2pt_00001_.png（530x300，crop 原点 (505,1855)）
源图 = temp/menu-states/plaque-f3-qwen-f0.png（稿 + 柜内木牌局部重绘，风格与稿一致且已正视）
产物 = temp/b17-asset/plaque-{left,mid,right}.png（@2x，带 alpha）
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = 'temp/menu-states/plaque-f3-qwen-f0.png'
MSK = 'temp/b17-sam2-pt/6-sam2pt_00001_.png'
OFF = (505, 1855)          # ImageCrop 原点
BASE = 'games/beads/design/art/shots/menu-showcase-20261010/v1-mainmenu-final.png'
OUT = 'temp/b17-asset'
os.makedirs(OUT, exist_ok=True)

DEV_H = 160                # 牌高 @2x（稿外轮廓 80 设计 px）
END_DEV, MID_DEV = 48, 80  # 两端固定 24 设计 px / 中段取样 40 设计 px
S = 750 / 1520.0

# ① mask 清理：中值吃散点 -> 二值化
m = np.asarray(Image.open(MSK).convert('L'))
m = np.asarray(Image.fromarray(m).filter(ImageFilter.MedianFilter(5)))
m = (m > 127).astype(np.uint8) * 255
# 闭运算填掉牌内小洞（先膨胀后收缩；不填的话运行时牌面会透出背景）
m = np.asarray(Image.fromarray(m).filter(ImageFilter.MaxFilter(7)))
m = np.asarray(Image.fromarray(m).filter(ImageFilter.MinFilter(7)))
ys, xs = np.where(m)
lx0, lx1, ly0, ly1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
gx0, gy0 = lx0 + OFF[0], ly0 + OFF[1]
print(f'mask 局部 bbox x[{lx0},{lx1}] y[{ly0},{ly1}] -> 全局 x[{gx0},{gx0 + lx1 - lx0}] y[{gy0},{gy0 + ly1 - ly0}]')
print(f'  牌体 {lx1 - lx0}x{ly1 - ly0} src px = 设计 {(lx1 - lx0) * S:.1f} x {(ly1 - ly0) * S:.1f} px'
      f'（稿实测外轮廓 191.4 x 80.0）')

src = Image.open(SRC).convert('RGB')
plate = src.crop((gx0, gy0, gx0 + (lx1 - lx0), gy0 + (ly1 - ly0)))
alpha = Image.fromarray(m[ly0:ly1, lx0:lx1])
plate = plate.convert('RGBA')
plate.putalpha(alpha)
plate.save(f'{OUT}/plaque-cut.png')
print(f'  抠出 {plate.size}  alpha=0 占比 {np.mean(np.asarray(alpha) == 0) * 100:.1f}%')

# ② 缩到 @2x 口径
sc = DEV_H / plate.height
NW = int(round(plate.width * sc))
p2 = plate.resize((NW, DEV_H), Image.LANCZOS)
p2.save(f'{OUT}/plaque-full.png')
print(f'整板 @2x {p2.size} = 设计 {NW / 2:.1f} x {DEV_H / 2:.1f} px（拉伸系数 {sc:.3f}）')
left = p2.crop((0, 0, END_DEV, DEV_H))
right = p2.crop((NW - END_DEV, 0, NW, DEV_H))
mid = p2.crop(((NW - MID_DEV) // 2, 0, (NW + MID_DEV) // 2, DEV_H))
for n, x in (('left', left), ('mid', mid), ('right', right)):
    x.save(f'{OUT}/plaque-{n}.png')
    a = np.asarray(x)[..., 3]
    print(f'  plaque-{n}.png {x.size}  alpha=0 {np.mean(a == 0) * 100:.2f}%')


def compose(wd, bgc=(250, 247, 240, 255)):
    w = int(round(wd * 2))
    out = Image.new('RGBA', (w, DEV_H), bgc)
    m2 = mid.resize((w - 2 * END_DEV, DEV_H), Image.LANCZOS)
    out.paste(left, (0, 0), left)
    out.paste(m2, (END_DEV, 0), m2)
    out.paste(right, (w - END_DEV, 0), right)
    return out


# ③ 接缝判据（只看牌身行，避开圆角空白）
for wd in (140.0, 191.5, 280.0):
    c = compose(wd)
    arr = np.asarray(c.convert('RGB')).astype(np.int16)[20:DEV_H - 20]
    w = int(round(wd * 2))
    print(f'  宽 {wd:6.1f} 设计 px -> 接缝 maxdiff 左 {np.abs(arr[:, END_DEV - 1] - arr[:, END_DEV]).max():3d}'
          f' / 右 {np.abs(arr[:, w - END_DEV - 1] - arr[:, w - END_DEV]).max():3d}（<12 连续）')

# ④ 目检：三档拼接 + 叠回稿位
strip = Image.new('RGBA', (660, 3 * (DEV_H + 30)), (255, 255, 255, 255))
d = ImageDraw.Draw(strip)
for i, wd in enumerate((140.0, 191.5, 280.0)):
    c = compose(wd)
    strip.paste(c, (20, i * (DEV_H + 30) + 26), c)
    d.text((20, i * (DEV_H + 30) + 4), f'{wd} design px @2x {int(wd * 2)}', fill=(60, 50, 40))
strip.save('temp/b17-slice-check.png')

b = Image.open(BASE).convert('RGB')
# 切边质量目检：把抠出的牌贴在洋红底上（⛔ 奶油底会掩盖白边/锯齿）
mag = Image.new('RGBA', p2.size, (255, 0, 255, 255))
mag.paste(p2, (0, 0), p2)
mag.convert('RGB').resize((p2.width * 3, p2.height * 3), Image.NEAREST).save('temp/b17-edge-check.png')
big = b.copy()
c = compose(191.5)
big.paste(c.convert('RGB'), (gx0 - 4, gy0 - 4), c)
box = (gx0 - 80, gy0 - 80, gx0 + 460, gy0 + 250)
o, n = b.crop(box), big.crop(box)
ab = Image.new('RGB', (box[2] - box[0], (box[3] - box[1]) * 2 + 14), (255, 255, 255))
ab.paste(o, (0, 0))
ab.paste(n, (0, box[3] - box[1] + 14))
ab.resize((ab.width * 2, ab.height * 2), Image.LANCZOS).save('temp/b17-plate-ab.png')
print('目检图 temp/b17-edge-check.png（洋红底看切边）/ temp/b17-plate-ab.png（上=稿原样 下=贴回）/ temp/b17-slice-check.png')
