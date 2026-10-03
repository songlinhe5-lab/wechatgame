#!/usr/bin/env python3
"""
════════════════════════════════════════════════════════════════════════
 无孔档 tint mask 烘焙纹理 —— v1.0-holeless（2026-09-29，以有孔定稿 v1.0 为模板；
 ⚠ 有孔档 v1.1 的「槽底→格底色」变更**不适用本档**——无孔珠不透底，坑底 0.32 深度感保留）
════════════════════════════════════════════════════════════════════════
 口径真源 = cell-standard-holeless.md（inset 3 ⇒ 珠面 24dp、角 7dp、无孔）；
 层数据真源 = `capture-layers.mjs --holeless` → layers-holeless.json（DEC-4 同源直读）。
 ⛔ 定稿后改参数 = 变更设计口径，须登记 memory/TASKS 并同步 GDD §7 / cell-standard-holeless。

【与有孔定稿 v1.0 的差异（其余逐段同构）】
 珠（bead，**24dp** 圆角方、角 **7dp** = round(24×0.30)）：
   - ⛔ **无孔**：无真透 ⌀12、无 B14 孔边线环、无孔缘羽化（J4 不适用本档）
   - 外描边 1dp（同有孔外框）· 本体 22dp · plate 0.56 · 刻面四向渐变（直读 24dp 层集）· lit 0.38
   - 底透全由目标色环承担（环宽 4dp）——mask 侧体现为形状外 4dp 透明
 格（grid，格径 30dp）：
   - 槽口 **22dp**（= 珠面 24 − 2×1dp，沿 v1.0「内缩 1dp 防漏」拍板同构）、角 7dp
   - ⚠ 文档钉「坑外廓 24dp = 珠面外沿对齐」（live 渲染口径）；烘焙纹理沿用 v1.0 防漏原则
     ⇒ 22dp。若 Cocos 叠放实测无漏沿，可改 SLOT_HALF_DP 回 24 对齐文档。
   - 槽内边沿 3dp 斜面（背光上+左+右 0.32 / 受光下 0.70+lit）· 坑底 0.32 · 格外 0.70（同 v1.0）
 通用：mask 编码 R=d / G=l / B=形状（A=255 免疫 Trim）· 512→LANCZOS×4→128 · r7 取整 dp 纪律

USAGE:
  node --import tools/mask-preview/reg.mjs tools/mask-preview/capture-layers.mjs --holeless
  python3 tools/mask-preview/export-cocos-textures-holeless.py
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

# `[WXG-T-226 WXG-T-232]` 形状通道**去振铃地板**（与有孔档 / `mask-field.ts` 同值）。
# 无孔档无孔缘羽化，但珠外缘同样是 0↔255 硬台阶 ⇒ LANCZOS 振铃同样会留斑点。
SHAPE_RINGING_FLOOR = 8


# 口径（cell-standard-holeless + v1.0 防漏同构）
FRAME_DP = 1.0                  # 珠外描边宽（同有孔外框）
LIT_L = 0.38                    # lit 档
DARK_STEP = 0.14                # plate→hole 档差
PLATE_D = 0.56                  # plate 档（−0.44）
BEAD_DP = 24.0                  # 珠面（轮廓边长，含外描边环；30 − 2×inset_small）
BEAD_CORNER_DP = 7.0            # round(24×0.30) = 7（r7 取整纪律）
CELL_DP = 30.0
SLOT_HALF_DP = 11.0             # 槽口半宽：22dp = 珠面 24 − 2×1（防漏同构，见头注）
SLOT_CORNER_DP = 7.0            # 槽角 = 珠角（轮廓同构）

data = json.load(open(HERE / "layers-holeless.json"))

C = RENDER / 2


def light_map():
    """连续受光系数 0..1：余弦，峰 = 图像左上。bead 用（同 v1.0 OK 点版）。"""
    ys, xs = np.mgrid[0:RENDER, 0:RENDER]
    return 0.5 + 0.5 * np.cos(np.arctan2(ys - C, xs - C) - math.radians(225))


def facet_light(dx, dy):
    """facet-4 同构亮度场：左 0 / 下 0.37 / 右 0.74 / 上 1.0。grid 用（同 v1.0）。"""
    r = np.sqrt(dx ** 2 + dy ** 2) + 1e-6
    ux, uy = dx / r, dy / r
    up_w = np.clip((-uy - np.abs(ux)) * 2, 0, 1)
    right_w = np.clip((ux - np.abs(uy)) * 2, 0, 1)
    down_w = np.clip((uy - np.abs(ux)) * 2, 0, 1)
    return 0.37 * down_w + 0.74 * right_w + 1.0 * up_w   # left=0


_ys, _xs = np.mgrid[0:RENDER, 0:RENDER]
_dx_all, _dy_all = _xs - C, _ys - C
LIGHT = light_map()

# 上扇隶属度（与本体 facet-4 上亮扇形同构）——外框受光提亮用（同 v1.0）。
UP_W = np.clip((-_dy_all / (np.sqrt(_dx_all ** 2 + _dy_all ** 2) + 1e-6)
                - np.abs(_dx_all / (np.sqrt(_dx_all ** 2 + _dy_all ** 2) + 1e-6))) * 2, 0, 1)


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


def render_mask(layers, shape_b):
    """系数图 R=d / G=l / B=形状（同 v1.0；无孔 capture 无 circle 层）。"""
    rgba = np.zeros((RENDER, RENDER, 4), np.uint8)
    rgba[..., 2] = 255 if shape_b is None else 0
    rgba[..., 3] = 255
    if shape_b is not None:
        rgba[..., 2] = shape_b
    for layer in layers:
        if layer["kind"] == "circle":
            continue
        dv, lv = layer.get("d", 1), layer.get("l", 0)
        m = Image.new("L", (RENDER, RENDER), 0)
        draw_layer(ImageDraw.Draw(m), layer, 255 if dv >= 1 else int(dv * 255))
        sel = np.array(m) > 0
        # **D1 修复（WXG-T-229）**：同有孔档——旧逻辑「`d>=1` 不写 R」+「`d==1 且 l==0` 整层跳过」
        # ⇒ plate 0.56 渗漏。修 = R/G **无条件双写**。
        rgba[sel, 0] = int(min(dv, 1.0) * 255)  # R = d
        rgba[sel, 1] = int(min(lv, 1.0) * 255)  # G = l
    return Image.fromarray(rgba, "RGBA")


def paint_frame_light(img):
    """珠外框 1dp 斜面光照（同 v1.0：上/左受光 lit、下/右背光 hole，沿珠轮廓圆角方）。"""
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
    # **WXG-T-229「甲」外框斜率**（同有孔档）：旧对称余弦 ⇒ 亮色珠外框上=左、无方向；
    # 改按四扇权重单调斜率：上 0.70 / 左 0.63 / 右 0.52 / 下 0.42（跨度 0.28，外缘 −0.10·t）。
    _r = np.sqrt(_dx_all ** 2 + _dy_all ** 2) + 1e-6
    _ux, _uy = _dx_all / _r, _dy_all / _r
    _left_w = np.clip((-_ux - np.abs(_uy)) * 2, 0, 1)
    _right_w = np.clip((_ux - np.abs(_uy)) * 2, 0, 1)
    _side_d = 0.42 + 0.28 * (1.0 * UP_W + 0.75 * _left_w + 0.35 * _right_w)
    d_val = _side_d - 0.10 * t                              # 外缘略暗（保留斜面方向）
    l_val = LIT_L * UP_W                                    # 受光提亮（上扇同构，无缝）
    a[..., 0][ring] = (np.clip(d_val, 0, 1)[ring] * 255).astype(np.uint8)
    a[..., 1][ring] = (np.clip(l_val, 0, 1)[ring] * 255).astype(np.uint8)
    return Image.fromarray(a, "RGBA")


# ---------- 珠形 B 通道（24dp 圆角方满幅；⛔ 无孔 ⇒ 无孔缘羽化段） ----------
shape = np.zeros((RENDER, RENDER), np.uint8)
si = Image.fromarray(shape)   # ⚠ fromarray 会拷贝缓冲 ⇒ 必须持有 si 并从它取回
sd = ImageDraw.Draw(si)
o0, o1 = (CELL_DP - BEAD_DP) / 2 * PX, (CELL_DP + BEAD_DP) / 2 * PX
sd.rounded_rectangle([o0, o0, o1, o1], radius=BEAD_CORNER_DP * PX, fill=255)
shape_b = np.array(si)

# ---------- 1/2. bead mask + base（base 仅 Sprite 占位） ----------
bead_mask = paint_frame_light(render_mask(data["beadLayers"], shape_b))
_bbase = np.zeros((RENDER, RENDER, 4), np.uint8)
_bbase[..., 0:3] = 255
_bbase[..., 3] = shape_b

# ---------- 3/4. grid mask + base（程序化槽，同 v1.0 结构；尺寸按无孔档） ----------
EDGE_DP = 3.0                                                  # 槽内边沿斜面深度（dp）
gm = np.zeros((RENDER, RENDER, 4), np.uint8)
gm[..., 0] = int(0.70 * 255)                                   # 格外圈：−0.30 纯色
gm[..., 2] = 0                                                 # [WXG-T-237 v7.0] 格外 shape=0 ⇒ **透明**
gm[..., 3] = 255                                               # ⚠ A=255（漏设则 PNG 全透明）
ys_g, xs_g = np.mgrid[0:RENDER, 0:RENDER]
dxg, dyg = xs_g - C, ys_g - C
rg = np.sqrt(dxg ** 2 + dyg ** 2) + 1e-6
uxg, uyg = dxg / rg, dyg / rg
down_w = np.clip((uyg - np.abs(uxg)) * 2, 0, 1)                # 下壁隶属（受光）
# 槽口 SDF（half 11dp、角 7dp = 珠面 24 内缩 1dp 防漏，v1.0 同构）：sd=0 槽口棱、负=向槽内
q_x, q_y = np.abs(dxg) - (SLOT_HALF_DP - SLOT_CORNER_DP) * PX, np.abs(dyg) - (SLOT_HALF_DP - SLOT_CORNER_DP) * PX
sd_g = (np.hypot(np.clip(q_x, 0, None), np.clip(q_y, 0, None))
        + np.minimum(np.maximum(q_x, q_y), 0) - SLOT_CORNER_DP * PX)
edge_g = (sd_g >= -EDGE_DP * PX) & (sd_g <= 0)                 # 槽内边沿 3dp 斜面
t_in = np.clip(-sd_g / (EDGE_DP * PX), 0, 1)                   # 0=槽口棱 → 1=贴槽底
# 斜面光照（同 v1.0）：受光=仅下内壁 0.70 亮；背光=上+左+右 0.32 暗
d_edge = 0.70 - 0.38 * np.clip(1.0 - uyg, 0, 1)
d_val = d_edge + (0.32 - d_edge) * t_in                        # 内缘渐入槽底 0.32
l_val = LIT_L * down_w * (1.0 - t_in)                          # 下壁受光提亮（棱最强）
gm[..., 0][edge_g] = (np.clip(d_val, 0, 1)[edge_g] * 255).astype(np.uint8)
gm[..., 1][edge_g] = (np.clip(l_val, 0, 1)[edge_g] * 255).astype(np.uint8)
gm[..., 2][edge_g] = 255                                           # 槽内 3dp 斜面：shape 满幅
# 槽底（斜面以内）= −0.68 纯色（0.32）。⚠ **本档不跟随有孔档 v1.1 的「槽底→格底色」变更**
#（用户 2026-09-29）：无孔珠**不透底**，「孔透坑底死黑」问题在本档不存在 ⇒ 深坑深度感保留。
gm[..., 0][sd_g < -EDGE_DP * PX] = int(0.32 * 255)
gm[..., 2][sd_g < -EDGE_DP * PX] = 255                             # 槽底：shape 满幅（⛔ holeless 深坑 0.32 必须保住 ⇒ I-5 分叉）
grid_mask = Image.fromarray(gm, "RGBA")

OUT_DIR.mkdir(exist_ok=True)
for name, img in (
    ("bead-holeless-tint-128-mask.png", bead_mask),
    ("grid-holeless-tint-128-mask.png", grid_mask),
):
    img = img.resize((OUT, OUT), Image.LANCZOS)   # ÷4 整数比 LANCZOS ⇒ 边缘平滑（勿改非整数比）
    # 形状通道 = mask 的 B / base 的 A（头注明文「base.A ≡ mask.B 逐像素相等」）⇒
    # **两侧都要施加地板**，否则去振铃会让这两个通道首次出现差异（2026-10-03 提交前自查抓到）。
    ch = 2 if "mask" in name else 3
    arr = np.array(img, dtype=np.uint8).copy()
    arr[:, :, ch] = np.where(arr[:, :, ch] < SHAPE_RINGING_FLOOR, 0, arr[:, :, ch])
    # [WXG-T-237 v7.0] **格面 mask 的 B(shape) 在 128 空间直接判定**（不经 LANCZOS 缩放）。
    # 理由：v7.0 让格外 shape=0 ⇒ 0↔255 硬台阶长达一整圈，而 **PIL 的 LANCZOS 与 TS 侧自实现
    # LANCZOS 对硬边的振铃幅度不同**（实测残留 1–9/255）⇒ 单靠 `SHAPE_RINGING_FLOOR` 无法让
    # 两边逐字节一致（对拍门禁 `mask-diff.test.ts` 会红）。治根 = 不缩放：形状本就是二值语义，
    # 无需抗锯齿（AA 由 R/G 的斜面光照承担）。⛔ 槽口内（3dp 斜面 + 槽底）仍 255 —— 无孔档槽底
    # 0.32 深坑必须保住（判据 I-5 分叉）。
    if "grid" in name and "mask" in name:
        ys8, xs8 = np.mgrid[0:OUT, 0:OUT]
        pxs = OUT / CELL_DP
        dx8, dy8 = xs8 - OUT / 2, ys8 - OUT / 2
        # ⚠ 用**本档自身**的槽口参数（无孔档 22dp/角 7dp，⛔ 不可硬编码有孔档的 12/8 —— 那会让
        # shape 平面比槽口大 1dp ⇒ 与 TS 侧 `spec.slotHalfDp/slotCornerDp` 不一致 ⇒ 对拍门禁红）。
        qx8 = np.abs(dx8) - (SLOT_HALF_DP - SLOT_CORNER_DP) * pxs
        qy8 = np.abs(dy8) - (SLOT_HALF_DP - SLOT_CORNER_DP) * pxs
        sd8 = (np.hypot(np.clip(qx8, 0, None), np.clip(qy8, 0, None))
               + np.minimum(np.maximum(qx8, qy8), 0) - SLOT_CORNER_DP * pxs)
        arr[:, :, 2] = np.where(sd8 <= 0, 255, 0).astype(np.uint8)
    img = Image.fromarray(arr, "RGBA")
    img.save(OUT_DIR / name)
    print(f"✅ {OUT_DIR / name}")
print(f"无孔档 v1.0：编码 R=d/G=l/B=shape · 珠面 {BEAD_DP:.0f}dp（含框，本体 {BEAD_DP - 2*FRAME_DP:.0f}dp）· "
      f"角 {BEAD_CORNER_DP:.0f}dp · ⛔无孔（J4 不适用）· 槽口 {SLOT_HALF_DP*2:.0f}dp（防漏同构）· 格径 {CELL_DP:.0f}dp")
