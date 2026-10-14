#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""初步切图规则 · 第二步修图：清除每张精灵四周的「独立纹理碎块」。

背景：第一步 cut-sprites-local.py 按 PAD=8 从原图裁单图时，相邻元素蹭在裁剪框
边缘的一小块（箭头盘残弧、邻居图标边角等）会被一起带进来，贴在精灵四周、与主体
不连通。本步对每张透明底精灵做「只保留最大不透明连通域」，把这些独立碎块设透明。

⚠ 前提假设：每张精灵 = 一个主导元素（本套菜单精灵成立：logo/图标/橱窗/箭头/按钮
   各自是一整块）。若某元素本就由多个分离部件组成，keep-largest 会误删——那种
   情况改用 --min-area 只删小碎块（见下）。

幂等：对已干净的图是 no-op（只剩一个域时不动）。

用法：
  python3 cleanup-sprites-edge.py <目录或png...> [--min-area N] [--keep-all-large]
  默认处理 sprites-v1-shadow 整套；--min-area N 时改为「只删面积<N 的域」而非「只留最大」。
"""
import sys
import glob
import os
import numpy as np
from PIL import Image

DEFAULT_DIR = "games/beads/design/art/shots/menu-showcase-20261010/sprites-v1-shadow"


def components(alpha_mask):
    """返回 [(id_mask, area), ...]，8 邻接连通域。"""
    H, W = alpha_mask.shape
    seen = ~alpha_mask.copy()          # 非不透明区视为已访问
    lab = np.zeros((H, W), np.int32)
    n = 0
    out = []
    for sy in range(H):
        for sx in range(W):
            if seen[sy, sx]:
                continue
            n += 1
            stack = [(sx, sy)]
            seen[sy, sx] = True
            lab[sy, sx] = n
            pts = 0
            while stack:
                x, y = stack.pop()
                pts += 1
                for dy in (-1, 0, 1):
                    ny = y + dy
                    if 0 <= ny < H:
                        for dx in (-1, 0, 1):
                            nx = x + dx
                            if 0 <= nx < W and not seen[ny, nx]:
                                seen[ny, nx] = True
                                lab[ny, nx] = n
                                stack.append((nx, ny))
            out.append((lab == n, pts))
    return out


def clean(path, min_area=None):
    s = np.asarray(Image.open(path).convert("RGBA")).copy()
    A = s[..., 3] > 0
    comps = components(A)
    if not comps:
        print(f"  {os.path.basename(path)}: 全透明，跳过")
        return
    if min_area is None:               # keep-largest
        keep_id = max(range(len(comps)), key=lambda i: comps[i][1])
        kill = np.zeros_like(A)
        for i, (m, _) in enumerate(comps):
            if i != keep_id:
                kill |= m
    else:                              # 只删小碎块
        kill = np.zeros_like(A)
        for m, a in comps:
            if a < min_area:
                kill |= m
    removed = int(kill.sum())
    if removed:
        s[..., 3] = np.where(kill, 0, s[..., 3])
        Image.fromarray(s, "RGBA").save(path)
    areas = sorted((a for _, a in comps), reverse=True)
    print(f"  {os.path.basename(path)}: 域{areas} → 清除 {removed}px")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    min_area = None
    for a in sys.argv[1:]:
        if a.startswith("--min-area"):
            min_area = int(a.split("=", 1)[1]) if "=" in a else int(sys.argv[sys.argv.index(a) + 1])
    targets = []
    for a in args or [DEFAULT_DIR]:
        if os.path.isdir(a):
            targets += sorted(glob.glob(os.path.join(a, "sprite-*.png")))
        else:
            targets.append(a)
    print(f"第二步修图：{len(targets)} 张  mode={'min-area<%d' % min_area if min_area else 'keep-largest'}")
    for t in targets:
        clean(t, min_area)


if __name__ == "__main__":
    main()
