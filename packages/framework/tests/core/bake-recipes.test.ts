import { describe, expect, it } from 'vitest';
import {
    makeBeadRecipe,
    makeCellRecipe,
    type FilledBeadDraw,
    type TargetTileDraw,
    type EmptySocketDraw,
} from '../../src/core/bake/bake-recipes.js';
import { BAKE_SCHEMA_VERSION } from '../../src/core/bake/bake-schema-version.js';
import type { RenderModelBuilder } from '../../src/core/render/render-model.js';

// The recipe factories take injected draw functions; framework tests cannot
// import the beads game module (L2). We assert the *call contract* — the exact
// arguments the factory hands to the injected draw — which IS the 同源 guarantee:
// studio + runtime feed the same drawFilledBead/drawTargetTile/drawEmptySocket
// into these factories, so identical args ⇒ identical command sequence.

describe('makeBeadRecipe', () => {
    it('calls draw at canvas center with { size, styleId } (byte-identical to manual)', () => {
        const calls: Array<{ cx: number; cy: number; ci: number; opts: unknown }> = [];
        const draw: FilledBeadDraw = (_b, cx, cy, ci, opts) => {
            calls.push({ cx, cy, ci, opts });
        };
        const recipe = makeBeadRecipe(draw);
        const fakeBuilder = {} as RenderModelBuilder;

        recipe(fakeBuilder, 'facet-4', 3, 112);

        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual({
            cx: 56,
            cy: 56,
            ci: 3,
            opts: { size: 112, styleId: 'facet-4' },
        });
    });

    it('is equivalent to the manual call the vector arm makes', () => {
        const manual: unknown[] = [];
        const viaRecipe: unknown[] = [];
        const record = (sink: unknown[]): FilledBeadDraw =>
            (_b, cx, cy, ci, opts) => sink.push([cx, cy, ci, opts]);

        const size = 112;
        // Manual: exactly what bake-experiment / runtime recipe does.
        record(manual)({} as RenderModelBuilder, size / 2, size / 2, 7, { size, styleId: 'lineart-18' });
        makeBeadRecipe(record(viaRecipe))({} as RenderModelBuilder, 'lineart-18', 7, size);

        expect(viaRecipe).toEqual(manual);
    });
});

describe('makeCellRecipe', () => {
    it('draws full-pitch tile then socket (tilePainted=true, scaled cell + inset)', () => {
        const tileCalls: Array<{ cx: number; cy: number; size: number; painted?: boolean }> = [];
        const socketCalls: Array<{ cellSize: number; ci: number | undefined; painted: boolean; inset: number }> = [];

        const drawTile: TargetTileDraw = (_b, cx, cy, _ci, _inks, size) => {
            tileCalls.push({ cx, cy, size });
        };
        const drawSocket: EmptySocketDraw = (_b, _cx, _cy, _p, size, ci, _inks, painted, inset) => {
            socketCalls.push({ cellSize: size, ci, painted, inset });
        };

        const recipe = makeCellRecipe(drawTile, drawSocket, {
            palette: {},
            inks: {},
            cellOfPitch: 30 / 32,
            insetOverPitch: 4 / 32,
        });
        recipe({} as RenderModelBuilder, 'ignored', 5, 112);

        expect(tileCalls).toEqual([{ cx: 56, cy: 56, size: 112 }]);
        expect(socketCalls).toEqual([{
            cellSize: 112 * (30 / 32),
            ci: 5,
            painted: true,
            inset: 112 * (4 / 32),
        }]);
    });

    it('ignores styleId (one cell face per color)', () => {
        const seen: number[] = [];
        const drawTile: TargetTileDraw = (_b, _cx, _cy, ci) => { seen.push(ci); };
        const recipe = makeCellRecipe(drawTile, () => { }, { palette: {}, inks: {}, cellOfPitch: 1, insetOverPitch: 0 });
        recipe({} as RenderModelBuilder, 'a', 2, 100);
        recipe({} as RenderModelBuilder, 'b', 2, 100);
        expect(seen).toEqual([2, 2]);
    });
});

describe('BAKE_SCHEMA_VERSION', () => {
    it('is a positive integer constant', () => {
        expect(Number.isInteger(BAKE_SCHEMA_VERSION)).toBe(true);
        expect(BAKE_SCHEMA_VERSION).toBeGreaterThan(0);
    });
});
