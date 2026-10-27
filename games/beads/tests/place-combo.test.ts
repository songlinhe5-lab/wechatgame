/**
 * **归位连击（普通模式 · 纯感官）判据（WXG-T-434）**
 * ─────────────────────────────────────────────────────────────────────────────
 * 立单出处 = MVP 验收线「归位连击（纯感官渐强，零 HUD 数字）」（`concept §7` /
 * `systems-index-changelog` v1.23：用户 2026-09-16 拍板，提案 Q15）。
 *
 * 口径（本批冻结的落码口径，**零新常量**）：
 *  - 阈值/窗口**复用冲刺腿**：`COMBO_STREAK_TIERS`（§3.10 C3）+ `COMBO_WINDOW_S`（C2）；
 *  - ⛔ 不算分、不乘倍率 ⇒ `combo:up.multiplier` 恒 `1`；
 *  - ⛔ 不上 HUD ⇒ 快照 `multiplier` 恒 1、`streak` 恒 0（那是冲刺腿的计分通道）。
 *
 * 三层不混：本文件只证 **game 层**事件与快照（`[Node]`）；观感与真机档分别留 `[B]`/`[R]`。
 */
import { describe, it, expect } from 'vitest';
import { COMBO_STREAK_TIERS, COMBO_WINDOW_S } from '../src/config/tuning.js';
import { createBeadsHarness, placeColor, simpleTestLevel } from './helpers.js';

/**
 * 6×5 可填盘（`x` = 锁定、`.` = void）：够放 7 颗跨满三档而不触发过关。
 * ⚠ 格数下限 = `[6, 32] × [5, 32]`（关卡校验拦截），3×3 会被拒进 PLAYING。
 */
function mk(saveKey: string) {
  return createBeadsHarness({
    noAssemble: true,
    levels: [simpleTestLevel({ pattern: ['x23123', '123123', '123123', '12312.', '231231'] })],
    saveKey,
    // 体力闸门放行：`retryLevel()` 在 normal 模式下会问 `canStartRun`（否则本判据腿走不到重开）。
    canStartRun: () => true,
  });
}

/**
 * 逐格投放**正确**珠（`placeColor` 走 `giveTrayBead` 死路径 + `selectTraySlot` + `tapGridCell`）。
 * ⚠ 每颗后推进 1 帧 = **真人节奏**：归位连击有「同帧只响一次」守卫（防同帧批量落子挤占
 * `AudioScheduler.maxPerFrame`），同帧连放多颗会被合并成一次。
 */
function placeCorrect(h: ReturnType<typeof mk>, row: number, col: number): boolean {
  const ok = placeColor(h.game, h.game.grid.requiredColor(row, col), row, col);
  h.advance(1 / 60);
  return ok;
}

/** 可填格的行主序清单（跳过锁定 / void）。 */
function fillableCells(h: ReturnType<typeof mk>): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (let row = 0; row < h.game.grid.rows; row++) {
    for (let col = 0; col < h.game.grid.cols; col++) {
      if (h.game.grid.isFillable(row, col)) out.push({ row, col });
    }
  }
  return out;
}

describe('归位连击（普通模式 · 纯感官）', () => {
  it('档位 = COMBO_STREAK_TIERS 且 multiplier 恒 1（⛔ 不乘倍率）', () => {
    const h = mk('combo-tiers');
    const cells = fillableCells(h);
    const tiers: number[] = [];

    for (let i = 0; i < cells.length; i++) {
      const { row, col } = cells[i]!;
      expect(placeCorrect(h, row, col), `第 ${i + 1} 颗落子失败`).toBe(true);
      const ups = h.all<{ streak: number; multiplier: number; tier: number }>('combo:up');
      if (ups.length > tiers.length) {
        const last = ups[ups.length - 1]!;
        tiers.push(last.tier);
        expect(last.multiplier, '普通模式无倍率语义').toBe(1);
        expect(last.streak).toBe(COMBO_STREAK_TIERS[last.tier - 1]);
      }
    }

    // 连续正确落子跨满三档（阈值 2 / 4 / 7），且全程不断连。
    expect(tiers).toEqual([1, 2, 3]);
    expect(h.count('combo:break')).toBe(0);
  });

  it('⛔ 零 HUD 数字：快照 multiplier 恒 1、streak 恒 0（计分通道仍归冲刺）', () => {
    const h = mk('combo-hud');
    const cells = fillableCells(h);
    for (let i = 0; i < 5; i++) {
      const { row, col } = cells[i]!;
      placeCorrect(h, row, col);
      expect(h.game.snapshot.multiplier).toBe(1);
      expect(h.game.snapshot.streak).toBe(0);
    }
    expect(h.count('combo:up')).toBeGreaterThan(0); // 特效确实起了，但 HUD 不涨
  });

  it('错色落子 ⇒ combo:break(wrong)；无活跃 streak 时零事件', () => {
    const h = mk('combo-wrong');
    const cells = fillableCells(h);
    placeCorrect(h, cells[0]!.row, cells[0]!.col);
    placeCorrect(h, cells[1]!.row, cells[1]!.col);
    const before = h.count('combo:break');

    // 造一颗**错色**珠投到下一个可填格。
    const target = cells[2]!;
    const wrong = (h.game.grid.requiredColor(target.row, target.col) % 8) + 1;
    const slot = h.game.giveTrayBead(wrong);
    h.game.selectTraySlot(slot);
    h.game.tapGridCell(target.row, target.col);

    expect(h.count('combo:break')).toBe(before + 1);
    expect(h.last<{ reason: string }>('combo:break')?.reason).toBe('wrong');

    // 已断连 ⇒ 再错一次不得再发（无活跃 streak）。
    const slot2 = h.game.giveTrayBead(wrong);
    h.game.selectTraySlot(slot2);
    h.game.tapGridCell(target.row, target.col);
    expect(h.count('combo:break')).toBe(before + 1);
  });

  it('超窗 ⇒ combo:break(timeout)；未超窗不断连', () => {
    const h = mk('combo-timeout');
    const cells = fillableCells(h);
    placeCorrect(h, cells[0]!.row, cells[0]!.col);

    // 未超窗前推进 ⇒ 不断连（留 0.5 s 余量：`placeCorrect` 自己已推了 1 帧）。
    h.advance(COMBO_WINDOW_S - 0.5);
    expect(h.count('combo:break')).toBe(0);

    // 越窗 ⇒ timeout 断连恰一次（⛔ 不卡浮点边界：总推进 5.1 s > 窗口 5 s）。
    h.advance(0.6);
    expect(h.count('combo:break')).toBe(1);
    expect(h.last<{ reason: string }>('combo:break')?.reason).toBe('timeout');
  });

  it('重开本关 ⇒ 连击清零且**不发** combo:break（重开不是断连）', () => {
    const h = mk('combo-reset');
    const cells = fillableCells(h);
    placeCorrect(h, cells[0]!.row, cells[0]!.col);
    const breaks = h.count('combo:break');
    const ups = h.count('combo:up');

    // 重开本关（`goToLevel` 与 retry/restart 同走 `_setupLevel` ⇒ `_resetPlaceCombo`；
    // ⛔ 不用 `retryLevel()`：它要求相位 = `game-over`，且 normal 模式下还要过体力闸门）。
    h.game.goToLevel(0);
    expect(h.count('combo:break')).toBe(breaks);
    // 重开后从 streak 1 起算 ⇒ 第 2 颗才升 tier 1（第 1 颗不得发事件）。
    const after = fillableCells(h);
    placeCorrect(h, after[0]!.row, after[0]!.col);
    expect(h.count('combo:up')).toBe(ups);
    placeCorrect(h, after[1]!.row, after[1]!.col);
    expect(h.count('combo:up')).toBe(ups + 1);
  });
});
