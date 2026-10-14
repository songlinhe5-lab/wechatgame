#!/usr/bin/env python3
"""B23 目检图：⑤ PyMatting 的"好阴影"换底色还成立吗？

行＝腿（④ GuidedFilter / ⑤ PyMatting / ⑩ 本地 v3a）
列＝底色（白背板 251 / 中灰 140 / 深木 90）
取牌体右下角一带（含底边与右侧影区）4× NEAREST 放大。
判读：真影应当在三列都让底色变暗；若某列反而变亮＝带进了稿上白背板（鬼影）。
"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import b19_cutlib as lib

OFF, CW, CH = (505, 1855), 530, 300
TX0, TY0, TW, TH = 68, 75, 386, 164
X0, Y0, X1, Y1 = TX0, TY0, TX0 + TW, TY0 + TH
SRCC = np.asarray(Image.open(lib.REF).convert('RGB').crop(
    (OFF[0], OFF[1], OFF[0] + CW, OFF[1] + CH)))

WX0, WY0, WW, WH = X1 - 96, Y1 - 44, 140, 84     # 右下角窗口
SCALE = 4
OUT = 'production/qa/menu-b19/b23-bg-test'
os.makedirs(OUT, exist_ok=True)


def load(path):
    im = Image.open(path).convert('RGBA')
    ar = np.asarray(im.split()[3]).astype(np.float32) / 255
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    if im.size != (CW, CH):
        h, w = ar.shape
        a = np.zeros((CH, CW), np.float32)
        R = np.zeros((CH, CW, 3), np.float32)
        a[TY0:TY0 + h, TX0:TX0 + w] = ar
        R[TY0:TY0 + h, TX0:TX0 + w] = rgb
        return a, R
    return ar, rgb


BGS = [('white 251', np.array([251., 250., 249.])),
       ('grey 140', np.full(3, 140.)),
       ('dark-wood 90', np.array([96., 78., 60.]))]
ROWS = [('4 GuidedFilter', 'temp/b22-cut4/112-d4-guidedfilter_00001_.png'),
        ('5 PyMatting', 'temp/b22-cut4/115-d5-pymatting_00001_.png'),
        ('10 local v3a', 'temp/b19-local3a/source.png')]
if '--with-v4' in sys.argv:      # B24：把二维影层一起拉过换底检验
    OUT = 'production/qa/menu-b19/b24-insitu'
    ROWS.append(('11 local v4 (2D shadow)', 'temp/b24-v4-full.png'))

cells = []
for tag, p in ROWS:
    a, rgb = load(p)
    comp = rgb * a[:, :, None] + np.zeros((CH, CW, 3))
    row = []
    for name, bg in BGS:
        c = rgb * a[:, :, None] + bg[None, None, :] * (1 - a[:, :, None])
        w = np.asarray(Image.fromarray(c[WY0:WY0 + WH, WX0:WX0 + WW].astype(np.uint8))
                       .resize((WW * SCALE, WH * SCALE), Image.NEAREST))
        row.append((name, w))
    cells.append((tag, row))

GAP = 8
W = WW * SCALE
H = WH * SCALE
sheet = Image.new('RGB', (W * 3 + GAP * 4 + 150, (H + 22) * len(cells) + GAP * (len(cells) + 1)),
                  (30, 30, 30))
draw = ImageDraw.Draw(sheet)
for r, (tag, row) in enumerate(cells):
    for c, (name, img) in enumerate(row):
        x = GAP + 150 + c * (W + GAP)
        y = GAP + r * (H + 22 + GAP)
        sheet.paste(Image.fromarray(img), (x, y + 22))
        draw.text((x, y + 4), f'{tag} | {name}', fill=(255, 255, 255))
        # 每格左上角画一条 2 px 亮线做方位参照（窗口内牌底边/右边的位置）
        px = Image.new('RGB', (W, 1), (255, 0, 255))
        sheet.paste(px, (x, y + 22 + int((Y1 - WY0) * SCALE)))
fn = 'bg-swap.webp' if '--with-v4' in sys.argv else 'bg-test.webp'
sheet.save(f'{OUT}/{fn}', 'WEBP', quality=88)
print(f'产物：{OUT}/{fn} {sheet.size[0]}×{sheet.size[1]}')
print(f'窗口 x[{WX0},{WX0+WW}) y[{WY0},{WY0+WH})，'
      f'行 4/5/10，列 white/grey/dark-wood，品红线＝牌底边 y={Y1}')
