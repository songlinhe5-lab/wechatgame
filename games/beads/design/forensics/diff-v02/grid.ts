// 难度公式 v0.1 → v0.2 取证 —— 结构批量 B 与真引擎点击数实测（非生产码）。
//
// 铁律（同 g3-lib）：**不复制任何判定逻辑**。盘面统计走生产 `boardStats`，v0.1 预测走
// 生产 `estimateLevelTime`，组块几何走生产 `collectMisplacedGroup`（经 g3-lib.blobAnchors），
// 每一步操作走 `BeadsGame` 公开命令（经 g3-lib.runBot）。装配走**生产 BOOT 路径**
// （`createBeadsHarness` 默认装配 `pattern` + `misplaced`），非夹具手填。
//
// 运行：
//   node --experimental-transform-types \
//     --import=./games/beads/design/forensics/g3/g3-hooks.mjs \
//     games/beads/design/forensics/diff-v02/grid.ts [patternDir ...]
// 无参 ⇒ 扫 `temp/*/pattern.json` 语料（去重后取样本）。

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBeadsHarness, simpleTestLevel } from '../../../tests/helpers.js';
import { boardStats, estimateLevelTime } from '../../../src/game/level-import.js';
import { LEVEL_TIME_MAX, LEVEL_TIME_MIN, TRAY_BASE_SLOTS } from '../../../src/config/tuning.js';
import { blobAnchors, runBot } from '../g3/g3-lib.js';

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '../../../../..');
/** 合法盘面（§3.3 `GRID_MAX` 50）；超限盘 BOOT 本就拒收，不进语料。 */
const SIDE_MAX = 50;
/** 单盘可填豆数上限（bot 步数与耗时的实用闸；> 此值的盘不进语料）。 */
const N_MAX = 2500;
/** v0.2 候选「每次点击秒数」档位（含思考/扫视；人类速率，bot 测不出 ⇒ 只列不拟合）。 */
const S_CANDIDATES = [2, 3, 4, 5, 6, 8, 11.25];

/**
 * 当前合法盘面口径（`BEAD_CHARSET = ".x1-9A"`、行长 = cols、行数 = rows）。
 * **为什么需要**：`temp/` 里有旧版 beads-gen 遗留产物（字符集宽到 `W`/`H`，或含老 bug 的
 * `undefined` 串），直接喂 `BeadGrid` 会在构造期抛（grid.ts:70）⇒ 语料入口一处过滤。
 */
function legalBoard(rows: unknown, cols: number, rowCount: number): rows is string[] {
    if (!Array.isArray(rows) || rows.length !== rowCount) return false;
    return rows.every((r) => typeof r === 'string' && r.length === cols && !/[^.x1-9A]/.test(r));
}

interface Row {
    dir: string;
    dims: string;
    n: number;
    c: number;
    a: number;
    m: number;
    blobs: number;
    bMean: number;
    bMed: number;
    bMax: number;
    bEff: number;
    actionsModel: number;
    /** 真引擎点击数：**只计成功命令**（下界，不含 bot 探测性误点）。 */
    tapsOk: number;
    /** 真引擎点击数：**含失败命令**（上界，bot 逐个试探目标格的代价）。 */
    tapsAll: number;
    cleared: boolean;
    peakTray: number;
    stuck: string;
    t01: number;
    d01: number;
}

function corpus(): string[] {
    const args = process.argv.slice(2);
    if (args.length > 0) return args.map((a) => (a.endsWith('.json') ? dirname(a) : a));
    const root = join(REPO_ROOT, 'temp');
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of readdirSync(root).sort()) {
        const p = join(root, d, 'pattern.json');
        if (!existsSync(p)) continue;
        let j: { cols?: number; rows?: number; pattern?: string[]; misplaced?: string[]; report?: { colorsUsed?: number; fillable?: number; clusteringAfter?: { adjRate?: number } } };
        try {
            j = JSON.parse(readFileSync(p, 'utf8'));
        } catch {
            continue;
        }
        if (!Array.isArray(j.misplaced) || j.misplaced.length === 0) continue; // 只测全错位盘
        if ((j.cols ?? 99) > SIDE_MAX || (j.rows ?? 99) > SIDE_MAX) continue;
        if ((j.report?.fillable ?? 0) > N_MAX) continue;
        if (!legalBoard(j.pattern, j.cols ?? 0, j.rows ?? 0)) continue; // 旧版遗留产物（字符集/尺寸不符）
        // 去重：同（尺寸, 用色, 相邻率 0.01 档）只留一个 ⇒ 语料覆盖多样性而非重复盘。
        const key = `${j.cols}x${j.rows}|${j.report?.colorsUsed}|${((j.report?.clusteringAfter?.adjRate ?? 0) * 100) | 0}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(join(root, d));
    }
    return out;
}

/** 一盘一次实测：结构量（B/actions）+ 真引擎 bot 点击数 + v0.1 预测。 */
function measure(dir: string): Row | null {
    const p = join(dir, 'pattern.json');
    if (!existsSync(p)) return null;
    const j = JSON.parse(readFileSync(p, 'utf8')) as {
        cols: number;
        rows: number;
        pattern: string[];
        misplaced: string[];
    };
    if (!legalBoard(j.pattern, j.cols, j.rows) || !legalBoard(j.misplaced, j.cols, j.rows)) return null;

    const level = simpleTestLevel({
        id: 901,
        name: 'diff-v02',
        cols: j.cols,
        rows: j.rows,
        time: LEVEL_TIME_MAX,
        pattern: j.pattern,
        misplaced: j.misplaced,
        swaps: [],
        cycleProfile: 'long',
    });
    const h = createBeadsHarness({ seed: 'diff-v02', levels: [level] });
    h.game.goToLevel(0);

    // 结构统计走生产 boardStats（M = 装配后实算错位珠数）。
    const stats = boardStats(j.pattern, h.game.grid.misplacedCount);
    if (stats.misplaced === 0) return null; // 装配未生效（如 swaps 盘）⇒ 不属本次取证范围

    // B：错位同色 8 向连通块（组选真码度量）。**均值不够用**（分布极度偏斜：
    // 实测 B_mean 18 / B_max 350 共存）⇒ 同时收块数 / 中位 / 最大，供候选模型对比。
    const sizes = blobAnchors(h.game.grid).map((b) => b.size).sort((x, y) => x - y);
    const blobs = sizes.length;
    const bMean = sizes.reduce((s, v) => s + v, 0) / Math.max(1, blobs);
    const bMed = sizes[Math.floor(blobs / 2)] ?? 0;
    const bMax = sizes[blobs - 1] ?? 0;
    const bEff = Math.max(1, Math.min(TRAY_BASE_SLOTS, bMean));
    const actionsModel = 2 * Math.ceil(stats.misplaced / bEff);

    // 真引擎点击埋点：**不改判定逻辑**，只包一层计数（四个公开命令 = 玩家四种点击）。
    const g = h.game as unknown as Record<string, unknown>;
    const CMDS = ['tapGridCell', 'selectBoardBead', 'selectTraySlot', 'retrieveSelectedGroup'] as const;
    const orig: ((...a: never[]) => boolean)[] = [];
    let tapsOk = 0;
    let tapsAll = 0;
    CMDS.forEach((name, i) => {
        const fn = g[name] as (...a: never[]) => boolean;
        orig[i] = fn.bind(h.game) as (...a: never[]) => boolean;
        g[name] = (...a: never[]): boolean => {
            tapsAll++;
            const r2 = orig[i]!(...a);
            if (r2) tapsOk++;
            return r2;
        };
    });

    // 真引擎 bot：直填放开（G-3 定档的核心机制）+ 贪心取最大组 = best play 代理。
    const r = runBot(h, { allowDirectFill: true, retrieve: 'max', usePowerups: false, maxMoves: 20000 });
    CMDS.forEach((name, i) => {
        g[name] = orig[i];
    }); // 还原（不污染后续盘的度量）

    const v01 = estimateLevelTime(stats);
    return {
        dir: dir.slice(REPO_ROOT.length + 1),
        dims: `${j.cols}x${j.rows}`,
        n: stats.fillable,
        c: stats.colors,
        a: stats.adjRate,
        m: stats.misplaced,
        blobs,
        bMean,
        bMed,
        bMax,
        bEff,
        actionsModel,
        tapsOk,
        tapsAll,
        cleared: r.cleared,
        peakTray: r.peakTray,
        stuck: r.stuck,
        t01: v01.time,
        d01: v01.difficulty,
    };
}

const dirs = corpus();
const rows: Row[] = [];
for (const d of dirs) {
    // 单盘异常（旧产物、装配失败）不拖垮整轮 —— 语料闸已挡掉已知类别，这里是兜底。
    try {
        const r = measure(d);
        if (r) rows.push(r);
        else console.error(`skip（非全错位盘 / 非法盘面 / 装配未生效）：${d}`);
    } catch (e) {
        console.error(`skip（异常）：${d} — ${(e as Error).message.slice(0, 80)}`);
    }
}
rows.sort((x, y) => x.n - y.n);

const f2 = (v: number): string => v.toFixed(2);
console.log(`\n══ 难度公式取证：结构批量 B vs 真引擎点击数（语料 ${rows.length} 盘）`);
console.log(
    ['dir', 'dims', 'N', 'C', 'A', 'M', 'M/N', 'blobs', 'B_mean', 'B_med', 'B_max', 'taps_ok', 'taps_all', 'clear', 'peak', 'T_v0.1', 'v0.1隐含s/tap'].join('\t'),
);
for (const r of rows) {
    console.log(
        [
            r.dir, r.dims, r.n, r.c, f2(r.a), r.m, f2(r.m / r.n), r.blobs, f2(r.bMean), r.bMed, r.bMax,
            r.tapsOk, r.tapsAll, r.cleared ? 'Y' : `N(${r.stuck.slice(0, 20)})`, r.peakTray,
            r.t01, f2(r.t01 / Math.max(1, r.tapsOk)),
        ].join('\t'),
    );
}

const ok = rows.filter((r) => r.cleared);
console.log(`\n── 模型对比（bot 通关 ${ok.length}/${rows.length} 盘；目标量 = taps_ok）`);
console.log(`v0.1 触顶盘数：${rows.filter((r) => r.t01 >= LEVEL_TIME_MAX).length}/${rows.length}（clamp 掉全部区分度）`);

/** 候选「点击数」模型：均只用生成期可算的结构量（不引用 bot 结果）。 */
const MODELS: { name: string; f: (r: Row) => number }[] = [
    { name: 'v0.1 按颗（M）', f: (r) => r.m },
    { name: 'P1 2×M/min(12,B_mean)', f: (r) => 2 * Math.ceil(r.m / Math.max(1, Math.min(TRAY_BASE_SLOTS, r.bMean))) },
    { name: 'P2 2×blobs', f: (r) => 2 * r.blobs },
    { name: 'P3 2×M/min(12,B_med)', f: (r) => 2 * Math.ceil(r.m / Math.max(1, Math.min(TRAY_BASE_SLOTS, r.bMed))) },
    { name: 'P4 blobs+M/12', f: (r) => r.blobs + Math.ceil(r.m / TRAY_BASE_SLOTS) },
    { name: 'P5 2×M/6（固定批量）', f: (r) => 2 * Math.ceil(r.m / 6) },
];
console.log(['model', '中位比值', '中位相对误差', 'max相对误差'].join('\t'));
const scored = MODELS.map((mo) => {
    const rel = ok.map((r) => mo.f(r) / Math.max(1, r.tapsOk));
    const err = rel.map((v) => Math.abs(v - 1)).sort((a, b) => a - b);
    const sorted = rel.slice().sort((a, b) => a - b);
    return {
        name: mo.name,
        medRatio: sorted[Math.floor(sorted.length / 2)]!,
        medErr: err[Math.floor(err.length / 2)]!,
        maxErr: err[err.length - 1]!,
    };
}).sort((a, b) => a.medErr - b.medErr);
for (const s of scored) console.log([s.name, f2(s.medRatio), f2(s.medErr), f2(s.maxErr)].join('\t'));

const best = MODELS.find((m) => m.name === scored[0]!.name)!;
console.log(`\n── S 候选（秒/次点击）下 v0.2 时长分布（模型 = ${best.name}）`);
console.log(['S', 'min', '中位', 'max', '触顶盘', '触底盘'].join('\t'));
for (const s of S_CANDIDATES) {
    const t = ok
        .map((r) => {
            const fN = 1 + 0.25 * Math.log10(Math.max(1, r.n) / 200);
            const fC = 0.75 + 0.083 * r.c;
            return Math.min(LEVEL_TIME_MAX, Math.max(LEVEL_TIME_MIN, Math.round(best.f(r) * s * fN * fC)));
        })
        .sort((a, b) => a - b);
    console.log(
        [
            s, t[0], t[Math.floor(t.length / 2)], t[t.length - 1],
            t.filter((v) => v >= LEVEL_TIME_MAX).length, t.filter((v) => v <= LEVEL_TIME_MIN).length,
        ].join('\t'),
    );
}

// 可玩性红线：人类速率区间下实际所需时长 vs LEVEL_TIME_MAX（超出 ⇒ 倒计时内不可能通关）。
console.log(`\n── 倒计时可行性（人类速率 1.5–3 s/tap，取 taps_ok 下界）`);
console.log(['dir', 'taps_ok', '最快s', '最慢s', 'T_MAX内可通关'].join('\t'));
for (const r of ok) {
    const fast = r.tapsOk * 1.5;
    const slow = r.tapsOk * 3;
    console.log([r.dir, r.tapsOk, Math.round(fast), Math.round(slow), fast <= LEVEL_TIME_MAX ? 'Y' : 'N'].join('\t'));
}
console.log(
    `不可通关盘（最快估也超 ${LEVEL_TIME_MAX}s）：${ok.filter((r) => r.tapsOk * 1.5 > LEVEL_TIME_MAX).length}/${ok.length}`,
);
