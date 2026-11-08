import sys
import numpy as np
from PIL import Image

# Whole-plate flat wood v2: replace the plate FACE up to 2 px inside its outer outline (rounded rect),
# so the 6 px outer grain traces and the plank seam at the left edge are gone. The 2 px outline itself is kept.
# Rivets excluded. Source = original text-bearing dialog; everything outside the plate is untouched.

SRC = 'temp/fullstar-gacha/icons/dialog-v25b-750x1334-rgb.png'
OX1, OX2 = 167, 602     # plate outer outline x (inclusive .. exclusive)
OY1, OY2 = 223, 334     # plate outer outline y (inclusive .. exclusive)
INSET = 2               # keep this many px of the outline
R_OUT = 12              # outer corner radius
FEATHER = 1.0
BOLTS = [(183, 240), (588, 240), (184, 316), (587, 316)]
BOLT_R = 10
SMOOTH_Y = 21
BOLT_ROWS = set(range(228, 254)) | set(range(304, 330))


def smooth_y(a, k):
    pad = np.pad(a, ((k // 2, k // 2), (0, 0)), mode='edge')
    return np.stack([np.convolve(pad[:, c], np.ones(k) / k, 'valid') for c in range(3)], axis=1)


def rounded_sdf(x, y, x0, x1, y0, y1, r):
    # signed distance (negative inside) to a rounded rectangle [x0,x1]x[y0,y1]
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    hx = (x1 - x0) / 2 - r
    hy = (y1 - y0) / 2 - r
    qx = np.abs(x - cx) - hx
    qy = np.abs(y - cy) - hy
    outside = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0))
    inside = np.minimum(np.maximum(qx, qy), 0)
    return outside + inside - r


def main(dst):
    A = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
    H, W, _ = A.shape
    ix1, ix2 = OX1 + INSET, OX2 - INSET
    iy1, iy2 = OY1 + INSET, OY2 - INSET
    ys = np.arange(iy1, iy2)
    xs = np.arange(ix1, ix2)

    L = np.stack([np.median(A[y, 198:206], axis=0) for y in ys])
    R = np.full((len(ys), 3), np.nan)
    for i, y in enumerate(ys):
        if y not in BOLT_ROWS:
            R[i] = np.median(A[y, 578:586], axis=0)
    for c in range(3):
        good = ~np.isnan(R[:, c])
        R[:, c] = np.interp(np.arange(len(ys)), np.nonzero(good)[0], R[good, c])
    L = smooth_y(L, SMOOTH_Y)
    R = smooth_y(R, SMOOTH_Y)
    t = np.clip((xs - 200) / (584 - 200), 0, 1)[None, :, None]
    plate = L[:, None, :] * (1 - t) + R[:, None, :] * t

    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    sd = rounded_sdf(xx, yy, ix1, ix2, iy1, iy2, R_OUT - INSET)  # negative inside the inset outline
    alpha = np.clip(-sd / FEATHER + 0.5, 0, 1)
    # rivets: keep original inside r=BOLT_R, soft ramp to full replacement at r=BOLT_R+3 (no halo)
    for cx, cy in BOLTS:
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        keep = np.clip((d - BOLT_R) / 3.0, 0, 1)
        alpha = alpha * keep
    alpha = alpha[..., None]

    flat = A.copy()
    flat[iy1:iy2, ix1:ix2] = plate
    out = A * (1 - alpha) + flat * alpha
    # left outline notch (board plank seam crossing the 2px outline near y~274): interpolate outline columns
    for x in range(OX1, OX1 + INSET):
        top, bot = 262, 288
        for y in range(top + 1, bot):
            t_ = (y - top) / (bot - top)
            out[y, x] = out[top, x] * (1 - t_) + out[bot, x] * t_
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB').save(dst)
    print('saved', dst)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'temp/fullstar-gacha/plaque/flat-plaque-full2.png')
