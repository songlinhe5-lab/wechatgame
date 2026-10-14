#!/usr/bin/env python3
"""B19 本地腿 v2：软边缘（4x 超采样覆盖率 + 向内取色）+ 影按逐列实测 + 右下裙边。

对上一版的三处纠正（都有探针数据，见 b19-probe-*.py）：
① 边缘：稿的抗锯齿只有 1 px（顶 249→222→163、右斜 250→198→131）。上一版
   `L<246` 二值化 + MedianFilter(5) 把它吃掉，再用 0.6 px 高斯硬补 → 斜边阶梯。
   本版把平整后的二值掩码上采 4x → 高斯 → BOX 下采，得到**真实次像素覆盖率**
   （1x 高斯做不到这件事：阶梯信息已经丢了）。
② 半透边的颜色不能取稿原值：那是「牌色 × 白背板」的混合，直接乘 alpha 会二次混合
   → 边缘发灰。改为**向内射线取色**（朝质心步进到首个全覆盖像素取其实色）。
③ 影：底边接触影峰值 k 实测左 0.24 → 右 0.30 单调加深（右下第 4 行 0.16 vs 左下
   0.11）。上一版虽逐列取 L，但只做到 y1+8 就断，且右侧整条不入影 → 右下角偏闷。
   本版按逐列 L 实测底带，并沿**右下扇区**补一段裙边（强度锚在底边右端实测峰值，
   方向与「光源左上」一致）。裙边是外推、稿上无 → 单独参数可调、可关。
"""
import os
import numpy as np
from PIL import Image, ImageFilter

import b19_cutlib as lib

MSK = 'temp/b19-sam2/6-b19_00001_.png'
OFF = (505, 1855)
PLATE = lib.DRAFT_PLATE
SS = 4                                        # 超采样倍率
SIGMA = 2.4                                   # 4x 图上的高斯 σ → 约 0.6 稿 px
SKIRT_W = 9                                   # 右下裙边宽（稿 px）
SKIRT_H = 52                                  # 裙边沿右边缘向上衰减的高度

x0l, x1l = PLATE[0] - OFF[0], PLATE[1] - OFF[0] + 1
y0l, y1l = PLATE[2] - OFF[1], PLATE[3] - OFF[1] + 1

src = Image.open(lib.REF).convert('RGB')
crop = src.crop((OFF[0], OFF[1], OFF[0] + 530, OFF[1] + 300))
A = np.asarray(crop).astype(np.float32)
L = A.mean(2)
hard = np.asarray(Image.open(MSK).convert('L')) > 127

# ---------- ① 硬轮廓（与 v1 同，已验证 bbox 与真值逐位吻合，不动）----------
hb = np.zeros_like(hard)
hb[y0l:y1l, x0l:x1l] = hard[y0l:y1l, x0l:x1l]
hb &= (L < 246)
for x in range(x0l, x1l):
    r = np.where(hb[:, x])[0]
    if not len(r):
        continue
    i = int(r[0])
    while i - 1 >= max(0, y0l - 3) and L[i - 1, x] < 240:
        hb[i - 1, x] = True
        i -= 1
for x in range(x0l, x1l):
    r = np.where(hb[:, x])[0]
    if not len(r):
        continue
    i = int(r[-1])
    j = i + 1
    while j + 1 <= y1l - 1 and L[j + 1, x] <= L[j, x]:
        j += 1
    if j <= i:
        continue
    k = j
    while k + 1 <= y1l - 1 and L[k + 1, x] <= L[j, x] + 30:
        k += 1
    for rr in range(i + 1, k + 1):
        hb[rr, x] = True
mm = Image.fromarray(hb.astype(np.uint8) * 255)
mm = mm.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
plate = np.asarray(mm) > 127
ys, xs = np.where(plate)
print(f'硬轮廓 bbox 全局 x[{xs.min()+OFF[0]},{xs.max()+OFF[0]}] '
      f'y[{ys.min()+OFF[1]},{ys.max()+OFF[1]}]（真值 x[{PLATE[0]},{PLATE[1]}] y[{PLATE[2]},{PLATE[3]}]）')

# ---------- ② 真实次像素覆盖率（4x 上采 → 高斯 → BOX 下采）----------
big = Image.fromarray(plate.astype(np.uint8) * 255).resize(
    (plate.shape[1] * SS, plate.shape[0] * SS), Image.NEAREST)
big = big.filter(ImageFilter.GaussianBlur(SIGMA))
cov = np.asarray(big.resize(plate.shape[::-1], Image.BOX)).astype(np.float32) / 255.0
print(f'覆盖率：全 1 像素 {int((cov > 0.999).sum())}，部分覆盖 {int(((cov > 0.01) & (cov < 0.999)).sum())}，'
      f'斜边阶梯已消（部分覆盖带不再是 0/1 跳变）')

# ---------- ③ 向内射线取色，去掉「牌色×白背板」的二次混合 ----------
solid = cov > 0.999
ys2, xs2 = np.where(plate)
cen = np.array([ys2.mean(), xs2.mean()])
rgb = A.copy()
by, bx = np.where((cov > 0.01) & (~solid))
replaced = 0
for py, px in zip(by, bx):
    d = cen - np.array([py, px], dtype=np.float32)
    n = np.hypot(*d)
    if n < 1e-3:
        continue
    d /= n
    for t in np.arange(1.0, 14.0, 0.5):
        qy, qx = int(round(py + d[0] * t)), int(round(px + d[1] * t))
        if 0 <= qy < L.shape[0] and 0 <= qx < L.shape[1] and solid[qy, qx]:
            rgb[py, px] = A[qy, qx]
            replaced += 1
            break
print(f'  半透边取色：{replaced}/{len(by)} px 换成内部实色（其余射线未命中，保留稿原值）')

# ---------- ④ 影层：底边逐列实测 + 右下裙边 ----------
base_b = np.median(L[253:278, x0l:x1l], 0)
SH_W = 9
kmap = np.zeros(L.shape, dtype=np.float32)
kmap[y1l:y1l + SH_W, x0l:x1l] = np.clip(1.0 - L[y1l:y1l + SH_W, x0l:x1l] / np.maximum(base_b, 1e-3), 0, 1)
k_bottom = kmap[y1l:y1l + SH_W, x0l:x1l]
print(f'  底边实测影：峰 {k_bottom.max():.3f}，左端列峰 {k_bottom[:, :12].max():.3f} '
      f'→ 右端列峰 {k_bottom[:, -12:].max():.3f}（稿实测左弱右强）')

# 裙边：逐行找牌体右边界，向外 SKIRT_W px，强度锚在底边右端实测峰、向上按 SKIRT_H 衰减
k_ref = float(np.nanmax(k_bottom[:, -24:]))
skirt_px = 0
for y in range(int(ys.min()), int(ys.max()) + 1):
    row = np.where(plate[y])[0]
    if not len(row):
        continue
    rx = int(row[-1])
    fy = max(0.0, 1.0 - (ys.max() - y) / SKIRT_H) ** 1.35
    if fy <= 0:
        continue
    for dx in range(1, SKIRT_W + 1):
        if rx + dx >= L.shape[1]:
            break
        v = k_ref * fy * (1.0 - dx / (SKIRT_W + 1.0)) ** 1.5
        if v > kmap[y, rx + dx]:
            kmap[y, rx + dx] = v
            skirt_px += 1
print(f'  右下裙边（外推，稿上无）：{skirt_px} px，锚定实测峰 k_ref={k_ref:.3f}，'
      f'沿右边缘 {SKIRT_H}px 内向上衰减')

kmap = np.where(plate, 0.0, kmap)
kmap = np.asarray(Image.fromarray((kmap * 255).astype(np.uint8)).filter(
    ImageFilter.GaussianBlur(0.9))) / 255.0                      # 影本身也要软
kmap = np.where(plate, 0.0, kmap)      # ⚠ 高斯会把影漏回牌体内侧，不清零会在牌缘啃出一圈黑边


def compose(tag, sh_gain, outdir):
    """标准 over 合成，不能简单取 max：影与牌体抗锯齿环重叠时，
    取 max 会让影的黑色顶掉牌色 → 牌缘发黑。影色为纯黑，故预乘色 = rgb·cov。"""
    a_sh = np.clip(kmap * sh_gain, 0.0, 1.0)
    alpha = cov + (1.0 - cov) * a_sh
    prem = rgb * cov[:, :, None]
    out = prem / np.maximum(alpha, 1e-3)[:, :, None]
    rgba = Image.fromarray(np.dstack([np.clip(out, 0, 255).astype(np.uint8),
                                      (np.clip(alpha, 0, 1) * 255).astype(np.uint8)]))
    bb = np.asarray(rgba.split()[3]) > 4
    byy, bxx = np.where(bb)
    rgba = rgba.crop((int(bxx.min()), int(byy.min()), int(bxx.max()) + 1, int(byy.max()) + 1))
    os.makedirs(outdir, exist_ok=True)
    lib.report(tag, rgba, plate[byy.min():byy.max() + 1, bxx.min():bxx.max() + 1], outdir)
    return rgba


compose('本地腿 v2a 软边 + 影×1.0（忠实稿）', 1.0, 'temp/b19-local2a')
compose('本地腿 v2b 软边 + 影×1.6（加强右下）', 1.6, 'temp/b19-local2b')
