#!/usr/bin/env python3
"""B19 探针 C：牌右下邻域打印 8px 块亮度栅格 —— 不建模，直接看数字形状。

上一轮两个错：① 拿「整条右侧边」和远场比 → 影只占右下 1/3，被平均掉；
② 远场参考跨过了层板前缘（灰蓝横带）与右侧斜玻璃边 → 基准本身跳变。
所以这轮不拟合平面，直接栅格化打印，肉眼认形状。
"""
import numpy as np
from PIL import Image

REF = 'games/beads/design/art/shots/menu-showcase-20261010/v1-mainmenu-final.png'
P = (576, 961, 1931, 2094)
A = np.asarray(Image.open(REF).convert('RGB')).astype(np.float32)
L = A.mean(2)
B = A[:, :, 2]
R = A[:, :, 0]

x0, x1, y0, y1 = P
BS = 8


def grid(tag, X0, X1, Y0, Y1, chan=L):
    print(f'\n=== {tag}  x[{X0},{X1}] y[{Y0},{Y1}]  块 {BS}px ===')
    hdr = '      ' + ''.join(f'{X0 + i * BS:>5d}' for i in range((X1 - X0) // BS))
    print(hdr)
    for j in range((Y1 - Y0) // BS):
        y = Y0 + j * BS
        row = ''.join(f'{np.median(chan[y:y + BS, x:x + BS]):>5.0f}'
                      for x in range(X0, X1, BS))
        print(f'{y:>5d} {row}')


# 右下：牌右边缘外 0–160 px、牌底上下各若干
grid('牌右下 L', x1 - 24, x1 + 168, y1 - 96, y1 + 120)
# 左下对照（同一行带，牌左外侧）
grid('牌左下 L（对照）', x0 - 168, x0 + 24, y1 - 96, y1 + 120)
# 色相：R−B 大＝暖（影/木），小＝冷（玻璃/层板边）
grid('牌右下 R−B', x1 - 24, x1 + 168, y1 - 96, y1 + 120, chan=R - B)
