#!/usr/bin/env node
/**
 * beads MVP 图案出图器（ADR-0018 两档：关 1–4 = small14 14×14；关 5–8 = small18 18×18）。
 *
 * 定位（诚实）：本工具把**手工绘制的 rowstring 剪影**渲染成 solved/misplaced 预览 PNG，
 * 并按 `levels-spec §2.1` 的交换构造法生成 `swaps`，产出**关卡数据草案**。
 * 它**不判 PASS** —— 入关仍由 `levels.ts` BOOT 校验决定；本工具只做视觉选型与数据成形。
 *
 * 与 `beads-gen.mjs`（照片→量化管线，属每日挑战轨）分工不同：那套会做去背景/平滑/碎块合并，
 * 会破坏手工剪影；本工具**原样接受 rowstring**，不改图案像素（只按 swaps 复原初始盘）。
 *
 * 字符集（`systems-index §3.2`）：`.`=void 空位；`1-9A`=色板索引 1..10。
 * 色板真源：`games/beads/src/view/palette.ts::BEAD_PALETTE`。
 *
 * 用法：
 *   node tools/scripts/beads-mvp-patterns.mjs            # 出全部 8 关
 *   node tools/scripts/beads-mvp-patterns.mjs --only 1,3 # 只出指定关（调试用）
 *   node tools/scripts/beads-mvp-patterns.mjs --out temp/beads-mvp --cell 26
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { dirname as dirOf } from 'node:path';
import { fileURLToPath as urlToPath } from 'node:url';

const SCRIPT_DIR = dirOf(urlToPath(import.meta.url));

// ── playwright/chromium（同 beads-gen.mjs）────────────────────────────────────
let chromium = null;
for (const c of [
    join(homedir(), '.workbuddy/binaries/node/workspace/node_modules'),
    join(SCRIPT_DIR, '../../node_modules'),
    join(process.cwd(), 'node_modules'),
]) {
    try {
        chromium = createRequire(join(c, 'package.json'))('playwright').chromium;
        break;
    } catch {
        /* try next */
    }
}
if (!chromium) {
    console.error('playwright/chromium 不可解析（参考 beads-gen.mjs）');
    process.exit(3);
}

// ── 色板（真源 view/palette.ts::BEAD_PALETTE）─────────────────────────────────
const BEAD_PALETTE = [
    '#FDF6E9', // 1 奶白
    '#FFD23F', // 2 柠黄
    '#F59B23', // 3 活力橙
    '#3FBF6B', // 4 草绿
    '#E84C3D', // 5 玫红
    '#8E6FD9', // 6 丁香紫
    '#3D7BF5', // 7 湖蓝
    '#A5652C', // 8 赭棕
    '#6B3E1E', // 9 深棕
    '#33333D', // 10 炭黑
];
const VOID_HEX = '#E9E6F2';
const CHARSET = '.123456789A';

// ── argv ──────────────────────────────────────────────────────────────────────
const A = process.argv.slice(2);
const arg = (k, d) => {
    const i = A.indexOf('--' + k);
    return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d;
};
const outDir = arg('out', join(process.cwd(), 'temp/beads-mvp'));
const cell = Math.max(6, parseInt(arg('cell', '26'), 10));
const onlyArg = arg('only', '');
const onlySet = onlyArg ? new Set(onlyArg.split(',').map((x) => +x)) : null;

// ── 8 个手工 pattern（ADR-0018 分档）─────────────────────────────────────────
// tier1 = 14×14、3–6 色；tier2 = 18×18、5–8 色。k = 错位交换对数（levels-spec §3 递增）。
// 每行长度必须 = cols；工具会逐行校验并报出越界行，据以修正。
const LEVELS = [
    {
        id: 1, name: '甜心', tier: 1, cols: 14, rows: 14, k: 2, cycleProfile: 'short',
        pattern: [
            '..............',
            '..............',
            '..555....333..',
            '.55115..33333.',
            '.551155333333.',
            '.555555533333.',
            '.555555533333.',
            '..5555533333..',
            '...55553333...',
            '....555333....',
            '.....6666.....',
            '......66......',
            '..............',
            '..............',
        ],
    },
    {
        id: 2, name: '五角星', tier: 1, cols: 14, rows: 14, k: 3, cycleProfile: 'short',
        pattern: [
            '......21......',
            '......22......',
            '......22......',
            '22....22....22',
            '.222222222222.',
            '..2222552222..',
            '...22555522...',
            '....333333....',
            '...33333333...',
            '..33..33..33..',
            '.33...33...33.',
            '.3....33....3.',
            '......33......',
            '..............',
        ],
    },
    {
        id: 3, name: '盆栽雏菊', tier: 1, cols: 14, rows: 14, k: 4, cycleProfile: 'short',
        pattern: [
            '......11......',
            '......11......',
            '..11.2222.11..',
            '.111222222111.',
            '11122222222111',
            '11122222222111',
            '.111222222111.',
            '..11.2222.11..',
            '......11......',
            '......44......',
            '......44......',
            '..3333333333..',
            '...33333333...',
            '....333333....',
        ],
    },
    {
        id: 4, name: '上箭头', tier: 1, cols: 14, rows: 14, k: 5, cycleProfile: 'long',
        pattern: [
            '......33......',
            '.....7755.....',
            '....777555....',
            '...77775555...',
            '..7777755555..',
            '.777777555555.',
            '......11......',
            '......11......',
            '......11......',
            '......44......',
            '......44......',
            '......44......',
            '......44......',
            '..............',
        ],
    },
    {
        id: 5, name: '苹果树', tier: 2, cols: 18, rows: 18, k: 5, cycleProfile: 'short',
        pattern: [
            '.....44444.....22.',
            '....4444444...222.',
            '...444444444..222.',
            '...4454445444.22..',
            '...444444444444...',
            '...445444445444...',
            '....4444444444....',
            '.......888........',
            '.......888........',
            '.......888........',
            '.......888........',
            '......88888.......',
            '......88888.......',
            '..88888888888888..',
            '..88888888888888..',
            '..88888888888888..',
            '..................',
            '..................',
        ],
    },
    {
        id: 6, name: '暖暖小屋', tier: 2, cols: 18, rows: 18, k: 6, cycleProfile: 'long',
        pattern: [
            '.........8........',
            '........888.......',
            '.......88888......',
            '......8888888.....',
            '.....888888888....',
            '....88888888888...',
            '...8888888888888..',
            '..888888888888888.',
            '....3333333333....',
            '....3377337733....',
            '....3377337733....',
            '....3333333333....',
            '....3331133333....',
            '....3331133333....',
            '....3331133333....',
            '....3331133333....',
            '..................',
            '..................',
        ],
    },
    {
        id: 7, name: '猫咪脸', tier: 2, cols: 18, rows: 18, k: 7, cycleProfile: 'long',
        pattern: [
            '..88........33....',
            '.8888......3333...',
            '.88668....336633..',
            '.8888888833333333.',
            '88888888833333333.',
            '88888888833333333.',
            '88118888833311333.',
            '88118888833311333.',
            '88888855553333333.',
            '888885555533333333',
            '888888555533333333',
            '.888888833333333..',
            '.8888888833333333.',
            '..88888833333333..',
            '....888833333333..',
            '..................',
            '..................',
            '..................',
        ],
    },
    {
        id: 8, name: '双樱果', tier: 2, cols: 18, rows: 18, k: 8, cycleProfile: 'long',
        pattern: [
            '.........88.......',
            '........88........',
            '......44488.......',
            '....4444488.......',
            '...4444448........',
            '....444448........',
            '......888.........',
            '.....88.88........',
            '....88...88.......',
            '...88.....88......',
            '..5558...8555.....',
            '.55555...55555....',
            '.51555...55515....',
            '.55555...55555....',
            '..5555...5555.....',
            '...555...555......',
            '..................',
            '..................',
        ],
    },
];

// ── 纯逻辑 ────────────────────────────────────────────────────────────────────
/** rowstring → 颜色索引数组（0=void）。行长越界即抛错（带关号与行号）。 */
function decode(lv) {
    const { cols, rows, id, pattern } = lv;
    if (pattern.length !== rows) throw new Error(`L${id} 行数 ${pattern.length} != rows ${rows}`);
    const arr = new Array(cols * rows).fill(0);
    for (let r = 0; r < rows; r++) {
        const s = pattern[r];
        if (s.length !== cols) {
            throw new Error(`L${id} r${r} 长度 ${s.length} != cols ${cols}  「${s}」`);
        }
        for (let c = 0; c < cols; c++) {
            const ch = s[c];
            const idx = CHARSET.indexOf(ch);
            if (idx < 0) throw new Error(`L${id} r${r}c${c} 非法字符「${ch}」`);
            arr[r * cols + c] = idx; // '.' → 0
        }
    }
    return arr;
}

function encode(arr, cols, rows) {
    const out = [];
    for (let r = 0; r < rows; r++) {
        let s = '';
        for (let c = 0; c < cols; c++) s += CHARSET[arr[r * cols + c]];
        out.push(s);
    }
    return out;
}

/** 直方图 + 用色集。 */
function colorSet(arr) {
    const s = new Set();
    for (const v of arr) if (v > 0) s.add(v);
    return [...s].sort((a, b) => a - b);
}

/** 同色相邻率（4 邻、仅两可填格间计边），聚集度代理量。 */
function adjacencyRate(arr, cols, rows) {
    let same = 0, total = 0;
    const at = (r, c) => arr[r * cols + c];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const v = at(r, c);
            if (v === 0) continue;
            if (c + 1 < cols) { total++; if (at(r, c + 1) === v) same++; }
            if (r + 1 < rows) { total++; if (at(r + 1, c) === v) same++; }
        }
    }
    return total ? +(same / total).toFixed(3) : 0;
}

/** 最大连通同色块（格数）。 */
function maxBlob(arr, cols, rows) {
    const seen = new Uint8Array(arr.length);
    let max = 0;
    for (let i = 0; i < arr.length; i++) {
        if (seen[i] || arr[i] === 0) continue;
        const color = arr[i];
        let n = 0;
        const stack = [i];
        seen[i] = 1;
        while (stack.length) {
            const p = stack.pop();
            n++;
            const r = (p / cols) | 0, c = p % cols;
            const nb = [];
            if (r > 0) nb.push(p - cols);
            if (r < rows - 1) nb.push(p + cols);
            if (c > 0) nb.push(p - 1);
            if (c < cols - 1) nb.push(p + 1);
            for (const q of nb) if (!seen[q] && arr[q] === color) { seen[q] = 1; stack.push(q); }
        }
        if (n > max) max = n;
    }
    return max;
}

/** 交换构造法（同 beads-gen §buildSwaps，确定性、无 RNG）。 */
function buildSwaps(arr, cols, k, minDist = 2) {
    const cells = [];
    for (let i = 0; i < arr.length; i++) if (arr[i] > 0) cells.push(i);
    const used = new Uint8Array(arr.length);
    const swaps = [];
    for (let a = 0; a < cells.length && swaps.length < k; a++) {
        const ia = cells[a];
        if (used[ia]) continue;
        const ra = (ia / cols) | 0, ca = ia % cols;
        for (let b = a + 1; b < cells.length; b++) {
            const ib = cells[b];
            if (used[ib] || arr[ib] === arr[ia]) continue;
            const rb = (ib / cols) | 0, cb = ib % cols;
            if (Math.abs(ra - rb) + Math.abs(ca - cb) < minDist) continue;
            swaps.push([ra, ca, rb, cb]);
            used[ia] = 1;
            used[ib] = 1;
            break;
        }
    }
    const init = arr.slice();
    for (const [r1, c1, r2, c2] of swaps) {
        const i1 = r1 * cols + c1, i2 = r2 * cols + c2;
        const t = init[i1]; init[i1] = init[i2]; init[i2] = t;
    }
    return { swaps, init, pairs: swaps.length };
}

/**
 * 全盘错位（derangement）：可填格按 (色号, 行主序) 排序后整体循环左移 maxFreq 位。
 * —— 同 beads-gen §derange / 每日挑战密集盘口径。
 * 充要前提：maxFreq ≤ ⌊N/2⌋（`MISPLACED_COLOR_CAP=0.5`）⇒ 每格新色必 ≠ 原色（无固定点）。
 * 不满足时仍做循环移位，但会残留固定点（该色超半数部分无法错），报告如实标 ok=false。
 * 因同色连续游程整体移到下一色 ⇒ **成片错豆**（整块区域统一错色）。
 * 确定性（无 RNG，守 L4）；珠色多重集守恒（可解）。
 */
function derange(arr, cols, rows) {
    const idx = [];
    for (let i = 0; i < arr.length; i++) if (arr[i] > 0) idx.push(i);
    idx.sort((a, b) => arr[a] - arr[b] || a - b);
    const N = idx.length;
    const cnt = {};
    for (const i of idx) cnt[arr[i]] = (cnt[arr[i]] || 0) + 1;
    const maxFreq = Math.max(0, ...Object.values(cnt));
    const cap = Math.floor(N / 2);
    const init = arr.slice();
    if (N >= 2) {
        for (let i = 0; i < N; i++) {
            const src = idx[(i + maxFreq) % N];
            init[idx[i]] = arr[src];
        }
    }
    let misplaced = 0;
    for (let i = 0; i < arr.length; i++) if (arr[i] > 0 && init[i] !== arr[i]) misplaced++;
    return { init, N, maxFreq, cap, ok: maxFreq <= cap && misplaced === N, misplaced };
}

// ── 渲染 ──────────────────────────────────────────────────────────────────────
const browser = await chromium.launch();
const page = await browser.newPage();

async function renderPng(colors, cols, rows, label, dir) {
    const url = await page.evaluate(
        ({ w, h, colors, pal, voidHex, cell }) => {
            const gap = 2, pad = 3;
            const cv = document.createElement('canvas');
            cv.width = pad * 2 + w * (cell + gap) - gap;
            cv.height = pad * 2 + h * (cell + gap) - gap;
            const g = cv.getContext('2d');
            g.fillStyle = '#FFFFFF';
            g.fillRect(0, 0, cv.width, cv.height);
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const v = colors[y * w + x];
                    g.fillStyle = v > 0 ? pal[v - 1] : voidHex;
                    g.fillRect(pad + x * (cell + gap), pad + y * (cell + gap), cell, cell);
                }
            }
            return cv.toDataURL('image/png');
        },
        { w: cols, h: rows, colors, pal: BEAD_PALETTE, voidHex: VOID_HEX, cell },
    );
    writeFileSync(join(dir, label + '.png'), Buffer.from(url.split(',')[1], 'base64'));
}

// ── 主流程 ────────────────────────────────────────────────────────────────────
mkdirSync(outDir, { recursive: true });
// 产物 = 真源 JSON 形态（对齐 LevelsData / BeadsLevelRaw），可直接落 design/levels/。
const draft = {
    version: 2,
    gameId: 'beads',
    description:
        '拼豆 MVP 前 8 关（ADR-0018 两档：关 1–4 = small14 14×14、关 5–8 = small18 18×18；全错位初盘 misplaced，字符集 .x1-9A，色板索引见 art-bible §3.2）。',
    levels: [],
};

// MVP 时长公式（用户 2026-09-20 暂定：优先级 **珠子数 > 颜色数 > 同色聚集度**）。
//   珠数 = 线性主项（工作量：每颗错位珠要找+取回+归位）；色数 = 次级乘子（视觉搜索扇出）；
//   聚集度 = 末级乘子（同色越散=越难找=多给时，成片=易连续填充=少给）。钳进 §3.5 [120,420]。
//   正式曲线待 playtest 校准（levels-spec §2.2：全错位盘不套旧 k 定价）。
const LEVEL_TIME_MIN = 120;
const LEVEL_TIME_MAX = 420;
function computeTime(fillable, colors, adjacency) {
  const base = 45 + 1.6 * fillable; // 珠数主导
  const colorAdj = 1 + (colors - 4) * 0.04; // 色数次级（4 色为基准）
  const clusterAdj = 1 + (0.75 - adjacency) * 0.3; // 聚集度末级（0.75 为基准）
  const t = Math.round(base * colorAdj * clusterAdj);
  return Math.max(LEVEL_TIME_MIN, Math.min(LEVEL_TIME_MAX, t));
}

let anyError = false;
for (const lv of LEVELS) {
    if (onlySet && !onlySet.has(lv.id)) continue;
    let arr;
    try {
        arr = decode(lv);
    } catch (e) {
        console.error(`❌ ${e.message}`);
        anyError = true;
        continue;
    }
    const { cols, rows } = lv;
    const colors = colorSet(arr);
    const fill = arr.filter((v) => v > 0).length;
    const adj = adjacencyRate(arr, cols, rows);
    const tierColorsOk = colors.length >= 4 && (lv.tier === 1 ? colors.length <= 6 : colors.length <= 8);
    const der = derange(arr, cols, rows);
    const time = computeTime(fill, colors.length, adj);

    const dir = join(outDir, `lv${String(lv.id).padStart(2, '0')}`);
    mkdirSync(dir, { recursive: true });
    await renderPng(arr, cols, rows, 'solved', dir);
    await renderPng(der.init, cols, rows, 'misplaced', dir);

    console.log(
        `L${lv.id} ${lv.name} · ${cols}×${rows} · tier${lv.tier} · ` +
        `色${colors.length}[${colors.join('')}] ${tierColorsOk ? '✅' : '⚠️色数'} · ` +
        `可填${fill} · 相邻率${adj} · time=${time}s · ` +
        `错位${der.misplaced}/${der.N}（${der.ok ? '✅全错' : `⚠️maxFreq${der.maxFreq}>½${der.cap} 残留${der.N - der.misplaced}固定点`}）`,
    );

    draft.levels.push({
        id: lv.id,
        name: lv.name,
        cols,
        rows,
        time,
        cycleProfile: lv.cycleProfile,
        decoys: [],
        // misplaced 全错位初盘为真源；swaps 置空数组占位（引擎见 misplaced 即忽略 swaps）。
        swaps: [],
        misplaced: encode(der.init, cols, rows),
        pattern: encode(arr, cols, rows),
    });
}
await browser.close();

writeFileSync(join(outDir, 'levels-mvp-draft.json'), JSON.stringify(draft, null, 2) + '\n');
console.log(`\n预览目录 = ${outDir}/lv01..lv08/{solved.png,misplaced.png}`);
console.log(`真源形态 JSON = ${join(outDir, 'levels-mvp-draft.json')}（可覆盖 design/levels/levels-01-08.json）`);
if (anyError) {
    console.error('\n⚠️ 有 pattern 行长/字符越界，见上方 ❌，修正后重跑。');
    process.exit(1);
}
