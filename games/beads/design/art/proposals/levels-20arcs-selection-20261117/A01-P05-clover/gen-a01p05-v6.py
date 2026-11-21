#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性驱动：A01-P05 三叶草 v6（用户 2026-11-21 批准提示词；补第 5 色深棕）。
v5 实测仅 4 色（深棕点过小，32×32 量化被吸收）⇒ 本版把深棕扩为叶心圆盘 + 茎基节点，
其余构图沿用 v4/v5。复用 design/ai-workflows/dashscope-generate.py，不改该脚本。
判据正本：../series-spec.md §2/§3/§5（G11 mis=max、G12 均衡、32 基准）。"""
import importlib.util
import json
import os
import time

REPO = "/Users/stephenhe/Development/workspace/wechatgame"
SCRIPT = os.path.join(REPO, "games/beads/design/ai-workflows/dashscope-generate.py")
BATCH = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P05-clover")
os.makedirs(BATCH, exist_ok=True)

spec = importlib.util.spec_from_file_location("dsg", SCRIPT)
dsg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dsg)

PROMPT = (
    "平涂矢量插画风格，单株三叶草居中。三片圆润心形叶按上、左下、右下 120° 放射，"
    "叶片草绿 #3FBF6B 实心；每片叶面靠叶基有一枚奶白 #FDF6E9 倒 V 形斑纹"
    "（宽≈叶宽 40%，不与叶缘相接）；三叶汇合处深棕 #6B3E1E 圆盘（直径≈株宽 16%），"
    "深棕圆盘正下方草绿短茎（宽≈株宽 12%、高≈株高 8%），茎基深棕节点"
    "（宽≈株宽 8%、高≈株高 4%）；左侧叶外缘一块活力橙 #F59B23 宽边"
    "（≥叶宽 20%，只贴左叶）；叶心右上方一颗柠黄 #FFD23F 实心球"
    "（直径≈株宽 18%，只与右叶相连）；整株含球宽≈画布 76%、整体高≈78%，"
    "中心位于画布 45% 高度。纯平涂单色填充，无渐变、无阴影、无描边、无纹理。"
    "无文字、无水印、无边框、无花盆、无土壤、无昆虫、无其他植物、无 3D、无摄影质感。"
    "背景纯黑 #000000（作为 mask 颜色）。"
)

params = {"prompt_extend": False, "seed": 42, "size": "2048*2048"}
key, endpoint = dsg.load_key("token-plan"), dsg.resolve("token-plan")
t0 = time.time()
resp = dsg.call("qwen-image-3.0-pro", params, PROMPT, key, endpoint)
urls = dsg.find_image_urls(resp)
assert urls, json.dumps(resp, ensure_ascii=False)[:400]
out = os.path.join(BATCH, "a01p05-v6-s42.png")
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
