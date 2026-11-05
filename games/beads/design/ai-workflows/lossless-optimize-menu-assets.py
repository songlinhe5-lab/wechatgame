#!/usr/bin/env python3
"""
lossless-optimize-menu-assets.py — 菜单设计正本的**无损** PNG 重编码（WXG-T-580）。

用途
----
`design/art/final/assets/menu/**` 下的 PNG 由 Figma 直接导出，压缩参数不可控。
本脚本只做**无损重压缩**（PIL optimize + compress_level=9，逐 filter 组合取最小），
⛔ 不缩放、不量化、不改色深、不重绘 —— 解出来的像素必须与原件**逐字节相同**。

同步腿
------
`asset-map.json` 里映射到已投放件的正本，压完直接拷到 `cocos/assets/textures/`，
保证「投放件 == 正本」字节相同（否则 `check-cocos-mask` 的归属腿会失配）。

⛔ 不碰的两类
-------------
· `ui_menu_badge_locked.png` / `ui_menu_arc_ring.png` 的**投放件**是 pal-256 有损量化件
  （主包余量只有几 KB，无损会爆）；本脚本只压它们的**正本**，投放件保持量化不动。
· 未在 `asset-map.json` 登记的件只压正本、不入包。

用法
----
    python3 lossless-optimize-menu-assets.py            # dry-run，只打印
    python3 lossless-optimize-menu-assets.py --apply     # 落盘

退出码：0 = 成功（含无收益跳过）；1 = 断言失败（像素变了 / 变大了）。
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys

from PIL import Image
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
BEADS = os.path.dirname(os.path.dirname(HERE))          # games/beads
MENU_SRC = os.path.join(BEADS, 'design', 'art', 'final', 'assets', 'menu')
ASSET_MAP = os.path.join(MENU_SRC, 'asset-map.json')
COCOS_TEX = os.path.join(BEADS, 'cocos', 'assets', 'textures')

# 这些投放件是**有损量化**产物，⛔ 不跟着正本同步（同步会撑爆主包）。
QUANTIZED_DEPLOY = {'ui_menu_badge_locked.png', 'ui_menu_arc_ring.png'}


def lossless_bytes(im: Image.Image) -> bytes:
    """逐个 PNG filter 重编码，返回最小的那一份（全部无损）。"""
    best: bytes | None = None
    for flt in (None, 0, 1, 2, 3, 4):
        buf = io.BytesIO()
        kw = {'format': 'PNG', 'optimize': True, 'compress_level': 9}
        if flt is not None:
            kw['filter'] = flt
        try:
            im.save(buf, **kw)
        except Exception:
            continue
        data = buf.getvalue()
        if best is None or len(data) < len(best):
            best = data
    if best is None:
        raise RuntimeError('PNG 重编码全部失败')
    return best


def pixels(blob_or_path) -> np.ndarray:
    src = io.BytesIO(blob_or_path) if isinstance(blob_or_path, bytes) else blob_or_path
    with Image.open(src) as im:
        return np.array(im.convert('RGBA'), dtype=np.uint8)


def png_files(root: str) -> list[str]:
    out = []
    for dirpath, _dirnames, filenames in os.walk(root):
        for fn in filenames:
            if fn.lower().endswith('.png'):
                out.append(os.path.join(dirpath, fn))
    return sorted(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='真正写盘（缺省 dry-run）')
    args = ap.parse_args()

    asset_map: dict[str, str] = json.load(open(ASSET_MAP, encoding='utf-8'))
    # 正本 → 投放件名（同一正本可能被多件引用，取第一个）
    deploy_of = {rel: cocos for cocos, rel in asset_map.items()}

    files = png_files(MENU_SRC)
    if not files:
        print(f'⛔ 没找到 PNG：{MENU_SRC}')
        return 1

    print(f"菜单正本无损重编码 — {len(files)} 件｜{'APPLY' if args.apply else 'DRY-RUN'}")
    print(f"{'件':<44}{'原':>9}{'压缩后':>9}{'省':>8}  投放")
    print('-' * 86)

    total_before = total_after = 0
    saved_deploy = 0
    problems: list[str] = []

    for path in files:
        rel = os.path.relpath(path, MENU_SRC).replace(os.sep, '/')
        before_bytes = os.path.getsize(path)
        with Image.open(path) as im:
            im.load()
            new_blob = lossless_bytes(im)

        # 判据 ①：逐像素不变（真无损的唯一硬证）
        if not np.array_equal(pixels(path), pixels(new_blob)):
            problems.append(f'{rel}: 像素发生变化（⛔ 不是无损）')
            continue
        # 判据 ②：不许变大
        after = len(new_blob)
        if after > before_bytes:
            print(f'{rel:<44}{before_bytes:>9}{after:>9}{"—":>8}  跳过（重编码反而更大）')
            total_before += before_bytes
            total_after += before_bytes
            continue

        total_before += before_bytes
        total_after += after
        cocos = deploy_of.get(rel)
        # 同步腿只在两条件同时成立时跑：① 不是有损量化件 ② 投放位**真的存在**
        # （asset-map 登记了但没投放的件，⛔ 不许当成「要同步」——那等于悄悄入包）。
        deployed = cocos is not None and os.path.exists(os.path.join(COCOS_TEX, cocos))
        sync = deployed and cocos not in QUANTIZED_DEPLOY
        if sync:
            saved_deploy += before_bytes - after
        if sync:
            tag = '→ ' + cocos
        elif deployed:
            tag = '（量化件，只压正本）'
        else:
            tag = '未投放'
        print(f'{rel:<44}{before_bytes:>9}{after:>9}{(before_bytes - after) / before_bytes * 100:>7.1f}%  {tag}')

        if args.apply:
            with open(path, 'wb') as fh:
                fh.write(new_blob)
            if sync:
                dst = os.path.join(COCOS_TEX, cocos)
                if not os.path.exists(dst):
                    problems.append(f'{cocos}: 投放位不存在（asset-map 指向了不存在的文件）')
                    continue
                with open(dst, 'wb') as fh:
                    fh.write(new_blob)

    print('-' * 86)
    print(f"{'合计 ' + str(len(files)) + ' 件':<44}{total_before:>9}{total_after:>9}"
          f"{(total_before - total_after) / total_before * 100:>7.1f}%"
          f"   省 {total_before - total_after} B")
    print(f'其中同步进包（已投放非量化件）省 {saved_deploy} B ≈ {saved_deploy / 1024:.1f} KB')

    if problems:
        print('\n⛔ 断言失败：')
        for p in problems:
            print('  ·', p)
        return 1
    print('\n✅ 全部逐像素不变，且无一变大')
    return 0


if __name__ == '__main__':
    sys.exit(main())
