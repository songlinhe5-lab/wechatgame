"""资源槽两枚图标（心数 / 豆数）—— 第一步：矢量定形（SVG 正本 + resvg 栅格化）。

WXG-T-558。用户 2026-11-02 拍板：豆 = **拼豆圆片（带中心孔）**；做法 = **程序化定形 + 模型补质感**。
⛔ **同日「模型补质感」复判负，用户拍板走 A：只定形** —— 本脚本产出的平涂版即 34 px 最终稿，
不再叠 i2i 木刻质感（实测：木刻版归一后线宽 12.72 vs 平涂 12.99、形状 IoU 0.922 尚可，
但缩到 34 px 后描边明度 std 0.6 < 平涂 1.6、明度极差 2.3 < 7.0、软边像素比 77.7% > 53.9%
⇒ 高频刻痕被降采样抹平，唯一残留差异是边缘发虚）。质感只在 ≥64 px 场景另议，不入此处。

为什么用 SVG 而不是 PIL 画线：PIL 的 `line(joint='curve')` 在心形尖点会出毛刺与内侧碎线
（第一版踩过，实测图见会话记录）；改走 SVG 贝塞尔 + resvg 栅格化，线条平滑且可无损放大。

风格对齐四钮（`btn-topbar-traced-v2-20261102` 实测）：线色 `#5A2606`、圆端圆角描边、无填充无投影。
⛔ 不套圆牌的 `FACE_R/FIT_R` 约束 —— 资源槽内不使用圆牌底托。

产出（落 proposals 同目录，母版 160×160；槽内以 34 px 显示）：
  ui_icon_heart_line.svg / .png   心形（心数 / 体力）
  ui_icon_bead_line.svg  / .png   拼豆圆片（豆数 / 奖励分）

栅格化依赖隔离空间的 resvg（`~/.workbuddy/binaries/node/workspace/node_modules/@resvg/resvg-js`）。
用法：python3 games/beads/design/ai-workflows/gen-resource-icons.py
"""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
DST = ROOT / 'games/beads/design/art/proposals/menu-3d-style-20261030/resource-icons-20261102'
SIZE = 160
LINE = 13           # 线宽（@160 母版；34 px 显示 ≈ 2.8 px）
DARK = '#5A2606'    # 与四钮同色
RESVG_NM = Path.home() / '.workbuddy/binaries/node/workspace/node_modules'

# 心形：四段三次贝塞尔（尖在底、顶部双弧、中缝凹口），外接框约 136×120，留安全边
HEART = ('M 80,138 C 44,110 12,86 12,58 C 12,34 30,18 50,18 '
         'C 64,18 74,27 80,37 C 86,27 96,18 110,18 C 130,18 148,34 148,58 '
         'C 148,86 116,110 80,138 Z')
BEAD_OUT_R = 58
BEAD_HOLE_R = 19    # ≈ 0.33 × 外径，与盘面拼豆同比例
# 槽内档（WXG-T-560 修订）：珠面材质 —— 暖奶白渐变 + 深棕勾边 + 亮缘。
# 用户 2026-11-02 三否之三「图标设计有纹理的，现在白色形状，不搭」⇒ 冷白平涂改珠面。
SLOT_HI, SLOT_MID, SLOT_LOW = '#FFF6E4', '#F2D9AC', '#CFA470'
SLOT_EDGE = '#5E3B1E'      # 勾边（与四钮/招牌珠字同族的深棕）


def _svg(body: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" '
            f'viewBox="0 0 {SIZE} {SIZE}">\n'
            f'  <g fill="none" stroke="{DARK}" stroke-width="{LINE}" '
            f'stroke-linecap="round" stroke-linejoin="round">\n{body}\n  </g>\n</svg>\n')


def _svg_slot(body: str) -> str:
    """槽内实心档（概念2「珠面高光」）：米白竖向渐变 + 亮缘，深槽底上必须浅色实心才站得住。"""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" '
            f'viewBox="0 0 {SIZE} {SIZE}">\n'
            f'  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{SLOT_HI}"/><stop offset="0.5" stop-color="{SLOT_MID}"/>'
            f'<stop offset="1" stop-color="{SLOT_LOW}"/></linearGradient></defs>\n{body}\n</svg>\n')


def _raster(svg_path: Path, png_path: Path, size: int = SIZE) -> None:
    """用隔离空间的 resvg 把 SVG 栅格化到 size×size。

    ⚠ 必须走 CJS（`node -e` 默认模式）：ESM 的 `import` 不认 `NODE_PATH`（实测 ERR_MODULE_NOT_FOUND）。
    """
    js = (
        "const {Resvg}=require('@resvg/resvg-js');"
        "const {readFileSync,writeFileSync}=require('node:fs');"
        f"const s=readFileSync({str(svg_path)!r},'utf8');"
        f"writeFileSync({str(png_path)!r}, new Resvg(s,{{fitTo:{{mode:'width',value:{size}}}}}).render().asPng());"
    )
    env = {**os.environ, 'NODE_PATH': str(RESVG_NM)}
    subprocess.run(['node', '-e', js], check=True, env=env)


def main() -> None:
    DST.mkdir(parents=True, exist_ok=True)
    icons = {
        'ui_icon_heart_line': f'    <path d="{HEART}" />',
        'ui_icon_bead_line': (
            f'    <circle cx="80" cy="80" r="{BEAD_OUT_R}" />\n'
            f'    <circle cx="80" cy="80" r="{BEAD_HOLE_R}" />'),
    }
    for name, body in icons.items():
        svg = DST / f'{name}.svg'
        svg.write_text(_svg(body), encoding='utf-8')
        _raster(svg, DST / f'{name}.png')
        print(f'✅ {(DST / f"{name}.svg").relative_to(ROOT)} + .png')

    # 槽内实心档（WXG-T-560）：概念2「珠面高光」——拼豆圆片的孔用 evenodd 真镂空，
    # 叠进深槽底时孔位透出槽色；心形同步给亮缘，两枚材质一致。
    slot_icons = {
        'ui_icon_heart_slot': (
            f'  <path d="{HEART}" fill="url(#g)" stroke="{SLOT_EDGE}" stroke-width="4"/>\n'
            f'  <path d="{HEART}" fill="none" stroke="{SLOT_HI}" stroke-width="3" opacity="0.85" '
            f'transform="translate(0,3) scale(0.94) translate(5,5)"/>'),
        'ui_icon_bead_slot': (
            f'  <path fill-rule="evenodd" fill="url(#g)" stroke="{SLOT_EDGE}" stroke-width="4" '
            f'd="M 80,{80 - BEAD_OUT_R} a {BEAD_OUT_R},{BEAD_OUT_R} 0 1,0 0.01,0 Z '
            f'M 80,{80 - BEAD_HOLE_R} a {BEAD_HOLE_R},{BEAD_HOLE_R} 0 1,1 -0.01,0 Z"/>\n'
            f'  <circle cx="80" cy="80" r="{BEAD_OUT_R - 5}" fill="none" stroke="{SLOT_HI}" '
            f'stroke-width="3" opacity="0.8"/>\n'
            f'  <circle cx="80" cy="80" r="{BEAD_HOLE_R + 3}" fill="none" stroke="{SLOT_EDGE}" '
            f'stroke-width="2.5" opacity="0.55"/>'),
    }
    for name, body in slot_icons.items():
        svg = DST / f'{name}.svg'
        svg.write_text(_svg_slot(body), encoding='utf-8')
        _raster(svg, DST / f'{name}.png')
        print(f'✅ {(DST / f"{name}.svg").relative_to(ROOT)} + .png（槽内实心档）')


if __name__ == '__main__':
    main()
