/**
 * BeadGrid — the S3 runtime pattern matrix, the single progress authority.
 *
 * v2.0 (错位归位, bead-grid §2.2): `filled` is no longer one terminal state.
 * It splits by **bead colour vs 底色 (pattern-required colour)**:
 *   - `filled(就位)` — bead colour == required colour: **terminal**, no
 *     outgoing transition (not even retrieve; §2.2「就位珠不可转移」);
 *   - `filled(错位)` — bead colour != required colour: the only outgoing edge
 *     is **retrieve** (`retrieve()` → `empty`, precondition: tray has a free
 *     slot, enforced by the adjudicator in `systems/retrieve.ts`).
 *
 * Per-cell colour model (v2.0): `colorIdx` is now ALWAYS the 底色 — the colour
 * the pattern requires at that cell (0 for locked/void); `beadColorIdx` is the
 * colour of the bead currently occupying the cell (0 = none). `misplaced` =
 * filled && beadColorIdx !== colorIdx.
 *
 * The charset was validated at BOOT (validateBeadsLevel); this class keeps only
 * defensive assertions (bead-grid §2.1 — the two layers do not repeat work).
 * Row 0 of the pattern is the TOP row (ADR-0004 authoring order), matching
 * `rowCenterY(i)` (§3.3).
 */

export type CellState = 'empty' | 'filled' | 'locked';

export interface GridCell {
  state: CellState;
  /** 底色 — the colour the pattern requires here; 0 for locked/void cells. */
  colorIdx: number;
  /**
   * Colour of the bead currently on the cell (v2.0); 0 when empty. Differs
   * from `colorIdx` exactly on misplaced cells. Locked/void: always 0.
   */
  beadColorIdx: number;
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
  /** Misplaced (`filled` with bead ≠ 底色) counter, maintained incrementally. */
  private _misplacedCount = 0;

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
          this._cells.push({ state: 'locked', colorIdx: 0, beadColorIdx: 0, void: false });
        } else if (ch === '.') {
          // Outside the pattern shape.
          this._cells.push({ state: 'locked', colorIdx: 0, beadColorIdx: 0, void: true });
        } else {
          // '1'-'9'/'A' — the 底色 this cell requires (v2.0: boot assembly may
          // place a DIFFERENT bead here; that assembly lives in E5/BOOT, the
          // constructor still yields an empty board).
          const colorIdx = ch === 'A' ? 10 : ch.charCodeAt(0) - 48;
          fillable++;
          this._cells.push({ state: 'empty', colorIdx, beadColorIdx: 0, void: false });
        }
      }
    }
    this._fillableTotal = fillable;
  }

  cell(row: number, col: number): GridCell | undefined {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return undefined;
    return this._cells[row * this.cols + col];
  }

  /** The 底色 the pattern requires at (row, col); 0 for locked/void cells. */
  requiredColor(row: number, col: number): number {
    return this.cell(row, col)?.colorIdx ?? 0;
  }

  isFillable(row: number, col: number): boolean {
    return this.cell(row, col)?.state === 'empty';
  }

  /** v2.0 — `misplaced(cell) = filled 且 bead ≠ 底色` (bead-grid §2.1). */
  isMisplaced(row: number, col: number): boolean {
    const cell = this.cell(row, col);
    return !!cell && cell.state === 'filled' && cell.beadColorIdx !== cell.colorIdx;
  }

  get misplacedCount(): number {
    return this._misplacedCount;
  }

  /**
   * `empty → filled`. `beadColorIdx` defaults to the required colour (a
   * placement that matched, i.e. 就位); pass a different colour only when
   * assembling the v2.0 misplaced board (BOOT swaps — E5) or in tests.
   * Returns false when the cell is not empty (no state change).
   */
  fill(row: number, col: number, beadColorIdx?: number): boolean {
    const cell = this.cell(row, col);
    if (!cell || cell.state !== 'empty') return false;
    const bead = beadColorIdx ?? cell.colorIdx;
    cell.state = 'filled';
    cell.beadColorIdx = bead;
    this._filledCount++;
    if (bead !== cell.colorIdx) this._misplacedCount++;
    return true;
  }

  /**
   * v2.0 retrieve — the ONLY outgoing edge of `filled`: 错位珠 → `empty`.
   * A 就位珠 (bead == 底色) is terminal and refuses; locked/empty refuse too.
   * @returns the removed bead's colour, or 0 when nothing was removed.
   */
  retrieve(row: number, col: number): number {
    const cell = this.cell(row, col);
    if (!cell || cell.state !== 'filled' || cell.beadColorIdx === cell.colorIdx) return 0;
    const bead = cell.beadColorIdx;
    cell.state = 'empty';
    cell.beadColorIdx = 0;
    this._filledCount--;
    this._misplacedCount--;
    return bead;
  }

  /**
   * v2.0 BOOT 装配原语（E5 `swaps` 交换构造消费；测试手工构造局面用）：
   * overwrite the bead on a FILLED fillable cell without going through the
   * retrieve/place edges — 就位⇄错位互转在这里是合法的，因为装配发生在玩法
   * 状态机接管之前（bead-grid §2.1 初始装配）。Returns false on
   * locked/void/empty cells.
   */
  setBead(row: number, col: number, beadColorIdx: number): boolean {
    const cell = this.cell(row, col);
    if (!cell || cell.void || cell.state !== 'filled') return false;
    if (cell.beadColorIdx === beadColorIdx) return true;
    if (cell.beadColorIdx !== cell.colorIdx) this._misplacedCount--;
    cell.beadColorIdx = beadColorIdx;
    if (beadColorIdx !== cell.colorIdx) this._misplacedCount++;
    return true;
  }

  get fillableTotal(): number {
    return this._fillableTotal;
  }

  get filledCount(): number {
    return this._filledCount;
  }

  /**
   * v2.0 completion predicate (bead-grid §2.3 路径 B 第 4 步): every fillable
   * cell carries a bead **and zero of them are misplaced** (= 错位珠全部归位).
   * A full board holding one misplaced bead is NOT complete (负例判据 §8-5).
   */
  isComplete(): boolean {
    return this._fillableTotal > 0 && this._filledCount === this._fillableTotal && this._misplacedCount === 0;
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
