#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A02 批 2 通用确定性微缩放：bbox 拉到目标 W×H%（NEAREST，居中贴纯黑 2048²）。
用法：python3 fix-a02-rescale.py <dir> <src_rgba> <dst_rgba> <targetW%> <targetH%>
G12/G9 执行口径内的「超差自适应缩放」腿；目标超 82% 上限时脚本拒绝。"""
import sys

import numpy as np
from PIL import Image

d, src, dst, tw_pct, th_pct = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5])
assert 70 <= tw_pct <= 82 and 70 <= th_pct <= 82, f"目标 {tw_pct}×{th_pct} 超 G9 70–82%"

im = np.asarray(Image.open(f"{d}/{src}")).copy()
fg = im[:, :, 3] == 255
ys, xs = np.where(fg)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
tw, th = int(tw_pct / 100 * 2048), int(th_pct / 100 * 2048)
crop = Image.fromarray(im[y0:y1, x0:x1], "RGBA").resize((tw, th), Image.NEAREST)
canvas = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))  # ⚠ 必须全透明：不透明黑底会毁掉 alpha（浣熊/鹿王已踩坑）
canvas.paste(crop, ((2048 - tw) // 2, (2048 - th) // 2))
canvas.save(f"{d}/{dst}")
print(f"{dst}: {tw/2048*100:.1f}×{th/2048*100:.1f}% (kx={tw/(x1-x0):.3f} ky={th/(y1-y0):.3f})")
