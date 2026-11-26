#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""P07 螃蟹：4 色 -> 7 色（不增珠，N=238 保持，D=7.952 仍中等）。
拆法：钳部(y<=9) 深棕->赭棕；湖蓝最下 15 格->丁香紫（体底阴影）；奶白最下 12 格->柠黄（足尖暖色）。
"""
import json
import numpy as np
from PIL import Image

BASE = ('/Users/stephenhe/Development/workspace/wechatgame/games/beads/design/art/'
        'proposals/levels-20arcs-selection-20261117/A03-P07-crab/')
SRC_JSON = BASE + 'studio-full-response-v4-max-32-c0.json'
SRC_RGBA = BASE + 'a03p07-v4-s42-rgba.png'
OUT_RGBA = BASE + 'a03p07-v5-c7-s42-rgba.png'

d = json.load(open(SRC_JSON))
rows = [list(r) for r in d['pattern']]
pal = d['paletteHex']
CH2HEX = {str(i + 1): pal[i] for i in range(len(pal))}

OCHRE, LILAC, LEMON = '#A5652C', '#8E6FD9', '#FFD23F'
plan = {}  # (x,y) -> hex

# 1) 钳部整体（深棕 y<=9）
claw = [(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == '3' and y <= 9]
for p in claw:
    plan[p] = OCHRE

# 2) 湖蓝最下 15 格
blue = [(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == '2']
blue.sort(key=lambda p: (-p[1], p[0]))
for p in blue[:15]:
    plan[p] = LILAC

# 3) 奶白最下 12 格
white = [(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == '1']
white.sort(key=lambda p: (-p[1], p[0]))
for p in white[:12]:
    plan[p] = LEMON

# 写回 pattern 文本（用 7 色新盘位：1 奶白 2 湖蓝 3 深棕 4 炭黑 5 赭棕 6 丁香紫 7 柠黄）
NEW = {'#FDF6E9': '1', '#3D7BF5': '2', '#6B3E1E': '3', '#33333D': '4',
       OCHRE: '5', LILAC: '6', LEMON: '7'}
for (x, y), hx in plan.items():
    rows[y][x] = NEW[hx]

# 重绘 RGBA：按格整块上色（仅 alpha>0 像素）
im = Image.open(SRC_RGBA).convert('RGBA')
a = np.array(im)
h, w = a.shape[:2]
cw, ch = w // d['cols'], h // d['rows']
for (x, y), hx in plan.items():
    rgb = tuple(int(hx[i:i + 2], 16) for i in (1, 3, 5))
    blk = a[y * ch:(y + 1) * ch, x * cw:(x + 1) * cw]
    m = blk[..., 3] > 0
    blk[..., 0][m], blk[..., 1][m], blk[..., 2][m] = rgb
Image.fromarray(a).save(OUT_RGBA)

# 打印新配色统计
from collections import Counter
cnt = Counter(ch for r in rows for ch in r if ch != '.')
inv = {v: k for k, v in NEW.items()}
tot = sum(cnt.values())
print('N =', tot)
for ch, c in sorted(cnt.items()):
    print(f'  {ch} {inv[ch]} {c:3d} {c / tot * 100:5.1f}%')
print('recolored cells:', len(plan))
print('out:', OUT_RGBA)
