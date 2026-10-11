#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""初步自动切图规则：平背景洪水填充去底 → 连通域拆件 → 透明底单图。

用途：把一张「奶白/平色背景 + 若干被背景完整分隔的元素」的界面 mood 图，
自动切成每个元素一张的 RGBA 透明底单图。零外部依赖（仅需 numpy + PIL），
逐像素保真、不重绘，适合 AI 生成的平色底 mood 图做**构图/切图参照**拆件。

⚠ 定位：本脚本产出的精灵是「初步切图规则」的自动化产物，作**参照/底稿**用；
工程落库真资产仍按 menu-showcase-asset-spec §5 走 Figma 矢量重画，不直接入库。

判据（背景像素 Q）——把像素 p 投影到背景单位向量 u = C/|C|：
  t    = p·u        亮度分量（cn = |C| 为背景亮度）
  perp = |p - t·u|  色度分量（偏离背景线的距离）
两套模式（env KEEP_SHADOW）：
  KEEP_SHADOW=1（保留阴影，默认留档这套）：Q = dist(p, C) < 7   —— 只键贴平背景色，
                元素外投影 dist>10 落在背景外 → 投影原样保留为不透明。
  KEEP_SHADOW=0（去投影）：Q = (perp<28) & (t<=cn+2) & (t>=cn-90)
                —— 吃平背景 + 比背景更暗的投影；白盘/画布(比背景更亮, t>cn)与
                   深色字形(比背景更暗, t<cn-90 之外)都被排除 → 洪水挡在元素外、不啃盘。

流程：边缘 4 邻接洪水（只从图四周种子）定背景区 → alpha 置 0 →
      不透明区 8 邻接连通域 → bbox 面积≥2500 过滤 → 「几乎完全嵌套」(inter/min>0.82)
      才合并（曼陀罗/名牌并入橱窗，齿轮↔logo 仅边缘相接各自独立）→ PAD=8 裁单图 →
      棋盘接触表 _contact.png 复核。

调参入口（换背景色 mood 图时）：
  C   = 真背景 RGB（用图边缘中位数取，勿假设）
  阈值 7 / 28 / cn+2 / cn-90 / MIN_AREA 2500 / 嵌套 0.82 / PAD 8

用法：
  SPRITE_SRC=path/to/img.png [KEEP_SHADOW=1] python3 cut-sprites-local.py
  默认 SRC = v1-mainmenu-final.png，OUT = temp/sprites-shadow|sprites-alpha
"""
import os
from collections import deque
import numpy as np
from PIL import Image

SRC = os.environ.get(
    "SPRITE_SRC",
    "games/beads/design/references/menu-showcase-20261010/v1-mainmenu-final.png",
)
KEEP = os.environ.get("KEEP_SHADOW", "1") == "1"  # 1=保留所有阴影（只键平背景）；0=连投影一起吃
OUT = os.environ.get("SPRITE_OUT", "temp/sprites-shadow" if KEEP else "temp/sprites-alpha")
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert("RGB")
a = np.asarray(im).astype(np.float64)
H, W, _ = a.shape
C = np.array([253.0, 245.0, 234.0])  # 真背景色；换图时用边缘中位数复核
u = C / np.linalg.norm(C); cn = np.linalg.norm(C)
t = a @ u
foot = t[..., None] * u
perp = np.linalg.norm(a - foot, axis=2)
if KEEP:
    # 只把贴平背景色的像素当背景；投影(dist>10)保留为不透明
    dist = np.linalg.norm(a - C, axis=2)
    Q = dist < 7.0
else:
    Q = (perp < 28) & (t <= cn + 2) & (t >= cn - 90)  # 吃平背景+更暗投影；盘底渐变与深字形被挡

# 边缘洪水 = 背景区
bg = np.zeros((H, W), dtype=bool); q = deque()
for x in range(W):
    for y in (0, H-1):
        if Q[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
for y in range(H):
    for x in (0, W-1):
        if Q[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
        ny, nx = y+dy, x+dx
        if 0 <= ny < H and 0 <= nx < W and Q[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = True; q.append((ny, nx))

alpha = np.where(bg, 0, 255).astype(np.uint8)
rgba = np.dstack([a.astype(np.uint8), alpha])
sprite = Image.fromarray(rgba, "RGBA")

# 不透明区 = 元素；8 邻接连通域
M = ~bg
seen = np.zeros((H, W), dtype=bool)
comps = []
for sy in range(H):
    for sx in range(W):
        if seen[sy, sx] or not M[sy, sx]:
            continue
        st = [(sx, sy)]; seen[sy, sx] = True
        minx = maxx = sx; miny = maxy = sy; cnt = 0
        while st:
            x, y = st.pop(); cnt += 1
            if x < minx: minx = x
            elif x > maxx: maxx = x
            if y < miny: miny = y
            elif y > maxy: maxy = y
            for dy in (-1, 0, 1):
                ny = y + dy
                if 0 <= ny < H:
                    for dx in (-1, 0, 1):
                        nx = x + dx
                        if 0 <= nx < W and M[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; st.append((nx, ny))
        comps.append(((minx, miny, maxx, maxy), cnt))

comps = [c for c in comps if c[1] >= 2500]
boxes = [list(c[0]) for c in comps]

def area(b): return max(0, b[2]-b[0]) * max(0, b[3]-b[1])
def inter(x, y):
    return max(0, min(x[2],y[2])-max(x[0],y[0])) * max(0, min(x[3],y[3])-max(x[1],y[1]))
changed = True
while changed:
    changed = False
    for i in range(len(boxes)):
        for j in range(i+1, len(boxes)):
            s = min(area(boxes[i]), area(boxes[j]))
            if s > 0 and inter(boxes[i], boxes[j])/s > 0.82:
                A, B = boxes[i], boxes[j]
                boxes[i] = [min(A[0],B[0]), min(A[1],B[1]), max(A[2],B[2]), max(A[3],B[3])]
                boxes.pop(j); changed = True; break
        if changed: break

PAD = 8
regions = [(max(0,x0-PAD), max(0,y0-PAD), min(W,x1+1+PAD), min(H,y1+1+PAD))
           for (x0,y0,x1,y1) in sorted(boxes, key=lambda b:(b[1],b[0]))]
items = []
for i,(x0,y0,x1,y1) in enumerate(regions):
    fn = f"{OUT}/sprite-{i:02d}.png"
    sprite.crop((x0,y0,x1,y1)).save(fn)
    items.append((fn,(x0,y0,x1,y1)))

# 棋盘接触表
CELL = 320; cols = 3; rows = (len(items)+cols-1)//cols
def checker(w,h,s=14):
    c = np.zeros((h,w,3),np.uint8)
    yy,xx = np.mgrid[0:h,0:w]
    m = ((xx//s + yy//s) % 2 == 0)
    c[m] = (205,205,205); c[~m] = (245,245,245); return Image.fromarray(c)
sheet = Image.new("RGB",(cols*CELL, rows*CELL),(255,255,255))
for i,(fn,(x0,y0,x1,y1)) in enumerate(items):
    c = sprite.crop((x0,y0,x1,y1)); sc = CELL/c.size[1]
    c = c.resize((max(1,int(c.size[0]*sc)), CELL))
    bgc = checker(c.size[0], c.size[1]).convert("RGBA"); bgc.alpha_composite(c)
    r,cc = divmod(i,cols); sheet.paste(bgc.convert("RGB"),(cc*CELL, r*CELL))
sheet.save(f"{OUT}/_contact.png")

print(f"img {W}x{H}  背景 {bg.mean()*100:.1f}%  元素 {len(items)}  KEEP_SHADOW={int(KEEP)}")
for i,(fn,bb) in enumerate(items):
    print(f"  {i:02d} {fn}  bbox={bb} size=({bb[2]-bb[0]}x{bb[3]-bb[1]})")
