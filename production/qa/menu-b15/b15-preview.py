"""第十五批 · 按 8 条裁定合成「改版效果图」（v2）。

输入 = 原稿 v1-mainmenu-final.png（1520x2736，**不改**）+ assets/menu/ui_menu_logo.png（960x622）。
画布 = 1500x2668（设计 750x1334 @2x）。稿按宽缩放后高 1350 ⇒ 溢出 16 设计 px。

下刀处 = **屏底空白带**（CTA 底缘 1293.8 以下到 1350 有 56.2 设计 px 纯背景）：
从这条空白里切掉 32 画布 px ⇒ 所有元素保持稿位、零形变，只让底部余量 40.2 -> 24.2。

步骤：① 缩放 + 压屏底空白 ② 几何擦稿上右上三颗 ③ 矩形行中位色擦橱窗内花盘
      ④ 稿上箭头整体下移到「橱窗高度居中」 ⑤ 贴位图招牌 ⑥ 运行时标注层 ⑦ 图例（含 9-slice 原理小图）
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC = 'games/beads/design/art/shots/menu-showcase-20261010/v1-mainmenu-final.png'
LOGO = 'games/beads/assets/menu/ui_menu_logo.png'
OUT = 'temp/b15-preview.png'
S = 750 / 1520.0
K = 1500 / 1520.0
CUT = 32                      # 画布 px = 16 设计 px
FONT = '/System/Library/Fonts/PingFang.ttc'


def D(v):
    """设计 px -> 画布 px（@2x，元素一律保持稿位，无 shift）。"""
    return int(round(v * 2))


# ───────────────────────────── ① 缩放 + 压屏底空白带
big = Image.open(SRC).convert('RGB').resize((1500, 2700), Image.LANCZOS)
BAND0, BAND1 = D(1296), 2700          # 纯背景带（CTA 底缘与其投影之下）
bh = BAND1 - BAND0
assert bh > CUT * 2, bh
_bs = np.asarray(big.crop((0, BAND0, 1500, BAND1))).astype(np.int16)
print('空白带行内最大色差', int(_bs.max(axis=(1, 2)).min() - _bs.min(axis=(1, 2)).max()), '（应接近 0）')
cv = Image.new('RGB', (1500, 2668), (250, 247, 240))
cv.paste(big.crop((0, 0, 1500, BAND0)), (0, 0))
cv.paste(big.crop((0, BAND0, 1500, BAND1)).resize((1500, bh - CUT), Image.LANCZOS), (0, BAND0))
print(f'压屏底空白带 画布 y[{BAND0},{BAND1}] 高 {bh} -> {bh - CUT}')


def median_fill(img_arr, mask, pool_x, passes=3, dil=5):
    """mask 内像素 <- 同行、pool_x 窗内未遮像素的中位色（⛔ 硬擦矩形会啃相邻元素）。"""
    a = img_arr
    m = mask.copy()
    for _ in range(passes):
        ys, xs = np.where(m)
        for y in np.unique(ys):
            pool = np.where(~m[y])[0]
            pool = pool[(pool >= pool_x[0]) & (pool < pool_x[1])]
            if len(pool) < 30:
                continue
            a[y, np.where(m[y])[0]] = np.median(a[y, pool], axis=0)
        mm = np.zeros_like(m)
        mm[ys, xs] = True
        m = np.asarray(Image.fromarray((mm * 255).astype(np.uint8))
                       .filter(ImageFilter.MaxFilter(dil))) > 127
    return a


# ───────────────────────────── ② 擦稿上右上三颗（几何：圆盘 + 投影）
A = np.asarray(cv).astype(np.int16)
H, W = A.shape[:2]
m = np.zeros((H, W), bool)
yy, xx = np.mgrid[0:H, 0:W]
for cx, cy, dd in [(569.2, 60.7, 55.3), (639.5, 60.4, 55.8), (709.8, 60.4, 56.2)]:
    r = D(dd / 2) + 3
    ccx, ccy = D(cx), D(cy)
    m |= ((xx - ccx) ** 2 + (yy - ccy) ** 2) <= r * r
    m |= (((xx - ccx) / (r * 1.05)) ** 2 + ((yy - (ccy + r * 0.95)) / (r * 0.42)) ** 2) <= 1.0
A = median_fill(A, m, (D(20), D(200)))
cv = Image.fromarray(A.astype(np.uint8))
print('擦除右上三颗 画布 px', int(m.sum()))

# ───────────────────────────── ③ 擦橱窗内花盘（柜内底图 -> 动态贴图位）
A = np.asarray(cv).astype(np.int16)
mx, mn = A.max(axis=2), A.min(axis=2)
wood = np.abs(A - np.array((228, 178, 120))).sum(axis=2) <= 115
flower = (((mx - mn) > 16) | (np.abs(A - np.array((250, 250, 250))).sum(axis=2) > 28)) & ~wood
flower[:D(428), :] = False
flower[D(934):, :] = False
flower[:, :D(206)] = False
flower[:, D(556):] = False
A = median_fill(A, flower, (D(180), D(210)), passes=4, dil=9)
cv = Image.fromarray(A.astype(np.uint8))
print('擦除橱窗内花盘 画布 px', int(flower.sum()))

# ───────────────────────────── ④ 箭头：整体下移到「橱窗高度居中」
CASE_T, CASE_B = 247.2, 1154.6
CY = (CASE_T + CASE_B) / 2                      # 700.9
src_arrow = Image.open(SRC).convert('RGBA')
arrows = []
for cx, box, pool in ((54.0, (24.2, 658.7, 83.4, 721.0), (D(2), D(100))),
                      (700.0, (666.6, 658.7, 733.2, 721.0), (D(655), D(748)))):
    l, t, r, b = (D(v) for v in box)
    crop = src_arrow.crop((int(box[0] / S), int(box[1] / S), int(box[2] / S), int(box[3] / S)))
    crop = crop.resize((r - l, b - t), Image.LANCZOS)
    A = np.asarray(cv).astype(np.int16)
    mm = np.zeros((H, W), bool)
    mm[t:b, l:r] = True
    A = median_fill(A, mm, pool)
    cv = Image.fromarray(A.astype(np.uint8))
    arrows.append((cx, box, crop))
for cx, box, crop in arrows:
    w0, h0 = crop.size
    cv.paste(crop, (D(cx) - w0 // 2, D(CY) - D(684.1 - box[1])), crop)   # 圆盘心 684.1 -> CY
print(f'箭头 稿心 684.1 -> 居中 {CY:.1f}（+{CY - 684.1:.1f}）')

# ───────────────────────────── ⑤ 贴位图招牌（板顶对稿 91.8）
logo = Image.open(LOGO).convert('RGBA')
ls = (541.8 - 208.2) / 890.0                    # 设计 px / asset px = 0.37483
lw, lh = logo.size
cw, ch = int(round(lw * ls * 2)), int(round(lh * ls * 2))
px = D(375.0) - int(round(((33 + 923) / 2) * ls * 2))
py = D(91.8) - int(round(230 * ls * 2))
cv.paste(logo.resize((cw, ch), Image.LANCZOS), (px, py), logo.resize((cw, ch), Image.LANCZOS))
SIGN_BOT = 91.8 + (585 - 230) * ls
SIGN_TEXT_TOP = 91.8 + (285 - 230) * ls
print(f'招牌位图 贴 ({px},{py}) {cw}x{ch} 板底 {SIGN_BOT:.1f} 字顶缘 {SIGN_TEXT_TOP:.1f}（门槛 103.1）')

# ───────────────────────────── ⑥ 标注层
dr = ImageDraw.Draw(cv, 'RGBA')
F = FB = None
for p in (FONT, '/System/Library/Fonts/STHeiti Medium.ttc', '/System/Library/Fonts/Hiragino Sans GB.ttc'):
    try:
        F, FB = ImageFont.truetype(p, 30), ImageFont.truetype(p, 23)
        print('font', p)
        break
    except OSError:
        continue
assert F is not None, 'no CJK font'
CYAN, RED, GREEN, ORANGE, VIOLET = (0, 165, 200), (214, 40, 40), (26, 150, 70), (226, 132, 0), (150, 40, 170)

dr.rectangle((0, 0, 1500, D(120)), fill=(255, 220, 0, 34))
dr.line((0, D(120), 1500, D(120)), fill=ORANGE, width=2)
dr.text((8, D(124)), '安全带上界 120', font=FB, fill=(150, 110, 0))
dr.rectangle((D(562), D(52), D(736), D(116)), outline=RED, width=3)
dr.text((D(566), D(16)), '胶囊禁区（接口值）', font=FB, fill=RED)
dr.line((D(120), D(SIGN_TEXT_TOP), D(206), D(SIGN_TEXT_TOP)), fill=GREEN, width=3)
dr.text((D(96), D(SIGN_TEXT_TOP - 30)), '字顶 112', font=FB, fill=GREEN)

for cx in (68, 604, 692):
    dr.rectangle((D(cx - 44), D(161), D(cx + 44), D(249)), outline=RED, width=2)
    dr.ellipse((D(cx - 29.5), D(175.5), D(cx + 29.5), D(234.5)), fill=RED + (36,), outline=RED, width=3)
dr.text((D(112), D(258)), '顶栏 左1右2 cx 68/604/692 Ø59 自顶175.5-234.5  细框=88热区（现装已实装）', font=FB, fill=RED)

dr.line((0, D(CY), 1500, D(CY)), fill=GREEN, width=2)
for cx in (54, 700):
    dr.rectangle((D(cx - 44), D(CY - 44), D(cx + 44), D(CY + 44)), outline=GREEN, width=2)
dr.text((D(104), D(CY + 50)), f'箭头 居中于橱窗（框 {CASE_T}→{CASE_B} 中心 {CY:.1f}）', font=FB, fill=GREEN)
dr.text((D(104), D(CY + 78)), 'cx 54/700 取稿位  Ø59 视觉 + 88 热区', font=FB, fill=GREEN)

# 动态贴图位
dr.rectangle((D(180), D(430), D(570), D(900)), outline=CYAN, width=4)
dr.text((D(186), D(438)), '动态贴图位 x[180,570] 自顶430-900', font=FB, fill=CYAN)
dr.text((D(186), D(466)), '内容=当前关卡成品 尺寸位置运行时算', font=FB, fill=CYAN)

# 柜内木牌：原位覆盖 + 两端固定标尺 + 文案示意
PQ_C, PQ_W, PQ_H, PQ_T, END = 380.5, 187.5, 82.4, 953.3, 24
pq = Image.open(SRC).convert('RGB').crop((int(286.7 / S), int(953.3 / S), int(474.2 / S), int(1035.7 / S)))
pq = pq.resize((D(PQ_W), D(PQ_H)), Image.LANCZOS)
cv.paste(pq, (D(PQ_C - PQ_W / 2), D(PQ_T)))
dr = ImageDraw.Draw(cv, 'RGBA')
for dx in (PQ_W / 2 - END, -(PQ_W / 2 - END)):
    x = D(PQ_C + dx)
    dr.line((x, D(PQ_T + 4), x, D(PQ_T + PQ_H - 4)), fill=VIOLET, width=4)
dr.rectangle((D(PQ_C - PQ_W / 2), D(PQ_T), D(PQ_C + PQ_W / 2), D(PQ_T + PQ_H)), outline=VIOLET, width=3)
dr.text((D(PQ_C - 88), D(PQ_T + PQ_H / 2 - 12)), '金币 1 200 · 体力 5/6', font=FB, fill=(92, 58, 22))
dr.text((D(150), D(PQ_T - 34)), '柜内木牌 = 单独纹理 9-slice（紫线内可拉伸，两端 24 固定）', font=FB, fill=VIOLET)
dr.text((D(150), D(1050)), '价目牌 -> 并入这块牌（牌宽 = 文案宽）', font=FB, fill=ORANGE)

# CTA / 版本号 / slogan
dr.rectangle((D(217.6), D(1204.4), D(542.3), D(1293.8)), outline=RED, width=4)
dr.text((D(226), D(1236)), 'CTA 保持稿位 1204.4-1293.8', font=FB, fill=RED)
dr.rectangle((D(300), D(1298), D(450), D(1326)), fill=(226, 132, 0, 40), outline=ORANGE, width=3)
dr.text((D(458), D(1298)), '版本号 -> CTA 下方', font=FB, fill=ORANGE)
dr.text((D(458), D(1326)), '余量 40.2 -> 24.2 仍可放', font=FB, fill=ORANGE)
dr.rectangle((D(240), D(228), D(510), D(245)), fill=(226, 132, 0, 40), outline=ORANGE, width=3)
dr.text((D(246), D(228)), 'slogan 放不下（间隙 22）', font=FB, fill=ORANGE)

# ───────────────────────────── ⑦ 图例条 + 9-slice 原理小图
STRIP = 800
canvas = Image.new('RGB', (1500 + STRIP, 2668), (248, 245, 240))
canvas.paste(cv, (0, 0))
dr2 = ImageDraw.Draw(canvas, 'RGBA')
X0 = 1520
lines = [
    (F, '第十五批 · 主菜单按稿重排（8 条裁定）', (40, 34, 28)),
    (FB, '底图=原稿未改；16 px 溢出从屏底空白带吸收（元素零位移）', (90, 80, 70)),
    (FB, '绿=箭头 青=贴图位 紫=木牌 红=顶栏/CTA 橙=三件', (90, 80, 70)),
    (FB, '—— 逐条裁定 ——', (40, 34, 28)),
    (FB, '① 删 menu-showcase-20261014 两张产物  已删', GREEN),
    (FB, '② 招牌接位图 ui_menu_logo.png 960x622', (40, 34, 28)),
    (FB, '   缩放 0.37483（板宽 890 -> 333.6 对稿）板顶 91.8', (40, 34, 28)),
    (FB, f'   板底 {SIGN_BOT:.1f}（稿 215.6，asset 板更厚 {SIGN_BOT - 215.6:.1f}）', ORANGE),
    (FB, f'   字顶缘 {SIGN_TEXT_TOP:.1f} >= 103.1 OK；珠拼带退役', GREEN),
    (FB, '③ 顶栏左1右2 避胶囊 = 现装 menuTopbarTop() 已做', GREEN),
    (FB, '   作废的只是稿上右上三颗；代码零改动', (40, 34, 28)),
    (FB, f'④ 箭头居中于橱窗 中心 {CY:.1f}（稿 684.1 -> +{CY - 684.1:.1f}）', (40, 34, 28)),
    (FB, '   cx 54/700 取稿；Ø59 视觉 + 88 热区，热区不越屏', (40, 34, 28)),
    (FB, '⑤ 橱窗内底图已擦 -> 动态贴图位 x[180,570] 430-900', (40, 34, 28)),
    (FB, '   ! 实装要的是「框体纹理本身不含内容」', RED),
    (FB, '   -> 需从稿裁橱窗框体（去花盘）当资产', RED),
    (FB, '   预览白底里的淡灰残块 = 柜内灯光锥（属框体光照层）', (90, 80, 70)),
    (FB, '⑥ 木牌 9-slice：两端 24 固定，中段随文案拉伸', (40, 34, 28)),
    (FB, '   BlitCommand 无 src 矩形 -> 左/中/右三张纹理三次 blit', RED),
    (FB, '   ! 稿上牌体带透视（顶面可见）-> 横拉会穿帮', RED),
    (FB, '   需重出一张正视平涂底板纹理，或只取平涂中段拉伸', RED),
    (FB, '⑦ 三件只标不删：价目牌并入木牌 / 版本号可放 /', ORANGE),
    (FB, '   slogan 22 px 间隙放不下（需 28 字高 + 余量）', ORANGE),
    (FB, '⑧ 溢出 16 px -> 屏底空白带（40.2 -> 24.2）', (40, 34, 28)),
    (FB, '—— 资产缺口（现 assets/menu 仅 logo 一件）——', (40, 34, 28)),
    (FB, '橱窗框体（去内容）· 木牌三段 左/中/右 · 箭头钮', RED),
]
y = 24
for fnt, txt, col in lines:
    dr2.text((X0 + 4, y), txt, font=fnt, fill=col)
    y += fnt.size + 10

y += 18
dr2.text((X0 + 4, y), '9-slice 原理（牌宽随文案）', font=F, fill=(40, 34, 28))
y += 36
for wd, lab in ((140.0, '短文案 140'), (187.5, '稿位 187.5'), (280.0, '长文案 280')):
    w0 = D(wd)
    # 手工拼：左端 + 中段拉伸 + 右端
    e = D(END)
    mid = pq.crop((e, 0, pq.size[0] - e, pq.size[1])).resize((w0 - 2 * e, D(PQ_H)), Image.LANCZOS)
    out = Image.new('RGB', (w0, D(PQ_H)))
    out.paste(pq.crop((0, 0, e, pq.size[1])), (0, 0))
    out.paste(mid, (e, 0))
    out.paste(pq.crop((pq.size[0] - e, 0, pq.size[0], pq.size[1])), (w0 - e, 0))
    canvas.paste(out, (X0 + 20, y))
    dr2.rectangle((X0 + 20, y, X0 + 20 + w0, y + D(PQ_H)), outline=VIOLET, width=2)
    dr2.line((X0 + 20 + e, y, X0 + 20 + e, y + D(PQ_H)), fill=VIOLET, width=3)
    dr2.line((X0 + 20 + w0 - e, y, X0 + 20 + w0 - e, y + D(PQ_H)), fill=VIOLET, width=3)
    dr2.text((X0 + 34, y + D(PQ_H) / 2 - 12), lab, font=FB, fill=(92, 58, 22))
    y += D(PQ_H) + 30
canvas.save(OUT)
print(OUT, canvas.size)
