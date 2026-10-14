#!/usr/bin/env python3
"""B19 本地腿 v3：外轮廓**拟合成直线四边形**（圆角）→ 4x 多边形光栅化取覆盖率。

v2 的边仍然跟着手稿的抖动走（平整 RMS 0.48–0.57 稿 px，@2x 就是约 1 px 波浪）。
云端之所以看着「做工精致」，是模型把四条边重画成了直线。所以这里把直线化搬到
**本地腿自己的像素**上：风格/木纹/颜色一律取稿，只有轮廓换成拟合直线。

做法：从已验证的平整掩码取四条边的边界点（各边中段 70%，避开圆角）→ 最小二乘
拟合（上下边 y=f(x)、左右边 x=g(y)，因为左右是斜边）→ 两两求交得四角 →
在 (u,v) 参数域画圆角矩形 → 双线性映回像素四边形 → 4x 超采样填充后 BOX 下采。
参数域矩形的**边界恰好映射到四边形的四条直边**，所以既直又有真次像素 AA。
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import b19_cutlib as lib

MSK = 'temp/b19-sam2/6-b19_00001_.png'
OFF = (505, 1855)
PLATE = lib.DRAFT_PLATE
SS = 4
CORNER_R = 5.0                                # 稿 px 圆角半径
SKIRT_W, SKIRT_H, SH_W = 9, 52, 9

x0l, x1l = PLATE[0] - OFF[0], PLATE[1] - OFF[0] + 1
y0l, y1l = PLATE[2] - OFF[1], PLATE[3] - OFF[1] + 1

src = Image.open(lib.REF).convert('RGB')
crop = src.crop((OFF[0], OFF[1], OFF[0] + 530, OFF[1] + 300))
A = np.asarray(crop).astype(np.float32)
L = A.mean(2)
hard = np.asarray(Image.open(MSK).convert('L')) > 127

# ---------- ① 平整掩码（同 v1/v2，bbox 已验证与真值逐位吻合）----------
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
plate0 = np.asarray(mm) > 127

# ---------- ② 四条边拟合 ----------
ys0, xs0 = np.where(plate0)
bx0, bx1, by0, by1 = xs0.min(), xs0.max(), ys0.min(), ys0.max()
top_pts, bot_pts, lft_pts, rgt_pts = [], [], [], []
for x in range(bx0, bx1 + 1):
    col = np.where(plate0[:, x])[0]
    if len(col):
        top_pts.append((x, col[0]))
        bot_pts.append((x, col[-1]))
for y in range(by0, by1 + 1):
    row = np.where(plate0[y])[0]
    if len(row):
        lft_pts.append((row[0], y))
        rgt_pts.append((row[-1], y))


def fit_h(pts):                                       # y = a + b·x，取中段 70% 避开圆角
    p = np.asarray(pts, dtype=np.float64)
    lo, hi = p[:, 0].min() + 0.30 * (p[:, 0].max() - p[:, 0].min()), \
        p[:, 0].max() - 0.30 * (p[:, 0].max() - p[:, 0].min())
    q = p[(p[:, 0] >= lo) & (p[:, 0] <= hi)]
    b, a = np.polyfit(q[:, 0], q[:, 1], 1)
    rms = float(np.sqrt(((q[:, 1] - (a + b * q[:, 0])) ** 2).mean()))
    return (lambda x, a=a, b=b: a + b * x), rms, len(q)


def fit_v(pts):                                       # x = c + d·y（斜边用 x 对 y 拟合才数值稳定）
    p = np.asarray(pts, dtype=np.float64)
    lo, hi = p[:, 1].min() + 0.30 * (p[:, 1].max() - p[:, 1].min()), \
        p[:, 1].max() - 0.30 * (p[:, 1].max() - p[:, 1].min())
    q = p[(p[:, 1] >= lo) & (p[:, 1] <= hi)]
    d, c = np.polyfit(q[:, 1], q[:, 0], 1)
    rms = float(np.sqrt(((q[:, 0] - (c + d * q[:, 1])) ** 2).mean()))
    return (lambda y, c=c, d=d: c + d * y), rms, len(q)


ft, rt, nt = fit_h(top_pts)
fb, rb, nb = fit_h(bot_pts)
fl, rl, nl = fit_v(lft_pts)
fr, rr_, nr = fit_v(rgt_pts)
print(f'四边拟合残差 RMS（稿 px）：顶 {rt:.2f}(n={nt}) 底 {rb:.2f} 左 {rl:.2f} 右 {rr_:.2f}'
      f'  ← 这就是「手抖量」，v2 把它原样带进资产，v3 抹平')


def solve_corner(fh, fv, xlo, xhi):                  # 一条横边 y=fh(x) 与一条斜边 x=fv(y) 求交
    # ⚠ 两个函数自变量不同，不能直接 fh(x)==fv(x) 比。代入：残差 r(x) = fv(fh(x)) − x。
    xs_ = np.linspace(xlo, xhi, 8001)
    r = fv(fh(xs_)) - xs_
    i = int(np.argmin(np.abs(r)))
    x = float(xs_[i])
    return x, float(fh(x))


# 四角：顶∩左、顶∩右、底∩左、底∩右
TLx, TLy = solve_corner(ft, fl, bx0 - 40, bx0 + 40)
TRx, TRy = solve_corner(ft, fr, bx1 - 40, bx1 + 40)
BLx, BLy = solve_corner(fb, fl, bx0 - 40, bx0 + 40)
BRx, BRy = solve_corner(fb, fr, bx1 - 40, bx1 + 40)
quad = np.array([[TLx, TLy], [TRx, TRy], [BRx, BRy], [BLx, BLy]])
print('四角（稿 px）：' + ' '.join(f'{n}=({v[0]:.1f},{v[1]:.1f})'
                                   for n, v in zip(('TL', 'TR', 'BR', 'BL'), quad)))
w_top = np.hypot(TRx - TLx, TRy - TLy)
w_bot = np.hypot(BRx - BLx, BRy - BLy)
print(f'顶边宽 {w_top:.1f} / 底边宽 {w_bot:.1f} → 梯形比 {w_top / w_bot:.3f}（稿 0.979）')

# ---------- ③ 参数域圆角矩形 → 双线性映回四边形 → 4x 光栅化 ----------
Wm = 0.5 * (w_top + w_bot)
Hm = 0.5 * (np.hypot(BLx - TLx, BLy - TLy) + np.hypot(BRx - TRx, BRy - TRy))
ru, rv = CORNER_R / Wm, CORNER_R / Hm


def bilinear(u, v):
    u = np.asarray(u, dtype=np.float64)[:, None]
    v = np.asarray(v, dtype=np.float64)[:, None]
    return ((1 - u) * (1 - v) * quad[0] + u * (1 - v) * quad[1]
            + (1 - u) * v * quad[3] + u * v * quad[2])


arc = np.linspace(0, np.pi / 2, 14)
pts = []
# 每段弧的圆心与**自己的**角度区间必须配对（上一版配错导致多边形自交、形状全歪）：
# TL 圆心在左上 → π→3π/2；TR → 3π/2→2π；BR → 0→π/2；BL → π/2→π（v 轴向下）
for cu, cv, a0 in ((ru, rv, np.pi), (1 - ru, rv, 3 * np.pi / 2),
                   (1 - ru, 1 - rv, 0), (ru, 1 - rv, np.pi / 2)):
    for t in a0 + arc:
        pts.append((cu + ru * np.cos(t), cv + rv * np.sin(t)))
P = bilinear(np.array([p[0] for p in pts]), np.array([p[1] for p in pts]))
P *= SS
canvas = Image.new('L', ((bx1 - bx0 + 1 + 80) * SS, (by1 - by0 + 1 + 80) * SS), 0)
ox, oy = (bx0 - 40) * SS, (by0 - 40) * SS
ImageDraw.Draw(canvas).polygon([(p[0] - ox, p[1] - oy) for p in P], fill=255)
cov = np.asarray(canvas.filter(ImageFilter.GaussianBlur(1.2)).resize(
    (canvas.size[0] // SS, canvas.size[1] // SS), Image.BOX)).astype(np.float32) / 255.0
plate = cov > 0.5
# 把 cov 平移回 crop 坐标系（canvas 原点 = bx0-40, by0-40）
full_cov = np.zeros(L.shape, dtype=np.float32)
full_cov[by0 - 40:by0 - 40 + cov.shape[0], bx0 - 40:bx0 - 40 + cov.shape[1]] = cov
cov = full_cov
plate = cov > 0.5
ys, xs = np.where(plate)
print(f'直线化后掩码 bbox x[{xs.min()+OFF[0]},{xs.max()+OFF[0]}] y[{ys.min()+OFF[1]},{ys.max()+OFF[1]}]'
      f'（真值 x[{PLATE[0]},{PLATE[1]}] y[{PLATE[2]},{PLATE[3]}]）；'
      f'部分覆盖 {int(((cov > 0.01) & (cov < 0.999)).sum())} px')

# ---------- ④ 半透边取色（同 v2：向内射线到首个全覆盖像素）----------
solid = cov > 0.999
cen = np.array([ys.mean(), xs.mean()])
rgb = A.copy()
by, bx = np.where((cov > 0.01) & (~solid))
rep = 0
for py, px in zip(by, bx):
    d = cen - np.array([py, px], dtype=np.float32)
    n = np.hypot(*d)
    if n < 1e-3:
        continue
    d /= n
    for t in np.arange(1.0, 16.0, 0.5):
        qy, qx = int(round(py + d[0] * t)), int(round(px + d[1] * t))
        if 0 <= qy < L.shape[0] and 0 <= qx < L.shape[1] and solid[qy, qx]:
            rgb[py, px] = A[qy, qx]
            rep += 1
            break
print(f'  半透边取色 {rep}/{len(by)} px')

# ---------- ⑤ 影层：底边逐列实测 + 右下裙边（同 v2）----------
base_b = np.median(L[253:278, x0l:x1l], 0)
kmap = np.zeros(L.shape, dtype=np.float32)
kmap[y1l:y1l + SH_W, x0l:x1l] = np.clip(1.0 - L[y1l:y1l + SH_W, x0l:x1l] / np.maximum(base_b, 1e-3), 0, 1)
k_bottom = kmap[y1l:y1l + SH_W, x0l:x1l]
k_ref = float(np.nanmax(k_bottom[:, -24:]))
for y in range(int(ys.min()), int(ys.max()) + 1):
    row = np.where(plate[y])[0]
    if not len(row):
        continue
    rx = int(row[-1])
    fy = max(0.0, 1.0 - (ys.max() - y) / SKIRT_H) ** 1.35
    if fy <= 0:
        continue
    for dx in range(1, SKIRT_W + 1):
        if rx + dx < L.shape[1]:
            kmap[y, rx + dx] = max(kmap[y, rx + dx], k_ref * fy * (1.0 - dx / (SKIRT_W + 1.0)) ** 1.5)
kmap = np.where(plate, 0.0, kmap)
kmap = np.asarray(Image.fromarray((kmap * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9))) / 255.0
kmap = np.where(plate, 0.0, kmap)
print(f'  影：底边峰 {k_bottom.max():.3f}（左 {k_bottom[:, :12].max():.3f} → 右 {k_bottom[:, -12:].max():.3f}）'
      f' + 右下裙边锚 {k_ref:.3f}')


def compose(tag, gain, outdir):
    a_sh = np.clip(kmap * gain, 0.0, 1.0)
    alpha = cov + (1.0 - cov) * a_sh
    out = (rgb * cov[:, :, None]) / np.maximum(alpha, 1e-3)[:, :, None]
    rgba = Image.fromarray(np.dstack([np.clip(out, 0, 255).astype(np.uint8),
                                      (np.clip(alpha, 0, 1) * 255).astype(np.uint8)]))
    bb = np.asarray(rgba.split()[3]) > 4
    byy, bxx = np.where(bb)
    rgba = rgba.crop((int(bxx.min()), int(byy.min()), int(bxx.max()) + 1, int(byy.max()) + 1))
    os.makedirs(outdir, exist_ok=True)
    lib.report(tag, rgba, plate[byy.min():byy.max() + 1, bxx.min():bxx.max() + 1], outdir)


compose('本地腿 v3a 直线边 r5 + 影×1.0', 1.0, 'temp/b19-local3a')
compose('本地腿 v3b 直线边 r5 + 影×1.6', 1.6, 'temp/b19-local3b')
