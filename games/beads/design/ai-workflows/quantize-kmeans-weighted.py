"""加权调色板实验：中位切分按「像素面积」分配色槽 ⇒ 占屏 70% 的木墙吃掉配额，
彩豆/玻璃高光被并色。这里改成按「视觉重要性」加权（饱和度 + 局部梯度），
看同样色数能不能把细节区救回来。

基准：qwen-3.0 · 0.9×（677×1210）；对照 = PIL 中位切分同色数。
"""
import os

import numpy as np
from PIL import Image

OUT = "temp/t521-color-sweep"
BASE = Image.open("temp/online-inpaint/bg_qwen-3.0_rgb.png").convert("RGB")
W0, H0 = round(752 * 0.9), round(1344 * 0.9)
WORK = BASE.resize((W0, H0), Image.LANCZOS)
REF = np.asarray(BASE, dtype=np.float32)          # 评价基准 = 原尺寸 RGB
PIX = np.asarray(WORK, dtype=np.float32).reshape(-1, 3)
DETAIL = (520, 900, 752, 1290)
WALL = (140, 380, 520, 980)
LUMA = np.array([0.299, 0.587, 0.114], dtype=np.float32)


def psnr(a, b, box=None):
    if box:
        x0, y0, x1, y1 = box
        a, b = a[y0:y1, x0:x1], b[y0:y1, x0:x1]
    m = float(((a - b) ** 2).mean())
    return 99.0 if m == 0 else 10 * np.log10(255.0 ** 2 / m)


def evaluate(p_img, label):
    shown = p_img.convert("RGB").resize((752, 1344), Image.BICUBIC)
    a = np.asarray(shown, dtype=np.float32)
    lum = a[WALL[1]:WALL[3], WALL[0]:WALL[2]] @ LUMA
    steps = float((np.abs(np.diff(lum, axis=0)) >= 3).mean() * 100)
    path = f"{OUT}/wp_{label}.png"
    p_img.save(path, optimize=True)
    return {
        "label": label,
        "kb": round(os.path.getsize(path) / 1024, 1),
        "psnr": round(psnr(a, REF), 2),
        "wall": round(psnr(a, REF, WALL), 2),
        "detail": round(psnr(a, REF, DETAIL), 2),
        "steps": round(steps, 2),
    }


def importance(img):
    """视觉重要性：饱和度 + 局部梯度（归一化到 0~1）。"""
    a = np.asarray(img, dtype=np.float32)
    mx, mn = a.max(axis=2), a.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    lum = a @ LUMA
    gy = np.zeros_like(lum); gx = np.zeros_like(lum)
    gy[1:-1] = np.abs(lum[2:] - lum[:-2])
    gx[:, 1:-1] = np.abs(lum[:, 2:] - lum[:, :-2])
    grad = gx + gy
    w = 1.0 + 6.0 * sat + 2.5 * (grad / max(grad.max(), 1))
    return w


def kmeans_weighted(px, w, k, iters=14, seed=7):
    rng = np.random.default_rng(seed)
    n = px.shape[0]
    # k-means++ 初始化（按权重抽）
    idx = [int(rng.choice(n, p=w / w.sum()))]
    d2 = ((px - px[idx[0]]) ** 2).sum(1)
    for _ in range(k - 1):
        p = d2 * w
        p = p / p.sum() if p.sum() > 0 else np.full(n, 1.0 / n)
        c = int(rng.choice(n, p=p))
        idx.append(c)
        d2 = np.minimum(d2, ((px - px[c]) ** 2).sum(1))
    cen = px[idx].astype(np.float64).copy()
    for _ in range(iters):
        dist = ((px[:, None, :] - cen[None, :, :]) ** 2).sum(2)
        lab = dist.argmin(1)
        for j in range(k):
            m = lab == j
            ww = w[m]
            if ww.sum() > 0:
                cen[j] = (px[m] * ww[:, None]).sum(0) / ww.sum()
    return cen


def map_to_palette(px, cen, chunk=200_000):
    out = np.empty(len(px), dtype=np.uint8)
    for i in range(0, len(px), chunk):
        blk = px[i:i + chunk]
        d = ((blk[:, None, :] - cen[None, :, :]) ** 2).sum(2)
        out[i:i + chunk] = d.argmin(1)
    return out


w = importance(WORK).reshape(-1)
rows = []
for k in (64, 96, 128):
    # 对照：PIL 中位切分
    med = WORK.quantize(colors=k, method=Image.MEDIANCUT)
    rows.append(evaluate(med, f"s90_q{k}_median"))
    # 加权 k-means：抽样 12 万像素建调色板，再全图映射
    sub = np.random.default_rng(3).choice(len(PIX), size=min(120_000, len(PIX)), replace=False)
    cen = kmeans_weighted(PIX[sub], w[sub], k)
    lab = map_to_palette(PIX, cen)
    pal = np.clip(np.round(cen), 0, 255).astype(np.uint8)
    img = Image.fromarray(lab.reshape(H0, W0), mode="P")
    flat = pal.flatten().tolist()
    flat += [0] * (768 - len(flat))
    img.putpalette(flat)
    rows.append(evaluate(img, f"s90_q{k}_weighted"))

print(f"{'候选':<26}{'KB':>7}{'PSNR':>7}{'墙':>7}{'细节':>7}{'台阶%':>7}")
for r in rows:
    print(f"{r['label']:<26}{r['kb']:>7.1f}{r['psnr']:>7.2f}{r['wall']:>7.2f}{r['detail']:>7.2f}{r['steps']:>7.1f}")
