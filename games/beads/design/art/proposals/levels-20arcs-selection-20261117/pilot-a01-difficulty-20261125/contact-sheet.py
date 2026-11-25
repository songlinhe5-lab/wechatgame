#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A01 试点 · 九关终选珠面拼版（呈样用）。

终选（心流节奏 易易中易中难中难超难，2026-11-25）：
  P01 b16 / P02 b17 / P03 b27 / P04 b16 / P05 b32 / P06 b32 / P07 b30 / P08 b35 / P09 b43
产物：out/contact-sheet.png（3×3）+ out/final-picks.json
"""
import json
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "evidence")
CHARS = "123456789ABCDEFGH"
CELL = 32
PAD = 10
LABEL_H = 34
FONT_PATH = "/System/Library/Fonts/PingFang.ttc"

FINAL = [
    ("P01", 16, 5, "雏菊", "简单"),
    ("P02", 17, 5, "向日葵", "简单"),
    ("P03", 27, 5, "郁金香", "中等"),
    ("P04", 16, 5, "玫瑰", "简单"),
    ("P05", 32, 5, "三叶草", "中等"),
    ("P06", 32, 5, "荷花", "难"),
    ("P07", 30, 5, "仙人掌", "中等"),
    ("P08", 35, 4, "蒲公英", "难"),
    ("P09", 43, 6, "花之王", "超难"),
]


def font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except OSError:
        return ImageFont.load_default()


def render_board(resp):
    pat = resp["pattern"]
    pal = resp["paletteHex"]
    rows = pat if isinstance(pat, list) else pat.splitlines()
    n = len(rows)
    img = Image.new("RGB", (n * CELL, n * CELL), "#ECEAF3")
    dr = ImageDraw.Draw(img)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            dr.rectangle([x * CELL + 1, y * CELL + 1, (x + 1) * CELL - 2, (y + 1) * CELL - 2],
                         fill=pal[CHARS.index(ch)])
    return img


def main():
    cells = []
    picks = []
    f = font(20)
    f2 = font(15)
    for tag, base, colors, name, tier in FINAL:
        resp = json.load(open(os.path.join(OUT, f"{tag.lower()}-b{base}-c{colors}-response.json")))
        img = render_board(resp)
        ld = resp["levelDraft"]
        rep = resp.get("report") or {}
        pr = ld["pricing"]
        flat = "".join(ld["pattern"])
        n = sum(1 for ch in flat if ch not in ".x")
        steps24 = pr["stepsByCap"]["24"]
        cells.append((img, f"{name} {base}×{base} N={n} {tier}"))
        picks.append({"tag": tag, "name": name, "master": resp.get("board"), "base": base,
                      "colorsParam": colors, "N": n, "tier": tier,
                      "colorsUsed": rep.get("colorsUsed"),
                      "voidCells": rep.get("voidCells"),
                      "derangement": rep.get("derangement"),
                      "stepsByCap": pr.get("stepsByCap"), "steps24": steps24,
                      "importable": resp.get("importable"), "blockers": resp.get("blockers"),
                      "tinyCells": (rep.get("clusteringAfter") or {}).get("tinyCells")})
    side = max(c[0].width for c in cells)
    label_h = 56
    sheet = Image.new("RGB", (3 * (side + PAD) + PAD, 3 * (side + label_h + PAD) + PAD), "#2B2B33")
    dr = ImageDraw.Draw(sheet)
    for i, (img, label) in enumerate(cells):
        r, c = divmod(i, 3)
        x = PAD + c * (side + PAD)
        y = PAD + r * (side + label_h + PAD)
        sheet.paste(img, (x, y))
        dr.text((x + 2, y + side + 4), label, fill="#FDF6E9", font=f)
        dr.text((x + 2, y + side + 30), f"steps24={picks[i]['steps24']} colors={picks[i]['colorsUsed']}",
                fill="#A9A6B8", font=f2)
    sheet.save(os.path.join(OUT, "contact-sheet.png"))
    json.dump(picks, open(os.path.join(OUT, "final-picks.json"), "w"), ensure_ascii=False, indent=2)
    for p in picks:
        print(json.dumps(p, ensure_ascii=False))


if __name__ == "__main__":
    main()
