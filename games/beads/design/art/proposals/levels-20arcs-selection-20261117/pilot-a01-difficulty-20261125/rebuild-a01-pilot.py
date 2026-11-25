#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A01 九关试点落库：锁定母版重量化响应 → singles/L00012–L00020.json（WXG-T-1063）。

映射沿 build-a02-chapter.py 配方：
  · levelDraft 全量直入（cols/rows/time/cycleProfile/pricing/decoys/swaps/pattern/misplaced）；
  · pattern/misplaced 字符 = studio 紧凑号 → 按 paletteHex 映射回 palette.json 十色板色号；
  · 保留 id/name；manifest contentVersion 47→48。
用法：python3 rebuild-a01-pilot.py [--dry]
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LV = os.path.abspath(os.path.join(HERE, "../../../../levels"))
CHARS = "123456789ABCDEFGH"
PAL10 = ["#FDF6E9", "#FFD23F", "#F59B23", "#3FBF6B", "#E84C3D",
         "#8E6FD9", "#3D7BF5", "#A5652C", "#6B3E1E", "#33333D"]

JOBS = [  # (uid, 响应文件, 名字)
    ("L00012", "p01-b16-c5-response.json", "雏菊"),
    ("L00013", "p02-b17-c5-response.json", "向日葵"),
    ("L00014", "p03-b27-c5-response.json", "郁金香"),
    ("L00015", "p04-b16-c5-response.json", "玫瑰"),
    ("L00016", "p05-b32-c5-response.json", "三叶草"),
    ("L00017", "p06-b32-c5-response.json", "荷花"),
    ("L00018", "p07-b30-c5-response.json", "仙人掌"),
    ("L00019", "p08-b35-c4-response.json", "蒲公英"),
    ("L00020", "p09-b43-c6-response.json", "花之王"),
]


def remap(rows, palette_hex):
    demo = [PAL10.index(h) + 1 for h in palette_hex]
    return ["".join("." if ch == "." else CHARS[demo[int(ch) - 1] - 1] for ch in row)
            for row in rows]


def main():
    dry = "--dry" in sys.argv
    for uid, resp_file, name in JOBS:
        r = json.load(open(os.path.join(HERE, "evidence", resp_file)))
        ld = r["levelDraft"]
        pr = ld["pricing"]
        time = math.ceil(math.ceil(pr["steps"] * pr["secPerStep"]) / pr["tierK"])
        path = os.path.join(LV, "singles", f"{uid}.json")
        old = json.load(open(path))
        single = {
            "id": old["id"],
            "name": name,
            "cols": ld["cols"],
            "rows": ld["rows"],
            "time": time,
            "cycleProfile": ld["cycleProfile"],
            "pricing": pr,
            "decoys": ld["decoys"],
            "pattern": remap(ld["pattern"], r["paletteHex"]),
            "swaps": ld["swaps"],
            "misplaced": remap(ld["misplaced"], r["paletteHex"]),
        }
        flat = "".join(single["pattern"])
        n = sum(1 for ch in flat if ch not in ".x")
        assert all(len(row) == single["cols"] for row in single["pattern"]), uid
        assert len(single["pattern"]) == single["rows"], uid
        print(f"{uid} {name}: {single['cols']}x{single['rows']} N={n} steps={pr['steps']} "
              f"time={time} colors={len(r['paletteHex'])}")
        if not dry:
            json.dump(single, open(path, "w"), ensure_ascii=False, indent=2)

    mpath = os.path.join(LV, "manifest.json")
    m = json.load(open(mpath))
    if not dry:
        m["contentVersion"] = 48
        json.dump(m, open(mpath, "w"), ensure_ascii=False, indent=2)
    print(f"manifest contentVersion {m['contentVersion']} -> 48")


if __name__ == "__main__":
    main()
