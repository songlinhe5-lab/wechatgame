#!/usr/bin/env node
/**
 * check-bundle-size.mjs — 微信小游戏包体校验（WXG-T-047 ①）。
 *
 * 补的是 `docs/agent/cocos-setup.md §12.3` 登记在案的缺口：
 *   「`games/breakout/cocos/README.md` §3 步骤 7 引用的 check-bundle-size.mjs …
 *    在仓库中均不存在。此为独立缺陷。」
 *
 * ── 阈值真源（一个字都不改，改前先改 §3）─────────────────────────────────
 *   `games/breakout/design/gdd/systems-index.md` §3.8「包体预算」(❄️ 冻结令)
 *     ① 平台红线：主包 ≤ 4096 KB ｜ 主包 + 分包 ≤ 30720 KB   → 超限 FAIL
 *     ② 内部目标：demo 主包合计 ≤ 2000 KB                    → 超目标 WARN（不阻断）
 *   分层口径由 `architecture.md` §2 约束表 / ADR-0001 背书；「红线 vs 目标勿混用」
 *   见 §3.8 末尾的「口径提醒」。**禁止**把 2000 当红线、也**禁止**把 4096 当目标。
 *
 * ── 体积口径（本脚本的裁定 + 一处已登记的文档偏差）───────────────────────
 *   · 判定基准 = **原始字节（raw）**。微信平台按上传文件的实际大小卡口，
 *     gzip 只是传输/优化参考，不参与判定。
 *   · gzip 体积**仅供参考展示**（逐文件 gzip 求和，属估算，非一次流式压缩）。
 *   · ⚠️ 偏差登记：`architecture.md` §5 末行写「对 `build/` 或 `dist/` 做 **gzip 后**统计」。
 *     本脚本实现为「raw 判定 + gzip 参考」——理由是 raw ≥ gzip，按 raw 卡**严格更安全**
 *     （宁假红不假绿）。该措辞应由文档侧修正（AGENTS.md §4：文档冲突先改文档再改代码）。
 *
 * ── 分包口径（G7 未验证，如实标注）─────────────────────────────────────
 *   · 优先读产物 `game.json` 的 `subpackages[].root` 作为分包根（**权威**）。
 *   · 读不到 → 回退目录启发式 `subpackages/`。
 *   · 再读不到 → **全部计入主包**（保守，即最严判定）。
 *   · ⚠️ Cocos 3.8.8 微信小游戏产物的真实目录结构**尚未实测**
 *     （`docs/engine-reference/cocos/VERSION.md` G7）——拿到首次产物后须回填本注释。
 *
 * ── 未落地的分项判定（刻意不做，避免造伪判据）───────────────────────────
 *   §3.8 ② 另有分项预算（引擎 ≤1800 KB / 业务 ≤400 KB / 美术位图 0 KB / 其他 ≤100 KB），
 *   但**分项拆分需要知道产物目录里哪部分是引擎、哪部分是业务**——当前未知。
 *   故本脚本只判「主包合计 / 主包+分包合计」，分项判定待 G7 实测目录结构后再落地。
 *
 * ── 覆盖面口径（WXG-T-095 / 缺陷 **BD-18** 的修正）───────────────────────
 *   旧行为：只测「磁盘上存在的产物」，缺产物的游戏**根本不出现**在报告里 ⇒ 整体仍打「✅ 包体校验 OK」，
 *   于是 beads 连续两轮「无数据却看似已测」。新行为：
 *   ① 逐游戏给结论——`games/*` 每个目录都要么被实测，要么被列为**未覆盖（SKIP）**；
 *   ② 「未覆盖」不是一种通过状态：总结论降为 **SKIP**（而非 OK），并打 WARN 清单与解除条件；
 *   ③ 机读标记 `STATUS: OK|SKIP|FAIL`（供 `verify-all.mjs` 聚合并区分 PASS/SKIP，见 K-036）。
 *   · 拿到 `wechatgame` 产物需有效 **AppID**（`build-cocos.mjs` 头注 09-14 实测）⇒ 缺产物属**环境阻塞**，
 *     不是可以忽略的空项。
 *
 * ── 用法 ────────────────────────────────────────────────────────────────
 *   node tools/scripts/check-bundle-size.mjs                     # 自动发现 games/<game>/{build,cocos/build}/wechatgame
 *   node tools/scripts/check-bundle-size.mjs <产物目录> [...]     # 显式指定
 *   node tools/scripts/check-bundle-size.mjs --json              # 机读输出（CI）
 *   node tools/scripts/check-bundle-size.mjs --strict             # 有游戏未被覆盖 ⇒ 也判失败
 *   node tools/scripts/check-bundle-size.mjs --selftest          # 桩自测（临时目录，不碰真产物）
 *
 * 干净检出（CI / 未构建）：**打 `STATUS: SKIP` 并列出未覆盖游戏**；退出码仍为 0（不阻断未构建环境），
 * 需要收紧时用 `--strict`（或走 `pnpm run verify:strict`）——与 `check-cocos-scripts.mjs` 同跳过范式。
 * 退出码：0 = 全覆盖达标，或未全覆盖但**未**开 `--strict`（此时结论是 SKIP，绝不是 OK）；
 *         1 = 超平台红线，或（`--strict` 下）存在未覆盖游戏；2 = 用法错误。
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';

/** 1 KB = 1024 B（与 §3.8 的「4096 KB（4 MB）」自洽） */
const KB = 1024;

/** 阈值真源：systems-index §3.8。单一常量表，禁止在别处再写一份数字。 */
const LIMITS = Object.freeze({
  mainRedlineKb: 4096,
  totalRedlineKb: 30720,
  mainTargetKb: 2000,
});

const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) {
  printHelp();
  process.exit(0);
}
if (argv.includes('--selftest')) {
  runSelftest();
}

const JSON_OUT = argv.includes('--json');
const STRICT = argv.includes('--strict');
const explicit = argv.filter((a) => !a.startsWith('-'));
const ROOT = gitRoot();

/** ── 目标发现 ─────────────────────────────────────────────────────────── */
const targets = explicit.length ? explicit.map((p) => resolve(ROOT, p)) : discoverTargets();
const found = targets.filter((t) => existsSync(t));

/**
 * 覆盖面（BD-18）：`games/*` 的**每一款**游戏都要有结论。
 * 显式指定目录时不推断覆盖面（调用方自行负责），只把没匹配上的目录留空。
 */
const games = explicit.length ? [] : listGames();
const covered = new Set(found.map((d) => gameOf(d, ROOT)).filter(Boolean));
const missing = games.filter((g) => !covered.has(g));

if (found.length === 0) {
  const where = explicit.length ? targets.map((t) => rel(t)).join('、') : 'games/*/build/wechatgame（含 cocos/build 双路径）';
  const status = overallStatus({ anyFail: false, missing });
  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        { status, limits: LIMITS, results: [], covered: [...covered], missing, reason: '产物目录不存在', looked: where },
        null,
        2,
      ),
    );
  } else {
    console.log('包体校验（微信小游戏）— **未覆盖**（不是「通过」）');
    console.log(`  未找到任何构建产物：${where}`);
    if (missing.length) console.log(`  未覆盖游戏（${missing.length} 款）：${missing.join('、')}`);
    console.log('  说明：干净检出 / 未构建时无产物可测属预期，但**结论必须写成 SKIP**（BD-18：旧版在此静默报 ✅）。');
    console.log('  解除条件：`pnpm --filter <game> run build:cocos` 需有效 **AppID**（wechatgame 平台）；仅看渲染可用 web-mobile 产物，但**不计入主包红线判定**。');
  }
  if (!JSON_OUT) console.log(`STATUS: ${status.toUpperCase()}`);
  process.exit(STRICT && status !== 'ok' ? 1 : 0);
}

/** ── 逐产物测量与判定 ─────────────────────────────────────────────────── */
const results = [];
let anyFail = false;

for (const dir of found) {
  const files = walk(dir, dir);
  const { roots: subRoots, source: subSource } = subpackageRoots(dir, files);

  const isSub = (f) => subRoots.some((r) => f.rel === r || f.rel.startsWith(`${r}/`));
  const mainFiles = files.filter((f) => !isSub(f));
  const subGroups = new Map();
  for (const f of files.filter(isSub)) {
    const root = subRoots.find((r) => f.rel === r || f.rel.startsWith(`${r}/`));
    if (!subGroups.has(root)) subGroups.set(root, []);
    subGroups.get(root).push(f);
  }

  const main = measure(mainFiles);
  const subs = [...subGroups.entries()].map(([root, fs]) => ({ root, ...measure(fs) })).sort((a, b) => b.raw - a.raw);
  const subRaw = subs.reduce((n, s) => n + s.raw, 0);
  const totalBytes = main.raw + subRaw;

  const verdict = judge({ mainBytes: main.raw, totalBytes });
  if (verdict.fail.length) anyFail = true;
  results.push({ dir: rel(dir), subSource, main, subs, totalBytes, verdict });
}

/** ── 报告 ─────────────────────────────────────────────────────────────── */
const status = overallStatus({ anyFail, missing });
if (JSON_OUT) {
  console.log(JSON.stringify({ status, limits: LIMITS, results, covered: [...covered], missing }, null, 2));
} else {
  console.log('包体校验（微信小游戏）— 阈值真源 systems-index §3.8');
  console.log(`  红线：主包 ≤ ${LIMITS.mainRedlineKb} KB ｜ 主包+分包 ≤ ${LIMITS.totalRedlineKb} KB`);
  console.log(`  目标：主包合计 ≤ ${LIMITS.mainTargetKb} KB（比红线更严，程序侧按此做）`);
  console.log('  口径：判定用**原始字节**；gzip 仅供参考（逐文件求和，估算）');
  console.log('');
  for (const r of results) {
    console.log(`产物：${r.dir}`);
    console.log(`  分包判定来源：${r.subSource}`);
    console.log(`  主包：${fmtKb(r.main.raw)}（${r.main.count} 文件）｜ gzip 参考 ${fmtKb(r.main.gz)}`);
    for (const s of r.subs) {
      console.log(`  分包 ${s.root}：${fmtKb(s.raw)}（${s.count} 文件）｜ gzip 参考 ${fmtKb(s.gz)}`);
    }
    if (r.subs.length) console.log(`  分包合计：${fmtKb(r.totalBytes - r.main.raw)}`);
    console.log(`  主包 + 分包：${fmtKb(r.totalBytes)}`);
    if (r.verdict.fail.length) {
      console.log(`  ❌ 超平台红线：${r.verdict.fail.join('；')}`);
    } else if (r.verdict.warns.length) {
      console.log(`  ⚠️ 超内部目标：${r.verdict.warns.join('；')}`);
    } else {
      console.log(`  ✅ 达标（主包 ${r.verdict.mainKb.toFixed(1)} KB ≤ 内部目标 ${LIMITS.mainTargetKb} KB）`);
    }
    console.log('');
  }
  if (anyFail) {
    console.log('❌ 包体校验 FAILED —— 超平台红线，**不可上线**。');
    console.log('   处置（按 §3.8 口径）：超出主包的内容走「分包 / 远程包」——关卡 2..N 美术走分包 levels、');
    console.log('   音乐/长音效走远程包；并核对「项目设置 → 功能裁剪」是否只勾了真正用到的模块。');
  } else if (missing.length) {
    console.log(`⚠️ 包体校验 **SKIP**（未全覆盖）—— 已测：${[...covered].join('、') || '（无）'}`);
    console.log(`   未覆盖（${missing.length} 款，**不是通过**）：${missing.join('、')}`);
    console.log('   解除条件：需有效 AppID 产出 `games/<game>/{build,cocos/build}/wechatgame`（见 `build-cocos.mjs` 头注）；');
    console.log('   本轮已跑部分（见上）仍有效，但**不得把本项计入达标**。收紧：`pnpm run verify:strict` 或 `check:size --strict`。');
  } else {
    console.log('✅ 包体校验 OK（`games/*` 全覆盖，且未越任何平台红线）');
  }
  console.log(`STATUS: ${status.toUpperCase()}`);
}

process.exit(anyFail || (STRICT && status !== 'ok') ? 1 : 0);

// ─────────────────────────────────────────────────────────── 结论（纯函数）───

/**
 * 总结论（可单测）：**只要有游戏未被覆盖，结论就不是 ok**（BD-18）。
 * 优先级：fail > skip > ok。`missing` = 无 `wechatgame` 产物的游戏名单。
 */
export function overallStatus({ anyFail, missing = [] }) {
  if (anyFail) return 'fail';
  if (missing.length) return 'skip';
  return 'ok';
}

/** `games/<game>/...` → `<game>`；不在 games 下则返回 undefined（显式指定路径时）。 */
function gameOf(absDir, root) {
  const r = relative(root, absDir).split(sep);
  return r[0] === 'games' ? r[1] : undefined;
}

/** 仓库内现有游戏目录名单（覆盖面分母）。 */
function listGames() {
  try {
    return readdirSync(join(ROOT, 'games'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────── 判定（纯函数）───

/**
 * 判定（纯函数，可单测）：**只判 §3.8 的两条红线 + 一条内部目标**，不做分项。
 * 返回值语义：fail 非空 = 超红线（阻断）；warns 非空 = 红线内但超目标（提示）。
 */
export function judge({ mainBytes, totalBytes, limits = LIMITS }) {
  const mainKb = mainBytes / KB;
  const totalKb = totalBytes / KB;
  const fail = [];
  if (mainKb > limits.mainRedlineKb) {
    fail.push(`主包 ${mainKb.toFixed(1)} KB > 平台红线 ${limits.mainRedlineKb} KB`);
  }
  if (totalKb > limits.totalRedlineKb) {
    fail.push(`主包+分包 ${totalKb.toFixed(1)} KB > 平台红线 ${limits.totalRedlineKb} KB`);
  }
  const warns = [];
  if (fail.length === 0 && mainKb > limits.mainTargetKb) {
    warns.push(`主包 ${mainKb.toFixed(1)} KB > 内部目标 ${limits.mainTargetKb} KB`);
  }
  return { mainKb, totalKb, fail, warns, ok: fail.length === 0 };
}

// ─────────────────────────────────────────────────────────── 测量 ───────────

function measure(files) {
  let raw = 0;
  let gz = 0;
  for (const f of files) {
    raw += f.size;
    try {
      gz += gzipSync(readFileSync(f.full)).length;
    } catch {
      gz += f.size; // 读不了就按原样计（偏保守）
    }
  }
  return { raw, gz, count: files.length };
}

function walk(dir, base, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue; // .DS_Store / .git 等不计入
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else if (e.isFile()) {
      try {
        out.push({ rel: relative(base, full).split(sep).join('/'), size: statSync(full).size, full });
      } catch {
        /* stat 失败的文件跳过 */
      }
    }
  }
  return out;
}

/**
 * 分包根判定。三级回退：game.json（权威）→ 目录启发式 → 全计入主包（保守）。
 * 返回 { roots, source }：source 会原样打印进报告，便于事后核对口径来自哪一级。
 */
function subpackageRoots(targetDir, files) {
  const gameJson = join(targetDir, 'game.json');
  if (existsSync(gameJson)) {
    try {
      const cfg = JSON.parse(readFileSync(gameJson, 'utf8'));
      const list = cfg.subpackages ?? cfg.subPackages ?? [];
      const roots = list
        .map((s) => String(s?.root ?? s?.name ?? '').replace(/^\/+|\/+$/g, ''))
        .filter(Boolean);
      if (roots.length) return { roots: [...new Set(roots)], source: 'game.json 的 subpackages[].root' };
    } catch {
      /* 落到下一级 */
    }
  }
  if (files.some((f) => f.rel.startsWith('subpackages/'))) {
    return { roots: ['subpackages'], source: '目录启发式 subpackages/（game.json 无分包字段）' };
  }
  return { roots: [], source: '无分包信息 → 全部计入主包（保守判定，最严）' };
}

// ─────────────────────────────────────────────────────────── 发现 ───────────

function discoverTargets() {
  const out = [];
  const gamesDir = join(ROOT, 'games');
  let names = [];
  try {
    names = readdirSync(gamesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return out;
  }
  for (const n of names.sort()) {
    // 两处都要看：Cocos CLI 默认把产物写在**工程内** `cocos/build/<platform>/`，
    // 而 `architecture.md §1/§5` 约定的位置是 `games/<game>/build/`。
    // **只认一处会造成「产物在、门禁说没产物」的静默跳过**（K-031 族）——故两处都扫。
    out.push(join(gamesDir, n, 'build', 'wechatgame'));
    out.push(join(gamesDir, n, 'cocos', 'build', 'wechatgame'));
  }
  return out;
}

// ─────────────────────────────────────────────────────────── 自测 ───────────

function runSelftest() {
  const tmp = join(tmpdir(), `wxg-bundle-selftest-${process.pid}`);
  const cases = [];
  const assert = (name, cond) => cases.push({ name, ok: !!cond });

  try {
    // §A 判定纯函数（合成数值，不写盘）
    const L = LIMITS;
    assert('A1 目标内 → pass', judge({ mainBytes: 1000 * KB, totalBytes: 1000 * KB }).ok === true);
    assert(
      'A2 超目标未超红线 → ok 且有 warn',
      judge({ mainBytes: 2500 * KB, totalBytes: 2500 * KB }).ok === true &&
        judge({ mainBytes: 2500 * KB, totalBytes: 2500 * KB }).warns.length === 1,
    );
    assert('A3 主包超红线 4096 → fail', judge({ mainBytes: 4097 * KB, totalBytes: 4097 * KB }).fail.length === 1);
    assert(
      'A4 主包刚好 4096 → 不含主包红线项（边界不算超）',
      !judge({ mainBytes: 4096 * KB, totalBytes: 4096 * KB }).fail.some((m) => m.includes('主包')),
    );
    assert(
      'A5 主包小但主包+分包 30721 → fail（合计红线独立生效）',
      judge({ mainBytes: 1000 * KB, totalBytes: 30721 * KB }).fail.some((m) => m.includes('主包+分包')),
    );
    assert(
      'A6 超红线时不再报目标 warn（避免噪声）',
      judge({ mainBytes: 5000 * KB, totalBytes: 5000 * KB }).warns.length === 0,
    );
    assert('A7 阈值表与 §3.8 一致', L.mainRedlineKb === 4096 && L.totalRedlineKb === 30720 && L.mainTargetKb === 2000);

    // §B 测量 + 分包识别（真文件，尺寸刻意做小）
    const p1 = join(tmp, 'no-sub');
    mkdirSync(join(p1, 'assets'), { recursive: true });
    writeFileSync(join(p1, 'game.json'), JSON.stringify({ deviceOrientation: 'portrait' }));
    writeFileSync(join(p1, 'assets', 'a.bin'), Buffer.alloc(2048));
    const f1 = walk(p1, p1);
    assert('B1 walk 跳过 dotfile', walk(p1, p1).length === 2);
    assert('B2 无分包信息 → 全计入主包', subpackageRoots(p1, f1).roots.length === 0);
    assert('B3 测量 raw 求和正确', measure(f1).raw === 2048 + JSON.stringify({ deviceOrientation: 'portrait' }).length);

    const p2 = join(tmp, 'with-sub');
    mkdirSync(join(p2, 'subpackages', 'levels'), { recursive: true });
    writeFileSync(join(p2, 'game.json'), JSON.stringify({ subpackages: [{ name: 'levels', root: 'subpackages/levels' }] }));
    writeFileSync(join(p2, 'main.bin'), Buffer.alloc(1024));
    writeFileSync(join(p2, 'subpackages', 'levels', 'l1.bin'), Buffer.alloc(4096));
    const f2 = walk(p2, p2);
    const r2 = subpackageRoots(p2, f2);
    assert('B4 game.json 分包根被识别', r2.source.includes('game.json') && r2.roots[0] === 'subpackages/levels');
    const isSub = (f) => r2.roots.some((r) => f.rel === r || f.rel.startsWith(`${r}/`));
    assert('B5 分包文件归属正确', f2.filter(isSub).length === 1 && f2.filter((f) => !isSub(f)).length === 2);

    const p3 = join(tmp, 'heuristic-sub');
    mkdirSync(join(p3, 'subpackages', 'x'), { recursive: true });
    writeFileSync(join(p3, 'subpackages', 'x', 'y.bin'), Buffer.alloc(16));
    assert('B6 game.json 缺失 → 回退目录启发式', subpackageRoots(p3, walk(p3, p3)).source.includes('启发式'));

    // §C 覆盖面（**BD-18**：缺产物的游戏不得被当作通过）
    assert('C1 全覆盖且无 fail → ok', overallStatus({ anyFail: false, missing: [] }) === 'ok');
    assert('C2 有游戏未被覆盖 → skip（**不是 ok**）', overallStatus({ anyFail: false, missing: ['beads'] }) === 'skip');
    assert('C3 超红线优先于未覆盖 → fail', overallStatus({ anyFail: true, missing: ['beads'] }) === 'fail');
    assert('C4 missing 缺省为空 → ok（旧调用不回归）', overallStatus({ anyFail: false }) === 'ok');
    const FAKE_ROOT = join(tmpdir(), 'wxg-fake-root');
    assert(
      'C5 产物路径能归到游戏名',
      gameOf(join(FAKE_ROOT, 'games', 'beads', 'cocos', 'build', 'wechatgame'), FAKE_ROOT) === 'beads',
    );
    assert('C6 不在 games 下的路径 → undefined（不乱计覆盖面）', gameOf(join(FAKE_ROOT, 'tools', 'x'), FAKE_ROOT) === undefined);
  } finally {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* 清理失败不影响结论 */
    }
  }

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) console.log(`  ${c.ok ? '✅' : '❌'} ${c.name}`);
  console.log('');
  if (failed.length) {
    console.error(`❌ check-bundle-size --selftest FAILED：${failed.length}/${cases.length} 未通过`);
    process.exit(1);
  }
  console.log(`✅ check-bundle-size --selftest OK（${cases.length}/${cases.length}）`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────── helpers ────────

function rel(p) {
  const r = relative(ROOT, p).split(sep).join('/');
  return r.startsWith('..') ? p : r;
}

function fmtKb(bytes) {
  return `${(bytes / KB).toFixed(1)} KB`;
}

function gitRoot() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  return process.cwd();
}

function printHelp() {
  console.log(`微信小游戏包体校验（WXG-T-047 ①）

用法：
  node tools/scripts/check-bundle-size.mjs [产物目录...] [选项]

选项：
  --json        机读输出（CI 用）
  --selftest    桩自测（临时目录 + 合成数值，不碰真产物）
  -h, --help    本帮助

阈值（真源 games/breakout/design/gdd/systems-index.md §3.8，改前先改 §3）：
  平台红线  主包 ≤ 4096 KB ｜ 主包 + 分包 ≤ 30720 KB   → 超限 exit 1
  内部目标  主包合计 ≤ 2000 KB                          → 超目标仅 warn

口径：
  · 判定用**原始字节**（微信按上传文件实际大小卡口）；gzip 仅参考展示。
  · ⚠️ architecture.md §5 写的是「gzip 后统计」——本脚本按 raw 判定（严格更安全），
    偏差已登记在脚本头注释，文档措辞待修正。
  · 分包根优先取产物 game.json 的 subpackages[].root；取不到则回退 subpackages/ 启发式；
    再取不到则全部计入主包（保守）。Cocos 产物真实结构见 VERSION.md G7（未实测）。

干净检出 / 未构建：自动跳过 exit 0（构建产物不入库）。
构建：Cocos 编辑器「项目 → 构建发布」，必须在 GUI 完成（MCP 只能开面板，不能触发构建）。`);
}
