/**
 * 关卡最少步数**求解器**（WXG-T-391，offline 工具，不入游戏运行时）。
 *
 * 为什么不是纯搜索：状态空间 = (每格状态)^可填格 × 托盘多重集，19×27/288 珠的盘不可穷举；
 * 且「一步」不是单珠移动而是**组搬移**（选中一颗珠自动带走整片同色连通组），分支虽然变粗，
 * 但深度可以很浅，所以用**束搜索（beam search）**在「组级动作」上做 anytime 求解：
 *
 *   - 每个动作 = 一组**真引擎公开命令**（选珠/选槽/点击），回放即执行 ⇒ 状态永远由引擎裁定，
 *     ⛔ 不复刻规则（复刻过一次就会与引擎悄悄分叉）。
 *   - 评分 = 剩余错位珠数（主）/ 空格数（次）；按 (动作后状态哈希) 去重。
 *   - 下界来自 `game/step-bounds.ts`（仅用于报告 gap，不参与剪枝正确性）。
 *
 * 用法：
 *   node --experimental-transform-types --import=./games/beads/design/forensics/g3/g3-hooks.mjs \
 *        tools/scripts/beads-solve.ts <pattern.json | levelUid> [--beam=8] [--depth=24]
 */
import { readFileSync } from 'node:fs';
import { LEVELS_DATA } from '../../games/beads/src/config/levels-data.js';
import { createBeadsHarness, simpleTestLevel } from '../../games/beads/tests/helpers.js';
import { LEVEL_TIME_MAX } from '../../games/beads/src/config/tuning.js';
import { stepBounds } from '../../games/beads/src/game/step-bounds.js';
import { blobAnchors, emptyCells } from '../../games/beads/design/forensics/g3/g3-lib.js';
import type { BeadsGame } from '../../games/beads/src/game/beads-game.js';

/** 一条命令 = 一次公开 API 调用（引擎裁定合法性）。 */
type Cmd =
    | { t: 'selBead'; r: number; c: number }
    | { t: 'selTray'; slot: number }
    | { t: 'retrieve' }
    | { t: 'tap'; r: number; c: number };

/** 一个「步」= 一组命令（= 一次玩家点击量级的意图；与 bot 计步口径一致）。 */
interface Action {
    readonly kind: 'retrieve' | 'trayFill' | 'boardMove';
    readonly cmds: readonly Cmd[];
    /** 计划消费量（仅用于排序，不影响合法性）。 */
    readonly gain: number;
}

interface Snapshot {
    misplaced: number;
    holes: number;
    /** 完成度缺口 = 错位珠 + 空洞（两者都必须归零才是终局；只看错位会停在「珠全在托盘」）。 */
    deficit: number;
    hash: string;
    complete: boolean;
    actions: Action[];
}

function freshGame(raw: any): BeadsGame {
    const h = createBeadsHarness({ seed: 'beads-bot', levels: [simpleTestLevel({ ...raw, time: LEVEL_TIME_MAX })] });
    h.game.goToLevel(0);
    return h.game;
}

function applyCmds(g: BeadsGame, cmds: readonly Cmd[]) {
    const any = g as any;
    for (const c of cmds) {
        if (c.t === 'selBead') any.selectBoardBead(c.r, c.c);
        else if (c.t === 'selTray') any.selectTraySlot(c.slot);
        else if (c.t === 'retrieve') any.retrieveSelectedGroup(any.tray.firstFree());
        else any.tapGridCell(c.r, c.c);
    }
}

function stateHash(g: BeadsGame): string {
    const grid = g.grid as any;
    let s = '';
    for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
            const cell = grid.cell(r, c);
            if (!cell || cell.void) { s += '.'; continue; }
            if (cell.state === 'empty') { s += '_'; continue; }
            s += cell.state === 'filled' && cell.beadColorIdx === cell.colorIdx ? '#' : String(cell.beadColorIdx);
        }
    }
    const tray: number[] = [];
    for (let i = 0; i < g.tray.capacity; i++) {
        const slot = g.tray.slot(i);
        if (slot && slot.state !== 'free') tray.push(slot.colorIdx as number);
    }
    tray.sort((a, b) => a - b);
    return `${s}|${tray.join(',')}`;
}

/** 生成候选动作（组级：同色珠组 × 同色洞组），按计划消费量降序。 */
function candidates(g: BeadsGame): Action[] {
    const grid = g.grid as any;
    const holes = emptyCells(grid);
    const blobs = blobAnchors(grid);

    // 洞组：按 requiredColor 分组的 8 连通块（取每块的一个代表格）
    const holeKey = new Map<string, { r: number; c: number; color: number; size: number }>();
    const seen = new Map<string, number>();
    for (const e of holes) {
        const k = `${e.row},${e.col}`;
        if (seen.has(k)) continue;
        const color = grid.requiredColor(e.row, e.col) as number;
        const q = [[e.row, e.col]];
        seen.set(k, 1);
        const cells: { r: number; c: number }[] = [];
        while (q.length) {
            const [r, c] = q.pop()!;
            cells.push({ r, c });
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr; const nc = c + dc;
                    if (nr < 0 || nc < 0 || nr >= grid.rows || nc >= grid.cols) continue;
                    const nk = `${nr},${nc}`;
                    if (seen.has(nk)) continue;
                    const cell = grid.cell(nr, nc);
                    if (!cell || cell.state !== 'empty' || (grid.requiredColor(nr, nc) as number) !== color) continue;
                    seen.set(nk, 1);
                    q.push([nr, nc]);
                }
            }
        }
        const gk = `${color}:${cells[0]!.r},${cells[0]!.c}`;
        holeKey.set(gk, { r: cells[0]!.r, c: cells[0]!.c, color, size: cells.length });
    }

    const trayByColor = new Map<number, number>(); // color → first slot
    const trayCount = new Map<number, number>();
    for (let i = 0; i < g.tray.capacity; i++) {
        const slot = g.tray.slot(i);
        if (!slot || slot.state === 'free') continue;
        const c = slot.colorIdx as number;
        trayCount.set(c, (trayCount.get(c) ?? 0) + 1);
        if (!trayByColor.has(c)) trayByColor.set(c, i);
    }

    const acts: Action[] = [];

    // ① 盘上搬珠：同色珠组 → 同色洞组
    for (const b of blobs) {
        const color = grid.cell(b.cell.row, b.cell.col)!.beadColorIdx as number;
        for (const hg of holeKey.values()) {
            if (hg.color !== color) continue;
            acts.push({
                kind: 'boardMove',
                cmds: [{ t: 'selBead', r: b.cell.row, c: b.cell.col }, { t: 'tap', r: hg.r, c: hg.c }],
                gain: Math.min(b.size, hg.size),
            });
        }
    }
    // ② 托盘落子：托盘持有色 → 同色洞组
    for (const [color, slot] of trayByColor) {
        for (const hg of holeKey.values()) {
            if (hg.color !== color) continue;
            acts.push({
                kind: 'trayFill',
                cmds: [{ t: 'selTray', slot }, { t: 'tap', r: hg.r, c: hg.c }],
                gain: Math.min(trayCount.get(color)!, hg.size),
            });
        }
    }
    // ③ 取回：同色珠组 → 托盘（锚 + 点空槽）
    if (g.tray.firstFree() >= 0) {
        for (const b of blobs) {
            acts.push({
                kind: 'retrieve',
                cmds: [{ t: 'selBead', r: b.cell.row, c: b.cell.col }, { t: 'retrieve' }],
                gain: Math.min(b.size, g.tray.capacity - g.tray.holdingCount),
            });
        }
    }

    // 洞组内「点到哪一格」不影响结果 ⇒ 上面已按组取代表格；组内同 gain 的动作会自然去重
    return acts.sort((a, b) => b.gain - a.gain);
}

function snapshot(raw: any, path: readonly Action[]): Snapshot {
    const g = freshGame(raw);
    for (const a of path) applyCmds(g, a.cmds);
    const grid = g.grid as any;
    const misplaced = grid.misplacedCount as number;
    const holes = emptyCells(grid).length;
    const complete = grid.isComplete() as boolean;
    return {
        misplaced, holes, deficit: misplaced + holes,
        hash: stateHash(g),
        complete,
        actions: complete ? [] : candidates(g),
    };
}

function solve(raw: any, beam: number, maxDepth: number) {
    interface Node { path: Action[]; snap: Snapshot }
    let frontier: Node[] = [{ path: [], snap: snapshot(raw, []) }];
    if (frontier[0]!.snap.complete) return { path: [] as Action[], snap: frontier[0]!.snap };
    for (let depth = 1; depth <= maxDepth; depth++) {
        const seen = new Set<string>();
        const next: Node[] = [];
        for (const node of frontier) {
            for (const act of node.snap.actions) {
                const path = [...node.path, act];
                const snap = snapshot(raw, path);
                if (snap.complete) return { path, snap };
                if (seen.has(snap.hash)) continue;
                seen.add(snap.hash);
                next.push({ path, snap });
            }
        }
        if (!next.length) break;
        next.sort((a, b) => (a.snap.deficit - b.snap.deficit) || (a.snap.misplaced - b.snap.misplaced));
        frontier = next.slice(0, beam);
    }
    return { path: null, snap: frontier[0]?.snap };
}

// ── CLI ──
const arg = process.argv[2];
const beam = Number((process.argv.find((a) => a.startsWith('--beam=')) ?? '--beam=8').split('=')[1]);
const maxDepth = Number((process.argv.find((a) => a.startsWith('--depth=')) ?? '--depth=24').split('=')[1]);

function resolveRaw(): { raw: any; label: string } {
    if (arg && arg.endsWith('.json')) {
        const d = JSON.parse(readFileSync(arg, 'utf8'));
        const ld = d.levelDraft || d;
        return {
            label: arg.split('/').pop()!,
            raw: { id: 0, name: 'x', cols: d.cols ?? ld.cols, rows: d.rows ?? ld.rows, pattern: ld.pattern, misplaced: ld.misplaced, swaps: ld.swaps },
        };
    }
    const found = (LEVELS_DATA as any).levels.find((l: any) => l.uid === arg);
    if (!found) throw new Error(`找不到关卡 ${arg}（给 .json 路径或 uid）`);
    return { raw: found, label: found.uid };
}

const { raw, label } = resolveRaw();
const lb = stepBounds(raw);
const t0 = Date.now();
const { path, snap } = solve(raw, beam, maxDepth);
const ms = Date.now() - t0;
const byKind = (k: string) => (path ?? []).filter((a) => a.kind === k).length;
console.log(JSON.stringify({
    label,
    lowerBound: lb.lowerBound,
    lbNote: lb.note,
    solvedSteps: path ? path.length : null,
    breakdown: path ? { boardMove: byKind('boardMove'), trayFill: byKind('trayFill'), retrieve: byKind('retrieve') } : null,
    remainingDeficit: snap ? snap.deficit : null,
    remainingMisplaced: snap?.misplaced ?? null,
    beam, maxDepth, elapsedMs: ms,
}, null, 1));
if (path) {
    // 步序走 stderr：stdout 只留一行 JSON，便于 `| node -e` 直接 JSON.parse
    for (const [i, a] of path.entries()) console.error(`  ${i + 1}. ${a.kind} gain=${a.gain}`);
}
