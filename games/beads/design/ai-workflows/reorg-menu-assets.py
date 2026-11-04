"""菜单资源 2x 重组（WXG-T-576）：按用途分 4 个子目录 + `@2x` 后缀 + 两件严格 2x 重采样。

零模型、零重绘；唯一像素操作 = 两件高清源图按「运行时设计 px × 2」LANCZOS 降采样，
原高清件先归档到 proposals/ 作母版。Cocos 投放侧保持扁平原名，靠 asset-map.json 对齐。

用法：python3 games/beads/design/ai-workflows/reorg-menu-assets.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
SRC = ROOT / 'games/beads/design/art/final/assets/menu'
ARCHIVE = ROOT / 'games/beads/design/art/proposals/menu-3d-style-20261030/badge-source-20261104'

GROUPS = {
    'background': ['ui_menu_backdrop_figma', 'ui_menu_signboard_figma'],
    'buttons': [
        'ui_btn_circle_normal', 'ui_btn_circle_pressed',
        'ui_btn_prev_normal', 'ui_btn_prev_highlight',
        'ui_btn_next_normal', 'ui_btn_next_highlight',
        'ui_btn_start_normal', 'ui_btn_start_highlight',
    ],
    'icons': ['ui_icon_settings', 'ui_icon_rank', 'ui_icon_calendar', 'ui_icon_skin'],
    'badges': ['ui_menu_badge_locked', 'ui_menu_badge_progress', 'ui_menu_seal_cleared'],
}
# 目标 = 最后一次在册的运行时设计 px × 2（比例与源图吻合，零变形）。
RESIZE = {
    'ui_menu_badge_progress': (171 * 2, 210 * 2),   # MENU_PROGRESS（WXG-T-566 前）
    'ui_menu_seal_cleared': (101 * 2, 140 * 2),     # MENU_SEAL（现行）
}

ARCHIVE.mkdir(parents=True, exist_ok=True)
for name, target in RESIZE.items():
    src = SRC / f'{name}.png'
    arc = ARCHIVE / f'{name}-source.png'
    if src.exists():
        arc.write_bytes(src.read_bytes())   # 续跑时源图可能已被上一轮移走
    else:
        assert arc.exists(), arc

mapping = {}
for group, names in GROUPS.items():
    (SRC / group).mkdir(exist_ok=True)
    for name in names:
        src = SRC / f'{name}.png'
        rel = f'{group}/{name}@2x.png'
        dst = SRC / rel
        if dst.exists() and not src.exists():   # 可续跑：上一轮已处理完
            mapping[f'{name}.png'] = rel
            continue
        assert src.exists(), src
        assert not dst.exists(), dst
        if name in RESIZE:
            target = RESIZE[name]
            # 2x 定义要求目标为偶数；源图可为奇数（那正是它非 2x 的证据）。
            assert target[0] % 2 == 0 and target[1] % 2 == 0, (name, target)
            im = Image.open(src).convert('RGBA')
            im.resize(target, Image.LANCZOS).save(dst)
            src.unlink()
            print(f'{name}: {im.size} -> {target} (LANCZOS)')
        else:
            src.rename(dst)
        mapping[f'{name}.png'] = rel

assert not list(SRC.glob('*.png')), '根目录仍有扁平 PNG'
assert len(mapping) == 17, len(mapping)
(SRC / 'asset-map.json').write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + '\n')
print('OK', len(mapping), 'files in', len(GROUPS), 'groups')
