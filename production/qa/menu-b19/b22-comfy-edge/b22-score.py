#!/usr/bin/env python3
"""B22 打分 v2：ComfyUI 收边法 vs 本地 v3a，全部在 crop(505,1855,530×300) 坐标系。

上一版废了：① 服务端底图是 b17-src.png（牌面被 B17 重绘过，比稿亮 7–13 灰阶）；
② 判据拿 alpha>0.999 当牌体，SAM2 掩码又反向，读数全是噪声。这一版：
GT = 本地 v3a 的 plate-mask 贴回 crop 坐标（B20 已验过它梯形比 0.979=稿、平整优于稿）。

量的六件事，前两件决定「能不能用」，后四件决定「好不好」：
  A RGB 是否被动过（JoinImageWithAlpha 只写 alpha → 杂边不可能靠它消）
  B 分割位置对不对（IoU vs GT）
  C 牌内漏气（GT 内 alpha<0.999）／牌外外溢（GT 外 alpha>0.01）
  D 杂边量：边环 RGB 相对向内射线实色的偏移，折成混入背景白的比例
  E 边缘平滑：alpha 档位与边环宽度
  F 形状抖动：alpha 50% 等值线掩码的平整 RMS（归一牌高 164）
"""
import glob
import os
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import b19_cutlib as lib

OFF = (505, 1855)
CROP_W, CROP_H = 530, 300
TX0, TY0 = 68, 75          # 对位由「不透明区对稿误差最小」搜出（误差 0.03 灰阶），非拍脑袋
GT = np.asarray(Image.open('temp/b22-gt-mask.png').convert('L')) > 127
SRCC = np.asarray(Image.open(lib.REF).convert('RGB').crop(
    (OFF[0], OFF[1], OFF[0] + CROP_W, OFF[1] + CROP_H))).astype(np.float32)
BG = np.array([251.2, 250.2, 249.0])            # 稿上牌外白背板实测均值（B19）


def load(path):
    """统一成 crop 坐标系的 (alpha, rgb)。本地 v3a 是裁过边的，按真值左上角贴回。"""
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im.split()[3]).astype(np.float32) / 255
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    if im.size != (CROP_W, CROP_H):
        # 贴回位置用「不透明区 RGB 对稿误差最小」搜出来，不拍脑袋
        best = None
        op = a > 0.98
        for dy in range(-6, 7):
            for dx in range(-6, 7):
                y0, x0 = TY0 + dy, TX0 + dx
                if y0 < 0 or x0 < 0 or y0 + a.shape[0] > CROP_H or x0 + a.shape[1] > CROP_W:
                    continue
                win = SRCC[y0:y0 + a.shape[0], x0:x0 + a.shape[1]]
                e = float(np.abs(rgb[op] - win[op]).mean())
                if best is None or e < best[0]:
                    best = (e, y0, x0)
        _, y0, x0 = best
        print(f'  [对齐] 本地资产贴回 crop 偏移搜到 (x={x0},y={y0})，真值假设 ({TX0},{TY0})，'
              f'不透明区对稿平均误差 {best[0]:.2f} 灰阶')
        A = np.zeros((CROP_H, CROP_W), np.float32)
        R = np.zeros((CROP_H, CROP_W, 3), np.float32)
        h, w = a.shape
        A[y0:y0 + h, x0:x0 + w] = a
        R[y0:y0 + h, x0:x0 + w] = rgb
        a, rgb = A, R
    return a, rgb


def score(tag, path):
    a, rgb = load(path)
    # 不透明阈值取 0.98：ComfyUI 存 PNG 时 1.0 会量化成 254/255=0.996，
    # 拿 >0.999 当「实心」会把整张牌面误判成边环（上一版 ③⑥⑨ 的「环宽 100%」就是这么来的）
    solid = a > 0.98
    ring = (a > 0.01) & (~solid)
    fg = a > 0.5
    iou = float((fg & GT).sum()) / max(float((fg | GT).sum()), 1)
    holes = int((GT & ~solid).sum())
    leak = int(((~GT) & (a > 0.01)).sum())
    # 向内射线取实色（与 v2/v3 同法）：环上每像素沿质心方向找第一个 solid 像素
    ys, xs = np.where(solid)
    ref = rgb.copy(); hit = 0
    if len(ys):
        cen = np.array([(xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2])
        ry, rx = np.where(ring)
        for py, px in zip(ry, rx):
            d = cen - np.array([px, py], np.float32); n = np.hypot(*d)
            if n < 1e-3:
                continue
            d /= n
            for t in np.arange(0.5, 16.0, 0.5):
                qy, qx = int(round(py + d[1] * t)), int(round(px + d[0] * t))
                if 0 <= qy < a.shape[0] and 0 <= qx < a.shape[1] and solid[qy, qx]:
                    ref[py, px] = rgb[qy, qx]; hit += 1; break
    off = (rgb - ref)[ring] if ring.any() else np.zeros((1, 3))
    denom = float((BG - ref[ring].mean(0)).mean()) if ring.any() else 1.0
    mix = float(off.mean() / denom) * 100 if ring.any() else 0.0
    # 形状：alpha 50% 掩码的牌体 bbox 与平整
    m = fg[TY0:TY0 + 164 + 6, TX0 - 4:TX0 + 386 + 6] if fg.any() else None
    f = 164 / max(m.shape[0], 1)
    vl, kl = lib.flat_v(m, int(m.shape[0] * .15), int(m.shape[0] * .85), 'l')
    vr, kr = lib.flat_v(m, int(m.shape[0] * .15), int(m.shape[0] * .85), 'r')
    ht, jt = lib.flat_h(m, 20, m.shape[1] - 20, 'top')
    tr, wt, wb = lib.trap_ratio(m)
    rgbmax = float(np.abs(rgb - SRCC)[solid].max()) if solid.any() else float('nan')
    print(f'--- {tag}')
    print(f'  [A] 不透明区 RGB 相对稿 crop 最大差 {rgbmax:.0f}   '
          f'（0＝只写了 alpha，稿原色一字未改 → 杂边不可能被消掉）')
    print(f'  [B] 前景 {int(fg.sum())} px（GT {int(GT.sum())}）  IoU {iou:.3f}')
    print(f'  [C] 牌内漏气 {holes} px（占牌面 {100 * holes / max(int(GT.sum()), 1):.1f}%）  牌外外溢 {leak} px')
    print(f'  [D] 边环 {int(ring.sum())} px  取色命中 {hit}/{int(ring.sum())}  '
          f'相对实色偏移 均值 {np.round(off.mean(0), 1).tolist()}  '
          f'→ 折算混入背景白 ≈ {mix:.0f}%')
    print(f'  [E] alpha 档位 {len(np.unique((a[ring] * 255).astype(np.uint8)))}  '
          f'环宽占比 {100 * ring.sum() / max(GT.sum(), 1):.1f}%')
    print(f'  [F] 平整 RMS（归一牌高 164）顶 {ht * f:.2f} 左 {vl * f:.2f} 右 {vr * f:.2f}  '
          f'梯形比 {tr:.3f}（稿 {lib.DRAFT_TRAP}）')
    # [G] 白杂边：合成到纯黑底上，紧贴实心核外那圈环的亮度 —— 越高越「发白带虚」
    er = np.zeros_like(solid)
    er[1:-1, 1:-1] = solid[1:-1, 1:-1] & solid[:-2, 1:-1] & solid[2:, 1:-1] & solid[1:-1, :-2] & solid[1:-1, 2:]
    band = (~er) & (a > 0.01)
    Lb = (rgb * np.clip(a, 0, 1)[:, :, None]).mean(2)      # 黑底合成后亮度
    print(f'  [G] 黑底环带亮度 均值 {Lb[band].mean():.1f}  p95 {np.percentile(Lb[band], 95):.1f}'
          f'（牌面本色 L≈225、描边 L≈120；越高＝白杂边越重）')
    core = np.zeros_like(solid)
    core[6:-6, 6:-6] = solid[6:-6, 6:-6]
    ca = a[GT & core]
    print(f'  [H] 牌面内部 alpha 中位 {np.median(ca) * 255:.0f}/255  <0.98 占 {100 * float((ca < 0.98).mean()):.1f}%'
          f'（>0 即整张牌面被 matting 刷成半透，深色底上会透底）')


C3 = 'temp/b22-cut4'
cases = [('① SAM2 mask 直出', f'{C3}/103-d1-sam2-raw_00001_.png'),
         ('② SAM2 + MaskGrow(−2, blur1)', f'{C3}/106-d2-maskgrow-n2b1_00001_.png'),
         ('③ SAM2 + MaskEdgeShrink', f'{C3}/109-d3-edgeshrink_00001_.png'),
         ('④ SAM2 + Ultra·GuidedFilter', f'{C3}/112-d4-guidedfilter_00001_.png'),
         ('⑤ SAM2 + Ultra·PyMatting', f'{C3}/115-d5-pymatting_00001_.png'),
         ('⑥ GT 硬掩码直出（无 AA）', f'{C3}/118-d6-gt-hard_00002_.png'),
         ('⑦ GT + Ultra·GuidedFilter', f'{C3}/121-d7-gt-guidedfilter_00002_.png'),
         ('⑧ GT + Ultra·PyMatting', f'{C3}/124-d8-gt-pymatting_00002_.png'),
         ('⑨ GT + MaskEdgeShrink', f'{C3}/127-d9-gt-edgeshrink_00002_.png'),
         ('⑩ 本地 v3a 定稿（对照）', 'temp/b19-local3a/source.png')]
for t, p in cases:
    if os.path.exists(p):
        score(t, p)
    else:
        print(f'--- {t}\n  缺文件 {p}')

# SAM2 原始 mask 的极性与面积（上一版翻车的确诊）
m = np.asarray(Image.open('temp/b22-cut2/6-c0-sam2-mask_00001_.png').convert('L')) > 127
print(f'\n[极性探针] c0-sam2-mask：白 {int(m.sum())} px（GT {int(GT.sum())}）  '
      f'与 GT 的 IoU {float((m & GT).sum()) / float((m | GT).sum()):.3f}  '
      f'牌窗内白占比 {100 * m[TY0:TY0 + 164, TX0:TX0 + 386].mean():.1f}%')
