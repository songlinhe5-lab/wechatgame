#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性：A00 批 1（P1–P3）上送 studio（draft=1）+ PIL 平铺珠面预览。
口径沿 P09：colors=0（自动定色数）、mis=max、noframe=1、notrim=1、smooth=0、swaps=0。
用法：python3 studio-a00-batch1.py [SUF]；SUF 默认 b1（同名 board 有缓存，重跑请换 suf）。
"""
import base64
import json
import os
import sys
import urllib.request

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
BATCH = os.path.join(HERE, "batch1")
SUF = sys.argv[1] if len(sys.argv) > 1 else "b1"
CHARS = "123456789ABCDEFGH"
JOBS = [
    ("A00-P01-rings", "a00p01", 13, 12),
    ("A00-P02-wheel", "a00p02", 10, 13),
    ("A00-P03-petals4", "a00p03", 14, 14),
]

for name, tag, cols, rows in JOBS:
    d = os.path.join(BATCH, name)
    im = np.asarray(Image.open(os.path.join(d, f"{tag}-rgba.png")).convert("RGBA"))
    h, w = im.shape[:2]
    body = json.dumps({"w": w, "h": h, "data": base64.b64encode(im.tobytes()).decode()}).encode()
    url = (f"http://127.0.0.1:8787/api/generate?cols={cols}&rows={rows}&board={tag}{SUF}"
           f"&palette=10&colors=0&colorsmode=error&cellmode=mode&smooth=0&swaps=0"
           f"&noframe=1&notrim=1&mis=max&draft=1")
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
    resp = json.loads(urllib.request.urlopen(req, timeout=180).read().decode())
    json.dump(resp, open(os.path.join(d, f"studio-full-response-{SUF}.json"), "w"),
              ensure_ascii=False, indent=2)

    pat = resp["pattern"]
    pal = resp["paletteHex"]
    prows = pat if isinstance(pat, list) else pat.splitlines()
    cell = 48
    out = Image.new("RGB", (cols * cell, rows * cell), "#ECEAF3")
    draw = ImageDraw.Draw(out)
    counts = {}
    for y, row in enumerate(prows):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            counts[ch] = counts.get(ch, 0) + 1
            draw.rectangle([x * cell + 2, y * cell + 2, (x + 1) * cell - 3, (y + 1) * cell - 3],
                           fill=pal[CHARS.index(ch)])
    out.save(os.path.join(d, f"beads-plain-{SUF}.png"))

    local = json.load(open(os.path.join(d, "pattern.json")))
    same = [r for r in prows] == local["pattern"]
    verify = {
        "importable": resp.get("importable"),
        "blockers": resp.get("blockers"),
        "colorsUsed": resp.get("colorsUsed"),
        "pattern_identical_to_local": same,
        "voidCells_report": resp.get("report", {}).get("voidCells"),
        "void_pattern": sum(r.count(".") for r in prows),
        "per_color_cells": {pal[CHARS.index(c)]: n for c, n in sorted(counts.items())},
        "derangement": resp.get("report", {}).get("derangement"),
        "engine": {**{k: resp.get("levelDraft", {}).get(k) for k in ("steps", "taps", "timeEst", "cleared")},
                   "pricing": resp.get("levelDraft", {}).get("pricing")},
        "balance": {k: resp.get("report", {}).get(k) for k in
                    ("cap", "maxFreqBefore", "maxFreqAfter", "balancedChanged", "balanceNote")},
        "mis_report": resp.get("report", {}).get("mis"),
    }
    json.dump(verify, open(os.path.join(d, f"studio-full-verify-{SUF}.json"), "w"),
              ensure_ascii=False, indent=2)
    print(f"== {name}")
    print(json.dumps(verify, ensure_ascii=False, indent=2))
