/**
 * Retrieve — the S3 adjudication for one bead-retrieval request
 * (bead-grid §2.3 路径 A · 取回; systems-index §3.13 取回前提).
 *
 * Input `(row, col)` comes from S2 (route 4b) or tests/harness commands.
 * **v2.4 (WXG-T-204 用户裁定，推翻 WXG-T-168 v2.3「点槽定落位」)**: 落槽 =
 * **自动归类**（`insertGrouped`）—— 新色从最左可用空格追加、已有色插到同色块尾
 * 并把后面的珠右移 ⇒ 同色成块、紧凑无洞。玩家点击的空槽**仅作 4b 取回触发**，
 * **不再决定落位**（= 恢复 WXG-T-158 裁定① v2.1/v2.2 口径）。
 *
 * Rules (all zero-event when not stored):
 *   1. target cell not `filled(错位)` (locked/empty/void/就位珠) → ignored —
 *      the S2 layer owns the 极轻非惩罚反馈 for locked/就位 taps;
 *   2. tray has no free slot → 满槽禁取珠 (§3.13): refuse, zero events,
 *      zero state writes;
 *   3. pass → SAME-CALL-STACK atomic write (core-loop §2.2.2 输入段): grid
 *      `filled(错位)` → `empty`, slot `free` → `holding(colorIdx)` at the
 *      auto-classified (grouped) position. The caller then broadcasts
 *      `tray:stored {slot, colorIdx, fromRow, fromCol}` — `slot` = 实际归类落位.
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
  // `filled(错位)` → `empty` + 归类落槽。v2.4（WXG-T-204，恢复 v2.1 裁定①）：
  // 落槽恒走 `insertGrouped`（同色成块 + 紧凑无洞），点击空槽不参与定位。
  // freeCount>0 已前置查 ⇒ insertGrouped 必成功（≥0）。
  const colorIdx = grid.retrieve(row, col);
  const slot = tray.insertGrouped(colorIdx);
  if (slot < 0) {
    return { outcome: 'ignored', row, col, reason: 'tray-full' }; // 理论不可达（前置已查）
  }
  return { outcome: 'stored', slot, colorIdx, fromRow: row, fromCol: col };
}
