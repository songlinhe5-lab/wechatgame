/**
 * `[WXG-T-221 / ADR-0027 S3-lite]` Bake schema version.
 *
 * Single source of truth for the vector-recipe layer set. Incremented whenever
 * the baked pixel layout changes visually (per ADR-0025 §4.2 失效纪律). Both the
 * runtime LRU cache key (`deriveKey`) and the studio pre-bake filenames
 * (`<slug>__c<idx>__v<schemaV>.png`) read this constant so a layer-set change
 * invalidates cached textures AND stale files in one bump.
 *
 * Kept separate from `bake-key.ts` (core) so the studio end can import just
 * this scalar without pulling the cache layer.
 */
export const BAKE_SCHEMA_VERSION = 1;
