/**
 * 帧内执行序判据（`core-loop.md §2.2.2`，WXG-T-061）。
 *
 * 为什么需要这个文件：`core-loop §6` / `tray-spawner §6` / `powerups §6` / `score-combo §6`
 * 里原本有一批以「事件**到达序** / 以**先到**为准」为基准的「同帧」条款 —— 在单线程固定步长
 * 循环里**不可观测**（一帧内没有先后事件，只有代码执行序），因此**不可测**。本轮把这些条款
 * 换成可观测基准：
 *
 *     输入（段内序：状态指令 → 玩法事件）→ 连击窗（仅冲刺）→ 供料 → 计时
 *
 * 本文件是那套基准的**可执行证明**：用真·同帧注入（`tapInFrame` 在 `beginFrame()` 之后、
 * `game.update()` 之前投递指针）钉住「段与段」以及「玩法事件段内序」的先后。
 *
 * ⚠️ 两处标定纪律（否则测试会假通过/假失败）：
 *  1. **供料帧号由探针实测**，不写死常数 —— ⚠ 累计 `1/60` 有浮点漂移，`240 × 1/60`
 *     求和略小于 4.0，供料实际落在**第 241 帧**。
 *  2. **`giveTrayBead()` 自己就发 `tray:spawned`** —— 计数断言必须用增量或对照，别把
 *     夹具的准备动作算成供料段的产出。
 */

import { describe, expect, it } from 'vitest';
import {
  GEAR_HIT_SIZE,
  HUD_BAND,
  PUZZLE_BAND,
  gridLayoutFor,
  powerupCardRects,
} from '../src/config/tuning.js';
import { createBeadsHarness, simpleTestLevel, tapInFrame, type Harness } from './helpers.js';

const STEP = 1 / 60;

function mk(saveKey: string): Harness {
  return createBeadsHarness({ levels: [simpleTestLevel()], saveKey });
}

function advanceFrames(harness: Harness, frames: number): void {
  for (let i = 0; i < frames; i++) harness.advance(STEP);
}

/** S6 道具卡 0（region）中心——命中区即绘制卡本身（§3.8）。 */
function cardPoint(): { x: number; y: number } {
  const card = powerupCardRects()[0]!;
  return { x: card.x + card.w / 2, y: card.bottom + card.h / 2 };
}

/** 齿轮热区中心（HUD 左端 TOUCH_MIN 方块，pause-settings §2.1）。 */
function gearPoint(): { x: number; y: number } {
  return { x: GEAR_HIT_SIZE / 2, y: (HUD_BAND.yMin + HUD_BAND.yMax) / 2 };
}

/** 网格格心（§3.3 派生）。 */
function cellPoint(harness: Harness, row: number, col: number): { x: number; y: number } {
  const layout = gridLayoutFor(harness.game.grid.cols, harness.game.grid.rows);
  return { x: layout.colCenterX(col), y: layout.rowCenterY(row) };
}

function heldSlots(harness: Harness): number[] {
  const out: number[] = [];
  for (let i = 0; i < harness.game.tray.capacity; i++) {
    if (harness.game.tray.slot(i)!.state !== 'free') out.push(i);
  }
  return out;
}

/**
 * 探针：在第几帧「若不注入输入就会供料」。同 seed/同关卡下确定 ⇒ 可作为标定基准，
 * 也让「对照组确实供料」与「实验组被抑制」构成真正的对照。
 */
function framesUntilSpawn(probe: Harness): number {
  const before = probe.count('tray:spawned');
  for (let frame = 1; frame <= 600; frame++) {
    probe.advance(STEP);
    if (probe.count('tray:spawned') > before) return frame;
  }
  throw new Error('探针：600 帧内没有供料');
}

/** 逼到「下一帧必归零」但**尚未**归零（手工逐帧，避免 overshoot 到 0）。 */
function burnToFinalFrame(harness: Harness): void {
  let guard = 0;
  while (harness.game.remaining > STEP && harness.game.phase === 'playing') {
    harness.advance(STEP);
    if (++guard > 60 * 600) throw new Error('burnToFinalFrame: ran away');
  }
  expect(harness.game.phase).toBe('playing');
  expect(harness.game.remaining).toBeGreaterThan(0);
  expect(harness.game.remaining).toBeLessThanOrEqual(STEP); // 下一帧必归零
}

describe('帧内执行序（core-loop §2.2.2）', () => {
  // core-loop §6「供料 tick 与暂停请求同帧」：输入段先于供料段 ⇒ 暂停生效、本帧不供料。
  it('processes a gear tap (input) before the feed in the same frame', () => {
    const spawnFrame = framesUntilSpawn(mk('wxgame.beads.test.fo-probe-1'));
    // 对照组：不注入输入时，第 spawnFrame 帧**确实**供料（否则本测试会假通过）。
    // GAP-02（WXG-T-086）后首颗珠在第 1 帧即供出，故下界放宽到 1；帧号仍由探针实测。
    expect(spawnFrame).toBeGreaterThanOrEqual(1);

    const h = mk('wxgame.beads.test.fo-1');
    advanceFrames(h, spawnFrame - 1);
    expect(h.count('tray:spawned')).toBe(0); // 边界没跑偏

    const gear = gearPoint();
    tapInFrame(h, gear.x, gear.y);

    expect(h.game.phase).toBe('paused'); // 输入段：暂停生效
    expect(h.count('game:paused')).toBe(1);
    expect(h.count('tray:spawned')).toBe(0); // 供料段本帧被抑制
  });

  // powerups §6「与供料同帧」：输入段（道具）恒先于供料段 ⇒ 本帧新珠**不被**该道具清除。
  it('runs a powerup (input) before the feed, so the fresh bead survives', () => {
    const spawnFrame = framesUntilSpawn(mk('wxgame.beads.test.fo-probe-2'));

    const h = mk('wxgame.beads.test.fo-2');
    h.game.giveTrayBead(1); // 槽 0 预置一颗（夹具动作，同时会发一次 tray:spawned）
    advanceFrames(h, spawnFrame - 1);
    const spawnsBefore = h.count('tray:spawned');

    const card = cardPoint();
    tapInFrame(h, card.x, card.y);

    // 道具先结算：清掉的是**旧**那顆；随后供料补 1 颗 ⇒ 帧末恰好 1 颗（新珠存活）。
    expect(h.last<{ affectedSlots: number[] }>('powerup:used')?.affectedSlots).toEqual([0]);
    expect(h.count('tray:spawned')).toBe(spawnsBefore + 1);
    expect(heldSlots(h)).toHaveLength(1);
    expect(heldSlots(h)).not.toContain(0); // 新珠落在别处 ⇒ 旧槽未被二次清除
    // 事件顺序也是帧内序：输入段（powerup:used）先于供料段（tray:spawned）。
    const usedAt = h.emitted.findIndex((e) => e.type === 'powerup:used');
    const spawnAt = h.emitted.map((e) => e.type).lastIndexOf('tray:spawned');
    expect(usedAt).toBeGreaterThanOrEqual(0);
    expect(usedAt).toBeLessThan(spawnAt);
  });

  // core-loop §6「cleared 优先」+ §2.2.2 机制：cleared 属输入段、failed 属计时段；
  // 输入段离开 PLAYING 后本帧**直接返回** ⇒ 计时不再 tick、供料不再执行、归零不被判定。
  it('lets the last placement win over a same-frame expiry, and never ticks the clock', () => {
    const h = mk('wxgame.beads.test.fo-3');
    const grid = h.game.grid;

    const fillable: { row: number; col: number }[] = [];
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (grid.isFillable(r, c)) fillable.push({ row: r, col: c });
      }
    }
    expect(fillable.length).toBe(30);
    const lastCell = fillable[fillable.length - 1]!;

    // 先逼到最后一帧（此时托盘已被供料塞满）→ 清空托盘再摆棋。
    burnToFinalFrame(h);
    expect(h.game.usePowerup('clearAll')).toBe(true);

    for (const { row, col } of fillable.slice(0, -1)) {
      const slot = h.game.giveTrayBead(grid.requiredColor(row, col));
      if (slot < 0) throw new Error(`tray full at (${row},${col})`);
      h.game.selectTraySlot(slot);
      if (!h.game.tapGridCell(row, col)) throw new Error(`place failed at (${row},${col})`);
    }
    expect(grid.filledCount).toBe(29);

    // 最后一格的珠子握在手里（选中），随后在同一帧内点下去。
    h.game.selectTraySlot(h.game.giveTrayBead(grid.requiredColor(lastCell.row, lastCell.col)));

    const spawnsBefore = h.count('tray:spawned');
    const ticksBefore = h.count('timer:tick');
    const point = cellPoint(h, lastCell.row, lastCell.col);
    tapInFrame(h, point.x, point.y);

    expect(h.game.phase).toBe('level-clear'); // 输入段：通关判定
    expect(h.count('level:cleared')).toBe(1);
    expect(h.count('level:failed')).toBe(0); // 计时段未执行 ⇒ 归零未被判定
    expect(h.count('timer:tick')).toBe(ticksBefore); // 本帧零 timer:tick
    expect(h.count('tray:spawned')).toBe(spawnsBefore); // 本帧零供料
    // 玩法事件段内序：落子回执恒先于通关判定。
    const placedAt = h.emitted.findIndex((e) => e.type === 'bead:placed');
    const clearedAt = h.emitted.findIndex((e) => e.type === 'level:cleared');
    expect(placedAt).toBeGreaterThanOrEqual(0);
    expect(placedAt).toBeLessThan(clearedAt);
  });

  // 帧内序的另一面：在「本帧到供料点」的那一帧里，供料段恒在计时段之前。
  it('orders the feed segment before the clock segment inside one frame', () => {
    const spawnFrame = framesUntilSpawn(mk('wxgame.beads.test.fo-probe-4'));

    const h = mk('wxgame.beads.test.fo-4');
    advanceFrames(h, spawnFrame - 1);
    const from = h.emitted.length;
    h.advance(STEP);
    const frame = h.emitted.slice(from).map((e) => e.type);

    expect(frame).toContain('tray:spawned');
    expect(frame).not.toContain('tray:selected'); // 本帧无输入 ⇒ 输入段零事件
    const spawnIdx = frame.indexOf('tray:spawned');
    const tickIdx = frame.indexOf('timer:tick');
    if (tickIdx >= 0) expect(spawnIdx).toBeLessThan(tickIdx); // 供料段先于计时段
    expect(PUZZLE_BAND.yMin).toBeLessThan(PUZZLE_BAND.yMax); // 常量自洽守卫
  });
});
