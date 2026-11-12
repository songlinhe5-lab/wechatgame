#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MiniMax-H3 文生视频 —— 内网 ComfyUI 驱动（标准库，无第三方依赖）。

为什么不是云 API：本机 Mac 跑不动 H3 权重；内网 Windows + RTX 2080 Ti(11GB) 的
ComfyUI 已装好 H3 的 GGUF 主干 / qwen3vl-32b 文本编码器 / 视频+音频 VAE，
本脚本只负责「组 API 图 → 提交 → 轮询 → 下载」。

现状（2026-11-09）：链路跑通（提交/采样/解码/下载/合轨），但服务器上的第三方
MiniMax-H3-FL2VA-Pruned-Q3_K_M.gguf 在 2080 Ti 上输出纯黑画面+饱和音频（NaN 隐变量）。
换 Comfy-Org 官方 minimax_h3_fl2va_pruned_int8_convrot.safetensors 后用
`--loader safetensors`；完整证据与下一步见同目录 README-minimax-h3.md。

用法（仓根执行）：
  # 0) 探活 + 列出服务器上可用的 H3 权重
  python3 tools/scripts/minimax-h3-t2v.py --probe

  # 1) 只看将提交的 API 图，不占 GPU
  python3 tools/scripts/minimax-h3-t2v.py --dry-run --prompt "一颗红色拼豆在白色桌面缓慢旋转"

  # 2) 最小验证档（512x288 / 124 帧≈5.2s / turbo 6 步）
  python3 tools/scripts/minimax-h3-t2v.py --prompt "..." --out temp/minimax-h3-out

  # 3) 画质档：608x352 或 864x480；关 turbo 走 20 步
  python3 tools/scripts/minimax-h3-t2v.py --width 864 --height 480 --no-turbo

  # 4) 换成 Comfy-Org 官方 int8 safetensors（需先把模型放到 models/diffusion_models/）
  python3 tools/scripts/minimax-h3-t2v.py --loader safetensors --width 864 --height 480

关键约束（来自 ComfyUI 节点定义，实测口径）：
  · width/height 必须是 32 的倍数；
  · length 是 24fps 帧数，会吸附到模型 17k+5 网格（124 ≈ 5.2s，124–362 为训练区间）；
  · turbo LoRA = minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors，6 步；
    非 turbo 走主干 20 步（慢很多，11GB 卡优先 turbo）。
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_HOST = "http://192.168.1.16:8188"
MODEL = "MiniMax-H3-FL2VA-Pruned-Q3_K_M.gguf"
LORA = "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors"
CLIP = "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"
VAE_VIDEO = "minimax_h3_video_vae_int8_convrot.safetensors"
VAE_AUDIO = "minimax_h3_audio_vae_fp32.safetensors"
FPS = 24


def snap_length(seconds: float) -> int:
    """秒 → 24fps 帧数 → 吸附到 17k+5 网格（与官方模板 ComfyMathExpression 同式）。"""
    raw = max(5, round(seconds * FPS))
    return raw + (5 - raw % 17) % 17


def api(host: str, path: str, payload=None, timeout=60):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        host.rstrip("/") + path, data=data,
        headers={"Content-Type": "application/json"} if data else {},
        method="POST" if data else "GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise SystemExit(f"HTTP {e.code} {path}: {detail[:2000]}")


def build_graph(a) -> dict:
    model_node = "1"
    if a.turbo:
        graph_model = ["2", 0]
    else:
        graph_model = ["1", 0]
    decode_audio = "VAEDecodeAudioTiled" if a.tiled_audio else "VAEDecodeAudio"
    audio_inputs = {"samples": ["11", 0], "vae": ["5", 0]}
    if a.tiled_audio:
        audio_inputs.update(tile_size=512, overlap=64)
    model_ref = graph_model
    g = {
        "1": ({"class_type": "UNETLoader", "inputs": {
            "unet_name": a.model, "weight_dtype": "default"}} if a.loader == "safetensors" else
              {"class_type": "UnetLoaderGGUFAdvanced", "inputs": {
                  "unet_name": a.model, "dequant_dtype": a.gguf_dtype or "default",
                  "patch_dtype": a.gguf_dtype or "default", "patch_on_device": False}}
              if a.gguf_dtype else
              {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": a.model}}),
        "3": {"class_type": "CLIPLoader", "inputs": {
            "clip_name": a.clip, "type": "minimax", "device": a.clip_device}},
        "4": {"class_type": "VAELoader", "inputs": {"vae_name": a.vae_video}},
        "5": {"class_type": "VAELoader", "inputs": {"vae_name": a.vae_audio}},
        "6": {"class_type": "MiniMaxH3ImageToVideo", "inputs": {
            "clip": ["3", 0], "vae": ["4", 0], "prompt": a.prompt,
            "width": a.width, "height": a.height, "length": a.length}},
        "7": {"class_type": "BasicScheduler", "inputs": {
            "model": model_ref, "scheduler": "simple",
            "steps": a.steps, "denoise": 1.0}},
        "8": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "res_multistep"}},
        "9": {"class_type": "RandomNoise", "inputs": {"noise_seed": a.seed}},
        "10": {"class_type": "BasicGuider", "inputs": {
            "model": model_ref, "conditioning": ["6", 0]}},
        "11": {"class_type": "SamplerCustomAdvanced", "inputs": {
            "noise": ["9", 0], "guider": ["10", 0], "sampler": ["8", 0],
            "sigmas": ["7", 0], "latent_image": ["6", 1]}},
        "12": {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": ["4", 0]}},
        "13": {"class_type": decode_audio, "inputs": audio_inputs},
        "15": {"class_type": "SaveVideo", "inputs": {
            "video": ["14", 0], "filename_prefix": a.prefix, "format": "auto", "codec": "auto"}},
    }
    if a.audio_mode == "mux":
        g["14"] = {"class_type": "CreateVideo", "inputs": {
            "images": ["12", 0], "audio": ["13", 0], "fps": FPS}}
    else:
        g["14"] = {"class_type": "CreateVideo", "inputs": {"images": ["12", 0], "fps": FPS}}
    if a.audio_mode == "separate":
        g["16"] = {"class_type": "SaveAudioAdvanced", "inputs": {
            "audio": ["13", 0], "filename_prefix": a.prefix + "-audio",
            "format": "flac"}}
    if a.turbo:
        g["2"] = {"class_type": "LoraLoaderModelOnly", "inputs": {
            "model": [model_node, 0], "lora_name": a.lora,
            "strength_model": a.lora_strength}}
    if a.attention:
        g["17"] = {"class_type": "ModelAttentionBackend", "inputs": {
            "model": model_ref, "attention": a.attention}}
        g["7"]["inputs"]["model"] = ["17", 0]
        g["10"]["inputs"]["model"] = ["17", 0]
    return g


def probe(host):
    stats = api(host, "/system_stats", timeout=10)
    print("server:", json.dumps(stats.get("system", {}), ensure_ascii=False)[:400])
    for d in stats.get("devices", []):
        print(f"  gpu: {d.get('name')} vram_total={d.get('vram_total', 0)/2**30:.1f}GB "
              f"vram_free={d.get('vram_free', 0)/2**30:.1f}GB")
    info = api(host, "/object_info", timeout=30)
    checks = [
        ("UnetLoaderGGUF", "unet_name"), ("LoraLoaderModelOnly", "lora_name"),
        ("CLIPLoader", "clip_name"), ("VAELoader", "vae_name"),
    ]
    for node, key in checks:
        vals = info.get(node, {}).get("input", {}).get("required", {}).get(key, [[]])[0]
        print(f"{node}.{key}:")
        for v in vals:
            mark = " <--" if v in (MODEL, LORA, CLIP, VAE_VIDEO, VAE_AUDIO) else ""
            print(f"   {v}{mark}")
    for node in ("MiniMaxH3ImageToVideo", "SamplerCustomAdvanced", "VAEDecodeAudio", "SaveVideo"):
        print(f"node {node}: {'OK' if node in info else 'MISSING'}")


def main(argv):
    ap = argparse.ArgumentParser(description="MiniMax-H3 文生视频（内网 ComfyUI）")
    ap.add_argument("--host", default=os.environ.get("COMFY_HOST", DEFAULT_HOST))
    ap.add_argument("--prompt", default=(
        "微距俯拍一颗红色拼豆珠子在暖白桌面上缓慢自转，柔和棚拍光，浅景深，"
        "背景干净，画面稳定无跳变；只有轻微的环境底噪，不要音乐。"))
    ap.add_argument("--seconds", type=float, default=5.0, help="时长秒；会吸附到 17k+5 帧网格")
    ap.add_argument("--width", type=int, default=512)
    ap.add_argument("--height", type=int, default=288)
    ap.add_argument("--length", type=int, default=None, help="直接给帧数（覆盖 --seconds）")
    ap.add_argument("--steps", type=int, default=None, help="默认 turbo=6 / 非 turbo=20")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--audio-mode", choices=("mux", "separate", "silent"), default="separate",
                    help="mux=官方模板同款（AAC 直封，本机实测 NaN 报错）；"
                         "separate=静音 MP4 + FLAC，本地 ffmpeg 合轨（默认）；silent=只要画面")
    ap.add_argument("--tiled-audio", action="store_true", help="音频 VAE 分块解码（NaN 时的缓解尝试）")
    ap.add_argument("--turbo", dest="turbo", action="store_true", default=True)
    ap.add_argument("--no-turbo", dest="turbo", action="store_false")
    ap.add_argument("--lora-strength", type=float, default=1.0)
    ap.add_argument("--loader", choices=("gguf", "safetensors"), default="gguf",
                    help="gguf=第三方 Q3_K_M；safetensors=Comfy-Org 官方 int8（推荐，需先下载）")
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--gguf-dtype", choices=("", "float32", "float16", "bfloat16", "target"),
                    default="", help="GGUF 反量化精度；空=UnetLoaderGGUF 默认，bfloat16 用于排查 fp16 溢出")
    ap.add_argument("--lora", default=LORA)
    ap.add_argument("--clip", default=CLIP)
    ap.add_argument("--clip-device", choices=("default", "cpu"), default="default",
                    help="文本编码器跑 CPU：nvfp4 在 Turing(2080Ti) 上疑似出 NaN 时的对照实验")
    ap.add_argument("--attention", choices=("", "pytorch attention", "comfy kitchen attention"),
                    default="", help="显式固定注意力后端；空=用模型默认")
    ap.add_argument("--vae-video", default=VAE_VIDEO)
    ap.add_argument("--vae-audio", default=VAE_AUDIO)
    ap.add_argument("--prefix", default="minimax-h3/verify")
    ap.add_argument("--out", default="temp/minimax-h3-out")
    ap.add_argument("--timeout", type=int, default=7200, help="轮询上限秒")
    ap.add_argument("--poll", type=float, default=10.0, help="轮询间隔秒")
    ap.add_argument("--probe", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)

    if a.probe:
        probe(a.host)
        return 0

    if a.width % 32 or a.height % 32:
        raise SystemExit("width/height 必须是 32 的倍数")
    a.length = a.length or snap_length(a.seconds)
    a.steps = a.steps or (8 if a.turbo else 20)
    if a.loader == "safetensors" and a.model == MODEL:
        a.model = "minimax_h3_fl2va_pruned_int8_convrot.safetensors"

    graph = build_graph(a)
    if a.dry_run:
        print(json.dumps(graph, ensure_ascii=False, indent=2))
        return 0

    print(f"[h3] {a.width}x{a.height} length={a.length}f "
          f"({a.length/FPS:.2f}s @ {FPS}fps) steps={a.steps} turbo={a.turbo} "
          f"seed={a.seed} audio={a.audio_mode}")
    t0 = time.time()
    res = api(a.host, "/prompt", {"prompt": graph, "client_id": f"wxgame-h3-{os.getpid()}"}, timeout=120)
    pid = res.get("prompt_id")
    if not pid:
        raise SystemExit(f"提交失败：{json.dumps(res, ensure_ascii=False)[:1200]}")
    print(f"[h3] queued prompt_id={pid}")

    deadline = t0 + a.timeout
    entry = None
    # 大模型换页时 ComfyUI 的事件循环可能短暂无响应；轮询超时只告警、不退出。
    poll_errors = 0
    while time.time() < deadline:
        time.sleep(a.poll)
        try:
            hist = api(a.host, f"/history/{pid}", timeout=90)
            if pid in hist:
                entry = hist[pid]
                break
            q = api(a.host, "/queue", timeout=60)
            running = [x for x in q.get("queue_running", []) if x[1] == pid]
            pending = [x for x in q.get("queue_pending", []) if x[1] == pid]
            state = "running" if running else ("queued" if pending else "unknown")
            print(f"[h3] {time.time()-t0:6.0f}s {state}")
            poll_errors = 0
        except (TimeoutError, urllib.error.URLError, ConnectionError) as e:
            poll_errors += 1
            print(f"[h3] {time.time()-t0:6.0f}s poll timeout/error ({poll_errors}): {e}")
            if poll_errors >= 12:
                raise SystemExit(f"连续 {poll_errors} 次轮询失败，服务可能已卡死：prompt_id={pid}")
    if entry is None:
        raise SystemExit(f"超时 {a.timeout}s，任务仍在排队/运行：prompt_id={pid}")

    st = entry.get("status", {})
    if st.get("status_str") != "success":
        msgs = json.dumps(st.get("messages", []), ensure_ascii=False)[:3000]
        raise SystemExit(f"生成失败：status={st.get('status_str')}\n{msgs}")

    os.makedirs(a.out, exist_ok=True)
    saved = []
    for node_id, out in entry.get("outputs", {}).items():
        for key in ("images", "video", "gifs", "audio"):
            for item in out.get(key, []) or []:
                if not isinstance(item, dict):
                    continue
                q = urllib.parse.urlencode({
                    "filename": item.get("filename", ""),
                    "subfolder": item.get("subfolder", ""),
                    "type": item.get("type", "output"),
                })
                data = urllib.request.urlopen(f"{a.host.rstrip('/')}/view?{q}", timeout=300).read()
                suffix = os.path.splitext(item.get("filename", ""))[1] or ".bin"
                path = os.path.join(a.out, f"seed{a.seed}-{a.width}x{a.height}-{a.length}f{suffix}")
                with open(path, "wb") as f:
                    f.write(data)
                saved.append(path)

    # separate 模式：本地 ffmpeg 合轨（服务端 AAC 编码器对 NaN 音频报 22，绕过它）
    if a.audio_mode == "separate":
        videos = [p for p in saved if p.lower().endswith((".mp4", ".mkv", ".webm"))]
        audios = [p for p in saved if p.lower().endswith((".flac", ".wav", ".mp3"))]
        if videos and audios and shutil.which("ffmpeg"):
            muxed = os.path.join(a.out, f"seed{a.seed}-{a.width}x{a.height}-{a.length}f-av.mp4")
            # aformat 先转 s16：把 NaN/Inf 压成静音，再进 AAC
            cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", videos[0], "-i", audios[0],
                   "-c:v", "copy", "-af", "aformat=sample_fmts=s16:channel_layouts=stereo",
                   "-c:a", "aac", "-shortest", muxed]
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode == 0:
                saved.append(muxed)
                print(f"[h3] muxed: {muxed}")
            else:
                print(f"[h3] ffmpeg 合轨失败，保留静音视频：{r.stderr[:300]}")

    meta = {
        "prompt": a.prompt, "width": a.width, "height": a.height, "length": a.length,
        "fps": FPS, "seconds_actual": a.length / FPS, "steps": a.steps,
        "turbo": a.turbo, "seed": a.seed, "model": a.model, "lora": a.lora if a.turbo else None,
        "clip": a.clip, "vae_video": a.vae_video, "vae_audio": a.vae_audio,
        "prompt_id": pid, "elapsed_s": round(time.time() - t0, 1), "files": saved,
        "graph": graph,
    }
    meta_path = os.path.join(a.out, f"seed{a.seed}-{a.width}x{a.height}-{a.length}f.json")
    with open(meta_path, "w") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"[h3] done in {meta['elapsed_s']}s")
    for p in saved:
        print("  ", p)
    print("  ", meta_path)
    return 0 if saved else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
