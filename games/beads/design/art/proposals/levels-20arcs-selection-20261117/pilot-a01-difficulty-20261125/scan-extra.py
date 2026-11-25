#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A01 试点补充扫描：指定关卡 × 指定基数（同 scan-a01-bases.py 口径）。

用法：python3 scan-extra.py P03 20 21 23 24
"""
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("scan", os.path.join(HERE, "scan-a01-bases.py"))
scan = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scan)

tag = sys.argv[1]
bases = [int(x) for x in sys.argv[2:]]
job = next(j for j in scan.JOBS if j[0] == tag)
_, d, master, colors, tier, target, name = job
png = os.path.join(scan.ROOT, d, master)
for base in bases:
    board, resp = scan.quantize(tag, png, base, colors)
    n = scan.board_n(resp)
    json.dump(resp, open(os.path.join(scan.OUT, f"{board}-response.json"), "w"),
              ensure_ascii=False, indent=2)
    pr = (resp.get("levelDraft") or {}).get("pricing") or {}
    print(json.dumps({"tag": tag, "base": base, "N": n, "colorsUsed": (resp.get("report") or {}).get("colorsUsed"),
                      "stepsByCap": pr.get("stepsByCap"), "importable": resp.get("importable"),
                      "blockers": resp.get("blockers")}, ensure_ascii=False))
