/**
 * `[WXG-T-280]` **nine-slice（九宫格拉伸）效果的生产侧 helper**。
 *
 * 权威键名登记 = `ADR-0029 §8.2`（与 `tint-composite.ts` 的 `base`/`strength` 同表）：
 * core 只定义**键名与构造**，⛔ 不实现任何拉伸绘制 —— 消费在 adapter：
 * - canvas2d：`tint-blit-resolver.ts` 把九段**预烘**成单张离屏纹理（renderer 零改动）；
 * - Cocos：`beads-blit-carrier.ts` 走引擎原生 `Sprite.Type.SLICED`（设 `SpriteFrame` border）。
 *
 * 键序由本模块级常量固定（ADR-0029 规则 4 ⇒ 同语义恒同 sha）。
 */

import type { BlitFx } from '../render/render-model.js';

/** 左/右（或 y 轴上下）端帽宽，**源纹理像素**。 */
export const NINE_SLICE_FX_CAP_X = 'nineSliceCapX';
/** 可选：上/下端帽高（源纹 px）；缺省 = 0（该轴整段拉伸）。 */
export const NINE_SLICE_FX_CAP_Y = 'nineSliceCapY';

/**
 * 构造九宫格 `fx`（生产侧唯一入口，⛔ 手写字面量对象）。
 *
 * @param capX 左右端帽宽（源纹 px，> 0）。
 * @param capY 上下端帽高（源纹 px）；不传 ⇒ 键**不出现**（不是 `undefined` 值，ADR-0029 规则 3）。
 */
export function nineSliceFx(capX: number, capY?: number): BlitFx {
    return capY === undefined
        ? { [NINE_SLICE_FX_CAP_X]: capX }
        : { [NINE_SLICE_FX_CAP_X]: capX, [NINE_SLICE_FX_CAP_Y]: capY };
}

/** 从 `fx` 读出九宫格参数；非九宫格命令 ⇒ `undefined`。 */
export function nineSliceFxRead(fx: BlitFx | undefined): { capX: number; capY: number } | undefined {
    if (fx === undefined) return undefined;
    const capX = fx[NINE_SLICE_FX_CAP_X];
    if (typeof capX !== 'number' || capX <= 0) return undefined;
    const capY = fx[NINE_SLICE_FX_CAP_Y];
    return { capX, capY: typeof capY === 'number' && capY > 0 ? capY : 0 };
}
