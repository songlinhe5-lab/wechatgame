/**
 * G2′ `vfx_solver_restore` — 解环器归位（WXG-T-150 · T-128「动态质感章」落码③）。
 *
 * 规格正本：`art/assets-spec.md` §1.6.2a；毫秒真源：`design/ux/ux-spec.md` §5
 * 「解环器归位 200ms + 120ms/颗、逐颗 80ms 错开」。
 *
 * 三层判据各管一段（与 `scene-vfx.test.ts` 同族）：
 *   ① 包络 = `scene-vfx.ts` 纯函数；
 *   ② 时序 = game 侧队列 —— ⚠️ 本单含**玩法语义变更**（用户 2026-09-17 裁定「甲：
 *      归位延后到相 A 200ms 之后」）⇒ 「同帧零动手 / 到点才动手」是玩法判据，不是观感判据；
 *   ③ 观感 = 命令层（相 A 状态环、T-148 白环的 clamp 几何与点名期退让）。
 */

import { describe, expect, it } from 'vitest';
import { RenderModelBuilder, type DrawCommand, type RectCommand } from '@wxgame/framework';
import {
  BEAD_CELL,
  BEAD_PITCH,
  FILL_POP_MS,
  SOLVER_HINT_MS,
  SOLVER_MAX_CELLS,
  SOLVER_PER_BEAD_MS,
  SOLVER_PLUS_COUNT,
  SOLVER_STAGGER_MS,
  POWERUP_FREE_USES,
  solverSequenceMs,
} from '../src/config/tuning.js';
import { solverBeadProgress, solverHintAlpha } from '../src/view/scene-vfx.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import {
  advancePastSolver,
  createBeadsHarness,
  simpleTestLevel,
  type Harness,
} from './helpers.js';
import { pausePanelLayout } from '../src/systems/pause-panel.js';
import type { BeadsSnapshot } from '../src/game/state.js';

/** 暂停面板「继续」按钮中点（同 `in-level-snapshot.test.ts` 判例：走真链退出 PAUSED）。 */
function tapResume(h: Harness): void {
  const b = pausePanelLayout('normal').buttons.find((x) => x.id === 'resume')!;
  h.game.tapDesign((b.rect.xMin + b.rect.xMax) / 2, (b.rect.yMin + b.rect.yMax) / 2);
}

/** 相 A 中点（α 峰值处）与「过门」余量：一律由 tuning 派生，**不写字面毫秒**。 */
const HINT_MID = SOLVER_HINT_MS / 2;
const EPS_MS = 1;
const s = (ms: number): number => ms / 1000;

/** 装配错位局面：满盘就位后做 `swaps` 次异色两两对调 ⇒ 每对 2 颗错位（同 powerups 判据）。 */
function buildMisplaced(h: Harness, swaps: number): { row: number; col: number }[] {
  const grid = h.game.grid;
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
  for (let a = 0; a < flat.length && done < swaps; a++) {
    if (used.has(a)) continue;
    for (let b = a + 1; b < flat.length; b++) {
      if (used.has(b)) continue;
      if (
        grid.requiredColor(flat[a]!.row, flat[a]!.col) ===
        grid.requiredColor(flat[b]!.row, flat[b]!.col)
      )
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
  for (let r = 0; r < grid.rows; r++)
    for (let c = 0; c < grid.cols; c++) if (grid.isMisplaced(r, c)) out.push({ row: r, col: c });
  return out;
}

function mk(saveKey: string): Harness {
  return createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey });
}

function renderSnap(snap: BeadsSnapshot): readonly DrawCommand[] {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  buildBeadsView(builder, snap, DEFAULT_PALETTE);
  return builder.end().commands;
}

/** 该格的描边环命令（`drawStateRing` / 白环都是 stroke-only rect，尺寸 = 格心方形）。 */
function strokesAt(
  cmds: readonly DrawCommand[],
  snap: BeadsSnapshot,
  row: number,
  col: number,
): RectCommand[] {
  const cx = snap.gridLeft + BEAD_CELL / 2 + BEAD_PITCH * col;
  const cy = snap.gridTop - BEAD_CELL / 2 - BEAD_PITCH * row;
  return cmds.filter(
    (c): c is RectCommand =>
      c.kind === 'rect' &&
      c.stroke !== undefined &&
      Math.abs(c.x + c.w / 2 - cx) < 0.01 &&
      Math.abs(c.y + c.h / 2 - cy) < 0.01,
  );
}

const countRects = (cmds: readonly DrawCommand[]): number =>
  cmds.filter((c) => c.kind === 'rect').length;

// ───────────────────────────────────────────── ① 包络（scene-vfx 纯函数）

describe('G2′ 包络（assets-spec §1.6.2a）', () => {
  it('相 A α = 单峰 sin、两端归 0（0 往复 ⇒ 不违 D2），且不越界到相 B', () => {
    expect(solverHintAlpha(0)).toBe(0);
    expect(solverHintAlpha(HINT_MID)).toBeCloseTo(1, 6);
    expect(solverHintAlpha(SOLVER_HINT_MS)).toBe(0);
    expect(solverHintAlpha(SOLVER_HINT_MS + 1)).toBe(0); // 相 B 期恒 0 ⇒ 视图不会拖尾
    let rising = true;
    let prev = 0;
    for (let t = 0; t <= SOLVER_HINT_MS; t += 4) {
      const a = solverHintAlpha(t);
      expect(a).toBeGreaterThanOrEqual(-1e-9);
      expect(a).toBeLessThanOrEqual(1 + 1e-9);
      if (rising && a < prev - 1e-9) rising = false;
      else if (!rising) expect(a).toBeLessThanOrEqual(prev + 1e-9); // 降段单调不增
      prev = a;
    }
    expect(rising).toBe(false); // 确实越过了峰
  });

  it('相 B 逐颗窗口 = [200+80k, +120)，窗口外恒 0、窗口内单调升', () => {
    for (let step = 0; step < SOLVER_MAX_CELLS; step++) {
      const from = SOLVER_HINT_MS + SOLVER_STAGGER_MS * step;
      expect(solverBeadProgress(from, step)).toBe(0); // 到点帧本身仍为 0（未激活哨兵）
      expect(solverBeadProgress(from + EPS_MS, step)).toBeGreaterThan(0);
      expect(solverBeadProgress(from + SOLVER_PER_BEAD_MS, step)).toBe(0); // 走完即归零
      let prev = 0;
      for (let t = from; t <= from + SOLVER_PER_BEAD_MS; t += 8) {
        const p = solverBeadProgress(t, step);
        if (p > 0) expect(p).toBeGreaterThan(prev);
        prev = p;
      }
      // 逐颗之间互不串台：上一颗的窗口里本颗必须为 0。
      expect(solverBeadProgress(from - SOLVER_STAGGER_MS, step)).toBe(0);
    }
  });

  it('总时长单一真源 = `solverSequenceMs`（末颗窗口终点恰等于序列总长）', () => {
    expect(solverSequenceMs(1)).toBe(SOLVER_HINT_MS + FILL_POP_MS);
    expect(solverSequenceMs(SOLVER_MAX_CELLS)).toBe(
      SOLVER_HINT_MS + SOLVER_STAGGER_MS * (SOLVER_MAX_CELLS - 1) + FILL_POP_MS,
    );
    expect(solverSequenceMs(0)).toBe(solverSequenceMs(1)); // 兜底不外溢
    const last = SOLVER_MAX_CELLS - 1;
    const total = solverSequenceMs(SOLVER_MAX_CELLS);
    expect(solverBeadProgress(total, last)).toBe(0);
    expect(solverBeadProgress(total - EPS_MS, last)).toBeGreaterThan(0);
  });
});

// ─────────────────────────── ② game 侧时序（裁定「甲」：先预警 → 后动手）

describe('G2′ 时序 · 相 A 只点名不动手（玩法语义变更）', () => {
  it('同帧：扣次 + 发 `powerup:used`（载荷 = 点名格）但棋盘零写、零 `bead:placed`', () => {
    const h = mk('wxgame.beads.test.g2-arm');
    const misplaced = buildMisplaced(h, 1);
    const before = h.game.grid.misplacedCount;

    expect(h.game.usePowerup('solver')).toBe(true);
    expect(h.game.powerups.freeUses('solver')).toBe(POWERUP_FREE_USES - 1);
    expect(h.last<{ affectedCells: { row: number; col: number }[] }>('powerup:used')!.affectedCells)
      .toEqual([misplaced[0]!]);
    expect(h.game.grid.misplacedCount).toBe(before); // 棋盘未动
    expect(h.count('bead:placed')).toBe(0);
    expect(h.count('level:cleared')).toBe(0);
    const snap = h.game.snapshot;
    expect(snap.solverCellCount).toBe(1);
    expect(snap.solverCellRows[0]).toBe(misplaced[0]!.row);
    expect(snap.solverCellCols[0]).toBe(misplaced[0]!.col);
    expect(snap.solverProgress).toBe(0); // 上弦帧哨兵（与 G1/G3 同族约定）
  });

  it('到点前 0 落子、到点后归位 ⇒ 200ms 门是玩法提交时刻而非观感时长', () => {
    const h = mk('wxgame.beads.test.g2-gate');
    buildMisplaced(h, 1);
    expect(h.game.usePowerup('solver')).toBe(true);
    h.advance(s(SOLVER_HINT_MS - EPS_MS));
    expect(h.count('bead:placed')).toBe(0);
    expect(h.game.grid.misplacedCount).toBe(2);
    h.advance(s(2 * EPS_MS));
    expect(h.count('bead:placed')).toBeGreaterThan(0);
    expect(h.game.grid.misplacedCount).toBe(0);
  });

  it('逐颗错开 80ms：点名多颗时落子事件数随各颗到点单调不减', () => {
    const h = mk('wxgame.beads.test.g2-stagger');
    buildMisplaced(h, 4); // 8 颗错位 ⇒ solverPlus 点名 3
    expect(h.game.usePowerup('solverPlus')).toBe(true);
    expect(h.game.snapshot.solverCellCount).toBe(SOLVER_PLUS_COUNT);
    let prev = 0;
    for (let step = 0; step < SOLVER_PLUS_COUNT; step++) {
      h.advance(s(SOLVER_STAGGER_MS));
      const now = h.count('bead:placed');
      expect(now).toBeGreaterThanOrEqual(prev);
      prev = now;
    }
    expect(prev).toBeGreaterThan(0);
    expect(prev).toBeLessThanOrEqual(SOLVER_PLUS_COUNT * 2); // 每步至多 2 格（交换）
  });

  it('序列末零残留：progress / counts / 三数组全部复位', () => {
    const h = mk('wxgame.beads.test.g2-reset');
    buildMisplaced(h, 1);
    expect(h.game.usePowerup('solverPlus')).toBe(true);
    advancePastSolver(h, 2);
    const snap = h.game.snapshot;
    expect(snap.solverProgress).toBe(0);
    expect(snap.solverCellCount).toBe(0);
    expect(snap.solverLandCount).toBe(0);
    expect(snap.solverCellRows.every((r) => r === -1)).toBe(true);
    expect(snap.solverLandRows.every((r) => r === -1)).toBe(true);
    expect(snap.solverLandSteps.every((v) => v === -1)).toBe(true);
  });

  it('过关判定排在序列末（先看归位动画，再进 G4 庆祝 —— 裁定 1 同族）', () => {
    const h = mk('wxgame.beads.test.g2-clear');
    buildMisplaced(h, 1);
    expect(h.game.usePowerup('solver')).toBe(true);
    h.advance(s(HINT_MID));
    expect(h.game.phase).toBe('playing');
    expect(h.count('level:cleared')).toBe(0);
    advancePastSolver(h);
    expect(h.game.phase).toBe('level-clear');
    expect(h.count('level:cleared')).toBe(1);
  });

  it('预警窗口内局面已变（该珠已被复位）⇒ 相 B 静默跳过，零落子零警告式误写', () => {
    const h = mk('wxgame.beads.test.g2-skip');
    const misplaced = buildMisplaced(h, 1);
    expect(h.game.usePowerup('solver')).toBe(true);
    h.advance(s(HINT_MID));
    // 模拟「玩家自己先动手」：直接把点名珠复位（不发事件、不动其它格）。
    const target = misplaced[0]!;
    h.game.grid.setBead(target.row, target.col, h.game.grid.requiredColor(target.row, target.col));
    const placedBefore = h.count('bead:placed');
    advancePastSolver(h);
    expect(h.count('bead:placed')).toBe(placedBefore);
    expect(h.game.snapshot.solverProgress).toBe(0); // 队列仍按时收尾，不悬挂
  });

  it('PAUSED ⇒ 冻结不作废（道具已扣次，不该因一次暂停丢掉归位）', () => {
    const h = mk('wxgame.beads.test.g2-pause');
    buildMisplaced(h, 1);
    expect(h.game.usePowerup('solver')).toBe(true);
    h.game.onPause(); // → PAUSED
    expect(h.game.phase).toBe('paused');
    h.advance(2);
    expect(h.game.snapshot.solverProgress).toBe(0); // 未推进（首帧哨兵）
    expect(h.count('bead:placed')).toBe(0);
    tapResume(h);
    expect(h.game.phase).toBe('playing');
    advancePastSolver(h);
    expect(h.game.grid.misplacedCount).toBe(0);
    expect(h.count('bead:placed')).toBeGreaterThan(0);
  });

  it('换关 / 重试 ⇒ 在途队列作废（不得拿旧格坐标动新棋盘）', () => {
    const h = mk('wxgame.beads.test.g2-invalidate');
    buildMisplaced(h, 1);
    expect(h.game.usePowerup('solver')).toBe(true);
    h.advance(s(HINT_MID));
    h.game.goToLevel(0); // 重装配（`_setupLevel`）⇒ 新空盘
    const placedBefore = h.count('bead:placed');
    advancePastSolver(h);
    expect(h.count('bead:placed')).toBe(placedBefore);
    expect(h.game.snapshot.solverCellCount).toBe(0);
  });
});

// ─────────────────────────────── ③ 观感（clamp 几何 / 点名期互斥 / D1）

describe('G2′ 观感 · 相 A 状态环（T-148 白环已随 WXG-T-165 真机反馈移除）', () => {
  it('D1 不关停相 A（纯 α 通道）：`reduceMotion` 下状态环照旧在场', () => {
    const h = mk('wxgame.beads.test.g2-d1');
    buildMisplaced(h, 1);
    expect(h.game.usePowerup('solver')).toBe(true);
    h.advance(s(HINT_MID));
    const snap = h.game.snapshot;
    const withMotion = renderSnap({ ...snap, reduceMotion: false });
    const without = renderSnap({ ...snap, reduceMotion: true });
    const row = snap.solverCellRows[0]!;
    const col = snap.solverCellCols[0]!;
    expect(strokesAt(without, snap, row, col).filter((c) => c.stroke === DEFAULT_PALETTE.slotBorder))
      .toHaveLength(1);
    expect(countRects(withMotion)).toBe(countRects(without)); // 相 A 期 D1 零增减
  });
});
