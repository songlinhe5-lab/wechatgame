#!/usr/bin/env python3
"""参数化环境层：用 6 个参数复现 lock-s88 的光照，色相锚回 bg_base。

为什么不用像素烘焙：
  lock-s88 的控件占了 68% 画面，插值填平后亮度不是平滑渐变而是斑块，
  模糊到任何程度都会留下可见的脏斑（CTA 位置、橱窗右侧）。
  而它真正有价值的信息只有"光从哪来、衰减多快、左右差多少"——六个参数。

实测依据（相对墙面中位亮度，见 measure_density.py 同批采样）：
  左墙 +4.5%  · 右墙 −5.5%  · 顶部 −6%  · 地面 左+4% 右−3%
  光束：左上角出发，边界约经过 (320, 0) 与 (0, 480)，峰值 +5.5%

输出 bg-param-750x1334.webp 与对照图 compare-lock-vs-param.png
"""
import numpy as np
from PIL import Image

W, H = 1152, 2048
BG_BASE = np.array([241, 232, 216], dtype=np.float32)   # art-bible §6 #F1E8D8

LEFT_GAIN = 0.045      # 左墙提亮
RIGHT_GAIN = -0.055    # 右墙压暗
BM_CX = 300.0          # 光束边界在顶边的 x
BM_CY = 460.0          # 光束边界在左边的 y
BM_GAIN = 0.062        # 光束峰值增益
BM_FEATHER = 55.0      # 光束边界羽化宽度（px）
FLOOR_Y = 1690
FLOOR_WARM = -6.0

# 实测色带：暗部暖、亮部白。等比乘 bg_base 会把暗部压成灰，这是错的。
# 锚点取自 lock-s88 采样：右墙 (239,219,189) / 左墙 (246,236,214) / 光斑 (253,247,225)
STOPS = [
    (0.00, (234, 209, 176)),
    (0.34, (239, 219, 189)),
    (0.66, (246, 236, 214)),
    (1.00, (253, 247, 226)),
]


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def build():
    x = np.arange(W, dtype=np.float32)[None, :].repeat(H, 0)
    y = np.arange(H, dtype=np.float32)[:, None].repeat(W, 1)
    u, v = x / W, y / H

    # 横向：左亮右暗，轻微非线性（靠边更明显）
    M = 1.0 + LEFT_GAIN + (RIGHT_GAIN - LEFT_GAIN) * (u ** 0.85)

    # 纵向：底部略暗
    M -= 0.020 * smoothstep(0.45, 1.0, v)

    # 光束：边界线 x/BM_CX + y/BM_CY = 1，沿线内外羽化
    t = x / BM_CX + y / BM_CY
    beam = 1.0 - smoothstep(1.0 - BM_FEATHER / BM_CX, 1.0, t)
    M += BM_GAIN * beam

    # 四角暗角
    vig = (smoothstep(0.72, 1.0, np.abs(u - 0.5) * 2)
           + smoothstep(0.80, 1.0, np.abs(v - 0.5) * 2)) * 0.035
    M -= vig

    # M 归一化后沿实测色带取色（而不是等比乘 bg_base）
    norm = np.clip((M - 0.855) / (1.082 - 0.855), 0, 1)
    keys = np.array([s[0] for s in STOPS], dtype=np.float32)
    out = np.zeros((H, W, 3), dtype=np.float32)
    for c in range(3):
        vals = np.array([s[1][c] for s in STOPS], dtype=np.float32)
        out[..., c] = np.interp(norm, keys, vals)
    out[FLOOR_Y:, :, 2] += FLOOR_WARM

    # 手作纸颗粒
    rng = np.random.default_rng(3)
    out += rng.normal(0, 1.0, (H, W, 1)).astype(np.float32)

    return np.clip(out, 0, 255).astype(np.uint8), M


def main():
    img, M = build()
    Image.fromarray(img).save('temp/menu-atlas/bg-param-1152x2048.png')

    small = Image.fromarray(img).resize((750, 1334), Image.LANCZOS)
    small.save('temp/menu-atlas/bg-param-750x1334.png')
    small.save('temp/menu-atlas/bg-param-750x1334.webp', quality=80, method=6)

    pot = Image.open('temp/menu-atlas/pot.webp').convert('RGBA')
    comp = Image.fromarray(img).convert('RGBA')
    comp.alpha_composite(pot, (8, 1432))
    comp.convert('RGB').resize((750, 1334), Image.LANCZOS).save(
        'temp/menu-atlas/bg-param-compose.png')

    # 与 lock-s88 并排对照
    ref = Image.open('temp/menu-atlas/lock-s88.png').convert('RGB').resize(
        (750, 1334), Image.LANCZOS)
    comp2 = Image.open('temp/menu-atlas/bg-param-compose.png').convert('RGB')
    side = Image.new('RGB', (1500, 1334), (30, 30, 30))
    side.paste(ref, (0, 0))
    side.paste(comp2, (750, 0))
    side.save('temp/menu-atlas/compare-lock-vs-param.png')

    import os
    print(f'M {M.min():.3f} ~ {M.max():.3f}')
    print(f'bg-param-750x1334.webp  {os.path.getsize("temp/menu-atlas/bg-param-750x1334.webp") / 1024:.1f} KB')


if __name__ == '__main__':
    main()
