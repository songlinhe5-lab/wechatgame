#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性驱动：A01-P06 荷花 v1（用户 2026-11-21 批准提示词；G12 色面分区）。
宽瓣奶白/橙双色交替 + 柠黄莲蓬 + 草绿水波 + 深棕孔/托座；目标 32×32、5 色、F=0。
复用 design/ai-workflows/dashscope-generate.py，不改该脚本。
判据正本：../series-spec.md §2 G9/G12 / §3 / §5。"""
import importlib.util
import json
import os
import time

REPO = "/Users/stephenhe/Development/workspace/wechatgame"
SCRIPT = os.path.join(REPO, "games/beads/design/ai-workflows/dashscope-generate.py")
BATCH = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P06-lotus")
os.makedirs(BATCH, exist_ok=True)

spec = importlib.util.spec_from_file_location("dsg", SCRIPT)
dsg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dsg)

PROMPT = (
    "平涂矢量插画风格，单朵荷花居中。花头由 5 片左右舒展的宽瓣组成：中央一片直立，"
    "左右各 1 片向斜上方展开、最外侧 2 片向左右平展，瓣尖圆润；花瓣双色交替，"
    "奶白 #FDF6E9 与活力橙 #F59B23 相邻不同色、两色面积近似相等，无渐变。"
    "花心为柠黄 #FFD23F 椭圆莲蓬（宽≈花宽 30%、高≈花高 22%），莲蓬面均匀排 3 个"
    "深棕 #6B3E1E 圆孔（孔径≈莲蓬宽 22%），莲蓬底部一条深棕托座带"
    "（宽≈莲蓬宽 90%、高≈莲蓬高 25%）。花头正下方接草绿 #3FBF6B 粗短茎"
    "（宽≈花宽 10%、高≈花高 10%），茎底连两条草绿波浪水纹（每条约 3 珠厚，"
    "左右各伸出≈花宽 70%，上下错开、纹间留黑），最外侧瓣尖与水纹均不与画布边缘相接。"
    "整朵含波纹宽≈画布 76%、整体高≈78%，花头中心位于画布 42% 高度。"
    "纯平涂单色填充，无渐变、无阴影、无描边、无纹理。无文字、无水印、无边框、"
    "无花盆、无土壤、无昆虫、无其他植物、无 3D、无摄影质感。背景纯黑 #000000（作为 mask 颜色）。"
)

params = {"prompt_extend": False, "seed": 42, "size": "2048*2048"}
key, endpoint = dsg.load_key("token-plan"), dsg.resolve("token-plan")
t0 = time.time()
resp = dsg.call("qwen-image-3.0-pro", params, PROMPT, key, endpoint)
urls = dsg.find_image_urls(resp)
assert urls, json.dumps(resp, ensure_ascii=False)[:400]
out = os.path.join(BATCH, "a01p06-v1-s42.png")
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
