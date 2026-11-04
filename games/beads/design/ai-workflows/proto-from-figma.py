#!/usr/bin/env python3
"""以 Figma 设计稿三件透明切图 + 既有基准底图，派生 v3 三态原型（纯像素变换，零模型）。

贴回三步（区外 maxdiff 必须 0）：α = blur(M)×M 向内羽化 → 合成 → 区外硬拷回。

与 v2 的差别：金边/三态章换成 Figma 新设计（珠圈装裱框 + 拼豆锁 + 金色通关圆章），
磨砂 / 竖向揭彩 / 满星行沿用 proto-from-baseline.py（同式同向，⛔ 不得反）。

用法（仓库根）：python3 games/beads/design/ai-workflows/proto-from-figma.py
"""
import importlib.util
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
ART = ROOT / "games/beads/design/art"

_spec = importlib.util.spec_from_file_location("pb", HERE / "proto-from-baseline.py")
pb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pb)

BASE = ART / "final/prototypes/menu-design-baseline-cat-topbar-final-slotbar-20261102.png"
ELEM = ART / "proposals/menu-3d-style-20261030/figma-elements-20261104"
OUT = ART / "final/prototypes"

# Figma 画布 750×1334 → 基准底图 752×1344
SX, SY = 752 / 750, 1344 / 1334

FRAME_BOX = (164, 450, 426, 426)   # 46:21 满星装裱框·实例
LOCK_BOX = (327, 622, 95, 130)     # 47:19 锁·关卡图案中心
SEAL_BOX = (545, 405, 90, 89)      # 47:20 通关标记·框右上


def feather_paste(base, el, box, feather=1.2):
    """贴回三步；返回 (结果, 区外 maxdiff)。区外必须逐像素等于 base。"""
    x, y, w, h = box
    x, y, w, h = round(x * SX), round(y * SY), round(w * SX), round(h * SY)
    el = el.resize((w, h), Image.LANCZOS).convert("RGBA")
    m = el.getchannel("A")
    alpha = ImageChops.multiply(m.filter(ImageFilter.GaussianBlur(feather)), m)

    out = base.copy()
    out.paste(el.convert("RGB"), (x, y), alpha)

    # 区外硬拷回（含越界裁剪）
    a = np.asarray(alpha)
    full = np.zeros((base.height, base.width), dtype=np.uint8)
    x0, y0, x1, y1 = max(0, x), max(0, y), min(base.width, x + w), min(base.height, y + h)
    full[y0:y1, x0:x1] = a[y0 - y:y1 - y, x0 - x:x1 - x]
    b = np.asarray(base, dtype=np.int16)
    o = np.asarray(out, dtype=np.int16)
    outside = full == 0
    o[outside] = b[outside]
    maxdiff = int(np.abs(o - b)[outside].max()) if outside.any() else 0
    assert maxdiff == 0, f"区外 maxdiff={maxdiff}，贴回越界"
    return Image.fromarray(o.astype(np.uint8)), maxdiff


def main():
    base = Image.open(BASE).convert("RGB")
    size = base.size
    print("base", size, "progress", pb.PROGRESS)

    # 珠圈装裱框：三态共用（新设计的基本元素）
    with Image.open(ELEM / "ui_menu_frame_pearls.png") as el:
        framed, d0 = feather_paste(base, el, FRAME_BOX)
    print("frame 贴回 区外 maxdiff", d0)

    fade = pb.bottom_fade(size, pb.CASE[3] - pb.CASE_FADE, pb.CASE[3] + 10)

    # locked：柜内磨砂置灰 + Figma 拼豆锁
    locked = Image.composite(
        pb.gray_layer(framed, blur=6, lift=100, scale=0.55, veil=0.16), framed,
        pb.shape(pb.CASE, size, blur=10, ramp=fade))
    with Image.open(ELEM / "ui_menu_badge_locked_figma.png") as el:
        locked, d1 = feather_paste(locked, el, LOCK_BOX)
    print("locked 章 贴回 区外 maxdiff", d1)

    # pushing：竖向揭彩（灰自上而下、彩自下而上）+ 木刻沙漏（Figma 未给此章）
    ramp = pb.wipe_ramp(size, pb.PROGRESS, pb.WIPE_SOFT) * fade
    pushing = Image.composite(
        pb.gray_layer(framed, blur=0, lift=64, scale=0.66, veil=0.10), framed,
        pb.shape(pb.CASE, size, blur=10, ramp=ramp))
    pb.stamp(pushing, "ui_menu_badge_progress.png",
             pb.ART_C[0], pb.ART_C[1] + 4, pb.HOUR_D, pb.HOUR_D)

    # cleared：全彩 + 满星行 + Figma 通关圆章（⛔ 不再叠 v2 金边，珠圈框已承担）
    cleared = pb.star_row(framed)
    with Image.open(ELEM / "ui_menu_seal_cleared_figma.png") as el:
        cleared, d2 = feather_paste(cleared, el, SEAL_BOX)
    print("cleared 章 贴回 区外 maxdiff", d2)

    states = {"locked": locked, "pushing": pushing, "cleared": cleared}
    for name, cv in states.items():
        p = OUT / f"proto-menu-v3-{name}-752x1344.png"
        cv.save(p)
        print("写出", p, cv.size)
    pb.selfcheck(base, states)


if __name__ == "__main__":
    main()
