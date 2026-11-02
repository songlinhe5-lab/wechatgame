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
 */

import type { BlitFx } from '../render/render-model.js';

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
