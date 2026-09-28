/**
 * `[WXG-T-220 / ADR-0025]` Canvas2D implementation of `BakeSurface`.
 *
 * Renders a bead vector recipe onto an offscreen canvas, then extracts the
 * raw pixel data as a `BakeResult`. The recipe is injected as a function so
 * the framework doesn't need to know about `drawFilledBead` (which lives in
 * the beads game package).
 *
 * Architecture:
 * ```
 * recipe(builder, styleId, colorIdx, size)
 *   → RenderModel (vector commands)
 *   → Canvas2DRenderer → offscreen canvas
 *   → getImageData() → BakeResult (raw RGBA)
 * ```
 *
 * The canvas factory is also injected (structural typing, matching the
 * codebase convention of not importing lib.dom in the framework).
 */

import { RenderModelBuilder } from '../../core/render/render-model';
import { Viewport } from '../../core/render/viewport';
import { Canvas2DRenderer } from './canvas2d-renderer';
import type { BakeResult, BakeSurface } from '../../core/bake/bake-surface';

/**
 * A recipe that draws a bead onto a `RenderModelBuilder`.
 *
 * The recipe is responsible for emitting all the vector commands needed to
 * render the bead (body, highlights, bevel, etc.). The hole is NOT part of
 * the bake (ADR-0025 DEC-3: hole stays live).
 */
export type BeadRecipe = (
    builder: RenderModelBuilder,
    styleId: string,
    colorIdx: number,
    size: number,
) => void;

/**
 * Minimal offscreen canvas subset for baking. Structural-typed so real
 * `OffscreenCanvas` / `document.createElement('canvas')` / wx offscreen
 * canvas all satisfy it without importing lib.dom.
 */
export interface BakeCanvasLike {
    width: number;
    height: number;
    getContext(contextId: '2d'): BakeContext2DLike | null;
}

/** Minimal 2D context subset needed for baking + pixel extraction. */
export interface BakeContext2DLike {
    clearRect(x: number, y: number, w: number, h: number): void;
    getImageData(sx: number, sy: number, sw: number, sh: number): { data: Uint8ClampedArray };
    // The Canvas2DRenderer needs the full Canvas2DLike, but for baking we
    // create a context that satisfies both. We declare the intersection below.
}

/** Factory that creates offscreen canvases for baking. */
export interface BakeCanvasFactory {
    createCanvas(width: number, height: number): BakeCanvasLike;
}

/**
 * Canvas2D BakeSurface implementation.
 *
 * Usage (harness / browser):
 * ```ts
 * const surface = new Canvas2DBakeSurface(
 *   (w, h) => document.createElement('canvas', { width: w, height: h }) as any,
 *   (builder, styleId, colorIdx, size) => {
 *     drawFilledBead(builder, size / 2, size / 2, colorIdx, { size });
 *   },
 * );
 * const result = surface.bake('facet-4', 1, 112);
 * // result.data = Uint8Array(112 * 112 * 4) — raw RGBA pixels
 * ```
 */
export class Canvas2DBakeSurface implements BakeSurface {
    constructor(
        private readonly _canvasFactory: BakeCanvasFactory,
        private readonly _recipe: BeadRecipe,
    ) { }

    bake(styleId: string, colorIdx: number, size: number): BakeResult {
        // 1. Build the vector model via the injected recipe.
        const builder = new RenderModelBuilder(size, size);
        builder.begin(); // no background (transparent)
        this._recipe(builder, styleId, colorIdx, size);
        const model = builder.end();

        // 2. Create an offscreen canvas and render the model onto it.
        const canvas = this._canvasFactory.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        // Defensive: structural type guarantees getContext('2d') returns non-null.
        if (!ctx) {
            throw new Error('[Canvas2DBakeSurface] createCanvas returned a canvas without 2d context');
        }

        // Use the Canvas2DRenderer to paint the vector commands. We enable the
        // viewport transform so the texture is pre-flipped to y-up orientation.
        // The blit handler in the consumer renderer will flip it back (y-up →
        // y-down for Canvas drawImage), producing a right-side-up result.
        // No letterbox needed: the canvas is exactly `size × size`, and the
        // default fit (scale=1, offset=0) maps 1:1 after the y-flip.
        const viewport = new Viewport(size, size);
        const renderer = new Canvas2DRenderer(ctx as any, viewport, {
            applyViewportTransform: true,
            pixelRatio: 1,
        });
        ctx.clearRect(0, 0, size, size);
        renderer.draw(model);

        // 3. Extract raw RGBA pixel data.
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = new Uint8Array(imageData.data.buffer.slice(
            imageData.data.byteOffset,
            imageData.data.byteOffset + imageData.data.byteLength,
        ));

        return { width: size, height: size, data };
    }
}
