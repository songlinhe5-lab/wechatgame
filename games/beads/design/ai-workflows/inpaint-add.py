#!/usr/bin/env python3
"""局部重绘实验：区域裁片 → 模型原生档 inpaint → 贴回原图。
用法：inpaint-add.py <tag> <x0> <y0> <x1> <y1> <prompt-file> [cfg] [backend] [shape] [feather] [denoise]
  backend sdxl|qwen   shape rect|ellipse|round|point   feather 羽化像素（0=硬边，可证零改动）
  shape=point：argv 语义切换——(x0,y0)=种子点、(x1,y1)=搜索半径（传 0 则默认 320）；
               半径只需“大到包住元素”，不必贴合；mask = 从种子洪水填充出的元素真实轮廓
               （PIL 原生，零下载）+ 自动填字洞，外扩 3px 吃掉抗锯齿边。
"""
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

REPO = Path(__file__).resolve().parents[2]
BASE = REPO / "games/beads/design/references/menu-showcase-20261010/v1-mainmenu-final.png"
HERE = Path(__file__).resolve().parent
SUBMIT = REPO / "games/beads/design/ai-workflows/submit-comfyui.py"
BACKENDS = {
    "sdxl": dict(wf=REPO / "games/beads/design/ai-workflows/workflows/sdxl-inpaint.api.json",
                 ks="6", save="8", steps="32"),
    "qwen": dict(wf=HERE / "qwen-turbo-inpaint.api.json", ks="8", save="10", steps="8"),
}
PAD = 160
SIDE = 1024
FILL = (255, 0, 255)      # 洪水填充哨兵色（菜单调色板里没有品红）


def make_mask(crop, box, shape):
    """重绘遮罩（crop 坐标）：rect / ellipse / round=圆角矩形 / point=种子点出真轮廓。

    ponytail: point 靠平色 UI 的洪水填充，只适用于背景与元素色差明显的图；照片级/渐变背景
    要改用真分割模型（等 GroundingDINO 或 SAM3 权重入库）。"""
    if shape != "point":
        hard = Image.new("L", crop.size, 0)
        d = ImageDraw.Draw(hard)
        if shape == "ellipse":
            d.ellipse(box, fill=255)
        elif shape == "round":
            d.rounded_rectangle(box, radius=(box[3] - box[1]) // 3, fill=255)
        else:
            d.rectangle(box, fill=255)
        return hard
    ff = crop.convert("RGB").copy()
    ImageDraw.floodfill(ff, (box[0], box[1]), FILL, thresh=24)          # 种子点→元素
    el = (np.asarray(ff) == np.array(FILL)).all(-1)
    # 在二值图上从边界灌「元素以外」：灌不到的就是被元素围住的孔洞（文字/图标）。
    # 不用颜色洪水判背景：木纹、渐变这类非平色区会被误当元素。
    # ⚠ Image.fromarray() 给的是 readonly 图，ImageDraw.floodfill 的写入会静默落到副本上——必须 .convert("L") 拿可写图
    mm = Image.fromarray((el * 255).astype(np.uint8)).convert("L")
    for c in ((0, 0), (crop.width - 1, 0), (0, crop.height - 1), (crop.width - 1, crop.height - 1)):
        if not el[c[1], c[0]]:                                          # 角落压在元素上就跳过（否则会把元素本身灌掉）
            ImageDraw.floodfill(mm, c, 128, thresh=1)
    m = np.asarray(mm) != 128
    if m.mean() > 0.9:
        sys.exit(f"point 模式失败：元素占比 {m.mean():.0%}——种子点洪水漏到背景了，调 thresh 或缩窗")
    # MaxFilter(7)=半径 3 膨胀：把 flood fill 停在边缘的抗锯齿那一圈纳进来
    return Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))


def main():
    a = sys.argv
    tag, x0, y0, x1, y1, pf = a[1], *map(int, a[2:6]), a[6]
    cfg = a[7] if len(a) > 7 else "6.0"
    be = a[8] if len(a) > 8 else "sdxl"
    shape = a[9] if len(a) > 9 else "rect"
    feather = int(a[10]) if len(a) > 10 else 0
    denoise = a[11] if len(a) > 11 else "1.0"
    B = BACKENDS[be]

    base = Image.open(BASE).convert("RGB")
    if shape == "point":
        sx, sy = x0, y0                              # 种子点
        rx, ry = abs(x1) or 320, abs(y1) or 320      # 半径（不必贴合，包住就行）
        x0, y0, x1, y1 = sx - rx, sy - ry, sx + rx, sy + ry
    else:
        sx, sy = x0, y0
    px0, py0 = max(0, x0 - PAD), max(0, y0 - PAD)
    px1, py1 = min(base.width, x1 + PAD), min(base.height, y1 + PAD)
    crop = base.crop((px0, py0, px1, py1))

    # 重绘遮罩（crop 坐标）：box[:2] = 种子（非 point 模式就是窗口左上角）
    box = [sx - px0, sy - py0, x1 - px0, y1 - py0]
    hard = make_mask(crop, box, shape)

    big = tuple(round(v * (SIDE / max(crop.size)) / 8) * 8 for v in crop.size)
    rgba = crop.convert("RGBA").copy()
    rgba.putalpha(ImageOps.invert(hard))      # ComfyUI：mask = 1 - alpha，透明=重绘
    src = HERE / f"{tag}-src.png"
    rgba.resize(big, Image.LANCZOS).save(src)

    pre = f"{be}-{tag}"
    ov = ["--override", f"{B['save']}:filename_prefix={pre}",
          "--override", f"{B['ks']}:steps={B['steps']}",
          "--override", f"{B['ks']}:denoise={denoise}"]
    if be == "sdxl":
        ov += ["--override", f"{B['ks']}:cfg={cfg}"]
    subprocess.run([
        sys.executable, str(SUBMIT), "--workflow", str(B["wf"]), "--image", str(src),
        "--seed", os.environ.get("SEED", "42"), "--out", str(HERE), "--prompt", Path(pf).read_text().strip(),
        "--negative", "text, letters, words, chinese, watermark, photorealistic, "
                      "gradient, drop shadow, texture, mandala, perler beads",
        *ov, "--timeout", "900",
    ], check=True, cwd=REPO)

    out = sorted(HERE.glob(f"{pre}_*.png"))[-1]
    patch = Image.open(out).convert("RGB").resize(crop.size, Image.LANCZOS)
    blend = hard.filter(ImageFilter.GaussianBlur(feather)) if feather else hard
    merged = Image.composite(patch, crop, blend)      # feather=0 时等价硬边贴
    res = base.copy()
    res.paste(merged, (px0, py0))
    dst = HERE / f"{tag}-{be}-f{feather}.png"
    res.save(dst)

    mask_full = Image.new("L", base.size, 0)
    mask_full.paste(hard, (px0, py0))
    keep = np.asarray(mask_full) == 0
    diff = np.abs(np.asarray(base).astype(int) - np.asarray(res).astype(int))
    bleed = int((diff[keep].sum(-1) > 0).sum())
    print(f"{dst.name}  size={res.size}  {be}/{shape}/feather={feather}")
    rect_area = max(1, (x1 - x0) * (y1 - y0))
    print(f"  重绘面积 = {int((np.asarray(hard) > 127).sum())}px  占搜索窗 {(np.asarray(hard) > 127).sum() / rect_area * 100:.1f}%"
          + ("  （point：轮廓比手输矩形小就是赢）" if shape == "point" else "  （rect：应近 100%）"))
    print(f"  硬区外 maxdiff = {diff[keep].max()}  外溢像素 = {bleed}"
          + ("  （必须 0 / 0）" if not feather else f"  （羽化外溢 ≈{feather}px 带宽）"))
    print(f"  重绘内 meandiff = {diff[~keep].mean():.1f}  面积 {int((~keep).sum())} px")


if __name__ == "__main__":
    main()
