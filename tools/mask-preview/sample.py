#!/usr/bin/env python3
"""mask PNG 采样器（可复用，杜绝 inline 采样坐标笔误）。
用法: python3 sample.py <png> <x_dp> <y_dp_up> [more...]
y_dp_up: 距中心向上为正。坐标 = dp（128 图 ⇒ 4.2667 px/dp，中心 64,64）。"""
import sys
import numpy as np
from PIL import Image

path = sys.argv[1]
a = np.array(Image.open(path).convert('RGBA'))
k = 128 / 30
for arg in sys.argv[2:]:
    x, y = arg.split(',')
    px = min(127, max(0, int(float(x) * k)))            # ⚠ x_dp 从左边缘起：px = x*k（⛔ 无 +64 偏移）
    py = min(127, max(0, int(64 - float(y) * k)))       # y_dp_up 相对中心向上
    print(f'({x},{y})dp:', tuple(int(v) for v in a[py, px]))

import numpy as np  # noqa
