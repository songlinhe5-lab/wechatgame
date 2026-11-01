#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
games/beads/design/ai-workflows/dashscope-generate.py —— 阿里云百炼（DashScope）云端生图。

本地 qwen-image 2.1 走 submit-comfyui.py；本脚本管**云端**后端（qwen-image-3.0-pro、
wan2.7-image 等），提示词从 temp/beads-positive.sh 正本取（与本地逐字一致，便于横比）。

**两套云端后端（--profile）**，key 与 base_url 完全隔离、混用会 401 或走错计费通道：
  · `maas`（缺省）＝ 按量付费专属实例，读 `DASHSCOPE_API_KEY`；
  · `token-plan` ＝ Token Plan 订阅，读 `TOKEN_PLAN_API_KEY` + `TOKEN_PLAN_BASE_URL`。
    请求/响应格式与 maas 逐字兼容（2026-10-31 实测），差别只在**在册模型集**：
    token-plan 侧无 qwen-image-2.1 系与非 pro 3.0，只有 qwen-image-3.0-pro / wan2.7-image[-pro]。

用法：
  # 单模型 × 指定关（boss 或 1–8 号 subject）
  python3 dashscope-generate.py --model qwen-image-3.0-pro --level boss
  python3 dashscope-generate.py --model wan2.7-image --level 5
  # 多模型 × 同一关（横比）；不给 --model 则跑该 profile 的全部已注册模型
  python3 dashscope-generate.py --model qwen-image-3.0-pro --model wan2.7-image --level boss
  # 走 Token Plan（生图与图像编辑同一端点，编辑＝加 --ref）
  python3 dashscope-generate.py --profile token-plan --model qwen-image-3.0-pro \\
      --ref <底图.png> --text "<编辑指令>" --size 768*1024
  # 直接给提示词（临时试构图）
  python3 dashscope-generate.py --model wan2.7-image --text "A flat vector red heart ..."
  # 指定出图尺寸（竖屏原型）：不给 --size 时 qwen 线一律回 2048x2048 方图
  python3 dashscope-generate.py --model qwen-image-3.0 --text "..." --size 1152*2048
  # 交互式编辑（框选，**仅 wan2.7 线认**）：只改框内，坐标＝底图绝对像素 x1,y1,x2,y2
  python3 dashscope-generate.py --profile token-plan --model wan2.7-image \\
      --ref <底图.png> --bbox 152,392,620,888 --size 752*1344 --text "<编辑指令>"
  ⚠ qwen 线（3.0 / 3.0-pro / 2.1-pro）**静默忽略 bbox**：接口收下不报错，出图照样改全图，
    框外均差 25–42（≈不传 bbox 的整图重绘水平）⇒ 本脚本对 qwen + bbox 直接 FAIL 退出，
    那三条线请走「整图生成 + 遮罩贴回」。实测数据见 model-matrix.md §5 bbox 判定表。

出图落 temp/dashscope-out/<tag>/<slug>.png（不入库），tag = 给了 --text 时恒为 custom，
slug = 模型名去 `.` 、`-`→`_`（例：wan2.7-image → wan27_image.png）。⚠ **同模型连跑必覆盖**
⇒ 每次调用后立刻 mv（上一轮因猜错 slug 白费一张）。
仅标准库（urllib）。key 按 --profile 取：maas → `DASHSCOPE_API_KEY`，
token-plan → `TOKEN_PLAN_API_KEY` + `TOKEN_PLAN_BASE_URL`（端点由 base_url 剥掉
`/compatible-mode` 尾巴推得，⛔ 不硬编码 host）；两者都读 `.env.local`。
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
NATIVE_PATH = "/api/v1/services/aigc/multimodal-generation/generation"
OUT = os.path.join(REPO, "temp", "dashscope-out")


def _env(name):
    for fn in (".env.local", ".env"):
        p = os.path.join(REPO, fn)
        if os.path.exists(p):
            m = re.search(rf"^{name}=(.+)$", open(p).read(), re.M)
            if m:
                return m.group(1).strip().strip('"').strip("'")
    return None


# profile → (endpoint, key 变量名)。token-plan 的 host 从 TOKEN_PLAN_BASE_URL 剥掉
# /compatible-mode 尾巴得到——⛔ 不得硬编码那串 URL，它随套餐地域变。
PROFILES = {
    "maas": ("https://llm-0jiu1fyll3llwwn0.cn-beijing.maas.aliyuncs.com" + NATIVE_PATH,
             "DASHSCOPE_API_KEY"),
    "token-plan": (None, "TOKEN_PLAN_API_KEY"),
}


def resolve(profile):
    if profile != "token-plan":
        return PROFILES[profile][0]
    base = _env("TOKEN_PLAN_BASE_URL")
    if not base:
        raise SystemExit("未找到 TOKEN_PLAN_BASE_URL（.env.local）")
    return base.split("/compatible-mode")[0].rstrip("/") + NATIVE_PATH

# 已注册云端模型 → 单图 parameters。
# ⚠ prompt_extend 属 **qwen 线**参数，wan2.7 官方 parameters 表里没有（实测传了不报错，是否被忽略未取证）
#   ⇒ wan 线留空对象；seed 腿仍会显式带 prompt_extend=False，对 qwen 才是关改写。
MODELS = {
    # 非 pro 3.0：model-matrix §1 ②③ 基准（背景最纯，0.18 元/张）。
    # ⚠ 仅 maas 有；token-plan 侧不在册，只认 qwen-image-3.0-pro / wan2.7-image[-pro]。
    "qwen-image-3.0": {"prompt_extend": True},
    "qwen-image-3.0-pro": {"prompt_extend": True},
    "qwen-image-2.1-pro": {"prompt_extend": True},
    "qwen-image-2.1-turbo": {"prompt_extend": True},
    "wan2.7-image": {},
    "wan2.7-image-pro": {},
}


def load_key(profile="maas"):
    p = _env(PROFILES[profile][1])
    if not p:
        raise SystemExit(f"未找到 {PROFILES[profile][1]}（.env.local）")
    return p


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


def call(model, params, prompt, key, endpoint=None):
    # prompt 可为字符串（纯文生图）或 content 列表（图生图：[{image},{text}]）
    content = [{"text": prompt}] if isinstance(prompt, str) else prompt
    body = {
        "model": model,
        "input": {"messages": [{"role": "user", "content": content}]},
        "parameters": params,
    }
    req = urllib.request.Request(
        endpoint or PROFILES["maas"][0], data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=300, context=ctx) as r:
        return json.loads(r.read().decode())


def download(url, path):
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(url, timeout=120, context=ctx) as r:
        open(path, "wb").write(r.read())


def _parse_args(argv):
    models, level, text, ref, seed = [], "boss", None, None, None
    size = None
    bbox = None
    palette = None
    profile = "maas"
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--profile":
            i += 1
            if argv[i] not in PROFILES:
                raise SystemExit(f"未知 --profile {argv[i]}（可用 {'/'.join(PROFILES)}）")
            profile = argv[i]
        elif a == "--model":
            i += 1
            models.append(argv[i])
        elif a == "--level":
            i += 1
            level = argv[i]
        elif a == "--text":
            i += 1
            text = argv[i]
        elif a == "--ref":
            i += 1
            ref = argv[i]
        elif a == "--seed":
            i += 1
            seed = int(argv[i])
        elif a == "--size":
            i += 1
            size = argv[i]  # 形如 1152*2048；不给则服务端默认（qwen 线恒为 2048 方图）
        elif a == "--bbox":
            # 交互式编辑框选（**仅 wan2.7 线认**）：x1,y1,x2,y2 原图绝对像素，左上角 (0,0)。
            i += 1
            v = [int(x) for x in argv[i].replace(" ", "").split(",")]
            if len(v) != 4:
                raise SystemExit("--bbox 需要四个整数：x1,y1,x2,y2")
            bbox = v
        elif a == "--palette":
            # wan2.7 线 `color_palette`：3–10 色 `"#RRGGBB:20.00"`（**服务端形状是
            # {"hex": "#RRGGBB", "ratio": "20.00%"}——ratio 是带百分号的字符串**，写成
            # 数字或键名用 color 都会 400 InvalidParameter，实测 request_id 119559e9…）。
            # CLI 上写裸数字更省事，这里补 `%`。⛔ qwen 线不认此参数；官方口径「仅关组图模式可用」。
            i += 1
            pal = []
            for it in [x for x in argv[i].replace(" ", "").split(",") if x]:
                c, _, r = it.partition(":")
                if not c.startswith("#") or len(c) != 7 or not r:
                    raise SystemExit('--palette 形如 "#RRGGBB:20.00,#…（3–10 色）"')
                pal.append({"hex": c.upper(), "ratio": "%.2f%%" % float(r)})
            if not 3 <= len(pal) <= 10:
                raise SystemExit("--palette 需要 3–10 色（当前 %d）" % len(pal))
            tot = sum(float(p["ratio"][:-1]) for p in pal)
            if abs(tot - 100.00) > 0.005:
                raise SystemExit("--palette 的 ratio 总和必须恰为 100.00（当前 %.2f）" % tot)
            palette = pal
        elif a in ("-h", "--help"):
            print(__doc__)
            raise SystemExit
        else:
            models.append(a)  # 兼容旧位置参数：直接给模型名
        i += 1
    return models, level, text, ref, seed, size, profile, bbox, palette


def bbox_guard(models, bbox):
    """仅 wan2.7 线认 bbox；qwen 线静默忽略 ⇒ 硬拦，⛔ 不留「收下参数但不生效」的坑。

    2026-11-01 同题探针（左上 140x140 框内涂纯蓝）：wan2.7 / wan2.7-pro 框内变蓝 88.5%/96.4%、
    框外均差 6.9/5.7；qwen3.0 / 3.0-pro / 2.1-pro 框内 0%、框外均差 42.5/41.7/25.1（比不传框还差）。
    """
    if not bbox:
        return
    bad = [m for m in models if not m.startswith("wan2.7")]
    if bad:
        raise SystemExit(
            f"FAIL: {'/'.join(bad)} 会静默忽略 --bbox（实测框外均差 25–42，等同整图重绘）"
            " —— 只有 wan2.7 线认区域约束。这三条线请改走「整图生成 + 遮罩贴回」，"
            "并把区外 maxdiff 校验到 0。")


def _self_check():
    """最小自检：--bbox / --palette 的解析与透传形状。改过解析腿必跑。"""
    m, _lv, _t, ref, _s, size, prof, bbox, _pal = _parse_args(
        ["--profile", "token-plan", "--model", "wan2.7-image", "--ref", "a.png",
         "--bbox", "152,392,620,888", "--size", "752*1344", "--text", "x"])
    assert bbox == [152, 392, 620, 888] and ref == "a.png" and size == "752*1344", bbox
    assert m == ["wan2.7-image"] and prof == "token-plan"
    assert {"bbox_list": [[bbox]]}["bbox_list"] == [[[152, 392, 620, 888]]]  # 1 图 → 1 层嵌套
    try:
        _parse_args(["--bbox", "1,2,3"])
        raise AssertionError("--bbox 三元组应报错")
    except SystemExit:
        pass
    # bbox 只对 wan2.7 线放行，qwen 线必须被拦下（实测静默忽略，见 bbox_guard 注释）
    bbox_guard(["wan2.7-image", "wan2.7-image-pro"], [1, 2, 3, 4])
    for bad in ("qwen-image-3.0", "qwen-image-3.0-pro", "qwen-image-2.1-pro"):
        try:
            bbox_guard([bad], [1, 2, 3, 4])
            raise AssertionError(f"{bad} + bbox 应被拦下")
        except SystemExit:
            pass
    bbox_guard(["qwen-image-3.0"], None)   # 不给框就不拦
    *_, pal = _parse_args(["--palette",
                           "#F1E8D8:40.00,#FFFCF6:30.00,#8C5C2A:30.00"])
    assert pal[0] == {"hex": "#F1E8D8", "ratio": "40.00%"} and len(pal) == 3, pal
    for bad in ("#FFFFFF:50.00,#000000:40.00", "#FFFFFF:33.30,#000000:33.30,#111111:33.30"):
        try:
            _parse_args(["--palette", bad])
            raise AssertionError("ratio 总和 ≠100 应报错：" + bad)
        except SystemExit:
            pass
    print("check ok")
    return 0


def main():
    argv = __import__("sys").argv[1:]
    if "--check" in argv:
        raise SystemExit(_self_check())
    models, level, text, ref, seed, size, profile, bbox, palette = _parse_args(argv)
    # 不给 --model 时只跑该 profile 在册的模型（token-plan 侧无 2.1 系与非 pro 3.0，
    # 拿全列表去撞会逐条 404 Model not exist）。
    models = models or (list(MODELS) if profile == "maas" else ["qwen-image-3.0-pro", "wan2.7-image"])
    if bbox and not ref:
        raise SystemExit("--bbox 必须配 --ref（bbox_list 是「每张输入图一栏」，无图即无栏）")
    bbox_guard(models, bbox)
    prompt = text or load_prompt(level)
    tag = "custom" if text else level
    out_dir = os.path.join(OUT, tag)
    os.makedirs(out_dir, exist_ok=True)
    key, endpoint = load_key(profile), resolve(profile)
    content = []
    if ref:  # 图生图：把参考图 base64 内联进 content（qwen-image-edit / wan 参考图腿）
        import base64
        mime = "image/png" if ref.lower().endswith(".png") else "image/jpeg"
        data = base64.b64encode(open(ref, "rb").read()).decode()
        content.append({"image": f"data:{mime};base64,{data}"})
    content.append({"text": prompt})
    results = {}
    for model in models:
        params = MODELS.get(model, {"prompt_extend": True})
        if seed is not None:  # 锁复现：固定 seed 同时关掉服务端提示词改写（漂移主因）
            params = {**params, "seed": seed, "prompt_extend": False}
        if size:
            params = {**params, "size": size}
        if bbox:
            params = {**params, "bbox_list": [[bbox]]}  # 单图输入 → 外层长度 1
        if palette:
            params = {**params, "color_palette": palette}
        slug = model.replace(".", "").replace("-", "_")
        print(f"\n=== {model} · {profile} · {tag}{' · i2i' if ref else ''}{' · bbox' + str(bbox) if bbox else ''}{' · palette' + str(len(palette)) if palette else ''}{' · ' + size if size else ''}{' · seed' + str(seed) if seed is not None else ''} ===")
        t0 = time.time()
        try:
            resp = call(model, params, content, key, endpoint)
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
            print(
                f"  ✗ 响应无图片 URL：{json.dumps(resp, ensure_ascii=False)[:400]}")
            results[model] = {"ok": False, "err": "no image url", "raw": resp}
            continue
        out = os.path.join(out_dir, f"{slug}.png")
        download(urls[0], out)
        dt = time.time() - t0
        print(f"  ✓ {dt:.1f}s → {os.path.relpath(out, REPO)}  (url×{len(urls)})")
        results[model] = {"ok": True, "file": out,
                          "secs": round(dt, 1), "n_urls": len(urls)}
    json.dump(results, open(os.path.join(out_dir, "_summary.json"), "w"),
              ensure_ascii=False, indent=2)
    print(
        f"\n汇总 → {os.path.relpath(os.path.join(out_dir, '_summary.json'), REPO)}")


if __name__ == "__main__":
    main()
