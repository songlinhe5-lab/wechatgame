"""橱窗顶部资源槽板（心数 / 豆数）定位稿 —— WXG-T-553 第一步（PIL 定位）。

用户 2026-11-02 令：「在橱窗顶部设计星数豆数的显示，要融合在外框上」→ 拍板：
  左 = 心数（体力值，现役红心件）；右 = 豆数（获取奖励分，现役金币件）；
  图标单独设计贴进槽内；橱窗外框顶部区域做成**放数值的槽板**。
方法 = PIL 定位（本脚本）→ 云端补质感（下一步，只重绘槽板区域）。

输入 = 顶栏定稿件 `menu-design-baseline-cat-topbar-final-20261102.png`（底图像素零改动）。
输出 = 同目录 `...-final-slot-20261102.png`。

⚠ 与运行时的关系：运行时资源条已嵌橱窗顶部（`meta-menu.ts` v3.6「覆盖楣的上 46 px」），
  现显示 体力+金币；本稿左项 = 心数（= 体力，语义不变）、右项 = 豆数（= coins 改叫法）。
  槽高默认 46 = 与运行时口径一致；坐标是**这张基准图**的 1:1 设计 px，⛔ 不是运行时真源。

用法：
  python3 games/beads/design/ai-workflows/menu-resource-slot.py            # 默认对称双槽
  python3 ... --left 150 --right 425 --w 195 --y 312 --h 46                 # 微调
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[4]
MENU = ROOT / 'games/beads/design/art/final/assets/menu'
PROPOSALS = ROOT / 'games/beads/design/art/proposals/menu-3d-style-20261030'
BASE = PROPOSALS / 'menu-design-baseline-cat-topbar-final-20261102.png'
OUT = PROPOSALS / 'menu-design-baseline-cat-topbar-final-slot-20261102.png'
FONT = '/System/Library/Fonts/STHeiti Medium.ttc'
FONT_NUM = '/System/Library/Fonts/SFNSRounded.ttf'   # 圆体数字（单槽口径，WXG-T-560）
FONT_PLAIN = '/System/Library/Fonts/SFNS.ttf'        # 运行时 sans-serif 的最近似（纯色档用）
FONT_PLAIN_BOLD = ('/System/Library/Fonts/Helvetica.ttc', 1)   # 纯色粗体档（运行时 bold sans-serif 近似）
# 单槽口径的图标 = T-558 新设计的线条件（心 / 拼豆圆片），槽内深底上须整色换成米白
ICON_DIR = PROPOSALS / 'resource-icons-20261102'
ICON_HEART = ICON_DIR / 'ui_icon_heart_line.png'
ICON_BEAD = ICON_DIR / 'ui_icon_bead_line.png'
ICON_LIGHT = (255, 241, 214)

INK = (255, 241, 214)        # 数值字色（米白）
RIM = (94, 56, 26)           # 槽沿外圈（亮木）
PIT = (46, 25, 12, 235)      # 槽内深底（半透明，让木纹隐透）
PIT_FLUSH = (32, 16, 8, 205)  # 开槽口径：无外沿的半透深底
PIT_TOP = (34, 17, 7, 198)    # 单槽口径：槽内渐变（上暗；暖棕，⛔ 不能用近黑，否则像贴片不像挖槽）
PIT_BOT = (96, 56, 26, 148)   # 单槽口径：槽内渐变（下亮，木纹略透）
LIP_CRISP = (198, 148, 92, 165)  # 下沿硬反光（1-2px 亮线 = 挖槽受光边）
LIP = (176, 126, 74, 120)     # 开槽下沿反光
GLOW = (0, 0, 0)             # 顶部内阴影


def slot(im: Image.Image, x: int, y: int, w: int, h: int, icon: str, label: str, icon_px: int, tilt: float,
         plate: bool = True, empty: bool = False, flush: bool = False) -> None:
    """一处数值位；tilt 随拱弧微倾（度）。plate=False 时不画底板（--cloud：底板由云图出），
    empty=True 时不画图标数字（--empty：给云端的参考底），
    flush=True 走**开槽**口径：无外沿/无新增槽图案，只在原梁面上挖出凹陷（用户 2026-11-02 二令）。"""
    pad = 24
    tile = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    r = h // 2 - 6
    x0, y0, x1, y1 = pad, pad, pad + w, pad + h
    if plate and flush:
        d.rounded_rectangle((x0, y0, x1, y1), radius=r, fill=PIT_FLUSH)               # 凹陷底（半透，木纹透出）
        sh = Image.new('L', tile.size, 0)                                             # 顶部内阴影（挖槽吃光）
        ImageDraw.Draw(sh).rounded_rectangle((x0 + 2, y0 + 1, x1 - 2, y0 + h // 2), radius=r, fill=150)
        sh = sh.filter(ImageFilter.GaussianBlur(5))
        tile.paste(Image.new('RGBA', tile.size, GLOW), (0, 0), sh)
        d.rounded_rectangle((x0 + 6, y1 - 3, x1 - 6, y1 - 1), radius=2, fill=LIP)     # 槽底反光（挖槽下沿受光）
    elif plate:
        d.rounded_rectangle((x0, y0, x1, y1), radius=r, fill=RIM)                     # 槽沿
        d.rounded_rectangle((x0 + 4, y0 + 4, x1 - 4, y1 - 4), radius=max(r - 4, 4), fill=PIT)
        sh = Image.new('L', tile.size, 0)                                             # 顶部内阴影
        ImageDraw.Draw(sh).rounded_rectangle((x0 + 6, y0 + 4, x1 - 6, (y0 + y1) // 2), radius=r - 4, fill=110)
        sh = sh.filter(ImageFilter.GaussianBlur(4))
        tile.paste(Image.new('RGBA', tile.size, GLOW), (0, 0), sh)
    cy = (y0 + y1) // 2
    if not empty:
        ico = Image.open(MENU / icon).convert('RGBA')                                 # 图标 + 数值
        s = icon_px / max(ico.size)
        ico = ico.resize((round(ico.width * s), round(ico.height * s)), Image.LANCZOS)
        ix = x0 + 18
        tile.alpha_composite(ico, (ix, cy - ico.height // 2))
        f = ImageFont.truetype(FONT, 26)
        d.text((ix + ico.width + 10, cy), label, font=f, fill=INK, anchor='lm',
               stroke_width=2, stroke_fill=(40, 20, 8))
    if tilt:
        tile = tile.rotate(tilt, resample=Image.BICUBIC, expand=True)
    cx, cyy = x + w // 2, y + h // 2
    im.alpha_composite(tile, (cx - tile.width // 2, cyy - tile.height // 2))


def bar(im: Image.Image, x0: int, y0: int, x1: int, y1: int, icon_px: int, style: str,
        icon_l: Path | None = None, icon_r: Path | None = None, recolor: bool = True,
        num_scale: float = 1.0) -> None:
    """单条贯通凹槽（WXG-T-560）：水平、圆头、无倾角，图标居两端、数值贴图标内侧、中间留空。

    槽体仍是「原梁面开槽」口径（无外沿/无新增槽图案）：半透深底 + 顶部内阴影 + 下沿反光。
    数值样式全部程序化（用户令：只定颜色/尺寸/位置，以能程序化实现为准）：
      a = 米白描边（26px，最保守，沿用旧稿口径）
      b = 暖黄大字（30px，双描边 + 上缘高光，最醒目）
      c = 凹刻（28px，上缘暗线 + 下缘亮线，与开槽最统一）
    """
    w, h = x1 - x0, y1 - y0
    pad = 26
    tile = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    bx0, by0, bx1, by1 = pad, pad, pad + w, pad + h
    r = h // 2
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=r, fill=255)
    grad = Image.new('RGBA', (w, h))                                               # 上暗下亮的竖直渐变（槽内受光）
    gd = ImageDraw.Draw(grad)
    for i in range(h):
        t = i / max(h - 1, 1)
        col = tuple(round(PIT_TOP[c] + (PIT_BOT[c] - PIT_TOP[c]) * t) for c in range(4))
        gd.line([(0, i), (w, i)], fill=col)
    tile.paste(grad, (bx0, by0), mask)
    d = ImageDraw.Draw(tile)
    ramp = Image.new('L', tile.size, 255)                                          # 端部渐隐（避免高光/阴影刀切般笔直收口）
    rd = ImageDraw.Draw(ramp)
    for i in range(26):
        a = round(255 * (1 - i / 26) ** 1.6)
        rd.line([(bx0 - pad + i, 0), (bx0 - pad + i, tile.height)], fill=a)
        rd.line([(bx1 + pad - i - 1, 0), (bx1 + pad - i - 1, tile.height)], fill=a)
    out_sh = Image.new('L', tile.size, 0)                                          # 槽顶上缘的外侧接触影（凹陷感的关键）
    ImageDraw.Draw(out_sh).rounded_rectangle((bx0, by0 - 5, bx1, by0 + 2), radius=r, fill=95)
    tile.paste(Image.new('RGBA', tile.size, (0, 0, 0)), (0, 0), out_sh.filter(ImageFilter.GaussianBlur(3)))
    sh = Image.new('L', tile.size, 0)                                              # 顶部内阴影（挖槽吃光，加深加宽）
    ImageDraw.Draw(sh).rounded_rectangle((bx0 + 1, by0 - 1, bx1 - 1, by0 + 7), radius=r, fill=225)
    sh = sh.filter(ImageFilter.GaussianBlur(4))
    tile.paste(Image.new('RGBA', tile.size, (0, 0, 0)), (0, 0), Image.composite(sh, Image.new('L', tile.size, 0), ramp))
    side = Image.new('L', tile.size, 0)                                            # 两端内壁暗角
    sd = ImageDraw.Draw(side)
    sd.ellipse((bx0 - 12, by0 + 3, bx0 + 18, by1 - 3), fill=110)
    sd.ellipse((bx1 - 18, by0 + 3, bx1 + 12, by1 - 3), fill=110)
    tile.paste(Image.new('RGBA', tile.size, (0, 0, 0)), (0, 0), side.filter(ImageFilter.GaussianBlur(6)))
    pool = Image.new('L', tile.size, 0)                                            # 槽底受光（下沿反光的柔光）
    ImageDraw.Draw(pool).rounded_rectangle((bx0 + 6, by1 - 13, bx1 - 6, by1 - 3), radius=max(r - 4, 3), fill=78)
    tile.paste(Image.new('RGBA', tile.size, LIP), (0, 0), Image.composite(pool.filter(ImageFilter.GaussianBlur(4)), Image.new('L', tile.size, 0), ramp))
    lip = Image.new('L', tile.size, 0)                                             # 槽底下沿硬反光（端部渐隐）
    ImageDraw.Draw(lip).rounded_rectangle((bx0 + 9, by1 - 4, bx1 - 9, by1 - 2), radius=3, fill=255)
    tile.paste(Image.new('RGBA', tile.size, LIP_CRISP), (0, 0), Image.composite(lip, Image.new('L', tile.size, 0), ramp))
    cy = (by0 + by1) // 2

    ico_l = _fit(icon_l or ICON_HEART, icon_px, ICON_LIGHT if recolor else None)
    ico_r = _fit(icon_r or ICON_BEAD, icon_px, ICON_LIGHT if recolor else None)
    tile.alpha_composite(ico_l, (bx0 + 16, cy - ico_l.height // 2))
    tile.alpha_composite(ico_r, (bx1 - 16 - ico_r.width, cy - ico_r.height // 2))
    _number(tile, bx0 + 16 + ico_l.width + 11, cy, '12/20', style, anchor='lm', scale=num_scale)
    _number(tile, bx1 - 16 - ico_r.width - 11, cy, '480', style, anchor='rm', scale=num_scale)
    im.alpha_composite(tile, (x0 - pad, y0 - pad))


def _fit(path: Path, px: int, recolor: tuple[int, int, int] | None = None) -> Image.Image:
    """等比缩到 px；给 recolor 时保留原 alpha、整色替换（槽内深底上必须换浅色，深棕线条看不见）。"""
    ico = Image.open(path).convert('RGBA')
    s = px / max(ico.size)
    ico = ico.resize((round(ico.width * s), round(ico.height * s)), Image.LANCZOS)
    if recolor:
        flat = Image.new('RGBA', ico.size, (*recolor, 255))
        flat.putalpha(ico.getchannel('A'))
        ico = flat
    return ico


NUM_SPEC = {                       # (字号, 字色, 描边宽, 描边色, 附加效果)
    'a': (26, (255, 241, 214), 2, (48, 24, 10), 'shadow'),
    'b': (30, (255, 217, 138), 3, (56, 28, 10), 'hilite'),
    'c': (28, (255, 246, 228), 2, (38, 19, 8), 'emboss'),
    'd': (26, (255, 241, 214), 0, None, 'plain'),   # 纯色档：⛔ 无描边无投影（运行时 TextCommand 支持不到）
    'e': (27, (255, 241, 214), 0, None, 'plain_bold'),  # 纯色粗体档（推荐：控件层可 1:1 还原）
}


def _number(tile: Image.Image, x: int, cy: int, text: str, style: str, anchor: str, scale: float = 1.0) -> None:
    size, fill, sw, sc, fx = NUM_SPEC[style]
    size = max(10, round(size * scale))
    sw = max(0, round(sw * scale))
    if fx in ('plain', 'plain_bold'):
        fp = FONT_PLAIN if fx == 'plain' else FONT_PLAIN_BOLD
        f = ImageFont.truetype(fp[0], size, index=fp[1]) if isinstance(fp, tuple) else ImageFont.truetype(fp, size)
    else:
        f = ImageFont.truetype(FONT_NUM, size)
    d = ImageDraw.Draw(tile)
    if fx in ('plain', 'plain_bold'):                                              # 纯色：单趟 fill，无描边无投影
        d.text((x, cy), text, font=f, fill=fill, anchor=anchor)
    elif fx == 'shadow':
        d.text((x, cy + 2), text, font=f, fill=(0, 0, 0, 110), anchor=anchor)
        d.text((x, cy), text, font=f, fill=fill, anchor=anchor, stroke_width=sw, stroke_fill=sc)
    elif fx == 'hilite':
        d.text((x, cy + 2), text, font=f, fill=(0, 0, 0, 120), anchor=anchor)
        d.text((x, cy - 1), text, font=f, fill=(255, 255, 236, 150), anchor=anchor, stroke_width=sw + 1, stroke_fill=(255, 255, 236, 150))
        d.text((x, cy), text, font=f, fill=fill, anchor=anchor, stroke_width=sw, stroke_fill=sc)
    else:                                                                          # emboss：凸起，上缘亮、下缘暗
        d.text((x, cy + 2), text, font=f, fill=(0, 0, 0, 150), anchor=anchor, stroke_width=sw, stroke_fill=(0, 0, 0, 150))
        d.text((x, cy - 1), text, font=f, fill=(255, 255, 244, 120), anchor=anchor)
        d.text((x, cy), text, font=f, fill=fill, anchor=anchor, stroke_width=sw, stroke_fill=sc)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--left', type=int, default=150, help='左槽 x')
    ap.add_argument('--right', type=int, default=420, help='右槽 x')
    ap.add_argument('--w', type=int, default=200, help='槽宽')
    ap.add_argument('--y', type=int, default=310, help='槽顶 y')
    ap.add_argument('--h', type=int, default=48, help='槽高（运行时同口径 46±）')
    ap.add_argument('--icon', type=int, default=34, help='图标显示边长')
    ap.add_argument('--tilt', type=float, default=7, help='随拱弧的倾角（度，左 + 右 −）')
    ap.add_argument('--empty', action='store_true', help='只画空槽（云端重绘参考底，无图标无数字）')
    ap.add_argument('--cloud', help='云端回图路径：按 --bbox 贴回（框外硬拷回）后再叠图标与数字')
    ap.add_argument('--bbox', default='130,295,645,400', help='云端重绘框（与 --cloud 配套；x1,y1,x2,y2）')
    ap.add_argument('--flush', action='store_true', help='开槽口径：无外沿/无新增槽图案，只在原梁面挖凹陷')
    ap.add_argument('--bar', action='store_true', help='单条贯通凹槽口径（水平、图标居两端、中缝镂空心形须已抹平）')
    ap.add_argument('--src', help='底图覆盖（默认用 BASE；单槽口径传已抹掉中缝心形的贴回图）')
    ap.add_argument('--style', default='a', choices=list(NUM_SPEC), help='数值样式 a/b/c（--bar 专用）')
    ap.add_argument('--iconl', help='左端图标 PNG（默认 T-558 心形线条件）')
    ap.add_argument('--iconr', help='右端图标 PNG（默认 T-558 拼豆圆片线条件）')
    ap.add_argument('--no-recolor', action='store_true', help='图标保留原色（新设计的自带米白时用）')
    ap.add_argument('--num-scale', type=float, default=1.0, help='数值字号缩放')
    a = ap.parse_args()

    im = Image.open(a.src or BASE).convert('RGBA') if a.bar else Image.open(BASE).convert('RGBA')
    out = OUT
    if a.bar:
        out = PROPOSALS / f'menu-design-baseline-cat-topbar-final-slotbar-{a.style}-20261102.png'
        bar(im, a.left, a.y, a.left + a.w, a.y + a.h, a.icon, a.style,
            Path(a.iconl) if a.iconl else None, Path(a.iconr) if a.iconr else None,
            not a.no_recolor, a.num_scale)
        im.save(out)
        print(f'✅ {out.relative_to(ROOT)} （单槽口径 · 样式 {a.style}）'
              f' 槽 x={a.left}..{a.left + a.w} y={a.y}..{a.y + a.h} 图标 {a.icon}px')
        return
    if a.flush:
        out = PROPOSALS / 'menu-design-baseline-cat-topbar-final-slot-flush-20261102.png'
    if a.empty:  # 参考底是云端中间产物，落 temp 不入库
        out = ROOT / 'temp/dashscope-out/custom/slot-empty-src.png'
        out.parent.mkdir(parents=True, exist_ok=True)
    if a.cloud:
        cloud = Image.open(a.cloud).convert('RGBA').resize(im.size, Image.LANCZOS)
        bx1, by1, bx2, by2 = [int(v) for v in a.bbox.split(',')]
        patch = im.copy()                                     # bbox 外 = 定位稿原像素（区外零改动）
        patch.paste(cloud.crop((bx1, by1, bx2, by2)), (bx1, by1))
        # 区内边缘羽化只向内（blur 后与硬边相乘裁剪）⇒ 框外逐字节 = 定位稿
        from PIL import ImageChops
        hard = Image.new('L', im.size, 0)
        ImageDraw.Draw(hard).rectangle((bx1 + 3, by1 + 3, bx2 - 3, by2 - 3), fill=255)
        m = ImageChops.multiply(hard.filter(ImageFilter.GaussianBlur(2)), hard)
        im = Image.composite(patch, im, m)
        print(f'↳ 云图已贴回 bbox={a.bbox}（羽化只向内 3px，框外逐字节 = 定位稿）')
    empty = a.empty and not a.cloud
    plate = not a.cloud
    slot(im, a.left, a.y, a.w, a.h, 'asset-icon-stamina.png', '12/20', a.icon, a.tilt, plate, empty, a.flush)
    slot(im, a.right, a.y, a.w, a.h, 'asset-icon-coin.png', '480', a.icon, -a.tilt, plate, empty, a.flush)
    im.save(out)
    mode = '（空槽版，云端参考底）' if a.empty else ('（云图贴回 + 图标数字）' if a.cloud else '（PIL 定位稿）')
    print(f'✅ {out.relative_to(ROOT)} {mode} 左槽 x={a.left} 右槽 x={a.right} y={a.y} h={a.h} w={a.w} tilt=±{a.tilt}')


if __name__ == '__main__':
    main()
