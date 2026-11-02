#!/usr/bin/env python3
"""三态章 v2（纯中灰背景 #808080）抠成真 alpha，按现役文件名落 `<批>/cut/`。

背景判据 = 与 (128,128,128) 逐通道最大差 ≤ 20；再做 3px 闭运算吃掉抗锯齿边。
输出 alpha 覆盖率自证，⛔ 不做任何重绘。用法（仓库根）：
  python3 games/beads/design/ai-workflows/cut-badge-v2.py
"""
import os

import numpy as np
from PIL import Image, ImageFilter

BATCH = "games/beads/design/art/proposals/menu-3d-style-20261030/badge-v2-20261102"
JOBS = [("lock-s11.png", "ui_menu_badge_locked.png"),
        ("hourglass-s33.png", "ui_menu_badge_progress.png"),
        ("seal-s11.png", "ui_menu_seal_cleared.png")]
BG = np.array([128, 128, 128])
TOL = 20


def cut(path):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    d = np.abs(a - BG).max(2)
    fg = (d > TOL).astype(np.uint8) * 255
    m = Image.fromarray(fg, "L")
    m = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))   # 闭运算
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))  # 轻羽化
    out = im.convert("RGBA")
    out.putalpha(m)
    return out, float((np.asarray(m) > 127).mean())


if __name__ == "__main__":
    os.makedirs(f"{BATCH}/cut", exist_ok=True)
    for src, dst in JOBS:
        im, cov = cut(f"{BATCH}/{src}")
        p = f"{BATCH}/cut/{dst}"
        im.save(p)
        print(f"{p}  {im.size}  不透明覆盖 {cov * 100:.1f}%")
