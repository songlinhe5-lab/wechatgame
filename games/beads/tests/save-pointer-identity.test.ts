/**
 * WXG-T-345 · 工程轨 T-4 / **S-2b**：两根进度指针（`maxUnlockedKey` / `lastPlayedKey`）的
 * 身份化判据 + **Q8 丙档**降级（`save-progress.md §2.6.4.1`，本批新裁）。
 *
 * 判据源（⛔ 本文件自立）：ADR-0034 **DEC-7**、§6.1 **M-18 / M-19 / M-20**、
 * `save-progress.md` **§8-23**（新硬条：章内插关 / 调展示序两指针仍解析到同一关）与
 * **§2.6.4.1**（v1.3-R4 起锚源 = 另一根指针）六条可执行定义 / 四条禁止实现 / 四条射程边界。
 *
 * 本文件只测**纯函数层**（`normalizeBeadsSave`）；运行期两边界点的写档次数与落盘形
 * 已由 `save-identity-boot.test.ts` 承担（⛔ 重复造观测面）。
 */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS, levelIdentityKeys } from '../src/config/levels.js';
import {
  SAVE_VERSION,
  defaultBeadsSave,
  normalizeBeadsSave,
  toBeadsSavePatch,
} from '../src/game/save-schema.js';
import { starsLedger } from './helpers.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const KEYS = levelIdentityKeys(LEVELS);
const LEVEL_COUNT = KEYS.length;
const ALL_FULL = new Array<number>(LEVEL_COUNT).fill(3);

/** 基线 v5 档：两指针都指得回、星账稠密（只用于**不**触发降级的臂）。 */
function doc(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...defaultBeadsSave(),
    version: SAVE_VERSION,
    runs: 5,
    onboarded: true,
    maxUnlockedKey: KEYS[4],
    lastPlayedKey: KEYS[3],
    starsByUid: starsLedger(ALL_FULL),
    ...over,
  };
}

const norm = (raw: unknown, keys: readonly string[] = KEYS) =>
  normalizeBeadsSave(raw, keys.length, keys);

/** 走一次「写回 → JSON 往返」（框架 `patch` 语义：`undefined` 键在序列化时消失）。 */
function writeBack(result: ReturnType<typeof norm>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(toBeadsSavePatch(result.save, result.staleKeys))) as Record<string, unknown>;
}

/* ═══════════ §8-23 / M-18：两指针按身份寻址（位置形实现必红）═══════════ */

describe('§8-23 / M-18 章内插关 / 调展示序 ⇒ 两指针仍解析到同一关', () => {
  it('臂① 章内插一关：身份不变 ⇒ 下标随装配序平移，⛔ 触发降级（§2.6.4.1 射程③）', () => {
    const inserted = 'L00011';
    const axis = [...KEYS.slice(0, 4), inserted, ...KEYS.slice(4)];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = norm(doc(), axis);
      expect(result.save.maxUnlockedKey, '解锁位 = 插关前同一关的身份').toBe(KEYS[4]);
      expect(result.save.lastPlayedKey, '推进位 = 插关前同一关的身份').toBe(KEYS[3]);
      // 插在 index 4 之前 ⇒ 原 index 4 的关平移到 5；位置形实现会停在 4（= 新关）⇒ 本断言红。
      expect(result.maxUnlockedIndex).toBe(5);
      expect(result.lastPlayedIndex).toBe(3);
      expect(warn, '追加 / 插入关不删身份 ⇒ ⛔ 降级').not.toHaveBeenCalled();
      expect(result.staleKeys).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it('臂② 章内调展示序：两个指针目标互换位置 ⇒ token 不变、下标互换', () => {
    const axis = [...KEYS];
    const a = axis[3]!;
    const b = axis[4]!;
    axis[3] = b;
    axis[4] = a;
    const result = norm(doc(), axis);
    expect(result.save.maxUnlockedKey).toBe(KEYS[4]);
    expect(result.save.lastPlayedKey).toBe(KEYS[3]);
    expect(result.maxUnlockedIndex).toBe(axis.indexOf(KEYS[4]));
    expect(result.lastPlayedIndex).toBe(axis.indexOf(KEYS[3]));
    // 位置形实现会保留下标 4/3 ⇒ 反而指到对方的关（本两行即红）。
    expect(result.maxUnlockedIndex).toBe(3);
    expect(result.lastPlayedIndex).toBe(4);
  });
});

/* ═══════════ M-19：旧数值键必须点名清除（patch 浅合并不删键）═══════════ */

describe('M-19 旧数值指针键 = v4 档一次性入口，且必须点名清除', () => {
  it('v5 档残留旧数值键 ⇒ 身份键优先、旧键进 staleKeys、写回物理消失', () => {
    const result = norm(doc({ maxUnlockedLevel: 9, currentLevel: 7 }));
    expect(result.save.maxUnlockedKey, '身份键优先，旧数值键不参与').toBe(KEYS[4]);
    expect(result.save.lastPlayedKey).toBe(KEYS[3]);
    expect(result.staleKeys).toEqual(['maxUnlockedLevel', 'currentLevel']);
    expect(result.changed).toBe(true);

    const stored = writeBack(result);
    expect('maxUnlockedLevel' in stored, '⛔ 旧键永久留在档里（M-6 同一课）').toBe(false);
    expect('currentLevel' in stored).toBe(false);
    expect(norm(stored).changed, '清除后二次读幂等').toBe(false);
  });

  it('v4 档（无身份键）⇒ 旧数值键对位读入一次，并同样点名清除', () => {
    const result = norm(doc({
      maxUnlockedKey: '',
      lastPlayedKey: '',
      maxUnlockedLevel: 7,
      currentLevel: 5,
    }));
    expect(result.maxUnlockedIndex).toBe(6);
    expect(result.lastPlayedIndex).toBe(4);
    expect(result.save.maxUnlockedKey).toBe(KEYS[6]);
    expect(result.save.lastPlayedKey).toBe(KEYS[4]);
    expect(result.staleKeys).toEqual(['maxUnlockedLevel', 'currentLevel']);
  });
});

/* ═══════════ Q8 丙档 · 六条可执行定义（M-20 期望值固化）═══════════ */

describe('Q8 丙档（§2.6.4.1 v1.3-R4）· 失配 ⇒ 另一根指针；⛔ 表末位 / ⛔ 回 1', () => {
  it('定义 1+2（生产形状·稠密星账）：锚 = 另一根指针，⛔ 被星账键集推到表末位', () => {
    // 生产档的 `starsByUid` 是稠密物化（每关都有键、含 0）——这正是 R4 收窄锚源的原因：
    // 若把「星账键集」并入锚集合，取装配序最靠后必落表末位 = 禁止实现②「白送全章」。
    const result = norm(doc({ maxUnlockedKey: 'L09999', lastPlayedKey: KEYS[2] }));
    expect(result.save.starsByUid, '夹具必须是生产形状（稠密）').toEqual(starsLedger(ALL_FULL));
    expect(result.maxUnlockedIndex, '锚 = 另一根指针所指的关').toBe(2);
    expect(result.save.maxUnlockedKey).toBe(KEYS[2]);
    expect(result.lastPlayedIndex, '未失配的一根原样保留').toBe(2);
    expect(result.save.lastPlayedKey).toBe(KEYS[2]);
    // ⛔ 禁止实现②：稠密星账不得把锚推到表末位（旧字面实现此处 = `LEVEL_COUNT - 1`）。
    expect(result.maxUnlockedIndex).not.toBe(LEVEL_COUNT - 1);
  });

  it('定义 3：两根各自判定 —— 失配一根按另一根回落，另一根不被拖动', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = norm(doc({ maxUnlockedKey: KEYS[6], lastPlayedKey: 'L09998' }));
      expect(result.maxUnlockedIndex, '解锁位未失配 ⇒ 原样').toBe(6);
      expect(result.save.maxUnlockedKey).toBe(KEYS[6]);
      expect(result.lastPlayedIndex, '锚 = 另一根指针所指的关').toBe(6);
      expect(result.save.lastPlayedKey).toBe(KEYS[6]);
      // 只降级失配的一根：若把两根一起改，计数 = 2 ⇒ 本行红。
      expect(warn.mock.calls.length).toBe(1);
      expect(String(warn.mock.calls[0]![0])).toContain('count=1');
    } finally {
      warn.mockRestore();
    }
  });

  it('定义 4：两根都指不回 ⇒ 兜底首个开放章首关（本版 = 第 1 关）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // 稠密星账照给：若星账键集仍参与锚，本臂会落到表末位 ⇒ 两行都红。
      const result = norm(doc({ maxUnlockedKey: 'L09999', lastPlayedKey: 'L09998' }));
      expect(result.maxUnlockedIndex).toBe(0);
      expect(result.lastPlayedIndex).toBe(0);
      expect(result.save.maxUnlockedKey).toBe(KEYS[0]);
      expect(result.save.lastPlayedKey).toBe(KEYS[0]);
      // 定义 6：失配次数恰为 2，一次汇总（⛔ 逐条刷屏、⛔ 玩家可见）。
      expect(warn.mock.calls.length).toBe(1);
      expect(String(warn.mock.calls[0]![0])).toContain('downgraded: count=2');
    } finally {
      warn.mockRestore();
    }
  });

  it('定义 5：降级结果同批写回恰一次；二次读 changed=false；⛔ bump 版本号', () => {
    const first = norm(doc({ maxUnlockedKey: 'L09999', lastPlayedKey: 'L09998' }));
    expect(first.changed).toBe(true);
    expect(first.maxUnlockedIndex).toBe(0);
    expect(first.lastPlayedIndex).toBe(0);
    expect(first.save.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION, 'DEC-7 补条①：留 5').toBe(5);

    const stored = writeBack(first);
    expect(stored['version']).toBe(5);
    const second = norm(stored);
    expect(second.changed, '降级只写一次').toBe(false);
    expect(second.staleKeys).toEqual([]);
    expect(second.maxUnlockedIndex).toBe(0);
    expect(second.lastPlayedIndex).toBe(0);
  });

  it('定义 6：静默（不抛、不中断）且 logger 计数 = 失配根数', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = norm(doc({ maxUnlockedKey: 'L09999', lastPlayedKey: KEYS[1] }));
      expect(result.maxUnlockedIndex).toBe(1);
      expect(result.save.maxUnlockedKey).toBe(KEYS[1]);
      expect(result.lastPlayedIndex).toBe(1);
      expect(warn.mock.calls.length).toBe(1);
      expect(String(warn.mock.calls[0]![0])).toContain('count=1');
    } finally {
      warn.mockRestore();
    }
  });
});

/* ═══════════ 静态臂：四条禁止实现里可静态判定的三条 ═══════════ */

describe('§2.6.4.1 ⛔ 禁止实现（静态臂 · v1.3-R4）', () => {
  it('降级分支 ⛔ 读星账（④）/ ⛔ 夹表末位（②）/ ⛔ token 反解（①）', () => {
    const src = readFileSync(resolve(REPO, 'games/beads/src/game/save-schema.ts'), 'utf8');
    // R4 收窄：星账键集退出锚集合 => 旧的并集函数必须物理消失（⛔ 只改名留壳）。
    expect(src, '星账键集⛔ 作锚（R4）').not.toContain('lastResolvableIndex');
    const start = src.indexOf('// ── 两根进度指针');
    const end = src.indexOf('const ledger = normalizeStarLedger', start);
    expect(start, '降级分支本体确实被截取到').toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);
    // ④ 星账（键集或值）：降级分支内⛔ 出现星账键名。
    expect(body, '⛔ 读星账').not.toContain('starsByUid');
    // ① token 反解：⛔ 把 `L00012` 当数字 / 字符串段解析。
    expect(/parseInt|parseFloat|charCodeAt|substring|\.split\(/.test(body), '⛔ token 反解序数').toBe(false);
    // ② 夹末位：不得出现「直接返回最后一个槽」的短路。
    expect(/return\s+levelKeys\.length\s*-\s*1/.test(body), '⛔ 夹到当前表末位').toBe(false);
  });
});
