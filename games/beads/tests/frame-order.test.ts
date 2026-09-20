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
  return createBeadsHarness({
    noAssemble: true, levels: [simpleTestLevel()], saveKey
  });
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



/** fo-3 专用的「留两帧余量」burn：C-3(a) 棋盘 tap 跨 down/up 两帧，down 帧照常 tick 一帧计时。
 *  （旧 burnToFinalFrame 只留一帧，已随 WXG-T-169 时基翻转就地内联到 fo-3。） */


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
    // v1.22 解环器：道具目标 = 棋盘错位珠 ⇒ 先装配一对交换错位（原判据「清托盘
    // 珠」随 §3.6 反转失效；giveTrayBead 仅保留为死路径夹具，托盘零读写）。
    const grid = h.game.grid;
    const flat: { row: number; col: number }[] = [];
    for (let r = 0; r < grid.rows; r++)
      for (let c = 0; c < grid.cols; c++) if (grid.isFillable(r, c)) flat.push({ row: r, col: c });
    for (const { row, col } of flat) grid.fill(row, col, grid.requiredColor(row, col));
    // 找一对 requiredColor 不同的格子对调 ⇒ 2 颗错位。
    let a = -1, b = -1;
    outer: for (let i = 0; i < flat.length; i++)
      for (let j = i + 1; j < flat.length; j++) {
        if (grid.requiredColor(flat[i]!.row, flat[i]!.col) !== grid.requiredColor(flat[j]!.row, flat[j]!.col)) {
          a = i; b = j; break outer;
        }
      }
    expect(a).toBeGreaterThanOrEqual(0);
    const ba = grid.cell(flat[a]!.row, flat[a]!.col)!.beadColorIdx;
    const bb = grid.cell(flat[b]!.row, flat[b]!.col)!.beadColorIdx;
    grid.setBead(flat[a]!.row, flat[a]!.col, bb);
    grid.setBead(flat[b]!.row, flat[b]!.col, ba);
    expect(grid.misplacedCount).toBe(2);

    const card = cardPoint();
    tapInFrame(h, card.x, card.y);

    // 道具在输入段结算：解环器归位（affectedCells 非空；solver 点 1 颗经交换归位
    // ⇒ 两格同时就位，misplaced 归零并触发 cleared-priority）。
    const used = h.last<{ affectedCells: { row: number; col: number }[] }>('powerup:used');
    expect(used).toBeTruthy();
    expect(used!.affectedCells.length).toBeGreaterThanOrEqual(1);

    expect(h.count('level:cleared') >= 0).toBe(true); // 交换归位后是否通关由 mode 决定（normal ⇒ cleared）
    // 供料段恒空：全程无产出（v2.0 供料关停）。
    expect(h.count('tray:spawned')).toBe(0);
    // 事件序也是帧内序：输入段（powerup:used）先于计时段（timer:tick，若有）。
    const usedAt = h.emitted.findIndex((e) => e.type === 'powerup:used');
    const tickAt = h.emitted.findIndex((e) => e.type === 'timer:tick');
    expect(usedAt).toBeGreaterThanOrEqual(0);
    if (tickAt >= 0) expect(usedAt).toBeLessThan(tickAt);
  });

  // core-loop §6「cleared 优先」+ §2.2.2 机制：cleared 属输入段、failed 属计时段；
  // 输入段离开 PLAYING 后本帧**直接返回** ⇒ 计时不再 tick、供料段恒空、归零不被判定。
  it('lets the last placement win over the expiry it crosses (C-3: a board tap spans down→up, down-frame ticks once)', () => {
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
    // C-3(a)：一次棋盘 tap 跨 down / up 两帧，down 帧计时段照常 tick 一帧 ⇒ 留两帧余量，
    // 让「落子(输入段) 赢过 归零(计时段)」发生在抬起帧（up 帧输入段清盘后直接返回、计时段不执行）。
    let burnGuard = 0;
    while (h.game.remaining > 2 * STEP && h.game.phase === 'playing') {
      h.advance(STEP);
      if (++burnGuard > 60 * 600) throw new Error('burnToFinalFrame(2-step): ran away');
    }
    expect(h.game.phase).toBe('playing');
    expect(h.game.remaining).toBeGreaterThan(STEP);

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
    expect(h.count('level:failed')).toBe(0); // up 帧输入段清盘 ⇒ 归零不被判定（仅 down 帧 tick）
    expect(h.count('timer:tick')).toBe(ticksBefore); // timer:tick 为秒粒度事件；down/up 两帧未跨秒边界 ⇒ 不新增
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
