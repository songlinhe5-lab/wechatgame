#!/usr/bin/env python3
"""WXG-T-942 设置项图标补投影：Figma 图像填充导出**不含图层效果**（drop shadow），
落码后图标在木面上「发飘」。本脚本把投影烘进图标 PNG（不改运行时接线）：

  · 画布四周各留 PAD=6px 透明边（2x 源 px）——投影落在边内，不改变图标相对位置；
  · 投影 = 图标 alpha 轮廓 → 深棕 #3D2E1E、alpha 0.65、偏移 (2, 3)、高斯模糊 4；
  · 图标本体仍按原位贴回（PAD, PAD），⛔ 不缩放、不重绘。

⚠ 运行时按 `ICON_SRC`（= 新画布尺寸）+ `CELL_ICON`（74×78）等比 FIT，图标视觉尺寸基本不变。
用法（仓根）：python3 games/beads/design/ai-workflows/bake-settings-icon-shadow.py
"""
from pathlib import Path

from PIL import Image, ImageFilter

REPO = Path(__file__).resolve().parents[4]
DIR = REPO / "games/beads/design/art/final/assets/menu/settings/icons"
PAD = 6
SHADOW_RGB = (61, 46, 30)   # palette.shadowInk #3D2E1E
SHADOW_A = 0.85
OFFSET = (3, 4)             # PIL 坐标（右 / 下）
BLUR = 3
# 原始 Figma 导出尺寸（2x）：只认这些输入 ⇒ 重复运行会拒绝（防二次叠投影）。
ORIGINAL = {
    "ui_icon_music@2x.png": (97, 103),
    "ui_icon_sound_settings@2x.png": (104, 93),
    "ui_icon_motion@2x.png": (102, 113),
    "ui_icon_vibrate@2x.png": (113, 115),
}


def bake(path: Path) -> tuple[int, int]:
    icon = Image.open(path).convert("RGBA")
    w, h = icon.size
    want = ORIGINAL.get(path.name)
    if want is None or (w, h) != want:
        raise SystemExit(f"⛔ {path.name} 尺寸 {w}×{h} ≠ 原始 {want}（疑似已烘过；"
                         f"如要重跑，先从 temp/figma/settings/ 恢复原件）")
    canvas = Image.new("RGBA", (w + PAD * 2, h + PAD * 2), (0, 0, 0, 0))

    # 投影层：alpha 轮廓 → 纯色，再模糊 + 压 alpha。
    alpha = icon.split()[3]
    shadow = Image.new("RGBA", icon.size, SHADOW_RGB + (0,))
    shadow.putalpha(alpha)
    shadow.putalpha(alpha.point(lambda v: round(v * SHADOW_A)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(BLUR))
    canvas.alpha_composite(shadow, (PAD + OFFSET[0], PAD + OFFSET[1]))
    canvas.alpha_composite(icon, (PAD, PAD))
    canvas.save(path)
    return canvas.size


def main() -> None:
    for p in sorted(DIR.glob("ui_icon_*@2x.png")):
        size = bake(p)
        print(f"✅ {p.name}  {size}")


if __name__ == "__main__":
    main()
