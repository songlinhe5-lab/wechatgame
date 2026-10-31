#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""单元素切图：AI 出的「一件一张 + 平色底」原图 → 真 alpha 透明底件 + 四道机检。

与 `cut-sprites-local.py` 的分工：那张吃**整页 mood 图**（多元素、按连通域拆件）；
本张吃**已经是一件一图**的产物（`menu-3d-asset-brief.md` §3/§5 交付口径），
只做「去底 → 留主体 → 填洞 → bbox 裁 → 缩到 @2x → 判据」。零外部依赖（numpy + PIL）。

流程（顺序不可换，洞必须在二值图上填）：
  1. 背景色 C = 图四周中位数（勿假设是纯白/纯灰，实测才准）
  2. 把像素投到 C 的单位向量，`perp < thresh 且 t ∈ [cn-90, cn+2]` 判为背景
     （= 平背景 **加上比背景更暗的中性投影** ⇒ 落地投影不会被吃进 alpha）→ fg = ~bg
  3. 只留**最大连通域**（散点、脱离主体的投影碎块在此被丢掉）
  4. 在二值图上从四周灌「非 fg」，灌不到的洞 → 并入 fg（文字内孔、凹陷区自动填）
  5. 内容缩到「宽 = 目标宽」（⛔ 不放大）→ 合成 8% 透明安全边 → 存 RGBA png
  6. 机检：真 alpha / 透明占比 / 四边安全边 ≥8% / 内容宽未缩水 / 长宽比偏差 ≤10%
     （10% = 交付件由运行时按**设计框非等比绘制**，无烧字的木件上 10% 不可见；超出即重出）

⚠ 3/4 两步的连通域与洪泛跑在**1/F 粗网格**上（纯 Python BFS，1M px 太慢），
  结果膨胀回全分辨率后再与全分辨率 fg 相与 ⇒ 边缘不啃、最终件精度不受影响（成品本就要缩到 ≤608px）。

用法：
  python3 cut-single-local.py IN.png OUT_DIR --target 608x166 [--thresh 28] [--pad 0.06] [--name plate]

退出码：机检不过 ⇒ 1（打印 FAIL 行），过 ⇒ 0。
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None
F = 2  # 粗网格倍率：标号/洪泛跑在 1/F 尺寸上


def _bfs_reach(allow: np.ndarray, seeds: list[tuple[int, int]]) -> np.ndarray:
    """4 邻接洪泛：从 seeds 出发只走 allow 为真的格，返回到达集。"""
    h, w = allow.shape
    seen = np.zeros_like(allow)
    q = deque()
    for y, x in seeds:
        if allow[y, x] and not seen[y, x]:
            seen[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and allow[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


def _border_seeds(h: int, w: int) -> list[tuple[int, int]]:
    return [(y, x) for y in range(h) for x in (0, w - 1)] + \
           [(y, x) for x in range(w) for y in (0, h - 1)]


def _grow(mask: np.ndarray, size: int) -> np.ndarray:
    """二值图膨胀（PIL MaxFilter），用于把粗网格结果放回全分辨率时不吃边。"""
    im = Image.fromarray((mask.astype(np.uint8)) * 255)
    im = im.filter(ImageFilter.MaxFilter(size | 1))
    return np.asarray(im) > 127


def _upsample(mask: np.ndarray, shape: tuple[int, int]) -> np.ndarray:
    h, w = shape
    out = np.zeros((h, w), dtype=bool)
    out[: mask.shape[0] * F, : mask.shape[1] * F] = np.repeat(np.repeat(mask, F, 0), F, 1)
    return out


def largest_component(fg: np.ndarray) -> np.ndarray:
    """8 邻接连通域，返回最大那块（粗网格跑，膨胀回贴）。"""
    small = fg[::F, ::F]
    h, w = small.shape
    lab = np.zeros_like(small)
    best, best_n = None, 0
    structure = [(dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]
    for sy in range(h):
        for sx in range(w):
            if small[sy, sx] and not lab[sy, sx]:
                cur = np.zeros_like(small)
                n = 0
                q = deque([(sy, sx)])
                lab[sy, sx] = True
                cur[sy, sx] = True
                while q:
                    y, x = q.popleft()
                    n += 1
                    for dy, dx in structure:
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = True
                            cur[ny, nx] = True
                            q.append((ny, nx))
                if n > best_n:
                    best, best_n = cur, n
    if best is None:
        return fg
    return _grow(_upsample(best, fg.shape), 2 * F + 1)


def cut(src: str, out_dir: str, target: tuple[int, int], thresh: int, pad: float, name: str) -> int:
    im = Image.open(src).convert("RGB")
    a = np.asarray(im, dtype=np.int16)
    h, w = a.shape[:2]

    border = np.concatenate([a[0:4].reshape(-1, 3), a[-4:].reshape(-1, 3),
                             a[:, 0:4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    C = np.median(border, axis=0)
    # 背景判据沿用 cut-sprites-local.py 的 KEEP_SHADOW=0 口径（⛔ 自创「距背景够远就算前景」，
    # 那条会把中性灰的落地投影一起吃进来，实测底部 6 行不透明率 85-94%）：
    #   把像素投到背景单位向量 u，perp = 偏离背景线的色度分量，t = 亮度分量
    #   bg = perp<thresh 且 t ∈ [cn-90, cn+2] ⇒ 平背景 + 比背景更暗的中性投影算背景，
    #   而暖色木牌（perp 大）与深胡桃胶囊（t 远低于 cn-90）都保住。
    cn = float(np.linalg.norm(C))
    u = C / cn
    t = a @ u
    perp = np.linalg.norm(a - t[:, :, None] * u, axis=2)
    fg = ~((perp < thresh) & (t <= cn + 2) & (t >= cn - 90))

    fg = fg & largest_component(fg)   # 相与 ⇒ 膨胀环不会把背景带进来
    small = fg[::F, ::F]
    reached = _bfs_reach(~small, _border_seeds(*small.shape))
    holes = _upsample(~small & ~reached, fg.shape)   # 非主体且从外部灌不到 = 洞
    fg = fg | holes

    ys, xs = np.nonzero(fg)
    if len(ys) == 0:
        print("FAIL: 主体为空（thresh 太大或背景判定失败）")
        return 1
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    bw, bh = x1 - x0, y1 - y0
    touches = (x0 == 0 or y0 == 0 or x1 == w or y1 == h)

    alpha = np.where(fg, 255, 0).astype(np.uint8)
    rgba = np.dstack([np.asarray(im, dtype=np.uint8), alpha])[y0:y1, x0:x1]
    content = Image.fromarray(rgba, "RGBA")

    # 缩到「内容宽 = 目标宽」（⛔ 不放大；高度由自然长宽比定，强塞目标框 =  distortion）
    tw, th = target
    scale = min(1.0, tw / bw)
    if scale < 1.0:
        content = content.resize((max(1, round(bw * scale)), max(1, round(bh * scale))), Image.LANCZOS)
    cw, ch = content.size

    # 合成 8% 透明安全边（源图贴边时的合规出路：加的是全透明像素，⛔ 不重绘）
    mx = my = max(2, round(max(cw, ch) * pad))
    canvas = Image.new("RGBA", (cw + 2 * mx, ch + 2 * my), (0, 0, 0, 0))
    canvas.paste(content, (mx, my), content)

    os.makedirs(out_dir, exist_ok=True)
    dst = os.path.join(out_dir, f"{name}.png")
    canvas.save(dst)

    # —— 机检（brief §6）——
    arr = np.asarray(canvas)
    sa = arr[:, :, 3]
    sh, sw = sa.shape
    cys, cxs = np.nonzero(sa)
    m_l, m_r = cxs.min(), sw - 1 - cxs.max()
    m_t, m_b = cys.min(), sh - 1 - cys.max()
    min_margin = min(m_l, m_r, m_t, m_b)
    nat_aspect, want_aspect = bw / bh, tw / th
    checks = [
        ("真 alpha", int(sa.min()) == 0, f"alpha.min={int(sa.min())}"),
        ("透明占比 >5%", (sa == 0).mean() > 0.05, f"{(sa == 0).mean():.1%}"),
        ("四边安全边 ≥8%", min_margin >= pad * cw, f"最小边距 {min_margin}px / 内容宽 {cw}px"),
        ("内容宽达标（未放大）", cw >= tw * 0.98, f"内容 {cw}x{ch} vs 目标 {tw}x{th}，scale={scale:.3f}"),
        ("长宽比偏差 ≤10%", abs(nat_aspect / want_aspect - 1) <= 0.10,
         f"自然 {nat_aspect:.2f} vs 设计 {want_aspect:.2f}"),
    ]
    print(f"背景中位色 = ({int(C[0])},{int(C[1])},{int(C[2])})  主体 bbox = {bw}x{bh}  洞 = {int(holes.sum())} px"
          + ("  ⚠ 源图主体贴画框" if touches else ""))
    ok = True
    for label, passed, detail in checks:
        print(f"  {'PASS' if passed else 'FAIL'}  {label}  {detail}")
        ok = ok and passed
    print(f"→ {dst}  {sw}x{sh}  {os.path.getsize(dst) / 1024:.1f} KB  色数 {len(np.unique(arr.reshape(-1, 4), axis=0))}")
    return 0 if ok else 1


def selfcheck() -> int:
    """合成图自检：平色底 + 主体矩形 + 矩形内一个洞 + 一块脱离主体的碎块。

    预期：洞被填、碎块被丢、内容 bbox 等于矩形外推安全边后的尺寸。
    """
    import tempfile

    w = h = 200
    bg = (234, 233, 231)
    a = np.zeros((h, w, 3), dtype=np.uint8)
    a[:, :] = bg
    a[60:110, 40:160] = (200, 140, 70)      # 主体 120x50
    a[80:90, 90:110] = bg                    # 主体内的洞（与背景同色）
    a[170:180, 170:180] = (200, 140, 70)     # 碎块（应被丢）
    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, "in.png")
        Image.fromarray(a, "RGB").save(src)
        rc = cut(src, td, (120, 50), 28, 0.08, "chk")   # 目标尺 = 自然尺 ⇒ 不放大不缩
        out = Image.open(os.path.join(td, "chk.png"))
        arr = np.asarray(out)
        sa = arr[:, :, 3]
        ys, xs = np.nonzero(sa)
        bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        # 洞在裁后画布上的位置：源 (80:90, 90:110) －bbox 原点 (60,40) + 安全边 (10,10)
        filled = int(sa[30:40, 60:80].min())
        # 碎块若未被丢，bbox 会撑到 170x170 ⇒ 画布尺寸即是它的判据
        speck_dropped = out.size == (140, 70)
        print(f"自检：内容 {bw}x{bh}（预期 120x50）画布 {out.size[0]}x{out.size[1]}（预期 140x70）"
              f"  洞已填={filled == 255}  碎块已丢={speck_dropped}  机检 rc={rc}")
        return 0 if (bw, bh) == (120, 50) and filled == 255 and speck_dropped and rc == 0 else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", nargs="?")
    ap.add_argument("out_dir", nargs="?")
    ap.add_argument("--target", help="@2x 交付尺寸 如 608x166")
    ap.add_argument("--thresh", type=int, default=28, help="背景线色度分量 perp 阈值（默认 28）")
    ap.add_argument("--pad", type=float, default=0.08, help="安全边比例（默认 8%%）")
    ap.add_argument("--name", default="sprite")
    ap.add_argument("--check", action="store_true", help="跑内置合成自检，改过算法必跑")
    args = ap.parse_args()
    if args.check:
        return selfcheck()
    if not args.src or not args.out_dir or not args.target:
        ap.error("需 src / out_dir / --target（或用 --check）")
    tw, th = (int(v) for v in args.target.lower().split("x"))
    return cut(args.src, args.out_dir, (tw, th), args.thresh, args.pad, args.name)


if __name__ == "__main__":
    sys.exit(main())
