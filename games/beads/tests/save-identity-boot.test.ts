/**
 * WXG-T-344（ADR-0034 §6 第 2/5 步）· **运行期双腿**的身份化判据。
 *
 * `tests/save-schema.test.ts` 验的是纯函数层；本文件验的是「换算真在被消费」这件事：
 * 身份对位只发生在 `BeadsGame` 的既有两个边界点（BOOT 读档 / `_persistProgress` 写档），
 * 且各恰一次（DEC-3）。判据源 = `design/gdd/save-progress.md` v1.3 **§8-16 / §8-17 /
 * §8-19 / §8-21**（⛔ 本文件不自立判据）；写次数机检沿用同族手法（`in-level-snapshot` /
 * `bead-style-settings` 的 `spyStorage`），⛔ 新造观测面。
 *
 * 本文件同时是变异自证 **M-5** 的命门载体：若在 `beads-game.ts` 的换算里忽略 `levelKeys`
 * （退回前缀搬运），下面「插一关 ⇒ 星随身份走」一条必须转红。
 */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import type { Storage } from '@wxgame/framework';
import { LEVELS, levelIdentityKeys, type BeadsLevelRaw } from '../src/config/levels.js';
import { SAVE_VERSION, defaultBeadsSave } from '../src/game/save-schema.js';
import {
  createBeadsHarness,
  simpleTestLevel,
  starsLedger,
  type Harness,
} from './helpers.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const GAME_SRC = resolve(REPO, 'games/beads/src/game/beads-game.ts');

const SAVE_KEY = 'wxgame.beads.test.t344.identity';

function newStorage(): Storage {
  return new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }).createStorage();
}

interface WriteLog {
  key: string;
  kind: 'set' | 'remove';
}

/** 计数 storage：断言「写档恰一次」这类事件级事实（同 `in-level-snapshot` 判例手法）。 */
function spyStorage(inner: Storage): { storage: Storage; log: WriteLog[] } {
  const log: WriteLog[] = [];
  const storage: Storage = {
    get: (k: string) => inner.get(k),
    set: (k: string, v: string) => {
      log.push({ key: k, kind: 'set' });
      inner.set(k, v);
    },
    remove: (k: string) => {
      log.push({ key: k, kind: 'remove' });
      inner.remove(k);
    },
    keys: () => inner.keys(),
    clear: () => inner.clear(),
  };
  return { storage, log };
}

const saveWrites = (log: WriteLog[]): number => log.filter((e) => e.key === SAVE_KEY && e.kind === 'set').length;

function readDoc(storage: Storage): Record<string, unknown> {
  const raw = storage.get(SAVE_KEY);
  expect(typeof raw, 'BOOT 应已落一份档').toBe('string');
  return JSON.parse(raw as string) as Record<string, unknown>;
}

/** 三关夹具池（`simpleTestLevel` 出生即带 token，见 helpers 注）。 */
const POOL: BeadsLevelRaw[] = [
  simpleTestLevel({ id: 301 }),
  simpleTestLevel({ id: 302 }),
  simpleTestLevel({ id: 303 }),
];
/** 插入关（落在槽 1 ⇒ 其后每关的**槽序**都左移一位，身份不动）。 */
const SPOILER = simpleTestLevel({ id: 304 });
const POOL_INSERTED: BeadsLevelRaw[] = [POOL[0], SPOILER, POOL[1], POOL[2]];

function boot(levels: readonly BeadsLevelRaw[], storage: Storage): Harness {
  return createBeadsHarness({ noAssemble: true, levels: [...levels], saveKey: SAVE_KEY, storage });
}

/** 填满整块棋盘（不推进时钟 ⇒ 快通按用时判 3★，与 `finish-panel` 同手法）。 */
function fillBoard(harness: Harness): void {
  const grid = harness.game.grid;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!grid.isFillable(r, c)) continue;
      const slot = harness.game.giveTrayBead(grid.requiredColor(r, c));
      if (slot < 0) throw new Error(`tray full at (${r},${c})`);
      harness.game.selectTraySlot(slot);
      if (!harness.game.tapGridCell(r, c)) throw new Error(`place failed at (${r},${c})`);
    }
  }
}

describe('§8-16 运行期双腿：关表插一关 ⇒ 星随身份走（M-5 命门载体）', () => {
  it('通关首末两关落档 ⇒ 档内是身份形；插入一关后重开 ⇒ 末关的 3★ 不被挪给新关', () => {
    const shared = newStorage();
    const first = boot(POOL, shared);
    fillBoard(first); // 槽 0 通关 ⇒ 3★
    first.game.goToLevel(2); // 末关（槽 2）
    fillBoard(first); // 槽 2 通关 ⇒ 3★；槽 1 仍 0★
    expect(Array.from(first.game.starsByLevel)).toEqual([3, 0, 3]);

    const doc = readDoc(shared);
    expect(doc['starsByUid'], 'DEC-1：落档形态 = 身份→星').toEqual(starsLedger([3, 0, 3], POOL));
    expect('starsByLevel' in doc, '⛔ 双轨并存').toBe(false);

    // 重开：同一份档 + **插了一关的池**（槽 0 之后多了 SPOILER）。
    const second = boot(POOL_INSERTED, shared);
    expect(second.game.bootError, '内容变更不属异常').toBe('');
    expect(Array.from(second.game.starsByLevel), '身份对位：新槽 0 星，末关的 3★ 仍在末关').toEqual([3, 0, 0, 3]);
    // 反例基准：若这里读成 `[3, 0, 3, 0]` ⇒ 说明换算退回了位置寻址（M-5 即此臂）。
    expect(Array.from(second.game.starsByLevel)).not.toEqual([3, 0, 3, 0]);
    // 新关自身无记录 ⇒ 稠密补 0，且第二次读幂等（不再有补写抖动）。
    const writes = spyStorage(shared);
    boot(POOL_INSERTED, writes.storage);
    const third = readDoc(shared);
    expect(third['starsByUid'], '第二 BOOT 的账与第一次逐键相同').toEqual(starsLedger([3, 0, 0, 3], POOL_INSERTED));
    expect(saveWrites(writes.log), '幂等：无补写 ⇒ 除 BOOT 既有 runs 写外不应多写').toBeLessThanOrEqual(1);
  });

  it('调展示序（前两关对调）⇒ 内存镜像跟着身份换槽，⛔ 换账', () => {
    const shared = newStorage();
    const first = boot(POOL, shared);
    fillBoard(first);
    const ledger = starsLedger([3, 0, 0], POOL);
    expect(readDoc(shared)['starsByUid']).toEqual(ledger);

    const swapped = [POOL[1], POOL[0], POOL[2]];
    const second = boot(swapped, shared);
    expect(Array.from(second.game.starsByLevel), '3★ 属于「L00301 那一关」，它现在在槽 1').toEqual([0, 3, 0]);
    expect(second.game.snapshot.finishStars).toEqual([0, 3, 0]);
    // 账本身一个字没改（只有内存镜像按新槽序重投影）：写回后档与换序前逐键相等。
    expect(readDoc(shared)['starsByUid']).toEqual(ledger);
  });

  it('末尾追加一关 ⇒ 既有记录逐条不动，新槽 0 星（§8-16 ③）', () => {
    const shared = newStorage();
    const first = boot(POOL, shared);
    fillBoard(first);
    first.game.goToLevel(1);
    fillBoard(first);

    const appended = [...POOL, SPOILER];
    const second = boot(appended, shared);
    expect(Array.from(second.game.starsByLevel)).toEqual([3, 3, 0, 0]);
    expect(readDoc(shared)['starsByUid']).toEqual(starsLedger([3, 3, 0, 0], appended));
  });
});

describe('§8-21 运行期一次性入口：v4 位置档 ⇒ 对位读入并写回恰一次，此后不再搬运', () => {
  it('喂位置型旧档 ⇒ 首 BOOT 对位读入并清旧键；第二 BOOT ⛔ 不再经搬运腿', () => {
    const shared = newStorage();
    // v4 形态：只有位置数组、无身份账（键名 `starsByLevel` = 旧 `BeadsSave` 字段）。
    shared.set(
      SAVE_KEY,
      JSON.stringify({
        ...defaultBeadsSave(),
        version: 4,
        runs: 5,
        onboarded: true,
        maxUnlockedLevel: 3,
        currentLevel: 3,
        starsByLevel: [3, 2, 0],
      }),
    );

    const first = spyStorage(shared);
    const h1 = boot(POOL, first.storage);
    expect(Array.from(h1.game.starsByLevel), '第 i 位 ⇒ 关表第 i 关的身份').toEqual([3, 2, 0]);
    const landed = readDoc(shared);
    expect(landed['starsByUid'], '迁移趟落成身份化终态').toEqual(starsLedger([3, 2, 0], POOL));
    expect('starsByLevel' in landed, '旧形须被物理清除（DEC-1 ⛔ 两轨）').toBe(false);
    expect(landed['version'], '写回即 v5').toBe(SAVE_VERSION);
    const firstWrites = saveWrites(first.log);

    // 第二 BOOT（同一份已是 v5 的档）：终态读档 ⛔ 不含前缀搬运 ⇒ 写次不再因「搬运」增加。
    const second = spyStorage(shared);
    const h2 = boot(POOL, second.storage);
    expect(Array.from(h2.game.starsByLevel)).toEqual([3, 2, 0]);
    // 幂等：终态读档不产生搬运补写 ⇒ 第二 BOOT 比首 BOOT **恰少一次写**（那一次 = 迁移补写）。
    expect(firstWrites, '首 BOOT = runs 自增写 + 迁移补写').toBe(2);
    expect(firstWrites - saveWrites(second.log), '终态读档 ⛔ 不再搬运').toBe(1);
    // 搬运腿已死的正面证据：换一条**同身份不同序**的轴重读 ⇒ 账逐键不动。
    const third = boot([POOL[1], POOL[0], POOL[2]], shared);
    expect(Array.from(third.game.starsByLevel), '若仍走搬运，此处会变成 [2,3,0]').toEqual([2, 3, 0]);
  });
});

describe('§8-17 运行期降级静默：孤儿记录逐条作废，⛔ 不弃整档、⛔ 不中断启动', () => {
  it('档内引用一条关表里已不存在的关 ⇒ 该条作废、其余无损、写回恰一次、无玩家可见错误', () => {
    const shared = newStorage();
    shared.set(
      SAVE_KEY,
      JSON.stringify({
        ...defaultBeadsSave(),
        runs: 4,
        onboarded: true,
        maxUnlockedLevel: 3,
        currentLevel: 3,
        starsByUid: { ...starsLedger([3, 2, 0], POOL), 'L00777': 3 },
      }),
    );

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
    try {
      const spy = spyStorage(shared);
      const harness = boot(POOL, spy.storage);
      expect(harness.game.bootError, '§8-17 ④：降级不得让启动中断').toBe('');
      expect(Array.from(harness.game.starsByLevel)).toEqual([3, 2, 0]); // ② 其余记录无损
      const doc = readDoc(shared);
      // BOOT 会自增 `runs`（§2.5）⇒ 4 变 5；关键是 **⛔ 弃整档**（弃档会读到 0/1）。
      expect(doc['runs'], '其余字段照常读出（仅 BOOT 固有 +1）').toBe(5);
      expect(doc['starsByUid'], '③ 写回时孤儿被裁剪（DEC-9）').toEqual(starsLedger([3, 2, 0], POOL));
      expect(warn.mock.calls.length, 'I3 可观测：一次性汇总，⛔ 逐条刷屏').toBe(1);
      expect(String(warn.mock.calls[0][0])).toContain('dropped=1');
    } finally {
      warn.mockRestore();
    }
  });
});

describe('§8-19 推进位独立落档（I6）：⛔ 由星数反推推进位', () => {
  it('重玩一个已 3★ 的低序号关 ⇒ 星值集合逐字节不变，推进位却随「打到哪一关」走', () => {
    const shared = newStorage();
    const first = boot(POOL, shared);
    fillBoard(first); // 槽 0 ⇒ 3★，推进位到 2
    first.game.goToLevel(1);
    fillBoard(first); // 槽 1 ⇒ 3★，推进位到 3
    const before = readDoc(shared);
    expect(before['starsByUid'], '三关全 3★ 前的账').toEqual(starsLedger([3, 3, 0], POOL));
    expect(before['currentLevel']).toBe(3);

    const replay = boot(POOL, shared);
    replay.game.goToLevel(0); // 重玩已 3★ 的首关
    fillBoard(replay); // 再通一次：星不变（max 取大），但推进位被写回 2
    const after = readDoc(shared);
    expect(after['starsByUid'], '星值集合与重玩前逐字节相同').toEqual(before['starsByUid']);
    expect(after['currentLevel'], '推进位 = 该重玩关的下一关，⛔ 不是「最高星关」').toBe(2);
    expect(after['maxUnlockedLevel'], '已解锁位只增不减（棘轮 I7）').toBe(3);

    const relaunched = boot(POOL, shared);
    expect(relaunched.game.levelIndex, 'BOOT 分流读的是落档的推进位，⛔ 不现算').toBe(1);
  });

  it('静态臂：`beads-game.ts` 内推进位的写入不读星账（⛔ 启发式反推）', () => {
    const src = readFileSync(GAME_SRC, 'utf8');
    // `currentLevel` 的写入点只有一处（`_persistProgress`），且其右值来自关卡指针算术。
    const writes = src.split('\n').filter((line) => /^\s*currentLevel:/.test(line));
    expect(writes.length).toBe(1);
    expect(writes[0]).not.toMatch(/stars/);
    // ⛔ 出现「按星数挑当前关」的启发式（取最高星关 / 首个非 3★ 关 等）。
    expect(/currentLevel\s*=\s*[^;]*stars/i.test(src), '不得由星数派生推进位').toBe(false);
    expect(/indexOf\(\s*STAR_MAX\s*\)|starsByLevel\.(?:indexOf|findIndex|reduce|sort)/.test(src)).toBe(false);
  });
});

describe('DEC-3 边界唯一性：换算只在两边界点各一次（⛔ 视图 / 结算路径再构造）', () => {
  it('PLAYING 全程零写档；结算帧恰一次，且落盘为身份形（联合 §8-9 / §8-21）', () => {
    const shared = newStorage();
    const spy = spyStorage(shared);
    const harness = boot(POOL, spy.storage);
    // **基线 = 首落子之后**：首次落子会写 `onboarded`（WXG-T-097 · BD-32，属§2.5 即写族），
    // 不属本判据的「局内零写档」域；⛔ 拿 BOOT 当场写数作基线会把那一笔合法即写算成红。
    const grid0 = harness.game.grid;
    {
      const slot = harness.game.giveTrayBead(grid0.requiredColor(0, 0));
      harness.game.selectTraySlot(slot);
      expect(harness.game.tapGridCell(0, 0)).toBe(true);
    }
    const baseline = saveWrites(spy.log);
    // 局内继续落子（不结算）⇒ 不新增进度写（§8-9 常规面；本处只验换制未把它打破）。
    const grid = harness.game.grid;
    let placed = 1;
    for (let r = 0; r < grid.rows && placed < 4; r++) {
      for (let c = 0; c < grid.cols && placed < 4; c++) {
        if (r === 0 && c === 0) continue; // 已落
        if (!grid.isFillable(r, c)) continue;
        const slot = harness.game.giveTrayBead(grid.requiredColor(r, c));
        if (slot < 0) break;
        harness.game.selectTraySlot(slot);
        if (harness.game.tapGridCell(r, c)) placed += 1;
      }
    }
    expect(placed).toBeGreaterThan(1);
    expect(saveWrites(spy.log), '局内落子 ⛔ 不写进度档').toBe(baseline);

    // 把本关打完 ⇒ 结算帧写档恰一次。
    harness.game.goToLevel(0);
    const beforeClear = saveWrites(spy.log);
    fillBoard(harness);
    expect(saveWrites(spy.log) - beforeClear, '结算帧恰一次写档').toBe(1);
    const doc = readDoc(shared);
    expect(doc['starsByUid'], '收拢边界产出的正是身份账').toEqual(starsLedger([3, 0, 0], POOL));
    expect('starsByLevel' in doc).toBe(false);
  });

  it('身份镜像 `levelIdentityKeys` 构造点在 `beads-game.ts` 恰两处（BOOT 装配 / 导入追加）', () => {
    const src = readFileSync(GAME_SRC, 'utf8');
    expect((src.match(/levelIdentityKeys\(/g) ?? []).length).toBe(2);
    expect(src).toContain('this._levelKeys = Object.freeze(levelIdentityKeys(this._levels));');
    // 结算写路径只**消费**镜像，⛔ 就地构造。
    const persist = src.slice(src.indexOf('private _persistProgress()'), src.indexOf('// ───────────────────────────────────────────────────────────── hit testing'));
    expect(persist.match(/levelIdentityKeys\(/g) ?? []).toHaveLength(0);
    expect(persist).toContain('collapseStars(this._starsByLevel, this._levelKeys)');
  });

  it('夹具身份轴与生产轴同源（本文件的免疫断言确实吃的是 token，不是槽序）', () => {
    expect(levelIdentityKeys(POOL)).toEqual(['L00301', 'L00302', 'L00303']);
    expect(levelIdentityKeys(POOL_INSERTED)).toEqual(['L00301', 'L00304', 'L00302', 'L00303']);
    expect(levelIdentityKeys(LEVELS).length).toBe(LEVELS.length);
  });
});
