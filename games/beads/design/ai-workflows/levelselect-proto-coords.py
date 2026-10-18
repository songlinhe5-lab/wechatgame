#!/usr/bin/env python3
# 选关弹框原型（3×3 · 9 槽）+ 坐标标注图，同一份合成底图（零模型，纯 PIL）。
# 几何 = arc-level-select-spec.md §3 线框 + meta-view.ts `levelsLayout`/`pushWallCells`（750 设计 px，y 向上）。
# 底图 = final/prototypes/proto-v3 推关中态（主菜单）+ 50% 黑遮罩；面板 = OVERLAY_PLATE 600×720 @(75,307)。
# 状态（用户 2026-10-17 裁定）：锁格 = 灰色褪色图 + 小锁 + 无星；空槽 = 纯虚线空白；BOSS 格 = 锁 + 金边 + 皇冠。
# 示意色/示意图形为占位（关卡图形待美术）；标注单位 = 750 设计 px，坐标 y 向上（与规格一致）。
# 用法（仓库根）：python3 games/beads/design/ai-workflows/levelselect-proto-coords.py
import math
from PIL import Image, ImageDraw, ImageFont

ART = "games/beads/design/art/final"
A = f"{ART}/assets/menu"
# 2026-10-18 webp 退役（小程序不支持 webp ⇒ 现役链零 webp）
BASE = f"{ART}/prototypes/proto-v3-pushing-750x1334-at2x.png"
# 小程序不支持 webp ⇒ 设计/资源图统一 PNG（2026-10-17）
OUT_PROTO = f"{ART}/prototypes/levelselect-v1-popup-750x1334-at2x.png"
OUT_COORDS = f"{ART}/coordinates/levelselect-coords-750x1334-at2x.png"
F_LIGHT = "/System/Library/Fonts/STHeiti Light.ttc"
F_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"

# ── tuning.ts / meta-view.ts 常量（750 系，y 向上）──
DESIGN_W, DESIGN_H = 750, 1334
PLATE_W, PLATE_H = 600, 720                     # OVERLAY_W / OVERLAY_H
PLATE_X = (DESIGN_W - PLATE_W) / 2              # 75
PLATE_Y = (DESIGN_H - PLATE_H) / 2              # 307（y 向上 = 下缘）
# WALL_COLS / WALL_ROWS（规格 v1.3 = 3×3；代码仍 4×3，漂移）
COLS, ROWS = 3, 3
CELL, GAP = 120, 22                             # WALL_CELL / WALL_GAP
GRID_W = COLS * CELL + (COLS - 1) * GAP         # 404
START_X = PLATE_X + (PLATE_W - GRID_W) / 2      # 173
TOP_Y = PLATE_Y + PLATE_H - 170                 # 857（网格上沿）
# THUMB_TOP_INSET / THUMB_STAR_BAND
THUMB_TOP_INSET, THUMB_STAR_BAND = 8, 28
THUMB_AREA = CELL - THUMB_TOP_INSET - THUMB_STAR_BAND   # 84
MATRIX_N = 5                                    # THUMB_MATRIX_N
BACK_W, BACK_H = 240, 88                        # back 按钮（TOUCH_MIN = 88）
BACK_X, BACK_Y = PLATE_X + (PLATE_W - BACK_W) / 2, PLATE_Y + 50   # (255, 357)
TITLE_Y = PLATE_Y + PLATE_H - 50                # 示意位置（规格未定标题 y，仅作版面参考）
SUB_Y = TOP_Y + 52                              # 示意：大关名 [TODO-1]

# 9 格状态（用户定稿的版面示意）：第 9 格 = BOSS（L9 收尾）
# kind: done=已通关（stars 1–3）/ push=推关中（0 星）/ lock=未解锁（无星）/ empty=越界空槽 / boss=BOSS 未解锁
CELLS = [
    ("done", 2, 0), ("push", 0, 1), ("lock", 0, 2),
    ("lock", 0, 3), ("lock", 0, 4), ("lock", 0, 5),
    ("lock", 0, 6), ("lock", 0, 0), ("boss", 0, 1),
]
# 5×5 示意图形（0–5 = 色槽，. = 空）
PATTERNS = {
    0: ["..0..", ".121.", "23432", ".121.", "..0.."],
    1: ["01110", "12221", "12421", "12221", "01110"],
    2: ["..4..", "..4..", "44444", "..4..", "..4.."],
    3: ["0.0.0", "00000", "00000", ".000.", "..0.."],
    4: ["40004", "04440", "00000", "04440", "40004"],
    5: ["50505", "05050", "50505", "05050", "50505"],
    6: ["33333", "3...3", "3.2.3", "3...3", "33333"],
}
COLORS = [(224, 72, 72), (244, 160, 60), (246, 220, 90),
          (110, 190, 110), (80, 140, 220), (160, 110, 210)]
PAPER = (250, 246, 236)
WOOD_EDGE = (94, 59, 30)
SLOT_EDGE = (205, 190, 165)
GOLD = (212, 160, 40)
GREY_FILL = (234, 234, 234)
GREY_INK = (150, 150, 150)
STAR_ON = (240, 180, 40)
STAR_OFF = (175, 175, 175)


def y_down(y_up, h=0):
    """y 向上（下缘）→ 画布 y 向下（上缘）。"""
    return DESIGN_H - (y_up + h)


def cell_origin(r, c):
    """格的下缘左角（y 向上）。"""
    return START_X + c * (CELL + GAP), TOP_Y - CELL - r * (CELL + GAP)


def draw_dashed_rr(d, box, s, color, width):
    """虚线圆角框（示意：四边分段虚线，角用直角近似）。box = 画布 px。"""
    x0, y0, x1, y1 = box
    dash, gap = 10 * s, 7 * s
    for (ax, ay, bx, by) in ((x0, y0, x1, y0), (x1, y0, x1, y1), (x1, y1, x0, y1), (x0, y1, x0, y0)):
        length = math.hypot(bx - ax, by - ay)
        ux, uy = (bx - ax) / length, (by - ay) / length
        t = 0.0
        while t < length:
            e = min(t + dash, length)
            d.line([(ax + ux * t, ay + uy * t), (ax + ux *
                   e, ay + uy * e)], fill=color, width=width)
            t += dash + gap


def star_points(cx, cy, r):
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        rad = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    return pts


def draw_crown(d, cx, cy, w, s, color):
    """皇冠示意：底边 + 三尖。(cx, cy) 为底边中心（画布 px）。"""
    h = w * 0.7
    pts = [(cx - w / 2, cy), (cx - w / 2, cy - h * 0.6), (cx - w / 4, cy - h * 0.3),
           (cx, cy - h), (cx + w / 4, cy - h * 0.3), (cx + w / 2, cy - h * 0.6), (cx + w / 2, cy)]
    d.polygon(pts, fill=color)


def draw_matrix(img, cx, cy, size, pattern, s, faded=False):
    """5×5 珠阵示意。(cx, cy) 为阵中心（画布 px），size 为边长（画布 px）。"""
    d = ImageDraw.Draw(img)
    pitch = size / MATRIX_N
    r = pitch * 0.42
    for j, row in enumerate(pattern):
        for i, ch in enumerate(row):
            if ch == ".":
                continue
            x = cx - size / 2 + (i + 0.5) * pitch
            y = cy - size / 2 + (j + 0.5) * pitch
            col = COLORS[int(ch)]
            if faded:
                g = int(sum(col) / 3)
                col = (g + 150) // 2, (g + 150) // 2, (g + 150) // 2
            d.ellipse([x - r, y - r, x + r, y + r], fill=col)


def draw_ring(img, cx, cy, size, s, faded=False):
    """BOSS 示意图形：一圈彩珠（12 颗）+ 中心一颗金珠。"""
    d = ImageDraw.Draw(img)
    R = size * 0.27
    r = size * 0.07
    for k in range(12):
        ang = k * math.pi / 6
        x, y = cx + R * math.cos(ang), cy + R * math.sin(ang)
        col = COLORS[k % 6] if not faded else (190, 190, 190)
        d.ellipse([x - r, y - r, x + r, y + r], fill=col)
    d.ellipse([cx - r * 1.3, cy - r * 1.3, cx + r * 1.3, cy + r * 1.3],
              fill=GOLD if not faded else (190, 190, 190))


def compose(s, with_base=True):
    """返回 (画布 RGBA, 面板/格几何读数)。s = 画布倍率（当前 2）。"""
    base = Image.open(BASE).convert("RGBA")
    if base.size != (DESIGN_W * s, DESIGN_H * s):
        base = base.resize((DESIGN_W * s, DESIGN_H * s), Image.LANCZOS)
    cv = base if with_base else Image.new(
        "RGBA", base.size, (255, 255, 255, 255))
    # 遮罩 rgba(0,0,0,0.5) 全屏
    cv.alpha_composite(Image.new("RGBA", cv.size, (0, 0, 0, 128)))
    d = ImageDraw.Draw(cv)
    # 面板
    px, py = PLATE_X * s, y_down(PLATE_Y, PLATE_H) * s
    d.rounded_rectangle([px, py, px + PLATE_W * s, py + PLATE_H * s], radius=28 * s,
                        fill=PAPER, outline=WOOD_EDGE, width=6 * s)
    # 标题（示意位置）
    f_title = ImageFont.truetype(F_BOLD, 40 * s)
    d.text(((PLATE_X + PLATE_W / 2) * s, y_down(TITLE_Y) * s), "选关", font=f_title,
           fill=(42, 46, 67), anchor="mm")
    f_sub = ImageFont.truetype(F_LIGHT, 26 * s)
    d.text(((PLATE_X + PLATE_W / 2) * s, y_down(SUB_Y) * s), "第 1 大关 · 曼陀罗（占位）", font=f_sub,
           fill=(120, 110, 95), anchor="mm")

    for idx, (kind, stars, pat) in enumerate(CELLS):
        r, c = divmod(idx, COLS)
        x0, yb = cell_origin(r, c)
        bx0, by0 = x0 * s, y_down(yb, CELL) * s
        bx1, by1 = (x0 + CELL) * s, y_down(yb) * s
        cx, cy = (x0 + CELL / 2) * s, y_down(yb) * \
            s - (CELL / 2) * s   # 画布 px 中心
        if kind == "empty":
            draw_dashed_rr(d, (bx0, by0, bx1, by1), s, SLOT_EDGE, 2 * s)
            continue
        boss = kind == "boss"
        locked = kind in ("lock", "boss")
        fill = GREY_FILL if locked else (255, 253, 247)
        edge = GOLD if boss else SLOT_EDGE
        ew = (6 if boss else 2) * s
        d.rounded_rectangle([bx0, by0, bx1, by1], radius=18 *
                            s, fill=fill, outline=edge, width=ew)
        # 缩略区（THUMB_AREA 84，水平居中，距格顶 8，底部留星带 28）
        tcx = cx
        tcy = by0 + (THUMB_TOP_INSET + THUMB_AREA / 2) * s
        tsize = THUMB_AREA * s
        if boss:
            draw_ring(cv, tcx, tcy, tsize, s, faded=True)
            draw_crown(d, tcx, tcy - 27 * s, 22 * s, s, (170, 170, 170))
        elif locked:
            draw_matrix(cv, tcx, tcy, tsize, PATTERNS[pat], s, faded=True)
        else:
            draw_matrix(cv, tcx, tcy, tsize, PATTERNS[pat], s)
        if locked:
            lock = Image.open(f"{A}/ui_menu_badge_locked.png").convert("RGBA")
            lw = 58 * s
            lock = lock.resize((lw, lw), Image.LANCZOS)
            cv.alpha_composite(
                lock, (round(tcx - lw / 2), round(tcy - lw / 2)))
        # 星带（3 颗；锁格无星）
        if not locked:
            band_cy = by1 - (THUMB_STAR_BAND / 2) * s
            for k in range(3):
                sx = cx + (k - 1) * 26 * s
                on = k < stars
                d.polygon(star_points(sx, band_cy, 11 * s),
                          fill=STAR_ON if on else (255, 253, 247), outline=STAR_ON if on else STAR_OFF,
                          width=max(1, s))
        if boss:
            f_boss = ImageFont.truetype(F_BOLD, 16 * s)
            d.text((cx, by1 - (THUMB_STAR_BAND / 2) * s), "BOSS",
                   font=f_boss, fill=(150, 100, 20), anchor="mm")

    # 返回钮
    d.rounded_rectangle([BACK_X * s, y_down(BACK_Y, BACK_H) * s, (BACK_X + BACK_W) * s, y_down(BACK_Y) * s],
                        radius=BACK_H * s / 2, fill=(255, 250, 240), outline=(200, 185, 160), width=2 * s)
    d.text(((BACK_X + BACK_W / 2) * s, y_down(BACK_Y, BACK_H / 2) * s), "返回",
           font=ImageFont.truetype(F_BOLD, 34 * s), fill=(42, 46, 67), anchor="mm")
    return cv


def annotate(cv, s, fs):
    """标注：面板、格框、星带、缩略区、返回钮与读数（坐标 y 向上，单位 750 设计 px）。"""
    d = ImageDraw.Draw(cv, "RGBA")
    f = ImageFont.truetype(F_LIGHT, fs)
    lw = max(1, round(s))

    def rect(x, y_up, w, h, col):
        d.rectangle([x * s, y_down(y_up, h) * s, (x + w) * s,
                    y_down(y_up) * s], outline=col, width=lw)

    def lab(x, y_up, txt, col, anchor="la"):
        d.text((x * s, y_down(y_up) * s), txt, font=f, fill=col, anchor=anchor,
               stroke_width=max(2, fs // 8), stroke_fill=(255, 255, 255))

    blue, red, green, purple, orange, teal, brown = (
        (0, 80, 220), (210, 0, 0), (0, 140, 0), (130, 0, 180), (230, 120, 0), (0, 130, 130), (140, 80, 20))
    rect(PLATE_X, PLATE_Y, PLATE_W, PLATE_H, blue)
    lab(PLATE_X + 4, PLATE_Y + PLATE_H - 4,
        f"OVERLAY_PLATE 600×720 @({PLATE_X:.0f},{PLATE_Y:.0f})", blue, "ld")
    lab(PLATE_X + PLATE_W / 2, TITLE_Y + 30, "标题「选关」 示意位（规格未定）", brown, "ma")
    lab(PLATE_X + PLATE_W / 2, SUB_Y - 22, "大关名 [TODO-1] 示意", brown, "ma")

    for idx, (kind, stars, pat) in enumerate(CELLS):
        r, c = divmod(idx, COLS)
        x0, yb = cell_origin(r, c)
        col = purple if kind == "boss" else (
            red if kind == "empty" else (orange if kind == "lock" else teal))
        rect(x0, yb, CELL, CELL, col)
        rect(x0 + (CELL - THUMB_AREA) / 2, yb +
             THUMB_STAR_BAND, THUMB_AREA, THUMB_AREA, green)
        if kind != "empty":
            rect(x0 + 8, yb + 6, CELL - 16, THUMB_STAR_BAND - 6, green)
        tag = {"done": f"通关{stars}★", "push": "推关 0★", "lock": "锁·无星",
               "empty": "空槽·虚线", "boss": "BOSS·锁"}[kind]
        lab(x0 + 3, yb + CELL + 2, f"[{r},{c}] {tag}", col)
        lab(x0 + 3, yb + CELL + 22, f"({x0:.0f},{yb:.0f})", col)

    # 格间距与网格
    rect(START_X, TOP_Y - (ROWS * CELL + (ROWS - 1) * GAP),
         GRID_W, ROWS * CELL + (ROWS - 1) * GAP, purple)
    lab(START_X + CELL + GAP / 2 - 4, TOP_Y -
        CELL - GAP / 2 - 12, "22", red, "ma")

    # 返回钮
    rect(BACK_X, BACK_Y, BACK_W, BACK_H, green)
    lab(BACK_X, BACK_Y - 6,
        f"back 240×88 @({BACK_X:.0f},{BACK_Y:.0f})", green, "lt")
    return d, f


def legend(d, f, x, y, rows):
    yy = y
    for txt, size, col in rows:
        if txt:
            d.text((x, yy), txt, font=ImageFont.truetype(
                F_LIGHT, size), fill=col)
        yy += size + 14


def main():
    s = 2
    cv = compose(s)
    legend_w = 380
    canvas = Image.new("RGB", ((DESIGN_W + legend_w) *
                       s, DESIGN_H * s), (255, 255, 255))
    canvas.paste(cv.convert("RGB"), (0, 0))
    ann_layer = canvas.convert("RGBA")
    d, f = annotate(ann_layer, s, 20)
    canvas = ann_layer.convert("RGB")
    d = ImageDraw.Draw(canvas)
    rows = [
        ("选关弹框 3×3 坐标图", 30, (0, 0, 0)),
        ("坐标 y 向上 · 单位 750 设计 px", 22, (80, 80, 80)),
        ("底图 = 原型 v3 推关态（主菜单）+ 50% 遮罩", 22, (80, 80, 80)),
        ("面板 = OVERLAY_PLATE 600×720 @(75,307)", 22, (80, 80, 80)),
        ("", 22, None),
        ("格几何（WALL_CELL 120 · GAP 22）：", 26, (0, 130, 0)),
        (f"网格宽 404 · startX {START_X:.0f} · topY {TOP_Y:.0f}",
         22, (20, 20, 20)),
        ("行 0 上沿 857 · 行 2 下沿 453（行距 142）", 22, (20, 20, 20)),
        ("缩略区 84 见方（距格顶 8，居中）", 22, (20, 20, 20)),
        ("星带 28 在格底（3 颗，锁格无星）", 22, (20, 20, 20)),
        ("", 22, None),
        ("格状态（本图 = 用户定稿示意）：", 26, (130, 0, 180)),
        ("已通关：彩色珠阵 + 1–3 金星", 22, (20, 20, 20)),
        ("推关中：彩色珠阵 + 3 空星（0★）", 22, (20, 20, 20)),
        ("未解锁（锁格）：灰褪珠阵 + 小锁 + 无星", 22, (20, 20, 20)),
        ("空槽：纯虚线框、内部空白", 22, (20, 20, 20)),
        ("BOSS（第 9 格）：金边 + 皇冠 + 彩珠圈 + 锁", 22, (20, 20, 20)),
        ("", 22, None),
        ("! ⚠ 与规格 §4 冲突（Q15，待裁）：", 22, (220, 0, 0)),
        ("  规格「未解锁 = 虚线空槽」；本图按用户指令", 22, (220, 0, 0)),
        ("  锁格 = 灰图+锁，空槽 = 纯虚线（两者分形）", 22, (220, 0, 0)),
        ("! BOSS 格尺寸：规格未定，本图同 120 格", 22, (220, 0, 0)),
        ("! 标题位置 / 大关名：示意，规格未定", 22, (220, 0, 0)),
        ("! 关卡图形为占位，待美术", 22, (220, 0, 0)),
        ("", 22, None),
        ("■ 蓝 面板 · 绿 缩略/星带/返回 · 青 已通关/推关", 22, (60, 60, 60)),
        ("■ 橙 锁格 · 红 空槽 · 紫 BOSS/网格", 22, (60, 60, 60)),
        ("", 22, None),
        ("! 本图只标注，不驱动运行时（真源 tuning.ts + 规格 §3）", 22, (220, 0, 0)),
        ("! 代码仍 4×3（WALL_COLS = 4），本图按 3×3 规格出", 22, (220, 0, 0)),
    ]
    legend(d, f, (DESIGN_W + 14) * s, 20, rows)

    # 干净底图（不带标注）
    proto = compose(s).convert("RGB")
    proto.save(OUT_PROTO, "PNG", optimize=True)
    canvas.save(OUT_COORDS)
    print("写出", OUT_PROTO, proto.size)
    print("写出", OUT_COORDS, canvas.size)


if __name__ == "__main__":
    main()
