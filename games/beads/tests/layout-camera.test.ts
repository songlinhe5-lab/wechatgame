/**
 * WXG-T-169 / ADR-0015 丁-3 「布局即相机」核心防线：
 *
 *  1. 回环（`gridLayoutFor` 相机档 → `Viewport.designToScreen` →
 *     `Viewport.screenToDesign` → `hitGridCell` → 必得原格）——
 *     证明缩放/平移后触摸到格子的路径与恒等档严格同源，
 *     不引入「画出的框 ≠ 点击落点」的第二套坐标（K-054 型真机偏移类）。
 *  2. 恒等档回归锚：`gridLayoutFor(c, r)` 与 `gridLayoutFor(c, r, IDENTITY_CAMERA)`
 *     逐位相同（旧关卡 / 快照差分 / 断言零漂移，向后兼容底线）。
 *  3. 反例自检（K-036）：故意写一份「半径不随缩放」的 hitGridCell 变体 ⇒
 *     在 zoom=1.5 必现死缝 → 反证半径必须缩放。不红说明用例没判别力。
 *
 * DPR 显式桩：不读环境 `devicePixelRatio`（不同 CI/浏览器会变，读了断言就退化成
 * 恒真）；只测 2 与 3 封顶档（ADR-0011 §3(d) 判例）。
 */
import { describe, expect, it } from 'vitest';
import { Viewport } from '@wxgame/framework';
import {
    DESIGN_W,
    DESIGN_H,
    GRID_HIT_SIZE,
    gridLayoutFor,
    hitGridCell,
    IDENTITY_CAMERA,
    type BoardCamera,
} from '../src/config/tuning.js';

const COLS = 8;
const ROWS = 6;

function makeViewport(dpr: number): Viewport {
    const v = new Viewport(DESIGN_W, DESIGN_H);
    // Portrait 屏尺寸 = 设计 × dpr ⇒ contain/letterbox scale 恰为 dpr（回环无残余缩放偏移）。
    v.resize(DESIGN_W * dpr, DESIGN_H * dpr);
    return v;
}

describe('layout⇄hit 回环（WXG-T-169 / ADR-0015 丁-3）', () => {
    const CAMERAS: Array<[label: string, cam: BoardCamera]> = [
        ['identity', { zoom: 1, offsetX: 0, offsetY: 0 }],
        ['zoom=1.5 无平移', { zoom: 1.5, offsetX: 0, offsetY: 0 }],
        ['zoom=1.5 平移 (-60,40)', { zoom: 1.5, offsetX: -60, offsetY: 40 }],
        ['zoom=2 平移 (100,-80)', { zoom: 2, offsetX: 100, offsetY: -80 }],
        ['zoom=0.85 缩小', { zoom: 0.85, offsetX: 0, offsetY: 0 }],
    ];

    for (const dpr of [2, 3]) {
        for (const [label, cam] of CAMERAS) {
            it(`${label} @ dpr=${dpr} 每一格 screenToDesign(designToScreen(centre)) → hit 回原格`, () => {
                const v = makeViewport(dpr);
                const layout = gridLayoutFor(COLS, ROWS, cam);
                const tmp = { x: 0, y: 0 };
                for (let i = 0; i < ROWS; i++) {
                    for (let j = 0; j < COLS; j++) {
                        const cx = layout.colCenterX(j);
                        const cy = layout.rowCenterY(i);
                        v.designToScreen(tmp, cx, cy);
                        // 触摸到达时坐标已在 screen 空间；归回 design 空间送 hit。
                        v.screenToDesign(tmp, tmp.x, tmp.y);
                        const cell = hitGridCell(layout, cam.zoom, tmp.x, tmp.y);
                        expect(cell).not.toBeNull();
                        expect(cell!.row).toBe(i);
                        expect(cell!.col).toBe(j);
                    }
                }
            });
        }
    }
});

describe('恒等档回归锚 — gridLayoutFor(c,r) === gridLayoutFor(c,r,IDENTITY_CAMERA)', () => {
    const SIZES: Array<[number, number]> = [
        [6, 5],
        [8, 6],
        [13, 12],
        [12, 12],
    ];
    for (const [c, r] of SIZES) {
        it(`${c}×${r} 逐位相同`, () => {
            const a = gridLayoutFor(c, r);
            const b = gridLayoutFor(c, r, IDENTITY_CAMERA);
            expect(b.left).toBe(a.left);
            expect(b.top).toBe(a.top);
            expect(b.bottom).toBe(a.bottom);
            expect(b.cols).toBe(a.cols);
            expect(b.rows).toBe(a.rows);
            for (let j = 0; j < c; j++) expect(b.colCenterX(j)).toBe(a.colCenterX(j));
            for (let i = 0; i < r; i++) expect(b.rowCenterY(i)).toBe(a.rowCenterY(i));
        });
    }
});

describe('反例自检（K-036）— 半径不随缩必红', () => {
    it('zoom=1.5 相邻格心之间中点：真半径命中近心，「固定 66」半径必现死缝', () => {
        const cam: BoardCamera = { zoom: 1.5, offsetX: 0, offsetY: 0 };
        const layout = gridLayoutFor(6, 5, cam);
        // pitch′ = 52 · 1.5 = 78；真半径 = 66 · 1.5 / 2 = 49.5 > 39（半距）；
        // 反例半径 = 66 / 2 = 33 < 39 ⇒ 中点两心皆不可达 → null。
        const midX = (layout.colCenterX(0) + layout.colCenterX(1)) / 2;
        const y = layout.rowCenterY(0);

        // 真：必命中 col 0 或 1（ties→earlier → col 0）。
        const real = hitGridCell(layout, 1.5, midX, y);
        expect(real).not.toBeNull();
        expect(real!.col).toBe(0);
        expect(real!.row).toBe(0);

        // 反例：一份半径「不随缩放」的内联拷贝。
        const buggyHalf = GRID_HIT_SIZE / 2;
        let found: { row: number; col: number } | null = null;
        let bestD2 = buggyHalf * buggyHalf;
        for (let i = 0; i < layout.rows; i++) {
            for (let j = 0; j < layout.cols; j++) {
                const dx = midX - layout.colCenterX(j);
                const dy = y - layout.rowCenterY(i);
                const d2 = dx * dx + dy * dy;
                if (d2 < bestD2) {
                    bestD2 = d2;
                    found = { row: i, col: j };
                }
            }
        }
        // 反例证否：若不随缩，zoom=1.5 时相邻格心之间必现死缝，此断言若变红
        // 说明 hitGridCell 忘了随缩——正是本用例存在的目的。
        expect(found).toBeNull();
    });
});
