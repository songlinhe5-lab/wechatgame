import sys
import numpy as np
from PIL import Image

# wan2.7 bbox edit is a guide, not a pixel lock (outside maxΔ ~196).
# Paste-back: inside the plaque rect use the wan pixels (3px inward feather at the rect edge),
# outside the rect hard-copy the source so maxΔ = 0 there.

SRC = sys.argv[3] if len(sys.argv) > 3 else 'temp/fullstar-gacha/diag/plaque-src-v3.png'
X1, Y1, X2, Y2 = 198, 226, 576, 330  # same bbox as sent to wan2.7
FEATHER = 14


def composite(wan_path, out_path):
    A = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
    W = np.asarray(Image.open(wan_path).convert('RGB')).astype(float)
    H, Wd, _ = A.shape
    rect = np.zeros((H, Wd))
    rect[Y1:Y2, X1:X2] = 1.0
    # distance to rect edge inside the rect -> linear ramp over FEATHER px
    yy, xx = np.mgrid[0:H, 0:Wd]
    d = np.minimum.reduce([yy - Y1, Y2 - 1 - yy, xx - X1, X2 - 1 - xx]).astype(float)
    alpha = np.clip((d + 1) / (FEATHER + 1), 0, 1) * rect
    out = A * (1 - alpha[..., None]) + W * alpha[..., None]
    out = np.clip(out, 0, 255)
    outside = rect == 0
    out[outside] = A[outside]
    Image.fromarray(out.astype(np.uint8), 'RGB').save(out_path)
    # stats
    inside = np.zeros((H, Wd), bool)
    inside[Y1 + 4:Y2 - 4, X1 + 4:X2 - 4] = True
    left = A[Y1:Y2, 186:199].reshape(-1, 3).mean(axis=0)
    right = A[Y1:Y2, 577:592].reshape(-1, 3).mean(axis=0)
    ref = (left + right) / 2
    mean_in = out[inside].mean(axis=0)
    print(out_path, 'interior mean', mean_in.round(1), 'outside-band ref', ref.round(1),
          'delta', (mean_in - ref).round(1), 'maxΔ outside rect', np.abs(out - A)[outside].max())


if __name__ == '__main__':
    composite(sys.argv[1], sys.argv[2])
