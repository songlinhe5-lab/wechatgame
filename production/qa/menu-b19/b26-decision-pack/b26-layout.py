#!/usr/bin/env python3
"""U1②×slogan取消 落位预览：四种裁法各自贴进屏幕（slogan 已撤），看谁需要压橱窗。

坐标全部现读 `tuning.ts` + `menu-architecture §5.1b`（y-up → 自顶 = 1334 − y）。
产物：`sign-layout.jpg`（四联，⛔ 只作版面判读，不当资产）。
"""
from PIL import Image, ImageFilter, ImageDraw
import re
import numpy as np

TUN = "games/beads/src/config/tuning.ts"
ARCH = "games/beads/design/art/proposals/ui-style-redesign/menu-architecture.md"
SRC = "games/beads/design/art/shots/menu-showcase-20261010/sprites-v1-shadow/sprite-00.png"
OUT = "production/qa/menu-b19/b26-decision-pack/sign-layout.jpg"
H = 1334
DELTA = 12


def const(n):
    return float(re.search(r"^export const %s = ([\d.]+);" % n, open(TUN).read(), re.M).group(1))


top_lo = int(
    re.search(r"设置[^|]*\|[^|]*y∈\[(\d+),(\d+)\]", open(ARCH).read()).group(1))
CARD_TOP, CARD_H = const("CAROUSEL_TOP"), const("CAROUSEL_H")
PLAQUE_TOP = CARD_TOP + const("SIGN_BAND_PAD") + const("MENU_PLAQUE_H")
PRIMARY_TOP = const("MENU_PRIMARY_Y") + const("TOUCH_MIN")

im = Image.open(SRC).convert("RGBA")
a = np.array(im)[:, :, 3]
w = (a > 128).sum(1)
rope_end = int(np.argmax(w > 80))     # 绳段结束（蝴蝶结顶）
plank_top = int(np.argmax(w > 0.4 * w.max()))


def aa(c):
    """裁后补 AA：1.5× 重采样回缩 + alpha 轻羽化（同 b26-resign.py 口径）。"""
    big = c.resize((c.width * 3 // 2, c.height * 3 // 2), Image.LANCZOS)
    s = big.resize(c.size, Image.LANCZOS)
    r, g, b, al = s.split()
    return Image.merge("RGBA", (r, g, b, al.filter(ImageFilter.GaussianBlur(0.8))))


ys = np.where((a > 128).any(1))[0]
xs = np.where((a > 128).any(0))[0]
VARIANTS = (
    ("A  keep rope 230 (squeeze 42)", im, 0, 42),
    ("B  crop rope 170 (no squeeze)", im.crop(
        (int(xs.min()), rope_end, int(xs.max()) + 1, int(ys.max()) + 1)), 0, 0),
    ("C  crop to plank 139", im.crop(
        (int(xs.min()), plank_top, int(xs.max()) + 1, int(ys.max()) + 1)), 0, 0),
    ("D  fit layout 183 (upscale)", aa(im.crop(
        (int(xs.min()), plank_top, int(xs.max()) + 1, int(ys.max()) + 1))), 1.316, 0),
)

SC, PW, PH = 0.36, int(750 * 0.36), int(H * 0.36)
canvas = Image.new("RGB", (PW * 4 + 30, PH + 46), (250, 246, 238))
D = ImageDraw.Draw(canvas)
for i, (label, crop, up, squeeze) in enumerate(VARIANTS):
    ox, oy = i * (PW + 10) + 6, 34
    pg = Image.new("RGBA", (PW, PH), (241, 232, 216, 255))
    d = ImageDraw.Draw(pg)

    # 顶栏三颗（热区 88，视觉 Ø59；顶栏不随 squeeze 动）
    for cx in (68, 604, 692):
        cy = top_lo + 44
        d.ellipse([(cx - 29.5) * SC, (H - cy - 29.5) * SC, (cx + 29.5) * SC, (H - cy + 29.5) * SC],
                  fill=(255, 255, 255, 255), outline=(200, 190, 170, 255))
    # 门楣牌 / 走马灯卡 / 主钮（整体随 squeeze 下移）
    d.rectangle([150 * SC, (H - PLAQUE_TOP + squeeze) * SC, 600 * SC, (H - (CARD_TOP + const("SIGN_BAND_PAD")) + squeeze) * SC],
                fill=(140, 92, 42, 255))
    d.rectangle([(750 - 300) / 2 * SC, (H - CARD_TOP + squeeze) * SC, (750 + 300) / 2 * SC,
                 (H - CARD_TOP + CARD_H + squeeze) * SC], fill=(255, 252, 246, 255), outline=(138, 91, 52, 255))
    d.rectangle([(750 - 320) / 2 * SC, (H - PRIMARY_TOP + squeeze) * SC, (750 + 320) / 2 * SC,
                 (H - const("MENU_PRIMARY_Y") + squeeze) * SC], fill=(253, 183, 187, 255))
    # 招牌：牌顶锚 顶栏热区底 −Δ12
    piece = crop
    if up:
        piece = crop.resize(
            (int(crop.width * up), int(crop.height * up)), Image.LANCZOS)
    disp_w = piece.width / 2 * SC
    disp_h = piece.height / 2 * SC
    top_px = (H - (top_lo - DELTA)) * SC
    piece = piece.resize(
        (max(1, int(disp_w)), max(1, int(disp_h))), Image.LANCZOS)
    pg.alpha_composite(piece, (int((PW - piece.width) / 2), int(top_px)))
    d.line([(0, top_px), (PW, top_px)], fill=(0, 170, 200, 255))
    d.line([(0, (H - PLAQUE_TOP + squeeze) * SC),
           (PW, (H - PLAQUE_TOP + squeeze) * SC)], fill=(220, 60, 60, 255))
    canvas.paste(pg.convert("RGB"), (ox, oy))
    D.text((ox + 4, 12), "%s  h=%d  squeeze=%d" %
           (label, piece.height / SC / 2, squeeze), fill=(30, 30, 40))
canvas.save(OUT, quality=90)
print("裁线实测：绳段结束 @2x y=%d（板顶 y=%d，实体底 y=%d）" % (rope_end, plank_top, ys.max()))
print("顶栏热区底 y-up %d｜门楣牌顶 %d｜可用带 %d｜主钮顶 %.0f" %
      (top_lo, PLAQUE_TOP, top_lo - PLAQUE_TOP, PRIMARY_TOP))
print("→", OUT)
