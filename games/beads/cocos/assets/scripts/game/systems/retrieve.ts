/**
 * Retrieve — the S3 adjudication for one bead-retrieval request
 * (bead-grid §2.3 路径 A · 取回, v2.0; systems-index §3.13 取回前提).
 *
 * Input `(row, col, targetSlot)` comes from S2 (route 4b, anchor = `board`)
 * or tests/harness commands. `targetSlot` is the PLAYER-CHOSEN free slot —
 * v2.0 removed the random-drop rule with the spawner (tray-spawner §2.4).
 *
 * Rules (v2.0, all zero-event when not stored):
 *   1. target cell not `filled(错位)` (locked/empty/void/就位珠) → ignored —
 *      the S2 layer owns the 极轻非惩罚反馈 for locked/就位 taps (裁定 4);
 *   2. tray has no free slot → 满槽禁取珠 (§3.13): refuse, zero events,
 *      zero state writes;
 *   3. target slot not free (S4 复核兜底, bead-grid §6) → refuse;
 *   4. pass → SAME-CALL-STACK atomic write (core-loop §2.2.2 输入段): grid
 *      `filled(错位)` → `empty`, slot `free` → `holding(colorIdx)`. The
 *      caller then broadcasts `tray:stored {slot, colorIdx, fromRow, fromCol}`.
 *
 * Retrieve NEVER triggers the completion check (bead-grid §2.3 路径 A 第 3 步:
 * `filled` 只减不增, 全满不可达成).
 */

import type { BeadGrid } from '../entities/grid';
import type { Tray } from '../entities/tray';

export type RetrieveVerdict =
  | { outcome: 'stored'; slot: number; colorIdx: number; fromRow: number; fromCol: number }
  | {
      outcome: 'ignored';
      row: number;
      col: number;
      reason: 'out-of-bounds' | 'not-misplaced' | 'tray-full' | 'slot-not-free';
    };

export function judgeRetrieve(
  grid: BeadGrid,
  tray: Tray,
  row: number,
  col: number,
  targetSlot: number,
): RetrieveVerdict {
  // (row,col) out of bounds → ignore + warn (caller logs).
  if (!grid.cell(row, col)) {
    return { outcome: 'ignored', row, col, reason: 'out-of-bounds' };
  }

  // Only a misplaced bead may leave the board (locked/empty/就位珠 refuse).
  if (!grid.isMisplaced(row, col)) {
    return { outcome: 'ignored', row, col, reason: 'not-misplaced' };
  }

  // 满槽禁取珠 (§3.13): the precondition is a free slot; refuse before any
  // state write. Zero events, zero writes — the S2 layer adds the 极轻反馈.
  if (tray.freeCount === 0) {
    return { outcome: 'ignored', row, col, reason: 'tray-full' };
  }

  // S4 复核兜底 (bead-grid §6): the target slot must still be free. The S2
  // route only fires on a tapped free slot; a stale/occupied target lands here.
  const slot = tray.slot(targetSlot);
  if (!slot || slot.state !== 'free') {
    return { outcome: 'ignored', row, col, reason: 'slot-not-free' };
  }

  // Same-call-stack atomic pair-write (core-loop §2.2.2 输入段): grid
  // `filled(错位)` → `empty` + slot `free` → `holding(colorIdx)`.
  const colorIdx = grid.retrieve(row, col);
  tray.storeInto(targetSlot, colorIdx);
  return { outcome: 'stored', slot: targetSlot, colorIdx, fromRow: row, fromCol: col };
}
