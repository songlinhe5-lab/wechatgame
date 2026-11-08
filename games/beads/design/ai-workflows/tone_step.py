import sys
import numpy as np
from PIL import Image
# per-row tone step across the two rect edges: mean(inside 8px) - mean(outside 8px), median over rows
ROWS = slice(232, 326)
def step(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(float)
    L = a.mean(axis=2)[ROWS]
    res = {}
    # left edge: outside x 186..197 vs inside x 200..207
    l = (L[:, 200:208].mean(axis=1) - L[:, 186:198].mean(axis=1)); l = np.median(l)
    # right edge: inside x 566..574 vs outside x 577..589
    r = np.median(L[:, 566:575].mean(axis=1) - L[:, 577:590].mean(axis=1))
    return round(float(l), 1), round(float(r), 1)
for p in sys.argv[1:]:
    print(p, 'left(in-out)', step(p)[0], 'right(in-out)', step(p)[1])
