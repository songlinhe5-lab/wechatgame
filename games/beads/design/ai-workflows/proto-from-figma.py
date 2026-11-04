#!/usr/bin/env python3
"""以 Figma 设计稿四件透明切图 + 既有基准底图，派生 v3 四态原型（纯像素变换，零模型）。

贴回三步（区外 maxdiff 必须 0）：α = blur(M)×M 向内羽化 → 合成 → 区外硬拷回。

四态口径（2026-11-04 用户令）：
  locked   = ⛔ 无蒙版、无框；只按 44:64 真 alpha 把小猫置灰；锁贴豆画 bbox 正中
  pushing  = 竖向揭彩（灰自上而下、彩自下而上）+ 木刻沙漏，珠圈框按 Figma 原位
  cleared  = 全彩；通关圆章贴豆画 bbox 右上内缩 8px（内容层，随走马灯左右滚动）
  fullstar = 珠圈框放大到中空区恰好容纳豆画并居中于 bbox；⛔ 无底座三颗星

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

FRAME_BOX = (164, 450, 426, 426)       # 46:21 原框位（仅 pushing 用）
ART_BOX_FIGMA = (212, 530, 325, 314)   # 44:64 关卡图案（猫咪拼豆）
# 模板匹配实测：基准图里的豆画相对 Figma 节点右移 26 / 下移 7（scale 1.0，MAE 5.38）
# ⇒ 一切以「图案」为准的落点（置灰 mask / 框中心 / 通关章 / 锁）都要加此位移
ART_SHIFT = (26, 7)
LOCK_WH = (95, 130)                    # 47:19 锁
SEAL_WH = (90, 89)                     # 47:20 通关圆章
SEAL_INSET = 8
# 珠圈框中空区占框宽 0.695 / 高 0.717（实测十字扫描）；
# 豆画 bbox 323×310 + 每边 8px ⇒ 框 488×455，中空区恰好框住图案
FRAME_FULLSTAR_WH = (488, 455)


def art_bbox():
    """豆画 44:64 的 alpha bbox（Figma 坐标，设计 px）；切图 @scale 2。"""
    with Image.open(ELEM / "ui_menu_art_cat.png") as im:
        a = np.asarray(im.convert("RGBA").getchannel("A"))
    ys, xs = np.nonzero(a > 32)
    ax, ay = ART_BOX_FIGMA[:2]
    dx, dy = ART_SHIFT
    return (ax + dx + xs.min() / 2, ay + dy + ys.min() / 2,
            ax + dx + (xs.max() + 1) / 2, ay + dy + (ys.max() + 1) / 2)


def centered_box(wh):
    """以豆画 bbox 中心为准的居中 box（Figma 坐标）。"""
    x0, y0, x1, y1 = art_bbox()
    w, h = wh
    return ((x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h)


def seal_box():
    """通关章贴豆画 bbox 右上角内缩 8px（内容层，随走马灯滚动）。"""
    _, y0, x1, _ = art_bbox()
    w, h = SEAL_WH
    return (x1 - SEAL_INSET - w, y0 + SEAL_INSET, w, h)


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


def local_composite(base, layer, mask):
    """全尺寸 L mask 合成 + 区外硬拷回 + maxdiff 自证。"""
    out = Image.composite(layer, base, mask)
    b = np.asarray(base, dtype=np.int16)
    o = np.asarray(out, dtype=np.int16)
    outside = np.asarray(mask) == 0
    o[outside] = b[outside]
    maxdiff = int(np.abs(o - b)[outside].max()) if outside.any() else 0
    assert maxdiff == 0, f"区外 maxdiff={maxdiff}"
    return Image.fromarray(o.astype(np.uint8)), maxdiff


def gray_art(base):
    """只置灰小猫：44:64 真 alpha 当 mask，纯去饱和（blur=0），⛔ 无蒙版、无框。"""
    with Image.open(ELEM / "ui_menu_art_cat.png") as im:
        m = im.convert("RGBA").getchannel("A")
    ax, ay, aw, ah = ART_BOX_FIGMA
    X = round((ax + ART_SHIFT[0]) * SX)
    Y = round((ay + ART_SHIFT[1]) * SY)
    W, H = round(aw * SX), round(ah * SY)
    m = m.resize((W, H), Image.LANCZOS)
    # 对齐后仍外扩 2px 盖住豆画外缘描边珠子
    m = m.filter(ImageFilter.MaxFilter(5))
    m = ImageChops.multiply(m.filter(ImageFilter.GaussianBlur(1.2)), m)
    full = Image.new("L", base.size, 0)
    full.paste(m, (X, Y))
    return local_composite(base, pb.gray_layer(base), full)


def main():
    base = Image.open(BASE).convert("RGB")
    size = base.size
    print("base", size, "progress", pb.PROGRESS,
          "豆画 bbox", tuple(round(v, 1) for v in art_bbox()))

    # 原位置珠圈框：仅 pushing 用（用户未点名此态）
    with Image.open(ELEM / "ui_menu_frame_pearls.png") as el:
        framed, d0 = feather_paste(base, el, FRAME_BOX)
    print("pushing 框 贴回 区外 maxdiff", d0)

    fade = pb.bottom_fade(size, pb.CASE[3] - pb.CASE_FADE, pb.CASE[3] + 10)

    # locked：只灰小猫 + 锁居中；⛔ 无磨砂蒙版、无框
    locked, d4 = gray_art(base)
    print("locked 小猫置灰 区外 maxdiff", d4)
    with Image.open(ELEM / "ui_menu_badge_locked_figma.png") as el:
        locked, d1 = feather_paste(locked, el, centered_box(LOCK_WH))
    print("locked 锁 贴回 区外 maxdiff", d1)

    # pushing：竖向揭彩（上灰下彩）+ 木刻沙漏（Figma 未给此章）
    ramp = pb.wipe_ramp(size, pb.PROGRESS, pb.WIPE_SOFT) * fade
    pushing = Image.composite(
        pb.gray_layer(framed, blur=0, lift=64, scale=0.66, veil=0.10), framed,
        pb.shape(pb.CASE, size, blur=10, ramp=ramp))
    pb.stamp(pushing, "ui_menu_badge_progress.png",
             pb.ART_C[0], pb.ART_C[1] + 4, pb.HOUR_D, pb.HOUR_D)

    # cleared：全彩 + 通关章贴豆画 bbox 右上；⛔ 无框、无底座三颗星
    cleared = base.copy()
    with Image.open(ELEM / "ui_menu_seal_cleared_figma.png") as el:
        cleared, d2 = feather_paste(cleared, el, seal_box())
    print("cleared 章 贴回 区外 maxdiff", d2)

    # fullstar：框放大并居中于豆画 bbox；⛔ 无三颗星
    box = centered_box(FRAME_FULLSTAR_WH)
    print("fullstar 框", tuple(round(v, 1) for v in box))
    with Image.open(ELEM / "ui_menu_frame_pearls.png") as el:
        fullstar, d3 = feather_paste(base, el, box)
    print("fullstar 框 贴回 区外 maxdiff", d3)

    states = {"locked": locked, "pushing": pushing, "cleared": cleared,
              "fullstar": fullstar}
    for name, cv in states.items():
        p = OUT / f"proto-menu-v3-{name}-752x1344.png"
        cv.save(p)
        print("写出", p, cv.size)
    pb.selfcheck(base, states)


if __name__ == "__main__":
    main()
