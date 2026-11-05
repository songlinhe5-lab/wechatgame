#!/usr/bin/env python3
# 「拼豆小铺 → 千面拼豆」顶板 logo 合成器（WXG-T-584 ③a）。
#
# 为什么是合成而不是直接用云的出图：wan2.7 的 `bbox_list` 是**指引不是像素锁**
# （实测框外 maxΔ 仍 165，见 production/qa/wan27-token-plan-20261101.md）⇒ 框外一律回取
# 原图，木牌 / 双绳 / 蝴蝶结逐像素不变。蝴蝶结底沿 y=446 与旧字顶行 y≈455 重叠 ⇒
# 字区框必须上探到 y=430，同时把蝴蝶结矩形单独从原图取回（两段 paste 的次序即掩码）。
#
# 三步生成史（正本 = 本目录 generation-record.txt；三张云图同批留档）：
#   s4201  框 55,460,890,705 —— 上沿切进旧字顶行 ⇒ 留下一排半截旧珠，**弃**
#   s4202  框 50,430,895,715 + 蝴蝶结矩形回取 —— 四字逐字正确，风格一致
#   s4203  只框第一字 48,430,290,715 —— s4202 的「千」撇被画成横排（读作「干」）⇒ 单字重做
#
# 用法（仓库根）：
#   python3 games/beads/design/ai-workflows/logo-rename-compose.py           # 只跑判据，不落盘
#   python3 games/beads/design/ai-workflows/logo-rename-compose.py --apply   # 写 正本 + carrier + 投放件
#
# ⚠ 判据腿只在**正本尚未覆盖**时有意义（覆盖后 BASE 就是结果，保留区自然为 0）。
#   事后校核请看本目录 generation-record.txt 的留档读数，或 `git show HEAD~1:<正本路径>`。
#
# ⚠ 投放件写完必须回 Cocos 编辑器 reimport（`.meta` 归编辑器，本脚本永不触碰，L1）；
#   未 reimport + 未重建前，构建产物里仍是旧纹理 ⇒ 工单不得提前关（判例 BD-61）。
import os
import sys

import numpy as np
from PIL import Image

ROOT = 'games/beads/design/art'
BASE = f'{ROOT}/final/v1/assets/menu/ui_menu_logo.png'      # 在册真源（README §招牌原件行）
CARRIER = 'games/beads/assets/menu/ui_menu_logo.png'        # harness / web 运行时同源副本
SHIP = 'games/beads/cocos/assets/textures/ui_menu_logo.png'  # Cocos 投放件（P256 + tRNS）
PROP = f'{ROOT}/proposals/logo-rename-20261105'

# (云图, 取用矩形)；按序 paste = 后段覆盖前段的重叠区。
STEPS = [(f'{PROP}/s4202.png', (50, 430, 895, 715)),
         (f'{PROP}/s4203.png', (48, 430, 290, 715))]
BOW = (348, 288, 622, 456)          # 蝴蝶结逐像素取回原图（实测 pink 底沿 446 + 余量）

# 投放件配方 = **现役 octree**（`quantize-cocos-textures.py::ship_rgba_octree`），⛔ 不用同文件的 `ship()`：
#   · `ship()`（RGB 量化 + 原 alpha 贴回）存 RGBA ⇒ 同一张图 **342.7 KB vs 107.1 KB**（+225 KB）；
#   · 该新配方是为「同族两态被并色抹平」（BD-61）设的，**本件无同族态** ⇒ 那条风险不适用；
#   · 实测本件走 octree 的 alpha 并档行为与在册件**逐数全等**（alpha=0 像素数均 365107）⇒ 无口径漂移、无视觉回归。
#  不能直接 import 那个文件 —— 它尾部**裸调 main()**（无 __main__ 守卫），import 即跑它的 CLI。
# ⇒ 取「去掉尾行 main() 后 exec」：配方仍单源，文件形状一变就当场报错，⛔ 不复制一份量化代码。
_QPATH = 'games/beads/design/ai-workflows/quantize-cocos-textures.py'


def _load_quantize():
    src = open(_QPATH, encoding='utf-8').read()
    stripped = src.replace('\nmain()\n', '\n')
    assert stripped != src, f'{_QPATH} 尾部不再是裸调 main() ⇒ 配方已改，本脚本需重读'
    ns = {'__name__': 'quantize_cocos_textures'}
    exec(compile(stripped, _QPATH, 'exec'), ns)
    return ns


_q = _load_quantize()
ship, mdiff, nbytes = _q['ship_rgba_octree'], _q['mdiff'], _q['nbytes']


def compose():
    out = Image.open(BASE).convert('RGBA')
    for path, box in STEPS:
        out.paste(Image.open(path).convert('RGBA').crop(box), box)
    out.paste(Image.open(BASE).convert('RGBA').crop(BOW), BOW)
    return out


def check(out):
    base = Image.open(BASE).convert('RGBA')
    a, b = np.array(base).astype(int), np.array(out).astype(int)
    keep = np.ones(a.shape[:2], bool)
    for _, box in STEPS:
        keep[box[1]:box[3], box[0]:box[2]] = False
    keep[BOW[1]:BOW[3], BOW[0]:BOW[2]] = False
    moved = int((np.abs(a - b).sum(2) > 0)[keep].sum())
    al = np.array(out)[:, :, 3]
    ship_im = ship(out)
    old_kb = os.path.getsize(SHIP) / 1024
    new_kb = nbytes(ship_im) / 1024
    # 投放件的 alpha 行为必须与在册同构（octree 会把 alpha 算进色距 ⇒ 半透明边并档，
    # 这是在册件已有的代价；只验「没变得更差」，⛔ 不拿它当「alpha 无损」报）。
    a_delta = int(np.abs(np.array(ship_im.convert('RGBA'))[:, :, 3].astype(int)
                         - np.array(out)[:, :, 3].astype(int)).max())
    print(f'保留区被改动像素 = {moved}（判据 = 0）')
    print(f'真透明自证：alpha=0 占比 {(al == 0).mean() * 100:.2f}%、极值 {al.min()}..{al.max()}'
          f'（⛔ 只查 mode 会被 RGBA 假透明骗过，见 model-matrix §假透明三形态）')
    print(f'投放件体积 {old_kb:.1f}K → {new_kb:.1f}K（Δ {new_kb - old_kb:+.1f}K）')
    print(f'投放件距正本 {mdiff(ship_im, out):.2f}（在册读数 1.98）· alpha 并档 maxΔ = {a_delta}')
    ok = moved == 0 and (al == 0).any() and new_kb <= old_kb
    return ok, ship_im


def main():
    out = compose()
    ok, ship_img = check(out)
    if '--apply' not in sys.argv:
        print('（只判据；加 --apply 才落盘）')
        return 0 if ok else 1
    if not ok:
        print('❌ 判据未过 ⇒ 不落盘')
        return 1
    out.save(BASE)
    out.save(CARRIER)
    ship_img.save(SHIP, 'PNG')
    back = Image.open(SHIP).convert('RGBA')
    if np.abs(np.array(back).astype(int) - np.array(ship_img.convert('RGBA')).astype(int)).max() != 0:
        print('❌ 投放件回读与产出逐位不一致 ⇒ 不落账')
        return 1
    print('✅ 已写 正本 / carrier / 投放件（回读逐位一致）→ **记得回编辑器 reimport**')
    return 0


if __name__ == '__main__':
    sys.exit(main())
