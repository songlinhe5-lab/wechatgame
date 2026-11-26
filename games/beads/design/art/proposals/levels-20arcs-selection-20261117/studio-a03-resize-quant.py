#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03 缩/扩盘重量化（0 次 Token Plan 调用）：复用 studio-a03.py 口径，尺寸参数化。
用法：python3 a03-resize-quant.py <关卡目录> <输入base> <输入suffix> <输出base> <cols> <rows>
"""
import base64, json, os, sys
import urllib.request

import numpy as np
from PIL import Image, ImageDraw

BATCH = '/Users/stephenhe/Development/workspace/wechatgame/games/beads/design/art/proposals/levels-20arcs-selection-20261117'
CHARS = "123456789ABCDEFGH"
CELL = 40

d, in_base, in_suf, out_base = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
cols, rows = int(sys.argv[5]), int(sys.argv[6])
colors = int(sys.argv[7]) if len(sys.argv) > 7 else 0
import glob
rgba = sorted(glob.glob(os.path.join(BATCH, d, f"{in_base}-{in_suf}-s*-rgba.png")))[0]
im = np.asarray(Image.open(rgba).convert("RGBA"))
h, w = im.shape[:2]
body = json.dumps({"w": w, "h": h, "data": base64.b64encode(im.tobytes()).decode()}).encode()
tag = f"{out_base}-max-{cols}-c{colors}"
url = (f"http://127.0.0.1:8787/api/generate?cols={cols}&rows={rows}&board={tag}&palette=10&colors={colors}"
       f"&colorsmode=error&cellmode=mode&smooth=0&swaps=0&noframe=1&notrim=1&mis=max&draft=1")
req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
resp = json.loads(urllib.request.urlopen(req, timeout=180).read().decode())
json.dump(resp, open(os.path.join(BATCH, d, f"studio-full-response-{tag}.json"), "w"), ensure_ascii=False, indent=2)

pat = resp["pattern"]
pal = resp["paletteHex"]
rows_p = pat if isinstance(pat, list) else pat.splitlines()
out = Image.new("RGB", (cols * CELL, rows * CELL), "#ECEAF3")
dr = ImageDraw.Draw(out)
counts = {}
for y, row in enumerate(rows_p):
    for x, ch in enumerate(row):
        if ch in ".x":
            continue
        counts[ch] = counts.get(ch, 0) + 1
        dr.rectangle([x * CELL + 1, y * CELL + 1, (x + 1) * CELL - 2, (y + 1) * CELL - 2], fill=pal[CHARS.index(ch)])
out.save(os.path.join(BATCH, d, f"{tag}-beads-plain.png"))

mis = resp.get("mis") or {}
print(f"{tag}: importable={resp.get('importable')} blockers={resp.get('blockers')} colorsUsed={resp.get('colorsUsed')} "
      f"N={mis.get('N')} M={mis.get('M')} F={mis.get('F')}")
p = resp.get("pricing") or {}
print("pricing", {k: p.get(k) for k in ('source', 'steps', 'stepsByCap', 'taps', 'tier', 'secPerTap', 'clamped')})
print("time", (resp.get('levelDraft') or {}).get('time'))
tot = sum(counts.values())
print("shares", {pal[CHARS.index(ch)]: round(c / tot * 100, 1) for ch, c in counts.items()})
print("report.brief", {k: (resp.get('report') or {}).get(k) for k in ('colorError', 'tinyCells', 'difficulty')})
