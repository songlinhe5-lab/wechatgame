#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性驱动：A01-P01 雏菊回溯 v6（用户 2026-11-18 批准路线 A：系列五令回溯＋花瓣形态语法）。
旧锁定 v5 = 8 圆瓣＋绿/棕/黄同心环心＋无茎（形态不足，回溯裁定「形态不足才重生」）。
复用 design/ai-workflows/dashscope-generate.py，不改该脚本。产物落批目录 A01-P01-daisy/。
判据正本：批目录 ../series-spec.md §2/§3/§5（G11 mis=max、G12 均衡、32 基准）；
提示词全文即下方 PROMPT（与会话公示稿逐字一致，中文）。"""
import importlib.util
import json
import os
import time

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(REPO, "games/beads/design/ai-workflows/dashscope-generate.py")
BATCH = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P01-daisy")
os.makedirs(BATCH, exist_ok=True)

spec = importlib.util.spec_from_file_location("dsg", SCRIPT)
dsg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dsg)

PROMPT = (
    "平涂矢量插画风格，单朵雏菊花头居中。外层 12 片细长花瓣均匀放射，花瓣=细长椭圆尖头，"
    "尖端带浅 V 缺口（缺口深度≥花瓣长度的 6%），瓣间缝隙露出背景；花瓣双色：主体奶白 #FDF6E9，"
    "基部赭棕 #A5652C 短带（带长≤花瓣长度的 25%）。花心=柠黄 #FFD23F 实心圆盘（直径≈花头宽的 38%），"
    "盘心深棕 #6B3E1E 小圆盘（直径≈黄盘的 40%），无任何其他同心环带。花头下方草绿 #3FBF6B 萼短桩"
    "（宽≈花头宽的 14%、高≈花头高的 6%），无细长茎、无叶。花头含瓣宽≈画布 74%、整体高≈78%，"
    "中心位于画布 40% 高度。纯平涂单色填充，无渐变、无阴影、无描边、无纹理。"
    "无文字、无水印、无边框、无花盆、无土壤、无昆虫、无其他花朵、无 3D、无摄影质感。"
    "背景纯黑 #000000（作为 mask 颜色）。"
)

params = {"prompt_extend": False, "seed": 42, "size": "2048*2048"}
key, endpoint = dsg.load_key("token-plan"), dsg.resolve("token-plan")
t0 = time.time()
resp = dsg.call("qwen-image-3.0-pro", params, PROMPT, key, endpoint)
urls = dsg.find_image_urls(resp)
assert urls, json.dumps(resp, ensure_ascii=False)[:400]
out = os.path.join(BATCH, "a01p01-v6-s42.png")
dsg.download(urls[0], out)
meta = {
    "elapsed_s": round(time.time() - t0, 1),
    "usage": resp.get("usage"),
    "request_id": resp.get("request_id"),
    "params": params,
    "prompt": PROMPT,
}
json.dump(meta, open(os.path.join(BATCH, "response-meta-v6.json"), "w"), ensure_ascii=False, indent=2)
print(f"OK {meta['elapsed_s']}s -> {out}")
print(json.dumps(meta["usage"], ensure_ascii=False))