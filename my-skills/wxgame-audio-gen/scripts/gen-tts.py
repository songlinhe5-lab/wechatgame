#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
my-skills/wxgame-audio-gen/scripts/gen-tts.py —— 阿里云百炼云端口播（qwen-audio-3.0-tts-plus）。

为什么要有它：`game-ui-voice-pack` 那条路要 Beatra 授权 + credits；本脚本只吃仓库
`.env.local` 里的 Token Plan key，**零外部 pack 依赖**，把 UI 短句直接做成 mp3 落进
`games/<game>/audio/voice/`。规格（要哪几条、时长上限）仍归 `wxgame-audio-spec`，
本脚本不发明规格，只产资产 + 实测表。

用法：
  # 单条
  python3 gen-tts.py --text "开始游戏" --out games/beads/audio/voice/ --id start
  # 批量：每行 `id<TAB>文本`（# 开头为注释）
  python3 gen-tts.py --list lines.tsv --out games/beads/audio/voice/

已知约束（2026-10-31 实测）：
  · 端点 `POST {host}/api/v1/services/audio/tts/SpeechSynthesizer`，service 段是 **audio**，
    不是 aigc —— 写成 `/services/aigc/tts/...` 会回 `url error`（不是鉴权问题）。
  · 文本挂在 `input.text`；写 `input.text_prompt` 会回 400 `Please ensure input text is valid.`
  · 成功体 `output.audio.url`，**http 且 24h 过期** ⇒ 必须当场下载，不能只存 url。
  · `--voice` 非法值回 `Engine error [411]` 且**不吐可用枚举** ⇒ 音色清单是 `[TODO]`，
    缺省 `longanhuan_v3.6` 为已验可用值，其余音色名须查官方页后再填，别猜。
仅标准库 + ffprobe（探时长，缺则报 `?`）。不落盘、不打印 key。
"""
import json
import os
import re
import shutil
import ssl
import subprocess
import sys
import time
import urllib.request
import urllib.error

MODEL_DEFAULT = "qwen-audio-3.0-tts-plus"
VOICE_DEFAULT = "longanhuan_v3.6"


def _repo_root(start):
    d = start
    while os.path.dirname(d) != d:
        if os.path.exists(os.path.join(d, "pnpm-workspace.yaml")):
            return d
        d = os.path.dirname(d)
    raise RuntimeError("找不到仓库根（pnpm-workspace.yaml）")


REPO = _repo_root(os.path.dirname(os.path.abspath(__file__)))


def _env(name):
    """环境变量优先，回退仓库根 .env.local / .env（与 dashscope-generate.py 同惯例）。"""
    v = os.environ.get(name)
    if v:
        return v.strip().strip('"').strip("'")
    for fn in (".env.local", ".env"):
        p = os.path.join(REPO, fn)
        if os.path.exists(p):
            m = re.search(rf"^{name}=(.+)$", open(p).read(), re.M)
            if m and m.group(1).strip():
                return m.group(1).strip().strip('"').strip("'")
    return None


def endpoint():
    base = _env("TOKEN_PLAN_BASE_URL")
    if not base:
        raise SystemExit("未找到 TOKEN_PLAN_BASE_URL（.env.local）")
    # BASE_URL 形如 https://<host>/compatible-mode/v1，原生服务要剥掉这段尾巴
    return base.split("/compatible-mode")[0].rstrip("/") + "/api/v1/services/audio/tts/SpeechSynthesizer"


def dur_ms(path):
    """ffprobe 实测时长；没装 ffprobe 就返回 None（宁可报 ? ，不报估算值）。"""
    if not shutil.which("ffprobe"):
        return None
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", path],
            capture_output=True, text=True, timeout=30).stdout.strip()
        return round(float(out) * 1000)
    except Exception:
        return None


def synth(text, voice, fmt, model, key, url, dest):
    body = {"model": model, "input": {"text": text},
            "parameters": {"voice": voice, "format": fmt}}
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=120, context=ctx) as r:
            resp = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}: {e.read().decode()[:200]}"
    audio_url = (resp.get("output") or {}).get("audio", {}).get("url")
    if not audio_url:
        # 拿不到 url 就把真实响应打出来要求改，而不是猜结构（gen-music.mjs 同规矩）
        return None, "响应无 output.audio.url：" + json.dumps(resp, ensure_ascii=False)[:400]
    with urllib.request.urlopen(audio_url, timeout=120, context=ctx) as r:
        open(dest, "wb").write(r.read())
    return dest, None


def read_list(path):
    rows = []
    for line in open(path, encoding="utf-8"):
        line = line.rstrip("\n")
        if not line.strip() or line.startswith("#"):
            continue
        cols = re.split(r"\t| {2,}", line, maxsplit=1)
        if len(cols) != 2:
            raise SystemExit(f"{path} 行格式应为 `id<TAB>文本`：{line!r}")
        rows.append((cols[0].strip(), cols[1].strip()))
    if not rows:
        raise SystemExit(f"{path} 里没有有效行")
    return rows


if __name__ == "__main__":
    argv = sys.argv[1:]
    if "-h" in argv or "--help" in argv:
        print(__doc__)
        raise SystemExit
    opt = {}
    i = 0
    while i < len(argv):
        if argv[i].startswith("--"):
            opt[argv[i]] = argv[i + 1] if i + 1 < len(argv) else ""
            i += 2
        else:
            raise SystemExit(f"不认识的参数：{argv[i]}（--help 看用法）")
    text, listf = opt.get("--text"), opt.get("--list")
    if not text and not listf:
        raise SystemExit("给 --text 或 --list 其一（--help 看用法）")
    out_dir = os.path.relpath(opt.get("--out", "games/beads/audio/voice"), REPO)
    os.makedirs(os.path.join(REPO, out_dir), exist_ok=True)
    voice = opt.get("--voice", VOICE_DEFAULT)
    fmt = opt.get("--format", "mp3")
    model = opt.get("--model", MODEL_DEFAULT)
    key, url = _env("TOKEN_PLAN_API_KEY"), endpoint()
    rows = [(opt.get("--id", "line"), text)] if text else read_list(os.path.join(REPO, listf))

    print(f"# {model} · voice={voice} · {len(rows)} 条 → {out_dir}/")
    fail = 0
    for name, line in rows:
        t0 = time.time()
        dest, err = None, None
        try:
            dest, err = synth(line, voice, fmt, model, key, url,
                              os.path.join(REPO, out_dir, f"{name}.{fmt}"))
        except Exception as e:
            err = f"{type(e).__name__}: {e}"
        if err:
            fail += 1
            print(f"✗ {name:<18} {err}")
            continue
        d = dur_ms(dest)
        print("%-18s %-6s %8s %7.1f KB %5.1fs  %s"
              % (name, fmt, ("%d ms" % d) if d else "?",
                 os.path.getsize(dest) / 1024.0, time.time() - t0, os.path.basename(dest)))
    if fail:
        raise SystemExit(f"\n{fail}/{len(rows)} 条失败 ⇒ 上面是服务端原文，按它改参数，别猜。")
    print("\n⚠ 时长上限与是否入 `AUDIO_CLIP_*` 闭合集，看 wxgame-audio-spec；本脚本不截断、不改 id。")
