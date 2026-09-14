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
import { STAR_MAX } from '../config/tuning.js';

/**
 * S9 audio settings (save-progress §2.2): two independent channels, persisted
 * the instant they are toggled. Missing fields degrade **per field** to false —
 * a document is never discarded because `settings` lacks a key.
 */
export interface BeadsSettings {
  /** Music channel muted (`bgmMuted`). */
  readonly bgmMuted: boolean;
  /** Sfx channel muted (`sfxMuted`). */
  readonly sfxMuted: boolean;
}

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
  /**
   * 每关**历史最高星**（`0` = 未通关），长度 = 关卡数 —— S8 GDD §2.2 的 `stars`
   * （代码侧命名 `starsByLevel`；键名与结构归代码，见该文文首「刻意例外」）。
   * 语义 = 过关时 `max(旧, 新)`（§8-2「历史最高星不被低星覆盖」）。
   */
  starsByLevel: number[];
  /** S9 audio toggles (save-progress §2.2; written on every switch). */
  settings: BeadsSettings;
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
    // 长度在 `normalizeBeadsSave(raw, levelCount)` 里按关卡表补齐（出厂默认不知关卡数）。
    starsByLevel: [],
    settings: { bgmMuted: false, sfxMuted: false },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read one boolean field, degrading per-field (save-progress §2.2: 缺字段按单
 * 字段默认 false，不弃整档).
 */
function boolField(raw: unknown, key: string, fallback: boolean): boolean {
  if (!isRecord(raw)) return fallback;
  const value = raw[key];
  return typeof value === 'boolean' ? value : fallback;
}

/** Normalise the `settings` sub-document — never throws, never drops the save. */
export function normalizeSettings(raw: unknown): BeadsSettings {
  return {
    bgmMuted: boolField(raw, 'bgmMuted', false),
    sfxMuted: boolField(raw, 'sfxMuted', false),
  };
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

/**
 * 每关星级数组（S8 GDD §2.2 `stars` / §2.4 降级矩阵 / §6 边界）：
 *   · **长度不符 → 重置全 0**（§2.4 明文，不是「钳到某个长度」）；
 *   · 单值非有限数 → 0；小数**向下取整**（§6）；再钳 `[0, STAR_MAX]`。
 * 逐项钳正、**绝不弃整档**（与 `settings` 同判例）。
 */
function normalizeStars(raw: unknown, levelCount: number): number[] {
  const out = new Array<number>(levelCount).fill(0);
  if (!Array.isArray(raw) || raw.length !== levelCount) return out;
  for (let i = 0; i < levelCount; i += 1) {
    const value = raw[i];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    out[i] = Math.max(0, Math.min(STAR_MAX, Math.floor(value)));
  }
  return out;
}

/** 逐项相等（长度不同即不等）——`changed` 判定用。 */
function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Repair a loaded document into a valid one (degrade, never throw). */
export function normalizeBeadsSave(raw: unknown, levelCount: number): NormalizeResult {
  const boundedCount = Math.max(1, Math.floor(levelCount));
  const fallback = defaultBeadsSave();

  if (!isRecord(raw)) return { save: fallback, changed: true };

  const maxUnlocked = levelIndex(raw['maxUnlockedLevel'], boundedCount);
  const current = levelIndex(raw['currentLevel'], boundedCount);
  const rawStars = raw['starsByLevel'];

  const save: BeadsSave = {
    version: SAVE_VERSION,
    runs: num(raw['runs'], 0),
    maxUnlockedLevel: maxUnlocked ?? 1,
    currentLevel: current ?? 1,
    sprintBestScore: num(raw['sprintBestScore'], 0),
    sprintBestStage: num(raw['sprintBestStage'], 0),
    starsByLevel: normalizeStars(rawStars, boundedCount),
    settings: normalizeSettings(raw['settings']),
  };

  const changed =
    raw['runs'] !== save.runs ||
    raw['maxUnlockedLevel'] !== save.maxUnlockedLevel ||
    raw['currentLevel'] !== save.currentLevel ||
    raw['sprintBestScore'] !== save.sprintBestScore ||
    raw['sprintBestStage'] !== save.sprintBestStage ||
    !Array.isArray(rawStars) ||
    !sameNumbers(rawStars as number[], save.starsByLevel) ||
    raw['settings'] === undefined ||
    save.settings.bgmMuted !== boolField(raw['settings'], 'bgmMuted', false) ||
    save.settings.sfxMuted !== boolField(raw['settings'], 'sfxMuted', false);

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
