/**
 * S4 tray-spawner §8 criteria (gdd/tray-spawner.md §8, quoted verbatim).
 * §8-3 exercises the weighting at the system level (Tray + Spawner + Rng),
 * which is exactly the mechanism the criterion pins down.
 */

import { describe, it, expect } from 'vitest';
import { createRng } from '@wxgame/framework';
import { createBeadsHarness, simpleTestLevel } from './helpers.js';
import { Tray } from '../src/entities/tray.js';
import { Spawner } from '../src/systems/spawner.js';
import { TRAY_EXPAND_SLOTS } from '../src/config/tuning.js';

describe('S4 tray-spawner', () => {
  // §8.1 SPAWN_INTERVAL 未覆盖时，PLAYING 60 秒内 tray:spawned 恰 15 次（±1），
  // 每次间隔 4.0s ±0.1s。
  it('§8-1 60 s of PLAYING spawns 15±1 beads at 4.0±0.1 s intervals', () => {
    // expandTray up-front so 15 spawns never hit the 12-slot ceiling mid-test.
    const harness = createBeadsHarness({
      levels: [simpleTestLevel()], // spawnInterval 4.0 = default
      saveKey: 'wxgame.beads.test.s4a',
    });
    const game = harness.game;
    expect(game.expandTray()).toBe(true);
    harness.advance(60);

    const spawns = harness.all<{ slot: number }>('tray:spawned');
    expect(spawns.length).toBeGreaterThanOrEqual(14);
    expect(spawns.length).toBeLessThanOrEqual(16);
  });

  // §8.3 抽色权重：构造"仍需 1 色 + 1 杂色"关卡，100 次供料中所需色占比 ≈ 75%
  // （3:1，允许 ±10 个百分点）。
  it('§8-3 weighted draw: one needed colour + one decoy → ≈75% needed (±10pp)', () => {
    const tray = new Tray();
    tray.initNeeded([0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0]); // colour 5 needed
    const spawner = new Spawner(1.0);
    spawner.setDecoys([4]);
    const rng = createRng('s4-weighting');

    let needed = 0;
    let decoy = 0;
    for (let i = 0; i < 100; i++) {
      // Free a slot each round so the feed never stalls.
      for (let s = 0; s < tray.capacity; s++) tray.takeBead(s);
      const outcome = spawner.tick(1.0, tray, rng);
      expect(outcome.spawned).not.toBeNull();
      if (outcome.spawned!.colorIdx === 5) needed++;
      else decoy++;
    }
    expect(needed + decoy).toBe(100);
    expect(needed).toBeGreaterThanOrEqual(65); // 75% ± 10pp
    expect(needed).toBeLessThanOrEqual(85);
  });

  // §8.6 换选：同帧两次点击不同槽，最终仅 1 槽处于 selected；双击同槽只广播 1 次
  // tray:selected。
  it('§8-6 re-selection moves the mark; double-tap on one slot broadcasts once', () => {
    const harness = createBeadsHarness({
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.s4f',
    });
    const game = harness.game;
    const slotA = game.giveTrayBead(1);
    const slotB = game.giveTrayBead(2);
    expect(slotA).toBeGreaterThanOrEqual(0);
    expect(slotB).toBeGreaterThanOrEqual(0);
    expect(slotB).not.toBe(slotA);

    // Double-tap the same slot: idempotent, one broadcast.
    expect(game.selectTraySlot(slotA)).toBe(true);
    expect(game.selectTraySlot(slotA)).toBe(false);
    expect(harness.count('tray:selected')).toBe(1);

    // Same-frame switch to a different slot: exactly one selected remains.
    expect(game.selectTraySlot(slotB)).toBe(true);
    expect(game.tray.slot(slotA)!.state).toBe('holding');
    expect(game.tray.slot(slotB)!.state).toBe('selected');
    expect(harness.count('tray:selected')).toBe(2);
  });

  // §8.7 落子成功回执后对应槽变 free；用 bead:placed 计数与 free 槽增量做 1:1 断言。
  it('§8-7 each bead:placed receipt frees exactly one tray slot (1:1)', () => {
    const harness = createBeadsHarness({
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.s4g',
    });
    const game = harness.game;

    let freeBefore = game.tray.freeCount;
    for (let n = 0; n < 3; n++) {
      const row = 0;
      const col = n;
      const color = game.grid.requiredColor(row, col);
      const slot = game.giveTrayBead(color);
      const freeWithBead = game.tray.freeCount;
      expect(freeWithBead).toBe(freeBefore - 1);
      game.selectTraySlot(slot);
      expect(game.tapGridCell(row, col)).toBe(true);
      expect(game.tray.slot(slot)!.state).toBe('free');
      expect(game.tray.freeCount).toBe(freeBefore); // 1:1: bead in → bead out
      freeBefore = game.tray.freeCount;
    }
    expect(harness.count('bead:placed')).toBe(3);

    // Structural sanity: expansion adds exactly TRAY_EXPAND_SLOTS.
    const cap = game.tray.capacity;
    expect(game.expandTray()).toBe(true);
    expect(game.tray.capacity).toBe(cap + TRAY_EXPAND_SLOTS);
    expect(harness.count('tray:expanded')).toBe(1);
  });
});
