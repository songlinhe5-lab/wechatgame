#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""纯黑排除区 → alpha=0（确定性 floodfill，零模型、零重绘）。

用途：20 大关 180 张母版的背景剔除。探路张 probe-s42 首次验证（WXG-T-974 谱系）。

为什么按「近黑」而不是精确 #000000 判定：
  qwen-image-3.0-pro 把背景画成 0-24 的近黑噪点，实测精确 #000000 只占 21.04%，
  近黑(max<=24) 占 58.85% —— 按精确纯黑抠会留下大片脏边，全部喂进 studio 量化。

用法：python3 extract-alpha.py <in.png> <out.png> [thresh=72]
  thresh 是 PIL floodfill 的 _color_diff 门限（RGB 三通道绝对差之和），
  72 = 24*3 ⇒ 能覆盖每通道 0-24 的噪点；主体四色最暗通道远高于此 ⇒ 不啃主体。
"""
import json
import sys

import numpy as np
from PIL import Image, ImageDraw

SENTINEL = (255, 0, 255)  # 品红，主体十色板里不存在


def extract(src, dst, thresh=72):
    im = Image.open(src).convert("RGB")
    # ponytail: Image.fromarray 得到的图 readonly=1，floodfill 会静默写进副本 ⇒ 必须 copy
    work = im.copy()
    w, h = work.size
    rgb = np.asarray(im)
    seeded = []
    # 用**源图**判断角是否可作种子：work 会被上一个角灌成品红，拿它判断会误判「主体触边」
    for xy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if max(rgb[xy[1], xy[0]]) > 24:  # 主体触边 ⇒ 不灌该角，避免把主体判成排除区
            continue
        ImageDraw.floodfill(work, xy, SENTINEL, thresh=thresh)
        seeded.append(xy)

    bg = np.all(np.asarray(work) == np.array(SENTINEL, dtype=np.uint8), axis=2)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    out = Image.fromarray(np.dstack([rgb, alpha]), "RGBA")
    out.save(dst)

    # ── 验收（六道）──
    fg = alpha == 255
    # 主体连通分量：G3 正解 = 4 连通分量恰为 1，用 ndimage 精确计数。
    # 旧版「画布中心播种灌一次」是启发式：3/4 侧视等主体不居中构图会误报 False
    # （A02 狐狸 v3 实踩，scipy 复核 1 分量）。语义对齐 series-spec G3。
    try:
        from scipy import ndimage
        lbl, ncomp = ndimage.label(fg)  # 默认结构 = 4 连通
        connected = ncomp == 1
        reached_px = int((lbl > 0).sum()) if connected else 0
    except ImportError:
        # scipy 缺席时退回中心播种启发式（旧行为）
        bim = Image.fromarray((fg * 255).astype(np.uint8), "L").copy()
        seed = (w // 2, h // 2)
        if bim.getpixel(seed) == 255:
            ImageDraw.floodfill(bim, seed, 128, thresh=0)
            reached_px = int((np.asarray(bim) == 128).sum())
            connected = reached_px == int(fg.sum())
        else:
            connected, reached_px = False, 0
    # 回读成品，实测 RGB 逐像素原值不变（⛔ 只改 alpha，零重绘）
    saved = np.asarray(Image.open(dst).convert("RGBA"))
    rgb_unchanged = bool(np.array_equal(saved[:, :, :3], rgb))
    ys, xs = np.where(fg)
    metrics = {
        "size": [w, h],
        "seeded_corners": seeded,
        "alpha0_pct": round(float((alpha == 0).mean() * 100), 3),
        "alpha255_pct": round(float(fg.mean() * 100), 3),
        "four_corners_transparent": bool(all(alpha[y, x] == 0 for y, x in
                                            ((0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)))),
        "nearblack_left_in_subject_px": int((fg & (rgb.max(2) <= 24)).sum()),
        "subject_single_connected": bool(connected),
        "subject_reached_px": reached_px,
        "subject_bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
        "subject_bbox_pct": round(float((xs.max() - xs.min() + 1) * (ys.max() - ys.min() + 1) / (w * h) * 100), 2),
        "rgb_unchanged": rgb_unchanged,  # 回读成品逐像素比对源图 RGB
    }
    return metrics


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    src, dst = sys.argv[1], sys.argv[2]
    t = int(sys.argv[3]) if len(sys.argv) > 3 else 72
    m = extract(src, dst, t)
    print(json.dumps(m, ensure_ascii=False, indent=2))
    open(dst.replace(".png", "-metrics.json"), "w").write(json.dumps(m, ensure_ascii=False, indent=2))
