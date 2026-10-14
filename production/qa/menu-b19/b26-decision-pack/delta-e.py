#!/usr/bin/env python3
"""裁定包 U5 取证：三枚越界图标主色 → 板内最近色与 ΔE76，兼算对纸白圆底的 WCAG 对比。

板内色从 `games/beads/src/view/palette.ts` 现读（不硬编码清单），免得又造一版「凭摘要的色板」。
"""
import re
import sys

PANEL = sys.argv[1] if len(sys.argv) > 1 else "games/beads/src/view/palette.ts"
STRAY = {"灰·齿轮": "#A29D9A", "橙·扩音筒": "#FBBA5D", "蓝·信封": "#B2D9FA"}


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


REF = (95.047, 100.0, 108.883)  # xyz 已 ×100，参考白同量纲
M = [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]


def lab(c):
    lin = [(v / 255) ** 2.4 if (v / 255) >
           0.04045 else (v / 255) / 12.92 for v in c]
    xyz = [sum(M[i][j] * lin[j] for j in range(3)) * 100 for i in range(3)]
    f = [(v / REF[i]) ** (1 / 3) if v / REF[i] > 0.008856 else 7.787 * (v / REF[i]) + 16 / 116
         for i, v in enumerate(xyz)]
    return 116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])


def de76(c1, c2):
    L1, a1, b1 = lab(c1)
    L2, a2, b2 = lab(c2)
    return ((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2) ** 0.5


def lum(c):
    def t(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = [t(v) for v in c]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def cr(a, b):
    la, lb = lum(rgb(a)), lum(rgb(b))
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


src = open(PANEL, encoding="utf-8").read()
pal = {}
for m in re.finditer(r"^\s*(\w+):\s*['\"]#([0-9A-Fa-f]{6})['\"]", src, re.M):
    pal.setdefault("#" + m.group(2).upper(), m.group(1))

# 尺子自证：同色 ΔE ≡ 0，白 L* ≈ 100、黑 L* ≈ 0
W, K = rgb("#FFFFFF"), rgb("#000000")
assert de76(W, W) < 1e-9 and de76(K, K) < 1e-9, "ΔE 自证失败"
print("尺子自证 L*(白)=%.1f L*(黑)=%.1f ΔE(白,黑)=%.1f（应 ≈100/0/100）"
      % (lab(W)[0], lab(K)[0], de76(W, K)))

print("板内实读色数 = %d（palette.ts 去重）" % len(pal))
print("纸白圆底 panel = #FFFCF6\n")
for name, hexv in STRAY.items():
    c = rgb(hexv)
    rank = sorted(((de76(c, rgb(k)), k, v) for k, v in pal.items()))[:3]
    print("%s %s  对纸白对比 %.2f:1" % (name, hexv, cr(hexv, "#FFFCF6")))
    for d, k, v in rank:
        print("   ΔE76 %5.1f → %s (%s)  对纸白对比 %.2f:1" %
              (d, k, v, cr(k, "#FFFCF6")))
