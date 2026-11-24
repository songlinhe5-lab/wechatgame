#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A02-P03 小鹿 v4 本地确定性修复（0 次模型调用）。

问题（2026-11-24 实测）：
  1) G9：bbox 67.53×83.59%（规格 70–82%）—— 宽差 2.5%、高差 1.6%；
  2) 章禁忌「小鹿白斑直径 ≥3 格」：5 颗背斑等效直径仅 ≈1.15 格（模型两次重生均不放大），
     且斑心贴背线（到背景 64–73px）、斑距 104px，同位放大必越界/互叠。

修复三步（对 a02p03-v4-s42.png 的 rgba 母版操作，RGB 平涂语义不变）：
  ① 抹旧斑：5 颗背斑区域填回周围赭棕中位色；
  ② 各向异性重画布：bbox 拉到 73×78%（kx=1.0808 / ky=0.9329），NEAREST，居中贴纯黑 2048²；
  ③ 重排白斑：沿原弧线内移，取 d=200px（重画布后 ≈3.1 格 ≥3）实心奶白圆，
     约束 = 圆心到背景 ≥110px、两两斑距 ≥210px、不触胸斑；
输出 a02p03-v4fix-s42.png（RGB 平涂、黑底，供 extract-alpha 复跑六道）。
"""
import json

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

SRC = "a02p03-v4-s42-rgba.png"
DST = "a02p03-v4fix-s42.png"
WHITE = np.array([253, 246, 233])
SPOT_D = 200  # 新斑直径 px（≥3 格 = 192px）
MARGIN_EDGE, MARGIN_PAIR = 110, 210

im = np.asarray(Image.open(SRC)).copy()
a = im[:, :, 3]
rgb = im[:, :, :3]
fg = a == 255
white = (np.abs(rgb.astype(int) - WHITE).sum(2) < 60) & fg
lab, n = ndimage.label(white)
sizes = sorted([(int((lab == i).sum()), i) for i in range(1, n + 1)], reverse=True)
back_ids = [i for s, i in sizes if s < 10000]
assert len(back_ids) == 5, f"背斑数 {len(back_ids)} ≠ 5"

# ① 抹旧斑：每斑填周围赭棕中位色
for i in back_ids:
    m = lab == i
    m_dil = ndimage.binary_dilation(m, iterations=12) & ~m & (a == 255)
    ochre = np.median(rgb[m_dil], axis=0)
    rgb[m] = ochre.astype(np.uint8)
print("① 旧斑已抹（填周围赭棕中位色）")

# ② 各向异性重画布到 73×78%
ys, xs = np.where(fg)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
w0, h0 = x1 - x0, y1 - y0
tw, th = int(0.73 * 2048), int(0.78 * 2048)
kx, ky = tw / w0, th / h0
crop = Image.fromarray(rgb[y0:y1, x0:x1], "RGB").resize((tw, th), Image.NEAREST)
canvas = Image.new("RGB", (2048, 2048), "#000000")
canvas.paste(crop, ((2048 - tw) // 2, (2048 - th) // 2))
print(f"② 重画布 kx={kx:.4f} ky={ky:.4f} → bbox {tw/2048*100:.1f}×{th/2048*100:.1f}%")

# ③ 重排白斑
im2 = np.asarray(canvas).copy()
a2 = im2[:, :, 3] if im2.shape[2] == 4 else None
rgb2 = im2
fg2 = None
# 黑底即排除区：非黑 = 主体
body = (rgb2.astype(int).sum(2) > 90)
bgdist = ndimage.distance_transform_edt(body)
# 缩放后的旧斑心（线性映射）
ox, oy = (2048 - tw) // 2 - x0 * kx, (2048 - th) // 2 - y0 * ky
old_c = []
for i in back_ids:
    ys3, xs3 = np.where(lab == i)
    old_c.append((xs3.mean() * kx + ox, ys3.mean() * ky + oy))
# 胸斑掩膜（新坐标系，避免新斑压胸斑）
white2 = (np.abs(rgb2.astype(int) - WHITE).sum(2) < 60)
chest = white2 & body

centers = []
for cx, cy in old_c:
    cx, cy = float(cx), float(cy)
    for _ in range(400):
        ok = (bgdist[int(cy), int(cx)] >= MARGIN_EDGE
              and all(np.hypot(cx - px, cy - py) >= MARGIN_PAIR for px, py in centers)
              and not chest[int(cy), int(cx)])
        if ok:
            break
        # 沿「指向躯干质心」方向内移 4px
        ys4, xs4 = np.where(body)
        cx += np.sign(xs4.mean() - cx) * 4
        cy += np.sign(ys4.mean() - cy) * 4
    centers.append((cx, cy))
    assert bgdist[int(cy), int(cx)] >= MARGIN_EDGE, f"斑心 ({cx:.0f},{cy:.0f}) 贴边"
d = ImageDraw.Draw(canvas)
for cx, cy in centers:
    d.ellipse([cx - SPOT_D / 2, cy - SPOT_D / 2, cx + SPOT_D / 2, cy + SPOT_D / 2], fill=tuple(WHITE))
print(f"③ 5 颗 d={SPOT_D}px 白斑重排完成（d/64≈{SPOT_D/64:.1f} 格）")

canvas.save(DST)
# 自检：圆不触轮廓、不互叠、不压胸斑
chk = np.asarray(canvas).astype(int)
body2 = chk.sum(2) > 90
er = ndimage.binary_erosion(body2, iterations=SPOT_D // 2 + 4)
for cx, cy in centers:
    assert er[int(cy), int(cx)], f"斑 ({cx:.0f},{cy:.0f}) 触/近轮廓"
print("自检通过：全部斑心满足 内缩安全距")
json.dump({"kx": kx, "ky": ky, "spot_d": SPOT_D,
           "centers": [[round(c[0]), round(c[1])] for c in centers]},
          open("a02p03-v4fix-meta.json", "w"), ensure_ascii=False, indent=1)
