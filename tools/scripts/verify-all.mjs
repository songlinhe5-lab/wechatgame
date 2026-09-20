#!/usr/bin/env node
/**
 * verify-all.mjs — 全量门禁聚合器（WXG-T-095 / 缺陷 **BD-17**）。
 *
 * ── 为什么存在（BD-17 的根因）────────────────────────────────────────────
 * 此前 `verify` = `pnpm run a && pnpm run b && …` 共 14 项。`&&` 的语义是**失败即短路**：
 * WXG-T-084 那一轮第 8 项 `framework:sync:check` 失败 ⇒ 第 9–13 项**从未执行**，
 * 而日志里只留下第 8 项的错误，读起来像「跑过全量、只挂一项」。
 * 教训正本：`knowledge/lessons.md` **K-036**（串联门禁若「失败即短路」且「缺对象仍报绿」，
 * 它的 ✅ 不构成任何证据）。
 *
 * ── 本脚本的三条硬承诺 ───────────────────────────────────────────────────
 *   ① **逐项执行、永不短路**：任一项失败，后续项照跑 —— 一轮就能看到全部挂点。
 *   ② **逐项收集 + 汇总退出码**：结尾必打「状态表 + 未通过清单」，并据此决定退出码。
 *   ③ **SKIP 不算 PASS**：子命令可打印机器可读标记 `STATUS: SKIP`（见下），
 *      聚合器把它记为 SKIP 而不是 PASS；`--strict` 下 SKIP 直接判失败（CI 想收紧时用）。
 *
 * ── STATUS 契约（与子命令之间的唯一新增约定）──────────────────────────────
 *   子命令在 **stdout** 打一行：`STATUS: OK | WARN | SKIP | FAIL`（取最后一次出现为准）。
 *   没打标记的项按退出码判：0 = PASS，非 0 = FAIL。
 *   · SKIP = **没测**（BD-18）：`check:size` 在产物缺失的游戏未被覆盖时报 SKIP；`--strict` 下判失败。
 *   · WARN = **观察项**（WXG-T-110）：子命令明确表达了「发现可疑但按用户裁定**本轮不阻断**」，
 *     例如 `check:host-tests`（§17 宿主行为测试守卫）在 warn 观察期。WARN **不计 PASS**（不伪装），
 *     但也**不影响退出码**（`--strict` 亦然）—— 升级为阻断靠该子命令自身改判 FAIL，不由聚合器代劳。
 *
 * ── 用法 ─────────────────────────────────────────────────────────────────
 *   pnpm run verify                      # 全量步骤（步骤表见 --list；推荐，等价旧 verify 但更诚实）
 *   node tools/scripts/verify-all.mjs --list                 # 只看步骤表
 *   node tools/scripts/verify-all.mjs --steps=check:tasks,check:links   # 局部复跑
 *   node tools/scripts/verify-all.mjs --strict               # SKIP 也判失败（退出码 1）
 *   node tools/scripts/verify-all.mjs --validate             # 校验步骤表仍都在 package.json
 *   node tools/scripts/verify-all.mjs --selftest             # 合成步骤自测（见 K-036 规避③）
 *
 * 退出码：0 = 无 FAIL（`--strict` 下还要求无 SKIP；**WARN 从不影响退出码**）；
 *         1 = 有 FAIL（或有 SKIP 且 `--strict`）；2 = 用法错误 / 步骤表与 package.json 脱钩。
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * 步骤表 —— **顺序即历史 `&&` 链的顺序**（保持阅读惯性；新增门禁项往这里加，别再加 `&&`）。
 * 每一项必须是 `package.json` 里的 script（`--validate` 机械核对，防改名脱钩）。
 */
const STEPS = Object.freeze([
  'check:arch',
  'check:es5spread',
  'check:secrets',
  'check:tasks',
  'check:links',
  // WXG-T-155 / K-035：可访问性矩阵「声称落地 ⇒ 代码锚点命中」机检（防假绿）。
  'check:a11y',
  'check:mcp',
  'levels:check',
  'typecheck',
  'framework:sync:check',
  'cocos:check',
  'check:size',
  'test',
  'harness:build',
  'harness:smoke',
  // WXG-T-110：§17 宿主行为测试守卫。**新增门禁项一律追加在此，不加 `&&`**。
  // WXG-T-121：装置自测分档 —— fast 档（≈6.5s）入常规门禁；heavy 档（≈26s）走 CI/手动。
  // 该步在 warn 观察期自报 `STATUS: WARN`（不阻断，见汇总表），升级判据见其自身输出。
  'check:host-tests',
  // WXG-T-160：fast 档入常规门禁 ⇒ BD-39 / BD-40 的**本地半边**一并闭合（CI 侧早已覆盖）。
  // 2026-09-16 暂缓挂载的根因已定位并修复（不是 worktree 依赖缺失）：`verify:selftest` 第 5 步
  // 用 `grep 'SKIP'` 子串判「子命令是否 SKIP」，而本聚合器的汇总行恒含计数「… ｜ SKIP 0 ｜ …」
  // ⇒ 恒定误判 ⇒ 产物齐备时必红。现改为只认该步骤自己的状态行，并在隔离 worktree 实测通过。
  'selftest:fast',
]);

const STATUS_RE = /^STATUS:\s*(OK|WARN|SKIP|FAIL)\b/m;
const PASS = 'PASS';
const WARN = 'WARN';
const SKIP = 'SKIP';
const FAIL = 'FAIL';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

if (has('-h') || has('--help')) {
  printHelp();
  process.exit(0);
}
if (has('--list')) {
  for (const s of STEPS) console.log(s);
  process.exit(0);
}

/** `--steps=a,b`：局部复跑（也用于自测）。未知名不阻断，只在摘要里提示。 */
const stepsArg = argv.find((a) => a.startsWith('--steps='));
const requested = stepsArg ? stepsArg.slice('--steps='.length).split(',').map((s) => s.trim()).filter(Boolean) : null;
if (stepsArg && requested.length === 0) {
  console.error('用法错误：--steps= 后面为空（逗号分隔的 package.json script 名）');
  process.exit(2);
}
if (requested) {
  const unknown = requested.filter((s) => !STEPS.includes(s));
  if (unknown.length) console.log(`ℹ️  以下步骤不在默认全量表内（按局部复跑处理）：${unknown.join('、')}`);
}

const STRICT = has('--strict');

if (has('--validate')) process.exit(validateStepTable());
if (has('--selftest')) process.exit(runSelftest());

const results = runSteps((requested ?? STEPS).map((name) => ({ name, argv: ['pnpm', 'run', name] })));
process.exit(summarize(results, { strict: STRICT }));

// ─────────────────────────────────────────────────────────────── 执行 ───────

/**
 * 逐项执行。**永不短路**：子进程失败只记录，不中断循环。
 * stdout 先捕获（为了扫 `STATUS:` 标记）再原样回放到终端 —— 不吞任何一项的日志。
 */
function runSteps(steps) {
  const out = [];
  for (const [i, step] of steps.entries()) {
    const label = `[${i + 1}/${steps.length}] ${step.name}`;
    process.stdout.write(`\n\u001b[1m${label}\u001b[0m\n`);
    const t0 = Date.now();
    const proc = spawnSync(step.argv[0], step.argv.slice(1), {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
      shell: process.platform === 'win32',
    });
    const secs = (Date.now() - t0) / 1000;
    if (proc.stdout) process.stdout.write(proc.stdout);
    if (proc.stdout && !proc.stdout.endsWith('\n')) process.stdout.write('\n');

    if (proc.error) {
      // 起不来（ENOENT 等）同样是「一项挂了」，而不是「后面的不用跑了」。
      console.log(`  ⚠️ 无法启动：${proc.error.message}`);
      out.push({ name: step.name, status: FAIL, secs, note: `spawn failed: ${proc.error.message}` });
      continue;
    }
    const marker = lastStatus(proc.stdout);
    const code = proc.status ?? 1;
    let status;
    let note;
    if (code !== 0) {
      status = FAIL;
      note = `exit ${code}`;
    } else if (marker === 'FAIL') {
      // 子命令自己声明 FAIL 却退出 0 —— 这是子命令的缺陷，聚合器按 FAIL 记。
      status = FAIL;
      note = 'STATUS: FAIL 但退出码为 0';
    } else if (marker === 'SKIP') {
      status = SKIP;
      note = '未覆盖（子命令自报 SKIP）';
    } else if (marker === 'WARN') {
      // 观察项：子命令声明「发现可疑但本轮不阻断」（WXG-T-110）。**不记 PASS**，也不改退出码。
      status = WARN;
      note = '观察项（子命令自报 WARN，按裁定不阻断）';
    } else {
      status = PASS;
    }
    out.push({ name: step.name, status, secs, note });
  }
  return out;
}

/** 取**最后一次** `STATUS:` 标记（子命令可能逐项打印，最后一次是总结论）。 */
function lastStatus(stdout) {
  let last = null;
  const re = new RegExp(STATUS_RE.source, 'gm');
  let m;
  while ((m = re.exec(stdout || '')) !== null) last = m[1];
  return last;
}

// ─────────────────────────────────────────────────────────────── 汇总 ───────

/** 打印状态表 + 未通过/未执行清单，返回退出码。 */
function summarize(results, { strict = false } = {}) {
  const failed = results.filter((r) => r.status === FAIL);
  const warned = results.filter((r) => r.status === WARN);
  const skipped = results.filter((r) => r.status === SKIP);
  const passed = results.filter((r) => r.status === PASS);
  const width = Math.max(...results.map((r) => r.name.length), 6);

  console.log('\n' + '─'.repeat(72));
  console.log(`verify 汇总 —— 共 ${results.length} 项（**逐项执行，未短路**）`);
  for (const r of results) {
    const icon = r.status === PASS ? '✅' : r.status === WARN ? '🔶' : r.status === SKIP ? '⚠️' : '❌';
    const note = r.note ? `  (${r.note})` : '';
    console.log(`  ${icon} ${r.status.padEnd(4)} ${r.name.padEnd(width)}  ${r.secs.toFixed(1)}s${note}`);
  }
  console.log('─'.repeat(72));
  console.log(`  PASS ${passed.length} ｜ WARN ${warned.length} ｜ SKIP ${skipped.length} ｜ FAIL ${failed.length}`);
  if (failed.length) {
    console.log('  ❌ 未通过：' + failed.map((r) => `${r.name}${r.note ? `[${r.note}]` : ''}`).join('、'));
  }
  if (skipped.length) {
    console.log('  ⚠️ 未覆盖（**不是通过，是没测**）：' + skipped.map((r) => r.name).join('、'));
    console.log('     解除条件见各子命令输出的 SKIP 原因；`--strict` 会把 SKIP 判为失败。');
  }
  if (warned.length) {
    console.log('  🔶 观察项（**不是通过，也不是失败**；按用户裁定本轮不阻断，`--strict` 也不判红）：'
      + warned.map((r) => r.name).join('、'));
    console.log('     升级条件见该子命令自身输出（如 `check:host-tests` 的「何时可升 fail-closed」）。');
  }
  if (!failed.length && !skipped.length && !warned.length) console.log('  ✅ 全部执行且全部达标。');
  if (failed.length) console.log('  ℹ️ 本轮其余项均已实际执行（本聚合器不短路），可放心引用上表逐项结论。');

  if (failed.length) return 1;
  if (strict && skipped.length) return 1;
  return 0;
}

// ────────────────────────────────────────────────────── 步骤表自校验 ─────────

/** 步骤表 ↔ package.json scripts 是否仍对得上（改名/删项即 exit 2）。 */
function validateStepTable() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const scripts = pkg.scripts ?? {};
  const missing = STEPS.filter((s) => !scripts[s]);
  if (missing.length) {
    console.error(`❌ 步骤表与 package.json 脱钩，缺：${missing.join('、')}`);
    console.error('   ⇒ 改门禁项名字时，`STEPS`（本文件）与 `verify` 必须同批改。');
    return 2;
  }
  if (scripts.verify !== 'node tools/scripts/verify-all.mjs') {
    console.error(`❌ package.json 的 verify 不再是本聚合器：${String(scripts.verify).slice(0, 80)}`);
    console.error('   ⇒ 回退成 `&&` 链 = 重新引入 BD-17（短路）。');
    return 2;
  }
  console.log(`✅ 步骤表 ${STEPS.length} 项全部存在于 package.json，且 verify 仍指向本聚合器`);
  return 0;
}

// ─────────────────────────────────────────────────────────────── 自测 ───────

/**
 * 合成步骤自测（K-036 规避③：**必须有一条用例证明「注入一项失败 ⇒ 后续项仍跑且总退出码非零」**）。
 * 不依赖仓库状态、不跑真实门禁 —— 只验聚合器自身的三条承诺。
 */
function runSelftest() {
  const node = (code) => ['node', '-e', code];
  const cases = [];
  const assert = (name, cond) => {
    cases.push({ name, ok: !!cond });
    console.log(`  ${cond ? '✅' : '❌'} ${name}`);
  };

  const say = (s) => `require('node:fs').writeSync(1, ${JSON.stringify(s)})`;
  const OK = { name: 'a-pass', argv: node(say('STATUS: OK\n')) };
  const BAD = { name: 'b-fail', argv: ['node', '-e', 'process.exit(3)'] };
  const AFTER = { name: 'c-after-fail', argv: node(say('我仍然被跑了\nSTATUS: OK\n')) };
  const SKP = { name: 'd-skip', argv: node(say('STATUS: SKIP\n')) };

  const round1 = runSteps([OK, BAD, AFTER, SKP]);
  console.log('\n[verify-all selftest] 断言：');
  assert('1 失败项后续步骤照跑（不短路）', round1.some((r) => r.name === AFTER.name && r.status === PASS));
  assert('2 四项都有独立结论', round1.length === 4 && round1.every((r) => r.status));
  assert('3 非零退出码被记为 FAIL 且带退出码', byName(round1, BAD.name)?.status === FAIL && byName(round1, BAD.name)?.note === 'exit 3');
  assert('4 STATUS: SKIP 记 SKIP 而非 PASS', byName(round1, SKP.name)?.status === SKIP);
  assert(
    '5 默认口径：有 SKIP 无 FAIL ⇒ 退 0',
    summarize([OK, SKP].map((s) => round1.find((r) => r.name === s.name)), { strict: false }) === 0,
  );
  assert(
    '6 --strict 口径：SKIP 判失败 ⇒ 退 1',
    summarize([OK, SKP].map((s) => round1.find((r) => r.name === s.name)), { strict: true }) === 1,
  );
  assert(
    '7 有 FAIL ⇒ 退 1（即使无 SKIP）',
    summarize([OK, BAD].map((s) => round1.find((r) => r.name === s.name)), { strict: false }) === 1,
  );

  const round2 = runSteps([
    { name: 'all-ok-1', argv: node(say('STATUS: OK\n')) },
    { name: 'all-ok-2', argv: node(say('STATUS: OK\n')) },
  ]);
  assert('8 全绿 ⇒ 退出 0（含 --strict）', summarize(round2, { strict: true }) === 0);

  const bad = runSteps([{ name: 'self-contradictory', argv: node(say('STATUS: FAIL\n')) }]);
  assert('9 STATUS: FAIL 但退出 0 ⇒ 仍记 FAIL（不给静默绿灯）', bad[0].status === FAIL);

  // WXG-T-110：WARN（观察项）是**第四种**状态 —— 既不能伪装成 PASS，也不能（意外）变成阻断。
  const WRN = { name: 'e-warn', argv: node(say('STATUS: WARN\n')) };
  const warnRound = runSteps([WRN, OK]);
  assert('10 STATUS: WARN 记 WARN，**不记 PASS**（不伪装成通过）', byName(warnRound, WRN.name)?.status === WARN);
  assert(
    '11 WARN 不改变退出码（含 --strict）——「观察项」不得被聚合器擅自升级为阻断',
    summarize([byName(warnRound, WRN.name)], { strict: false }) === 0
    && summarize([byName(warnRound, WRN.name)], { strict: true }) === 0,
  );
  assert(
    '12 WARN 与 FAIL 并存时仍以 FAIL 为准（退 1）',
    summarize([byName(warnRound, WRN.name), { name: 'x', status: FAIL, secs: 0 }], { strict: false }) === 1,
  );

  const pass = cases.filter((c) => c.ok).length;
  console.log(`\n[verify-all selftest] ${pass}/${cases.length} 通过`);
  if (pass !== cases.length) console.error('❌ 聚合器自身承诺不成立 —— 这等于把 BD-17 换了个地方复发');
  return pass === cases.length ? 0 : 1;
}

function byName(results, name) {
  return results.find((r) => r.name === name);
}

// ─────────────────────────────────────────────────────────────── 帮助 ───────

function printHelp() {
  console.log(
    [
      '用法：node tools/scripts/verify-all.mjs [选项]',
      '',
      '全量门禁聚合器（逐项执行 + 逐项收集 + 汇总退出码，永不短路）。',
      '',
      '  --list          打印步骤表',
      '  --steps=a,b     只跑指定步骤（局部复跑）',
      '  --strict        SKIP 也判失败（CI 收紧用）',
      '  --validate      校验步骤表与 package.json 未脱钩',
      '  --selftest      合成步骤自测（不跑真实门禁）',
      '',
      '子命令可打 `STATUS: OK|WARN|SKIP|FAIL` 影响聚合结论；详见文件头注释。',
      '（WARN = 观察项：不伪装成 PASS，也不影响退出码；SKIP = 没测，`--strict` 判失败）',
    ].join('\n'),
  );
}
