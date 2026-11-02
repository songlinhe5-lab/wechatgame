"""把已定稿的顶栏四钮贴到 v2 设计基准图的招牌两侧（纯程序化合成，零模型调用）。

来源：WXG-T-552 —— 用户 2026-11-02 令「在这个图左上右上增加之前 4 个按钮，调整合适布局」。
方法与排布均由用户拍板：**程序化贴装（PIL）** + **让位招牌（Ø56 竖叠于板体左右外缘）**。

输入（全部为现役定稿件，⛔ 不重出美术）：
  底图 = proposals/menu-3d-style-20261030/menu-design-baseline-cat-20261101.png（752×1344）
  底托 = final/assets/menu/ui_btn_circle_normal.png（160×160 @2x，对应 Ø80 设计 px）
  图标 = final/assets/menu/ui_icon_{settings,rank,calendar,skin}.png（同 160 画布覆盖层）

⚠ 两条口径（改之前先读）：
  1. 底图按 1:1 设计 px 读 ⇒ `--diameter 56` 就是图上 56 px。
  2. 这张基准图的招牌**比运行时版面大得多**（图上板体约 548 px，落地单是 370 px）⇒
     本脚本产物只服务「设计稿观感」，⛔ 不构成运行时坐标；运行时真源 =
     `games/beads/src/config/tuning/layout.ts` 的 `MENU_TOPBAR_X` / `MENU_TOPBAR_ROW2_DY`。

用法：
  python3 games/beads/design/ai-workflows/menu-topbar-compose.py
  python3 games/beads/design/ai-workflows/menu-topbar-compose.py --diameter 72 --edge 16 --center-y 122 --suffix A2
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
MENU = ROOT / 'games/beads/design/art/final/assets/menu'
PROPOSALS = ROOT / 'games/beads/design/art/proposals/menu-3d-style-20261030'
BASE = PROPOSALS / 'menu-design-baseline-cat-20261101.png'
BASE_D = 80  # 底托 / 图标的画布语义直径（设计 px，160 文件 = @2x）

# 列序与运行时一致：左列 settings(上) / rank(下)，右列 calendar(上) / skin(下)
LEFT = ('ui_icon_settings.png', 'ui_icon_rank.png')
RIGHT = ('ui_icon_calendar.png', 'ui_icon_skin.png')


def tile(icon: str, size: int) -> Image.Image:
    """底托 + 图标叠成一枚按钮，再缩到目标直径（与运行时同口径：先叠后退缩放）。"""
    base = Image.open(MENU / 'ui_btn_circle_normal.png').convert('RGBA')
    lay = Image.open(MENU / icon).convert('RGBA')
    out = Image.alpha_composite(base, lay)
    return out.resize((size, size), Image.LANCZOS)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--diameter', type=int, default=56, help='按钮视觉直径（设计 px）')
    ap.add_argument('--gap', type=int, default=12, help='同列两枚的纵向间隙')
    ap.add_argument('--edge', type=int, default=20, help='按钮列距屏幕左右边缘')
    ap.add_argument('--center-y', type=int, default=122, help='两枚竖叠整体中心 y（对齐招牌带）')
    ap.add_argument('--suffix', default='A1', help='输出名后缀，用于多版对比')
    a = ap.parse_args()

    canvas = Image.open(BASE).convert('RGBA')
    w, h = canvas.size
    d, g = a.diameter, a.gap
    y0 = a.center_y - (2 * d + g) // 2
    for icons, x in ((LEFT, a.edge), (RIGHT, w - a.edge - d)):
        for i, icon in enumerate(icons):
            canvas.alpha_composite(tile(icon, d), (x, y0 + i * (d + g)))

    out = PROPOSALS / f'menu-design-baseline-cat-topbar-{a.suffix}-20261102.png'
    canvas.save(out)
    print(f'✅ {out.relative_to(ROOT)}  Ø{d} 边距{a.edge} 隙{g} 列 y={y0}/{y0 + d + g}')


if __name__ == '__main__':
    main()
