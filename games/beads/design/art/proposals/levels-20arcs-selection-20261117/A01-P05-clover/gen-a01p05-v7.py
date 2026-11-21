#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性驱动：A01-P05 三叶草 v7（用户 2026-11-21 裁定路线 A：三色叶 + G12 色面均衡）。
v6 绿色 303/373=81.2% ⇒ F=233，无法全错豆；v7 顶绿/左橙/右黄三色近似等面积，
白 V 纹加宽到叶宽 40%，保证 32×32 五色不掉、主导色 ≤40%、F=0。
复用 design/ai-workflows/dashscope-generate.py，不改该脚本。
判据正本：../series-spec.md §2 G9/G12 / §3 / §5。"""
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
    "叶基轻微层叠；顶叶草绿 #3FBF6B、左叶活力橙 #F59B23、右叶柠黄 #FFD23F，"
    "三色面积近似相等；顶叶与左叶各有一枚奶白 #FDF6E9 宽 V 形斑纹"
    "（宽≈叶宽 40%，自叶基延伸至近叶尖，不与叶缘相接），右叶无斑纹；"
    "三叶汇合处深棕 #6B3E1E 圆盘（直径≈株宽 14%），圆盘正下方草绿短茎"
    "（宽≈株宽 12%、高≈株高 8%），茎基深棕节点（宽≈株宽 8%、高≈株高 4%）；"
    "整株宽≈画布 76%、高≈78%，中心位于画布 45% 高度。纯平涂单色填充，"
    "无渐变、无阴影、无描边、无纹理。无文字、无水印、无边框、无花盆、无土壤、"
    "无昆虫、无其他植物、无 3D、无摄影质感。背景纯黑 #000000（作为 mask 颜色）。"
)

params = {"prompt_extend": False, "seed": 42, "size": "2048*2048"}
key, endpoint = dsg.load_key("token-plan"), dsg.resolve("token-plan")
t0 = time.time()
resp = dsg.call("qwen-image-3.0-pro", params, PROMPT, key, endpoint)
urls = dsg.find_image_urls(resp)
assert urls, json.dumps(resp, ensure_ascii=False)[:400]
out = os.path.join(BATCH, "a01p05-v7-s42.png")
dsg.download(urls[0], out)
meta = {
    "elapsed_s": round(time.time() - t0, 1),
    "usage": resp.get("usage"),
    "request_id": resp.get("request_id"),
    "params": params,
    "prompt": PROMPT,
}
json.dump(meta, open(os.path.join(BATCH, "response-meta-v7.json"), "w"), ensure_ascii=False, indent=2)
print(f"OK {meta['elapsed_s']}s -> {out}")
print(json.dumps(meta["usage"], ensure_ascii=False))
