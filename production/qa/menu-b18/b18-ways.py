#!/usr/bin/env python3
"""B18：柜内木牌把 W1–W6 六种方式各裁一遍，同源（原稿）可比。

W1 直裁矩形｜W2 直裁+算法去背｜W3 直裁+SAM2 去背｜W4 inpaint 后+SAM2
W5 9-slice 切片（基于 W3）｜W6 状态变体本地派生（基于 W3）
统一口径：牌高 80 设计 px（@2x = 160），稿→设计 0.49342。
图上标注一律 ASCII（默认字体无中文字形，会出豆腐块）。
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

REF = 'games/beads/design/art/shots/menu-showcase-20261010/v1-mainmenu-final.png'
F3 = 'temp/menu-states/plaque-f3-qwen-f0.png'
OUT = 'temp/b18-ways'
CROP = (505, 1855, 530, 300)          # 牌窗紧裁（与 SAM2 工作流同窗口）
DEV_H = 160
END_DEV, MID_DEV = 48, 80
os.makedirs(OUT, exist_ok=True)
S = 750 / 1520
MAG = (255, 0, 255)


def dev(im):
    """切好的 RGBA（稿 px）→ 设备 px @2x。"""
    w, h = im.size
    return im.resize((max(1, int(round(w * S * 2))),
                      max(1, int(round(h * S * 2))),), Image.LANCZOS)


def from_mask(img, msk, tag):
    """稿图 + 同尺寸 mask → 带 alpha 切图（含中值/闭运算后处理）。"""
    m = np.asarray(Image.open(msk).convert('L'))
    m = np.asarray(Image.fromarray(m).filter(ImageFilter.MedianFilter(5)))
    m = (m > 127).astype(np.uint8) * 255
    m = np.asarray(Image.fromarray(m).filter(ImageFilter.MaxFilter(7)))
    m = np.asarray(Image.fromarray(m).filter(ImageFilter.MinFilter(7)))
    a = Image.fromarray(m).convert('RGBA'); a.putalpha(Image.fromarray(m))
    im = Image.open(img).convert('RGBA').crop(
        (CROP[0], CROP[1], CROP[0] + CROP[2], CROP[1] + CROP[3]))
    a = a.resize(im.size, Image.LANCZOS)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), a.split()[3])
    bb = out.getbbox(); out = out.crop(bb)
    out.save(f'{OUT}/{tag}.png')
    return out


def floodfill_cut(img, tag):
    """W2：四角灌品红哨兵 → 反解 alpha → 角灌找洞填实 → 半径 3 膨胀吃抗锯齿边。

    ⚠ 洪水填充必须在 RGB 图上做：RGBA 上喂 3 元组哨兵会静默不填（实测 0 像素）。
    """
    im = Image.open(img).convert('RGBA').crop(
        (CROP[0], CROP[1], CROP[0] + CROP[2], CROP[1] + CROP[3]))
    w, h = im.size
    ff = im.convert('RGB')
    for c in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(ff, c, MAG, thresh=24)
    bg = (np.asarray(ff) == np.array(MAG)).all(axis=2)
    solid = (~bg).astype(np.uint8) * 255
    si = Image.fromarray(solid).convert('L')          # fromarray 返 readonly，不 convert 灌入会静默丢
    for c in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(si, c, 128, thresh=64)          # 灌不到的洞＝元素内部
    solid = np.asarray(si).copy()          # np.asarray 给的是只读视图，要写就得 copy
    holes = int((solid == 0).sum())        # 灌不到的 0 ＝ 元素内部的洞，归入实体
    solid = np.where(solid == 128, 0, 255).astype(np.uint8)   #  reachable 从四角灌到的才算背景
    m = np.asarray(Image.fromarray(solid).filter(ImageFilter.MaxFilter(7)))
    out = im.copy(); out.putalpha(Image.fromarray(m))
    bb = out.getbbox(); out = out.crop(bb)
    out.save(f'{OUT}/{tag}.png')
    return out, holes


print('=== W1 直裁矩形（含四周背景，零处理）===')
base = Image.open(REF).convert('RGBA')
m18 = from_mask(REF, 'temp/b18-sam2-orig/6-sam2pt_00001_.png', 'w3-sam2')
# 牌在原稿上的紧外框（由 W3 结果反推，窗口原点 505,1855）
mfull = Image.open('temp/b18-sam2-orig/6-sam2pt_00001_.png').convert('L')
mn = np.asarray(mfull) > 127
ys, xs = np.where(mn)
gx0, gx1, gy0, gy1 = 505 + xs.min(), 505 + xs.max(), 1855 + ys.min(), 1855 + ys.max()
w1 = base.crop((gx0, gy0, gx1 + 1, gy1 + 1))
w1.save(f'{OUT}/w1-rect.png')
print(f'  外框 x[{gx0},{gx1}] y[{gy0},{gy1}] = {w1.size[0]}x{w1.size[1]} src px '
      f'= 设计 {w1.size[0]*S:.1f} x {w1.size[1]*S:.1f} px；无 alpha，四周带白背板/木架')

print('=== W2 直裁 + 算法去背（洪水填充）===')
w2, holes = floodfill_cut(REF, 'w2-flood')
a2 = np.asarray(w2.split()[3])
print(f'  切出 {w2.size[0]}x{w2.size[1]} src px = 设计 {w2.size[0]*S:.1f} x {w2.size[1]*S:.1f} px'
      f'；内部填洞 {holes} px；alpha=0 占比 {(a2 == 0).mean()*100:.2f}%')

print('=== W3 直裁 + SAM2 去背（原稿）===')
a3 = np.asarray(m18.split()[3])
print(f'  切出 {m18.size[0]}x{m18.size[1]} src px = 设计 {m18.size[0]*S:.1f} x {m18.size[1]*S:.1f} px'
      f'；alpha=0 占比 {(a3 == 0).mean()*100:.2f}%')

print('=== W4 inpaint 正视化 + SAM2（B17 路线）===')
w4 = from_mask(F3, 'temp/b17-sam2-pt/6-sam2pt_00001_.png', 'w4-inpaint-sam2')
print(f'  切出 {w4.size[0]}x{w4.size[1]} src px = 设计 {w4.size[0]*S:.1f} x {w4.size[1]*S:.1f} px')

def nine_slice(src, save_prefix=None):
    """9-slice：端 24 设计 px 不拉 + 中段从牌面中心取均匀区横拉（B17 口径）。

    返回 (三档接缝 maxdiff, 拼接图列表)。⚠ 中段不得靠右端取——那里有牌面渐变/投影。
    """
    d0 = dev(src)
    b = d0.resize((int(round(d0.size[0] * DEV_H / d0.size[1])), DEV_H), Image.LANCZOS)
    al = np.asarray(b)[:, :, 3]
    cols = np.where(al.max(0) > 200)[0]
    x0, x1 = int(cols.min()), int(cols.max()) + 1
    W = x1 - x0
    b = b.crop((x0, 0, x1, DEV_H))
    parts = {
        'left': b.crop((0, 0, END_DEV, DEV_H)),
        'mid': b.crop(((W - MID_DEV) // 2, 0, (W + MID_DEV) // 2, DEV_H)),
        'right': b.crop((W - END_DEV, 0, W, DEV_H)),
    }
    res, comps = [], []
    for wd in (140.0, 191.5, 280.0):
        w = int(round(wd * 2))
        o = Image.new('RGBA', (w, DEV_H), (250, 247, 240, 255))
        m2 = parts['mid'].resize((w - 2 * END_DEV, DEV_H), Image.LANCZOS)
        o.paste(parts['left'], (0, 0), parts['left'])
        o.paste(m2, (END_DEV, 0), m2.split()[3])
        o.paste(parts['right'], (w - END_DEV, 0), parts['right'])
        a = np.asarray(o.convert('RGB')).astype(np.int16)[20:DEV_H - 20]
        res.append((int(np.abs(a[:, END_DEV - 1] - a[:, END_DEV]).max()),
                    int(np.abs(a[:, w - END_DEV - 1] - a[:, w - END_DEV]).max())))
        comps.append(o)
        if save_prefix:
            o.save(f'{save_prefix}-{int(wd)}.png')
    if save_prefix:
        for n, x in parts.items():
            x.save(f'{save_prefix}-{n}.png')
    return res, comps, (W, DEV_H)


print('=== W5 9-slice（基于 W3，端 24 设计 px 固定 + 中段横拉）===')
s3, s3imgs, board3 = nine_slice(m18, f'{OUT}/w5')
print(f'  整板 {board3[0]}x{board3[1]} 设备 px = 设计 {board3[0] / 2:.1f} px（拉伸系数 '
      f'{DEV_H / dev(m18).size[1]:.3f}）')
print('  三档（140/191.5/280 设计 px）接缝 maxdiff（左/右，行带 20:-20，<12 连续）：'
      + ' / '.join(f'{l}/{r}' for l, r in s3))
s4, s4imgs, board4 = nine_slice(w4)
print('  对照：同样切片跑在 W4（inpaint 正视版，即 B17）→ '
      + ' / '.join(f'{l}/{r}' for l, r in s4))

print('=== W6 状态变体本地派生（基于 W3，确定性变换，不再生成）===')
states = {}

def derive(src, brightness=1.0, sat=1.0, dy=0):
    im = src.copy()
    r, g, b, a = im.split()
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    if sat != 1.0:
        gray = rgb.mean(2, keepdims=True)
        rgb = gray + (rgb - gray) * sat
    rgb = np.clip(rgb * brightness, 0, 255)
    out = Image.fromarray(rgb.astype(np.uint8)).convert('RGBA')
    out.putalpha(a)
    if dy:
        canvas = Image.new('RGBA', out.size, (0, 0, 0, 0))
        canvas.paste(out.crop((0, max(0, -dy), out.size[0], out.size[1] + min(0, -dy))),
                     (0, max(0, dy)))
        out = canvas
    return out


for tag, kw in (('normal', {}), ('pressed', {'brightness': 0.82, 'dy': 4}),
               ('locked', {'brightness': 0.88, 'sat': 0.25})):
    s = derive(m18, **kw); states[tag] = s; s.save(f'{OUT}/w6-{tag}.png')
    px = np.asarray(s.convert('RGB'))[np.asarray(s.split()[3]) > 200]
    print(f'  {tag:8s} 均色 {np.median(px, 0).astype(int).tolist()}')

# ---------- 对比图（洋红底看 alpha，标注 ASCII）----------
def on_bg(im, bg=(255, 0, 255, 255), scale=2):
    w, h = im.size
    out = Image.new('RGBA', (w * scale, h * scale), bg)
    out.paste(im.resize((w * scale, h * scale), Image.NEAREST), (0, 0),
              im.resize((w * scale, h * scale), Image.NEAREST))
    return out


def scale_to(im, wd):
    k = wd / im.size[0]
    return im.resize((int(round(im.size[0] * k)), int(round(im.size[1] * k))), Image.LANCZOS)

CW = 470
rows = []
for label, im in [
    ('W1 rect crop (bg kept)', w1),
    ('W2 crop + floodfill cut', w2),
    ('W3 crop + SAM2 cut', m18),
    ('W4 inpaint + SAM2 (B17)', w4),
    ('W5 9-slice @140 dev px', Image.open(f'{OUT}/w5-140.png')),
    ('W5 9-slice @280 dev px', s3imgs[2]),
    ('W5b same slice on W4', s4imgs[2]),
    ('W6 pressed (local derive)', states['pressed']),
    ('W6 locked (local derive)', states['locked']),
]:
    rows.append((label, on_bg(scale_to(dev(im) if im.mode != 'RGBA' or im.size[1] != DEV_H
                                       else im, CW))))
H = sum(r[1].size[1] + 34 for r in rows) + 70
c = Image.new('RGB', (CW + 20, H), (246, 241, 231))
d = ImageDraw.Draw(c)
d.text((10, 10), 'B18: cabinet plaque - six cut ways (magenta = transparent)',
       fill=(60, 45, 25))
d.text((10, 32), 'src: v1-mainmenu-final.png  |  height 80 design px (@2x=160)',
       fill=(120, 95, 65))
y = 54
for label, im in rows:
    d.text((10, y + 2), label, fill=(60, 45, 25))
    c.paste(im.convert('RGB'), (10, y + 22))
    y += im.size[1] + 34
c.save(f'{OUT}/b18-compare.webp', quality=86)
print(f'\n对比图 {OUT}/b18-compare.webp（{c.size[0]}x{c.size[1]}）')
