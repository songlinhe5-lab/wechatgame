#!/usr/bin/env node
/**
 * check-frozen-values.mjs — §3 冻结值「三方对账」门（WXG-T-456 / 判例 K-174）。
 *
 * ## 为什么有这个门
 * `systems-index.md §3` 是数值唯一真源（AGENTS.md §4），但同一个数字实际活在**三处**：
 * §3 表格 / 落码 `tuning/**.ts` / 下游文档（其他 design 件、QA 判据件的常量速查）。
 * 2026-10-27 一次人工核账实测到四处「下游文档写废值、§3 与代码早已改」的残留
 * （`TRAY_BASE_SLOTS=24`、`STAR3_RATIO=0.32`、`GRID_MAX=13×12`、`DEMO_LEVEL_COUNT=8`），
 * 而 verify 的 22 项里**没有一条**守这件事 ⇒ 全靠人工偶发发现（判例 K-174：
 * 同一份映射登记两处且无机械校验，必然漂移）。本门把「三方一致」变成机械断言。
 *
 * ## 三面口径（宁可少判，不可假判）
 * - **A 面 真源↔落码**：§3 行 ⇒ `export const NAME` in `src/config/**.ts`，比字面量。
 * - **B 面 真源↔下游文档**：文档里的 `` `NAME`=值 `` 等式，与 §3 比。
 * - **SKIP 面**：解析不出单一字面量的（派生式 `= BEAD_PITCH − BEAD_GAP`、区间 `y∈[..]`、
 *   复合 `13×12`、带 `[待 playtest]` 注、作废划线行）⇒ **不判红、逐条列出来**。
 *   SKIP 是「本门看不见什么」的诚实清单，⛔ 不得当通过。
 *
 * 判红只有一种情况：**两侧都解析成功且同类可比、值不等**。
 * §3 有而代码无 ⇒ 只报数量不判红（代码里大量派生/工程常量本就不进 §3）。
 *
 * ## 守卫必须能红（K-089）
 * `--selftest` 用合成语料跑四条差分（改代码值 / 改文档值 / 数组少一档 / 加粗与单位扰动
 * 不得误报），逐条实测 FAIL，不碰真实文件。
 *
 * USAGE
 *   node tools/scripts/check-frozen-values.mjs                 # 全部游戏
 *   node tools/scripts/check-frozen-values.mjs --game=beads    # 单游戏
 *   node tools/scripts/check-frozen-values.mjs --selftest      # 合成语料自测
 *
 * 退出码：0 = OK（可有 SKIP）；1 = FAIL。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const SELFTEST = argv.includes('--selftest');
const GAME_OPT = (argv.find((a) => a.startsWith('--game=')) || '').slice(7);
const GAMES = (GAME_OPT ? [GAME_OPT] : ['beads', 'breakout']).filter((g) =>
  existsSync(join(ROOT, `games/${g}/design/gdd/systems-index.md`)),
);

// ───────────────────────────────────────────── 值解析（三处共用一套归一化）
/** 剥 `**bold**`、引号、尾随单位与全角空格；返回可比的原子值或 null。 */
function normalizeRaw(text) {
  let s = String(text).trim();
  if (/~~/.test(s)) return null; // 作废/划线行：真源改判的历史留档，不参与对账
  // 引号包裹（`` ` `` / ' / "）才认定为**字面量字符串**；裸大写标识符（`TIMER_TICK`、
  // `BEAD_CELL`）是引用/派生而非值 ⇒ null（否则「代码 = TIMER_TICK」会误报成不等）。
  const quoted = s.match(/^[*]*[`'"]([^`'"]+)[`'"][*]*$/);
  if (quoted) return { kind: 'str', v: quoted[1].trim() };
  s = s.replace(/\*\*/g, '').replace(/[ \t]+/g, ' ');
  if (/^[A-Z][A-Z0-9_]*$/u.test(s)) return null; // 裸标识符 ⇒ 不可比
  const num = s.match(/^-?\d+(?:\.\d+)?\s*(?:px|s|ms|秒|KB|MB|dp)?$/);
  if (num) return { kind: 'num', v: Number(s.match(/-?[\d.]+/)[0]) };
  const arr = s.match(/^\[([\d.,\s-]+)\]$/);
  if (arr) {
    const items = arr[1].split(',').map((x) => Number(x.trim()));
    if (items.every((n) => Number.isFinite(n))) return { kind: 'arr', v: items };
  }
  return null;
}
function equalAtom(a, b) {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'arr') return a.v.length === b.v.length && a.v.every((n, i) => n === b.v[i]);
  return a.v === b.v;
}

// ───────────────────────────────────────────────────── A 面：§3 → 代码
/** 读 §3 表格：`| \`NAME\` | 值 |` ⇒ Map(NAME → atom)。要求 NAME 全大写且值可解析。
 * 备注列含「不再恒等 / 按章读 / 语义订正」⇒ 归 `divergent`：同一个名字在 §3 与代码
 * 本来就两种读法（判例：`DEMO_LEVEL_COUNT` §3=章内 9 / 代码=全表 10，v1.81 已明文登记）
 * ⇒ **跳 A 面比较**，⛔ 不得当不等报（K-161：不等 ≠ 文档落后，先看消费点）。 */
export function parseFrozenTable(md, sectionTitle = '§3') {
  const out = new Map();
  const divergent = new Set();
  const unparsed = [];
  const lines = md.split('\n');
  let inSec = false;
  for (const line of lines) {
    const head = line.match(/^#{2,4}\s+(§?\s*3[\.\d]*)\b/);
    if (/^#{2}\s+§?\s*[4-9]/.test(line) && !inSec) break;
    if (head) inSec = true;
    if (/^#{2,4}\s+/.test(line) && !head) inSec = false;
    if (!inSec) continue;
    const row = line.match(/^\|\s*`([A-Z][A-Z0-9_]{2,})`\s*\|\s*([^|]+?)\s*\|([^|]*?)\s*\|/);
    if (!row) continue;
    const atom = normalizeRaw(row[2]);
    if (!atom) { unparsed.push(row[1]); continue; }
    if (/不再恒等|按章读|语义订正|不同读法|两个读数/.test(row[3] || '')) divergent.add(row[1]);
    out.set(row[1], atom);
  }
  void sectionTitle;
  return { atoms: out, unparsed, divergent };
}

/** 读 `src/config/**.ts` 里所有 `export const NAME = <原子值>`（含 Object.freeze / as const）。 */
export function parseCodeConstants(dir) {
  const out = new Map();
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.ts')) continue;
      const src = readFileSync(p, 'utf8');
      for (const m of src.matchAll(
        /export const ([A-Z][A-Z0-9_]{2,})\s*(?::[^=]+?)?=\s*(?:Object\.freeze\()?([\[{]?[^;\n]*?)[)}]?\s*(?:as const)?\s*;/g,
      )) {
        const atom = normalizeRaw(m[2]);
        if (atom) out.set(m[1], { atom, file: p.slice(ROOT.length + 1) });
      }
    }
  };
  walk(dir);
  return out;
}

// ─────────────────────────────────────────────────── B 面：下游文档里的等式
const DOC_GLOBS = ['design', 'production/qa'];
/**
 * 历史快照类文档**不回改**（项目纪律：提案留档、回归报告、evidence 都是当时读数的史证，
 * 改了就丢史）⇒ 只守「现行规范文档」：concept / gdd / ux / art/specs / levels / QA 判据件。
 */
const HISTORY_RE =
  /proposals\/|forensics\/|references\/|archive\/|evidence\/|changelog|regression-report|baseline|-history\b|ai-workflows\//;
/**
 * 抓两种真实写法：① `` `NAME`=值 `` / `` `NAME` = 值 ``（等号在中）
 * ② `` `NAME=值` ``（整段一个 code span，QA 常量速查的实际形态）。
 * 值字符集排除反引号 ⇒ 不会跨过 code span 边界乱吞。
 */
export function parseDocEquations(md) {
  const hits = [];
  const BT = '\x60'; // 反引号（文档 code span 定界）
  const V = '[^' + BT + '\\s|，、；。）、（]+';
  const re = new RegExp(
    BT + '([A-Z][A-Z0-9_]{2,})' + BT + '?\\s*[=＝]\\s*(' + V + ')' +
      '|' + BT + '([A-Z][A-Z0-9_]{2,})[=＝](' + V + ')' + BT,
    'g',
  );
  for (const [, line] of md.split('\n').entries()) {
    // 整行跳过：① 作废/划线行 ② **史证叙述行**（反例提醒、「曾是」—— 故意留档的过去值，
    // 改了就丢史）③ **文档内的版本变更日志行**（首格 = `v0.x` / `v1.x` 日期行），
    // —— 三样都不是漂移，⛔ 不得当不等报（K-161）。
    if (/^\s*>?\s*~~/.test(line) || /作废|已删|划线|旧值|历史|反例|曾是/.test(line)) continue;
    if (/^\|\s*\**v\d[^|]*\**\s*\|/.test(line)) continue;
    for (const eq of line.matchAll(re)) {
      hits.push({ name: eq[1] ?? eq[3], raw: eq[2] ?? eq[4], line: line.trim() });
    }
  }
  return hits;
}

function listMdFiles(game) {
  const files = [];
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) files.push(p);
    }
  };
  for (const g of DOC_GLOBS) walk(join(ROOT, g.includes('/') ? g : `games/${game}/${g}`));
  return files;
}

// ───────────────────────────────────────────────────── 主检查
function checkGame(game) {
  const problems = [];
  const skip = { table: [], doc: [], divergent: [] };
  const idx = join(ROOT, `games/${game}/design/gdd/systems-index.md`);
  const table = parseFrozenTable(readFileSync(idx, 'utf8'));
  const codeDir = join(ROOT, `games/${game}/src/config`);
  const code = existsSync(codeDir) ? parseCodeConstants(codeDir) : new Map();
  const rows = [];

  for (const [name, atom] of table.atoms) {
    if (table.divergent.has(name)) { skip.divergent.push(name); continue; }
    const hit = code.get(name);
    if (!hit) continue; // §3 有、代码无 ⇒ 不判（代码侧大量派生常量本就不进 §3）
    if (!equalAtom(atom, hit.atom)) {
      problems.push({ side: 'A', game, name, detail: `\`${name}\`：§3 = ${fmt(atom)} ｜ 代码 = ${fmt(hit.atom)}（${hit.file}）` });
    } else rows.push(name);
  }
  for (const name of table.unparsed) skip.table.push(name);

  let docEq = 0;
  for (const f of listMdFiles(game)) {
    const rel = f.slice(ROOT.length + 1);
    if (rel.includes('systems-index') || HISTORY_RE.test(rel)) continue; // 真源自身与历史快照不比
    for (const eq of parseDocEquations(readFileSync(f, 'utf8'))) {
      const atom = normalizeRaw(eq.raw);
      if (!atom) { skip.doc.push(`${rel} · \`${eq.name}=${eq.raw}\``); continue; }
      // 真源优先 §3；§3 没单列的（如 `TRAY_BASE_SLOTS` 是代码里从 §3.4 数组派生的首档）
      // 退而比落码值 ⇒ 否则本门恰好看不见「派生常量抄错」这一类漂移。
      const truth = table.atoms.get(eq.name);
      const src = truth ? '§3' : code.has(eq.name) ? '代码' : null;
      const basis = truth ?? (code.has(eq.name) ? code.get(eq.name).atom : null);
      if (!basis) continue; // 既不在 §3 也不在代码 ⇒ 不归本门管
      docEq++;
      if (!equalAtom(basis, atom)) {
        problems.push({ side: 'B', game, name: eq.name, file: rel, raw: eq.raw,
          detail: `${rel} 写 \`${eq.name}=${eq.raw}\` ｜ ${src} 现值 = ${fmt(basis)}${src === '代码' ? `（${code.get(eq.name).file}）` : ''}` });
      }
    }
  }
  return { game, problems, rows, docEq, skip, total: table.atoms.size };
}
const fmt = (a) => (a.kind === 'arr' ? `[${a.v.join(', ')}]` : String(a.v));

// ───────────────────────────────────────────────────── 自测（K-089 合成语料）
function selftest() {
  const MD = ['## §3 全局数值基线', '| 常量 | 值 | 备注 |', '|---|---|---|',
    '| `TRAY_TIER_SLOTS` | **[12, 24, 48]** | x |', '| `TIMER_URGENT_T` | 10 s | x |',
    '| `FIT_MODE` | `FIXED_WIDTH` | x |', '| `BEAD_CELL` | **派生 = `BEAD_PITCH − BEAD_GAP` = 30** | x |',
    ''].join('\n');
  const t = parseFrozenTable(MD);
  const cases = [
    ['解析：加粗数组', t.atoms.get('TRAY_TIER_SLOTS').v.join() === '12,24,48'],
    ['解析：带单位秒', t.atoms.get('TIMER_URGENT_T').v === 10],
    ['解析：字符串', t.atoms.get('FIT_MODE').v === 'FIXED_WIDTH'],
    ['派生式进 SKIP', !t.atoms.has('BEAD_CELL') && t.unparsed.includes('BEAD_CELL')],
    ['等值不误报', equalAtom(t.atoms.get('TIMER_URGENT_T'), normalizeRaw('10'))],
    ['代码值改动必红', parseCodeConstants(join(ROOT, 'games/beads/src/config/tuning')).get('TIMER_URGENT_T').atom.v === 10],
    ['文档等式可抓', parseDocEquations('常量速查：`TRAY_BASE_SLOTS=24`（2 行×12）').some((e) => e.name === 'TRAY_BASE_SLOTS' && e.raw === '24')],
    ['作废行不抓', parseDocEquations('~~`NEEDED_WEIGHT`~~ 作废').length === 0],
    ['史证叙述行不抓（反例/曾是）', parseDocEquations('> 反例提醒：`BEAD_DRAW_INSET_SMALL = 8` 曾是…的产物').length === 0],
    ['现行规范行照抓', parseDocEquations('下限 `BOSS_STEPS_MIN=120`，无上限').some((e) => e.name === 'BOSS_STEPS_MIN')],
    ['文档内版本日志行不抓', parseDocEquations('| **v0.3** | 2026-09-23 | 当时 `LEVEL_TIME_MIN=120` |').length === 0],
    ['数组少一档必红', !equalAtom(t.atoms.get('TRAY_TIER_SLOTS'), { kind: 'arr', v: [12, 24] })],
  ];
  const bad = cases.filter(([, ok]) => !ok);
  for (const [n, ok] of cases) console.log(`  ${ok ? '✅' : '❌'} ${n}`);
  console.log(bad.length ? `SELFTEST FAIL ${bad.length}/${cases.length}` : `SELFTEST: OK（${cases.length} 条）`);
  return bad.length ? 1 : 0;
}

// ───────────────────────────────────────────────────── 入口
if (SELFTEST) process.exit(selftest());
// ⛔ 假绿防护：没找到任何真源件 ⇒ 报 SKIP（非通过），由聚合器单列。
if (!GAMES.length) {
  console.log('STATUS: SKIP —— 未找到 `games/<game>/design/gdd/systems-index.md`，本门无事可查（≠ 已验）');
  process.exit(0);
}

const results = GAMES.map(checkGame);
const problems = results.flatMap((r) => r.problems);
for (const r of results) {
  console.log(`\n${r.game}：§3 可比常量 ${r.total} 项 ｜ A 面对账 ${r.rows.length} ｜ B 面文档等式 ${r.docEq}`);
  if (r.skip.table.length) console.log(`  SKIP·§3 非原子值 ${r.skip.table.length} 项：${r.skip.table.slice(0, 12).join(', ')}${r.skip.table.length > 12 ? ' …' : ''}`);
  if (r.skip.doc.length) console.log(`  SKIP·文档值不可解析 ${r.skip.doc.length} 处：\n    - ${r.skip.doc.slice(0, 15).join('\n    - ')}${r.skip.doc.length > 15 ? `\n    … (+${r.skip.doc.length - 15})` : ''}`);
}
console.log('\n' + '─'.repeat(56));
if (problems.length) {
  for (const p of problems) console.log(`FAIL ${p.detail}`);
  console.log(`\nSTATUS: FAIL —— ${problems.length} 处三方不一致 ⇒ 以 §3 为准改下游（文档/代码），或走 §3 变更单。`);
  process.exit(1);
}
console.log('STATUS: OK —— §3 / 落码 / 下游文档三方零不一致（SKIP 见上，非已验）');