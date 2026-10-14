#!/usr/bin/env python3
"""B21 箭头圆钮补 AA：把 v3 的「解析轮廓 + 4x 覆盖率 + 去污染取色」换成圆版。

为什么是负收益的反例已被实测：老资产 ui_btn_arrow_bg_normal.png **半透边环 0 px**
（硬边阶梯），周向半径残差 RMS 0.83 px / 最大 1.9 px —— 与用户「边缘不够平滑」同源。

只做外形，不动几何与投影：
  · pressed 的底缘投影带（v14–v16 反复回退调出来的）原样保留，只重建圆盘那圈边；
  · 残差一律先去线性趋势（把轻微椭圆/偏心吸掉），剩下的才是真抖。
"""
import os
import numpy as np
from PIL import Image

B = 'games/beads/design/art/shots/menu-showcase-20261010/btn-arrow/'
OUT = 'temp/b21-arrow'
os.makedirs(OUT, exist_ok=True)


def boundary_pts(m, cx=None, cy=None, nsec=180):
    """取外缘点：按角度扇区取最远一个。

    ⚠ 不能直接把**全部**不透明点喂给 Kasa+径向精修：实心盘大量内部点会
    把半径往内吸（实测 r 从真值≈71 被拉到 47.6 ≈ 0.7 倍）。
    没圆心时先用 bbox 估一个（对盘这种凸形够准）。
    """
    ys, xs = np.where(m)
    x = xs.astype(float); y = ys.astype(float)
    if cx is None:
        cx, cy = (x.min() + x.max()) / 2, (y.min() + y.max()) / 2
    d = np.hypot(x - cx, y - cy); th = np.arctan2(y - cy, x - cx)
    bx, by = [], []
    for ang in np.linspace(0, 2 * np.pi, nsec, endpoint=False):
        dt = (th - ang + np.pi) % (2 * np.pi) - np.pi
        sel = np.abs(dt) < (np.pi / nsec)
        if sel.any():
            i = int(np.argmax(d[sel]))
            bx.append(float(x[sel][i])); by.append(float(y[sel][i]))
    return np.asarray(bx), np.asarray(by)


def fit_circle(x, y):
    """Kasa 拟合 + 3 轮径向精修（同 btn-arrow-cut 里 pressed 的作法）。"""
    A = np.c_[2 * x, 2 * y, np.ones(len(x))]
    sol, *_ = np.linalg.lstsq(A, (x ** 2 + y ** 2), rcond=None)
    cx, cy = sol[0], sol[1]
    r = np.sqrt(sol[2] + cx * cx + cy * cy)
    for _ in range(3):
        d = np.hypot(x - cx, y - cy)
        n = np.c_[(x - cx) / d, (y - cy) / d, np.ones(len(x))]
        delta, *_ = np.linalg.lstsq(n, d - r, rcond=None)
        cx += delta[0]; cy += delta[1]; r += delta[2]
    return cx, cy, r


def radial_rms(m, cx, cy, nsec=180):
    x, y = boundary_pts(m, cx, cy, nsec)
    d = np.hypot(x - cx, y - cy); th = np.arctan2(y - cy, x - cx)
    prof = []
    for ang in np.linspace(0, 2 * np.pi, nsec, endpoint=False):
        dt = (th - ang + np.pi) % (2 * np.pi) - np.pi
        sel = np.abs(dt) < 0.035
        prof.append(d[sel].max() if sel.any() else np.nan)
    prof = np.array(prof); k = ~np.isnan(prof)
    idx = np.arange(nsec)
    lin = np.polyfit(idx[k], prof[k], 1)
    resid = prof[k] - np.polyval(lin, idx[k])
    return float(resid.std()), float(np.abs(resid).max())


for name in ('ui_btn_arrow_bg_normal', 'ui_btn_arrow_bg_pressed'):
    im = Image.open(B + name + '.png').convert('RGBA')
    a = np.asarray(im.split()[3]).astype(np.float32) / 255
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    full = a > 0.999
    bx0, by0 = boundary_pts(full)
    cx, cy, r = fit_circle(bx0, by0)
    bx, by = boundary_pts(full, cx, cy)          # 用真实圆心重取一次外缘
    cx, cy, r = fit_circle(bx, by)
    before = radial_rms(full, cx, cy)
    print(f'--- {name} {im.size} ---')
    print(f'  圆盘拟合（外缘点） 圆心({cx:.1f},{cy:.1f}) r={r:.2f}  '
          f'老 alpha 周向残差 RMS {before[0]:.2f} px 最大 {before[1]:.2f} px')
    print(f'  老资产半透边环 {int(((a > 0.01) & (~full)).sum())} px（=抗锯齿信息量）')

    H, W = a.shape
    yy, xx = np.mgrid[0:H, 0:W]
    signed = np.hypot(xx - cx, yy - cy) - r                    # 圆内负、圆外正
    cov = np.clip(0.5 - signed, 0.0, 1.0)                      # 1 px 线性覆盖环（解析 AA）
    # 影与盘外交互：原 alpha 里落在圆外的部分＝投影带，原样保留（不动 v14–v16 的调法）
    shadow = np.clip(a - cov, 0, 1) * (signed > 0.5)
    alpha = np.clip(cov + shadow * (1 - cov), 0, 1)

    # 去污染：新增的解析边环上原 RGB 是「盘色×背景」混合，沿半径向内取首个全不透明实色
    out_rgb = rgb.copy()
    ring = (cov > 0.01) & (cov < 0.999)
    ry, rx = np.where(ring)
    hit = 0
    for py, px in zip(ry, rx):
        vx, vy = px - cx, py - cy
        n = np.hypot(vx, vy)
        if n < 1e-3:
            continue
        ux, uy = -vx / n, -vy / n
        for t in np.arange(0.5, 10.0, 0.5):
            qy, qx = int(round(py + uy * t)), int(round(px + ux * t))
            if 0 <= qy < H and 0 <= qx < W and full[qy, qx]:
                out_rgb[py, px] = rgb[qy, qx]; hit += 1; break
    print(f'  解析边环 {int(ring.sum())} px，向内取色命中 {hit} px（{100*hit/max(ring.sum(),1):.0f}%）')

    new = Image.fromarray(np.dstack([np.clip(out_rgb, 0, 255), (alpha * 255).astype(np.uint8)]).astype(np.uint8), 'RGBA')
    new.save(f'{OUT}/{name}-aa.png')
    after = radial_rms(np.asarray(new.split()[3]) > 250, cx, cy)
    na = np.asarray(new.split()[3]).astype(np.float32) / 255
    print(f'  新 alpha 全不透明区周向残差 RMS {after[0]:.2f} px 最大 {after[1]:.2f} px'
          f'（解析圆＝只剩光栅量化）  半透边环 {int(((na > 0.01) & (na < 0.999)).sum())} px')
    print(f'  投影带保留 {int(shadow.sum())} px（圆外 alpha>0）')
    for tag, bg in (('magenta', (255, 0, 255, 255)), ('cream', (246, 238, 222, 255))):
        p = Image.new('RGBA', new.size, bg); p.paste(new, (0, 0), new)
        p.convert('RGB').resize((W * 3, H * 3), Image.NEAREST).save(f'{OUT}/{name}-on-{tag}.png')
