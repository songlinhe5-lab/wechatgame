#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A01-P09 花之王 boss v1 母版生成（Token Plan qwen-image-3.0-pro · 2048² · seed 42）。
按 design-plan.md：五角王冠（柠黄＋深棕底带）+ 外层 12 瓣（玫红/奶白交替）+
内层 8 瓣（柠黄/活力橙交替）+ 深棕花心盘（柠黄点睛）+ 草绿萼桩，6 色均衡。
背景纯黑 #000000（G7 mask）。"""
import importlib.util
import json
import os
import time

REPO = "/Users/stephenhe/Development/workspace/wechatgame"
SCRIPT = os.path.join(REPO, "games/beads/design/ai-workflows/dashscope-generate.py")
BATCH = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P09-flower-king")
os.makedirs(BATCH, exist_ok=True)

spec = importlib.util.spec_from_file_location("dsg", SCRIPT)
dsg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dsg)

PROMPT = (
    "平涂矢量插画风格，单株花之王居中、正视图、左右严格轴对称，"
    "由顶部五角王冠、中部双层花瓣大花、深棕花心、底部草绿萼桩四段组成，"
    "全部相接成一个整体，无悬浮、无缝隙。"
    "五角王冠在最顶部：一条水平冠带，宽≈画布 68%、高≈画布 5%，冠带顶部等距立 5 个硬边三角形尖，"
    "每个尖底宽≈画布 10%、尖高≈画布 12%，中间 1 个最高、左右对称；冠带与 5 个尖统一为柠黄 #FFD23F；"
    "冠带下沿是一条深棕 #6B3E1E 细横带（高≈画布 1.5%）；冠带下沿与顶部花瓣上缘重叠≈画布 2%，连成整体。"
    "大花为双层：外层 12 片宽瓣，瓣尖朝外、实心硬边、每片宽≈画布 7%、整圈直径≈画布 70%，"
    "严格玫红 #E84C3D 与奶白 #FDF6E9 交替（6 片玫红 + 6 片奶白）；"
    "内层 8 片短瓣压在外层花瓣之上、层叠错位、每片宽≈画布 6%、整圈直径≈画布 42%，"
    "严格柠黄 #FFD23F 与活力橙 #F59B23 交替（4 片柠黄 + 4 片活力橙）；"
    "所有花瓣彼此相接，颜色之间硬边直切，无渐变、无描边、无高光。"
    "花心：正中一颗深棕 #6B3E1E 实心圆盘（直径≈画布 17%），完全嵌在内层瓣中央；"
    "圆盘正中一颗柠黄 #FFD23F 小圆点（直径≈画布 5%）作为点睛，不越界。"
    "萼桩：花盘底部正中一段草绿 #3FBF6B 短粗萼桩（宽≈画布 11%、高≈画布 7%，"
    "垂直向下、不弯曲、不分支、无叶子），顶端与花盘底边正好相接。"
    "整株主体包围盒宽≈画布 74%、高≈画布 78%，水平与垂直居中，四边留白 ≥11%。"
    "整图只使用这 6 种颜色：奶白 #FDF6E9、柠黄 #FFD23F、活力橙 #F59B23、玫红 #E84C3D、"
    "深棕 #6B3E1E、草绿 #3FBF6B；禁止使用其他颜色，禁止颜色合并，禁止渐变或过渡色。"
    "纯平涂单色填充，无阴影、无描边、无深色边缘、无纹理、无高光、无飘落花瓣、无露珠、"
    "无其他植物、无地面、无投影、无 3D、无摄影质感。无文字、无水印、无边框。"
    "背景纯黑 #000000 作为 mask 颜色。"
)

params = {"prompt_extend": False, "seed": 42, "size": "2048*2048"}
key, endpoint = dsg.load_key("token-plan"), dsg.resolve("token-plan")
t0 = time.time()
resp = dsg.call("qwen-image-3.0-pro", params, PROMPT, key, endpoint)
urls = dsg.find_image_urls(resp)
assert urls, json.dumps(resp, ensure_ascii=False)[:400]
out = os.path.join(BATCH, "a01p09-v1-s42.png")
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
