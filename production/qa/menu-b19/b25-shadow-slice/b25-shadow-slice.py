#!/usr/bin/env python3
"""B25：影层怎么跟着牌宽走 —— 与牌体共用切片线的三段式，并按 B18 口径量接缝。

B17 裁定柜内木牌按文字宽度**动态横向拉伸**、两端不拉；B24 的 v4 影层是在稿上那
一个牌宽（386 稿px）量出来的二维足迹。牌一变宽，右下裙边就会错位 → 影层必须和牌体
一起切三段。

切片线沿用 B18 `nine_slice()` 的口径（端 48 设备px ＝ 24 设计px 不拉、中段横拉、
行带裁 20:H-20、接缝判据 <12），差别只有两处：
 1) 端帽的宽度从**资产内容边缘**起算，不是从牌体边缘 —— 牌左影 359 px / 牌右裙边
    1003 px 都悬在牌体外，必须整块留在端帽里，不能被卷进中段拉伸；
 2) 中段是牌底那条接触影，先量它**能不能拉**（列剖面有没有横向趋势），
    趋势大＝拉完会被摊平，这是本批唯一可能判死 v4 的地方。

对照组：同一套切片线只切牌体（v3a 定稿资产）时的接缝 —— 差值才是影层带来的增量。
"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import b19_cutlib as lib

OFF, CW, CH = (505, 1855), 530, 300
TX0, TY0, TW, TH = 68, 75, 386, 164
K = lib.S * 2                                    # 稿 px → 设备 px @2x
END = 48                                         # 端帽：B18 口径 24 设计px
DEV_H = round(CH * K)
TARGETS = [140.0, 191.5, 280.0]                  # 设计 px，与 B18 同三档
OUT = 'production/qa/menu-b19/b25-shadow-slice'
os.makedirs(OUT, exist_ok=True)


def to_dev(path, org=(TX0, TY0)):
    """crop 坐标 RGBA → 设备 px（预乘域缩放，非预乘会自造暗杂边）。"""
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im.split()[3]).astype(np.float32) / 255
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    if im.size != (CW, CH):
        h, w = a.shape
        A = np.zeros((CH, CW), np.float32)
        R = np.zeros((CH, CW, 3), np.float32)
        A[org[1]:org[1] + h, org[0]:org[0] + w] = a
        R[org[1]:org[1] + h, org[0]:org[0] + w] = rgb
        a, rgb = A, R
    pm = np.dstack([rgb * a[:, :, None], a * 255]).astype(np.uint8)
    d = Image.fromarray(pm, 'RGBA').resize((round(CW * K), DEV_H), Image.LANCZOS)
    da = np.asarray(d.split()[3]).astype(np.float32) / 255
    dr = np.asarray(d.convert('RGB')).astype(np.float32)
    out = np.zeros_like(dr)
    np.divide(dr, np.maximum(da[:, :, None], 1e-3), out=out, where=da[:, :, None] > 1e-3)
    return Image.fromarray(np.dstack([np.clip(out, 0, 255), da * 255]).astype(np.uint8),
                           'RGBA')


def hstretch(part, w):
    """中段横向缩放到 w（同样走预乘）。"""
    a = np.asarray(part.split()[3]).astype(np.float32) / 255
    rgb = np.asarray(part.convert('RGB')).astype(np.float32)
    pm = np.dstack([rgb * a[:, :, None], a * 255]).astype(np.uint8)
    d = Image.fromarray(pm, 'RGBA').resize((w, part.size[1]), Image.LANCZOS)
    da = np.asarray(d.split()[3]).astype(np.float32) / 255
    dr = np.asarray(d.convert('RGB')).astype(np.float32)
    out = np.zeros_like(dr)
    np.divide(dr, np.maximum(da[:, :, None], 1e-3), out=out, where=da[:, :, None] > 1e-3)
    return Image.fromarray(np.dstack([np.clip(out, 0, 255), da * 255]).astype(np.uint8),
                           'RGBA')


def plate_cols(dev_img):
    """牌体左/右缘：取资产自己的不透明列（alpha>230）。"""
    xs = np.where((np.asarray(dev_img.split()[3]) > 230).max(0))[0]
    return int(xs.min()), int(xs.max()) + 1


def slice3(dev_img, tag):
    """按牌体边缘 ±END 切三段，端帽含牌体外的悬影。返回 (三段, 板在资产内的 x 范围)。

    牌缘不写死稿 GT —— 管线腿的牌缘与 GT 差 1 px，写死会让切片线落在牌体外
    1 px 的影上。
    """
    px0, px1 = plate_cols(dev_img)
    w = dev_img.size[0]
    parts = {'left': dev_img.crop((0, 0, px0 + END, DEV_H)),
             'mid': dev_img.crop((px0 + END, 0, px1 - END, DEV_H)),
             'right': dev_img.crop((px1 - END, 0, w, DEV_H))}
    print(f'  [{tag}] 端帽左 {parts["left"].size[0]} px  中段 {parts["mid"].size[0]} px'
          f'  端帽右 {parts["right"].size[0]} px（牌宽自然值 {px1 - px0} 设备px）')
    return parts, (px0, px1)


def assemble(parts, plate_w):
    """拼出牌宽 = plate_w 的资产（牌宽只由中段贡献，两端各贡献 END）；返回 (RGBA, 牌体左缘 x)。"""
    lw, rw = parts['left'].size[0], parts['right'].size[0]
    mid_w = plate_w - 2 * END
    assert mid_w > 4, f'中段被压没：{mid_w}'
    o = Image.new('RGBA', (lw + mid_w + rw, DEV_H), (0, 0, 0, 0))
    o.paste(hstretch(parts['mid'], mid_w), (lw, 0))
    o.paste(parts['left'], (0, 0))
    o.paste(parts['right'], (lw + mid_w, 0))
    return o, lw - END


def seams(img, plate_x0, plate_x1):
    """接缝 maxdiff：牌体带（B18 行带口径）与牌底下的影带分开量，RGB 与 alpha 各一条。"""
    a = np.asarray(img)
    rgb = a[:, :, :3].astype(np.int16)
    al = a[:, :, 3].astype(np.int16)
    y0, y1 = round(TY0 * K) + 20, round((TY0 + TH) * K) - 20      # 牌体带
    ys0, ys1 = round((TY0 + TH) * K), min(a.shape[0], round((TY0 + TH) * K) + 40)  # 影带
    out = []
    for x in (plate_x0 + END, plate_x1 + END):
        out.append(int(np.abs(rgb[y0:y1, x - 1] - rgb[y0:y1, x]).max()))
    for x in (plate_x0 + END, plate_x1 + END):
        out.append(int(np.abs(al[y0:y1, x - 1] - al[y0:y1, x]).max()))
    for x in (plate_x0 + END, plate_x1 + END):
        out.append(int(np.abs(al[ys0:ys1, x - 1] - al[ys0:ys1, x]).max()))
    return out                                      # [rgb 左/右, alpha 牌体, alpha 影带]


GT = np.asarray(Image.open('temp/b22-gt-mask.png').convert('L')) > 127


def b18_replicate(path):
    """回归用：逐字复现 B18 `nine_slice()` 的几何。⚠ B18 那把尺的量纲是**牌紧框缩到
    高 160 设备px**（牌高 80 设计px），不是本脚本的 crop 高 296 —— 用错量纲复现不出
    3/4（实测会得到 18/14），所以这里把 B18 的 DEV_H 单独写死。"""
    MID, H18 = 80, 160
    im = Image.open(path).convert('RGBA')
    d = im.resize((max(1, round(im.size[0] * K)), max(1, round(im.size[1] * K))),
                  Image.LANCZOS)
    d = d.resize((max(1, round(d.size[0] * H18 / d.size[1])), H18), Image.LANCZOS)
    al = np.asarray(d.split()[3])
    cols = np.where(al.max(0) > 200)[0]
    x0, x1 = int(cols.min()), int(cols.max()) + 1
    W = x1 - x0
    b = d.crop((x0, 0, x1, H18))
    L, M, R = b.crop((0, 0, END, H18)), b.crop(((W - MID) // 2, 0, (W + MID) // 2, H18)), \
        b.crop((W - END, 0, W, H18))
    out = []
    for wd in TARGETS:
        w = int(round(wd * 2))
        o = Image.new('RGBA', (w, H18), (250, 247, 240, 255))
        m2 = M.resize((w - 2 * END, H18), Image.LANCZOS)
        o.paste(L, (0, 0), L)
        o.paste(m2, (END, 0), m2.split()[3])
        o.paste(R, (w - END, 0), R)
        a = np.asarray(o.convert('RGB')).astype(np.int16)[20:H18 - 20]
        out.append((int(np.abs(a[:, END - 1] - a[:, END]).max()),
                    int(np.abs(a[:, w - END - 1] - a[:, w - END]).max())))
    return out


print('\n[尺子回归] 跑原始 B18 脚本实测：W3＝9/7，W4（inpaint 正视版，B17）＝3/4（判据 <12）')
for tag, p in (('W3', 'production/qa/menu-b18/w3-sam2.png'),
               ('W4', 'production/qa/menu-b18/w4-inpaint-sam2.png')):
    print(f'  本脚本复现 nine_slice() {tag}：',
          b18_replicate(p) if os.path.exists(p) else f'⚠ 缺 {p}')


def shadow_dirs(img, plate_x0, plate_x1):
    """重排后影足迹方位：牌下应随牌宽线性增长，牌右裙边应保持恒定。"""
    al = np.asarray(img.split()[3]).astype(np.float32) / 255
    py0, py1 = round(TY0 * K), round((TY0 + TH) * K)
    sh = al > 0.02
    sh[:py0 + 1, :] = False                        # 牌顶以上不算影
    inside = np.zeros_like(sh)
    inside[py0:py1, plate_x0:plate_x1 + 1] = True
    sh &= ~inside
    ys, xs = np.where(sh)
    below = ys >= py1
    return dict(影px=int(sh.sum()), 牌下=int(below.sum()),
                牌右=int(((~below) & (xs > plate_x1)).sum()),
                牌左=int(((~below) & (xs < plate_x0)).sum()))


print('=== B25 影层三段式（与牌体共用切片线）===')
# 资产左上角在 crop 坐标的位置：牌缘在 crop = (69,76)（管线拟合矩形），在资产内 = (14,1)
# ⇒ 资产原点 = (55,75)。⚠ 这里填牌缘坐标会把整张资产推右 14 px（上一版错在这）。
ORG4 = (69 - 14, 76 - 1)
ASSETS = {'v4 牌体+二维影（管线产物）': ('temp/b19-local4/source.png', ORG4),
          'v3a 只有牌体': ('temp/b19-local3a/source.png', None)}
devs = {t: to_dev(p, org or (TX0, TY0)) for t, (p, org) in ASSETS.items()}
results = {}
for t, d in devs.items():
    parts, (px0, px1) = slice3(d, t)
    rows = []
    for wd in TARGETS:
        pw = int(round(wd * 2))
        img, x0 = assemble(parts, pw)
        rows.append((wd, pw, img, x0, x0 + pw, seams(img, x0, x0 + pw)))
    results[t] = rows
    print(f'  [{t}] 接缝 maxdiff（判据 <12 连续）')
    for wd, pw, _, _, _, s in rows:
        print(f'    牌宽 {wd:5.1f} 设计px（{pw} 设备px）  RGB 左/右 {s[0]:3d}/{s[1]:3d}'
              f'   alpha 牌体带 {s[2]:3d}/{s[3]:3d}   alpha 影带 {s[4]:3d}/{s[5]:3d}')

# 中段可拉伸性：牌底接触影的列剖面有没有横向趋势
print('\n[中段能不能拉] 中段逐列影均值（k 的列剖面）')
d4 = devs['v4 牌体+二维影（管线产物）']
al = np.asarray(d4.split()[3]).astype(np.float32) / 255
py0, py1 = round(TY0 * K), round((TY0 + TH) * K)
px0, px1 = plate_cols(d4)
band = al[py1 - 2:py1 + 12, px0 + END:px1 - END]     # 牌底接触带（含影）
prof = band.mean(0)
n = len(prof)
q = max(1, n // 8)
slope = np.polyfit(np.arange(n), prof, 1)[0]
print(f'  中段 {n} 列  影均值 首 1/8 {prof[:q].mean():.3f} → 末 1/8 {prof[-q:].mean():.3f}'
      f'  差 {prof[-q:].mean() - prof[:q].mean():+.3f}（{100*(prof[-q:].mean()/max(prof[:q].mean(),1e-3)-1):+.1f}%）')
print(f'  线性斜率 {slope*100:+.3f} /100 列   列间自然抖动 RMS {prof.std():.4f}'
      f'   拉伸 ×1.5 会把首尾差摊薄到 {abs(prof[-q:].mean()-prof[:q].mean())/1.5:.3f}')

# 方位守恒：三档重排后影足迹
print('\n[方位守恒] 牌下应随牌宽增长、牌右裙边应恒定（同一把尺：dev alpha>0.02）')
base_dirs = shadow_dirs(devs['v4 牌体+二维影（管线产物）'], px0, px1)
nat_w = px1 - px0
print(f'  未切片（稿上自然宽 {nat_w} 设备px）  {base_dirs}  ← 参照行')
for wd, pw, img, x0, x1, _ in results['v4 牌体+二维影（管线产物）']:
    d = shadow_dirs(img, x0, x1)
    print(f'  牌宽 {wd:5.1f} 设计px（{pw} 设备px，×{pw / nat_w:.2f}）  {d}'
          f'   牌右/牌左与参照比 {d["牌右"] - base_dirs["牌右"]:+d}/{d["牌左"] - base_dirs["牌左"]:+d}')

# 交付几何：**已入库的 @2x 定稿资产**（引擎吃的那张，含 2 px 留白）
# 规格正本 §5 写的是「⛔ 不在切图工具里切九宫，引擎侧设 border」→ 所以这里给的是
# border 四值；同时存三张预切片作为 ADR-0031 blit 腿（setContentSize、无九宫）的备选。
print('\n[九宫 border] @2x 定稿资产牌体实测定位与不可拉区（单位 = @2x px）')
ASSET = 'production/qa/menu-b19/asset/plate-shadow@2x.png'
aim = Image.open(ASSET)
al = np.asarray(aim.split()[3])
plate = al > 230                                    # 牌体不透明，影层峰值 k≈0.56
ys, xs = np.where(plate)
mx0, mx1 = int(xs.min()), int(xs.max()) + 1
my0, my1 = int(ys.min()), int(ys.max()) + 1
print(f'  资产 {aim.size[0]}×{aim.size[1]}  牌体 alpha>230 实测 bbox '
      f'x[{mx0},{mx1}] y[{my0},{my1}] = {mx1 - mx0}×{my1 - my0} @2x px')
E = END                                       # 24 设计px = 48 @2x px（B18 口径）
bL, bR = mx0 + E, aim.size[0] - (mx1 - E)
print(f'  端帽不可拉宽度 E = 24 设计px = {E} @2x px ⇒ borderLeft {bL}  borderRight {bR}'
      f'  拉伸带 {mx1 - E - (mx0 + E)} @2x px = {(mx1 - E - mx0 - E) / 2:.1f} 设计px')
print(f'  横向以上为定稿值；纵向：borderTop {my0}  borderBottom {aim.size[1] - my0}'
      f'（中段高度 0，牌高永不重采样）')
for n, box in (('left', (0, 0, bL, aim.size[1])),
               ('mid', (bL, 0, aim.size[0] - bR, aim.size[1])),
               ('right', (aim.size[0] - bR, 0, aim.size[0], aim.size[1]))):
    aim.crop(box).save(f'{OUT}/plate-{n}.png')
print(f'  预切三张已存：{OUT}/plate-{{left,mid,right}}.png')

def skirt_w(img, plate_x1):
    """裙边伸出量：牌右影区最远到哪一列（拉完该恒定，整图横拉会 ×r）。"""
    a = np.asarray(img.split()[3]).astype(np.float32) / 255
    cols = np.where(a[:, plate_x1 + 1:].max(0) > 0.02)[0]
    return int(cols.max()) + 1 if len(cols) else 0


print('\n[对照组：整图横拉（ADR-0031 blit 腿 setContentSize）] 悬影会被一起摊开')
print(f'  未切片参照  裙边伸出 {skirt_w(devs["v4 牌体+二维影（管线产物）"], px1)} 设备px')
nat_full = devs['v4 牌体+二维影（管线产物）'].size[0]
for wd, pw, img, x0, x1, _ in results['v4 牌体+二维影（管线产物）']:
    r = pw / nat_w
    naive = hstretch(devs['v4 牌体+二维影（管线产物）'], round(nat_full * r))
    nx1 = round(px1 * r)
    print(f'  牌宽 {wd:5.1f} 设计px（×{r:.2f}）'
          f'  三段式 裙边伸出 {skirt_w(img, x1)}（应恒定）'
          f'   整图横拉 {skirt_w(naive, nx1)}（×{r:.2f} → 影角被摊平）')

# 目检图：三档重排贴回 B24 那张重建橱窗底（设备 px）
# 牌宽 280dp（560 设备px）比 crop 还宽 → 底图取重建后的**加宽窗口**（牌左右各 180 稿px，
# 那些区域是稿原像素，不是重建带），否则右半会被切掉
import importlib.util
spec = importlib.util.spec_from_file_location('b24v4', 'temp/b24-insitu.py')
b24 = importlib.util.module_from_spec(spec)
sys.argv = ['b24-insitu.py']
spec.loader.exec_module(b24)
EXT = 180
win_x0 = OFF[0] - EXT
bg = Image.fromarray(np.clip(b24.clean[OFF[1]:OFF[1] + CH, win_x0:OFF[0] + CW + EXT],
                             0, 255).astype(np.uint8)).resize(
    (round((CW + 2 * EXT) * K), DEV_H), Image.LANCZOS)
BGW = bg.size[0]
GAP = 8
ZM = 3
py1d = round((TY0 + TH) * K)
cells = []
for wd, pw, img, x0, x1, s in results['v4 牌体+二维影（管线产物）']:
    c = bg.copy()
    ox = round((BGW - pw) / 2) - x0                                # 牌体居中
    c.paste(img, (ox, 0), img)
    arr = np.asarray(c.convert('RGB'))
    zoom = []
    for sx in (ox + x0 + END, ox + x1 + END):                      # 两条接缝各一块
        z = arr[max(0, py1d - 30):py1d + 30, sx - 24:sx + 24]
        zoom.append(Image.fromarray(z).resize((48 * ZM, z.shape[0] * ZM), Image.NEAREST))
    cells.append((f'{wd:.0f}dp  seam RGB {s[0]}/{s[1]}  alphaBand {s[4]}/{s[5]}', c, zoom))
w, h = cells[0][1].size
zh = cells[0][2][0].size[1]
rowh = max(h, zh)
sheet = Image.new('RGB', (w + (48 * ZM + GAP) * 2 + GAP, (rowh + 26) * len(cells) + GAP),
                  (30, 30, 30))
dr = ImageDraw.Draw(sheet)
for i, (tag, c, zoom) in enumerate(cells):
    y = GAP + i * (rowh + 26)
    sheet.paste(c.convert('RGB'), (0, y + 22))
    for j, z in enumerate(zoom):
        sheet.paste(z, (w + GAP + j * (48 * ZM + GAP), y + 22))
        dr.text((w + GAP + j * (48 * ZM + GAP), y + 8), f'seam {j + 1} 3x', fill=(255, 255, 255))
    dr.text((6, y + 4), 'shadow 3-slice @ ' + tag, fill=(255, 255, 255))
sheet.save(f'{OUT}/slice-insitu.webp', 'WEBP', quality=88)
print(f'\n产物：{OUT}/slice-insitu.webp {sheet.size[0]}×{sheet.size[1]}')
for wd, pw, img, x0, x1, _ in results['v4 牌体+二维影（管线产物）']:
    img.save(f'{OUT}/plate-shadow-{int(wd)}dp.png')
