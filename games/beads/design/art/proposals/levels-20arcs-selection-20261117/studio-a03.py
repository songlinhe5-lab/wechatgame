#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03 深海湾 · 单关上送 studio 32×32 量化（draft=1，0 次 Token Plan 调用）。

口径沿 A02 定稿链：cols=32&rows=32&palette=10&colors=0&colorsmode=error&cellmode=mode
&smooth=0&swaps=0&noframe=1&notrim=1&mis=max&draft=1（A03 宪法 4–5 色，colors=0 自适应）。
用法：python3 studio-a03.py <关卡目录> <base> <suffix>
  例：python3 studio-a03.py A03-P01-fish a03p01 v2
产物（写回关卡目录）：studio-full-response-<suf>-max-32-c0.json /
      studio-full-verify-<suf>-max-32-c0.json / <base>-<suf>-max-32-c0-beads-plain.png
"""
import base64
import json
import os
import sys
import urllib.request

import numpy as np
from PIL import Image, ImageDraw

BATCH = os.path.dirname(os.path.abspath(__file__))
CHARS = "123456789ABCDEFGH"
CELL = 40

d, base, suf = sys.argv[1], sys.argv[2], sys.argv[3]
rgba = os.path.join(BATCH, d, f"{base}-{suf}-s42-rgba.png")
im = np.asarray(Image.open(rgba).convert("RGBA"))
h, w = im.shape[:2]
body = json.dumps({"w": w, "h": h, "data": base64.b64encode(im.tobytes()).decode()}).encode()
board = f"{base}-{suf}-max-32-c0"
url = (f"http://127.0.0.1:8787/api/generate?cols=32&rows=32&board={board}&palette=10&colors=0"
       f"&colorsmode=error&cellmode=mode&smooth=0&swaps=0&noframe=1&notrim=1&mis=max&draft=1")
req = urllib.request.Request(url, data=body, method="POST",
                             headers={"Content-Type": "application/json"})
resp = json.loads(urllib.request.urlopen(req, timeout=180).read().decode())
json.dump(resp, open(os.path.join(BATCH, d, f"studio-full-response-{suf}-max-32-c0.json"), "w"),
          ensure_ascii=False, indent=2)

pat = resp["pattern"]
pal = resp["paletteHex"]
rows = pat if isinstance(pat, list) else pat.splitlines()
out = Image.new("RGB", (32 * CELL, 32 * CELL), "#ECEAF3")
dr = ImageDraw.Draw(out)
counts = {}
for y, row in enumerate(rows):
    for x, ch in enumerate(row):
        if ch == ".":
            continue
        counts[ch] = counts.get(ch, 0) + 1
        dr.rectangle([x * CELL + 1, y * CELL + 1, (x + 1) * CELL - 2, (y + 1) * CELL - 2],
                     fill=pal[CHARS.index(ch)])
out.save(os.path.join(BATCH, d, f"{base}-{suf}-max-32-c0-beads-plain.png"))

mis = resp.get("mis") or {}
verify = {
    "board": board,
    "importable": resp.get("importable"),
    "blockers": resp.get("blockers"),
    "voidCells": resp.get("report", {}).get("voidCells", resp.get("voidCells")),
    "colorsUsed": resp.get("colorsUsed"),
    "paletteHex": pal,
    "balancedChanged": resp.get("colorLimit", {}).get("balancedChanged", resp.get("balancedChanged")),
    "mis": mis,
    "pricing": resp.get("pricing"),
    "adjacency": resp.get("adjacency"),
    "colorErrorFinal": (resp.get("colorError") or {}).get("final") if isinstance(resp.get("colorError"), dict) else resp.get("colorError"),
    "report": resp.get("report"),
}
json.dump(verify, open(os.path.join(BATCH, d, f"studio-full-verify-{suf}-max-32-c0.json"), "w"),
          ensure_ascii=False, indent=2)

tot = sum(counts.values())
shares = {pal[CHARS.index(ch)]: round(c / tot * 100, 1) for ch, c in counts.items()}
print(f"{base}-{suf}: importable={resp.get('importable')} blockers={resp.get('blockers')} "
      f"colorsUsed={resp.get('colorsUsed')} F={mis.get('F')} steps={(resp.get('pricing') or {}).get('steps')} "
      f"colorError={verify['colorErrorFinal']}")
print("palette", pal)
print("shares", shares)
print("report", json.dumps(resp.get("report"), ensure_ascii=False))
