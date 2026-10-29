#!/usr/bin/env python3
# 选关弹窗（版式 Q）原型 + 坐标标注图，同一份合成底图（零模型，纯 PIL）。
# 版面真源 = `design/ux/level-select-page-layout.md` **v0.7 §2A** + `tuning/menu.ts`
# （格 = `WALL_CELL` 120 / 距 = `WALL_GAP` 22 / 缩略 = `THUMB_AREA` 84）+ `meta-layout.ts::levelsPanelMetrics`
# （板 600×720 @75,307；网格左缘 173 / 上沿 861；返回 240×88 @357；章名+星进度同行 925；判星 885）。
# `[WXG-T-503]` 用户 2026-10-29 改判回弹窗（旧整页版式 P 已作废）。
# 状态（2026-10-17 定稿 + 2026-10-23 判星行 + 2026-10-28 图鉴/本地榜入口）：
#   已通关 = 彩珠缩略 + 1–3 金星；推关中 = 彩珠缩略 + 0★；未解锁/越界 = 灰褪 + 小锁 + 无星；
#   当前关 = 4px 主色描边；BOSS = 金边 6px + 皇冠 + 珠圈 + 锁。
# 示意色/图形为占位（真图 = 珠拼缩略）；本图只标注，不驱动运行时。
# 用法（仓库根）：python3 games/beads/design/ai-workflows/levelselect-proto-coords.py
import math
from PIL import Image, ImageDraw, ImageFont

ART = "games/beads/design/art/final"
A = f"{ART}/assets/menu"
BASE = f"{ART}/prototypes/proto-v3-pushing-750x1334-at2x.png"
OUT_PROTO = f"{ART}/prototypes/levelselect-v1-popup-750x1334-at2x.png"
OUT_COORDS = f"{ART}/coordinates/levelselect-coords-750x1334-at2x.png"
F_LIGHT = "/System/Library/Fonts/STHeiti Light.ttc"
F_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"

# ── tuning/menu.ts + meta-layout.ts 常量（750 系，y 向上）──
DESIGN_W, DESIGN_H = 750, 1334
PLATE_W, PLATE_H = 600, 720
PLATE_X, PLATE_Y = (DESIGN_W - PLATE_W) / 2, (DESIGN_H - PLATE_H) / 2   # 75 / 307
COLS, ROWS = 3, 3
CELL, GAP = 120, 22                              # WALL_CELL / WALL_GAP
GRID_W = COLS * CELL + (COLS - 1) * GAP          # 404
GRID_H = ROWS * CELL + (ROWS - 1) * GAP          # 404
GRID_LEFT = PLATE_X + (PLATE_W - GRID_W) / 2     # 173
BACK_W, BACK_H = 240, 88
BACK_Y = PLATE_Y + 50                            # 357
GRID_TOP = BACK_Y + BACK_H + 12 + GRID_H         # 861
TITLE_CY = PLATE_Y + PLATE_H - 50                # 977
CHAP_CY = GRID_TOP + 64                          # 925
PROG_CY = CHAP_CY                                # 925（与章名同行）
CRIT_CY = GRID_TOP + 24                          # 885
THUMB_TOP_INSET, THUMB_STAR_BAND = 8, 28
THUMB_AREA = CELL - THUMB_TOP_INSET - THUMB_STAR_BAND   # 84

BG = (241, 232, 216)                             # palette.background #F1E8D8
INK = (42, 46, 67)                               # palette.text
INK_DIM = (110, 114, 136)                        # palette.textDim
PAPER = (255, 253, 247)
WOOD_EDGE = (94, 59, 30)
SLOT_EDGE = (205, 190, 165)
GOLD = (212, 160, 40)
GREY_FILL = (234, 234, 234)
STAR_ON = (240, 180, 40)
STAR_OFF = (175, 175, 175)
ACCENT = (217, 106, 74)                          # 当前关描边（示意）

# 9 格状态（云端基底：2★ / 0★ 推关 / 锁×6 / BOSS）
# kind: done=已通关 / push=推关中（当前关）/ lock=未解锁或越界 / boss=BOSS 未解锁
CELLS = [
    ("done", 2, 0), ("lock", 0, 1), ("lock", 0, 2),
    ("lock", 0, 3), ("push", 0, 4), ("lock", 0, 5),
    ("lock", 0, 6), ("lock", 0, 1), ("boss", 0, 0),
]
CURRENT_CELL = 4
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
MATRIX_N = 5


def y_down(y_up, h=0):
    """y 向上（下缘）→ 画布 y 向下（上缘）。"""
    return DESIGN_H - (y_up + h)


def cell_origin(r, c):
    """格的下缘左角（y 向上）。"""
    return GRID_LEFT + c * (CELL + GAP), GRID_TOP - CELL - r * (CELL + GAP)


def star_points(cx, cy, r):
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        rad = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    return pts


def draw_crown(d, cx, cy, w, color):
    """皇冠示意：底边 + 三尖。(cx, cy) 为底边中心（画布 px）。"""
    h = w * 0.7
    pts = [(cx - w / 2, cy), (cx - w / 2, cy - h * 0.6), (cx - w / 4, cy - h * 0.3),
           (cx, cy - h), (cx + w / 4, cy - h * 0.3), (cx + w / 2, cy - h * 0.6), (cx + w / 2, cy)]
    d.polygon(pts, fill=color)


def draw_matrix(d, cx, cy, size, pattern, faded=False):
    """5×5 盘面示意（`[WXG-T-502]` 平涂化：纯色方块，不画珠子描边/体积）。(cx, cy) 为阵中心（画布 px）。"""
    pitch = size / MATRIX_N
    half = pitch * 0.42
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
            d.rectangle([x - half, y - half, x + half, y + half], fill=col)


def draw_ring(d, cx, cy, size, faded=False):
    """BOSS 盘面示意：一圈彩块（12 枚）+ 中心一块金块（同 T-502 平涂口径）。"""
    R = size * 0.27
    half = size * 0.045
    for k in range(12):
        ang = k * math.pi / 6
        x, y = cx + R * math.cos(ang), cy + R * math.sin(ang)
        col = COLORS[k % 6] if not faded else (190, 190, 190)
        d.rectangle([x - half, y - half, x + half, y + half], fill=col)
    g = half * 1.3
    d.rectangle([cx - g, cy - g, cx + g, cy + g],
                fill=GOLD if not faded else (190, 190, 190))


def draw_button(d, s, x, y_up, w, label):
    top = y_down(y_up, BACK_H) * s
    bottom = y_down(y_up) * s
    d.rounded_rectangle([x * s, top, (x + w) * s, bottom], radius=BACK_H * s / 2,
                        fill=(255, 250, 240), outline=(200, 185, 160), width=2 * s)
    d.text(((x + w / 2) * s, (top + bottom) / 2), label,
           font=ImageFont.truetype(F_BOLD, 34 * s), fill=INK, anchor="mm")


def compose(s):
    """返回选关弹窗（无标注）。s = 画布倍率（当前 2）。"""
    cv = Image.open(BASE).convert("RGBA")
    if cv.size != (DESIGN_W * s, DESIGN_H * s):
        cv = cv.resize((DESIGN_W * s, DESIGN_H * s), Image.LANCZOS)
    # 弹窗遮罩（= UI_SCRIM.alpha 0.5）
    cv.alpha_composite(Image.new("RGBA", cv.size, (0, 0, 0, 128)))
    d = ImageDraw.Draw(cv)
    f_title = ImageFont.truetype(F_BOLD, 40 * s)
    f_chap = ImageFont.truetype(F_BOLD, 30 * s)
    f_sub = ImageFont.truetype(F_LIGHT, 28 * s)

    # 纸面板
    px, py = PLATE_X * s, y_down(PLATE_Y, PLATE_H) * s
    d.rounded_rectangle([px, py, px + PLATE_W * s, py + PLATE_H * s], radius=28 * s,
                        fill=PAPER, outline=WOOD_EDGE, width=6 * s)
    # 标题 / 章名+星进度（同行） / 判星对照
    d.text((DESIGN_W / 2 * s, y_down(TITLE_CY) * s), "选关", font=f_title, fill=INK, anchor="mm")
    d.text((DESIGN_W / 2 * s, y_down(CHAP_CY) * s), "曼陀罗",
           font=f_chap, fill=INK, anchor="mm")
    d.text(((PLATE_X + PLATE_W - 40) * s, y_down(PROG_CY) * s), "★ 2/9",
           font=f_sub, fill=INK_DIM, anchor="rm")
    d.text((DESIGN_W / 2 * s, y_down(CRIT_CY) * s), "3★ 用时 ≤ 03:30  ｜  2★ 用时 ≤ 05:00",
           font=f_sub, fill=INK_DIM, anchor="mm")

    for idx, (kind, stars, pat) in enumerate(CELLS):
        r, c = divmod(idx, COLS)
        x0, yb = cell_origin(r, c)
        locked = kind in ("lock", "boss")
        boss = kind == "boss"
        current = idx == CURRENT_CELL
        top = y_down(yb, CELL) * s
        bottom = y_down(yb) * s
        left, right = x0 * s, (x0 + CELL) * s
        fill = GREY_FILL if locked else PAPER
        edge = GOLD if boss else (ACCENT if current else SLOT_EDGE)
        ew = (6 if boss else (4 if current else 2)) * s
        d.rounded_rectangle([left, top, right, bottom], radius=18 * s,
                            fill=fill, outline=edge, width=ew)
        # 缩略区 84：占格中上部（星带 28 在格底、顶留 8）
        tcx = (x0 + CELL / 2) * s
        tcy = y_down(yb + THUMB_STAR_BAND + THUMB_AREA / 2) * s
        tsize = THUMB_AREA * s
        if boss:
            draw_ring(d, tcx, tcy, tsize, faded=True)
            draw_crown(d, tcx, tcy - THUMB_AREA * 0.22 * s, 22 * s, (170, 170, 170))
        else:
            draw_matrix(d, tcx, tcy, tsize, PATTERNS[pat], faded=locked)
        if locked:
            lock = Image.open(f"{A}/ui_menu_badge_locked.png").convert("RGBA")
            lw = 52 * s
            lock = lock.resize((lw, lw), Image.LANCZOS)
            cv.alpha_composite(lock, (round(tcx - lw / 2), round(tcy - lw / 2)))
        # 星带 28（锁格无星）
        if not locked:
            band_cy = y_down(yb + THUMB_STAR_BAND / 2) * s
            for k in range(3):
                sx = tcx + (k - 1) * 26 * s
                on = k < stars
                d.polygon(star_points(sx, band_cy, 10 * s),
                          fill=STAR_ON if on else PAPER, outline=STAR_ON if on else STAR_OFF,
                          width=max(1, s))
        if boss:
            d.text((tcx, y_down(yb + THUMB_STAR_BAND / 2) * s), "BOSS",
                   font=ImageFont.truetype(F_BOLD, 14 * s), fill=(150, 100, 20), anchor="mm")

    # 返回（板内，居中）
    draw_button(d, s, (DESIGN_W - BACK_W) / 2, BACK_Y, BACK_W, "返回")
    return cv


def annotate(cv, s, fs):
    """标注：纸面板 / 网格 / 两行信息 / 返回（坐标 y 向上）。"""
    d = ImageDraw.Draw(cv, "RGBA")
    f = ImageFont.truetype(F_LIGHT, fs)
    lw = max(1, round(s))

    def rect(x, y_up, w, h, col):
        d.rectangle([x * s, y_down(y_up, h) * s, (x + w) * s, y_down(y_up) * s],
                    outline=col, width=lw)

    def lab(x, y_up, txt, col, anchor="la"):
        d.text((x * s, y_down(y_up) * s), txt, font=f, fill=col, anchor=anchor,
               stroke_width=max(2, fs // 8), stroke_fill=(255, 255, 255))

    blue, red, green, purple, orange, teal, brown = (
        (0, 80, 220), (210, 0, 0), (0, 140, 0), (130, 0, 180), (230, 120, 0), (0, 130, 130), (140, 80, 20))
    # 纸面板
    rect(PLATE_X, PLATE_Y, PLATE_W, PLATE_H, blue)
    lab(PLATE_X + 4, PLATE_Y + PLATE_H - 4, "板 600×720 @(75,307) · 遮罩 α0.5", blue, "ld")
    lab(DESIGN_W / 2, TITLE_CY + 30, "标题「选关」 y=977", brown, "ma")
    # 两行信息
    for y_up, txt in ((CHAP_CY, f"章名 + 星进度 {CHAP_CY:.0f}（同行）"), (CRIT_CY, f"判星对照 {CRIT_CY:.0f}")):
        d.line([(PLATE_X + 24 * s, y_down(y_up) * s), ((PLATE_X + PLATE_W - 24) * s, y_down(y_up) * s)],
               fill=(120, 140, 200, 120), width=1)
        lab(PLATE_X + PLATE_W + 8, y_up + 4, txt, blue, "la")
    # 网格（参数读数已在右侧规范栏，画布内不重复标注）
    rect(GRID_LEFT, GRID_TOP - GRID_H, GRID_W, GRID_H, purple)
    for c in range(COLS):
        x = GRID_LEFT + c * (CELL + GAP)
        lab(x + CELL / 2, GRID_TOP + 6, f"x{int(x)}", blue, "ma")
    for r in range(ROWS):
        y_top = GRID_TOP - r * (CELL + GAP)
        lab(GRID_LEFT - 8, y_top - 8, f"y{int(y_top)}", blue, "ra")
    # 逐格框
    for idx, (kind, stars, pat) in enumerate(CELLS):
        r, c = divmod(idx, COLS)
        x0, yb = cell_origin(r, c)
        col = purple if kind == "boss" else (orange if kind == "lock" else teal)
        rect(x0, yb, CELL, CELL, col)
        rect(x0, yb + THUMB_STAR_BAND, CELL, THUMB_AREA, green)
        rect(x0, yb, CELL, THUMB_STAR_BAND, green)
    # 返回
    rect((DESIGN_W - BACK_W) / 2, BACK_Y, BACK_W, BACK_H, green)
    lab(PLATE_X + 4, BACK_Y - 18, "返回 240×88 @ y=357（板底 +50）", green)
    return d, f


def legend(d, _f, x, y, rows):
    yy = y
    for txt, size, col in rows:
        if txt:
            d.text((x, yy), txt, font=ImageFont.truetype(F_LIGHT, size), fill=col)
        yy += size + 14


def main():
    s = 2
    cv = compose(s)
    legend_w = 400
    canvas = Image.new("RGB", ((DESIGN_W + legend_w) * s, DESIGN_H * s), (255, 255, 255))
    canvas.paste(cv.convert("RGB"), (0, 0))
    ann_layer = canvas.convert("RGBA")
    d, f = annotate(ann_layer, s, 20)
    canvas = ann_layer.convert("RGB")
    d = ImageDraw.Draw(canvas)
    rows = [
        ("选关弹窗 3×3 坐标图（版式 Q）", 30, (0, 0, 0)),
        ("坐标 y 向上 · 单位 750 设计 px", 22, (80, 80, 80)),
        ("弹窗 600×720 @75,307 · 遮罩 α0.5（叠主菜单）", 22, (80, 80, 80)),
        ("", 22, None),
        ("版面（meta-layout.ts::levelsPanelMetrics）：", 26, (0, 130, 0)),
        (f"网格 3×3 · 格 {CELL} · 间距 {GAP} · 左缘 {GRID_LEFT} · 上沿 {GRID_TOP}", 22, (20, 20, 20)),
        (f"缩略 {THUMB_AREA}（距格顶 {THUMB_TOP_INSET}）· 星带 {THUMB_STAR_BAND} 在格底", 22, (20, 20, 20)),
        (f"章名 + 星进度 同行 y={CHAP_CY:.0f}（进度右对齐 x=635）", 22, (20, 20, 20)),
        (f"判星对照 y={CRIT_CY:.0f}（与结算共读 starCriteriaText）", 22, (20, 20, 20)),
        (f"返回 {BACK_W}×{BACK_H} @x255, y{BACK_Y}（板底 +50）", 22, (20, 20, 20)),
        ("", 22, None),
        ("格状态（本图 = 定稿示意）：", 26, (130, 0, 180)),
        ("已通关：盘面色块 + 1–3 金星", 22, (20, 20, 20)),
        ("推关中：盘面色块 + 0★（当前关 = 4px 主色描边）", 22, (20, 20, 20)),
        ("未解锁 / 越界：灰褪盘面 + 小锁 + 无星（Q15 已合形）", 22, (20, 20, 20)),
        ("BOSS（第 9 格）：金边 6px + 皇冠 + 珠圈 + 锁", 22, (20, 20, 20)),
        ("", 22, None),
        ("! 弹窗形态：格 120 / 缩略 84（T-503 改判；旧整页 170/134 作废）", 22, (220, 0, 0)),
        ("! 缩略只画盘面（T-502 平涂化），不展示珠子样式", 22, (220, 0, 0)),
        ("", 22, None),
        ("■ 蓝 板/两行 · 绿 格/缩略/星带/返回", 22, (60, 60, 60)),
        ("■ 紫 网格/BOSS · 青 已通关/推关 · 橙 锁格", 22, (60, 60, 60)),
        ("", 22, None),
        ("! 本图只标注，不驱动运行时（真源 tuning.ts + 规格 v0.7 §2A）", 22, (220, 0, 0)),
    ]
    legend(d, f, (DESIGN_W + 14) * s, 20, rows)

    proto = compose(s).convert("RGB")
    proto.save(OUT_PROTO, "PNG", optimize=True)
    canvas.save(OUT_COORDS)
    print("写出", OUT_PROTO, proto.size)
    print("写出", OUT_COORDS, canvas.size)


if __name__ == "__main__":
    main()
