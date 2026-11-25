#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A03-P09 鲸之王 v2 · 40×40 定稿产线（0 次 Token Plan 调用，只打本机 studio）。

背景：用户 2026-11-24 裁定「难度靠增加颜色来处理，珠面可以不用 48×48 那么宽」⇒
      BOSS 板面改 40×40。在 40 格上 N=622（300–699 ⇒ 档₀=2）+ C=6 升一档 + G(12) 不降档
      ⇒ 实测 tier 3「超难」，满足 A01 起章末 BOSS 硬闸。
      48×48 那条链（fix-a03p09-v2.py）留作弃档对照，不再是交付口径。

输入：a03p09-v2-s42-rgba.png（qwen-image-3.0-pro seed42 母版抠图）
输出：a03p09-v2-g40fix-s42-rgba.png（定稿底图）
      studio-full-response-v2-g40fix-40-c0.json（量化全响应）
      a03p09-v2-g40fix-max-40-c0-beads-plain.png（珠面预览）

流程：
  1. bbox 归一 78%×78%（NEAREST，居中贴全透明 2048²）——G9 要求 70–82%。
  2. 清掉模型自带炭黑眼（48 格位置在 40 格会糊成一块），按 40 格格心重画 3×3×2：
     近眼 rows11-13 cols11-13、远眼 rows12-14 cols16-18。
  3. 量化 → 自动吞并 ≤2 格的孤块（按 4 邻域多数色回填母版）→ 再量化，最多 3 轮。
  4. 导出响应 JSON 与珠面预览。

量化口径：40×40 / palette=10 / colors=0（全色板投票；⛔ colors=6 的 k-means
会把湖蓝整簇并进丁香紫）/ colorsmode=error / cellmode=mode / smooth=0 / swaps=0 /
noframe=1 / notrim=1 / mis=max / draft=1。
"""
import base64
import json
import urllib.request

import numpy as np
from PIL import Image, ImageDraw

SRC = 'a03p09-v2-s42-rgba.png'
DST = 'a03p09-v2-g40fix-s42-rgba.png'
OUT_JSON = 'studio-full-response-v2-g40fix-40-c0.json'
OUT_PNG = 'a03p09-v2-g40fix-max-40-c0-beads-plain.png'
GRID = 40
CH = "123456789ABCDEFGH"
API = ('http://127.0.0.1:8787/api/generate?cols={g}&rows={g}&board={b}&palette=10&colors=0'
       '&colorsmode=error&cellmode=mode&smooth=0&swaps=0&noframe=1&notrim=1&mis=max&draft=1')
BLUE = (0x41, 0x89, 0xE5, 255)
INK = (0x33, 0x33, 0x3D, 255)
C = 2048 / GRID


def frame(c, r):
    return (int(round(c * C)), int(round(r * C)), int(round((c + 1) * C)) - 1, int(round((r + 1) * C)) - 1)


# ── 1) G9 归一 ────────────────────────────────────────────────
im = np.asarray(Image.open(SRC)).copy()
fg = im[:, :, 3] == 255
ys, xs = np.where(fg)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
side = int(0.78 * 2048)
crop = Image.fromarray(im[y0:y1, x0:x1], 'RGBA').resize((side, side), Image.NEAREST)
canvas = Image.new('RGBA', (2048, 2048), (0, 0, 0, 0))  # ⚠ 必须全透明
canvas.paste(crop, ((2048 - side) // 2, (2048 - side) // 2))
src = canvas
dr = ImageDraw.Draw(src)

# ── 2) 清旧眼 + 重画 3×3×2 ────────────────────────────────────
arr = np.asarray(src)[..., :3].astype(np.int32)
for r in range(int(0.25 * GRID), int(0.55 * GRID)):
    for c in range(int(0.15 * GRID), int(0.55 * GRID)):
        x0, y0, x1, y1 = frame(c, r)
        med = np.median(arr[y0:y1 + 1, x0:x1 + 1].reshape(-1, 3), axis=0)
        if ((med - np.array(INK[:3])) ** 2).sum() < 900:
            dr.rectangle((x0, y0, x1, y1), fill=BLUE)
dr.rectangle(frame(11, 11)[:2] + frame(13, 13)[2:], fill=INK)
dr.rectangle(frame(16, 12)[:2] + frame(18, 14)[2:], fill=INK)


# ── 3) 量化 + 孤块吞并 ────────────────────────────────────────
def quantize(board):
    data = np.asarray(src).astype(np.uint8)
    body = json.dumps({"w": 2048, "h": 2048,
                       "data": base64.b64encode(data.tobytes()).decode()}).encode()
    req = urllib.request.Request(API.format(g=GRID, b=board), data=body, method='POST',
                                 headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=300).read().decode())


def tiny_blocks(pat, limit=2):
    R = len(pat); Cc = len(pat[0])
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
    resp = quantize(f'a03p09v2-g40fix-p{pass_no}')
    pat = resp['pattern'] if isinstance(resp['pattern'], list) else resp['pattern'].splitlines()
    pal = resp['paletteHex']
    small = tiny_blocks(pat)
    print(f'pass {pass_no}: N={resp["report"]["mis"]["N"]} F={resp["report"]["mis"]["F"]} '
          f'C={resp["report"]["colorsUsed"]} tiny={sum(len(c) for _, c in small)}')
    if not small:
        break
    for ch, cells in small:
        for (r, c) in cells:
            nb = {}
            for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nr, nc = r + da, c + db
                if 0 <= nr < GRID and 0 <= nc < GRID and pat[nr][nc] not in '. ':
                    nb[pat[nr][nc]] = nb.get(pat[nr][nc], 0) + 1
            if not nb:
                continue
            target = max(nb, key=nb.get)
            hexc = pal[CH.index(target)]
            rgb = (int(hexc[1:3], 16), int(hexc[3:5], 16), int(hexc[5:7], 16), 255)
            dr.rectangle(frame(c, r), fill=rgb)

# ── 4) 导出 ──────────────────────────────────────────────────
src.save(DST)
json.dump(resp, open(OUT_JSON, 'w'), ensure_ascii=False, indent=2)
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
print(f'{DST} / {OUT_JSON} / {OUT_PNG} 已出')
