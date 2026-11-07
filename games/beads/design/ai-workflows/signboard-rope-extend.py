#!/usr/bin/env python3
# v2 招牌绳加长（WXG-T-585 续，用户 2026-11-07 令「请导出新的招牌资源」）。
#
# 动因：v3 落位 `signTop = boardTop − boardOff`，`boardOff` 是**图内绳高**。实测 5 档 + 21:9 里
# X-14 / 灵动岛 / 16 Pro Max 三档绳顶与屏顶之间分别留 12 / 21 / 10 设计 px 的木墙（悬空）。
# 要让全档 `signTop = 0`，绳高需 ≥ max(`st` + `safeGap`) = 103 + 12 = 115 ⇒ 取 118（余量 3）。
#
# 做法（⛔ 不重绘整图、不走云端）：整图**向下平移 EXT**，顶部 EXT 行用「原图 rows 1..EXT 的
# 垂直镜像」补齐 —— 接缝处 `newTop[EXT-1] = a[1]` 紧邻 `a[0]`，一阶连续，无断口；
# 镜像只发生在**绳区**（原图 y<EXT 时板体尚未开始，非绳列本就 alpha=0）。
# 代价：镜像段纹理方向反转；麻绳编织在 0.5 缩放下不可辨（以 6 档效果图比对为准）。
#
# ⚠ 换图后必须同批改 4 处：`MENU_PLACEMENT.boardOff` / `MENU_PLACEMENT.signH` / `MENU_V2.sign.h`
#   （games/beads/src/config/tuning/menu.ts）+ `menu-v2-ship.py` 的 JOBS 招牌目标尺寸。
# ⚠ Cocos 投放件 `.meta` 里的 size 由编辑器 reimport 更新（L1，本脚本永不触碰）。
#
# 用法（仓库根）：
#   python3 games/beads/design/ai-workflows/signboard-rope-extend.py           # 只跑判据 + 出预览
#   python3 games/beads/design/ai-workflows/signboard-rope-extend.py --apply    # 写正本（原件先备份）
import os
import shutil
import sys

import numpy as np
from PIL import Image

ROOT = 'games/beads/design/art'
TARGET = f'{ROOT}/final/assets/menu/background/ui_menu_signboard_figma@2x.png'
BATCH = f'{ROOT}/proposals/signboard-rope-20261107'
BACKUP = f'{BATCH}/base-before-rope-extend.png'
PREVIEW = '/tmp/signboard-rope-preview.png'

EXT = 48                    # 加长量（图 px）= 24 设计 px
BOARD_ROW_OLD = 188         # 板体上沿（图内，原图）；换图必须同批重扫
BOARD_ROW_NEW = BOARD_ROW_OLD + EXT


def extend(a: np.ndarray) -> np.ndarray:
    """整图下移 EXT，顶部补镜像行。返回新数组（高 +EXT）。"""
    h, w = a.shape[:2]
    out = np.zeros((h + EXT, w, a.shape[2]), dtype=a.dtype)
    out[EXT:] = a
    # newTop[y] = a[EXT - y]，y ∈ [0, EXT) ⇒ 末行 = a[1]，与 a[0] 相邻
    for y in range(EXT):
        out[y] = a[EXT - y]
    return out


def row_alpha_widths(a: np.ndarray) -> np.ndarray:
    return (a[..., 3] > 16).sum(axis=1)


def main():
    apply = '--apply' in sys.argv[1:]
    if not os.path.exists(TARGET):
        raise SystemExit(f'❌ 缺输入：{TARGET}')

    base = np.array(Image.open(TARGET).convert('RGBA'))
    h, w = base.shape[:2]
    new = extend(base)

    # ── 判据 ────────────────────────────────────────────────────────────
    same = int(np.abs(new[EXT:].astype(int) - base.astype(int)).max())
    w_old = row_alpha_widths(base)
    w_new = row_alpha_widths(new)

    def board_row(widths):
        """板体上沿 = 首次出现「宽 > 400 图 px」的行（与 tuning 注释同口径）。"""
        hits = np.where(widths > 400)[0]
        return int(hits[0]) if len(hits) else -1

    b_old, b_new = board_row(w_old), board_row(w_new)

    # 接缝自证：延伸段末行 ↔ 原图首行，只在两侧都实心（alpha>200）的像素上比 RGB。
    # 基准 = 原图绳区（y<96）内部相邻行 maxΔ —— 接缝不得超过它，否则就是新造的断口。
    solid = (new[EXT][..., 3] > 200) & (new[EXT - 1][..., 3] > 200)
    seam = int(np.abs(new[EXT][solid].astype(int) - new[EXT - 1][solid].astype(int)).max()) if solid.any() else -1
    m = base[:96, :, 3] > 200
    d = np.abs(np.diff(base[:96, :, :3].astype(int), axis=0))
    inner_max = int(d[m[1:] & m[:-1]].max())
    alpha0 = float((new[..., 3] == 0).mean() * 100)

    # 延长段只许有绳：新图顶部 EXT 行里 alpha>16 的列必须全部落在两绳 x 区间内
    ROPE_X = [(140, 206), (872, 936)]
    cols = np.where((new[:EXT, :, 3] > 16).any(axis=0))[0]
    leak = [int(c) for c in cols if not any(lo <= c <= hi for lo, hi in ROPE_X)]

    print(f'尺寸              = {w}×{h} → {new.shape[1]}×{new.shape[0]}   （期望 {w}×{h + EXT}）')
    print(f'原图区 maxdiff    = {same}   （须 0：板体及以下逐像素不变）')
    print(f'板体上沿（图内 y）= {b_old} → {b_new}   （读数，+{EXT} 即对齐）')
    print(f'接缝相邻行 maxΔ   = {seam}   （基准 = 原图绳区内部 maxΔ {inner_max}，须 ≤ 它）')
    print(f'延长段越界列      = {len(leak)}   （须 0：只许两绳 x∈{[f"{a}..{b}" for a, b in ROPE_X]}）')
    print(f'真透明自证        = alpha=0 占比 {alpha0:.2f}%')

    if same != 0:
        raise SystemExit('❌ 原图区被改动 ⇒ 拒绝落盘')
    if leak:
        raise SystemExit(f'❌ 延长段溢出绳区（{len(leak)} 列，如 {leak[:8]}）⇒ 拒绝落盘')
    if b_new - b_old != EXT:
        raise SystemExit(f'❌ 板体上沿位移 {b_new - b_old} ≠ {EXT} ⇒ 拒绝落盘')
    if seam > inner_max:
        raise SystemExit(f'❌ 接缝 maxΔ {seam} > 原图内部 {inner_max} ⇒ 出现断口，拒绝落盘')

    im = Image.fromarray(new)
    if not apply:
        im.save(PREVIEW)
        im.crop((0, 0, w, 300)).save('/tmp/signboard-rope-preview-top.png')
        print(f'（未落盘；预览 {PREVIEW}，顶部特写 /tmp/signboard-rope-preview-top.png）')
        return

    os.makedirs(BATCH, exist_ok=True)
    if not os.path.exists(BACKUP):
        shutil.copy2(TARGET, BACKUP)
        print(f'原件已备份 → {BACKUP}')
    im.save(TARGET)
    print(f'✅ 正本已改写 → {TARGET}（{new.shape[1]}×{new.shape[0]}，{os.path.getsize(TARGET) / 1024:.1f} KB）')


if __name__ == '__main__':
    main()
