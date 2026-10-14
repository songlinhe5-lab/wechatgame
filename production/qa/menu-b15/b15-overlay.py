"""第十五批 · 叠加对位图：原稿实测框 vs 运行时现装框。

底图 = v1-mainmenu-final.png（1520x2736，**未改**）按宽缩到设计 750 ⇒ 高 1350（比 1334 多 16）。
画布 = 设计 px × SCALE；青虚线 = 原稿实测；红半透明 = 运行时现装（tier 161）；橙 = 稿上无、按裁定删。
"""
from PIL import Image, ImageDraw, ImageFont

SRC = 'games/beads/design/art/shots/menu-showcase-20261010/v1-mainmenu-final.png'
OUT = 'temp/b15-overlay.png'
SCALE = 1.6
PAGE_W = int(750 * SCALE)          # 1200
PAGE_H = int(1350 * SCALE)         # 2160（稿按宽缩放后的真实高）
STRIP = 660
DESIGN_H = 1334

MOCK = {
    'board': (208.2, 91.8, 541.8, 215.6),
    'case': (106.6, 247.2, 651.3, 1154.6),
    'plaque': (286.7, 953.3, 474.2, 1035.7),
    'cta': (217.6, 1204.4, 542.3, 1293.8),
    'arrowL': (24.2, 658.7, 83.4, 709.5),
    'arrowR': (666.6, 658.7, 733.2, 709.0),
}
MOCK_CIRCLES = [(569.2, 60.7, 55.3), (639.5, 60.4, 55.8), (709.8, 60.4, 56.2)]
RUN_BOXES = [
    ('招牌珠拼带 660x120', 45, 262, 705, 382, 'run'),
    ('走马灯卡 300x340', 225, 474, 525, 814, 'run'),
    ('CTA 320x88', 215, 886, 535, 974, 'run'),
    ('门楣价目牌 450x38', 150, 462, 600, 500, 'cut'),
    ('slogan 中心394', 275, 380, 475, 408, 'cut'),
    ('版本号 中心1194', 300, 1180, 450, 1208, 'cut'),
]
RUN_CIRCLES = [(68, 175.5, 234.5), (604, 175.5, 234.5), (692, 175.5, 234.5)]

CYAN, RED, ORANGE, YELLOW, INK = (0, 168, 200), (214, 40, 40), (232, 140, 0), (214, 170, 0), (40, 34, 28)

F = F2 = FB = None
for p in ('/System/Library/Fonts/PingFang.ttc', '/System/Library/Fonts/STHeiti Medium.ttc'):
    try:
        F = ImageFont.truetype(p, 22)
        F2 = ImageFont.truetype(p, 19)
        FB = ImageFont.truetype(p, 16)
        break
    except OSError:
        continue


def X(v):
    return v * SCALE


def Y(v):
    return v * SCALE


def dashed(dr, box, color, w=3, dash=12, gap=8):
    x0, y0, x1, y1 = X(box[0]), Y(box[1]), X(box[2]), Y(box[3])
    for a0, b0, a1, b1 in ((x0, y0, x1, y0), (x0, y1, x1, y1), (x0, y0, x0, y1), (x1, y0, x1, y1)):
        total = abs(a1 - a0) + abs(b1 - b0)
        if total == 0:
            continue
        ux, uy = (a1 - a0) / total, (b1 - b0) / total
        t = 0
        while t < total:
            e = min(t + dash, total)
            dr.line((a0 + ux * t, b0 + uy * t, a0 + ux * e, b0 + uy * e), fill=color, width=w)
            t = e + dash + gap


base = Image.open(SRC).convert('RGB').resize((PAGE_W, PAGE_H), Image.LANCZOS)
cv = Image.new('RGB', (PAGE_W + STRIP, PAGE_H), (248, 245, 240))
cv.paste(base, (0, 0))
dr = ImageDraw.Draw(cv, 'RGBA')

def label_at(x, y, txt, col, anchor='la'):
    """把标注推到画内并避开右边界（anchor: la=左上角 / ra=右上角）。"""
    wpx = dr.textlength(txt, font=FB)
    if anchor == 'ra':
        x = min(x, PAGE_W - wpx - 6)
    else:
        x = max(6, min(x, PAGE_W - wpx - 6))
    dr.text((x, max(2, y)), txt, font=FB, fill=col)


# ① 安全带 / 1334 线
dr.rectangle((0, 0, PAGE_W, Y(120)), fill=(255, 220, 0, 42))
dr.line((0, Y(120), PAGE_W, Y(120)), fill=YELLOW, width=3)
dr.text((8, Y(120) + 6), '安全带上界 120（刘海/挖空）', font=FB, fill=(120, 92, 0))
dr.line((0, Y(DESIGN_H), PAGE_W, Y(DESIGN_H)), fill=(150, 40, 150), width=3)
dr.text((8, Y(DESIGN_H) + 6), '设计高 1334（稿按宽缩放 = 1350 -> 溢出 16）', font=FB, fill=(120, 30, 120))

# ② 原稿实测框
for name, b in MOCK.items():
    dashed(dr, b, CYAN)
    label_at(X(b[0]) + 4, Y(b[1]) - 26, f'稿·{name} x[{b[0]:.0f},{b[2]:.0f}] y[{b[1]:.0f},{b[3]:.0f}]', CYAN)
for i, (cx, cy, d) in enumerate(MOCK_CIRCLES):
    dr.ellipse((X(cx - d / 2), Y(cy - d / 2), X(cx + d / 2), Y(cy + d / 2)), outline=CYAN, width=3)
    # 稿位上套 88 热区（TOUCH_MIN）⇒ 相邻互叠，证据画在图上
    dr.rectangle((X(cx - 44), Y(cy - 44), X(cx + 44), Y(cy + 44)), outline=RED, width=2)
label_at(X(541), Y(28), '稿·三颗 x 541→738 自顶 33-88', CYAN)
label_at(X(430), Y(152), '稿位套 88 热区（红框）-> 相邻互叠 18 px，且整颗在安全带内', RED)

# ③ 运行时现装
for name, x0, y0, x1, y1, kind in RUN_BOXES:
    col = RED if kind == 'run' else ORANGE
    dr.rectangle((X(x0), Y(y0), X(x1), Y(y1)), fill=col + (46,), outline=col, width=3)
    lx = X(x1) + 8 if name.startswith('版本号') else X(x0) + 5
    dr.text((lx, Y(y0) + 3), name, font=FB, fill=col)
for cx, ty, by in RUN_CIRCLES:
    dr.ellipse((X(cx - 29.5), Y(ty), X(cx + 29.5), Y(by)), fill=RED + (46,), outline=RED, width=3)
    dr.rectangle((X(cx - 44), Y(ty - 4.5), X(cx + 44), Y(by + 4.5)), outline=RED, width=1)
label_at(X(120), Y(270), '现装·顶栏三颗 x 68/604/692 自顶 175.5-234.5（tier161，细框=88 热区）', RED)

# ④ 对照连线：稿 CTA ↔ 现装 CTA
dr.line((X(380), Y(1249), X(375), Y(930)), fill=RED, width=2)

# ⑤ 右侧图例
sx = PAGE_W + 24
lines = [
    (F, '第十五批 · 主菜单「按稿重排」对位图', INK),
    (FB, '底图 = v1-mainmenu-final.png（原稿，未改）×0.4934 → 设计 750 宽', (90, 80, 70)),
    (F2, '青虚线 = 原稿实测   红 = 运行时现装   橙 = 稿上没有（裁定删）', INK),
    (F2, '—— 逐元素差值（设计 px）——', INK),
    (FB, '招牌  稿板 x[208,542] 宽 334 / 自顶 92–216', INK),
    (FB, '        现装珠拼带 x[45,705] 宽 660 / 自顶 262-382', RED),
    (FB, '        -> 宽 +326（1.98 倍）· 整体下移 ≈166', RED),
    (FB, '顶栏  稿三颗全在右 x[541,738] 自顶 33-88（整颗在安全带内）', INK),
    (FB, '        现装 左1右2 cx 68/604/692 自顶 175.5-234.5', RED),
    (FB, '橱窗  稿 x[107,651] 自顶 247-1155（545 × 908）', INK),
    (FB, '        现装走马灯卡 x[225,525] 自顶 474-814（300 × 340）', RED),
    (FB, '        -> 面积 49.5 万 vs 10.2 万 ≈ 4.9 倍', RED),
    (FB, '箭头  稿 2 颗 中心 x 54 / 700 自顶 684（Ø≈53/60）', INK),
    (FB, '        现装 0 颗（src 内无 prev/next 图元与热区）', RED),
    (FB, '柜内牌 稿 x[287,474] 自顶 953-1036（188 × 82）', INK),
    (FB, '        现装无对应物', RED),
    (FB, 'CTA   稿 x[218,542] 自顶 1204-1294（325 × 89）', INK),
    (FB, '        现装 x[215,535] 自顶 886-974（320 × 88）', RED),
    (FB, '        -> 尺寸差 <2%，位置需下移 318', RED),
    (FB, '删除  门楣价目牌（现装自顶 462-500）· slogan（394）· 版本号（1194）', ORANGE),
    (F2, '—— 开工前必须裁的三件 ——', INK),
    (FB, '① 稿按宽缩放后高 1350 > 设计 1334 -> 多 16 px，压在哪一段？', RED),
    (FB, '② 稿的招牌 = 木板 + 板内珠拼字（字宽 ≤ 337）；现装字带 660 宽', RED),
    (FB, '    -> 要么接位图 A2、要么把 SIGN 档从 n·d=120 降到 ≈55（美术规格）', RED),
    (FB, '③ 顶栏三颗：稿 pitch 70.3 < 热区 88 -> 互叠 18 px，且 y 33-88 在安全带内', RED),
    (FB, '    -> 三颗全右需占 x[462,726]（圆心 506/594/682，贴右 24）；或维持现装「左1右2」', RED),
]
y = 24
for fnt, txt, col in lines:
    dr.text((sx, y), txt, font=fnt, fill=col)
    y += fnt.size + 9

cv.save(OUT)
print(OUT, cv.size)
