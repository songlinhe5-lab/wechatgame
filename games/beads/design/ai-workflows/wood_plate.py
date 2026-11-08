import sys
import numpy as np
from PIL import Image

# Regenerate the wood grain INSIDE the kept plate outline, seamlessly.
#  - Outline (2 px ring, bevel, rivets) is kept from the original (text-bearing) dialog.
#  - Base colour: Laplace (harmonic) interpolation of the clean plate colours on the boundary
#    (left/right per row, top/bottom constant), so the colour matches the outline exactly at the edge.
#  - Grain: procedural horizontal wood streaks (sin rings warped by smooth noise), generated once over the
#    whole face (no tiling), tapered to ZERO at the boundary so there is no seam.

SRC = 'temp/fullstar-gacha/icons/dialog-v25b-750x1334-rgb.png'
OX1, OX2 = 167, 602
OY1, OY2 = 223, 334
INSET = 2
R_OUT = 12
IX1, IX2 = OX1 + INSET, OX2 - INSET     # 169..600
IY1, IY2 = OY1 + INSET, OY2 - INSET     # 225..332
R_IN = R_OUT - INSET
BOLTS = [(183, 240), (588, 240), (184, 316), (587, 316)]
BOLT_R = 10
BOLT_ROWS = set(range(228, 254)) | set(range(304, 330))
GRAIN_AMP = 3.5
TAPER = 7.0
SEED = 11


def rounded_sdf(x, y, x0, x1, y0, y1, r):
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    hx, hy = (x1 - x0) / 2 - r, (y1 - y0) / 2 - r
    qx, qy = np.abs(x - cx) - hx, np.abs(y - cy) - hy
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r


def gauss_fft(field, sy, sx):
    # separable gaussian by FFT (periodic); we taper to 0 at the boundary so wrap artifacts never show
    h, w = field.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    spec = np.fft.fft2(field)
    gain = np.exp(-2 * (np.pi ** 2) * ((sy * fy) ** 2 + (sx * fx) ** 2))
    return np.real(np.fft.ifft2(spec * gain))


def main(dst):
    A = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
    H, W, _ = A.shape
    bh, bw = IY2 - IY1, IX2 - IX1
    ys = np.arange(IY1, IY2)
    xs = np.arange(IX1, IX2)

    # ---- boundary colours from clean plate pixels -------------------------------------------------
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

    # ---- Dirichlet field over the bbox: horizontal (L->R) + vertical (T->B) blend ----------------
    tx = np.clip((np.arange(bw) - 0) / (bw - 1), 0, 1)[None, :, None]
    sy = np.clip(np.arange(bh) / (bh - 1), 0, 1)[:, None, None]
    Hf = L[:, None, :] * (1 - tx) + R[:, None, :] * tx
    Vf = Tc[None, None, :] * (1 - sy) + Bc[None, None, :] * sy
    D = 0.5 * (Hf + Vf)

    # ---- interior mask in bbox coords ------------------------------------------------------------
    gy, gx = np.mgrid[IY1:IY2, IX1:IX2].astype(float)
    sd = rounded_sdf(gx, gy, IX1, IX2, IY1, IY2, R_IN)
    interior = sd < 0

    # ---- Laplace solve: interior = mean of 4-neighbours, boundary fixed to D --------------------
    V = D.copy()
    for _ in range(3000):
        P = np.pad(V, ((1, 1), (1, 1), (0, 0)), mode='edge')
        avg = 0.25 * (P[:-2, 1:-1] + P[2:, 1:-1] + P[1:-1, :-2] + P[1:-1, 2:])
        V = np.where(interior[..., None], avg, D)
    base = V

    # ---- procedural wood grain (streaks + warped rings), zero-mean, no tiling ---------------------
    rng = np.random.default_rng(SEED)
    n = rng.normal(size=(bh + 40, bw + 40))
    n1 = gauss_fft(n, 0.9, 12.0)
    n2 = gauss_fft(rng.normal(size=n.shape), 3.5, 45.0)
    n1 = n1 / n1.std()
    n2 = n2 / n2.std()
    # warp rings by the slow noise, then crop back to the bbox
    yy = np.arange(bh + 40)[:, None].astype(float)
    rings = np.sin(2 * np.pi * (yy / 6.5 + 0.9 * n2))
    G = (0.55 * n1 + 0.45 * rings) * 0.8 + 0.25 * n2
    G = G[20:20 + bh, 20:20 + bw]
    G = G / G.std()
    scale = (base.mean(axis=2) / 170.0)[..., None]
    grain = G[..., None] * GRAIN_AMP * scale

    taper = np.clip(-sd / TAPER, 0, 1)[..., None]   # 0 at the boundary, 1 deep inside
    face = base + grain * taper

    # ---- compose into the full image (outline untouched) ----------------------------------------
    yy_full, xx_full = np.mgrid[0:H, 0:W].astype(float)
    sd_full = rounded_sdf(xx_full, yy_full, IX1, IX2, IY1, IY2, R_IN)
    alpha = np.clip(-sd_full + 0.5, 0, 1)            # antialiased interior mask (1 px)
    for cx, cy in BOLTS:
        d = np.sqrt((xx_full - cx) ** 2 + (yy_full - cy) ** 2)
        alpha = alpha * np.clip((d - BOLT_R) / 3.0, 0, 1)
    out = A.copy()
    region = (slice(IY1, IY2), slice(IX1, IX2))
    a_crop = alpha[region][..., None]
    out[region] = A[region] * (1 - a_crop) + face * a_crop
    # left outline notch: interpolate the 2 px outline columns across the plank seam
    for x in range(OX1, OX1 + INSET):
        top, bot = 262, 288
        for y in range(top + 1, bot):
            t_ = (y - top) / (bot - top)
            out[y, x] = out[top, x] * (1 - t_) + out[bot, x] * t_
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB').save(dst)
    inner = face[(sd < -TAPER)]
    print('saved', dst, 'grain std (deep)', inner.std(axis=0).round(2), 'mean', inner.mean(axis=0).round(1))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'temp/fullstar-gacha/plaque/wood-plate.png')
