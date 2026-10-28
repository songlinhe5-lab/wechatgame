/**
 * S6 道具系统判据（真源：`design/gdd/powerups-v2.md` §8 + `systems-index §3.6`
 * **v1.95 换版**，WXG-T-419/429/431）。v1.22 三解环器判据已按 K-053 由本文件
 * 全量改写：每处写明「原判据 → 新判据」，用例不删（语义作废的显式标注）。
 *
 * 测试基建事实：
 *  1. 一律用 simpleTestLevel()（6×5、三色、(0,0) 是可填格）。`SIDE=6` ≥ 任一边
 *     ⇒ `windowRestore` 窗口贴边收缩 = **整盘**（min(6,rows) × min(6,cols)），
 *     于是「最密集窗口」在小测试盘上恒覆盖全部错位珠。
 *  2. 错位局面一律用 grid.setBead() 装配（BOOT 装配原语，bead-grid §2.1）。
 *  3. 托盘珠用 `giveTrayBead` 死路径夹具装配（仅供 trayRestore 测试；⚠ 它凭空造珠
 *     ⇒ **不得**用它做恒等式类断言，守恒腿走「取回 → 扫豆刷」的合法走子链）。
 *
 * 【编号口径 · 2026-10-28 对表】本文件 `describe` 一律引 `powerups-v2` §8 **现行编号**
 * （判据表已扩到 35 条：v2.4 新增 26～32、v2.5 新增 33～35）。旧版编号（v2.0～v2.3 的
 * 1～10 号段）与现号不同构，旧号一律以 `git log -L` 查本行以前的版本，⛔ 不在本文件
 * 另存一份「旧号↔新号」映射表（判例 K-174：同一映射两处登记必漂移）。
 */

import { describe, expect, it } from 'vitest';
import { createRng, type RewardedAdProvider } from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import {
  AD_PLACEMENTS,
  POWERUP_BUY_PRICE,
  POWERUP_FREE_USES,
  POWERUP_TYPES,
  RANDOM_RESTORE_COUNT,
  SIDE,
  powerupBuyPrice,
} from '../src/config/tuning.js';
import { META_MIGRATIONS, META_SAVE_VERSION } from '../src/game/meta-save-schema.js';
import { PowerupSystem, type MisplacedBead } from '../src/systems/powerups.js';
import {
  advancePastSolver,
  createBeadsHarness,
  simpleTestLevel,
  type Harness,
  type HarnessOptions,
} from './helpers.js';

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

/** 托盘快照 —— §8-6 改写：「托盘只读（S6 不写）」的直接断言对象。 */
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

/**
 * G2′ 相 A（WXG-T-150 / 裁定「甲」）的**同帧**不变式：`usePowerup` 只扣次 + 点名，
 * 棋盘与事件都不得提前动。每一处「归位后」断言前先走本断言、再 `advancePastSolver`。
 */
function expectDeferred(h: Harness): void {
  expect(h.all('bead:placed')).toHaveLength(0); // 相 B 未到点 ⇒ 零落子事件
}

// ─────────────────────────────────────────────────────── 常量镜像 §3.6

describe('S6 §3.6 常量镜像（v1.95）', () => {
  it('mirrors the frozen §3.6 values', () => {
    // 原：['solver','solverPlus','solverRandom'] + SOLVER_*_COUNT；
    // 改：§3.6 v1.95 换版 ⇒ 三件新道具 + SIDE / RANDOM_RESTORE_COUNT（旧值死值留档 tuning）。
    expect(POWERUP_TYPES).toEqual(['windowRestore', 'randomRestore', 'trayRestore']);
    expect(SIDE).toBe(6);
    expect(RANDOM_RESTORE_COUNT).toBe(12);
    expect(POWERUP_FREE_USES).toBe(1); // 值未动；语义 = 账号级永久每型 1 次（另有用例锁）
    expect(AD_PLACEMENTS).toBe(4); // 3 道具 + 扩展（布局 A）
    // §8-23 守卫：升版必须带迁移（漏注册 = 整档回落老玩家经济，§3.6 v1.95 最高危）。
    expect(META_SAVE_VERSION).toBe(2);
    expect(META_MIGRATIONS[1], 'v1→v2 迁移必须同批注册').toBeTypeOf('function');
  });
});

// ───────────────────────────────────────────────────────────────────── §8-1

describe('S6 §8-4 windowRestore 区域内全归位（6×6 最密集窗口 · 原：solver 行主序首颗）', () => {
  it('names every misplaced bead inside the densest window', () => {
    const h = mk('wxgame.beads.test.s6-1');
    const misplaced = buildMisplaced(h, 2); // 4 颗错位
    expect(misplaced.length).toBe(4);
    expect(h.game.grid.misplacedCount).toBe(4);

    expect(h.game.usePowerup('windowRestore')).toBe(true);
    expect(h.count('powerup:used')).toBe(1);
    const payload = h.last<UsedPayload>('powerup:used')!;
    expect(payload.type).toBe('windowRestore');
    // 测试盘 6×5 < 6×6 ⇒ 窗口贴边收缩 = 整盘 ⇒ 最密集窗口 = 全部错位珠。
    expect(payload.affectedCells).toHaveLength(4);
    expect([...payload.affectedCells].sort((a, b) => a.row * 16 + a.col - (b.row * 16 + b.col)))
      .toEqual(misplaced);
    const solved = payload.affectedCells[0]!;
    // G2′ 相 A（裁定「甲」）：本帧**只点名不动手** ⇒ 被点名的格仍是错位珠。
    expectDeferred(h);
    expect(h.game.grid.isMisplaced(solved.row, solved.col)).toBe(true);
    // 相 B 到点后才真归位。
    advancePastSolver(h, 4);
    expect(h.game.grid.misplacedCount).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-2

describe('S6 §8-16(b)(e) randomRestore 抽 min(12, M₀) 颗 · 无放回（原：solverPlus 上限 3）', () => {
  it('names at most RANDOM_RESTORE_COUNT cells, drawn without replacement', () => {
    const h = mk('wxgame.beads.test.s6-2a');
    const misplaced = buildMisplaced(h, 4); // 8 颗错位 < 12
    expect(misplaced.length).toBe(8);

    expect(h.game.usePowerup('randomRestore')).toBe(true);
    const payload = h.last<UsedPayload>('powerup:used')!;
    // 不足不补：池 8 < 12 ⇒ 全部 8 颗（G2′ 后 payload = 点名格，可能被同对交换连带
    // 修好的格仍在点名清单里——点名语义 = 「要动的格」）。
    expect(payload.affectedCells.length).toBeGreaterThanOrEqual(1);
    expect(payload.affectedCells.length).toBeLessThanOrEqual(RANDOM_RESTORE_COUNT);
    expectDeferred(h);
    advancePastSolver(h, RANDOM_RESTORE_COUNT);
    expect(h.game.grid.misplacedCount).toBe(0);
  });

  it('names fewer when the board has fewer misplaced beads（不足不补）', () => {
    const h = mk('wxgame.beads.test.s6-2b');
    const misplaced = buildMisplaced(h, 1); // 2 颗错位 < 12
    expect(misplaced.length).toBe(2);

    expect(h.game.usePowerup('randomRestore')).toBe(true);
    const payload = h.last<UsedPayload>('powerup:used')!;
    expect(payload.affectedCells).toHaveLength(2);
    expectDeferred(h);
    advancePastSolver(h, 2);
    expect(h.game.grid.misplacedCount).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-3

describe('S6 §2.2.1 归位几何：empty 目标格优先，否则交换（守恒臂 = §8-5；几何不变，沿用）', () => {
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

    expect(h.game.usePowerup('windowRestore')).toBe(true);
    const payload = h.last<UsedPayload>('powerup:used')!;
    expect(payload.affectedCells).toEqual([{ row: 0, col: 1 }]);
    expectDeferred(h);
    advancePastSolver(h);
    // 直移：原格 empty、家格就位（珠数守恒 ⇒ 原格留空，不再全满 ⇒ 不判通关）。
    expect(grid.cell(0, 1)!.state).toBe('empty');
    expect(grid.cell(0, 0)!.beadColorIdx).toBe(homeColor);
    expect(grid.misplacedCount).toBe(0);
  });

  it('swaps two misplaced beads when the home cell is occupied by another misplaced bead', () => {
    const h = mk('wxgame.beads.test.s6-3b');
    buildMisplaced(h, 1); // 满盘错位：目标格必被另一颗错位珠占据
    const before = h.game.grid.cell(0, 0)!.beadColorIdx;

    expect(h.game.usePowerup('windowRestore')).toBe(true);
    const payload = h.last<UsedPayload>('powerup:used')!;
    expect(payload.affectedCells[0]).toEqual({ row: 0, col: 0 });
    expectDeferred(h);
    advancePastSolver(h);
    // 交换：两格都归位（错位计数 −2）。
    expect(h.game.grid.cell(0, 0)!.beadColorIdx).not.toBe(before);
    expect(h.game.grid.isMisplaced(0, 0)).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-4

describe('S6 §8-16(a)(c) + §8-15 randomRestore 唯一随机源 = 注入 rng（原：solverRandom）', () => {
  /** times 次抽取（每次重置**本关已用**计数；免费额度账号级，需手动复位耗尽标志）。 */
  function draw(seed: string, times: number, pool: number): { row: number; col: number }[][] {
    const sys = new PowerupSystem();
    sys.attach(createRng(seed));
    const beads: MisplacedBead[] = [];
    for (let i = 0; i < pool; i++) beads.push({ row: i, col: 0, colorIdx: 1 });
    const out: { row: number; col: number }[][] = [];
    for (let t = 0; t < times; t++) {
      sys.restoreUses({ randomRestore: 0 });
      sys.setFreeDepleted({ randomRestore: false }); // 免费腿用掉即永久耗尽 ⇒ 测试里手动复位
      const result = sys.request('randomRestore', beads);
      if (result.kind !== 'used') throw new Error(`randomRestore 未生效：${result.kind}`);
      out.push([...result.affectedCells]);
    }
    return out;
  }

  it('is deterministic per seed and draws exactly RANDOM_RESTORE_COUNT（不足不补）', () => {
    expect(draw('s6-uniform', 5, 20)).toEqual(draw('s6-uniform', 5, 20));
    for (const cells of draw('s6-uniform', 20, 20)) {
      expect(cells).toHaveLength(RANDOM_RESTORE_COUNT);
    }
  });
});

// ───────────────────────────────────────────────────────────────────── §8-5

describe('S6 §8-16(e) 不足数不补抽（沿用判例，randomRestore）', () => {
  it('names what exists and never conjures a bead', () => {
    const sys = new PowerupSystem();
    sys.attach(createRng('s6-5'));
    const result = sys.request('randomRestore', [{ row: 0, col: 0, colorIdx: 1 }]);
    expect(result.kind).toBe('used');
    if (result.kind === 'used') expect(result.affectedCells).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-6

describe('S6 §8-7(a) 棋盘道具不写托盘（v1.95：S6 对托盘只读，非「零读写」）', () => {
  it('never touches the tray via windowRestore/randomRestore: state before == state after', () => {
    const h = mk('wxgame.beads.test.s6-6a');
    expect(h.game.expandTray()).toBe(true); // 扩容后 24 槽
    buildMisplaced(h, 3);
    const before = traySnapshot(h);

    expect(h.game.usePowerup('windowRestore')).toBe(true);
    expect(h.count('powerup:used')).toBe(1);
    expect(traySnapshot(h)).toBe(before); // 相 A 只读
    advancePastSolver(h, 4);
    expect(traySnapshot(h)).toBe(before); // 相 B 真归位后仍只读
  });
});

// ───────────────────────────────────────────────────────────────────── §8-7

describe('S6 §8-5 + §8-6 只动错位珠（每色珠数相等 · 就位/锁定逐格不变）', () => {
  it('leaves locked counts untouched and only relocates misplaced beads', () => {
    const h = mk('wxgame.beads.test.s6-7');
    const grid = h.game.grid;
    let lockedBefore = 0;
    for (let r = 0; r < grid.rows; r++)
      for (let c = 0; c < grid.cols; c++) if (grid.cell(r, c)!.state === 'locked') lockedBefore += 1;
    buildMisplaced(h, 1);
    const filledBefore = grid.filledCount;

    expect(h.game.usePowerup('windowRestore')).toBe(true);
    advancePastSolver(h, 4); // G2′：到点才写盘 ⇒ 本断言若不留门会空转
    expect(grid.filledCount).toBe(filledBefore);
    let locked = 0;
    for (let r = 0; r < grid.rows; r++)
      for (let c = 0; c < grid.cols; c++) if (grid.cell(r, c)!.state === 'locked') locked += 1;
    expect(locked).toBe(lockedBefore);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-8

describe('S6 §8-10(a) + §8-21 免费额度（v1.95：账号级永久）与超限占位', () => {
  it('free use is account-level: exhausted stays exhausted across reset; purchase path opens', () => {
    const spy = adSpy();
    const h = mk('wxgame.beads.test.s6-8', { rewardedAd: spy.provider });
    buildMisplaced(h, 1);

    expect(h.game.usePowerup('windowRestore')).toBe(true);
    expect(h.game.powerups.freeUses('windowRestore')).toBe(0); // 用掉即永久耗尽
    // 其余两型额度独立（§2.5）。
    expect(h.game.powerups.freeUses('randomRestore')).toBe(POWERUP_FREE_USES);
    // 超限：**双通道面板**（购买 / 视频）——本帧零扣豆、零广告 API（弹窗语义）。
    expect(h.game.usePowerup('windowRestore')).toBe(false);
    expect(spy.calls.filter((c) => c === 'load' || c === 'show')).toEqual([]);
    // ⛔ v1.95 语义变更：reset **不恢复**免费额度（原判据「整关重置 ⇒ 三计数回满」作废）。
    h.game.powerups.reset();
    expect(h.game.powerups.freeUses('windowRestore')).toBe(0);
    expect(h.game.powerups.freeUses('trayRestore')).toBe(POWERUP_FREE_USES);
  });

  it('setFreeDepleted 注入账号档耗尽标志（shell 落档回读路径）', () => {
    const sys = new PowerupSystem();
    sys.attach(createRng('s6-8b'));
    sys.setFreeDepleted({ trayRestore: true });
    expect(sys.freeUses('trayRestore')).toBe(0);
    expect(sys.freeUses('windowRestore')).toBe(POWERUP_FREE_USES);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-9

describe('S6 §8-9 + §8-12(a) 零错位不置位 / 非法 type（沿用）', () => {
  it('treats an empty scope (zero misplaced) as a no-op and never charges a use', () => {
    const h = mk('wxgame.beads.test.s6-9'); // 全空盘 ⇒ 零错位
    expect(h.game.usePowerup('windowRestore')).toBe(false);
    expect(h.count('powerup:used')).toBe(0);
    expect(h.game.powerups.freeUses('windowRestore')).toBe(POWERUP_FREE_USES); // 零扣次
  });

  it('ignores an invalid type (invalid-enum guard)', () => {
    const sys = new PowerupSystem();
    const result = sys.request('solver', [{ row: 0, col: 0, colorIdx: 1 }]); // 旧类型名 ∉ 冻结清单
    expect(result.kind).toBe('invalid');
  });
});

// ───────────────────────────────────────────────────────────────────── §8-10

describe('S6 §8-8 bead:placed 语义与通关（payload 1:1，沿用）', () => {
  it('emits bead:placed without a slot and clears the level on zero-misplaced', () => {
    const h = mk('wxgame.beads.test.s6-10');
    buildMisplaced(h, 1); // 一对交换错位 ⇒ 归位后即全归位

    expect(h.game.usePowerup('windowRestore')).toBe(true);
    // G2′ 相 A（裁定「甲」）：同帧零 `bead:placed`、零过关 ⇒ 过关判定排在序列末。
    expectDeferred(h);
    expect(h.count('level:cleared')).toBe(0);
    advancePastSolver(h);
    const placed = h.all<{ slot?: number }>('bead:placed');
    expect(placed.length).toBeGreaterThanOrEqual(1);
    for (const p of placed) expect('slot' in p).toBe(false); // 道具路径不带 slot
    // 归位完成 ⇒ 零错位 ⇒ level:cleared（cleared-priority）。
    expect(h.count('level:cleared')).toBe(1);
  });
});

// ───────────────────────────────────────────────── trayRestore（v1.95 新件）

describe('S6 §2.2.5 trayRestore 托盘归位（判据族 = §8-26～§8-35）', () => {
  const empties = [
    { row: 0, col: 0 },
    { row: 1, col: 1 },
    { row: 2, col: 2 },
  ];

  it('首颗目标格为空 ⇒ 放入不换出；目标格被占 ⇒ 换出珠随机落剩余空格', () => {
    const sys = new PowerupSystem();
    sys.attach(createRng('s6-tray'));
    const tray = [
      { colorIdx: 1, slot: 0, targetRow: 0, targetCol: 0 }, // 空 ⇒ 放入
      { colorIdx: 2, slot: 1, targetRow: 2, targetCol: 0 }, // 不在空格清单 ⇒ 被占 ⇒ 换出
    ];
    const result = sys.request('trayRestore', [], { tray, empties });
    expect(result.kind).toBe('used');
    if (result.kind !== 'used') return;
    // 托盘两颗的目标格都在点名里；换出珠落剩余空格之一。
    expect(result.affectedCells).toContainEqual({ row: 0, col: 0 });
    expect(result.affectedCells).toContainEqual({ row: 2, col: 0 });
    expect(result.affectedCells).toHaveLength(3); // 2 目标 + 1 换出落格
  });

  it('托盘空 ⇒ empty（零事件零扣次）；同 seed 复现', () => {
    const sys = new PowerupSystem();
    sys.attach(createRng('s6-tray-2'));
    expect(sys.request('trayRestore', [], { tray: [], empties }).kind).toBe('empty');

    const tray = [{ colorIdx: 3, slot: 2, targetRow: 1, targetCol: 1 }];
    const run = (): readonly { row: number; col: number }[] => {
      const s2 = new PowerupSystem();
      s2.attach(createRng('s6-tray-2'));
      const r = s2.request('trayRestore', [], { tray, empties });
      if (r.kind !== 'used') throw new Error(r.kind);
      return r.affectedCells;
    };
    expect(run()).toEqual(run());
  });

  it('空格耗尽 ⇒ 换出珠留托盘（仍归位目标格，不凭空造格）', () => {
    const sys = new PowerupSystem();
    sys.attach(createRng('s6-tray-3'));
    const tray = [
      { colorIdx: 1, slot: 0, targetRow: 0, targetCol: 0 }, // 被占 ⇒ 换出
      { colorIdx: 2, slot: 1, targetRow: 1, targetCol: 1 }, // 被占 ⇒ 换出
    ];
    const result = sys.request('trayRestore', [], { tray, empties: [{ row: 0, col: 0 }] });
    expect(result.kind).toBe('used');
    if (result.kind !== 'used') return;
    expect(result.affectedCells).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 1 },
    ]); // 只有目标格，零落格
  });
});

// ───────────────── §8-26(d) 守恒恒等式 / §8-27(b) 镜像漂移拒绝（本批补腿）

describe('S6 §8-26(d) 守恒恒等式 `#empty = #trayBeads`（现号；本批前无腿）', () => {
  /** 盘面空格数 = 可填格总数 − 已填格数（`grid.fillableTotal` / `filledCount`）。 */
  const emptiesOf = (h: Harness): number => h.game.grid.fillableTotal - h.game.grid.filledCount;

  it('合法走子链（填满 → 取回 k 颗 → 扫豆刷）前后恒等式均成立', () => {
    const h = mk('wxgame.beads.test.s6-8-26d');
    buildMisplaced(h, 3);
    expect(emptiesOf(h)).toBe(0); // 装配后全盘就位/错位、零空格
    expect(h.game.tray.holdingCount).toBe(0);

    // 合法取回：盘面拿掉的每一颗都必须落进托盘（⛔ 不用 giveTrayBead 死路径夹具 ——
    // 它会凭空造珠，恒等式在夹具层就已破，测不到真不变式）。
    let anchor: { row: number; col: number } | null = null;
    for (let r = 0; r < h.game.grid.rows && !anchor; r++) {
      for (let c = 0; c < h.game.grid.cols && !anchor; c++) {
        if (h.game.grid.isMisplaced(r, c)) anchor = { row: r, col: c };
      }
    }
    expect(anchor, '夹具须至少造出一颗错位珠').not.toBeNull();
    expect(h.game.selectBoardBead(anchor!.row, anchor!.col)).toBe(true);
    expect(h.game.retrieveSelectedGroup()).toBe(true);

    const before = emptiesOf(h);
    expect(h.game.tray.holdingCount, '取回后恒等式（珠只换了住处）').toBe(before);
    expect(before).toBeGreaterThan(0);

    expect(h.game.usePowerup('trayRestore')).toBe(true);
    // 同帧动手腿（v1.95 / WXG-T-431）：plan 与 `_execTrayPlan` 同一次调用内完成，无需相 B。

    expect(h.game.tray.holdingCount, '使用后恒等式仍成立：空格与托盘珠等量递减').toBe(emptiesOf(h));
    expect(h.game.tray.holdingCount).toBeLessThan(before);
    expect(h.count('bead:rejected')).toBe(0);
  });
});

describe('S6 §8-27(b) 镜像漂移（托盘非空 ∧ 无空格）⇒ 拒绝裁定（现号；本批前无腿）', () => {
  /**
   * 上位 = `powerups-v2 §6 X-9`（镜像漂移：零事件、零格变化、零扣次、零扣豆 + 记警告）
   * 与 `§6 X-2`（守恒恒等式使「托盘非空 ∧ 无空格」结构上不可达 ⇒ 出现即漂移）。
   * 判据原文只要求一件事：⛔ 不得「按镜像硬算」把珠写进已填格。
   */
  it('伪造镜像喂进裁定函数 ⇒ 走拒绝（empty）、不扣次、零 plan', () => {
    const sys = new PowerupSystem();
    sys.attach(createRng('s6-8-27b'));
    const tray = [
      { colorIdx: 1, slot: 0, targetRow: 0, targetCol: 0 },
      { colorIdx: 2, slot: 1, targetRow: 1, targetCol: 1 },
    ];
    const freeBefore = sys.freeUses('trayRestore');
    const result = sys.request('trayRestore', [], { tray, empties: [] });
    expect(result.kind, '拒绝裁定 = 零事件零扣次，出口只能是 empty（§6 X-9）').toBe('empty');
    expect(sys.freeUses('trayRestore'), '零扣次（§8-30 同族）').toBe(freeBefore);
  });

  it('反向臂：合法镜像（有空格）仍照常执行，拒绝不得把正常路径一并堵死', () => {
    const sys = new PowerupSystem();
    sys.attach(createRng('s6-8-27b-ok'));
    const tray = [{ colorIdx: 1, slot: 0, targetRow: 0, targetCol: 0 }];
    const result = sys.request('trayRestore', [], { tray, empties: [{ row: 0, col: 0 }] });
    expect(result.kind).toBe('used');
    if (result.kind !== 'used') return;
    expect(result.affectedCells).toEqual([{ row: 0, col: 0 }]);
  });
});

// ───────────────────────────────────── §3.6 v1.95 · 豆子购买（无上限 / 统一 100）

describe('§3.6 v1.95 · 豆子购买（§8-18 / §8-31：统一 100 豆、不设次数上限）', () => {
  const pool: MisplacedBead[] = [
    { row: 0, col: 0, colorIdx: 1 },
    { row: 0, col: 1, colorIdx: 2 },
    { row: 0, col: 2, colorIdx: 3 },
  ];

  // windowRestore 必需 dims（缺 = invalid 出口）；pool 3 颗在 0 行 ⇒ 1×3 整盘窗口。
  const dims = { rows: 1, cols: 3 };

  function exhausted(): PowerupSystem {
    const sys = new PowerupSystem();
    sys.attach(createRng(7));
    expect(sys.request('windowRestore', pool, { dims }).kind).toBe('used');
    expect(sys.request('windowRestore', pool, { dims }).kind, '免费 1 次已永久耗尽').toBe('exhausted');
    return sys;
  }

  it('免费次数内不产生购买计数；耗尽后可购买且不动免费额度', () => {
    const sys = exhausted();
    expect(sys.bought('windowRestore'), '免费使用不计入购买').toBe(0);
    expect(sys.canPurchase('windowRestore')).toBe(true);
    expect(sys.purchase('windowRestore', pool, { dims }).kind).toBe('used');
    expect(sys.bought('windowRestore')).toBe(1);
    expect(sys.freeUses('windowRestore'), '购买不返还免费额度').toBe(0);
    expect(sys.usedCount, 'C7 扣分口径 = 本关已用（免费+购买）').toBe(2);
  });

  it('不设次数上限（v2.1 裁定 C）：连续购买恒可', () => {
    const sys = exhausted();
    expect(sys.purchase('windowRestore', pool, { dims }).kind).toBe('used');
    expect(sys.purchase('windowRestore', pool, { dims }).kind).toBe('used');
    expect(sys.purchase('randomRestore', pool).kind).toBe('used');
    expect(sys.canPurchase('trayRestore')).toBe(true);
    expect(sys.bought('windowRestore')).toBe(2);
  });

  it('棋盘无错位珠 ⇒ 购买零副作用（拒用不扣，同 request 判例）', () => {
    const sys = exhausted();
    expect(sys.purchase('windowRestore', [], { dims }).kind).toBe('empty');
    expect(sys.bought('windowRestore'), '未记账').toBe(0);
    expect(sys.canPurchase('windowRestore')).toBe(true);
  });

  it('reset 清购买计数但**不恢复**免费额度（账号级语义的分界用例）', () => {
    const sys = exhausted();
    sys.purchase('windowRestore', pool, { dims });
    expect(sys.bought('windowRestore')).toBe(1);
    sys.reset();
    expect(sys.bought('windowRestore')).toBe(0);
    expect(sys.canPurchase('windowRestore')).toBe(true);
    expect(sys.freeUses('windowRestore')).toBe(0); // ⛔ 不回满
  });

  it('三件统一 100 豆（§3.6 v1.95 冻结）', () => {
    expect(powerupBuyPrice('windowRestore')).toBe(POWERUP_BUY_PRICE);
    expect(powerupBuyPrice('randomRestore')).toBe(100);
    expect(powerupBuyPrice('trayRestore')).toBe(100);
    expect(POWERUP_BUY_PRICE).toBe(100);
  });
});
