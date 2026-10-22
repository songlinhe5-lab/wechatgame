/**
 * `game/save-schema.ts` — 存档修复与降级（save-progress §2.2 + S1 §8-1/§8-10），
 * 以及 **ADR-0034 落码批（WXG-T-344 · §6 第 2/5 步）** 的身份化星账判据族。
 *
 * The two design rules this file pins down are both invisible from a happy-path
 * test: **degrade, never throw**, and **never discard a document because one field
 * is missing** (per-field defaults for `settings`).
 *
 * 自 v5 起第三条同样不可见：**星账按内容身份记账，不按位置**——
 * 判据源 = `design/gdd/save-progress.md` v1.3 **§8-14 ～ §8-22**（⛔ 本文件不自立判据）。
 * 关表轴一律从 `config/levels.ts` 派生（判例 K-152：⛔ 把本版 token 快照当不变式硬写）。
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SaveManager } from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import {
  VIBRATE_DEFAULT,
} from '../src/config/tuning.js';
import { LEVELS, levelIdentityKeys } from '../src/config/levels.js';
import { ARCS } from '../src/config/arcs.js';
import {
  BACKUP_KEY,
  BEADS_MIGRATIONS,
  SAVE_KEY,
  SAVE_VERSION,
  bootLevel,
  collapseStars,
  defaultBeadsSave,
  flattenStars,
  migrateV4ToV5,
  normalizeBeadsSave,
  normalizeSettings,
  preserveCorruptBackup,
  toBeadsSavePatch,
  type BeadsSave,
} from '../src/game/save-schema.js';
import { starsLedger } from './helpers.js';

/**
 * **身份轴真源**：`levelIdentityKeys(LEVELS)` = 运行期 `BeadsGame._levelKeys` 的同一构造式
 * （ADR-0034 DEC-2/DEC-3）。本文件所有夹具的星账键都从这里长出来 ⇒ 关表增删调序时
 * 夹具自动跟涨，⛔ 不出现「加了关就得改测试」的第二真源。
 */
const KEYS = levelIdentityKeys(LEVELS);
/** 关池长度 = 轴长度（⛔ 写死 8 / 10；K-152）。 */
const LEVEL_COUNT = KEYS.length;

/**
 * EP11-S5（S8 §8-11）两新字段 + EP12-S8 `skinId` 的默认档：补进本文件各**全字段
 * `toEqual`** 期望，以 single source 避免逐处漂移（真值仍由 `src` 侧
 * `DEFAULT_BEAD_STYLE_ID` / `BEAD_SIZE_DEFAULT` / `DEFAULT_SKIN_ID` 定，本处只存
 * 【期望字面量】，⛔ 不反向引用实现常量以免抹掉回归）。
 */
const SETTINGS_DEFAULTS = { beadStyle: 'facet-4', beadSize: 'full', skinId: 'warm-paper', debugGuides: false };

/** 有星的前三关（其余槽由 `starsLedger` 稠密补 0 ⇒ 完好档可自证 `changed = false`）。 */
const STAR_HEAD = [3, 2, 1];
/** 位置型**星值序列**（长度 = 当前关池）；v4 形态夹具与「逐条无损」比对基准都用它。 */
const STAR_SEQ = STAR_HEAD.concat(new Array(Math.max(0, LEVEL_COUNT - STAR_HEAD.length)).fill(0));

const validSave = () => ({
  version: SAVE_VERSION,
  runs: 3,
  // WXG-T-097 BD-32：v3 起显式引导标记（runs>0 的存量语义）。
  onboarded: true,
  // S-2b：两根指针存**身份 token**（不再存 1-based 位置数）。
  maxUnlockedKey: KEYS[3],
  lastPlayedKey: KEYS[2],
  sprintBestScore: 1200,
  sprintBestStage: 5,
  starsByUid: starsLedger(STAR_HEAD),
  settings: { bgmMuted: true, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true, debugInfo: false, debugGuides: false, beadStyle: 'facet-4', beadSize: 'full', skinId: 'warm-paper' },
});

/** **v4 形态**文档（只有位置轴、无身份账）：一次性入口专用夹具（§8-21 / §8-14）。 */
const positionalDoc = (values: readonly number[], extra: Record<string, unknown> = {}) => ({
  ...validSave(),
  starsByUid: undefined,
  starsByLevel: values,
  ...extra,
});

/** 走归一化的统一入口：`levelCount` 恒 = 轴长（⛔ 两者分开填，防止造出对不上号的假轴）。 */
const norm = (raw: unknown, keys: readonly string[] = KEYS) => normalizeBeadsSave(raw, keys.length, keys);

/** 经一次「写档 → 读档」的 JSON 往返（框架 `JsonStorage.setJSON` 会省略 undefined 键）。 */
const jsonRoundTrip = (value: unknown): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

const storage = () => new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }).createStorage();

describe('beads save schema', () => {
  it('starts a first launch at level 1 with both audio channels on', () => {
    expect(defaultBeadsSave()).toEqual({
      version: SAVE_VERSION,
      runs: 0,
      onboarded: false,
      maxUnlockedKey: '',
      lastPlayedKey: '',
      sprintBestScore: 0,
      sprintBestStage: 0,
      // v5：出厂默认不知关表 ⇒ 空身份账；稠密终态由 `normalizeBeadsSave` 物化。
      starsByUid: {},
      settings: { bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true, debugInfo: false, ...SETTINGS_DEFAULTS },
    });
  });

  // 「降级，不抛异常」—— 任何垃圾输入都要得到一个可用存档，且标记为「需要写回」。
  it('degrades any non-document input to the default and reports the change', () => {
    for (const raw of [null, undefined, 42, 'save', [], true, () => { }]) {
      const result = norm(raw);
      expect(result.save).toEqual(defaultBeadsSave());
      expect(result.changed).toBe(true);
      expect(result.staleKeys).toEqual([]);
    }
  });

  // 完好文档不得触发多余的写回（否则每次启动都会写盘）。
  it('reports no change for a document that is already valid', () => {
    const result = norm(validSave());
    expect(result.changed).toBe(false);
    expect(result.save).toEqual(validSave());
    expect(result.staleKeys, '完好 v5 档不该带旧形态键').toEqual([]);
  });

  // §2.4 v1.3 / DEC-1：星账换算在**身份轴**上逐条做；长度对位不再是运行期概念。
  it('normalizes the star ledger per §2.4/§6: per-key clamp, unknown form → all zero', () => {
    // 无账形（缺失 / 类型错 / 空记录 / 空数组）⇒ 全槽 0（沿旧「非数组 ⇒ 全 0」臂语义）。
    for (const bad of [undefined, null, 3, 'stars', [], {}, true]) {
      const result = norm({ ...validSave(), starsByUid: bad });
      expect(result.save.starsByUid).toEqual(starsLedger(new Array(LEVEL_COUNT).fill(0)));
      expect(result.changed).toBe(true);
    }
    // §6：小数**向下取整**；越界 / 非有限数钳 0；上界 = STAR_MAX(3)——**逐键**钳，口径逐字不变。
    const messy = { [KEYS[0]]: 5, [KEYS[1]]: -1, [KEYS[2]]: 2.7, [KEYS[3]]: Number.NaN };
    const messyDoc = { ...validSave(), starsByUid: { ...starsLedger(STAR_SEQ), ...messy } };
    const repaired = norm(messyDoc);
    expect(repaired.save.starsByUid[KEYS[0]]).toBe(3);
    expect(repaired.save.starsByUid[KEYS[1]]).toBe(0);
    expect(repaired.save.starsByUid[KEYS[2]]).toBe(2);
    expect(repaired.save.starsByUid[KEYS[3]]).toBe(0);
    expect(repaired.changed, '钳正 ⇒ 写回一次').toBe(true);
    // 逐项钳正**不弃整档**：其余字段照常读出。
    expect(repaired.save.runs).toBe(3);
    expect(repaired.maxUnlockedIndex, '身份指针不受星账钳正牵连').toBe(3);
    // 「档短于关表」（旧 §2.4 的长度臂）在新制下 = 缺记录槽 ⇒ 补 0，⛔ 不搬前缀。
    const short = norm({ ...validSave(), starsByUid: { [KEYS[0]]: 3 } });
    expect(short.save.starsByUid, '缺槽补 0、余槽不因长度失配对位').toEqual(starsLedger([3]));
    // 反向：档长于关表 ⇒ 多出的键 = 孤儿，走 §8-17 逐条作废（见下族）。
  });

  // §8-14（v1.3 订正后地位）+ §8-21：**一次性入口**，此后不再有位置轴。
  it('carries a positional v4 document in ONCE and lands the identity form (§8-14 / §8-21)', () => {
    const OLD = STAR_SEQ.slice(0, Math.max(0, LEVEL_COUNT - 1)); // 比关池少一关的旧档（= 扩池场景）
    const first = norm(positionalDoc(OLD));
    // ① 可对位部分逐条无损（按身份落键，0 星也在）。
    expect(first.save.starsByUid, '旧第 i 位 ⇒ 当时关表第 i 关的身份').toEqual(starsLedger(OLD));
    // ② 新增槽 = 0 星（由稠密物化兑住，⛔ 不留空洞键）。
    expect(first.save.starsByUid[KEYS[KEYS.length - 1]]).toBe(0);
    // ③ `changed = true` ⇒ 写回恰一次；旧形态键被点名待清。
    expect(first.changed).toBe(true);
    expect(first.staleKeys).toEqual(['starsByLevel']);
    const patch = toBeadsSavePatch(first.save, first.staleKeys);
    const stored = jsonRoundTrip(patch);
    expect('starsByLevel' in stored, '写回档内 ⛔ 不得残留位置型数组（DEC-1 双轨禁令）').toBe(false);
    expect(stored['starsByUid']).toEqual(starsLedger(OLD));
    // ④ 第二次读同一档 ⇒ `changed = false`（幂等，不每次启动写盘）且**不再经搬运腿**。
    const second = norm(stored);
    expect(second.save.starsByUid).toEqual(starsLedger(OLD));
    expect(second.changed, '迁移只写一次').toBe(false);
    expect(second.staleKeys).toEqual([]);
    // ④ 的加强臂：第二次读**换一条轴**（前两关对调）⇒ 星随身份走，⛔ 随位置走。
    //   若搬运腿仍在跑（位置寻址），对调轴会把 3★ 挪到第二关 ⇒ 本断言即红。
    const swapped = [KEYS[1], KEYS[0], ...KEYS.slice(2)];
    const third = norm(stored, swapped);
    expect(third.save.starsByUid[KEYS[0]], '身份不变 ⇒ 星不变').toBe(3);
    expect(third.save.starsByUid[KEYS[1]], '身份不变 ⇒ 星不变').toBe(2);
    // 反向臂（关池变小、旧档长于关卡数）⇒ 超出部分逐条作废，前缀无损。
    const shrunk = norm(positionalDoc(STAR_SEQ), KEYS.slice(0, 3));
    expect(shrunk.save.starsByUid).toEqual(starsLedger(STAR_SEQ.slice(0, 3), LEVELS.slice(0, 3)));
    // 非数组臂（`starsByUid` 缺 + `starsByLevel` 为字符串）⇒ 全 0（§2.4 行口径不变）。
    expect(norm({ ...validSave(), starsByUid: undefined, starsByLevel: 'stars' }).save.starsByUid)
      .toEqual(starsLedger(new Array(LEVEL_COUNT).fill(0)));
  });

  // §8-21 ⛔ 双轨并存（本次改判明确禁止的形态）：两形齐备时身份形**必须赢**。
  it('never lets the positional form win when both forms coexist (§8-21 / DEC-1 ⛔ 双轨)', () => {
    const both = {
      ...validSave(),
      starsByUid: starsLedger([0, 0, 3]),
      starsByLevel: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3].slice(0, LEVEL_COUNT),
    };
    const result = norm(both);
    expect(result.save.starsByUid, 'uid 形优先，⛔ 不被旧数组覆盖').toEqual(starsLedger([0, 0, 3]));
    expect(result.staleKeys, '旧数组须被点名清除').toEqual(['starsByLevel']);
    expect(result.changed, '并存即脏档 ⇒ 必须写回一次收敛成单轨').toBe(true);
    const stored = jsonRoundTrip(toBeadsSavePatch(result.save, result.staleKeys));
    expect('starsByLevel' in stored).toBe(false);
    expect(norm(stored).changed, '收敛后二次读幂等').toBe(false);
  });

  // §8-2：历史最高星不被低星覆盖 —— 钳制只做上下界，不做「取大」（取大在游戏侧过关时做）。
  it('does not invent a max() over the stars ledger (that rule lives in the game, not the schema)', () => {
    const lower = norm({ ...validSave(), starsByUid: starsLedger([1]) });
    expect(lower.save.starsByUid[KEYS[0]]).toBe(1); // 原样保留，schema 不做 max
    expect(lower.changed).toBe(false);
  });

  // S1 §8-10：越界值安全降级，不崩溃、不中断启动。
  // S-2b 后旧数值键 = v4 档的**一次性入口**（身份键缺位时才读）；越界一律降级到首关。
  it('degrades out-of-range legacy level indices to the first level', () => {
    const legacy = (extra: Record<string, unknown>) => ({
      ...validSave(), maxUnlockedKey: '', lastPlayedKey: '', ...extra,
    });
    expect(norm(legacy({ maxUnlockedLevel: 99 })).maxUnlockedIndex).toBe(0);
    expect(norm(legacy({ currentLevel: 0 })).lastPlayedIndex).toBe(0);
    expect(norm(legacy({ currentLevel: LEVEL_COUNT + 1 })).lastPlayedIndex).toBe(0);
    expect(norm(legacy({ currentLevel: 2.5 })).lastPlayedIndex).toBe(0);
    expect(norm(legacy({ maxUnlockedLevel: '4' })).maxUnlockedIndex).toBe(0);
  });

  it('accepts both bounds of the legal legacy level range', () => {
    const legacy = (extra: Record<string, unknown>) => ({
      ...validSave(), maxUnlockedKey: '', lastPlayedKey: '', ...extra,
    });
    expect(norm(legacy({ currentLevel: 1 })).lastPlayedIndex).toBe(0);
    expect(norm(legacy({ currentLevel: LEVEL_COUNT })).lastPlayedIndex).toBe(LEVEL_COUNT - 1);
  });

  it('degrades counters that are missing, negative or non-finite to 0', () => {
    for (const bad of [undefined, -1, Number.NaN, Number.POSITIVE_INFINITY, '9']) {
      const save = norm({ ...validSave(), runs: bad, sprintBestScore: bad }).save;
      expect(save.runs).toBe(0);
      expect(save.sprintBestScore).toBe(0);
    }
  });

  // save-progress §2.2 的核心：settings 缺字段按**单字段**降级，绝不弃整档。
  it('degrades settings per field instead of discarding the document', () => {
    const missing = norm({ ...validSave(), settings: undefined });
    expect(missing.save.settings).toEqual({
      bgmMuted: false,
      sfxMuted: false,
      reduceMotion: false,
      largeText: false,
      vibrate: true,
      debugInfo: false,
      ...SETTINGS_DEFAULTS,
    });
    expect(missing.lastPlayedIndex).toBe(2); // progression survived
    expect(missing.changed).toBe(true);

    expect(normalizeSettings({ bgmMuted: true })).toEqual({
      bgmMuted: true,
      sfxMuted: false,
      reduceMotion: false,
      largeText: false,
      vibrate: true,
      debugInfo: false,
      ...SETTINGS_DEFAULTS,
    });
    expect(normalizeSettings({ sfxMuted: true })).toEqual({
      bgmMuted: false,
      sfxMuted: true,
      reduceMotion: false,
      largeText: false,
      vibrate: true,
      debugInfo: false,
      ...SETTINGS_DEFAULTS,
    });
    expect(normalizeSettings('nonsense')).toEqual({
      bgmMuted: false,
      sfxMuted: false,
      reduceMotion: false,
      largeText: false,
      vibrate: true,
      debugInfo: false,
      ...SETTINGS_DEFAULTS,
    });
    expect(normalizeSettings({ bgmMuted: 'yes' })).toEqual({
      bgmMuted: false,
      sfxMuted: false,
      reduceMotion: false,
      largeText: false,
      vibrate: true,
      debugInfo: false,
      ...SETTINGS_DEFAULTS,
    });
  });

  // WXG-T-088：v1→v2 升位——旧档（无 reduceMotion / largeText）装载后进度全保留、
  // 新开关逐字段降级 false，绝不因“版本号落后”而重置（旧档不炸）。
  // ⚠ v5 起该腿同时是「v1 位置档 → 身份档」的一次性入口（§8-21）。
  // **S-7 改严**（ADR-0034 §6 S-7）：每级迁移各返回 `n+1` ⇒ v1 档必须逐级走完
  // 1→2→3→4→5。`migrationsApplied` 只记**落点**（框架 `SaveManager.load` 的既有语义，
  // ⛔ 本批不改 core）⇒ 恰为 `[2,3,4,5]`：4 次跃迁、5 个版本台阶（含起点 1）。
  it('migrates a v1 document through the full 1→2→3→4→5 chain', () => {
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
      // 注册**全链**：改严后缺任何一级都会在 `migrations[current]` 缺位时 reset（M-13 咬此）。
      // 与生产**同一真源**（`BEADS_MIGRATIONS`，S-7）⇒ 测试不可能「自己注册全、生产漏一级」。
      migrations: BEADS_MIGRATIONS,
    });
    const loaded = manager.load();
    expect(loaded.wasReset).toBe(false);
    expect(loaded.migrationsApplied, '逐级落点必须一个不缺').toEqual([2, 3, 4, 5]);

    const normalized = norm(loaded.data);
    // 进度、原开关一字未动；新开关逐字段降级 false。
    expect(normalized.save.version).toBe(SAVE_VERSION);
    expect(normalized.save.runs).toBe(7);
    expect(normalized.maxUnlockedIndex).toBe(4);
    expect(normalized.lastPlayedIndex).toBe(4);
    expect(normalized.save.sprintBestScore).toBe(9999);
    // 位置档 ⇒ 身份档：值序列逐条无损（展平回下标轴后与旧档逐位相同）。
    expect(normalized.save.starsByUid).toEqual(starsLedger(v1.starsByLevel));
    expect(flattenStars(normalized.save.starsByUid, KEYS)).toEqual(
      v1.starsByLevel.concat(new Array(LEVEL_COUNT - v1.starsByLevel.length).fill(0)),
    );
    expect(normalized.staleKeys, 'v1 档带旧数组 + 两条旧数值指针 ⇒ 写回须清').toEqual(['starsByLevel', 'maxUnlockedLevel', 'currentLevel']);
    expect(normalized.save.settings).toEqual({
      bgmMuted: true,
      sfxMuted: true,
      reduceMotion: false,
      largeText: false,
      vibrate: true,
      debugInfo: false,
      // EP11-S5 / S8 §8-13：v1→v2 迁移体**零换肤代码**，两新字段由 normalize 逐字段兜底。
      ...SETTINGS_DEFAULTS,
    });
  });

  // S1 §8-1：无存档 → 第 1 关；有进度 → 续进已解锁最远关。
  it('§8-1 boots level 1 on a first run and resumes the stored level otherwise', () => {
    expect(bootLevel(defaultBeadsSave(), 0)).toBe(1);
    expect(bootLevel({ ...defaultBeadsSave(), runs: 1 }, 2)).toBe(3);
    // A first run always starts at level 1, whatever the pointer says.
    expect(bootLevel({ ...defaultBeadsSave(), runs: 0 }, 4)).toBe(1);
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

/* ═══════ WXG-T-344 · ADR-0034 §6 第 2/5 步 — 身份化免疫族（判据源 = S8 v1.3 §8-16 ～ §8-22）═══════ */

/** 三种「内容变更」后的轴（全部由 `KEYS` 派生，⛔ 手抄 token）。 */
const NEW_UID = 'L99001';
const APPEND_UID = 'L99002';
const WITH_INSERT = [...KEYS.slice(0, 2), NEW_UID, ...KEYS.slice(2)]; // ① 章内插一关（插在第 3 槽）
const WITH_APPEND = [...KEYS, APPEND_UID];                              // ③ 全表末尾追加
const WITH_SWAP = [KEYS[1], KEYS[0], ...KEYS.slice(2)];                 // ② 调展示序（前两关对调）

describe('§8-16 身份化免疫（I2 / I4）：关表三种变更 ⇒ 未变更关逐条无损', () => {
  /** 三条 ✅ 的共同断言体（插关 / 调序 / 追加共用；判据逐字来自 §8-16）。 */
  function expectImmune(keys: readonly string[], label: string): void {
    const result = norm(validSave(), keys);
    for (let i = 0; i < KEYS.length; i += 1) {
      expect(result.save.starsByUid[KEYS[i]], `${label}：${KEYS[i]} 的历史最高星必须无损`).toEqual(STAR_SEQ[i]);
    }
    const carried = KEYS.reduce((sum, k) => sum + (result.save.starsByUid[k] ?? 0), 0);
    expect(carried, `${label}：总星数 = 可对位记录之和`).toBe(STAR_SEQ.reduce((a, b) => a + b, 0));
    expect(result.save.maxUnlockedKey, `${label}：解锁位身份不丢`).toBe(KEYS[3]);
    expect(result.maxUnlockedIndex, `${label}：解锁位随身份落到新下标`).toBe(keys.indexOf(KEYS[3]));
    expect(result.save.lastPlayedKey, `${label}：推进位身份不丢`).toBe(KEYS[2]);
    expect(result.lastPlayedIndex, `${label}：推进位随身份落到新下标`).toBe(keys.indexOf(KEYS[2]));
  }

  it('① 章内插一关 ⇒ 新关 0 星、其余逐条不动（且写回幂等）', () => {
    expectImmune(WITH_INSERT, '章内插一关');
    const result = norm(validSave(), WITH_INSERT);
    expect(result.save.starsByUid[NEW_UID], '新关无记录 = 0 星（稠密补位）').toBe(0);
    expect(result.changed, '新增槽补 0 ⇒ 需一次写回').toBe(true);
    expect(norm(result.save, WITH_INSERT).changed, '补位后二次读幂等').toBe(false);
  });

  it('② 章内调展示序 ⇒ 星随身份走（轴换了，账没换）', () => {
    expectImmune(WITH_SWAP, '调展示序');
    const result = norm(validSave(), WITH_SWAP);
    expect(result.changed, '轴含同一批身份 ⇒ 无补写，幂等').toBe(false);
  });

  it('③ 全表末尾追加一关 ⇒ 与旧「前缀搬运」同效，但⛔ 不依赖该前提', () => {
    expectImmune(WITH_APPEND, '末尾追加');
    expect(norm(validSave(), WITH_APPEND).save.starsByUid[APPEND_UID]).toBe(0);
  });

  it('反例臂（钉住「位置寻址即缺陷」）：同一插关下位置形必读错格（§8-16 反例 / §2.6.5-3 近似迁移）', () => {
    const positional = positionalDoc(STAR_SEQ);
    expect(positional.starsByUid).toBeUndefined(); // 构造自证：这是一份只有位置轴的旧档
    const bad = norm(positional, WITH_INSERT);
    // 旧第 3 位的 1★ 落到了**插进来的新关**头上，而 L00003 自己的 1★ 被抹成 0。
    expect(bad.save.starsByUid[NEW_UID], '位置对位 ⇒ 新关凭空继承邻居的星').toBe(1);
    expect(bad.save.starsByUid[KEYS[2]], '位置对位 ⇒ 老关的星被挪走').toBe(0);
    // ⚠ 本臂**不是**验收，而是把「为何必须换制」钉在测试里：该腿只在一次性入口内可达；
    //   运行期常规读档路径已由上面三臂 + §8-21 幂等臂封死（终态档内 ⛔ 无位置数组）。
  });
});

describe('§8-17 孤儿记录逐条作废（I3 / §2.6.4）：对不上号的那一条单独作废，⛔ 不弃整档', () => {
  it('档内引用一条关表里已不存在的关 ⇒ 该条作废、其余无损、写回恰一次、幂等', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
    try {
      const orphanDoc = { ...validSave(), starsByUid: { ...starsLedger(STAR_SEQ), 'L00777': 3 } };
      const first = norm(orphanDoc);
      expect(first.save.starsByUid['L00777'], '孤儿记录不得被消费').toBeUndefined();
      // 其余记录逐条无损（⛔ 整批回滚 = 清档，违反 §2.6.4-1）。
      for (let i = 0; i < KEYS.length; i += 1) expect(first.save.starsByUid[KEYS[i]]).toEqual(STAR_SEQ[i]);
      expect(first.save.runs).toBe(3);
      expect(first.save.settings).toEqual(validSave().settings);
      expect(first.changed).toBe(true);
      // 幂等：第二读 `changed = false`。
      expect(norm(first.save).changed, '作废只写回一次').toBe(false);
      // 可观测 = I3 必需项，但走**日志计数**、⛔ 玩家可见反馈、⛔ 抛异常。
      expect(warn.mock.calls.length, '一次性 warn 恰一条').toBe(1);
      expect(String(warn.mock.calls[0][0])).toContain('dropped=1');
    } finally {
      warn.mockRestore();
    }
  });

  it('⛔ 不得把孤儿当类型错而走「全档出厂默认」（§8-17 红条件）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
    try {
      const allOrphan = { ...validSave(), starsByUid: { 'L00801': 3, 'L00802': 2 } };
      const result = norm(allOrphan);
      expect(result.save.runs, '全孤 ⇒ 只作废星账条目，其余字段照常读出').toBe(3);
      expect(result.save.sprintBestScore).toBe(1200);
      expect(result.save.starsByUid, '全孤 ⇒ 稠密全 0，⛔ 不是 defaultBeadsSave 的 {}').toEqual(
        starsLedger(new Array(LEVEL_COUNT).fill(0)),
      );
      expect(result.save).not.toEqual(defaultBeadsSave());
      expect(() => norm(allOrphan), '⛔ 抛异常 = 中断启动').not.toThrow();
      // 「一次性」= **每档一条汇总**（非逐条刷屏）；本例调了两次归一化 ⇒ 恰两条。
      expect(warn.mock.calls.length).toBe(2);
      for (const call of warn.mock.calls) expect(String(call[0])).toContain('dropped=2');
    } finally {
      warn.mockRestore();
    }
  });

  it('出厂新档（无账）⇒ 稠密全 0 且 ⛔ 不误报 warn（missing 不单独触发告警）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
    try {
      const fresh = norm({ ...validSave(), starsByUid: undefined });
      expect(fresh.save.starsByUid).toEqual(starsLedger(new Array(LEVEL_COUNT).fill(0)));
      expect(fresh.changed).toBe(true);
      expect(warn.mock.calls.length, '新关无记录 = 正常事实，⛔ 刷屏告警').toBe(0);
    } finally {
      warn.mockRestore();
    }
  });
});

/**
 * §8-18 章维变更（v1.3-R 整条改写）：星账按**关身份**扁平记账 ⇒ 章归属每次构建由章清单重生，
 * 故「改章名 / 删一章 / 拆章重分」三臂只改**章表**、不动存档，关级记录连一次作废都不许发生。
 * 夹具构造 = 由改造后的章清单（`levelRefs` ⇒ `LEVELS` 的 id 轴 ⇒ 身份 token）重导出关表轴。
 */
function axisOfChapters(chapters: readonly { levelRefs: readonly (readonly [number, number])[] }[]): string[] {
  const ids: number[] = [];
  for (const ch of chapters) {
    for (const [from, to] of ch.levelRefs) {
      for (let id = from; id <= to; id += 1) ids.push(id);
    }
  }
  const byId = new Map(LEVELS.map((l) => [l.id, l]));
  return ids.map((id) => byId.get(id)?.uid ?? '');
}

describe('§8-18 章维变更对关身份账无损（⚠ v1.3-R：改章表不动存档 ⇒ ⛔ 任何关级记录作废）', () => {
  it('臂① 改章 id（改名）⇒ 轴恒等、逐键相等、零作废、幂等', () => {
    const renamed = ARCS.map((a) => ({ levelRefs: a.levelRefs, id: `${a.id}-v2`, title: `${a.title}（改名）` }));
    const axis = axisOfChapters(renamed);
    expect(axis).toEqual(KEYS); // 结构自证：章改名对关身份轴零影响
    const result = norm(validSave(), axis);
    expect(result.save.starsByUid).toEqual(validSave().starsByUid);
    expect(result.changed, '无补写 ⇒ 幂等，⛔ 不产生多余写回').toBe(false);
  });

  it('臂② 删一章（名下关改归他章）⇒ ⛔ 不得有「按章批量清掉名下记录」的分支', () => {
    const merged = [{ levelRefs: ARCS.flatMap((a) => a.levelRefs) }];
    const axis = axisOfChapters(merged);
    expect(axis.length).toBe(KEYS.length); // 一关恰属一章（§8-22-③ 同族前提，⛔ 弄哑）
    const result = norm(validSave(), axis);
    expect(Object.keys(result.save.starsByUid).length, '逐键相等 ⇒ 一条都没被清').toBe(KEYS.length);
    expect(result.save.starsByUid).toEqual(validSave().starsByUid);
    expect(result.changed).toBe(false);
  });

  it('臂③ 拆章重分（同一批关换归属）⇒ 记录无损；严/松变化属门票侧，不属本条（§2.6.3 跨章移关行）', () => {
    const half = Math.ceil(KEYS.length / 2);
    const split = [
      { levelRefs: [[1, half] as readonly [number, number]] },
      { levelRefs: [[half + 1, LEVEL_COUNT] as readonly [number, number]] },
    ];
    const axis = axisOfChapters(split);
    const result = norm(validSave(), axis);
    expect(result.save.starsByUid).toEqual(validSave().starsByUid);
    for (let i = 0; i < KEYS.length; i += 1) expect(result.save.starsByUid[KEYS[i]]).toEqual(STAR_SEQ[i]);
    expect(result.maxUnlockedIndex).toBe(KEYS.indexOf(KEYS[3]));
    expect(result.changed).toBe(false);
  });

  it('静态臂：星账层 ⛔ 不存在章维账本（§8-18：章 id 一旦参与判定，✅ 立刻退回 ❌）', () => {
    const src = readFileSync(resolve(REPO, 'games/beads/src/game/save-schema.ts'), 'utf8');
    // 只禁**代码形**（标识符 / 字段名），注释里讨论「采纳案不把章身份写进存档」是合法登记。
    expect(/starsByChapter|chapterStars|arcStars|starsByArc|levelRefs/.test(src), '存档层不得出现章维星账').toBe(false);
  });
});

/* ═══════════════ WXG-T-211-B1 · QA §K.3 存档族两条（S8 §8-12/§8-13）══════════════════ */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SAVE_SRC = resolve(REPO, 'games/beads/src/game/save-schema.ts');

/** 六字段基线（腿① 的「其余无损」参照物）+ EP11-S5 两新字段（共八字段）。 */
const ALL_ON = { bgmMuted: true, sfxMuted: true, reduceMotion: true, largeText: true, vibrate: false, debugInfo: true, ...SETTINGS_DEFAULTS };

describe('TC-SAVE-12 腿① · §8-12 字段级隔离结构的现成回归锚（六字段上构造）', () => {
  // §8-12 四构造（①缺失 ②类型错 ③未注册 styleId ④豆径越界）中，**只有腿①可立即执行**：
  // 现有六字段上构造「缺 `vibrate`」/「`debugInfo` 类型错」⇒ 该字段取默认、其余无损。
  // 腿②④ 需 `beadStyle` / 豆径档字段先入档（= 步 5）；腿③ 的 registry 前置本单已就位
  // （`view/bead-styles/registry.ts`），但仍需字段先存在 ⇒ 三条均 **⛔ 本单不可测**，只在此登记。
  it('缺 `vibrate` ⇒ 该字段取默认 ON（与其余四开关的 false 相反），五字段与进度全无损', () => {
    const { vibrate: _omitted, ...settingsWithoutVibrate } = ALL_ON;
    expect('vibrate' in settingsWithoutVibrate).toBe(false); // 构造自证：字段确实缺失
    const result = norm({ ...validSave(), settings: settingsWithoutVibrate });
    // 该字段单独回落默认（§3.8 VIBRATE_DEFAULT = ON）。
    expect(result.save.settings.vibrate).toBe(VIBRATE_DEFAULT);
    expect(result.save.settings.vibrate).toBe(true);
    // 其余五字段**不受影响**（字段级隔离；含与 vibrate 默认值相反的 false 族不得被带跳）。
    expect(result.save.settings).toEqual({ ...ALL_ON, vibrate: true });
    // 不弃整档：进度 / 星级 / runs 逐字段无损。
    expect(result.save.runs).toBe(3);
    expect(result.save.maxUnlockedKey).toBe(KEYS[3]);
    expect(result.save.lastPlayedKey).toBe(KEYS[2]);
    expect(result.save.sprintBestScore).toBe(1200);
    expect(result.save.starsByUid).toEqual(starsLedger(STAR_HEAD));
    // **B1-Q3 已随 EP11-S5 修正**：旧实现是 `normalizeSettings(raw)` 与同源产物的自我
    // 比较 ⇒ 单字段缺失永不报 changed；现按「原始文档 vs 归一结果」比较 ⇒ 补写回 1 次。
    // （patch 型全量写档不变，不 bump 版本，S8 §8-12；本断言即该修正的正面锚。）
    expect(result.changed).toBe(true);
    expect(norm({ ...validSave(), settings: undefined }).changed).toBe(true);
    // 反向下限（阳性对照，K-060）：八字段俱备的完好档仍不得报 changed（否则每次启动都写盘）。
    expect(norm(validSave()).changed).toBe(false);
  });

  it('`debugInfo` 类型错（非布尔）⇒ 该字段取默认 false，其余五字段无损，不抛异常', () => {
    for (const bad of ['on', 1, null, undefined, {}, []]) {
      const result = norm({ ...validSave(), settings: { ...ALL_ON, debugInfo: bad } });
      expect(result.save.settings.debugInfo).toBe(false);
      expect(result.save.settings).toEqual({ ...ALL_ON, debugInfo: false });
      expect(result.save.runs).toBe(3);
      expect(result.save.starsByUid).toEqual(starsLedger(STAR_HEAD));
    }
    // BOOT 不报错：整档非文档输入也只是降级默认（既有判例，本条不重写）。
    expect(() => norm({ ...validSave(), settings: 'nonsense' })).not.toThrow();
    expect(norm({ ...validSave(), settings: 'nonsense' }).save.settings)
      .toEqual({ bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true, debugInfo: false, ...SETTINGS_DEFAULTS });
  });
});

describe('TC-SAVE-13 · §8-13 「无换肤迁移代码」静态哨 (a)(b)(c) + K-060 阳性对照', () => {
  /**
   * 限定语义的三条规则（⛔ 泛 grep「migrat」必假红 —— `migrateV2ToV3` 在体内写
   * `onboarded` = 既有合法判例，见 save-schema.ts:143-152）：
   *  (a) `migrate*` 函数体内不得出现 `beadStyle` / 豆径档字段的赋值或推算；
   *  (b)  migrate 体只允许透传 `version`（赋值键白名单）⇒ 不得以换肤为由把新字段
   *      偷渡进迁移链；`SAVE_VERSION` 钉值 = 任何 bump 都必须先过差分记账重钉本例；
   *  (c) 文案**字面量**（非注释）不得出现「皮肤已变更」类玩家告知。
   * 实现与断言同处本文件：规则写成可复用函数，**阳性对照腿直接吃合成注入串**
   * ⇒ 同时证明「规则能命中」与「现码零命中」，防“永不命中而假绿”（K-060）。
   *
   * ⚠ **本哨只保护「无换肤迁移」，不保护 ADR-0034 的星账换算**：`migrateV4ToV5` 的
   *   合法形态 = **只做版本标记**（DEC-4），真正的对位换算住 `normalizeBeadsSave`
   *   （DEC-5 形态探测），故它落在 (b) 白名单内 ⇒ 本例的绿**不读作**星账迁移已验，
   *   那一面由上方 §8-14 / §8-21 两族负责（K-035 纪律）。
   */
  const SKIN_TOKENS = /beadStyle|beadSizeTier|sizeTier|豆径|豆子尺寸|满豆档|小豆档/;
  const SKIN_COPY = /皮肤已|风格已变更|已为您(切换|更换)|新皮肤|换肤成功|默认皮肤已/;
  const ALLOWED_MIGRATE_KEYS = new Set(['version', 'onboarded']);

  /** 抽取 `export function migrateXxx(...) { … }` 的函数体（体以顶格 `}` 结束）。 */
  function migrateBodies(source: string): { name: string; body: string }[] {
    const out: { name: string; body: string }[] = [];
    const re = /export function (migrate\w+)\s*\([^)]*\)\s*(?::[^{]+)?\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) {
      const rest = source.slice(m.index + m[0].length);
      const end = rest.indexOf('\n}');
      out.push({ name: m[1], body: end === -1 ? rest : rest.slice(0, end) });
    }
    return out;
  }

  /** 一次扫描三条规则 ⇒ 返回违规行（空数组 = 绿）。 */
  function scanSkinMigration(source: string, label: string): string[] {
    const hits: string[] = [];
    for (const { name, body } of migrateBodies(source)) {
      if (SKIN_TOKENS.test(body)) hits.push(`(a) ${label}::${name} 体内出现换肤字段语义`);
      const keys = [...body.matchAll(/[{,]\s*([A-Za-z_]\w*)\s*:/g)].map((k) => k[1]);
      const illegal = keys.filter((k) => !ALLOWED_MIGRATE_KEYS.has(k));
      if (illegal.length > 0) hits.push(`(b) ${label}::${name} 赋值键越出白名单 {version, onboarded}：${illegal.join(', ')}`);
    }
    // (c) 只看字符串字面量（注释里讨论「不做换肤迁移」是合法登记，不得误伤）。
    for (const lit of source.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g)) {
      const text = lit[1] ?? lit[2] ?? lit[3] ?? '';
      if (SKIN_COPY.test(text)) hits.push(`(c) ${label} 文案字面量含玩家告知：${text}`);
    }
    return hits;
  }

  /** 递归收采 src 下全部 .ts（文案哨不得有目录盲区）。 */
  function tsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...tsFiles(full));
      else if (entry.endsWith('.ts')) out.push(full);
    }
    return out;
  }

  it('(a)(b)(c) 现码零命中 ⇒ 护栏哨兵绿（⛔ 其绿不读作 §8-13「旧档不丢档」已验）', () => {
    const bodies = migrateBodies(readFileSync(SAVE_SRC, 'utf8'));
    // 前提哨兵：抽取函数本身能抽到全部四条合法迁移（否则 (a)(b) 扫的是空集 = 假绿）。
    // WXG-T-344：`migrateV4ToV5` 入链 ⇒ 本钉值随 ADR-0034 DEC-4 同批改此（差分记账见 ADR §6 第 2 步）。
    expect(bodies.map((b) => b.name)).toEqual([
      'migrateV1ToV2',
      'migrateV2ToV3',
      'migrateV3ToV4',
      'migrateV4ToV5',
    ]);
    const srcFiles = tsFiles(resolve(REPO, 'games/beads/src'));
    expect(srcFiles.length).toBeGreaterThan(20);
    const hits = srcFiles.flatMap((f) => scanSkinMigration(readFileSync(f, 'utf8'), f.replace(`${REPO}/`, '')));
    expect(hits).toEqual([]);
    // (b) 的钉值形式：SAVE_VERSION = 5（ADR-0034 DEC-4 换制 bump；任何再 bump 都须先过本钉值差分）。
    expect(SAVE_VERSION).toBe(5);
  });

  it('K-060 阳性对照：注入假想换肤迁移分支 ⇒ 三条规则均能命中（⛔ 不得永真绿）', () => {
    const injectedA = `export function migrateV5ToV6(doc: Record<string, unknown>): Record<string, unknown> {
  return { ...doc, beadStyle: 'facet-4', version: SAVE_VERSION };
}`;
    const hitsA = scanSkinMigration(injectedA, 'inject-a');
    expect(hitsA.some((h) => h.startsWith('(a)'))).toBe(true);
    expect(hitsA.some((h) => h.startsWith('(b)') && h.includes('beadStyle'))).toBe(true);
    // 推算形式（不写字面字段名但赋值旧档推算）⇒ (b) 键白名单仍命中。
    const injectedB = `export function migrateV5ToV6(doc: Record<string, unknown>): Record<string, unknown> {
  const tier = num(doc['runs'], 0) > 0 ? 'compact' : 'full';
  return { ...doc, sizeTier: tier, version: SAVE_VERSION };
}`;
    expect(scanSkinMigration(injectedB, 'inject-b').some((h) => h.includes('sizeTier'))).toBe(true);
    // (c) 补发告知文案⇒ 命中；同串出现在**注释**里不得误伤。
    expect(scanSkinMigration("const t = '皮肤已变更，已为您切回默认';", 'inject-c').length).toBe(1);
    expect(scanSkinMigration('// 皮肤已变更类告知 = 明确不做（C9 知情项）\nexport function migrateV9ToV10(doc: Record<string, unknown>): Record<string, unknown> {\n  return { ...doc, version: SAVE_VERSION };\n}', 'inject-comment')).toEqual([]);
  });
});

/* ═════════ ADR-0034 DEC-3 换算三函数（纯函数臂：⛔ 不持状态、⛔ 不进热路径）═════════ */

describe('ADR-0034 DEC-3：uid ↔ index 双向换算 = 纯函数，恰在写读两边界各一次', () => {
  it('flatten ∘ collapse = 恒等（在稠密账 + 全槽有身份的前提下）', () => {
    const slots = STAR_SEQ.slice();
    const ledger = collapseStars(slots, KEYS);
    expect(ledger).toEqual(starsLedger(slots));
    expect(flattenStars(ledger, KEYS)).toEqual(slots);
  });

  it('无身份槽（空串）双向都跳过 ⇒ 不入档、不占位、⛔ 不发明 token', () => {
    const keys = ['', KEYS[0], ''];
    const ledger = collapseStars([3, 2, 1], keys);
    expect(Object.keys(ledger)).toEqual([KEYS[0]]); // 只有有身份的那一槽入档
    expect(ledger[KEYS[0]]).toBe(2);
    expect(flattenStars(ledger, keys)).toEqual([0, 2, 0]); // 无身份槽恒 0（内存态可显示，⛔ 不落档）
  });

  it('展平只投影 ⛔ 不二次钳（双钳 = 两条口径，钳臂 M-7 会失去归因）', () => {
    expect(flattenStars({ [KEYS[0]]: 99 }, KEYS)[0]).toBe(99);
  });

  it('收拢以较短轴为准（两轴失配时 ⛔ 不越界读、⛔ 不造新键）', () => {
    expect(Object.keys(collapseStars([3, 3, 3, 3], KEYS.slice(0, 2)))).toEqual(KEYS.slice(0, 2));
    expect(Object.keys(collapseStars(STAR_SEQ, KEYS.slice(0, 3)))).toEqual(KEYS.slice(0, 3));
  });

  it('toBeadsSavePatch 把旧形态键置 undefined ⇒ JSON 落盘即物理消失（框架 patch 不删键的兑法）', () => {
    const save = norm(positionalDoc(STAR_SEQ)).save;
    const stale = norm(positionalDoc(STAR_SEQ)).staleKeys;
    const patch = toBeadsSavePatch(save, stale) as Record<string, unknown>;
    expect(patch['starsByLevel']).toBeUndefined();
    expect(jsonRoundTrip(patch)['starsByLevel']).toBeUndefined();
    expect(Object.keys(patch)).toContain('starsByUid');
  });

  it('migrateV4ToV5 只做版本标记（DEC-4：⛔ 在迁移体里换算，那里拿不到关表轴）', () => {
    const doc = positionalDoc(STAR_SEQ);
    const out = migrateV4ToV5(jsonRoundTrip({ ...doc, starsByUid: undefined }));
    expect(out['version']).toBe(SAVE_VERSION);
    expect(out['starsByLevel'], '迁移体不碰星账形态').toEqual(STAR_SEQ);
    expect(out['runs']).toBe(3);
  });
});

/* ══════ §8-22-④ 静态臂：身份通道的消费点唯一（⛔ 运行期存在第二条「长度对位」读路径）══════ */

describe('§8-22 静态臂：内容身份只有一条消费链（判据正文住 GDD §8-22，落码切片 = ADR-0034 S-1）', () => {
  function srcFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...srcFiles(full));
      else if (entry.endsWith('.ts')) out.push(full);
    }
    return out;
  }
  const SRC_DIR = resolve(REPO, 'games/beads/src');
  const files = srcFiles(SRC_DIR);
  const rel = (f: string) => f.replace(`${SRC_DIR}/`, '');
  const hitsOf = (needle: RegExp) => files.filter((f) => needle.test(readFileSync(f, 'utf8'))).map(rel);

  it('① `starsByUid` 只许出现在存档层与两个边界点（⛔ 视图 / 渲染 / shell 不得持有身份账）', () => {
    expect(hitsOf(/starsByUid/).sort()).toEqual(['game/beads-game.ts', 'game/save-schema.ts']);
  });

  it('② 身份表构造式 `levelIdentityKeys(` 在 `beads-game.ts` 恰两处（BOOT 装配 + 导入追加），⛔ 第三处 = 第二真源', () => {
    const game = readFileSync(join(SRC_DIR, 'game/beads-game.ts'), 'utf8');
    expect((game.match(/levelIdentityKeys\(/g) ?? []).length).toBe(2);
    expect(hitsOf(/levelIdentityKeys\(/).sort()).toEqual(['config/levels.ts', 'game/beads-game.ts']);
  });

  it('③ 位置型字面量只作输入侧兼容（⛔ 除 save-schema 外无人再读 `starsByLevel` 档字段）', () => {
    expect(hitsOf(/['"]starsByLevel['"]/)).toEqual(['game/save-schema.ts']);
  });

  it('④ 视图 / shell 层与存档换算零接触（L5：⛔ 视图查表、⛔ 视图换算身份）', () => {
    const viewFiles = srcFiles(join(SRC_DIR, 'view')).concat([join(SRC_DIR, 'game/beads-shell.ts')]);
    const offenders = viewFiles
      .filter((f) => /starsByUid|levelIdentityKeys|normalizeBeadsSave|flattenStars|collapseStars/.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('⑤ 关表身份在运行期可解析且全表唯一（§8-22-①；生成期门禁同腿，本臂验其产物形状）', () => {
    expect(KEYS.length).toBe(LEVELS.length);
    expect(KEYS.every((k) => typeof k === 'string' && k !== ''))
      .toBe(true); // 已入关的记录恒有身份（⛔ 空 token 只属于未过 sync 的草案）
    expect(new Set(KEYS).size).toBe(KEYS.length);
  });

  it('⑥ 展开序与装配槽序一致（§8-22-②：「第 i 格是谁」永远可答，⛔ 需第二条换算路径）', () => {
    // 装配轴 = `LEVELS` 数组序；身份轴 = 同序 map ⇒ 两轴同长同序即「可答」的全部条件。
    expect(KEYS).toEqual(LEVELS.map((l) => l.uid));
  });

  it('⑦ 一关恰属一章的既有生成期断言未因新通道变哑（§8-22-③）', () => {
    const owned = new Map<string, number>();
    for (const arc of ARCS) {
      for (const [from, to] of arc.levelRefs) {
        for (let id = from; id <= to; id += 1) owned.set(String(id), (owned.get(String(id)) ?? 0) + 1);
      }
    }
    const doubled = [...owned.entries()].filter(([, n]) => n > 1);
    expect(doubled, '⛔ 一关两章').toEqual([]);
  });
});
