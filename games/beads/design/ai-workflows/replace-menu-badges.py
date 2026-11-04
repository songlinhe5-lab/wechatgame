"""badges 三件套替换（WXG-T-577）：Figma v2 锁 / 框 / 通关，补 1px 透明边到偶数尺寸。

零模型、零重绘、零重采样：只在右/下补 1px 全透明边，原内容像素逐点不变。
用法：python3 games/beads/design/ai-workflows/replace-menu-badges.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
ELEM = ROOT / 'games/beads/design/art/proposals/menu-3d-style-20261030/figma-elements-20261104'
DST = ROOT / 'games/beads/design/art/final/assets/menu/badges'

JOBS = [
    ('ui_menu_badge_locked_figma.png', 'ui_menu_lock@2x.png', (192, 260)),   # 47:19
    ('ui_menu_frame_pearls.png', 'ui_menu_frame@2x.png', (854, 854)),        # 46:21
    ('ui_menu_seal_cleared_figma.png', 'ui_menu_seal@2x.png', (180, 180)),   # 47:20
]

for src, name, target in JOBS:
    out_path = DST / name
    if out_path.exists():
        assert Image.open(out_path).size == target, out_path
        print(name, 'exists, skip')
        continue
    im = Image.open(ELEM / src).convert('RGBA')
    assert target[0] - im.width in (0, 1) and target[1] - im.height in (0, 1), (src, im.size)
    assert target[0] % 2 == 0 and target[1] % 2 == 0, target
    out = Image.new('RGBA', target, (0, 0, 0, 0))
    out.paste(im, (0, 0))
    a = np.asarray(im)
    b = np.asarray(out)
    assert (a == b[:im.height, :im.width]).all(), src          # 原内容逐点不变
    assert (b[im.height:, :] == 0).all() and (b[:, im.width:] == 0).all(), src  # 新增边全透明
    out.save(out_path)
    print(name, im.size, '->', target)

print('OK', len(JOBS), 'badges')
