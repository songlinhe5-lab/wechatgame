import { describe, expect, it } from 'vitest';
import {
    GRAY_FX_KEY,
    GRAY_WIPE_FX_KEY,
    grayFx,
    grayFxRead,
    grayWipeFx,
    grayWipeRead,
} from '../../src/core/bake/gray-fx.js';

/**
 * `[WXG-T-566]` 灰度 fx 的键名 / 夹取 / JSON 安全性判据。
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
