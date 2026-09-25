/**
 * `game/save-schema.ts` — 存档修复与降级（save-progress §2.2 + S1 §8-1/§8-10）。
 *
 * The two design rules this file pins down are both invisible from a happy-path
 * test: **degrade, never throw**, and **never discard a document because one field
 * is missing** (per-field defaults for `settings`).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SaveManager } from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import {
  VIBRATE_DEFAULT,
} from '../src/config/tuning.js';
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
  settings: { bgmMuted: true, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true, debugInfo: false },
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
      settings: { bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true, debugInfo: false },
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
      debugInfo: false,
    });
    expect(missing.save.currentLevel).toBe(3); // progression survived
    expect(missing.changed).toBe(true);

    expect(normalizeSettings({ bgmMuted: true })).toEqual({
      bgmMuted: true,
      sfxMuted: false,
      reduceMotion: false,
      largeText: false,
      vibrate: true,
      debugInfo: false,
    });
    expect(normalizeSettings({ sfxMuted: true })).toEqual({
      bgmMuted: false,
      sfxMuted: true,
      reduceMotion: false,
      largeText: false,
      vibrate: true,
      debugInfo: false,
    });
    expect(normalizeSettings('nonsense')).toEqual({
      bgmMuted: false,
      sfxMuted: false,
      reduceMotion: false,
      largeText: false,
      vibrate: true,
      debugInfo: false,
    });
    expect(normalizeSettings({ bgmMuted: 'yes' })).toEqual({
      bgmMuted: false,
      sfxMuted: false,
      reduceMotion: false,
      largeText: false,
      vibrate: true,
      debugInfo: false,
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
      debugInfo: false,
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

/* ══════════════════ WXG-T-211-B1 · QA §K.3 存档族两条（S8 §8-12/§8-13）══════════════════ */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SAVE_SRC = resolve(REPO, 'games/beads/src/game/save-schema.ts');

/** 六字段基线（腿① 的「其余无损」参照物）。 */
const ALL_ON = { bgmMuted: true, sfxMuted: true, reduceMotion: true, largeText: true, vibrate: false, debugInfo: true };

describe('TC-SAVE-12 腿① · §8-12 字段级隔离结构的现成回归锚（六字段上构造）', () => {
  // §8-12 四构造（①缺失 ②类型错 ③未注册 styleId ④豆径越界）中，**只有腿①可立即执行**：
  // 现有六字段上构造「缺 `vibrate`」/「`debugInfo` 类型错」⇒ 该字段取默认、其余无损。
  // 腿②④ 需 `beadStyle` / 豆径档字段先入档（= 步 5）；腿③ 的 registry 前置本单已就位
  // （`view/bead-styles/registry.ts`），但仍需字段先存在 ⇒ 三条均 **⛔ 本单不可测**，只在此登记。
  it('缺 `vibrate` ⇒ 该字段取默认 ON（与其余四开关的 false 相反），五字段与进度全无损', () => {
    const { vibrate: _omitted, ...settingsWithoutVibrate } = ALL_ON;
    expect('vibrate' in settingsWithoutVibrate).toBe(false); // 构造自证：字段确实缺失
    const result = normalizeBeadsSave(
      { ...validSave(), settings: settingsWithoutVibrate },
      LEVEL_COUNT,
    );
    // 该字段单独回落默认（§3.8 VIBRATE_DEFAULT = ON）。
    expect(result.save.settings.vibrate).toBe(VIBRATE_DEFAULT);
    expect(result.save.settings.vibrate).toBe(true);
    // 其余五字段**不受影响**（字段级隔离；含与 vibrate 默认值相反的 false 族不得被带跳）。
    expect(result.save.settings).toEqual({ ...ALL_ON, vibrate: true });
    // 不弃整档：进度 / 星级 / runs 逐字段无损。
    expect(result.save.runs).toBe(3);
    expect(result.save.maxUnlockedLevel).toBe(4);
    expect(result.save.currentLevel).toBe(3);
    expect(result.save.sprintBestScore).toBe(1200);
    expect(result.save.starsByLevel).toEqual([3, 2, 1, 0, 0, 0, 0, 0]);
    // 实测登记（不背书）：`changed` 对 settings 是**自我比较**（save.settings 已由
    // normalizeSettings 产出）⇒ 单字段缺失不触发写回，仅 settings 整体缺失才触发。
    // 「缺字段是否应补写回」= 回传未决问题（不自行消解；旧档实际写回由 migrate 路径保底）。
    expect(result.changed).toBe(false);
    expect(normalizeBeadsSave({ ...validSave(), settings: undefined }, LEVEL_COUNT).changed).toBe(true);
  });

  it('`debugInfo` 类型错（非布尔）⇒ 该字段取默认 false，其余五字段无损，不抛异常', () => {
    for (const bad of ['on', 1, null, undefined, {}, []]) {
      const result = normalizeBeadsSave(
        { ...validSave(), settings: { ...ALL_ON, debugInfo: bad } },
        LEVEL_COUNT,
      );
      expect(result.save.settings.debugInfo).toBe(false);
      expect(result.save.settings).toEqual({ ...ALL_ON, debugInfo: false });
      expect(result.save.runs).toBe(3);
      expect(result.save.starsByLevel).toEqual([3, 2, 1, 0, 0, 0, 0, 0]);
    }
    // BOOT 不报错：整档非文档输入也只是降级默认（既有判例，本条不重写）。
    expect(() => normalizeBeadsSave({ ...validSave(), settings: 'nonsense' }, LEVEL_COUNT)).not.toThrow();
    expect(normalizeBeadsSave({ ...validSave(), settings: 'nonsense' }, LEVEL_COUNT).save.settings)
      .toEqual({ bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true, debugInfo: false });
  });
});

describe('TC-SAVE-13 · §8-13 「无换肤迁移代码」静态哨 (a)(b)(c) + K-060 阳性对照', () => {
  /**
   * 限定语义的三条规则（⛔ 泛 grep「migrat」必假红 —— `migrateV2ToV3` 在体内写
   * `onboarded` = 既有合法判例，见 save-schema.ts:93-102）：
   *  (a) `migrate*` 函数体内不得出现 `beadStyle` / 豆径档字段的赋值或推算；
   *  (b)  migrate 体只允许透传 `version`（赋值键白名单）⇒ 不得以换肤为由把新字段
   *      偷渡进迁移链；`SAVE_VERSION` 钉值 = 任何 bump 都必须先过差分记账重钉本例；
   *  (c) 文案**字面量**（非注释）不得出现「皮肤已变更」类玩家告知。
   * 实现与断言同处本文件：规则写成可复用函数，**阳性对照腿直接吃合成注入串**
   * ⇒ 同时证明「规则能命中」与「现码零命中」，防“永不命中而假绿”（K-060）。
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
    // 前提哨兵：抽取函数本身能抽到既有三个合法迁移（否则 (a)(b) 扫的是空集 = 假绿）。
    expect(bodies.map((b) => b.name)).toEqual(['migrateV1ToV2', 'migrateV2ToV3', 'migrateV3ToV4']);
    const srcFiles = tsFiles(resolve(REPO, 'games/beads/src'));
    expect(srcFiles.length).toBeGreaterThan(20);
    const hits = srcFiles.flatMap((f) => scanSkinMigration(readFileSync(f, 'utf8'), f.replace(`${REPO}/`, '')));
    expect(hits).toEqual([]);
    // (b) 的钉值形式：SAVE_VERSION = 4（步 5 入档两字段时按 §8-11「不新增事件名」同批重钉）。
    expect(SAVE_VERSION).toBe(4);
  });

  it('K-060 阳性对照：注入假想换肤迁移分支 ⇒ 三条规则均能命中（⛔ 不得永真绿）', () => {
    const injectedA = `export function migrateV4ToV5(doc: Record<string, unknown>): Record<string, unknown> {
  return { ...doc, beadStyle: 'facet-4', version: SAVE_VERSION };
}`;
    const hitsA = scanSkinMigration(injectedA, 'inject-a');
    expect(hitsA.some((h) => h.startsWith('(a)'))).toBe(true);
    expect(hitsA.some((h) => h.startsWith('(b)') && h.includes('beadStyle'))).toBe(true);
    // 推算形式（不写字面字段名但赋值旧档推算）⇒ (b) 键白名单仍命中。
    const injectedB = `export function migrateV4ToV5(doc: Record<string, unknown>): Record<string, unknown> {
  const tier = num(doc['runs'], 0) > 0 ? 'compact' : 'full';
  return { ...doc, sizeTier: tier, version: SAVE_VERSION };
}`;
    expect(scanSkinMigration(injectedB, 'inject-b').some((h) => h.includes('sizeTier'))).toBe(true);
    // (c) 补发告知文案⇒ 命中；同串出现在**注释**里不得误伤。
    expect(scanSkinMigration("const t = '皮肤已变更，已为您切回默认';", 'inject-c').length).toBe(1);
    expect(scanSkinMigration('// 皮肤已变更类告知 = 明确不做（C9 知情项）\nexport function migrateV9ToV10(doc: Record<string, unknown>): Record<string, unknown> {\n  return { ...doc, version: SAVE_VERSION };\n}', 'inject-comment')).toEqual([]);
  });
});
