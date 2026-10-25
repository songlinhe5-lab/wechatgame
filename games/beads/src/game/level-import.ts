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
import { LEVEL_TIME_MAX, LEVEL_TIME_MIN, SEC_PER_STEP, STAR_TIER_K, tierSecondsFor } from '../config/tuning.js';
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
    /**
     * **整套皮肤引用**（EP12-S9 · 裁定②，可选）：值 = 游戏侧已注册皮肤 id 白名单
     * （`config/skins/registry`，现 `warm-paper` / `cool-violet`）——**只传引用 id，
     * 不传皮肤数据本体**（T-267 `BeadsSkin` 数据结构接轨）。缺省 / 旧草案无此字段
     * ⇒ 零影响；未注册 id ⇒ 游戏侧 `importLevel` **不拒收关卡本体**，回落默认肤 +
     * 一次性告警（K-064「谎报值不采信」，本地注册表为唯一复验真源）。
     */
    readonly skin?: string;
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
 * 批量动作数 → 1★ 时钟/难度（§3.5 **v1.84**，公式 **v0.5** · 正本 `levels-spec §5.0`）。
 *
 *   need = ceil( steps × SEC_PER_STEP )                        // 2★ 档至少要给的秒数
 *   T₁   = clamp( ceil( need ÷ STAR_TIER_K[1] ), [LEVEL_TIME_MIN, LEVEL_TIME_MAX] )
 *   D    = round(100 × T₁ / LEVEL_TIME_MAX)
 *
 * `steps` = **基础档容量（12 槽）下**的批量动作数（`直填 + 取回 + 落子`，选锚并入被它服务的
 * 动作），由 `tools/scripts/beads-bot.ts` 走生产 BOOT + `BeadsGame` 公开命令实测。
 *
 * **v0.5 为什么除以 0.85（用户 2026-10-25 口径）**：`time` 是 **1★ 档**时钟，而玩家的真实
 * 体验基准是「基础 12 槽能不能卡点拿 2★」。把基础档步数装进 **2★ 档**（`STAR_TIER_K[1]=0.85`）
 * ⇒ 2★ 秒数恰 ≈ `steps × SEC_PER_STEP`（**紧平衡**：不多不少刚好打完），3★ 档自动 ≈ 0.82×
 * 该值 ⇒ **必须靠扩容（24/48 槽）压步数才拿得到**。这正是「12 槽 2★ 紧平衡 / 3★ 要开广告」
 * 的机械化表达，⛔ 不要改回 1★ 基准（那会让 2★ 也必须扩容，与设计口径相反）。
 * 两级 `ceil` 而非 `round`：2★ 秒数必须**恒 ≥** 定价步数×单价，否则四舍五入会把边沿关判成
 * 「2★ 拿不到」（可用性由 `tierStepBudget()` 复核；`clamped` 位让消费方知道等式已失效）。
 *
 * ⚠ **本函数只给「新关先验」**：已人工试玩过的关一律用实测 `t_act` 定 T₁（`pricing.source='playtest'`）。
 * 历史：v0.1 按颗（`M × 22.5s`）在 32 盘语料上 32/32 触顶 420s ⇒ 作废；v0.4 = 1★ 基准。
 */
export function measuredLevelTime(steps: number): { time: number; difficulty: number; clamped: boolean } {
    const n = Number.isFinite(steps) && steps > 0 ? Math.round(steps) : 0;
    // 两级 ceil，缺一不可：先取「2★ 档至少要给的秒数」`need`（步数 × 单价向上取整），
    // 再把它反解回 1★ 时钟。只做一次 ceil（`ceil(S×c÷K)`）会因
    // `tierSecondsFor` 内部再 round 一次而少给 1 秒 ⇒ `tierStepBudget` 少算 1 步
    // （实测 S=109 时 217 → 预算 108 < 109，关卡被判「2★ 拿不到」）。
    const need = Math.ceil(n * SEC_PER_STEP);
    const raw = need / STAR_TIER_K[1]!;
    const time = Math.min(LEVEL_TIME_MAX, Math.max(LEVEL_TIME_MIN, Math.ceil(raw)));
    return {
        time,
        difficulty: Math.round((100 * time) / LEVEL_TIME_MAX),
        /** 钳位过（上下沿生效）⇒ 档秒数不再与步数成正比，消费方应跳过等式复核。 */
        clamped: Math.ceil(raw) !== time,
    };
}

/**
 * 第 `tier` 档时钟**能容纳多少批量动作**（= `floor(档秒数 ÷ SEC_PER_STEP)`）。
 *
 * 用途 = 关卡设计/入关判据把「这档到底够不够」变成一句可算的话（§5.0 公式 v0.5 的配套）：
 * - `tierStepBudget(T₁, 2) ≥ steps@12` ⇒ 基础档 2★ 可达（紧平衡的定义）；
 * - `tierStepBudget(T₁, 3) ≥ min(steps@24, steps@48)` ⇒ 至少某一扩容档 3★ 可达。
 * 两条都成立才算一关「定价自洽」，消费方 = `beads-bot.ts` 的 blockers（生成期硬拦）。
 */
export function tierStepBudget(levelTime: number, tier: number, starTierK?: readonly number[]): number {
    return Math.floor(tierSecondsFor(levelTime, tier, starTierK) / SEC_PER_STEP);
}

/**
 * 静态兜底（**无引擎路径专用**）：游戏内「一键导入」拿到的是服务端 levelDraft，
 * 客户端侧跑不了 bot ⇒ 只能按 M 粗估批量动作数。
 *
 * 形态 = `steps ≈ round(M × 0.8)`：取自 v1.50 八关实测 `M ÷ BAC步数` 中位数 1.25 的倒数。
 * 诚实口径：八关上 `M ÷ 步数` 实际跨 **0.74–3.3（4.5 倍）**（大色块盘一步扒 4 颗、碎花盘 1 颗）
 * ⇒ 本式误差可到 ±2 倍，**只能在“没引擎”时用，且刻意不假装准确**。
 * 有引擎的路径（beads-gen 生成期 / server ingest 入关期）一律走实测，不得调本函数。
 */
export function estimateLevelTime(stats: BoardStats): { time: number; difficulty: number } {
    return measuredLevelTime(Math.round(stats.misplaced * 0.8));
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
        // 身份 token 恒由**生成期**从 `manifest.entries[].uid` 派生注入（ADR-0034 DEC-1/DEC-2），
        // ⛔ 不得由本转换层手写（那是第二真源，`§8-22-①`）。草案未过 `levels:sync` ⇒ 无身份，
        // 取空串 = 「本槽不入星账」哨兵（`levelIdentityKeys` 与双向换算均按此跳过）。
        // 入关（写 `design/levels/` + 重跑 `levels:sync`）后身份才由脚本赋予。
        uid: '',
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
        // EP12-S9：皮肤引用原样透传（`levels-spec §2` 既有字段零触碰；是否已注册由
        // 游戏侧 `importLevel` 以本地注册表复验，本转换层不裁决、不静默改写）。
        ...(draft.skin !== undefined ? { skin: draft.skin } : {}),
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
