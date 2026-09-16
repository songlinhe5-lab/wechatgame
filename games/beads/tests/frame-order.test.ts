/**
 * 帧内执行序判据（`core-loop.md §2.2.2`，WXG-T-061；v2.0 供料关停修订 WXG-T-136）。
 *
 * 为什么需要这个文件：`core-loop §6` / `tray-spawner §6` / `powerups §6` / `score-combo §6`
 * 里原本有一批以「事件**到达序** / 以**先到**为准」为基准的「同帧」条款 —— 在单线程固定步长
 * 循环里**不可观测**（一帧内没有先后事件，只有代码执行序），因此**不可测**。本轮把这些条款
 * 换成可观测基准：
 *
 *     输入（段内序：状态指令 → 玩法事件）→ 连击窗（仅冲刺）→ [供料段：⛔ v2.0 恒空] → 计时
 *
 * 本文件是那套基准的**可执行证明**：用真·同帧注入（`tapInFrame` 在 `beginFrame()` 之后、
 * `game.update()` 之前投递指针）钉住「段与段」以及「玩法事件段内序」的先后。
 *
 * ⚠️ 标定纪律（WXG-T-136 修订）：供料段已随 v2.0 定时供料关停而**恒空**——`tray:spawned`
 * / `tray:full` 全程零发射。凡需要托盘珠的夹具一律走 `giveTrayBead()`（死路径，自己会发
 * 一次 `tray:spawned`）——计数断言必须用增量或对照，别把夹具准备动作算成供料段产出。
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
  // core-loop §6「暂停请求同帧」：输入段恒先于计时段 ⇒ 暂停生效、本帧 dt 不计入倒计时；
  // 供料段恒空（v2.0）⇒ 全程零 tray:spawned。
  it('processes a gear tap (input) before the clock in the same frame; the feed segment stays empty', () => {
    const h = mk('wxgame.beads.test.fo-1');

    const gear = gearPoint();
    tapInFrame(h, gear.x, gear.y);

    expect(h.game.phase).toBe('paused'); // 输入段：暂停生效
    expect(h.count('game:paused')).toBe(1);
    expect(h.count('tray:spawned')).toBe(0); // 供料段恒空（v2.0）
    expect(h.game.remaining).toBe(simpleTestLevel().time); // 暂停帧 dt 未计入倒计时
  });

  // powerups §6「输入段恒先于计时段」：同帧点道具，结算先于计时；供料段恒空。
  it('runs a powerup (input) before the clock in the same frame (feed segment is dead)', () => {
    const h = mk('wxgame.beads.test.fo-2');
    h.game.giveTrayBead(1); // 槽 0 预置一颗（死路径夹具，同发一次 tray:spawned）

    const card = cardPoint();
    tapInFrame(h, card.x, card.y);

    // 道具在输入段结算：清掉预置的那颗 ⇒ 帧末托盘空。
    expect(h.last<{ affectedSlots: number[] }>('powerup:used')?.affectedSlots).toEqual([0]);
    expect(heldSlots(h)).toHaveLength(0);
    // 供料段恒空：全程只有夹具那一次 tray:spawned，帧内无产出。
    expect(h.count('tray:spawned')).toBe(1);
    // 事件序也是帧内序：输入段（powerup:used）先于计时段（timer:tick，若有）。
    const usedAt = h.emitted.findIndex((e) => e.type === 'powerup:used');
    const tickAt = h.emitted.findIndex((e) => e.type === 'timer:tick');
    expect(usedAt).toBeGreaterThanOrEqual(0);
    if (tickAt >= 0) expect(usedAt).toBeLessThan(tickAt);
  });

  // core-loop §6「cleared 优先」+ §2.2.2 机制：cleared 属输入段、failed 属计时段；
  // 输入段离开 PLAYING 后本帧**直接返回** ⇒ 计时不再 tick、供料段恒空、归零不被判定。
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

    // v2.0：供料关停 ⇒ 无「托盘被供料塞满」前置，也无需 clearAll——夹具直接摆棋。
    burnToFinalFrame(h);

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
    expect(h.count('tray:spawned')).toBe(spawnsBefore); // 本帧零供料（供料段恒空）
    // 玩法事件段内序：落子回执恒先于通关判定。
    const placedAt = h.emitted.findIndex((e) => e.type === 'bead:placed');
    const clearedAt = h.emitted.findIndex((e) => e.type === 'level:cleared');
    expect(placedAt).toBeGreaterThanOrEqual(0);
    expect(placedAt).toBeLessThan(clearedAt);
  });

  // 帧内序的另一面（v2.0）：PLAYING 帧里供料段**恒空**，计时段照常推进。
  it('keeps the feed segment empty while the clock segment still runs inside one frame', () => {
    const h = mk('wxgame.beads.test.fo-4');
    const from = h.emitted.length;
    h.advance(STEP);
    const frame = h.emitted.slice(from).map((e) => e.type);

    expect(frame).not.toContain('tray:spawned'); // 供料段恒空（v2.0 零供料）
    expect(frame).not.toContain('tray:full'); // 连带：满槽告警事件零发射
    expect(frame).not.toContain('tray:selected'); // 本帧无输入 ⇒ 输入段零事件
    expect(h.game.remaining).toBeLessThan(simpleTestLevel().time); // 计时段仍推进
    expect(PUZZLE_BAND.yMin).toBeLessThan(PUZZLE_BAND.yMax); // 常量自洽守卫
  });
});
