#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""单元素切图：一张图 → 真 alpha 透明底件 + 六道机检。三种背景判定（`--mode`）：

| mode | 吃什么图 | 前景判据 |
|---|---|---|
| `proj`（默认）| AI 出的「一件一图 + 平色底」| 投到背景单位向量的投影法（下表步骤 1–3）|
| `lum` | **整屏设计稿**（同色相背景）| 与 `--seed` 连通的亮面（`--lum-min`）或暗面（`--lum-max`）+ `--grow` 补回暗倒角 |
| `shape` | **整屏设计稿**里的几何形件（正圆钮 / 胶囊钮）| 按形状给蒙版（`disc,cx,cy,r` / `pill,x0,y0,x1,y1,r`），⛔ 不判色 |

与 `cut-sprites-local.py` 的分工：那张吃**整页 mood 图**（多元素、按连通域拆件）；
本张吃**单件**（AI 单件图，或从设计稿里按区域抠出的单件）。
只做「定前景 → 留主体 → 填洞 → bbox 裁 → 缩到目标宽 → 判据」。零外部依赖（numpy + PIL）。

流程（顺序不可换，洞必须在二值图上填）：
  1. `proj`：背景色 C = 图四周中位数（勿假设是纯白/纯灰，实测才准），把像素投到 C 的单位向量，
     `perp < thresh 且 t ∈ [cn-90, cn+2]` 判为背景（= 平背景 **加上比背景更暗的中性投影**
     ⇒ 落地投影不会被吃进 alpha）→ fg = ~bg；`lum` / `shape` 见上表
  2. 只留**主体连通域**（`shape` 本就是单块；散点、脱离主体的投影碎块在此被丢掉）
  3. 在二值图上从四周灌「非 fg」，灌不到的洞 → 并入 fg（文字内孔、凹陷区自动填）
     → 二值**闭运算**缝合填洞走粗网格留下的 ≤1px 内缝（实测不闭合则胶囊内缘漏 19 px 透明点）
  4. 内容缩到「宽 = 目标宽」（⛔ 不放大）→ 合成 8% 透明安全边 → 存 RGBA png
  5. 机检六道：真 alpha / 透明占比 / 四边安全边 ≥8% / 内容宽未缩水 / 长宽比偏差 ≤10% /
     **回贴 maxdiff = 0**（把成品贴回源图逐通道比 ⇒ 证明「只据形、⛔ 未重绘」；缩过放则跳过）
     （长宽比 10% = 交付件由运行时按**设计框非等比绘制**，无烧字的木件上不可见；超出即重出）

⚠ 2/3 两步的连通域与洪泛跑在**1/F 粗网格**上（纯 Python BFS，1M px 太慢），
  结果膨胀回全分辨率后再与全分辨率 fg 相与 ⇒ 边缘不啮、最终件精度不受影响。
⚠ `lum` 只在主体坐**均匀暗带**上时可用（木牌✓）；四周背景有亮斑时会漏成整屏（顶栏钮实测失败 ⇒ 改 `shape`）。

用法：
  # AI 单件图去底
  python3 cut-single-local.py IN.png OUT_DIR --target 608x166 [--thresh 28] [--pad 0.06] [--name plate]
  # 从整屏设计稿抠（亮主体 / 几何形）
  python3 cut-single-local.py SHEET.png OUT_DIR --target 304x83 --mode lum  --seed 373,915 --grow 3 --name plate
  python3 cut-single-local.py SHEET.png OUT_DIR --target 64x64  --mode shape --shape disc,42,154,32 --name btn

退出码：机检不过 ⇒ 1（打印 FAIL 行），过 ⇒ 0。`--check` 跑内置合成自检（改过算法必跑）。
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

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


def _shrink(mask: np.ndarray, size: int) -> np.ndarray:
    """二值图腐蚀（PIL MinFilter）。"""
    im = Image.fromarray((mask.astype(np.uint8)) * 255)
    im = im.filter(ImageFilter.MinFilter(size | 1))
    return np.asarray(im) > 127


def _close(mask: np.ndarray, size: int = 3) -> np.ndarray:
    """二值闭运算（先胀后缩）：缝合填洞走 1/F 粗网格留下的 ≤1px 内缝。
    实测不闭合时胶囊内缘漏 19 px 透明点（运行时背景会从深木胶囊里透出来）。"""
    return _shrink(_grow(mask, size), size)


def _upsample(mask: np.ndarray, shape: tuple[int, int]) -> np.ndarray:
    h, w = shape
    out = np.zeros((h, w), dtype=bool)
    out[: mask.shape[0] * F, : mask.shape[1] * F] = np.repeat(np.repeat(mask, F, 0), F, 1)
    return out


def component_at(fg: np.ndarray, seed: tuple[int, int]) -> np.ndarray:
    """只灌包含 seed 的那一块（8 邻接，粗网格）。seed 落在非前景时就近找一个。"""
    small = fg[::F, ::F]
    sy, sx = seed[1] // F, seed[0] // F
    if not small[sy, sx]:
        found = None
        for rad in range(1, 12):
            for dy in range(-rad, rad + 1):
                for dx in range(-rad, rad + 1):
                    ny, nx = sy + dy, sx + dx
                    if 0 <= ny < small.shape[0] and 0 <= nx < small.shape[1] and small[ny, nx]:
                        found = (ny, nx)
                        break
                if found:
                    break
            if found:
                break
        if found is None:
            raise SystemExit(f"FAIL: seed {seed} 周围 12 格内无前景")
        sy, sx = found
    h, w = small.shape
    seen = np.zeros_like(small)
    seen[sy, sx] = True
    q = deque([(sy, sx)])
    while q:
        y, x = q.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if not dy and not dx:
                    continue
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
    return _grow(_upsample(seen, fg.shape), 2 * F + 1)


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


def cut(src: str, out_dir: str, target: tuple[int, int], thresh: int, pad: float, name: str,
        mode: str = "proj", lum_min: int = 130, seed: tuple[int, int] | None = None,
        grow: int = 0, shape: str | None = None, lum_max: int | None = None) -> int:
    im = Image.open(src).convert("RGB")
    a = np.asarray(im, dtype=np.int16)
    h, w = a.shape[:2]

    border = np.concatenate([a[0:4].reshape(-1, 3), a[-4:].reshape(-1, 3),
                             a[:, 0:4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    C = np.median(border, axis=0)
    if mode == "shape":
        # 设计里本就是几何形的件（正圆钮 / 胶囊钮）：蒙版按形状给，⛔ 不做任何亮度/颜色判定
        # ⇒ 像素 100% 原样。实测亮度键对暗底圆钮无效（种子 72 vs 四周 73，分不开）。
        m = Image.new("L", (w, h), 0)
        d = ImageDraw.Draw(m)
        kind, *nums = shape.split(",")
        if kind == "disc":
            cx, cy, r = (int(v) for v in nums)
            d.ellipse([cx - r, cy - r, cx + r - 1, cy + r - 1], fill=255)
        elif kind == "pill":
            bx0, by0, bx1, by1, r = (int(v) for v in nums)
            d.rounded_rectangle([bx0, by0, bx1 - 1, by1 - 1], radius=r, fill=255)
        else:
            raise SystemExit(f"FAIL: --shape 只认 disc,cx,cy,r / pill,x0,y0,x1,y1,r，收到 {shape}")
        fg = np.asarray(m) > 127
    elif mode == "lum":
        # 设计稿整屏里抠单件用这条（⛔ 颜色键出）：同色相背景下“主体面 + 暗倒角围墙”比色距稳定。
        # fg = 与 seed 连通的那块亮面（--lum-min）或暗面（--lum-max，适用暗盘亮图标，如左右箭头）；
        # 倒角圈用 --grow 补回，图标/胶囊等内部异色区靠填洞收回。
        lum = a.mean(axis=2)
        if lum_max is not None:
            fg = lum < lum_max
        else:
            fg = lum > lum_min
        fg = fg & (component_at(fg, seed) if seed else largest_component(fg))
        if grow:
            fg = _grow(fg, 2 * grow + 1)
    else:
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
    fg = _close(fg | holes)

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
    # 回贴自检（抠稿路线的硬判据）：把成品贴回源图原位逐通道比 ⇒ 非 0 即说明像素被动过。
    # scale < 1 时按定义会有重采样差，只能跳过并在 detail 里写明（⛔ 默判通过而不声明）。
    if scale == 1.0:
        back = im.copy()
        back.paste(content, (x0, y0), content)   # content 不含安全边，其原点就是源图 bbox 左上角
        changed = int((np.asarray(ImageChops.difference(im, back)).astype(int).sum(axis=2) > 0).sum())
    else:
        changed = -1
    checks = [
        ("真 alpha", int(sa.min()) == 0, f"alpha.min={int(sa.min())}"),
        ("透明占比 >5%", (sa == 0).mean() > 0.05, f"{(sa == 0).mean():.1%}"),
        ("四边安全边 ≥8%", min_margin >= min(mx, my), f"最小边距 {min_margin}px / 内容宽 {cw}px"),
        ("内容宽达标（未放大）", cw >= tw * 0.98, f"内容 {cw}x{ch} vs 目标 {tw}x{th}，scale={scale:.3f}"),
        ("长宽比偏差 ≤10%", abs(nat_aspect / want_aspect - 1) <= 0.10,
         f"自然 {nat_aspect:.2f} vs 设计 {want_aspect:.2f}"),
        ("回贴 maxdiff = 0", changed <= 0,
         "已缩到目标宽，重采样不可比 ⇒ 跳过" if changed < 0 else f"改动像素 {changed}"),
    ]
    print(f"背景中位色 = ({int(C[0])},{int(C[1])},{int(C[2])})  主体 bbox = {bw}x{bh} @ 源图({x0},{y0})  洞 = {int(holes.sum())} px"
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
    ap.add_argument("--mode", choices=("proj", "lum", "shape"), default="proj",
                    help="proj = 平色底 AI 单件图（默认）；lum = 从整屏设计稿里抠单件（亮度+连通）；"
                         "shape = 几何蒙版抠几何形件（⛔ 不判色）")
    ap.add_argument("--shape", help="shape 模式：disc,cx,cy,r 或 pill,x0,y0,x1,y1,r（图坐标）")
    ap.add_argument("--lum-min", type=int, default=130, help="lum 模式的亮面阈值")
    ap.add_argument("--lum-max", type=int, help="lum 模式反向：取暗于该值的连通块（暗盘亮图标件）")
    ap.add_argument("--seed", help="lum 模式：主体内部一点 x,y（图坐标）")
    ap.add_argument("--grow", type=int, default=0, help="lum 模式：向外补回暗倒角圈的半径 px")
    ap.add_argument("--check", action="store_true", help="跑内置合成自检，改过算法必跑")
    args = ap.parse_args()
    if args.check:
        return selfcheck()
    if not args.src or not args.out_dir or not args.target:
        ap.error("需 src / out_dir / --target（或用 --check）")
    tw, th = (int(v) for v in args.target.lower().split("x"))
    sd = tuple(int(v) for v in args.seed.split(",")) if args.seed else None
    return cut(args.src, args.out_dir, (tw, th), args.thresh, args.pad, args.name,
               args.mode, args.lum_min, sd, args.grow, args.shape, args.lum_max)


if __name__ == "__main__":
    sys.exit(main())
