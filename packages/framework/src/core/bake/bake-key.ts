/**
 * `[WXG-T-220 / ADR-0025 DEC-1]` Bake key derivation.
 *
 * ⛔ **[WXG-T-221 八裁 2026-09-28] 冻结**：运行时烘焙路线转历史归档（ADR-0025/0028）；
 * 本模块不再演进。tint 目标制（ADR-0028）下 key 去 `colorIdx`（style×color → style），
 * 本三元组仅作路线史保留；复活或删除均须新 ADR。
 *
 * The key uniquely identifies a baked texture in the LRU cache. It is a
 * deterministic serialization of the inputs that affect the visual output:
 * `styleId`, `colorIdx`, and `bakeSchemaVersion`. The hole is NOT baked
 * (ADR-0025 DEC-3: hole stays live for target-color transparency).
 *
 * Key properties:
 *  - **Deterministic**: same inputs ⇒ same key (JSON.stringify with sorted keys).
 *  - **Collision-resistant**: the triple `(styleId, colorIdx, schema)` is
 *    sufficient to distinguish all visual variants.
 *  - **Cache-friendly**: short string, suitable for Map key.
 */

/** Inputs that determine a baked texture's visual content. */
export interface BakeKeyInputs {
    /** Bead visual style identifier (e.g. 'facet-4', 'lineart-18'). */
    readonly styleId: string;
    /** Color index into the bead inks table. */
    readonly colorIdx: number;
    /**
     * Schema version — incremented whenever the vector recipe changes visually.
     * A mismatch invalidates all cached textures (ADR-0025 §4.2 失效纪律).
     */
    readonly bakeSchemaVersion: number;
}

/**
 * Derive a deterministic cache key from the inputs.
 *
 * Uses JSON.stringify with sorted keys to ensure deterministic ordering
 * regardless of property insertion order. The output is a short string
 * suitable for use as a Map key.
 *
 * @example
 * ```ts
 * deriveKey({ styleId: 'facet-4', colorIdx: 1, bakeSchemaVersion: 1 })
 * // ⇒ '{"bakeSchemaVersion":1,"colorIdx":1,"styleId":"facet-4"}'
 * ```
 */
export function deriveKey(inputs: BakeKeyInputs): string {
    // Sort keys to ensure deterministic ordering. The three fields are known
    // at compile time, so we could hardcode the order — but JSON.stringify
    // with a sort replacer is clearer and the cost is negligible (called once
    // per cache miss, not per frame).
    return JSON.stringify(inputs, Object.keys(inputs).sort());
}
