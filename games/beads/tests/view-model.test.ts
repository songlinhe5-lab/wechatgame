/**
 * `view/view-model.ts` — 快照 → 绘制指令（control-manifest §8：只读、每帧重建、可复现）。
 *
 * Why this file exists: the 392-line view model had **no test at all** while breakout's
 * equivalent (`tests/view-model.test.ts`) did. Two things matter here and neither is
 * visible from the harness: the model must not mutate game state, and the symbol
 * channel must reach **every** filled cell (not just some).
 */

import { describe, it, expect } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import {
  BEAD_CELL,
  DESIGN_H,
  DESIGN_W,
  POWERUP_BAND,
  POWERUP_CARD_H,
  POWERUP_CARD_W,
  POWERUP_LABEL_H,
  PUZZLE_BAND,
  TOUCH_MIN,
  powerupCardRects,
  powerupLabelY,
} from '../src/config/tuning.js';
import { POWERUP_LABELS } from '../src/systems/powerups.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { createBeadsHarness, placeColor, simpleTestLevel, type Harness } from './helpers.js';
import type { BeadsSnapshot } from '../src/game/state.js';

function render(harness: Harness): readonly DrawCommand[] {
  const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
  builder.begin();
  buildBeadsView(builder, harness.game.snapshot, DEFAULT_PALETTE);
  return builder.end().commands;
}

/**
 * Per-symbol signatures. The three colours of `simpleTestLevel()` are the only
 * symbols the model can contain, and each has a primitive no chrome uses:
 *   ○ 奶白 → the only stroke-only circle
 *   ★ 柠黄 → the only polygon at all (chrome draws rect/circle/line/text)
 *   ● 活力橙 → a filled circle of exactly r = 11 × BEAD/64 (no stroke)
 */
const isRingSymbol = (cmd: DrawCommand): boolean =>
  cmd.kind === 'circle' && cmd.stroke !== undefined && cmd.fill === undefined;
const isStarSymbol = (cmd: DrawCommand): boolean =>
  cmd.kind === 'polygon' && cmd.points.length === 20;
const isDotSymbol = (cmd: DrawCommand): boolean =>
  cmd.kind === 'circle' &&
  cmd.stroke === undefined &&
  cmd.fill !== undefined &&
  Math.abs(cmd.r - (11 * BEAD_CELL) / 64) < 0.01;

/** Vertical centre of a command (polygons have no centre field ⇒ vertex mean). */
function centreY(cmd: DrawCommand): number {
  if (cmd.kind === 'circle' || cmd.kind === 'text') return cmd.y;
  if (cmd.kind === 'rect') return cmd.y + cmd.h / 2;
  if (cmd.kind === 'line') return (cmd.y1 + cmd.y2) / 2;
  if (cmd.kind === 'polygon') {
    const ys = cmd.points.filter((_, i) => i % 2 === 1);
    return ys.reduce((a, b) => a + b, 0) / ys.length;
  }
  return Number.NaN;
}

/**
 * Bead symbols only ever appear **inside the puzzle band**. Needed since S6
 * (WXG-T-060): the 魔法棒 card draws its own 5-point star — the same primitive
 * as the bead ★ — so an unscoped signature would count powerup chrome as beads.
 */
const onBoard = (cmd: DrawCommand): boolean => {
  const y = centreY(cmd);
  return y >= PUZZLE_BAND.yMin && y <= PUZZLE_BAND.yMax;
};

/** Fill a level completely, one matching bead at a time. */
function fillBoard(harness: Harness): number {
  const { game } = harness;
  let placed = 0;
  for (let row = 0; row < game.grid.rows; row++) {
    for (let col = 0; col < game.grid.cols; col++) {
      if (placeColor(game, game.grid.requiredColor(row, col), row, col)) placed++;
    }
  }
  return placed;
}

describe('beads view model (control-manifest §8)', () => {
  // §8：同一快照渲染两次必须逐字节相同 —— 视图是快照的纯函数。
  it('§8 renders the same snapshot to identical commands', () => {
    const harness = createBeadsHarness({
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.vm-a',
    });
    expect(render(harness)).toEqual(render(harness));
  });

  // §8：UI/渲染层不持有游戏状态 —— 渲染不得写回快照。
  it('§8 never mutates the snapshot it renders', () => {
    const harness = createBeadsHarness({
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.vm-b',
    });
    const before = JSON.stringify(harness.game.snapshot);
    render(harness);
    render(harness);
    expect(JSON.stringify(harness.game.snapshot)).toBe(before);
  });

  // accessibility A1 的落地断言：L5 符号通道必须覆盖**每一个**已填格，而不是抽样。
  it('A1 draws the L5 symbol for every filled cell and none for empty ones', () => {
    const harness = createBeadsHarness({
      levels: [simpleTestLevel()], // 3 colours ⇒ validator-legal; '123123' × 5 rows
      saveKey: 'wxgame.beads.test.vm-c',
    });
    const filled = fillBoard(harness);
    expect(filled).toBe(30);
    expect(harness.game.grid.filledCount).toBe(30);

    const commands = render(harness);
    // 30 格 = 10 个 ''1'' + 10 个 ''2'' + 10 个 ''3''，每色各 10 颗 → 10/10/10 个符号。
    expect(commands.filter((c) => onBoard(c) && isRingSymbol(c))).toHaveLength(10);
    expect(commands.filter((c) => onBoard(c) && isStarSymbol(c))).toHaveLength(10);
    expect(commands.filter((c) => onBoard(c) && isDotSymbol(c))).toHaveLength(10);
  });

  // A3 灰度可辨：符号数是「已填格数」的函数，与颜色无关；空格不得带符号。
  it('A3 keeps exactly one symbol per filled cell as the board fills up', () => {
    const harness = createBeadsHarness({
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.vm-d',
    });
    // 未填一格的棋盘上不存在任何符号。
    expect(render(harness).filter((c) => onBoard(c) && isRingSymbol(c))).toHaveLength(0);

    for (let row = 0; row < harness.game.grid.rows; row++) {
      placeColor(harness.game, 1, row, 0); // 每行第 0 列都是 ''1''（○）
    }
    const commands = render(harness);
    expect(commands.filter((c) => onBoard(c) && isRingSymbol(c))).toHaveLength(5); // 5 颗已填 → 5 个符号
    expect(commands.filter((c) => onBoard(c) && isStarSymbol(c))).toHaveLength(0); // 其余 25 格仍为空
    expect(commands.filter((c) => onBoard(c) && isDotSymbol(c))).toHaveLength(0);
  });

  // A4（WXG-T-062 转真）：三张道具卡**以形状为唯一识别** + 卡下方 28px **文字标签并列**，
  // 且「卡 + 标签」整块几何落在 POWERUP_BAND 内（§1.4 与 §3.1 曾冲突，裁定见 T-062）。
  it('A4 draws three shape-unique powerup glyphs with 28px labels inside the band', () => {
    const harness = createBeadsHarness({
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.vm-a4',
    });
    const commands = render(harness);
    const inBand = (cmd: DrawCommand): boolean => {
      const y = centreY(cmd);
      return y >= POWERUP_BAND.yMin && y <= POWERUP_BAND.yMax;
    };
    const centreX = (cmd: DrawCommand): number => {
      if (cmd.kind === 'circle' || cmd.kind === 'text') return cmd.x;
      if (cmd.kind === 'rect') return cmd.x + cmd.w / 2;
      if (cmd.kind === 'line') return (cmd.x1 + cmd.x2) / 2;
      if (cmd.kind === 'polygon') {
        const xs = cmd.points.filter((_, i) => i % 2 === 0);
        return xs.reduce((a, b) => a + b, 0) / xs.length;
      }
      return Number.NaN;
    };

    // ① 三张标签文案逐字出现（§1.4 原文）。
    for (const label of Object.values(POWERUP_LABELS)) {
      expect(
        commands.some((c) => c.kind === 'text' && inBand(c) && c.text === label),
        `缺标签「${label}」`,
      ).toBe(true);
    }

    // ② 几何：卡与标签都落在带内；卡高 ≥ TOUCH_MIN（§1.4「整卡即热区」）。
    const rects = powerupCardRects();
    expect(rects).toHaveLength(3);
    for (const r of rects) {
      expect(r.w).toBe(POWERUP_CARD_W);
      expect(r.h).toBe(POWERUP_CARD_H);
      expect(r.h).toBeGreaterThanOrEqual(TOUCH_MIN);
      expect(r.bottom).toBeGreaterThanOrEqual(POWERUP_BAND.yMin);
      expect(r.bottom + r.h).toBeLessThanOrEqual(POWERUP_BAND.yMax);
    }
    const labelY = powerupLabelY();
    expect(labelY + POWERUP_LABEL_H / 2).toBeLessThanOrEqual(rects[0]!.bottom); // 标签在卡**下方**
    expect(labelY - POWERUP_LABEL_H / 2).toBeGreaterThanOrEqual(POWERUP_BAND.yMin);

    // ③ 「以形状为唯一识别」：三张卡内的图元组合互不相同。
    const signature = (r: { x: number; w: number; bottom: number; h: number }): string =>
      commands
        .filter(
          (c) =>
            inBand(c) &&
            centreX(c) >= r.x &&
            centreX(c) <= r.x + r.w &&
            centreY(c) >= r.bottom &&
            centreY(c) <= r.bottom + r.h,
        )
        .map((c) => c.kind)
        .sort()
        .join(',');
    const sigs = rects.map(signature);
    expect(new Set(sigs).size).toBe(3);
    for (const sig of sigs) expect(sig).toContain('polygon'); // 每张都有图标本体
  });

  // architecture-beads §4 规模账：满格 13×12 = 156 珠，每珠 ≥ 6 层 → 指令数随格数线性增长。
  it('§4 keeps the full-board command budget at the documented 900+ per frame', () => {
    const harness = createBeadsHarness({
      levels: [
        simpleTestLevel({
          cols: 13,
          rows: 12,
          // 13 列 × 12 行，三色（校验器要求 ≥3 色）——满格 = GRID_MAX_COLS × GRID_MAX_ROWS。
          pattern: Array.from({ length: 12 }, () => '1231231231231'),
        }),
      ],
      saveKey: 'wxgame.beads.test.vm-e',
    });
    const filled = fillBoard(harness);
    expect(filled).toBe(156);

    const commands = render(harness);
    // 每颗满珠至少 7 条卡层指令（L0/L1/L2×2/L3×2/L4）+ 1 条符号 ⇒ 每珠 ≥ 8 条。
    expect(commands.length).toBeGreaterThanOrEqual(8 * 156);
    expect(commands.length).toBeGreaterThanOrEqual(900); // architecture-beads §4 规模账
    // 符号通道同样覆盖满格：156 格 ÷ 三色分布后，符号总数仍等于已填格数。
    const symbols =
      commands.filter((c) => onBoard(c) && isStarSymbol(c)).length +
      commands.filter((c) => onBoard(c) && isDotSymbol(c)).length +
      commands.filter((c) => onBoard(c) && isRingSymbol(c)).length;
    expect(symbols).toBe(156);
  });

  // ux-spec §3.3：暂停面板必须整屏遮挡（防误触/防偷看），并带「暂停」标题。
  it('§3.3 covers the whole canvas with the pause scrim and prints the title', () => {
    const harness = createBeadsHarness({
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.vm-f',
    });
    harness.game.onPause();
    harness.advance(0.3); // let panelProgress ramp without reaching the exit fade
    const snap: BeadsSnapshot = harness.game.snapshot;
    expect(snap.panelVisible).toBe(true);

    const commands = render(harness);
    const scrim = commands.find(
      (c) => c.kind === 'rect' && c.x === 0 && c.y === 0 && c.w === DESIGN_W && c.h === DESIGN_H,
    );
    expect(scrim).toBeDefined();
    expect(commands.some((c) => c.kind === 'text' && c.text === '暂停')).toBe(true);
  });

  // ux-spec §3 / D6：普通模式不显示分数 HUD，冲刺模式才显示。
  it('§3 hides the score HUD in normal mode and shows it in sprint mode', () => {
    const normal = createBeadsHarness({
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.vm-g',
    });
    const normalText = render(normal)
      .filter((c) => c.kind === 'text')
      .map((c) => (c.kind === 'text' ? c.text : ''));
    expect(normalText.some((t) => t.startsWith('SCORE'))).toBe(false);

    const sprint = createBeadsHarness({
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.vm-h',
    });
    sprint.game.startSprint();
    const sprintText = render(sprint)
      .filter((c) => c.kind === 'text')
      .map((c) => (c.kind === 'text' ? c.text : ''));
    expect(sprintText.some((t) => t.startsWith('SCORE'))).toBe(true);
    expect(sprintText.some((t) => t.startsWith('STAGE'))).toBe(true);
  });
});
