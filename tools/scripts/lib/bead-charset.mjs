/**
 * bead-charset.mjs — 工具侧（生成端 / 关卡内容管线）唯一的 pattern 字符表。
 *
 * 为什么要提出来：`systems-index.md §3.2` **v1.55** 把 `BEAD_COLOR_MAX` 由 10 抬到
 * **35**、`BEAD_CHARSET` 由 `.x1-9A` 扩为 `.x1-9A-Z`。在此之前同一份「字符 ↔ 色索引」
 * 映射在全仓有 **4 份独立实现**（`config/levels.ts` / `entities/grid.ts` /
 * `game/misplaced-assembler.ts` / `tools/scripts/level-derange.mjs`），且已经漂过：
 * `level-derange.mjs` 带的是 12 枚表（`123456789ABCDEFGHIJK`），Plate 出 12 色以上的盘
 * 会**静默丢色**（`CHAR[i] === undefined`）。正本 §5-A8 要求与 `beads-gen.mjs` 合一，
 * 其 `ponytail:` 注释自认「刻意不共用 = 已知债」，本模块即为还债点。
 *
 * 游戏侧同源件 = `games/beads/src/config/bead-charset.ts`（TypeScript，运行时真源）。
 * 两者跨语言，判据 **X1** 由 `games/beads/tests/bead-charset.test.ts` 以「文本抽取
 * 表字面量 + 逐字符比对」锁死（不能 import ：TS 测试引 `.mjs` 会破 `tsc --noEmit`，
 * 判例见 `games/beads/tests/levels-dir-pipeline.test.ts` 头注）。
 *
 * 大小写敏感是契约的一部分（§3.2 v1.55）：`x` = 锁定符、`X` = 色索引 **33**（`Y`=34、`Z`=35）。
 * `String.prototype.indexOf` 天然精确匹配，任何 `toUpperCase()` / 正则 `i` flag
 * 都是契约破坏。
 */

/** 空位（无图案位）：不可填、不计完成。 */
export const EMPTY_CHAR = '.';
/** 锁定格：不可填、不计完成（渲染为斜纹收边）。 */
export const LOCKED_CHAR = 'x';

/**
 * 色索引字符表（§3.2 v1.55）：`1-9` = 1–9、`A-Z` = 10–35，**只收大写**。
 * 35 = 单字符 rowstring（每格一字符，ADR-0004）形态的编码天花板。
 * ⚠️ 改这一行必须同步改 `tuning.ts` 的 `BEAD_COLOR_MAX` / `BEAD_CHARSET`，
 * 否则 X1 断言红。
 */
export const BEAD_COLOR_CHARS = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 本表可表达的最大色索引 = 工具侧天花板（等价 `BEAD_COLOR_MAX`，由 X1 锁死）。 */
export const BEAD_COLOR_MAX = BEAD_COLOR_CHARS.length;

/**
 * `.` / `x` / 非法字符 → **0**（不可填）；色索引字符 → 1-based 索引。
 *
 * ⚠️ 与游戏侧 `colorIndexOfChar` **故意不同名**：那边是三态（`null` = `.`/`x`、
 * `undefined` = 非法、数字 = 色索引），校验器需要区分「非法字符」与「空位」；
 * 工具侧只管编码，统一压成 0 就够。两者对 `'1'..'9'` / `'A'..'Z'` 的**映射**必须
 * 逐字符一致（判据 X1 校的是映射，不是返回值形态）。
 */
export function baseColorOfChar(ch) {
  const pos = BEAD_COLOR_CHARS.indexOf(ch);
  return pos < 0 ? 0 : pos + 1;
}

/** 1-based 色索引 → 字符；越界返回 `undefined`（调用方须显式处理，勿静默拼串）。 */
export function charOfColor(colorIdx) {
  return BEAD_COLOR_CHARS[colorIdx - 1];
}

/** 字符是否在 `BEAD_CHARSET` 内（与 {@link baseColorOfChar} 同表，不会「合法但解不出」）。 */
export function isBeadCharsetChar(ch) {
  return ch === EMPTY_CHAR || ch === LOCKED_CHAR || BEAD_COLOR_CHARS.indexOf(ch) >= 0;
}
