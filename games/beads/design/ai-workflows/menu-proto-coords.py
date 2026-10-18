#!/usr/bin/env python3
# 主界面原型 v3（三态 + 走马灯示意帧）+ 坐标总图 + 五档机型坐标图，同一份合成底图（零模型，纯 PIL）。
# 布局 = 落地单 v3.8（§8 走马灯）/ tuning.ts `menuAnchors`；素材 = final/assets/menu 正本（顶栏钮/徽标/木牌/箭头）
# + proto-v2 切件（资源条、曼陀罗豆画）。标注单位 = 750 设计px（rpx 语义）。
# 用法（仓库根）：python3 games/beads/design/ai-workflows/menu-proto-coords.py
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ART = "games/beads/design/art/final"
A = f"{ART}/assets/menu"
# 2026-10-18 webp 退役 ⇒ 输入也走 PNG
PROTO_V2 = f"{ART}/prototypes/proto-v2-full-750x1334-at2x.png"
LOGO = "games/beads/assets/menu/ui_menu_logo.png"
F_LIGHT = "/System/Library/Fonts/STHeiti Light.ttc"
F_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"
PLATE_TEXT = ("第 9 关", "曼陀罗")           # 关名为占位：运行时读关卡 `title`（可选），缺省只显关序
CTA_TEXT = "开始游戏"                         # copy-tokens `btn_start_label`

# ── tuning.ts 常量（750 系）──
TOPG, BOTG, PAD = 16, 32, 12
# 无刘海结顶下限 = 加长前绳长（tuning MENU_BOW_MIN_FROM_TOP）
BOW_MIN = 61
SIGN_CHAIN, BAR_H, BAR_INSET, CASE_H, CTA_H = 165, 32, 14, 871, 92
# x, w, h, bowYOff（v3.9 绳加长到 960×772）
SIGN = (190, 370, 298, 119)
BAR = (154, 442)                              # 圆角不探出框肩，中心 375
CASE = (107, 544)
BOSS = (146, 130, 468, 528)                   # x, yOff, w, h
# 走马灯滑动裁切区 = 玻璃内壁（橱窗位图实测 x167..590）
CLIP = (168, 130, 422, 528)
SEAL_H, SEAL_INSET = 140, 12                  # 通关飘带随内容滑动 ⇒ 整枚落在裁切区内
NEXT_TEXT = ("第 10 关", "小雏菊")             # 滑动示意里的下一项（占位）
BADGE = (538, 142, 64)
DONE = (380, 394, 160)                        # cx, yOff, d
PLATE = (381, 652, 214, 100)                  # cx, yOff, w, h
PLATE_TITLE = (30, 62)                        # 两行行心距牌顶（关序 28 / 关名 30，E1 地板 28）
# palette woodFace / woodEdge
WOOD_FACE, WOOD_EDGE = (138, 91, 52), (94, 59, 30)
ARROW_X, ARROW_D, ARROW_ICON = (26, 660), 64, 36
TOPBAR_X, TOPBAR_D, HIT = (24, 560, 648), 80, 88
CTA_X, CTA_W = 218, 324

v2 = Image.open(PROTO_V2).convert("RGB")
BG = v2.getpixel((10, 10))


def v2crop(x0, y0, x1, y1):
    return v2.crop((x0 * 2, y0 * 2, x1 * 2, y1 * 2))


BAR_IMG = v2crop(156, 248, 595, 294)
# 豆画：v2 boss 图位（窗顶 294 + 130）内非白像素外接框；正片叠底贴回 ⇒ 白底自然吃掉
_slot = v2crop(146, 424, 614, 940)
_ink = ImageOps.invert(_slot.convert("L")).point(
    lambda v: 255 if v > 30 else 0)
MANDALA = _slot.crop(_ink.getbbox())
# 花的重心（图内 0..1）。贴图按外接框中心摆会让花偏上、章跟着偏。
_rgb = np.asarray(MANDALA.convert("RGB")).astype(np.int16)
_r, _g, _b = _rgb[:, :, 0], _rgb[:, :, 1], _rgb[:, :, 2]
_ys, _xs = np.nonzero((np.maximum(np.maximum(_r, _g), _b) -
                      np.minimum(np.minimum(_r, _g), _b)) > 18)
FLOWER = (_xs.mean() / MANDALA.width, _ys.mean() / MANDALA.height)
_sat = np.zeros(_r.shape, np.uint8)
_sat[_ys, _xs] = 255
BEAD_MASK = Image.fromarray(_sat).filter(
    ImageFilter.MaxFilter(9))   # 彩豆 + 9px 外扩（豆间缝）
# 只留与花心连通的一块（切件两侧带着白板木边，饱和度也过阈）
ImageDraw.floodfill(BEAD_MASK, (round(_xs.mean()), round(_ys.mean())), 128)
BEAD_MASK = BEAD_MASK.point(lambda v: 255 if v == 128 else 0)


def mass_frac(img, thresh=32):
    """不透明像素重心 / 图幅，用来把纹理的内容（不是外接框）摆到目标点上。"""
    a = np.asarray(img.convert("RGBA").split()[-1])
    ys, xs = np.nonzero(a > thresh)
    return xs.mean() / img.width, ys.mean() / img.height


def seal_xy(c0, sw):
    """通关飘带左上角：裁切区右上内缩 SEAL_INSET。"""
    return CLIP[0] + CLIP[2] - SEAL_INSET - sw, c0 + CLIP[1] + SEAL_INSET


def anchors(st, sb, cap, H):
    """tuning.ts menuAnchors 的 y-down 直译（只用于出图，真源仍是 TS）。"""
    bow0 = max(st + TOPG, BOW_MIN)
    sign1 = bow0 + SIGN_CHAIN
    cta1 = H - sb - BOTG
    cta0 = cta1 - CTA_H
    zone = cta0 - sign1
    gap_top = max((zone - CASE_H) / 3, PAD)
    case0 = sign1 + gap_top
    return dict(st=st, sb=sb, cap=cap, H=H, bow0=bow0, sign1=sign1, cta0=cta0, cta1=cta1,
                gap_top=gap_top, gap_bot=zone - CASE_H - gap_top, case0=case0,
                case1=case0 + CASE_H, bt=cap + 4, arrow_cy=case0 + 0.42 * CASE_H)


def content_layer(g, s, state):
    """走马灯滑动层（透明底，尺寸 = CLIP）：豆画 + 三态盖章。坐标仍按 750 系写，内部减去 CLIP 原点。"""
    ox0, oy0 = CLIP[0], g["case0"] + CLIP[1]
    lay = Image.new("RGBA", (round(CLIP[2] * s), round(CLIP[3] * s)))

    def put(img, x, y, w, h):
        im = img.convert("RGBA").resize(
            (max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
        lay.alpha_composite(im, (round((x - ox0) * s), round((y - oy0) * s)))

    def put_centered(img, cx, cy, w, h):
        ox, oy = mass_frac(img)
        put(img, cx - ox * w, cy - oy * h, w, h)

    # 豆画白底转透明（等效原先叠在白板上的正片叠底）。未开启 = 置灰；进行中 / 通关 = 原色（v3.8）
    art = MANDALA if state != "locked" else Image.blend(
        ImageOps.grayscale(MANDALA).convert("RGB"), Image.new("RGB", MANDALA.size, "white"), 0.4)
    rgb = np.asarray(art.convert("RGB")).astype(np.float32)
    a = 255 - rgb.min(axis=2)
    a = a * (np.asarray(BEAD_MASK) > 0)          # 去掉 proto-v2 切件里白板灰边，只留豆子
    col = 255 - (255 - rgb) * 255 / np.maximum(a, 1)[..., None]
    art = Image.fromarray(
        np.dstack([np.clip(col, 0, 255), a]).astype(np.uint8), "RGBA")
    aw = 340
    ah = aw * MANDALA.height / MANDALA.width
    # 花的重心落在图位中心，三态盖章再按各自纹理的重心叠到同一点
    cx, cy = DONE[0], g["case0"] + DONE[1]
    put(art, cx - FLOWER[0] * aw, cy - FLOWER[1] * ah, aw, ah)
    if state == "locked":
        put_centered(Image.open(
            f"{A}/ui_menu_badge_locked.png"), cx, cy, 220, 220)
    elif state == "pushing":
        badge = Image.open(f"{A}/ui_menu_badge_progress.png")
        bh = 200
        put_centered(badge, cx, cy, bh * badge.width / badge.height, bh)
    else:
        seal = Image.open(f"{A}/ui_menu_seal_cleared.png")
        sw = SEAL_H * seal.width / seal.height
        put(seal, *seal_xy(g["case0"], sw), sw, SEAL_H)
    return lay


def compose(g, s, state, w750=750, content=True, plate_text=PLATE_TEXT):
    """干净 UI 底图；s = 每设计px 的画布像素数。state ∈ pushing/locked/done。
    content=False ⇒ 不画滑动层（豆画 + 盖章），plate_text=None ⇒ 木牌不写字。"""
    cv = Image.new("RGB", (round(w750 * s), round(g["H"] * s)), BG)

    def put(img, x, y, w, h, alpha=True):
        im = img.convert("RGBA").resize(
            (max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
        cv.paste(im, (round(x * s), round(y * s)), im if alpha else None)

    def text(cx, cy, txt, size, fill, font=F_BOLD, stroke=0, stroke_fill=None):
        f = ImageFont.truetype(font, round(size * s))
        ImageDraw.Draw(cv).text((cx * s, cy * s), txt, font=f, fill=fill, anchor="mm",
                                stroke_width=round(stroke * s), stroke_fill=stroke_fill)

    c0 = g["case0"]
    put(Image.open(f"{A}/ui_showcase_frame.png"), CASE[0], c0, CASE[1], CASE_H)
    put(BAR_IMG, BAR[0], c0 + BAR_INSET, BAR[1], BAR_H, alpha=False)
    if content:
        lay = content_layer(g, s, state)
        box = tuple(round(v * s) for v in (CLIP[0], c0 + CLIP[1]))
        cv.paste(lay, box, lay)
    # 木牌（固定层）+ 关卡标题（两行：关序 / 关名）
    px, py = PLATE[0] - PLATE[2] / 2, c0 + PLATE[1]
    put(Image.open(f"{A}/ui_showcase_plate.png"), px, py, PLATE[2], PLATE[3])
    if plate_text:
        text(PLATE[0], py + PLATE_TITLE[0], plate_text[0], 28, WOOD_FACE)
        text(PLATE[0], py + PLATE_TITLE[1], plate_text[1], 30, WOOD_EDGE)
    # ◀▶
    for x, icon in zip(ARROW_X, ("left", "right")):
        y = g["arrow_cy"] - ARROW_D / 2
        put(Image.open(f"{A}/ui_btn_arrow_bg_normal.png"),
            x, y, ARROW_D, ARROW_D)
        ic = Image.open(f"{A}/ui_icon_arrow_{icon}.png")
        iw = ARROW_ICON * ic.width / ic.height
        put(ic, x + (ARROW_D - iw) / 2, y +
            (ARROW_D - ARROW_ICON) / 2, iw, ARROW_ICON)
    put(Image.open(LOGO), SIGN[0], g["bow0"] - SIGN[3], SIGN[1], SIGN[2])
    # 顶栏三钮：圆底 + 图标同框 80（热区 88 同心）
    for hx, icon in zip(TOPBAR_X, ("settings", "sound", "mail")):
        x, y = hx + (HIT - TOPBAR_D) / 2, g["bt"] + (HIT - TOPBAR_D) / 2
        put(Image.open(f"{A}/ui_btn_circle_normal.png"),
            x, y, TOPBAR_D, TOPBAR_D)
        put(Image.open(f"{A}/ui_icon_{icon}.png"), x, y, TOPBAR_D, TOPBAR_D)
    # CTA：正本 200×240 纵向等比缩到 92，横向三段拉伸（端帽 capX 76 源px）+ 文案居台面
    src = Image.open(f"{A}/ui_btn_start_9s.png").convert("RGBA")
    hp, wp = round(CTA_H * s), round(CTA_W * s)
    src = src.resize((round(src.width * hp / src.height), hp), Image.LANCZOS)
    cap = round(76 * hp / 240)
    pill = Image.new("RGBA", (wp, hp))
    pill.paste(src.crop((0, 0, cap, hp)), (0, 0))
    pill.paste(src.crop((cap, 0, src.width - cap, hp)
                        ).resize((wp - 2 * cap, hp)), (cap, 0))
    pill.paste(src.crop((src.width - cap, 0, src.width, hp)), (wp - cap, 0))
    cv.paste(pill, (round(CTA_X * s), round(g["cta0"] * s)), pill)
    label = Image.open(f"{A}/ui_menu_cta_label.png")
    lh = 56
    lw = lh * label.width / label.height
    ox, oy = mass_frac(label)
    put(label, CTA_X + CTA_W / 2 - ox * lw,
        g["cta0"] + CTA_H * 0.42 - oy * lh, lw, lh)
    return cv


def swipe(g, s, out_state, in_state, t):
    """走马灯滑到 t（0..1）的一帧：固定层不动，滑动层左移 t·槽宽并裁到 CLIP；
    木牌文字先淡出（t 0→0.5）再淡入（0.5→1），两段不重叠。"""
    c0 = g["case0"]
    cv = compose(g, s, out_state, content=False, plate_text=None)
    W = round(CLIP[2] * s)
    strip = Image.new("RGBA", (3 * W, round(CLIP[3] * s)))
    for state, off in ((out_state, -t), (in_state, 1 - t)):
        strip.alpha_composite(content_layer(g, s, state),
                              (W + round(off * W), 0))
    win = strip.crop((W, 0, 2 * W, strip.height))
    cv.paste(win, tuple(round(v * s) for v in (CLIP[0], c0 + CLIP[1])), win)
    py = c0 + PLATE[1]
    ov = Image.new("RGBA", cv.size)
    d = ImageDraw.Draw(ov)
    for txt, a in ((PLATE_TEXT, max(0, 1 - 2 * t)), (NEXT_TEXT, max(0, 2 * t - 1))):
        for line, size, col in ((txt[0], 28, WOOD_FACE), (txt[1], 30, WOOD_EDGE)):
            yoff = PLATE_TITLE[0] if size == 28 else PLATE_TITLE[1]
            d.text((PLATE[0] * s, (py + yoff) * s), line, font=ImageFont.truetype(F_BOLD, round(size * s)),
                   fill=(*col, round(255 * a)), anchor="mm")
    cv.paste(ov, (0, 0), ov)
    return cv


def annotate(cv, g, s, fs):
    """元素框 + 读数（总图与五档共用）。fs = 标注字号（画布 px）。"""
    d = ImageDraw.Draw(cv, "RGBA")
    f = ImageFont.truetype(F_LIGHT, fs)
    lw = max(1, round(s))
    c0 = g["case0"]

    def lab(x, y, txt, col, anchor="la"):
        d.text((x * s, y * s), txt, font=f, fill=col, anchor=anchor,
               stroke_width=max(2, fs // 8), stroke_fill=(255, 255, 255))

    def rect(x, y, w, h, col, txt="", dy=2):
        d.rectangle([x * s, y * s, (x + w) * s, (y + h) * s],
                    outline=col, width=lw)
        if txt:
            lab(x + 3, y + dy, txt, col)

    def circ(cx, cy, r, col):
        d.ellipse([(cx - r) * s, (cy - r) * s, (cx + r) *
                  s, (cy + r) * s], outline=col, width=lw)

    blue, brown, purple, red, green, pink, orange = (
        (0, 80, 220), (140, 80, 20), (130, 0, 180), (210, 0, 0), (0, 140, 0), (210, 0, 110), (230, 120, 0))
    sy = g["bow0"] - SIGN[3]
    rect(SIGN[0], sy, SIGN[1], SIGN[2], blue,
         f"招牌 370×298 @({SIGN[0]},{sy:.0f})  结顶{g['bow0']:.0f} 板底{g['sign1']:.0f}", dy=SIGN[2] - 18)
    rect(CASE[0], c0, CASE[1], CASE_H, brown,
         f"橱窗(含楣) 544×871 @(107,{c0:.0f})  不拉伸", dy=CASE_H - 50)
    rect(BAR[0], c0 + BAR_INSET, BAR[1], BAR_H, orange)
    lab(BAR[0] + 4, c0 + BAR_INSET + BAR_H + 4,
        f"资源条 442×32 @(154,{c0 + BAR_INSET:.0f}) 落在木纹内", orange)
    rect(BOSS[0], c0 + BOSS[1], BOSS[2], BOSS[3], purple, f"Boss图位 468×528 @(146,{c0 + BOSS[1]:.0f})",
         dy=-(fs / s + 4))
    teal = (0, 130, 130)
    for i in range(3):
        rect(CLIP[0] + i, c0 + CLIP[1] + i,
             CLIP[2] - 2 * i, CLIP[3] - 2 * i, teal)
    lab(CLIP[0] + 4, c0 + CLIP[1] + 4,
        f"滑动裁切区 {CLIP[2]}×{CLIP[3]} @({CLIP[0]},{c0 + CLIP[1]:.0f})", teal)
    lab(CLIP[0] + 4, c0 + CLIP[1] + 4 + fs / s + 2, "= 玻璃内壁 · 豆画+盖章 滑", teal)
    circ(DONE[0], c0 + DONE[1], 100, purple)
    lab(DONE[0], c0 + DONE[1] + 114, "沙漏 / 大锁 按纹理重心居中于花心", purple, "ma")
    sw = SEAL_H * 441 / 610
    sx, sy = seal_xy(c0, sw)
    rect(sx, sy, sw, SEAL_H, red)
    lab(sx + sw, sy + SEAL_H + 2,
        f"通关飘带 {sw:.0f}×{SEAL_H} @({sx:.0f},{sy:.0f}) 内缩{SEAL_INSET}", red, "ra")
    px, py = PLATE[0] - PLATE[2] / 2, c0 + PLATE[1]
    rect(px, py, PLATE[2], PLATE[3], brown)
    lab(PLATE[0], py - 46, f"木牌 214×100 @({px:.0f},{py:.0f})", brown, "ma")
    lab(PLATE[0], py - 24, "标题：关序28 / 关名30 居中", brown, "ma")
    for x in ARROW_X:
        rect(x, g["arrow_cy"] - ARROW_D / 2, ARROW_D, ARROW_D, green)
    lab(6, g["arrow_cy"] + 36,
        f"◀▶ 64² x{ARROW_X[0]}/{ARROW_X[1]} 心y{g['arrow_cy']:.0f}", green)
    for hx in TOPBAR_X:
        rect(hx, g["bt"], HIT, HIT, green)
        circ(hx + HIT / 2, g["bt"] + HIT / 2, TOPBAR_D / 2, orange)
    lab(6, g["bt"] + HIT + 4,
        f"钮行 bt={g['bt']:.0f} 热区88 视觉Ø80 x24/560/648", green)
    rect(CTA_X, g["cta0"], CTA_W, CTA_H, pink,
         f"CTA 324×92 @(218,{g['cta0']:.0f})")
    lab(CTA_X + 3, g["cta0"] + CTA_H + 4,
        f"文案纹理重心居中 · 底锚 H−sb−32 = {g['cta1']:.0f}", pink)
    return d, f


def master(out, legend_w=330):
    s = 2
    g = anchors(40, 0, 112, 1334)
    base = compose(g, s, "pushing")
    cv = Image.new("RGB", ((750 + legend_w) * s, 1334 * s), BG)
    cv.paste(base, (0, 0))
    d, f = annotate(cv, g, s, 22)
    d.rectangle([0, 0, 750 * s, g["st"] * s], fill=(20, 20, 20, 60))
    for y, col, txt, tx in [(g["st"], (220, 0, 0), "safeArea.top 40（20dp·接口）", 6),
                            (g["sign1"], (0, 80, 220),
                             f"板底 {g['sign1']}", 640),
                            (g["case1"], (0, 140, 140),
                             f"橱窗底 {g['case1']:.0f}", 6),
                            (g["cta1"], (0, 160, 0), f"CTA底锚 {g['cta1']}", 6)]:
        d.line([(0, y * s), (750 * s, y * s)], fill=col, width=2)
        d.text((tx * s, (y - 14) * s), txt, font=f,
               fill=col, stroke_width=3, stroke_fill="white")
    for ya, yb, txt in [(g["sign1"], g["case0"], f"上{g['gap_top']:.0f}"),
                        (g["case1"], g["cta0"], f"下{g['gap_bot']:.0f}")]:
        d.line([(96 * s, ya * s), (96 * s, yb * s)], fill=(200, 0, 0), width=4)
        d.text((102 * s, (ya + yb) / 2 * s - 11), txt, font=f, fill=(200, 0, 0),
               stroke_width=3, stroke_fill="white")
    rows = [
        ("坐标总图 · 主界面 = 布局规范 v3.8", 32, (0, 0, 0)),
        ("SE 档 375×667dp · st40 · H1334 · @2x", 22, (80, 80, 80)),
        ("底图 = 原型 v3（推关中态），现役素材按规范落位", 22, (80, 80, 80)),
        ("标注 = 设计px（750 基准，dp = px/2）", 22, (80, 80, 80)),
        ("", 22, None),
        ("规范链：", 26, (0, 130, 0)),
        (f"结顶 = max(safeTop + 16, 61) → {g['bow0']}", 22, (20, 20, 20)),
        (f"招牌链 165 → 板底 {g['sign1']}（图框 370×298 @x190）", 22, (20, 20, 20)),
        (f"柜隙上 {g['gap_top']:.0f} → 橱窗顶 {g['case0']:.0f}（= 资源条顶）",
         22, (20, 20, 20)),
        ("橱窗 871 恒定；资源条 46 嵌窗顶不占高", 22, (20, 20, 20)),
        (f"柜隙下 {g['gap_bot']:.0f} = 2 × 上", 22, (20, 20, 20)),
        (f"CTA 324×92 底锚 = H − sb − 32 → {g['cta1']}", 22, (20, 20, 20)),
        (f"钮行 bt = 胶囊底 {g['cap']} + 4 = {g['bt']}", 22, (20, 20, 20)),
        ("", 22, None),
        ("橱窗三态（v3.8，随窗顶平移）：", 26, (130, 0, 180)),
        ("未开启：豆画置灰 + 大锁 220，重心对齐花心", 22, (20, 20, 20)),
        ("进行中：豆画原色 + 沙漏章，重心对齐花心", 22, (20, 20, 20)),
        ("通关：豆画原色 + 金章飘带「通关」裁切区右上", 22, (20, 20, 20)),
        ("  花心 (380, 窗顶+394)", 22, (20, 20, 20)),
        ("", 22, None),
        ("走马灯（v3.8 裁定）：", 26, (0, 130, 130)),
        ("固定：窗框·资源条·灯·◀▶·木牌板·玻璃高光", 22, (20, 20, 20)),
        (f"滑动：豆画 + 盖章，裁到 {CLIP[2]}×{CLIP[3]} 玻璃内壁", 22, (20, 20, 20)),
        ("木牌文字：交叉淡变；翻页阈 30% 槽宽 / 快甩", 22, (20, 20, 20)),
        ("两端回弹不循环；点按/滑动分界 10px", 22, (20, 20, 20)),
        ("木牌 214×100 心x381 @窗顶+652", 22, (20, 20, 20)),
        ("  标题：关序 28 / 关名 30（无关名只显关序）", 22, (20, 20, 20)),
        ("CTA 文案纹理按重心居中于钮面（0.42H）", 22, (20, 20, 20)),
        ("", 22, None),
        ("逐机柜隙 上/下：SE 38/75 · And 130/259", 22, (0, 100, 20)),
        ("X-14 95/191 · 岛 94/188 · 16PM 101/203", 22, (0, 100, 20)),
        ("", 22, None),
        ("! 本次改图（v3.7 → v3.8，链不变）：", 22, (150, 60, 0)),
        ("  未开启：置灰 + 大锁居中", 22, (150, 60, 0)),
        ("  进行中：原色 + 沙漏章居中", 22, (150, 60, 0)),
        ("  通关：飘带收进裁切区右上（随内容滑）", 22, (150, 60, 0)),
        ("  CTA 文案改艺术字纹理", 22, (150, 60, 0)),
        ("", 22, None),
        ("■ 蓝 招牌 / 橙 资源条 / 棕 橱窗·木牌", 22, (60, 60, 60)),
        ("■ 紫 Boss图位 / 青 裁切区 / 红 飘带 / 粉 CTA", 22, (60, 60, 60)),
        ("■ 绿 热区88·◀▶ / 橙圈 视觉Ø80", 22, (60, 60, 60)),
        ("", 22, None),
        ("! 本图只标注，不驱动运行时（真源 tuning.ts）", 22, (220, 0, 0)),
    ]
    yy = 20
    for txt, size, col in rows:
        if txt:
            d.text(((750 + 14) * s, yy), txt,
                   font=ImageFont.truetype(F_LIGHT, size), fill=col)
        yy += size + 16
    cv.save(out)
    print("写出", out, cv.size)


# (文件名, 型号, w_dp, h_dp, dpr, safeTop dp, Home inset dp, 胶囊底 dp, 遮挡件 750系框)
TIERS = [
    ("menu-coords-se375.png", "iPhone SE/6/7/8", 375, 667, 2, 20, 0, 56, None),
    ("menu-coords-android360.png", "Android 挖孔主流（示例 360×780）", 360, 780, 3, 28.8, 0, 64,
     ("hole", 120, 24, 164, 68)),
    ("menu-coords-iphonex375.png", "iPhone X–14（刘海）", 375, 812, 3, 47, 34, 81.5,
     ("notch", 205, 0, 545, 90)),
    ("menu-coords-island393.png", "iPhone 14/15 Pro·16（灵动岛）", 393, 852, 3, 54, 34, 90,
     ("island", 255, 26, 495, 103)),
    ("menu-coords-max440.png", "iPhone 16 Pro Max", 440, 956, 3, 54, 34, 90,
     ("island", 255, 26, 495, 103)),
]
EXPECT_GAPS = [(38, 75), (130, 259), (95, 191), (94, 188),
               (101, 203)]   # menu-anchors.test.ts 钉值


def tier(fname, model, w, h, dpr, st_dp, sb_dp, cap_dp, notch, expect):
    k = 750 / w
    s = dpr / k
    g = anchors(round(st_dp * k), round(sb_dp * k),
                round(cap_dp * k), round(h * k))
    assert (round(g["gap_top"]), round(g["gap_bot"])
            ) == expect, (fname, g["gap_top"], g["gap_bot"])
    cv = compose(g, s, "pushing").crop((0, 0, w * dpr, h * dpr))
    fs = 11 * dpr
    d, f = annotate(cv, g, s, fs)
    head = [f"{model}  {w}x{h}dp  {cv.width}x{cv.height}px @{dpr}x  [标注=750 设计px]",
            f"入系 st{g['st']} cap{g['cap']} home{g['sb']} H{g['H']:.0f} | 链165 窗871 | "
            f"柜隙 上{g['gap_top']:.0f}:下{g['gap_bot']:.0f}"]
    d.rectangle([0, 0, cv.width, 2 * (fs + 4 * dpr) + 2 * dpr],
                fill=(255, 255, 255, 200))
    for i, t in enumerate(head):
        d.text((3 * dpr, 2 * dpr + i * (fs + 4 * dpr)),
               t, font=f, fill=(0, 0, 0))
    d.rectangle([0, 0, cv.width, g["st"] * s], fill=(20, 20, 20, 90))
    if sb_dp:
        y = (g["H"] - g["sb"]) * s
        d.rectangle([0, y, cv.width, cv.height], fill=(20, 20, 20, 90))
        d.text((3 * dpr, y + 2 * dpr),
               f"Home条 inset {sb_dp}dp = {g['sb']}系", font=f, fill="white")
    if notch:
        kind, x0, y0, x1, y1 = notch
        bx = [x0 * s, y0 * s, x1 * s, y1 * s]
        if kind == "hole":
            d.ellipse(bx, fill=(20, 20, 20, 160))
        else:
            d.rounded_rectangle(bx, radius=(y1 - y0) / 2 * s if kind == "island" else 6 * dpr,
                                fill=(20, 20, 20, 230))
        name = {"hole": "挖孔", "notch": "刘海", "island": "灵动岛"}[kind]
        lx, anc = (x1 * s + 4 * dpr,
                   "la") if kind == "hole" else ((x0 + x1) / 2 * s, "ma")
        d.text((lx, (y1 + 4) * s), f"{name} {x1 - x0}×{y1 - y0} 底{y1} ·近似", anchor=anc,
               font=f, fill=(200, 0, 0), stroke_width=2 * dpr, stroke_fill="white")
    cw, ch = 87 * k, 32 * k
    cx0 = 750 - 10 * k - cw
    d.rounded_rectangle([cx0 * s, (g["cap"] - ch) * s, (cx0 + cw) * s, g["cap"] * s],
                        radius=ch / 2 * s, outline=(20, 20, 20), width=2 * dpr)
    d.text(((cx0 + cw) * s, (g["cap"] + 4) * s), f"胶囊底 {g['cap']}系", font=f, fill=(20, 20, 20),
           anchor="ra", stroke_width=2 * dpr, stroke_fill="white")
    out = f"{ART}/coordinates/{fname}"
    cv.save(out)
    print("写出", out, cv.size, f"柜隙 {g['gap_top']:.0f}/{g['gap_bot']:.0f}")


if __name__ == "__main__":
    se = anchors(40, 0, 112, 1334)
    assert (se["sign1"], round(se["case0"]),
            se["cta1"]) == (226, 264, 1302), se
    for st in ("pushing", "locked", "done"):
        # 2026-10-17 起统一 PNG（小程序不支持 webp）
        out = f"{ART}/prototypes/proto-v3-{st}-750x1334-at2x.png"
        compose(se, 2, st).save(out, quality=90)
        print("写出", out)
    out = f"{ART}/prototypes/proto-v3-swipe-750x1334-at2x.png"
    swipe(se, 2, "done", "pushing", 0.35).save(out, quality=90)
    print("写出", out)
    master(f"{ART}/coordinates/menu-master-coords.png")
    for t, e in zip(TIERS, EXPECT_GAPS):
        tier(*t, e)
