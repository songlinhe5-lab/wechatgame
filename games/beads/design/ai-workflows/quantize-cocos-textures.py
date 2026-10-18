#!/usr/bin/env python3
# 从设计正本生成 Cocos 投放件（BD-61 修复腿）。
#
# 为什么不用现役配方：现役投放件 = PIL **RGBA** FASTOCTREE(256)。八叉树把 alpha 一起算进色距 ⇒
# 256 格预算被「同色不同透明」的组合吃掉，低幅差（按下态那条下沉暗边）最先被合并掉。
# 实测（`ui_btn_arrow_bg_pressed`）：该配方下投放件距自己正本 16.39，反而大于距 normal 正本 3.16，
# 同族两态互异从 17.58 塌到 2.28（保持率 13%）⇒ 上架包里 ◀▶ 按下无反馈 = BD-61。
# 本脚本改用「**RGB** FASTOCTREE(256) + 原 alpha 贴回」：同族保持率 98%，小尺寸件体积 +0.4 KB。
#
# 用法（仓库根）：
#   python3 games/beads/design/ai-workflows/quantize-cocos-textures.py --check [件名.png ...]
#   python3 games/beads/design/ai-workflows/quantize-cocos-textures.py <件名.png ...>
#   python3 games/beads/design/ai-workflows/quantize-cocos-textures.py --selftest
# 不带件名的 --check = 体检 `final/assets/menu` 全部同名件。
#
# ⚠ 写完必须回 Cocos 编辑器 reimport：`.meta` 由编辑器维护，本脚本永不触碰（L1）；
#   未 reimport 前，构建产物里仍是旧纹理 ⇒ 缺陷单不得提前关。
import io
import os
import sys

import numpy as np
from PIL import Image

SRC = 'games/beads/design/art/final/assets/menu'
DST = 'games/beads/cocos/assets/textures'
KEEP_MIN = 0.5   # 同族两态互异保持率下限（现役 arrow pressed 实测 0.13 ⇒ 判红）
COLORS = 256     # 与现役投放件同档


def rgba(path):
    return Image.open(path).convert('RGBA')


def arr(im):
    return np.asarray(im.convert('RGBA'), dtype=np.int16)


def mdiff(a, b):
    """两图 RGB 均差（0–255）。"""
    return float(np.abs(arr(a) - arr(b))[..., :3].mean())


def ship_rgba_octree(im, colors=COLORS):
    """现役配方（只用于对照/自测，⛔ 不再作为产出）。"""
    return im.quantize(colors=colors, method=Image.FASTOCTREE)


def ship(im, colors=COLORS):
    """投放件配方：RGB 量化 + 原 alpha 贴回。"""
    out = im.convert('RGB').quantize(
        colors=colors, method=Image.FASTOCTREE).convert('RGBA')
    out.putalpha(im.split()[-1])
    return out


def pair_of(name):
    """同族另一态（本仓命名并存两种：`X` ↔ `X_pressed`、`X_normal` ↔ `X_pressed`）。
    返回第一个存在的候选；无对应态 ⇒ None。"""
    stem = name[:-4]
    if stem.endswith('_pressed'):
        base = stem[:-len('_pressed')]
        cands = [base + '_normal.png', base + '.png']
    elif stem.endswith('_normal'):
        cands = [stem[:-len('_normal')] + '_pressed.png']
    else:
        cands = [stem + '_pressed.png']
    return next((c for c in cands if os.path.exists(os.path.join(SRC, c))), None)


def nbytes(im):
    buf = io.BytesIO()
    im.save(buf, 'PNG')
    return buf.tell()


def report(name, write):
    sp, dp = os.path.join(SRC, name), os.path.join(DST, name)
    if not os.path.exists(sp):
        print(f'  ❌ {name}：正本不存在（{sp}）')
        return False
    src = rgba(sp)
    new = ship(src)
    lines = [f'  {name}  {src.size[0]}×{src.size[1]}']
    ok = True
    if os.path.exists(dp):
        cur = rgba(dp)
        lines.append(
            f'    在册：距正本 {mdiff(cur, src):5.2f}｜= 现役配方? {"是" if mdiff(ship_rgba_octree(src), cur) == 0 else "否"}'
        )
    else:
        lines.append('    在册：无（新增）')
    pn = pair_of(name)
    psp = os.path.join(SRC, pn) if pn else ''
    pdp = os.path.join(DST, pn) if pn else None
    if pn and os.path.exists(psp):
        truth = mdiff(src, rgba(psp))
        kept_new = mdiff(new, ship(rgba(psp)))
        rate = kept_new / truth if truth else 1.0
        lines.append(
            f'    同族 {pn}：真差 {truth:.2f} → 新产出 {kept_new:.2f}（保持率 {rate:.2f}）')
        if rate < KEEP_MIN:
            ok = False
            lines.append(f'    ❌ 新产出保持率 < {KEEP_MIN} ⇒ 态差会被抹平')
        if os.path.exists(dp) and os.path.exists(pdp) and truth:
            old_rate = mdiff(rgba(dp), rgba(pdp)) / truth
            lines.append(f'    在册保持率 {old_rate:.2f}' + ('' if old_rate >=
                         KEEP_MIN else f'  ❌ < {KEEP_MIN} ⇒ 在册件态差已被抹平（BD-61 型）'))
            if old_rate < KEEP_MIN and not write:   # 写盘模式是来修它的，不把旧件再判一遍
                ok = False
    lines.append(
        f'    体积 {os.path.getsize(dp) / 1024 if os.path.exists(dp) else 0:6.1f}K → {nbytes(new) / 1024:.1f}K')
    print('\n'.join(lines))
    if write:
        new.save(dp, 'PNG')
        back = rgba(dp)
        if np.abs(arr(back) - arr(new)).max() != 0:
            print('    ❌ 回读与产出逐位不一致 ⇒ 不落账')
            return False
        print('    ✅ 已写入（回读逐位一致）→ **记得回编辑器 reimport**')
    return ok


def selftest():
    """配方有效性自检：现役配方必须抹平 arrow 两态、新配方必须保住（PIL 行为变了就红）。"""
    p = rgba(os.path.join(SRC, 'ui_btn_arrow_bg_pressed.png'))
    n = rgba(os.path.join(SRC, 'ui_btn_arrow_bg_normal.png'))
    truth = mdiff(p, n)
    old = mdiff(ship_rgba_octree(p), ship_rgba_octree(n))
    new = mdiff(ship(p), ship(n))
    assert truth > 8, f'正本两态本身就不互异（{truth}）⇒ 样本失效'
    assert old / truth < 0.3, f'现役配方不再抹平态差（{old / truth:.2f}）⇒ 本脚本的动因需重述'
    assert new / truth > 0.9, f'新配方保不住态差（{new / truth:.2f}）⇒ 换配方'
    assert ship(p).mode == 'RGBA' and nbytes(ship(p)) < 4096, '产出形态/体积异常'
    print(
        f'selftest OK：真差 {truth:.2f}｜现役 {old:.2f}（{old / truth:.2f}）｜新 {new:.2f}（{new / truth:.2f}）')


def main():
    args = sys.argv[1:]
    if '--selftest' in args:
        selftest()
        return
    write = '--check' not in args
    names = [a for a in args if not a.startswith('--')]
    if not names:
        if write:
            print('用法：写盘模式必须逐个点名件（不提供全量写盘，防误覆盖）')
            return
        names = sorted(f for f in os.listdir(SRC) if f.endswith('.png'))
    print(f'投放件生成（{"写盘" if write else "只体检"}）：{SRC} → {DST}')
    bad = [n for n in names if not report(n, write)]
    if bad:
        print(f'\n❌ {len(bad)} 件未达标：{", ".join(bad)}')
        sys.exit(1)
    print('\n✅ 全部达标')


main()
