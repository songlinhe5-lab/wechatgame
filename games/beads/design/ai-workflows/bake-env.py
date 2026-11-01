#!/usr/bin/env python3
"""烘焙环境层（v4）：从 lock-s88 取「光」，色相锚回 palette。

为什么不直接烘 lock-s88：
  实测墙面光照差异只有 +6%（左上光斑）到 −6.5%（右墙），
  但这张图的蓝通道被整体压了 39（奶油白 → 驼米色）。
  直接烘 = 把一层不想要的黄色滤镜固化进产品，且违反 art-bible §6 的 bg_base。

所以只取它的「亮度结构」，色相 100% 由 bg_base 决定：
  M   = 亮度(环境层) / 中位亮度          ← 生图给的正确答案（光的角度、衰减、明暗分布）
  out = bg_base × M                       ← palette 给的正确答案（色相）

环境层由「逐行插值擦除控件 → sigma=18 强模糊」得到；强模糊同时吸收
插值残留的横向条纹，且让整张图统一为低频光照，没有拼接边界。
"""
import numpy as np
from PIL import Image, ImageFilter

SRC = 'temp/menu-atlas/lock-s88.png'
W, H = 1152, 2048

ERASE = [
    (268, 0, 882, 400),
    (20, 180, 172, 480),
    (986, 178, 1140, 482),
    (228, 376, 1002, 486),
    (182, 428, 1002, 1762),   # 橱窗
    (18, 852, 172, 1028),
    (990, 852, 1142, 1028),
    (302, 1676, 858, 1930),   # CTA
    (8, 1432, 170, 1760),     # 陶盆（单独出资产）
]
BG_BASE = (241, 232, 216)     # art-bible §6  bg_base #F1E8D8
FLOOR_Y = 1690                # 墙地交界
FLOOR_WARM = -7               # 地面蓝通道微降，保留"木地板"暗示
BLUR = 18
M_LO, M_HI = 0.915, 1.075     # 光照强度截断区间


def main():
    src = Image.open(SRC).convert('RGB')
    if src.size != (W, H):
        src = src.resize((W, H), Image.LANCZOS)
    arr = np.asarray(src).astype(np.float32)

    mask = np.zeros((H, W), dtype=bool)
    for (x0, y0, x1, y1) in ERASE:
        mask[max(0, y0):min(H, y1), max(0, x0):min(W, x1)] = True

    # 逐行插值抹掉控件（墙面是横向渐变，逐行最准）
    filled = arr.copy()
    for y in range(H):
        rm = mask[y]
        if not rm.any():
            continue
        known = np.where(~rm)[0]
        if len(known) < 2:
            continue
        holes = np.where(rm)[0]
        for c in range(3):
            filled[y, holes, c] = np.interp(holes, known, arr[y, known, c])

    # 强模糊 → 纯光照场
    env = np.asarray(
        Image.fromarray(np.clip(filled, 0, 255).astype(np.uint8))
        .filter(ImageFilter.GaussianBlur(BLUR))
    ).astype(np.float32)

    lum = 0.299 * env[..., 0] + 0.587 * env[..., 1] + 0.114 * env[..., 2]
    M = lum / np.median(lum[FLOOR_Y:])
    # 截断：插值残留会把局部 M 拉到 0.7x，形成无法解释的脏斑
    M = np.clip(M, M_LO, M_HI)

    out = np.zeros((H, W, 3), dtype=np.float32)
    for c in range(3):
        out[..., c] = BG_BASE[c] * M
    # 暗部蓝通道额外衰减，让阴影像暖光下的影子而不是灰
    out[..., 2] *= 0.62 + 0.38 * M
    out[FLOOR_Y:, :, 2] += FLOOR_WARM

    # 颗粒：只加在光照域，强度按亮度反比（暗处颗粒更明显，像纸）
    rng = np.random.default_rng(11)
    out += rng.normal(0, 1.0, (H, W, 1)).astype(np.float32) * np.clip(1.15 - M, 0.2, 1.0)[..., None]

    out = np.clip(out, 0, 255).astype(np.uint8)
    Image.fromarray(out).save('temp/menu-atlas/bg-baked-1152x2048.png')

    small = Image.fromarray(out).resize((750, 1334), Image.LANCZOS)
    small.save('temp/menu-atlas/bg-baked-750x1334.png')
    small.save('temp/menu-atlas/bg-baked-750x1334.webp', quality=80, method=6)

    # 复合自检：背景 + 陶盆
    pot = Image.open('temp/menu-atlas/pot.webp').convert('RGBA')
    comp = Image.fromarray(out).convert('RGBA')
    comp.alpha_composite(pot, (8, 1432))
    comp.convert('RGB').resize((750, 1334), Image.LANCZOS).save(
        'temp/menu-atlas/bg-baked-compose.png')

    import os
    print(f'M 范围 {M.min():.3f} ~ {M.max():.3f}（中位 1.000）')
    print(f'光束峰值亮度 {BG_BASE[0] * M.max():.0f} / 底色 {BG_BASE[0]}')
    for f in ['bg-baked-750x1334.webp', 'pot.webp']:
        print(f'{f:<28}{os.path.getsize("temp/menu-atlas/" + f) / 1024:6.1f} KB')


if __name__ == '__main__':
    main()
