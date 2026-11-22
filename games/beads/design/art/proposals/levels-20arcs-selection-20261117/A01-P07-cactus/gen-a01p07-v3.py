#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性驱动：A01-P07 仙人掌 v3（用户 2026-11-22 批准方案）。
v1/v2 失败：细高柱（G9 宽不足）+ 绿色 >50%。v3 改矮胖短柱 40×38、4 条绿/白交替
色带、右臂 18% 撑到 72%、盆 66%、花 28%。目标 32×32、5 色、F=0、G9 72×78。
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
    "平涂矢量插画风格，单株仙人掌居中、矮胖短柱造型。主干为圆角短柱"
    "（宽≈画布 40%、高≈38%），柱身正面用 4 条等宽纵向色带交替：草绿 #3FBF6B、"
    "奶白 #FDF6E9、草绿、奶白（每条宽≈主干宽 25%，从顶端延伸到基部，色带之间无缝隙）；"
    "右侧中部伸出一条向上弯的圆角短臂（宽≈18%、高≈20%，基部与主干重叠，臂身草绿、"
    "臂端一小块奶白，臂尖把整株撑到宽≈画布 72%）；主干顶端一朵花：外圈 5 片"
    "活力橙 #F59B23 大瓣（花径≈画布 28%，瓣尖圆润、基部插入主干），内圈奶白 #FDF6E9 "
    "圆盘（直径≈花径 55%），花心柠黄 #FFD23F 圆盘（直径≈花径 30%）；主干底部插入"
    "深棕 #6B3E1E 梯形花盆（上宽≈画布 66%、下宽≈56%、高≈16%），盆口一条同色厚沿"
    "（高≈盆高 20%），主干与盆沿重叠相接；整株宽≈画布 72%、高≈78%，"
    "中心位于画布 50% 高度。纯平涂单色填充，无渐变、无阴影、无描边、无深色边缘、"
    "无纹理。无文字、无水印、无边框、无土壤颗粒、无刺、无昆虫、无其他植物、无 3D、"
    "无摄影质感。背景纯黑 #000000（作为 mask 颜色）。"
)

params = {"prompt_extend": False, "seed": 42, "size": "2048*2048"}
key, endpoint = dsg.load_key("token-plan"), dsg.resolve("token-plan")
t0 = time.time()
resp = dsg.call("qwen-image-3.0-pro", params, PROMPT, key, endpoint)
urls = dsg.find_image_urls(resp)
assert urls, json.dumps(resp, ensure_ascii=False)[:400]
out = os.path.join(BATCH, "a01p07-v3-s42.png")
dsg.download(urls[0], out)
meta = {
    "elapsed_s": round(time.time() - t0, 1),
    "usage": resp.get("usage"),
    "request_id": resp.get("request_id"),
    "params": params,
    "prompt": PROMPT,
}
json.dump(meta, open(os.path.join(BATCH, "response-meta-v3.json"), "w"), ensure_ascii=False, indent=2)
print(f"OK {meta['elapsed_s']}s -> {out}")
print(json.dumps(meta["usage"], ensure_ascii=False))
