/**
 * 在线关卡导入（WXG-T-179 续作 · beads-studio）。
 *
 * 把 beads-studio 服务（`GET /api/results/:id/level`）的 **levelDraft** 转成本仓
 * `BeadsLevelRaw`，并过 `validateBeadsLevel`（判据源 = `levels-spec §2/§7` +
 * `systems-index §3`，与 BOOT 校验同一套 —— 本模块不放宽任何约束，也不信草案自报值。
 *
 * 纪律：纯逻辑 + **注入式 HTTP**（L3 —— 不 import `cc` / `wx` / DOM；平台通道由
 * 宿主提供：微信 = `wx.request`、harness/Node = `fetch`）。产物仍是**关卡草案**，
 * 供调试试玩；入关（写进 `design/levels/`）走 `levels:sync`，不归本模块。
 */

import { validateBeadsLevel } from '../config/levels.js';
import { LEVEL_TIME_MAX, LEVEL_TIME_MIN, SEC_PER_TAP } from '../config/tuning.js';
import { assembleFromMisplaced, fillableCells } from './misplaced-assembler.js';
import type { BeadsLevelRaw } from '../config/levels-data.js';

/** beads-studio `levelDraft` 载荷（字段口径 = `levels-spec §2`，`time` 可为 null）。 */
export interface LevelDraft {
    readonly cols: number;
    readonly rows: number;
    readonly time: number | null;
    readonly decoys?: readonly string[];
    readonly swaps?: readonly (readonly [number, number, number, number])[];
    readonly pattern: readonly string[];
    /**
     * 全错位初盘（可选，`--mis full` 产物）：rowstring，字符集同 pattern。
     * 引擎侧 `applyMisplacedToGrid` 见 misplaced 优先、忽略 swaps ⇒ 带上就成片错豆（100% 可填格）。
     */
    readonly misplaced?: readonly string[];
    readonly paletteHex?: readonly string[];
}

/** 列表项（服务端 result.json 的精简投影；只取导入需要的字段）。 */
export interface StudioResult {
    readonly id: string;
    readonly board?: string;
    readonly createdAt?: string;
    /** 服务端可入关判据（旧服务端可能不下发 ⇒ 按未知处理，不拦）。 */
    readonly importable?: boolean;
}

export interface ImportOutcome {
    readonly ok: boolean;
    readonly level?: BeadsLevelRaw;
    readonly errors: readonly string[];
}

/** 注入式 HTTP：解析并返回 JSON；失败 reject。 */
export type HttpGet = (url: string) => Promise<unknown>;

/** 盘面三维度统计（§3.5 报告口径；v0.2 起时长只用 `misplaced`，N/C/A 留给报告与 playtest 归因）。 */
export interface BoardStats {
    /** N = 可填豆数（void `.` 不计）。 */
    readonly fillable: number;
    /** C = 用色数。 */
    readonly colors: number;
    /** A = 同色相邻率（4 向同色边 ÷ 双可填相邻边；低 = 碎花难，高 = 成片易）。 */
    readonly adjRate: number;
    /** M = 错位珠数（misplaced 初盘实算；swaps 路径恒 2-环 ⇒ 2k）。 */
    readonly misplaced: number;
}

/** pattern 三维度统计。`misplacedCount` 由调用方算好传入（misplaced 初盘实算 / swaps 恒 2k）。 */
export function boardStats(pattern: readonly string[], misplacedCount: number): BoardStats {
    const cells = fillableCells(pattern);
    const cols = pattern[0]?.length ?? 0;
    const at = new Map<number, number>();
    for (const c of cells) at.set(c.row * cols + c.col, c.colorIdx);
    let same = 0, edges = 0;
    for (const c of cells) {
        const nb = [
            c.row > 0 ? at.get((c.row - 1) * cols + c.col) : undefined,
            c.col + 1 < cols ? at.get(c.row * cols + c.col + 1) : undefined,
            c.row + 1 < pattern.length ? at.get((c.row + 1) * cols + c.col) : undefined,
            c.col > 0 ? at.get(c.row * cols + c.col - 1) : undefined,
        ];
        for (const v of nb) if (v !== undefined) { edges++; if (v === c.colorIdx) same++; }
    }
    return {
        fillable: cells.length,
        colors: new Set(cells.map((c) => c.colorIdx)).size,
        adjRate: edges ? same / edges : 0,
        misplaced: misplacedCount,
    };
}

/**
 * 实测点击数 → 时长/难度（§3.5 v1.41，公式 **v0.2** · 正本 `levels-spec §5.0`）。
 *
 *   T = clamp( taps × SEC_PER_TAP, [LEVEL_TIME_MIN, LEVEL_TIME_MAX] )
 *   D = round(100 × T / LEVEL_TIME_MAX)
 *
 * `taps` = 真引擎实测的成功点击数（`tools/scripts/beads-bot.ts`，装配走生产 BOOT、
 * 每步走 `BeadsGame` 公开命令，不复刻任何判定逻辑）。**这是时长的唯一正源**——
 * v0.1 按颗定价在 32 盘语料上 32/32 触顶 420s（详见 `SEC_PER_TAP` 注释与
 * `design/forensics/diff-v02/grid.log.txt`），已作废。
 */
export function measuredLevelTime(taps: number): { time: number; difficulty: number } {
    const n = Number.isFinite(taps) && taps > 0 ? Math.round(taps) : 0;
    const raw = n * SEC_PER_TAP;
    const time = Math.min(LEVEL_TIME_MAX, Math.max(LEVEL_TIME_MIN, Math.round(raw)));
    return { time, difficulty: Math.round((100 * time) / LEVEL_TIME_MAX) };
}

/**
 * 静态兜底（**无引擎路径专用**）：游戏内「一键导入」拿到的是服务端 levelDraft，
 * 客户端侧跑不了 bot ⇒ 只能按 M 粗估点击数。v0.2 形态 = `taps ≈ ceil(M / 2)`。
 *
 * 诚实口径：过闸样本仅 3 盘（`B_med ≥ 8 ∧ M ≤ 280`），实测 taps/M = 0.25–0.63 ⇒
 * 本式误差约 ±50%，**刻意偏高**（高估 = 白给星级，低估 = 玩家倒计时内不可能通关，
 * 两害取其轻）。有引擎的路径（beads-gen 生成期 / server ingest 入关期）一律走实测，
 * 不得调用本函数。校准机制见 levels-spec §5.0.1。
 */
export function estimateLevelTime(stats: BoardStats): { time: number; difficulty: number } {
    return measuredLevelTime(Math.ceil(stats.misplaced / 2));
}

/** 拼接服务地址与路径（去重尾斜杠；不做任何 URL 编码外的魔法）。 */
export function studioUrl(base: string, path: string): string {
    return `${base.replace(/\/+$/, '')}${path}`;
}

/**
 * levelDraft → `BeadsLevelRaw`。校验不过就 **返回错误串**，不产出关卡
 * （调用方不得忽略 errors —— 草案的 `time` 常为 null，此处按静态兜底补齐）。
 */
export function draftToLevel(draft: LevelDraft, id: number, name: string): ImportOutcome {
    const swaps = draft.swaps ?? [];
    const level: BeadsLevelRaw = {
        id,
        name,
        cols: draft.cols,
        rows: draft.rows,
        time: typeof draft.time === 'number'
            ? draft.time
            : estimateLevelTime(boardStats(
                draft.pattern,
                draft.misplaced
                    ? assembleFromMisplaced(draft.pattern, draft.misplaced).misplacedCount
                    : swaps.length * 2, // 交换法恒 2-环（见下注），misplaced = 2k
            )).time,
        // 不采用草案自报的 cycleProfile：交换法构造的两两互换 **恒为 2-环** ⇒ 只能是 `short`。
        //（真缺陷：旧 beads-gen 草案写 'long'，BOOT 以「cycleProfile=long 与实际最长环 2 矛盾」拒收；
        //  转换层也不信声明值，两面夹住这个漂移。）
        cycleProfile: 'short',
        decoys: draft.decoys ?? [],
        pattern: draft.pattern,
        swaps,
        ...(draft.misplaced ? { misplaced: draft.misplaced } : {}),
    };
    // k 区间 / 交换对合法性 / 色数 / charset 全由 validateBeadsLevel 统一裁决（不在此重复）。
    const errors = validateBeadsLevel(level);
    return errors.length ? { ok: false, errors } : { ok: true, level, errors };
}

/** 拉取结果列表（按服务端序 = createdAt 倒序 ⇒ 首项即最新）。 */
export async function fetchResults(base: string, get: HttpGet): Promise<readonly StudioResult[]> {
    const data = (await get(studioUrl(base, '/api/results'))) as { results?: readonly StudioResult[] };
    return data?.results ?? [];
}

/**
 * 一键导入用：取**最新一条可入关**的结果并转成可装配的 `BeadsLevelRaw`。
 * 为何不盲取 `results[0]`：列表里常夹着参考图 / 实验残品（Artkal 色板等），
 * 拿它们去 `/level` 只会吃一个 422，用户看到的是“导入失败”而非“你该删/选对条目”。
 * 空列表 / 不合规 / 校验失败均以 errors 返回（不抛，交给 UI 显示）。
 */
export async function importLatest(base: string, get: HttpGet): Promise<ImportOutcome> {
    const list = await fetchResults(base, get);
    const head = list.find((r) => r.importable !== false);
    if (!head) {
        return list.length
            ? { ok: false, errors: [`服务上 ${list.length} 条结果均不可入关（请在 beads-studio 删除或换一条）`] }
            : { ok: false, errors: ['服务无已存结果（请先在 beads-studio 生成一关）'] };
    }
    const draft = (await get(studioUrl(base, `/api/results/${head.id}/level`))) as LevelDraft & { error?: string };
    // 服务端对「不可入关」产物直返 422 + 原因（如非 10 色色板 ⇒ 游戏内静默换色）；
    // 这里原样透传，不降级成看不出所以然的「无 levelDraft」。
    if (draft && typeof draft.error === 'string') {
        return { ok: false, errors: [draft.error] };
    }
    if (!draft || !Array.isArray(draft.pattern)) {
        return { ok: false, errors: [`结果 ${head.id} 无 levelDraft（交换错位 k 需 ≥ 1）`] };
    }
    return draftToLevel(draft, 9000, `在线导入 ${head.id}`);
}
