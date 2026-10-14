#!/usr/bin/env python3
"""B21 两态一致性检查：btn-circle 规范说 pressed「盘体不动只改投影」，实测对不对。

盘的几何边取 **alpha 50% 等值线**（不用 >0.999 区 bbox：老资产 normal 半透环 0 px，
bbox 会把硬边阶梯当成形状；等值线对两态同口径）。
"""
import numpy as np
from PIL import Image

B = 'games/beads/design/art/shots/menu-showcase-20261010/btn-arrow/'
out = {}
for st in ('normal', 'pressed'):
    im = Image.open(B + f'ui_btn_arrow_bg_{st}.png').convert('RGBA')
    a = np.asarray(im.split()[3]).astype(np.float32) / 255
    ys, xs = np.where(a > 0.5)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    rr = []
    for ang in np.linspace(0, 2 * np.pi, 72, endpoint=False):
        u, v = np.cos(ang), np.sin(ang)
        for t in np.arange(40, 80, 0.25):
            y, x = int(round(cy + v * t)), int(round(cx + u * t))
            if not (0 <= y < a.shape[0] and 0 <= x < a.shape[1]):
                break
            if a[y, x] < 0.5:
                rr.append(t)
                break
    out[st] = (np.array(rr), cx, cy)
    print(f'{st:<8} 圆心({cx:.1f},{cy:.1f})  alpha50% 半径 均值 {np.mean(rr):.2f} ±{np.std(rr):.2f}'
          f'  范围 [{min(rr):.1f},{max(rr):.1f}]')
d = out['normal'][0].mean() - out['pressed'][0].mean()
print(f'\n两态盘半径差 = {d:+.2f} px（规范：pressed 盘体不动，应 ≈0）')
print(f'两态圆心差 = dy {out["pressed"][2]-out["normal"][2]:+.1f} px  dx '
      f'{out["pressed"][1]-out["normal"][1]:+.1f} px')
