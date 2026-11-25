#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P09 鲸之王 v2 · 42×42 定稿产线（0 次 Token Plan 调用，只打本机 studio）。

用户 2026-11-24 裁定「难度靠增加颜色来处理，珠面可以不用 48×48 那么宽」⇒
48 档（fix-a03p09-v2.py）与 40 档（build-a03p09-40.py）都作弃档对照，交付口径 = 42×42。
42 格 N=701（≥700 ⇒ 档₀=3）+ C=6 升一档，即使 G 比 <1.25 降一档仍收在 tier 3。

输入：a03p09-v2-g42fix-s42-rgba.png（78% 归一 + 双眼重画后的 42 格底图）
处理：量化 → 吞并 ≤2 格孤块（4 邻域多数色回填）→ 再量化，最多 3 轮
输出：a03p09-v2-g42final-s42-rgba.png / studio-full-response-v2-g42final-42-c0.json /
      a03p09-v2-g42final-max-42-c0-beads-plain.png / v2-g42final-pattern.txt

量化口径：42×42 / palette=10 / colors=0（全色板投票；⛔ colors=6 会把湖蓝并进丁香紫）/
colorsmode=error / cellmode=mode / smooth=0 / swaps=0 / noframe=1 / notrim=1 / mis=max / draft=1。
"""
import base64
import json
import urllib.request

import numpy as np
from PIL import Image, ImageDraw

SRC = 'a03p09-v2-g42fix-s42-rgba.png'
DST = 'a03p09-v2-g42v5-s42-rgba.png'
OUT_JSON = 'studio-full-response-v2-g42v5-42-c0.json'
OUT_PNG = 'a03p09-v2-g42v5-max-42-c0-beads-plain.png'
OUT_PAT = 'v5-g42-pattern.txt'
GRID = 42
CH = "123456789ABCDEFGH"
API = ('http://127.0.0.1:8787/api/generate?cols={g}&rows={g}&board={b}&palette=10&colors=0'
       '&colorsmode=error&cellmode=mode&smooth=0&swaps=0&noframe=1&notrim=1&mis=max&draft=1')
C = 2048 / GRID


def frame(c, r):
    return (int(round(c * C)), int(round(r * C)), int(round((c + 1) * C)) - 1, int(round((r + 1) * C)) - 1)


src = Image.open(SRC).convert('RGBA')
dr = ImageDraw.Draw(src)

# 喷柱左缘：母版描边在 42 格量化成赭棕/深棕 2×3 块（贴图提示词要求无描边，属生成副作用）。
# 把这条描边格直接并回柠黄，喷柱在 rows5-7 由 2 格宽变 4 格宽（贴 11% 设计宽 ≈4.6 格）。
YELLOW = (0xFF, 0xD2, 0x3F, 255)
for r in (5, 6, 7):
    for c in (10, 11):
        dr.rectangle(frame(c, r), fill=YELLOW)

# 近眼左下的溢出格（40 格眼位在 42 格上多出 1 格，眼睛变 3×3+1）：并回湖蓝，眼睛回到 3×3×2。
BLUE = (0x41, 0x89, 0xE5, 255)
dr.rectangle(frame(11, 13), fill=BLUE)

# ── v5 鲸身纵向放大 + 海面收窄贴腹（用户 2026-11-25 追裁「减少海面比例，鲸鱼与海面紧密结合」）──
# 全鲸（喷柱到腹底 rows0-27）纵向 ×1.2：鲸底 row26 → row32，鲸形不变形、面积 +20%；
# 海面 rows31-37（浪冠 2 行 + 丁香紫 3 + 深棕 2），比 v3 矮 1 行，且浪冠直接贴住鲸腹。
BOT = int(round(28 * C))
crop = src.crop((0, 0, 2048, BOT))
crop = crop.resize((2048, int(round(BOT * 1.2))), Image.NEAREST)
src = Image.new('RGBA', (2048, 2048), (0, 0, 0, 0))
src.paste(crop, (0, 0))
dr = ImageDraw.Draw(src)
A1 = np.asarray(src)[:, :, 3].copy()

# 鲸面补形：胸腹下缘的透明楔口补成奶白腹色，鲸腹与海面浪冠同色相接（不扩海面）
BELLY = (0xFD, 0xF6, 0xE9, 255)
FILLS = [(r, 5, 9) for r in range(24, 32)] + [(r, 23, 28) for r in range(29, 32)]
for r, a, b in FILLS:
    for c in range(a, b + 1):
        if A1[int((r + 0.5) * C), int((c + 0.5) * C)] == 0:
            dr.rectangle(frame(c, r), fill=BELLY)
print(f'whale fill cells: {sum(len(range(a, b + 1)) for _, a, b in FILLS)}')
PAL = {'1': (0xFD, 0xF6, 0xE9), '3': (0x8E, 0x6F, 0xD9), '5': (0x6B, 0x3E, 0x1E)}
px = src.load()


def paint(c, r, ch):
    """画一格；已有 alpha 的鲸格跳过（保护鲸身）。返回是否画上。"""
    if px[int((c + 0.5) * C), int((r + 0.5) * C)][3] > 0:
        return 0
    dr.rectangle(frame(c, r), fill=PAL[ch] + (255,))
    return 1


# 浪冠（奶白）rows31-32 三块贴鲸腹；丁香紫 rows33-35；深棕 rows36-37
n_foam = 0
for r in (31, 32):
    for c0, c1 in [(5, 13), (17, 24), (29, 36)]:
        for c in range(c0, c1 + 1):
            n_foam += paint(c, r, '1')
for c in range(25, 29):
    n_foam += paint(c, 32, '1')
n_water = 0
for r in (33, 34, 35):
    for c in range(4, 38):
        n_water += paint(c, r, '3')
for r in (36, 37):
    for c in range(4, 38):
        n_water += paint(c, r, '5')
print(f'foam cells: {n_foam} / water cells: {n_water}')


# 鲸面加色：背鞍斑 → 丁香紫；尾鳍（rows20+ / cols29+）→ 深棕。用缩放后的 A1 判定鲸格
def repaint(c, r, ch):
    if A1[int((r + 0.5) * C), int((c + 0.5) * C)] <= 0:
        return 0
    dr.rectangle(frame(c, r), fill=PAL[ch] + (255,))
    return 1


n_saddle = 0
for r, a, b in [(19, 19, 25), (20, 19, 25), (21, 19, 25), (22, 20, 26), (23, 19, 27)]:
    for c in range(a, b + 1):
        n_saddle += repaint(c, r, '3')
n_tail = 0
for r in range(20, GRID):
    for c in range(29, GRID):
        if frame(c, r)[0] > 1852:
            continue
        n_tail += repaint(c, r, '5')
print(f'whale repaint: saddle(紫)={n_saddle} tail(深棕)={n_tail}')
# 尾鳍内被抗锯齿切出的蓝碎片（rows24-25 尾尖 2×2、col33 rows28-30 细条）并回深棕，收 T2 碎块
for c, r in [(36, 24), (37, 24), (36, 25), (37, 25), (33, 28), (33, 29), (33, 30)]:
    dr.rectangle(frame(c, r), fill=PAL['5'] + (255,))


def quantize(board):
    data = np.asarray(src).astype(np.uint8)
    body = json.dumps({"w": 2048, "h": 2048,
                       "data": base64.b64encode(data.tobytes()).decode()}).encode()
    req = urllib.request.Request(API.format(g=GRID, b=board), data=body, method='POST',
                                 headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=300).read().decode())


def tiny_blocks(pat, limit=2):
    R, Cc = len(pat), len(pat[0])
    seen = [[False] * Cc for _ in range(R)]
    out = []
    for r in range(R):
        for c in range(Cc):
            ch = pat[r][c]
            if ch == '.' or seen[r][c]:
                continue
            st = [(r, c)]; seen[r][c] = True; cells = []
            while st:
                a, b = st.pop(); cells.append((a, b))
                for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    na, nb = a + da, b + db
                    if 0 <= na < R and 0 <= nb < Cc and not seen[na][nb] and pat[na][nb] == ch:
                        seen[na][nb] = True; st.append((na, nb))
            if len(cells) <= limit:
                out.append((ch, cells))
    return out


resp = None
for pass_no in range(3):
    resp = quantize(f'a03p09v2-g42v5-p{pass_no}')
    pat = resp['pattern'] if isinstance(resp['pattern'], list) else resp['pattern'].splitlines()
    pal = resp['paletteHex']
    small = tiny_blocks(pat)
    print(f'pass {pass_no}: N={resp["report"]["mis"]["N"]} F={resp["report"]["mis"]["F"]} '
          f'C={resp["report"]["colorsUsed"]} tiny={sum(len(c) for _, c in small)}')
    if not small:
        break
    for ch, cells in small:
        nb = {}
        for (r, c) in cells:
            for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nr, nc = r + da, c + db
                if 0 <= nr < GRID and 0 <= nc < GRID and pat[nr][nc] not in '. ' and pat[nr][nc] != ch:
                    nb[pat[nr][nc]] = nb.get(pat[nr][nc], 0) + 1
        if not nb:
            continue
        target = max(nb, key=nb.get)
        hexc = pal[CH.index(target)]
        rgb = (int(hexc[1:3], 16), int(hexc[3:5], 16), int(hexc[5:7], 16), 255)
        for (r, c) in cells:
            x0, y0, x1, y1 = frame(c, r)
            if x0 > 1852:
                continue
            # 裁剪到 x≤1852：studio 的 1px 出血格回填整格会把 alpha 顶出 G9 上限
            dr.rectangle((x0, y0, min(x1, 1852), y1), fill=rgb)

src.save(DST)
a = np.asarray(Image.open(DST).convert('RGBA'))[:, :, 3]
ys, xs = np.where(a > 0)
print(f'alpha bbox x[{xs.min()}..{xs.max()}] y[{ys.min()}..{ys.max()}] '
      f'W={(xs.max()-xs.min()+1)/2048:.2%} H={(ys.max()-ys.min()+1)/2048:.2%}')
json.dump(resp, open(OUT_JSON, 'w'), ensure_ascii=False, indent=2)
pat = resp['pattern'] if isinstance(resp['pattern'], list) else resp['pattern'].splitlines()
open(OUT_PAT, 'w').write('\n'.join(pat) + '\n')
CELL = 16
out = Image.new('RGB', (GRID * CELL, GRID * CELL), '#ECEAF3')
dd = ImageDraw.Draw(out)
for y, row in enumerate(pat):
    for x, ch in enumerate(row):
        if ch == '.':
            continue
        dd.rectangle([x * CELL + 1, y * CELL + 1, (x + 1) * CELL - 2, (y + 1) * CELL - 2],
                     fill=pal[CH.index(ch)])
out.save(OUT_PNG)

# ── 读数：tier / DI / G12 占比 ────────────────────────────────
mp = resp['misplaced']


def is_mis(r, c):
    return mp[r][c] != '.' and pat[r][c] != '.' and mp[r][c] != pat[r][c]


R = GRID
seen = [[False] * R for _ in range(R)]
sizes = []
for r in range(R):
    for c in range(R):
        if seen[r][c] or not is_mis(r, c):
            continue
        color = mp[r][c]
        st = [(r, c)]; seen[r][c] = True; n = 0
        while st:
            a, b = st.pop(); n += 1
            for da in (-1, 0, 1):
                for db in (-1, 0, 1):
                    if da == db == 0:
                        continue
                    na, nb = a + da, b + db
                    if (0 <= na < R and 0 <= nb < R and not seen[na][nb]
                            and is_mis(na, nb) and mp[na][nb] == color):
                        seen[na][nb] = True; st.append((na, nb))
        sizes.append(n)
n_fillable = sum(1 for row in pat for ch in row if ch != '.')
colors = len({ch for row in pat for ch in row if ch != '.'})
g = sum(-(-b // 12) for b in sizes)
gmin = -(-n_fillable // 12)
ratio = g / gmin if gmin else 0
tier = 0 if n_fillable < 150 else 1 if n_fillable < 300 else 2 if n_fillable < 700 else 3
if colors >= 6:
    tier += 1
if sizes and ratio >= 2:
    tier += 1
elif sizes and ratio < 1.25:
    tier -= 1
tier = max(0, min(3, tier))
di = tier * 10**12 + n_fillable * 10**8 + colors * 10**4 + g
print(f'N={n_fillable} C={colors} blobs={len(sizes)} g={g} gmin={gmin} ratio={ratio:.3f} '
      f'tier={tier} DI={di}')
from collections import Counter
cnt = Counter(ch for row in pat for ch in row if ch != '.')
for ch, k in cnt.most_common():
    print(f'  {ch} {resp["paletteHex"][CH.index(ch)]} {k} ({k / n_fillable * 100:.1f}%)')
print(f'steps={resp["report"]["difficulty"]["steps"]} time={resp["report"]["difficulty"]["timeEst"]} '
      f'importable={resp["importable"]} blockers={resp["blockers"]}')
print(f'{DST} / {OUT_JSON} / {OUT_PNG} / {OUT_PAT} 已出')
