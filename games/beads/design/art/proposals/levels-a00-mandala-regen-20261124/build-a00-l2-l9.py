#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A00 重生成收口（用户 2026-11-24 令）：只重生 L00002（第二关）与 L00009（BOSS），
其余 A00 关保持现值不动。

数据源 = studio draft（mis=max）：L00002 用真花形重做版（10×13/4 色，A00-P02-flower2），
L00009 用已验收的 P9 曼陀罗样张（30×30/6 色）。字符经 `paletteHex → demo 十色` 重映射，
palette/paletteCodes 不再携带（新盘直接落 demo 调色板，maxIdx=10 ≤ demo 10 色）。
time 按门禁⑤ `ceil(ceil(steps×secPerStep)/tierK)` 复算（studio 自带 time 与公式不符时不采用）。
"""
import json
import math

PAL = ["#FDF6E9", "#FFD23F", "#F59B23", "#3FBF6B", "#E84C3D", "#8E6FD9",
       "#3D7BF5", "#A5652C", "#6B3E1E", "#33333D"]
CH = "123456789ABCDEFGH"
BASE = "games/beads/design/levels/singles"
ART = "games/beads/design/art/proposals/levels-a00-mandala-regen-20261124"
JOBS = [
    ("L00002", f"{ART}/A00-P02-flower2/studio-full-response-b3.json"),
    ("L00009", f"{ART}/A00-P09-mandala/studio-full-response-v4-max-30-c0.json"),
]


def lines(v):
    return v if isinstance(v, list) else v.splitlines()


for uid, resp_path in JOBS:
    resp = json.load(open(resp_path))
    ld = resp["levelDraft"]
    pal = resp["paletteHex"]
    demo = [PAL.index(h) + 1 for h in pal]

    def remap(rows):
        return ["".join("." if c == "." else CH[demo[int(c) - 1] - 1] for c in row)
                for row in lines(rows)]

    pattern = remap(ld["pattern"])
    misplaced = remap(ld["misplaced"])

    def counts(grid):
        out = {}
        for row in grid:
            for ch in row:
                if ch != ".":
                    out[ch] = out.get(ch, 0) + 1
        return out

    cp, cm = counts(pattern), counts(misplaced)
    assert cp == cm, f"{uid}: pattern/misplaced 每色珠数不守恒 {cp} vs {cm}"
    assert pattern != misplaced, f"{uid}: misplaced 与 pattern 相同（错位格缺失）"

    p = ld["pricing"]
    time = math.ceil(math.ceil(p["steps"] * p["secPerStep"]) / p.get("tierK", 1))

    old = json.load(open(f"{BASE}/{uid}.json"))
    star_tier_k = old.get("starTierK")
    out = {
        "id": old["id"],
        "name": old["name"],
        "cols": ld["cols"],
        "rows": ld["rows"],
        "time": time,
    }
    if star_tier_k is not None:
        out["starTierK"] = star_tier_k
    out |= {
        "cycleProfile": old["cycleProfile"],
        "pricing": p,
        "decoys": ld.get("decoys", []),
        "pattern": pattern,
        "swaps": [],
        "misplaced": misplaced,
    }
    with open(f"{BASE}/{uid}.json", "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{uid}: {ld['cols']}x{ld['rows']} N={sum(cp.values())} colors={len(cp)} "
          f"steps={p['steps']} time={time} (studio {ld.get('time')}) counts={cp}")

man_path = "games/beads/design/levels/manifest.json"
man = json.load(open(man_path))
man["contentVersion"] += 1
with open(man_path, "w") as f:
    json.dump(man, f, ensure_ascii=False, indent=2)
    f.write("\n")
print("contentVersion ->", man["contentVersion"])
