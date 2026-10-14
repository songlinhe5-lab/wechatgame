#!/usr/bin/env python3
"""B24b：影层的正确做法 —— 形状取稿上**二维**实测投影，编码仍用乘性。

B21 的 v3a 影层只取了「底边逐列 + 右下裙边」两个一维剖面，实测证明形状不对：
稿上影足迹 牌下 2407 / 牌右 1003 / 牌左 359，而 v3a 牌右只有 322 px（稿的 1/3），
且在不该有影的地方多画 17.7%。B23 推荐的"加宽羽化"更糟：覆盖升到 76% 的同时
多画升到 46.5%，IoU 从 0.614 掉到 0.458 —— 拿错影换覆盖，方向错。

本脚本一次性解决两头的要求（⑤ 的形状对 + v3a 的换底不坏）：
  k(x,y) = clip((干净底 − 稿) / 干净底, 0, 1)   —— 逐像素二维，直接取稿上投影足迹
  RGB 一律置黑、alpha = k                        —— 乘性编码，合成结果 = 底×(1−k)
干净底 = b24-insitu 同一套重建（同行平铺 + 逐行亮度校正），零大模型、可复跑。
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import b19_cutlib as lib

OFF, CW, CH = (505, 1855), 530, 300
TX0, TY0, TW, TH = 68, 75, 386, 164
X0, Y0 = OFF[0] + TX0, OFF[1] + TY0
X1, Y1 = X0 + TW, Y0 + TH
SRCX = (380, 560)
PAD = 24

full = np.asarray(Image.open(lib.REF).convert('RGB')).astype(np.float32)
GT = np.asarray(Image.open('temp/b22-gt-mask.png').convert('L')) > 127


def dil(m, n):
    o = m.copy()
    for _ in range(n):
        d = o.copy()
        d[1:, :] |= o[:-1, :]; d[:-1, :] |= o[1:, :]
        d[:, 1:] |= o[:, :-1]; d[:, :-1] |= o[:, 1:]
        o = d
    return o


# GT 是 crop 坐标（530×300），hole/k 是全图坐标（1520×2736）——
# 这两个坐标系混用过两次了，这里显式把 GT 搬到全图坐标再算
GTf = np.zeros(full.shape[:2], bool)
GTf[Y0:Y1, X0:X1] = GT[TY0:TY0 + TH, TX0:TX0 + TW]

hole = np.zeros(full.shape[:2], bool)
hole[Y0 - 30:Y1 + 30, X0 - 30:X1 + 30] = dil(GT, 24)[TY0 - 30:TY0 + TH + 30,
                                                     TX0 - 30:TX0 + TW + 30]
clean = full.copy()
sw = SRCX[1] - SRCX[0]
for y in range(Y0 - 30, Y1 + 30):
    row = full[y, SRCX[0]:SRCX[1]]
    for x in range(X0 - 30, X1 + 30):
        if hole[y, x]:
            clean[y, x] = row[(x - SRCX[0]) % sw]
for y in range(Y0 - 30, Y1 + 30):
    seg = slice(X0 - 30, X1 + 30)
    keep = ~hole[y, seg]
    if keep.sum() < 20:
        continue
    corr = np.median(full[y, seg][keep], 0) - np.median(clean[y, seg][keep], 0)
    idx = np.where(hole[y, seg])[0]
    clean[y, seg.start + idx] += corr

Ld = full.mean(2)
Lc = clean.mean(2)
k = np.clip((Lc - Ld) / np.maximum(Lc, 1e-3), 0, 1)
k = np.where(hole & ~GTf, k, 0.0)              # 只认牌体外、重建域内的暗化
k = np.where((Lc - Ld) > 5.0, k, 0.0)          # 噪门与判据同阈（>5 灰阶才算影，3–5 当重建误差）
# 牌体正上方不该有影（稿上实测 牌上 0 px），且重建底在那里最不准 → 抑制。
# 只切「牌顶边以上」：上一版把到牌底边的整块都切了，牌体右下角会出现直角台阶
topband = np.zeros(full.shape[:2], bool)
topband[Y0 - 30:Y0, X0:X1] = True              # 牌顶边以上、左右边缘之间的横带
k = np.where(topband, 0.0, k)
print(f'[二维影] 足迹 {int((k > 0).sum())} px  峰值 k {k.max():.3f}  均值 {k[k > 0].mean():.3f}')
ys, xs = np.where(k > 0.02)
for nm, sel in [('牌下', ys > Y1), ('牌右', xs > X1), ('牌左', xs < X0), ('牌上', ys < Y0)]:
    print(f'  {nm} {int(sel.sum()):5d} px   （稿影足迹方位：牌下 2407 / 牌右 1003 / 牌左 359）')

# 影层搬回 crop 坐标（重建域比牌体 bbox 外扩 30 px，crop 内放得下）
kc = np.zeros((CH, CW), np.float32)
kc[TY0 - 30:TY0 + TH + 30, TX0 - 30:TX0 + TW + 30] = k[Y0 - 30:Y1 + 30, X0 - 30:X1 + 30]

# 与 v3a 牌体合并：牌体（含抗锯齿环）用 v3a 的 alpha/RGB，牌体外的影整层换成 k
va = Image.open('temp/b19-local3a/source.png').convert('RGBA')
aw = np.asarray(va.split()[3]).astype(np.float32) / 255
rw = np.asarray(va.convert('RGB')).astype(np.float32)
h0, w0 = aw.shape
A = np.zeros((CH, CW), np.float32); R = np.zeros((CH, CW, 3), np.float32)
A[TY0:TY0 + h0, TX0:TX0 + w0] = aw
R[TY0:TY0 + h0, TX0:TX0 + w0] = rw
plate = dil(GT, 2)

# 影层外边界的柔度 A/B：噪门 >5 灰阶会在影的外缘切出硬边（直角感），拿羽化 σ 换。
# 乘性编码下合成＝底×(1−k)，所以暗化量＝底×k；DSH 真值取稿上比重建底暗 >5 的足迹
cropL = lambda arr: arr[OFF[1]:OFF[1] + CH, OFF[0]:OFF[0] + CW].mean(2)
Lcc, Ldd = cropL(clean), cropL(full)
DSHc = (~GT) & (Lcc - Ldd > 5)
print('\n[影层羽化 σ A/B]  稿影足迹真值', int(DSHc.sum()), 'px')
for sig in (0.0, 0.6, 1.2, 2.0, 3.0):
    kk = kc if sig == 0 else np.asarray(Image.fromarray(
        (np.clip(kc, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(sig))) / 255.
    CS = (~GT) & (Lcc * kk > 5)
    inter = int((CS & DSHc).sum()); union = int((CS | DSHc).sum())
    print(f'  σ{sig:3.1f}  影足迹 {int(CS.sum()):5d}  IoU {inter / max(union, 1):.3f}  '
          f'覆盖 {100 * inter / max(int(DSHc.sum()), 1):5.1f}%  '
          f'多出来 {100 * int((CS & ~DSHc).sum()) / max(int(CS.sum()), 1):5.1f}%  '
          f'影深均值 {float((Lcc * kk)[DSHc].mean()) if DSHc.any() else 0:5.1f}')

# 只羽化影层本身。上一版先合并再羽化 → 牌体 alpha=1 被模糊到牌顶外 1 px，
# 凭空造出 373 px / alpha 0.024 的黑边（量出来就是「牌上有影」）
ksh = np.asarray(Image.fromarray((np.clip(kc, 0, 1) * 255).astype(np.uint8))
                 .filter(ImageFilter.GaussianBlur(0.6))) / 255.0
alpha = np.where(plate, np.maximum(A, ksh), ksh)   # 牌体用 v3a 的 alpha，外面只有影
rgb = np.where(plate[:, :, None] > 0, R, 0.0)            # 牌体外 RGB 置黑＝乘性
bb = alpha > 0.004
byy, bxx = np.where(bb)
y0, y1, x0, x1 = byy.min(), byy.max() + 1, bxx.min(), bxx.max() + 1
print(f'[v4 资产] 裁边后 {x1 - x0}×{y1 - y0}，左上在 crop ({x0},{y0})')
out = Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8),
                                 (np.clip(alpha, 0, 1) * 255).astype(np.uint8)]))
out.save('temp/b24-v4-full.png')
out.crop((x0, y0, x1, y1)).save('temp/b24-v4.png')
with open('temp/b24-v4-origin.txt', 'w') as f:
    f.write(f'{x0} {y0}\n')
