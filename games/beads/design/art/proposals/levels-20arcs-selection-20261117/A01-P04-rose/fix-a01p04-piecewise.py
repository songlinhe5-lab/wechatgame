#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性：A01-P04 v2 花瓣版玫瑰「内部特征格级化」确定性修复（用户 2026-11-18 批准，0 次模型调用）。
v2 形态好（层叠尖瓣+螺旋开口+绿萼）但内部特征亚格：黄芯1.26格/奶白螺旋中位0.16格 ⇒ 珠面黄芯混成赭棕、螺旋仅2格。
实测（measure-a01p04-v2.py）：芯中心(1031,975) R84；内瓣环 84..204；螺旋带 204..260（厚中位20/p90 56）；
外薄螺旋尾 r>430（12px 细线，G2 违例）；外瓣至 r~822；绿萼 207×336（模型画浅绿 #5FB76C，板外）。
批准表＋披露修正：k3 3.0→4.5（中位厚20px 实测推翻56px 设计； survival 判据=格内覆盖≥55%，studio 区域平均后最近色）；
内瓣×0.5；外瓣×0.85 保尖（首跑 0.47 把瓣尖压没被判「螺旋面包」回调）；
细线归并改 cream&r>430→red（螺旋尾半径随角变化，固定环带会切主带）。
操作序：四色板硬 snap（去混色边/浅绿/粉内线）→ 细尾归并 → 分段径向逆映射（NEAREST 搬运）→ 去噪 → 自适应统缩/平移补边距。
产物覆盖 a01p04-v2-s42-rgba.png（原件留 -rgba-orig.png），metrics 落 -fix-metrics.json。
判据正本：../series-spec.md §2 G1–G9 + G11；P02/P03 分段修复同族。"""
import json
import os
from collections import deque

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH = os.path.join(REPO, "games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P04-rose")
SRC = os.path.join(BATCH, "a01p04-v2-s42-rgba.png")
ORIG = SRC.replace(".png", "-orig.png")
CELL_PX = 128 ** 2
TARGET = 0.78

src = ORIG if os.path.exists(ORIG) else SRC  # 重跑幂等：原件只备份一次
a = np.asarray(Image.open(src).convert("RGBA")).copy()
h, w = a.shape[:2]
if not os.path.exists(ORIG):
    Image.fromarray(a, "RGBA").save(ORIG)
fg = a[:, :, 3] == 255

# 1) 四色板硬 snap：每个前景像素取最近板色（只减色不增色；消混色边/浅绿萼/粉内线）
PAL = np.array([(232, 76, 61), (253, 246, 233), (255, 210, 63), (63, 191, 107)])
rgb = a[:, :, :3].astype(int)
d = np.stack([((rgb - c) ** 2).sum(2) for c in PAL])
snap = PAL[d.argmin(0)]
a[:, :, :3][fg] = snap[fg]

# 2) 外薄螺旋尾归并（G2 无描边）：cream 且 r>430 → red
CX, CY = 1031.0, 975.0
yy, xx = np.mgrid[0:h, 0:w]
rr = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
cream = fg & (a[:, :, 0] == 253) & (a[:, :, 1] == 246)
tail = cream & (rr > 430)
a[:, :, :3][tail] = (232, 76, 61)
tail_px = int(tail.sum())

# 3) 分段径向逆映射：R[84,204,260,430] k=[1.7,0.5,4.5,0.85]（末段无界）
R1, R2, R3, R4 = 84.0, 204.0, 260.0, 430.0
K1, K2, K3, K4 = 1.7, 0.5, 4.5, 0.85  # k3=4.5：螺旋中位90px≈格内64%覆盖（studio 区域平均后最近色保奶白）；k4=0.85 保外瓣尖
T1, T2, T3, T4 = R1 * K1, R1 * K1 + (R2 - R1) * K2, R1 * K1 + (R2 - R1) * K2 + (R3 - R2) * K3, \
    R1 * K1 + (R2 - R1) * K2 + (R3 - R2) * K3 + (R4 - R3) * K4
rp = rr
rsrc = np.where(rp <= T1, rp / K1,
                np.where(rp <= T2, R1 + (rp - T1) / K2,
                         np.where(rp <= T3, R2 + (rp - T2) / K3, R3 + (rp - T3) / K4)))
ang = np.arctan2(yy - CY, xx - CX)
sxi = np.round(CX + rsrc * np.cos(ang)).astype(int)
syi = np.round(CY + rsrc * np.sin(ang)).astype(int)
ok = (sxi >= 0) & (sxi < w) & (syi >= 0) & (syi < h)
out = np.zeros((h, w, 4), dtype=np.uint8)
out[ok] = a[syi[ok], sxi[ok]]
out[:, :, :3][out[:, :, 3] == 0] = 0
a = out
fg = a[:, :, 3] == 255

# 4) 去噪：<1 格漂浮连通域置透明
seen = np.zeros((h, w), bool)
removed = []
for sy0 in range(h):
    for sx0 in np.where(fg[sy0] & ~seen[sy0])[0]:
        if seen[sy0, sx0]:
            continue
        q = deque([(sy0, sx0)])
        seen[sy0, sx0] = True
        pix = []
        while q:
            y, x = q.popleft()
            pix.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and fg[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        if len(pix) < CELL_PX:
            for y, x in pix:
                a[y, x] = (0, 0, 0, 0)
            removed.append(len(pix))
fg = a[:, :, 3] == 255

# 5) 自适应统缩（最大轴>82%→78%）＋平移补四边 >=8%
ys, xs = np.where(fg)
bcx, bcy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
bw, bh = (xs.max() - xs.min() + 1) / w, (ys.max() - ys.min() + 1) / h
scale = 1.0
if max(bw, bh) > 0.82:
    scale = TARGET / max(bw, bh)
    sxf = np.round(bcx + (xx - w / 2) / scale).astype(int)
    syf = np.round(bcy + (yy - h / 2) / scale).astype(int)
    ok2 = (sxf >= 0) & (sxf < w) & (syf >= 0) & (syf < h)
    out2 = np.zeros((h, w, 4), dtype=np.uint8)
    out2[ok2] = a[syf[ok2], sxf[ok2]]
    out2[:, :, :3][out2[:, :, 3] == 0] = 0
    a = out2
    fg = a[:, :, 3] == 255
ys, xs = np.where(fg)
shift = [0, 0]
need = 0.08
if xs.min() / w < need:
    shift[0] = int(np.ceil(need * w - xs.min()))
elif (w - 1 - xs.max()) / w < need:
    shift[0] = -int(np.ceil(need * w - (w - 1 - xs.max())))
if ys.min() / h < need:
    shift[1] = int(np.ceil(need * h - ys.min()))
elif (h - 1 - ys.max()) / h < need:
    shift[1] = -int(np.ceil(need * h - (h - 1 - ys.max())))
if shift != [0, 0]:
    a = np.roll(a, shift, axis=(0, 1))
    fg = a[:, :, 3] == 255

colors_after = set(map(tuple, a[fg][:, :3]))
assert colors_after <= set(map(tuple, PAL)), f"板外色: {colors_after - set(map(tuple, PAL))}"

Image.fromarray(a, "RGBA").save(SRC)
ys, xs = np.where(fg)
info = {
    "k": [K1, K2, K3, K4],
    "tail_merged_px": tail_px,
    "noise_components_removed": removed,
    "scale": round(scale, 4),
    "shift": shift,
    "bbox_pct": [round((xs.max() - xs.min() + 1) / w * 100, 2), round((ys.max() - ys.min() + 1) / h * 100, 2)],
    "margins_pct": [round(xs.min() / w * 100, 2), round(ys.min() / h * 100, 2),
                    round((w - 1 - xs.max()) / w * 100, 2), round((h - 1 - ys.max()) / h * 100, 2)],
    "fg_px": int(fg.sum()),
    "colors_kept": sorted("#%02X%02X%02X" % c for c in colors_after),
}
json.dump(info, open(os.path.join(BATCH, "a01p04-v2-fix-metrics.json"), "w"), ensure_ascii=False, indent=2)
print(json.dumps(info, ensure_ascii=False, indent=2))