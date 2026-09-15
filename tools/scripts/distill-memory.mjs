#!/usr/bin/env node
/**
 * distill-memory.mjs — memory 日志 30 天蒸馏轮转器（WXG-T-041，对策 R2）。
 *
 * 背景：`memory/YYYY-MM-DD.md` 是 AI 会话日记（每日追加式），审计（2026-09-13）认定
 * 只增不减是真雷——`memory/2026-09-12.md` 已 10141 tokens（B 门 8000 靠豁免硬扛）。
 * 本脚本把**满 30 天**的日志机械移入 `memory/archive/`，并在 `MEMORY.md` 末尾追加
 * 「待蒸馏」占位提醒，确保归档事实可追溯。
 *
 * ── 核心边界（本任务的关键裁决）────────────────────────────────────────────────
 * 日志的价值在于**可蒸馏进 MEMORY.md（长期精选）**，但蒸馏是语义工作，脚本只能做
 * 机械轮转 + 防丢护栏——**绝不能无人蒸馏就把原始日志删掉/移走不管**。因此：
 * • 归档 = 移动即归档：原始内容**逐字节保留**在 `memory/archive/<同名>`，不删不改，
 *   git 里永久可查（脚本写入归档后逐字节回读校验，不等则 fail loud 不删原件）；
 * • `--write` 同时在 `MEMORY.md` 末尾追加「⏳ 待蒸馏」占位提醒（蒸馏责任在人/会话，
 *   提醒不消化不删除）；
 * • dry-run 对每个候选报告 `MEMORY.md` 最近修改时间与日志日期的先后——作为「已蒸馏」
 *   的**弱证据**（MEMORY.md 晚于日志更新 ≈ 可能已蒸馏），提醒先蒸馏再归档。
 *
 * ── 归档路径裁决（沿用 WXG-T-040 / WXG-T-029 先例）────────────────────────────
 * 归档目录 `memory/archive/` 命中 `lib/context-index.mjs` 的 `SKIP_DIRS`（其中 `archive`
 * 一项，WXG-T-029 注释已预告覆盖未来的 `memory/archive/`）——**零代码改动**即被排除
 * ctx 索引面：归档文件永不进常驻面（不撞 B 门单文件上限），但 git 里永久可查。
 *
 * ── 日志年龄判定来源（裁决）────────────────────────────────────────────────────
 * 日志日期取自**文件名 `YYYY-MM-DD.md`**（日记命名即会话日期，比 mtime 可靠——mtime
 * 会被并发追加刷新）：
 * • 只认严格匹配 `^\d{4}-\d{2}-\d{2}\.md$` 且日期可解析的文件；命名不符 / 日期非法
 *   （如 2026-13-40.md）→ 一律不动（宁漏勿错）；
 * • 年龄 = 今日（UTC 日界）− 文件名日期，**≥ N 天（默认 30）即为候选**；
 * • 非候选文件**只读不碰**（连内容都不读）——当日日志正被其他会话追加，保证并发安全。
 *
 * ── 连座归档（WXG-T-106：二级详情层 `memory/details/`）─────────────────────────
 * 某天日记的**长正文已逐节外移**至 `memory/details/<日期>-<slug>.md`。归档该天而
 * 不带走它的详情件 ⇒ 详情件的 H1 隶属标记指向已不存在的日记节 = 孤儿，而 `ctx:check`
 * 对此**硬拦**⇒ 轮转器必**同进同退**：
 * • 归档件落 `memory/archive/details/<同名>`（同命中 `SKIP_DIRS`，不进索引面）；
 * • 隶属标记**故意不写目录前缀**（见 `lib/memory-index.mjs`），故逐字节保留后仍成立；
 * • 连座组内任一**归档重名** → **整组跳过**（不拆散日记与其详情件，宁漏勿错）；
 * • 孤儿详情件（对应日记本就不存在）只告警不动——归因与处置属人工。
 *
 * ── 安全边界 ─────────────────────────────────────────────────────────────────
 * • 默认 **dry-run**，`--write` 才落盘；
 * • 防重复归档：`memory/archive/` 已有同名文件 → 跳过并告警，不覆盖（宁漏勿错）；
 * • 幂等：归档后原位无文件 → 不再是候选；重跑 0 候选 → **空转不落盘**（连 archive
 *   目录、MEMORY.md 都不碰）；
 * • 归档副本回读校验失败 → fail loud exit 1，原件保留；
 * • `--write` 时 `MEMORY.md` 必须已存在（不代建——防伪造长期笔记正本）；
 * • **可选治理**：不挂 pre-commit / CI 强制执行。
 *
 * USAGE
 *   node tools/scripts/distill-memory.mjs                 # 默认 dry-run，30 天
 *   node tools/scripts/distill-memory.mjs --write         # 真实归档落盘
 *   node tools/scripts/distill-memory.mjs --days=30 --memory=<dir> --root=<path>
 *
 * 退出码：0 成功（含空转 / dry-run）；1 数据 / 参数错误（fail loud）。
 * 桩自测：tools/scripts/distill-memory-selftest.sh
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) {
  printHelp();
  process.exit(0);
}
const args = parseArgs(argv);
const DRY = !argv.includes('--write');
const DAYS = Number(args.days ?? 30);
if (!Number.isFinite(DAYS) || DAYS < 0) {
  console.error(`❌ --days 需为 ≥0 的数字（收到：${args.days ?? '（缺省）'}）`);
  process.exit(1);
}
const ROOT = normalize((args.root ?? process.cwd()).replace(/\/+$/, ''));
const MEMORY_DIR = args.memory ? resolve(ROOT, args.memory) : join(ROOT, 'memory');
const ARCHIVE_DIR = join(MEMORY_DIR, 'archive');
/** 二级详情层（WXG-T-106）：与日记连座轮转，归档后同不进 ctx 索引面。 */
const DETAILS_DIR = join(MEMORY_DIR, 'details');
const ARCHIVE_DETAILS_DIR = join(ARCHIVE_DIR, 'details');
const MEMORY_MD = join(MEMORY_DIR, 'MEMORY.md');

if (!existsSync(MEMORY_DIR) || !statSync(MEMORY_DIR).isDirectory()) {
  console.error(`❌ 未找到 memory 目录 ${rel(ROOT, MEMORY_DIR)}`);
  process.exit(1);
}

// ── 扫描日志文件：只认 YYYY-MM-DD.md 且日期可解析 ─────────────────────────────
const nameRe = /^(\d{4}-\d{2}-\d{2})\.md$/;
const todayUtc = Math.floor(Date.now() / 864e5) * 864e5; // 今日 UTC 日界，年龄按整天算
const logs = []; // { name, date, ageDays }
const skipped = []; // { name, why }
for (const entry of readdirSync(MEMORY_DIR, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const m = nameRe.exec(entry.name);
  if (!m) {
    if (entry.name !== 'MEMORY.md') skipped.push({ name: entry.name, why: '非 YYYY-MM-DD 命名' });
    continue;
  }
  const t = Date.parse(`${m[1]}T00:00:00Z`);
  if (!Number.isFinite(t)) {
    skipped.push({ name: entry.name, why: '日期非法（如月份 >12）' });
    continue;
  }
  logs.push({ name: entry.name, date: m[1], ageDays: Math.floor((todayUtc - t) / 864e5) });
}
logs.sort((a, b) => (a.name < b.name ? -1 : 1));

// ── 候选：满 N 天；归档重名防护（连座组整组同进同退）──────────────────────────────
const candidates = logs.filter((l) => l.ageDays >= DAYS);
const detailNameRe = /^(\d{4}-\d{2}-\d{2})-.+\.md$/;
const detailNames = existsSync(DETAILS_DIR)
  ? readdirSync(DETAILS_DIR).filter((n) => detailNameRe.test(n)).sort()
  : [];
// 详情件的日期＝文件名前 10 字符（与日记同一真源口径，不看 mtime）。
const detailDate = (n) => n.slice(0, 10);
const orphanDetails = detailNames.filter((n) => !logs.some((l) => l.date === detailDate(n)));
const movable = [];
for (const c of candidates) {
  const group = detailNames.filter((n) => detailDate(n) === c.date);
  const clash = [];
  if (existsSync(join(ARCHIVE_DIR, c.name))) clash.push(`memory/archive/${c.name}`);
  for (const n of group) {
    if (existsSync(join(ARCHIVE_DETAILS_DIR, n))) clash.push(`memory/archive/details/${n}`);
  }
  if (clash.length) {
    console.log(
      `  ⚠️ ${c.name} 连座组内有归档重名（${clash.join('、')}）——**整组跳过**：` +
      '日记与其详情件必同进同退，否则详情件变孤儿被 `ctx:check` 硬拦（不拆散，宁漏勿错）',
    );
    continue;
  }
  c.details = group;
  movable.push(c);
}

// ── 弱证据：MEMORY.md 最近修改时间 vs 各候选日志日期 ──────────────────────────
const memoryMtime = existsSync(MEMORY_MD) ? statSync(MEMORY_MD).mtime : null;
const fmtLocal = (d) => new Date(d).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const weakEvidence = (date) => {
  if (!memoryMtime) return '⚠️ MEMORY.md 不存在——未蒸馏（无正本可承接）';
  const mtimeDay = Math.floor(memoryMtime.getTime() / 864e5) * 864e5;
  const dateDay = Date.parse(`${date}T00:00:00Z`);
  return mtimeDay > dateDay
    ? `MEMORY.md 于 ${fmtLocal(memoryMtime)} 修改（晚于该日志）——可能已蒸馏（弱证据，请人工确认）`
    : `MEMORY.md 自该日志后未更新——大概率未蒸馏（先蒸馏再归档）`;
};

// ── 报告 ───────────────────────────────────────────────────────────────────────
console.log(`memory 日志 30 天蒸馏轮转（memory:distill，WXG-T-041 R2）${DRY ? '—— dry-run（默认；加 --write 落盘）' : '—— --write 落盘'}`);
console.log(`  memory 目录：${rel(ROOT, MEMORY_DIR)}｜归档：${rel(ROOT, ARCHIVE_DIR)}（不进 ctx 索引面，SKIP_DIRS 先例）` +
  `｜二级详情：${existsSync(DETAILS_DIR) ? `${rel(ROOT, DETAILS_DIR)}/（${detailNames.length} 件）` : '（无）'}`);
console.log(`  候选判定：文件名日期距今 ≥ ${DAYS} 天｜MEMORY.md 最后修改：${memoryMtime ? fmtLocal(memoryMtime) : '（不存在）'}`);
for (const l of logs) {
  const tag = l.ageDays >= DAYS ? (movable.includes(l) ? '→ 候选' : '⚠️ 重名跳过') : '⏸ 保留';
  const size = l.ageDays >= DAYS ? statSync(join(MEMORY_DIR, l.name)).size : null;
  console.log(
    `  ${tag}｜${l.name}｜${l.ageDays} 天` +
    `${l.details && l.details.length ? `｜连座详情 ${l.details.length} 件` : ''}` +
    `${size != null ? `｜${size} 字节（≈${Math.round(size / 3.5)} tokens）` : ''}`,
  );
  if (l.ageDays >= DAYS) console.log(`      蒸馏弱证据：${weakEvidence(l.date)}`);
}
for (const s of skipped) console.log(`  ⏭ 不动｜${s.name}｜${s.why}`);
for (const n of orphanDetails) {
  console.log(
    `  ⚠️ 孤儿详情件｜details/${n}｜对应日记 \`memory/${detailDate(n)}.md\` 不存在——本工具不代处置` +
    '（`ctx:check` 会就此硬拦；要么补回日记节，要么逐字节归位详情件）',
  );
}
if (candidates.length === 0) {
  console.log('✅ 无满 30 天的日志——无可归档。');
  console.log(DRY ? '（dry-run：未落盘）' : '（0 候选空转：archive 目录与 MEMORY.md 均不触碰，不落盘——幂等）');
  process.exit(0);
}
if (DRY) {
  const nd = movable.reduce((n, c) => n + (c.details?.length ?? 0), 0);
  console.log(
    `（dry-run：计划归档 ${movable.length} 个日记 + ${nd} 个连座详情件` +
    `（${movable.map((c) => c.name).join('、')}），并在 MEMORY.md 末尾追加待蒸馏提醒；未落盘）`,
  );
  console.log('  ⚠️ 蒸馏提醒：脚本只做机械轮转——请先把候选日志中长期有效的内容蒸馏进 MEMORY.md，再 --write 归档。');
  process.exit(0);
}
if (movable.length === 0) {
  console.log('✅ 候选均为归档重名——本次无新增，不落盘（幂等）。');
  process.exit(0);
}
if (!existsSync(MEMORY_MD)) {
  console.error(`❌ ${rel(ROOT, MEMORY_MD)} 不存在——拒绝伪造长期笔记正本，不落盘（fail loud）。`);
  process.exit(1);
}

// ── --write：移动即归档（原文逐字节保留 + 回读校验，全部通过才删原件）─────────
// 连座口径（WXG-T-106）⇒ 先全量写+全量校验，再统一删：中途失败不会把日记与
// 其详情件拆到两边（那是最坏状态：指针悬空 + 孤儿，且难手工回滚）。
mkdirSync(ARCHIVE_DIR, { recursive: true });
mkdirSync(ARCHIVE_DETAILS_DIR, { recursive: true });
const plan = [];
for (const c of movable) {
  plan.push({ label: c.name, src: join(MEMORY_DIR, c.name), dst: join(ARCHIVE_DIR, c.name) });
  for (const n of c.details ?? []) {
    plan.push({
      label: `details/${n}`,
      src: join(DETAILS_DIR, n),
      dst: join(ARCHIVE_DETAILS_DIR, n),
    });
  }
}
for (const p of plan) p.buf = readFileSync(p.src);
for (const p of plan) {
  writeFileSync(p.dst, p.buf);
  if (!p.buf.equals(readFileSync(p.dst))) {
    console.error(
      `❌ 归档副本回读校验失败：${p.label} 字节不等——**不删任何原件**（fail loud，` +
      `已写入的 ${rel(ROOT, p.dst)} 可手工删除后重跑）。`,
    );
    process.exit(1);
  }
}
for (const p of plan) {
  rmSync(p.src);
  if (existsSync(p.src)) {
    console.error(`❌ 原件删除失败（仍在原位）：${rel(ROOT, p.src)}——fail loud。`);
    process.exit(1);
  }
}
for (const p of plan) {
  console.log(`  ✅ 归档｜${p.label}（${p.buf.length} 字节，回读校验一致）→ ${rel(ROOT, p.dst)}`);
}
for (const c of movable) c.archivedPaths = [c.name, ...(c.details ?? []).map((n) => `details/${n}`)];

// ── --write：MEMORY.md 末尾追加「待蒸馏」占位提醒（蒸馏责任在人/会话）─────────
const stamp = new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' +08:00';
const reminder =
  `\n## ⏳ 归档待蒸馏提醒（memory:distill 自动追加，蒸馏完成后删除对应行）\n` +
  `- ${stamp}：${movable.flatMap((c) => c.archivedPaths).map((p) => `\`memory/archive/${p}\``).join('、')} 已由 \`pnpm run memory:distill\` 归档` +
  `（含连座的二级详情件；原文逐字节保留，git 永久可查，不进 ctx 索引面）。` +
  `**请把其中长期有效的内容蒸馏进本文件相应章节**，完成后删除本行；规程见 \`docs/agent/memory-distill.md\`。\n`;
if (!readFileSync(MEMORY_MD, 'utf8').endsWith('\n')) appendFileSync(MEMORY_MD, '\n');
appendFileSync(MEMORY_MD, reminder);
console.log(
  `✅ 归档完成：${movable.length} 个日记 + ${plan.length - movable.length} 个连座详情件` +
  `（${movable.map((c) => c.name).join('、')}）；MEMORY.md 末尾已追加「待蒸馏」占位提醒。`,
);
console.log('   提醒：memory:distill 是可选治理，不挂 pre-commit / CI；请把 memory/ 与 memory/archive/ 一并提交。');

// ─────────────────────────────────────────────────────────────────── helpers ──

function parseArgs(list) {
  const out = {};
  for (const a of list) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) continue;
    out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

function normalize(p) {
  return p.split('\\').join('/');
}
function resolve(root, p) {
  return (p.startsWith('/') ? p : join(root, p)).split('\\').join('/');
}
function rel(root, p) {
  return p.startsWith(root) ? p.slice(root.length + 1) : p;
}

function printHelp() {
  console.log(`memory 日志 30 天蒸馏轮转器（WXG-T-041 R2）

用法：
  node tools/scripts/distill-memory.mjs [选项]

选项：
  --write          真实归档落盘（缺省为 dry-run：只打印候选，不改任何文件）
  --days=<N>       年龄阈值（默认 30；按文件名 YYYY-MM-DD 判定，≥N 天为候选）
  --memory=<dir>   memory 目录（默认 <root>/memory）
  --root=<path>    仓库根（默认 process.cwd()）

口径：
  • 只动文件名严格匹配 YYYY-MM-DD.md 且日期可解析的日志；命名不符 / 日期非法 → 不动。
  • 归档 = 移动即归档：memory/archive/<同名> 逐字节保留原文（写入后回读校验，失败不删原件）。
  • 连座（WXG-T-106）：归档某天 ⇒ 该天 memory/details/<日期>-*.md 一同进 memory/archive/details/；
    组内任一重名 → 整组跳过（不拆散），先全量写+校验再统一删。
  • --write 在 MEMORY.md 末尾追加「⏳ 待蒸馏」占位提醒；**蒸馏进 MEMORY.md 的内容责任在人/会话**。
  • memory/archive/ 命中 lib/context-index.mjs SKIP_DIRS（archive）——不进 ctx 索引面，git 永久可查。
  • 防重复归档（重名跳过）、幂等（0 候选空转不落盘）、<30 天文件只读不碰（并发会话安全）。
  • 可选治理：不挂 pre-commit / CI 强制执行。`);
}
