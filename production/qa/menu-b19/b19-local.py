#!/usr/bin/env python3
"""B19 本地腿：SAM2（含影先验）→ 硬轮廓平整化 + 影层乘性编码 → 共用判据量三条要求。

分工：SAM2 只给分割先验；平整化与影层是确定性后处理（零付费、可复现）。
影层编码：RGB = 纯黑（实测优于手推暖棕），alpha = 1 − L/L_ref（只用亮度导出）。
→ 于是「重建残差」是可证伪的：对不上就说明这个编码撑不住。
"""
import os
import numpy as np
from PIL import Image, ImageFilter

import b19_cutlib as lib

MSK = 'temp/b19-sam2/6-b19_00001_.png'
OFF = (505, 1855)
OUT = 'temp/b19-local'
os.makedirs(OUT, exist_ok=True)

# 牌体真值外框（稿 px，含顶描边 y=1931；B18 确诊 SAM2 mask 缺顶边）
PLATE = lib.DRAFT_PLATE
x0l, x1l = PLATE[0] - OFF[0], PLATE[1] - OFF[0] + 1
y0l, y1l = PLATE[2] - OFF[1], PLATE[3] - OFF[1] + 1

src = Image.open(lib.REF).convert('RGB')
crop = src.crop((OFF[0], OFF[1], OFF[0] + 530, OFF[1] + 300))
L = np.asarray(crop.convert('L')).astype(np.float32)
m = np.asarray(Image.open(MSK).convert('L'))
hard = (m > 127)
print(f'SAM2 mask {m.shape[1]}x{m.shape[0]} 白占比 {(hard).mean()*100:.1f}%')

# ① 硬轮廓：限制在牌框内 → **长回暗色描边**（补顶边缺的 2 px）→ 中值 + 闭运算
hb = np.zeros_like(hard)
hb[y0l:y1l, x0l:x1l] = hard[y0l:y1l, x0l:x1l]
hb &= (L < 246)                                    # 去掉框外白背板
# 只向上长回顶描边（B18 确诊 mask 缺顶边）；**不能全方向长**——牌底紧邻影带 L<215，
# 一长就把接触影吃成不透明牌体（实测梯形比从 0.979 被顶到 0.969）。
ngrow = 0
for x in range(x0l, x1l):
    r = np.where(hb[:, x])[0]
    if not len(r):
        continue
    i = int(r[0])
    while i - 1 >= max(0, y0l - 3) and L[i - 1, x] < 240:
        hb[i - 1, x] = True
        ngrow += 1
        i -= 1
print(f'  向上长回描边 {ngrow} px（顶边缺口在此补）')
# 底边同病：mask 止于 y2092，而描边实到 y2094（112→136），影从 y2095（165）起。
# 不能用「比背景暗就算牌体」——影也比背景暗，分不开。改用亮度极小值定位：
# 描边是局部最暗，过了它影单调变亮 → 走到极小值后再多吃「仍 ≤ 极小值+30」的行。
ngrow2 = 0
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
    ngrow2 += k - i
print(f'  向下长回描边 {ngrow2} px')
mm = Image.fromarray(hb.astype(np.uint8) * 255)
mm = mm.filter(ImageFilter.MedianFilter(5))
mm = mm.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
plate = np.asarray(mm) > 127
ys, xs = np.where(plate)
print(f'  硬轮廓 bbox 全局 x[{xs.min()+OFF[0]},{xs.max()+OFF[0]}] '
      f'y[{ys.min()+OFF[1]},{ys.max()+OFF[1]}]（真值 x[{PLATE[0]},{PLATE[1]}] '
      f'y[{PLATE[2]},{PLATE[3]}]）')

# ② 影层：牌底 5 px 深 ramp（峰值衰减 0.78）。**牌右侧不入影层**——初稿曾量到「右侧暗 20 灰阶」，
#    目检发现那块灰是搁板台面本身的一条灰蓝带（同行远场参考也落在那条带里，所以只剩
#    3–10 灰阶残差，与描边抗锯齿无法分开）→ 强行编码会在资产上多出一条脱离牌边的暗带。
#    牌顶外侧 249.1 vs 基线 250 = 无影、牌左外侧同。光源在左上。
SH_TINT = np.array([0.0, 0.0, 0.0])                # 实测纯黑优于手推暖棕（见 ③）
alpha = np.zeros(L.shape, dtype=np.float32)
A = np.asarray(crop).astype(np.float32)

# 牌底：行带 local 240..247，基线取 local 253..277 同列
base_b = np.median(L[253:278, x0l:x1l], 0)
k_b = np.clip(1.0 - L[240:248, x0l:x1l] / np.maximum(base_b, 1e-3), 0, 1)
alpha[240:248, x0l:x1l] = k_b
alpha = np.where(plate, 1.0, alpha)
sh = (~plate) & (alpha > 0.004)
print(f'  影层 {int(sh.sum())} px；牌底峰 k={k_b.max():.3f}')
print('  （k = 1 − L/L_ref，ref 取同方向远场；不能 360° 平均，会被白背板抬基准）')

# ③ 可证伪检查：固定影色 + 亮度导出的 alpha，重建逐通道色对得上稿吗
B_ref = np.median(A[253:278, x0l:x1l], 0)                      # (8,3) 按列基线 RGB
kb8 = alpha[240:248, x0l:x1l][:, :, None]
recon = B_ref[None, :, :] * (1 - kb8) + SH_TINT[None, None, :] * kb8
resid = np.abs(recon - A[240:248, x0l:x1l])
print(f'  影编码重建残差（牌底带）：max {resid.max():.1f} / mean {resid.mean():.1f} 灰阶  '
      f'（阈值预先定为 max≤12：未达，已定位到峰出在紧贴描边那一行——影与描边抗锯齿混采；'
      f'同口径对比：纯黑 max 12.8/mean 4.9、暖棕 max 20.7/mean 7.1 → 取纯黑）')
# 影衰减单调性：真影应随远离牌边递减（噪声不会）
prof = alpha[240:250, x0l + 40:x1l - 40].mean(1)
mono = float((np.diff(prof) <= 1e-3).mean())
print(f'  牌底影衰减：k 逐行 {np.round(prof, 3).tolist()} → 单调递减步占比 {mono*100:.0f}%')

# ④ 合成 RGBA（牌体＝稿原色不透明；影＝纯黑 + alpha）
rgb = np.asarray(crop).astype(np.uint8)
rgb = np.where(sh[:, :, None], SH_TINT.astype(np.uint8), rgb)
a_u8 = (alpha * 255).astype(np.uint8)
feather = np.asarray(Image.fromarray(plate.astype(np.uint8) * 255).filter(
    ImageFilter.GaussianBlur(0.6)))                            # 牌体边界 0.6 px 羽化吃抗锯齿
a_u8 = np.where(plate, 255, np.maximum(a_u8, feather))
rgba = Image.fromarray(np.dstack([rgb, a_u8]))
bb = np.asarray(rgba.split()[3]) > 4
ys2, xs2 = np.where(bb)
rgba = rgba.crop((int(xs2.min()), int(ys2.min()), int(xs2.max()) + 1, int(ys2.max()) + 1))
plate_c = plate[ys2.min():ys2.max() + 1, xs2.min():xs2.max() + 1]

lib.report('本地腿 SAM2 + 平整化 + 影层', rgba, plate_c, OUT)

# 目检底（洋红看 alpha / 奶白看影）由 lib.report 统一产出，两条腿同一张尺子。
