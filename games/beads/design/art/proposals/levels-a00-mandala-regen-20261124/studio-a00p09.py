#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性：A00-P09 曼陀罗样张上送 studio（draft=1）+ PIL 平铺珠面预览。
用法：python3 studio-a00p09.py [SUF]；SUF 默认 v3（同名 board 有缓存，重跑请换 suf）。
口径沿 A02 批：colors=0（自动定色数）、mis=max、noframe=1、notrim=1、smooth=0、swaps=0。
"""
import base64
import json
import os
import sys
import urllib.request

import numpy as np
from PIL import Image, ImageDraw

BATCH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "A00-P09-mandala")
SUF = sys.argv[1] if len(sys.argv) > 1 else "v3"
SIZE = 30
RGBA = os.path.join(BATCH, f"a00p09-mandala-{SUF}-rgba.png")
if not os.path.exists(RGBA):
    RGBA = os.path.join(BATCH, "a00p09-mandala-v3-rgba.png")

im = np.asarray(Image.open(RGBA).convert("RGBA"))
h, w = im.shape[:2]
body = json.dumps({"w": w, "h": h, "data": base64.b64encode(im.tobytes()).decode()}).encode()
url = (f"http://127.0.0.1:8787/api/generate?cols={SIZE}&rows={SIZE}&board=a00p09{SUF}&palette=10&colors=0"
       f"&colorsmode=error&cellmode=mode&smooth=0&swaps=0&noframe=1&notrim=1&mis=max&draft=1")
req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
resp = json.loads(urllib.request.urlopen(req, timeout=120).read().decode())
json.dump(resp, open(os.path.join(BATCH, f"studio-full-response-{SUF}-max-30-c0.json"), "w"),
          ensure_ascii=False, indent=2)

pat = resp["pattern"]
pal = resp["paletteHex"]
rows = pat if isinstance(pat, list) else pat.splitlines()
CHARS = "123456789ABCDEFGH"
cell = 48
out = Image.new("RGB", (SIZE * cell, SIZE * cell), "#ECEAF3")
d = ImageDraw.Draw(out)
counts = {}
for y, row in enumerate(rows):
    for x, ch in enumerate(row):
        if ch == ".":
            continue
        counts[ch] = counts.get(ch, 0) + 1
        d.rectangle([x * cell + 2, y * cell + 2, (x + 1) * cell - 3, (y + 1) * cell - 3],
                    fill=pal[CHARS.index(ch)])
out.save(os.path.join(BATCH, f"beads-plain-{SUF}.png"))

verify = {
    "importable": resp.get("importable"),
    "blockers": resp.get("blockers"),
    "colorsUsed": resp.get("colorsUsed"),
    "paletteHex": pal,
    "voidCells_report": resp.get("report", {}).get("voidCells"),
    "void_pattern": sum(r.count(".") for r in rows),
    "per_color_cells": {pal[CHARS.index(c)]: n for c, n in sorted(counts.items())},
    "derangement": resp.get("report", {}).get("derangement"),
    "engine": {**{k: resp.get("levelDraft", {}).get(k) for k in ("steps", "taps", "timeEst", "cleared")},
               "pricing": resp.get("levelDraft", {}).get("pricing")},
    "balance": {k: resp.get("report", {}).get(k) for k in
                ("cap", "maxFreqBefore", "maxFreqAfter", "balancedChanged", "balanceNote")},
    "mis_report": resp.get("report", {}).get("mis"),
}
json.dump(verify, open(os.path.join(BATCH, f"studio-full-verify-{SUF}-max-30-c0.json"), "w"),
          ensure_ascii=False, indent=2)
print(json.dumps(verify, ensure_ascii=False, indent=2))
