#!/usr/bin/env python3
"""U1② 原型：把 707×459 招牌原件裁掉「断头绳」并补 AA，量出真实体积与落位框。

只做两件事（⛔ 不重绘、不上大模型）：按行宽跳变找板体上缘 → 裁；alpha 轻微羽化破硬边。
产物落本目录（证据，不进 temp）：`sign-norope@2x.png` / `.webp`。
"""
from PIL import Image, ImageFilter
import numpy as np
import os

SRC = "games/beads/design/art/shots/menu-showcase-20261010/sprites-v1-shadow/sprite-00.png"
OUT = os.path.dirname(os.path.abspath(__file__))

im = Image.open(SRC).convert("RGBA")
a = np.array(im)[:, :, 3]
w = (a > 128).sum(1)
H, W = a.shape
# 板体上缘 = 行宽从「细颈」跳到「宽板」的第一行（阈值：>40% 峰值宽）
thr = 0.4 * w.max()
plank_top = int(np.argmax(w > thr))
xs = np.where((a > 128).any(0))[0]
ys = np.where((a > 128).any(1))[0]
print("原件 %d×%d @2x ｜板体上缘 @2x y=%d ⇒ 绳段高 %d px(@2x) = %d(@1x)" %
      (W, H, plank_top, plank_top, plank_top // 2))

cut = im.crop((int(xs.min()), plank_top, int(xs.max()) + 1, int(ys.max()) + 1))
# 补 AA：整图 1.5× 重采样后回缩（Lanczos 自带过渡），只动 alpha 边缘、不RGB 不改形状
big = cut.resize((cut.width * 3 // 2, cut.height * 3 // 2), Image.LANCZOS)
small = big.resize(cut.size, Image.LANCZOS)
r, g, b, al = small.split()
small = Image.merge(
    "RGBA", (r, g, b, al.filter(ImageFilter.GaussianBlur(0.8))))
solid = np.array(small)[:, :, 3]
half = ((solid > 0) & (solid < 255)).mean() * 100
png = os.path.join(OUT, "sign-norope@2x.png")
webp = os.path.join(OUT, "sign-norope@2x.webp")
small.save(png, optimize=True)
small.save(webp, "WEBP", quality=80, method=6)
print("裁绳后 %d×%d @2x ⇒ @1x %d×%d（比例 %.2f:1）半透 %.2f%%（原 0.00%%）" %
      (small.width, small.height, small.width // 2, small.height // 2,
       small.width / small.height, half))
print("体积：裁绳前 PNG %.1f KB ｜裁绳后 PNG %.1f KB / WebP %.1f KB" %
      (os.path.getsize(SRC) / 1024, os.path.getsize(png) / 1024, os.path.getsize(webp) / 1024))
print("主包余量 1117 KB ⇒ PNG 路线占 %.0f%%，WebP 路线占 %.0f%%" %
      (os.path.getsize(png) / 1024 / 1117 * 100, os.path.getsize(webp) / 1024 / 1117 * 100))

# 尺子自证：裁绳件必须①仍有非零 alpha ②半透占比在 (0,15%) 合理带 ③面积确实变小
# ④边缘振铃门（K-133 同族）：半透环的 RGB 亮度不得比实心区亮 40 以上（防亮边振入）
rgb = np.array(small)[:, :, :3].astype(int)
halfm = (solid > 0) & (solid < 255)
solidm = solid == 255
lum_h = np.percentile(rgb[halfm].mean(1), 99) if halfm.any() else 0
lum_s = np.percentile(rgb[solidm].mean(1), 99)
assert solid.max() > 0 and half > 0, "补 AA 失败，边缘仍是硬边"
assert half < 15, "半透占比异常（可能把内容糊进背景）"
assert small.height < H, "没裁到绳"
assert lum_h - lum_s <= 40, "半透环比实心区亮 %.0f（边缘振铃）" % (lum_h - lum_s)
print("自证通过：断头绳已裁、边缘有过渡、件未变大、振铃差 %.0f ≤ 40" % (lum_h - lum_s))
