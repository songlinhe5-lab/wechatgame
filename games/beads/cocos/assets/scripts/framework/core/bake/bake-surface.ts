/**
 * `[WXG-T-220 / ADR-0025 DEC-1]` Bake result type and BakeSurface interface.
 *
 * The `BakeResult` is the output of a bake operation: a texture described by
 * its dimensions and raw pixel data. The adapter layer (Canvas2D / wx
 * offscreen) is responsible for converting this into a format the renderer
 * can consume (e.g. `CanvasImageSource` for `drawImage`).
 *
 * The `BakeSurface` interface is the contract between the core cache layer
 * and the adapter-specific baker. The core layer never calls Canvas / WebGL
 * APIs directly (L2: no `cc` / DOM / `wx` in `core/**`).
 */

/**
 * The result of baking a single bead texture.
 *
 * The `data` field contains raw RGBA pixel data (4 bytes per pixel, row-major,
 * top-to-bottom). The adapter layer converts this to a platform-specific
 * texture (e.g. `ImageData` → `createImageBitmap` → Canvas drawImage).
 */
export interface BakeResult {
    /** Width in pixels. */
    readonly width: number;
    /** Height in pixels. */
    readonly height: number;
    /** Raw RGBA pixel data (length = width × height × 4). */
    readonly data: Uint8Array;
}

/**
 * Contract for the adapter-specific baker. The core cache layer calls
 * `bake()` on cache miss; the adapter renders the vector recipe into a
 * `BakeResult` using platform APIs (Canvas2D / wx offscreen).
 *
 * Implementations:
 *  - `Canvas2DBakeSurface` (harness + wx Canvas): renders via
 *    `drawFilledBead` → `getImageData` → `BakeResult`.
 *  - Cocos: not implemented this cycle (ADR-0025 §4.2).
 */
export interface BakeSurface {
    /**
     * Bake a single bead texture.
     *
     * @param styleId  Visual style identifier (e.g. 'facet-4').
     * @param colorIdx Color index into the bead inks table.
     * @param size     Bake size in pixels (ADR-0025 DEC-2: ≈112px at base).
     * @returns The baked texture result.
     */
    bake(styleId: string, colorIdx: number, size: number): BakeResult;
}
