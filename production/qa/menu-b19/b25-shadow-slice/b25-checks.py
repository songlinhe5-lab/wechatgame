#!/usr/bin/env python3
"""B25 收工自检：管线产物 ≡ B24 的 QA 探针，且乘性编码没在回管线时丢掉。

两条都是断言，跑不过就 exit 1（不靠目测）：
  ① lib.shadow2d(GT) 与 B24 手搓的 `temp/b24-v4-full.png` 牌体外 alpha 逐像素比
     —— 证明「搬进 cutlib」这一步没改算法（容差 1/255，量化误差）。
  ② 定稿资产牌体外**纯影区**（离牌体 3 px 以上）RGB 必须恒 0 —— 乘性编码；
     只要有一处非 0，换底时就会把稿上背景带出来（B24 否掉 ④/⑤ 的同一条理由）。
"""
import os
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import b19_cutlib as lib

GT = np.asarray(Image.open('temp/b22-gt-mask.png').convert('L')) > 127
k = lib.shadow2d(GT)
A = np.asarray(Image.open('temp/b24-v4-full.png').split()[3]).astype(np.float32) / 255
out = ~lib.dil(GT, 2)
d = float(np.abs(k - A)[out].max())
print(f'[① 管线 ≡ B24] 牌体外 {int(out.sum())} px  alpha 最大差 {d * 255:.2f}/255')
assert d <= 1.5 / 255, f'shadow2d 与 B24 探针不一致：{d}'

for p in ('temp/b19-local4/source.png',
          'production/qa/menu-b19/asset/plate-shadow@2x.png'):
    im = Image.open(p).convert('RGBA')
    a = np.asarray(im.split()[3]).astype(np.float32) / 255
    rgb = np.asarray(im.convert('RGB'))
    far = ~lib.dil(a > 0.9, 3) & (a > 0.02)
    mx = int(rgb[far].max())
    print(f'[② 乘性编码] {p}  纯影区 {int(far.sum())} px  RGB max {mx}')
    assert mx == 0, f'{p} 纯影区 RGB 非 0（{mx}）→ 换底会带出稿上背景'
print('PASS')
