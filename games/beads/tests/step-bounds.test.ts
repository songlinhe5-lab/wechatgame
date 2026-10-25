import { describe, expect, it } from 'vitest';
import { stepBounds } from '../src/game/step-bounds.js';

/**
 * WXG-T-391 · 最少步数**下界**（`game/step-bounds.ts`）。
 *
 * 判据点：下界必须**可证**（不高估），且两条来源（珠组 / 需求区域）取 max；
 * ⛔ 容量 k 不参与下界（搬珠单步可远超 k）——这条用「大盘 + 小 k」用例钉住。
 */

const lv = (pattern: string[], misplaced?: string[], swaps?: (readonly [number, number, number, number])[]) =>
    ({ pattern, misplaced, swaps: swaps ?? [] }) as never;

describe('stepBounds', () => {
    it('全就位 ⇒ LB 0', () => {
        const b = stepBounds(lv(['11', '11'], ['11', '11']));
        expect(b.misplaced).toBe(0);
        expect(b.lowerBound).toBe(0);
    });

    it('缺省 misplaced ⇒ 走 swaps 路径，与等效 misplaced 同界', () => {
        const viaSwaps = stepBounds(lv(['12', '11'], undefined, [[0, 0, 0, 1]]));
        const viaMisplaced = stepBounds(lv(['12', '11'], ['21', '11']));
        expect(viaSwaps.misplaced).toBe(2);
        expect(viaSwaps).toEqual(viaMisplaced);
    });

    it('同一块错位珠 ⇒ 珠组 1（不是按颗数）', () => {
        const b = stepBounds(lv(['11', '11'], ['22', '11']));
        expect(b.misplaced).toBe(2);
        expect(b.beadGroups).toBe(1);
        expect(b.lowerBound).toBe(1);
    });

    it('被空格切开的两块错位珠 ⇒ 珠组 2、区域 2', () => {
        const b = stepBounds(lv(['1.1'], ['2.2']));
        expect(b.misplaced).toBe(2);
        expect(b.beadGroups).toBe(2);
        expect(b.targetGroups).toBe(2);
        expect(b.lowerBound).toBe(2);
    });

    it('同色大块整片错位：珠组 1、区域 1 ⇒ LB 1（⛔ 与容量无关，k=1 也仍是 1）', () => {
        const rows = ['1111', '1111', '1111'];
        const mis = ['2222', '1111', '1111'];
        const b = stepBounds(lv(rows, mis));
        expect(b.misplaced).toBe(4);
        expect(b.beadGroups).toBe(1);
        expect(b.lowerBound).toBe(1);
        expect(b.note).toContain('容量不参与');
    });

    it('取两条下界的较大者', () => {
        // 2x2 全错位：珠色 2 在上排（1 组）、需求色各成一块，故 max 取区域数
        const b = stepBounds(lv(['11', '11'], ['22', '22']));
        expect(b.beadGroups).toBe(1);
        expect(b.targetGroups).toBe(1);
        expect(b.lowerBound).toBe(1);
    });
});
