/**
 * Retrieve — the S3 adjudication for one bead-retrieval request
 * (bead-grid §2.3 路径 A · 取回, v2.1; systems-index §3.13 取回前提).
 *
 * Input `(row, col)` comes from S2 (route 4b) or tests/harness commands.
 * **v2.3 (WXG-T-168 用户裁定，推翻 v2.1/WXG-T-158 裁定①)**: the landing slot is
 * PLAYER-CHOSEN again — `landSlot` = 玩家点击的空槽，整组从该槽起**连续相邻**
 * 排布（`insertRun`）。未传 `landSlot` 时退回 `insertGrouped` 自动归类（v2.1
 * 口径），仅供夹具 / 死路径兼容，**玩法入口必传**。
 * 备注：v2.1 曾把点槽降级为「仅触发信号」；用户 2026-09-18 复测后推翻该条。
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
  landSlot?: number,
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

  // v2.3 点槽定落位（WXG-T-168）：**先校验落槽再动 grid** —— 落槽不可用就必须
  // 零状态写，事后回滚 `grid.retrieve` 会把「取回」变成可逆难题，故前置到写之前。
  if (landSlot !== undefined) {
    const target = tray.slot(landSlot);
    if (!target || target.state !== 'free') {
      return { outcome: 'ignored', row, col, reason: 'tray-full' };
    }
  }

  // Same-call-stack atomic pair-write (core-loop §2.2.2 输入段): grid
  // `filled(错位)` → `empty` + 落槽。
  // v2.3（WXG-T-168 裁定，覆盖 v2.1 裁定①）：`landSlot` 给定 ⇒ 玩家点槽定落位
  // （`insertRun`，整组连续相邻）；未给定 ⇒ 退回 `insertGrouped` 自动归类（夹具
  // / 死路径兼容，非玩法入口）。两条前置已查 ⇒ 落槽必成功。
  const colorIdx = grid.retrieve(row, col);
  const slot =
    landSlot === undefined
      ? tray.insertGrouped(colorIdx)
      : tray.insertRun(landSlot, colorIdx, 1) === 1
        ? landSlot
        : -1;
  if (slot < 0) {
    return { outcome: 'ignored', row, col, reason: 'tray-full' }; // 理论不可达（前置已查）
  }
  return { outcome: 'stored', slot, colorIdx, fromRow: row, fromCol: col };
}
