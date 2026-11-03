/**
 * `[WXG-T-567 2026-11-03 拆分 Step 1]` mask-field.ts → mask-lanczos.ts。
 *
 * 逐字复制原始 mask-field.ts L457-548（LANCZOS 数学函数 + 常量 + resampleSquare）。
 * cInt 逐字复制（一行），避免循环 import（模块解耦比 DRY 更重要）。
 *
 * TypedArray 池化：pre（Float64 临时）+ temp（Uint8 临时），bounds/k/out 因 return 出而跳过。
 */

import { acquireFloat64, acquireUint8, releaseFloat64, releaseUint8 } from '../pool/typedarray-pool';

// ─── 重复函数（避免循环 import mask-field） ────────────────────────────
/** C `(int)` = 向零截断。逐字复制自 mask-field.ts L50。 */
function cInt(v: number): number {
    return Math.trunc(v);
}

// ─── LANCZOS ÷4（`Resample.c` 8bpc 定点路径逐式复刻） ─────────────────────

/** `Resample.c`: `PRECISION_BITS = 32 − 8 − 2`。 */
const PRECISION_BITS = 22;
const PRECISION_ONE = 1 << PRECISION_BITS;

export function sincFilter(x: number): number {
    if (x === 0) return 1;
    const px = x * Math.PI;
    return Math.sin(px) / px;
}

export function lanczosFilter(x: number): number {
    if (x >= -3 && x < 3) return sincFilter(x) * sincFilter(x / 3);
    return 0;
}

/** `precompute_coeffs` + `normalize_coeffs_8bpc`（`LANCZOS` support = 3）。 */
export function lanczosCoeffs(inSize: number, outSize: number): { bounds: Int32Array; k: Int32Array; ksize: number } {
    const scale = inSize / outSize;
    const filterscale = scale < 1 ? 1 : scale;
    const support = 3 * filterscale;
    const ksize = Math.ceil(support) * 2 + 1;
    const bounds = new Int32Array(outSize * 2);
    const _pre = acquireFloat64(outSize * ksize * 8);
    const pre = _pre.subarray(0, outSize * ksize);
    try {
        for (let xx = 0; xx < outSize; xx++) {
            const center = (xx + 0.5) * scale;
            const ss = 1 / filterscale;
            let xmin = cInt(center - support + 0.5);
            if (xmin < 0) xmin = 0;
            let xmax = cInt(center + support + 0.5);
            if (xmax > inSize) xmax = inSize;
            xmax -= xmin;
            let ww = 0;
            const base = xx * ksize;
            for (let x = 0; x < xmax; x++) {
                const wgt = lanczosFilter((x + xmin - center + 0.5) * ss);
                pre[base + x] = wgt;
                ww += wgt;
            }
            for (let x = 0; x < xmax; x++) {
                if (ww !== 0) pre[base + x] = pre[base + x]! / ww;
            }
            bounds[xx * 2] = xmin;
            bounds[xx * 2 + 1] = xmax;
        }
        const k = new Int32Array(outSize * ksize);
        for (let i = 0; i < outSize * ksize; i++) {
            const v = pre[i]!;
            k[i] = v < 0 ? cInt(-0.5 + v * PRECISION_ONE) : cInt(0.5 + v * PRECISION_ONE);
        }
        return { bounds, k, ksize };
    } finally {
        releaseFloat64(_pre);
    }
}

/** `clip8(ss) = clip8_lookups[ss >> 22]`（算术右移 = floor，表端点 clamp 0/255）。 */
export function clip8(ss: number): number {
    const v = Math.floor(ss / PRECISION_ONE);
    return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** 单通道 `size×size` → `n×n`：横遍（`size`→`n`）后纵遍（`size`→`n`），PIL 的两遍顺序。 */
export function resampleSquare(src: Uint8Array, size: number, n: number): Uint8Array {
    if (size === n) return src.slice();
    const h = lanczosCoeffs(size, n);
    const _tmp = acquireUint8(n * size);
    const temp = _tmp.subarray(0, n * size);
    try {
        // 横遍：src(size×size) → temp(n×size)。
        for (let yy = 0; yy < size; yy++) {
            for (let xx = 0; xx < n; xx++) {
                const xmin = h.bounds[xx * 2]!;
                const xmax = h.bounds[xx * 2 + 1]!;
                const kb = xx * h.ksize;
                let ss = 1 << (PRECISION_BITS - 1);
                const row = yy * size;
                for (let x = 0; x < xmax; x++) ss += src[row + (x + xmin)]! * h.k[kb + x]!;
                temp[yy * n + xx] = clip8(ss);
            }
        }
        // 纵遍：temp(n×size) → out(n×n)。
        const v = lanczosCoeffs(size, n);
        const out = new Uint8Array(n * n);
        for (let yy = 0; yy < n; yy++) {
            const ymin = v.bounds[yy * 2]!;
            const ymax = v.bounds[yy * 2 + 1]!;
            const kb = yy * v.ksize;
            for (let xx = 0; xx < n; xx++) {
                let ss = 1 << (PRECISION_BITS - 1);
                for (let y = 0; y < ymax; y++) ss += temp[(y + ymin) * n + xx]! * v.k[kb + y]!;
                out[yy * n + xx] = clip8(ss);
            }
        }
        return out;
    } finally {
        releaseUint8(_tmp);
    }
}
