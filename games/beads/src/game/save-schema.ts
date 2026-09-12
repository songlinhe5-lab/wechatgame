/**
 * Persisted Beads save document — minimal sprint-slice schema
 * (full S8 field set is a later sprint; the **key** is the deliberate
 * exception that code owns — systems-index §3 note).
 *
 * Design rules carried over from the breakout 判例:
 * 1. **Degrade, never throw.** Corrupt/out-of-range documents are repaired and
 *    written back exactly once.
 * 2. **Only progression is stored** — never mid-run state (combo, tray, grid).
 */

import type { SaveDocument, Storage } from '@wxgame/framework';

export interface BeadsSave extends SaveDocument {
  version: 1;
  /** Runs started — the "first launch" test is `runs === 0` (S1 §8-1). */
  runs: number;
  /** Highest unlocked level, 1-based, clamped to `[1, levelCount]`. */
  maxUnlockedLevel: number;
  /** Level to resume on boot, 1-based. Out of range degrades to 1. */
  currentLevel: number;
  /** Best sprint score ever (S8 v1.1 field, minimal slice). */
  sprintBestScore: number;
  /** Best sprint stage index ever reached (0-based). */
  sprintBestStage: number;
}

/** Storage key — namespaced (architecture-beads §2: `wxgame.beads.save.v1`). */
export const SAVE_KEY = 'wxgame.beads.save.v1';
/** Where an unreadable document is preserved before being discarded. */
export const BACKUP_KEY = 'wxgame.beads.save.v1.bak';
export const SAVE_VERSION = 1;

export function defaultBeadsSave(): BeadsSave {
  return {
    version: SAVE_VERSION,
    runs: 0,
    maxUnlockedLevel: 1,
    currentLevel: 1,
    sprintBestScore: 0,
    sprintBestStage: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Non-negative finite number, else `fallback`. */
function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** A 1-based level index inside `[1, levelCount]`, else `null` when invalid. */
function levelIndex(value: unknown, levelCount: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 1 || value > levelCount) return null;
  return value;
}

export interface NormalizeResult {
  readonly save: BeadsSave;
  /** True when anything was repaired — the caller should write back. */
  readonly changed: boolean;
}

/** Repair a loaded document into a valid one (degrade, never throw). */
export function normalizeBeadsSave(raw: unknown, levelCount: number): NormalizeResult {
  const boundedCount = Math.max(1, Math.floor(levelCount));
  const fallback = defaultBeadsSave();

  if (!isRecord(raw)) return { save: fallback, changed: true };

  const maxUnlocked = levelIndex(raw['maxUnlockedLevel'], boundedCount);
  const current = levelIndex(raw['currentLevel'], boundedCount);

  const save: BeadsSave = {
    version: SAVE_VERSION,
    runs: num(raw['runs'], 0),
    maxUnlockedLevel: maxUnlocked ?? 1,
    currentLevel: current ?? 1,
    sprintBestScore: num(raw['sprintBestScore'], 0),
    sprintBestStage: num(raw['sprintBestStage'], 0),
  };

  const changed =
    raw['runs'] !== save.runs ||
    raw['maxUnlockedLevel'] !== save.maxUnlockedLevel ||
    raw['currentLevel'] !== save.currentLevel ||
    raw['sprintBestScore'] !== save.sprintBestScore ||
    raw['sprintBestStage'] !== save.sprintBestStage;

  return { save, changed };
}

/**
 * Preserve an unparseable document before `SaveManager` discards it.
 * Best-effort: a failure here must never block boot.
 */
export function preserveCorruptBackup(storage: Storage, key: string = SAVE_KEY): boolean {
  try {
    const raw = storage.get(key);
    if (raw === null || raw === undefined) return false;
    try {
      JSON.parse(raw);
      return false; // parseable — nothing to preserve
    } catch {
      storage.set(`${key}.bak`, raw);
      return true;
    }
  } catch {
    return false;
  }
}

/**
 * Which level to enter on boot (S1 §8-1, no menu):
 *   - `runs === 0` → level 1 (first launch)
 *   - otherwise    → `currentLevel` (resume the furthest unlocked)
 */
export function bootLevel(save: BeadsSave): number {
  if (save.runs === 0) return 1;
  return save.currentLevel;
}
