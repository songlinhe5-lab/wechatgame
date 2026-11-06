#!/usr/bin/env python3
# v2 招牌改字合成器：「拼豆小铺 → 千面拼豆」（WXG-T-585）。
#
# 与 v1 同名工序（`logo-rename-compose.py`，WXG-T-584 ③a）同构，但底图换成 **v2 Figma 招牌**
# （3D 写实：木牌 + 双麻绳 + 浮雕字 + 彩珠 + 白雏菊）。三步同源：
#   ① 云端 `wan2.7-image` i2i + `bbox_list` 只重绘四字框（唯一的「3D 写实改字」可用腿，
#      判据见 `model-matrix-changelog.md §7.4`：qwen 线静默忽略 bbox、erase 会顺着残留续画）；
#   ② 框外**逐像素回取原图**（bbox 是「指引不是像素锁」，实测框外 maxΔ 165）；
#   ③ 装饰件（彩珠 / 白花 / 绿叶）按**颜色区间 mask** 回取 —— ⛔ 不能用矩形回取：新字比旧字
#      更靠右，矩形会把「豆」字右下角整块切掉（本批实测）。
#
# 为什么装饰件要 mask 而不是矩形（本批判负的教训）：
#   v1 只回取蝴蝶结（矩形）就够，因为字位几乎不动。v2 的新字向右扩了约 30 px，
#   右下白花与「豆」字严格重叠 ⇒ 矩形回取 = 把字切成方块。改用「装饰色区间」后
#   只贴回珠/花/叶的像素，字与木纹保持云端版本，接缝问题消失。
#
# 用法（仓库根）：
#   python3 games/beads/design/ai-workflows/signboard-rename-v2-compose.py           # 只跑判据，不落盘
#   python3 games/beads/design/ai-workflows/signboard-rename-v2-compose.py --apply   # 写正本（原件先备份）
#
# ⚠ 判据腿只在**正本尚未覆盖**时有意义（覆盖后 BASE 就是结果）。事后校核看
#   `proposals/signboard-rename-v2-20261106/generation-record.txt` 的留档读数。
# ⚠ 写完必须回 Cocos 编辑器 reimport（`.meta` 归编辑器，本脚本永不触碰，L1）；
#   未 reimport + 未重建前，构建产物里仍是旧字（判例 BD-61）。
import os
import shutil
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = 'games/beads/design/art'
# 正本 = Figma v2 导出件（**就地改写**：`assets/menu/` 是 v2 工作区、文件名保持不变，
# 见 `final/README.md` 顶部版本分界；原件在 --apply 时备份进批次目录）
TARGET = f'{ROOT}/final/assets/menu/background/ui_menu_signboard_figma@2x.png'
BATCH = f'{ROOT}/proposals/signboard-rename-v2-20261106'
CLOUD = f'{BATCH}/s5101.png'
BACKUP = f'{BATCH}/base-figma-before-rename.png'

# 云端重绘框（底图绝对像素）。四字实测：x 85..1005 / y 285..570（含浮雕投影）
BOX = (70, 265, 1020, 580)

# 装饰件**宽松矩形** —— 只用作「颜色 mask 的作用域」，⛔ 不是回取框。
# 顺序无关；矩形内不属于装饰色的像素一律保留云端版本。
DECO_SCOPE = [
    (175, 240, 270, 340),    # 上排粉珠
    (555, 220, 645, 315),    # 上排蓝珠
    (695, 245, 795, 345),    # 上排黄珠
    (905, 255, 1050, 400),   # 右上绿叶 + 绿珠
    (5, 430, 100, 525),      # 左边粉珠
    (60, 490, 150, 595),     # 左下绿珠
    (655, 505, 755, 605),    # 下排蓝珠
    (815, 455, 1098, 674),   # 右下白雏菊 + 绿叶（与「豆」字重叠，故必须走 mask）
]

# 结构性硬回取：云图在木牌右端画出一块边缘笔直的暗斑（框内瑕疵）⇒ 原样盖回。
HARD_RESTORE = [(990, 490, 1098, 660)]

# 装饰色区间（PIL HSV：H/S/V 均为 0..255）。字面米黄落在 H 20~23 / S 55~85 / V 215~245，
# 被三条规则**全部排除** ⇒ 回取不会碰字。
def deco_mask(hsv):
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    bead = ((H > 30) | (H < 8)) & (S >= 95) & (V >= 60)        # 粉/蓝/黄/绿珠（木色 H 10~25 被排除）
    white = (S <= 45) & (V >= 195)                              # 白雏菊花瓣
    leaf = (H >= 55) & (H <= 115) & (S >= 90) & (V >= 50)       # 绿叶
    return bead | white | leaf


def compose(base, cloud):
    a = Image.open(base).convert('RGBA')
    c = Image.open(cloud).convert('RGBA')
    comp = a.copy()
    comp.paste(c.crop(BOX), BOX[:2])

    hsv = np.array(a.convert('HSV')).astype(int)
    dm = np.array(
        Image.fromarray((deco_mask(hsv) * 255).astype('uint8')).filter(ImageFilter.MaxFilter(9))
    ) > 128
    for r in DECO_SCOPE:
        x1, y1, x2, y2 = r
        sub = np.zeros_like(dm)
        sub[y1:y2, x1:x2] = dm[y1:y2, x1:x2]
        comp.paste(a.crop(r), r[:2], Image.fromarray((sub[y1:y2, x1:x2] * 255).astype('uint8')))

    for r in HARD_RESTORE:
        comp.paste(a.crop(r), r[:2])
    return a, comp


def maxdiff(x, y, box=None):
    A = np.array((x.crop(box) if box else x).convert('RGB')).astype(int)
    B = np.array((y.crop(box) if box else y).convert('RGB')).astype(int)
    return int(np.abs(A - B).max())


def outside_box(im, box):
    """返回 BOX 之外的全部区域（四块拼回），用于「框外必须逐像素不变」的判据。"""
    W, H = im.size
    x1, y1, x2, y2 = box
    blank = Image.new('RGBA', im.size, (0, 0, 0, 0))
    for r in [(0, 0, W, y1), (0, y2, W, H), (0, y1, x1, y2), (x2, y1, W, y2)]:
        if r[2] > r[0] and r[3] > r[1]:
            blank.paste(im.crop(r), r[:2])
    return blank


def main():
    apply = '--apply' in sys.argv[1:]
    for p in (TARGET, CLOUD):
        if not os.path.exists(p):
            raise SystemExit(f'❌ 缺输入：{p}')

    a, comp = compose(TARGET, CLOUD)

    # ── 判据 ────────────────────────────────────────────────────────────
    d_out = maxdiff(outside_box(a, BOX), outside_box(comp, BOX))
    d_hard = max(maxdiff(a, comp, r) for r in HARD_RESTORE)
    print(f'框外 maxdiff      = {d_out}   （须 0）')
    print(f'硬回取区 maxdiff  = {d_hard}   （须 0）')
    if d_out != 0:
        raise SystemExit('❌ 框外被改动 ⇒ 拒绝落盘')
    if d_hard != 0:
        raise SystemExit('❌ 硬回取区被改动 ⇒ 拒绝落盘')

    alpha = np.array(comp)[..., 3]
    print(f'真透明自证        = alpha=0 占比 {(alpha == 0).mean() * 100:.2f}%（极值 {alpha.min()}..{alpha.max()}）')

    if not apply:
        comp.save('/tmp/signboard-rename-preview.png')
        print('（未落盘；预览 /tmp/signboard-rename-preview.png）')
        return

    os.makedirs(BATCH, exist_ok=True)
    if not os.path.exists(BACKUP):
        shutil.copy2(TARGET, BACKUP)
        print(f'原件已备份 → {BACKUP}')
    comp.save(TARGET)
    print(f'✅ 正本已改写 → {TARGET}（{os.path.getsize(TARGET) / 1024:.1f} KB）')


if __name__ == '__main__':
    main()
