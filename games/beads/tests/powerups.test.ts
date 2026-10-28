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
import { createRng, type Rng, type RewardedAdProvider } from '@wxgame/framework';
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
    noAssemble: true, levels: [simpleTestLevel()], saveKey, ...extra
  });
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

/** 盘面读数（`state:beadColorIdx` 逐格串）——§8-27(a)「格态零变化」/ (c)「其余珠照常」/ (d)「写入保留」的比对对象。 */
function gridDigest(h: Harness): string {
  const grid = h.game.grid;
  const out: string[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cell(r, c)!;
      out.push(`${cell.state}:${cell.beadColorIdx}`);
    }
  }
  return out.join(',');
}

/** S6 的随机消费计数器（Proxy 包 `createRng`，只挂进 S6 ⇒ 不掺 game 侧 `services.rng` 的噪声）。 */
function rngSpy(seed: string): { rng: Rng; calls: string[] } {
  const calls: string[] = [];
  const inner = createRng(seed);
  const rng = new Proxy(inner, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        calls.push(String(prop));
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  }) as Rng;
  return { rng, calls };
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

// ───────────── §8-27(a) 托盘空 / §8-27(c) 候选集空 / §8-27(d) 中途终止（本批补腿）

describe('S6 §8-27(a) 托盘为空 ⇒ 整次零效果（现号；本批前无腿）', () => {
  /** 额度逐字段读数：免费位 / 本关已用 / 豆子购买计数（§8-30 同族口径）。 */
  const quotaOf = (sys: PowerupSystem): string[] =>
    POWERUP_TYPES.map((t) => `${t}:${sys.freeUses(t)}/${sys.usedThisLevel[t]}/${sys.bought(t)}`);

  it('点 10 次 ⇒ 零事件、零随机、格态与托盘不变、额度逐字段不变、不弹面板（§6 X-1）', () => {
    let charged = 0;
    const h = mk('wxgame.beads.test.s6-8-27a', {
      // 豆子住在 MetaState，扣款腿由 shell 注入 ⇒ 本腿以「回调零调用」作「豆子不变」的口径。
      onPowerupPurchase: () => {
        charged += 1;
        return true;
      },
    });
    buildMisplaced(h, 2); // 盘上确有错位珠 ⇒ 与 §8-9「零错位不置位」那条腿区分开
    expect(h.game.tray.holdingCount).toBe(0);

    const spy = rngSpy('s6-8-27a');
    h.game.powerups.attach(spy.rng);
    const gridBefore = gridDigest(h);
    const trayBefore = traySnapshot(h);
    const quotaBefore = quotaOf(h.game.powerups);

    for (let i = 0; i < 10; i++) {
      expect(h.game.usePowerup('trayRestore'), `第 ${i + 1} 次点击应零效果`).toBe(false);
    }
    expect(h.count('powerup:used')).toBe(0);
    expect(h.count('bead:placed')).toBe(0);
    expect(spy.calls, '零随机消费（连换出腿都不该进）').toEqual([]);
    expect(gridDigest(h), '格态零变化').toBe(gridBefore);
    expect(traySnapshot(h), '托盘零写').toBe(trayBefore);
    expect(quotaOf(h.game.powerups), '全部额度逐字段不变（免费位 + 本关计数 + 购买计数）').toEqual(
      quotaBefore,
    );
    expect(charged, '零扣豆').toBe(0);
    expect(h.game.pendingPowerupBuy, '§6 X-1：不弹面板（不卖用不了的东西）').toBeNull();
    expect(h.game.powerupHint, '§6 X-1 / E-3：零噪声，不置占位提示').toBe('');
  });
});

describe('S6 §8-27(c) 候选集为空 ⇒ 该珠 skipped（现号；本批前无腿）', () => {
  /**
   * 夹具 = §8-34(e) 的 **P-1 伪造态**（「某色珠比该色格多 1 颗」，6×5 三色测试盘）：
   *  · 色 2 的每一格都**正确就位** ⇒ 托盘那颗色 2 珠没有任何归宿格 = 候选集为空；
   *  · (0,0)（要求色 1）填成色 3 ⇒ 错位 ⇒ 色 1 珠的归宿格被占 ⇒ 走**换出腿**（本腿唯一真抽随机的
   *    地方，用它证明「skipped 的珠不掺进随机」，而不是「整条腿压根没抽随机」）；
   *  · 其余格留 `empty` ⇒ 换出珠有处可落（镜像合法：托盘非空 ∧ 有空格 ⇒ 不触发 §8-27(b) 守卫）。
   */
  function mkP1(saveKey: string): { h: Harness; spy: { rng: Rng; calls: string[] } } {
    const h = mk(saveKey);
    const grid = h.game.grid;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) if (grid.requiredColor(r, c) === 2) grid.fill(r, c, 2);
    }
    grid.fill(0, 0, 3); // (0,0) 要求色 1、填色 3 ⇒ 行主序第一个色 1 归宿格被占
    expect(grid.isMisplaced(0, 0)).toBe(true);
    const spy = rngSpy('s6-8-27c'); // 两臂同 seed ⇒ 换出落点必须逐位相同
    h.game.powerups.attach(spy.rng);
    return { h, spy };
  }

  it('有归宿的珠照常换出归位、无归宿的珠 skipped 留槽且不消费随机、事件照发', () => {
    const a = mkP1('wxgame.beads.test.s6-8-27c-both');
    const slotHomeless = a.h.game.giveTrayBead(2); // 无归宿（色 2 全部已就位）
    const slotHomed = a.h.game.giveTrayBead(1); // 有归宿 = (0,0)（被占 ⇒ 换出）

    expect(a.h.game.usePowerup('trayRestore')).toBe(true);
    expect(a.h.count('powerup:used'), '事件照发（不因有一颗没归宿就整次静默）').toBe(1);
    const payload = a.h.last<UsedPayload & { traySlots?: readonly number[] }>('powerup:used')!;
    expect(payload.affectedCells).toContainEqual({ row: 0, col: 0 });
    expect(payload.affectedCells).toHaveLength(2); // 目标格 + 换出落格，无归宿那颗不进点名
    expect(payload.traySlots, 'traySlots 只含真被清空的槽（§8-32(a)）').toEqual([slotHomed]);
    expect(a.h.game.grid.cell(0, 0)!.beadColorIdx).toBe(1);
    expect(a.h.game.grid.isMisplaced(0, 0), '有归宿那颗真归位了').toBe(false);
    expect(a.h.game.tray.holdingCount, '无归宿那颗留在槽（⛔ 不得静默吞珠）').toBe(1);
    expect(a.h.game.tray.slot(slotHomeless)!.state).toBe('holding');
    expect(a.h.game.tray.slot(slotHomeless)!.colorIdx).toBe(2);
    expect(a.h.game.tray.slot(slotHomed)!.state).toBe('free');
    expect(a.spy.calls, '本腿只有换出腿抽了一次 ⇒ skipped 的珠未多消费随机').toHaveLength(1);

    // 对照臂：同夹具、同 seed，只是**不放**那颗无归宿珠 ⇒ 点名与盘面必须逐字段相同（「其余珠照常」）。
    const b = mkP1('wxgame.beads.test.s6-8-27c-alone');
    b.h.game.giveTrayBead(1);
    expect(b.h.game.usePowerup('trayRestore')).toBe(true);
    expect(b.h.game.tray.holdingCount).toBe(0);
    expect(b.spy.calls).toHaveLength(1);
    expect(b.h.last<UsedPayload>('powerup:used')!.affectedCells, '两臂点名一致').toEqual(
      payload.affectedCells,
    );
    expect(gridDigest(b.h), '两臂盘面一致 ⇒ 无归宿珠未影响任何格').toBe(gridDigest(a.h));
  });

  it('整批都无归宿 ⇒ 唯一合法出口是整次拒绝（零事件、零扣次、托盘不动 · §8-34(c)）', () => {
    const c = mkP1('wxgame.beads.test.s6-8-27c-all');
    c.h.game.giveTrayBead(2);
    const freeBefore = c.h.game.powerups.freeUses('trayRestore');
    const gridBefore = gridDigest(c.h);

    expect(c.h.game.usePowerup('trayRestore')).toBe(false);
    expect(c.h.count('powerup:used')).toBe(0);
    expect(c.h.game.powerups.freeUses('trayRestore'), '零扣次').toBe(freeBefore);
    expect(c.h.game.tray.holdingCount, '不存在「归位了一半」的中间态').toBe(1);
    expect(gridDigest(c.h)).toBe(gridBefore);
    expect(c.spy.calls).toEqual([]);
  });
});

describe('S6 §8-27(d) 中途终止不回滚（现号；本批前无腿）', () => {
  it('第 3 颗的写入失败 ⇒ 前 2 颗的写入保留、该颗留槽（无回滚）+ 未生效格可观测（§8-27(d) v2.7 现文）', () => {
    const h = mk('wxgame.beads.test.s6-8-27d');
    // 三色各一颗：目标 = 各色行主序第一个空格 ⇒ (0,0)/(0,1)/(0,2)，全走直填腿（零随机）。
    const slot1 = h.game.giveTrayBead(1);
    const slot2 = h.game.giveTrayBead(2);
    const slot3 = h.game.giveTrayBead(3);
    expect([slot1, slot2, slot3]).toEqual([0, 1, 2]);

    // 异常注入 = 第 3 次 `fill`（`_execTrayPlan` 倒序执行 ⇒ 槽 0 那颗）失败，模拟动手帧中途终止。
    const e0 = h.game.grid.fillableTotal - h.game.grid.filledCount;
    const hold0 = h.game.tray.holdingCount;
    const grid = h.game.grid as unknown as {
      fill: (row: number, col: number, bead?: number) => boolean;
    };
    const realFill = grid.fill.bind(grid);
    let fillCalls = 0;
    grid.fill = (row, col, bead) => {
      fillCalls += 1;
      return fillCalls === 3 ? false : realFill(row, col, bead);
    };

    expect(h.game.usePowerup('trayRestore')).toBe(true);
    expect(fillCalls, '三颗都该被动手过一轮').toBe(3);
    expect(h.count('bead:placed'), '已生效的两颗各一条 bead:placed').toBe(2);
    expect(h.game.grid.cell(0, 2)!.beadColorIdx).toBe(3); // 倒序第 1 颗
    expect(h.game.grid.cell(0, 1)!.beadColorIdx).toBe(2); // 倒序第 2 颗
    expect(h.game.grid.cell(0, 0)!.state, '第 3 颗未写').toBe('empty');
    expect(h.game.tray.holdingCount, '不回滚：失败那颗留槽，前两颗的写入保留').toBe(1);
    expect(h.game.tray.slot(slot1)!.colorIdx).toBe(1);
    expect(h.game.tray.slot(slot2)!.state).toBe('free');
    expect(h.game.tray.slot(slot3)!.state).toBe('free');
    expect(h.game.grid.filledCount).toBe(2);
    expect(h.count('level:cleared')).toBe(0);

    // ── v2.7（WXG-T-434 / R-28）改写后的本条断言：原判据末句「`affectedCells` 只含已生效格」**作废留痕**
    //   （K-053；emit 早于动手，结构上做不到，与 §8-32(b) 的「逐格相等」互斥）。现文改断
    //   **「未生效格必须可观测」**⇒ 意图集不收缩 + §8-32(b) 在本态必须红 + 守恒不破。
    const payload = h.last<UsedPayload>('powerup:used')!;
    expect(payload.affectedCells).toHaveLength(3);
    expect(
      payload.affectedCells,
      '§8-27(d) 现文：affectedCells = 裁定时刻的**意图集**，不随执行收缩 ⇒ (0,0) 仍在点名里',
    ).toContainEqual({ row: 0, col: 0 });
    // §8-32(b) 的「正常路径下 S3 写入格集合 ≡ affectedCells」在本异常态**必须红**：点名 3 格、
    // 实写 2 格 ⇒ 差集恰是那颗留槽珠的目标格 (0,0)。本腿把红签名钉住，⛔ 不得静默成「看起来全生效」。
    const written = new Set(h.all<{ row: number; col: number }>('bead:placed').map((p) => p.row * 1024 + p.col));
    expect(written.size, '§8-32(b) 红签名的右端：实际生效格集合 = 2 个').toBe(2);
    expect(written.has(0), '§8-32(b) 红签名：(0,0) 在点名里但从未被写入 ⇒ 逐格比对在此态为红').toBe(false);
    // 守恒（§8-26(d)）的**增量形式**：本夹具走 `giveTrayBead`（凭空造珠 ⇒ ⛔ 拿它断绝对守恒就是误用），
    // 可断的是「空格减少数 ≡ 离槽颗数」：那颗失败的珠既没被吞掉，也没被硬塞进别的格。
    expect(
      e0 - (h.game.grid.fillableTotal - h.game.grid.filledCount),
      '§8-26(d) 增量守恒：空格只少了「真写入的那 2 格」',
    ).toBe(hold0 - h.game.tray.holdingCount);
    // §8-33(a)「使用后托盘占用恒为 0」在本异常态就是**红**的（上面已断 `holdingCount = 1`）
    // ⇒ 缺陷可观测，这正是 v2.7 把末句从「收缩」改成「可观测」的全部目的。
  });
});

// ──────── §8-33(b) / §8-34(a) 同色重复点名回归腿（2026-10-28 P1 缺陷的固定复现，⛔ 不得删）

describe('S6 §8-33(b)/§8-34(a) 同色多颗托盘珠 ⇒ 归宿格互不重复（P1 回归腿）', () => {
  /**
   * 上位判据：§8-33(b)「`traySlots.length` 恒等于裁定时刻的 `t`」、§8-34(a)「每颗托盘珠的落点格
   * `pattern` 恒等于该珠色」、§8-26(a)「`ΔM ≥ 0` 恒成立」。
   *
   * 缺陷本体（`src/game/beads-game.ts:_powerupInputs()` 旧实现）：每颗珠都取「行主序第一个匹配格」
   * ⇒ 同色 N 颗指向**同一格**，违反 `systems/powerups.ts:planTray` 头注写明的前置「目标格互不重复
   * 由调用方保证」。倒序执行时首格被 `setBead` 反复覆盖、被逐出的正是刚放下的那颗托盘珠 ⇒
   * 实测「声称清 2 槽、实际只落 1 颗」。修法 = 按色消费式分配（第 k 颗 ⇒ 第 k 个候选格）。
   *
   * 夹具（两腿共用，`BEADS_DUP_FIXTURE`）：图案 `'123123'×5` 的 6×5 盘，逐行摆 `112233` 的一个
   * 排列 ⇒ **每色珠数恒等于每色格数 = 10**（⛔ 非 §8-34(e) 的 P-1 伪造态，故本腿断言的是
   * 「合法盘面上的 100% 清空/归位」）。色 1 珠占 (0,0)(0,5)(1,4)(1,5)(2,0)(2,3)(3,0)(3,3)(4,0)(4,1)
   * ⇒ 错位 9 颗；其中 (0,5)-(1,5)-(1,4) 是一个 8 向连通组，整组取回后盘面恰好留下 3 个色 1 空格
   * (0,3)(1,0)(1,3) ⇒ 「三颗同色珠 ≡ 三个同色归宿格」，旧实现下必然三珠争一格。
   */
  const BEADS_DUP_FIXTURE = ['123321', '223311', '123123', '123123', '112323'];

  /** 行主序逐格摆珠（BOOT 装配原语 `grid.fill` 的第三参 = 珠色，⛔ 不走凭空造珠的 giveTrayBead）。 */
  function loadDupFixture(h: Harness): void {
    const grid = h.game.grid;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (grid.isFillable(r, c)) grid.fill(r, c, Number(BEADS_DUP_FIXTURE[r]!.charAt(c)));
      }
    }
  }

  it('三格同色空 + 三颗同色珠 ⇒ 三格全就位、托盘清空、`traySlots` 不短于 t', () => {
    const h = mk('wxgame.beads.test.s6-8-33-dup');
    const grid = h.game.grid;
    loadDupFixture(h);
    expect(grid.misplacedCount, '每色珠 ≡ 每色格 ⇒ 错位恰 9（(0,3)(0,5)(1,0)(1,3)(1,4)(1,5)(4,1)(4,2)(4,3)）').toBe(9);

    // 合法取回：色 1 的错位连通块 (0,5)-(1,5)-(1,4) ⇒ 整组 3 颗进托盘。
    expect(h.game.selectBoardBead(0, 5)).toBe(true);
    expect(h.game.retrieveSelectedGroup()).toBe(true);
    expect(h.game.tray.holdingCount).toBe(3);
    for (let s = 0; s < 3; s++) expect(h.game.tray.slot(s)!.colorIdx).toBe(1);
    const emptiesBefore = grid.fillableTotal - grid.filledCount;
    expect(emptiesBefore, '守恒：空格数 ≡ 托盘占用').toBe(3);
    const mBefore = grid.misplacedCount;

    expect(h.game.usePowerup('trayRestore')).toBe(true);
    const payload = h.last<{ traySlots: number[]; affectedCells: { row: number; col: number }[] }>(
      'powerup:used',
    )!;
    // §8-33(b)：清空槽数恒等于 t（旧缺陷这里给出 [0,1] 却只落 1 颗 ⇒ 本条先红）。
    expect(payload.traySlots, 'traySlots.length ≡ t').toEqual([0, 1, 2]);
    // §8-34(b) 落点判据：三个目标格互不重复。
    const keys = new Set(payload.affectedCells.map((c) => c.row * 1024 + c.col));
    expect(keys.size, 'affectedCells 无重复格（旧缺陷：三颗点同一格）').toBe(payload.affectedCells.length);
    expect(h.game.tray.holdingCount, '§8-33(a) 托盘占用恒为 0').toBe(0);
    for (const { row, col } of payload.affectedCells) {
      expect(grid.cell(row, col)!.beadColorIdx, `§8-34(a) (${row},${col}) 落点色 ≡ 该格要求色`).toBe(
        grid.requiredColor(row, col),
      );
    }
    expect(grid.misplacedCount, '§8-26(a) ΔM ≥ 0（旧缺陷全量实测 −6.91）').toBeLessThanOrEqual(mBefore);
    expect(mBefore - grid.misplacedCount, '本态 ΔM = +3（三颗全落对）').toBe(3);
    // §8-32(c) 口径（powerups-v2 **v2.7** 裁定后现文）：条数 ≡ **离槽颗数 `t`**、每份必带 `slot`；
    // ⛔ 不等于「新增就位格数 `t + ΔM`」（换出珠顺手落对的那 `ΔM` 格不产 placed）——本态 `t = 3`。
    expect(h.count('bead:placed'), '§8-32(c) bead:placed 条数 ≡ 离槽颗数 t（v2.7 现文）').toBe(3);
  });

  it('组选期间（托盘珠为 `selected`）点扫豆刷仍须生效 ⇒ 不得整次无效果', () => {
    const h = mk('wxgame.beads.test.s6-8-33-selected');
    const grid = h.game.grid;
    loadDupFixture(h);
    expect(h.game.selectBoardBead(0, 5)).toBe(true);
    expect(h.game.retrieveSelectedGroup()).toBe(true);
    // 点托盘同色块 ⇒ 整组转 `selected`（v2.2 组选；`Tray.holdingCount` 仍计入这些珠）。
    expect(h.game.selectTraySlot(0)).toBe(true);
    expect(h.game.tray.selectedCount).toBe(3);

    expect(
      h.game.usePowerup('trayRestore'),
      '旧实现只收 `holding` 槽 ⇒ 组选期间点名清单为空 ⇒ 整次无效果（不扣次但也不干活）',
    ).toBe(true);
    expect(h.game.tray.holdingCount, '§8-33(a) selected 珠同样要被清空').toBe(0);
    expect(grid.fillableTotal - grid.filledCount, '§8-33(a) 空格同步归零').toBe(0);
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
