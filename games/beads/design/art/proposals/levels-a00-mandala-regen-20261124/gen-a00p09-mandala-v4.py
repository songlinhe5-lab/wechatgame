#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A00-P09 曼陀罗 v4：按 prompt-v2 字面几何重画（WXG-T-1050）。

与 v3 的差别（用户 2026-11-24 令「严格照提示词重画」）：
- 外盘直径 24 格 = 画布 80%，四边留白 3 格 = 10%（v3 为 94%/3.3%）
- 8 枚湖蓝尖瓣用局部坐标定义（正向 u=max|d|,v=min|d|；斜向 u=(|dx|+|dy|)/√2,
  v=|dx-|dy||/√2），保证八瓣在网格上等形等面积；尖端止于紫环内（11.2 格），
  紫环外缘保持连续整圈（v3 蓝瓣压成环带、紫外圈只剩 8 个鼓包）
- 8 枚草绿短瓣为椭圆掩膜（22.5° 轴，与蓝瓣错开 22.5°），等形
- 黑心直径 5.1 格 = 17%（v3 为 8 格 = 27%）
- 各层半径按 G12 反解：黑 5.4% / 橙 16.1% / 黄 17.9% / 绿 19.6% / 蓝 17.9% / 紫 23.2%
  （提示词面积口径 8/16/20/18/18/20；黑按「直径 17%」执行，故面积落在点缀带 2–8%）
输出：30×30 pattern + 2048 反渲染母版（供 studio 复算 steps/mis）。
"""
import json
import math

import numpy as np
from PIL import Image

N = 30
CX = CY = (N - 1) / 2.0
R_OUT = 12.0                     # 外盘半径（直径 24 = 80%，留白 3 格 = 10%）
R_BLACK = 2.55                   # 黑心直径 5.1 = 17%
R_ORANGE = 5.6                   # 橙环外径 11.2（G12 下限所需）
R_YELLOW = 8.0                   # 黄环外径 16
R_GROOVE = 9.5                   # 绿瓣间黄槽外沿
GREEN_RC, GREEN_H, GREEN_W = 8.8, 1.8, 2.1
BLUE_U0, BLUE_U1, BLUE_W0 = 8.0, 11.2, 2.9
SQ2 = math.sqrt(2.0)
HEX = {"1": "#FDF6E9", "2": "#FFD23F", "3": "#F59B23", "4": "#3FBF6B",
       "5": "#E84C3D", "6": "#8E6FD9", "7": "#3D7BF5", "8": "#A5652C",
       "9": "#6B3E1E", "A": "#33333D"}


def blue(u, v):
    """蓝尖瓣：沿瓣轴 u 从根到尖线性收窄。"""
    if not (BLUE_U0 <= u <= BLUE_U1):
        return False
    return v <= BLUE_W0 * (BLUE_U1 - u) / (BLUE_U1 - BLUE_U0)


def build():
    grid = []
    for y in range(N):
        row = []
        for x in range(N):
            dx, dy = abs(x - CX), abs(y - CY)
            r = math.hypot(dx, dy)
            th = (math.degrees(math.atan2(CY - y, x - CX)) + 360.0) % 45.0
            a = min(th, 45.0 - th)          # 到 45° 轴（蓝瓣轴）
            b = abs(a - 22.5)               # 到 22.5° 轴（绿瓣轴）
            green = (r - GREEN_RC) ** 2 / GREEN_H ** 2 + (r * math.radians(b)) ** 2 / GREEN_W ** 2 <= 1.0
            is_blue = blue(max(dx, dy), min(dx, dy)) or blue((dx + dy) / SQ2, abs(dx - dy) / SQ2)
            if r > R_OUT:
                ch = "."
            elif r <= R_BLACK:
                ch = "A"
            elif r <= R_ORANGE:
                ch = "3"
            elif is_blue:
                ch = "7"
            elif green:
                ch = "4"
            elif r <= R_YELLOW or r <= R_GROOVE:
                ch = "2"
            else:
                ch = "6"
            row.append(ch)
        grid.append("".join(row))
    return grid


def check_sym(grid):
    bad = 0
    for y in range(N):
        for x in range(N):
            c = grid[y][x]
            for ny, nx in ((y, N - 1 - x), (N - 1 - y, x), (N - 1 - y, N - 1 - x),
                           (x, y), (x, N - 1 - y), (N - 1 - x, y), (N - 1 - x, N - 1 - y)):
                if grid[ny][nx] != c:
                    bad += 1
    return bad


def count(grid):
    cnt = {}
    for row in grid:
        for ch in row:
            if ch != ".":
                cnt[ch] = cnt.get(ch, 0) + 1
    return cnt


def render(grid, size=2048):
    arr = np.zeros((size, size, 4), dtype=np.uint8)
    cell = size / N
    for gy, row in enumerate(grid):
        for gx, ch in enumerate(row):
            if ch == ".":
                continue
            hx = HEX[ch]
            c = tuple(int(hx[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
            arr[int(gy * cell):int((gy + 1) * cell), int(gx * cell):int((gx + 1) * cell)] = c
    return Image.fromarray(arr, "RGBA")


if __name__ == "__main__":
    D = "games/beads/design/art/proposals/levels-a00-mandala-regen-20261124/A00-P09-mandala"
    grid = build()
    cnt = count(grid)
    filled = sum(cnt.values())
    print(f"filled={filled}  symmetry_violations={check_sym(grid)}")
    print({k: f"{cnt.get(k, 0)} ({cnt.get(k, 0) / filled * 100:.1f}%)" for k in ("A", "3", "2", "4", "7", "6")})
    for row in grid:
        print("  " + row)
    render(grid).save(f"{D}/a00p09-mandala-v4-rgba.png")
    json.dump({"pattern": grid, "counts": cnt, "filled": filled,
               "radii": [R_BLACK, R_ORANGE, R_YELLOW, GREEN_RC, BLUE_U0, BLUE_U1, R_OUT],
               "petals": {"green": [GREEN_RC, GREEN_H, GREEN_W], "blue": [BLUE_U0, BLUE_U1, BLUE_W0]}},
              open(f"{D}/a00p09-mandala-v4-params.json", "w"), ensure_ascii=False, indent=2)
    print("written: a00p09-mandala-v4-rgba.png / v4-params.json")
