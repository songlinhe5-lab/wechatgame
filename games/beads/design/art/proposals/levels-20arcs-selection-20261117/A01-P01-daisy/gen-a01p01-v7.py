#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性驱动：A01-P01 雏菊 v7（WXG-T-1064 · 用户 2026-11-25 裁「选项 3：档案对称性口径注 + 重做雏菊」）。

背景：v6 锁定版（用户 2026-11-18 通过）提示词已要「12 片花瓣均匀放射」，模型实画 **15 片**（奇数）
      ⇒ 垂直中轴一侧对瓣、一侧对缝，母版格化墨形镜像差 78/512、入库 pattern 左右不对称 153 格。
v7 对策：把对称性写成可判读的构图指令——中轴穿过正上/正下两片瓣，其余 10 片左右各 5 片一一镜像，
      并显式禁止「花瓣数量非偶数排布」。通道/参数逐字复刻 gen-a01p01-v6.py（1 次调用）。
用法：python3 gen-a01p01-v7.py
产物：a01p01-v7-s42.png + response-meta-v7.json
"""
import importlib.util
import json
import os
import time


def _repo_root(start):
    """上溯找 pnpm-workspace.yaml：⛔ 用 dirname 层数硬算（本批 v6/fix 脚本因搬迁已失效）。"""
    p = start
    while p != os.path.dirname(p):
        if os.path.exists(os.path.join(p, "pnpm-workspace.yaml")):
            return p
        p = os.path.dirname(p)
    raise SystemExit("repo root not found")


HERE = os.path.dirname(os.path.abspath(__file__))
REPO = _repo_root(HERE)
SCRIPT = os.path.join(REPO, "games/beads/design/ai-workflows/dashscope-generate.py")
BATCH = HERE

spec = importlib.util.spec_from_file_location("dsg", SCRIPT)
dsg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dsg)

PROMPT = (
    "平涂矢量插画风格，单朵雏菊花头居中，**整幅以画布垂直中线为轴严格左右镜像对称**："
    "左半边与右半边完全互为镜像，花瓣位置、花瓣颜色、缺口朝向一律左右一一对应。"
    "外层共 12 片细长花瓣均匀放射，排布方式固定为：**1 片指向正上方、1 片指向正下方（这两片骑在垂直中轴上），"
    "其余 10 片分为左右各 5 片一一镜像对应**；除正上正下两片外，⛔ 任何花瓣不得跨轴或单独出现在某一侧。"
    "花瓣=细长椭圆尖头，尖端带浅 V 缺口（缺口深度≥花瓣长度的 6%），瓣间缝隙露出背景；"
    "花瓣双色：主体奶白 #FDF6E9，基部赭棕 #A5652C 短带（带长≤花瓣长度的 25%），"
    "左右镜像侧的基部带颜色完全相同。花心=柠黄 #FFD23F 实心圆盘（直径≈花头宽的 38%），"
    "盘心深棕 #6B3E1E 小圆盘（直径≈黄盘的 40%），两盘圆心都落在垂直中轴上，无任何其他同心环带。"
    "花头正下方草绿 #3FBF6B 萼短桩（宽≈花头宽的 14%、高≈花头高的 6%），桩身左右对称且中心在垂直中轴上，"
    "无细长茎、无叶。花头含瓣宽≈画布 74%、整体高≈78%，中心位于画布水平正中、40% 高度。"
    "纯平涂单色填充，无渐变、无阴影、无描边、无纹理。"
    "无文字、无水印、无边框、无花盆、无土壤、无昆虫、无其他花朵、无 3D、无摄影质感。"
    "背景纯黑 #000000（作为 mask 颜色）。"
)

params = {"prompt_extend": False, "seed": 42, "size": "2048*2048"}
key, endpoint = dsg.load_key("token-plan"), dsg.resolve("token-plan")
t0 = time.time()
resp = dsg.call("qwen-image-3.0-pro", params, PROMPT, key, endpoint)
urls = dsg.find_image_urls(resp)
assert urls, json.dumps(resp, ensure_ascii=False)[:400]
out = os.path.join(BATCH, "a01p01-v7-s42.png")
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
