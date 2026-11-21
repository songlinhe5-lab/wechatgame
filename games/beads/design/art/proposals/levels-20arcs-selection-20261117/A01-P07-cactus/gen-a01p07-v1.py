#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性驱动：A01-P07 仙人掌 v1（用户 2026-11-21 批准提示词；G12 色面分区）。
柱状掌身+侧臂草绿、奶白纵棱、橙顶花、黄花心、深棕花盆；目标 32×32、5 色、F=0。
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
    "平涂矢量插画风格，单株仙人掌居中。主干为圆角柱状掌身（宽≈画布 26%、高≈45%），"
    "右侧中部伸出一条向上弯的圆角短臂（宽≈12%、高≈18%，基部与主干重叠相接）；"
    "掌身与短臂草绿 #3FBF6B 实心，主干表面 3 条、短臂 1 条奶白 #FDF6E9 纵向棱纹"
    "（每条宽≈主干宽 14%，从顶端延伸到基部，不触外缘）；主干顶端一朵活力橙 #F59B23 "
    "五瓣花（直径≈主干宽 70%，瓣尖圆润，基部插入主干），花心柠黄 #FFD23F 圆盘"
    "（直径≈花径 38%）；主干底部插入深棕 #6B3E1E 梯形花盆（上宽≈画布 46%、"
    "下宽≈38%、高≈16%），盆口一条同色厚沿（高≈盆高 18%），主干与盆沿重叠相接；"
    "整株宽≈画布 72%、高≈76%，中心位于画布 50% 高度。纯平涂单色填充，无渐变、"
    "无阴影、无描边、无深色边缘、无纹理。无文字、无水印、无边框、无土壤颗粒、无刺、"
    "无昆虫、无其他植物、无 3D、无摄影质感。背景纯黑 #000000（作为 mask 颜色）。"
)

params = {"prompt_extend": False, "seed": 42, "size": "2048*2048"}
key, endpoint = dsg.load_key("token-plan"), dsg.resolve("token-plan")
t0 = time.time()
resp = dsg.call("qwen-image-3.0-pro", params, PROMPT, key, endpoint)
urls = dsg.find_image_urls(resp)
assert urls, json.dumps(resp, ensure_ascii=False)[:400]
out = os.path.join(BATCH, "a01p07-v1-s42.png")
dsg.download(urls[0], out)
meta = {
    "elapsed_s": round(time.time() - t0, 1),
    "usage": resp.get("usage"),
    "request_id": resp.get("request_id"),
    "params": params,
    "prompt": PROMPT,
}
json.dump(meta, open(os.path.join(BATCH, "response-meta-v1.json"), "w"), ensure_ascii=False, indent=2)
print(f"OK {meta['elapsed_s']}s -> {out}")
print(json.dumps(meta["usage"], ensure_ascii=False))
