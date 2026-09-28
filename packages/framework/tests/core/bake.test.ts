import { describe, expect, it } from 'vitest';
import { deriveKey, type BakeKeyInputs } from '../../src/core/bake/bake-key.js';
import { estimateTextureSize, DEFAULT_BAKE_BUDGET_BYTES, BakeCacheCounters } from '../../src/core/bake/bake-budget.js';
import { BakeLru } from '../../src/core/bake/bake-lru.js';
import type { BakeResult, BakeSurface } from '../../src/core/bake/bake-surface.js';

// ─── bake-key ────────────────────────────────────────────────────────────────

describe('deriveKey', () => {
    it('produces deterministic output regardless of property order', () => {
        const a = deriveKey({ styleId: 'facet-4', colorIdx: 1, bakeSchemaVersion: 2 });
        const b = deriveKey({ bakeSchemaVersion: 2, colorIdx: 1, styleId: 'facet-4' } as BakeKeyInputs);
        expect(a).toBe(b);
    });

    it('differs when colorIdx changes', () => {
        const a = deriveKey({ styleId: 'facet-4', colorIdx: 0, bakeSchemaVersion: 1 });
        const b = deriveKey({ styleId: 'facet-4', colorIdx: 1, bakeSchemaVersion: 1 });
        expect(a).not.toBe(b);
    });

    it('differs when bakeSchemaVersion changes', () => {
        const a = deriveKey({ styleId: 'facet-4', colorIdx: 0, bakeSchemaVersion: 1 });
        const b = deriveKey({ styleId: 'facet-4', colorIdx: 0, bakeSchemaVersion: 2 });
        expect(a).not.toBe(b);
    });

    it('differs when styleId changes', () => {
        const a = deriveKey({ styleId: 'facet-4', colorIdx: 0, bakeSchemaVersion: 1 });
        const b = deriveKey({ styleId: 'lineart-18', colorIdx: 0, bakeSchemaVersion: 1 });
        expect(a).not.toBe(b);
    });
});

// ─── bake-budget ─────────────────────────────────────────────────────────────

describe('estimateTextureSize', () => {
    it('returns w × h × 4 for RGBA', () => {
        expect(estimateTextureSize(112, 112)).toBe(112 * 112 * 4);
    });

    it('handles 1×1', () => {
        expect(estimateTextureSize(1, 1)).toBe(4);
    });
});

describe('DEFAULT_BAKE_BUDGET_BYTES', () => {
    it('equals 2.5 MB', () => {
        expect(DEFAULT_BAKE_BUDGET_BYTES).toBe(2.5 * 1024 * 1024);
    });
});

describe('BakeCacheCounters', () => {
    it('starts at zero and increments', () => {
        const c = new BakeCacheCounters();
        expect(c.hitCount).toBe(0);
        expect(c.missCount).toBe(0);
        expect(c.evictCount).toBe(0);
        c.recordHit();
        c.recordMiss();
        c.recordEviction();
        expect(c.hitCount).toBe(1);
        expect(c.missCount).toBe(1);
        expect(c.evictCount).toBe(1);
    });

    it('reset clears all counters', () => {
        const c = new BakeCacheCounters();
        c.recordHit();
        c.recordMiss();
        c.recordEviction();
        c.reset();
        expect(c.hitCount).toBe(0);
        expect(c.missCount).toBe(0);
        expect(c.evictCount).toBe(0);
    });
});

// ─── bake-lru ────────────────────────────────────────────────────────────────

/** Stub BakeSurface that returns a solid-color texture. */
function stubSurface(): BakeSurface {
    return {
        bake(_styleId: string, _colorIdx: number, bakeSize: number): BakeResult {
            const w = bakeSize;
            const h = bakeSize;
            return { width: w, height: h, data: new Uint8Array(w * h * 4) };
        },
    };
}

describe('BakeLru', () => {
    it('returns baked result on first access (miss)', () => {
        const lru = new BakeLru(stubSurface());
        const result = lru.getOrBake({ styleId: 'facet-4', colorIdx: 0, bakeSchemaVersion: 1 }, 4);
        expect(result.width).toBe(4);
        expect(result.height).toBe(4);
        expect(result.data.length).toBe(4 * 4 * 4);
        expect(lru.missCount).toBe(1);
        expect(lru.hitCount).toBe(0);
    });

    it('returns cached result on second access (hit)', () => {
        const lru = new BakeLru(stubSurface());
        const inputs = { styleId: 'facet-4', colorIdx: 0, bakeSchemaVersion: 1 };
        const a = lru.getOrBake(inputs, 4);
        const b = lru.getOrBake(inputs, 4);
        expect(a).toBe(b); // same reference
        expect(lru.hitCount).toBe(1);
        expect(lru.missCount).toBe(1);
    });

    it('evicts LRU entry when budget exceeded', () => {
        // Budget = 256 bytes. Each 4×4 texture = 64 bytes. So 4 fit, 5th triggers eviction.
        const lru = new BakeLru(stubSurface(), { budgetBytes: 256 });
        for (let i = 0; i < 4; i++) {
            lru.getOrBake({ styleId: `s${i}`, colorIdx: 0, bakeSchemaVersion: 1 }, 4);
        }
        expect(lru.size).toBe(4);
        expect(lru.usedBytes).toBe(256);
        expect(lru.evictCount).toBe(0);

        // 5th entry: should evict the oldest (s0).
        lru.getOrBake({ styleId: 's4', colorIdx: 0, bakeSchemaVersion: 1 }, 4);
        expect(lru.size).toBe(4);
        expect(lru.evictCount).toBe(1);
        expect(lru.usedBytes).toBe(256);
    });

    it('evicts multiple entries if needed', () => {
        // Budget = 128 bytes. Each 4×4 = 64 bytes. 2 fit.
        const lru = new BakeLru(stubSurface(), { budgetBytes: 128 });
        lru.getOrBake({ styleId: 'a', colorIdx: 0, bakeSchemaVersion: 1 }, 4);
        lru.getOrBake({ styleId: 'b', colorIdx: 0, bakeSchemaVersion: 1 }, 4);
        expect(lru.size).toBe(2);

        // Insert an 8×8 texture = 256 bytes > budget. Must evict both.
        lru.getOrBake({ styleId: 'big', colorIdx: 0, bakeSchemaVersion: 1 }, 8);
        expect(lru.size).toBe(1);
        expect(lru.evictCount).toBe(2);
        expect(lru.usedBytes).toBe(8 * 8 * 4);
    });

    it('invalidateAll clears cache and resets counters', () => {
        const lru = new BakeLru(stubSurface());
        lru.getOrBake({ styleId: 'x', colorIdx: 0, bakeSchemaVersion: 1 }, 4);
        lru.getOrBake({ styleId: 'x', colorIdx: 0, bakeSchemaVersion: 1 }, 4);
        expect(lru.hitCount).toBe(1);
        lru.invalidateAll();
        expect(lru.size).toBe(0);
        expect(lru.usedBytes).toBe(0);
        expect(lru.hitCount).toBe(0);
        expect(lru.missCount).toBe(0);
    });

    it('accessing an entry moves it to MRU position', () => {
        // Budget = 192 bytes. Each 4×4 = 64 bytes. 3 fit.
        const lru = new BakeLru(stubSurface(), { budgetBytes: 192 });
        const inputsA = { styleId: 'a', colorIdx: 0, bakeSchemaVersion: 1 };
        const inputsB = { styleId: 'b', colorIdx: 0, bakeSchemaVersion: 1 };
        const inputsC = { styleId: 'c', colorIdx: 0, bakeSchemaVersion: 1 };

        lru.getOrBake(inputsA, 4); // [a]
        lru.getOrBake(inputsB, 4); // [a, b]
        lru.getOrBake(inputsC, 4); // [a, b, c]

        // Access 'a' → moves to MRU: [b, c, a]
        lru.getOrBake(inputsA, 4);

        // Insert 'd' → should evict 'b' (LRU), not 'a'.
        lru.getOrBake({ styleId: 'd', colorIdx: 0, bakeSchemaVersion: 1 }, 4);
        expect(lru.evictCount).toBe(1);

        // 'a' should still be cached (hit), 'b' should be evicted (miss).
        const beforeA = lru.hitCount;
        lru.getOrBake(inputsA, 4);
        expect(lru.hitCount).toBe(beforeA + 1);

        const beforeMiss = lru.missCount;
        lru.getOrBake(inputsB, 4);
        expect(lru.missCount).toBe(beforeMiss + 1);
    });
});
