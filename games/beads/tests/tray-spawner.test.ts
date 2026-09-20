/**
 * S4 tray-spawner criteria (gdd/tray-spawner.md §8).
 *
 * ⛔ v2.0（WXG-T-130 案 A / WXG-T-136 代码摘除）：定时供料关停——错位珠是珠子
 * 唯一供给，托盘为纯解谜缓冲。原 §8-1/2/4/9/10 已作废；本文件按 v2.0「改写替代
 * 判据」落码（§8-1 零供料反证、§8-4 满槽取回拒绝/无告警事件），并保留 `Spawner`
 * 类的**单元级死路径**测试（供料复活口径，复活时原文判据自动重新生效）。
 */

import { describe, it, expect } from 'vitest';
import { createRng } from '@wxgame/framework';
import { createBeadsHarness, simpleTestLevel, burnToRemaining } from './helpers.js';
import { Tray } from '../src/entities/tray.js';
import { Spawner } from '../src/systems/spawner.js';
import { TRAY_BASE_SLOTS, TRAY_EXPAND_SLOTS } from '../src/config/tuning.js';

describe('S4 tray-spawner', () => {
  // §8-1 v2.0 改写替代判据：进 PLAYING 后 60 s 内 `tray:spawned` 计数 === 0
  // （零供料反证；QA 不得按旧文把「零供料」判成缺陷）。连带钉住 `tray:full`
  // 同样零发射（systems-index §4 作废）与托盘恒空。
  it('§8-1 (v2.0 rewritten) 60 s of PLAYING emits zero spawns — zero-feed counter-proof', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.s4a',
    });
    harness.advance(60);

    expect(harness.count('tray:spawned')).toBe(0);
    expect(harness.count('tray:full')).toBe(0);
    expect(harness.game.tray.holdingCount).toBe(0); // 托盘初始全 free 且无供料
  });

  // GAP-02 v2.0 改写：进 PLAYING 首帧**零供料**（原「首帧立即供 1 颗」随供料作废；
  // 托盘开局全 free 是现行语义，tray-spawner v2.0 §2.1）。
  it('GAP-02 (v2.0 rewritten) the first PLAYING frames feed nothing; the tray starts empty', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.s4-firstfeed',
    });
    expect(harness.game.tray.holdingCount).toBe(0); // 开局空盘
    expect(harness.count('tray:spawned')).toBe(0);

    harness.advance(1 / 60);
    expect(harness.count('tray:spawned')).toBe(0);
    expect(harness.game.tray.holdingCount).toBe(0);

    harness.advance(1 / 60);
    expect(harness.count('tray:spawned')).toBe(0);
  });

  // timer-gameover v1.3 §2.4 + tray-spawner v2.0 §2.4：整关重置（失败重试）托盘
  // 清空、扩展回基线；重置后长跑仍零供料、零满槽事件。
  it('retry reset clears the tray and never spawns afterwards (v2.0 reset semantics)', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.s4-reset',
    });
    const game = harness.game;
    // 夹具：死路径塞珠 + 解锁扩展（重置应一并清掉）。
    expect(game.giveTrayBead(1)).toBeGreaterThanOrEqual(0);
    expect(game.giveTrayBead(2)).toBeGreaterThanOrEqual(0);
    expect(game.expandTray()).toBe(true);
    expect(game.tray.holdingCount).toBe(2);

    burnToRemaining(harness, 0);
    expect(game.phase).toBe('game-over');
    expect(game.retryLevel()).toBe(true);

    expect(game.tray.holdingCount).toBe(0); // 托盘清空
    expect(game.tray.expanded).toBe(false); // 扩展回基线
    expect(game.tray.freeCount).toBe(TRAY_BASE_SLOTS);

    harness.advance(10); // 远超任何历史供料间隔 ⇒ 无 spawn 复发
    // tray:spawned 总数 = 重置前夹具自发的 2 次（giveTrayBead 死路径）；重置后零增量。
    expect(harness.count('tray:spawned')).toBe(2);
    expect(harness.count('tray:full')).toBe(0);
  });

  // §8-4 v2.0 改写替代判据（满槽面）：满槽状态存在但只禁取回——长时间运行零
  // `tray:full`（无告警事件）；取回拒绝的零事件断言在 misplaced.test（E1/E2）。
  it('§8-4 (v2.0 rewritten) a full tray never broadcasts tray:full under long play', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.s4-full',
    });
    const game = harness.game;
    for (let i = 0; i < TRAY_BASE_SLOTS; i++) {
      expect(game.giveTrayBead(1)).toBeGreaterThanOrEqual(0);
    }
    expect(game.tray.freeCount).toBe(0);

    harness.advance(30); // 旧语义下满槽跳供必发 tray:full（去重 1 次）——现已零事件
    expect(harness.count('tray:full')).toBe(0);
    // tray:spawned 总数 = 夹具自发的 12 次（giveTrayBead 死路径）；长跑零供料增量。
    expect(harness.count('tray:spawned')).toBe(TRAY_BASE_SLOTS);
    expect(game.tray.holdingCount).toBe(TRAY_BASE_SLOTS); // 槽态零变化
  });

  // ─────────────────── 以下两例为 Spawner 类的单元级死路径锁定（供料复活口径）
  // GAP-06 A′（WXG-T-086）：供料侧不变量 `held ≤ demand`——某色持有量永不超过
  // 棋盘对该色的剩余需求；需求满后不再供该色，不堆无法落子的杂色→尾部不软锁。
  // ⛔ v2.0：主循环不再触发供料，本例仅锁定死路径类语义。
  it('GAP-06 A′ (dead-path unit) never holds more of a colour than the board demands', () => {
    const tray = new Tray();
    tray.initNeeded([0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0]); // 仅色 5 需要 2 颗
    const spawner = new Spawner(1.0);
    const rng = createRng('s4-demand');

    for (let i = 0; i < 40; i++) {
      spawner.tick(1.0, tray, rng);
      // 不变量：每色 held ≤ needed（未落子 ⇒ needed 恒为初值）。
      for (let c = 1; c <= 10; c++) {
        expect(tray.heldCount(c)).toBeLessThanOrEqual(tray.neededCount(c));
      }
    }
    // 停在 held=2，绝不溢出成 3；且除色 5 外无任何杂色被供出。
    expect(tray.heldCount(5)).toBe(2);
    expect(tray.holdingCount).toBe(2);
  });

  // §8.3（⛔ v2.0 维持作废——抽色机制随供料关停消失）：抽色权重死路径单元锁定：
  // 构造"仍需 1 色 + 1 杂色"，100 次供料中所需色占比 ≈ 75%（3:1，允许 ±10 个百分点）。
  it('§8-3 (dead-path unit) weighted draw: one needed colour + one decoy → ≈75% needed (±10pp)', () => {
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

  // §8-6（v2.2 组选改写，WXG-T-158 裁定②）：点 holding 珠 = 同色全组 selected
  // （payload `count` = 组珠数）；再点已选组任一颗 = 整组静默取消（零事件）；
  // 点他色 = 整组换选，同帧至多一色组被选。旧「双击同槽幂等⇒仅广播 1 次」作废。
  it('§8-6 group select / whole-group silent cancel / switch-select (v2.2)', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.s4f',
    });
    const game = harness.game;
    const slotA1 = game.giveTrayBead(1);
    const slotA2 = game.giveTrayBead(1); // 同色第二颗 ⇒ 归类同一块（裁定①不变式）
    const slotB = game.giveTrayBead(2);
    expect(slotA1).toBeGreaterThanOrEqual(0);
    expect(slotA2).toBeGreaterThanOrEqual(0);
    expect(slotB).toBeGreaterThanOrEqual(0);
    expect(game.tray.selectedCount).toBe(0);

    // 组选：点一次 ⇒ 该色全部 selected，`tray:selected {slot,colorIdx,count}` 恰 1 次。
    expect(game.selectTraySlot(slotA1)).toBe(true);
    expect(game.tray.slot(slotA1)!.state).toBe('selected');
    expect(game.tray.slot(slotA2)!.state).toBe('selected');
    expect(game.tray.slot(slotB)!.state).toBe('holding');
    const ev = harness.all<{ slot: number; colorIdx: number; count: number }>('tray:selected');
    expect(ev).toHaveLength(1);
    expect(ev[0]!.slot).toBe(slotA1);
    expect(ev[0]!.count).toBe(2);

    // 再点已选组另一颗 ⇒ 整组静默取消（零新广播，锚回 none）。
    expect(game.selectTraySlot(slotA2)).toBe(true);
    expect(game.tray.slot(slotA1)!.state).toBe('holding');
    expect(game.tray.slot(slotA2)!.state).toBe('holding');
    expect(harness.count('tray:selected')).toBe(1);
    expect(game.selection).toBe('none');

    // 换选：重新组选 A 后点他色 B ⇒ 整组换选，同帧至多一色组被选。
    expect(game.selectTraySlot(slotA1)).toBe(true);
    expect(game.selectTraySlot(slotB)).toBe(true);
    expect(harness.count('tray:selected')).toBe(3);
    expect(game.tray.slot(slotA1)!.state).toBe('holding');
    expect(game.tray.slot(slotA2)!.state).toBe('holding');
    expect(game.tray.slot(slotB)!.state).toBe('selected');
    expect(game.tray.selectedCount).toBe(1);
  });

  // §8.7 落子成功回执后对应槽变 free；用 bead:placed 计数与 free 槽增量做 1:1 断言。
  it('§8-7 each bead:placed receipt frees exactly one tray slot (1:1)', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
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
