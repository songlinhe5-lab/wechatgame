#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make-grid-backplate.py —— 路线 A：Figma 九宫格背板几何补齐（零模型）。

输入：Figma `选关弹窗 / 抠图层 / 九宫格 / 九宫格背板`（节点 164:63）的 @2x 导出件。
现状：左右各一道金色立边（线心距边 11px @2x），上下是平切、四角直角。
目标：上下补同款金边 + 四角 24dp 圆角（真透明角外）。

做法：不重绘木纹。把左右线的**横截面颜色剖面**按「到圆角矩形中心线的有符号距离」
      映射到四条边与四角（SDF 法），再用外框圆角 SDF 切 alpha。
      ⇒ 四边/四角共用同一剖面，接缝与角部连续性由几何保证，非拼接。

用法：
  python3 games/beads/design/ai-workflows/make-grid-backplate.py \
      --src temp/figma/levelselect/164-63.png \
      --out temp/levelselect-9slice/backplate-geo.png
"""
import argparse
import os

import numpy as np
from PIL import Image

# —— 冻结口径（改 = 变更设计口径，须登记）——
INSET = 11        # 线心距外框边（@2x px）。源图左右线实测 x=11 / x=W-12。
PROFILE_D = 32    # 剖面采样宽度（@2x px）：d ∈ [-11, +20]
RADIUS_DP = 24    # 圆角半径（设计 dp）。与 P-3 面板圆角裁定一致。
SS = 4            # 超采样倍数（抗锯齿）


def round_rect_sdf(px, py, cx, cy, hw, hh, r):
    """圆角矩形有符号距离场：内部负、外部正。"""
    qx = np.abs(px - cx) - (hw - r)
    qy = np.abs(py - cy) - (hh - r)
    ax = np.maximum(qx, 0.0)
    ay = np.maximum(qy, 0.0)
    return np.sqrt(ax * ax + ay * ay) + np.minimum(np.maximum(qx, qy), 0.0) - r


def build_profile(a):
    """左右线剖面取中位数后合并（消除单侧光照偏置）。返回 (PROFILE_D,3) RGB。"""
    h, w, _ = a.shape
    band = a[h // 3: 2 * h // 3, :, :3].astype(np.float64)
    left = np.median(band[:, :PROFILE_D], axis=0)
    right = np.median(band[:, -PROFILE_D:], axis=0)[::-1]
    return ((left + right) / 2.0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--scale", type=int, default=2, help="源图相对设计 px 的倍数")
    args = ap.parse_args()

    src = Image.open(args.src).convert("RGBA")
    a = np.array(src)
    h, w = a.shape[:2]
    prof = build_profile(a)
    radius = RADIUS_DP * args.scale

    # 超采样画布
    W, H = w * SS, h * SS
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    cx, cy = W / 2.0, H / 2.0

    # 线心路径（圆角矩形，内缩 INSET）
    inset = INSET * SS
    r_path = max(radius * SS - inset, 1.0)
    sdf_path = round_rect_sdf(xx, yy, cx, cy, W / 2.0 - inset, H / 2.0 - inset, r_path)
    d = -sdf_path / SS  # 回到源图 px；外侧负、内侧正（与剖面同向）

    # 外框（切 alpha）
    sdf_outer = round_rect_sdf(xx, yy, cx, cy, W / 2.0, H / 2.0, radius * SS)

    out = np.repeat(a.astype(np.float64), SS, axis=0).repeat(SS, axis=1)

    # 剖面色按距离线性插值，覆盖 d ∈ [-INSET, PROFILE_D-INSET)
    lo, hi = -INSET, PROFILE_D - INSET
    idx = np.clip(d + INSET, 0, PROFILE_D - 1.001)
    i0 = np.floor(idx).astype(np.int32)
    i1 = np.minimum(i0 + 1, PROFILE_D - 1)
    t = (idx - i0)[..., None]
    col = prof[i0] * (1.0 - t) + prof[i1] * t

    band = (d >= lo) & (d < hi)
    out[..., :3] = np.where(band[..., None], col, out[..., :3])
    out[..., 3] = np.where(sdf_outer > 0, 0.0, out[..., 3])

    res = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")
    res = res.resize((w, h), Image.LANCZOS)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    res.save(args.out)
    print(f"✓ {args.out}  {res.size[0]}x{res.size[1]}  r={RADIUS_DP}dp  inset={INSET}px@2x")


if __name__ == "__main__":
    main()
