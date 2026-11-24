#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A02-P02 棕熊 v4 本地确定性修复（0 次模型调用）：纵向统缩 H→78%（kx=1.0）。
v4 H=87.9% 超 82%（宽 78.1% 已达标）；近黑仅 50px（眼鼻抗锯齿级，不处理）。"""
import json
import numpy as np
from PIL import Image

SRC = "a02p02-v4-s42-rgba.png"
DST = "a02p02-v4fix-s42.png"
im = np.asarray(Image.open(SRC)).copy()
fg = im[:, :, 3] == 255
ys, xs = np.where(fg)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
tw, th = x1 - x0, int(0.78 * 2048)
ky = th / (y1 - y0)
crop = Image.fromarray(im[y0:y1, x0:x1], "RGBA").resize((tw, th), Image.NEAREST)
canvas = Image.new("RGBA", (2048, 2048), "#000000")
canvas.paste(crop, ((2048 - tw) // 2, (2048 - th) // 2))
canvas.save(DST)
print(f"ky={ky:.4f} → bbox {tw/2048*100:.1f}×{th/2048*100:.1f}%")
json.dump({"ky": round(ky, 4)}, open("a02p02-v4fix-meta.json", "w"))
