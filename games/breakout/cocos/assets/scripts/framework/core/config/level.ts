/**
 * Data-driven grid levels.
 *
 * A level is authored as an array of strings where each character is a *legend*
 * key. This format is:
 *  - human-readable and diff-friendly (a designer can edit it in git),
 *  - engine-agnostic (no `.scene` / `.prefab` / `.tres` involved),
 *  - validated at load time so bad content fails at boot, not mid-run.
 *
 * ```ts
 * const level: LevelDef = {
 *   id: 'l1',
 *   name: 'Warm-up',
 *   layout: ['..###..', '.#####.'],
 *   legend: { '#': { hp: 1, score: 10, color: '#4cc9f0' } },
 * };
 * const compiled = compileLevel(level); // → bricks with world positions
 * ```
 */

/** Per-character brick specification. */
export interface BrickTypeSpec {
  /** Hit points; bricks with `hp <= 0` are treated as empty. */
  readonly hp: number;
  /** Base score awarded per hit (multiplied by the combo multiplier). */
  readonly score: number;
  /** Render colour, CSS-style `#rrggbb`. */
  readonly color: string;
  /** Indestructible bricks never lose hp and never count toward clear. */
  readonly indestructible?: boolean;
  /** Optional damage-per-hit override (defaults to 1). */
  readonly damage?: number;
}

export interface GridLayout {
  /** Grid geometry in design-space units. */
  readonly originX: number;
  readonly originY: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  /** Gap between cells, subtracted from the drawn brick. */
  readonly gapX?: number;
  readonly gapY?: number;
}

export interface LevelDef {
  readonly id: string;
  readonly name: string;
  readonly layout: readonly string[];
  readonly legend: Readonly<Record<string, BrickTypeSpec>>;
  /** Per-level overrides; fall back to global tuning when absent. */
  readonly ballSpeed?: number;
  readonly paddleWidth?: number;
  readonly ballRadius?: number;
  /** Par time in seconds, used for star ratings / analytics. */
  readonly parTime?: number;
}

export interface CompiledBrick {
  readonly col: number;
  readonly row: number;
  readonly type: string;
  readonly maxHp: number;
  /** Mutable: decremented on each hit. */
  hp: number;
  readonly score: number;
  readonly color: string;
  readonly indestructible: boolean;
  readonly damage: number;
  /** Centre position in design space. */
  readonly x: number;
  readonly y: number;
  /** Drawn size (cell minus gap). */
  readonly width: number;
  readonly height: number;
  /** Mutable: set true when hp reaches 0; the entry stays to preserve indices. */
  destroyed: boolean;
}

export interface CompiledLevel {
  readonly def: LevelDef;
  readonly cols: number;
  readonly rows: number;
  readonly bricks: readonly CompiledBrick[];
  /** Number of hp>0, non-indestructible bricks at spawn (win condition). */
  readonly brickCount: number;
}

/** Characters that always mean "no brick", regardless of legend. */
const EMPTY_CHARS = new Set([' ', '.', '_']);

/**
 * Validate a level definition without compiling it.
 * @returns an array of human-readable errors; empty means valid.
 */
export function validateLevel(def: LevelDef): string[] {
  const errors: string[] = [];
  if (!def.id) errors.push('level.id must be a non-empty string');
  if (!Array.isArray(def.layout) || def.layout.length === 0) {
    errors.push(`level "${def.id}": layout must be a non-empty array of strings`);
    return errors;
  }
  if (!def.legend || typeof def.legend !== 'object') {
    errors.push(`level "${def.id}": legend is required`);
    return errors;
  }

  const width = def.layout[0]!.length;
  def.layout.forEach((row, i) => {
    if (row.length !== width) {
      errors.push(
        `level "${def.id}": row ${i} has width ${row.length}, expected ${width} (rows must be equal length)`,
      );
    }
    for (const ch of row) {
      if (EMPTY_CHARS.has(ch)) continue;
      if (!(ch in def.legend)) {
        errors.push(`level "${def.id}": row ${i} uses "${ch}" which is missing from legend`);
      }
    }
  });

  for (const [key, spec] of Object.entries(def.legend)) {
    if (key.length !== 1) errors.push(`level "${def.id}": legend key "${key}" must be 1 char`);
    if (EMPTY_CHARS.has(key)) {
      errors.push(`level "${def.id}": legend key "${key}" is reserved as an empty cell`);
    }
    if (spec.hp <= 0) errors.push(`level "${def.id}": legend "${key}" hp must be > 0`);
    if (spec.score < 0) errors.push(`level "${def.id}": legend "${key}" score must be >= 0`);
  }

  let destructible = 0;
  for (const row of def.layout) {
    for (const ch of row) {
      if (EMPTY_CHARS.has(ch)) continue;
      const spec = def.legend[ch];
      if (spec && !spec.indestructible) destructible++;
    }
  }
  if (destructible === 0) {
    errors.push(`level "${def.id}": needs at least one destructible brick`);
  }

  return errors;
}

/** Compile a level into positioned bricks. Throws when the data is invalid. */
export function compileLevel(def: LevelDef, grid: GridLayout): CompiledLevel {
  const errors = validateLevel(def);
  if (errors.length > 0) {
    throw new Error(`Invalid level "${def.id}":\n  - ${errors.join('\n  - ')}`);
  }

  const rows = def.layout.length;
  const cols = def.layout[0]!.length;
  const gapX = grid.gapX ?? 0;
  const gapY = grid.gapY ?? 0;
  const bricks: CompiledBrick[] = [];
  let brickCount = 0;

  /** Row 0 is authored at the TOP of the layout, so it maps to the highest y. */
  for (let row = 0; row < rows; row++) {
    const line = def.layout[row]!;
    for (let col = 0; col < cols; col++) {
      const ch = line[col]!;
      if (EMPTY_CHARS.has(ch)) continue;
      const spec = def.legend[ch]!;
      const x = grid.originX + col * grid.cellWidth + grid.cellWidth / 2;
      const y = grid.originY - row * grid.cellHeight - grid.cellHeight / 2;
      const indestructible = spec.indestructible === true;
      if (!indestructible) brickCount++;
      bricks.push({
        col,
        row,
        type: ch,
        maxHp: spec.hp,
        hp: spec.hp,
        score: spec.score,
        color: spec.color,
        indestructible,
        damage: spec.damage ?? 1,
        x,
        y,
        width: grid.cellWidth - gapX,
        height: grid.cellHeight - gapY,
        destroyed: false,
      });
    }
  }

  return { def, cols, rows, bricks, brickCount };
}

/** Compile many levels at boot, surfacing every error at once. */
export function compileLevels(
  defs: readonly LevelDef[],
  grid: GridLayout,
): readonly CompiledLevel[] {
  const problems: string[] = [];
  const compiled: CompiledLevel[] = [];
  defs.forEach((def, i) => {
    const errors = validateLevel(def);
    if (errors.length > 0) {
      problems.push(...errors.map((e) => `[level ${i}] ${e}`));
      return;
    }
    compiled.push(compileLevel(def, grid));
  });
  if (problems.length > 0) {
    throw new Error(`Invalid level data:\n  - ${problems.join('\n  - ')}`);
  }
  return compiled;
}
