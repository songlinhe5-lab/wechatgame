#!/usr/bin/env python3
"""B19 共用判据：两条腿（本地 SAM2 / 云端 qwen 指令）必须用同一把尺子量。

三条硬要求各自量化，不靠目测：
  有透视     = 梯形比 = 顶行跨度 / 底行跨度（矩形 1.000；稿实测 0.979）
  有阴影     = 牌体外有影像素、且 alpha 按「相对局部基线的衰减」编码（乘性，非实心块）
  外轮廓平整 = 平边（顶/底）逐列边界偏差；斜边（左/右）先去透视斜率再量残差 RMS 与相邻行跳变
"""
import numpy as np
from PIL import Image

REF = 'games/beads/design/art/shots/menu-showcase-20261010/v1-mainmenu-final.png'
S = 750 / 1520                      # 稿 px → 设计 px
DEV_H = 160                         # 牌高 80 设计 px @2x
DRAFT_TRAP = 0.979                  # 稿上实测梯形比
DRAFT_FACE = (242.0, 195.0, 139.0)  # 稿上牌面中位色
DRAFT_PLATE = (576, 961, 1931, 2094)  # 牌体真值外框（稿 px，含顶描边）


def flat_h(mask, x0, x1, which):
    """平边（顶/底）：逐列取首/末真值行 → 去斜率 → (残差 RMS, 相邻列最大跳变) px。"""
    xs, ys = [], []
    for x in range(x0, x1):
        r = np.where(mask[:, x])[0]
        if len(r):
            xs.append(x)
            ys.append(r[0] if which == 'top' else r[-1])
    if len(xs) < 20:
        return float('nan'), 0
    x = np.asarray(xs, dtype=float)
    y = np.asarray(ys, dtype=float)
    k, b0 = np.polyfit(x, y, 1)
    d = y - (k * x + b0)
    return float(np.sqrt((d ** 2).mean())), int(np.abs(np.diff(y)).max())


def flat_v(mask, y0, y1, side):
    """斜边（左/右）：逐行取首/末真值列 → 去透视斜率 → (残差 RMS, 相邻行最大跳变) px。

    量顶边不行——梯形牌顶边本就水平，RMS 恒 0，证不了什么；斜边才是抖动暴露处。
    """
    xs, ys = [], []
    for y in range(y0, y1):
        c = np.where(mask[y])[0]
        if len(c):
            ys.append(y)
            xs.append(c[0] if side == 'l' else c[-1])
    if len(xs) < 20:
        return float('nan'), 0
    x = np.asarray(xs, dtype=float)
    y = np.asarray(ys, dtype=float)
    k, b0 = np.polyfit(y, x, 1)
    d = x - (k * y + b0)
    return float(np.sqrt((d ** 2).mean())), int(np.abs(np.diff(x)).max())


def edge_slope(mask, x0, x1, which):
    """顶/底边的平均斜度（度）。梯形比只说「上窄下宽」，说不了「牌是否歪着站」。"""
    xs, ys = [], []
    for x in range(x0, x1):
        r = np.where(mask[:, x])[0]
        if len(r):
            xs.append(x)
            ys.append(r[0] if which == 'top' else r[-1])
    if len(xs) < 20:
        return float('nan')
    k = np.polyfit(np.asarray(xs, dtype=float), np.asarray(ys, dtype=float), 1)[0]
    return float(np.degrees(np.arctan(k)))


def trap_ratio(opaque):
    """梯形比 = 顶行跨度 / 底行跨度（只用全不透明＝牌体，避免影层混入）。"""
    rows = np.where(opaque.any(1))[0]
    if len(rows) < 10:
        return float('nan'), 0, 0

    def ext(i):
        c = np.where(opaque[i])[0]
        return int(c.max() - c.min())
    t, b = ext(rows[3]), ext(rows[-4])
    return (t / max(b, 1)), t, b


def face_color(rgba):
    """牌面中位色：取不透明区中心 60%×60%，避开描边与影。"""
    al = np.asarray(rgba.split()[3])
    ys, xs = np.where(al == 255)
    if len(ys) < 100:
        return None
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    sy = slice(int(y0 + (y1 - y0) * .2), int(y1 - (y1 - y0) * .2))
    sx = slice(int(x0 + (x1 - x0) * .2), int(x1 - (x1 - x0) * .2))
    px = np.asarray(rgba.convert('RGB'))[sy, sx].reshape(-1, 3)
    return np.median(px, 0).astype(float)


def shadow_report(rgba, plate_only):
    """影层读数：牌体外有影像素占比 + 峰值/均值不透明度（k = alpha/255，乘性编码）。"""
    al = np.asarray(rgba.split()[3])
    outside = (~plate_only) & (al > 0)
    n = int(outside.sum())
    if not n:
        return 0, 0.0, 0.0
    k = al[outside] / 255.0
    return n, float(k.mean()), float(np.percentile(k, 99))


def report(tag, rgba, plate_only, outdir, unit=164):
    """统一口径打印 + 落两张目检底（洋红看 alpha / 奶白看影）。

    unit：平整度归一基准（牌体高 px）。云端出图 2048²、稿只有 386×164，
    不归一的话两边 RMS 根本不可比。行/列带由 plate_only 自动推出。
    """
    al = np.asarray(rgba.split()[3])
    op = (al == 255)
    ys, xs = np.where(plate_only)
    py0, py1, px0, px1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
    ph = py1 - py0
    f = unit / max(ph, 1)                       # 归一到 unit px 高
    r = trap_ratio(op)
    ft, jt = flat_h(plate_only, px0 + 40, px1 - 40, 'top')
    fb, jb = flat_h(plate_only, px0 + 40, px1 - 40, 'bot')
    vl, kl = flat_v(plate_only, py0 + 25, py1 - 25, 'l')
    vr, kr = flat_v(plate_only, py0 + 25, py1 - 25, 'r')
    n, kmean, kpk = shadow_report(rgba, plate_only)
    fc = face_color(rgba)
    print(f'--- {tag} ---')
    print(f'  牌体 {ph}x{px1 - px0} 自出图 px → 宽高比 {(px1 - px0) / ph:.3f}（稿 '
          f'{(DRAFT_PLATE[1] - DRAFT_PLATE[0]) / (DRAFT_PLATE[3] - DRAFT_PLATE[2] + 1):.3f}）；'
          f'资产含影 {rgba.size[0]}x{rgba.size[1]}，'
          f'不透明 {op.mean()*100:.1f}% 半透明 {((al > 0) & (al < 255)).mean()*100:.2f}%')
    print(f'  [透视] 顶跨 {r[1]} / 底跨 {r[2]} → 梯形比 {r[0]:.3f}（稿 {DRAFT_TRAP}；1.000=已被矩形化）'
          f'；顶边斜度 {edge_slope(plate_only, px0 + 40, px1 - 40, "top"):+.2f}° / '
          f'底边 {edge_slope(plate_only, px0 + 40, px1 - 40, "bot"):+.2f}°')
    print(f'  [平整] 已归一到牌高 {unit} px：顶边 RMS {ft*f:.2f}/跳变 {jt*f:.1f} · '
          f'底边 {fb*f:.2f}/{jb*f:.1f} · 左斜边 {vl*f:.2f}/{kl*f:.1f} · 右斜边 {vr*f:.2f}/{kr*f:.1f}')
    print(f'  [阴影] 牌体外有影 {n} px（占牌面积 {n/(ph*(px1-px0))*100:.1f}%），'
          f'不透明度 均值 {kmean*100:.1f}% / p99 {kpk*100:.1f}%')
    if fc is not None:
        d = np.abs(fc - np.asarray(DRAFT_FACE)).max()
        print(f'  [风格] 牌面中位色 {fc.astype(int).tolist()} vs 稿 '
              f'{np.asarray(DRAFT_FACE).astype(int).tolist()} → 最大通道差 {d:.0f}')
    # 缩放必须走**预乘 alpha**：直接 resize RGBA 时，透明区 RGB=0 会被 LANCZOS 负瓣
    # 吸进半透边环 → 自己造一圈暗杂边。实测（v3a @2x）边环 5354 px RGB 均值
    # 偏移 -8.1/-6.1/-7.8，最暗 -131/-140/-170 灰阶；alpha 通道本身不受影响。
    pa = np.asarray(rgba.split()[3]).astype(np.float32) / 255.0
    premul = Image.fromarray(np.dstack([
        np.asarray(rgba.convert('RGB')).astype(np.float32) * pa[:, :, None],
        pa * 255]).astype(np.uint8))
    d2p = premul.resize((max(1, int(round(rgba.size[0] * S * 2))),
                         max(1, int(round(rgba.size[1] * S * 2)))), Image.LANCZOS)
    da = np.asarray(d2p.split()[3]).astype(np.float32) / 255.0
    dr = np.asarray(d2p.convert('RGB')).astype(np.float32)
    du = np.zeros_like(dr)
    np.divide(dr, np.maximum(da[:, :, None], 1e-3), out=du, where=da[:, :, None] > 1e-3)
    d2 = Image.fromarray(np.dstack([np.clip(du, 0, 255), da * 255]).astype(np.uint8), 'RGBA')
    d2.save(f'{outdir}/at2x.png')
    # 下游要复用本资产时必读这两张：重采样会改 alpha，拿 at2x 反推牌体掩码会把
    # 边界像素当成影（实测阴影均值从 12.5% 虚高到 25.9%）。
    rgba.save(f'{outdir}/source.png')
    Image.fromarray(plate_only.astype(np.uint8) * 255).save(f'{outdir}/plate-mask.png')
    for name, bg in (('magenta', (255, 0, 255, 255)), ('cream', (250, 247, 240, 255))):
        c = Image.new('RGBA', d2.size, bg)
        c.paste(d2, (0, 0), d2)
        c.convert('RGB').save(f'{outdir}/on-{name}.png')
    return {'trap': r[0], 'flat': (ft * f, fb * f, vl * f, vr * f), 'shadow_px': n}
