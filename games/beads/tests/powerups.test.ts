/**
 * S6 道具系统判据（`design/gdd/powerups.md` §8 十条，逐条一个 test）。
 *
 * 纪律（与其余 beads 套件同）：判据只**引用** GDD §8 既有条目，不发明新判据；
 * 每条断言都能在纯 Node（vitest）下硬判定。角标视觉项明确标 `[DevTools]`，
 * 本套件断言的是它的**事件学**——零事件、零扣次、零广告 API 调用。
 *
 * ⚠️ 两条测试基建事实（踩过才知道，写下来防复发）：
 *  1. **一律用 `simpleTestLevel()`**（6×5、三色、`spawnInterval 4.0`、`(0,0)` 是可填格）。
 *     出货关卡 1 是 `spawnInterval 6` 且首行含 `.`/`x` —— 用它测供料恢复会静默失败。
 *  2. **§8-4 已由「偏差 ≤ ±20%」改为卡方检验**（WXG-T-062 裁定，df = 11、α = 0.01、
 *     临界 24.725）：原容差在统计上偏紧 —— 12 槽族的极大偏差期望本身就有 ≈20–24%
 *     （单槽 σ ≈ 11%），约一半概率误报。卡方与 seed 无关，故此处 seed 只求「可复现」。
 */

import { describe, expect, it } from 'vitest';
import { createRng, type RewardedAdProvider } from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import {
  AD_PLACEMENTS,
  POWERUP_FREE_USES,
  POWERUP_TYPES,
  RANDOM_CLEAR_COUNT,
  REGION_CLEAR_SLOTS,
  TRAY_BASE_SLOTS,
  TRAY_EXPAND_SLOTS,
  type PowerupType,
} from '../src/config/tuning.js';
import { PowerupSystem } from '../src/systems/powerups.js';
import type { BeadGrid } from '../src/entities/grid.js';
import {
  burnToRemaining,
  createBeadsHarness,
  placeColor,
  simpleTestLevel,
  type Harness,
  type HarnessOptions,
} from './helpers.js';

type UsedPayload = { type: string; affectedSlots: readonly number[] };

/** χ² 临界值（df = 11、α = 0.01）—— `powerups.md §8-4` 的判据阈值。 */
const CHI_SQUARE_DF11_ALPHA001 = 24.725;

// ─────────────────────────────────────────────────────────────────── helpers

/** S6 专用 harness：一律用 6×5 三色测试关（见文件头第 1 条）。 */
function mk(saveKey: string, extra: HarnessOptions = {}): Harness {
  return createBeadsHarness({ levels: [simpleTestLevel()], saveKey, ...extra });
}

/** Put `n` beads into the low slots (the S4 give-path fills left to right). */
function hold(harness: Harness, n: number): void {
  for (let i = 0; i < n; i++) harness.game.giveTrayBead(1 + (i % 3));
}

/** Slot indices currently holding a bead (ascending). */
function heldSlots(harness: Harness): number[] {
  const out: number[] = [];
  for (let i = 0; i < harness.game.tray.capacity; i++) {
    if (harness.game.tray.slot(i)!.state !== 'free') out.push(i);
  }
  return out;
}

/** Grid cell census — S6 must never move any of these three numbers (§8-7). */
function gridCensus(grid: BeadGrid): { filled: number; empty: number; locked: number } {
  const out = { filled: 0, empty: 0, locked: 0 };
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cell(r, c)!;
      if (cell.void) continue;
      out[cell.state] += 1;
    }
  }
  return out;
}

/**
 * Fill every fillable cell with its required colour — deterministic, and it
 * never depends on the spawner. Driving PLAYING → LEVEL_CLEAR (or FINISH).
 */
function clearBoard(harness: Harness): void {
  const grid = harness.game.grid;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!grid.isFillable(r, c)) continue;
      const slot = harness.game.giveTrayBead(grid.requiredColor(r, c));
      if (slot < 0) throw new Error(`tray full while clearing (${r},${c})`);
      if (!harness.game.selectTraySlot(slot)) throw new Error(`select failed (${r},${c})`);
      if (!harness.game.tapGridCell(r, c)) throw new Error(`place failed (${r},${c})`);
    }
  }
}

/** Count every call into a `RewardedAdProvider` (§8-8「零广告 API 调用」). */
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

// ─────────────────────────────────────────────────────────────── 常量镜像 §3.6

describe('S6 §3.6 常量镜像', () => {
  it('mirrors the frozen §3.6 values', () => {
    expect(POWERUP_TYPES).toEqual(['region', 'clearAll', 'random']);
    expect(REGION_CLEAR_SLOTS).toBe(6);
    expect(RANDOM_CLEAR_COUNT).toBe(5);
    expect(POWERUP_FREE_USES).toBe(1);
    expect(AD_PLACEMENTS).toBe(4); // 3 道具 + 扩展：布局 A 全为角标占位
  });
});

// ───────────────────────────────────────────────────────────────────── §8-1

describe('S6 §8-1 region 窗口恒长与集合正确', () => {
  it('clears a contiguous REGION_CLEAR_SLOTS window and matches S4 1:1', () => {
    const h = mk('wxgame.beads.test.s6-1');
    hold(h, 8); // 槽 0..7，无选中
    expect(h.game.usePowerup('region')).toBe(true);

    expect(h.count('powerup:used')).toBe(1);
    const payload = h.last<UsedPayload>('powerup:used')!;
    expect(payload.type).toBe('region');
    // 无选中 ⇒ 锚点 = 线性索引最小的 holding 槽（0）⇒ 窗口 [0,5]，恒长。
    expect(payload.affectedSlots).toEqual([0, 1, 2, 3, 4, 5]);
    expect(payload.affectedSlots).toHaveLength(REGION_CLEAR_SLOTS);
    // 1:1：点名的槽全 free，窗口外的 holding 逐一不变（联合 S4§8-10）。
    expect(heldSlots(h)).toEqual([6, 7]);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-2

describe('S6 §8-2 region 锚点规则', () => {
  it('centres on the selected slot, else on the lowest holding slot', () => {
    const noSel = mk('wxgame.beads.test.s6-2a');
    hold(noSel, 8);
    expect(noSel.game.tray.selectedSlot).toBe(-1);
    expect(noSel.game.usePowerup('region')).toBe(true);
    expect(noSel.last<UsedPayload>('powerup:used')!.affectedSlots).toEqual([0, 1, 2, 3, 4, 5]);

    const sel = mk('wxgame.beads.test.s6-2b');
    hold(sel, 8);
    expect(sel.game.selectTraySlot(6)).toBe(true);
    expect(sel.game.usePowerup('region')).toBe(true);
    // 锚点 6 ⇒ from = 6 − floor((6−1)/2) = 4 ⇒ 窗口 [4,9] ∩ holding(0..7) = [4,5,6,7]。
    expect(sel.last<UsedPayload>('powerup:used')!.affectedSlots).toEqual([4, 5, 6, 7]);
    // 选中槽被清除 ⇒ 选中态一并清除（S4 §2.4）。
    expect(sel.game.tray.selectedSlot).toBe(-1);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-3

describe('S6 §8-3 region 钳制与跨行', () => {
  it('keeps the window length at both capacity ends', () => {
    const head = mk('wxgame.beads.test.s6-3a');
    hold(head, TRAY_BASE_SLOTS);
    expect(head.game.selectTraySlot(0)).toBe(true);
    expect(head.game.usePowerup('region')).toBe(true);
    expect(head.last<UsedPayload>('powerup:used')!.affectedSlots).toEqual([0, 1, 2, 3, 4, 5]);

    const tail = mk('wxgame.beads.test.s6-3b');
    hold(tail, TRAY_BASE_SLOTS);
    expect(tail.game.selectTraySlot(TRAY_BASE_SLOTS - 1)).toBe(true);
    expect(tail.game.usePowerup('region')).toBe(true);
    const slots = tail.last<UsedPayload>('powerup:used')!.affectedSlots;
    expect(slots).toHaveLength(REGION_CLEAR_SLOTS);
    expect(slots[slots.length - 1]).toBe(TRAY_BASE_SLOTS - 1);
    expect(slots.every((i) => i >= 0 && i < TRAY_BASE_SLOTS)).toBe(true);
  });

  it('crosses the baseline/expansion row boundary without truncating', () => {
    const h = mk('wxgame.beads.test.s6-3c');
    expect(h.game.expandTray()).toBe(true); // 容量 = 12 + 12
    hold(h, 14); // 槽 0..13
    expect(h.game.selectTraySlot(TRAY_BASE_SLOTS - 1)).toBe(true);
    expect(h.game.usePowerup('region')).toBe(true);
    // from = 11 − 2 = 9 ⇒ 窗口 [9,14] ∩ holding = [9,10,11,12,13] —— 跨 11|12 行界不截断。
    expect(h.last<UsedPayload>('powerup:used')!.affectedSlots).toEqual([9, 10, 11, 12, 13]);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-4

describe('S6 §8-4 random 唯一随机源', () => {
  /** `times` 次抽取（每次重置免费次数；镜像在抽取后重新补满）。 */
  function draw(seed: string, times: number): number[][] {
    const sys = new PowerupSystem();
    sys.attach(createRng(seed));
    const out: number[][] = [];
    for (let t = 0; t < times; t++) {
      sys.restoreUses({ random: 0 });
      for (let i = 0; i < TRAY_BASE_SLOTS; i++) sys.noteSpawned(i);
      const result = sys.request('random');
      if (result.kind !== 'used') throw new Error(`random 未生效：${result.kind}`);
      out.push([...result.affectedSlots]);
    }
    return out;
  }

  it('is deterministic per seed and chi-square uniform over 200 draws', () => {
    expect(draw('s6-uniform', 5)).toEqual(draw('s6-uniform', 5));

    const counts = new Array<number>(TRAY_BASE_SLOTS).fill(0);
    for (const slots of draw('s6-uniform', 200)) {
      expect(slots).toHaveLength(RANDOM_CLEAR_COUNT);
      expect(new Set(slots).size).toBe(RANDOM_CLEAR_COUNT); // 无放回
      for (const slot of slots) counts[slot] += 1;
    }
    // §8-4（WXG-T-062 修订）：200 次 × 5 颗 = 1000 次抽取 / 12 槽 ⇒ 每槽期望 83.3；
    // 卡方统计量 < 临界 24.725（df = 11、α = 0.01）即与均匀分布无显著差异。
    const expected = (200 * RANDOM_CLEAR_COUNT) / TRAY_BASE_SLOTS;
    const chiSquare = counts.reduce((sum, n) => sum + (n - expected) ** 2 / expected, 0);
    expect(chiSquare).toBeLessThan(CHI_SQUARE_DF11_ALPHA001);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-5

describe('S6 §8-5 random 不足数不补抽', () => {
  it('removes everything it has and never conjures a bead', () => {
    const three = mk('wxgame.beads.test.s6-5a');
    hold(three, 3);
    expect(three.game.usePowerup('random')).toBe(true);
    expect(three.count('powerup:used')).toBe(1);
    expect(three.last<UsedPayload>('powerup:used')!.affectedSlots).toHaveLength(3);
    expect(heldSlots(three)).toEqual([]);

    const one = mk('wxgame.beads.test.s6-5b');
    hold(one, 1);
    expect(one.game.usePowerup('random')).toBe(true);
    expect(one.last<UsedPayload>('powerup:used')!.affectedSlots).toHaveLength(1);
    expect(heldSlots(one)).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-6

describe('S6 §8-6 clearAll 全容量清槽', () => {
  it('clears every held slot (incl. selected) and feeding resumes in ≤1 interval', () => {
    const base = mk('wxgame.beads.test.s6-6a');
    hold(base, TRAY_BASE_SLOTS);
    expect(base.game.selectTraySlot(3)).toBe(true);
    const spawnedBefore = base.count('tray:spawned');
    expect(base.game.usePowerup('clearAll')).toBe(true);
    expect(base.last<UsedPayload>('powerup:used')!.affectedSlots).toHaveLength(TRAY_BASE_SLOTS);
    expect(heldSlots(base)).toEqual([]);
    expect(base.game.tray.selectedSlot).toBe(-1);
    base.advance(4.2); // ≤ 1 个 SPAWN_INTERVAL（测试关 = 4.0s）
    expect(base.count('tray:spawned')).toBeGreaterThan(spawnedBefore); // 联合 S1§8-3

    const wide = mk('wxgame.beads.test.s6-6b');
    expect(wide.game.expandTray()).toBe(true);
    hold(wide, 14);
    expect(wide.game.usePowerup('clearAll')).toBe(true);
    expect(wide.last<UsedPayload>('powerup:used')!.affectedSlots).toHaveLength(14);
    expect(heldSlots(wide)).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-7

describe('S6 §8-7 零网格写入', () => {
  it('leaves the grid census and the S3 event counters untouched', () => {
    const h = mk('wxgame.beads.test.s6-7');
    const before = gridCensus(h.game.grid);

    hold(h, 6);
    expect(h.game.usePowerup('region')).toBe(true);
    hold(h, 6);
    expect(h.game.usePowerup('clearAll')).toBe(true);
    hold(h, 6);
    expect(h.game.usePowerup('random')).toBe(true);

    expect(h.count('powerup:used')).toBe(3);
    expect(gridCensus(h.game.grid)).toEqual(before);
    // 对齐 S3§8-6：网格不可回退，S6 绝不调用 S3。
    expect(h.count('bead:placed')).toBe(0);
    expect(h.count('bead:rejected')).toBe(0);
    expect(h.game.grid.filledCount).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-8

describe('S6 §8-8 免费次数、超限占位与重置', () => {
  it('keeps counters independent, badges the over-limit tap, resets on retry', () => {
    const spy = adSpy();
    const h = mk('wxgame.beads.test.s6-8', { rewardedAd: spy.provider });

    // 三计数互相独立：每次用前重新给珠，三个道具各成功一次。
    hold(h, TRAY_BASE_SLOTS);
    expect(h.game.usePowerup('region')).toBe(true);
    hold(h, TRAY_BASE_SLOTS);
    expect(h.game.usePowerup('clearAll')).toBe(true);
    hold(h, TRAY_BASE_SLOTS);
    expect(h.game.usePowerup('random')).toBe(true);
    expect(h.count('powerup:used')).toBe(3);
    expect(h.game.powerups.usedCount).toBe(3);
    for (const type of POWERUP_TYPES) expect(h.game.powerups.freeUses(type)).toBe(0);

    // 超限：零事件、零槽变化、零扣次，仅占位轻提示（§2.6 布局 A）。
    hold(h, 6);
    const before = heldSlots(h);
    expect(h.game.usePowerup('region')).toBe(false);
    expect(h.count('powerup:used')).toBe(3);
    expect(heldSlots(h)).toEqual(before);
    expect(h.game.powerups.freeUses('region')).toBe(0);
    expect(h.game.powerupHint).toBe('即将开放');
    // 全程零广告**拉起**：`onRewarded`/`onClose`/`onError` 是 T-058 为失败页续时做的
    // 一次性监听注册（初始化即发生，合法），§8-8 要的是**不 load、不 show**。
    expect(spy.calls.filter((c) => c === 'load' || c === 'show')).toEqual([]);

    // 整关重置（失败重试）：三计数回 FREE + 扩展复位（联合 S5§8-6）。
    expect(h.game.expandTray()).toBe(true);
    burnToRemaining(h, 0);
    expect(h.game.phase).toBe('game-over');
    expect(h.game.retryLevel()).toBe(true);
    for (const type of POWERUP_TYPES) expect(h.game.powerups.freeUses(type)).toBe(POWERUP_FREE_USES);
    expect(h.game.tray.expanded).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────── §8-9

describe('S6 §8-9 空作用 / 非法 type / 状态门禁', () => {
  it('treats an empty scope as a no-op and never charges a use', () => {
    const h = mk('wxgame.beads.test.s6-9a');
    expect(h.game.usePowerup('region')).toBe(false);
    expect(h.count('powerup:used')).toBe(0);
    expect(h.game.powerups.freeUses('region')).toBe(POWERUP_FREE_USES); // §2.3 已裁定：拒用不扣
  });

  it('ignores an unknown type without crashing', () => {
    const h = mk('wxgame.beads.test.s6-9b');
    hold(h, 4);
    expect(h.game.usePowerup('nope' as PowerupType)).toBe(false);
    expect(h.count('powerup:used')).toBe(0);
    expect(h.game.powerups.usedCount).toBe(0);
  });

  it('ignores requests in PAUSED / LEVEL_CLEAR / GAME_OVER / FINISH', () => {
    const paused = mk('wxgame.beads.test.s6-9c');
    hold(paused, 4);
    paused.game.onPause();
    expect(paused.game.phase).toBe('paused');
    expect(paused.game.usePowerup('clearAll')).toBe(false);
    expect(paused.count('powerup:used')).toBe(0);

    const clearing = mk('wxgame.beads.test.s6-9d');
    clearBoard(clearing);
    expect(clearing.game.phase).toBe('level-clear');
    hold(clearing, 2);
    expect(clearing.game.usePowerup('clearAll')).toBe(false);
    expect(clearing.count('powerup:used')).toBe(0);

    const over = mk('wxgame.beads.test.s6-9e');
    hold(over, 4);
    burnToRemaining(over, 0);
    expect(over.game.phase).toBe('game-over');
    expect(over.game.usePowerup('region')).toBe(false);
    expect(over.count('powerup:used')).toBe(0);

    const done = mk('wxgame.beads.test.s6-9f'); // 单关表 ⇒ 过关后进 FINISH
    clearBoard(done);
    expect(done.game.phase).toBe('level-clear');
    done.advance(1.5);
    expect(done.game.phase).toBe('finish');
    hold(done, 2);
    expect(done.game.usePowerup('clearAll')).toBe(false);
    expect(done.count('powerup:used')).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────── §8-10

describe('S6 §8-10 同帧竞态守恒', () => {
  it('serialises against a same-frame spawn: the fresh bead is included', () => {
    const h = mk('wxgame.beads.test.s6-10a');
    hold(h, 5);
    h.advance(4.05); // 本帧供料 1 颗（供料先到；测试关间隔 4.0s）
    expect(heldSlots(h)).toHaveLength(6);
    expect(h.game.usePowerup('clearAll')).toBe(true);
    expect(h.last<UsedPayload>('powerup:used')!.affectedSlots).toHaveLength(6);
    expect(heldSlots(h)).toEqual([]);
    expect(h.count('powerup:used')).toBe(1);
    expect(h.game.powerups.usedCount).toBe(1);
  });

  it('treats a bead that already left the tray as an empty scope', () => {
    const h = mk('wxgame.beads.test.s6-10b');
    expect(placeColor(h.game, 1, 0, 0)).toBe(true); // 落子先到 ⇒ 槽 0 已 free
    expect(h.game.usePowerup('clearAll')).toBe(false);
    expect(h.count('powerup:used')).toBe(0);
    expect(h.game.powerups.freeUses('clearAll')).toBe(POWERUP_FREE_USES);
  });

  it('interprets the window against the post-expansion capacity', () => {
    const h = mk('wxgame.beads.test.s6-10c');
    hold(h, 8);
    expect(h.game.expandTray()).toBe(true); // 同帧先扩容
    expect(h.game.selectTraySlot(7)).toBe(true);
    expect(h.game.usePowerup('region')).toBe(true);
    const slots = h.last<UsedPayload>('powerup:used')!.affectedSlots;
    expect(slots).toEqual([5, 6, 7]);
    expect(slots.every((i) => i >= 0 && i < TRAY_BASE_SLOTS + TRAY_EXPAND_SLOTS)).toBe(true);
    expect(h.count('powerup:used')).toBe(1); // 无同槽二次清除、无重复计数
  });
});
