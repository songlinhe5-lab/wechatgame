#!/usr/bin/env python3
"""
════════════════════════════════════════════════════════════════════════
 有孔 tint mask 烘焙纹理 —— **定稿 v1.1**（v1.0 2026-09-29 冻结；v1.1 同日变更：槽底 → 格底色）
════════════════════════════════════════════════════════════════════════
 本脚本即「有孔档 tint mask」的正式烘焙标准；产物供 Cocos 探针与正式管线共用。
 ⛔ 定稿后改参数 = 变更设计口径，须登记 memory/TASKS 并同步 GDD §7 / cell-standard-holed。

【冻结口径】
 珠（bead，26dp 圆角方、角 8dp）：
   - 真透孔 ⌀12dp（J4：round(26×0.44/2)=6 ⇒ 12）· B14 孔边线 1dp 实色（hole −0.58 ⇒ d 0.42）
   - 珠外框 1dp（−0.58 实色）· 本体 24dp · plate 0.56 · 刻面四向渐变 · lit 0.38
 格（grid，格径 30dp）：
   - 槽口 24dp（珠面轮廓内缩 1dp ⇒ 珠盖上不漏槽沿）、角 8dp
   - 槽内边沿 3dp 斜面：背光（上+左+右）0.32（−0.68）/ 受光（下）0.70+lit（光照在暗带基础上）
   - 坑底 0.32（−0.68）· 格外 0.70（−0.30）
 通用：
   - mask 编码 R=d / G=l / B=形状（A=255 满幅免疫 Trim）
   - 512 超采样 → LANCZOS ×4 缩回 128 · 距离计算完成后取整 dp（r7 纪律）

生成 Cocos 探针四件套（128px；格径 30dp 居中，珠面 26dp）：
  bead-tint-128-base.png   Sprite 占位图（shader 已不读 SpriteFrame 纹理）
  bead-tint-128-mask.png   珠 mask，编码 **R=d / G=l / B=形状**（A=255 满幅 ⇒ 免疫 Trim）
  grid-tint-128-base.png   Sprite 占位图
  grid-tint-128-mask.png   格 mask（同编码，B=满幅实底）

编码动机（2026-09-29）：3.x 自定义 effect 里 `cc_spriteTexture` 不被引擎绑定（恒 white）⇒
形状 alpha 必须进 mask 本身 ⇒ B 通道。⇒ 真正「一张 mask × tint 色 = 成品」，SpriteFrame 只剩占位职责。

抗锯齿：512（128×4）栅格化 → LANCZOS 整数 4 倍缩回。光照 = **双场**：bead 用余弦连续函数
（峰=图像左上，替换 conic 四段硬切换的折痕）；grid 用 facet-4 同构亮度场（上 1.0/右 0.74/下 0.37/左 0，
与本体刻面统一）。孔边/外框 1dp；孔缘 0.5dp smoothstep 羽化（消 LANCZOS 振铃杂点）。

USAGE: python3 tools/mask-preview/export-cocos-textures.py
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
OUT_DIR = HERE / "cocos-assets"
OUT = 128
SS = 4
RENDER = OUT * SS               # 512
PX = RENDER / 30.0              # px per dp（layers 为 dp 空间，SIZE=30）

# `[WXG-T-226 WXG-T-232]` 形状通道**去振铃地板**（与 `mask-field.ts` 的 `applyShapeFloor` 同值）。
# LANCZOS 在珠外缘的 0↔255 硬台阶两侧各留 1–4/255 的振铃斑点（实测 x=6 shape=4 / x=121 shape=2）
# ⇒ 落在 B0 底图上成为极淡亮晕，让「亮刻面压格边界」比几何应有值更靠外。
# ⛔ 地板 8/255 只清斑点：真 AA 边实测 128 / 190（远高于 8）⇒ 不碰真边缘。
# ⛔ **两侧（py / TS）必须同值**，否则 `mask:diff` 逐字节门立即红。
SHAPE_RINGING_FLOOR = 8


# 口径（cell-standard-holed + 2026-09-29 调整）
HOLE_DP = 12.0                  # 真透 ⌀12（J4）
HOLE_RING_DP = 1.0              # 孔边宽（复裁 1dp ⇒ 外缘 ⌀14 = J4 原口径）
FRAME_DP = 1.0                  # 珠外框宽（吃珠面 ⇒ 本体 24dp）
LIT_L = 0.38                    # lit 档
DARK_STEP = 0.14                # plate→hole 档差
PLATE_D = 0.56                  # plate 档（−0.44）
BEAD_DP = 26.0
BEAD_CORNER_DP = 8.0
CELL_DP = 30.0

data = json.load(open(HERE / "layers.json"))

C = RENDER / 2
HOLE_R_PX = HOLE_DP / 2 * PX


def light_map():
    """连续受光系数 0..1：余弦，峰 = 图像左上（atan2 坐标 y 向下 ⇒ 峰角 225°）。
    【bead 恢复此版——用户 OK 点的光照】；grid 方向调制用 facet_light（用户拍板槽按 facet）。"""
    ys, xs = np.mgrid[0:RENDER, 0:RENDER]
    return 0.5 + 0.5 * np.cos(np.arctan2(ys - C, xs - C) - math.radians(225))


def facet_light(dx, dy):
    """facet-4 同构亮度场（归一 0..1）：左 0 / 下 0.37 / 右 0.74 / 上 1.0。
    【仅 grid 方向调制用】（用户拍板槽按 facet 角度）。"""
    r = np.sqrt(dx ** 2 + dy ** 2) + 1e-6
    ux, uy = dx / r, dy / r
    up_w = np.clip((-uy - np.abs(ux)) * 2, 0, 1)
    right_w = np.clip((ux - np.abs(uy)) * 2, 0, 1)
    down_w = np.clip((uy - np.abs(ux)) * 2, 0, 1)
    left_w = np.clip(1.0 - up_w - right_w - down_w, 0, 1)
    return 0.37 * down_w + 0.74 * right_w + 1.0 * up_w   # left=0


_ys, _xs = np.mgrid[0:RENDER, 0:RENDER]
_dx_all, _dy_all = _xs - C, _ys - C
LIGHT = light_map()                                      # bead：余弦（OK 点）
LIGHT_FACET = facet_light(_dx_all, _dy_all)              # grid：facet 同构（用户拍板）

# 上扇隶属度（与本体 facet-4 上亮扇形同构：对角线 45° 渐变）——外框受光提亮用它，
# 与本体上亮扇（l=0.38 恒值）衔接无缝；余弦 LIGHT 仍用于背光压暗的连续渐变。
_ys, _xs = np.mgrid[0:RENDER, 0:RENDER]
_up_dy, _up_dx = _ys - C, _xs - C
UP_W = np.clip((-_up_dy / (np.sqrt(_up_dx ** 2 + _up_dy ** 2) + 1e-6)
                - np.abs(_up_dx / (np.sqrt(_up_dx ** 2 + _up_dy ** 2) + 1e-6))) * 2, 0, 1)


def draw_layer(d, layer, fill):
    k = layer["kind"]
    if k == "rect":
        x, y, w, h = (layer["x"] * PX, layer["y"] * PX,
                      layer["w"] * PX, layer["h"] * PX)
        y = RENDER - y - h
        r = layer.get("r", 0) * PX
        if r > 0:
            d.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=fill)
        else:
            d.rectangle([x, y, x + w, y + h], fill=fill)
    elif k == "polygon":
        pts = layer["pts"]
        pts = [pts[i] * PX if i % 2 == 0 else RENDER - pts[i] * PX
               for i in range(len(pts))]
        d.polygon(pts, fill=fill)
    elif k == "circle":
        cx, cy, r = layer["cx"] * PX, layer["cy"] * PX, layer["r"] * PX
        cy = RENDER - cy
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)
    elif k == "line":
        x1, y1, x2, y2 = (layer["x1"] * PX, layer["y1"] * PX,
                          layer["x2"] * PX, layer["y2"] * PX)
        y1, y2 = RENDER - y1, RENDER - y2
        d.line([x1, y1, x2, y2], fill=fill, width=max(1, round(layer.get("lw", 1) * PX)))


def render_mask(layers, shape_b, skip_lines=False):
    """系数图 R=d / G=l / B=形状。B15：跳过 circle（孔 live）。
    skip_lines：跳过 line 层（用户 2026-09-29：槽的 S3 暗线删除，方向感全由内阴影承担）。"""
    rgba = np.zeros((RENDER, RENDER, 4), np.uint8)
    rgba[..., 2] = 255 if shape_b is None else 0
    rgba[..., 3] = 255
    if shape_b is not None:
        rgba[..., 2] = shape_b
    for layer in layers:
        if layer["kind"] == "circle":
            continue
        if skip_lines and layer["kind"] == "line":
            continue
        dv, lv = layer.get("d", 1), layer.get("l", 0)
        m = Image.new("L", (RENDER, RENDER), 0)
        draw_layer(ImageDraw.Draw(m), layer, 255 if dv >= 1 else int(dv * 255))
        sel = np.array(m) > 0
        # **D1 修复（WXG-T-229）**：旧逻辑「`d>=1` 不写 R」+「`d==1 且 l==0` 整层跳过」
        # ⇒ plate 0.56 渗漏，上/左扇实落 0.56（层集应落 1.0）、珠面零纯本色像素。
        # 修 = R/G **无条件双写**（mask 语义 = 该像素**该层**的 (d,l)，不是叠加层）。
        rgba[sel, 0] = int(min(dv, 1.0) * 255)  # R = d
        rgba[sel, 1] = int(min(lv, 1.0) * 255)  # G = l
    return Image.fromarray(rgba, "RGBA")


def paint_b14_ring(img):
    """孔边 1dp 斜面光照（内凹：上内壁背光→hole 档、下内壁受光→lit）。
    ⛔ 孔区不做硬清零：R/G 写环带值的**连续延拓**（孔内 = 环带内缘公式，无 0↔值 硬跳
    ⇒ 免 LANCZOS 振铃红点圈）；孔缘透明度全由 shape 通道的 K_HOLE 羽化承担
    （孔内 alpha=0 不显示，R/G 残值无视觉意义但保证通道连续）。"""
    a = np.array(img)
    ys, xs = np.mgrid[0:RENDER, 0:RENDER]
    dx, dy = xs - C, ys - C
    dist = np.sqrt(dx ** 2 + dy ** 2)
    r_in, r_out = HOLE_R_PX, HOLE_R_PX + HOLE_RING_DP * PX
    ring = (dist >= r_in) & (dist < r_out)
    hole = dist < r_in
    fade = 1.0 - np.clip((dist - r_in) / (r_out - r_in), 0, 1)   # 真透侧强 → 珠面侧弱
    d_val = PLATE_D - DARK_STEP * LIGHT * fade   # 上内壁压向 hole 档
    l_val = LIT_L * (1.0 - LIGHT) * fade         # 下内壁提亮
    # 孔内：环带内缘公式的延拓（fade=1），三通道连续 ⇒ 零振铃
    d_hole = PLATE_D - DARK_STEP * LIGHT
    l_hole = LIT_L * (1.0 - LIGHT)
    a[..., 0][ring] = (np.clip(d_val, 0, 1)[ring] * 255).astype(np.uint8)
    a[..., 1][ring] = (np.clip(l_val, 0, 1)[ring] * 255).astype(np.uint8)
    a[..., 0][hole] = (np.clip(d_hole, 0, 1)[hole] * 255).astype(np.uint8)
    a[..., 1][hole] = (np.clip(l_hole, 0, 1)[hole] * 255).astype(np.uint8)
    return Image.fromarray(a, "RGBA")


def paint_frame_light(img):
    """珠外框 1dp 斜面光照（外凸：上/左受光 lit、下/右背光 hole），沿珠轮廓圆角方。
    t：内缘（贴本体）0.35 → 外缘（珠轮廓棱）1.0。"""
    a = np.array(img)
    ring_m = Image.new("L", (RENDER, RENDER), 0)
    dr = ImageDraw.Draw(ring_m)
    o0, o1 = (CELL_DP - BEAD_DP) / 2 * PX, (CELL_DP + BEAD_DP) / 2 * PX
    w = FRAME_DP * PX
    dr.rounded_rectangle([o0, o0, o1, o1], radius=BEAD_CORNER_DP * PX, fill=255)
    dr.rounded_rectangle([o0 + w, o0 + w, o1 - w, o1 - w],
                         radius=max(0, BEAD_CORNER_DP * PX - w), fill=0)
    ring = np.array(ring_m) > 0
    inner_m = Image.new("L", (RENDER, RENDER), 0)
    ImageDraw.Draw(inner_m).rounded_rectangle([o0 + w, o0 + w, o1 - w, o1 - w],
                                              radius=max(0, BEAD_CORNER_DP * PX - w), fill=255)
    inside = np.array(inner_m) > 0
    t = np.where(ring, np.where(inside, 0.35, 1.0), 0.0)   # 内缘 0.35 → 外缘 1.0 斜面
    # **WXG-T-229「甲」外框斜率**：旧式 = 对称余弦（`LIGHT` 峰在左上 ⇒ 上=左）+ 受光靠 `l`
    # ⇒ 亮色珠外框只有「上左亮 / 右下暗」两档、方向丢失（实测奶白 上137.3 / 左135.5）。
    # 改按四扇权重给**单调斜率**：上 0.70 / 左 0.63 / 右 0.52 / 下 0.42（跨度 0.28，外缘 −0.10·t）。
    _r = np.sqrt(_up_dx ** 2 + _up_dy ** 2) + 1e-6
    _ux, _uy = _up_dx / _r, _up_dy / _r
    _left_w = np.clip((-_ux - np.abs(_uy)) * 2, 0, 1)
    _right_w = np.clip((_ux - np.abs(_uy)) * 2, 0, 1)
    _side_d = 0.42 + 0.28 * (1.0 * UP_W + 0.75 * _left_w + 0.35 * _right_w)
    d_val = _side_d - 0.10 * t                              # 外缘略暗（保留斜面方向）
    # 受光提亮用上扇隶属 UP_W（与本体上亮扇同构）：上段恒 0.38 与本体无缝，
    # ⛔ 不用余弦 LIGHT（正上只有 0.85 ⇒ 与本体 0.38 差 0.06 = 接缝台阶）
    l_val = LIT_L * UP_W
    a[..., 0][ring] = (np.clip(d_val, 0, 1)[ring] * 255).astype(np.uint8)
    a[..., 1][ring] = (np.clip(l_val, 0, 1)[ring] * 255).astype(np.uint8)
    return Image.fromarray(a, "RGBA")


# ---------- 珠形 B 通道（圆角方 − 孔真透，孔缘 0.5dp smoothstep 羽化） ----------
# ⚠ 孔缘必须羽化：B 通道 255→0 硬跳经 LANCZOS 会振铃 ⇒ 孔缘一圈像素杂质（2026-09-29 实测）。
# 外框/刻面无此问题（B 恒 255，只有 R/G 变化）。羽化语义：孔缘 alpha 渐出 = 抗锯齿，真透 ⌀12 名义不变。
shape = np.zeros((RENDER, RENDER), np.uint8)
si = Image.fromarray(shape)   # ⚠ fromarray 会拷贝缓冲 ⇒ 必须持有 si 并从它取回，画在临时 Image 上会全丢
sd = ImageDraw.Draw(si)
o0, o1 = (CELL_DP - BEAD_DP) / 2 * PX, (CELL_DP + BEAD_DP) / 2 * PX
sd.rounded_rectangle([o0, o0, o1, o1], radius=BEAD_CORNER_DP * PX, fill=255)
# 孔缘羽化：K = smoothstep(r_in − f, r_in + f, dist)
# ⚠ `f = 0.5dp → 0.25dp`（WXG-T-232，2026-10-03 用户裁「甲」）：原值与 LANCZOS 振铃**叠加**，
# 实测过渡带 **7px ≈ 1.64dp**（标称 0.5dp = 2.1px）且把全透区侵蚀到 ⌀≈10.5dp（标称 12dp）。
# ⛔ **物理孔径未动**（`HOLE_DP = 12` 不变；50% 交点仍在 r=25.6px）。
feather = 0.25 * PX
ys, xs = np.mgrid[0:RENDER, 0:RENDER]
dist_h = np.sqrt((xs - C) ** 2 + (ys - C) ** 2)
K_HOLE = np.clip((dist_h - (HOLE_R_PX - feather)) / (2 * feather), 0, 1)
K_HOLE = K_HOLE * K_HOLE * (3 - 2 * K_HOLE)   # smoothstep
si_np = np.array(si).astype(np.float32) * K_HOLE
shape_b = si_np.astype(np.uint8)

# ---------- 1/2. bead mask + base（base 仅 Sprite 占位） ----------
# （2026-09-29 回退：上一轮误将"槽的暗条删除+亮面"应用到 bead 侧 ⇒ 恢复 facet 刻面直读版。
#   槽侧的正确改动保留在 grid 分支。）
bead_mask = paint_frame_light(paint_b14_ring(render_mask(data["beadLayers"], shape_b)))
# 占位图：RGB=白、A=shape_b（与 mask B 通道**逐像素相等**——同一 K_HOLE 场，语义零歧义）
_bbase = np.zeros((RENDER, RENDER, 4), np.uint8)
_bbase[..., 0:3] = 255
_bbase[..., 3] = shape_b
bead_base = Image.fromarray(_bbase, "RGBA")

# ---------- 3/4. grid mask + base ----------
# 用户 2026-09-29 拍板：**槽口轮廓 = 珠面轮廓（26dp 圆角方、角 8dp）**；
# 槽内边沿 **3dp 深度斜面**（内凹：上内壁暗→hole 档 0.42、下内壁亮→本色 0.70，内缘渐入槽底）
# ⇒ 深度感 + 光照清晰；槽底（斜面以内）= −0.44 纯色（0.56）；格外（槽口外）= −0.30 纯色（0.70）。
# S3/S4/内阴影阶梯全部退役（cellLayers 直读退役——槽视觉完全程序化）。
EDGE_DP = 3.0                                                  # 槽内边沿斜面深度（dp）
gm = np.zeros((RENDER, RENDER, 4), np.uint8)
gm[..., 0] = int(0.70 * 255)                                   # 格外圈：−0.30 纯色
gm[..., 2] = 255
gm[..., 3] = 255                                               # ⚠ A=255（漏设则 PNG 全透明）
ys_g, xs_g = np.mgrid[0:RENDER, 0:RENDER]
dxg, dyg = xs_g - C, ys_g - C
rg = np.sqrt(dxg ** 2 + dyg ** 2) + 1e-6
uxg, uyg = dxg / rg, dyg / rg
down_w = np.clip((uyg - np.abs(uxg)) * 2, 0, 1)                # 下壁隶属（受光）
# 槽口 SDF（half 12dp、角 8dp = 珠面轮廓内缩 1dp）：sd=0 槽口棱、负=向槽内。
# ⛔ 内缩 1dp（用户 2026-09-29）：珠 26dp（half 13dp）盖上后槽棱藏于珠下 ⇒ 不漏槽沿。
q_x, q_y = np.abs(dxg) - (12.0 - 8.0) * PX, np.abs(dyg) - (12.0 - 8.0) * PX
sd_g = (np.hypot(np.clip(q_x, 0, None), np.clip(q_y, 0, None))
        + np.minimum(np.maximum(q_x, q_y), 0) - 8.0 * PX)
edge_g = (sd_g >= -EDGE_DP * PX) & (sd_g <= 0)                 # 槽内边沿 3dp 斜面
t_in = np.clip(-sd_g / (EDGE_DP * PX), 0, 1)                   # 0=槽口棱 → 1=贴槽底
# 斜面光照：受光侧（仅下内壁）→ 本色 0.70 亮；背光侧（**上+左+右**，用户 2026-09-29
# "左右与上边沿深色一致"）→ −0.68 档 0.32 暗。背光权重 = clip(1−uyg)：上/左右=1、下=0。
d_edge = 0.70 - 0.38 * np.clip(1.0 - uyg, 0, 1)
d_val = d_edge + (0.70 - d_edge) * t_in                        # 内缘渐入槽底 0.70（=格底色）
l_val = LIT_L * down_w * (1.0 - t_in)                          # 下壁受光提亮（棱最强）
gm[..., 0][edge_g] = (np.clip(d_val, 0, 1)[edge_g] * 255).astype(np.uint8)
gm[..., 1][edge_g] = (np.clip(l_val, 0, 1)[edge_g] * 255).astype(np.uint8)
# 槽底（斜面以内）= **格底色 0.70**（−0.30，同 B0 tile；设计变更 v1.0→v1.1，用户 2026-09-29：
# 「取放珠瞬间深坑↔格底跳变突兀 + 深坑挡目标色辨识」⇒ 槽凹感全交给 3dp 斜面光照，坑底与格底同色）
gm[..., 0][sd_g < -EDGE_DP * PX] = int(0.70 * 255)
grid_mask = Image.fromarray(gm, "RGBA")
grid_base = Image.new("RGBA", (RENDER, RENDER), (255, 255, 255, 255))

OUT_DIR.mkdir(exist_ok=True)
for name, img in (
    ("bead-tint-128-base.png", bead_base),
    ("bead-tint-128-mask.png", bead_mask),
    ("grid-tint-128-base.png", grid_base),
    ("grid-tint-128-mask.png", grid_mask),
):
    img = img.resize((OUT, OUT), Image.LANCZOS)   # ÷4 整数比 LANCZOS ⇒ 边缘平滑（勿改非整数比）
    # 形状通道 = mask 的 B / base 的 A（头注明文「base.A ≡ mask.B 逐像素相等」）⇒
    # **两侧都要施加地板**，否则去振铃会让这两个通道首次出现差异（2026-10-03 提交前自查抓到）。
    ch = 2 if "mask" in name else 3
    arr = np.array(img, dtype=np.uint8).copy()
    arr[:, :, ch] = np.where(arr[:, :, ch] < SHAPE_RINGING_FLOOR, 0, arr[:, :, ch])
    img = Image.fromarray(arr, "RGBA")
    img.save(OUT_DIR / name)
    print(f"✅ {OUT_DIR / name}")
print(f"编码 R=d / G=l / B=shape（A=255 免疫 Trim）· 光照=facet-4 同构亮度场（上1.0/右0.74/下0.37/左0，"
      f"与本体刻面统一）· 真透 ⌀{HOLE_DP} · 孔边/外框 {HOLE_RING_DP}dp · 外缘 ⌀{HOLE_DP + 2*HOLE_RING_DP} · "
      f"珠面 {BEAD_DP}dp（含框，本体 {BEAD_DP - 2*FRAME_DP:.0f}dp）· 格径 {CELL_DP:.0f}dp")
