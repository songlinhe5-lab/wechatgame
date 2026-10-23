// 豆面可读性（正本：games/beads/design/levels/pattern-legibility.md，WXG-T-357）
// 三处复用：门禁⑧（tools/scripts/sync-levels-data.mjs）· studio 生成后二次修复
// （apps/beads-studio/server.mjs）· CLI 报告（node tools/scripts/lib/pattern-legibility.mjs --report）。
// 纯 JS、零依赖（4-连通 BFS），⛔ 不参与难度定价（DI 管排序与工量，本文件管「看不看得清」）。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** 可填格：非空（`.`）非锁定（`x`）。 */
const isBead = (ch) => typeof ch === 'string' && ch !== '.' && ch !== 'x';

/** 门限（设计锚定值，逐条锚见正本 §2；⛔ 不按现池回归调整，同 level-difficulty §3.3 口径）。 */
export const LIMITS = Object.freeze({
    beadsPerBlock: 9, // 每块 ≥ 3×3 = 图案最小识别单元
    blocksPerColor: 2, // 同色最多 1 主块 + 1 点缀块
    speckRate: 0.01, // 孤点（面积 1）/ N
    silks: 1, // 1 格宽笔画块数
    beadsPerColor: 25, // 每色 ≥ 5×5
    parts: 1, // 主体连通分量
    // 参考带（只报告不判死）：轮廓比周长
    psn: [4.0, 6.5],
});

/** 短边下限（按用色数分档；C≥7 ⇒ 16）。 */
export function shortSideLimit(C) {
    return C >= 7 ? 16 : C >= 5 ? 14 : 11;
}

/** 4 连通分量；`pick(i,j)` 返回 joinable 时给一个分组键（null = 不可连）。 */
function components(rows, cols, pick) {
    const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
    const out = [];
    for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            if (seen[i][j] || pick(i, j) === null) continue;
            const key = pick(i, j);
            const stack = [[i, j]];
            seen[i][j] = true;
            const cells = [];
            while (stack.length) {
                const [a, b] = stack.pop();
                cells.push([a, b]);
                for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const na = a + da;
                    const nb = b + db;
                    if (na < 0 || nb < 0 || na >= rows || nb >= cols) continue;
                    if (seen[na][nb]) continue;
                    const k = pick(na, nb);
                    if (k === null || k !== key) continue;
                    seen[na][nb] = true;
                    stack.push([na, nb]);
                }
            }
            out.push(cells);
        }
    }
    return out;
}

const bboxOf = (cells) => {
    let r0 = Infinity;
    let r1 = -Infinity;
    let c0 = Infinity;
    let c1 = -Infinity;
    for (const [r, c] of cells) {
        r0 = Math.min(r0, r);
        r1 = Math.max(r1, r);
        c0 = Math.min(c0, c);
        c1 = Math.max(c1, c);
    }
    return { h: r1 - r0 + 1, w: c1 - c0 + 1 };
};

const round = (x, n = 2) => {
    const p = 10 ** n;
    return Math.round(x * p) / p;
};

/**
 * 度量一格盘。`pattern` = 行串数组（`.` 空 / `x` 锁定 / 其它 = 色索引字符）。
 * ⛔ 不改入参、零分配依赖（只为报告路径调用，不在热路径）。
 */
export function analyze(pattern) {
    const rows = pattern.length;
    const cols = rows ? pattern[0].length : 0;
    const bead = (i, j) => isBead(pattern[i][j]);

    // 同色块（4 连通，键 = 颜色字符）
    const perColor = new Map();
    for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            const ch = pattern[i][j];
            if (!isBead(ch)) continue;
            perColor.set(ch, (perColor.get(ch) ?? 0) + 1);
        }
    }
    const blocks = components(rows, cols, (i, j) => (bead(i, j) ? pattern[i][j] : null)).map((cells) => {
        const bb = bboxOf(cells);
        return { ch: pattern[cells[0][0]][cells[0][1]], area: cells.length, h: bb.h, w: bb.w, cells };
    });
    const N = blocks.reduce((s, b) => s + b.area, 0);
    const C = perColor.size;
    const R = blocks.length;
    const specks = blocks.filter((b) => b.area === 1).length;
    const silks = blocks.filter((b) => Math.min(b.h, b.w) === 1 && b.area >= 2).length;

    // 主体连通分量（不区分颜色）
    const parts = components(rows, cols, (i, j) => (bead(i, j) ? '#' : null))
        .map((c) => c.length)
        .sort((a, b) => b - a);

    // 背景孔洞（不触盘边的空格区）
    const holes = components(rows, cols, (i, j) => (bead(i, j) ? null : 'bg'))
        .filter((cells) => !cells.some(([r, c]) => r === 0 || c === 0 || r === rows - 1 || c === cols - 1))
        .map((cells) => cells.length);

    // 比周长：珠格与「非珠/盘外」相邻的边数
    let perimeter = 0;
    for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            if (!bead(i, j)) continue;
            for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const na = i + da;
                const nb = j + db;
                if (na < 0 || nb < 0 || na >= rows || nb >= cols || !bead(na, nb)) perimeter += 1;
            }
        }
    }

    return {
        cols,
        rows,
        shortSide: Math.min(cols, rows),
        N,
        C,
        blocks: R,
        beadsPerBlock: R ? round(N / R, 1) : 0,
        blocksPerColor: C ? round(R / C, 2) : 0,
        beadsPerColor: C ? round(N / C, 1) : 0,
        specks,
        speckRate: N ? round(specks / N, 4) : 0,
        silks,
        parts: parts.length,
        islands: parts.slice(1),
        holes,
        psn: N ? round(perimeter / Math.sqrt(N), 2) : 0,
        fill: rows && cols ? round(N / (rows * cols), 2) : 0,
    };
}

/**
 * 判读：返回未过项。`kind` 分型 —— `sizing`（盘/色数不够 ⇒ 放大或减色）·
 * `structure`（盘够但图案碎 ⇒ 合并色块/降纹理）· `ok`。
 */
export function judge(m) {
    const fails = [];
    const add = (k, label, value, limit) => fails.push({ k, label, value, limit });
    if (m.beadsPerBlock < LIMITS.beadsPerBlock) add('T1', '珠/块不足', m.beadsPerBlock, LIMITS.beadsPerBlock);
    if (m.blocksPerColor > LIMITS.blocksPerColor) add('T2', '同色碎块', m.blocksPerColor, LIMITS.blocksPerColor);
    if (m.speckRate > LIMITS.speckRate) add('T3', '孤点过多', m.speckRate, LIMITS.speckRate);
    if (m.silks > LIMITS.silks) add('T4', '细丝过多', m.silks, LIMITS.silks);
    if (m.beadsPerColor < LIMITS.beadsPerColor) add('T5', '每色格数不足', m.beadsPerColor, LIMITS.beadsPerColor);
    if (m.parts > LIMITS.parts) add('T6', '主体断裂', m.parts, LIMITS.parts);
    const sMin = shortSideLimit(m.C);
    if (m.shortSide < sMin) add('T7', '短边不足', m.shortSide, sMin);
    const sizing = fails.some((f) => f.k === 'T5' || f.k === 'T7' || f.k === 'T6');
    const warns = [];
    if (m.psn < LIMITS.psn[0] || m.psn > LIMITS.psn[1]) warns.push({ k: 'W1', label: '轮廓比周长出带', value: m.psn, band: LIMITS.psn });
    return { ok: fails.length === 0, fails, warns, kind: fails.length === 0 ? 'ok' : sizing ? 'sizing' : 'structure' };
}

const neighbors = (pattern, i, j) => {
    const rows = pattern.length;
    const cols = pattern[0].length;
    const out = [];
    for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const na = i + da;
        const nb = j + db;
        if (na >= 0 && nb >= 0 && na < rows && nb < cols && isBead(pattern[na][nb])) out.push(pattern[na][nb]);
    }
    return out;
};

const majorOf = (list) => {
    const tally = new Map();
    for (const ch of list) tally.set(ch, (tally.get(ch) ?? 0) + 1);
    let best = null;
    let bestN = -1;
    for (const [ch, n] of tally) {
        if (n > bestN || (n === bestN && ch < best)) {
            best = ch;
            bestN = n;
        }
    }
    return best;
};

/**
 * 生成后二次优化修复：三个原子操作反复扫描至稳定（上限 3 轮）。
 * ① 吞孤点（面积 1 → 邻色多数；四邻皆空则删为 `.`）· ② 并细丝（1 格宽且该色另有主块 →
 * 重涂为邻色多数）· ③ 填小孔（面积 ≤ 4 的内孔 → 邻色多数）。
 * ⛔ 不改盘尺寸、不引入新颜色、不碰 `x` 锁定格；返回 `log` 供 studio 回执。
 */
export function repair(pattern, { maxPasses = 3 } = {}) {
    const grid = pattern.map((r) => [...r]);
    const rows = grid.length;
    const cols = rows ? grid[0].length : 0;
    const log = [];
    const asPattern = () => grid.map((r) => r.join(''));
    const blocksOf = () => {
        const p = asPattern();
        return components(rows, cols, (i, j) => (isBead(p[i][j]) ? p[i][j] : null)).map((cells) => {
            const bb = bboxOf(cells);
            return { ch: p[cells[0][0]][cells[0][1]], area: cells.length, h: bb.h, w: bb.w, cells };
        });
    };

    for (let pass = 0; pass < maxPasses; pass += 1) {
        let touched = 0;

        // ③ 填小孔
        const p0 = asPattern();
        for (const hole of components(rows, cols, (i, j) => (isBead(p0[i][j]) ? null : 'bg'))) {
            const touchesEdge = hole.some(([r, c]) => r === 0 || c === 0 || r === rows - 1 || c === cols - 1);
            if (touchesEdge || hole.length > 4) continue;
            const ring = hole.flatMap(([r, c]) => neighbors(p0, r, c));
            const fill = majorOf(ring);
            if (!fill) continue;
            for (const [r, c] of hole) grid[r][c] = fill;
            touched += hole.length;
            log.push(`填孔 ${hole.length} 格→${fill}`);
        }

        // ①② 孤点 / 细丝
        const blocks = blocksOf();
        const areaByCh = new Map();
        for (const b of blocks) areaByCh.set(b.ch, (areaByCh.get(b.ch) ?? 0) + b.area);
        const p1 = asPattern();
        for (const b of blocks) {
            const isSpeck = b.area === 1;
            const isSilk = Math.min(b.h, b.w) === 1 && b.area >= 2;
            if (!isSpeck && !isSilk) continue;
            const ring = b.cells.flatMap(([r, c]) => neighbors(p1, r, c)).filter((ch) => ch !== b.ch);
            // 细丝只在「该色另有主块（≥ 9 格）」时并入邻色，否则保留（避免吃掉该色的唯一形体）
            const hasMain = (areaByCh.get(b.ch) ?? 0) - b.area >= LIMITS.beadsPerBlock;
            if (isSilk && !hasMain) continue;
            const to = majorOf(ring);
            if (!to) {
                if (isSpeck) {
                    const [r, c] = b.cells[0];
                    grid[r][c] = '.';
                    touched += 1;
                    log.push('删孤点 1 格（无邻珠）');
                }
                continue;
            }
            for (const [r, c] of b.cells) grid[r][c] = to;
            touched += b.area;
            log.push(`${isSpeck ? '吞孤点' : '并细丝'} ${b.area} 格 ${b.ch}→${to}`);
        }

        if (!touched) break;
    }

    // 汇总：按操作类型合计格数（回执不刷屏）
    const tally = new Map();
    for (const line of log) {
        const [op] = line.split(' ');
        const n = Number((line.match(/\s(\d+)\s格/) ?? [])[1] ?? 0);
        tally.set(op, (tally.get(op) ?? 0) + n);
    }
    const summary = [...tally.entries()].map(([op, n]) => `${op} ${n} 格`);
    return { pattern: asPattern(), log: summary, changed: summary.length > 0 };
}

// ─────────────────────────────────────────────────────────── CLI ────────────
/** `node tools/scripts/lib/pattern-legibility.mjs --report [--game=beads] [--json]` */
function cli() {
    const argv = process.argv.slice(2);
    if (!argv.includes('--report')) {
        console.log('用法：node tools/scripts/lib/pattern-legibility.mjs --report [--game=beads] [--json]');
        return;
    }
    const game = (argv.find((a) => a.startsWith('--game=')) ?? '--game=beads').split('=')[1];
    const asJson = argv.includes('--json');
    const root = join(import.meta.dirname, '..', '..', '..');
    const levelsDir = join(root, 'games', game, 'design', 'levels');
    const manifest = JSON.parse(readFileSync(join(levelsDir, 'manifest.json'), 'utf8'));
    const rows = [];
    for (const e of manifest.entries) {
        if (e.retired) continue;
        const obj = JSON.parse(readFileSync(join(levelsDir, e.file), 'utf8'));
        const cells = e.kind === 'plate' ? obj.cells : [obj];
        for (const c of cells) {
            if (!Array.isArray(c.pattern)) continue;
            const m = analyze(c.pattern);
            rows.push({ uid: e.kind === 'plate' ? `${e.uid}#${c.id}` : e.uid, kind: e.kind, ...m, verdict: judge(m) });
        }
    }
    if (asJson) {
        console.log(JSON.stringify(rows, null, 2));
        return;
    }
    const head = ['uid', '尺寸', 'C', '珠/块', '块/色', '孤点/N', '细丝', '珠/色', '分量', 'P/√N', '判定'];
    console.log(head.join('\t'));
    for (const r of rows) {
        console.log([
            r.uid,
            `${r.cols}x${r.rows}`,
            r.C,
            r.beadsPerBlock,
            r.blocksPerColor,
            `${(r.speckRate * 100).toFixed(1)}%`,
            r.silks,
            r.beadsPerColor,
            r.parts,
            r.psn,
            r.verdict.ok ? 'OK' : `${r.verdict.kind}:${r.verdict.fails.map((f) => f.k).join(',')}`,
        ].join('\t'));
    }
}

if (import.meta.filename === process.argv[1]) cli();
