/**
 * 造型工作台核心：把造型期手工摸索出的四件事做成可点、可回退的纯函数。
 *
 * 号标注（2026-10-24 订正）：本文件属 beads-studio **造型工作台批，台账从未登记**。历史头注自引
 *   WXG-T-363 / WXG-T-362 **均为误标**，经核 —— WXG-T-362 已被 `aa5c85e`（三关豆面可读性修复 +
 *   L9 曼陀罗重建）署用，但主表行与详情节均未登记；WXG-T-363 属并发的装扮馆工程批（`ff8efe4`）。
 *   本文件下游 = **WXG-T-364**（大关草稿统一发布 `f47f278`：草稿层正是为「批量小关攒成一个大关」服务）。
 *   ⇒ 本件号**待补登**，⛔ 不得再据此引用 362/363。
 *
 * 为什么独立成文件：`server.mjs` 是 1500 行的路由/事务文件，几何与迭代算法塞进去不可单测。
 * 本文件零依赖（只 import 可读性真源 `pattern-legibility.mjs`），全部函数 **纯**（同输入同输出，
 * seed 显式传入）⇒ 能在 node --test 里逐条断言；`server.mjs` 只做路由转发。
 *
 * 四个能力（= 制作资源时的四个按钮）：
 *   ① buildShape   几何底图（曼陀罗 / 玫瑰花窗 / 靶心）—— 参数化瓣数、环宽、缝宽、盘面
 *   ② despeckle    吞孤点（消 T3）
 *   ③ desilk       并细丝（消 T4）**保留闭合环** —— 这是 造型期实测到的判据缺陷：1 格宽的同心
 *                  环在 4 连通泛洪下会「不闭合」而被当毛刺并掉，环是图案元素不是毛刺。
 *   ④ derange      聚块错排（全错位 + 同色成块）—— 直接决定 bot 的批量动作数（steps）
 *
 * 三条硬约束（造型期实测，写进默认值防后人踩）：
 *   · 环宽 < 1.5 格 ⇒ 1 格宽环在栅格上必然断裂（紫环在赤道整段消失）
 *   · 瓣间白缝 < 0.5 珠宽 ⇒ 离散化后粘连（缝宽取整只有 0 或 1，无中间态）
 *   · 同心环与瓣之间必须有 ≥1 格白环隔离，否则同色环与瓣合并成一块
 */

import { analyze, judge } from '../../tools/scripts/lib/pattern-legibility.mjs';

const VOID = new Set(['.', 'x']);
const isBead = (ch) => !VOID.has(ch);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** 默认调色顺序（字符 '1'..'9'）。前 4 色住同心区，其后住瓣。与 L00009 落盘版一致。 */
export const LAB_PALETTE = ['SE1', 'S120', 'S52', 'S150', 'S36', 'SE4', 'S18', 'ST4', 'S19'];

// ─────────────────────────────────────────────────────────── ① 几何底图 ────

/**
 * 几何底图。三种 mode：
 * - `mandala`  同心环 + N 瓣（默认；还原 l9-boss-mandala-256.png 的 8 瓣曼陀罗）
 * - `rosette`  只有瓣 + 纯色中心（无环，适合 18 格以下小盘）
 * - `target`   只有同心环（靶心；瓣数设 0）
 *
 * @param {object} o
 * @param {'mandala'|'rosette'|'target'} o.mode
 * @param {number} o.size   盘面边长（正方；12–32）
 * @param {number} o.petals 瓣数（0/4/6/8/12）
 * @param {number} o.ringW  环宽（格）；<1.5 会在栅格上断裂
 * @param {number} o.seam   瓣间缝宽（格）；0.5–2.5
 * @param {number} o.phase  瓣相位（度）
 * @param {number} o.sup    超椭圆指数（2=椭圆，3.2=圆角方，越大越方）
 * @returns {{pattern: string[], rows: number, cols: number, paletteCodes: string[]}}
 */
export function buildShape(o = {}) {
    const mode = o.mode ?? 'mandala';
    const size = clampInt(o.size ?? 30, 12, 32);
    const petals = [0, 4, 6, 8, 12].includes(o.petals ?? 8) ? (o.petals ?? 8) : 8;
    const ringW = clampNum(o.ringW ?? 1.6, 0.8, 3.0);
    const seam = clampNum(o.seam ?? 1.5, 0.5, 2.5);
    const phase = ((o.phase ?? 22.5) * Math.PI) / 180;
    const sup = clampNum(o.sup ?? 3.2, 2.0, 6.0);

    const s = size / 30;                     // 相对 30 格的缩放（几何全部按 30 格标定）
    const R = size / 2 - 0.2;
    const coreR = 2.8 * s;
    const yelOut = coreR + ringW * s;
    const purOut = yelOut + ringW * s;
    const whiteOut = purOut + 1.7 * s;

    // 环只在 mandala / target 出现
    const useRings = mode !== 'rosette';
    // 瓣只在 mandala / rosette 出现
    const usePetals = mode !== 'target' && petals > 0;

    // 瓣几何：内缘贴白环，外缘贴盘边 ⇒ a 由 (R − whiteOut) 定，b 由缝宽反解
    let aRad = 0, dPet = 0, bTan = 0;
    if (usePetals) {
        aRad = Math.max(1.2, (R - whiteOut) / 2);
        dPet = whiteOut + aRad;
        const arcGap = (2 * Math.PI * dPet) / petals;
        bTan = Math.max(0.8, (arcGap - seam) / 2);
    }

    const petalColors = ['3', '5', '2', '6', '7', '9', '4', '8']; // '3' 黄 / '5' 玫 / '2' 绿 / '6' 蓝 …
    const grid = [];
    for (let r = 0; r < size; r += 1) {
        let line = '';
        for (let c = 0; c < size; c += 1) {
            const dx = c + 0.5 - size / 2;
            const dy = r + 0.5 - size / 2;
            const rad = Math.hypot(dx, dy);
            if (rad > R + 0.35) { line += '.'; continue; }

            let ch = null;
            if (useRings && rad <= whiteOut) {
                ch = '1';                                       // 白环基底
                if (rad <= purOut) ch = '4';                    // 紫环
                if (rad <= yelOut) ch = '3';                    // 黄环
                if (rad <= coreR) ch = '2';                     // 绿心
            } else if (!useRings && rad <= coreR) {
                ch = '2';                                       // rosette：纯色中心
            }

            if (usePetals) {
                const ang = Math.atan2(dy, dx);
                const step = (2 * Math.PI) / petals;
                for (let i = 0; i < petals; i += 1) {
                    const pa = phase + i * step;
                    let dA = ang - pa;
                    dA = Math.atan2(Math.sin(dA), Math.cos(dA));  // 归一 (-π, π]
                    const u = rad - dPet;
                    const v = rad * dA;                          // 弧长口径 ⇒ 缝等宽
                    if (Math.abs(u / aRad) ** sup + Math.abs(v / bTan) ** sup <= 1) {
                        ch = petalColors[i % petalColors.length];
                        break;
                    }
                }
            }

            // 瓣间白：延伸到基线（< 瓣外缘）⇒ 外轮廓呈波浪（瓣凸出、瓣间凹）
            // 不做这步 ⇒ 瓣间是 void，图案读作「8 个漂浮色块」而不是一朵花。
            if (ch === null && rad <= R - 1.5 * s) ch = '1';

            line += ch ?? '.';
        }
        grid.push(line);
    }
    return { pattern: grid, rows: size, cols: size, paletteCodes: LAB_PALETTE.slice() };
}

// ─────────────────────────────────────────────────────── ② 吞孤点 ────

/** 面积=1 的同色块涂成四邻多数色（消 T3）。不改盘面、不新增颜色。 */
export function despeckle(pattern, { rounds = 4 } = {}) {
    const g = pattern.map((r) => [...r]);
    const rows = g.length, cols = g[0]?.length ?? 0;
    let changed = 0;
    for (let k = 0; k < rounds; k += 1) {
        let touched = 0;
        for (const blk of blocksOf(g.map((r) => r.join('')))) {
            if (blk.cells.length !== 1) continue;
            const [r, c] = blk.cells[0];
            const tally = new Map();
            for (const [dy, dx] of N4) {
                const ny = r + dy, nx = c + dx;
                if (ny < 0 || nx < 0 || ny >= rows || nx >= cols) continue;
                const v = g[ny][nx];
                if (!isBead(v)) continue;
                tally.set(v, (tally.get(v) ?? 0) + 1);
            }
            tally.delete(g[r][c]);
            if (!tally.size) continue;
            const [best] = [...tally.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
            g[r][c] = best[0];
            touched += 1;
        }
        changed += touched;
        if (!touched) break;
    }
    return { pattern: g.map((r) => r.join('')), changed };
}

// ─────────────────────────────────────────────────────── ③ 并细丝 ────

/**
 * 并 1 格宽细丝（消 T4）。**闭合环豁免**：块若包围至少一个 void 格，说明它是环不是毛刺。
 *
 * 为什么必须豁免（造型期实测）：共享库 `repair()` 的并细丝会把黄环 55→48、紫环 67→48
 * 整个吃掉（图案失去同心结构），因为 1 格宽的环在 4 连通泛洪下边界处「不闭合」。
 * 本函数用 **8 连通**判断洞，环得以保留。⛔ 这是 studio 侧能力，不改门禁正本判据（
 * `pattern-legibility.md` 的 T4 定义仍待独立裁定，见 K-012）。
 */
export function desilk(pattern, { rounds = 3, keepRings = true } = {}) {
    const g = pattern.map((r) => [...r]);
    const rows = g.length, cols = g[0]?.length ?? 0;
    let changed = 0;

    // ⚠ 细丝判据必须与 T4 同口径 = **bbox 最短边**（`analyze()` 的 `Math.min(b.h, b.w) === 1`）。
    //   用「每行/每列格数最小值」会把 L 形/凹形块误判成细丝（实测一次误并 189 格，把整个瓣吃掉）。
    const minSide = (cells) => {
        let r0 = Infinity, r1 = -Infinity, c0 = Infinity, c1 = -Infinity;
        for (const [r, c] of cells) {
            if (r < r0) r0 = r;
            if (r > r1) r1 = r;
            if (c < c0) c0 = c;
            if (c > c1) c1 = c;
        }
        return Math.min(r1 - r0 + 1, c1 - c0 + 1);
    };

    for (let k = 0; k < rounds; k += 1) {
        let touched = 0;
        const cur = g.map((r) => r.join(''));
        const total = new Map();
        for (const row of cur) for (const ch of row) if (isBead(ch)) total.set(ch, (total.get(ch) ?? 0) + 1);
        for (const blk of blocksOf(cur)) {
            const cells = blk.cells;
            if (cells.length < 2 || minSide(cells) !== 1) continue;
            if (keepRings && hasHole(cells, rows, cols)) continue;   // 环 = 图案元素
            // 并掉后该色归零 ⇒ 跳过（保住色数）。⚠ total 必须在同轮内递减：同色多个细丝块时
            //   用轮初快照会让它们接连被并、整色消失（用例 A：两块 1×3 直条 changed=6，期望 3）。
            if ((total.get(blk.ch) ?? 0) - cells.length <= 0) continue;
            const own = new Set(cells.map(([r, c]) => `${r},${c}`));
            const tally = new Map();
            for (const [r, c] of cells) {
                for (const [dy, dx] of N4) {
                    const ny = r + dy, nx = c + dx;
                    const key = `${ny},${nx}`;
                    if (ny < 0 || nx < 0 || ny >= rows || nx >= cols || own.has(key)) continue;
                    const v = g[ny][nx];
                    if (!isBead(v)) continue;
                    tally.set(v, (tally.get(v) ?? 0) + 1);
                }
            }
            tally.delete(blk.ch);
            if (!tally.size) continue;
            const [best] = [...tally.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
            for (const [r, c] of cells) g[r][c] = best[0];
            total.set(blk.ch, (total.get(blk.ch) ?? 0) - cells.length);
            total.set(best[0], (total.get(best[0]) ?? 0) + cells.length);
            touched += cells.length;
        }
        changed += touched;
        if (!touched) break;
    }
    return { pattern: g.map((r) => r.join('')), changed };
}

/** 该块是否包围 ≥1 个 void 格（8 连通泛洪；环的判据）。 */
export function hasHole(cells, rows, cols) {
    let r0 = Infinity, r1 = -Infinity, c0 = Infinity, c1 = -Infinity;
    for (const [r, c] of cells) {
        if (r < r0) r0 = r; if (r > r1) r1 = r;
        if (c < c0) c0 = c; if (c > c1) c1 = c;
    }
    r0 -= 1; r1 += 1; c0 -= 1; c1 += 1;
    const own = new Set(cells.map(([r, c]) => `${r},${c}`));
    const outside = new Set();
    const stack = [];
    for (let r = r0; r <= r1; r += 1) { stack.push([r, c0], [r, c1]); }
    for (let c = c0; c <= c1; c += 1) { stack.push([r0, c], [r1, c]); }
    while (stack.length) {
        const [r, c] = stack.pop();
        if (r < r0 || c < c0 || r > r1 || c > c1) continue;
        const key = `${r},${c}`;
        if (outside.has(key) || own.has(key)) continue;
        outside.add(key);
        for (const [dy, dx] of N8) stack.push([r + dy, c + dx]);
    }
    let inner = 0;
    for (let r = r0; r <= r1; r += 1) {
        for (let c = c0; c <= c1; c += 1) {
            const key = `${r},${c}`;
            if (!own.has(key) && !outside.has(key)) inner += 1;
        }
    }
    return inner > 0;
}

// ─────────────────────────────────────────────────── ④ 聚块错排 ────

/**
 * 全错位初盘，且**同色尽量成块**（这是决定 bot 步数的唯一杠杆）。
 *
 * 算法（造型期实测 steps 282→183）：
 *   1. 求 pattern 的 4 连通同色块（每块目标色单一）
 *   2. 给每个块分配一种珠色，约束 `≠ 块目标色`（⇒ 全错位），并尽量「与相邻已分配块同色」以合并
 *   3. 用**受限优先**（每步先满足可用色最少的块）+ 随机重试破解贪心死锁
 *      —— 朴素"取剩余最多"会把非本色耗尽，最后剩本色填不了自己的块（造型期踩过）
 *
 * @returns {{misplaced: string[], blocks: number, ok: boolean, seed: number}}
 */
export function derange(pattern, { seed = 0, tries = 80, mergeBias = 0 } = {}) {
    const blocks = blocksOf(pattern);
    const rows = pattern.length, cols = pattern[0]?.length ?? 0;
    const adj = adjacencyOf(blocks, rows, cols);
    const base = countColors(pattern);

    for (let t = 0; t < tries; t += 1) {
        const plan = tryAssign(blocks, adj, base, seed + t, mergeBias);
        if (!plan) continue;
        const g = pattern.map((row) => [...row].map((ch) => (isBead(ch) ? '.' : ch)));
        let ok = true;
        for (let i = 0; i < blocks.length; i += 1) {
            const cells = [...blocks[i].cells].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
            const seq = [];
            for (const [ch, n] of plan[i]) for (let k = 0; k < n; k += 1) seq.push(ch);
            if (seq.length !== cells.length) { ok = false; break; }
            for (let k = 0; k < cells.length; k += 1) {
                const [r, c] = cells[k];
                g[r][c] = seq[k];
            }
        }
        if (!ok) continue;
        const misplaced = g.map((row) => row.join(''));
        // 双重断言：全错位 + 每色守恒
        let bad = 0;
        const tally = new Map();
        for (let r = 0; r < rows; r += 1) {
            for (let c = 0; c < cols; c += 1) {
                if (!isBead(pattern[r][c])) continue;
                if (misplaced[r][c] === pattern[r][c]) bad += 1;
                tally.set(misplaced[r][c], (tally.get(misplaced[r][c]) ?? 0) + 1);
            }
        }
        if (bad !== 0) continue;
        let same = true;
        for (const [ch, n] of base) if (tally.get(ch) !== n) same = false;
        if (!same) continue;
        return { misplaced, blocks: blocksOf(misplaced).length, ok: true, seed: seed + t };
    }
    return { misplaced: pattern.slice(), blocks: 0, ok: false, seed };
}

function tryAssign(blocks, adj, base, seed, mergeBias) {
    const rnd = mulberry32(seed);
    const pool = new Map(base);
    const plan = blocks.map(() => new Map());
    const room = blocks.map((b) => b.cells.length);
    const done = new Set();

    for (let guard = 0; guard < blocks.length * 40 && done.size < blocks.length; guard += 1) {
        let best = -1, bestKey = null;
        for (let i = 0; i < blocks.length; i += 1) {
            if (done.has(i)) continue;
            let avail = 0;
            for (const [ch, n] of pool) if (n > 0 && ch !== blocks[i].target) avail += 1;
            const key = [avail, -room[i], rnd()];
            if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])
                || (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] < bestKey[2])) {
                bestKey = key; best = i;
            }
        }
        if (best < 0) return null;
        const tgt = blocks[best].target;
        let pick = null, pickScore = -Infinity;
        for (const [ch, n] of pool) {
            if (n <= 0 || ch === tgt) continue;
            let near = 0;
            if (mergeBias > 0) {
                for (const j of adj[best]) {
                    const got = plan[j].get(ch) ?? 0;
                    if (got > 0) near += blocks[j].cells.length;
                }
            }
            const score = mergeBias > 0 ? mergeBias * near + n * 0.05 : n;
            if (score > pickScore) { pickScore = score; pick = ch; }
        }
        if (!pick) return null;
        const take = Math.min(pool.get(pick), room[best]);
        plan[best].set(pick, (plan[best].get(pick) ?? 0) + take);
        pool.set(pick, pool.get(pick) - take);
        room[best] -= take;
        if (room[best] === 0) done.add(best);
    }
    if (done.size < blocks.length) return null;
    for (const [, n] of pool) if (n > 0) return null;
    return plan;
}

// ─────────────────────────────────────────────── 指标 / 工具 ────

/** 门禁七项 + DI 所需中间量（口径与 `pattern-legibility.mjs` / `difficulty.ts` 一致）。
 *  ⚠ `analyze()` 不返回同色相邻率（那是 `boardStats` 的事）⇒ A/K 在此自算，勿再从 m 上取。 */
export function labReport(pattern) {
    const m = analyze(pattern);
    const v = judge(m);
    const A = round3(adjRate(pattern));
    const K = round3(1 - A);
    const fC = round3(Math.min(2.0, Math.max(0.6, 1 + 0.1 * (m.C - 5))));
    const fK = round3(Math.max(0.35, 1 + 1.6 * (K - 0.5)));
    const DI = Math.round(m.N * fC * fK * 10) / 10;   // ρ=1（全错位）时的上限值
    return {
        N: m.N, C: m.C, A, K, fC, fK, DI,
        T1: round1(m.beadsPerBlock), T2: round2(m.blocksPerColor),
        T3: round4(m.speckRate), T4: m.silks,
        T5: round1(m.beadsPerColor), T6: m.parts, T7: m.shortSide,
        blocks: m.blocks ?? Math.round(m.N / m.beadsPerBlock),
        ok: v.ok,
        fails: v.fails.map((f) => ({ k: f.k, label: f.label, value: round2f(f.value), limit: f.limit })),
        kind: v.kind,
    };
}

export function blocksOf(pattern) {
    const rows = pattern.length, cols = pattern[0]?.length ?? 0;
    const seen = new Set();
    const out = [];
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            const ch = pattern[r][c];
            if (!isBead(ch)) continue;
            const k0 = `${r},${c}`;
            if (seen.has(k0)) continue;
            const cells = [];
            const stack = [[r, c]];
            seen.add(k0);
            while (stack.length) {
                const [y, x] = stack.pop();
                cells.push([y, x]);
                for (const [dy, dx] of N4) {
                    const ny = y + dy, nx = x + dx;
                    if (ny < 0 || nx < 0 || ny >= rows || nx >= cols) continue;
                    if (pattern[ny][nx] !== ch) continue;
                    const key = `${ny},${nx}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    stack.push([ny, nx]);
                }
            }
            out.push({ ch, target: ch, cells });
        }
    }
    return out;
}

function adjacencyOf(blocks, rows, cols) {
    const owner = new Map();
    blocks.forEach((b, i) => { for (const [r, c] of b.cells) owner.set(`${r},${c}`, i); });
    const adj = blocks.map(() => new Set());
    for (const [key, i] of owner) {
        const [r, c] = key.split(',').map(Number);
        for (const [dy, dx] of N4) {
            const j = owner.get(`${r + dy},${c + dx}`);
            if (j !== undefined && j !== i) { adj[i].add(j); adj[j].add(i); }
        }
    }
    return adj;
}

/** A = 同色边 / 双可填相邻边（4 向、双向计数；口径 = `difficulty.ts` 的 boardStats.adjRate）。 */
export function adjRate(pattern) {
    const rows = pattern.length, cols = pattern[0]?.length ?? 0;
    let same = 0, edges = 0;
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            if (!isBead(pattern[r][c])) continue;
            for (const [dy, dx] of N4) {
                const ny = r + dy, nx = c + dx;
                if (ny < 0 || nx < 0 || ny >= rows || nx >= cols) continue;
                if (!isBead(pattern[ny][nx])) continue;
                edges += 1;
                if (pattern[ny][nx] === pattern[r][c]) same += 1;
            }
        }
    }
    return edges ? same / edges : 0;
}

function countColors(pattern) {
    const m = new Map();
    for (const row of pattern) for (const ch of row) if (isBead(ch)) m.set(ch, (m.get(ch) ?? 0) + 1);
    return m;
}

function mulberry32(a) {
    let t = a >>> 0;
    return () => {
        t = (t + 0x6D2B79F5) >>> 0;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
const clampNum = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
const round1 = (x) => Math.round(x * 10) / 10;
const round2 = (x) => Math.round(x * 100) / 100;
const round3 = (x) => Math.round(x * 1000) / 1000;
const round4 = (x) => Math.round(x * 10000) / 10000;
const round2f = (x) => (typeof x === 'number' ? round3(x) : x);
