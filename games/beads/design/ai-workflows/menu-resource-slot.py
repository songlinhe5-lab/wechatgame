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

INK = (255, 241, 214)        # 数值字色（米白）
RIM = (94, 56, 26)           # 槽沿外圈（亮木）
PIT = (46, 25, 12, 235)      # 槽内深底（半透明，让木纹隐透）
GLOW = (0, 0, 0)             # 顶部内阴影


def slot(im: Image.Image, x: int, y: int, w: int, h: int, icon: str, label: str, icon_px: int, tilt: float,
         plate: bool = True, empty: bool = False) -> None:
    """一块嵌槽；tilt 随拱弧微倾（度）。plate=False 时不画底板（--cloud：底板由云图出），
    empty=True 时不画图标数字（--empty：给云端的空槽参考底）。"""
    pad = 24
    tile = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    r = h // 2 - 6
    x0, y0, x1, y1 = pad, pad, pad + w, pad + h
    if plate:
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
    a = ap.parse_args()

    im = Image.open(BASE).convert('RGBA')
    out = OUT
    if a.empty:  # 空槽版是云端中间产物，落 temp 不入库
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
    slot(im, a.left, a.y, a.w, a.h, 'asset-icon-stamina.png', '12/20', a.icon, a.tilt, plate, empty)
    slot(im, a.right, a.y, a.w, a.h, 'asset-icon-coin.png', '480', a.icon, -a.tilt, plate, empty)
    im.save(out)
    mode = '（空槽版，云端参考底）' if a.empty else ('（云图贴回 + 图标数字）' if a.cloud else '（PIL 定位稿）')
    print(f'✅ {out.relative_to(ROOT)} {mode} 左槽 x={a.left} 右槽 x={a.right} y={a.y} h={a.h} w={a.w} tilt=±{a.tilt}')


if __name__ == '__main__':
    main()
