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
