import { describe, expect, it } from 'vitest';
import {
    FROST_FX_KEY,
    GRAY_FX_KEY,
    GRAY_WIPE_FX_KEY,
    frostFx,
    frostPixels,
    frostRead,
    grayFx,
    grayFxRead,
    grayWipeFx,
    grayWipeRead,
} from '../../src/core/bake/gray-fx.js';

/**
 * `[WXG-T-566 / WXG-T-567]` 灰度 / 揭彩 / 磨砂 fx 的键名 / 夹取 / JSON 安全性判据。
 *
 * `BlitFx` 会被 `JSON.stringify` 后取 sha（`ADR-0026` J-1）⇒ 键名、键序、值域都是硬契约，
 * 本测试锁的正是这三条（⛔ 不是同义反复）。
 */

describe('grayFx', () => {
    it('建单键、键序固定、JSON 安全', () => {
        expect(grayFx(0.55)).toEqual({ gray: 0.55 });
        expect(JSON.stringify(grayFx(1))).toBe('{"gray":1}');
        expect(GRAY_FX_KEY).toBe('gray');
    });

    it('越界夹取到 [0,1]', () => {
        expect(grayFx(1.5)).toEqual({ gray: 1 });
        expect(grayFx(-0.2)).toEqual({ gray: 0 });
        expect(grayFx(Number.POSITIVE_INFINITY)).toEqual({ gray: 1 });
    });

    it('`0` 也照常建键（是否跳过由消费侧决定）', () => {
        expect(grayFx(0)).toEqual({ gray: 0 });
    });
});

describe('grayFxRead', () => {
    it('缺省 / 无键 / 非数字 ⇒ undefined', () => {
        expect(grayFxRead(undefined)).toBeUndefined();
        expect(grayFxRead({})).toBeUndefined();
        expect(grayFxRead({ gray: '1' })).toBeUndefined();
        expect(grayFxRead({ gray: Number.NaN })).toBeUndefined();
    });

    it('读回构造值', () => {
        expect(grayFxRead(grayFx(0.55))).toBe(0.55);
        expect(grayFxRead({ gray: 1 })).toBe(1);
    });
});

describe('grayWipeFx', () => {
    it('建单键、载荷 [progress, soft]、JSON 安全', () => {
        expect(grayWipeFx(0.5, 0.08)).toEqual({ grayWipe: [0.5, 0.08] });
        expect(JSON.stringify(grayWipeFx(0, 0))).toBe('{"grayWipe":[0,0]}');
        expect(GRAY_WIPE_FX_KEY).toBe('grayWipe');
    });

    it('两值都夹取到 [0,1]', () => {
        expect(grayWipeFx(-1, 2)).toEqual({ grayWipe: [0, 1] });
        expect(grayWipeFx(2, -1)).toEqual({ grayWipe: [1, 0] });
    });
});

describe('grayWipeRead', () => {
    it('缺省 / 非数组 / 短板 / 非数字 ⇒ undefined', () => {
        expect(grayWipeRead(undefined)).toBeUndefined();
        expect(grayWipeRead({})).toBeUndefined();
        expect(grayWipeRead({ grayWipe: 'x' })).toBeUndefined();
        expect(grayWipeRead({ grayWipe: [0.5] })).toBeUndefined();
        expect(grayWipeRead({ grayWipe: [Number.NaN, 0.08] })).toBeUndefined();
        expect(grayWipeRead({ grayWipe: [0.5, Number.POSITIVE_INFINITY] })).toBeUndefined();
    });

    it('读回构造值', () => {
        expect(grayWipeRead(grayWipeFx(0.375, 0.08))).toEqual([0.375, 0.08]);
        expect(grayWipeRead({ grayWipe: [1, 0] })).toEqual([1, 0]);
    });
});

describe('frostFx', () => {
    it('建单键、JSON 安全、键名固定', () => {
        expect(frostFx(8)).toEqual({ frost: 8 });
        expect(JSON.stringify(frostFx(8))).toBe('{"frost":8}');
        expect(FROST_FX_KEY).toBe('frost');
    });

    it('越界夹取到 [0,32]，`0` 也照常建键', () => {
        expect(frostFx(-1)).toEqual({ frost: 0 });
        expect(frostFx(40)).toEqual({ frost: 32 });
        expect(frostFx(Number.POSITIVE_INFINITY)).toEqual({ frost: 32 });
    });
});

describe('frostRead', () => {
    it('缺省 / 非数字 ⇒ undefined', () => {
        expect(frostRead(undefined)).toBeUndefined();
        expect(frostRead({})).toBeUndefined();
        expect(frostRead({ frost: '8' })).toBeUndefined();
        expect(frostRead({ frost: Number.NaN })).toBeUndefined();
    });

    it('读回构造值', () => {
        expect(frostRead(frostFx(8))).toBe(8);
        expect(frostRead({ frost: 0 })).toBe(0);
    });
});

describe('frostPixels', () => {
    /** 8×8：左半红、右半蓝 ⇒ 4× 下采样正好 2×2 两格纯色。 */
    const halves = (): Uint8ClampedArray => {
        const data = new Uint8ClampedArray(8 * 8 * 4);
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const i = (y * 8 + x) * 4;
                const red = x < 4;
                data[i] = red ? 255 : 0;
                data[i + 1] = 0;
                data[i + 2] = red ? 0 : 255;
                data[i + 3] = 255;
            }
        }
        return data;
    };

    it('1/4 块平均 + 全灰（radius 0 只下采样）', () => {
        const out = frostPixels(halves(), 8, 8, 0);
        expect(out.width).toBe(2);
        expect(out.height).toBe(2);
        // 红 luma = 54.213 → 54；蓝 luma = 18.411 → 18；alpha 保留
        expect(Array.from(out.data)).toEqual([54, 54, 54, 255, 18, 18, 18, 255,
            54, 54, 54, 255, 18, 18, 18, 255]);
    });

    it('半径 8（源 px）= 1/4 网格 r=2 ⇒ 左右格各得 3:2 权重（边缘夹取），alpha 保留', () => {
        const out = frostPixels(halves(), 8, 8, 8);
        // x=0 采样列 0,0,0,1,1 ⇒ (153,102) → luma 39.9 = 40；x=1 ⇒ (102,153) → 32.7 = 33
        expect(Array.from(out.data)).toEqual([40, 40, 40, 255, 33, 33, 33, 255,
            40, 40, 40, 255, 33, 33, 33, 255]);
    });

    it('非 4 倍数尺寸 ⇒ 1/4 向下取整（5×5 ⇒ 1×1）', () => {
        const data = new Uint8ClampedArray(5 * 5 * 4).fill(255);
        const out = frostPixels(data, 5, 5, 0);
        expect(out.width).toBe(1);
        expect(out.height).toBe(1);
        expect(Array.from(out.data)).toEqual([255, 255, 255, 255]);
    });
});
