#!/usr/bin/env python3
"""以 v2 设计基准图（752×1344 整屏，非分层）派生三态原型设计图。

置灰腿 = 玻璃内壁整块像素变换（去饱和 + 抬亮压对比 + 冷灰 + 圆角羽化遮罩），⛔ 不重绘
⇒ 形状绝对不变、零模型。三态章 = 现役 `final/assets/menu/ui_menu_*.png`。
用法（仓库根）：python3 temp/proto-from-baseline.py
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ART = "games/beads/design/art/final"
BASE = ("games/beads/design/art/proposals/menu-3d-style-20261030/"
        "menu-design-baseline-cat-topbar-final-slotbar-20261102.png")
OUT = "games/beads/design/art/final/prototypes"

GLASS = (178, 395, 592, 758)            # 玻璃内壁（基准图坐标，手工量；顶在资源条之下）
GLASS_C = ((GLASS[0] + GLASS[2]) // 2, (GLASS[1] + GLASS[3]) // 2)
LOCK_D, HOUR_H = 190, 210
SEAL_W, SEAL_H, SEAL_INSET = 101, 140, 12


def glass_mask(size, radius=24, blur=12):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle(GLASS, radius=radius, fill=255)
    return m.filter(ImageFilter.GaussianBlur(blur))


def faded(im, mask):
    """置灰：去饱和 → 抬亮压对比（灰蒙）→ 冷灰偏 → 软边合回。"""
    lum = ImageOps.grayscale(im).point(
        [int(min(255, 112 + v * 0.47)) for v in range(256)]).convert("RGB")
    lum = Image.blend(lum, Image.new("RGB", im.size, (205, 210, 215)), 0.24)
    out = im.copy()
    out.paste(lum, (0, 0), mask)
    return out


def stamp(cv, name, cx, cy, w, h, anchor="center"):
    """贴三态章。anchor = center（锁/沙漏，按纹理重心居中）或 topleft。"""
    im = Image.open(f"{ART}/assets/menu/{name}").convert("RGBA")
    kw, kh = max(1, round(w)), max(1, round(h))
    im = im.resize((kw, kh), Image.LANCZOS)
    if anchor == "center":
        a = np.asarray(im.split()[-1])
        ys, xs = np.nonzero(a > 32)
        x, y = cx - (xs.mean() / im.width) * kw, cy - (ys.mean() / im.height) * kh
    else:
        x, y = cx, cy
    cv.paste(im, (round(x), round(y)), im)


def main():
    os.makedirs(OUT, exist_ok=True)
    im = Image.open(BASE).convert("RGB")
    print("base", im.size)
    m = glass_mask(im.size)
    m.save("temp/_glass-mask.png")          # 调试件不入 final

    locked = faded(im, m)
    stamp(locked, "ui_menu_badge_locked.png", GLASS_C[0], GLASS_C[1] + 8, LOCK_D, LOCK_D)

    pushing = im.copy()
    stamp(pushing, "ui_menu_badge_progress.png", GLASS_C[0], GLASS_C[1] + 5,
          HOUR_H * 820 / 1008, HOUR_H)

    cleared = im.copy()
    stamp(cleared, "ui_menu_seal_cleared.png",
          GLASS[2] - SEAL_INSET - SEAL_W, GLASS[1] + SEAL_INSET, SEAL_W, SEAL_H,
          anchor="topleft")

    for name, cv in (("locked", locked), ("pushing", pushing), ("cleared", cleared)):
        p = f"{OUT}/proto-menu-v2-{name}-752x1344.png"
        cv.save(p)
        print("写出", p, cv.size)


if __name__ == "__main__":
    main()
