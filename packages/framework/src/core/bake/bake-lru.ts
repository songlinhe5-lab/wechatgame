/**
 * `[WXG-T-220 / ADR-0025 DEC-1]` LRU cache for baked bead textures.
 *
 * The cache stores `BakeResult` entries keyed by the deterministic key from
 * `deriveKey()`. Eviction is by byte budget: when adding a new entry would
 * exceed the budget, the least-recently-used entries are evicted until there
 * is room.
 *
 * Design choices:
 *  - **Map-based**: insertion order in JS Map is guaranteed, so we use Map
 *    iteration order as the LRU order (most-recent at end). No doubly-linked
 *    list needed — the cache is small (≈50 entries max at 2.5 MB budget).
 *  - **Byte-cap eviction**: not count-based. A 112×112 RGBA texture ≈ 50 KB;
 *    the default 2.5 MB budget holds ≈50 textures. Eviction only triggers
 *    when the byte sum exceeds the cap.
 *  - **Counters**: hit/miss/eviction counts are tracked via `BakeCacheCounters`
 *    (scalar getters, no per-access allocation).
 */

import { type BakeKeyInputs, deriveKey } from './bake-key.js';
import { type BakeResult, type BakeSurface } from './bake-surface.js';
import { estimateTextureSize, DEFAULT_BAKE_BUDGET_BYTES, BakeCacheCounters } from './bake-budget.js';

/** Options for constructing a `BakeLru`. */
export interface BakeLruOptions {
    /** Maximum byte budget for the cache (default: 2.5 MB). */
    readonly budgetBytes?: number;
}

/** Internal cache entry. */
interface CacheEntry {
    readonly key: string;
    readonly result: BakeResult;
    readonly sizeBytes: number;
}

/**
 * LRU cache for baked bead textures.
 *
 * Usage:
 * ```ts
 * const cache = new BakeLru(bakeSurface, { budgetBytes: 2.5 * 1024 * 1024 });
 * const result = cache.getOrBake({ styleId: 'facet-4', colorIdx: 1, bakeSchemaVersion: 1 });
 * // result is a BakeResult — either from cache (hit) or freshly baked (miss).
 * ```
 */
export class BakeLru {
    private readonly _map = new Map<string, CacheEntry>();
    private readonly _budgetBytes: number;
    private _usedBytes = 0;
    private readonly _counters = new BakeCacheCounters();

    constructor(
        private readonly _surface: BakeSurface,
        options: BakeLruOptions = {},
    ) {
        this._budgetBytes = options.budgetBytes ?? DEFAULT_BAKE_BUDGET_BYTES;
    }

    /** Current byte usage. */
    get usedBytes(): number { return this._usedBytes; }

    /** Byte budget cap. */
    get budgetBytes(): number { return this._budgetBytes; }

    /** Cache hit counter. */
    get hitCount(): number { return this._counters.hitCount; }

    /** Cache miss counter. */
    get missCount(): number { return this._counters.missCount; }

    /** Eviction counter. */
    get evictCount(): number { return this._counters.evictCount; }

    /** Number of entries currently in the cache. */
    get size(): number { return this._map.size; }

    /**
     * Get a baked texture from cache, or bake it on miss.
     *
     * On hit: moves the entry to the end (most-recently used) and returns it.
     * On miss: calls `bakeSurface.bake()`, inserts into cache (evicting LRU
     * entries if needed), and returns the fresh result.
     */
    getOrBake(inputs: BakeKeyInputs, bakeSize: number): BakeResult {
        const key = deriveKey(inputs);
        const entry = this._map.get(key);
        if (entry) {
            // Cache hit: move to end (most-recently used).
            this._map.delete(key);
            this._map.set(key, entry);
            this._counters.recordHit();
            return entry.result;
        }

        // Cache miss: bake via the adapter surface.
        this._counters.recordMiss();
        const result = this._surface.bake(inputs.styleId, inputs.colorIdx, bakeSize);
        const sizeBytes = estimateTextureSize(result.width, result.height);

        // Evict LRU entries until we have room.
        while (this._usedBytes + sizeBytes > this._budgetBytes && this._map.size > 0) {
            const oldest = this._map.keys().next().value;
            if (oldest !== undefined) {
                const evicted = this._map.get(oldest)!;
                this._map.delete(oldest);
                this._usedBytes -= evicted.sizeBytes;
                this._counters.recordEviction();
            }
        }

        // Insert new entry at end.
        this._map.set(key, { key, result, sizeBytes });
        this._usedBytes += sizeBytes;

        return result;
    }

    /**
     * Invalidate all cached textures (e.g. when `bakeSchemaVersion` changes).
     * Resets counters and clears the cache.
     */
    invalidateAll(): void {
        this._map.clear();
        this._usedBytes = 0;
        this._counters.reset();
    }
}
