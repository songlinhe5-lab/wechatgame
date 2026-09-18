/**
 * Retrieve — the S3 adjudication for one bead-retrieval request
 * (bead-grid §2.3 路径 A · 取回, v2.1; systems-index §3.13 取回前提).
 *
 * Input `(row, col)` comes from S2 (route 4b — the tapped free slot is only a
 * TRIGGER signal) or tests/harness commands. **v2.1 (WXG-T-158 用户裁定①)**:
 * the landing slot is NO LONGER player-chosen — S4 auto-inserts the bead at
 * the tail of its colour block (tray-spawner §2.1 归类不变式, `insertGrouped`).
 *
 * Rules (v2.1, all zero-event when not stored):
 *   1. target cell not `filled(错位)` (locked/empty/void/就位珠) → ignored —
 *      the S2 layer owns the 极轻非惩罚反馈 for locked/就位 taps (裁定 4);
 *   2. tray has no free slot → 满槽禁取珠 (§3.13): refuse, zero events,
 *      zero state writes;整组收进额外前提 = free 槽数 ≥ 组大小 (router);
 *   3. pass → SAME-CALL-STACK atomic write (core-loop §2.2.2 输入段): grid
 *      `filled(错位)` → `empty`, slot `free` → `holding(colorIdx)` at the
 *      auto-classified position. The caller then broadcasts
 *      `tray:stored {slot, colorIdx, fromRow, fromCol}` — `slot` = 实际落位.
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
      reason: 'out-of-bounds' | 'not-misplaced' | 'tray-full';
    };

export function judgeRetrieve(
  grid: BeadGrid,
  tray: Tray,
  row: number,
  col: number,
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

  // Same-call-stack atomic pair-write (core-loop §2.2.2 输入段): grid
  // `filled(错位)` → `empty` + S4 自动归类插入（v2.1 裁定①：落位 = 同色堆尾部，
  // 无同色堆追加紧凑序列末尾）。freeCount > 0 已查 ⇒ insertGrouped 必成功。
  const colorIdx = grid.retrieve(row, col);
  const slot = tray.insertGrouped(colorIdx);
  return { outcome: 'stored', slot, colorIdx, fromRow: row, fromCol: col };
}
