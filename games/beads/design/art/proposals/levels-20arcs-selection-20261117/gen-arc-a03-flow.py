#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03 九关珠面总览（3×3），带关卡/色数/珠数/D 档/time 标签。"""
from PIL import Image, ImageDraw, ImageFont

BASE = ('/Users/stephenhe/Development/workspace/wechatgame/games/beads/design/art/'
        'proposals/levels-20arcs-selection-20261117/')
OUT = '/tmp/a03-nine-sheet-v3.png'

ITEMS = [
    ('P01 小鱼', '4 色 · N269 · D5.08 简单 · 105s', 'A03-P01-fish/a03p01-v2fix-g28-max-28-c0-beads-plain.png'),
    ('P02 海马', '5 色 · N206 · D5.82 简单 · 73s', 'A03-P02-seahorse/a03p02s-v3-c5-max-32-c5-beads-plain.png'),
    ('P03 海豚', '6 色 · N280 · D7.12 中等 · 137s', 'A03-P03-dolphin/a03p03-v3-c6-max-32-c6-beads-plain.png'),
    ('P04 章鱼', '4 色 · N393 · D5.57 简单 · 144s', 'A03-P04-octopus/a03p04-v1fix-max-32-c0-beads-plain.png'),
    ('P05 水母', '6 色 · N325 · D7.30 中等 · 158s', 'A03-P05-jellyfish/a03p05-v3-c6-max-32-c6-beads-plain.png'),
    ('P06 海龟', '8 色 · N270 · D9.08 难 · 222s', 'A03-P06-turtle/a03p06-v3-g28-c8-max-28-c8-beads-plain.png'),
    ('P07 螃蟹', '7 色 · N238 · D7.95 中等 · 199s', 'A03-P07-crab/a03p07-v5-c7-max-32-c7-beads-plain.png'),
    ('P08 贝壳', '7 色 · N533 · D9.13 难 · 345s', 'A03-P08-shell/a03p08-v2-c7-max-32-c7-beads-plain.png'),
    ('P09 鲸之王(BOSS)', '10 色 · N735 · D12.94 超难 · 535s', 'A03-P09-whaleking/a03p09-v4c-fix4-max-42-c10-beads-plain.png'),
]

TILE, PAD, HEAD, COLS, ROWS = 640, 12, 74, 3, 3
font = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 30)
font_sub = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 24)

W = COLS * (TILE + PAD) + PAD
H = ROWS * (TILE + HEAD + PAD) + PAD
sheet = Image.new('RGB', (W, H), '#F4F2F8')
dr = ImageDraw.Draw(sheet)

for i, (t1, t2, rel) in enumerate(ITEMS):
    cx, cy = i % COLS, i // COLS
    x0 = PAD + cx * (TILE + PAD)
    y0 = PAD + cy * (TILE + HEAD + PAD)
    dr.rounded_rectangle([x0, y0, x0 + TILE, y0 + TILE + HEAD], radius=18, fill='#FFFFFF', outline='#D9D5E4')
    dr.text((x0 + 18, y0 + 10), t1, font=font, fill='#2B2B33')
    dr.text((x0 + 18, y0 + 44), t2, font=font_sub, fill='#6B6880')
    im = Image.open(BASE + rel).convert('RGB')
    im.thumbnail((TILE - 2 * PAD, TILE - 2 * PAD), Image.LANCZOS)
    sheet.paste(im, (x0 + (TILE - im.width) // 2, y0 + HEAD + (TILE - im.height) // 2))

sheet.save(OUT)
print(OUT, sheet.size)
