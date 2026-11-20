#!/usr/bin/env python3
"""结算双钮背景 9-slice 资源：`ui_btn_clear_next`（主·橙）/ `ui_btn_clear_menu`（次·奶油）。

用户令（2026-11-20）：「下一关和主界面两个按钮背景要做 9sprites 资源」——回放钮（160×96）复用次钮
底图，与次钮 192×101 纵横比不同，整图拉伸会压扁圆角 ⇒ 两件统一走九宫格，端帽盖住圆角。

产物（设计 px 1:1 不变，只附切片参数）：
  · `final/assets/menu/clear/ui_btn_clear_next_9s@2x.png`   554×218，capX=capY=64（圆角半径约 50）
  · `final/assets/menu/clear/ui_btn_clear_menu_9s@2x.png`    384×204，capX=capY=56（圆角半径约 51）
  · `cocos/assets/textures/ui_btn_clear_{next,menu}_9s.png`  投放件（⛔ `.meta` 由编辑器签发，L1）

⛔ 不重绘、不 AI 生成：像素全部来自定稿切图，本脚本只复制、校验、出预览。
校验：两件四角透明（圆角外无像素）、端帽不超过半宽/半高、拉伸预览三档尺寸无缝。
用法：python3 games/beads/design/ai-workflows/derive-clear-btn-9slice.py
"""
import shutil
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[4]
CLEAR = REPO / "games/beads/design/art/final/assets/menu/clear"
COCOS = REPO / "games/beads/cocos/assets/textures"
PREVIEW = REPO / "temp/clear-btn-9s-preview.png"

# (源文件, 9s 产物名, 投放名, capX, capY, 目标尺寸档 (w,h) 设计 px)
ASSETS = [
    ("ui_btn_clear_next@2x.png", "ui_btn_clear_next_9s@2x.png", "ui_btn_clear_next_9s.png", 64, 64,
     [(279, 106), (160, 96)]),
    ("ui_btn_clear_menu@2x.png", "ui_btn_clear_menu_9s@2x.png", "ui_btn_clear_menu_9s.png", 56, 56,
     [(192, 101), (160, 96)]),
]


def check(src: Image.Image, capx: int, capy: int) -> None:
    w, h = src.size
    if capx * 2 >= w or capy * 2 >= h:
        raise SystemExit(f"端帽过大：cap({capx},{capy}) vs 源 {w}×{h}")
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if src.getpixel((x, y))[3] != 0:
            raise SystemExit(f"源图角点不透明 {(x, y)} ⇒ 圆角假设不成立，先复核")


def nine_slice(src: Image.Image, dw: int, dh: int, capx: int, capy: int) -> Image.Image:
    """与 framework `nineSliceFx` 同语义：端帽按较小缩放比同比缩小（只缩不放），中段拉伸。"""
    sw, sh = src.size
    fit = min(dw / sw, dh / sh)
    fit = 1.0 if (fit <= 0 or fit > 1) else fit
    # 断点一律取整且只算一次：左右端帽宽、中段宽互相咬合，⛔ 不得各自 round 造成 1px 缝。
    cx = round(min(capx * fit, dw / 2))
    cy = round(min(capy * fit, dh / 2))
    xs = [(0, cx), (cx, dw - cx), (dw - cx, dw)]
    ys = [(0, cy), (cy, dh - cy), (dh - cy, dh)]
    sx = [(0, capx), (capx, sw - capx), (sw - capx, sw)]
    sy = [(0, capy), (capy, sh - capy), (sh - capy, sh)]
    out = Image.new("RGBA", (dw, dh), (0, 0, 0, 0))
    for j in range(3):
        for i in range(3):
            x0, x1 = xs[i]
            y0, y1 = ys[j]
            u0, u1 = sx[i]
            v0, v1 = sy[j]
            if x1 - x0 <= 0 or y1 - y0 <= 0:
                continue
            part = src.crop((u0, v0, u1, v1)).resize(
                (max(1, x1 - x0), max(1, y1 - y0)), Image.LANCZOS)
            out.alpha_composite(part, (x0, y0))
    return out


def main() -> None:
    tiles = []
    for src_name, out_name, cocos_name, capx, capy, targets in ASSETS:
        src_path = CLEAR / src_name
        src = Image.open(src_path).convert("RGBA")
        check(src, capx, capy)
        # 9s 产物 = 源像素原样复制（切片参数由本脚本与 `menu.ts` 常量同口径登记）。
        shutil.copyfile(src_path, CLEAR / out_name)
        shutil.copyfile(src_path, COCOS / cocos_name)
        print(f"✅ {(CLEAR / out_name).relative_to(REPO)}  {src.size}  cap({capx},{capy})")
        print(f"✅ {(COCOS / cocos_name).relative_to(REPO)}  （.meta 待编辑器签发）")
        for tw, th in targets:
            tiles.append((f"{src_name.split('@')[0]} {tw}×{th}", nine_slice(src, tw, th, capx, capy)))

    # 预览：三档目标尺寸（含回放钮 160×96）逐档拉伸，肉眼验圆角不压扁。
    pad, gap = 24, 18
    width = max(t.width for _, t in tiles) + pad * 2
    height = sum(t.height + 34 for _, t in tiles) + gap * len(tiles) + pad
    sheet = Image.new("RGBA", (width, height), (240, 233, 220, 255))
    y = pad
    for _, tile in tiles:
        sheet.alpha_composite(tile, (pad, y + 26))
        y += tile.height + 34 + gap
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW)
    print(f"🖼  {PREVIEW.relative_to(REPO)}")


if __name__ == "__main__":
    main()
