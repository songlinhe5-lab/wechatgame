#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性：A01-P01 上送 studio（draft=1，0 次 Token Plan 调用）+ PIL 平铺珠面预览。
用法：python3 studio-a01p01-v2.py <TAG> [mis=full|max]；mis=max 时产物/board 加 -max 后缀免覆盖。
请求口径逐字沿用 v1 generation-record.txt【studio 量化】段，仅 board/mis 参数化。
预览为 plain 格渲染（非 board-render.js 珠体腿，环境无 node-canvas），色号取响应 paletteHex。"""
import base64
import json
import os
import sys
import urllib.request

import numpy as np
from PIL import Image, ImageDraw

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P01-daisy")
TAG = sys.argv[1] if len(sys.argv) > 1 else "v2"
MIS = sys.argv[2] if len(sys.argv) > 2 else "full"
SUF = TAG if MIS == "full" else f"{TAG}-{MIS}"
RGBA = os.path.join(BATCH, f"a01p01-{TAG}-s42-rgba.png")

im = np.asarray(Image.open(RGBA).convert("RGBA"))
h, w = im.shape[:2]
body = json.dumps({"w": w, "h": h, "data": base64.b64encode(im.tobytes()).decode()}).encode()
url = (f"http://127.0.0.1:8787/api/generate?cols=16&rows=16&board=a01p01{SUF}&palette=10&colors=4"
       f"&colorsmode=error&cellmode=mode&smooth=0&swaps=8&noframe=0&notrim=1&mis={MIS}&draft=1")
req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
resp = json.loads(urllib.request.urlopen(req, timeout=120).read().decode())
json.dump(resp, open(os.path.join(BATCH, f"studio-full-response-{SUF}.json"), "w"), ensure_ascii=False, indent=2)

pat = resp["pattern"]
pal = resp["paletteHex"]
rows = pat if isinstance(pat, list) else pat.splitlines()
CHARS = "123456789ABCDEFGH"
cell = 64
out = Image.new("RGB", (16 * cell, 16 * cell), "#ECEAF3")
d = ImageDraw.Draw(out)
counts = {}
for y, row in enumerate(rows):
    for x, ch in enumerate(row):
        if ch == ".":
            continue
        counts[ch] = counts.get(ch, 0) + 1
        d.rectangle([x * cell + 2, y * cell + 2, (x + 1) * cell - 3, (y + 1) * cell - 3],
                    fill=pal[CHARS.index(ch)])
out.save(os.path.join(BATCH, f"a01p01-{SUF}-beads-plain.png"))

verify = {
    "importable": resp.get("importable"),
    "blockers": resp.get("blockers"),
    "colorsUsed": resp.get("colorsUsed"),
    "paletteHex": pal,
    "voidCells_report": resp.get("report", {}).get("voidCells"),
    "void_pattern": sum(r.count(".") for r in rows),
    "per_color_cells": {pal[CHARS.index(c)]: n for c, n in sorted(counts.items())},
    "derangement": resp.get("report", {}).get("derangement"),
    "engine": {k: resp.get("levelDraft", {}).get(k) for k in ("steps", "taps", "timeEst", "cleared")},
    "balance": {k: resp.get("report", {}).get(k) for k in ("cap", "maxFreqBefore", "maxFreqAfter", "balancedChanged", "balanceNote")},
    "mis_report": resp.get("report", {}).get("mis"),
}
json.dump(verify, open(os.path.join(BATCH, f"studio-full-verify-{SUF}.json"), "w"), ensure_ascii=False, indent=2)
print(json.dumps(verify, ensure_ascii=False, indent=2))