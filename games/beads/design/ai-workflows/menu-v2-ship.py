#!/usr/bin/env python3
# v2 主界面资源 → Cocos 投放件（WXG-T-585）。
#
# 分工（本仓既有约定）：
#   · harness 走 `final/assets/menu/` **正本**（serve-harness 的 `/menu-assets/` 白名单映射），
#     本地无包体约束 ⇒ 不压缩、不缩放。
#   · Cocos 走 `cocos/assets/textures/` **投放件** ⇒ 本脚本的唯一产物，受主包红线约束。
#
# 配方（USER 2026-11-06 裁定「背景转 JPEG + 其余 pal-256」）：
#   · 背景（整屏 3D 写实、无 alpha）→ @1x 750×1334 + JPEG q85（pal-256 对写实渐变会出 banding）；
#   · **有同族两态**的件（start / prev / next 各 normal↔highlight）→ `ship()`：RGB 量化 + 原 alpha
#     贴回，同族互异保持率 98%。⛔ 不用 octree —— 八叉树把 alpha 算进色距，两态会被并色抹平，
#     上架包里「按下无反馈」= BD-61（该文件头有实测读数：保持率 13%）。
#   · **无同族态**的件（招牌 / 珠圈框 / 锁 / 通盖章）→ `ship_rgba_octree()`：省体积，无并色风险。
#   两个配方都取自现役 `quantize-cocos-textures.py`（⛔ 不复制量化代码：该文件尾部裸调 main()，
#   故「去掉尾行 main() 后 exec」——文件形状一变就当场报错）。
#
# 用法（仓库根）：
#   python3 games/beads/design/ai-workflows/menu-v2-ship.py            # 只报账，不落盘
#   python3 games/beads/design/ai-workflows/menu-v2-ship.py --apply    # 写投放件
#
# ⚠ 写完必须回 Cocos 编辑器 reimport（`.meta` 由编辑器维护，本脚本永不触碰，L1）；
#   未 reimport + 未重建 ⇒ 构建产物里仍是旧纹理，缺陷单不得提前关（判例 BD-61）。
import os
import sys

import numpy as np
from PIL import Image

SRC = 'games/beads/design/art/final/assets/menu'
DST = 'games/beads/cocos/assets/textures'
QPATH = 'games/beads/design/ai-workflows/quantize-cocos-textures.py'
BG_SIZE = (750, 1334)
BG_QUALITY = 85

# (正本相对 SRC, 投放件名, 目标逻辑尺寸 | None=保持原尺寸, 'jpg' | 'octree' | 'pair')
# 'pair' = 有同族两态，必须走航 `ship()` 保按下反馈（BD-61）
JOBS = [
    ('background/ui_menu_backdrop_figma@2x.png',  'ui_menu_backdrop.jpg',          BG_SIZE, 'jpg'),
    # `[WXG-T-585]` 甲案整张扩图（正本 1500×3500 = 750×1750 设计 @2x，上下各扩 208）：
    # 只被 baked 腿的「一次 blit」消费 ⇒ 缺件时自动回退三图/纯色（`menuBitmapReady` 门）。
    ('background/ui_menu_backdrop@2x.png',        'ui_menu_backdrop_expanded.jpg', (750, 1750), 'jpg'),
    ('background/ui_menu_signboard_figma@2x.png', 'ui_menu_signboard.png',         (549, 361), 'octree'),
    ('badges/ui_menu_frame@2x.png',               'ui_menu_arc_ring.png',          (518, 518), 'octree'),
    ('badges/ui_menu_lock@2x.png',                'ui_menu_badge_locked.png',      None,     'octree'),
    ('badges/ui_menu_seal@2x.png',                'ui_menu_seal.png',              (90, 90), 'octree'),
    ('buttons/ui_btn_start_normal@2x.png',        'ui_menu_cta.png',               (378, 179), 'pair'),
    ('buttons/ui_btn_start_highlight@2x.png',     'ui_menu_cta_highlight.png',     (378, 179), 'pair'),
    ('buttons/ui_btn_prev_normal@2x.png',         'ui_menu_arrow_left.png',        (110, 116), 'pair'),
    ('buttons/ui_btn_prev_highlight@2x.png',      'ui_menu_arrow_left_highlight.png', (110, 116), 'pair'),
    ('buttons/ui_btn_next_normal@2x.png',         'ui_menu_arrow_right.png',       (109, 116), 'pair'),
    ('buttons/ui_btn_next_highlight@2x.png',      'ui_menu_arrow_right_highlight.png', (109, 116), 'pair'),
]


def _load_quantize():
    """取现役两条配方（去掉尾行 main()）——配方单源，不复制。"""
    src = open(QPATH, encoding='utf-8').read()
    if not src.rstrip().endswith('main()'):
        raise SystemExit('❌ quantize-cocos-textures.py 尾部不再是裸调 main()，本脚本需同步')
    ns = {'__name__': 'q_import'}
    exec(src.rstrip()[: -len('main()')], ns)
    for k in ('ship_rgba_octree', 'ship'):
        if k not in ns:
            raise SystemExit(f'❌ 现役配方里找不到 {k}')
    return ns['ship_rgba_octree'], ns['ship']


def kb(p):
    return os.path.getsize(p) / 1024


def main():
    apply = '--apply' in sys.argv[1:]
    ship_rgba_octree, ship_pair = _load_quantize()
    os.makedirs(DST, exist_ok=True)

    rows, src_total, ship_total = [], 0.0, 0.0
    for rel, name, size, kind in JOBS:
        sp = os.path.join(SRC, rel)
        dp = os.path.join(DST, name)
        if not os.path.exists(sp):
            print(f'  ⚠️  缺正本：{rel} ⇒ 跳过')
            continue
        im = Image.open(sp).convert('RGBA')
        old = kb(dp) if os.path.exists(dp) else 0.0
        src_total += kb(sp)

        if size and im.size != size:
            im = im.resize(size, Image.LANCZOS)

        if kind == 'jpg':
            if apply:
                im.convert('RGB').save(dp, 'JPEG', quality=BG_QUALITY, optimize=True, progressive=True)
        elif apply:
            (ship_pair if kind == 'pair' else ship_rgba_octree)(im).save(dp, optimize=True)

        new = kb(dp) if (apply and os.path.exists(dp)) else 0.0
        ship_total += new
        rows.append((name, kb(sp), old, new))

    print(f'{"投放件":38s} {"正本KB":>8s} {"旧KB":>8s} {"新KB":>8s} {"Δ":>8s}')
    for name, s, o, n in rows:
        d = (n - o) if (o or n) else 0
        print(f'{name:38s} {s:8.1f} {o:8.1f} {n:8.1f} {d:+8.1f}')
    if apply:
        print(f'\n正本合计 {src_total:.1f} KB → 投放件合计 {ship_total:.1f} KB')
    else:
        print('\n（未落盘；加 --apply 写入）')


if __name__ == '__main__':
    main()
