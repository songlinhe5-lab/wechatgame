import { describe, expect, it } from 'vitest';
import { Canvas2DBakeSurface, type BakeCanvasFactory, type BakeCanvasLike, type BakeContext2DLike } from '../../src/adapters/canvas2d/bake-surface-impl.js';
import type { RenderModelBuilder } from '../../src/core/render/render-model.js';
import type { Canvas2DLike } from '../../src/adapters/canvas2d/canvas2d-renderer.js';

/**
 * Minimal mock canvas + context for testing Canvas2DBakeSurface.
 * Records recipe invocations and returns a zero-filled pixel buffer.
 */
function mockCanvasFactory(): {
    factory: BakeCanvasFactory;
    recipeCalls: Array<{ styleId: string; colorIdx: number; size: number }>;
} {
    const recipeCalls: Array<{ styleId: string; colorIdx: number; size: number }> = [];

    const factory: BakeCanvasFactory = {
        createCanvas(width: number, height: number): BakeCanvasLike {
            // Build a mock context that satisfies both BakeContext2DLike and Canvas2DLike.
            const pixelData = new Uint8ClampedArray(width * height * 4);
            const ctx: BakeContext2DLike & Partial<Canvas2DLike> = {
                clearRect() { /* noop */ },
                getImageData(_sx: number, _sy: number, _sw: number, _sh: number) {
                    return { data: pixelData };
                },
                // Canvas2DLike surface (the renderer draws into these):
                save() { /* noop */ },
                restore() { /* noop */ },
                setTransform() { /* noop */ },
                fillRect() { /* noop */ },
                beginPath() { /* noop */ },
                closePath() { /* noop */ },
                rect() { /* noop */ },
                arc() { /* noop */ },
                moveTo() { /* noop */ },
                lineTo() { /* noop */ },
                translate() { /* noop */ },
                scale() { /* noop */ },
                fill() { /* noop */ },
                stroke() { /* noop */ },
                fillText() { /* noop */ },
                fillStyle: '',
                strokeStyle: '',
                lineWidth: 0,
                globalAlpha: 1,
                font: '',
                textAlign: '',
                textBaseline: '',
            };
            return {
                width,
                height,
                getContext(_id: '2d') { return ctx; },
            };
        },
    };

    return { factory, recipeCalls };
}

/** A simple recipe that records its invocations and emits a rect. */
function recordingRecipe(
    calls: Array<{ styleId: string; colorIdx: number; size: number }>,
) {
    return (builder: RenderModelBuilder, styleId: string, colorIdx: number, size: number): void => {
        calls.push({ styleId, colorIdx, size });
        builder.rect(0, 0, size, size, { fill: '#f00' });
    };
}

describe('Canvas2DBakeSurface', () => {
    it('calls the recipe with correct arguments', () => {
        const { factory, recipeCalls } = mockCanvasFactory();
        const surface = new Canvas2DBakeSurface(factory, recordingRecipe(recipeCalls));

        surface.bake('facet-4', 2, 64);

        expect(recipeCalls).toHaveLength(1);
        expect(recipeCalls[0]).toEqual({ styleId: 'facet-4', colorIdx: 2, size: 64 });
    });

    it('returns a BakeResult with correct dimensions and data length', () => {
        const { factory } = mockCanvasFactory();
        const surface = new Canvas2DBakeSurface(factory, (_b, _s, _c, _sz) => { });

        const result = surface.bake('facet-4', 0, 112);

        expect(result.width).toBe(112);
        expect(result.height).toBe(112);
        expect(result.data).toBeInstanceOf(Uint8Array);
        expect(result.data.length).toBe(112 * 112 * 4);
    });

    it('creates a canvas with the requested size', () => {
        let createdWidth = 0;
        let createdHeight = 0;
        const factory: BakeCanvasFactory = {
            createCanvas(w: number, h: number) {
                createdWidth = w;
                createdHeight = h;
                // Return a minimal canvas-like.
                const ctx = {
                    clearRect() { }, getImageData() { return { data: new Uint8ClampedArray(w * h * 4) }; },
                    save() { }, restore() { }, setTransform() { }, fillRect() { },
                    beginPath() { }, closePath() { }, rect() { }, arc() { },
                    moveTo() { }, lineTo() { }, translate() { }, scale() { },
                    fill() { }, stroke() { }, fillText() { },
                    fillStyle: '', strokeStyle: '', lineWidth: 0, globalAlpha: 1,
                    font: '', textAlign: '', textBaseline: '',
                };
                return { width: w, height: h, getContext: () => ctx };
            },
        };
        const surface = new Canvas2DBakeSurface(factory, () => { });
        surface.bake('x', 0, 48);

        expect(createdWidth).toBe(48);
        expect(createdHeight).toBe(48);
    });

    it('integrates with BakeLru (end-to-end stub)', async () => {
        // Verify the Canvas2DBakeSurface satisfies the BakeSurface interface
        // and can be plugged into BakeLru.
        const { BakeLru } = await import('../../src/core/bake/bake-lru.js');
        const { factory } = mockCanvasFactory();
        const surface = new Canvas2DBakeSurface(factory, (_b, _s, _c, _sz) => { });

        const lru = new BakeLru(surface, { budgetBytes: 256 * 1024 });
        const result = lru.getOrBake(
            { styleId: 'facet-4', colorIdx: 0, bakeSchemaVersion: 1 },
            16,
        );

        expect(result.width).toBe(16);
        expect(result.height).toBe(16);
        expect(lru.missCount).toBe(1);

        // Second access: cache hit.
        const cached = lru.getOrBake(
            { styleId: 'facet-4', colorIdx: 0, bakeSchemaVersion: 1 },
            16,
        );
        expect(cached).toBe(result);
        expect(lru.hitCount).toBe(1);
    });
});
