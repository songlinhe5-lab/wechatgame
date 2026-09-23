/**
 * ⚠️ GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: games/beads/design/levels/{manifest.json,palette.json,singles/,plates/}
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
   * 全错位初盘（可选；v1.3）。rowstring，字符集同 `pattern`（`.x1-9A`），逐格给出
   * **初始珠色**。存在则**替代 `swaps`** 作初盘真源（引擎直读装配、零 RNG ⇒ 输出确定），
   * 用于表达「成片错豆」（swaps 封顶 8 对 ≤16 颗不够）。BOOT 校验：形状一致 +
   * 可填轮廓逐格匹配 pattern + 每色珠数守恒 + 错位格数 ≥1（不强制 100% 全错）。
   * 缺省 ⇒ 走 `swaps` 路径（旧语义零扰动）。见 levels-spec §2.2 / systems-index §3.13。
   */
  readonly misplaced?: readonly string[];
  /**
   * Pattern rows, **top to bottom**. Charset `BEAD_CHARSET = ".x1-9A"`
   * (`.` = empty slot, `x` = locked bead, `1-9`+`A` = palette index 1–10).
   */
  readonly pattern: readonly string[];
  /**
   * 本关品牌色板引用（可选，v1.40）：slug ↔ `games/beads/art/<slug>.json`
   * （如 `'artkal-s'`）。与 {@link paletteCodes} 成对出现；缺省 ⇒ demo 默认色板。
   * hex 不随关卡携带 —— 只住品牌生成物（`palettes-data.ts`，art/ 编译期打包）。
   */
  readonly palette?: string;
  /**
   * 本关用到的品牌色号（可选，v1.40）：紧凑序，`paletteCodes[colorIdx-1]` ↔ 索引
   * colorIdx，逐项存在于 `PALETTES[palette].codes`。charset/`BEAD_COLOR_MAX`
   * 上限不变（≤10）。缺省 ⇒ demo 默认色板。
   */
  readonly paletteCodes?: readonly string[];
}

export interface LevelsData {
  readonly version: number;
  readonly gameId: string;
  /**
   * 默认珠色板（可选，v1.40）：demo 关卡（无逐关 `paletteHex`）的渲染色板，
   * 值 = 原 art-bible §3.2 十色（v1.40 起真源降级为关卡数据，`game-10.json` 已删除）。
   */
  readonly palette?: readonly string[];
  readonly description?: string;
  readonly levels: readonly BeadsLevelRaw[];
}

export const LEVELS_DATA: LevelsData = {
  version: 2,
  gameId: "beads",
  palette: [
    "#FDF6E9",
    "#FFD23F",
    "#F59B23",
    "#3FBF6B",
    "#E84C3D",
    "#8E6FD9",
    "#3D7BF5",
    "#A5652C",
    "#6B3E1E",
    "#33333D",
  ],
  description: "关卡内容管线目录化真源（P1/P2）。WXG-T-203 pre-release 重置第二批：原 demo 8 关（L00001–L00008）已按用户裁定移出，关表由 beads-studio 生成的盘逐张入关重建；uid 5 位零填充、order 从 1 只追加。字符集与色板口径见 levels-spec §2 / art-bible §3.2。",
  levels: [
    {
      id: 1,
      name: "studio-2-3851",
      cols: 14,
      rows: 13,
      time: 84,
      cycleProfile: "short",
      decoys: [],
      pattern: [
        "..322....223..",
        ".333333333333.",
        "33333333333333",
        "23323333332332",
        "23332333323332",
        "33333333333333",
        ".332221122222.",
        ".222222222222.",
        "..2222222222..",
        "...22222222...",
        "....222222....",
        ".....2222.....",
        "......22......",
      ],
      swaps: [],
      misplaced: [
        "..133....331..",
        ".222222222222.",
        "22222222222222",
        "32232222223223",
        "32223222232223",
        "22222222222222",
        ".223333333333.",
        ".333333333333.",
        "..3333333333..",
        "...33333333...",
        "....333333....",
        ".....3333.....",
        "......33......",
      ],
      palette: "artkal-s",
      paletteCodes: [
        "S01",
        "S05",
        "S130",
      ],
    },
    {
      id: 2,
      name: "studio-0-1f55",
      cols: 14,
      rows: 13,
      time: 143,
      cycleProfile: "short",
      decoys: [],
      pattern: [
        ".....111144...",
        "....1144114...",
        "...11433411...",
        "..1143443411..",
        ".114342243411.",
        "11433344333411",
        "33333333333333",
        ".333344443333.",
        ".352544445253.",
        ".322544445223.",
        ".333344443333.",
        ".434344443434.",
        ".444444444444.",
      ],
      swaps: [],
      misplaced: [
        ".....333355...",
        "....3355335...",
        "...33544133...",
        "..3314114133..",
        ".331413314133.",
        "33144411444133",
        "44444444444444",
        ".444411114444.",
        ".433311113434.",
        ".444311123444.",
        ".444422224444.",
        ".242423334343.",
        ".333333333333.",
      ],
      palette: "artkal-s",
      paletteCodes: [
        "S05",
        "S138",
        "S154",
        "S17",
        "SE1",
      ],
    },
    {
      id: 3,
      name: "studio-6-82ed",
      cols: 14,
      rows: 12,
      time: 118,
      cycleProfile: "short",
      decoys: [],
      pattern: [
        "......3.......",
        "...66335......",
        "..24222233....",
        ".61622222.....",
        "6616236262....",
        "622226242222..",
        ".6242423622226",
        "....55.3.2222.",
        ".....3...22266",
        "........2662..",
        ".......266....",
        ".......66.....",
      ],
      swaps: [],
      misplaced: [
        "......1.......",
        "...22222......",
        "..32333322....",
        ".22233334.....",
        "2222422424....",
        "255562626666..",
        ".2626262266662",
        "....22.2.6666.",
        ".....2...66622",
        "........6226..",
        ".......122....",
        ".......22.....",
      ],
      palette: "artkal-s",
      paletteCodes: [
        "S01",
        "S107",
        "S109",
        "S11",
        "S27",
        "S73",
      ],
    },
    {
      id: 4,
      name: "studio-3-eb90",
      cols: 14,
      rows: 14,
      time: 98,
      cycleProfile: "short",
      decoys: [],
      pattern: [
        ".....2222.....",
        "...22222532...",
        "..2222422222..",
        "..2222222444..",
        ".222222242222.",
        "22224212222222",
        "22222442414422",
        ".2444434445422",
        "2444443344444.",
        ".444..3334444.",
        "......33......",
        "......33......",
        "......33......",
        "...34333443...",
      ],
      swaps: [],
      misplaced: [
        ".....3333.....",
        "...33333223...",
        "..3333233334..",
        "..4444444222..",
        ".444444424444.",
        "44442424444444",
        "44444224222244",
        ".5222222222251",
        "1222222222222.",
        ".222..2222222.",
        "......22......",
        "......22......",
        "......22......",
        "...22222222...",
      ],
      palette: "artkal-s",
      paletteCodes: [
        "S05",
        "S124",
        "S148",
        "S91",
        "SP3",
      ],
    },
    {
      id: 5,
      name: "studio-5-21cd",
      cols: 14,
      rows: 13,
      time: 288,
      cycleProfile: "short",
      decoys: [],
      pattern: [
        ".22........22.",
        "2676......6762",
        "22166555566122",
        "22277577577622",
        ".577777777775.",
        ".576576676675.",
        ".5534511543552",
        "27763522536772",
        "25566222266552",
        "27772122127762",
        ".662122221266.",
        "..2211111122..",
        "....2222222...",
      ],
      swaps: [],
      misplaced: [
        ".33........33.",
        "4727......7274",
        "55277777771255",
        "55522722722155",
        ".722222222227.",
        ".721721121127.",
        ".7766722776775",
        "52216755761225",
        "57711555511775",
        "52225256262216",
        ".226266662622.",
        "..6622222266..",
        "....6666666...",
      ],
      palette: "artkal-s",
      paletteCodes: [
        "S01",
        "S07",
        "S124",
        "S13",
        "S41",
        "S47",
        "S97",
      ],
    },
    {
      id: 6,
      name: "studio-0-0a91",
      cols: 12,
      rows: 16,
      time: 205,
      cycleProfile: "short",
      decoys: [],
      pattern: [
        ".....52.....",
        ".....2222...",
        "....512.....",
        "..6222225...",
        ".555555655..",
        ".5565555655.",
        "55555555655.",
        "655655556555",
        "665655556555",
        "566666666665",
        ".6666656665.",
        "...61112....",
        "..11111115..",
        ".744414417..",
        "73347473737.",
        ".77.333777..",
      ],
      swaps: [],
      misplaced: [
        ".....65.....",
        ".....5555...",
        "....655.....",
        "..1555556...",
        ".666666166..",
        ".6616666166.",
        "66666666166.",
        "266277772777",
        "227277772111",
        "122222333331",
        ".3344414441.",
        "...45555....",
        "..55555551..",
        ".555555555..",
        "55555555555.",
        ".55.555555..",
      ],
      palette: "artkal-s",
      paletteCodes: [
        "S16",
        "S17",
        "S24",
        "S64",
        "S93",
        "SE14",
        "SG3",
      ],
    },
    {
      id: 7,
      name: "studio-1-90bb",
      cols: 10,
      rows: 14,
      time: 111,
      cycleProfile: "short",
      decoys: [],
      pattern: [
        "...4777...",
        ".77522777.",
        ".42712224.",
        "7217411172",
        "7127447177",
        "7722647277",
        ".72747224.",
        ".4774224..",
        "..77724...",
        "...777....",
        "...66.....",
        "...3......",
        "..353.....",
        "..353.....",
      ],
      swaps: [],
      misplaced: [
        "...7111...",
        ".11744112.",
        ".74245557.",
        "2642744426",
        "2462772422",
        "2277772722",
        ".27272777.",
        ".7337777..",
        "..33377...",
        "...444....",
        "...77.....",
        "...7......",
        "..777.....",
        "..777.....",
      ],
      palette: "artkal-s",
      paletteCodes: [
        "S106",
        "S124",
        "S148",
        "S34",
        "S81",
        "S92",
        "SE09",
      ],
    },
    {
      id: 8,
      name: "studio-0-5a1d",
      cols: 8,
      rows: 15,
      time: 84,
      cycleProfile: "short",
      decoys: [],
      pattern: [
        "...33...",
        "...33...",
        "..4444..",
        "..4444..",
        "..4447..",
        "..7444..",
        ".444448.",
        ".444424.",
        ".474474.",
        ".822428.",
        ".212212.",
        "..6556..",
        "..6556..",
        ".665566.",
        "66.55.66",
      ],
      swaps: [],
      misplaced: [
        "...44...",
        "...44...",
        "..5555..",
        "..5555..",
        "..6664..",
        "..4666..",
        ".666664.",
        ".677747.",
        ".848841.",
        ".444144.",
        ".444444.",
        "..3223..",
        "..3223..",
        ".442244.",
        "44.22.44",
      ],
      palette: "artkal-s",
      paletteCodes: [
        "S01",
        "S13",
        "S144",
        "S159",
        "S47",
        "S66",
        "S89",
        "SE17",
      ],
    },
  ],
};
