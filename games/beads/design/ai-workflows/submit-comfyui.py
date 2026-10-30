#!/usr/bin/env python3
"""ComfyUI Server API 最小提交器（产线 B 外部出图入口，仅标准库）。

用法（从仓根）：
    python3 games/beads/design/ai-workflows/submit-comfyui.py \
        --host http://192.168.1.16:8188 \
        --workflow games/beads/design/ai-workflows/workflows/qwen-image-2.1-t2i.api.json \
        --prompt "game UI element, perler beads theme, ..." \
        --seed 42 --out temp/comfyui-out/

节点 id 补丁路径钉死在当前这份 qwen-image 2.1 workflow（导出自服务器 UI）：
  - "459:474".on_false  = 原始 prompt；switch=true 时改走 "459:471" TextGenerate 扩写
  - "459:458".seed / "459:471".sampling_mode.seed = 采样/扩写种子（同值保确定性）
  - "13".aspect_ratio / megapixels = 分辨率选择器
换 workflow 需同步改 NODES（这就是全部魔法数字，不假装通用）。

含标准 CLIPTextEncode 节点的 workflow（如 sdxl-sticker.api.json）走通用探测分支：
  正/负提示词 = KSampler.positive/negative 链接指向的 CLIPTextEncode.text；
  种子 = KSampler.seed；--mp 映射到 EmptyLatentImage 边长（sqrt(mp)×1024）。
  注：cfg>1 时 --negative 真生效（qwen 那份 cfg=1 会忽略）。

Flux 类（SamplerCustomAdvanced，如 flux-dev-sticker.api.json）同分支自动识别：
  正向 = 沿 guider→conditioning 链回溯到 CLIPTextEncode（可穿 FluxGuidance）；
  无负面入口（单条件引导，--negative 会告警忽略）；种子 = RandomNoise.noise_seed；
  尺寸 = EmptySD3LatentImage（也兼容 EmptyLatentImage）。

Qwen 指令编辑类（TextEncodeQwenImageEditPlus，如 qwen-image-2.1-edit*.api.json）：
  正向 = 该节点的 prompt 字段（参考图走 image1，不是 img2img 的噪声降噪）；种子 = KSampler.seed；
  无负面入口（cfg=1）；--image 支持「节点id=路径」定位单个 LoadImage（带遮罩的工作流有两个 LoadImage，必须分开传）。
"""
import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

NODES = {
    "prompt_switch": "459:474",
    "prompt_enhancer": "459:471",
    "ksampler": "459:458",
    "resolution": "13",
}


def http_json(url: str, payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"} if data else {},
        method="POST" if data else "GET",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def upload_image(host: str, path: str) -> str:
    """POST /upload/image（multipart，仅标准库）→ 返回服务器端文件名，供 LoadImage 引用。
    传入带 alpha 通道的 RGBA PNG 时，ComfyUI LoadImage 会把 alpha 当遮罩输出。"""
    boundary = uuid.uuid4().hex
    fn = Path(path).name
    data = Path(path).read_bytes()
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="{fn}"\r\n'
        f"Content-Type: image/png\r\n\r\n"
    ).encode() + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"{host}/upload/image?type=input&overwrite=true", data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)["name"]


def _find_text_encode(wf: dict, io, depth: int = 0) -> str | None:
    """沿链接回溯到 CLIPTextEncode 节点 id（可穿 FluxGuidance 等中转节点）。"""
    if depth > 6 or not isinstance(io, list):
        return None
    src = io[0]
    if wf[src]["class_type"] == "CLIPTextEncode":
        return src
    for v in wf[src]["inputs"].values():
        if isinstance(v, list):
            r = _find_text_encode(wf, v, depth + 1)
            if r:
                return r
    return None


def patch_workflow(wf: dict, args: argparse.Namespace) -> None:
    edit = [n for n in wf.values() if n.get("class_type") == "TextEncodeQwenImageEditPlus"]
    if edit:
        # Qwen 指令编辑：提示词在 prompt 字段；cfg=1 无负面入口
        if args.prompt:
            edit[0]["inputs"]["prompt"] = args.prompt
        if args.negative:
            print("WARN: Qwen 编辑类工作流 cfg=1，--negative 忽略", file=sys.stderr)
        ks = next((n for n in wf.values() if n.get("class_type") == "KSampler"), None)
        if ks and args.seed is not None:
            ks["inputs"]["seed"] = args.seed
        return
    if any(n.get("class_type") == "CLIPTextEncode" for n in wf.values()):
        # 通用分支：标准 KSampler（SDXL 类）或 SamplerCustomAdvanced（Flux 类）
        ks = next((n for n in wf.values() if n.get("class_type") == "KSampler"), None)
        if ks:
            if args.prompt:
                wf[ks["inputs"]["positive"][0]]["inputs"]["text"] = args.prompt
            if args.negative:
                wf[ks["inputs"]["negative"][0]]["inputs"]["text"] = args.negative
            if args.seed is not None:
                ks["inputs"]["seed"] = args.seed
        else:
            sca = next(n for n in wf.values() if n.get("class_type") == "SamplerCustomAdvanced")
            if args.prompt:
                pos = _find_text_encode(wf, sca["inputs"]["guider"])
                wf[pos]["inputs"]["text"] = args.prompt
            if args.negative:
                print("WARN: Flux 单条件引导无负面入口，--negative 忽略", file=sys.stderr)
            if args.seed is not None:
                for n in wf.values():
                    if n.get("class_type") == "RandomNoise":
                        n["inputs"]["noise_seed"] = args.seed
        if args.mp is not None:
            side = round((args.mp ** 0.5) * 1024)
            for n in wf.values():
                # ModelSamplingFlux 的 width/height 参与 shift 计算，改尺寸必须同步（boss 2048 事故根因）
                if n.get("class_type") in ("EmptyLatentImage", "EmptySD3LatentImage", "ModelSamplingFlux"):
                    n["inputs"].update(width=side, height=side)
        return
    if NODES["prompt_switch"] not in wf:
        # 非 qwen 结构（无 CLIPTextEncode 也无提示词开关，如纯分割/后处理链）：没有可 patch 的提示词档
        if any(v is not None for v in (args.prompt, args.seed, args.ratio, args.mp)) or args.enhance:
            print("WARN: 工作流无 CLIPTextEncode 且非 qwen 结构，--prompt/--seed/--ratio/--mp/--enhance 全部忽略",
                  file=sys.stderr)
        return
    sw = wf[NODES["prompt_switch"]]["inputs"]
    if args.prompt:
        sw["on_false"] = args.prompt
    if args.enhance:
        sw["switch"] = True
        if args.prompt:
            wf[NODES["prompt_enhancer"]]["inputs"]["prompt"] = args.prompt
    if args.seed is not None:
        wf[NODES["ksampler"]]["inputs"]["seed"] = args.seed
        wf[NODES["prompt_enhancer"]]["inputs"]["sampling_mode.seed"] = args.seed
    if args.ratio:
        # ResolutionSelector 是 COMBO 枚举：非法值服务端照样返回 execution_success 但零产物，必须本地拦住
        try:
            opts = http_json(f"{args.host}/object_info/ResolutionSelector")[
                "ResolutionSelector"]["input"]["required"]["aspect_ratio"][1]["options"]
        except Exception as e:  # 拿不到枚举就别拦，只提示
            opts = []
            print(f"WARN: 取 ResolutionSelector 失败（{e}），跳过 --ratio 校验", file=sys.stderr)
        if opts and args.ratio not in opts:
            sys.exit(f"非法 --ratio：{args.ratio!r}\n合法值：{opts}")
        wf[NODES["resolution"]]["inputs"]["aspect_ratio"] = args.ratio
    if args.mp is not None:
        wf[NODES["resolution"]]["inputs"]["megapixels"] = args.mp


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--host", default="http://192.168.1.16:8188")
    ap.add_argument("--workflow", required=True)
    ap.add_argument("--prompt")
    ap.add_argument("--negative", help="仅含标准 CLIPTextEncode 且 cfg>1 的 workflow 生效")
    ap.add_argument("--seed", type=int)
    ap.add_argument("--enhance", action="store_true", help="走 TextGenerate 扩写分支（qwen3.5 PE）")
    ap.add_argument("--ratio", help='如 "1:1 (Square)"')
    ap.add_argument("--mp", type=float, help="megapixels，2048x2048 ≈ 4")
    ap.add_argument("--out", default="temp/comfyui-out")
    ap.add_argument("--image", action="append", metavar="[NODE=]PATH",
                    help="上传到 ComfyUI 并填进 LoadImage（inpaint 用带 alpha 遮罩的 RGBA PNG）。"
                         "不带节点号时填所有 LoadImage；带节点号只改那一个，可重复",
                    )
    ap.add_argument("--override", action="append", metavar="NODE:KEY=VAL",
                    help='临时改任意节点输入，如 "18:strength_model=0"（可重复）')
    ap.add_argument("--timeout", type=int, default=600)
    args = ap.parse_args()

    wf = json.loads(Path(args.workflow).read_text())
    patch_workflow(wf, args)
    for spec in args.image or []:
        node_id, _, path = spec.rpartition("=")
        if node_id and node_id not in wf:
            sys.exit(f"--image 节点号不存在：{node_id}")
        name = upload_image(args.host, path if node_id else spec)
        targets = [wf[node_id]] if node_id else [n for n in wf.values() if n.get("class_type") == "LoadImage"]
        if not targets:
            print("WARN: workflow 无 LoadImage 节点，--image 未生效", file=sys.stderr)
        for n in targets:
            n["inputs"]["image"] = name
        print(f"uploaded {path if node_id else spec} -> {name}", flush=True)
    for ov in getattr(args, "override", None) or []:
        nid, kv = ov.split(":", 1)
        k, v = kv.split("=", 1)
        try:
            v = json.loads(v)
        except ValueError:
            pass
        wf[nid]["inputs"][k] = v

    pid = http_json(f"{args.host}/prompt", {"prompt": wf, "client_id": uuid.uuid4().hex})["prompt_id"]
    print(f"queued {pid}", flush=True)

    deadline = time.monotonic() + args.timeout
    while time.monotonic() < deadline:
        time.sleep(2)
        hist = http_json(f"{args.host}/history/{pid}")
        if pid in hist:
            break
        # 排队中：/queue 里还有没有跑完的前置任务时可在此观察，YAGNI 不做显示
    else:
        print(f"TIMEOUT after {args.timeout}s", file=sys.stderr)
        return 1

    entry = hist[pid]
    status = entry.get("status", {})
    if status.get("status_str") == "error":
        print(f"workflow error: {json.dumps(status, ensure_ascii=False)}", file=sys.stderr)
        return 1

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    saved = []
    for node_out in entry.get("outputs", {}).values():
        for img in node_out.get("images", []):
            q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img.get("type", "output")})
            req = urllib.request.Request(f"{args.host}/view?{q}")
            with urllib.request.urlopen(req, timeout=60) as resp, (out_dir / img["filename"]).open("wb") as f:
                f.write(resp.read())
            saved.append(out_dir / img["filename"])
    for p in saved:
        print(p)
    return 0 if saved else 1


if __name__ == "__main__":
    sys.exit(main())
