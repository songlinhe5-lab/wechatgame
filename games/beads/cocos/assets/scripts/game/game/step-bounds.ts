/**
 * 关卡**最少步数下界**（WXG-T-391，纯分析、不含引擎）。
 *
 * 背景：门禁⑦（`NORMAL_STEPS_MAX` 等）吃的是 `beads-bot` 的**实测步数**，那是某个贪心策略
 * 的**上界**——策略一换数字就翻（同一张花图 BAC 122 / ACB 38 / 邻接规则 22，见 TASKS 详情节）。
 * 有上界没下界，就永远说不清「这盘到底几步」。本模块只给**可证的**下界，供门禁做
 * 「`LB > 上限 ⇒ 一定不合格`」的硬判，以及给求解器（`tools/scripts/beads-solve.ts`）做剪枝锚。
 *
 * ⛔ **容量不构成下界**（这条踩过）：「一步最多搬 k 颗 ⇒ 步数 ≥ ⌈M/k⌉」是**错的**：
 * 盘上搬珠（选中一颗错位珠自动带走整组同色连通珠）单次可搬远超 k 颗——实测花图一步搬 93 颗
 * （k=24）。洞组大小同理不受 k 约束（搬离的源格会造出更大的新洞组）。所以 k 只影响「托盘取回」
 * 这一条路径的上限，不能反推步数下界。
 *
 * 本模块给的两条**成立**的下界：
 * 1. `beadGroups`：一次动作只触及**一个**初始错位同色连通珠组（取回、搬珠都是整组）⇒
 *    每个初始珠组至少被触一次 ⇒ 步数 ≥ 珠组数。
 * 2. `targetGroups`：落珠/搬珠的目标必须是一个**同色 8 连通洞组**，它必落在某一个「同色需求区域」
 *    （初始盘上一块同 `requiredColor` 的 8 连通区）之内 ⇒ 一个动作最多服务一个区域 ⇒
 *    凡含错位珠的区域至少一次动作 ⇒ 步数 ≥ 此类区域数。
 *
 * 分层：`game/` 纯计算（L2/L3 干净：无 `cc` / DOM / `wx` / 随机），可在 Node 单测。
 */

import type { BeadsLevelRaw } from '../config/levels-data';
import { colorIndexOfChar } from '../config/bead-charset';

/** 8 邻域固定序（上→下、左→右），与 `collectMisplacedGroup` / `planGroupFill` 同口径。 */
const DELTAS: readonly (readonly [number, number])[] = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1],
];

export interface StepBounds {
    /** 初始错位珠数（`M`）：每颗都必须被搬动至少一次。 */
    readonly misplaced: number;
    /** 初始错位珠按「同珠色 8 连通」切出的组数 ⇒ 步数下界一号。 */
    readonly beadGroups: number;
    /** 含错位珠的「同需求色 8 连通区域」数 ⇒ 步数下界二号。 */
    readonly targetGroups: number;
    /** 用到的颜色数（诊断用，不参与下界）。 */
    readonly colors: number;
    /** `max(beadGroups, targetGroups)`；无错位珠时为 0。 */
    readonly lowerBound: number;
    /** 下界来源说明（直接可上屏/落报告）。 */
    readonly note: string;
}

type Raw = Pick<BeadsLevelRaw, 'pattern' | 'misplaced' | 'swaps'>;

/** 解码盘面：返回每格 `required`（null = 空格/锁格）与初始 `bead`（null = 无珠）。 */
function decode(level: Raw) {
    const rows = level.pattern.length;
    const cols = rows > 0 ? level.pattern[0]!.length : 0;
    const required: (number | null)[][] = [];
    const bead: (number | null)[][] = [];
    for (let r = 0; r < rows; r++) {
        const prow = level.pattern[r]!;
        const mrow = level.misplaced?.[r];
        const reqRow: (number | null)[] = [];
        const beadRow: (number | null)[] = [];
        for (let c = 0; c < cols; c++) {
            const req = colorIndexOfChar(prow[c] ?? '') ?? null;
            reqRow.push(req);
            // `misplaced` 存在 ⇒ 逐格给出初始珠色（v1.3，替代 swaps）；缺省 ⇒ 珠色 = 需求色，
            // 之后由 swaps 逐对交换。锁格（`x`）恒为已就位，不参与错位判定。
            const ch = mrow ? mrow[c] : prow[c];
            beadRow.push(req === null ? null : (colorIndexOfChar(ch ?? '') ?? null));
        }
        required.push(reqRow);
        bead.push(beadRow);
    }
    if (!level.misplaced) {
        for (const [r1, c1, r2, c2] of level.swaps ?? []) {
            const a = bead[r1!]?.[c1!] ?? null;
            const b = bead[r2!]?.[c2!] ?? null;
            if (a === null || b === null) continue;
            bead[r1!]![c1!] = b;
            bead[r2!]![c2!] = a;
        }
    }
    return { rows, cols, required, bead };
}

/**
 * 算出该关的步数下界。纯函数、零引擎依赖 ⇒ 门禁侧可直接 `stepBounds(level)`。
 *
 * ⚠️ 下界**天生很松**：一次搬珠能消费上百颗，所以 `LB` 与真最优之间通常差 2–5 倍。
 * 它只用于「证伪」（`LB > 上限 ⇒ 一定不达标`），不可用于「证真」。
 */
export function stepBounds(level: Raw): StepBounds {
    const { rows, cols, required, bead } = decode(level);

    const isMisplaced = (r: number, c: number) => {
        const req = required[r]![c];
        const b = bead[r]![c];
        return req !== null && b !== null && b !== req;
    };

    const seenBead = new Set<number>();
    const seenTarget = new Set<number>();
    let misplaced = 0;
    let beadGroups = 0;
    let targetGroups = 0;
    const colorSet = new Set<number>();

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!isMisplaced(r, c)) continue;
            misplaced++;
            colorSet.add(bead[r]![c]!);
        }
    }

    // ① 珠组：同珠色的错位格 8 连通块
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const id = r * cols + c;
            if (seenBead.has(id) || !isMisplaced(r, c)) continue;
            const color = bead[r]![c]!;
            beadGroups++;
            const q: [number, number][] = [[r, c]];
            seenBead.add(id);
            while (q.length) {
                const [qr, qc] = q.pop()!;
                for (const [dr, dc] of DELTAS) {
                    const nr = qr + dr;
                    const nc = qc + dc;
                    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
                    const nid = nr * cols + nc;
                    if (seenBead.has(nid)) continue;
                    if (!isMisplaced(nr, nc) || bead[nr]![nc] !== color) continue;
                    seenBead.add(nid);
                    q.push([nr, nc]);
                }
            }
        }
    }

    // ② 目标区域：同需求色的 8 连通区，只有「区内含错位珠」才计数
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const id = r * cols + c;
            if (seenTarget.has(id) || required[r]![c] === null) continue;
            const color = required[r]![c]!;
            const q: [number, number][] = [[r, c]];
            seenTarget.add(id);
            let hasMisplaced = false;
            while (q.length) {
                const [qr, qc] = q.pop()!;
                if (isMisplaced(qr, qc)) hasMisplaced = true;
                for (const [dr, dc] of DELTAS) {
                    const nr = qr + dr;
                    const nc = qc + dc;
                    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
                    const nid = nr * cols + nc;
                    if (seenTarget.has(nid) || required[nr]![nc] !== color) continue;
                    seenTarget.add(nid);
                    q.push([nr, nc]);
                }
            }
            if (hasMisplaced) targetGroups++;
        }
    }

    const lowerBound = misplaced === 0 ? 0 : Math.max(beadGroups, targetGroups);
    return {
        misplaced,
        beadGroups,
        targetGroups,
        colors: colorSet.size,
        lowerBound,
        note: misplaced === 0
            ? '无错位珠（0 步即终局）'
            : `LB = max(珠组 ${beadGroups}, 需求区域 ${targetGroups}) = ${lowerBound}`
                + '；⛔ 容量不参与（搬珠单步可远超底槽 k）',
    };
}
