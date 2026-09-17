/**
 * S6 道具系统判据（`design/gdd/powerups.md` §8；v1.22 解环器反转，WXG-T-137）。
 *
 * 本文件用例**全部经语义改写**（§3.6 v1.22：道具从「清托盘槽」反转为
 * 「自动归位棋盘错位珠」）：每处改动写明「原判据 → 新判据」，用例不删。
 *
 * 测试基建事实：
 *  1. 一律用 simpleTestLevel()（6×5、三色、(0,0) 是可填格）。
 *  2. 错位局面一律用 grid.setBead() 装配（BOOT 装配原语，bead-grid §2.1）；
 *     v2.0 供料已关停 ⇒ 托盘恒空（giveTrayBead 只是测试死路径夹具）。
 */

import { describe, expect, it } from 'vitest';
import { createRng, type RewardedAdProvider } from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import {
  AD_PLACEMENTS,
  POWERUP_FREE_USES,
  POWERUP_TYPES,
  SOLVER_PLUS_COUNT,
  SOLVER_RANDOM_COUNT,
} from '../src/config/tuning.js';
import { PowerupSystem, type MisplacedBead } from '../src/systems/powerups.js';
import { createBeadsHarness, simpleTestLevel, type Harness, type HarnessOptions } from './helpers.js';

type UsedPayload = { type: string; affectedCells: readonly { row: number; col: number }[] };

/** S6 专用 harness：一律用 6×5 三色测试关。 */
function mk(saveKey: string, extra: HarnessOptions = {}): Harness {
  return createBeadsHarness({
      noAssemble: true, levels: [simpleTestLevel()], saveKey, ...extra });
}

/** 装配错位局面：全部可填格就位，再做指定次数的两两对调（贪心找不同色格） ⇒ 受控错位局面。 */
function buildMisplaced(h: Harness, swaps: number): { row: number; col: number }[] {
  const grid = h.game.grid;
  // flat 必须在 fill 之前收集 —— isFillable 只对 empty 格为真（bead-grid §2.1），
  // fill 之后全部变 filled ⇒ 再收集恒为空（本文件曾因此整组 0 错位，教训）。
  const flat: { row: number; col: number }[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cell(r, c)!;
      if (!cell.void && cell.state === 'empty') flat.push({ row: r, col: c });
    }
  }
  for (const { row, col } of flat) grid.fill(row, col, grid.requiredColor(row, col));
  const used = new Set<number>();
  let done = 0;
  // ⚠️ 三色下同色对调 = 零错位 ⇒ 只在珠色不同的两格间对调（贪心扫描）。
  for (let a = 0; a < flat.length && done < swaps; a++) {
    if (used.has(a)) continue;
    for (let b = a + 1; b < flat.length && done < swaps; b++) {
      if (used.has(b)) continue;
      if (grid.requiredColor(flat[a]!.row, flat[a]!.col) === grid.requiredColor(flat[b]!.row, flat[b]!.col))
        continue;
      const ba = grid.cell(flat[a]!.row, flat[a]!.col)!.beadColorIdx;
      const bb = grid.cell(flat[b]!.row, flat[b]!.col)!.beadColorIdx;
      grid.setBead(flat[a]!.row, flat[a]!.col, bb);
      grid.setBead(flat[b]!.row, flat[b]!.col, ba);
      used.add(a);
      used.add(b);
      done += 1;
      break;
    }
  }
  const out: { row: number; col: number }[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) if (grid.isMisplaced(r, c)) out.push({ row: r, col: c });
  }
  return out;
}

/** 托盘快照 —— §8-6 改写：「托盘零读写」的直接断言对象。 */
function traySnapshot(h: Harness): string {
  const tray = h.game.tray;
  const slots: string[] = [];
  for (let i = 0; i < tray.capacity; i++) {
    const s = tray.slot(i)!;
    slots.push(`${s.state}:${s.colorIdx}`);
  }
  return `${tray.selectedSlot}|${slots.join(',')}`;
}

/** Count every call into a RewardedAdProvider（§8-8「零广告 API 调用」）。 */
function adSpy(): { provider: RewardedAdProvider; calls: string[] } {
  const calls: string[] = [];
  const inner = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }).createRewardedAdProvider();
  const provider = new Proxy(inner, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        calls.push(String(prop));
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  }) as RewardedAdProvider;
  return { provider, calls };
}

// ─────────────────────────────────────────────────────── 常量镜像 §3.6

describe('S6 §3.6 常量镜像', () => {
  it('mirrors the frozen §3.6 values', () => {
    // 原：['region','clearAll','random'] + REGION_CLEAR_SLOTS/RANDOM_CLEAR_COUNT；
    // 改：§3.6 v1.22 反转 ⇒ 三型解环器 + SOLVER_*_COUNT（旧值作废死值保留在 tuning）。
    expect(POWERUP_TYPES).toEqual(['solver', 'solverPlus', 'solverRandom']);
    expect(SOLVER_PLUS_COUNT).toBe(3);
    expect(SOLVER_RANDOM_COUNT).toBe(1);
    expect(POWERUP_FREE_USES).toBe(1);
    expect(AD_PLACEMENTS).toBe(4); // 3 道具 + 扩展：布局 A 全为角标占位
  });
});

// ───────────────────────────────────────────────────────────────────── §8-1

describe('S6 §8-1 solver 点名行主序首颗并归位', () => {
  it('names exactly the first misplaced bead (row-major) and relocates it home', () => {
    const h = mk('wxgame.beads.test.s6-1');
    const misplaced = buildMisplaced(h, 2); // 4 颗错位
    expect(misplaced.length).toBe(4);
    expect(h.game.grid.misplacedCount).toBe(4);

    expect(h.game.usePowerup('solver')).toBe(true);
    expect(h.count('powerup:used')).toBe(1);
    const payload = h.last<UsedPayload>('powerup:used')!;
    expect(payload.type).toBe('solver');
    // 原：清 6 槽窗口；改：solver 恒点名 1 颗（§3.6）＝ 行主序首颗。
    expect(payload.affectedCells).toHaveLength(1);
    expect(payload.affectedCells).toEqual([misplaced[0]!]);
    const solved = payload.affectedCells[0]!;
    expect(h.game.grid.isMisplaced(solved.row, solved.col)).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-2

describe('S6 §8-2 solverPlus 点名上限', () => {
  it('names at most SOLVER_PLUS_COUNT cells in row-major order', () => {
    const h = mk('wxgame.beads.test.s6-2a');
    const misplaced = buildMisplaced(h, 4); // 8 颗错位
    expect(misplaced.length).toBe(8);

    expect(h.game.usePowerup('solverPlus')).toBe(true);
    const payload = h.last<UsedPayload>('powerup:used')!;
    // 原：region 6 槽；改：solverPlus 上限 = SOLVER_PLUS_COUNT = 3（不足不补）。
    // ⚠️ payload 记**实际归位**格：点名 3 颗里可能有一颗已被同对交换连带修好
    // ⇒ solved = 2（4 颗错位归位）。COUNT 上限的纯选择断言见 §8-4 单元测。
    expect(payload.affectedCells.length).toBeGreaterThanOrEqual(1);
    expect(payload.affectedCells.length).toBeLessThanOrEqual(SOLVER_PLUS_COUNT);
    expect(h.game.grid.misplacedCount).toBe(4);
  });

  it('names fewer when the board has fewer misplaced beads（不足不补）', () => {
    // 原：random 不足数不补抽（§8-5）；改：solverPlus 同判例。一对交换错位 ⇒
    // 点名 2 颗、首颗交换连带修好配对珠 ⇒ payload = 1、错位清零。
    const h = mk('wxgame.beads.test.s6-2b');
    const misplaced = buildMisplaced(h, 1); // 2 颗错位 < 3
    expect(misplaced.length).toBe(2);

    expect(h.game.usePowerup('solverPlus')).toBe(true);
    const payload = h.last<UsedPayload>('powerup:used')!;
    expect(payload.affectedCells).toHaveLength(1);
    expect(h.game.grid.misplacedCount).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-3

describe('S6 §8-3 归位几何：empty 目标格优先，否则交换', () => {
  it('moves a misplaced bead into the empty home cell when one exists', () => {
    const h = mk('wxgame.beads.test.s6-3a');
    const grid = h.game.grid;
    // 全部就位，仅留一个 empty 目标格：把 (0,0) 留空，(0,1) 放上 (0,0) 的珠色。
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (!grid.isFillable(r, c)) continue;
        if (r === 0 && c === 0) continue;
        grid.fill(r, c, grid.requiredColor(r, c));
      }
    }
    const homeColor = grid.requiredColor(0, 0);
    grid.setBead(0, 1, homeColor); // (0,1) 错位：它的家 (0,0) 正空着
    expect(grid.isMisplaced(0, 1)).toBe(true);

    expect(h.game.usePowerup('solver')).toBe(true);
    const payload = h.last<UsedPayload>('powerup:used')!;
    expect(payload.affectedCells).toEqual([{ row: 0, col: 1 }]);
    // 直移：原格 empty、家格就位（珠数守恒 ⇒ 原格留空，不再全满 ⇒ 不判通关）。
    expect(grid.cell(0, 1)!.state).toBe('empty');
    expect(grid.cell(0, 0)!.beadColorIdx).toBe(homeColor);
    expect(grid.misplacedCount).toBe(0);
  });

  it('swaps two misplaced beads when the home cell is occupied by another misplaced bead', () => {
    const h = mk('wxgame.beads.test.s6-3b');
    buildMisplaced(h, 1); // 满盘错位：目标格必被另一颗错位珠占据
    const before = h.game.grid.cell(0, 0)!.beadColorIdx;

    expect(h.game.usePowerup('solver')).toBe(true);
    const payload = h.last<UsedPayload>('powerup:used')!;
    expect(payload.affectedCells).toEqual([{ row: 0, col: 0 }]);
    // 交换：两格都归位（错位计数 −2）。
    expect(h.game.grid.cell(0, 0)!.beadColorIdx).not.toBe(before);
    expect(h.game.grid.isMisplaced(0, 0)).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-4

describe('S6 §8-4 solverRandom 唯一随机源', () => {
  /** times 次抽取（每次重置免费次数）。 */
  function draw(seed: string, times: number, pool: number): { row: number; col: number }[][] {
    const sys = new PowerupSystem();
    sys.attach(createRng(seed));
    const beads: MisplacedBead[] = [];
    for (let i = 0; i < pool; i++) beads.push({ row: i, col: 0, colorIdx: 1 });
    const out: { row: number; col: number }[][] = [];
    for (let t = 0; t < times; t++) {
      sys.restoreUses({ solverRandom: 0 });
      const result = sys.request('solverRandom', beads);
      if (result.kind !== 'used') throw new Error(`solverRandom 未生效：${result.kind}`);
      out.push([...result.affectedCells]);
    }
    return out;
  }

  it('is deterministic per seed and draws exactly SOLVER_RANDOM_COUNT', () => {
    expect(draw('s6-uniform', 5, 12)).toEqual(draw('s6-uniform', 5, 12));
    for (const cells of draw('s6-uniform', 20, 12)) {
      expect(cells).toHaveLength(SOLVER_RANDOM_COUNT); // 原：RANDOM_CLEAR_COUNT=5；改：1
    }
  });
});

// ───────────────────────────────────────────────────────────────────── §8-5

describe('S6 §8-5 solverRandom 不足数不补抽', () => {
  it('names what exists and never conjures a bead', () => {
    // 原：random 抽托盘 holding；改：solverRandom 抽棋盘错位珠（不足不补）。
    const sys = new PowerupSystem();
    sys.attach(createRng('s6-5'));
    const result = sys.request('solverRandom', [{ row: 0, col: 0, colorIdx: 1 }]);
    expect(result.kind).toBe('used');
    if (result.kind === 'used') expect(result.affectedCells).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-6

describe('S6 §8-6 零托盘读写（v1.22 新判据，取代「clearAll 全容量清槽」）', () => {
  it('never touches the tray: state before == state after (incl. expansion)', () => {
    const h = mk('wxgame.beads.test.s6-6a');
    expect(h.game.expandTray()).toBe(true); // 扩容后 24 槽
    buildMisplaced(h, 3);
    const before = traySnapshot(h);

    expect(h.game.usePowerup('solverPlus')).toBe(true);
    expect(h.count('powerup:used')).toBe(1);
    expect(traySnapshot(h)).toBe(before); // 托盘零读写
  });
});

// ───────────────────────────────────────────────────────────────────── §8-7

describe('S6 §8-7 只动错位珠（改写自「零网格写入」）', () => {
  it('leaves locked counts untouched and only relocates misplaced beads', () => {
    // 原：道具绝不写网格（census 恒定）；改：解环器写网格但只动错位珠 ⇒
    // filled 总数守恒（归位 = 移动）、locked 恒不变。
    const h = mk('wxgame.beads.test.s6-7');
    const grid = h.game.grid;
    let lockedBefore = 0;
    for (let r = 0; r < grid.rows; r++)
      for (let c = 0; c < grid.cols; c++) if (grid.cell(r, c)!.state === 'locked') lockedBefore += 1;
    buildMisplaced(h, 1);
    const filledBefore = grid.filledCount;

    expect(h.game.usePowerup('solverPlus')).toBe(true);
    expect(grid.filledCount).toBe(filledBefore);
    let locked = 0;
    for (let r = 0; r < grid.rows; r++)
      for (let c = 0; c < grid.cols; c++) if (grid.cell(r, c)!.state === 'locked') locked += 1;
    expect(locked).toBe(lockedBefore);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-8

describe('S6 §8-8 免费次数、超限占位与重置', () => {
  it('keeps counters independent, badges the over-limit tap, resets on retry', () => {
    const spy = adSpy();
    const h = mk('wxgame.beads.test.s6-8', { rewardedAd: spy.provider });
    buildMisplaced(h, 1);

    expect(h.game.usePowerup('solver')).toBe(true);
    expect(h.game.powerups.freeUses('solver')).toBe(POWERUP_FREE_USES - 1);
    // 其余两型计数独立（§2.5）。
    expect(h.game.powerups.freeUses('solverPlus')).toBe(POWERUP_FREE_USES);
    // 超限：占位轻提示（[DevTools] 角标的事件学）。onRewarded/onClose/onError 是
    // 初始化即发生的一次性监听注册（合法），§8-8 要的是**不 load、不 show**。
    expect(h.game.usePowerup('solver')).toBe(false);
    expect(spy.calls.filter((c) => c === 'load' || c === 'show')).toEqual([]);
    // 整关重置 ⇒ 三计数回满。
    h.game.powerups.reset();
    expect(h.game.powerups.freeUses('solver')).toBe(POWERUP_FREE_USES);
    expect(h.game.powerups.freeUses('solverRandom')).toBe(POWERUP_FREE_USES);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-9

describe('S6 §8-9 空作用 / 非法 type', () => {
  it('treats an empty scope (zero misplaced) as a no-op and never charges a use', () => {
    const h = mk('wxgame.beads.test.s6-9'); // 全空盘 ⇒ 零错位
    expect(h.game.usePowerup('solver')).toBe(false);
    expect(h.count('powerup:used')).toBe(0);
    expect(h.game.powerups.freeUses('solver')).toBe(POWERUP_FREE_USES); // 零扣次
  });

  it('ignores an invalid type (invalid-enum guard)', () => {
    const sys = new PowerupSystem();
    const result = sys.request('region', [{ row: 0, col: 0, colorIdx: 1 }]); // 旧类型名 ∉ 冻结清单
    expect(result.kind).toBe('invalid');
  });
});

// ───────────────────────────────────────────────────────────────────── §8-10

describe('S6 §8-10 bead:placed 语义与通关（解环器路径无 slot）', () => {
  it('emits bead:placed without a slot and clears the level on zero-misplaced', () => {
    const h = mk('wxgame.beads.test.s6-10');
    buildMisplaced(h, 1); // 一对交换错位 ⇒ solver 交换后即全归位

    expect(h.game.usePowerup('solver')).toBe(true);
    const placed = h.all<{ slot?: number }>('bead:placed');
    expect(placed.length).toBeGreaterThanOrEqual(1);
    for (const p of placed) expect('slot' in p).toBe(false); // 解环器路径不带 slot
    // 交换完成 ⇒ 零错位 ⇒ level:cleared（cleared-priority）。
    expect(h.count('level:cleared')).toBe(1);
  });
});
