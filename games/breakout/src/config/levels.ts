/**
 * Breakout brick types + level table.
 *
 * ⚠️ AUTHORITY: content comes from
 * `design/levels/levels-01-05.json` via the generated `./levels-data.ts`
 * (regenerate with `node tools/scripts/sync-levels-data.mjs`). Nothing in this
 * file may re-declare HP, score, speed or layout — those are owned by the data,
 * which in turn is frozen by `design/gdd/systems-index.md §3`.
 *
 * What *does* live here:
 *   - the mapping from the data's brick codes to the framework's `BrickTypeSpec`
 *     (the framework needs a colour and a numeric hp, so `S` becomes `Infinity`);
 *   - the special-brick behaviour the framework cannot express (explosion,
 *     gold drop multiplier);
 *   - the `powerupPool ∩ IMPLEMENTED_POWERUPS` rule from §3.6.
 *
 * Layout rows are authored top-down; the framework compiler maps row 0 to the
 * highest y.
 */

import type { BrickTypeSpec, LevelDef } from '@wxgame/framework';
import {
  LEVELS_DATA,
  type BrickTypeCode,
  type LevelData,
  type PowerupId,
} from './levels-data.js';
import { IMPLEMENTED_POWERUPS } from './tuning.js';

export type { BrickTypeCode, LevelData, PowerupId } from './levels-data.js';

/** Every brick code the data may use. */
export const BRICK_CODES = ['N', 'T', 'S', 'B', 'G'] as const;

/** Layout characters. `.` is the empty cell, handled by the framework. */
export const BRICK_CHARS = {
  normal: 'N',
  tough: 'T',
  steel: 'S',
  bomb: 'B',
  gold: 'G',
} as const;

/** The empty-cell character used in `rows`. */
export const EMPTY_CHAR = '.';

/** Full character set permitted in a level's `rows` (levels-spec §2.4/§5). */
export const LEVEL_CHARSET = `.${BRICK_CODES.join('')}`;

/**
 * Brick colours, owned by `art/art-bible.md §2`. Colour is a presentation
 * concern, so it lives here rather than in the design data.
 */
export const BRICK_COLORS: Readonly<Record<BrickTypeCode, string>> = {
  N: '#35C2F0', // 青 — plain block
  T: '#A96BFF', // 紫 — cracked texture, darkens to #7649B3 when damaged
  S: '#8892A6', // 钢灰 — sheen + rivets + double outline
  B: '#FF6B3D', // 橙红 — explicit bomb glyph
  G: '#FFCB3D', // 金 — coin glyph
};

/**
 * Special behaviour the framework's `BrickTypeSpec` cannot carry.
 * Keyed by brick code; mirrors `LevelsData['brickTypes']`.
 */
export interface BrickBehavior {
  /** Bomb bricks damage neighbours within `radius` of their centre. */
  readonly explode?: { readonly radius: number; readonly damage: number; readonly maxChain: number };
  /** Drop-chance multiplier (gold bricks: ×3, capped at 1.0). */
  readonly dropRateMultiplier?: number;
}

export const BRICK_BEHAVIOR: Readonly<Record<BrickTypeCode, BrickBehavior>> = {
  N: {},
  T: {},
  S: {},
  B: { explode: LEVELS_DATA.brickTypes.B.explode! },
  G: { dropRateMultiplier: LEVELS_DATA.brickTypes.G.dropRateMultiplier ?? 1 },
};

/**
 * Framework-facing brick specs.
 *
 * HP and score are read straight from the data. `S` is indestructible, so the
 * framework needs `hp > 0`; `Infinity` expresses "never loses HP" while keeping
 * the validation rule (hp must be > 0) satisfied.
 */
export const BRICK_TYPES: Readonly<Record<BrickTypeCode, BrickTypeSpec>> = Object.freeze(
  Object.fromEntries(
    BRICK_CODES.map((code): [BrickTypeCode, BrickTypeSpec] => {
      const def = LEVELS_DATA.brickTypes[code];
      return [
        code,
        {
          hp: def.indestructible ? Number.POSITIVE_INFINITY : (def.hp ?? 1),
          score: def.score,
          color: BRICK_COLORS[code],
          indestructible: def.indestructible,
          damage: def.explode?.damage ?? 1,
        },
      ];
    }),
  ) as Record<BrickTypeCode, BrickTypeSpec>,
);

/** Legend handed to the framework compiler. Shared by every level. */
const LEGEND: Readonly<Record<string, BrickTypeSpec>> = BRICK_TYPES;

/** The authoritative raw level records, keyed by their stable `l<id>` string. */
export const LEVEL_DATA: readonly LevelData[] = LEVELS_DATA.levels;

/** Framework level ids in order, e.g. `['l1','l2','l3','l4','l5']`. */
export function levelIdOf(data: LevelData): string {
  return `l${data.id}`;
}

/**
 * The shipped level table, straight from the design data.
 *
 * `ballSpeed` / `paddleWidth` are always explicit — we do **not** extrapolate
 * speed per level index (see `systems-index §3.4`).
 */
export const LEVELS: readonly LevelDef[] = Object.freeze(
  LEVEL_DATA.map((data) => ({
    id: levelIdOf(data),
    name: data.name,
    layout: data.rows,
    legend: LEGEND,
    ballSpeed: data.ballSpeed,
    paddleWidth: data.paddleWidth,
  })),
);

/** Look up a level by its stable id. */
export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

/** Look up the raw design record (drop rate, powerup pool, hint) by level id. */
export function levelDataById(id: string): LevelData | undefined {
  const index = LEVELS.findIndex((l) => l.id === id);
  return index >= 0 ? LEVEL_DATA[index] : undefined;
}

/**
 * Point the framework at this game's level table; the registry is the single
 * source of truth for "what levels exist".
 */
export const BREAKOUT_LEVEL_IDS: readonly string[] = Object.freeze(LEVELS.map((l) => l.id));

/**
 * Powerups that may actually drop on a level.
 *
 * §3.6: the effective candidate set is `level.powerupPool ∩ IMPLEMENTED_POWERUPS`.
 * Ids that are defined but not implemented are **silently ignored** — never an
 * error — and the remaining weights re-normalise across the survivors.
 */
export function droppablePowerups(levelData: LevelData): readonly PowerupId[] {
  const implemented = new Set<string>(IMPLEMENTED_POWERUPS);
  return levelData.powerupPool.filter((id) => implemented.has(id));
}

/**
 * Relative drop weights for a level's *implemented* powerups, re-normalised.
 * Returns `[]` when nothing is droppable.
 */
export function powerupWeights(levelData: LevelData): readonly { id: PowerupId; weight: number }[] {
  const ids = droppablePowerups(levelData);
  const total = ids.reduce((sum, id) => sum + (LEVELS_DATA.powerupPool[id]?.weight ?? 0), 0);
  if (total <= 0) return [];
  return ids.map((id) => ({
    id,
    weight: (LEVELS_DATA.powerupPool[id]?.weight ?? 0) / total,
  }));
}

/** Base powerup drop chance for a level (gold bricks multiply this). */
export function dropRateFor(levelData: LevelData): number {
  return levelData.powerupDropRate;
}
