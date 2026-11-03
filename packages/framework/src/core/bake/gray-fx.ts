/**
 * `[WXG-T-566]` **灰度效果**（`fx.gray`）的键名权威 + 具象化（纯函数，⛔ 无 DOM / 无 canvas）。
 *
 * ## 语义
 *
 * `gray = g`（0–1，1 = 全灰）⇒ 消费侧对纹理做**线性去饱和**：
 * ```
 * luma = 0.2126·R + 0.7152·G + 0.0722·B        （Rec.709）
 * out  = c·(1−g) + luma·g                       alpha 原样保留
 * ```
 * `g = 0` ⇒ 恒等（调用侧可直接省掉该键）；`g = 1` ⇒ 纯亮度图。
 *
 * ## 为什么是标量而不是 `matrix`
 *
 * `ADR-0029 §8.4` 的 `matrix` 仍留给通用色彩矩阵（对比度 / 通道混合）。
 * 灰度只用一个标量就能表达，且 cocos 侧只需 1 个 uniform ⇒ 不为单一用途引入 20 个浮点载荷。
 *
 * ## 与 tint 的关系
 *
 * 同一 `fx` 同时带 `base` 与 `gray` 时，**`base` 优先**（由 resolver 的分派顺序结构性保证）；
 * ⛔ 生产者不要混用两种效果。
 *
 * ## `frost`（磨砂玻璃）
 *
 * 见下方 {@link FROST_FX_KEY}：语义 = **下采样模糊 + 全灰**（同一 Rec.709 式），用于「未开启」态。
 * 它不是通用 blur 原语：载荷只有模糊半径，灰度是定义的一部分（`frost` 的观感就是灰玻璃后的展品）。
 */

import type { BlitFx } from '../render/render-model.js';
import { acquireClamped, releaseClamped } from '../pool/typedarray-pool.js';

/** 灰度强度键名（`ADR-0029 §8.4` 键名表的代码侧正本）。 */
export const GRAY_FX_KEY = 'gray';

/**
 * `[WXG-T-566]` **竖向揭彩**键名：彩色自图像**底部向上**揭开，其余部分保持灰度。
 *
 * 载荷固定为 `[progress, soft]` 两个数：
 * - `progress`（0–1）= 已彩色部分占图像**高度**的比例（0 = 全灰，1 = 全彩）；
 * - `soft`（0–1）= 交界柔带的**总高度**占图像高度的比例（0 = 硬边）。
 *
 * 为什么用数组而不是两个键：`BlitFxValue` 支持 `readonly number[]`，且键序 / JSON
 * 可哈希性一次锁定（两个键会引入「只给一个」的半合法态）。
 */
export const GRAY_WIPE_FX_KEY = 'grayWipe';

/**
 * 构造「竖向揭彩」效果的 `fx`。
 *
 * @param progress 0–1；越界夹取；`0` 也照常建键（消费侧自行决定是否跳过）
 * @param soft 0–1；越界夹取；`0` = 硬边
 */
export function grayWipeFx(progress: number, soft: number): BlitFx {
    const p = progress < 0 ? 0 : progress > 1 ? 1 : progress;
    const s = soft < 0 ? 0 : soft > 1 ? 1 : soft;
    return { [GRAY_WIPE_FX_KEY]: [p, s] };
}

/**
 * 从 `fx` 读出竖向揭彩载荷（消费侧用）。
 *
 * @returns `[progress, soft]`；键缺失 / 不是长度 ≥2 的数字数组 ⇒ `undefined`
 */
export function grayWipeRead(fx: BlitFx | undefined): readonly number[] | undefined {
    if (fx === undefined) return undefined;
    const v = fx[GRAY_WIPE_FX_KEY];
    if (!Array.isArray(v) || v.length < 2) return undefined;
    const p = v[0];
    const s = v[1];
    if (typeof p !== 'number' || !Number.isFinite(p) || typeof s !== 'number' || !Number.isFinite(s)) {
        return undefined;
    }
    return v;
}

/**
 * 构造「灰度」效果的 `fx`。
 *
 * @param strength 0–1；越界夹取；`0` 也照常建键（消费侧自行决定是否跳过）
 */
export function grayFx(strength: number): BlitFx {
    const g = strength < 0 ? 0 : strength > 1 ? 1 : strength;
    return { [GRAY_FX_KEY]: g };
}

/**
 * 从 `fx` 读出灰度强度（消费侧用）。
 *
 * @returns `0..1`；`fx` 缺 `gray`、或值不是有限数字 ⇒ `undefined` ⇒ 调用方走无效果路径
 */
export function grayFxRead(fx: BlitFx | undefined): number | undefined {
    if (fx === undefined) return undefined;
    const v = fx[GRAY_FX_KEY];
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * `[WXG-T-567]` **磨砂玻璃**键名：模糊 + 全灰。
 *
 * 载荷 = `radius`（**源纹理像素**，0 = 只做 1/4 下采样不额外模糊）。
 * 实现是「先 4× 盒式下采样，再在 1/4 网格上做两遍盒式模糊（半径 `radius/4`），最后按
 * {@link GRAY_FX_KEY} 同一 Rec.709 式全灰」。
 *
 * 为什么存 1/4 分辨率：模糊抹掉高频后，1/4 图放大回显示尺寸观感等价（`WXG-T-567` 对照图），
 * 显存降到 1/16；两条宿主腿共用 {@link frostPixels} ⇒ 像素级同源，可进 UI 金样本。
 *
 * 为什么不做真·实时 shader 模糊：`tint-mask.effect` 只采样 `maskTexture`、不采样美术图；
 * 且浏览器 harness 无 shader ⇒ 两端不等价。锁定态是静止的，「一次预烘」= 实时。
 */
export const FROST_FX_KEY = 'frost';

/** 磨砂玻璃的下采样倍数（两条宿主腿与缓存尺寸口径同源）。 */
export const FROST_DOWNSCALE = 4;

/**
 * 构造「磨砂玻璃」效果的 `fx`。
 *
 * @param radius 模糊半径（源纹理像素）；越界夹取到 `0..32`；`0` 也照常建键
 */
export function frostFx(radius: number): BlitFx {
    const r = radius < 0 ? 0 : radius > 32 ? 32 : radius;
    return { [FROST_FX_KEY]: r };
}

/**
 * 从 `fx` 读出磨砂半径（消费侧用）。
 *
 * @returns 源纹理像素；键缺失 / 非有限数字 ⇒ `undefined`
 */
export function frostRead(fx: BlitFx | undefined): number | undefined {
    if (fx === undefined) return undefined;
    const v = fx[FROST_FX_KEY];
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * 构造「磨砂玻璃 + 灰度」**叠加管线**的 `fx`（多键，消费侧 frost 先跑、gray 在其产物上再跑）。
 *
 * @param radius 模糊半径（源纹理像素）；越界夹取到 `0..32`
 * @param gray 灰度强度（0–1，默认 1 = 全灰）；<1 时 blur 产物保留部分原色
 *   ⇒ 叠加管线比「先 frost(全灰) 再 gray」有意义（后者在全灰图上再灰一次等于 no-op）
 */
export function frostGrayFx(radius: number, gray = 1): BlitFx {
    const r = radius < 0 ? 0 : radius > 32 ? 32 : radius;
    const g = gray < 0 ? 0 : gray > 1 ? 1 : gray;
    // 键序固定（frost 前、gray 后）⇒ 同参数同 JSON.stringify 输出。
    // 但消费侧**不从键序推断叠加顺序**——顺序硬编码在 carrier 里。
    return { [FROST_FX_KEY]: r, [GRAY_FX_KEY]: g };
}

/** {@link frostPixels} 的产物：1/4 尺寸的 RGBA 像素（`data` 长度为 `width*height*4`）。 */
export interface FrostPixels {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8ClampedArray;
}

/**
 * 纯像素实现（⛔ 无 canvas / DOM）：源 RGBA → 1/4 下采样 → 盒式模糊 → 灰度（默认全灰）。
 *
 * `radius` 为**源纹理像素**；内部折算到 1/4 网格（`round(radius / 4)`，上限 8）。
 * alpha 一并下采样与模糊（磨砂会把作品轮廓糊开），灰度只改 RGB。
 *
 * @param gray 灰度强度（0–1，默认 1 = 全灰）。设 <1 时 blur 后保留部分原色，
 *   供叠加管线 frost+gray 组合使用。
 */
export function frostPixels(src: ArrayLike<number>, sw: number, sh: number, radius: number, gray = 1): FrostPixels {
    const q = FROST_DOWNSCALE;
    const w = Math.max(1, Math.floor(sw / q));
    const h = Math.max(1, Math.floor(sh / q));
    const small = new Uint8ClampedArray(w * h * 4);
    // 4×4 块平均（含 alpha）；右/下残块按纹理边界夹取
    for (let y = 0; y < h; y++) {
        const y0 = y * q;
        const y1 = Math.min(sh, y0 + q);
        for (let x = 0; x < w; x++) {
            const x0 = x * q;
            const x1 = Math.min(sw, x0 + q);
            let sr = 0;
            let sg = 0;
            let sb = 0;
            let sa = 0;
            let n = 0;
            for (let yy = y0; yy < y1; yy++) {
                for (let xx = x0; xx < x1; xx++) {
                    const i = (yy * sw + xx) * 4;
                    sr += src[i]!;
                    sg += src[i + 1]!;
                    sb += src[i + 2]!;
                    sa += src[i + 3]!;
                    n++;
                }
            }
            const o = (y * w + x) * 4;
            small[o] = sr / n;
            small[o + 1] = sg / n;
            small[o + 2] = sb / n;
            small[o + 3] = sa / n;
        }
    }
    const rad = Math.min(8, Math.max(0, Math.round(radius / q)));
    if (rad > 0) {
        // `[WXG-T-567]` TypedArray 池化：tmp/out 是每帧一次的中间缓冲，
        // 池化后避免烘焙 miss 时的 GC 抖动。release 在 finally 里保证归还。
        const byteLen = w * h * 4;
        const tmp = acquireClamped(byteLen);
        const out = acquireClamped(byteLen);
        try {
            const n = rad * 2 + 1;
            for (let y = 0; y < h; y++) {
                const row = y * w * 4;
                for (let x = 0; x < w; x++) {
                    let sr = 0;
                    let sg = 0;
                    let sb = 0;
                    let sa = 0;
                    for (let dx = -rad; dx <= rad; dx++) {
                        const xx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
                        const i = row + xx * 4;
                        sr += small[i]!;
                        sg += small[i + 1]!;
                        sb += small[i + 2]!;
                        sa += small[i + 3]!;
                    }
                    const o = row + x * 4;
                    tmp[o] = sr / n;
                    tmp[o + 1] = sg / n;
                    tmp[o + 2] = sb / n;
                    tmp[o + 3] = sa / n;
                }
            }
            for (let y = 0; y < h; y++) {
                const row = y * w * 4;
                for (let x = 0; x < w; x++) {
                    let sr = 0;
                    let sg = 0;
                    let sb = 0;
                    let sa = 0;
                    for (let dy = -rad; dy <= rad; dy++) {
                        const yy = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
                        const i = (yy * w + x) * 4;
                        sr += tmp[i]!;
                        sg += tmp[i + 1]!;
                        sb += tmp[i + 2]!;
                        sa += tmp[i + 3]!;
                    }
                    const o = row + x * 4;
                    out[o] = sr / n;
                    out[o + 1] = sg / n;
                    out[o + 2] = sb / n;
                    out[o + 3] = sa / n;
                }
            }
            small.set(out.subarray(0, byteLen));
        } finally {
            releaseClamped(tmp);
            releaseClamped(out);
        }
    }
    const g = gray < 0 ? 0 : gray > 1 ? 1 : gray;
    if (g > 0) {
        for (let i = 0; i < small.length; i += 4) {
            const r = small[i]!;
            const b = small[i + 2]!;
            const luma = 0.2126 * r + 0.7152 * small[i + 1]! + 0.0722 * b;
            if (g >= 1) {
                small[i] = luma;
                small[i + 1] = luma;
                small[i + 2] = luma;
            } else {
                const keep = 1 - g;
                small[i] = r * keep + luma * g;
                small[i + 1] = small[i + 1]! * keep + luma * g;
                small[i + 2] = b * keep + luma * g;
            }
        }
    }
    return { width: w, height: h, data: small };
}
