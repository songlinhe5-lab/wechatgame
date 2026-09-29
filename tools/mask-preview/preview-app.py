#!/usr/bin/env python3
"""
Streamlit 实时预览工具：调孔口内阴影参数，秒级看 mask + 合成效果。

**固化说明（2026-09-28，自 temp/tint-mask-export 收编至 tools/mask-preview/）**：
- 参数默认值与判读口径对齐 **tint-probe 终版（V4 修正版，`hole-seam-v2.mjs`）**：
  三段径向（孔底 0.56 → 中段最深 0.42 → 外端 0.70=最暗珠面档）+ 单 conic 四方向定标
  （右 0.47 / 下 0 / 左 1.0 / 上 1.0）+ 径向 α 掩膜（0.55 前不提亮、0.85 满标）。
  ⛔ 亮侧方向（现 = 上/左亮）与槽「暗上亮下」（TC-SKT-01）相反，**待用户拍板**后改 stops 即可。
- 对齐 r8：槽内阴影 4 层由 `layers.json` 的 cellLayers 直读（capture-layers.mjs 已修字典，
  旧版漏 −0.58/−0.68/−0.80 三档 ⇒ 内阴影在预览里整段塌成不压暗）；S3/S4 明暗线照画。
- B15：珠面孔（pit 圆 + 边线环）**不入 mask**（build_mask 跳过 circle），合成后叠孔底 pit。
- 已修：mask 写入的二次 y 翻转 bug（d/l 两路不一致的那版表达式删除；draw_layer 已做 y_flip，
  mask 即图像坐标，直接按 mask>0 写入）。

USAGE:
  pip install streamlit numpy pillow   # 首次
  node --import tools/mask-preview/reg.mjs tools/mask-preview/capture-layers.mjs  # 改珠面/格面代码后重跑（--import 注册 resolve hook：根 node_modules 无 @wxgame/framework）
  streamlit run tools/mask-preview/preview-app.py
"""
import json
import math
from pathlib import Path

import numpy as np
import streamlit as st
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
LAYERS_FILE = HERE / "layers.json"


@st.cache_data
def load_layers():
    with open(LAYERS_FILE) as f:
        return json.load(f)


def hex_mix_dark(hex_color: str, k: float) -> str:
    """与 palette.mix 同式（向黑混 k）。"""
    v = [int(hex_color[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(round(c + (0 - c) * k).__format__("02x") for c in v)


def draw_layer(img_draw, layer, size, fill, y_flip=True):
    """画单个层（rect/polygon/circle/line），fill 由调用方给（灰度 d 或 α）。"""
    if layer["kind"] == "rect":
        x, y, w, h = layer["x"], layer["y"], layer["w"], layer["h"]
        if y_flip:
            y = size - y - h
        r = layer.get("r", 0)
        if r > 0:
            img_draw.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=fill)
        else:
            img_draw.rectangle([x, y, x + w, y + h], fill=fill)
    elif layer["kind"] == "polygon":
        pts = layer["pts"]
        if y_flip:
            pts = [pts[i] if i % 2 == 0 else size - pts[i] for i in range(len(pts))]
        img_draw.polygon(pts, fill=fill)
    elif layer["kind"] == "circle":
        cx, cy, r = layer["cx"], layer["cy"], layer["r"]
        if y_flip:
            cy = size - cy
        img_draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)
    elif layer["kind"] == "line":
        x1, y1, x2, y2 = layer["x1"], layer["y1"], layer["x2"], layer["y2"]
        if y_flip:
            y1, y2 = size - y1, size - y2
        img_draw.line([x1, y1, x2, y2], fill=fill, width=max(1, int(round(layer.get("lw", 1)))))


def build_mask(layers, size, hole_r, with_v3_ring, v3_params, is_bead: bool):
    """构建系数 mask（RGB=d, A=l）。图像坐标（draw_layer 已做 y_flip ⇒ 直接按 mask>0 写入）。"""
    rgba = np.zeros((size, size, 4), dtype=np.uint8)  # RGB/A 全 0 ⇒ 未覆盖区 = 中性（d=1,l=0）

    for layer in layers:
        # B15：孔族 live 不入 mask（珠面的 pit 圆 + 孔边线环；facet-4 珠面无其它 circle）。
        if is_bead and layer["kind"] == "circle":
            continue

        mask = Image.new("L", (size, size), 0)
        mask_draw = ImageDraw.Draw(mask)

        d_val = layer.get("d", 1)
        l_val = layer.get("l", 0)
        if d_val < 1:
            draw_layer(mask_draw, layer, size, int(round(d_val * 255)))
        elif l_val > 0:
            draw_layer(mask_draw, layer, size, 255)  # 纯亮层：形状参与 A 写入
        else:
            continue  # d=1,l=0 ⇒ 中性层，不写 mask

        m = np.array(mask) > 0
        if d_val < 1:
            rgba[m, :3] = int(round(d_val * 255))
        if l_val > 0:
            rgba[m, 3] = int(round(l_val * 255))

    # 孔口内阴影环（V4 修正版：三段径向 + 单 conic 四方向定标 + 径向 α 掩膜）
    if with_v3_ring:
        cx, cy = size // 2, size // 2
        r_inner = hole_r
        r_outer = hole_r + v3_params["ring_width"]

        d_core = v3_params["d_core"]
        d_deep = v3_params["d_deep"]
        d_face_outer = v3_params["d_face_outer"]
        lmax = v3_params["lmax"]

        ys, xs = np.mgrid[0:size, 0:size]
        dx = xs - cx
        dy = ys - cy
        dist = np.sqrt(dx ** 2 + dy ** 2)
        in_ring = (dist >= r_inner) & (dist <= r_outer)

        t = np.clip((dist - r_inner) / (r_outer - r_inner), 0, 1)
        # 三段径向：内端收敛孔底(d_core) → 0.45 处最深(d_deep) → 外端(d_face_outer)
        d_rad = np.where(t < 0.45,
                         d_core + (d_deep - d_core) * (t / 0.45),
                         d_deep + (d_face_outer - d_deep) * ((t - 0.45) / 0.55))
        # conic 四方向定标（与 canvas createConicGradient(0=右,顺时针) 同映射：0.25=下、0.5=左、0.75=上）
        angle = (np.arctan2(dy, dx) / (2 * np.pi) + 1) % 1
        c = np.where(angle < 0.25, 0.47 + (0 - 0.47) * (angle / 0.25),
                     np.where(angle < 0.5, (angle - 0.25) / 0.25,
                              np.where(angle < 0.75, 1.0,
                                       1.0 + (0.47 - 1.0) * ((angle - 0.75) / 0.25))))
        # 径向 α 掩膜（0.55 前不提亮、0.85 满标）
        alpha_mask = np.clip((t - 0.55) / 0.30, 0, 1)

        rgba[in_ring, :3] = (d_rad[in_ring] * 255).astype(np.uint8)
        rgba[in_ring, 3] = (c[in_ring] * alpha_mask[in_ring] * lmax * 255).astype(np.uint8)

    return rgba


def blend(mask_rgba, base_rgb):
    """合成：out = base·d + (1−base)·l（ADR-0028 §2.1）。"""
    d = mask_rgba[..., :3].astype(np.float32) / 255.0
    l = mask_rgba[..., 3:4].astype(np.float32) / 255.0
    b = np.array(base_rgb, dtype=np.float32) / 255.0
    out = b * d + (1.0 - b) * l
    return np.clip(out * 255, 0, 255).astype(np.uint8)


def overlay_pit(blend_img, hole_r, base_hex, size):
    """孔底 pit（live 层，不入 mask）——对齐 tint-probe 的收尾 pit 实色圆。"""
    pit_hex = hex_mix_dark(base_hex, 0.44)
    pit = tuple(int(pit_hex[i:i + 2], 16) for i in (1, 3, 5))
    img = Image.fromarray(blend_img, "RGB")
    draw = ImageDraw.Draw(img)
    cx = cy = size // 2
    draw.ellipse([cx - hole_r, cy - hole_r, cx + hole_r, cy + hole_r], fill=pit)
    return np.array(img)


def main():
    st.set_page_config(layout="wide", page_title="Tint Mask Preview")
    st.title("🎨 Tint Mask 实时预览（V4 修正版 · 对齐 tint-probe 终口径）")
    st.caption("孔底 pit + 三段内阴影 + conic 方向调制；槽侧含 r8 内阴影 4 层与 S3/S4 明暗线。"
               "亮侧方向（现 = 上/左）与槽「暗上亮下」相反，待拍板后改 conic stops 即可。")

    data = load_layers()
    size = data["SIZE"]
    hole_r = data["HOLE_R"]

    st.sidebar.header("孔口内阴影参数（V4 修正版）")
    with_v3_ring = st.sidebar.checkbox("启用孔口环", value=True)

    col1, col2 = st.sidebar.columns(2)
    with col1:
        d_core = st.slider("D_CORE (孔底 pit)", 0.0, 1.0, 0.56, 0.01)
        d_deep = st.slider("D_DEEP (最深)", 0.0, 1.0, 0.42, 0.01)
    with col2:
        d_face_outer = st.slider("D_FACE_OUTER (外端)", 0.0, 1.0, 0.70, 0.01)
        lmax = st.slider("LMAX (最亮)", 0.0, 1.0, 1.0, 0.01)

    ring_width = st.sidebar.slider("环宽 (texel)", 1, 8, 4, 1)

    v3_params = {
        "d_core": d_core,
        "d_deep": d_deep,
        "d_face_outer": d_face_outer,
        "lmax": lmax,
        "ring_width": ring_width,
    }

    st.sidebar.header("Base 色")
    color_preset = st.sidebar.selectbox("预设", ["RED #d9534f", "BLUE #5bc0de", "GREEN #5cb85c", "自定义"])
    if color_preset == "RED #d9534f":
        base_rgb = [217, 83, 79]
        base_hex = "#d9534f"
    elif color_preset == "BLUE #5bc0de":
        base_rgb = [91, 192, 222]
        base_hex = "#5bc0de"
    elif color_preset == "GREEN #5cb85c":
        base_rgb = [92, 184, 92]
        base_hex = "#5cb85c"
    else:
        col1, col2, col3 = st.sidebar.columns(3)
        with col1:
            r = st.slider("R", 0, 255, 128)
        with col2:
            g = st.slider("G", 0, 255, 128)
        with col3:
            b = st.slider("B", 0, 255, 128)
        base_rgb = [r, g, b]
        base_hex = "#%02x%02x%02x" % (r, g, b)

    st.sidebar.header("显示")
    show_mask = st.sidebar.checkbox("显示 Mask 本身", value=True)
    scale = st.sidebar.slider("放大倍数", 1, 8, 4, 1)

    # 构建 mask（bead 侧跳过孔族 circle = B15；cell 侧含 r8 内阴影 4 层 + S3/S4 线）
    bead_mask = build_mask(data["beadLayers"], size, hole_r, with_v3_ring, v3_params, is_bead=True)
    cell_mask = build_mask(data["cellLayers"], size, hole_r, False, v3_params, is_bead=False)

    # 合成 + 孔底 pit 叠加（live）
    bead_blend = overlay_pit(blend(bead_mask, base_rgb), hole_r, base_hex, size)
    cell_blend = blend(cell_mask, base_rgb)

    # 显示
    st.header("珠面 (Bead)")
    col1, col2 = st.columns(2)
    with col1:
        if show_mask:
            st.image(bead_mask, caption="Mask (RGB=d, A=l；孔区透明=B15 live)", use_container_width=True)
    with col2:
        st.image(bead_blend, caption=f"合成 (Base {base_rgb}，孔底 pit 已叠)", use_container_width=True)

    st.header("底图 (Cell)")
    col1, col2 = st.columns(2)
    with col1:
        if show_mask:
            st.image(cell_mask, caption="Mask (RGBA)", use_container_width=True)
    with col2:
        st.image(cell_blend, caption=f"合成 (Base {base_rgb})", use_container_width=True)

    # 导出
    st.header("导出")
    col1, col2 = st.columns(2)
    with col1:
        bead_img = Image.fromarray(bead_mask, "RGBA")
        st.download_button("下载 mask-bead.png", bead_img.tobytes(), "mask-bead.png", "image/png")
    with col2:
        cell_img = Image.fromarray(cell_mask, "RGBA")
        st.download_button("下载 mask-cell.png", cell_img.tobytes(), "mask-cell.png", "image/png")


if __name__ == "__main__":
    main()
