/**
 * Epic T-133 · E5 (WXG-T-139) —— 错位装配器 + `swaps` BOOT 校验器 + levels JSON v2。
 *
 * 真源：`systems-index.md` **v1.23** §3.13 / §3.5（时间按 k 定价）、
 * `levels-spec.md` v1.2 §2.1（交换构造法 + 错位珠恒等式）、
 * `core-loop v2.0` §2.1（BOOT 校验 swaps）。
 *
 * 说明：8 关数据判据与「时间公式边界」见本文件末尾两个 describe（第二段）。
 */

import { describe, it, expect } from 'vitest';
import { createRng } from '@wxgame/framework';
import {
  assembleBoard,
  countMisplaced,
  decomposeCycles,
  generatePlan,
  generateSwaps,
  validateSwaps,
  applyMisplacedToGrid,
  type Swap,
} from '../src/game/misplaced-assembler.js';
import {
  CYCLE_LEN_LONG,
  LEVEL_TIME_MAX,
  LEVEL_TIME_MIN,
  MISPLACED_PAIRS_MAX,
  MISPLACED_PAIRS_MIN,
  levelTimeFor,
} from '../src/config/tuning.js';
import { LEVELS, validateBeadsLevel } from '../src/config/levels.js';
import { BeadGrid } from '../src/entities/grid.js';
import { createBeadsHarness, simpleTestLevel } from './helpers.js';

/** 6×5 全可填、3 色（= BOOT 色数下限）的测试图案。 */
const TEST_PATTERN = ['123123', '123123', '123123', '123123', '123123'];
const COLS = 6;

const hasError = (errors: readonly string[], fragment: string): boolean =>
  errors.some((e) => e.includes(fragment));

// ─────────────────────────────────────────────────────── 装配器 · 确定性 ────

describe('E5 · 装配器确定性（同 seed 同局面；随机性只来自注入 rng）', () => {
  it('同 seed + 同 (pattern, k, profile) ⇒ 同一份 swaps 与同一份局面', () => {
    const a = generatePlan(TEST_PATTERN, 4, 'short', createRng('e5-seed'));
    const b = generatePlan(TEST_PATTERN, 4, 'short', createRng('e5-seed'));
    expect(a.swaps).toEqual(b.swaps);
    expect(a.cycles).toEqual(b.cycles);
    expect(assembleBoard(TEST_PATTERN, a.swaps).beads).toEqual(
      assembleBoard(TEST_PATTERN, b.swaps).beads,
    );
  });

  it('不同 seed ⇒ 不同局面（随机性确实生效，不是常量）', () => {
    const a = generateSwaps(TEST_PATTERN, 4, 'short', createRng('seed-A'));
    const b = generateSwaps(TEST_PATTERN, 4, 'short', createRng('seed-B'));
    expect(a).not.toEqual(b);
    // 但两者都是合法构造：对数与错位珠数一致（恒等式由下一 describe 断言）。
    expect(a).toHaveLength(4);
    expect(b).toHaveLength(4);
  });

  it('装配 = pattern 全满 → 按序两两交换（手工核对 1 对）', () => {
    const swaps: Swap[] = [[0, 0, 0, 1]]; // (0,0) 底色 1 ⇄ (0,1) 底色 2
    const board = assembleBoard(TEST_PATTERN, swaps);
    expect(board.beads[0]).toBe(2);
    expect(board.beads[1]).toBe(1);
    expect(board.misplacedCount).toBe(2);
    // 其余格保持底色（就位）
    expect(board.beads[2]).toBe(3);
    expect(countMisplaced(TEST_PATTERN, board.beads)).toBe(2);
  });

  it('cycleProfile=long 生成长环：环长 > 2，且 k 用满', () => {
    const plan = generatePlan(TEST_PATTERN, 6, 'long', createRng('e5-long'));
    expect(plan.swaps).toHaveLength(6);
    let maxLen = 0;
    for (const cycle of plan.cycles) maxLen = Math.max(maxLen, cycle.length);
    expect(maxLen).toBeGreaterThan(2);
    expect(maxLen).toBeLessThanOrEqual(CYCLE_LEN_LONG);
  });

  it('cycleProfile=short 全 2-环（= 恒等式 2k 的前提）', () => {
    const plan = generatePlan(TEST_PATTERN, 5, 'short', createRng('e5-short'));
    expect(plan.swaps).toHaveLength(5);
    for (const cycle of plan.cycles) expect(cycle.length).toBe(2);
    expect(plan.misplacedCount).toBe(10); // 2k
  });

  it('applyMisplacedToGrid 把装配结果写进 BeadGrid（满盘 + 错位计数）', () => {
    // ⚠️ 必须显式给 TEST_PATTERN 关卡：无 levels 时 harness 用默认关卡 ⇒ grid
    // 底色与 TEST_PATTERN 不符 ⇒ 装配珠大面积「错位」（曾实测 22 ≠ 4）。
    const harness = createBeadsHarness({ saveKey: 'wxgame.beads.test.e5grid', levels: [simpleTestLevel()] });
    const grid = harness.game.grid;
    const swaps: Swap[] = [
      [0, 0, 0, 1],
      [1, 2, 1, 3],
    ];
    const misplaced = applyMisplacedToGrid(grid, TEST_PATTERN, swaps);
    expect(grid.filledCount).toBe(grid.fillableTotal);
    expect(misplaced).toBe(4);
    expect(grid.misplacedCount).toBe(4);
    expect(grid.isComplete()).toBe(false); // 满盘但有 4 颗错位珠 ⇒ 未通关
  });

  it('BeadGrid 直接装配（无 game）同样成立', () => {
    const grid = new BeadGrid(TEST_PATTERN);
    expect(applyMisplacedToGrid(grid, TEST_PATTERN, [[2, 2, 3, 3]])).toBe(2);
    expect(grid.isMisplaced(2, 2)).toBe(true);
    expect(grid.isMisplaced(3, 3)).toBe(true);
  });
});

// ─────────────────────────────────────────────────── 恒等式 misplaced ────

describe('E5 · 错位珠恒等式（levels-spec §2.1；一般式 = k + 环数）', () => {
  it('全 2-环（cell-disjoint 对）：misplaced === 2 × swaps.length', () => {
    const swaps: Swap[] = [
      [0, 0, 0, 1],
      [1, 0, 1, 1],
      [2, 0, 2, 1],
    ];
    const board = assembleBoard(TEST_PATTERN, swaps);
    expect(board.misplacedCount).toBe(2 * swaps.length);
    expect(validateSwaps('L90', TEST_PATTERN, swaps, 'short')).toEqual([]);
  });

  it('长环（3-环链式）：misplaced = k + 环数 = 3（**不是** 2k = 4）', () => {
    // 反例锁死 levels-spec §2.1「恒等式在任意 swaps 下成立」的不成立处：
    // (A,B),(B,C) 三格轮换 ⇒ 3 颗错位珠，而 2 × swaps.length = 4。
    const swaps: Swap[] = [
      [0, 0, 0, 1],
      [0, 1, 0, 2],
    ];
    const board = assembleBoard(TEST_PATTERN, swaps);
    expect(board.misplacedCount).toBe(3);
    expect(2 * swaps.length).toBe(4); // ← 旧式在此失效
    expect(validateSwaps('L90', TEST_PATTERN, swaps, 'mixed')).toEqual([]);
    expect(decomposeCycles(swaps, COLS)).toEqual([[0, 1, 2]]);
  });

  it('生成结果恒满足一般式：misplaced === swaps + 环数（short/mixed/long 各一）', () => {
    for (const profile of ['short', 'mixed', 'long'] as const) {
      for (const k of [1, 2, 3, 5, 8]) {
        const plan = generatePlan(TEST_PATTERN, k, profile, createRng(`id-${profile}-${k}`));
        if (plan.swaps.length === 0) continue; // 可填格/色不足（本图案不会发生）
        const board = assembleBoard(TEST_PATTERN, plan.swaps);
        expect(board.misplacedCount, `${profile}/k=${k}`).toBe(
          plan.swaps.length + plan.cycles.length,
        );
      }
    }
  });
});

// ─────────────────────────────────────────────────── BOOT 校验器 · 拒收 ────

describe('E5 · BOOT 校验器拒收分支（沿用 L{id} row{i} col{j} 形态）', () => {
  it('swaps 缺失 / 非数组 → 拒收', () => {
    expect(hasError(validateSwaps('L1', TEST_PATTERN, undefined), 'swaps 缺失或非数组')).toBe(true);
    expect(hasError(validateSwaps('L1', TEST_PATTERN, 'nope'), 'swaps 缺失或非数组')).toBe(true);
  });

  it(`对数越界（0 与 ${MISPLACED_PAIRS_MAX + 1}）→ 拒收；区间 [${MISPLACED_PAIRS_MIN}, ${MISPLACED_PAIRS_MAX}]`, () => {
    expect(hasError(validateSwaps('L1', TEST_PATTERN, []), 'swaps 对数 0 不在')).toBe(true);
    const nine: Swap[] = [];
    for (let i = 0; i < MISPLACED_PAIRS_MAX + 1; i++) nine.push([0, i % 6, 1, i % 6]);
    expect(
      hasError(validateSwaps('L1', TEST_PATTERN, nine), `swaps 对数 ${MISPLACED_PAIRS_MAX + 1} 不在`),
    ).toBe(true);
  });

  it('坐标越界 / 非整数 / 形状不对 → 拒收', () => {
    expect(hasError(validateSwaps('L1', TEST_PATTERN, [[9, 9, 0, 0]]), '坐标越界')).toBe(true);
    expect(hasError(validateSwaps('L1', TEST_PATTERN, [[0, 0, 0]]), '四元数组')).toBe(true);
    expect(hasError(validateSwaps('L1', TEST_PATTERN, [[0, 0, 0, 'x']]), '坐标须为整数')).toBe(true);
  });

  it('非可填格（. 或 x）→ 拒收', () => {
    const withHole = ['.23123', '123123', '123123', '123123', '123123'];
    expect(hasError(validateSwaps('L1', withHole, [[0, 0, 0, 1]]), '非可填格')).toBe(true);
    const withLock = ['x23123', '123123', '123123', '123123', '123123'];
    expect(hasError(validateSwaps('L1', withLock, [[0, 0, 1, 0]]), '非可填格')).toBe(true);
  });

  it('两格相同 / 珠色相同 → 拒收（交换无效）', () => {
    expect(hasError(validateSwaps('L1', TEST_PATTERN, [[0, 0, 0, 0]]), '两格相同')).toBe(true);
    // (0,0) 与 (0,3) 底色同为 1 ⇒ 交换后两格仍就位（0 错位珠）
    expect(hasError(validateSwaps('L1', TEST_PATTERN, [[0, 0, 0, 3]]), '珠色相同')).toBe(true);
  });

  it('星序交换 = 本质 3-环 → 合法接受（原「分叉拒收」判据随真交换语义删除）', () => {
    // 原判据「(A,B),(A,C) ⇒ A 的珠被复制」与规格「交换是可逆置换」（levels-spec
    // §2.1）矛盾：真交换下星序 (A,B),(A,C) 恰是一个 3-环（A↔B 后 A↔C），珠色守恒
    // ⇒ 合法，且一般式恒等式 2+1=3 成立。原「链形/分叉」自造判据由此删除。
    const star: Swap[] = [
      [0, 0, 0, 1],
      [0, 0, 0, 2],
    ];
    expect(validateSwaps('L1', TEST_PATTERN, star, 'mixed')).toEqual([]);
  });

  it('环内底色重复 → 拒收（该珠会「歪打正着」就位，恒等式失效）', () => {
    const cycleSameColor: Swap[] = [
      [0, 0, 0, 1],
      [0, 1, 0, 3],
    ]; // (0,0) 与 (0,3) 底色同为 1
    // 原：显式「环内底色重复」判据；改：第二步交换的两格 current 珠色相同 ⇒
    // 被静态规则②（交换无效）拒收 —— 同一拒绝、更早发生。
    expect(hasError(validateSwaps('L1', TEST_PATTERN, cycleSameColor), '珠色相同')).toBe(true);
  });

  it('cycleProfile 取值非法 / 与实际环长矛盾 → 拒收', () => {
    expect(hasError(validateSwaps('L1', TEST_PATTERN, [[0, 0, 0, 1]], 'nope'), 'cycleProfile 非法')).toBe(
      true,
    );
    const long3: Swap[] = [
      [0, 0, 0, 1],
      [0, 1, 0, 2],
    ]; // 3-环
    expect(hasError(validateSwaps('L1', TEST_PATTERN, long3, 'short'), 'cycleProfile=short')).toBe(
      true,
    );
    expect(hasError(validateSwaps('L1', TEST_PATTERN, [[0, 0, 0, 1]], 'long'), 'cycleProfile=long')).toBe(
      true,
    );
  });

  it('恒等式被破坏（伪造 swaps）→ 拒收', () => {
    // 装配后再手改一格珠色：错位珠数不再等于 k + 环数。
    const errors = validateSwaps('L1', TEST_PATTERN, [[0, 0, 0, 1]], 'short');
    expect(errors).toEqual([]);
    const board = assembleBoard(TEST_PATTERN, [[0, 0, 0, 1]]);
    expect(board.misplacedCount).toBe(2);
    // 同一份 swaps 在另一个图案下（(0,0)、(0,1) 同色）恒等式不成立 → 拒收
    const flat = ['111123', '123123', '123123', '123123', '123123'];
    expect(hasError(validateSwaps('L1', flat, [[0, 0, 0, 1]], 'short'), '珠色相同')).toBe(true);
  });

  it('validateBeadsLevel 会把 swaps 错误并进关卡错误列表（含 L{id} 前缀）', () => {
    const level = {
      id: 77,
      name: '缺 swaps',
      cols: 6,
      rows: 5,
      time: 300,
      swaps: [],
      cycleProfile: 'short' as const,
      decoys: [],
      pattern: TEST_PATTERN,
    };
    const errors = validateBeadsLevel(level);
    expect(hasError(errors, 'L77')).toBe(true);
    expect(hasError(errors, 'swaps 对数 0 不在')).toBe(true);
  });
});

// ────────────────────────────────────────── 第二段：levels JSON v2 + 时间 ────

describe('E5 · levels JSON v2：8 关数据全过 BOOT', () => {
  it('8 关逐关零错误，且对数 = k 曲线 [1,2,2,3,4,5,6,8]', () => {
    const kCurve = [1, 2, 2, 3, 4, 5, 6, 8];
    expect(LEVELS).toHaveLength(8);
    LEVELS.forEach((level, i) => {
      expect(validateBeadsLevel(level), `L${level.id}: ${validateBeadsLevel(level).join(' | ')}`).toEqual(
        [],
      );
      expect(level.swaps.length, `L${level.id} k`).toBe(kCurve[i]);
    });
  });

  it('8 关装配后错位珠数 === 2 × k（全 2-环，与 levels-spec §3 表一致）', () => {
    for (const level of LEVELS) {
      const board = assembleBoard(level.pattern, level.swaps);
      expect(board.misplacedCount, `L${level.id}`).toBe(2 * level.swaps.length);
      expect(board.beads.length).toBe(level.rows * level.cols);
    }
  });

  it('8 关错位珠数远小于可填格数（「满盘中挑错」而非满盘错位）', () => {
    for (const level of LEVELS) {
      const fillable = level.pattern.join('').split('').filter((ch) => ch !== '.' && ch !== 'x').length;
      expect(2 * level.swaps.length, `L${level.id}`).toBeLessThan(fillable / 2);
    }
  });

  it('spawnInterval 供料残余已从数据面清理（version 2）', () => {
    for (const level of LEVELS) {
      expect(Object.prototype.hasOwnProperty.call(level, 'spawnInterval'), `L${level.id}`).toBe(false);
    }
  });
});

describe('E5 · 时间按 k 定价（§3.5 v1.23 clamp(k × 45s, 120, 420)）', () => {
  it('边界：k=1 → 120s（下限）、k=2/3 → 120/135s、大 k → 420s 封顶', () => {
    expect(levelTimeFor(1)).toBe(LEVEL_TIME_MIN); // 45 → 钳到 120
    expect(levelTimeFor(2)).toBe(LEVEL_TIME_MIN); // 90 → 钳到 120
    expect(levelTimeFor(3)).toBe(135);
    expect(levelTimeFor(8)).toBe(360);
    expect(levelTimeFor(9)).toBe(405);
    expect(levelTimeFor(10)).toBe(LEVEL_TIME_MAX); // 450 → 钳到 420
    expect(levelTimeFor(999)).toBe(LEVEL_TIME_MAX);
  });

  it('非有限 / 非正 k → 兜底 LEVEL_TIME_DEFAULT（不产生 NaN 倒计时）', () => {
    expect(Number.isFinite(levelTimeFor(Number.NaN))).toBe(true);
    expect(levelTimeFor(0)).toBeGreaterThan(0);
  });

  it('8 关 time 逐关等于公式值（120/120/120/135/180/225/270/360）', () => {
    const expected = [120, 120, 120, 135, 180, 225, 270, 360];
    LEVELS.forEach((level, i) => {
      expect(level.time, `L${level.id} time`).toBe(expected[i]);
      expect(level.time).toBe(levelTimeFor(level.swaps.length));
    });
  });
});
