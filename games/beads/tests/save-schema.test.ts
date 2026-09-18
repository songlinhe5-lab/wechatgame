/**
 * `game/save-schema.ts` — 存档修复与降级（save-progress §2.2 + S1 §8-1/§8-10）。
 *
 * The two design rules this file pins down are both invisible from a happy-path
 * test: **degrade, never throw**, and **never discard a document because one field
 * is missing** (per-field defaults for `settings`).
 */

import { describe, it, expect } from 'vitest';
import { SaveManager } from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import {
  BACKUP_KEY,
  SAVE_KEY,
  SAVE_VERSION,
  bootLevel,
  defaultBeadsSave,
  migrateV1ToV2,
  normalizeBeadsSave,
  normalizeSettings,
  preserveCorruptBackup,
  type BeadsSave,
} from '../src/game/save-schema.js';

const LEVEL_COUNT = 8;

const validSave = () => ({
  version: SAVE_VERSION,
  runs: 3,
  // WXG-T-097 BD-32：v3 起显式引导标记（runs>0 的存量语义）。
  onboarded: true,
  maxUnlockedLevel: 4,
  currentLevel: 3,
  sprintBestScore: 1200,
  sprintBestStage: 5,
  starsByLevel: [3, 2, 1, 0, 0, 0, 0, 0],
  settings: { bgmMuted: true, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true },
});

const storage = () => new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }).createStorage();

describe('beads save schema', () => {
  it('starts a first launch at level 1 with both audio channels on', () => {
    expect(defaultBeadsSave()).toEqual({
      version: SAVE_VERSION,
      runs: 0,
      onboarded: false,
      maxUnlockedLevel: 1,
      currentLevel: 1,
      sprintBestScore: 0,
      sprintBestStage: 0,
      starsByLevel: [],
      settings: { bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true },
    });
  });

  // 「降级，不抛异常」—— 任何垃圾输入都要得到一个可用存档，且标记为「需要写回」。
  it('degrades any non-document input to the default and reports the change', () => {
    for (const raw of [null, undefined, 42, 'save', [], true, () => { }]) {
      const result = normalizeBeadsSave(raw, LEVEL_COUNT);
      expect(result.save).toEqual(defaultBeadsSave());
      expect(result.changed).toBe(true);
    }
  });

  // 完好文档不得触发多余的写回（否则每次启动都会写盘）。
  it('reports no change for a document that is already valid', () => {
    const result = normalizeBeadsSave(validSave(), LEVEL_COUNT);
    expect(result.changed).toBe(false);
    expect(result.save).toEqual(validSave());
  });

  // §2.2 `stars`（= 代码侧 `starsByLevel`）：每关历史最高星，长度 = 关卡数。
  it('normalizes the stars table per §2.4/§6: length mismatch → all zero, else clamp per value', () => {
    // §2.4：长度不符 → **重置全 0**（不是钳到某个长度）。
    for (const bad of [undefined, null, 3, 'stars', [], [3, 2, 1], new Array(LEVEL_COUNT + 1).fill(3)]) {
      const result = normalizeBeadsSave({ ...validSave(), starsByLevel: bad }, LEVEL_COUNT);
      expect(result.save.starsByLevel).toEqual(new Array(LEVEL_COUNT).fill(0));
    }
    // §6：小数**向下取整**；越界 / 非有限数钳 0；上界 = STAR_MAX(3)。
    const messy = [5, -1, 2.7, Number.NaN, 'x', null, Number.POSITIVE_INFINITY, 3];
    expect(normalizeBeadsSave({ ...validSave(), starsByLevel: messy }, LEVEL_COUNT).save.starsByLevel)
      .toEqual([3, 0, 2, 0, 0, 0, 0, 3]);
    // 逐项钳正**不弃整档**：其余字段照常读出。
    const repaired = normalizeBeadsSave({ ...validSave(), starsByLevel: messy }, LEVEL_COUNT);
    expect(repaired.save.runs).toBe(3);
    expect(repaired.save.maxUnlockedLevel).toBe(4);
    expect(repaired.changed).toBe(true);
  });

  // §8-2：历史最高星不被低星覆盖 —— 钳制只做上下界，不做「取大」（取大在游戏侧过关时做）。
  it('does not invent a max() over the stars table (that rule lives in the game, not the schema)', () => {
    const lower = normalizeBeadsSave(
      { ...validSave(), starsByLevel: [1, 0, 0, 0, 0, 0, 0, 0] },
      LEVEL_COUNT,
    );
    expect(lower.save.starsByLevel[0]).toBe(1); // 原样保留，schema 不做 max
    expect(lower.changed).toBe(false);
  });

  // S1 §8-10：越界值安全降级，不崩溃、不中断启动。
  it('degrades out-of-range level indices to 1', () => {
    expect(normalizeBeadsSave({ ...validSave(), maxUnlockedLevel: 99 }, LEVEL_COUNT).save.maxUnlockedLevel).toBe(1);
    expect(normalizeBeadsSave({ ...validSave(), currentLevel: 0 }, LEVEL_COUNT).save.currentLevel).toBe(1);
    expect(normalizeBeadsSave({ ...validSave(), currentLevel: LEVEL_COUNT + 1 }, LEVEL_COUNT).save.currentLevel).toBe(1);
    expect(normalizeBeadsSave({ ...validSave(), currentLevel: 2.5 }, LEVEL_COUNT).save.currentLevel).toBe(1);
    expect(normalizeBeadsSave({ ...validSave(), maxUnlockedLevel: '4' }, LEVEL_COUNT).save.maxUnlockedLevel).toBe(1);
  });

  it('accepts both bounds of the legal level range', () => {
    expect(normalizeBeadsSave({ ...validSave(), currentLevel: 1 }, LEVEL_COUNT).save.currentLevel).toBe(1);
    expect(normalizeBeadsSave({ ...validSave(), currentLevel: LEVEL_COUNT }, LEVEL_COUNT).save.currentLevel).toBe(
      LEVEL_COUNT,
    );
  });

  it('degrades counters that are missing, negative or non-finite to 0', () => {
    for (const bad of [undefined, -1, Number.NaN, Number.POSITIVE_INFINITY, '9']) {
      const save = normalizeBeadsSave({ ...validSave(), runs: bad, sprintBestScore: bad }, LEVEL_COUNT).save;
      expect(save.runs).toBe(0);
      expect(save.sprintBestScore).toBe(0);
    }
  });

  // save-progress §2.2 的核心：settings 缺字段按**单字段**降级，绝不弃整档。
  it('degrades settings per field instead of discarding the document', () => {
    const missing = normalizeBeadsSave({ ...validSave(), settings: undefined }, LEVEL_COUNT);
    expect(missing.save.settings).toEqual({
      bgmMuted: false,
      sfxMuted: false,
      reduceMotion: false,
      largeText: false,
      vibrate: true,
    });
    expect(missing.save.currentLevel).toBe(3); // progression survived
    expect(missing.changed).toBe(true);

    expect(normalizeSettings({ bgmMuted: true })).toEqual({
      bgmMuted: true,
      sfxMuted: false,
      reduceMotion: false,
      largeText: false,
      vibrate: true,
    });
    expect(normalizeSettings({ sfxMuted: true })).toEqual({
      bgmMuted: false,
      sfxMuted: true,
      reduceMotion: false,
      largeText: false,
      vibrate: true,
    });
    expect(normalizeSettings('nonsense')).toEqual({
      bgmMuted: false,
      sfxMuted: false,
      reduceMotion: false,
      largeText: false,
      vibrate: true,
    });
    expect(normalizeSettings({ bgmMuted: 'yes' })).toEqual({
      bgmMuted: false,
      sfxMuted: false,
      reduceMotion: false,
      largeText: false,
      vibrate: true,
    });
  });

  // WXG-T-088：v1→v2 升位——旧档（无 reduceMotion / largeText）装载后进度全保留、
  // 新开关逐字段降级 false，绝不因“版本号落后”而重置（旧档不炸）。
  it('migrates a v1 document to v2 without discarding progress', () => {
    const store = storage();
    const v1 = {
      version: 1,
      runs: 7,
      maxUnlockedLevel: 5,
      currentLevel: 5,
      sprintBestScore: 9999,
      sprintBestStage: 4,
      starsByLevel: [3, 3, 2, 1, 0, 0, 0, 0],
      settings: { bgmMuted: true, sfxMuted: true },
    };
    store.set(SAVE_KEY, JSON.stringify(v1));

    const manager = new SaveManager<BeadsSave>(store, {
      key: SAVE_KEY,
      version: SAVE_VERSION,
      defaults: defaultBeadsSave,
      migrations: { 1: migrateV1ToV2 },
    });
    const loaded = manager.load();
    expect(loaded.wasReset).toBe(false);
    expect(loaded.migrationsApplied).toContain(SAVE_VERSION);

    const normalized = normalizeBeadsSave(loaded.data, LEVEL_COUNT);
    // 进度、原开关一字未动；新开关逐字段降级 false。
    expect(normalized.save.version).toBe(SAVE_VERSION);
    expect(normalized.save.runs).toBe(7);
    expect(normalized.save.maxUnlockedLevel).toBe(5);
    expect(normalized.save.currentLevel).toBe(5);
    expect(normalized.save.sprintBestScore).toBe(9999);
    expect(normalized.save.starsByLevel).toEqual([3, 3, 2, 1, 0, 0, 0, 0]);
    expect(normalized.save.settings).toEqual({
      bgmMuted: true,
      sfxMuted: true,
      reduceMotion: false,
      largeText: false,
      vibrate: true,
    });
  });

  // S1 §8-1：无存档 → 第 1 关；有进度 → 续进已解锁最远关。
  it('§8-1 boots level 1 on a first run and resumes the stored level otherwise', () => {
    expect(bootLevel(defaultBeadsSave())).toBe(1);
    expect(bootLevel({ ...defaultBeadsSave(), runs: 1, currentLevel: 3 })).toBe(3);
    // A first run always starts at level 1, whatever currentLevel says.
    expect(bootLevel({ ...defaultBeadsSave(), runs: 0, currentLevel: 5 })).toBe(1);
  });

  it('preserves an unparseable document once and leaves valid JSON alone', () => {
    const store = storage();
    store.set(SAVE_KEY, '{not json');
    expect(preserveCorruptBackup(store)).toBe(true);
    expect(store.get(BACKUP_KEY)).toBe('{not json');

    const healthy = storage();
    healthy.set(SAVE_KEY, JSON.stringify(validSave()));
    expect(preserveCorruptBackup(healthy)).toBe(false);
    expect(healthy.get(BACKUP_KEY)).toBeNull();
  });

  it('is a no-op when there is nothing stored', () => {
    expect(preserveCorruptBackup(storage())).toBe(false);
  });
});
