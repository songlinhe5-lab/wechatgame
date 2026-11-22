#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性驱动：A01-P07 仙人掌 v4（用户 2026-11-22 批准球形方案）。
v1/v2 细高柱、v3 矮胖柱仍 G9 宽 39.99% ⇒ v4 改矮胖球形主体：球宽≈画布 68%、
5 条绿/奶白纵向瓜棱（绿 3 白 2）、顶花 30%、宽口深棕盆 76%，整株 76%×74%。
目标 32×32、5 色、F=0、最大色面 ≤40%（预估绿/棕 ≈31%）。
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
    "平涂矢量插画风格，单株球形仙人掌居中、正视图。主干为一个矮胖圆球形的仙人掌球体"
    "（宽≈画布 68%、高≈画布 42%，上下略扁），球体表面用 5 条等宽纵向瓜棱交替分区："
    "草绿 #3FBF6B、奶白 #FDF6E9、草绿、奶白、草绿（每条宽≈球体宽 20%，从球顶延伸到球底，"
    "色带之间硬边无缝隙，球体左右两端各留一条绿色弧边）；球体顶端一朵花：外圈 5 片"
    "活力橙 #F59B23 圆润大瓣（花径≈画布 30%，瓣尖朝外、基部插入球顶），内圈一个"
    "奶白 #FDF6E9 圆盘（直径≈花径 52%），花心一个柠黄 #FFD23F 圆盘（直径≈花径 32%）；"
    "球体底部插入深棕 #6B3E1E 宽口梯形花盆（盆口上宽≈画布 76%、盆底宽≈画布 60%、"
    "盆高≈画布 14%，盆口一条同色厚沿、高≈盆高 22%、略外挑），球体与盆沿重叠相接，"
    "重叠高度≈画布 4%；整株外接框宽≈画布 76%、高≈画布 74%，水平与垂直居中。"
    "纯平涂单色填充，无渐变、无阴影、无描边、无深色边缘、无纹理、无高光。"
    "无文字、无水印、无边框、无土壤颗粒、无刺、无昆虫、无其他植物、无 3D、无摄影质感。"
    "背景纯黑 #000000（作为 mask 颜色）。"
)

params = {"prompt_extend": False, "seed": 42, "size": "2048*2048"}
key, endpoint = dsg.load_key("token-plan"), dsg.resolve("token-plan")
t0 = time.time()
resp = dsg.call("qwen-image-3.0-pro", params, PROMPT, key, endpoint)
urls = dsg.find_image_urls(resp)
assert urls, json.dumps(resp, ensure_ascii=False)[:400]
out = os.path.join(BATCH, "a01p07-v4-s42.png")
dsg.download(urls[0], out)
meta = {
    "elapsed_s": round(time.time() - t0, 1),
    "usage": resp.get("usage"),
    "request_id": resp.get("request_id"),
    "params": params,
    "prompt": PROMPT,
}
json.dump(meta, open(os.path.join(BATCH, "response-meta-v4.json"), "w"), ensure_ascii=False, indent=2)
print(f"OK {meta['elapsed_s']}s -> {out}")
print(json.dumps(meta["usage"], ensure_ascii=False))
