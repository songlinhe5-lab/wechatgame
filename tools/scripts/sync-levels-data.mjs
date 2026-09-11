#!/usr/bin/env node
/**
 * sync-levels-data.mjs — regenerate `src/config/levels-data.ts` from the
 * authoritative design JSON.
 *
 * WHY THIS EXISTS
 * ---------------
 * `games/breakout/design/levels/levels-01-05.json` is the single source of truth
 * for level content (frozen by `design/gdd/systems-index.md §3`). But importing
 * a `.json` file *outside* `src/` does not work in every consumer we must
 * support:
 *   - Cocos Creator only loads assets that live under its `assets/` tree and
 *     requires a `.json` asset type;
 *   - a raw browser ESM module cannot import JSON without an import attribute.
 *
 * So we generate a plain TypeScript module that `src/` imports normally. The
 * generated file is a **build artifact**; the JSON stays authoritative. Drift is
 * impossible because `tests/levels-sync.test.ts` re-derives the module and fails
 * when the committed file disagrees.
 *
 * USAGE
 *   node tools/scripts/sync-levels-data.mjs          # write the module
 *   node tools/scripts/sync-levels-data.mjs --check  # verify, exit 1 on drift
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

export const SOURCE_JSON = resolve(
  root,
  'games/breakout/design/levels/levels-01-05.json',
);
export const TARGET_TS = resolve(
  root,
  'games/breakout/src/config/levels-data.ts',
);

const HEADER = `/**
 * ⚠️ GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: games/breakout/design/levels/levels-01-05.json
 * Regenerate:      node tools/scripts/sync-levels-data.mjs
 * Drift guard:     tests/levels-sync.test.ts (fails if this file disagrees)
 *
 * Why a generated module instead of importing the JSON directly: Cocos Creator
 * only loads assets under its own \`assets/\` tree, and browsers cannot import
 * JSON in an ES module without an import attribute. A plain TS module works
 * everywhere — Cocos, vitest, tsc and the browser harness alike.
 */

export type BrickTypeCode = 'N' | 'T' | 'S' | 'B' | 'G';
export type PowerupId = 'expand' | 'multi' | 'life' | 'slow' | 'sticky' | 'laser';

export interface LevelsGrid {
  readonly cols: number;
  readonly brickW: number;
  readonly brickH: number;
  readonly gapX: number;
  readonly gapY: number;
  /** Column 0 brick *left edge* x. */
  readonly originX: number;
  /** Row 0 brick *top edge* y. */
  readonly topY: number;
  /** Row pitch = brickH + gapY. */
  readonly rowPitch: number;
}

export interface ExplodeDef {
  readonly radius: number;
  readonly damage: number;
  readonly maxChain: number;
}

export interface BrickTypeData {
  readonly code: BrickTypeCode;
  readonly name: string;
  /** \`null\` means indestructible (infinite HP). */
  readonly hp: number | null;
  readonly score: number;
  readonly indestructible: boolean;
  readonly damagedVisual?: boolean;
  readonly explode?: ExplodeDef;
  readonly dropRateMultiplier?: number;
}

export interface PowerupData {
  readonly id: PowerupId;
  readonly name: string;
  readonly weight: number;
  readonly durationMs: number;
  readonly params: Readonly<Record<string, number>>;
}

export interface LevelData {
  readonly id: number;
  readonly name: string;
  readonly ballSpeed: number;
  readonly paddleWidth: number;
  readonly powerupDropRate: number;
  readonly livesOnEnter?: number;
  readonly clearCondition: string;
  readonly powerupPool: readonly PowerupId[];
  readonly hint?: string;
  /**
   * Layout rows, **top to bottom**. Character set: \`.NTSBG\`
   * (\`.\` = empty cell, the rest are \`brickTypes\` keys).
   */
  readonly rows: readonly string[];
}

export interface LevelsData {
  readonly version: number;
  readonly gameId: string;
  readonly description?: string;
  readonly designResolution: {
    readonly width: number;
    readonly height: number;
    readonly fitMode: string;
  };
  readonly grid: LevelsGrid;
  readonly brickTypes: Readonly<Record<BrickTypeCode, BrickTypeData>>;
  readonly powerupPool: Readonly<Record<string, PowerupData>>;
  readonly levels: readonly LevelData[];
}
`;

/** Render a JS value as pretty, deterministic TypeScript source. */
function render(value, indent = 0) {
  const pad = '  '.repeat(indent);
  const inner = '  '.repeat(indent + 1);

  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((v) => `${inner}${render(v, indent + 1)}`);
    return `[\n${items.join(',\n')},\n${pad}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    const items = keys.map(
      (k) => `${inner}${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${render(value[k], indent + 1)}`,
    );
    return `{\n${items.join(',\n')},\n${pad}}`;
  }
  return JSON.stringify(value);
}

/**
 * Build the exact source text for the generated module.
 * Exported so the drift-guard test can reproduce it without writing files.
 */
export function buildModuleSource() {
  const raw = readFileSync(SOURCE_JSON, 'utf8');
  const data = JSON.parse(raw);
  return `${HEADER}\nexport const LEVELS_DATA: LevelsData = ${render(data, 0)};\n`;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const expected = buildModuleSource();

  let actual = null;
  try {
    actual = readFileSync(TARGET_TS, 'utf8');
  } catch {
    actual = null;
  }

  const inSync = actual === expected;

  if (checkOnly) {
    if (inSync) {
      console.log('✅ levels-data.ts is in sync with levels-01-05.json');
      process.exit(0);
    }
    console.error(
      '❌ levels-data.ts is OUT OF SYNC with levels-01-05.json.\n' +
        '   Run: node tools/scripts/sync-levels-data.mjs',
    );
    process.exit(1);
  }

  if (inSync) {
    console.log('✅ already in sync — nothing to do');
    return;
  }

  writeFileSync(TARGET_TS, expected, 'utf8');
  console.log(`✍️  wrote ${TARGET_TS.replace(`${root}/`, '')}`);
}

// Only run when invoked directly (so the test can import buildModuleSource).
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
