#!/usr/bin/env python3
"""B23：PyMatting 的右下影是真影还是雾？换个底色还成立吗？

三问，逐问可证伪（不重复上一版自造的 L<245 阈值——牌外 p25 只有 218 灰阶，
说明 crop 里牌外不全是白背板，拍一个亮度阈值当"影真值"不成立）：

 Q1 方位：外溢集中在牌底（=稿上真有影）还是铺满四边（=糊出的光晕）？
     → 用「到牌体的距离分环 + 同环远场基线」测稿上暗度剖面，非阈值法。
 Q2 影的本质：⑤ 在影区的 RGB 是**稿上已合成过的暗色**（JoinImageWithAlpha 不改 RGB），
     而 v3a 的影是**乘性编码**（alpha=k、RGB=牌色），后者换底色才不坏。
     → 把两条腿分别合成到 白/灰/木 三种底上，看影的暗度还在不在。
 Q3 边缘：过渡带落在牌内（啃边）还是牌外（光晕）？10–90% 坡宽多少 px？
"""
import os
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import b19_cutlib as lib

OFF, CW, CH = (505, 1855), 530, 300
TX0, TY0, TW, TH = 68, 75, 386, 164
GT = np.asarray(Image.open('temp/b22-gt-mask.png').convert('L')) > 127
SRCC = np.asarray(Image.open(lib.REF).convert('RGB').crop(
    (OFF[0], OFF[1], OFF[0] + CW, OFF[1] + CH))).astype(np.float32)
L = SRCC.mean(2)


def dilate(m, n):
    out = m.copy()
    for _ in range(n):
        d = out.copy()
        d[1:, :] |= out[:-1, :]; d[:-1, :] |= out[1:, :]
        d[:, 1:] |= out[:, :-1]; d[:, :-1] |= out[:, 1:]
        out = d
    return out


# ---- Q1 距离分环：牌外第 r 圈相对「远场基线」的暗度，分方位 ----
gt2 = dilate(GT, 2)                       # 2 px 隔离带：避开牌体自身抗锯齿
outer = dilate(GT, 40) & ~gt2
rings = []
prev = gt2
for r in range(3, 41):
    cur = dilate(GT, r)
    rings.append((r, cur & ~prev))
    prev = cur
FAR = L[dilate(GT, 40) & ~outer] if (dilate(GT, 40) & ~outer).any() else L[outer]
base_far = float(np.median(L[outer]))
py, px_ = np.where(GT)
Y0, Y1, X0, X1 = py.min(), py.max(), px_.min(), px_.max()
print(f'[远场基线] 牌外 3–40 px 全域中位亮度 {base_far:.1f}')
print('\n[Q1 稿上暗度剖面] 环＝到牌体距离；暗度＝基线−本环中位（>0 才是影）')
print('  r   全域暗度   牌下方    牌上方    左      右     像素数')
for r, m in rings:
    if not m.any():
        continue
    def md(sel):
        if not sel.any():
            return float('nan')
        return base_far - float(np.median(L[m & sel]))
    below = np.zeros((CH, CW), bool); below[Y1 + 1:, :] = True
    above = np.zeros((CH, CW), bool); above[:Y0, :] = True
    left = np.zeros((CH, CW), bool); left[:, :X0] = True
    right = np.zeros((CH, CW), bool); right[:, X1 + 1:] = True
    print(f' {r:3d}  {md(np.ones((CH, CW), bool)):8.1f}  {md(below):8.1f} '
          f'{md(above):8.1f} {md(left):7.1f} {md(right):7.1f} {int(m.sum()):7d}')

SH_DEPTH = 8
# 表面基线不能用全域中位（被牌下方的架子拉低到 223）——
# 用「牌上方 3–20 px 那圈」的中位，那才是牌实际坐着的白背板
above_band = np.zeros((CH, CW), bool); above_band[:Y0, :] = True
SURFACE = None
_ab = np.zeros((CH, CW), bool)
for r, m in rings:
    if r <= 20:
        _ab |= (m & above_band)
if _ab.any():
    SURFACE = float(np.median(L[_ab]))
print(f'\n[表面基线] 牌上方 3–20 px 中位亮度 {SURFACE:.1f}（全域基线 {base_far:.1f} 被牌下方架子污染，不用）')

shadow_zone = np.zeros((CH, CW), bool)
depth = 0
for r, m in rings:
    sel = m & ~above_band                        # 影只可能在牌下方/两侧
    if not sel.any():
        continue
    d = SURFACE - float(np.median(L[sel]))
    if d > SH_DEPTH and r <= 12:
        shadow_zone |= (m & (L < SURFACE - SH_DEPTH))
        depth = r
print(f'[稿上真影] 物理深度到 r={depth} px；按「比背板暗 >{SH_DEPTH} 灰阶」圈定 {int(shadow_zone.sum())} px')


def load(path):
    im = Image.open(path).convert('RGBA')
    ar = np.asarray(im.split()[3]).astype(np.float32) / 255
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    if im.size != (CW, CH):
        h, w = ar.shape
        a = np.zeros((CH, CW), np.float32); R = np.zeros((CH, CW, 3), np.float32)
        a[TY0:TY0 + h, TX0:TX0 + w] = ar
        R[TY0:TY0 + h, TX0:TX0 + w] = rgb
        return a, R
    return ar, rgb


C4 = 'temp/b22-cut4'
LEGS = [('① SAM2 直出', f'{C4}/103-d1-sam2-raw_00001_.png'),
        ('④ +GuidedFilter', f'{C4}/112-d4-guidedfilter_00001_.png'),
        ('⑤ +PyMatting', f'{C4}/115-d5-pymatting_00001_.png'),
        ('⑧ GT+PyMatting', f'{C4}/124-d8-gt-pymatting_00002_.png'),
        ('⑩ 本地 v3a', 'temp/b19-local3a/source.png')]

print('\n[Q1 各腿外溢的方位分布]（牌上＝纯光晕，牌下＝可能是真影）')
for tag, p in LEGS:
    a, _ = load(p)
    leak = (~GT) & (a > 0.01)
    ly, lx = np.where(leak)
    if not leak.any():
        print(f'  {tag}: 外溢 0 px'); continue
    ab = int((ly < Y0).sum()); bl = int((ly > Y1).sum())
    sd = int(leak.sum()) - ab - bl
    inzone = int((leak & shadow_zone).sum())
    print(f'  {tag}: 外溢 {int(leak.sum()):6d}  牌上 {ab:6d}({100*ab/leak.sum():4.1f}%)  '
          f'牌下 {bl:6d}({100*bl/leak.sum():4.1f}%)  两侧 {sd:6d}  '
          f'落在影带内 {inzone}({100*inzone/leak.sum():4.1f}%)')

print('\n[Q2 换底色检验] 合成到各底色后，影带区相对**该底色本身**的暗化量 ΔL'
      '（越大＝影越实；若只在白底上有影、换深底就没＝稿上预合成的白底影，不可用）')
zone = shadow_zone
DR = float(251.0 - np.median(L[zone]))
print(f'  靶值：稿上真影在白背板上的暗化 ΔL = {251.0 - float(np.median(L[zone])):.1f} 灰阶'
      f'（影带中位亮度 {np.median(L[zone]):.1f}，背板 {SURFACE:.1f}）')
for tag, p in LEGS:
    a, rgb = load(p)
    outs = []
    for name, bg in [('白251', np.array([251., 250., 249.])),
                     ('灰140', np.full(3, 140.)),
                     ('深木90', np.array([96., 78., 60.]))]:
        comp = rgb * a[:, :, None] + bg[None, None, :] * (1 - a[:, :, None])
        Lc = comp.mean(2)
        z = zone & (a > 0.01)
        if not z.any():
            outs.append(f'{name} 无影(0 px)'); continue
        outs.append(f'{name} ΔL={float(bg.mean()) - float(np.median(Lc[z])):5.1f}'
                    f'[{int(z.sum())}px]')
    print(f'  {tag:16s} ' + '  '.join(outs))

print('\n[Q3 边缘过渡带] 沿牌底边法线向上射线：alpha 10%→90% 的坡宽与落点')
for tag, p in LEGS:
    a, _ = load(p)
    widths, inside, outside = [], 0, 0
    for x in range(X0 + 10, X1 - 10, 4):
        col = a[Y0 - 12:Y1 + 12, x]
        idx = np.where((col > 0.1) & (col < 0.9))[0]
        if len(idx):
            widths.append(len(idx))
        if (col[:12] > 0.9).any():
            outside += 1
    if widths:
        print(f'  {tag:16s} 坡宽 中位 {int(np.median(widths))} px  '
              f'max {max(widths)} px  （底部法线取样 {len(widths)} 条）')
