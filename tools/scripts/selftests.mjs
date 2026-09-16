#!/usr/bin/env node
/**
 * selftests.mjs —— 装置自测的分档执行器（WXG-T-121 / 缺陷 BD-39 · BD-40）。
 *
 * 为什么要这么一层：仓库里的装置自测（`*-selftest.sh` 与 `--selftest` 模式）**一件都不在**
 * `verify` 的步骤表里，CI 里也是零命中 ⇒ 「守卫自己的测试」腐烂无人见。判例：
 *   · BD-39 —— `kb:selftest` 首跑即 4 FAIL（WXG-T-111 记录）
 *   · 本轮实测 —— `ctx:usage:selftest` 在 `3fa3be4` 与 `e9664da` 都是 **FAIL=63**（同一根因：
 *     桩只拷 `lib/` 里两件，而 `check-context-budget.mjs` 后来 import 了 `lib/memory-index.mjs`）
 *
 * 分档判据 = 实测耗时（2026-09-16，本机逐项计时；当前 verify 各项相加 13.8s）：
 *   fast  六件自测 + `ctx:check` ≈6.7s ⇒ 挂进 `verify` 与 CI，代价可接受（verify 13.8s → ≈20s）
 *   heavy >2s 五件 ≈25s           ⇒ 只挂 CI（全挂进 verify 会让本地全量验证慢三倍，反而诱发绕开）
 *
 * 为什么 fast 档里混了一条**非自测**的 `ctx:check`（BD-40）：它与 BD-39 同属「有门、但本地 verify
 * 不跑」这一族，实测只 0.51s。把它并入 fast 档 ⇒ 将来 `verify` 只需往 `STEPS` 加 `selftest:fast`
 * **一项**，两条缺陷的本地半边一起闭合，不必再为 BD-40 单开一次改动。
 *
 * 三条硬规矩（都是判例换来的）：
 *   1. **逐项执行、永不短路**（K-036：短路后的 ✅ 不构成证据），末尾按汇总定退出码。
 *   2. 打 `STATUS: OK|SKIP|FAIL` 机读行 —— 这样 `verify-all.mjs` 只需往 `STEPS` 加一项
 *      `selftest:fast` 即可接入，不必知道档位里有哪些件。
 *   3. **完整性守卫**：新出现的 `*-selftest.sh` / package.json 里 `*:selftest` 入口若未入档，
 *      当场报红（防「第 12 件装置自测又漏挂」）；确实挂不上的须写进 `AWAITING` 并给理由，
 *      由它降为 SKIP（**SKIP 不是通过，是没测** —— BD-18 口径），`--strict` 下判失败。
 *
 * 用法：node tools/scripts/selftests.mjs [--tier=fast|heavy|all] [--strict] [--list]
 *       pnpm run selftest:fast ｜ pnpm run selftest:heavy
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const S = 'tools/scripts';

/** 档位表：pnpm 入口名 → 直接执行的 argv（走 node/bash 而非 `pnpm run`，省 11 次 pnpm 启动）。 */
export const TIERS = {
    fast: [
        // 直接 `node` 执行而非 `pnpm run`：CI 的 ctx job 已记「node_modules 缺失时 pnpm 以
        // 『did you mean to install?』拒绝执行并 exit 1」⇒ 档位项一律绕开包管理器。
        { script: 'ctx:check', argv: ['node', `${S}/check-context-budget.mjs`] },
        { script: 'check:size:selftest', argv: ['node', `${S}/check-bundle-size.mjs`, '--selftest'] },
        { script: 'memory:split:selftest', argv: ['bash', `${S}/split-memory-detail-selftest.sh`] },
        { script: 'memory:distill:selftest', argv: ['bash', `${S}/distill-memory-selftest.sh`] },
        { script: 'knowledge:split:selftest', argv: ['bash', `${S}/split-knowledge-lessons-selftest.sh`] },
        { script: 'tasks:archive:selftest', argv: ['bash', `${S}/archive-tasks-selftest.sh`] },
        { script: 'verify:selftest', argv: ['bash', `${S}/verify-all-selftest.sh`] },
    ],
    heavy: [
        { script: 'ci:review:selftest', argv: ['bash', `${S}/ci-pr-review-selftest.sh`] },
        { script: 'check:es5spread:selftest', argv: ['bash', `${S}/check-es5-spread-selftest.sh`] },
        { script: 'ctx:usage:selftest', argv: ['bash', `${S}/context-usage-selftest.sh`] },
        { script: 'ctx:selftest', argv: ['bash', `${S}/worktree-authoritative-selftest.sh`] },
        { script: 'kb:selftest', argv: ['bash', `${S}/knowledge-selftest.sh`] },
    ],
};

/**
 * 已知但**本轮不能入档**的装置自测：理由必须写在这里，否则就是第二个「腐烂无人见」。
 * 值为理由串；条目由守卫识别为 SKIP（不判绿）。
 */
const AWAITING = {
    'check:host-tests:selftest':
        '被测脚本 tools/scripts/check-host-behavior-tests.mjs 尚未入库（HEAD 的 package.json 入口指向未跟踪文件）' +
        ' ⇒ 挂上即 CI 恒红；待 WXG-T-110 收口后并入 fast 档',
};

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const tierArg = (args.find((a) => a.startsWith('--tier=')) ?? '').slice(7);
if (!['fast', 'heavy', 'all', ''].includes(tierArg)) {
    console.error(`❌ --tier 只能是 fast|heavy|all，收到「${tierArg}」`);
    process.exit(2);
}
const STRICT = flag('strict');
const tier = tierArg || 'all';

if (flag('list')) {
    for (const t of ['fast', 'heavy']) {
        console.log(`${t}:`);
        for (const i of TIERS[t]) console.log(`  ${i.script}`);
    }
    console.log('awaiting（未入档，理由见源码 AWAITING）:');
    for (const k of Object.keys(AWAITING)) console.log(`  ${k}`);
    process.exit(0);
}

/* ── 完整性守卫：磁盘上/入口表里的装置自测，必须要么入档、要么在 AWAITING ───── */
function guardCoverage() {
    const declared = new Set([...TIERS.fast, ...TIERS.heavy].map((i) => i.script));
    const problems = [];
    const shOnDisk = readdirSync(join(ROOT, S)).filter((f) => f.endsWith('-selftest.sh')).sort();
    const byTarget = new Map(
        [...TIERS.fast, ...TIERS.heavy].filter((i) => i.argv[0] === 'bash').map((i) => [i.argv[1].split('/').pop(), i.script]),
    );
    for (const f of shOnDisk) {
        if (!byTarget.has(f)) problems.push(`${S}/${f} 未入任何档位（既不在 TIERS，也没有 bash 目标）`);
    }
    const scripts = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts;
    for (const key of Object.keys(scripts)) {
        if (!key.endsWith(':selftest')) continue;
        if (declared.has(key) || key in AWAITING) continue;
        problems.push(`package.json 入口 ${key} 未入档 ⇒ 请加进 TIERS 或写明 AWAITING 理由`);
    }
    const orphanDeclared = [...declared].filter((k) => !(k in scripts));
    for (const k of orphanDeclared) problems.push(`档位项 ${k} 在 package.json 里不存在（改名脱钩）`);
    return problems;
}

/**
 * 本地覆盖缺口提示（不判红）：`verify` 的步骤表里还没有 `selftest:fast` 时，BD-39 的
 * 「本地半边」就未闭合 —— 挂不上多半是因为该文件正被别的单在飞改动，故**每次运行都点名**，
 * 免得又变成一件「只有 CI 跑、本地腐烂无人见」的事。
 */
function noteVerifyCoverage() {
    const stepsSrc = readFileSync(join(ROOT, S, 'verify-all.mjs'), 'utf8');
    if (!/selftest:fast/.test(stepsSrc)) {
        console.log('  ⚠️ verify 步骤表尚未含 selftest:fast ⇒ BD-39 / BD-40 的本地半边未闭合（CI 侧已覆盖）');
    }
}

function run(items, label) {
    const rows = [];
    for (const item of items) {
        const target = item.argv[1];
        if (!existsSync(join(ROOT, target))) {
            rows.push({ name: item.script, status: 'FAIL', secs: 0, note: `被测脚本 ${target} 不存在` });
            console.log(`  ❌ ${item.script} —— 被测脚本 ${target} 不存在（入口指向未入库文件）`);
            continue;
        }
        const t0 = Date.now();
        const proc = spawnSync(item.argv[0], item.argv.slice(1), { cwd: ROOT, encoding: 'utf8' });
        const secs = (Date.now() - t0) / 1000;
        const out = `${proc.stdout ?? ''}${proc.stderr ?? ''}`;
        const m = out.match(/(?:结果[:：]\s*)?PASS=(\d+)\s+FAIL=(\d+)/);
        const rc = proc.status ?? -1;
        const status = rc === 0 ? 'PASS' : 'FAIL';
        const note = m ? `断言 ${m[1]}/${Number(m[1]) + Number(m[2])}` : `exit ${rc}`;
        rows.push({ name: item.script, status, secs, note });
        console.log(`  ${status === 'PASS' ? '✅' : '❌'} ${item.script.padEnd(28)} ${secs.toFixed(1)}s  ${note}`);
    }
    return { label, rows };
}

console.log(`selftests —— 档位=${tier}${STRICT ? ' strict' : ''}（逐项执行，不短路）`);

const groups = [];
for (const t of ['fast', 'heavy']) {
    if (tier === 'all' || tier === t) groups.push(run(TIERS[t], t));
}
const skipped = Object.keys(AWAITING).length;

let fail = 0;
let pass = 0;
for (const g of groups) {
    for (const r of g.rows) (r.status === 'PASS' ? (pass += 1) : (fail += 1));
}
const total = pass + fail;
console.log('────────────────────────────────────────────────────────────');
console.log(`装置自测汇总：PASS ${pass} ｜ FAIL ${fail} ｜ 共 ${total} 件` +
    ` ｜ 档位未覆盖（SKIP，不是通过）${skipped} 件：${Object.keys(AWAITING).join('、') || '—'}`);

noteVerifyCoverage();
const problems = guardCoverage();
for (const p of problems) console.log(`  ❌ 完整性守卫：${p}`);
if (problems.length > 0) fail += 1;

if (fail > 0) {
    console.log('STATUS: FAIL');
    process.exit(1);
}
if (STRICT && skipped > 0) {
    console.log(`STATUS: FAIL —— --strict 下「档位未覆盖」判失败（${Object.keys(AWAITING).join('、')}）`);
    process.exit(1);
}
console.log('STATUS: OK');
process.exit(0);
