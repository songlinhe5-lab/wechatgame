#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性驱动：A01-P07 仙人掌 v2（用户 2026-11-21 批准方案）。
v1 失败：G9 35.8%×87%（太窄太高）、32×32 仅 3 色。v2 双短臂撑宽 72%、宽纵棱、
两层花（橙外瓣+白内盘+黄花心）、花盆加宽 64%，保证 5 色与 F=0。
复用 design/ai-workflows/dashscope-generate.py，不改该脚本。
判据正本：../series-spec.md §2 G9/G12 / §3 / §5。"""
import importlib.util
import json
import os
import time

REPO = "/Users/stephenhe/Development/workspace/wechatgame"
SCRIPT = os.path.join(REPO, "games/beads/design/ai-workflows/dashscope-generate.py")
BATCH = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P07-cactus")
os.makedirs(BATCH, exist_ok=True)

spec = importlib.util.spec_from_file_location("dsg", SCRIPT)
dsg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dsg)

PROMPT = (
    "平涂矢量插画风格，单株仙人掌居中。主干为圆角柱状掌身（宽≈画布 30%、高≈42%），"
    "左右各一条向上弯的圆角短臂（基部与主干重叠相接，左臂略低、右臂略高，"
    "两臂连同主干撑到整株宽≈画布 72%）；掌身与短臂草绿 #3FBF6B 实心，"
    "主干正面 1 条、左右臂各 1 条奶白 #FDF6E9 宽纵棱（主干棱宽≈主干宽 35%、"
    "臂棱宽≈臂宽 35%，从顶端延伸到基部，不触外缘）；主干顶端一朵两层花："
    "外圈 5 片活力橙 #F59B23 大瓣（花径≈画布 30%，瓣尖圆润、基部插入主干），"
    "内圈一个奶白 #FDF6E9 圆盘（直径≈花径 55%，边缘 5 个小圆弧），"
    "花心柠黄 #FFD23F 圆盘（直径≈花径 30%）；主干底部插入深棕 #6B3E1E 梯形花盆"
    "（上宽≈画布 64%、下宽≈54%、高≈16%），盆口一条同色厚沿（高≈盆高 20%），"
    "主干与盆沿重叠相接；整株宽≈画布 72%、高≈76%，中心位于画布 50% 高度。"
    "纯平涂单色填充，无渐变、无阴影、无描边、无深色边缘、无纹理。无文字、无水印、"
    "无边框、无土壤颗粒、无刺、无昆虫、无其他植物、无 3D、无摄影质感。"
    "背景纯黑 #000000（作为 mask 颜色）。"
)

params = {"prompt_extend": False, "seed": 42, "size": "2048*2048"}
key, endpoint = dsg.load_key("token-plan"), dsg.resolve("token-plan")
t0 = time.time()
resp = dsg.call("qwen-image-3.0-pro", params, PROMPT, key, endpoint)
urls = dsg.find_image_urls(resp)
assert urls, json.dumps(resp, ensure_ascii=False)[:400]
out = os.path.join(BATCH, "a01p07-v2-s42.png")
dsg.download(urls[0], out)
meta = {
    "elapsed_s": round(time.time() - t0, 1),
    "usage": resp.get("usage"),
    "request_id": resp.get("request_id"),
    "params": params,
    "prompt": PROMPT,
}
json.dump(meta, open(os.path.join(BATCH, "response-meta-v2.json"), "w"), ensure_ascii=False, indent=2)
print(f"OK {meta['elapsed_s']}s -> {out}")
print(json.dumps(meta["usage"], ensure_ascii=False))
