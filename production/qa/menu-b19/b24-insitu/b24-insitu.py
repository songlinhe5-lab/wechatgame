#!/usr/bin/env python3
"""B24：把三条腿合成回**真实橱窗底**上看（回应「⑤更贴原图，但没合成看过」）。

B23 我用的 白251/灰140/深木90 是**假想底**，实测稿上牌周围的真实底是
奶白内壁(≈250) + 玻璃层板(≈176) + 板前浅木(≈220) 三条横带 —— 既不是纯白也不是深木，
所以「换底反号」那条结论在真实底上要重算，不能沿用。

做法（可复核，不伪造场景）：
 1) 稿上把牌+四周 24 px 挖掉，用**同一行**左侧干净带（x 380–560）横向平铺补回
    —— 橱窗背景是横带状结构，横向平铺几何上成立；
 2) 三条腿按原位贴回这张「干净橱窗」，量 ①对稿 RMSE ②接触带影深保留率；
 3) 出图：行＝稿原样/④/⑤/⑩，列＝全景 / 牌底边 4× 放大。
"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import b19_cutlib as lib

REF = lib.REF
OFF, CW, CH = (505, 1855), 530, 300
TX0, TY0, TW, TH = 68, 75, 386, 164
X0, Y0 = OFF[0] + TX0, OFF[1] + TY0
X1, Y1 = X0 + TW, Y0 + TH
SRCX = (380, 560)                          # 干净带（同行横向平铺源）

full = np.asarray(Image.open(REF).convert('RGB')).astype(np.float32)
GT = np.asarray(Image.open('temp/b22-gt-mask.png').convert('L')) > 127


def dil(m, n):
    o = m.copy()
    for _ in range(n):
        d = o.copy()
        d[1:, :] |= o[:-1, :]; d[:-1, :] |= o[1:, :]
        d[:, 1:] |= o[:, :-1]; d[:, :-1] |= o[:, 1:]
        o = d
    return o


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

# 平铺不跟随稿上的行亮度剖面（牌周围有渐暗晕）→ 接缝可见。
# 逐行加一个常量，使重建底在**洞外**的行中位与稿一致（只校整行亮度，不造细节）
for y in range(Y0 - 30, Y1 + 30):
    seg = slice(X0 - 30, X1 + 30)
    keep = ~hole[y, seg]
    if keep.sum() < 20:
        continue
    corr = (np.median(full[y, seg][keep], 0) - np.median(clean[y, seg][keep], 0))
    idx = np.where(hole[y, seg])[0]
    clean[y, seg.start + idx] = clean[y, seg.start + idx] + corr

crop_clean = clean[OFF[1]:OFF[1] + CH, OFF[0]:OFF[0] + CW]
crop_draft = full[OFF[1]:OFF[1] + CH, OFF[0]:OFF[0] + CW]
print(f'[重建底] 挖掉 {int(hole.sum())} px，用同行 x{SRCX} 干净带平铺补回')
band = dil(GT, 8) & ~GT
above = np.zeros((CH, CW), bool); above[:TY0] = True
zone = band & (~above)
Lz = crop_draft.mean(2)
print(f'[真实底] 接触带（牌底/两侧 1–8 px）稿上中位亮度 {np.median(Lz[zone]):.1f}  '
      f'内壁 {np.median(Lz[TY0 - 20:TY0 - 6, TX0 + 40:TX0 + TW - 40]):.1f}  '
      f'→ 既非纯白 251 也非深木 90，B23 的假想底结论需重算')


def load(path, org=(TX0, TY0)):
    """org = 资产左上角在 crop 坐标的位置（柔影变体带 20 px 垫边 → org 需前移）"""
    im = Image.open(path).convert('RGBA')
    ar = np.asarray(im.split()[3]).astype(np.float32) / 255
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    if im.size != (CW, CH):
        h, w = ar.shape
        a = np.zeros((CH, CW), np.float32); R = np.zeros((CH, CW, 3), np.float32)
        a[org[1]:org[1] + h, org[0]:org[0] + w] = ar
        R[org[1]:org[1] + h, org[0]:org[0] + w] = rgb
        return a, R
    return ar, rgb


C4 = 'temp/b22-cut4'
LEGS = [('④ +GuidedFilter', f'{C4}/112-d4-guidedfilter_00001_.png', None),
        ('⑤ +PyMatting', f'{C4}/115-d5-pymatting_00001_.png', None),
        ('⑩ 本地 v3a', 'temp/b19-local3a/source.png', None),
        ('⑩+σ1.6 柔影', 'temp/b23-soft-s1.6.png', (TX0 - 20, TY0 - 20)),
        ('⑩+σ3.2 柔影', 'temp/b23-soft-s3.2.png', (TX0 - 20, TY0 - 20)),
        ('⑩ v4 二维影', 'temp/b24-v4-full.png', None)]

# 稿上真影在接触带的暗化量（靶值）：拿「牌底正下方那条」与「同高度干净带」比
draft_dark = float(np.median(Lz[zone]))
base_line = float(np.median(crop_clean.mean(2)[zone]))     # 重建底（无牌无影）在同一接触带
print(f'[靶值] 接触带：稿原样 {draft_dark:.1f} vs 重建干净底 {base_line:.1f}  '
      f'→ 稿上真影暗化 ΔL = {base_line - draft_dark:.1f} 灰阶')

# 影的**形状/方向**：拿重建底当无影参照，比「谁把影下在哪」而不是「谁平均暗多少」
Lclean = crop_clean.mean(2)
DSH = (~GT) & (Lclean - Lz > 5)
# 分桁一律用 crop 坐标（牌体 bbox = TX0/TY0 起算）——上面已因混用全图坐标跳过一次
BX0, BY0, BX1, BY1 = TX0, TY0, TX0 + TW, TY0 + TH
sec = {'牌下': 0, '牌右': 1, '牌左': 2, '牌上': 3}


def sectors(m):
    """按「离牌体哪条边最近」分桶（bbox 内但牌体外的角上像素归最近边）"""
    ys, xs = np.where(m)
    out = {k: 0 for k in sec}
    for y, x in zip(ys, xs):
        d = {'牌下': y - BY1, '牌上': BY0 - y, '牌右': x - BX1, '牌左': BX0 - x}
        k = max(d, key=lambda k: d[k])
        out[k if d[k] > 0 else '牌下'] += 1
    return out


print(f'\n[影的形状] 稿上影足迹（比重建底暗 >5 灰阶）= {int(DSH.sum())} px')
print('  稿的方位分布：', sectors(DSH))
ring2 = dil(GT, 2) & ~GT          # 牌体自身描边环：会被当成「影」混进多出来里
for tag, p, org in LEGS:
    a, rgb = load(p) if org is None else load(p, org)
    comp = crop_clean * (1 - a[:, :, None]) + rgb * a[:, :, None]
    Lc = comp.mean(2)
    CS = (~GT) & (Lclean - Lc > 5)
    iou = float((CS & DSH).sum()) / max(float((CS | DSH).sum()), 1)
    extra = CS & ~DSH
    print(f'  {tag:16s} 影足迹 {int(CS.sum()):5d} px  与稿影 IoU {iou:.3f}  '
          f'覆盖稿影 {100 * (CS & DSH).sum() / DSH.sum():5.1f}%  多出来 '
          f'{100 * extra.sum() / max(CS.sum(), 1):5.1f}%（其中描边环 0–2px 内 '
          f'{int((extra & ring2).sum())}/{int(extra.sum())} px）  方位 {sectors(CS)}')

rows = [('稿原样（参照）', crop_draft)]
print('\n[对稿误差分层 / 影深保留率]  分层是为了问清「⑤ 贴的是哪一层」')


def erode(m, n):
    return ~dil(~m, n)


face = erode(GT, 12)                       # 牌面中心（离边 ≥12 px）
ring = GT & ~face                          # 牌体内缘（描边与抗锯齿所在）
print('  ⚠ 不列「牌体外 RMSE」：那条指标是循环的 —— 谁用稿原像素盖住的面积大'
      '谁就“更像稿”，与质量无关。改用接触带逐像素比稿。')
for tag, p, org in LEGS:
    a, rgb = load(p) if org is None else load(p, org)
    comp = crop_clean * (1 - a[:, :, None]) + rgb * a[:, :, None]
    rows.append((tag, comp))
    Lc = comp.mean(2)
    d = base_line - float(np.median(Lc[zone]))
    keep = 100 * d / max(base_line - draft_dark, 1e-3)
    e_zone = float(np.sqrt(((Lc[zone] - Lz[zone]) ** 2).mean()))
    e_face = float(np.sqrt(((comp[face] - crop_draft[face]) ** 2).mean()))
    e_ring = float(np.sqrt(((comp[ring] - crop_draft[ring]) ** 2).mean()))
    print(f'  {tag:16s} 牌面中心 RMSE {e_face:5.2f}  牌体内缘({int(ring.sum())}px) RMSE '
          f'{e_ring:5.2f}  接触带({int(zone.sum())}px) 逐像素比稿 RMSE {e_zone:5.2f}'
          f'  ｜影深 {d:5.1f}/13.7（保留 {keep:5.1f}%）')

# 出图
OUT = 'production/qa/menu-b19/b24-insitu'
os.makedirs(OUT, exist_ok=True)
Z = 4
LS = .8                                            # 左栏缩放（整 crop 预览）
zx0, zy0, zw, zh = TX0 + TW - 150, TY0 + TH - 30, 200, 70     # 牌底边窗口（crop 坐标）
gap = 6
fw, fh = CW, CH
tw, th = zw * Z, zh * Z
sh = int(fh * LS)
rowh = max(sh, th)
sheet = Image.new('RGB', (int(fw * LS) + tw + gap * 3,
                          rowh * len(rows) + gap * (len(rows) + 1)), (40, 40, 40))
draw = ImageDraw.Draw(sheet)
# PIL 默认字体只认 Latin-1，中文/带圈数字会渲染成方框 → 图上用 ASCII 标签
ASCII = {'稿原样（参照）': '0 draft (reference)', '④ +GuidedFilter': '4 +GuidedFilter',
         '⑤ +PyMatting': '5 +PyMatting', '⑩ 本地 v3a': '10 local v3a',
         '⑩+σ1.6 柔影': '10 v3a +soft 1.6', '⑩+σ3.2 柔影': '10 v3a +soft 3.2',
         '⑩ v4 二维影': '11 v4 2D-shadow'}
for i, (tag, comp) in enumerate(rows):
    y = gap + i * (rowh + gap)
    small = Image.fromarray(np.clip(comp, 0, 255).astype(np.uint8)).resize(
        (int(fw * LS), int(fh * LS)), Image.LANCZOS)
    sheet.paste(small, (gap, y))
    win = comp[zy0:zy0 + zh, zx0:zx0 + zw]
    z = Image.fromarray(np.clip(win, 0, 255).astype(np.uint8)).resize((tw, th), Image.NEAREST)
    sheet.paste(z, (gap + int(fw * LS) + gap, y))
    draw.text((gap + 6, y + 4), ASCII.get(tag, tag), fill=(255, 255, 255),
              stroke_width=2, stroke_fill=(0, 0, 0))
sheet.save(f'{OUT}/insitu.webp', 'WEBP', quality=90)
print(f'\n产物：{OUT}/insitu.webp {sheet.size[0]}×{sheet.size[1]}  '
      f'行＝稿原样/④/⑤/⑩/⑩σ1.6/⑩σ3.2/v4，左＝整 crop，右＝牌底边 4×')
