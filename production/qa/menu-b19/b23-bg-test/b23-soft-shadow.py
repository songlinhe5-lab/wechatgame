#!/usr/bin/env python3
"""B23b：把「柔影」这个效果留在本地乘性影层上做，而不是借 matting 的 alpha。

v3a 影层构造（b19-local3.py ⑤）：k = 1 − L/局部基线（底边逐列实测 + 右下裙边），
再 GaussianBlur(0.9) 一次 → alpha 直接编码影的不透明度，RGB 是牌色。
所以「更柔」＝把 k 的衰减带加宽，一个参数的事，且**换底色不坏**（乘性天然成立）。

本脚本只在影通道上加宽（牌体实心 alpha 一字不动），并做峰值归一，
使三档可比：σ=0（v3a 基线）/ 1.6 / 3.2。
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import b19_cutlib as lib

SRC = 'temp/b19-local3a/source.png'
PAD = 20
OFF, CW, CH = (505, 1855), 530, 300
TX0, TY0, TW, TH = 68, 75, 386, 164

im = Image.open(SRC).convert('RGBA')
w0, h0 = im.size
a0 = np.asarray(im.split()[3]).astype(np.float32) / 255
rgb0 = np.asarray(im.convert('RGB')).astype(np.float32)
A = np.zeros((h0 + 2 * PAD, w0 + 2 * PAD), np.float32)
RGB = np.zeros((h0 + 2 * PAD, w0 + 2 * PAD, 3), np.float32)
A[PAD:PAD + h0, PAD:PAD + w0] = a0
RGB[PAD:PAD + h0, PAD:PAD + w0] = rgb0

# 牌体掩码必须用 GT（资产左上 = crop (TX0,TY0)），不能用 alpha>0.98：
# 后者会把牌体自身的抗锯齿环当成「影」一起加宽，峰值与坡宽全部失真
_gt = np.asarray(Image.open('temp/b22-gt-mask.png').convert('L')) > 127
plate0 = _gt[TY0:TY0 + h0, TX0:TX0 + w0]
plate = np.zeros(A.shape, bool)
plate[PAD:PAD + h0, PAD:PAD + w0] = plate0
for _ in range(2):                                # 外扩 2 px 保护牌体边缘
    d = plate.copy()
    d[1:, :] |= plate[:-1, :]; d[:-1, :] |= plate[1:, :]
    d[:, 1:] |= plate[:, :-1]; d[:, :-1] |= plate[:, 1:]
    plate = d
shadow = np.where(plate, 0.0, A)


def blur(m, s):
    if s <= 0:
        return m.copy()
    return np.asarray(Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8))
                      .filter(ImageFilter.GaussianBlur(s))) / 255.0


def build(sigma):
    b = blur(shadow, sigma)
    g = float(shadow.max()) / max(float(b.max()), 1e-3)     # 峰值归一：只加宽，不减深度
    k = np.clip(b * g, 0, 1)
    alpha = np.where(plate, A, np.maximum(A, k))            # 牌体 alpha 一字不动
    out = np.dstack([np.clip(RGB, 0, 255).astype(np.uint8),
                     (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    return Image.fromarray(out), alpha


def to_crop(alpha):
    """资产 → crop(530×300) 坐标系：v3a 左上角在 crop 的 (TX0,TY0)，资产又垫了 PAD。"""
    m = np.zeros((CH, CW), np.float32)
    y0, x0 = TY0 - PAD, TX0 - PAD
    ys, xs = np.where(alpha > 0)
    h, w = alpha.shape
    sy0, sx0 = max(0, -y0), max(0, -x0)
    dy0, dx0 = max(0, y0), max(0, x0)
    hh = min(h - sy0, CH - dy0)
    ww = min(w - sx0, CW - dx0)
    m[dy0:dy0 + hh, dx0:dx0 + ww] = alpha[sy0:sy0 + hh, sx0:sx0 + ww]
    return m


GT = np.asarray(Image.open('temp/b22-gt-mask.png').convert('L')) > 127
SRCC = np.asarray(Image.open(lib.REF).convert('RGB').crop(
    (OFF[0], OFF[1], OFF[0] + CW, OFF[1] + CH))).astype(np.float32)
L = SRCC.mean(2)
# 牌色 RGB 也要搬到 crop 坐标系才能与 m 对齐（之前拿垫边资产坐标的 RGB 去乘
# crop 坐标的 alpha，尺寸不同会静默广播错位）
RGBc = np.zeros((CH, CW, 3), np.float32)
RGBc[TY0:TY0 + h0, TX0:TX0 + w0] = rgb0
py, px_ = np.where(GT)
Y0, Y1, X0, X1 = py.min(), py.max(), px_.min(), px_.max()
above = np.zeros((CH, CW), bool); above[:Y0, :] = True
SURFACE = 250.0


def dilate(m, n):
    out = m.copy()
    for _ in range(n):
        d = out.copy()
        d[1:, :] |= out[:-1, :]; d[:-1, :] |= out[1:, :]
        d[:, 1:] |= out[:, :-1]; d[:, :-1] |= out[:, 1:]
        out = d
    return out


# 量测区固定为「牌体外 1–8 px 接触带、且稿上比背板暗」——
# 三档 σ 用同一组像素比 ΔL，否则每档的 z 集合不同，中位数不可比
band = dilate(GT, 8) & ~GT
zone = band & (~above) & (L < SURFACE - 8)
print(f'[影带真值] {int(zone.sum())} px（牌底/两侧 1–8 px 接触带、比背板暗 8 灰阶以上）')

BGS = [('白251', np.array([251., 250., 249.])),
       ('灰140', np.full(3, 140.)),
       ('深木90', np.array([96., 78., 60.]))]
rows = []
for sigma in (0.0, 1.6, 3.2):
    img, alpha = build(sigma)
    img.crop((PAD, PAD, PAD + w0, PAD + h0)).save(f'temp/b23-soft-s{sigma}.png')
    m = to_crop(alpha)
    solid = m > 0.98
    outs = []
    for name, bg in BGS:
        comp = RGBc * m[:, :, None] + bg[None, None, :] * (1 - m[:, :, None])
        Lc = comp.mean(2)
        z = zone & (m > 0.01)
        outs.append(f'{name} ΔL={float(bg.mean()) - float(np.median(Lc[z])):5.1f}'
                    f'[{int(z.sum())}px]')
    # 坡宽：底部法线上半透（0.1–0.9）px 数，与 B23 Q3 同一把尺（len 而非首尾跨度）
    widths = []
    for x in range(X0 + 10, X1 - 10, 4):
        col = m[Y0 - 16:Y1 + 24, x]
        idx = np.where((col > 0.1) & (col < 0.9))[0]
        if len(idx):
            widths.append(len(idx))
    ext = np.where((m > 0.02) & ~GT)[0]
    sh = (~GT) & (m > 0.01) & (m <= 0.98)
    print(f'σ+{sigma}: 影峰值 k={float(m[~GT].max()):.3f}  Σk={float(m[~GT].sum()):8.1f}  '
          f'影区 px {int(sh.sum()):5d}  最深 {int(ext.max() - Y1) if len(ext) else 0} px'
          f'  坡宽 中位 {int(np.median(widths))} px  ' + '  '.join(outs))
    rows.append((f'v3a σ+{sigma}', img))

# 三档 × 三底目检图（右下角窗口，与 B23 同窗同倍率）
WX0, WY0, WW, WH = X1 - 96, Y1 - 44, 140, 84
SC = 4
GAP = 8
sheet = Image.new('RGB', (WW * SC * 3 + GAP * 4, WH * SC * 3 + GAP * 4), (30, 30, 30))
for r, (tag, img) in enumerate(rows):
    arr = np.asarray(img.convert('RGB')).astype(np.float32)
    al = np.asarray(img.split()[3]).astype(np.float32) / 255
    for c, (name, bg) in enumerate(BGS):
        comp = arr * al[:, :, None] + bg[None, None, :] * (1 - al[:, :, None])
        # 资产坐标（含 PAD 垫边）← crop 坐标窗口
        cy0, cx0 = WY0 - TY0 + PAD, WX0 - TX0 + PAD
        win = comp[cy0:cy0 + WH, cx0:cx0 + WW]
        t = Image.fromarray(np.clip(win, 0, 255).astype(np.uint8)).resize(
            (WW * SC, WH * SC), Image.NEAREST)
        sheet.paste(t, (GAP + c * (WW * SC + GAP), GAP + r * (WH * SC + GAP)))
        sheet.paste(Image.new('RGB', (WW * SC, 1), (255, 0, 255)),
                    (GAP + c * (WW * SC + GAP), GAP + r * (WH * SC + GAP) + (Y1 - WY0) * SC))
out = 'production/qa/menu-b19/b23-bg-test/soft-local.webp'
sheet.save(out, 'WEBP', quality=88)
print(f'产物：{out} {sheet.size[0]}×{sheet.size[1]}  行 σ+0/1.6/3.2，列 白/灰/深木')
