#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A02 林中友建章转换器：studio 响应 → singles/L00021-29.json + manifest + chapters/A02.json。

映射（沿 A01/WXG-T-982 配方）：
  · levelDraft 全量字段直入（cols/rows/time/cycleProfile/pricing/decoys/swaps/pattern/misplaced）；
  · pattern/misplaced 字符 = studio 紧凑号（1..k）→ 按 report.colorLimit.kept 重映射回
    palette.json 默认色号（kept 为 1 基 demo 序号；不改母版，仅改盘面字符）；
  · 丢 skin/paletteHex，加 id/name；id = 19–27（= manifest order，A01 止于 18）。
用法：python3 build-a02-chapter.py
"""
import json
import math

PRO = "/Users/stephenhe/Development/workspace/wechatgame/games/beads/design/art/proposals/levels-20arcs-selection-20261117"
LV = "/Users/stephenhe/Development/workspace/wechatgame/games/beads/design/levels"

JOBS = [  # (dir, response, uid, id, name)
    ("A02-P01-fox", "studio-full-response-v4fix-max-32-c4.json", "L00021", 19, "狐狸"),
    ("A02-P02-bear", "studio-full-response-v4fix2-max-32-c4.json", "L00022", 20, "棕熊"),
    ("A02-P03-deer", "studio-full-response-v5fix-max-32-c4.json", "L00023", 21, "小鹿"),
    ("A02-P04-rabbit", "studio-full-response-v2fix-max-32-c4.json", "L00024", 22, "兔子"),
    ("A02-P05-squirrel", "studio-full-response-v1fix-max-32-c4.json", "L00025", 23, "松鼠"),
    ("A02-P06-hedgehog", "studio-full-response-v1fix4-max-32-c5.json", "L00026", 24, "刺猬"),
    ("A02-P07-raccoon", "studio-full-response-v1fix-max-32-c5.json", "L00027", 25, "浣熊"),
    ("A02-P08-wolf", "studio-full-response-v1fix-max-32-c5.json", "L00028", 26, "小狼"),
    ("A02-P09-deerking", "studio-full-response-v1fix4-max-32-c6.json", "L00029", 27, "鹿王"),
]

CHARS = "123456789ABCDEFGH"


def remap(rows, kept):
    out = []
    for row in rows:
        out.append("".join("." if ch == "." else CHARS[kept[int(ch) - 1] - 1] for ch in row))
    return out


for d, resp, uid, lid, name in JOBS:
    r = json.load(open(f"{PRO}/{d}/{resp}"))
    ld = r["levelDraft"]
    kept = r["report"]["colorLimit"]["kept"]  # 1 基 demo 色号
    # 门禁⑦：time = ceil(ceil(steps×secPerStep) ÷ tierK)（sync-levels-data 权威公式；
    # studio 响应的 time 是草稿值，与门禁不符会硬红）
    steps = ld["pricing"]["steps"]
    sec = ld["pricing"]["secPerStep"]
    tk = ld["pricing"]["tierK"]
    time = math.ceil(math.ceil(steps * sec) / tk)
    single = {
        "id": lid,
        "name": name,
        "cols": ld["cols"],
        "rows": ld["rows"],
        "time": time,
        "cycleProfile": ld["cycleProfile"],
        "pricing": ld["pricing"],
        "decoys": ld["decoys"],
        "pattern": remap(ld["pattern"], kept),
        "swaps": ld["swaps"],
        "misplaced": remap(ld["misplaced"], kept),
    }
    json.dump(single, open(f"{LV}/singles/{uid}.json", "w"), ensure_ascii=False, indent=2)
    print(f"{uid} {name}: id={lid} steps={steps} time={time} colors={len(kept)}")

# manifest：追加 entries + chapters + contentVersion（幂等：先清 A02 残留）
m = json.load(open(f"{LV}/manifest.json"))
uids = {uid for (_, _, uid, _, _) in JOBS}
m["entries"] = [e for e in m["entries"] if e["uid"] not in uids]
m["chapters"] = [c for c in m["chapters"] if c["id"] != "A02"]
m["contentVersion"] = 43
orders = {e["order"] for e in m["entries"]}
for (_, _, uid, lid, _) in JOBS:
    assert lid not in orders, f"order {lid} 冲突"
    m["entries"].append({"uid": uid, "kind": "boss" if uid == "L00029" else "single",
                         "file": f"singles/{uid}.json", "pack": "main", "order": lid})
m["chapters"].append({"id": "A02", "file": "chapters/A02.json", "order": 4, "open": True})
json.dump(m, open(f"{LV}/manifest.json", "w"), ensure_ascii=False, indent=2)
print("manifest: entries+9, chapters+A02, contentVersion 43")

# chapters/A02.json
json.dump({"id": "A02", "title": "林中友",
           "levels": [uid for (_, _, uid, _, _) in JOBS]},
          open(f"{LV}/chapters/A02.json", "w"), ensure_ascii=False, indent=2)
print("chapters/A02.json 写入")
