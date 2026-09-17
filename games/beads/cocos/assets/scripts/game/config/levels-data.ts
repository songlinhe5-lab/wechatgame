/**
 * ⚠️ GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: games/beads/design/levels/levels-01-08.json
 * Regenerate:      node tools/scripts/sync-levels-data.mjs --game=beads
 * Drift guard:     pnpm run levels:check（pnpm run verify 内；覆盖面断言见 WXG-T-048）
 *
 * Why a generated module instead of importing the JSON directly: Cocos Creator
 * only loads assets under its own `assets/` tree, and browsers cannot import
 * JSON in an ES module without an import attribute. A plain TS module works
 * everywhere — Cocos, vitest, tsc and the browser harness alike (breakout 判例).
 */

export interface BeadsLevelRaw {
  readonly id: number;
  readonly name: string;
  readonly cols: number;
  readonly rows: number;
  readonly time: number;
  /**
   * 错位交换对 `[[r1,c1,r2,c2], ...]`（levels-spec v1.2 §2.1 / systems-index
   * v1.23 §3.13）：按数组序对「pattern 全满」的可填格珠两两交换 ⇒ 初始错位局面。
   * 对数 k ∈ [MISPLACED_PAIRS_MIN(1), MISPLACED_PAIRS_MAX(8)]。
   * ⛔ `spawnInterval` 已随供料关停在 version 2 清理删除（E5）。
   */
  readonly swaps: readonly (readonly [number, number, number, number])[];
  /**
   * 环长分布（v1.23 增补，**建议值、不冻结**）：`short` 全 2-环 / `mixed` 长短
   * 混合 / `long` 偏长环。8 关数据暂一律 `short`（恒等式 misplaced = 2k 优先，
   * 长环与 levels-spec §2.1 恒等式冲突，已回传）。
   */
  readonly cycleProfile: 'short' | 'mixed' | 'long';
  /** Decoy colour characters (pattern charset, never part of the pattern). */
  readonly decoys: readonly string[];
  /**
   * Pattern rows, **top to bottom**. Charset `BEAD_CHARSET = ".x1-9A"`
   * (`.` = empty slot, `x` = locked bead, `1-9`+`A` = palette index 1–10).
   */
  readonly pattern: readonly string[];
}

export interface LevelsData {
  readonly version: number;
  readonly gameId: string;
  readonly description?: string;
  readonly levels: readonly BeadsLevelRaw[];
}

export const LEVELS_DATA: LevelsData = {
  version: 2,
  gameId: "beads",
  description: "拼豆填色消除 demo 前 8 关（ADR-0004 行字符串形态；字符集 .x1-9A；色板索引见 art-bible §3.2，1=奶白 2=柠黄 3=活力橙 4=草绿 5=玫红 6=丁香紫 7=湖蓝 8=赭棕）",
  levels: [
    {
      id: 1,
      name: "暖心",
      cols: 6,
      rows: 5,
      time: 120,
      swaps: [
        [
          0,
          1,
          2,
          1,
        ],
      ],
      cycleProfile: "short",
      decoys: [],
      pattern: [
        ".55.55",
        "555555",
        "515555",
        ".5556.",
        "..66..",
      ],
    },
    {
      id: 2,
      name: "小屋",
      cols: 8,
      rows: 6,
      time: 120,
      swaps: [
        [
          0,
          3,
          3,
          1,
        ],
        [
          0,
          4,
          3,
          2,
        ],
      ],
      cycleProfile: "short",
      decoys: [],
      pattern: [
        "...88...",
        "..8888..",
        ".888888.",
        ".333333.",
        ".321123.",
        ".333333.",
      ],
    },
    {
      id: 3,
      name: "摆尾小鱼",
      cols: 9,
      rows: 6,
      time: 120,
      swaps: [
        [
          0,
          2,
          0,
          8,
        ],
        [
          0,
          3,
          2,
          0,
        ],
      ],
      cycleProfile: "short",
      decoys: [],
      pattern: [
        "..7777..5",
        ".777777..",
        "27777771.",
        ".777777..",
        "..7777...",
        "...77....",
      ],
    },
    {
      id: 4,
      name: "结果的树",
      cols: 10,
      rows: 7,
      time: 135,
      swaps: [
        [
          0,
          4,
          0,
          5,
        ],
        [
          1,
          2,
          1,
          3,
        ],
        [
          1,
          4,
          4,
          4,
        ],
      ],
      cycleProfile: "short",
      decoys: [],
      pattern: [
        "....24....",
        "..414444..",
        ".44444444.",
        "4444444444",
        ".44454444.",
        "....88....",
        "....88....",
      ],
    },
    {
      id: 5,
      name: "猫脸",
      cols: 11,
      rows: 8,
      time: 180,
      swaps: [
        [
          0,
          1,
          1,
          2,
        ],
        [
          0,
          2,
          1,
          8,
        ],
        [
          0,
          8,
          2,
          3,
        ],
        [
          0,
          9,
          2,
          5,
        ],
      ],
      cycleProfile: "short",
      decoys: [],
      pattern: [
        ".33.....33.",
        ".353...353.",
        ".338383833.",
        ".337357333.",
        ".333111333.",
        "..3336333..",
        "..3333333..",
        "..3.333.3..",
      ],
    },
    {
      id: 6,
      name: "顺风帆船",
      cols: 12,
      rows: 9,
      time: 225,
      swaps: [
        [
          0,
          10,
          1,
          6,
        ],
        [
          0,
          11,
          1,
          7,
        ],
        [
          2,
          5,
          2,
          6,
        ],
        [
          2,
          7,
          2,
          8,
        ],
        [
          3,
          4,
          3,
          5,
        ],
      ],
      cycleProfile: "short",
      decoys: [],
      pattern: [
        "..........22",
        "......84....",
        ".....1881...",
        "....188881..",
        "...18588881.",
        ".8888888888.",
        ".788888887..",
        "777777777777",
        "x.66.777.7x.",
      ],
    },
    {
      id: 7,
      name: "升空热气球",
      cols: 13,
      rows: 10,
      time: 270,
      swaps: [
        [
          0,
          1,
          0,
          4,
        ],
        [
          0,
          5,
          0,
          8,
        ],
        [
          0,
          6,
          0,
          11,
        ],
        [
          0,
          7,
          1,
          2,
        ],
        [
          1,
          3,
          1,
          4,
        ],
        [
          1,
          5,
          1,
          9,
        ],
      ],
      cycleProfile: "short",
      decoys: [],
      pattern: [
        ".7..15551..7.",
        "..153333351.2",
        ".15333333351.",
        ".15333333351.",
        ".15333633351.",
        "..153333351..",
        ".....151.....",
        ".7..8...8..7.",
        "....88888....",
        "4.111...111.4",
      ],
    },
    {
      id: 8,
      name: "星际火箭",
      cols: 13,
      rows: 12,
      time: 360,
      swaps: [
        [
          0,
          6,
          3,
          0,
        ],
        [
          1,
          5,
          3,
          4,
        ],
        [
          1,
          6,
          3,
          5,
        ],
        [
          1,
          7,
          3,
          6,
        ],
        [
          2,
          4,
          3,
          7,
        ],
        [
          2,
          5,
          3,
          8,
        ],
        [
          2,
          6,
          4,
          3,
        ],
        [
          2,
          7,
          4,
          4,
        ],
      ],
      cycleProfile: "short",
      decoys: [],
      pattern: [
        "......5......",
        ".....555.....",
        "....55555....",
        "6...11111....",
        "...1177711...",
        "...1177711...",
        "...1111111...",
        "..551111155..",
        ".55..111..55.",
        "....23332....",
        ".....222.....",
        "8...444....8.",
      ],
    },
  ],
};
