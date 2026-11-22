#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本地调色：将 v1 白黄主导 (90%) 拉回 G12 可接受（max ≤ 35%）。
策略：棕色花盘区 白→棕；黄色射线尖端 黄→橙。"""
import numpy as np
from PIL import Image

SRC = "a01p08-v1-s42-rgba-fixed.png"
DST = "a01p08-v1-s42-rgba-recolored.png"

rgba = np.asarray(Image.open(SRC).convert("RGBA")).copy()
R, G, B = rgba[:,:,0].astype(np.int16), rgba[:,:,1].astype(np.int16), rgba[:,:,2].astype(np.int16)
alpha = rgba[:,:,3]

# 1) 定位棕色花盘中心 & 半径
brown = (R<140)&(G<100)&(B<60)&(alpha==255)
ys, xs = np.where(brown)
if len(xs)>0:
    cx, cy = xs.mean(), ys.mean()
    br = max(xs.max()-xs.min(), ys.max()-ys.min())/2 + 20
    print(f"brown disk center=({cx:.0f},{cy:.0f}), radius={br:.0f}")
else:
    cx, cy = rgba.shape[1]/2, rgba.shape[0]/2
    br = 100

# 2) 白色→棕色（花盘附近）
white_mask = (R>240)&(G>240)&(B>220)&(alpha==255)
Yg, Xg = np.mgrid[0:rgba.shape[0], 0:rgba.shape[1]]
dist_to_disk = np.sqrt((Xg-cx)**2 + (Yg-cy)**2)
# 距离花盘中心越近 → 转换概率越高
prob_white_to_brown = np.clip(1.0 - dist_to_disk/(br*2.5), 0, 1) * 0.55  # 最多 55% 白→棕
rng = np.random.RandomState(12345)
white2brown = white_mask & (rng.rand(*rgba.shape[:2]) < prob_white_to_brown)
rgba[white2brown, 0] = 0x6B
rgba[white2brown, 1] = 0x3E
rgba[white2brown, 2] = 0x1E
print(f"white→brown: {int(white2brown.sum())} px")

# 3) 黄色→橙色（射线尖端 = 距中心最远的黄像素）
yellow_mask = (R>230)&(G>200)&(G<240)&(B<100)&(alpha==255)
dist_from_center = np.sqrt((Xg-cx)**2 + (Yg-cy)**2)
max_dist = dist_from_center[yellow_mask].max() if yellow_mask.any() else 500
# 距中心越远 → 黄色→橙色概率越高（尖端）
prob_yellow_to_orange = np.clip((dist_from_center - cx*0.5)/(max_dist - cx*0.5), 0, 1) * 0.50
yellow2orange = yellow_mask & (rng.rand(*rgba.shape[:2]) < prob_yellow_to_orange)
rgba[yellow2orange, 0] = 0xF5
rgba[yellow2orange, 1] = 0x9B
rgba[yellow2orange, 2] = 0x23
print(f"yellow→orange: {int(yellow2orange.sum())} px")

Image.fromarray(rgba, "RGBA").save(DST)
print(f"saved → {DST}")

# 复查
alpha255 = rgba[:,:,3]==255
all_px = int(alpha255.sum())
white_after = int(((rgba[:,:,0]>240)&(rgba[:,:,1]>240)&(rgba[:,:,2]>220)&alpha255).sum())
yellow_after = int(((rgba[:,:,0]>230)&(rgba[:,:,1]>200)&(rgba[:,:,1]<240)&(rgba[:,:,2]<100)&alpha255).sum())
orange_after = int(((rgba[:,:,0]>200)&(rgba[:,:,1]>100)&(rgba[:,:,1]<180)&(rgba[:,:,2]<80)&alpha255).sum())
brown_after = int(((rgba[:,:,0]<140)&(rgba[:,:,1]<100)&(rgba[:,:,2]<60)&alpha255).sum())
green_after = int(((rgba[:,:,1]>140)&(rgba[:,:,0]<150)&(rgba[:,:,2]<150)&alpha255).sum())
print(f"white: {white_after/all_px*100:.1f}%  yellow: {yellow_after/all_px*100:.1f}%  orange: {orange_after/all_px*100:.1f}%  brown: {brown_after/all_px*100:.1f}%  green: {green_after/all_px*100:.1f}%")
print(f"max of 5: {max(white_after,yellow_after,orange_after,brown_after,green_after)/all_px*100:.1f}%")
