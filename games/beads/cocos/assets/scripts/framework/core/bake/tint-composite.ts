/**
 * `[WXG-T-226 EP12-B3 / ADR-0028 §2.1]` tint mask **合成数学**（纯函数，⛔ 无 DOM / 无 canvas）。
 *
 * ## 公式（三端同式：GPU shader / CPU 合成 / py 预览）
 *
 * `games/beads/cocos/assets/effects/tint-mask.effect`（frag）与
 * `tools/mask-preview/preview-combined.py:29-36`：
 * ```
 * out = base·d + (1−base)·l        alpha = shape
 * ```
 * 其中 mask 通道 = `R = d` / `G = l` / `B = shape` / `A = 255`（ADR-0028 §2.1）。
 *
 * ⚠ **`l` 不乘 shape（WXG-T-259 裁定「GPU 为准」）**：旧 CPU 式写作 `l·shape`，在
 * `shape ∈ (0,1)` 羽化带上多衰一次 ⇒ 珠 mask 1242 个半透明像素与真机 ΔRGB 最大 40.7/255（格 mask
 * 纯二值不受影响）。形状只进 alpha、亮度与 shape 无关才是 shader 口径。
 *
 * ## 两个刻意的取舍
 *
 * 1. **⛔ 不走 `globalCompositeOperation: multiply/screen`**：它在仓内**在役用量 = 0**，
 *    且 `wxg-t-228-tint-criteria.md:81` 明文「⛔ 禁把浏览器可用性外推为真机可用」⇒ 走 CPU 合成。
 * 2. **输出 straight alpha（非预乘）**：本函数的产物交给 `putImageData`，其契约是
 *    **非预乘** RGBA。浏览器展示时自行预乘（`rgb·a`）⇒ 与 shader 的 `vec4(outColor*alpha, alpha)` 等价。
 *    `shape = 0` 的像素额外清零 RGB —— 直通 alpha 下留残值会在浏览器内部预乘时产生边缘晕影。
 *
 * 数值口径：8-bit 量化误差 ±1/255（判据 `TC-TINT` 统计容差 ±2/255 覆盖）。
 */

import type { BlitFx } from '../render/render-model';

/* ── fx 键名权威（`ADR-0029 §8.2` 键名约定表的**代码侧正本**）───────────────
 *
 * 规则：`core` 只认「一个袋 + 键名不进类型」；**键名与语义住在效果模块**。
 * ⛔ 生产者一律用下面的具象化 helper，⛔ 不要手写字面量对象
 *    （手写会绕过键名检查，且键序不固定 ⇒ 同语义不同 sha）。
 */

/** 着色基色（hex）—— 原 `BlitCommand.tint` 的迁移目标（`ADR-0029 §8.2`）。 */
export const TINT_FX_BASE = 'base';
/** 着色强度 0–1（预留键，core 0 改动即可启用）。 */
export const TINT_FX_STRENGTH = 'strength';

/**
 * 构造「着色」效果的 `fx`（**具象化在此，不在 core**）。
 *
 * @param base 着色基色（hex 字符串；⛔ 不可解析时消费侧跳过该 blit，不抛）
 * @param strength 预留：0–1；省略 ⇒ 键**不出现**（⛔ 不写 `undefined`，见 `BlitFx` 规则 3）
 */
export function tintFx(base: string, strength?: number): BlitFx {
    return strength === undefined
        ? { [TINT_FX_BASE]: base }
        : { [TINT_FX_BASE]: base, [TINT_FX_STRENGTH]: strength };
}

/**
 * 从 `fx` 读出着色基色（消费侧用）。
 *
 * @returns hex 字符串；`fx` 缺 `base`、或 `base` 不是字符串（键名被误用）⇒ `undefined`
 *   ⇒ 调用方**跳过该 blit**（⛔ 不回落去贴裸 mask：那会用错色渲染）。
 */
export function tintFxBase(fx: BlitFx | undefined): string | undefined {
    if (fx === undefined) return undefined;
    const v = fx[TINT_FX_BASE];
    return typeof v === 'string' ? v : undefined;
}

/** 解析出的 sRGB 三元组（0..255，各通道独立）。 */
export interface TintRgb {
    readonly r: number;
    readonly g: number;
    readonly b: number;
}

const HEX_DIGITS = '0123456789abcdef';

/** ⛔ 非丢弃路径：不可解析的颜色返回 `undefined` ⇒ 调用方**跳过该 blit**（与纹理缺失同处理）。 */
export function parseTintColor(tint: string): TintRgb | undefined {
    if (tint.length === 7 && tint.charCodeAt(0) === 35 /* # */) {
        return {
            r: hex2(tint, 1),
            g: hex2(tint, 3),
            b: hex2(tint, 5),
        };
    }
    if (tint.length === 4 && tint.charCodeAt(0) === 35) {
        // #rgb ⇒ 每位自我复制（#abc ≡ #aabbcc）
        return {
            r: hex1(tint, 1) * 17,
            g: hex1(tint, 2) * 17,
            b: hex1(tint, 3) * 17,
        };
    }
    return undefined;
}

function hex1(s: string, i: number): number {
    return HEX_DIGITS.indexOf(s[i]!.toLowerCase());
}

function hex2(s: string, i: number): number {
    return hex1(s, i) * 16 + hex1(s, i + 1);
}

/**
 * 就地把一张 d/l/shape mask 合成为 sprite 像素（straight alpha）。
 *
 * @param dst 目标缓冲（长度 ≥ `mask.length`，RGBA 交错）
 * @param mask 源 mask 像素（`R = d` / `G = l` / `B = shape`）
 * @param rgb 合成基色（tint 本色）
 *
 * ⛔ **逐位对齐**：`dst.length` 与 `mask.length` 不等时按 `mask.length` 走（短的一方截断），
 * 调用方（`TintSpriteCache`）保证两者同长 ⇒ 热路径无分支成本。
 */
export function compositeTintMask(
    dst: Uint8ClampedArray,
    mask: Uint8ClampedArray,
    rgb: TintRgb,
): void {
    const n = mask.length < dst.length ? mask.length : dst.length;
    const br = rgb.r / 255;
    const bg = rgb.g / 255;
    const bb = rgb.b / 255;
    for (let i = 0; i < n; i += 4) {
        const shape = mask[i + 2]! / 255;
        if (shape === 0) {
            // 孔区真透（DEC-2）⇒ 像素全透明；RGB 必须清零，否则内预乘出边缘晕影。
            dst[i] = 0;
            dst[i + 1] = 0;
            dst[i + 2] = 0;
            dst[i + 3] = 0;
            continue;
        }
        const d = mask[i]! / 255;
        const ls = mask[i + 1]! / 255;
        dst[i] = Math.round((br * d + (1 - br) * ls) * 255);
        dst[i + 1] = Math.round((bg * d + (1 - bg) * ls) * 255);
        dst[i + 2] = Math.round((bb * d + (1 - bb) * ls) * 255);
        dst[i + 3] = Math.round(shape * 255);
    }
}
