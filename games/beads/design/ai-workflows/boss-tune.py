#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
temp/boss-tune.py —— 验证「3.0-pro 能否调到 wan2.7 那种线条更粗、豆子更连贯的效果」。

两条旋钮：
  ① 源图提示词（生图端）：白带宽 one cell → two cells；限色到 5；要求大色块连贯。
  ② studio smooth（转化端）：众数滤波轮数 0 → 2，把孤立碎豆并成大块。

连贯度指标 speckle = 无可同色正交邻居的「孤立豆」占可填格比例，越低越连贯。

复用 studio-batch-report.py 的 start_server / http_json / png_to_raw，不另写服务与自检。
"""
import importlib.util as ilu
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))


def _load(mod_name, path):
    spec = ilu.spec_from_file_location(mod_name, path)
    m = ilu.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


sbr = _load("sbr", os.path.join(HERE, "studio-batch-report.py"))       # start_server/http_json/png_to_raw/render_board/dominant
dsb = _load("dsb", os.path.join(HERE, "dashscope-generate.py"))         # load_key/load_boss_prompt/call/download/MODELS

REPO = sbr.REPO  # 复用 studio-batch-report 已解析的仓库根（向上找 pnpm-workspace.yaml）

SET_DIR = os.path.join(REPO, "temp", "dashscope-boss-set")
OUT_DIR = os.path.join(REPO, "temp", "boss-tune")


def tuned_prompt():
    b = dsb.load_boss_prompt()
    b = b.replace("as wide as one cell of a 32 by 32 grid",
                  "as wide as two cells of a 32 by 32 grid")
    b += (", using only five distinct flat colors in total, each color forming one "
          "large solid contiguous block with no scattered single beads and no dithering")
    return b


def gen_regenerate(prompt, out_png):
    key = dsb.load_key()
    resp = dsb.call("qwen-image-3.0-pro", {"prompt_extend": True}, prompt, key)
    urls = dsb.find_image_urls(resp)
    if not urls:
        raise RuntimeError(f"无图 URL：{json.dumps(resp, ensure_ascii=False)[:300]}")
    dsb.download(urls[0], out_png)


def speckle(pat):
    R = len(pat)
    C = max((len(r) for r in pat), default=0)
    def cell(y, x): return pat[y][x] if y < R and x < len(pat[y]) else "."
    fill = iso = 0
    for y in range(R):
        for x in range(C):
            c = cell(y, x)
            if not c.isdigit():
                continue
            fill += 1
            nb = [cell(y + dy, x + dx) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if c not in nb:
                iso += 1
    return (100.0 * iso / fill if fill else 0.0), fill


def run_generate(base, png, smooth):
    raw = sbr.png_to_raw(png)
    from urllib.parse import urlencode
    q = urlencode({"cols": 32, "rows": 32, "palette": "artkal-s", "colors": 8,
                   "mis": "full", "noframe": "0", "smooth": str(smooth),
                   "cellmode": "mode", "swaps": "8", "colorsmode": "error",
                   "premedian": "0", "shape": "square", "skin": "warm-paper"})
    st, j = sbr.http_json("POST", f"{base}/api/generate?{q}", raw)
    if st != 200 or "pattern" not in j:
        return None
    pat = j["pattern"]
    mx, tot, pct, nc = sbr.dominant(pat)
    sp, fill = speckle(pat)
    rep = j.get("report") or {}
    return {"colors": rep.get("colorsUsed", nc), "dom": pct, "speckle": sp,
            "fill": fill, "id": j.get("id"), "pat": pat, "pal": j.get("paletteHex") or []}


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    tuned_png = os.path.join(SET_DIR, "level-09-qwen30_tuned.png")
    print("[tune] 重生 3.0-pro（白带宽 2 格 + 限色 5 + 大色块）…")
    gen_regenerate(tuned_prompt(), tuned_png)
    print(f"  → {os.path.relpath(tuned_png, REPO)}")

    cases = [
        ("3.0-pro 原", os.path.join(SET_DIR, "level-09-qwen_image_30_pro.png"), 0),
        ("3.0-pro 调prompt", tuned_png, 0),
        ("3.0-pro 调prompt+smooth2", tuned_png, 2),
        ("wan2.7 基准", os.path.join(SET_DIR, "level-09-wan27_image.png"), 0),
    ]
    srv = sbr.start_server(18801)
    base = "http://127.0.0.1:18801"
    print(f"\n{'case':<26}{'色数':<6}{'主导%':<8}{'speckle%(孤立豆)':<18}{'可填格'}")
    rows = []
    try:
        for label, png, smooth in cases:
            r = run_generate(base, png, smooth)
            if not r:
                print(f"{label:<26}  生成失败/拒产"); continue
            print(f"{label:<26}{r['colors']:<6}{r['dom']:<8.0f}{r['speckle']:<18.1f}{r['fill']}")
            rows.append((label, png, smooth, r))
    finally:
        srv.kill()
    # 渲染调优版对位盘（供目验）
    for label, png, smooth, r in rows:
        if label == "3.0-pro 调prompt":
            sbr.render_board(r["pat"], r["pal"], os.path.join(OUT_DIR, "tuned.solved.png"),
                             "3.0-pro 调优后（白带宽 2 格 + 限色 5）· 对位")
    json.dump([{"label": l, "speckle": round(x['speckle'], 1), "colors": x['colors'],
                "dom": round(x['dom'], 1)} for l, _, _, x in rows],
              open(os.path.join(OUT_DIR, "tune-metrics.json"), "w"), ensure_ascii=False, indent=2)
    print(f"\n指标 → {os.path.relpath(os.path.join(OUT_DIR, 'tune-metrics.json'), REPO)}")


if __name__ == "__main__":
    main()
