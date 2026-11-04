"""Figma 顶栏图标位图 → 真矢量 SVG（复用 trace-icon-lineart.py 的追踪函数，零改写原脚本）。

输入：`temp/figma/layered-20261104/{23-6,23-13,23-20,23-27}.png`（Figma icon 层 @2x，透明底）。
输出：`proposals/.../btn-topbar-figma-20261104/` 下的白底原图、SVG path、160² 栅格预览。

用法：python3 games/beads/design/ai-workflows/trace-figma-icons.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
LIB = Path(__file__).with_name('trace-icon-lineart.py')
SRC = ROOT / 'temp/figma/layered-20261104'
DST = ROOT / 'games/beads/design/art/proposals/menu-3d-style-20261030/btn-topbar-figma-20261104'
ICONS = {'settings': '23-6', 'rank': '23-13', 'calendar': '23-20', 'skin': '23-27'}

# 只取函数与常量段：原脚本第 286 行起是历史批次主流程，执行它会覆写旧产物。
head = LIB.read_text().split('base1 = Image.open(')[0]
ns = {'__name__': '_trace_lib'}
exec(compile(head, str(LIB), 'exec'), ns)

DST.mkdir(parents=True, exist_ok=True)
for name, node in ICONS.items():
    rgba = Image.open(SRC / f'{node}.png').convert('RGBA')
    white = Image.new('RGBA', rgba.size, (255, 255, 255, 255))
    white.alpha_composite(rgba)
    src_white = DST / f'icon-{name}-source-white.png'
    white.convert('RGB').save(src_white)

    mask = ns['square_pad'](ns['to_mask'](src_white))
    loops = ns['to_unit'](ns['vectorize'](mask), 100.0, fit_r=ns['FIT_R'])
    assert loops, f'{name}: 追踪不到闭合轮廓'
    d = ns['svg_path'](loops)
    (DST / f'icon-{name}.svg').write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" '
        'width="100" height="100">\n'
        f'  <path fill="#5A2606" fill-rule="evenodd" d="{d}"/>\n</svg>\n')
    png = ns['raster'](loops, 160)
    assert (np.asarray(png.getchannel('A')) > 40).any(), f'{name}: 空矢量'
    png.save(DST / f'icon-{name}-2x-160.png')
    print(f'{name}: {len(loops)} loops / {len(d)} path chars')

print('OK', len(ICONS), 'SVG')
