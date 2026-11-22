#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A01-P08 蒲公英 v1 母版生成（Token Plan qwen-image-3.0-pro · 2048² · seed 42）。
按 design-plan.md：28 条奶白/柠黄严格交替的等宽射线 + 深棕花盘 + 活力橙斑 + 细绿长茎，
5 色均衡（主导 30.5% ≤ 40%，mis=max 预期 F=0）。背景纯黑 #000000（G7 mask）。"""
import importlib.util
import json
import os
import time

REPO = "/Users/stephenhe/Development/workspace/wechatgame"
SCRIPT = os.path.join(REPO, "games/beads/design/ai-workflows/dashscope-generate.py")
BATCH = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P08-dandelion")
os.makedirs(BATCH, exist_ok=True)

spec = importlib.util.spec_from_file_location("dsg", SCRIPT)
dsg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dsg)

PROMPT = (
    "平涂矢量插画风格，单株蒲公英居中、正视图。顶部一个略扁的圆形绒球"
    "（宽≈画布 62%、高≈画布 62%，水平略扁，中心与画布中心对齐），绒球由 28 条等宽"
    "放射射线拼接而成，从中心到球缘长度完全一致、硬边、无缝隙、无渐变、无长短不齐："
    "严格奶白 #FDF6E9 和柠黄 #FFD23F 交替排列（每条宽≈画布 2.2%，14 条奶白 + 14 条柠黄），"
    "所有射线紧贴底部花盘底座连成一个整体球体，无飞絮飘散、无种子散落、无弯曲、无粗细变化；"
    "绒球下端正中一颗深棕 #6B3E1E 圆形花盘底座（直径≈画布 16%），花盘中心一颗活力橙 #F59B23"
    "装饰圆斑（直径≈画布 9%），橙斑完全嵌在花盘正中不越界；"
    "花盘底部正中接一条细草绿 #3FBF6B 长茎（宽≈画布 6%、高≈画布 22%，垂直向下、不弯曲、"
    "不分支、无叶子、顶端与花盘底边正好相接）。"
    "整株主体包围盒宽≈画布 74%、高≈画布 78%，水平与垂直居中，四边留白 ≥11%。"
    "整图只使用这 5 种颜色，禁止使用其他颜色，禁止颜色合并，禁止渐变或过渡色。"
    "纯平涂单色填充，无阴影、无描边、无深色边缘、无纹理、无高光、无刺、无飞絮、无种子飘散、"
    "无叶子、无其他植物、无地面、无投影、无 3D、无摄影质感。"
    "无文字、无水印、无边框。背景纯黑 #000000 作为 mask 颜色。"
)

params = {"prompt_extend": False, "seed": 42, "size": "2048*2048"}
key, endpoint = dsg.load_key("token-plan"), dsg.resolve("token-plan")
t0 = time.time()
resp = dsg.call("qwen-image-3.0-pro", params, PROMPT, key, endpoint)
urls = dsg.find_image_urls(resp)
assert urls, json.dumps(resp, ensure_ascii=False)[:400]
out = os.path.join(BATCH, "a01p08-v1-s42.png")
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
