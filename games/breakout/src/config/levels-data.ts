/**
 * ⚠️ GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: games/breakout/design/levels/levels-01-05.json
 * Regenerate:      node tools/scripts/sync-levels-data.mjs
 * Drift guard:     tests/levels-sync.test.ts (fails if this file disagrees)
 *
 * Why a generated module instead of importing the JSON directly: Cocos Creator
 * only loads assets under its own `assets/` tree, and browsers cannot import
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
  /** `null` means indestructible (infinite HP). */
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
   * Layout rows, **top to bottom**. Character set: `.NTSBG`
   * (`.` = empty cell, the rest are `brickTypes` keys).
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

export const LEVELS_DATA: LevelsData = {
  version: 1,
  gameId: "breakout",
  description: "打砖块前 5 关关卡数据。行序从上到下，每行长度必须等于 grid.cols。'.' 表示空位。",
  designResolution: {
    width: 750,
    height: 1334,
    fitMode: "FIXED_WIDTH",
  },
  grid: {
    cols: 10,
    brickW: 62,
    brickH: 34,
    gapX: 6,
    gapY: 6,
    originX: 38,
    topY: 1200,
    rowPitch: 40,
  },
  brickTypes: {
    N: {
      code: "N",
      name: "普通砖",
      hp: 1,
      score: 100,
      indestructible: false,
    },
    T: {
      code: "T",
      name: "硬砖",
      hp: 2,
      score: 250,
      indestructible: false,
      damagedVisual: true,
    },
    S: {
      code: "S",
      name: "钢砖",
      hp: null,
      score: 0,
      indestructible: true,
    },
    B: {
      code: "B",
      name: "炸弹砖",
      hp: 1,
      score: 150,
      indestructible: false,
      explode: {
        radius: 68,
        damage: 1,
        maxChain: 8,
      },
    },
    G: {
      code: "G",
      name: "金砖",
      hp: 1,
      score: 500,
      indestructible: false,
      dropRateMultiplier: 3,
    },
  },
  powerupPool: {
    expand: {
      id: "expand",
      name: "加宽挡板",
      weight: 30,
      durationMs: 15000,
      params: {
        paddleWidthMultiplier: 1.4,
      },
    },
    multi: {
      id: "multi",
      name: "三球",
      weight: 25,
      durationMs: 0,
      params: {
        splitCount: 3,
        splitAngleDeg: 25,
        maxBalls: 9,
      },
    },
    life: {
      id: "life",
      name: "加命",
      weight: 8,
      durationMs: 0,
      params: {
        maxLives: 5,
        overflowScore: 500,
      },
    },
    slow: {
      id: "slow",
      name: "减速球",
      weight: 20,
      durationMs: 10000,
      params: {
        speedMultiplier: 0.75,
        minSpeed: 240,
      },
    },
    sticky: {
      id: "sticky",
      name: "磁吸挡板",
      weight: 10,
      durationMs: 12000,
      params: {},
    },
    laser: {
      id: "laser",
      name: "激光挡板",
      weight: 7,
      durationMs: 10000,
      params: {
        cooldownMs: 500,
      },
    },
  },
  levels: [
    {
      id: 1,
      name: "热身",
      ballSpeed: 480,
      paddleWidth: 140,
      powerupDropRate: 0.1,
      livesOnEnter: 3,
      clearCondition: "all-destructible",
      powerupPool: [
        "expand",
        "multi",
        "life",
      ],
      hint: "拖动屏幕移动挡板",
      rows: [
        "NNNNNNNNNN",
        "NNNNNNNNNN",
        "NNNNNNNNNN",
      ],
    },
    {
      id: 2,
      name: "硬骨头",
      ballSpeed: 500,
      paddleWidth: 140,
      powerupDropRate: 0.14,
      clearCondition: "all-destructible",
      powerupPool: [
        "expand",
        "multi",
        "life",
      ],
      rows: [
        "TTTTTTTTTT",
        "NNNNNNNNNN",
        "NNNNNNNNNN",
        "NNNNNNNNNN",
      ],
    },
    {
      id: 3,
      name: "钢之回廊",
      ballSpeed: 520,
      paddleWidth: 140,
      powerupDropRate: 0.12,
      clearCondition: "all-destructible",
      powerupPool: [
        "expand",
        "multi",
        "life",
        "slow",
      ],
      rows: [
        "SSNNNNNNSS",
        "NNTTNNTTNN",
        "NNNNNNNNNN",
        ".NNNNNNNN.",
        "..NNNNNN..",
      ],
    },
    {
      id: 4,
      name: "连锁爆破",
      ballSpeed: 540,
      paddleWidth: 140,
      powerupDropRate: 0.14,
      clearCondition: "all-destructible",
      powerupPool: [
        "expand",
        "multi",
        "life",
        "slow",
      ],
      rows: [
        "TTTTTTTTTT",
        "TTNNNNNNTT",
        "NBBNNNNBBN",
        "NNTNNNNTNN",
      ],
    },
    {
      id: 5,
      name: "霓虹终章",
      ballSpeed: 560,
      paddleWidth: 140,
      powerupDropRate: 0.12,
      clearCondition: "all-destructible",
      powerupPool: [
        "expand",
        "multi",
        "life",
        "slow",
        "sticky",
      ],
      rows: [
        "SSTTTTTTSS",
        "TTNNGGNNTT",
        "NBBNNNNBBN",
        "NNTNNTNNTT",
        ".NNNNNNNN.",
      ],
    },
  ],
};
