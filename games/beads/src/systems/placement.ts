/**
 * Placement — the S3 adjudication for one bead placement request
 * (bead-grid §2.3 路径 B · 归位, v2.0).
 *
 * Pure function: no events, no I/O. The caller (BeadsGame) applies the verdict
 * and broadcasts `bead:placed` / `bead:rejected` / nothing.
 *
 * Rules (v2.0):
 *   1. target not `empty` (locked/filled/void) → ignore — zero events, zero
 *      feedback noise (core-loop §6);
 *   2. colour invalid (0 or > BEAD_COLOR_MAX) → defensive reject + warn (§6);
 *   3. colour mismatch → reject, bead stays in the tray (A4: no penalty) —
 *      only the tray path can reach this (the solver is match-by-construction);
 *   4. match → fill: the cell becomes `filled(就位)` (terminal, bead == 底色).
 *
 * v1.22 payload change: `slot` is now OPTIONAL — required for the tray path
 * (the bead leaves that slot), absent for the solver path (S6 → S3 write, the
 * bead never came from the tray). Consumers must not assume it is always set.
 *
 * v2.1 (WXG-T-158 裁定③④): the tray path became a GROUP placement — a match
 * on the tapped cell may fill more 同色连通空格 in the same call stack (see
 * {@link planGroupFill}); `bead:placed` is emitted once per filled cell, so
 * "一次归位多发事件" is by design, not a defect (bead-grid §8-11). This
 * adjudicator still judges the TAPPED cell only; the batch lives in the caller.
 */

import { BEAD_COLOR_MAX } from '../config/tuning.js';
import type { BeadGrid } from '../entities/grid.js';

export type PlacementOutcome = 'placed' | 'rejected' | 'ignored';

export type PlacementVerdict =
  | { outcome: 'placed'; row: number; col: number; colorIdx: number; slot?: number }
  | {
      outcome: 'rejected';
      row: number;
      col: number;
      colorIdx: number;
      reason: 'mismatch' | 'invalid-color';
    }
  | {
      outcome: 'ignored';
      row: number;
      col: number;
      colorIdx: number;
      reason: 'out-of-bounds' | 'occupied' | 'locked' | 'no-color';
    };

export function judgePlacement(
  grid: BeadGrid,
  row: number,
  col: number,
  colorIdx: number,
  slot?: number,
): PlacementVerdict {
  const cell = grid.cell(row, col);

  // (row,col) out of bounds or off-grid → ignore + warn (caller logs).
  if (!cell) {
    return { outcome: 'ignored', row, col, colorIdx, reason: 'out-of-bounds' };
  }

  // Non-empty targets are silently ignored (locked keeps its own reason for logs).
  if (cell.state === 'locked') {
    return { outcome: 'ignored', row, col, colorIdx, reason: 'locked' };
  }
  if (cell.state === 'filled') {
    return { outcome: 'ignored', row, col, colorIdx, reason: 'occupied' };
  }

  // Defensive colour range (bead-grid §6): 0 or > BEAD_COLOR_MAX → reject + warn.
  if (!Number.isInteger(colorIdx) || colorIdx < 1 || colorIdx > BEAD_COLOR_MAX) {
    return { outcome: 'rejected', row, col, colorIdx, reason: 'invalid-color' };
  }

  if (cell.colorIdx !== colorIdx) {
    return { outcome: 'rejected', row, col, colorIdx, reason: 'mismatch' };
  }

  // Match → fill (bead == 底色 ⇒ 就位, terminal). `fill` re-checks emptiness;
  // serialization means the second same-frame request on the same cell lands
  // in the ignore branch.
  if (!grid.fill(row, col, colorIdx)) {
    return { outcome: 'ignored', row, col, colorIdx, reason: 'occupied' };
  }
  // `slot` only rides along on the tray path (solver path passes undefined).
  return slot === undefined
    ? { outcome: 'placed', row, col, colorIdx }
    : { outcome: 'placed', row, col, colorIdx, slot };
}

/**
 * v2.1 组批量填充规划（bead-grid §2.3 路径 B 第 3 步，WXG-T-158 用户裁定③④）：
 * 被点格匹配并已填入（`judgePlacement` placed）后，从被点格起 **8 向 BFS、不限
 * 步数**（区别于盘侧组选 T-157 的 ≤2 收窄），沿「`empty` 且底色 = 组色」的连通
 * 空格逐层蔓延，至多再报 `beadCount` 格（按 BFS 距层就近，同层行主序）。
 * 调用时被点格已 `filled` ⇒ 它不再入选，仅作为 BFS 源不参与计数。
 * 输入路径调用（一次点击一次），非每帧热路径 ⇒ 队列/集合分配可接受（
 * `collectMisplacedGroup` 同判例）。
 */
export function planGroupFill(
  grid: BeadGrid,
  fromRow: number,
  fromCol: number,
  colorIdx: number,
  beadCount: number,
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  if (beadCount <= 0) return out;
  const seen = new Set<number>();
  seen.add(fromRow * grid.cols + fromCol);
  // 邻域固定序 = 行主序（上→下、左→右），保证同层确定性。
  const DELTAS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1],
  ];
  let frontier: { row: number; col: number }[] = [{ row: fromRow, col: fromCol }];
  while (frontier.length > 0 && out.length < beadCount) {
    const next: { row: number; col: number }[] = [];
    for (const cellPos of frontier) {
      for (const [dr, dc] of DELTAS) {
        const r = cellPos.row + dr;
        const c = cellPos.col + dc;
        const key = r * grid.cols + c;
        if (seen.has(key)) continue;
        seen.add(key);
        const cell = grid.cell(r, c);
        if (!cell || cell.state !== 'empty' || cell.colorIdx !== colorIdx) continue;
        out.push({ row: r, col: c });
        next.push({ row: r, col: c });
        if (out.length >= beadCount) break;
      }
      if (out.length >= beadCount) break;
    }
    frontier = next;
  }
  return out;
}
