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
import {
  BEAD_SIZE_DEFAULT,
  BEAD_SIZE_ORDER,
  type BeadSizeKind,
  STAR_MAX,
  VIBRATE_DEFAULT,
} from '../config/tuning.js';
// **换肤两字段的注册真源 = style registry**（`view/bead-styles/registry.ts`）：S8 §8-12 构造 ③
// 「`styleId` 字符串合法但未在 registry 注册 ⇒ 单独回落默认」只能在读档层判，否则非法值会
// 一路走到渲染侧被「静默兜底」，档内永远留着脏值。方向说明：本行是 game → view 的**只读函数**
// 引用（registry 仅 import tuning 与三套风格模块，无环）；默认档 id 与渲染默认**同一真源**
// （`DEFAULT_BEAD_STYLE_ID`），⛔ 不得在存档层另写 `'facet-4'` 字面量。
import { DEFAULT_BEAD_STYLE_ID, styleById } from '../view/bead-styles/registry.js';

/**
 * Persisted toggles (save-progress §2.2 + accessibility D1/E2, WXG-T-088): four
 * independent channels, persisted the instant they are toggled. Missing fields
 * degrade **per field** to false — a document is never discarded because
 * `settings` lacks a key. This per-field default is exactly what lets the v1→v2
 * bump (adding `reduceMotion` / `largeText`) stay backward compatible.
 */
export interface BeadsSettings {
  /** Music channel muted (`bgmMuted`). */
  readonly bgmMuted: boolean;
  /** Sfx channel muted (`sfxMuted`). */
  readonly sfxMuted: boolean;
  /** D1 减弱动效：关停非必要位移 / 脉冲（accessibility §4）。 */
  readonly reduceMotion: boolean;
  /** E2 大字号：正文 / 说明类文本放大（accessibility §5）。 */
  readonly largeText: boolean;
  /**
   * 触觉震动开关（§3.8 VIBRATE_DEFAULT = ON，WXG-T-164 拍板⑦）：默认 **true**，
   * 仅 isMiniGame 平台显示行（pause-settings v1.3 §8-12）；屏震语义不受本开关控制。
   */
  readonly vibrate: boolean;
  /**
   * DEBUG 性能覆层开关（pause-settings v1.6 §2.2）：**唯一持久化的 debug 项**——真机
   * QA 无 console / query 可用，需跨重启保留。缺字段逐字段降级 false（同 v1→v2 判例，
   * 无需版本 bump）；仅控制覆层绘制，不碰玩法与存档数据。
   */
  readonly debugInfo: boolean;
  /**
   * 换肤两字段（**EP11-S5 / S8 v1.1 §8-11~13**）：珠子风格与豆径档的末值。
   * - `beadStyle`：string styleId，默认 `DEFAULT_BEAD_STYLE_ID`（= `facet-4`）；
   * - `beadSize`：枚举 BeadSizeKind，默认 BEAD_SIZE_DEFAULT（= 'full' 满豆）。
   * 两者均住 `settings` 对象，随**即写**落盘（§2.5 即写族，与四开关同一写入通道），
   * **不新造事件名**，**不存历史栈**（只存末值）。
   * ⛔ **SAVE_VERSION 不 bump**：逐字段降级 = debugInfo 判例，缺字段按单字段默认处理，
   *   无需版本迁移（S8 §8-12「version 无需为此 bump」）。
   */
  readonly beadStyle: string;
  readonly beadSize: BeadSizeKind;
}

export interface BeadsSave extends SaveDocument {
  version: 4;
  /** Runs started — the "first launch" test is `runs === 0` (S1 §8-1). */
  runs: number;
  /**
   * 显式「已完成首屏引导」标记（WXG-T-097 · BD-32）：`runs` 每次 BOOT 自增、
   * 不能作「是否见过引导」的真源（首玩落子前杀进程 ⇒ runs=1 ⇒ 旧判定永久失
   * 引导）。首次落子置 true 并落盘；`normalizeBeadsSave` 对**无字段的 v2 存量档**
   * 以 `runs > 0` 一次性迁移（老玩家不重看引导）。
   */
  onboarded: boolean;
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
export const SAVE_VERSION = 4;

/**
 * v1 → v2（WXG-T-088）：新增可访问性开关 `reduceMotion`（D1）与 `largeText`
 * （E2）。迁移**只升版本号并原样透传旧字段**——缺省的新字段交由 `normalizeSettings`
 * 逐字段降级为 false，因此旧档进度与原 settings 全保留、绝不重置（旧档不炸）。
 */
export function migrateV1ToV2(doc: Record<string, unknown>): Record<string, unknown> {
  return { ...doc, version: SAVE_VERSION };
}

/**
 * v2 → v3（WXG-T-097 · BD-32）：新增显式引导标记 `onboarded`。迁移**只升版本号
 * 并原样透传旧字段**——缺省字段交由 `normalizeBeadsSave` 判定：无 `onboarded` 的
 * v2 存量档以 `runs > 0` 一次性迁移（玩过的 = 已引导），新档由 default 显式 false。
 */
export function migrateV2ToV3(doc: Record<string, unknown>): Record<string, unknown> {
  // ⚠ 迁移必须在**本函数**内落 `onboarded`：SaveManager.load 会先用 defaults 补
  // 缺字段再交给 normalize ⇒ normalize 层无法区分「v2 无字段」与「显式 false」。
  // 存量玩家（runs>0）一次性迁移为已引导；v3 后字段由 default/写入恒在。
  return {
    ...doc,
    onboarded: doc['onboarded'] !== undefined ? doc['onboarded'] === true : num(doc['runs'], 0) > 0,
    version: SAVE_VERSION,
  };
}

/**
 * v3 → v4（WXG-T-164 拍板⑦）：settings 新增 `vibrate`（默认 ON）。同 v1→v2
 * 判例：**只升版本号透传旧字段**，缺省字段由 `normalizeSettings` 逐字段降级。
 */
export function migrateV3ToV4(doc: Record<string, unknown>): Record<string, unknown> {
  return { ...doc, version: SAVE_VERSION };
}

export function defaultBeadsSave(): BeadsSave {
  return {
    version: SAVE_VERSION,
    runs: 0,
    onboarded: false,
    maxUnlockedLevel: 1,
    currentLevel: 1,
    sprintBestScore: 0,
    sprintBestStage: 0,
    // 长度在 `normalizeBeadsSave(raw, levelCount)` 里按关卡表补齐（出厂默认不知关卡数）。
    starsByLevel: [],
    settings: {
      bgmMuted: false,
      sfxMuted: false,
      reduceMotion: false,
      largeText: false,
      vibrate: VIBRATE_DEFAULT,
      debugInfo: false,
      beadStyle: DEFAULT_BEAD_STYLE_ID,
      beadSize: BEAD_SIZE_DEFAULT,
    },
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
  // 换肤两字段的**逐字段**降级（S8 §8-12 四构造：①缺字段 ②类型错 ③未注册 ④越界）：
  // - `beadStyle`：非字符串 / 空串 / **未在 registry 注册** ⇒ 单独回落 `DEFAULT_BEAD_STYLE_ID`；
  // - `beadSize`：非枚举值 ⇒ 单独回落 `BEAD_SIZE_DEFAULT`（= 满豆）。
  // 两者**互不牵连**，也不牵其余六字段（S9 §8-18「不弃整档、其余字段无损」）；
  // 本函数只在 BOOT / 写档兜底路径上跑，⛔ 不进每帧热路径（故 `includes` 与 `styleById` 的
  // 开销可接受；渲染侧每帧取风格走 `bead-render` 的 `styleById`，Map.get 零分配）。
  const styleRaw = isRecord(raw) ? raw['beadStyle'] : undefined;
  const sizeRaw = isRecord(raw) ? raw['beadSize'] : undefined;
  return {
    bgmMuted: boolField(raw, 'bgmMuted', false),
    sfxMuted: boolField(raw, 'sfxMuted', false),
    reduceMotion: boolField(raw, 'reduceMotion', false),
    largeText: boolField(raw, 'largeText', false),
    // §3.8 VIBRATE_DEFAULT = ON：缺字段降级为 true（与其余四开关的 false 相反）。
    vibrate: boolField(raw, 'vibrate', VIBRATE_DEFAULT),
    debugInfo: boolField(raw, 'debugInfo', false),
    beadStyle:
      typeof styleRaw === 'string' && styleById(styleRaw) !== undefined
        ? styleRaw
        : DEFAULT_BEAD_STYLE_ID,
    beadSize: (BEAD_SIZE_ORDER as readonly string[]).includes(sizeRaw as string)
      ? (sizeRaw as BeadSizeKind)
      : BEAD_SIZE_DEFAULT,
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

/** 逐字段比较（含 normalize 兜底的缺字段 / 类型错场景），⛔ 不对整个 settings 对象做序列化比较。 */
function settingsEqual(a: BeadsSettings, b: BeadsSettings): boolean {
  return (
    a.bgmMuted === b.bgmMuted &&
    a.sfxMuted === b.sfxMuted &&
    a.reduceMotion === b.reduceMotion &&
    a.largeText === b.largeText &&
    a.vibrate === b.vibrate &&
    a.debugInfo === b.debugInfo &&
    a.beadStyle === b.beadStyle &&
    a.beadSize === b.beadSize
  );
}

/** Repair a loaded document into a valid one (degrade, never throw). */
export function normalizeBeadsSave(raw: unknown, levelCount: number): NormalizeResult {
  const boundedCount = Math.max(1, Math.floor(levelCount));
  const fallback = defaultBeadsSave();

  if (!isRecord(raw)) return { save: fallback, changed: true };

  const maxUnlocked = levelIndex(raw['maxUnlockedLevel'], boundedCount);
  const current = levelIndex(raw['currentLevel'], boundedCount);
  const rawStars = raw['starsByLevel'];
  // 一次性取出原始 settings 引用（归一入参、`changed` 比较与注释均读它，⛔ 不二次下标）。
  const rawSettings = raw['settings'];

  const save: BeadsSave = {
    version: SAVE_VERSION,
    runs: num(raw['runs'], 0),
    onboarded: raw['onboarded'] === true,
    maxUnlockedLevel: maxUnlocked ?? 1,
    currentLevel: current ?? 1,
    sprintBestScore: num(raw['sprintBestScore'], 0),
    sprintBestStage: num(raw['sprintBestStage'], 0),
    starsByLevel: normalizeStars(rawStars, boundedCount),
    settings: normalizeSettings(rawSettings),
  };

  const changed =
    raw['runs'] !== save.runs ||
    raw['maxUnlockedLevel'] !== save.maxUnlockedLevel ||
    raw['currentLevel'] !== save.currentLevel ||
    raw['sprintBestScore'] !== save.sprintBestScore ||
    raw['sprintBestStage'] !== save.sprintBestStage ||
    !Array.isArray(rawStars) ||
    !sameNumbers(rawStars as number[], save.starsByLevel) ||
    rawSettings === undefined ||
    !isRecord(rawSettings) ||
    // **B1-Q3 `changed` 自我比较怪癖修正**（EP11-S5）：旧写法将 `normalizeSettings(raw)`
    // 与 `save.settings`（**同一次 normalize 的产物**）手展开逐字段比较 ⇒ 两恒相等，
    // settings 字段除了「整体缺失」外永不报 changed（单字段缺失 / 非法值不补写回）。
    // 现按**原始文档 vs 归一结果**比较 ⇒ 缺字段与非法值都能触发一次补写回。
    // 口径不变项：仍为 patch 型全量写档、只存末值、不 bump `SAVE_VERSION`（S8 §8-12）。
    // 下转安全：上一行 `isRecord` 已保证它是对象；字段缺失 / 类型错读出 `undefined` 或不
    // 等值 ⇒ 恰好是要报 changed 的场景（本处不需要归一后的类型，比较的就是原始脏值）。
    !settingsEqual(rawSettings as unknown as BeadsSettings, save.settings);

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
