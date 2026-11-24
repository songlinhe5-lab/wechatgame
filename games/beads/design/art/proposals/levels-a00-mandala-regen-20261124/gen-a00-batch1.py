#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A00 批 1（L00001–L00003）曼陀罗重生生成器（WXG-T-1050）。

盘面/色数沿用现值：13×12 3 色、10×13 4 色、14×14 3 色。
非方盘用椭圆适配（半轴贴边留 0.2–0.3 格），方盘用圆；环半径与象限占比按目标格数反解。
对称：P1 三环 = D2；P2 四象限四色 = 中心对称（4 色互异无镜像，见记录）；P3 四瓣 = D4。

用法：python3 gen-a00-batch1.py
输出：batch1/A00-P0X-*/pattern.json + a00p0x-rgba.png（2048 反渲染，供 studio）
"""
import json
import math
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "batch1")
HEX = {"1": "#FDF6E9", "2": "#FFD23F", "3": "#F59B23", "4": "#3FBF6B",
       "5": "#E84C3D", "6": "#8E6FD9", "7": "#3D7BF5", "8": "#A5652C",
       "9": "#6B3E1E", "A": "#33333D"}


def make_points(cols, rows, a, b):
    cx, cy = (cols - 1) / 2.0, (rows - 1) / 2.0
    pts = []
    for y in range(rows):
        for x in range(cols):
            dx, dy = x - cx, y - cy
            pts.append((((dx / a) ** 2 + (dy / b) ** 2), dx, dy, x, y))
    return pts


def cut(pts, target, key=lambda p: p[0]):
    vals = sorted({key(p) for p in pts})
    best = None
    for v in vals:
        c = sum(1 for p in pts if key(p) <= v)
        d = abs(c - target)
        if best is None or d < best[0]:
            best = (d, v)
        if c > target:
            break
    return best[1]


def counts(grid):
    c = {}
    for row in grid:
        for ch in row:
            if ch != ".":
                c[ch] = c.get(ch, 0) + 1
    return c


def blocks(grid):
    rows, cols = len(grid), len(grid[0])
    seen = [[0] * cols for _ in range(rows)]
    per = {}
    for y in range(rows):
        for x in range(cols):
            if grid[y][x] == "." or seen[y][x]:
                continue
            ch = grid[y][x]
            stack = [(y, x)]
            seen[y][x] = 1
            n = 0
            while stack:
                cy, cx = stack.pop()
                n += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < rows and 0 <= nx < cols and not seen[ny][nx] and grid[ny][nx] == ch:
                        seen[ny][nx] = 1
                        stack.append((ny, nx))
            per.setdefault(ch, []).append(n)
    return per


def render(grid, size=2048):
    rows, cols = len(grid), len(grid[0])
    arr = np.zeros((size, size, 4), dtype=np.uint8)
    for gy, row in enumerate(grid):
        y0, y1 = int(gy * size / rows), int((gy + 1) * size / rows)
        for gx, ch in enumerate(row):
            if ch == ".":
                continue
            hx = HEX[ch]
            arr[y0:y1, int(gx * size / cols):int((gx + 1) * size / cols)] = tuple(
                int(hx[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
    return Image.fromarray(arr, "RGBA")


def dump(name, cols, rows, grid, extra):
    d = os.path.join(OUT, name)
    os.makedirs(d, exist_ok=True)
    c = counts(grid)
    b = blocks(grid)
    tot = sum(c.values())
    nb = sum(len(v) for v in b.values())
    print(f"== {name} {cols}x{rows} filled={tot} colors={len(c)} T2={nb / len(c):.2f}")
    print("   ", {k: f"{v} ({v / tot * 100:.1f}%)" for k, v in sorted(c.items())})
    print("    blocks", {k: sorted(v, reverse=True) for k, v in sorted(b.items())})
    for row in grid:
        print("   " + row)
    json.dump({"cols": cols, "rows": rows, "pattern": grid, "counts": c,
               "blocks": {k: sorted(v, reverse=True) for k, v in b.items()}, **extra},
              open(os.path.join(d, "pattern.json"), "w"), ensure_ascii=False, indent=2)
    render(grid).save(os.path.join(d, "a00%s-rgba.png" % name.split("-")[1].lower()))


# ---- P1：13×12 三环（柠黄/活力橙/湖蓝）33/33/33 ----
# 实测：qf 取 104 时占比 32/34/34（spread 2.0）；薄环在 4 连通下断成 4 段弧（数字圆固有），
# 环角 4 个单格孤点按 T3 判噪点，直接剪除（对称剪）→ 弧长 8、bbox 两边 ≥2，T4=0。
def build_p1():
    cols, rows = 13, 12
    pts = make_points(cols, rows, 5.5, 5.0)
    q1 = cut(pts, 33)
    q2 = cut(pts, 67)
    qf = cut(pts, 104)
    gg = [["." if q > qf else "2" if q <= q1 else "3" if q <= q2 else "7"
           for q, dx, dy, x, y2 in [p for p in pts if p[4] == y]] for y in range(rows)]
    for y in range(rows):
        for x in range(cols):
            ch = gg[y][x]
            if ch == ".":
                continue
            if not any(0 <= y + dy < rows and 0 <= x + dx < cols and gg[y + dy][x + dx] == ch
                       for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                gg[y][x] = "."
    grid = ["".join(row) for row in gg]
    dump("A00-P01-rings", cols, rows, grid, {"a": 5.5, "b": 5.0, "q": [q1, q2, qf]})


# ---- P2：10×13 四象限四色（椭盘）25% 各一 ----
def build_p2():
    cols, rows = 10, 13
    pts = make_points(cols, rows, 4.6, 6.0)
    qf = cut(pts, 86)
    cols4 = ["5", "2", "4", "1"]
    grid = []
    for y in range(rows):
        row = []
        for q, dx, dy, x, y2 in [p for p in pts if p[4] == y]:
            if q > qf:
                row.append(".")
            else:
                th = (math.degrees(math.atan2(dy, dx)) + 360.0) % 360.0
                row.append(cols4[int(th // 90)])
        grid.append("".join(row))
    dump("A00-P02-wheel", cols, rows, grid, {"a": 4.6, "b": 6.0, "q": [qf]})


# ---- P3：14×14 内盘 + 中环 + 4 对角瓣（丁香紫/柠黄/草绿）33/33/33 ----
# 实测：qA=40/qP=86/RATIO=0.75/qf=156 → 44/44/44，T2=2.0（4 瓣各 11 格，均 ≥3×3 可读）。
# 瓣放在环外（q>qP）→ 环保持完整 1 块；4 色瓣天然 4 块，T2 恰 2.0。
def build_p3():
    cols = rows = 14
    pts = make_points(cols, rows, 6.3, 6.3)
    qA = cut(pts, 40)
    qP = cut(pts, 86)
    qf = cut(pts, 156)
    RATIO = 0.75
    grid = []
    for y in range(rows):
        row = []
        for q, dx, dy, x, y2 in [p for p in pts if p[4] == y]:
            if q > qf:
                row.append(".")
            elif q <= qA:
                row.append("6")
            elif q <= qP:
                row.append("2")
            elif abs(abs(dx) - abs(dy)) <= RATIO * max(abs(dx), abs(dy)):
                row.append("4")
            else:
                row.append(".")
        grid.append("".join(row))
    dump("A00-P03-petals4", cols, rows, grid, {"a": 6.3, "b": 6.3, "q": [qA, qP, qf], "petalRatio": RATIO})


if __name__ == "__main__":
    build_p1()
    build_p2()
    build_p3()
