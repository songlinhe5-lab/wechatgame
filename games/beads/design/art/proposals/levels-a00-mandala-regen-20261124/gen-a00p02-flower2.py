#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A00-P02 v2 真花形生成器（WXG-T-1050，2026-11-24 用户裁定「重做真花形，尺寸色数不变」）。

10×13、四色（奶白 1 / 柠黄 2 / 草绿 4 / 玫红 5）：
  圆花冠（玫红外缘 + 奶白内环 + 柠黄花心）+ 绿茎双叶。
约束：G12 每色 15–35%；T1 珠/块 ≥9；T2 块/色 ≤2；T3/T4 零孤点细丝；T6 主体单连通。
用法：python3 gen-a00p02-flower2.py [--studio b3]
输出：A00-P02-flower2/pattern.json + a00p02b-rgba.png（2048，供 studio）
"""
import json
import math
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "A00-P02-flower2")
HEX = {"1": "#FDF6E9", "2": "#FFD23F", "3": "#F59B23", "4": "#3FBF6B",
       "5": "#E84C3D", "6": "#8E6FD9", "7": "#3D7BF5", "8": "#A5652C",
       "9": "#6B3E1E", "A": "#33333D"}


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


def parts(grid):
    rows, cols = len(grid), len(grid[0])
    seen = [[0] * cols for _ in range(rows)]
    out = []
    for y in range(rows):
        for x in range(cols):
            if grid[y][x] == "." or seen[y][x]:
                continue
            stack = [(y, x)]
            seen[y][x] = 1
            n = 0
            while stack:
                cy, cx = stack.pop()
                n += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < rows and 0 <= nx < cols and not seen[ny][nx] and grid[ny][nx] != ".":
                        seen[ny][nx] = 1
                        stack.append((ny, nx))
            out.append(n)
    return sorted(out, reverse=True)


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


COLS, ROWS = 10, 13
CX, CY = 4.5, 4.3
COROLLA_R = 4.5
CORE_Q, RING_Q = 0.45, 0.70  # 花心 / 奶白内环 的归一化半径
STEM = [(4, 9), (5, 9), (4, 10), (5, 10)]
LEAF_L = (2.0, 10.8, 2.05, 1.5)  # cx, cy, rx, ry
LEAF_R = (7.0, 10.8, 2.05, 1.5)


def in_leaf(x, y, leaf):
    lx, ly, rx, ry = leaf
    return ((x - lx) / rx) ** 2 + ((y - ly) / ry) ** 2 <= 1.0


def build():
    grid = [["."] * COLS for _ in range(ROWS)]
    for y in range(ROWS):
        for x in range(COLS):
            q = math.hypot(x - CX, y - CY) / COROLLA_R
            if q <= CORE_Q:
                grid[y][x] = "2"
            elif q <= RING_Q:
                grid[y][x] = "1"
            elif q <= 1.0:
                grid[y][x] = "5"
    for x, y in STEM:
        grid[y][x] = "4"
    for y in range(ROWS):
        for x in range(COLS):
            if in_leaf(x, y, LEAF_L) or in_leaf(x, y, LEAF_R):
                grid[y][x] = "4"
    return ["".join(r) for r in grid]


if __name__ == "__main__":
    import base64
    import sys
    import urllib.request

    os.makedirs(OUT, exist_ok=True)
    grid = build()
    c = counts(grid)
    b = blocks(grid)
    tot = sum(c.values())
    nb = sum(len(v) for v in b.values())
    print(f"10x13 filled={tot} colors={len(c)} T1={tot / nb:.1f} T2={nb / len(c):.2f}")
    print({k: f"{v} ({v / tot * 100:.1f}%)" for k, v in sorted(c.items())})
    print("blocks", {k: sorted(v, reverse=True) for k, v in sorted(b.items())})
    print("parts", parts(grid))
    for row in grid:
        print(" " + row)
    json.dump({"cols": COLS, "rows": ROWS, "pattern": grid, "counts": c,
               "blocks": {k: sorted(v, reverse=True) for k, v in b.items()},
               "corolla": {"r": COROLLA_R, "c": [CX, CY]}, "bands": [CORE_Q, RING_Q]},
              open(os.path.join(OUT, "pattern.json"), "w"), ensure_ascii=False, indent=2)
    png = os.path.join(OUT, "a00p02b-rgba.png")
    render(grid).save(png)
    if "--studio" in sys.argv:
        suf = sys.argv[sys.argv.index("--studio") + 1] if len(sys.argv) > sys.argv.index("--studio") + 1 else "b2"
        im = np.asarray(Image.open(png).convert("RGBA"))
        h, w = im.shape[:2]
        body = json.dumps({"w": w, "h": h, "data": base64.b64encode(im.tobytes()).decode()}).encode()
        url = (f"http://127.0.0.1:8787/api/generate?cols={COLS}&rows={ROWS}&board=a00p02b{suf}"
               f"&palette=10&colors=0&colorsmode=error&cellmode=mode&smooth=0&swaps=0"
               f"&noframe=1&notrim=1&mis=max&draft=1")
        req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
        resp = json.loads(urllib.request.urlopen(req, timeout=180).read().decode())
        json.dump(resp, open(os.path.join(OUT, f"studio-full-response-{suf}.json"), "w"),
                  ensure_ascii=False, indent=2)
        print("studio:", json.dumps({k: resp.get(k) for k in ("importable", "colorsUsed", "blockers")}, ensure_ascii=False),
              "steps", resp.get("levelDraft", {}).get("pricing", {}).get("steps"),
              "palette", resp.get("paletteHex"))
