#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A02 批 1（P1 狐 / P2 熊 / P3 鹿）上送 studio 32×32 量化（draft=1，0 次 Token Plan 调用）。

口径沿 A01-P09 定稿链：cols=32&rows=32&palette=10&colors=4&colorsmode=error&cellmode=mode
&smooth=0&swaps=0&noframe=1&notrim=1&mis=max&draft=1（A02 宪法 P1–P8 4 色）。
用法：python3 studio-a02-batch1.py
产物：每关 studio-full-response-<TAG>-max-32-c4.json / studio-full-verify-<...>.json /
      a02p0n-<TAG>-max-32-c4-beads-plain.png（PIL 平铺预览）。
"""
import base64
import json
import os
import urllib.request

import numpy as np
from PIL import Image, ImageDraw

BATCH = os.path.dirname(os.path.abspath(__file__))
JOBS = [
    ("A02-P07-raccoon", "a02p07", "v1fix", "v1fix", 5),
    ("A02-P08-wolf", "a02p08", "v1fix", "v1fix", 5),
    ("A02-P09-deerking", "a02p09", "v1fix", "v1fix", 6),
]
CHARS = "123456789ABCDEFGH"
CELL = 40  # 32×40 = 1280px 预览

for job in JOBS:
    d, base, tag, suf, ncols = job
    rgba = os.path.join(BATCH, d, f"{base}-{tag}-s42-rgba.png")
    im = np.asarray(Image.open(rgba).convert("RGBA"))
    h, w = im.shape[:2]
    body = json.dumps({"w": w, "h": h, "data": base64.b64encode(im.tobytes()).decode()}).encode()
    board = f"{base}{suf}-max-32-c{ncols}"
    url = (f"http://127.0.0.1:8787/api/generate?cols=32&rows=32&board={board}&palette=10&colors={ncols}"
           f"&colorsmode=error&cellmode=mode&smooth=0&swaps=0&noframe=1&notrim=1&mis=max&draft=1")
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Content-Type": "application/json"})
    resp = json.loads(urllib.request.urlopen(req, timeout=180).read().decode())
    json.dump(resp, open(os.path.join(BATCH, d, f"studio-full-response-{suf}-max-32-c{ncols}.json"), "w"),
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
    out.save(os.path.join(BATCH, d, f"{base}-{suf}-max-32-c{ncols}-beads-plain.png"))

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
    }
    json.dump(verify, open(os.path.join(BATCH, d, f"studio-full-verify-{suf}-max-32-c{ncols}.json"), "w"),
              ensure_ascii=False, indent=2)
    f = mis.get("F") if isinstance(mis, dict) else None
    print(f"{base}-{suf}: importable={resp.get('importable')} blockers={resp.get('blockers')} "
          f"colorsUsed={resp.get('colorsUsed')} pal={pal} F={f} "
          f"steps={(resp.get('pricing') or {}).get('steps')} "
          f"colorError={verify['colorErrorFinal']} counts={counts}")
