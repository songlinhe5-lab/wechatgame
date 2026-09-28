/**
 * `[WXG-T-221 / ADR-0027 DEC-4 / S3-lite]` Bake recipe factories.
 *
 * These factories let the studio pre-baker and the game runtime share ONE
 * recipe definition (同源 import 铁律 DEC-4): both feed the same
 * `drawFilledBead` / `drawTargetTile` / `drawEmptySocket` (from the beads game
 * package) into a recipe and hand the result to `Canvas2DBakeSurface`. The
 * framework never imports the game functions itself (L2: no game module in
 * `core/**`) — the caller injects them, structurally typed here.
 *
 * Recipe shape matches the adapter `BeadRecipe` contract
 * (`packages/framework/src/adapters/canvas2d/bake-surface-impl.ts`):
 * `(builder, styleId, colorIdx, size) => void`, structurally compatible.
 */

import type { RenderModelBuilder } from '../render/render-model';

/** A recipe that draws one texture (bead face or cell face) onto a builder. */
export type BeadBakeRecipe = (
    builder: RenderModelBuilder,
    styleId: string,
    colorIdx: number,
    size: number,
) => void;

/** Options a recipe passes through to the injected bead drawer (subset). */
export interface RecipeBeadDrawOptions {
    readonly size: number;
    readonly styleId: string;
    readonly hideHole?: boolean;
    readonly [key: string]: unknown;
}

/** Game-side `drawFilledBead` (structurally typed to keep core game-agnostic). */
export type FilledBeadDraw = (
    builder: RenderModelBuilder,
    cx: number,
    cy: number,
    colorIdx: number,
    options: RecipeBeadDrawOptions,
) => void;

/** Game-side `drawTargetTile` (B0 底图整格 rect). */
export type TargetTileDraw = (
    builder: RenderModelBuilder,
    cx: number,
    cy: number,
    colorIdx: number,
    inks: unknown,
    size: number,
) => void;

/** Game-side `drawEmptySocket` (凹槽，孔 live 不入烘焙). */
export type EmptySocketDraw = (
    builder: RenderModelBuilder,
    cx: number,
    cy: number,
    palette: unknown,
    size: number,
    colorIdx: number | undefined,
    inks: unknown,
    tilePainted: boolean,
    beadInset: number,
) => void;

/**
 * Build the **bead face** recipe (styleId × colorIdx).
 *
 * The emitted command sequence is byte-identical to a manual
 * `drawFilledBead(builder, size / 2, size / 2, colorIdx, { size, styleId })`
 * call — the same call the runtime vector arm makes, so a baked PNG and the
 * on-screen bead come from one source (同源判据，见 `bake-recipes.test.ts`).
 */
export function makeBeadRecipe(draw: FilledBeadDraw): BeadBakeRecipe {
    return (builder, styleId, colorIdx, size) => {
        draw(builder, size / 2, size / 2, colorIdx, { size, styleId });
    };
}

/** Tuning constants for the **cell face** recipe, expressed as design ratios. */
export interface CellRecipeOptions {
    /** Panel palette (`BeadsPalette`), used by `drawEmptySocket` neutral path. */
    readonly palette: unknown;
    /** Bead inks table (`BeadInks`) for the target color of the tile/socket. */
    readonly inks: unknown;
    /** `BEAD_CELL / BEAD_PITCH` (v1.57 = 30 / 32): socket cell edge over pitch. */
    readonly cellOfPitch: number;
    /** `BEAD_DRAW_INSET / BEAD_PITCH` (v1.57 = 4 / 32): bead inset over pitch. */
    readonly insetOverPitch: number;
}

/**
 * Build the **cell face** recipe (colorIdx only, 孔 live 不入烘焙).
 *
 * Composes the B0 底图 (`drawTargetTile`, full-pitch rect) + the empty socket
 * (`drawEmptySocket`, `tilePainted = true` so the socket skips its own base
 * block). The bead center hole is NOT part of the cell face — it stays live
 * (ADR-0025 DEC-3). `styleId` is ignored (a cell has one face per color).
 *
 * All geometry scales from the bake `size` (= one pitch in px) via the design
 * ratios in `opts`, so 112px and any other bake size render proportionally.
 */
export function makeCellRecipe(
    drawTile: TargetTileDraw,
    drawSocket: EmptySocketDraw,
    opts: CellRecipeOptions,
): BeadBakeRecipe {
    return (builder, _styleId, colorIdx, size) => {
        const cx = size / 2;
        const cy = size / 2;
        // B0 底图：满铺一个 pitch（tile 边长 = bake size），方角。
        drawTile(builder, cx, cy, colorIdx, opts.inks, size);
        // 凹槽：cellSize = pitch · (BEAD_CELL/BEAD_PITCH)，beadInset 同尺换算。
        const cellSize = size * opts.cellOfPitch;
        const beadInset = size * opts.insetOverPitch;
        drawSocket(builder, cx, cy, opts.palette, cellSize, colorIdx, opts.inks, true, beadInset);
    };
}
