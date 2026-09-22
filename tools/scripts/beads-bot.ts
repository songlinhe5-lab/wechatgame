// 生成期/入关期「真引擎实测」工具 —— 难度公式 v0.2（§3.5 v1.41）的时长真源。
//
// **为什么存在**：v0.1 按颗定价（`M × 22.5s`）在 32 盘真实语料上 **32/32 触顶 420s**，
// 且隐含「每点击秒数」跨 0.46–70s（150 倍）⇒ 既造出倒计时内不可能通关的盘，也造出白给
// 3★ 的盘。取证（`games/beads/design/forensics/diff-v02/grid.log.txt`）进一步证明：静态
// 结构量预测不了点击数（6 个候选模型最好的中位误差 38%、最大 87%）—— 真实批量由托盘占用
// 动态与「同色空格连通域」几何支配，全错位初盘空格数为 0、连通域随玩法演化，静态盘面看不见。
// ⇒ 不拟合代理公式，**直接测**：单盘 bot 全程 0.1–0.4s。
//
// 铁律（同 g3-lib）：**不复制任何判定逻辑**。装配走生产 BOOT（`pattern` + `misplaced`），
// 每一步操作走 `BeadsGame` 公开命令（经 g3 已验证的 `runBot`），时长/难度走生产
// `measuredLevelTime`，闸门阈值走生产 `tuning` 常量。本文件只做「装盘 + 埋点计数 + 汇总」。
//
// 用法（仓内；容器无引擎 ⇒ 不可用，见 README「部署边界」）：
//   node --experimental-transform-types \
//     --import=./games/beads/design/forensics/g3/g3-hooks.mjs \
//     tools/scripts/beads-bot.ts <pattern.json | levels.json> [--id N] [--patch]
// stdout **最后一行** = 结果 JSON（单关对象 / `--levels` 无 `--id` 时为数组）；
// `--patch` 把实测 `time`（与 pattern 模式的 `difficulty`）写回目标文件。

import { readFileSync, writeFileSync } from 'node:fs';
import { createBeadsHarness, simpleTestLevel } from '../../games/beads/tests/helpers.js';
import { measuredLevelTime } from '../../games/beads/src/game/level-import.js';
import { LEVEL_TIME_MAX, SEC_PER_TAP } from '../../games/beads/src/config/tuning.js';
import { blobAnchors, runBot } from '../../games/beads/design/forensics/g3/g3-lib.js';
import type { BeadsLevelRaw } from '../../games/beads/src/config/levels-data.js';

export interface MeasureResult {
    readonly id: number;
    readonly name: string;
    readonly dims: string;
    /** M = 装配后实算错位珠数（全错位模式 = 可填豆数；交换模式 = 2k）。 */
    readonly m: number;
    /** 错位同色 8 向连通块中位大小（组选真码度量；交换模式下无意义 ⇒ 0）。 */
    readonly bMed: number;
    /** 真引擎点击数（**只计成功命令** = 人类点击数的下界；bot 探测性误点另计不上）。 */
    readonly taps: number;
    /** 动作分解（取证）：`places` 托盘→洞、`directFills` 盘上锤直填、`retrieves` 整组取回。 */
    readonly split: { readonly moves: number; readonly places: number; readonly directFills: number; readonly retrieves: number };
    readonly cleared: boolean;
    readonly time: number;
    readonly difficulty: number;
    /** 硬拦判据（非空 ⇒ 不可入关）；阈值全来自 `tuning`（§3.13/§3.5）。 */
    readonly blockers: readonly string[];
}

/** 四个公开命令 = 玩家四种点击；包一层计数，**不改判定逻辑**。 */
const CMDS = ['tapGridCell', 'selectBoardBead', 'selectTraySlot', 'retrieveSelectedGroup'] as const;

/** 装一盘（生产 BOOT 装配）→ bot 打到通关 → 实测点击数与时长。 */
export function measureBoard(raw: BeadsLevelRaw, seed = 'beads-bot'): MeasureResult {
    const level = simpleTestLevel({ ...raw, time: LEVEL_TIME_MAX });
    const h = createBeadsHarness({ seed, levels: [level] });
    h.game.goToLevel(0);
    const grid = h.game.grid;
    const m = grid.misplacedCount;
    const full = m > 0 && (raw.misplaced?.length ?? 0) > 0;

    // B_med：错位同色连通块中位数（`collectMisplacedGroup` 真码度量）。
    const sizes = blobAnchors(grid).map((b) => b.size).sort((a, b) => a - b);
    const bMed = full ? (sizes[Math.floor(sizes.length / 2)] ?? 0) : 0;

    const g = h.game as unknown as Record<string, unknown>;
    const orig: ((...a: never[]) => boolean)[] = [];
    let taps = 0;
    CMDS.forEach((name, i) => {
        const fn = g[name] as (...a: never[]) => boolean;
        orig[i] = fn.bind(h.game) as (...a: never[]) => boolean;
        g[name] = (...a: never[]): boolean => {
            const r = orig[i]!(...a);
            if (r) taps++;
            return r;
        };
    });
    const r = runBot(h, { allowDirectFill: true, retrieve: 'max', usePowerups: false, maxMoves: 20000 });
    CMDS.forEach((name, i) => {
        g[name] = orig[i];
    });
    // 动作分解（取证用）：taps 花在「逐个直填」还是「批量取回+批量填充」上，
    // 决定了 SEC_PER_TAP 的量级，不能只看总数。
    const split = { moves: r.moves, places: r.places, directFills: r.directFills, retrieves: r.retrieves };

    const { time, difficulty } = measuredLevelTime(taps);
    const blockers: string[] = [];
    if (!r.cleared) blockers.push(`bot 未通关（${r.stuck.slice(0, 40)}）⇒ 可解性未证实，不可入关`);
    // 规模闸（§3.13 v1.41）**只用真值**：实测点击数×单价击穿倒计时预算 ⇒ 拒。
    // 为何不用静态代理量（M / B_med）：已入库 10 关实测证伪 —— 甜心 B_med=6 但 44 taps
    // 可通关、猫咪脸 B_med=6 而 134 taps 超预算，B_med 同为 6 结果相反 ⇒ 静态量无分辨力，
    // 用作闸会误伤；而 bot 单盘 0.3s，也不需要静态量做早期剪枝。
    if (taps * SEC_PER_TAP > LEVEL_TIME_MAX)
        blockers.push(`实测 ${taps} 次点击 × ${SEC_PER_TAP}s = ${Math.round(taps * SEC_PER_TAP)}s > ${LEVEL_TIME_MAX}s（倒计时内不可能通关）`);
    return {
        id: raw.id,
        name: raw.name,
        dims: `${raw.cols}x${raw.rows}`,
        m,
        bMed,
        taps,
        split,
        cleared: r.cleared,
        time,
        difficulty,
        blockers,
    };
}

// ───────────────────────────────────────────────────────────────────── CLI

interface PatternDoc {
    cols: number;
    rows: number;
    pattern: string[];
    misplaced?: string[];
    swaps?: unknown[];
    levelDraft?: { time?: number | null; cols?: number; rows?: number; pattern?: string[]; misplaced?: string[]; swaps?: unknown[] };
    report?: { difficulty?: unknown } & Record<string, unknown>;
}
interface LevelsDoc {
    levels: BeadsLevelRaw[];
}

const argv = process.argv.slice(2);
const target = argv.find((a) => !a.startsWith('--'));
const idArg = argv.indexOf('--id');
const wantId = idArg >= 0 ? Number(argv[idArg + 1]) : null;
const patch = argv.includes('--patch');
if (!target) {
    console.error('用法：beads-bot.ts <pattern.json | levels.json> [--id N] [--patch]');
    process.exit(2);
}

const doc = JSON.parse(readFileSync(target, 'utf8')) as PatternDoc & Partial<LevelsDoc>;
const results: MeasureResult[] = [];

if (Array.isArray(doc.levels)) {
    // levels JSON 模式：逐关（或 `--id` 单关）。
    for (const lv of doc.levels) {
        if (wantId !== null && lv.id !== wantId) continue;
        results.push(measureBoard(lv));
    }
    if (patch) {
        for (const res of results) {
            const i = doc.levels.findIndex((l) => l.id === res.id);
            // 实测值回写真源（sync-levels-data 随后同步进 src/cocos）；整体替换而非赋值
            // —— `BeadsLevelRaw.time` 是 readonly（关卡数据不可局部突变）。
            if (i >= 0) doc.levels[i] = { ...doc.levels[i]!, time: res.time };
        }
        writeFileSync(target, JSON.stringify(doc, null, 2) + '\n');
    }
} else {
    // pattern.json 模式（beads-gen 产物）：用 levelDraft 装盘。
    const d = doc.levelDraft;
    if (!d || !Array.isArray(d.pattern)) {
        console.error('pattern.json 缺 levelDraft.pattern（mis=none 或错位构造失败）');
        process.exit(3);
    }
    const res = measureBoard({
        id: 900,
        name: 'beads-gen 产物',
        cols: d.cols as number,
        rows: d.rows as number,
        time: LEVEL_TIME_MAX,
        swaps: (d.swaps as BeadsLevelRaw['swaps']) ?? [],
        cycleProfile: 'short',
        decoys: [],
        pattern: d.pattern as string[],
        ...(Array.isArray(d.misplaced) ? { misplaced: d.misplaced as string[] } : {}),
    } as BeadsLevelRaw);
    results.push(res);
    if (patch) {
        // 写回位置 = **前端契约**：beads-studio `index.html` 读 `report.difficulty.{score,timeEst,misplaced}`，
        // 装盘读 `levelDraft.time`。字段名不变，值源从 v0.1 公式换成实测；
        // `taps`/`bMed`/`split`/`blockers` 是 v0.2 新增的取证字段。
        if (doc.levelDraft) doc.levelDraft.time = res.time;
        if (doc.report) {
            doc.report.difficulty = {
                score: res.difficulty,
                timeEst: res.time,
                misplaced: res.m,
                taps: res.taps,
                bMed: res.bMed,
                split: res.split,
                cleared: res.cleared,
                secPerTap: SEC_PER_TAP,
                blockers: res.blockers,
                formula: 'v0.2（真引擎实测 taps × SEC_PER_TAP）',
            };
        }
        writeFileSync(target, JSON.stringify(doc, null, 2) + '\n');
    }
}

for (const res of results) {
    console.error(
        `${res.name} ${res.dims}｜M=${res.m}｜B_med=${res.bMed}｜taps=${res.taps}` +
        `（mv${res.split.moves}/放${res.split.places}/直${res.split.directFills}/取${res.split.retrieves}）` +
        `｜通关=${res.cleared ? 'Y' : 'N'}` +
        `｜time=${res.time}s｜D=${res.difficulty}` +
        (res.blockers.length ? `｜⛔ ${res.blockers.join('；')}` : ''),
    );
}
console.log(JSON.stringify(results.length === 1 ? results[0] : results));
if (results.some((r) => r.blockers.length > 0)) process.exit(4); // 硬拦：调用方据退出码拒产/拒收
