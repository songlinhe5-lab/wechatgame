#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03 五关「拆色不增珠」：从 parent pattern 合成 RGBA（每格 64px 同色），按主体内部换色。
输出 <prefix>-rgba.png 供 /tmp/a03-resize-quant.py 量化。"""
import json
import os
from collections import Counter

from PIL import Image, ImageDraw

BATCH = ('/Users/stephenhe/Development/workspace/wechatgame/games/beads/design/art/'
         'proposals/levels-20arcs-selection-20261117/')
CELL = 64

WHITE = '#FDF6E9'
GREEN = '#3FBF6B'
ROSE = '#E84C3D'
LILAC = '#8E6FD9'
BLUE = '#3D7BF5'
OCHRE = '#A5652C'
DBROWN = '#6B3E1E'
INK = '#33333D'
LEMON = '#FFD23F'
ORANGE = '#F59B23'


def load(rel):
    d = json.load(open(BATCH + rel))
    rows = d['pattern']
    pal = d['paletteHex']
    grid = [[pal[int(c) - 1] if c not in '.x' else None for c in r] for r in rows]
    return d, grid


def boundary(rows, x, y):
    R, C = len(rows), len(rows[0])
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if dx == dy == 0:
                continue
            nx, ny = x + dx, y + dy
            if not (0 <= nx < C and 0 <= ny < R) or rows[ny][nx] is None:
                return True
    return False


def neighbours(rows, x, y, color):
    R, C = len(rows), len(rows[0])
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if dx == dy == 0:
                continue
            nx, ny = x + dx, y + dy
            if 0 <= nx < C and 0 <= ny < R and rows[ny][nx] == color:
                return True
    return False


def bfs_layers(rows, color):
    """返回 {cell: 距区域边界的最短步数}（8 邻域），只统计 color 区域。"""
    from collections import deque
    R, C = len(rows), len(rows[0])
    src = {(x, y) for y in range(R) for x in range(C) if rows[y][x] == color}
    depth = {}
    dq = deque()
    for (x, y) in src:
        if any(not (0 <= x + dx < C and 0 <= y + dy < R) or rows[y + dy][x + dx] != color
               for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx, dy) != (0, 0)):
            depth[(x, y)] = 0
            dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if 0 <= nx < C and 0 <= ny < R and rows[ny][nx] == color and (nx, ny) not in depth:
                    depth[(nx, ny)] = depth[(x, y)] + 1
                    dq.append((nx, ny))
    return depth


# ─────────────────────────── 各关拆色规则 ───────────────────────────

def p02(grid):
    """海马 5 色：尾巴卷 蓝→丁香紫。"""
    for y, r in enumerate(grid):
        for x, c in enumerate(r):
            if c == BLUE and y >= 23:
                r[x] = LILAC


def p03(grid):
    """海豚 6 色：尾鳍 玫红→活力橙；蓝身上半（贴着红背一侧）→丁香紫。"""
    blue_layer = bfs_layers(grid, BLUE)
    for y, r in enumerate(grid):
        for x, c in enumerate(r):
            if c == ROSE and y >= 19 and x <= 15:
                r[x] = ORANGE
            elif c == BLUE and y >= 14:
                r[x] = LILAC


def p05(grid):
    """水母 6 色：伞顶 蓝→丁香紫；伞缘奶白带→柠黄。"""
    for y, r in enumerate(grid):
        for x, c in enumerate(r):
            if c == BLUE and y <= 4:
                r[x] = LILAC
            elif c == WHITE and y in (9, 10):
                r[x] = LEMON


def p06(grid):
    """海龟 8 色：四鳍 蓝→丁香紫；龟壳按到边界层数分 3 环（底棕/赭棕/橙/柠黄心）。"""
    # 四鳍：蓝且在外侧上/下两簇
    for y, r in enumerate(grid):
        for x, c in enumerate(r):
            if c == BLUE and (y <= 9 or 14 <= y <= 19) and (x <= 9 or x >= 18):
                r[x] = LILAC
            elif c == BLUE and y == 10 and (x <= 9 or x >= 18):
                r[x] = LILAC  # 肩部 2 格蓝孤块并入鳍色，消 tiny 块
    # 龟壳主体 = 赭棕且与中心区相连的主块（y10..18）
    shell = {(x, y) for y in range(10, 19) for x in range(len(grid[0])) if grid[y][x] == OCHRE}
    # 只保留最大连通块
    seen = set()
    best = set()
    for cell in shell:
        if cell in seen:
            continue
        stack = [cell]
        comp = set()
        seen.add(cell)
        while stack:
            cx, cy = stack.pop()
            comp.add((cx, cy))
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nb = (cx + dx, cy + dy)
                    if nb in shell and nb not in seen:
                        seen.add(nb)
                        stack.append(nb)
        if len(comp) > len(best):
            best = comp
    # 半径分层（切比雪夫）：中心→外
    cx0 = sum(x for x, _ in best) / len(best)
    cy0 = sum(y for _, y in best) / len(best)
    for (x, y) in best:
        r = max(abs(x - cx0), abs(y - cy0))
        if r <= 1.0:
            grid[y][x] = LEMON
        elif r <= 2.0:
            grid[y][x] = ORANGE
        elif r <= 3.0:
            grid[y][x] = DBROWN
        else:
            grid[y][x] = OCHRE
    # 主块之外的赭棕（底块/鳍尖）保持赭棕（原色），不并进深棕，避免鳍面碎斑
    print('  shell main blob', len(best), 'centroid', round(cx0, 1), round(cy0, 1))


def p08(grid):
    """贝壳 7 色：中央扇骨 玫红→活力橙；蓝外缘最外圈→丁香紫；奶白内芯下缘→柠黄。"""
    for y, r in enumerate(grid):
        for x, c in enumerate(r):
            if c == ROSE and 12 <= x <= 19 and y <= 11:
                r[x] = ORANGE
            elif c == BLUE and boundary(grid, x, y):
                r[x] = LILAC
            elif c == WHITE and y >= 21:
                r[x] = LEMON


JOBS = [
    ('P02', 'A03-P02-seahorse/studio-full-response-v1fix3-max-32-c0.json', 'a03p02s-v1fix3', 'a03p02s-v3-c5', p02),
    ('P03', 'A03-P03-dolphin/studio-full-response-v2fix-max-32-c0.json', 'a03p03-v2fix', 'a03p03-v3-c6', p03),
    ('P05', 'A03-P05-jellyfish/studio-full-response-v1fix-max-32-c0.json', 'a03p05-v1fix', 'a03p05-v3-c6', p05),
    ('P06', 'A03-P06-turtle/studio-full-response-a03p06-v1fix4-g28-max-28-c0.json', 'a03p06-v1fix4-g28', 'a03p06-v3-g28-c8', p06),
    ('P08', 'A03-P08-shell/studio-full-response-v1fix-max-32-c0.json', 'a03p08-v1fix', 'a03p08-v2-c7', p08),
]

for tag, rel, inbase, outbase, rule in JOBS:
    if len(__import__('sys').argv) > 1 and tag != __import__('sys').argv[1]:
        continue
    d, grid = load(rel)
    rule(grid)
    cols, rows_n = d['cols'], d['rows']
    im = Image.new('RGBA', (cols * CELL, rows_n * CELL), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    cnt = Counter()
    for y, r in enumerate(grid):
        for x, c in enumerate(r):
            if c:
                cnt[c] += 1
                dr.rectangle([x * CELL, y * CELL, (x + 1) * CELL - 1, (y + 1) * CELL - 1], fill=c)
    out = BATCH + rel.split('/')[0] + f'/{outbase}-s42-rgba.png'
    im.save(out)
    tot = sum(cnt.values())
    print(f'{tag}: N={tot} colors={len(cnt)} -> {os.path.basename(out)}')
    for c, k in cnt.most_common():
        flag = '  <<< 2% 下限告警' if k / tot < 0.02 else ''
        print(f'   {c} {k:4d} {k / tot * 100:5.1f}%{flag}')
