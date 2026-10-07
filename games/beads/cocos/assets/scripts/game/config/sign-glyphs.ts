/**
 * 招牌珠拼字模位表（`beadText`）— WXG-T-269-S6 · 子单 T-2B（EP12-S6 美术半边落码）。
 *
 * ## 真源（⛔ 本文件不自拟字形）
 * `games/beads/art/menu-wall-signage-spec.md`（林绘澄 T-1）**§1.5 推荐档 `10×10 @ d=12` 位表**，
 * 四枚字模 `拼 / 豆 / 小 / 铺` 的 40 枚行字符串**逐字转写**（含每字珠数 37 / 38 / 19 / 54 ⇒
 * 合计 **148 珠**，由 `tests/menu-signage-beadtext.test.ts` 与本表自算值逐字对撞，抄错即红）。
 *
 * ⛔ **不预支 `12×12` 位表**（T-1 §1.6：该档在口径 B 下破地板 ⇒ 「不出一份无人消费的第二套字模数据」）；
 * `8×8` 回落档（§1.2）同样**不入本表** —— 它是回退杠杆（§3.8 序 5），触发时须 art 回单补数据，
 * 工程侧只预留 `SIGN.FALLBACK_MATRIX_N` 的档名与算式（见 `tuning.ts::SIGN`），⛔ 不伪造位表。
 *
 * ## 位表语义（T-1 §0.5，⛔ 位序歧义是首要风险）
 * - **行主序（row-major）**，每行一枚定长字符串；`#` = 该格位**有珠**，`.` = 无珠。
 *   ⇒ 本文件的新增物**只有布尔位表**（S0 硬约束②：位图 +0 KB，不是美术文件、不是字体文件）。
 * - **`rows[0]`（`r00`）= 视觉顶行**（自上而下编号）、`rows[r][0]`（`c00`）= 视觉最左列。
 * - 设计空间 **y 向上、原点左下**（`control-manifest §8` / `art-bible §4.1`）⇒ 换算住在
 *   `view/menu-signage.ts`（`y = glyphTop − (r + 0.5)·d`、`x = glyphLeft + (c + 0.5)·d`）；
 *   「反位」（把 `r00` 当底行）会让 `小` 的卧钩与 `铺` 的底横翻到字顶 ⇒ 字形作废，
 *   故 `tests/menu-signage-beadtext.test.ts` 逐行钉死（含**反位探针**）。
 *
 * ## 查表口径（L4 零 RNG / §2 热路径零分配）
 * 字模按 **Unicode 码点**（number）索引 ⇒ `Map.get(codePoint)` **零字符串分配**；
 * 若按字符键索引，逐珠取键会经 `charCodeAt → String` 造出临时串（CJK 不在 V8 单字符缓存内）。
 * 位表行本身是模块级冻结字符串 ⇒ 逐格判定走 `row.charCodeAt(c) === HASH_CODE`（零分配）。
 * 本文件全部为**确定性数据**：无 `Math.random()`、无时间/IO 依赖（L4）。
 *
 * 层级：config 数据表（L2/L3 clean：无 `cc`、无 DOM、无 `wx`）。
 */

/** 位表里有珠格的字符（T-1 §0.5）。 */
const HASH_CODE = 0x23; /* '#' */

/** 字模条目（`n` 与 `beads` 由行串**自算** ⇒ 与位表天然同步，不存在第二份可漂移的读数）。 */
export interface SignGlyph {
    /** 码点（= 招牌串里的字符）。 */
    readonly codePoint: number;
    /** 字符本身（仅供日志/测试可读，⛔ 不参与渲染热路径的键查找）。 */
    readonly char: string;
    /** 位表边长 `n`（`10×10` 档 ⇒ 10）。 */
    readonly n: number;
    /** 行主序位表（`rows[0]` = 视觉顶行）。 */
    readonly rows: readonly string[];
    /** 该字模的珠数（`#` 计数）。 */
    readonly beads: number;
}

/**
 * 位表原文（逐字转写自 T-1 §1.5；行序 = 招牌阅读序 `拼豆小铺`）。
 * ⚠ 每行**必须**等长且长度 = `n`（构造期校验，见 `buildGlyph`）。
 */
const GLYPH_SOURCE: readonly (readonly [char: string, rows: readonly string[]])[] = [
    [
        '拼',
        [
            '..#..#...#',
            '..#...#.#.',
            '####......',
            '..#..#####',
            '..#.......',
            '..#..#####',
            '..#...#.#.',
            '..#...#.#.',
            '.###.#..#.',
            '.#...#..#.',
        ],
    ],
    [
        '豆',
        [
            '.########.',
            '..........',
            '..######..',
            '..#....#..',
            '..######..',
            '..........',
            '...#..#...',
            '..#....#..',
            '.#......#.',
            '##########',
        ],
    ],
    [
        '小',
        [
            '....#.....',
            '....#.....',
            '....#.....',
            '....#.....',
            '...###....',
            '..#.#.#...',
            '.#..#..#..',
            '#...#...#.',
            '....#....#',
            '...#......',
        ],
    ],
    [
        '铺',
        [
            '..#...#...',
            '#...######',
            '###...#...',
            '..#.######',
            '###.#.#..#',
            '..#..####.',
            '###.#.#..#',
            '..#..####.',
            '..#.#.#..#',
            '.##.######',
        ],
    ],
];

function countBeads(rows: readonly string[]): number {
    let total = 0;
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r]!;
        for (let c = 0; c < row.length; c++) {
            if (row.charCodeAt(c) === HASH_CODE) total++;
        }
    }
    return total;
}

/** 构造期校验（一次性、非热路径）：行长一致 + 字符闭集 `{#,.}` ⇒ 位表不可「半坏」地进帧。 */
function buildGlyph(char: string, rows: readonly string[]): SignGlyph {
    const n = rows.length;
    for (let r = 0; r < n; r++) {
        const row = rows[r]!;
        if (row.length !== n) {
            throw new Error(`sign-glyphs: 「${char}」r${String(r).padStart(2, '0')} 长 ${row.length} ≠ n ${n}（位表必须为 n×n 方阵）`);
        }
        for (let c = 0; c < n; c++) {
            const k = row.charCodeAt(c);
            if (k !== HASH_CODE && k !== 0x2e /* '.' */) {
                throw new Error(`sign-glyphs: 「${char}」r${String(r).padStart(2, '0')}c${String(c).padStart(2, '0')} 非法字符 ${String.fromCharCode(k)}（位表字符集 = {#, .}）`);
            }
        }
    }
    return {
        codePoint: char.codePointAt(0)!,
        char,
        n,
        rows: Object.freeze([...rows]),
        beads: countBeads(rows),
    };
}

/** 已建字模（模块级一次构建；`Object.freeze` ⇒ 位表不可被运行期改写）。 */
export const SIGN_GLYPHS: readonly SignGlyph[] = Object.freeze(
    GLYPH_SOURCE.map(([char, rows]) => buildGlyph(char, rows)),
);

const _byCode = new Map<number, SignGlyph>();
for (let i = 0; i < SIGN_GLYPHS.length; i++) {
    const g = SIGN_GLYPHS[i]!;
    _byCode.set(g.codePoint, g);
}

/** 位表边长（四枚字模同 `n`，构造期已由 `buildGlyph` 校方阵；此处取首枚 ⇒ 10）。 */
export const SIGN_GLYPH_MATRIX_N: number = SIGN_GLYPHS[0]!.n;

/** 码点 → 字模；未知字符 ⇒ `undefined`（渲染侧据此跳过并一次性告警，⛔ 不猜字形）。 */
export function signGlyphOf(codePoint: number): SignGlyph | undefined {
    return _byCode.get(codePoint);
}

/**
 * 招牌串的珠数（纯函数、零分配）：逐码点查表求和，未知字符计 0。
 * = 「图元 = 珠数 × 7」的分子（`menu-wall-signage-spec §0.3` / §1.5 合计 148 ⇒ **1036 命令**）。
 */
export function signGlyphBeadsOf(text: string): number {
    let total = 0;
    for (let i = 0; i < text.length; i++) {
        const cp = text.codePointAt(i)!;
        if (cp > 0xffff) i++; // 代理对：码点已含高位，跳过低Surrogate
        const glyph = _byCode.get(cp);
        if (glyph !== undefined) total += glyph.beads;
    }
    return total;
}
