#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A02 批 2（P4 兔 / P5 松鼠 / P6 刺猬）上送 studio 32×32 量化（draft=1，0 次 Token Plan 调用）。

口径沿批 1 定稿链：cols=32&rows=32&palette=10&colors=0&colorsmode=error&cellmode=mode
&smooth=0&swaps=0&noframe=1&notrim=1&mis=max&draft=1；colors=0 = 全色板投票
（坑①：k-means 会吸并炭黑小簇，用母版 snap 色板精确色后 colors=0 兜底）。
坑③：/api/generate 同名 board 疑似缓存，suf 统一加 a 后缀换名。
用法：python3 studio-a02-batch2.py
产物：每关 studio-full-response-<suf>-max-32-c0.json / studio-full-verify-<...>.json /
      a02p0n-<suf>-max-32-c0-beads-plain.png（PIL 平铺预览）。
"""
import base64
import json
import os
import urllib.request

import numpy as np
from PIL import Image, ImageDraw

BATCH = os.path.dirname(os.path.abspath(__file__))
JOBS = [
    ("A02-P04-rabbit", "a02p04", "v4fix", "v4fixa", 0),
    ("A02-P05-squirrel", "a02p05", "v2fix", "v2fixa", 0),
    ("A02-P06-hedgehog", "a02p06", "v3fix", "v3fixa", 0),
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
    total = sum(counts.values())
    shares = {pal[CHARS.index(ch)]: f"{100*c/total:.1f}%" for ch, c in sorted(counts.items(), key=lambda kv: -kv[1])}
    f = mis.get("F") if isinstance(mis, dict) else None
    print(f"{base}-{suf}: importable={resp.get('importable')} blockers={resp.get('blockers')} "
          f"colorsUsed={resp.get('colorsUsed')} steps={(resp.get('pricing') or {}).get('steps')} "
          f"colorError={verify['colorErrorFinal']} 占比={shares}")
