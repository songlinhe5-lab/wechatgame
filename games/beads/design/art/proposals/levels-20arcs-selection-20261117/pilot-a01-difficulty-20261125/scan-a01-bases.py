#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A01 九关 · 「按总珠数定档 → 反选盘面基数」试点扫描（WXG-T-1063）。

口径（用户 2026-11-25 令）：
  · 第一道门 = 总珠数 N → 四档：简单 N<150 / 中等 150–299 / 难 300–699 / 超难 ≥700；
  · 基数 = 盘面边长（cols=rows=base），限定 10–64；
  · 珠太多 ⇒ 降基数、珠太少 ⇒ 升基数；每关按心流节奏给目标 N。
  · 锁版母版 2048² RGBA 不变，只重量化（0 次 Token Plan 调用）。

用法：python3 scan-a01-bases.py [关卡代号...]
产物：pilot-a01-difficulty-20261125/out/<tag>-response.json / <tag>-beads.png
"""
import base64
import io
import json
import math
import os
import sys
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))  # → levels-20arcs-selection-20261117
OUT = os.path.join(HERE, "evidence")
CHARS = "123456789ABCDEFGH"
CELL = 24
FONT = "/System/Library/Fonts/PingFang.ttc"

# (代号, 母版文件名, colors 参数, 目标档, 目标 N, 名称)
JOBS = [
    ("P01", "A01-P01-daisy", "a01p01-v6-s42-rgba.png", 5, "简单", 120, "雏菊"),
    ("P02", "A01-P02-sunflower", "a01p02-v4-s42-rgba.png", 5, "简单", 140, "向日葵"),
    ("P03", "A01-P03-tulip", "a01p03-v2-s42-rgba.png", 5, "中等", 200, "郁金香"),
    ("P04", "A01-P04-rose", "a01p04-v2-s42-rgba.png", 5, "简单", 125, "玫瑰"),
    ("P05", "A01-P05-clover", "a01p05-v7-s42-rgba.png", 5, "中等", 250, "三叶草"),
    ("P06", "A01-P06-lotus", "a01p06-v2-s42-rgba-final.png", 5, "难", 360, "荷花"),
    ("P07", "A01-P07-cactus", "a01p07-v4-s42-rgba-final.png", 5, "中等", 280, "仙人掌"),
    ("P08", "A01-P08-dandelion", "a01p08-v1-s42-rgba-final.png", 4, "难", 520, "蒲公英"),
    ("P09", "A01-P09-flower-king", "a01p09-v1-s42-rgba-final.png", 6, "超难", 720, "花之王"),
]


def quantize(tag, png_path, base, colors):
    im = np.asarray(Image.open(png_path).convert("RGBA"))
    h, w = im.shape[:2]
    body = json.dumps({"w": w, "h": h, "data": base64.b64encode(im.tobytes()).decode()}).encode()
    board = f"{tag.lower()}-b{base}-c{colors}"
    url = (f"http://127.0.0.1:8787/api/generate?cols={base}&rows={base}&board={board}"
           f"&palette=10&colors={colors}&colorsmode=error&cellmode=mode&smooth=0&swaps=0"
           f"&noframe=1&notrim=1&mis=max&draft=1")
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Content-Type": "application/json"})
    return board, json.loads(urllib.request.urlopen(req, timeout=300).read().decode())


def board_n(resp):
    pat = resp["pattern"]
    rows = pat if isinstance(pat, list) else pat.splitlines()
    return sum(1 for row in rows for ch in row if ch not in ".x")


def render(resp, path):
    pat = resp["pattern"]
    pal = resp["paletteHex"]
    rows = pat if isinstance(pat, list) else pat.splitlines()
    n = len(rows)
    out = Image.new("RGB", (n * CELL, n * CELL), "#ECEAF3")
    dr = ImageDraw.Draw(out)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            dr.rectangle([x * CELL + 1, y * CELL + 1, (x + 1) * CELL - 2, (y + 1) * CELL - 2],
                         fill=pal[CHARS.index(ch)])
    out.save(path)
    return out


def main():
    want = set(sys.argv[1:])
    os.makedirs(OUT, exist_ok=True)
    picked = []
    for tag, d, master, colors, tier, target, name in JOBS:
        if want and tag not in want:
            continue
        png = os.path.join(ROOT, d, master)
        est = max(10, min(64, round(32 * math.sqrt(target / 420))))
        best = None
        tries = []
        base = est
        for _ in range(4):
            board, resp = quantize(tag, png, base, colors)
            n = board_n(resp)
            tries.append((base, n))
            json.dump(resp, open(os.path.join(OUT, f"{board}-response.json"), "w"),
                      ensure_ascii=False, indent=2)
            if best is None or abs(n - target) < abs(best[1] - target):
                best = (base, n, resp)
            if abs(n - target) <= max(6, target * 0.05):
                break
            nb = max(10, min(64, round(base * math.sqrt(target / max(n, 1)))))
            if nb == base:
                nb = base + (1 if n < target else -1)
            base = nb
        base, n, resp = best
        bpath = os.path.join(OUT, f"{tag}-b{base}-c{colors}-beads.png")
        render(resp, bpath)
        pr = resp.get("pricing") or {}
        picks = {"tag": tag, "name": name, "master": master, "colors": colors,
                 "tier": tier, "targetN": target, "base": base, "N": n,
                 "stepsByCap": pr.get("stepsByCap"), "steps24": (pr.get("stepsByCap") or {}).get("24"),
                 "tries": tries,
                 "blockers": resp.get("blockers"), "importable": resp.get("importable"),
                 "colorsUsed": resp.get("colorsUsed"), "misF": (resp.get("mis") or {}).get("F")}
        picked.append(picks)
        print(json.dumps(picks, ensure_ascii=False))
    json.dump(picked, open(os.path.join(OUT, "picks.json"), "w"), ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
