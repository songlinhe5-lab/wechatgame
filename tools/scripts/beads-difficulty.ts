/**
 * 给定珠面 → 难度等级 + 1/2/3★ 时间门槛（开发期评估工具，不入运行时、不进包体）。
 *
 * 用法（与 beads-bot 同一 runner）：
 *   node --experimental-transform-types \
 *     --import=./games/beads/design/forensics/g3/g3-hooks.mjs \
 *     tools/scripts/beads-difficulty.ts <pattern.json | levels.json | 关卡.json> [--id N]
 *
 * stdout 前若干行 = 人读表，末行 = JSON（单关对象 / 多关数组，`| tail -1` 可取）。
 *
 * 单一真源（⛔ 本文件不复制公式、不新增数值常量）：
 *   steps      ← 关卡 pricing.steps（已入关，秒出）或 beads-bot CLI 实测（未入关）
 *   1★ 时钟    ← 关卡 time；缺失时 measuredLevelTime(steps)
 *   三档秒数   ← tierSecondsFor / 步数预算 ← tierStepBudget
 *   等级边界   ← G11 常量 NORMAL_STEPS_MIN/MAX、BOSS_STEPS_MIN（无新阈值）
 *
 * ⚠ 三星秒数是「模型值」：SEC_PER_STEP 未经新 playtest 重标定，steps 是固定贪心策略
 *   的路径长。真机体验验证前不得当作人类用时判据（levels-spec §5.0.1）。
 */

import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    NORMAL_STEPS_MIN, NORMAL_STEPS_MAX, BOSS_STEPS_MIN,
    TRAY_TIER_SLOTS, SEC_PER_STEP, tierSecondsFor,
} from '../../games/beads/src/config/tuning.js';
import { measuredLevelTime, tierStepBudget } from '../../games/beads/src/game/level-import.js';
import { difficultyOf } from '../../games/beads/src/game/difficulty.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HOOKS = fileURLToPath(new URL('../../games/beads/design/forensics/g3/g3-hooks.mjs', import.meta.url));
const BOT = fileURLToPath(new URL('./beads-bot.ts', import.meta.url));

/** 一个珠面的最小输入形状（不为此发明 interface，够用即可）。 */
interface Board {
    name?: string;
    cols?: number;
    rows?: number;
    pattern?: string[];
    misplaced?: string[];
    swaps?: unknown[];
    time?: number;
    starTierK?: number[];
    pricing?: { steps?: number; stepsByCap?: Record<string, number> };
    [k: string]: unknown;
}

/** bot 实测（复用 beads-bot CLI 的 stdout 末行 JSON 契约，避免 import 其顶层 CLI 副作用）。 */
function runBot(file: string, id: number | null, tmp: string): Record<string, unknown>[] {
    const wrapped = join(tmp, `levels-${Date.now()}.json`);
    const doc = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    if (!Array.isArray(doc.levels) && !doc.levelDraft) {
        writeFileSync(wrapped, JSON.stringify({ levels: [doc] }));
    }
    const target = Array.isArray(doc.levels) || doc.levelDraft ? file : wrapped;
    const args = ['--experimental-transform-types', `--import=${HOOKS}`, BOT, target];
    if (id !== null && Array.isArray(doc.levels)) args.push('--id', String(id));
    const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const lines = (r.stdout ?? '').trim().split('\n').filter(Boolean);
    if (!lines.length) throw new Error(`beads-bot 无输出（exit=${r.status}）: ${(r.stderr ?? '').slice(-400)}`);
    const parsed = JSON.parse(lines.at(-1)!) as Record<string, unknown> | Record<string, unknown>[];
    return Array.isArray(parsed) ? parsed : [parsed];
}

/** 等级边界全部取自现有 G11 常量（不新发明阈值）；首关教学豁免由调用方按 order 判断。 */
function gradeOf(steps: number): string {
    if (steps < NORMAL_STEPS_MIN) return `过易(<${NORMAL_STEPS_MIN})`;
    if (steps <= NORMAL_STEPS_MAX) return `普通(${NORMAL_STEPS_MIN}–${NORMAL_STEPS_MAX})`;
    if (steps < BOSS_STEPS_MIN) return '偏难(超普通闸)';
    return `Boss(≥${BOSS_STEPS_MIN})`;
}

interface StarTier { star: number; seconds: number; stepBudget: number }

function evaluate(b: Board, measured: Record<string, unknown> | null) {
    const pricing = b.pricing ?? {};
    const fromPricing = typeof pricing.steps === 'number';
    const steps = fromPricing ? pricing.steps! : Number(measured?.steps ?? NaN);
    if (!Number.isFinite(steps)) throw new Error('拿不到 steps：既无 pricing.steps，bot 也未实测');

    const derived = measuredLevelTime(steps);
    const time = typeof b.time === 'number' ? b.time : derived.time;
    const k = b.starTierK;

    const starTiers: StarTier[] = [1, 2, 3].map((star) => ({
        star,
        seconds: tierSecondsFor(time, star, k),
        stepBudget: tierStepBudget(time, star, k),
    }));
    if (!(starTiers[0]!.seconds >= starTiers[1]!.seconds && starTiers[1]!.seconds >= starTiers[2]!.seconds))
        throw new Error('三档时钟非单调（starTierK 非法）');

    const stepsByCap = pricing.stepsByCap ?? (measured?.pricing as { stepsByCap?: Record<string, number> } | undefined)?.stepsByCap ?? {};
    const budget3 = starTiers[2]!.stepBudget;
    const threeStarCap = TRAY_TIER_SLOTS.find((cap) => (stepsByCap[String(cap)] ?? Infinity) <= budget3) ?? null;

    let di: number | null = null;
    try {
        if (Array.isArray(b.pattern)) di = difficultyOf({ pattern: b.pattern, misplaced: b.misplaced, swaps: b.swaps as never }).di;
    } catch { /* 草案盘可能不满足 difficultyOf 前置条件 ⇒ DI 仅作可选参考，不拦评估 */ }

    const dims = b.cols && b.rows ? `${b.cols}x${b.rows}` : String(measured?.dims ?? '?');
    return {
        name: b.name ?? String(measured?.name ?? '?'),
        dims,
        /** 难度主量 = 实测批量动作数（点击次数）。 */
        steps,
        stepsSource: fromPricing ? 'pricing(已入关真值)' : 'beads-bot(ACB/12槽实测)',
        /** 等级 = 现有 G11 边界的映射，非新增分级体系。 */
        grade: gradeOf(steps),
        /** 结构排序分，仅作陈列参考，不估工。 */
        di,
        /** 1★ 时钟（秒）= 关卡真源或 measuredLevelTime 派生。 */
        time,
        timeSource: typeof b.time === 'number' ? '关卡 time 字段' : 'measuredLevelTime(steps)',
        clamped: typeof b.time === 'number' ? undefined : derived.clamped,
        secPerStep: SEC_PER_STEP,
        starTiers,
        stepsByCap,
        threeStarCap,
        blockers: (measured?.blockers as string[] | undefined) ?? [],
        warnings: (measured?.warnings as string[] | undefined) ?? [],
        note: 'steps 为固定贪心策略路径长（非最优）；三星秒数为模型值，[待真机 playtest 校准]',
    };
}

// ─────────────────────────────────────────────────────────────────── CLI
const argv = process.argv.slice(2);

/** 自检：公式/常量漂移时立刻失败（真值 = L00007 落盘读数，2026-11-17 复核）。 */
function selfCheck(): void {
    const r = evaluate({ name: 'self-check', cols: 14, rows: 8, time: 166, pricing: { steps: 34, stepsByCap: { '12': 34, '24': 25, '48': 25 } } }, null);
    assert.equal(r.steps, 34);
    assert.equal(r.grade, `普通(${NORMAL_STEPS_MIN}–${NORMAL_STEPS_MAX})`);
    assert.deepEqual(r.starTiers.map((s) => s.seconds), [166, 141, 116]);
    assert.deepEqual(r.starTiers.map((s) => s.stepBudget), [40, 34, 28]);
    assert.equal(r.threeStarCap, 24);
    // 单关 starTierK 覆盖必须生效（L00009 = [1, 0.85, 0.4176] ⇒ 3★ 228s）
    const boss = evaluate({ name: 'self-check-boss', time: 546, starTierK: [1, 0.85, 0.4176], pricing: { steps: 112 } }, null);
    assert.equal(boss.starTiers[2]!.seconds, 228);
    assert.equal(boss.grade, `Boss(≥${BOSS_STEPS_MIN})`);
    console.log('self-check OK：三星公式 / 单关系数覆盖 / G11 等级边界均一致');
}
if (argv.includes('--self-check')) { selfCheck(); process.exit(0); }

const file = argv.find((a) => !a.startsWith('--'));
const idArg = argv.indexOf('--id');
const wantId = idArg >= 0 ? Number(argv[idArg + 1]) : null;
if (!file) {
    console.error('用法：beads-difficulty.ts <pattern.json | levels.json | 关卡.json> [--id N] [--self-check]');
    process.exit(2);
}

const doc = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
const boards: Board[] = Array.isArray(doc.levels)
    ? (doc.levels as Board[]).filter((b) => wantId === null || (b as { id?: number }).id === wantId)
    : (doc.levelDraft ? [] : [doc as Board]);

// 未入关的珠面（含 bead-gen 的 levelDraft 产物）才需要跑 bot；已入关关卡读 pricing 秒出。
const tmp = mkdtempSync(join(tmpdir(), 'beads-difficulty-'));
const needsBot = boards.some((b) => typeof b.pricing?.steps !== 'number') || boards.length === 0;
const measured = needsBot ? runBot(file, wantId, tmp) : [];

// levelDraft 产物：把草案盘面带进 evaluate，否则 DI（结构排序分）算不出来。
const draft = doc.levelDraft as { cols?: number; rows?: number; pattern?: string[]; misplaced?: string[] } | undefined;
const rows = boards.length
    ? boards.map((b, i) => evaluate(b, typeof b.pricing?.steps === 'number' ? null : (measured[i] ?? measured[0] ?? null)))
    : measured.map((m) => evaluate({
        name: String(m.name ?? '?'),
        cols: draft?.cols, rows: draft?.rows,
        pattern: draft?.pattern, misplaced: draft?.misplaced,
    }, m));

for (const r of rows) {
    const t = r.starTiers.map((s) => `${s.star}★ ${s.seconds}s/${s.stepBudget}步`).join('  ');
    console.log(
        `${r.name} ${r.dims}｜steps=${r.steps} [${r.stepsSource}]｜等级=${r.grade}｜DI=${r.di ?? '—'}` +
        `｜${t}｜3★需容量=${r.threeStarCap ?? '不可达'}槽` +
        (r.blockers.length ? `｜⛔ ${r.blockers.join('；')}` : ''),
    );
}
console.log(JSON.stringify(rows.length === 1 ? rows[0] : rows));
