#!/usr/bin/env python3
"""以 v2 设计基准图（752×1344 整屏，非分层）派生三态原型设计图（v2 终版）。

三态规格（2026-11-03 用户裁定 · 第二版）：
  locked   = 玻璃内整块**磨砂置灰**（模糊 + 去饱和 + 冷灰罩），锁章居中
  pushing  = **竖向揭彩**：灰自上而下覆盖、彩色自下而上揭开，彩色高度 = 完成度
             （与运行时 `grayWipeFx(progress=done/total, soft)` 同式同向，⛔ 不得反）
  cleared  = 全彩（零灰度）+ 满星金色腿：玻璃内金边 + 圆台正面三颗亮金星

框体口径（本脚本手工量，基准图坐标）：
  PANEL = 玻璃前面板（通关印定位用）  FRAME = 金边贴这条（顶在资源条之下）
  CASE  = 柜内展示区（灰化只到这条，顶在资源条之下、底在木牌之上
          ⇒ 资源条与「小猫咪/第1关」永不灰）

置灰腿零模型（形状必须绝对不变）；金色腿也是纯像素变换，⛔ 不重绘。
用法（仓库根）：python3 games/beads/design/ai-workflows/proto-from-baseline.py
  环境变量：BADGE_DIR（三态章目录）/ PROGRESS（完成度 0–1）/ OUT（输出目录，默认 final/prototypes）
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ART = "games/beads/design/art/final"
# 三态章 = T-564 木刻 v2（`cut/` 真 alpha）；v1 白盘章在 `final/assets/menu/`，已不合本场景
BADGE_DIR = os.environ.get(
    "BADGE_DIR",
    "games/beads/design/art/proposals/menu-3d-style-20261030/badge-v2-20261102/cut")
BASE = ("games/beads/design/art/proposals/menu-3d-style-20261030/"
        "menu-design-baseline-cat-topbar-final-slotbar-20261102.png")
OUT = os.environ.get("OUT", f"{ART}/prototypes")

# ── 手工量框（基准图 752×1344）───────────────────────────────────────────
PANEL = (120, 372, 620, 1002)           # 玻璃前面板（含四边亮倒角）
FRAME = (120, 404, 620, 1000)           # 金边贴这条：顶在资源条之下，⛔ 不穿 12/20
CASE = (124, 402, 616, 872)             # 柜内展示区：资源条之下、木牌之上
CASE_FADE = 46                          # 灰化下缘羽化高（避免圆台上切一条硬线）
ART_BOX = (175, 518, 585, 838)          # 作品（豆画）可视包围盒
CASE_W = CASE[2] - CASE[0]
CASE_H = CASE[3] - CASE[1]
CASE_CX = (CASE[0] + CASE[2]) // 2
ART_C = ((ART_BOX[0] + ART_BOX[2]) // 2, (ART_BOX[1] + ART_BOX[3]) // 2)

LOCK_D, HOUR_D = 176, 158               # v2 章为方形（1024²）；沙漏不挡揭彩交界
SEAL_W, SEAL_H, SEAL_INSET = 118, 157, 14   # v2 通关章 768×1024（3:4）
STAR_R, STAR_GAP, STAR_Y = 22, 14, 860  # 满星行：圆台正面（作品之下、木牌之上）

GOLD_HI = (255, 236, 166)               # 金箔高光
GOLD_LO = (176, 112, 38)                # 金箔暗部
GOLD_DEEP = (139, 90, 46)               # 深棕木刻描边色（T-540 同源）
PROGRESS = float(os.environ.get("PROGRESS", "0.40"))
WIPE_SOFT = 0.08                        # 交界柔带占总高比 = 运行时 MENU_GRAY_WIPE.soft


# ── 遮罩与灰化腿 ────────────────────────────────────────────────────────
def shape(box, size, radius=22, blur=8, ramp=None):
    """圆角矩形遮罩（0–255 L）；`ramp` 为逐行系数（len=size[1]，0–1）⇒ 竖向揭彩。"""
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=radius, fill=255)
    if blur:
        m = m.filter(ImageFilter.GaussianBlur(blur))
    if ramp is not None:
        a = np.asarray(m, dtype=np.float32) * np.asarray(ramp, dtype=np.float32)[:, None]
        m = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    return m


def bottom_fade(size, y0, y1):
    """逐行系数：`y0` 以上为 1，到 `y1` 线性收到 0 ⇒ 灰化下缘溶进圆台。"""
    ys = np.arange(size[1], dtype=np.float32)
    return np.clip((y1 - ys) / max(1.0, y1 - y0), 0.0, 1.0)


def _lut(f):
    return [int(max(0, min(255, f(v)))) for v in range(256)]


def gray_layer(im, blur=0, lift=118, scale=0.46, veil=0.24):
    """置灰：（可选模糊=磨砂）→ 去饱和抬亮压对比 → 与冷灰混 ⇒ 灰玻璃观感，形状逐像素不变。"""
    src = im.filter(ImageFilter.GaussianBlur(blur)) if blur else im
    lum = ImageOps.grayscale(src).point(_lut(lambda v: lift + v * scale)).convert("RGB")
    return Image.blend(lum, Image.new("RGB", im.size, (206, 211, 216)), veil)


def wipe_ramp(size, progress, soft):
    """逐行灰度系数：彩色自**底**向上揭开 `progress` 高度，其余为灰（运行时同向）。"""
    boundary = CASE[1] + CASE_H * (1.0 - progress)      # 灰/彩交界（屏幕 y）
    band = max(1.0, soft * CASE_H)
    ys = np.arange(size[1], dtype=np.float32)
    return np.clip((boundary - ys) / band + 0.5, 0.0, 1.0)


# ── 金色腿 ──────────────────────────────────────────────────────────────
def gold_ramp(size, top=GOLD_HI, bottom=GOLD_LO, band=None):
    """竖向金属渐变（上亮下暗）。`band=(y0,y1)` ⇒ 渐变只在该段走完（局部件必用，
    否则小件落在整屏渐变尾部 ⇒ 只剩暗金）。"""
    if band is None:
        g = np.linspace(0.0, 1.0, size[1], dtype=np.float32)[:, None]
    else:
        y0, y1 = band
        g = np.clip((np.arange(size[1], dtype=np.float32) - y0) / max(1.0, y1 - y0),
                    0.0, 1.0)[:, None]
    row = (np.asarray(top, dtype=np.float32) * (1 - g)
           + np.asarray(bottom, dtype=np.float32) * g)          # (H,3)
    img = np.broadcast_to(row[None], (size[0], size[1], 3)).transpose(1, 0, 2)
    return Image.fromarray(np.ascontiguousarray(img.astype(np.uint8)))


def gold_edge(im, width=7):
    """金边：沿玻璃面板内壁画金属渐变金箔（外粗圈 + 内细圈 + 深棕发丝线 + 外溢金辉）。"""
    out = im.copy()
    glow = Image.new("L", im.size, 0)
    ImageDraw.Draw(glow).rounded_rectangle(FRAME, radius=26, outline=255, width=width * 3)
    glow = glow.filter(ImageFilter.GaussianBlur(9))
    out = Image.composite(Image.new("RGB", im.size, GOLD_HI), out, glow.point(
        lambda v: int(v * 0.30)))
    ring = Image.new("L", im.size, 0)
    d = ImageDraw.Draw(ring)
    d.rounded_rectangle(FRAME, radius=26, outline=255, width=width)
    inner = (FRAME[0] + width + 3, FRAME[1] + width + 3,
             FRAME[2] - width - 3, FRAME[3] - width - 3)
    d.rounded_rectangle(inner, radius=22, outline=255, width=2)
    out = Image.composite(gold_ramp(im.size), out, ring)
    hair = Image.new("L", im.size, 0)
    ImageDraw.Draw(hair).rounded_rectangle(inner, radius=21, outline=255, width=1)
    out = Image.composite(Image.new("RGB", im.size, GOLD_DEEP), out, hair)
    return out


def star_pts(cx, cy, r, inner=0.45):
    pts = []
    for i in range(10):
        ang = math.radians(-90 + i * 36)
        rr = r if i % 2 == 0 else r * inner
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    return pts


def star_row(im, n=3):
    """满星行：圆台正面木色上的亮金五角星（局部落差渐变 + 投影 + 深棕描边）。"""
    out = im.copy()
    total = n * STAR_R * 2 + (n - 1) * STAR_GAP
    xs = [CASE_CX - total / 2 + STAR_R + i * (STAR_R * 2 + STAR_GAP) for i in range(n)]
    band = (STAR_Y - STAR_R, STAR_Y + STAR_R)
    mask = Image.new("L", out.size, 0)
    shadow = Image.new("L", out.size, 0)
    for cx in xs:
        ImageDraw.Draw(mask).polygon(star_pts(cx, STAR_Y, STAR_R), fill=255)
        ImageDraw.Draw(shadow).polygon(star_pts(cx, STAR_Y + 4, STAR_R), fill=120)
    shadow = shadow.filter(ImageFilter.GaussianBlur(3))
    out = Image.composite(Image.new("RGB", out.size, (28, 14, 6)), out, shadow)
    out = Image.composite(
        gold_ramp(out.size, (255, 232, 140), (226, 158, 44), band=band), out, mask)
    rim = Image.new("L", out.size, 0)
    dr = ImageDraw.Draw(rim)
    for cx in xs:
        dr.polygon(star_pts(cx, STAR_Y, STAR_R), outline=255, width=2)
    return Image.composite(Image.new("RGB", out.size, (110, 66, 26)), out, rim)


# ── 三态章 ──────────────────────────────────────────────────────────────
def stamp(cv, name, cx, cy, w, h, anchor="center"):
    """贴三态章。anchor = center（锁/沙漏，按纹理重心居中）或 topleft。"""
    im = Image.open(f"{BADGE_DIR}/{name}").convert("RGBA")
    kw, kh = max(1, round(w)), max(1, round(h))
    im = im.resize((kw, kh), Image.LANCZOS)
    if anchor == "center":
        a = np.asarray(im.split()[-1])
        ys, xs = np.nonzero(a > 32)
        x, y = cx - (xs.mean() / im.width) * kw, cy - (ys.mean() / im.height) * kh
    else:
        x, y = cx, cy
    cv.paste(im, (round(x), round(y)), im)


def selfcheck(base, states):
    """自证（打印不阻断）：全彩腿只动金色三处；灰化腿只看柜内饱和度分档。"""
    b = np.asarray(base, dtype=np.int16)
    for name, cv in states.items():
        d = np.abs(np.asarray(cv, dtype=np.int16) - b).sum(axis=2)
        ys, xs = np.nonzero(d > 12)
        box = tuple(map(int, (xs.min(), ys.min(), xs.max(), ys.max()))) if len(xs) else None
        print(f"自检 {name:8s} 改动像素 {len(xs):7d} ({len(xs) / d.size:.1%}) 包围盒 {box}")

    def sat(im, box):
        a = np.asarray(im.crop(box), dtype=np.int16)
        return round((np.abs(a[:, :, 0] - a[:, :, 1]) + np.abs(a[:, :, 1] - a[:, :, 2])).mean(), 1)

    print("饱和度 柜内 base", sat(base, (150, 430, 590, 830)),
          "| locked", sat(states["locked"], (150, 430, 590, 830)),
          "| pushing 灰", sat(states["pushing"], (150, 430, 590, 650)),
          "彩", sat(states["pushing"], (150, 720, 590, 830)),
          "| cleared", sat(states["cleared"], (150, 430, 590, 830)))


def main():
    os.makedirs(OUT, exist_ok=True)
    im = Image.open(BASE).convert("RGB")
    size = im.size
    print("base", size, "progress", PROGRESS)
    fade = bottom_fade(size, CASE[3] - CASE_FADE, CASE[3] + 10)

    # ── locked：整块磨砂置灰 + 锁章 ────────────────────────────────────
    locked = Image.composite(gray_layer(im, blur=6, lift=100, scale=0.55, veil=0.16), im,
                             shape(CASE, size, blur=10, ramp=fade))
    stamp(locked, "ui_menu_badge_locked.png", ART_C[0], ART_C[1] + 6, LOCK_D, LOCK_D)

    # ── pushing：竖向揭彩（上灰下彩，彩 = 完成度）+ 沙漏 ───────────────
    ramp = wipe_ramp(size, PROGRESS, WIPE_SOFT) * fade
    pushing = Image.composite(
        gray_layer(im, blur=0, lift=64, scale=0.66, veil=0.10), im,
        shape(CASE, size, blur=10, ramp=ramp))
    stamp(pushing, "ui_menu_badge_progress.png", ART_C[0], ART_C[1] + 4, HOUR_D, HOUR_D)

    # ── cleared：全彩 + 满星金色腿 + 通关印 ────────────────────────────
    cleared = gold_edge(im)
    cleared = star_row(cleared)
    stamp(cleared, "ui_menu_seal_cleared.png",
          PANEL[2] - SEAL_INSET - SEAL_W, CASE[1] + SEAL_INSET, SEAL_W, SEAL_H,
          anchor="topleft")

    for name, cv in (("locked", locked), ("pushing", pushing), ("cleared", cleared)):
        p = f"{OUT}/proto-menu-v2-{name}-752x1344.png"
        cv.save(p)
        print("写出", p, cv.size)
    selfcheck(im, {"locked": locked, "pushing": pushing, "cleared": cleared})


if __name__ == "__main__":
    main()
