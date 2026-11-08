import sys
import numpy as np
from PIL import Image

# AI-natural grain, seam-exact.
#  - LOW frequency (colour) = Laplace-harmonic base from the clean plate colours (same as wood_plate.py),
#    so the face colour matches the kept outline exactly at the boundary.
#  - HIGH frequency (grain) = high-pass of the qwen-3.0-pro text-free plaque (plaque/q3pro-s7.png), which is
#    natural AI wood; it is tapered to ZERO at the outline, so the seam is exact by construction.

SRC = 'temp/fullstar-gacha/icons/dialog-v25b-750x1334-rgb.png'
AI = 'temp/fullstar-gacha/plaque/q3pro-s7.png'     # 1536x456 qwen output of crop 170..600 x 212..340
CROP = (170, 212, 600, 340)
DY = 4                                              # qwen output shift measured at +4 px (1x)
OX1, OX2 = 167, 602
OY1, OY2 = 223, 334
INSET = 2
R_OUT = 12
IX1, IX2 = OX1 + INSET, OX2 - INSET
IY1, IY2 = OY1 + INSET, OY2 - INSET
R_IN = R_OUT - INSET
BOLTS = [(183, 240), (588, 240), (184, 316), (587, 316)]
BOLT_R = 10
BOLT_ROWS = set(range(228, 254)) | set(range(304, 330))
GRAIN_AMP = 6.0
TAPER = 6.0


def rounded_sdf(x, y, x0, x1, y0, y1, r):
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    hx, hy = (x1 - x0) / 2 - r, (y1 - y0) / 2 - r
    qx, qy = np.abs(x - cx) - hx, np.abs(y - cy) - hy
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r


def gauss_nonneg(field, sy, sx):
    # separable gaussian blur with edge padding (small kernels, direct conv)
    def k1(s):
        r = int(3 * s + 0.5)
        x = np.arange(-r, r + 1)
        k = np.exp(-x * x / (2 * s * s))
        return k / k.sum()
    ky, kx = k1(sy), k1(sx)
    py, px = len(ky) // 2, len(kx) // 2
    p = np.pad(field, ((py, py), (px, px), (0, 0)), mode='edge')
    tmp = sum(w * p[:, i:i + field.shape[1], :] for i, w in enumerate(kx))
    return sum(w * tmp[i:i + field.shape[0], :, :] for i, w in enumerate(ky))


def main(dst):
    A = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
    H, W, _ = A.shape
    bh, bw = IY2 - IY1, IX2 - IX1
    ys = np.arange(IY1, IY2)

    # ---- colour base (identical recipe to wood_plate.py) --------------------------------------
    L = np.stack([np.median(A[y, 198:206], axis=0) for y in ys])
    R = np.full((bh, 3), np.nan)
    for i, y in enumerate(ys):
        if y not in BOLT_ROWS:
            R[i] = np.median(A[y, 578:586], axis=0)
    for c in range(3):
        good = ~np.isnan(R[:, c])
        R[:, c] = np.interp(np.arange(bh), np.nonzero(good)[0], R[good, c])
    Tc = np.median(np.concatenate([A[226:229, 200:216].reshape(-1, 3), A[226:229, 585:590].reshape(-1, 3)]), axis=0)
    Bc = np.median(np.concatenate([A[327:329, 200:216].reshape(-1, 3), A[327:329, 585:590].reshape(-1, 3)]), axis=0)
    tx = np.clip(np.arange(bw) / (bw - 1), 0, 1)[None, :, None]
    sy = np.clip(np.arange(bh) / (bh - 1), 0, 1)[:, None, None]
    D = 0.5 * (L[:, None, :] * (1 - tx) + R[:, None, :] * tx + Tc[None, None, :] * (1 - sy) + Bc[None, None, :] * sy)

    gy, gx = np.mgrid[IY1:IY2, IX1:IX2].astype(float)
    sd = rounded_sdf(gx, gy, IX1, IX2, IY1, IY2, R_IN)
    interior = sd < 0
    V = D.copy()
    for _ in range(3000):
        P = np.pad(V, ((1, 1), (1, 1), (0, 0)), mode='edge')
        avg = 0.25 * (P[:-2, 1:-1] + P[2:, 1:-1] + P[1:-1, :-2] + P[1:-1, 2:])
        V = np.where(interior[..., None], avg, D)
    base = V

    # ---- AI grain: high-pass of the qwen plaque, aligned to 1x and cropped to the face bbox ----
    ai = Image.open(AI).convert('RGB')
    cx1, cy1, cx2, cy2 = CROP
    ai1x = np.asarray(ai.resize((cx2 - cx1, cy2 - cy1), Image.LANCZOS)).astype(float)
    shifted = np.empty_like(ai1x)
    shifted[:-DY] = ai1x[DY:]
    shifted[-DY:] = ai1x[-DY:]
    hp_full = shifted - gauss_nonneg(shifted, 2.5, 6.0)   # keep streaks (fine), drop colour
    # map face bbox (IX1..IX2, IY1..IY2) into crop coords, clamp to crop
    ox = np.clip(np.arange(IX1, IX2) - cx1, 0, cx2 - cx1 - 1)
    oy = np.clip(np.arange(IY1, IY2) - cy1, 0, cy2 - cy1 - 1)
    hp = hp_full[oy][:, ox]
    hp = hp / (hp.std(axis=(0, 1), keepdims=True) + 1e-6)
    hp = np.clip(hp, -2.2, 2.2)   # kill the sharp qwen block/step edges, keep streak texture
    hp = hp / (hp.std(axis=(0, 1), keepdims=True) + 1e-6)
    scale = (base.mean(axis=2) / 170.0)[..., None]
    grain = hp * GRAIN_AMP * scale

    taper = np.clip(-sd / TAPER, 0, 1)
    # suppress AI artefacts: around rivets (qwen redraws a soft pad there) and across the left plank seam
    gm = np.ones((bh, bw))
    for cx, cy in BOLTS:
        d = np.sqrt((gx - cx) ** 2 + (gy - cy) ** 2)
        gm = np.minimum(gm, np.clip((d - 14.0) / 6.0, 0, 1))
    seam = np.clip(1.0 - (np.abs(gy - 273.0) - 2.0) / 3.0, 0, 1) * np.clip((gx - 166.0) / 6.0, 0, 1) * np.clip((192.0 - gx) / 4.0, 0, 1)
    gm = np.minimum(gm, 1 - seam)
    face = base + (grain * (taper * gm)[..., None])

    yy_f, xx_f = np.mgrid[0:H, 0:W].astype(float)
    sd_full = rounded_sdf(xx_f, yy_f, IX1, IX2, IY1, IY2, R_IN)
    alpha = np.clip(-sd_full + 0.5, 0, 1)
    for cx, cy in BOLTS:
        d = np.sqrt((xx_f - cx) ** 2 + (yy_f - cy) ** 2)
        alpha = alpha * np.clip((d - BOLT_R) / 3.0, 0, 1)
    out = A.copy()
    region = (slice(IY1, IY2), slice(IX1, IX2))
    a_crop = alpha[region][..., None]
    out[region] = A[region] * (1 - a_crop) + face * a_crop
    for x in range(OX1, OX1 + INSET):
        top, bot = 262, 288
        for y in range(top + 1, bot):
            t_ = (y - top) / (bot - top)
            out[y, x] = out[top, x] * (1 - t_) + out[bot, x] * t_
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB').save(dst)
    deep = face[sd < -TAPER]
    print('saved', dst, 'grain std', deep.std(axis=0).round(2), 'mean', deep.mean(axis=0).round(1))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'temp/fullstar-gacha/plaque/ai-grain-plate.png')
