/**
 * `[WXG-T-220 / ADR-0025 §4.2]` Byte budget estimation and cache counters.
 *
 * The budget tracks how much memory the baked texture cache consumes. Each
 * baked texture's size is estimated as `width × height × 4` (RGBA bytes).
 * The LRU cache uses this to enforce a byte-cap eviction policy.
 *
 * Counters (`hitCount`, `missCount`, `evictCount`) are exposed as scalar
 * getters (not an object) to avoid per-frame allocation on the hot path
 * (ADR-0024 §10-Q1(a) pattern: counters live in production code).
 */

/**
 * Estimate the memory footprint of a baked texture in bytes.
 *
 * Assumes RGBA 8-bit per channel (4 bytes per pixel). This is an upper bound;
 * actual GPU memory may differ due to compression, but it is sufficient for
 * cache budgeting purposes (ADR-0025 §4.2 L1 budget ≈ 2.5 MB).
 *
 * @param width  Texture width in pixels.
 * @param height Texture height in pixels.
 * @returns Estimated byte count.
 */
export function estimateTextureSize(width: number, height: number): number {
    return width * height * 4;
}

/**
 * Default L1 memory budget for the bake cache (ADR-0025 §4.2).
 *
 * 2.5 MB = 2,621,440 bytes. At 112×112×4 ≈ 50 KB per texture, this holds
 * about 50 textures. The budget is configurable via `BakeLruOptions`.
 */
export const DEFAULT_BAKE_BUDGET_BYTES = 2.5 * 1024 * 1024;

/**
 * Mutable counters for cache telemetry. Exposed as a class (not a plain
 * object) so the LRU can increment in-place without allocation.
 *
 * Hot-path zero-allocation: the counters are plain number fields, read by
 * scalar getters. No object is created per access.
 */
export class BakeCacheCounters {
    private _hits = 0;
    private _misses = 0;
    private _evictions = 0;

    /** Number of cache hits (texture found in LRU). */
    get hitCount(): number { return this._hits; }

    /** Number of cache misses (texture not found, had to bake). */
    get missCount(): number { return this._misses; }

    /** Number of evictions (texture removed to make room). */
    get evictCount(): number { return this._evictions; }

    /** @internal Incremented by the LRU on cache hit. */
    recordHit(): void { this._hits++; }

    /** @internal Incremented by the LRU on cache miss. */
    recordMiss(): void { this._misses++; }

    /** @internal Incremented by the LRU on eviction. */
    recordEviction(): void { this._evictions++; }

    /** Reset all counters to zero (e.g. between test runs). */
    reset(): void {
        this._hits = 0;
        this._misses = 0;
        this._evictions = 0;
    }
}
