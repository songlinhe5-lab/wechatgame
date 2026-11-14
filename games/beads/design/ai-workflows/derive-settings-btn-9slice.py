#!/usr/bin/env python3
"""WXG-T-938 设置弹窗按钮底板：从选关「关闭」烘字图派生**无字**厚木 9-slice。

用户令：「设置页面的按钮不是选关页面的按钮设计」⇒ 设置页 cell 底板 + 在线导入
统一改用选关页底部「关闭」钮（`160:48`，301×105 @2x）同款厚木高光材质。

烘字图不能直接复用作 11 个档位文案的底 ⇒ 本脚本只取它的**边框 + 干净木面**：
  · 左端帽 = 源图 x[0, CAP)
  · 右端帽 = 源图 x[W-CAP, W)
  · 中段   = 源图 x[CLEAN_X0, CLEAN_X1) 的**无字平面带**（文字包围盒左侧，木纹横向
             ⇒ 横向拉伸后仍是横向木纹）
输出 235×210（@2x）= 70 + 95 + 70，9-slice `capX = 70`（源 px）。

⛔ 不重绘、不 AI 生成：像素全部来自定稿烘图，只做裁切与拼接。
用法：python3 games/beads/design/ai-workflows/derive-settings-btn-9slice.py [--preview]
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[4]
SRC = REPO / "games/beads/design/art/final/assets/detail/ui_level_select_close@2x.png"
OUT_DESIGN = REPO / "games/beads/design/art/final/assets/menu/buttons/ui_btn_settings_9s@2x.png"
OUT_COCOS = REPO / "games/beads/cocos/assets/textures/ui_btn_settings_9s.png"
PREVIEW = REPO / "temp/ui-btn-settings-preview.png"

CAP = 70          # 端帽宽（源 px；圆角半径约 45，70 留 25 净空）
CLEAN_X0 = 80     # 无字平面带（文字包围盒 ≈ x195 起，留 20px 余量）
CLEAN_X1 = 175
# 中段取左右两条无字带**横向交叉淡化**：烘图面有轻微左右明暗差，直接拼一条会在
# 与右端帽的接缝处出现竖向亮线（预览实测）⇒ 左带 x80..175、右带 x415..510 逐列线性混合。
CLEAN_R0 = 415
CLEAN_R1 = 510
# 设置页按钮实际尺寸（设计 px）：设置 cell 509×138 / 在线导入 130×88（底部返回已随 Figma 删除）
TARGETS = [(509, 138, "音乐"), (130, 88, "导入")]


def derive() -> Image.Image:
    src = Image.open(SRC).convert("RGBA")
    w, h = src.size
    if (w, h) != (602, 210):
        raise SystemExit(f"源图尺寸变了：{src.size} ≠ (602, 210)，先复核裁切参数")
    # 干净带自检：两条中段 y[40,170) 内不得出现烘字的高亮米白（>225）。
    for x0, x1 in ((CLEAN_X0, CLEAN_X1), (CLEAN_R0, CLEAN_R1)):
        band = src.crop((x0, 40, x1, 170)).convert("RGB")
        peak = max(sum(p) / 3 for p in list(band.getdata()))
        if peak > 225:
            raise SystemExit(f"干净带 x[{x0},{x1}) 含文字高光（peak={peak:.0f}）⇒ 改裁切参数")

    out = Image.new("RGBA", (CAP + (CLEAN_X1 - CLEAN_X0) + CAP, h))
    out.paste(src.crop((0, 0, CAP, h)), (0, 0))
    left = src.crop((CLEAN_X0, 0, CLEAN_X1, h))
    right = src.crop((CLEAN_R0, 0, CLEAN_R1, h))
    bw = CLEAN_X1 - CLEAN_X0
    mid = Image.new("RGBA", (bw, h))
    lp, rp, mp = left.load(), right.load(), mid.load()
    for x in range(bw):
        t = x / (bw - 1)
        for y in range(h):
            r0, g0, b0, a0 = lp[x, y]
            r1, g1, b1, a1 = rp[x, y]
            mp[x, y] = (
                round(r0 + (r1 - r0) * t),
                round(g0 + (g1 - g0) * t),
                round(b0 + (b1 - b0) * t),
                round(a0 + (a1 - a0) * t),
            )
    out.paste(mid, (CAP, 0))
    out.paste(src.crop((w - CAP, 0, w, h)), (CAP + bw, 0))
    return out


def nine_slice(src: Image.Image, w: float, h: float, cap: int) -> Image.Image:
    """与 framework `bakeNineSlice` 同判据：fit=min(w/sw, h/sh)（>1 取 1），端帽同比。"""
    sw, sh = src.size
    tw, th = max(1, round(w)), max(1, round(h))
    fit = min(tw / sw, th / sh)
    if not (fit > 0) or fit > 1:
        fit = 1
    cx = min(cap * fit, tw / 2)
    lw = round(cx)
    rw = round(cx)
    mw = max(1, tw - lw - rw)
    out = Image.new("RGBA", (tw, th))
    # 纵向整体缩放（不传 capY），横向三段：左帽 / 中段拉伸 / 右帽（⛔ 取整留缝）
    def paste_band(sx, sw_src, dx, dw):
        out.paste(src.crop((sx, 0, sx + sw_src, sh)).resize(
            (max(1, round(dw)), th), Image.LANCZOS), (dx, 0))
    paste_band(0, cap, 0, lw)
    paste_band(cap, sw - cap * 2, lw, mw)
    paste_band(sw - cap, cap, lw + mw, rw)
    return out


def main() -> None:
    img = derive()
    OUT_DESIGN.parent.mkdir(parents=True, exist_ok=True)
    OUT_COCOS.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT_DESIGN)
    img.save(OUT_COCOS)
    print(f"✅ {OUT_DESIGN.relative_to(REPO)}  {img.size}")
    print(f"✅ {OUT_COCOS.relative_to(REPO)}  {img.size}")

    if "--preview" in sys.argv:
        PREVIEW.parent.mkdir(parents=True, exist_ok=True)
        pad, gap = 30, 24
        tiles = []
        font = ImageFont.truetype("/System/Library/Fonts/STHeiti Medium.ttc", 30)
        for tw, th, text in TARGETS:
            tile = nine_slice(img, tw, th, CAP)
            d = ImageDraw.Draw(tile)
            d.text((tile.width / 2, tile.height / 2), text, font=font,
                   fill=(255, 248, 235, 255), anchor="mm",
                   stroke_width=2, stroke_fill=(92, 52, 24, 255))
            tiles.append(tile)
        pw = max(t.width for t in tiles) + pad * 2
        ph = sum(t.height for t in tiles) + gap * (len(tiles) - 1) + pad * 2
        sheet = Image.new("RGBA", (pw, ph), (92, 64, 40, 255))
        y = pad
        for t in tiles:
            sheet.alpha_composite(t, (pad, y))
            y += t.height + gap
        sheet.save(PREVIEW)
        print(f"🖼  {PREVIEW.relative_to(REPO)}")


if __name__ == "__main__":
    main()
