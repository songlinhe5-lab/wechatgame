#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A00-P09 曼陀罗：生图定形态 + 程序化重绘环（WXG-T-1050）。

形态语言取自 qwen v2 母版（同心层次 + 8 绿瓣 + 8 蓝尖 + 紫外环）。
qwen 面积比例不可控（v1 紫 39.5% / v2 紫 41.1%），故环半径由目标格数反解：
  黑 50 / 橙 100 / 黄 125 / 绿 112 / 蓝 112 / 紫 125（共 624 格）
求解口径：对 D2 = (2x-(N-1))² + (2y-(N-1))² = 4r² 做累积阈值二分，
按同心层顺序一次解出，不做「逐色加 err」迭代（旧版会发散）。
对称：所有判据只用 D2 与折叠角 a = min(θ%45, 45-θ%45)，二者在 D4 下不变 ⇒ 严格八向对称。
输出：30×30 pattern + 反渲染 2048 母版（供 studio 复算 steps/mis）。
"""
import json
import math

import numpy as np
from PIL import Image

N = 30
cy = cx = (N - 1) / 2.0
# 累积格数（624 格口径）
CUM_A, CUM_3, CUM_2CORE, CUM_BAND, CUM_RING, CUM_BLUE, CUM_FILLED = 46, 150, 247, 387, 460, 499, 624
SPIKE_CELLS = CUM_BLUE - CUM_RING          # 蓝尖占的额外格数（从紫区里挖）
GAP_HALF = 4.5                             # 瓣间黄槽半角（度），关于 45° 轴
SPIKE_HALF_BASE, SPIKE_HALF_TIP = 9.0, 3.0  # 蓝尖根部/尖端半角（度）
HEX = {"1": "#FDF6E9", "2": "#FFD23F", "3": "#F59B23", "4": "#3FBF6B",
       "5": "#E84C3D", "6": "#8E6FD9", "7": "#3D7BF5", "8": "#A5652C",
       "9": "#6B3E1E", "A": "#33333D"}


def d2_of(x, y):
    return (2 * x - (N - 1)) ** 2 + (2 * y - (N - 1)) ** 2


def r_of(d2):
    return math.sqrt(d2) / 2.0


def fold(x, y):
    """到最近 45° 轴线的夹角（0..22.5），D4 不变。"""
    th = (math.degrees(math.atan2(y - cy, x - cx)) + 360.0) % 45.0
    return min(th, 45.0 - th)


PTS = [(d2_of(x, y), fold(x, y), x, y) for y in range(N) for x in range(N)]
D2S = sorted({p[0] for p in PTS})


def pick(count_fn, target):
    """在 D2 候选值里选阈值，使 count_fn(t) 最接近 target（单调，越界即停）。"""
    best = None
    for t in D2S:
        c = count_fn(t)
        d = abs(c - target)
        if best is None or d < best[0]:
            best = (d, t)
        if c > target:
            break
    return best[1]


def count_all(t):
    return sum(1 for p in PTS if p[0] <= t)


def count_after(t0, t):
    return sum(1 for p in PTS if t0 < p[0] <= t)


def count_spike(tb, t):
    """蓝尖：tb 之外、a < 随半径线性收窄的锥角。"""
    r4, r5 = r_of(T4), r_of(T5)
    n = 0
    for d2, a, _, _ in PTS:
        if not (tb < d2 <= t):
            continue
        r = r_of(d2)
        w = SPIKE_HALF_BASE - (SPIKE_HALF_BASE - SPIKE_HALF_TIP) * min(1.0, max(0.0, (r - r4) / max(1e-6, r5 - r4)))
        if a < w:
            n += 1
    return n


def assign(t1, t2, t3, t4, tb, ts, t5, green=True):
    grid = []
    for y in range(N):
        row = []
        for x in range(N):
            d2, a = d2_of(x, y), fold(x, y)
            if d2 > t5:
                ch = "."
            elif d2 <= t1:
                ch = "A"
            elif d2 <= t2:
                ch = "3"
            elif d2 <= t3:
                ch = "2"
            elif d2 <= t4:
                ch = "4" if (green and a >= GAP_HALF) else "2"
            elif d2 <= tb:
                ch = "7"
            elif d2 <= ts:
                r = r_of(d2)
                w = SPIKE_HALF_BASE - (SPIKE_HALF_BASE - SPIKE_HALF_TIP) * min(1.0, max(0.0, (r - r_of(t4)) / max(1e-6, r_of(t5) - r_of(t4))))
                ch = "7" if a < w else "6"
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
    T5 = pick(count_all, CUM_FILLED)
    T1 = pick(count_all, CUM_A)
    T2 = pick(lambda t: count_after(T1, t), CUM_3 - CUM_A)
    T3 = pick(lambda t: count_after(T2, t), CUM_2CORE - CUM_3)
    T4 = pick(lambda t: count_after(T3, t), CUM_BAND - CUM_2CORE)
    TB = pick(lambda t: count_after(T4, t), CUM_RING - CUM_BAND)
    TS = pick(lambda t: count_spike(TB, t), SPIKE_CELLS)
    if TS <= TB:                      # 蓝尖若被环吃掉，退化为纯环
        TS = TB
    grid = assign(T1, T2, T3, T4, TB, TS, T5)
    cnt = count(grid)
    filled = sum(cnt.values())
    print(f"thresholds D2 = {T1, T2, T3, T4, TB, TS, T5}")
    print(f"radii(cells)  = {[round(r_of(t), 2) for t in (T1, T2, T3, T4, TB, TS, T5)]}")
    print(f"filled={filled}  symmetry_violations={check_sym(grid)}")
    print({k: f"{cnt.get(k, 0)} ({cnt.get(k, 0) / filled * 100:.1f}%)" for k in ("A", "3", "2", "4", "7", "6")})
    for row in grid:
        print("  " + row)
    render(grid).save(f"{D}/a00p09-mandala-v3-rgba.png")
    json.dump({"pattern": grid, "thresholds": [T1, T2, T3, T4, TB, TS, T5],
               "radii": [r_of(t) for t in (T1, T2, T3, T4, TB, TS, T5)],
               "counts": cnt, "filled": filled},
              open(f"{D}/a00p09-mandala-v3-params.json", "w"), ensure_ascii=False, indent=2)
    print("written: a00p09-mandala-v3-rgba.png / v3-params.json")
