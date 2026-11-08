import sys
import numpy as np
from PIL import Image

# Paste the qwen-3.0-pro text-free plaque back into the background.
# qwen i2i output is shifted ~ +4 px down vs the 1x crop (gradient correlation: dy=+4 -> 0.74, dy=0 -> 0.17);
# x is aligned. Shift the output up by DY, then feather 6 px at the crop border so the board margin blends.

BG = 'temp/fullstar-gacha/icons/dialog-v25b-750x1334-rgb-no-title.png'
OUT_IMG = sys.argv[1]
DST = sys.argv[2]
CX1, CY1, CX2, CY2 = 170, 212, 600, 340
DY = 4
FEATHER = 6


def main():
    bg = np.asarray(Image.open(BG).convert('RGB')).astype(float)
    W = CX2 - CX1
    H = CY2 - CY1
    gen = np.asarray(Image.open(OUT_IMG).convert('RGB').resize((W, H), Image.LANCZOS)).astype(float)
    # shift generated content up by DY (out[y] -> sample from y+DY); pad bottom with original
    sh = np.empty_like(gen)
    sh[:H - DY] = gen[DY:]
    sh[H - DY:] = bg[CY1 + H - DY:CY2, CX1:CX2]

    yy, xx = np.mgrid[0:H, 0:W]
    d = np.minimum.reduce([yy, H - 1 - yy, xx, W - 1 - xx]).astype(float)
    alpha = np.clip((d + 1) / (FEATHER + 1), 0, 1)[..., None]

    orig = bg[CY1:CY2, CX1:CX2].copy()
    bg[CY1:CY2, CX1:CX2] = alpha * sh + (1 - alpha) * orig
    Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8), 'RGB').save(DST)
    print('saved', DST)


if __name__ == '__main__':
    main()
