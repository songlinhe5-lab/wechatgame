"""图标线稿位图 → 矢量：crack-following 轮廓追踪 + Douglas-Peucker + Chaikin 平滑 → SVG。

输入 = 模型出的线稿底图（白底深色线条），输出 = SVG 路径 + 栅格化 PNG + 叠底托的预合成件。

来源：WXG-T-541/542/543 三批（`temp/m8-trace.py` 原样搬运，仅改本 docstring 的用法说明）。
复用时改三处常量：`DST`（产物目录）、`PICK`（底图路径）、`BASE_DIR`（底托所在批次）。
几何约束：`FACE_R` = 100×(0.5−外环0.055−斜面0.075) = 37.0（凸起面边缘），`FIT_R` = FACE_R − 安全边；
⛔ 图标外接圆不得超过 FACE_R，越界断言见主循环末尾。
用法：python3 games/beads/design/ai-workflows/trace-icon-lineart.py
"""
import glob
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

DST = 'games/beads/design/art/proposals/menu-3d-style-20261030/btn-topbar-traced-v2-20261102'
PREV = 'games/beads/design/art/proposals/menu-3d-style-20261030/btn-topbar-traced-20261102'
BASE_DIR = 'games/beads/design/art/proposals/menu-3d-style-20261030/btn-topbar-layered-20261102'
DARK = (90, 38, 6)                      # 木牌暗部实测值 #5A2606
# 本轮只重出榜单/打卡/换肤三枚；设置（齿轮）沿用上一版矢量，⛔ 不重出
PICK = {'rank': ('m8-rank-v2-s11', None),
        'calendar': ('m8-calendar-s11', None),
        'skin': ('m8-skin-v2-s222', None)}
ZH = {'settings': '设置', 'rank': '好友榜', 'calendar': '打卡', 'skin': '换肤'}
WORK = 480                              # 归一化工作分辨率
TOL = 0.9                               # Douglas-Peucker 容差（px @ WORK）
# 底托几何（与 m5-layered.py 的倒角参数一一对应，0..100 画布 = 圆盘直径）：
#   圆盘半径 R = 50｜外环 0.055×100 = 5.5 ⇒ 环内缘 44.5｜斜面 0.075×100 = 7.5 ⇒ 凸起面边缘 37.0
FACE_R = 100 * (0.5 - 0.055 - 0.075)    # = 37.0 凸起平face 的半径
FIT_R = FACE_R - 2.0                    # 图标外接圆上限，留 2.0 单位安全边（较上版 3.5 放宽，⛔ 仍不得压斜面）
N_DILATE = 10                           # 线宽档位：膨胀次数（新底图线条本就更粗，重新目视 A/B 定档）
ALL = ('settings', 'rank', 'calendar', 'skin')   # 对照表列序（settings 沿用上一版）


# ── 预处理：裁切 → 缩放 → 二值 → 墨量归一化 → 重新装框 ──
def otsu(v):
    hist, edges = np.histogram(v, bins=128, range=(0, 255))
    h = hist.astype(np.float64) / hist.sum()
    c = (edges[:-1] + edges[1:]) / 2
    w0 = np.cumsum(h)
    w1 = 1 - w0
    mu0 = np.cumsum(h * c) / np.maximum(w0, 1e-9)
    mu1 = (np.sum(h * c) - np.cumsum(h * c)) / np.maximum(w1, 1e-9)
    return c[np.nanargmax(w0 * w1 * (mu0 - mu1) ** 2)]


def to_mask(path):
    a = np.asarray(Image.open(path).convert('L')).astype(np.float32)
    m = a < 245
    ys, xs = np.where(m)
    im = Image.open(path).convert('L').crop(
        (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    sc = WORK / max(im.size)
    im = im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))), Image.LANCZOS)
    arr = np.asarray(im).astype(np.float32)
    t = otsu(arr)
    mask = Image.fromarray(((arr < t) * 255).astype(np.uint8))
    return mask


def ink_ratio(m):
    a = np.asarray(m) > 127
    return a.mean()


def normalize_ink(mask):
    cur = ink_ratio(mask)
    for _ in range(14):
        if cur < TARGET_INK * 0.95:
            mask = mask.filter(ImageFilter.MaxFilter(3))
        elif cur > TARGET_INK * 1.05:
            mask = mask.filter(ImageFilter.MinFilter(3))
        else:
            break
        cur = ink_ratio(mask)
    return mask, cur


def square_pad(mask, margin=0.06):
    """按墨迹 bbox 重新装进正方形画布，留 margin。"""
    a = np.asarray(mask) > 127
    ys, xs = np.where(a)
    box = mask.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    side = int(max(box.size) / (1 - 2 * margin))
    canvas = Image.new('L', (side, side), 0)
    canvas.paste(box, ((side - box.width) // 2, (side - box.height) // 2))
    return canvas


# ── 轮廓追踪：沿像素边界（crack following）──
def de_diagonal(mask):
    """消除「仅对角相接」的像素对。

    对角相接会让边界顶点出现 2 条出边，追踪时选错分支就把两个环串成开链；
    开链被当作闭合多边形栅格化 ⇒ 出现楔形填色块（本轮日历即此症状）。
    补成 4 连通后每顶点出入度恒为 1，环必然闭合。
    """
    a = (np.asarray(mask) > 127)
    a = np.pad(a, 1, constant_values=False)
    for _ in range(2):
        for (dy, dx) in ((1, 1), (1, -1)):
            ys = np.arange(1, a.shape[0] - 1)
            xs = np.arange(1, a.shape[1] - 1)
            Y, X = np.meshgrid(ys, xs, indexing='ij')
            p, q = a[Y, X], a[Y + dy, X + dx]
            fix = p & q & ~a[Y, X + dx] & ~a[Y + dy, X]
            if fix.any():
                a[Y[fix], X[fix] + dx] = True
    return Image.fromarray((a[1:-1, 1:-1] * 255).astype(np.uint8))


def trace_loops(mask):
    a = (np.asarray(de_diagonal(mask)) > 127)
    a = np.pad(a, 1, constant_values=False)
    H, W = a.shape
    edges = {}
    for y in range(H - 1):
        for x in range(W - 1):
            if not a[y, x]:
                continue
            if not a[y - 1, x]:
                edges.setdefault((x, y), []).append((x + 1, y))
            if not a[y, x + 1]:
                edges.setdefault((x + 1, y), []).append((x + 1, y + 1))
            if not a[y + 1, x]:
                edges.setdefault((x + 1, y + 1), []).append((x, y + 1))
            if not a[y, x - 1]:
                edges.setdefault((x, y + 1), []).append((x, y))
    loops, open_chains = [], 0
    for start in list(edges):
        while edges.get(start):
            cur, prev, loop = start, None, [start]
            while True:
                outs = edges.get(cur)
                if not outs:
                    break
                if len(outs) == 1:
                    nxt = outs.pop()
                else:
                    # 兜底：de_diagonal 后不应再出现多出边
                    dx, dy = (0, 1) if prev is None else (cur[0] - prev[0], cur[1] - prev[1])
                    def turn(e):
                        ex, ey = e[0] - cur[0], e[1] - cur[1]
                        return math.atan2(dx * ey - dy * ex, dx * ex + dy * ey)
                    outs.sort(key=turn)
                    nxt = outs.pop(0)
                prev, cur = cur, nxt
                if cur == start:
                    break
                loop.append(cur)
            if cur != start:                     # 开链一律丢弃：当成闭合多边形会填出楔形块
                open_chains += 1
                continue
            if len(loop) > 12:
                loops.append(loop)
    if open_chains:
        print(f'    ⚠ 丢弃开链 {open_chains} 条')
    return loops


# ── 简化与平滑 ──
def rdp(pts, eps):
    """迭代版 Douglas-Peucker（递归版在几千点的闭合轮廓上会爆栈）。"""
    a = np.asarray(pts, float)
    n = len(a)
    keep = np.zeros(n, bool)
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        p0, p1 = a[i], a[j]
        d = p1 - p0
        nrm = math.hypot(*d)
        seg = a[i + 1:j] - p0
        if nrm < 1e-9:
            dist = np.hypot(seg[:, 0], seg[:, 1])
        else:
            dist = np.abs(d[0] * seg[:, 1] - d[1] * seg[:, 0]) / nrm
        k = int(np.argmax(dist))
        if dist[k] > eps:
            m = i + 1 + k
            keep[m] = True
            stack.append((i, m))
            stack.append((m, j))
    return [tuple(p) for p in a[keep]]


def chaikin(pts, it=2, closed=True):
    for _ in range(it):
        out = []
        n = len(pts)
        for i in range(n if closed else n - 1):
            p, q = np.array(pts[i], float), np.array(pts[(i + 1) % n], float)
            out.append(tuple(0.75 * p + 0.25 * q))
            out.append(tuple(0.25 * p + 0.75 * q))
        pts = out if closed else [pts[0]] + out + [pts[-1]]
    return pts


def vectorize(mask):
    loops = trace_loops(mask)
    out = []
    for lp in loops:
        # 顺序必须是「先平滑密集折线、再剪枝」。
        # ⛔ 反过来（先 RDP 再 Chaikin）会把长直边的角点切掉约 1/4 边长，
        #    在方角上切出 45° 大斜口（本轮日历右上角楔形即此）；
        # ⛔ 也不能给 RDP 传 lp+[lp[0]]：首尾同点会让基线退化成零向量。
        s = rdp(chaikin(lp, 2), TOL)
        if len(s) < 3:
            continue
        out.append(s)
    return out


# ── 缩放到 0..100 并写 SVG ──
def to_unit(loops, size=100.0, fit_r=None):
    """归一到 size×size 画布。

    fit_r 非空时按**外接圆**归一（最大顶点半径压到 fit_r）——
    圆牌按钮上按「填满方形」会从斜角溢出，方形图标（日历框）尤其明显。
    """
    pts = np.array([p for lp in loops for p in lp], float)
    lo, hi = pts.min(0), pts.max(0)
    sc = size / max(hi - lo)
    off = (np.array([size, size]) - (hi - lo) * sc) / 2
    out = [[((x - lo[0]) * sc + off[0], (y - lo[1]) * sc + off[1]) for x, y in lp]
           for lp in loops]
    if fit_r:
        c = size / 2
        rmax = max(math.hypot(x - c, y - c) for lp in out for x, y in lp)
        k = fit_r / rmax
        out = [[(c + (x - c) * k, c + (y - c) * k) for x, y in lp] for lp in out]
    return out


def svg_path(loops):
    d = []
    for lp in loops:
        d.append('M ' + ' L '.join(f'{x:.2f},{y:.2f}' for x, y in lp) + ' Z')
    return ' '.join(d)


def raster(loops, size, ss=4):
    """扫描线 even-odd 填充 —— 不依赖环绕方向，孔洞自动正确（含多层嵌套）。

    追踪出的环方向不一致，按面积正负号填/挖会把日历对勾、齿轮中心孔填死。
    """
    S = size * ss
    polys = [[(x / 100 * S, y / 100 * S) for x, y in lp] for lp in loops]
    segs = []
    for p in polys:
        arr = np.asarray(p, float)
        segs.append(np.stack([arr, np.roll(arr, -1, axis=0)], axis=1))
    e1 = np.concatenate(segs)                       # (E, 2, 2)
    x1, y1, x2, y2 = e1[:, 0, 0], e1[:, 0, 1], e1[:, 1, 0], e1[:, 1, 1]
    m = np.zeros((S, S), np.uint8)
    for yi in range(S):
        y = yi + 0.5
        hit = ((y1 <= y) & (y < y2)) | ((y2 <= y) & (y < y1))
        if not hit.any():
            continue
        t = (y - y1[hit]) / (y2[hit] - y1[hit])
        xs = np.sort(x1[hit] + t * (x2[hit] - x1[hit]))
        for a, b in zip(xs[0::2], xs[1::2]):
            ia, ib = max(0, int(round(a))), min(S, int(round(b)))
            if ib > ia:
                m[yi, ia:ib] = 255
    img = Image.new('RGBA', (S, S), DARK + (255,))
    img.putalpha(Image.fromarray(m))
    return img.resize((size, size), Image.LANCZOS)


def _font(px):
    for p in ('/System/Library/Fonts/STHeiti Medium.ttc',
              '/System/Library/Fonts/Hiragino Sans GB.ttc'):
        try:
            return ImageFont.truetype(p, px)
        except Exception:
            continue
    return ImageFont.load_default()


base1 = Image.open(f'{BASE_DIR}/btn-base-1x-80.png').convert('RGBA')
keys = list(PICK)
report, composited = {}, {}

def _thicken(base, n):
    """n>0 膨胀、n<0 细化，单位 = MaxFilter/MinFilter(3) 一次。"""
    m = base
    for _ in range(abs(n)):
        m = m.filter(ImageFilter.MaxFilter(3) if n > 0 else ImageFilter.MinFilter(3))
    return m


for k in keys:
    dirn, _ = PICK[k]
    path = sorted(glob.glob(f'temp/comfyui-out/{dirn}/*.png'))[-1]

    # ⛔ 必须「先定尺寸、再膨胀」：若每次膨胀后都按墨迹重新装框，
    #    膨胀与归一化互相抵消，墨量永远打不到目标（本轮先踩过，膨胀 +12 仍只到 15%）。
    # ⛔ 也不做「按墨量搜膨胀量」：墨量对膨胀不单调（细部粘连后合并），且 +8 以上会把
    #    齿轮齿槽、奖杯把手与杯身糊在一起。改固定档位 + 目视 A/B（见 weight-ab.png）。
    base_mask = square_pad(to_mask(path))
    m = _thicken(base_mask, N_DILATE)
    vl = vectorize(m)
    loops = to_unit(vl, 100.0, fit_r=FIT_R)
    loops_m = to_unit(vl, 100.0)
    n = N_DILATE
    ink80 = (np.asarray(raster(loops, 80).getchannel('A')) > 40).mean()

    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" '
           'width="100" height="100">\n'
           f'  <path fill="#5A2606" fill-rule="evenodd" d="{svg_path(loops)}"/>\n</svg>\n')
    open(f'{DST}/icon-{k}.svg', 'w').write(svg)

    for tag, size in (('1x-80', 80), ('2x-160', 160), ('master-320', 320)):
        raster(loops, size).save(f'{DST}/icon-{k}-{tag}.png')

    ic1 = raster(loops, 80)
    cmp = base1.copy()
    cmp.alpha_composite(ic1)
    cmp.save(f'{DST}/btn-{k}-layered-1x-80.png')
    composited[k] = cmp

    # 保真度：矢量栅格 vs 源位图。
    # ⛔ 参考图必须与「方形归一」版 loops_m 同口径 —— 拿 fit_r 版比会得到 0。
    rv = np.asarray(raster(loops_m, 480, ss=1).getchannel('A')) > 127
    a0 = np.asarray(m) > 127
    ys, xs = np.where(a0)
    box = Image.fromarray((a0 * 255).astype(np.uint8)).crop(
        (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    sc = 480 / max(box.size)
    box = box.resize((max(1, int(box.width * sc)), max(1, int(box.height * sc))), Image.LANCZOS)
    ref_im = Image.new('L', (480, 480), 0)
    ref_im.paste(box, ((480 - box.width) // 2, (480 - box.height) // 2))
    ref = np.asarray(ref_im) > 127
    iou = (rv & ref).sum() / max(1, (rv | ref).sum())

    # 越界检查：图标像素到圆心的最大半径必须小于凸起面边缘（否则压在斜面上）
    al = np.asarray(ic1.getchannel('A'))
    yy, xx = np.mgrid[0:80, 0:80]
    rr = np.sqrt((xx - 39.5) ** 2 + (yy - 39.5) ** 2)
    hit = al > 8
    max_r = float(rr[hit].max()) if hit.any() else 0.0
    face_px = FACE_R / 100 * 80
    flag = 'OK' if max_r <= face_px else '越界!'
    # 核心尺寸：外框长边（设计单位）。方形图标的几何上限 = 2×FIT_R/√2，
    # 圆形图标（齿轮）可到 2×FIT_R —— 这是「核心一样大」的硬天花板，不是参数问题
    ys, xs = np.nonzero(hit)
    long_u = (max(xs.max() - xs.min(), ys.max() - ys.min()) + 1) * (100.0 / 80)

    npts = sum(len(l) for l in loops)
    report[k] = (len(loops), npts, ink80, iou, max_r)
    print(f'  {k:9s} 环 {len(loops)}  顶点 {npts}  膨胀 {n:+d}  外框长边 {long_u:.1f}u  '
          f'80px 墨量 {ink80*100:.1f}%  保真 IoU {iou:.3f}  '
          f'最大半径 {max_r:.1f}/{face_px:.1f}px {flag}')

# 对照：手绘矢量（T-540） / 上一版追踪（+10，FIT_R 33.5） / 本轮重出（+N，FIT_R 35.0）
VEC = 'games/beads/design/art/proposals/menu-3d-style-20261030/btn-topbar-vector-20261102'
font, font_s = _font(19), _font(16)
Z, PAD, HEAD, LW = 2, 12, 26, 104
cw = 80 * Z
rows = (('T-540 手绘矢量', lambda k: Image.open(f'{VEC}/btn-{k}-layered-1x-80.png').convert('RGBA')),
        ('上一版追踪 +10', lambda k: Image.open(f'{PREV}/btn-{k}-layered-1x-80.png').convert('RGBA')),
        ('本轮重出 +%d' % N_DILATE,
         lambda k: composited.get(k) or Image.open(f'{PREV}/btn-{k}-layered-1x-80.png').convert('RGBA')))
sheet = Image.new('RGB', (LW + cw * 4 + PAD * 5, PAD + HEAD + (cw + PAD) * len(rows)),
                  (245, 240, 232))
dr = ImageDraw.Draw(sheet)
for i, k in enumerate(ALL):
    dr.text((LW + PAD + i * (cw + PAD) + cw / 2, PAD + 12), ZH[k],
            font=font, fill=(60, 45, 30), anchor='mm')
for row, (tag, getter) in enumerate(rows):
    y = PAD + HEAD + row * (cw + PAD)
    dr.text((PAD + 2, y + cw / 2), tag, font=font_s, fill=(60, 45, 30), anchor='lm')
    for i, k in enumerate(ALL):
        im = getter(k)
        bg = Image.new('RGB', (80, 80), (226, 214, 196))
        bg.paste(im, (0, 0), im)
        sheet.paste(bg.resize((cw, cw), Image.LANCZOS), (LW + PAD + i * (cw + PAD), y))
sheet.save(f'{DST}/compare-traced-vs-handdrawn.png')

# 大图
prev = Image.new('RGB', (320 * 4 + 50, 320), (245, 240, 232))
for i, k in enumerate(ALL):
    bg = Image.new('RGB', (320, 320), (226, 214, 196))
    src_ic = f'{DST}/icon-{k}-master-320.png' if k in composited else f'{PREV}/icon-{k}-master-320.png'
    ic = Image.open(src_ic)
    bg.paste(ic, (0, 0), ic)
    prev.paste(bg, (10 + i * 330, 0))
prev.save(f'{DST}/traced-320-preview.png')

# 线宽档位 A/B（新底图线条本就更粗，档位整体下移一档重扫）
AB = (6, 8, 10, 12)
Z, PAD, HEAD, LW = 3, 10, 24, 54
cw = 80 * Z
ab = Image.new('RGB', (LW + cw * 4 + PAD * 5, PAD + HEAD + (cw + PAD) * len(AB)), (245, 240, 232))
dab = ImageDraw.Draw(ab)
font_ab, font_ab_s = _font(18), _font(16)
for i, k in enumerate(keys):
    dab.text((LW + PAD + i * (cw + PAD) + cw / 2, PAD + 8), ZH[k],
             font=font_ab, fill=(60, 45, 30), anchor='mm')
for r, n in enumerate(AB):
    y = PAD + HEAD + r * (cw + PAD)
    dab.text((PAD, y + cw / 2), f'+{n}', font=font_ab_s, fill=(60, 45, 30), anchor='lm')
    for i, k in enumerate(keys):
        dirn, _ = PICK[k]
        p = sorted(glob.glob(f'temp/comfyui-out/{dirn}/*.png'))[-1]
        mm = _thicken(square_pad(to_mask(p)), n)
        lp = to_unit(vectorize(mm), 100.0, fit_r=FIT_R)
        cp = base1.copy()
        cp.alpha_composite(raster(lp, 80))
        ab.paste(cp.resize((cw, cw), Image.LANCZOS), (LW + PAD + i * (cw + PAD), y))
ab.save(f'{DST}/weight-ab.png')
print('ok ->', DST)
