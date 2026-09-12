/**
 * BeadGrid — the S3 runtime pattern matrix, the single progress authority.
 *
 * Cells are `empty | filled | locked`; `filled` carries the placed colour and
 * is terminal (powerups can never revert it, §3.6). Row 0 of the pattern is the
 * TOP row (ADR-0004 authoring order), matching `rowCenterY(i)` (§3.3).
 *
 * The charset was validated at BOOT (validateBeadsLevel); this class keeps only
 * defensive assertions (bead-grid §2.1 — the two layers do not repeat work).
 */

export type CellState = 'empty' | 'filled' | 'locked';

export interface GridCell {
  state: CellState;
  /** Placed colour for `filled`; required colour for fillable `empty`. */
  colorIdx: number;
  /**
   * True for `.` cells: outside the pattern shape — not fillable, never
   * counted for completion, rendered as background. Mechanically a `locked`
   * variant (levels-spec §4 counts 可填格 = coloured cells only).
   */
  void: boolean;
}

export class BeadGrid {
  readonly rows: number;
  readonly cols: number;
  private readonly _cells: GridCell[];
  private readonly _fillableTotal: number;
  private _filledCount = 0;

  constructor(pattern: readonly string[]) {
    this.rows = pattern.length;
    this.cols = pattern[0]?.length ?? 0;
    this._cells = [];
    let fillable = 0;
    for (let i = 0; i < this.rows; i++) {
      const row = pattern[i]!;
      for (let j = 0; j < this.cols; j++) {
        const ch = row[j]!;
        if (ch === 'x') {
          // Locked bead: not fillable, not counted (decoration/教学).
          this._cells.push({ state: 'locked', colorIdx: 0, void: false });
        } else if (ch === '.') {
          // Outside the pattern shape.
          this._cells.push({ state: 'locked', colorIdx: 0, void: true });
        } else {
          // '1'-'9'/'A' — an empty slot awaiting its required colour.
          const colorIdx = ch === 'A' ? 10 : ch.charCodeAt(0) - 48;
          fillable++;
          this._cells.push({ state: 'empty', colorIdx, void: false });
        }
      }
    }
    this._fillableTotal = fillable;
  }

  cell(row: number, col: number): GridCell | undefined {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return undefined;
    return this._cells[row * this.cols + col];
  }

  /** The colour the pattern requires at (row, col); 0 for locked/void cells. */
  requiredColor(row: number, col: number): number {
    return this.cell(row, col)?.colorIdx ?? 0;
  }

  isFillable(row: number, col: number): boolean {
    return this.cell(row, col)?.state === 'empty';
  }

  /** `empty → filled`. Returns false when the cell is not empty (no state change). */
  fill(row: number, col: number): boolean {
    const cell = this.cell(row, col);
    if (!cell || cell.state !== 'empty') return false;
    cell.state = 'filled';
    this._filledCount++;
    return true;
  }

  get fillableTotal(): number {
    return this._fillableTotal;
  }

  get filledCount(): number {
    return this._filledCount;
  }

  /** All fillable cells occupied (S3 completion predicate). */
  isComplete(): boolean {
    return this._fillableTotal > 0 && this._filledCount === this._fillableTotal;
  }

  /**
   * Still-needed colour counts (index 0 unused; 1..10). Initial value for the
   * tray's needed-colour projection (architecture-beads §2 note ①).
   */
  neededColorCounts(): number[] {
    const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const cell of this._cells) {
      if (cell.state === 'empty' && cell.colorIdx > 0) counts[cell.colorIdx]!++;
    }
    return counts;
  }
}
