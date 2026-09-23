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
import { LEVEL_TIME_MAX, SEC_PER_STEP } from '../../games/beads/src/config/tuning.js';
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
    /**
     * 真引擎点击数（**只计成功命令**）。
     *
     * ⚠️ **旧注释「= 人类点击数的下界」已于 2026-09-23 playtest 证伪，不得再用**：
     * L8 实测人类 104 击 > bot 84 击；`t_act ÷ bot_taps` 跨 0.72–1.27（±38%）
     * ⇒ **不能用本值推人类用时/点击**。bot 在小而碎的盘上退化到接近「1 击 1 颗」
     * （L7 `taps = 1.88 × M`）。本值的定位 = **真最小动作数的可达上界**（贪心策略，
     * 非最优）+ 规模闸的保守剪枝。正本：`levels-spec §5.0` 「bot 的适用边界」/ §5.0.1。
     */
    readonly taps: number;
    /**
     * 可证明的动作数**下界** = 初始盘上「同色 8 向连通错位块」的**个数**（`blobAnchors().length`，
     * 与玩家选组走同一个 `collectMisplacedGroup`）。
     *
     * 成立理由：每颗错位珠必须被某个动作消费，而一次消费（整组取回或盘上直填）
     * **只能动一个连通组内的珠**（移除只会拆分组、不会让两组连通；填回的是「就位珠」
     * 不属于错位集）⇒ 消费动作数 ≥ 组数。
     *
     * ⚠️ **很松，不得当难度代理量**：v1.46 关表 8 关实测 `actionsLB ÷ actions` = **0.13–0.20**
     * （L5 组数 33 vs 实测 236 击；L8 最紧 17 vs 84）⇒ 差 5–8 倍且比值会随盘形飘，
     * 无外推价值。它的作用限于 = 区间左端点 + 异常盘哨兵（`actions < actionsLB` ⇒ 必错）。
     */
    readonly actionsLB: number;
    /** 动作分解（取证）：`places` 托盘→洞、`directFills` 盘上锤直填、`retrieves` 整组取回。 */
    readonly split: { readonly moves: number; readonly places: number; readonly directFills: number; readonly retrieves: number };
    readonly cleared: boolean;
    /** 批量动作数（`直填+取回+落子`，`BAC` 尝试序）= **时长定价的自变量**（公式 v0.4）。 */
    readonly steps: number;
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
    const r = runBot(h, { allowDirectFill: true, retrieve: 'max', usePowerups: false, maxMoves: 20000, branchOrder: 'BAC' });
    CMDS.forEach((name, i) => {
        g[name] = orig[i];
    });
    // 动作分解（取证用）：taps 花在「逐个直填」还是「批量取回+批量填充」上，
    // 决定了 `SEC_PER_STEP` 的量级，不能只看总数。
    const split = { moves: r.moves, places: r.places, directFills: r.directFills, retrieves: r.retrieves };
    /**
     * 定价自变量 = **批量动作数**（选锚并入被它服务的动作）。道具关闭 ⇒ 恰等于循环次数。
     * 尝试序取 **`BAC`**（先取回挖洞→再落子→最后直填）：八关实测上它同时拿下最大误差最小
     * （±28%，旧 `ACB` ±39%）与难度排序最准（Spearman ρ 0.95 vs 0.83）。
     */
    const steps = r.places + r.directFills + r.retrieves;

    const { time, difficulty } = measuredLevelTime(steps);
    const blockers: string[] = [];
    if (!r.cleared) blockers.push(`bot 未通关（${r.stuck.slice(0, 40)}）⇒ 可解性未证实，不可入关`);
    // 规模闸（§3.13）**只用真值**：实测步数 × 每步单价 击空倒计时预算 ⇒ 拒。
    // 为何不用静态代理量（M / B_med）：已入库关卡实测证伪 —— 甜心 B_med=6 但 44 taps
    // 可通关、猫咪脸 B_med=6 而 134 taps 超预算，B_med 同为 6 结果相反 ⇒ 静态量无分辨力；
    // 而 bot 单盘 0.3s，也不需要静态量做早期剪枝。
    if (steps * SEC_PER_STEP > LEVEL_TIME_MAX)
        blockers.push(`实测 ${steps} 个批量动作 × ${SEC_PER_STEP}s = ${Math.round(steps * SEC_PER_STEP)}s > ${LEVEL_TIME_MAX}s（1★ 档内不可能通关）`);
    return {
        id: raw.id,
        name: raw.name,
        dims: `${raw.cols}x${raw.rows}`,
        m,
        bMed,
        taps,
        /** 下界 = 初始错位组数（见 `MeasureResult.actionsLB` 成立理由）。 */
        actionsLB: sizes.length,
        steps,
        split,
        cleared: r.cleared,
        time,
        difficulty,
        blockers,
    };
}

// ───────────────────────────────────────────────────────────────────── CLI

/**
 * 定价溯源块（**dev-only**）：随关卡真源落盘，`sync-levels-data.mjs` 会整块剔除，
 * 不进 `LEVELS_DATA` / cocos 镜像 / 包体。
 *
 * 为何要落：现在 `time` 是个孤儿数字 —— 它是 `taps × SEC_PER_TAP` 算完即扔的结果，
 * 谁改了 `pattern` 不会有人发现 `time` 已过期。存下动作数 + 当时单价后，
 * `levels:check` 能校 `time` 与定价方式一致；公式 v0.3 的校准面（bot 值 ↔ 人类
 * 实测 `t_act`）也有了对齐落点。
 *
 * `source` 两态：`bot` = 生成期先验；`playtest` = 已人工试玩，额外带
 * `tAct`（实测用时）/ `k`（紧度系数）/ `humanActions`（= 结算面板「N 击」），
 * 此时 `time = round(tAct × k)`（§5.0 公式 v0.3）。
 *
 * `clamped` = `taps × SEC_PER_TAP` 被 `LEVEL_TIME_MIN/MAX` 钳过 ⇒ `levels:check`
 * 的等式不变式跳过本关（钳位上下界住在 `tuning.ts`，本脚本不跨语言再抄一份）。
 */
export function pricingOf(res: MeasureResult) {
    const raw = Math.round(res.steps * SEC_PER_STEP);
    return {
        source: 'bot' as const,
        steps: res.steps,
        stepsLB: res.actionsLB,
        taps: res.taps,
        actionsSplit: res.split,
        secPerStep: SEC_PER_STEP,
        clamped: raw !== res.time,
        cleared: res.cleared,
    };
}

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
/** 真源层关卡 = 运行时形状 + dev-only `pricing`（产物不含，故**不进** `BeadsLevelRaw`）。 */
type SourceLevel = BeadsLevelRaw & { readonly pricing?: ReturnType<typeof pricingOf> };

const argv = process.argv.slice(2);
const target = argv.find((a) => !a.startsWith('--'));
const idArg = argv.indexOf('--id');
const wantId = idArg >= 0 ? Number(argv[idArg + 1]) : null;
const patch = argv.includes('--patch');
if (!target) {
    console.error('用法：beads-bot.ts <pattern.json | levels.json> [--id N] [--patch]');
    process.exit(2);
}

const doc = JSON.parse(readFileSync(target, 'utf8')) as PatternDoc & Partial<LevelsDoc & { levels: SourceLevel[] }>;
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
            if (i >= 0) doc.levels[i] = { ...doc.levels[i]!, time: res.time, pricing: pricingOf(res) };
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
        if (doc.levelDraft) { doc.levelDraft.time = res.time; (doc.levelDraft as Record<string, unknown>).pricing = pricingOf(res); }
        if (doc.report) {
            doc.report.difficulty = {
                score: res.difficulty,
                timeEst: res.time,
                misplaced: res.m,
                taps: res.taps,
                bMed: res.bMed,
                split: res.split,
                steps: res.steps,
                cleared: res.cleared,
                secPerStep: SEC_PER_STEP,
                blockers: res.blockers,
                formula: 'v0.4（真引擎实测 BAC 批量动作数 × SEC_PER_STEP）',
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
// stdout 末行 = 调用方契约（`server.mjs measureWithBot/measureCells` 直接 JSON.parse）：
// 除 `MeasureResult` 本身外附带 `pricing` 溯源块 ⇒ 调用方不重建构造式，单一真源在 `pricingOf`。
const out = results.map((r) => ({ ...r, pricing: pricingOf(r) }));
console.log(JSON.stringify(out.length === 1 ? out[0] : out));
if (results.some((r) => r.blockers.length > 0)) process.exit(4); // 硬拦：调用方据退出码拒产/拒收
