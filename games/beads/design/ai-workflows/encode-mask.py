#!/usr/bin/env python3
"""
encode-mask.py — 将 AI 生成的珠子光照参考图转换为 ADR-0028 tint-mask 格式。

输入: 一张珠子渲染参考图（RGBA，透明背景，256x256 或更大）
输出: tint-mask 格式 PNG
  - RGB = d（暗系数，灰度光照图，0=全暗 255=全亮）
  - A   = l（亮系数/高光，0=无高光 255=最强高光）

用法:
  python3 encode-mask.py input.png -o output_mask.png [--size 128]
  python3 encode-mask.py input.png --preview  # 仅输出预览，不写文件

依赖: Pillow, NumPy
"""

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def load_and_resize(path: str, size: int) -> np.ndarray:
    """加载图片并缩放到目标尺寸（RGBA）。"""
    img = Image.open(path).convert("RGBA")
    img = img.resize((size, size), Image.LANCZOS)
    return np.array(img, dtype=np.float64)


def extract_luminance(arr: np.ndarray) -> np.ndarray:
    """从 RGB 通道提取亮度（Rec.709 加权）。"""
    return 0.2126 * arr[:, :, 0] + 0.7152 * arr[:, :, 1] + 0.0722 * arr[:, :, 2]


def compute_shape_alpha(arr: np.ndarray, threshold: float = 128.0) -> np.ndarray:
    """从输入图的 alpha 通道提取珠子轮廓。"""
    alpha = arr[:, :, 3]
    # 软边：保留原始 alpha 作为形状
    return np.clip(alpha, 0, 255)


def compute_dark_coefficient(lum: np.ndarray, shape: np.ndarray) -> np.ndarray:
    """
    暗系数 d = 归一化亮度（限制在珠子区域内）。
    背景区域 d=0（shader 中 base*0=0，配合形状 alpha 不可见）。
    """
    # 仅在珠子区域内归一化
    mask = shape > 0
    if not mask.any():
        return np.zeros_like(lum)

    lum_min = lum[mask].min()
    lum_max = lum[mask].max()

    if lum_max - lum_min < 1e-6:
        # 均匀亮度 → d = 255 在珠子区域
        d = np.where(mask, 255.0, 0.0)
        return d

    # 归一化到 [0, 255]
    d = (lum - lum_min) / (lum_max - lum_min) * 255.0
    d = np.where(mask, d, 0.0)
    return d


def compute_highlight_coefficient(
    lum: np.ndarray, shape: np.ndarray, threshold_ratio: float = 0.85
) -> np.ndarray:
    """
    亮系数 l = 高光区域（亮度超过阈值的部分，归一化）。
    threshold_ratio: 相对于珠子区域最大亮度的比例阈值。
    """
    mask = shape > 0
    if not mask.any():
        return np.zeros_like(lum)

    lum_max = lum[mask].max()
    threshold = lum_max * threshold_ratio

    # 超过阈值的部分线性映射到 [0, 255]
    range_above = lum_max - threshold
    if range_above < 1e-6:
        return np.zeros_like(lum)

    l = np.clip((lum - threshold) / range_above * 255.0, 0, 255)
    l = np.where(mask, l, 0.0)
    return l


def encode_mask(
    input_path: str,
    size: int = 128,
    highlight_threshold: float = 0.85,
) -> np.ndarray:
    """主编码流程，返回 (size, size, 4) uint8 数组。"""
    arr = load_and_resize(input_path, size)
    lum = extract_luminance(arr)
    shape = compute_shape_alpha(arr)
    d = compute_dark_coefficient(lum, shape)
    l = compute_highlight_coefficient(lum, shape, highlight_threshold)

    # 组装输出: RGB = d (灰度复制三通道), A = l
    out = np.zeros((size, size, 4), dtype=np.uint8)
    d_u8 = np.clip(d, 0, 255).astype(np.uint8)
    out[:, :, 0] = d_u8  # R = d
    out[:, :, 1] = d_u8  # G = d
    out[:, :, 2] = d_u8  # B = d
    out[:, :, 3] = np.clip(l, 0, 255).astype(np.uint8)  # A = l

    return out


def save_output(data: np.ndarray, output_path: str) -> None:
    """保存为 PNG。"""
    img = Image.fromarray(data, "RGBA")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, optimize=True)
    print(f"[encode-mask] 写入: {output_path} ({img.size[0]}x{img.size[1]})")


def print_stats(data: np.ndarray, label: str = "") -> None:
    """打印通道统计，辅助验证。"""
    prefix = f"[{label}] " if label else ""
    r, g, b, a = (data[:, :, i] for i in range(4))
    print(f"{prefix}RGB(d): min={r.min()} max={r.max()} mean={r.mean():.1f}")
    print(f"{prefix}A(l):   min={a.min()} max={a.max()} mean={a.mean():.1f}")
    print(f"{prefix}R==G==B (grayscale): {np.array_equal(r, g) and np.array_equal(g, b)}")


def main():
    parser = argparse.ArgumentParser(
        description="将 AI 生成的珠子光照参考图转为 ADR-0028 tint-mask 格式"
    )
    parser.add_argument("input", help="输入图片路径 (RGBA PNG, 建议 >= 256x256)")
    parser.add_argument(
        "-o", "--output", help="输出 mask PNG 路径 (默认: <input>_mask.png)"
    )
    parser.add_argument(
        "--size", type=int, default=128, help="输出尺寸 (默认 128, 可选 64/128/256)"
    )
    parser.add_argument(
        "--highlight-threshold",
        type=float,
        default=0.85,
        help="高光阈值比例 (0~1, 默认 0.85, 越小高光越多)",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="仅打印统计信息，不输出文件",
    )
    args = parser.parse_args()

    data = encode_mask(args.input, size=args.size, highlight_threshold=args.highlight_threshold)

    print_stats(data, "output")

    if args.preview:
        return

    output = args.output
    if not output:
        p = Path(args.input)
        output = str(p.parent / f"{p.stem}_mask.png")

    save_output(data, output)


if __name__ == "__main__":
    main()
