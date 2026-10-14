#!/usr/bin/env python3
"""B25 柜内木牌定稿：影档 = ×1.0（用户 2026-10-14 拍板，忠实稿实测）。

上游 = b19-local3.py 的 v4（影层换成稿上二维实测，已落 temp/b19-local4/source.png）。
历史：B21 定的是 v3a（一维剖面影），B24 确诊其形状不对后改走二维实测。
本步只做两件事：
  ① 按项目口径缩到 @2x：稿 px × (750/1520) × 2 = ×0.98684（牌高 163 → 161 @2x）。
  ② 缩放必须走**预乘 alpha**：直接 resize RGBA 会让透明区的黑 RGB 渗进半透边缘，
     等于自己造一圈杂边 —— 正是我们在云端腿上否掉的那个毛病。
"""
import os
import numpy as np
from PIL import Image

import b19_cutlib as lib

SRC = 'temp/b19-local4/source.png'    # v4 定稿资产（稿 px 域，含二维影，lib.report 已裁边）
OUT = 'production/qa/menu-b19/asset'
K = lib.S * 2                        # 稿 px → @2x px = 0.98684
PAD = 2                              # 缩完后的外扩留白（@2x px），给渲染器双线性取样

os.makedirs(OUT, exist_ok=True)
im = Image.open(SRC).convert('RGBA')            # v3a 定稿资产（稿 px 域，含影，lib.report 已裁边）
plate_px = (int(round(im.size[0] * K)), int(round(im.size[1] * K)))
a = np.asarray(im.split()[3]).astype(np.float32) / 255.0
rgb = np.asarray(im.convert('RGB')).astype(np.float32)
pm = rgb * a[:, :, None]                                  # 预乘
pm_img = Image.fromarray(np.dstack([pm, a * 255]).astype(np.uint8))
small = pm_img.resize(plate_px, Image.LANCZOS)            # 在预乘域缩放
sa = np.asarray(small.split()[3]).astype(np.float32) / 255.0
sr = np.asarray(small.convert('RGB')).astype(np.float32)
# LANCZOS 有负瓣：牌体亮边会被振铃到外侧 3–4 px 的纯影区，再除以小 alpha 就放大成
# RGB 255 的白点（实测 30 px，alpha 0.027–0.090）—— 正是乘性编码要消除的「把底带进来」。
# 影区 RGB 本来就该是 0，所以用牌体覆盖率的同口径重采样当门，盖不到的地方直接抹零。
cov_r = np.asarray(Image.fromarray(
    (np.asarray(im.split()[3]) > 230).astype(np.uint8) * 255
).resize(plate_px, Image.LANCZOS)).astype(np.float32) / 255.0
sr = np.where(cov_r[:, :, None] < 0.01, 0.0, sr)
out = np.zeros_like(sr)
np.divide(sr, np.maximum(sa[:, :, None], 1e-3), out=out, where=sa[:, :, None] > 1e-3)
final = Image.fromarray(np.dstack([np.clip(out, 0, 255), sa * 255]).astype(np.uint8), 'RGBA')
print(f'【影区抹零】牌体覆盖率重采样 <0.01 且原 RGB≠0 的 px：'
      f'{int(((cov_r < 0.01) & (np.asarray(small.convert("RGB")).astype(np.float32).max(2) > 0)).sum())}'
      f'（这些就是 LANCZOS 振铃进来的亮边）')

# 对照：lib.report 里那条 naive resize（非预乘）到底差多少
naive = im.resize(plate_px, Image.LANCZOS)
na = np.asarray(naive.split()[3]).astype(np.float32) / 255.0
nr = np.asarray(naive.convert('RGB')).astype(np.float32)
fr = np.asarray(final.convert('RGB')).astype(np.float32)
ring = (sa > 0.01) & (sa < 0.999)                          # 半透边环（影 + 抗锯齿）
inner = sa >= 0.999
print(f'【重采样对照】目标 {plate_px[0]}×{plate_px[1]} px')
print(f'  半透边环 {int(ring.sum())} px：naive 相对预乘的 RGB 偏移 均值 '
      f'{np.round((nr[ring] - fr[ring]).mean(0), 2).tolist()}，最暗 '
      f'{np.round((nr[ring] - fr[ring]).min(0), 1).tolist()} 灰阶')
print(f'  不透明区内部 RGB 偏移均值 {np.round((nr[inner] - fr[inner]).mean(0), 2).tolist()}'
      f'  alpha 最大差 {float(np.abs(na - sa).max()) * 255:.0f}/255')

pad_img = Image.new('RGBA', (final.size[0] + PAD * 2, final.size[1] + PAD * 2), (0, 0, 0, 0))
pad_img.paste(final, (PAD, PAD))
pad_img.save(f'{OUT}/plate-shadow@2x.png')

# ---- 目检底：洋红看 alpha，奶白看影（与 v1–v3 同一把尺子）----
for tag, bg in (('magenta', (255, 0, 255, 255)), ('cream', (246, 238, 222, 255))):
    p = Image.new('RGBA', pad_img.size, bg)
    p.paste(pad_img, (0, 0), pad_img)
    p.convert('RGB').resize((pad_img.size[0] * 2, pad_img.size[1] * 2), Image.NEAREST) \
        .save(f'{OUT}/plate-on-{tag}.png')

# ---- 判据：在 @2x 域再量一遍，确认缩放没把平整度与姿态做坏 ----
# 牌体掩码一律从 plate-mask.png 取（alpha==255 会把抗锯齿环一并当影，量出来偏小一圈）
fa = np.asarray(pad_img.split()[3])[PAD:PAD + plate_px[1], PAD:PAD + plate_px[0]]
pmask = Image.open('temp/b19-local4/plate-mask.png').convert('L').resize(plate_px, Image.LANCZOS)
m0 = np.asarray(pmask) > 127
ys2, xs2 = np.where(m0)
py0, py1, px0, px1 = ys2.min(), ys2.max() + 1, xs2.min(), xs2.max() + 1
sh = (~m0) & (fa > 0)
h_norm = 164 / max(py1 - py0, 1)        # 归一到牌高 164 px，与 B20 各腿同一把尺
u8 = Image.fromarray((m0.astype(np.uint8)) * 255).resize(
    (int(round(plate_px[0] * h_norm)), int(round(plate_px[1] * h_norm))), Image.LANCZOS)
m = np.asarray(u8) > 127
mh, mw = m.shape
ft, jt = lib.flat_h(m, 40, mw - 40, 'top')
fb, jb = lib.flat_h(m, 40, mw - 40, 'bot')
vl, kl = lib.flat_v(m, 25, mh - 25, 'l')
vr, kr = lib.flat_v(m, 25, mh - 25, 'r')
st = lib.edge_slope(m, 40, mw - 40, 'top')
sb = lib.edge_slope(m, 40, mw - 40, 'bot')
sc, wtop, wbot = lib.trap_ratio(op_ := (np.asarray(pad_img.split()[3]) == 255))
k = fa[sh] / 255.0
print(f'@2x 资产 {pad_img.size[0]}×{pad_img.size[1]} px（含影，四周留 {PAD} px 透明边）')
print(f'  牌体 {py1-py0}×{px1-px0} @2x（稿 163×385 × {K:.4f} = {163*K:.1f}×{385*K:.1f}）')
print(f'  [透视] 顶跨 {wtop} / 底跨 {wbot} → 梯形比 {sc:.3f}（稿 {lib.DRAFT_TRAP}）；'
      f'顶边 {st:+.2f}° / 底边 {sb:+.2f}°')
print(f'  [平整] 归一牌高 164 px（与 B20 同尺）：顶 RMS {ft:.2f}/跳变 {jt:.1f} · 底 {fb:.2f}/{jb:.1f} · '
      f'左斜 {vl:.2f}/{kl:.1f} · 右斜 {vr:.2f}/{kr:.2f}')
print(f'  [阴影] 牌体外有影 {int(sh.sum())} px（占牌面积 {sh.sum()/((py1-py0)*(px1-px0))*100:.1f}%），'
      f'不透明度 均值 {k.mean()*100:.1f}% / p99 {np.percentile(k,99)*100:.1f}%')
face = lib.face_color(pad_img)
print(f'  牌面中位色 {np.round(face,1).tolist()}（稿 {list(lib.DRAFT_FACE)}）'
      f'  色差 {float(np.abs(face - np.array(lib.DRAFT_FACE)).max()):.1f}')
print(f'产物：{OUT}/plate-shadow@2x.png  plate-on-magenta.png  plate-on-cream.png')
