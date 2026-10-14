#!/usr/bin/env python3
"""remove-box-fill：把矩形元素（如橱窗里的木牌）从位图上程序化擦除。

原理（2026-10-14 橱窗去牌定稿）：手绘平涂 UI 的背景带通常只有纵向渐变、
横向近均匀 ⇒ 对擦除域**逐行**取干净采样带的**中位数颜色**回填（中位数抗高光/
纹理离群；逐行保纵向渐变），alpha 随行复制。若左右各有一条干净带且横向不均
（如有斜向玻璃高光），给 --right 走「左右缘中位数线性插值」，别用平移贴补
（会把高光整块复制进擦除区）。

用法：
  python3 remove-box-fill.py IN OUT --box x0,y0,x1,y1 \
      [--left lx0,lx1] [--right rx0,rx1] [--check]
  采样带缺省 = 擦除缘外 30..200px 宽 170 的条带。
验收：目检裁图；或 --check 跑内置合成自检（纵向渐变+离群高光+色块，擦回原图
误差均值守阈值）。
"""
import argparse
import sys

import numpy as np
from PIL import Image


def fill(arr, box, left, right):
    x0, y0, x1, y1 = box
    rgb = arr[:, :, :3].astype(np.float32)
    has_a = arr.shape[2] == 4
    alp = arr[:, :, 3].copy() if has_a else None
    for y in range(y0, y1):
        L = np.median(rgb[y, left[0]:left[1]], axis=0)
        if right:
            R = np.median(rgb[y, right[0]:right[1]], axis=0)
            f = np.linspace(0.0, 1.0, x1 - x0)[:, None]
            rgb[y, x0:x1] = L * (1 - f) + R * f
        else:
            rgb[y, x0:x1] = L
        if alp is not None:
            alp[y, x0:x1] = alp[y, left[0] + 10]
    out = np.dstack([rgb.astype(np.uint8), alp]) if has_a else rgb.astype(np.uint8)
    return out


def selfcheck():
    h, w = 200, 300
    g = np.linspace(120, 240, h, dtype=np.float32)[:, None, None] * np.ones((1, w, 3), np.float32)
    g += np.random.RandomState(7).randint(-2, 3, (h, w, 3))          # 纹理噪声
    truth = np.clip(g, 0, 255).astype(np.uint8)                      # 贴块前的底
    g[80:140, 40:60] += 80                                           # 高光落在采样带内：验中位数（非均值）不被拉偏
    g[80:140, 100:200] = (30, 30, 200)                               # 待擦色块
    img = np.dstack([np.clip(g, 0, 255).astype(np.uint8), np.full((h, w), 255, np.uint8)])
    out = fill(img, (95, 75, 205, 145), (10, 90), None)              # 采样带内混高光，擦回仍应贴 truth
    err = np.abs(out[80:140, 100:200, :3].astype(int) - truth[80:140, 100:200].astype(int))
    assert err.mean() < 6, f"selfcheck fail mean={err.mean():.2f}"
    assert (out[:, :, 3] == 255).all()
    print(f"selfcheck OK mean|err|={err.mean():.2f} max={err.max()}")


def rng(s, lo, hi):
    a, b = (int(v) for v in s.split(",")) if s else (None, None)
    if a is None:
        a, b = (lo - 200, lo - 30) if hi is None else (hi + 30, hi + 200)
    return max(a, 0), max(b, 1)


def main():
    if "--check" in sys.argv:
        selfcheck()
        return
    ap = argparse.ArgumentParser()
    ap.add_argument("inp"); ap.add_argument("outp")
    ap.add_argument("--box", required=True, help="x0,y0,x1,y1")
    ap.add_argument("--left"); ap.add_argument("--right")
    a = ap.parse_args()
    x0, y0, x1, y1 = (int(v) for v in a.box.split(","))
    arr = np.asarray(Image.open(a.inp).convert("RGBA"))
    out = fill(arr, (x0, y0, x1, y1),
               rng(a.left, x0, None), rng(a.right, None, x1) if a.right else None)
    Image.fromarray(out, mode="RGBA").save(a.outp)
    print(f"erased box=({x0},{y0},{x1},{y1}) → {a.outp}")


if __name__ == "__main__":
    main()
