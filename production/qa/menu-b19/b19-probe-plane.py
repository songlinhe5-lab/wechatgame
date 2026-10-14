#!/usr/bin/env python3
"""B19 探针 A+B：把台面当**二维平面**拟合，再量牌四周残差 —— 纠正上一轮的判据错误。

上一轮我用「同列/同行远场中位」当基线。台面本身有渐变和一条灰蓝带，远场参考也落在
同一条带里，于是残差被基线一起吃掉 → 得出「右侧只差 3 灰阶、没有影」。
那个比法不成立。这次改成：远离牌的干净台面像素拟合 L ≈ a+b·x+c·y，
把拟合外推回牌四周，残差 < 0 的区域才可能是投影。

再叠一把**色相刀**：投影是「变暗且色相不往蓝偏」（稿上影实测 R>G>B，暖调），
搁板台面自身的灰蓝带是「B 相对升高」。所以残差要同时看 ΔL 与 Δ(R−B)，
两者分开才能把「影」和「带」区分开。
"""
import numpy as np
from PIL import Image

REF = 'games/beads/design/art/shots/menu-showcase-20261010/v1-mainmenu-final.png'
P = (576, 961, 1931, 2094)                 # 牌体真值外框（含描边）

im = Image.open(REF).convert('RGB')
A = np.asarray(im).astype(np.float32)
L = A.mean(2)
RB = A[:, :, 0] - A[:, :, 2]

x0, x1, y0, y1 = P
W = 340
crop = im.crop((x0 - 120, y0 - 100, x1 + 200, y1 + 200))
crop.resize((crop.size[0] * 2, crop.size[1] * 2), Image.NEAREST).save('temp/b19-probe-neighborhood.png')
print(f'邻域放大图 temp/b19-probe-neighborhood.png {crop.size} → 2x（先目检再信数字）')

# ---- 干净远场：离牌外框 ≥ FAR px 的像素（四周各取 W 宽的大窗）----
FAR = 45
gx, gy = np.meshgrid(np.arange(A.shape[1]), np.arange(A.shape[0]))
dx = np.clip(x0 - gx, 0, None) + np.clip(gx - x1, 0, None)
dy = np.clip(y0 - gy, 0, None) + np.clip(gy - y1, 0, None)
dist = np.maximum(dx, dy)                   # 切比雪夫距离：到外框的最近距离
inx = (gx > x0 - W) & (gx < x1 + W)
iny = (gy > y0 - W) & (gy < y1 + W)
far = inx & iny & (dist >= FAR)
print(f'远场样本 {int(far.sum())} px（离牌 ≥{FAR}px，窗宽 ±{W}）')

def fit_masked(chan, sel):
    xs, ys = chan.shape[1], chan.shape[0]
    gx2, gy2 = np.meshgrid(np.arange(xs), np.arange(ys))
    v = chan[sel]
    M = np.stack([np.ones(sel.sum()), gx2[sel].ravel(), gy2[sel].ravel()], 1)
    coef, *_ = np.linalg.lstsq(M, v, rcond=None)
    pred = coef[0] + coef[1] * gx2 + coef[2] * gy2
    resid = chan - pred
    r = v - M @ coef
    print(f'  拟合 L: a={coef[0]:.1f} bx={coef[1]:+.3f} by={coef[2]:+.3f}  '
          f'远场残差 std={r.std():.2f} p1={np.percentile(r,1):.1f} p99={np.percentile(r,99):.1f}')
    return resid, coef

resL, _ = fit_masked(L, far)
resRB, _ = fit_masked(RB, far)
near = inx & iny & (dist >= 0) & (dist < FAR)
print(f'近场带样本 {int(near.sum())} px（牌外 0–{FAR}px）')

# ---- 分侧读数：残差中位（负＝比台面预测更暗＝候选影）----
sides = {
    '底 y>%d' % (y1 + 1): (gy > y1, gx >= x0 - 6, gx <= x1 + 6, 1, 26),
    '右 x>%d' % (x1 + 1): (gx > x1, gy >= y0 - 6, gy <= y1 + 6, 1, 26),
    '右下（对角扇区）': None,
    '顶 y<%d' % (y0 - 1): (gy < y0, gx >= x0 - 6, gx <= x1 + 6, 1, 26),
    '左 x<%d' % (x0 - 1): (gx < x0, gy >= y0 - 6, gy <= y1 + 6, 1, 26),
}
print('\n分侧（沿边全长的中位残差，按离开牌边的距离分档）：')
print(f"{'侧':<22}{'档':<10}{'ΔL 中位':>10}{'ΔL p10':>9}{'Δ(R−B) 中位':>13}{'n':>8}")
for name, spec in sides.items():
    if spec is None:
        continue
    cond, _, _, d0, d1 = spec[0], spec[1], spec[2], spec[3], spec[4]
    for lo, hi in ((1, 4), (4, 10), (10, 26)):
        band = cond & (dist >= lo) & (dist < hi) & near
        n = int(band.sum())
        if n < 40:
            continue
        rl = resL[band]
        rr = resRB[band]
        print(f'{name:<22}{f"{lo}-{hi}px":<10}{np.median(rl):>10.1f}{np.percentile(rl,10):>9.1f}'
              f'{np.median(rr):>+13.1f}{n:>8}')

# 右下对角扇区单独量：以牌右下角为原点，r 与 45°方向内
cx, cy = x1, y1
rr_ = np.hypot(gx - cx, gy - cy)
ang = np.degrees(np.arctan2((gy - cy).astype(np.float32), (gx - cx).astype(np.float32)))
se = (ang > 15) & (ang < 75) & (rr_ >= 2)
print('\n右下对角扇区（15°–75°，距右下角 ≥2px）：')
for lo, hi in ((2, 12), (12, 28), (28, 60), (60, 110)):
    band = se & (rr_ < hi) & (rr_ >= lo) & inx & iny
    n = int(band.sum())
    if n < 40:
        continue
    print(f'  r{lo:>3}-{hi:<3}px  ΔL 中位 {np.median(resL[band]):>6.1f}  '
          f'ΔL p10 {np.percentile(resL[band],10):>6.1f}  '
          f'Δ(R−B) 中位 {np.median(resRB[band]):>+6.1f}  n={n}')

# ---- 残差图落盘，目检影到底长什么样 ----
viz = np.clip((resL - resL.min()) / max(1e-3, (resL.max() - resL.min())), 0, 1)
Image.fromarray((viz * 255).astype(np.uint8)).crop(
    (x0 - 120, y0 - 100, x1 + 200, y1 + 200)).resize((640, 800), Image.LANCZOS
).save('temp/b19-probe-residualL.png')
viz2 = np.clip((resRB - resRB.min()) / max(1e-3, (resRB.max() - resRB.min())), 0, 1)
Image.fromarray((viz2 * 255).astype(np.uint8)).crop(
    (x0 - 120, y0 - 100, x1 + 200, y1 + 200)).resize((640, 800), Image.LANCZOS
).save('temp/b19-probe-residualRB.png')
print('\n残差图（黑＝比台面预测暗 / 色相反）temp/b19-probe-residualL.png, '
      'temp/b19-probe-residualRB.png')
