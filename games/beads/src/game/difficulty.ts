/**
 * 结构难度分 `DI`（WXG-T-266 EP12-S5 · **单一真源**）。
 *
 * 正本公式 = `design/proposals/ui-style-redesign/level-difficulty.md §3`；落码后**本函数即唯一实现**
 * （§4「单一真源声明」：文档只引函数名，不引数值副本）。系数住 `tuning.ts::DIFFICULTY`（不进 §3）。
 *
 * 铁律：
 * - **L4 零 RNG**：纯输入→输出，同 `pattern`/`misplaced` 跑两次逐位相等（守卫 G2）。
 * - **只管「序」不管「价」**（§1.2）：本函数与定价（`measuredLevelTime` / `SEC_PER_STEP`）零耦合，
 *   `DI` 不回写 `time`（守卫 G7）。
 * - **A 只住此处的 `boardStats`**（§8 B-3）：不另起第二份同色相邻率口径。
 *
 * 消费方：EP12-S6 陈列序（DI 升序）· `sync-levels-data.mjs` 门禁⑥（G6 生成期无退化）。
 */

import { DIFFICULTY } from '../config/tuning.js';
import { boardStats } from './level-import.js';
import { assembleFromMisplaced } from './misplaced-assembler.js';

/** difficultyOf 的关卡输入（只取难度所需结构字段，与 `BeadsLevelRaw` 兼容的子集）。 */
export interface DifficultyLevel {
    readonly pattern: readonly string[];
    /** 全错位初盘 rowstring（存在则替代 swaps 作初盘真源，M 由此实算）。 */
    readonly misplaced?: readonly string[];
    /** 交换构造法（无 misplaced 时走此，恒 2-环 ⇒ M = 2k）。 */
    readonly swaps?: readonly (readonly [number, number, number, number])[];
}

/** 难度分及各中间量（一并返回便于守卫断言与 S6 消费，不必二次拆解）。 */
export interface DifficultyResult {
    /** N = 可填格数（图元）。 */
    readonly n: number;
    /** C = 用色数。 */
    readonly c: number;
    /** A = 同色相邻率（三位）。 */
    readonly a: number;
    /** K = 碎片度 = 1 − A（三位）。 */
    readonly k: number;
    /** M = 错位珠数（misplaced/swaps 实算）。 */
    readonly m: number;
    /** ρ = M / N（现池恒 1.000，H-1 零分辨力，仅留口）。 */
    readonly rho: number;
    /** f_C = 色数难度因子（三位，钳位后）。 */
    readonly fC: number;
    /** f_K = 碎片度难度因子（三位，地板后）。 */
    readonly fK: number;
    /** DI = round₁₀(M × f_C × f_K)，一位小数。 */
    readonly di: number;
}

/** 三位小数（§3.2 逐字口径，跨端一致否则漂移）。 */
const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/**
 * `DI(level) = round₁₀( M × f_C × f_K )`，公式见 §3。
 *
 * 取整口径（§3.2，前置到各因子）：`A`→三位；`K = 1 − A`→三位；`f_C`/`f_K`→三位；`DI`→一位。
 * 前置取整是**逐值复现 §5 表**的必要条件（例：L00009 `f_K` 1.0496→1.050 才得 DI 538.0）。
 */
export function difficultyOf(level: DifficultyLevel): DifficultyResult {
    // M：misplaced 型实算优先；否则 swaps 恒 2-环 ⇒ 2k（与 level-import.draftToLevel 同口径）。
    const m = level.misplaced
        ? assembleFromMisplaced(level.pattern, level.misplaced).misplacedCount
        : (level.swaps?.length ?? 0) * 2;

    // N / C / A 复用 boardStats（不重造，ponytail 梯 2）；A 取三位（§3.2）。
    const stats = boardStats(level.pattern, m);
    const n = stats.fillable;
    const c = stats.colors;
    const a = round3(stats.adjRate);
    const k = round3(1 - a);

    // f_C = clamp(1 + c_C × (C − C_REF), FC_LO, FC_HI)（§3）。
    const fC = round3(
        Math.min(
            DIFFICULTY.FC_HI,
            Math.max(DIFFICULTY.FC_LO, 1 + DIFFICULTY.c_C * (c - DIFFICULTY.C_REF)),
        ),
    );
    // f_K = max(FK_FLOOR, 1 + c_K × (K − K_REF))（§3，地板防退化）。
    const fK = round3(Math.max(DIFFICULTY.FK_FLOOR, 1 + DIFFICULTY.c_K * (k - DIFFICULTY.K_REF)));

    const di = Math.round(m * fC * fK * 10) / 10;
    return { n, c, a, k, m, rho: n ? m / n : 0, fC, fK, di };
}
