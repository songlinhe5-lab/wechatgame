/**
 * Persisted Breakout save document — implementation of
 * `design/gdd/save-progress.md §4` (the field set is final; the **key** is the
 * deliberate exception that code owns).
 *
 * Design rules that shape this file:
 *
 * 1. **Degrade, never throw.** A corrupt or out-of-range document must never
 *    block boot. Every field is silently repaired and written back, so the
 *    repair happens exactly once instead of on every launch (`§6.8`).
 * 2. **Back up before discarding.** Unparseable raw JSON is copied to the
 *    backup key so a support request can still be diagnosed (`§6.2`).
 * 3. **Only progression is stored** — never mid-run physics state. A player
 *    interrupted mid-board restarts that board.
 */

import type { SaveDocument, Storage } from '@wxgame/framework';

/** Drag mode for the paddle. */
export type ControlMode = 'absolute' | 'relative';

export interface BreakoutSettings {
  /** Sound effects. */
  sfx: boolean;
  /** Background music. */
  music: boolean;
  /** Haptics. */
  vibrate: boolean;
  /** How the paddle follows the pointer. */
  controlMode: ControlMode;
}

export interface BreakoutStats {
  /** Runs started — the "first launch" test is `runs === 0`. */
  runs: number;
  /** Levels cleared, lifetime. */
  clears: number;
  /** Bricks destroyed, lifetime. */
  bricksDestroyed: number;
  /** Best combo ever reached. */
  bestCombo: number;
  /** Epoch ms of the last session, 0 when unknown. */
  lastPlayedAt: number;
}

export interface BreakoutSave extends SaveDocument {
  version: 1;
  /** Highest unlocked level, 1-based, clamped to `[1, levelCount]`. */
  maxUnlockedLevel: number;
  /** True once every level has been cleared. */
  allCleared: boolean;
  /** Level to resume on boot, 1-based. Out of range degrades to 1. */
  currentLevel: number;
  /** All-time high score. */
  bestScore: number;
  settings: BreakoutSettings;
  stats: BreakoutStats;
}

/** Storage key — namespaced with the platform prefix to avoid host collisions. */
export const SAVE_KEY = 'wxgame.breakout.save';
/** Where an unreadable document is preserved before being discarded. */
export const BACKUP_KEY = 'wxgame.breakout.save.bak';
export const SAVE_VERSION = 1;

export function defaultSettings(): BreakoutSettings {
  return { sfx: true, music: true, vibrate: true, controlMode: 'absolute' };
}

export function defaultStats(): BreakoutStats {
  return { runs: 0, clears: 0, bricksDestroyed: 0, bestCombo: 0, lastPlayedAt: 0 };
}

export function defaultBreakoutSave(): BreakoutSave {
  return {
    version: SAVE_VERSION,
    maxUnlockedLevel: 1,
    allCleared: false,
    currentLevel: 1,
    bestScore: 0,
    settings: defaultSettings(),
    stats: defaultStats(),
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

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export interface NormalizeResult {
  readonly save: BreakoutSave;
  /** True when anything was repaired — the caller should write back (`§6.8`). */
  readonly changed: boolean;
}

/**
 * Repair a loaded document into a valid one.
 *
 * Implements the `§6.8` degradation table and the `§6.9` consistency rule:
 * `allCleared === true` with an invalid `currentLevel` resets the whole document
 * to defaults (better to replay than to soft-lock or skip a level).
 */
export function normalizeBreakoutSave(raw: unknown, levelCount: number): NormalizeResult {
  const boundedCount = Math.max(1, Math.floor(levelCount));
  const fallback = defaultBreakoutSave();

  if (!isRecord(raw)) return { save: fallback, changed: true };

  const allCleared = bool(raw['allCleared'], false);
  const normalizedCurrent = levelIndex(raw['currentLevel'], boundedCount);
  const rawMax = levelIndex(raw['maxUnlockedLevel'], boundedCount);

  // §6.9 — inconsistent pair means we cannot trust the document at all.
  if (allCleared && normalizedCurrent === null) {
    return { save: fallback, changed: true };
  }

  const settingsRaw = isRecord(raw['settings']) ? raw['settings'] : {};
  const statsRaw = isRecord(raw['stats']) ? raw['stats'] : {};

  const settings: BreakoutSettings = {
    sfx: bool(settingsRaw['sfx'], true),
    music: bool(settingsRaw['music'], true),
    vibrate: bool(settingsRaw['vibrate'], true),
    controlMode: settingsRaw['controlMode'] === 'relative' ? 'relative' : 'absolute',
  };

  const stats: BreakoutStats = {
    runs: num(statsRaw['runs'], 0),
    clears: num(statsRaw['clears'], 0),
    bricksDestroyed: num(statsRaw['bricksDestroyed'], 0),
    bestCombo: num(statsRaw['bestCombo'], 0),
    lastPlayedAt: num(statsRaw['lastPlayedAt'], 0),
  };

  const save: BreakoutSave = {
    version: SAVE_VERSION,
    maxUnlockedLevel: rawMax ?? 1,
    allCleared,
    currentLevel: normalizedCurrent ?? 1,
    bestScore: num(raw['bestScore'], 0),
    settings,
    stats,
  };

  // A repair is anything where the output differs from what we read.
  const changed =
    !isRecord(raw) ||
    raw['maxUnlockedLevel'] !== save.maxUnlockedLevel ||
    raw['allCleared'] !== save.allCleared ||
    raw['currentLevel'] !== save.currentLevel ||
    raw['bestScore'] !== save.bestScore ||
    settingsRaw['sfx'] !== settings.sfx ||
    settingsRaw['music'] !== settings.music ||
    settingsRaw['vibrate'] !== settings.vibrate ||
    settingsRaw['controlMode'] !== settings.controlMode ||
    !isRecord(raw['settings']) ||
    !isRecord(raw['stats']) ||
    statsRaw['runs'] !== stats.runs ||
    statsRaw['clears'] !== stats.clears ||
    statsRaw['bricksDestroyed'] !== stats.bricksDestroyed ||
    statsRaw['bestCombo'] !== stats.bestCombo ||
    statsRaw['lastPlayedAt'] !== stats.lastPlayedAt;

  return { save, changed };
}

/**
 * Preserve an unparseable document before `SaveManager` discards it (`§6.2`).
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
 * Which level to enter on boot (`§4` BOOT routing, no menu):
 *   - `stats.runs === 0`            → level 1 (first launch)
 *   - `allCleared`                  → `null` (the caller shows the FINISH screen)
 *   - otherwise                     → `currentLevel` (resume)
 */
export function bootLevel(save: BreakoutSave): number | null {
  if (save.allCleared) return null;
  if (save.stats.runs === 0) return 1;
  return save.currentLevel;
}
