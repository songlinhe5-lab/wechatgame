import sys
import numpy as np
from PIL import Image

# Keep wan2.7 TEXTURE (high frequency), replace its LOW-FREQUENCY colour with the plaque's own
# clean colour (per-row, linear between the clean left/right margins of the source).
# Then paste back with a wide feather so the rect edge carries no tone step.

SRC = 'temp/fullstar-gacha/diag/plaque-src-v3.png'
X1, Y1, X2, Y2 = 198, 226, 576, 330
FEATHER = 14
SIGMA_X, SIGMA_Y = 30.0, 4.0


def gauss1d(sig):
    r = int(3 * sig)
    x = np.arange(-r, r + 1)
    k = np.exp(-x * x / (2 * sig * sig))
    return k / k.sum()


def blur_rect(img, sx, sy):
    # separable gaussian with edge padding, operates on (H, W, 3)
    kx, ky = gauss1d(sx), gauss1d(sy)
    py, px = len(ky) // 2, len(kx) // 2
    p = np.pad(img, ((py, py), (px, px), (0, 0)), mode='edge')
    tmp = np.zeros((p.shape[0], img.shape[1], 3))
    for i, w in enumerate(kx):
        tmp += w * p[:, i:i + img.shape[1], :]
    out = np.zeros(img.shape)
    for i, w in enumerate(ky):
        out += w * tmp[i:i + img.shape[0], :, :]
    return out


def composite(wan_path, out_path, src_path=SRC):
    A = np.asarray(Image.open(src_path).convert('RGB')).astype(float)
    W = np.asarray(Image.open(wan_path).convert('RGB')).astype(float)
    H, Wd, _ = A.shape

    # target colour per row: linear interpolation between clean margins (outside the rect)
    rows = np.arange(Y1, Y2)
    Lt = np.median(A[Y1:Y2, 186:199], axis=1)  # (h, 3)
    Rt = np.median(A[Y1:Y2, 577:592], axis=1)
    xs = np.arange(X1, X2)
    t = np.clip((xs - 199) / (577 - 199), 0, 1)[None, :, None]
    target = Lt[:, None, :] * (1 - t) + Rt[:, None, :] * t  # (h, w, 3)

    wr = W[Y1:Y2, X1:X2]
    lp = blur_rect(wr, SIGMA_X, SIGMA_Y)
    HF = 0.6
    fixed = (wr - lp) * HF + lp * 0 + target  # wan texture scaled to HF, low-freq replaced

    rect = np.zeros((H, Wd))
    rect[Y1:Y2, X1:X2] = 1.0
    yy, xx = np.mgrid[0:H, 0:Wd]
    d = np.minimum.reduce([yy - Y1, Y2 - 1 - yy, xx - X1, X2 - 1 - xx]).astype(float)
    alpha = np.clip((d + 1) / (FEATHER + 1), 0, 1) * rect

    Wfull = A.copy()
    Wfull[Y1:Y2, X1:X2] = fixed
    out = A * (1 - alpha[..., None]) + Wfull * alpha[..., None]
    out = np.clip(out, 0, 255)
    outside = rect == 0
    out[outside] = A[outside]
    Image.fromarray(out.astype(np.uint8), 'RGB').save(out_path)
    print(out_path, 'maxΔ outside rect', np.abs(out - A)[outside].max())


if __name__ == '__main__':
    composite(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else SRC)
