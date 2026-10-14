#!/usr/bin/env python3
"""B19 云端腿：qwen-image-3.0-pro 指令「背景填纯白」→ 本地按**色相**分离牌体/影 → 共用判据。

为什么不走现成的分割 API：百炼没有通用物体抠图（人像分割/擦除补全/指令编辑都不干这事），
VIAPI SegmentCommonImage 官方文档明写「不适用于卡通图」→ 手绘稿不适用。
所以云端腿 = 模型出白底图 + 本地色键，模型只负责「把影画出来」这一件它擅长的事。

色键依据（实测非白 117.9 万 px 按亮度分档后的 R−B 中位）：
  L<120 → sat 30–95（深棕描边）｜L120–210 → sat ~114（木面）｜L240–252 → sat ~6（浅灰影）
→ 牌体 = sat>25 或 L<170；影 = 剩下的非白中性区。
⚠ 不能只拿 sat>40 当牌体：描边环会被划成背景，而环与背景同为 0、连通，
  四角灌水会连环一起灌掉（实测回填洞 = 0 px 就是这个信号）。
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import b19_cutlib as lib

SRC = 'temp/dashscope-out/custom/qwen_image_30_pro.png'
OUT = 'temp/b19-cloud'
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert('RGB')
A = np.asarray(im).astype(np.float32)
L = A.mean(2)
sat = A[:, :, 0] - A[:, :, 2]
print(f'云端出图 {im.size} RGB（无 alpha）；四角 L {[int(L[0,0]),int(L[0,-1]),int(L[-1,0]),int(L[-1,-1])]}')

# ① 牌体 = 木色或深棕描边；洞（牌内低饱和浅色斑）用四角灌水找回来
solid = ((sat > 25) | (L < 170)).astype(np.uint8) * 255
si = Image.fromarray(solid).convert('L')            # fromarray 返 readonly，不 convert 灌入会静默丢
w, h = si.size
for c in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
    ImageDraw.floodfill(si, c, 128, thresh=64)      # 可达的 0 ＝ 背景
b = np.asarray(si).copy()                           # np.asarray 是只读视图
holes = int(((b == 0)).sum())
plate = (b != 128)                                  # 背景（可达 0）排除，其余（牌体+洞）算实体
print(f'  牌体 {int(plate.sum())} px，其中回填洞 {holes} px')

# ② 影 = 牌体外、非白，且必须贴着牌（远离牌的非白点多是压缩噪声）
near = np.asarray(Image.fromarray(plate.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(121))) > 127
shadow = (~plate) & near & (L < 252)
k = np.clip(1.0 - L / 255.0, 0.0, 1.0)              # 白底上：黑+alpha 可精确还原观测亮度
print(f'  影 {int(shadow.sum())} px（占牌面积 {shadow.sum() / plate.sum() * 100:.1f}%），'
      f'峰 k={k[shadow].max():.3f} 均值 k={k[shadow].mean():.3f}')
# 影落在哪一侧：与稿（牌底 + 右下）对得上才算「抠对了」而不是「模型自己发挥了」
ys, xs = np.where(plate)
sy, sx = np.where(shadow)
quad = {'底': int(((sy > ys.max()) ).sum()), '右': int(((sx > xs.max())).sum()),
        '顶': int((sy < ys.min()).sum()), '左': int((sx < xs.min()).sum()),
        '牌内环带': int(((sy >= ys.min()) & (sy <= ys.max()) & (sx >= xs.min()) & (sx <= xs.max())).sum())}
print(f'  影分布（相对牌体外框）{quad} → 稿上实测为「牌底 5px 深 + 右下浅裙边，顶/左无影」')

# ③ 合成：牌体＝模型原色不透明；影＝纯黑 + alpha（与本地腿同一编码，才可比）
rgb = np.where(shadow[:, :, None], 0.0, A).astype(np.uint8)
ph = int(ys.max() - ys.min() + 1)
feather = np.asarray(Image.fromarray(plate.astype(np.uint8) * 255).filter(
    ImageFilter.GaussianBlur(0.6 * ph / 164)))      # 羽化随出图尺度放大，否则两条腿不可比
a_u8 = np.where(plate, 255, np.where(shadow, (k * 255).astype(np.uint8), feather))
# ⚠ 一定要用 shadow 门住：直接拿全图 k 会连远处的压缩噪声（L≈240 → alpha≈15）一起当影，
#   资产外框会从牌高 734 px 胀到 1368 px。
rgba = Image.fromarray(np.dstack([rgb, a_u8]))
bb = np.asarray(rgba.split()[3]) > 4
by, bx = np.where(bb)
rgba = rgba.crop((int(bx.min()), int(by.min()), int(bx.max()) + 1, int(by.max()) + 1))
plate_c = plate[by.min():by.max() + 1, bx.min():bx.max() + 1]

lib.report('云端腿 qwen-image-3.0-pro 白底 + 本地色键', rgba, plate_c, OUT)

# ④ 风格漂移独立读数：本地腿那行按构造必为 0（RGB 直接取稿像素，自证），只有这里有意义
fc = lib.face_color(rgba)
print(f'  [风格独立核] 牌面中位色 {fc.astype(int).tolist()} vs 稿 '
      f'{np.asarray(lib.DRAFT_FACE).astype(int).tolist()} → 最大通道差 '
      f'{np.abs(fc - np.asarray(lib.DRAFT_FACE)).max():.0f} 灰阶'
      f'（本地腿同项为 0 属自证，不可与本行直接比高下）')
