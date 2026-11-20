/**
 * 结构难度主序（WXG-T-266 EP12-S5 起 · **单一真源**；WXG-T-997 换方案 C 离散四档）。
 *
 * 正本 = `games/beads/design/proposals/difficulty-rewrite-stage0-20261119.md` §3 C 案 / §6.1 裁定。
 * 对外输出四档标签 `tier`；对内输出确定性主键 `di` 供门禁⑥ 与陈列序消费。
 * 旧连续式 `round₁₀(M × f_C × f_K)` 已退居史证读数 `a/k/fC/fK`，**不再参与主序**。
 *
 * 铁律：
 * - **L4 零 RNG**：纯输入 → 输出，同 `pattern`/`misplaced` 跑两次逐位相等（守卫 G2）。
 * - **脱钩于「价」**：输入集合只含 N / C / T=12 / 错位初盘连通块，不读 `steps`、
 *   不读 `SEC_PER_STEP`、不跑 bot、不碰 `pricing`；`pricing.steps` 仍是定价与门禁⑦真源。
 * - **邻域单一真源**：错位盘同色连通块走 `grid.ts::collectMisplacedGroup`（8 邻域一步 BFS，
 *   与玩家组选同源）；⛔ 不在此造第二套 BFS，⛔ 不 import 离线取证层 `design/forensics/g3`。
 *
 * 消费方：EP12-S6 陈列序 · `sync-levels-data.mjs` 门禁⑥（G6 生成期无退化）。
 */

import { DIFFICULTY, DIFFICULTY_TIERS } from '../config/tuning.js';
import { boardStats } from './level-import.js';
import { assembleFromMisplaced, type AssembledBoard } from './misplaced-assembler.js';
import { BeadGrid, collectMisplacedGroup } from '../entities/grid.js';

/** difficultyOf 的关卡输入（只取难度所需结构字段，与 `BeadsLevelRaw` 兼容的子集）。 */
export interface DifficultyLevel {
    readonly pattern: readonly string[];
    /** 全错位初盘 rowstring（存在则替代 swaps 作初盘真源，M 与此盘连通块由此实算）。 */
    readonly misplaced?: readonly string[];
    /** 交换构造法（无 misplaced 时走此，恒 2-环 ⇒ M = 2k；无错位初盘 ⇒ G 修正不启用）。 */
    readonly swaps?: readonly (readonly [number, number, number, number])[];
}

/** 主序结果：`tier` 对外，`di` 对内；`a/k/fC/fK` 为旧体系史证读数（不参与主序）。 */
export interface DifficultyResult {
    /** N = 可填格数（图元）。 */
    readonly n: number;
    /** C = 用色数。 */
    readonly c: number;
    /** 四档标签：0 简单 / 1 中等 / 2 难 / 3 超难。 */
    readonly tier: number;
    /** G(T) 参考值（T = 12/24/48）；主序锁 12，后两档只作参考、不回写档。 */
    readonly g: readonly [number, number, number];
    /** 确定性主键 = tier×1e12 + N×1e8 + C×1e4 + G(12)。⛔ 不是难度分数。 */
    readonly di: number;
    /** A = 答案盘 4 邻域同色相邻率（三位；史证读数）。 */
    readonly a: number;
    /** K = 1 − A（三位；史证读数）。 */
    readonly k: number;
    /** M = 错位珠数（misplaced/swaps 实算）。 */
    readonly m: number;
    /** ρ = M / N（现池近 1，零分辨力，仅留口）。 */
    readonly rho: number;
    /** f_C = 旧色数因子（三位；史证读数）。 */
    readonly fC: number;
    /** f_K = 旧碎片度因子（三位；史证读数）。 */
    readonly fK: number;
}

/** 三位小数（§3.2 逐字口径，跨端一致否则漂移）。 */
const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/**
 * 错位初盘上的同色连通块尺寸。复用 `collectMisplacedGroup`（8 邻域一步 BFS），
 * 用 `seen` 去重保证每块只计一次；非热路径，分配可接受。
 * 无 `misplaced` 初盘（legacy swaps 关）返回空数组 ⇒ G 参考值全 0、G 修正不启用。
 */
function misplacedBlobSizes(pattern: readonly string[], board: AssembledBoard | null): number[] {
    if (!board) return [];
    const grid = new BeadGrid(pattern);
    const cols = board.cols;
    for (let i = 0; i < board.beads.length; i++) {
        const bead = board.beads[i]!;
        if (bead > 0) grid.fill(Math.floor(i / cols), i % cols, bead);
    }
    const seen = new Set<number>();
    const sizes: number[] = [];
    for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
            if (seen.has(r * cols + c) || !grid.isMisplaced(r, c)) continue;
            const group = collectMisplacedGroup(grid, r, c);
            for (const cell of group) seen.add(cell.row * cols + cell.col);
            sizes.push(group.length);
        }
    }
    return sizes;
}

/** 一块 b 颗在 T 槽托盘下需 ceil(b/T) 次周转；整盘求和即 G(T)。 */
const gAt = (sizes: readonly number[], t: number): number =>
    sizes.reduce((sum, b) => sum + Math.ceil(b / t), 0);

/**
 * 方案 C：`档₀ = table(N档, C档)` → `G(12)` 一次性升降档（各至多一次）→ 夹到 0–3。
 *
 * 边界与初锚住 `tuning/gameplay.ts::DIFFICULTY_TIERS`（不进 §3、全数 `[待 playtest]`）。
 * `di` 只作确定性排序主键：档序主导、N 次之、C 再次、`G(12)` 末位消歧
 * （现池 L00001 与 L00006 的 N/C 完全相同，不消歧会撞门禁⑥ 的严格递增）。
 */
export function difficultyOf(level: DifficultyLevel): DifficultyResult {
    const board = level.misplaced
        ? assembleFromMisplaced(level.pattern, level.misplaced)
        : null;
    const m = board ? board.misplacedCount : (level.swaps?.length ?? 0) * 2;

    // N / C 复用 boardStats（不重造，ponytail 梯 2）。
    const stats = boardStats(level.pattern, m);
    const n = stats.fillable;
    const c = stats.colors;

    // 旧连续式的中间量：保留为史证读数，⛔ 不参与下列 tier / di 计算。
    const a = round3(stats.adjRate);
    const k = round3(1 - a);
    const fC = round3(
        Math.min(
            DIFFICULTY.FC_HI,
            Math.max(DIFFICULTY.FC_LO, 1 + DIFFICULTY.c_C * (c - DIFFICULTY.C_REF)),
        ),
    );
    const fK = round3(Math.max(DIFFICULTY.FK_FLOOR, 1 + DIFFICULTY.c_K * (k - DIFFICULTY.K_REF)));

    const sizes = misplacedBlobSizes(level.pattern, board);
    const t = DIFFICULTY_TIERS.T_REFS;
    const g: [number, number, number] = [gAt(sizes, t[0]), gAt(sizes, t[1]), gAt(sizes, t[2])];

    let tier = n < DIFFICULTY_TIERS.N_SIMPLE ? 0
        : n < DIFFICULTY_TIERS.N_HARD ? 1
            : n < DIFFICULTY_TIERS.N_EXTREME ? 2 : 3;
    if (c >= DIFFICULTY_TIERS.C_PROMOTE) tier += 1;

    const gMin = Math.ceil(n / DIFFICULTY_TIERS.T_PRIMARY);
    if (sizes.length > 0 && gMin > 0) {
        const ratio = g[0] / gMin;
        if (ratio > DIFFICULTY_TIERS.G_PROMOTE_RATIO) tier += 1;
        else if (ratio < DIFFICULTY_TIERS.G_DEMOTE_RATIO) tier -= 1;
    }
    tier = Math.min(DIFFICULTY_TIERS.TIER_MAX, Math.max(0, tier));

    const di = tier * DIFFICULTY_TIERS.KEY_TIER
        + n * DIFFICULTY_TIERS.KEY_N
        + c * DIFFICULTY_TIERS.KEY_C
        + g[0];

    return { n, c, tier, g, di, a, k, m, rho: n ? m / n : 0, fC, fK };
}
