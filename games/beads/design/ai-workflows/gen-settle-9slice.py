#!/usr/bin/env python3
"""结算面板 9-slice 资产草案 v2（临时脚本，定稿后移入 design/ai-workflows/）。

四件：
  ui_panel_frame_9s        外框木框（九宫格，中心透明）  520×470 cap60
  ui_panel_face_9s         框内底（九宫格，纸面内凹）    520×470 cap36
  ui_btn_wood_9s(_pressed) 主钮（垂直光照，横向可拉伸）  300×92  capX76
  ui_btn_paper_9s          次钮（纸面，横向可拉伸）      150×88  capX52

九宫格安全铁律：所有装饰线只允许出现在
  · 角落（双轴不拉伸）
  · 上/下边条的水平直线（水平拉伸后仍是同一条线）
  · 左/右边条的垂直直线（垂直拉伸后仍是同一条线）
⛔ 不得出现「只画半圈」的环线或依赖整图比例的纹理。
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = "."
GRAIN = f"{ROOT}/games/beads/design/art/final/assets/menu/ui_wood_grain.png"
BASE = f"{ROOT}/games/beads/design/art/final/prototypes/proto-v3-pushing-750x1334-at2x.png"
OUT = f"{ROOT}/temp/9s"
F_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"
F_LIGHT = "/System/Library/Fonts/STHeiti Light.ttc"

EDGE_DARK = (70, 42, 18)
EDGE_LINE = (94, 59, 30)
SHEEN = (214, 172, 124)
PAPER_TOP = (250, 246, 237)
PAPER_BOT = (255, 253, 248)
INK = (42, 46, 67)
GOLD = (212, 160, 40)
CREAM = (255, 248, 235)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgrad(w, h, stops):
    im = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / max(1, h - 1)
        c = stops[0][1]
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1:
                k = 0 if t1 == t0 else (t - t0) / (t1 - t0)
                c = lerp(c0, c1, k)
                break
        d.line([(0, y), (w, y)], fill=c)
    return im


def bleed(img, mask, color, radius=0):
    """透明区 RGB 用统一材质色填充（只动 RGB，不动 alpha）——
    否则九宫格缩放会把透明区的深描边 RGB 混成暗线。
    ⛔ 不能用模糊：深描边会被模糊扩散进透明区，仍在边缘混出暗线。"""
    flat = Image.new("RGB", img.size, color)
    rgb = Image.composite(img.convert("RGB"), flat, mask)
    out = rgb.convert("RGBA")
    out.putalpha(mask)
    return out


def paint(base, fn):
    """半透明笔画必须走独立图层 —— PIL 直接画 RGBA 会覆盖像素 alpha（阴影会变透明）。"""
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    fn(ImageDraw.Draw(layer))
    base.alpha_composite(layer)


def round_mask(w, h, r):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
    return m


def grain_tile(w, h, dark=34, light=26, alpha_mul=1.0):
    """裁一块 300×92 左右的真实木纹窗口（保持颗粒尺度），返回 RGBA 叠加层。"""
    g = Image.open(GRAIN).convert("RGB")
    win = g.crop((330, 96, 330 + 300, 96 + 92)).resize((w, h), Image.LANCZOS)
    lum = win.convert("L")
    px = list(lum.getdata())
    lo, hi = min(px), max(px)
    span = max(1, hi - lo)
    out = []
    for v in px:
        k = (v - lo) / span - 0.5  # -0.5..0.5
        if k >= 0:
            out.append((255, 246, 230, round(light * 2 * k * alpha_mul)))
        else:
            out.append((46, 26, 12, round(dark * 2 * -k * alpha_mul)))
    im = Image.new("RGBA", (w, h))
    im.putdata(out)
    return im


# ───────────────────────────────────────────────────────────── frame

def make_frame():
    W, H, R, B = 520, 470, 24, 18
    body = vgrad(W, H, [
        (0.00, (188, 136, 86)),
        (0.10, (172, 122, 76)),
        (0.42, (150, 102, 60)),
        (0.72, (128, 86, 49)),
        (0.90, (108, 70, 39)),
        (1.00, (92, 58, 30)),
    ]).convert("RGBA")

    # 纵向拉丝木纹（只在 y 方向模糊 ⇒ 上下边条读作顺纹、左右边条拉伸后仍是顺纹）
    noise = Image.effect_noise((W, H), 34).convert("L")
    streak = noise.resize((W, max(1, H // 9)), Image.BILINEAR).resize((W, H), Image.BILINEAR)
    nz = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    nz.putdata([(255, 240, 218, round((v - 128) / 128 * 26)) if v >= 128
                else (42, 24, 10, round((128 - v) / 128 * 32))
                for v in list(streak.getdata())])
    body.alpha_composite(nz)

    d = ImageDraw.Draw(body)
    # 外缘：3px 深描边 + 1px 更深的压线
    d.rounded_rectangle([0, 0, W - 1, H - 1], radius=R, outline=EDGE_DARK, width=3)
    d.rounded_rectangle([1, 1, W - 2, H - 2], radius=R - 1, outline=(50, 30, 12, 170), width=1)
    # 顶缘极淡暖光 / 底缘极淡落影（各一条，贴外缘；水平拉伸安全）
    paint(body, lambda g: (
        g.line([(R, 4), (W - R, 4)], fill=(240, 198, 152, 45), width=2),
        g.line([(R, H - 4), (W - R, H - 4)], fill=(52, 30, 12, 70), width=2),
    ))

    # 框内壁：只留「内孔 2px 深线 + 下内壁 4px 落影」——哑光木作，⛔ 不画亮黄衬线
    inner_top, inner_bot = B, H - B
    inner_l, inner_r = B, W - B
    # 内孔深线：整圈，收在不透明区内（y ≤ 内孔线）
    d.rounded_rectangle([inner_l - 2, inner_top - 2, inner_r + 2, inner_bot + 2],
                        radius=R - B + 2, outline=EDGE_LINE, width=2)
    # 下内壁：4px 落影（水平整条 ⇒ 水平拉伸安全）
    paint(body, lambda g: g.line([(inner_l - 2, inner_bot + 3), (inner_r + 2, inner_bot + 3)],
                                 fill=(48, 28, 12, 150), width=4))

    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, W - 1, H - 1], radius=R, fill=255)
    md.rounded_rectangle([B, B, W - 1 - B, H - 1 - B], radius=R - B, fill=0)

    return bleed(body, mask, (150, 100, 60))


# ───────────────────────────────────────────────────────────── face

def make_face():
    W, H, R = 520, 470, 10
    face = vgrad(W, H, [
        (0.00, (247, 242, 232)),
        (0.08, (251, 247, 239)),
        (0.30, PAPER_BOT),
        (1.00, (255, 254, 251)),
    ]).convert("RGBA")
    # 纸纹：各向同性细噪点（拉伸安全，只提供「纸」的触感）
    noise = Image.effect_noise((W, H), 14).convert("L")
    nz = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    nz.putdata([(120, 100, 80, round((v - 128) / 128 * 8)) if v < 128
                else (255, 255, 255, round((v - 128) / 128 * 10))
                for v in list(noise.getdata())])
    face.alpha_composite(nz)

    def shade(g):
        # 内凹：纸面被木框压住 —— 顶部 24px 渐暗、左右 13px
        for i in range(24):
            a = round(46 * (1 - i / 23) ** 0.85)
            g.line([(0, i), (W, i)], fill=(64, 48, 30, a), width=1)
        for i in range(13):
            a = round(28 * (1 - i / 12) ** 1.1)
            g.line([(i, 0), (i, H)], fill=(64, 48, 30, a), width=1)
            g.line([(W - 1 - i, 0), (W - 1 - i, H)], fill=(64, 48, 30, a), width=1)
        # 下缘受光（纸沿被光洗亮）
        for i in range(6):
            a = round(64 * (1 - i / 5) ** 1.5)
            g.line([(0, H - 1 - i), (W, H - 1 - i)], fill=(255, 255, 255, a), width=1)
        # 接缝：上缘暗线（纸压在框下），下缘亮线（纸沿翻起）
        g.line([(R, 1), (W - R, 1)], fill=(70, 50, 30, 150), width=3)
        g.line([(R, H - 2), (W - R, H - 2)], fill=(255, 255, 255, 210), width=2)
    paint(face, shade)

    m = round_mask(W, H, R)
    return bleed(face, m, (255, 253, 248))


# ───────────────────────────────────────────────────────────── buttons

def make_wood_btn(w, h, r, pressed=False):
    if pressed:
        stops = [
            (0.00, (156, 106, 64)),
            (0.16, (140, 94, 56)),
            (0.50, (116, 75, 42)),
            (0.82, (94, 58, 30)),
            (1.00, (74, 44, 22)),
        ]
    else:
        stops = [
            (0.00, (208, 156, 102)),
            (0.16, (188, 134, 84)),
            (0.50, (150, 100, 58)),
            (0.82, (120, 78, 44)),
            (1.00, (98, 60, 30)),
        ]
    body = vgrad(w, h, stops).convert("RGBA")
    body.alpha_composite(grain_tile(w, h, dark=54, light=44, alpha_mul=0.75 if pressed else 1.15))

    m = round_mask(w, h, r)
    im = bleed(body, m, (150, 100, 60))
    # 外描边 3px（不透明，可直接画）
    ImageDraw.Draw(im).rounded_rectangle([1, 1, w - 2, h - 2], radius=r, outline=EDGE_DARK, width=3)

    def shade(g):
        if not pressed:
            # 顶缘受光：2px 亮 + 2px 柔光（垂直光照的「光源端」）
            g.line([(r - 2, 5), (w - r + 2, 5)], fill=(242, 204, 160, 100), width=2)
            g.line([(r - 2, 8), (w - r + 2, 8)], fill=(255, 234, 204, 50), width=3)
        else:
            # 按下：顶缘转暗，底缘承重线加粗
            g.line([(r - 2, 5), (w - r + 2, 5)], fill=(56, 34, 16, 150), width=3)
        g.line([(r - 2, h - 8), (w - r + 2, h - 8)], fill=(78, 46, 22, 140), width=3)
        g.line([(r - 2, h - 4), (w - r + 2, h - 4)], fill=(46, 26, 10, 210), width=2)
    paint(im, shade)
    return im


def make_paper_btn(w, h, r):
    m = round_mask(w, h, r)
    im = bleed(Image.new("RGBA", (w, h), (255, 254, 250, 255)), m, (255, 254, 250))
    def shade(g):
        for i in range(8):
            a = round(30 * (1 - i / 7) ** 1.6)
            g.line([(r - 6, 3 + i), (w - r + 6, 3 + i)], fill=(64, 48, 30, a), width=1)
        g.line([(r - 4, h - 4), (w - r + 4, h - 4)], fill=(255, 255, 255, 230), width=2)
    paint(im, shade)
    ImageDraw.Draw(im).rounded_rectangle([1, 1, w - 2, h - 2], radius=r, outline=(150, 116, 80), width=2)
    return im


# ───────────────────────────────────────────────────────────── preview

FRAME_INSET = 18


def nine_slice(src, dw, dh, capx, capy):
    """与 packages/framework .../bakeNineSlice 同语义：端帽只缩不放、按较短边同比。"""
    sw, sh = src.size
    scx = min(capx, sw // 2)
    scy = min(capy, sh // 2)
    fit = min(dw / sw, dh / sh)
    fit = 1.0 if (fit <= 0 or fit > 1) else fit
    cx = min(scx * fit, dw / 2)
    cy = min(scy * fit, dh / 2)
    l, r = 0, sw - scx
    t, b = 0, sh - scy
    out = Image.new("RGBA", (int(round(dw)), int(round(dh))), (0, 0, 0, 0))
    xs = [(0, cx), (cx, dw - cx), (dw - cx, dw)]
    ys = [(0, cy), (cy, dh - cy), (dh - cy, dh)]
    sx = [(0, scx), (scx, sw - scx), (sw - scx, sw)]
    sy = [(0, scy), (scy, sh - scy), (sh - scy, sh)]
    for j in range(3):
        for i in range(3):
            x0, x1 = xs[i]; y0, y1 = ys[j]
            u0, u1 = sx[i]; v0, v1 = sy[j]
            if x1 - x0 <= 0 or y1 - y0 <= 0:
                continue
            part = src.crop((int(u0), int(v0), int(u1), int(v1)))
            part = part.resize((max(1, int(round(x1 - x0))), max(1, int(round(y1 - y0)))), Image.NEAREST)
            out.alpha_composite(part, (int(round(x0)), int(round(y0))))
    return out


def paste_panel(canvas, frame, face, pw, ph, px, py):
    # 真九宫格：框 cap60 / 底 cap36（与落码常量同口径）
    f = nine_slice(frame, pw, ph, 60, 60)
    inset = FRAME_INSET
    g = nine_slice(face, pw - inset * 2, ph - inset * 2, 36, 36)
    canvas.alpha_composite(g, (px + inset, py + inset))
    canvas.alpha_composite(f, (px, py))


def star(cx, cy, r):
    pts = []
    for k in range(10):
        ang = -math.pi / 2 + k * math.pi / 5
        rr = r if k % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    return pts


def make_preview():
    W, H = 750, 1334
    cv = Image.open(BASE).convert("RGBA").resize((W, H), Image.LANCZOS)
    cv.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, 118)))
    frame, face = make_frame(), make_face()
    btn = make_wood_btn(300, 92, 20)
    pbtn = make_paper_btn(150, 88, 20)

    PW, PH = 520, 470
    PX, PY = (W - PW) // 2, (H - PH) // 2
    paste_panel(cv, frame, face, PW, PH, PX, PY)

    d = ImageDraw.Draw(cv)
    # 木牌（沿用现役木纹，骑上沿）
    plaque = Image.open(GRAIN).convert("RGBA").crop((0, 40, 1024, 280)).resize((200, 64), Image.LANCZOS)
    plaque.putalpha(round_mask(200, 64, 16))
    pv = Image.new("RGBA", (200, 64), (0, 0, 0, 0))
    pv.alpha_composite(plaque)
    ImageDraw.Draw(pv).rounded_rectangle([0, 0, 199, 63], radius=16, outline=EDGE_LINE, width=3)
    cv.alpha_composite(pv, (W // 2 - 100, PY - 32))
    d.text((W // 2, PY + 2), "过关", font=ImageFont.truetype(F_BOLD, 40), fill=CREAM, anchor="mm")

    sy = PY + PH - 150
    for i in range(3):
        cx = W // 2 + (i - 1) * 104
        d.polygon(star(cx, sy + 3, 33), fill=(61, 46, 30, 70))
        d.polygon(star(cx, sy, 33), fill=GOLD, outline=(120, 86, 30), width=2)
        d.polygon(star(cx, sy + 2, 18), fill=(255, 244, 212, 190))

    d.text((W // 2, sy - 66), "用时41秒", font=ImageFont.truetype(F_LIGHT, 30), fill=INK, anchor="mm")
    d.text((W // 2, sy - 112), "+45 豆", font=ImageFont.truetype(F_BOLD, 34), fill=GOLD, anchor="mm")
    d.text((W // 2, sy - 154), "再快12秒可得3★", font=ImageFont.truetype(F_LIGHT, 28), fill=INK, anchor="mm")

    row_y = PY + 44
    left = (W - (300 + 16 + 150)) // 2
    cv.alpha_composite(btn, (left, row_y))
    d.text((left + 150, row_y + 47), "下一关", font=ImageFont.truetype(F_BOLD, 34), fill=CREAM, anchor="mm")
    cv.alpha_composite(pbtn, (left + 300 + 16, row_y + 2))
    d.text((left + 300 + 16 + 75, row_y + 46), "回主界面",
           font=ImageFont.truetype(F_LIGHT, 26), fill=INK, anchor="mm")

    cv.convert("RGB").save(f"{ROOT}/temp/settle-9s-preview.png")

    # 拉伸测试：同一张源图 → 三种目标尺寸
    tv = Image.new("RGBA", (1600, 700), (240, 233, 220, 255))
    for i, (pw, ph) in enumerate([(520, 470), (640, 360), (380, 540)]):
        x, y = 24 + i * 520, 24
        paste_panel(tv, frame, face, pw, ph, x, y)
        bw = min(300, pw - 60)
        tv.alpha_composite(nine_slice(btn, bw, 92, 76, 46), (x + 24, y + ph + 24))
    tv.convert("RGB").save(f"{ROOT}/temp/settle-9s-stretch.png")
    print("wrote preview + stretch")


def main():
    os.makedirs(OUT, exist_ok=True)
    make_frame().save(f"{OUT}/ui_panel_frame_9s.png")
    make_face().save(f"{OUT}/ui_panel_face_9s.png")
    make_wood_btn(300, 92, 20).save(f"{OUT}/ui_btn_wood_9s.png")
    make_wood_btn(300, 92, 20, pressed=True).save(f"{OUT}/ui_btn_wood_9s_pressed.png")
    make_paper_btn(150, 88, 20).save(f"{OUT}/ui_btn_paper_9s.png")
    print("assets ->", OUT)
    make_preview()


if __name__ == "__main__":
    main()
