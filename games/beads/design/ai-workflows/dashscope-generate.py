#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
games/beads/design/ai-workflows/dashscope-generate.py —— 阿里云百炼（DashScope）云端生图。

本地 qwen-image 2.1 走 submit-comfyui.py；本脚本管**云端**后端（qwen-image-3.0-pro、
wan2.7-image 等），提示词从 temp/beads-positive.sh 正本取（与本地逐字一致，便于横比）。

用法：
  # 单模型 × 指定关（boss 或 1–8 号 subject）
  python3 dashscope-generate.py --model qwen-image-3.0-pro --level boss
  python3 dashscope-generate.py --model wan2.7-image --level 5
  # 多模型 × 同一关（横比）；不给 --model 则跑全部已注册模型
  python3 dashscope-generate.py --model qwen-image-3.0-pro --model wan2.7-image --level boss
  # 直接给提示词（临时试构图）
  python3 dashscope-generate.py --model wan2.7-image --text "A flat vector red heart ..."

出图落 temp/dashscope-out/<level>/<model>.png（不入库），供走 studio /api/generate 比对。
仅标准库（urllib）；DASHSCOPE_API_KEY 读 .env.local。
"""
import json
import os
import re
import ssl
import time
import urllib.request
import urllib.error


def _repo_root(start):
    d = start
    while os.path.dirname(d) != d:
        if os.path.exists(os.path.join(d, "pnpm-workspace.yaml")):
            return d
        d = os.path.dirname(d)
    raise RuntimeError("找不到仓库根（pnpm-workspace.yaml）")


REPO = _repo_root(os.path.dirname(os.path.abspath(__file__)))
POSITIVE = os.path.join(REPO, "temp", "beads-positive.sh")
ENDPOINT = ("https://llm-0jiu1fyll3llwwn0.cn-beijing.maas.aliyuncs.com"
            "/api/v1/services/aigc/multimodal-generation/generation")
OUT = os.path.join(REPO, "temp", "dashscope-out")

# 已注册云端模型 → 单图 parameters（wan2.7 示例是 sequential 多图，这里取单图档）
MODELS = {
    "qwen-image-3.0-pro": {"prompt_extend": True},
    "qwen-image-2.1-pro": {"prompt_extend": True},
    "qwen-image-2.1-turbo": {"prompt_extend": True},
    "wan2.7-image": {"prompt_extend": True},
}


def load_key():
    for fn in (".env.local", ".env"):
        p = os.path.join(REPO, fn)
        if os.path.exists(p):
            m = re.search(r"^DASHSCOPE_API_KEY=(.+)$", open(p).read(), re.M)
            if m:
                return m.group(1).strip().strip('"').strip("'")
    raise SystemExit("未找到 DASHSCOPE_API_KEY（.env.local）")


def _parse_positive():
    txt = open(POSITIVE).read()
    return dict(re.findall(r'^(PRE|S|BOSS|SUBJ_\d+)="(.*)"$', txt, re.M))


def load_prompt(level):
    """level = 'boss' → BOSS 整段；'1'..'8' → PRE + SUBJ_n + S（与本地批脚本逐字一致）。"""
    v = _parse_positive()
    if level == "boss":
        if "BOSS" not in v:
            raise SystemExit("未解析到 BOSS 提示词")
        return v["BOSS"]
    key = "SUBJ_" + str(int(level))
    if key not in v:
        raise SystemExit(f"无 subject {level}（可用 1-8 或 boss）")
    return v["PRE"] + v[key] + v["S"]


def load_boss_prompt():
    """兼容旧调用（boss-tune.py）：等价 load_prompt('boss')。"""
    return load_prompt("boss")


def find_image_urls(obj):
    """递归收集响应里所有 http(s) 图片 URL（qwen/wan 把 URL 放在 content[].image）。"""
    urls = []
    if isinstance(obj, dict):
        for k, val in obj.items():
            if k == "image" and isinstance(val, str) and val.startswith("http"):
                urls.append(val)
            else:
                urls += find_image_urls(val)
    elif isinstance(obj, list):
        for x in obj:
            urls += find_image_urls(x)
    return urls


def call(model, params, prompt, key):
    body = {
        "model": model,
        "input": {"messages": [{"role": "user", "content": [{"text": prompt}]}]},
        "parameters": params,
    }
    req = urllib.request.Request(
        ENDPOINT, data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=300, context=ctx) as r:
        return json.loads(r.read().decode())


def download(url, path):
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(url, timeout=120, context=ctx) as r:
        open(path, "wb").write(r.read())


def _parse_args(argv):
    models, level, text = [], "boss", None
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--model":
            i += 1; models.append(argv[i])
        elif a == "--level":
            i += 1; level = argv[i]
        elif a == "--text":
            i += 1; text = argv[i]
        elif a in ("-h", "--help"):
            print(__doc__); raise SystemExit
        else:
            models.append(a)  # 兼容旧位置参数：直接给模型名
        i += 1
    return models, level, text


def main():
    argv = __import__("sys").argv[1:]
    models, level, text = _parse_args(argv)
    models = models or list(MODELS)
    prompt = text or load_prompt(level)
    tag = "custom" if text else level
    out_dir = os.path.join(OUT, tag)
    os.makedirs(out_dir, exist_ok=True)
    key = load_key()
    results = {}
    for model in models:
        params = MODELS.get(model, {"prompt_extend": True})
        slug = model.replace(".", "").replace("-", "_")
        print(f"\n=== {model} · {tag} ===")
        t0 = time.time()
        try:
            resp = call(model, params, prompt, key)
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:400]
            print(f"  ✗ HTTP {e.code}: {msg}")
            results[model] = {"ok": False, "err": f"HTTP {e.code}: {msg}"}
            continue
        except Exception as e:
            print(f"  ✗ {type(e).__name__}: {e}")
            results[model] = {"ok": False, "err": str(e)}
            continue
        urls = find_image_urls(resp)
        if not urls:
            print(f"  ✗ 响应无图片 URL：{json.dumps(resp, ensure_ascii=False)[:400]}")
            results[model] = {"ok": False, "err": "no image url", "raw": resp}
            continue
        out = os.path.join(out_dir, f"{slug}.png")
        download(urls[0], out)
        dt = time.time() - t0
        print(f"  ✓ {dt:.1f}s → {os.path.relpath(out, REPO)}  (url×{len(urls)})")
        results[model] = {"ok": True, "file": out, "secs": round(dt, 1), "n_urls": len(urls)}
    json.dump(results, open(os.path.join(out_dir, "_summary.json"), "w"),
              ensure_ascii=False, indent=2)
    print(f"\n汇总 → {os.path.relpath(os.path.join(out_dir, '_summary.json'), REPO)}")


if __name__ == "__main__":
    main()
