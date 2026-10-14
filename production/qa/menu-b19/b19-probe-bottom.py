#!/usr/bin/env python3
"""B19 探针 D：牌底接触影的**逐列剖面** —— 影在右下角是否加深（用户要的那块）。

右侧已确诊无影（近牌 217 vs 玻璃边前 220，只差 3 灰阶，与左侧对称）。
但「右下角」是另一件事：接触影沿底边的**强弱分布**没量过。
若影从左到右加深，就说明光源偏左上、右下最重 —— 用户要的不是伪造，是漏画。
"""
import numpy as np
from PIL import Image

REF = 'games/beads/design/art/shots/menu-showcase-20261010/v1-mainmenu-final.png'
P = (576, 961, 1931, 2094)
A = np.asarray(Image.open(REF).convert('RGB')).astype(np.float32)
L = A.mean(2)
x0, x1, y0, y1 = P

# 远场基准：牌底下方 2110–2128（避开 2095–2108 的影带与 2134 的层板前缘）
REF_Y = (2110, 2128)
base = np.median(L[REF_Y[0]:REF_Y[1], x0:x1 + 1], 0)
print(f'远场基准（y{REF_Y}，同列中位）：均值 {base.mean():.1f} 范围 [{base.min():.0f},{base.max():.0f}]')

print('\n逐列（每 24px 一列组）底边接触影衰减 k = 1 − L/同列远场：')
print(f"{'列组':<14}" + ''.join(f'{dy:>7d}' for dy in range(0, 14)) + '   影宽(px,k>0.05)')
for c0 in range(x0, x1, 24):
    c1 = min(c0 + 24, x1 + 1)
    b = np.median(base[c0 - x0:c1 - x0])
    ks = [1.0 - np.median(L[y1 + 1 + d:y1 + 2 + d, c0:c1]) / b for d in range(14)]
    width = sum(1 for k in ks if k > 0.05)
    print(f'x[{c0},{c1})'.ljust(14) + ''.join(f'{k:>7.2f}' for k in ks) + f'   {width}')

print('\n同一段的绝对亮度（远场基准之上，灰阶）：')
for c0 in range(x0, x1, 24):
    c1 = min(c0 + 24, x1 + 1)
    vals = [np.median(L[y1 + 1:y1 + 9, c0:c1])]
    prof = ' '.join(f'{np.median(L[y1+1+d:y1+2+d, c0:c1]):>4.0f}' for d in range(10))
    print(f'x[{c0},{c1})  y{y1+1}..{y1+10}: {prof}')

# 右下角扇区 vs 左下角扇区（各 40x40，牌底外）
for tag, cx in (('左下', x0 + 40), ('中下', (x0 + x1) // 2), ('右下', x1 - 40)):
    win = L[y1 + 1:y1 + 11, cx - 20:cx + 20]
    bb = np.median(base[max(0, cx - 20 - x0):cx + 20 - x0])
    print(f'{tag} 40x10 窗：L 中位 {np.median(win):.1f} / 远场 {bb:.1f} → 衰减 '
          f'{100 * (1 - np.median(win) / bb):.1f}%  最暗行峰值 {100 * (1 - win.min() / bb):.1f}%')
