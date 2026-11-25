#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性：A01-P01 雏菊 v7 上送 studio 32×32 量化（WXG-T-1064，0 次 Token Plan 调用）。

口径逐字沿 v6 定稿腿（studio-a02-batch1.py 同参）：cols=32&rows=32&palette=10&colors=6
&colorsmode=error&cellmode=mode&smooth=0&swaps=0&noframe=1&notrim=1&mis=max&draft=1。
额外产出一项本单专属门：**pattern 左右镜像差格数**（v6 = 153，目标 = 0）。
用法：python3 studio-a01p01-v7.py [base=32] [colors=6]
     （并发 WXG-T-1063 把 A01 重建为 16 基/c5 ⇒ 跑 `16 5` 得可直接换库的对照版）
产物：studio-full-response-<SUF>-max-<base>-c<colors>.json / 同名 verify / beads-plain
"""
import base64
import json
import os
import sys
import urllib.request

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = "a01p01-v7-s42-rgba.png"
BASE = int(sys.argv[1]) if len(sys.argv) > 1 else 32
NCOLS = int(sys.argv[2]) if len(sys.argv) > 2 else 6
SUF = "v7"
CHARS = "123456789ABCDEFGH"
CELL = max(8, 1280 // BASE)

im = np.asarray(Image.open(os.path.join(HERE, SRC)).convert("RGBA"))
h, w = im.shape[:2]
body = json.dumps({"w": w, "h": h, "data": base64.b64encode(im.tobytes()).decode()}).encode()
board = f"a01p01{SUF}-max-{BASE}-c{NCOLS}"
url = (f"http://127.0.0.1:8787/api/generate?cols={BASE}&rows={BASE}&board={board}&palette=10&colors={NCOLS}"
       f"&colorsmode=error&cellmode=mode&smooth=0&swaps=0&noframe=1&notrim=1&mis=max&draft=1")
req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
resp = json.loads(urllib.request.urlopen(req, timeout=180).read().decode())
tag = f"{SUF}-max-{BASE}-c{NCOLS}"
json.dump(resp, open(os.path.join(HERE, f"studio-full-response-{tag}.json"), "w"),
          ensure_ascii=False, indent=2)

pat = resp["pattern"]
pal = resp["paletteHex"]
rows = pat if isinstance(pat, list) else pat.splitlines()
rows = [r.ljust(max(len(x) for x in rows), ".") for r in rows]
N, M = len(rows), len(rows[0])

# 本单专属门：墨形镜像差 / 色层镜像差
ink = sum(1 for y in range(N) for x in range(M // 2) if (rows[y][x] == ".") != (rows[y][M - 1 - x] == "."))
col = sum(1 for y in range(N) for x in range(M // 2) if rows[y][x] != rows[y][M - 1 - x])

out = Image.new("RGB", (M * CELL, N * CELL), "#ECEAF3")
dr = ImageDraw.Draw(out)
counts = {}
for y, row in enumerate(rows):
    for x, ch in enumerate(row):
        if ch == ".":
            continue
        counts[ch] = counts.get(ch, 0) + 1
        dr.rectangle([x * CELL + 1, y * CELL + 1, (x + 1) * CELL - 2, (y + 1) * CELL - 2],
                     fill=pal[CHARS.index(ch)])
out.save(os.path.join(HERE, f"a01p01-{tag}-beads-plain.png"))

mis = resp.get("mis") or {}
verify = {
    "board": board, "importable": resp.get("importable"), "blockers": resp.get("blockers"),
    "voidCells": resp.get("report", {}).get("voidCells", resp.get("voidCells")),
    "colorsUsed": resp.get("colorsUsed"), "paletteHex": pal,
    "balancedChanged": resp.get("colorLimit", {}).get("balancedChanged"),
    "mis": mis, "pricing": resp.get("pricing"), "adjacency": resp.get("adjacency"),
    "symmetry": {"grid": [N, M], "ink_mirror_diff": ink, "color_mirror_diff": col,
                 "half_cells": N * (M // 2)},
    "colorErrorFinal": (resp.get("colorError") or {}).get("final")
    if isinstance(resp.get("colorError"), dict) else resp.get("colorError"),
}
json.dump(verify, open(os.path.join(HERE, f"studio-full-verify-{tag}.json"), "w"),
          ensure_ascii=False, indent=2)
beads = sum(counts.values())
print(f"board={board} beads N={beads}")
print(f"importable={resp.get('importable')} blockers={resp.get('blockers')} "
      f"colorsUsed={resp.get('colorsUsed')} voidCells={verify['voidCells']} "
      f"F={mis.get('F') if isinstance(mis, dict) else None} "
      f"steps={(resp.get('pricing') or {}).get('steps')} colorError={verify['colorErrorFinal']}")
print(f"counts={counts}")
print(f"对称门：墨形镜像差 = {ink}/{N*(M//2)}  色层镜像差 = {col}/{N*(M//2)}  "
      f"（v6 同口径 = 50 / 153）")
for r in rows:
    print(r)
assert col == 0, f"镜像门 FAIL：色层镜像差 {col} 格"
print("→ 严格左右镜像 ✓")
