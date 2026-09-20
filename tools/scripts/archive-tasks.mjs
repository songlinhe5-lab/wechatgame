#!/usr/bin/env node
/**
 * archive-tasks.mjs — `production/TASKS.md` 完成行 30 天归档器（WXG-T-040，对策 R3）。
 *
 * 背景：跨 IDE 任务台账 `production/TASKS.md` 是 SSOT，完成行只增不减（2026-09-13 上下文
 * 膨胀审计：≈3800 tokens，B 项单文件 8000 上限只能拦截不能治理）。本脚本把**完成 ≥30 天**
 * 的 ✅ 行移入归档文件，主表保持精瘦。
 *
 * ── 归档路径裁决（WXG-T-040，偏离任务书原始路径 `production/TASKS-archive.md`）──────
 * 归档文件落在 **`production/archive/TASKS-archive.md`**：
 * • 归档文件是**只增不减的冷数据**——若照原名放 `production/`，会作为普通 .md 进 ctx 索引
 *   面（TASKS.md 本身是 tier:hot），无限增长迟早撞 B 项单文件 8000 硬门 → 归档动作反而红门；
 * • WXG-T-029 先例：归档目录**排除索引面**。`lib/context-index.mjs` 的 `SKIP_DIRS` 已含
 *   `archive`，置于 `production/archive/` 下**零代码改动**即被排除（不触碰 R1/R4/R5 产物）；
 * • 追溯老任务直接读文件 / git 即可，无需 ctx 路由。
 *
 * ── 完成日期判定来源（裁决）──────────────────────────────────────────────────────
 * 台账行**没有统一的「完成日期」字段**，行内文本日期只有个别行有、不可靠。本脚本用
 * **`git blame --porcelain` 的行级 committer-time**（该行最后一次被修改的提交时间）：
 * • 行最后一次被修改通常就是「✅ 完成回填」那笔（= 完成时间）；后续勘误微调只会把日期
 *   **推后** → 只会漏归档不会错归档（宁漏勿错）；
 * • 一次 git 调用取全文件行级归属，O(行数) 不逐行 spawn；
 * • 无日期证据（未提交行 / blame 无元数据）→ **不动**。
 *
 * ── 头注号校准（本任务核心验收点：防并行会话重号）────────────────────────────────
 * 头注原有纪律「领号只认表内最大号，不要只信本注」在归档后失效——老行移出主表后主表
 * 最大号会变小，只看主表必然重号。故：
 * • 每次真实归档，脚本把头注重写为「当前已分配至 **WXG-T-M**，下一可用号 **WXG-T-M+1**」，
 *   其中 **M = 主表 ∪ 归档文件 的全局最大号**（任何状态行占用号都计数）；
 * • 头注纪律文字同步改为「领号认本注，本注由 tasks:archive 校准」（旧文字残留时替换，
 *   已是新文字则不动）；
 * • 头注模式不匹配（找不到「当前已分配至…下一可用号」句式）→ fail loud 退出 1，不落盘；
 * • **0 行可归档 → 空转不落盘**（头注号若与全局最大号不符，只告警提示手工处理）。
 *
 * ── 安全边界 ─────────────────────────────────────────────────────────────────
 * • 只移「第一列 = `WXG-T-\d+` 且状态列以 ✅ 开头」的表行；🔄 / ⏸ / backlog / 注释行不动；
 *   （按 `|` 切列，行内若含裸 `|` 会切错列 → 状态判非 ✅ → 跳过，仍落在「宁漏勿错」方向）
 * • 默认 **dry-run**，`--write` 才落盘；
 * • 幂等：归档文件已有同号 → 跳过并告警，不重复入档；归档后再跑 → 0 行空转；
 * • **同号守卫**（WXG-T-078）：写盘前扫「主表 ∪ 归档」的号频次，凡出现 ≥2 次即**告警**
 *   （dry-run 与 --write 都报，独立于能否归档）；合并语义需人判 ⇒ **只警告、不自动合并**，
 *   同批内的同号行**只归档首份**、其余保留主表（防 T-032 式撞号被归档放大成重复行）；
 * • 守恒校验：主表减少的任务行数 == 归档新增的任务行数，不等则不落盘（fail loud）；
 * • **可选治理**：本命令不挂 pre-commit / CI 强制执行（TASKS.md 手工编辑路径不受影响）。
 *
 * ── 详情节的成对搬运（WXG-T-065）───────────────────────────────────────────────
 * `production/TASKS.md` 自 WXG-T-064 起为**标题制**，正文在 `production/TASKS-DETAIL.md`
 * 一任务一节。若只搬行不搬节，详情文件会**只增不减**（正是本机制要治的病）。故：
 * • 成对：搬走的行 ⊆ 搬走的节（同一批），行数 == 节数（守恒，不等不落盘）；
 * • 落点：`production/archive/TASKS-DETAIL-archive.md`（与行归档同目录、同样被 SKIP_DIRS
 *   排除索引面）；批次留痕只写在行归档那一条 `> 归档批次` 里，本文件**保持纯节结构**
 *   （利于幂等解析——见 `lib/tasks-detail.mjs`）；
 * • 宁漏勿错：主表有行但详情文件**无对应小节** → **不搬该行**并告警（搬了会丢正文），
 *   提示先跑 `pnpm run check:tasks` 补齐配对；
 * • **退化为只搬行**：详情文件不存在时（老仓库 / 桩自测的纯行台账）跳过成对逻辑并在报告里明示。
 *
 * USAGE
 *   node tools/scripts/archive-tasks.mjs                 # 默认 dry-run，30 天
 *   node tools/scripts/archive-tasks.mjs --write         # 真实归档落盘
 *   node tools/scripts/archive-tasks.mjs --until-under=6000 --write   # 体积驱动（推荐用于治理撞门）
 *   node tools/scripts/archive-tasks.mjs --days=30 --tasks=<path> --archive=<path>
 *   node tools/scripts/archive-tasks.mjs --detail=<path> --detail-archive=<path>   # 详情侧路径（WXG-T-065）
 *
 * 退出码：0 成功（含空转 / dry-run）；1 数据 / 参数错误（fail loud）。
 * 桩自测：tools/scripts/archive-tasks-selftest.sh
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { estimateTokens } from './lib/context-tokens.mjs';
import {
  DETAIL_ARCHIVE_HEADER,
  appendDetailSections,
  parseDetail,
  serializeDetail,
  takeDetailSections,
} from './lib/tasks-detail.mjs';

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
/**
 * 体积驱动阈值（WXG-T-053）：给了它就不再按年龄筛，而是「最老优先」删到台账估值低于该值。
 * 存在的理由：纯时间策略对**年轻但已满**的台账完全无效——2026-09-14 实测，台账全部行都
 * 不到 24 小时（09-12 建档），`--days=1` 一行都归不了档，而它已撞 B 项 8000 门。
 */
const UNTIL_UNDER = args['until-under'] === undefined ? null : Number(args['until-under']);
if (UNTIL_UNDER !== null && (!Number.isFinite(UNTIL_UNDER) || UNTIL_UNDER <= 0)) {
  console.error(`❌ --until-under 需为 >0 的数字（收到：${args['until-under']}）`);
  process.exit(1);
}
/**
 * 体积驱动 · **详情侧**（WXG-T-073）：给了它就不再按年龄筛，而是按**详情文件**最老优先删到低于该值。
 *
 * 存在的理由（实测两次咬人）：标题制（WXG-T-064）之后台账只剩 ~2.4k，而 B 项压力常常在
 * **详情文件**（一任务一节的正文，8k+）⇒ 拿台账阈值去压详情只能"凭感觉挑一个很低的数"✗，
 * 意图与手段不一致。本旋钮直接量详情文件。
 */
const DETAIL_UNTIL_UNDER =
  args['detail-until-under'] === undefined ? null : Number(args['detail-until-under']);
if (
  DETAIL_UNTIL_UNDER !== null &&
  (!Number.isFinite(DETAIL_UNTIL_UNDER) || DETAIL_UNTIL_UNDER <= 0)
) {
  console.error(`❌ --detail-until-under 需为 >0 的数字（收到：${args['detail-until-under']}）`);
  process.exit(1);
}
const ROOT = normalize((args.root ?? gitRoot()).replace(/\/+$/, ''));
const TASKS = args.tasks ? resolve(ROOT, args.tasks) : join(ROOT, 'production', 'TASKS.md');
const ARCHIVE = args.archive ? resolve(ROOT, args.archive) : join(ROOT, 'production', 'archive', 'TASKS-archive.md');
/** 详情侧（WXG-T-065 成对搬运）：正文文件 + 它的归档文件。 */
const DETAIL = args.detail ? resolve(ROOT, args.detail) : join(ROOT, 'production', 'TASKS-DETAIL.md');
const DETAIL_ARCHIVE = args['detail-archive']
  ? resolve(ROOT, args['detail-archive'])
  : join(ROOT, 'production', 'archive', 'TASKS-DETAIL-archive.md');

// ── 读入台账 ───────────────────────────────────────────────────────────────────
let tasksText;
try {
  tasksText = readFileSync(TASKS, 'utf8');
} catch {
  console.error(`❌ 未找到台账 ${rel(ROOT, TASKS)}`);
  process.exit(1);
}
const eol = tasksText.includes('\r\n') ? '\r\n' : '\n';
const lines = tasksText.split(eol);

// ── 行级 blame（committer-time，秒）─────────────────────────────────────────────
const blame = blameCommitterTimes(TASKS, ROOT);

// ── 识别候选行：WXG-T 表行 + 状态列 ✅ + blame 日期 ≥ N 天 ─────────────────────
const taskRowRe = /^\|\s*WXG-T-(\d+)\s*\|/;
const cutoff = Date.now() / 1000 - DAYS * 86400;
const candidates = [];
let taskRowsBefore = 0;
const allIds = [];
let idWidth = 3; // 编号零填充宽度：取主表∪归档中实际 ID 的最大位数（本台账为 3 位），下限 3。
for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  const m = taskRowRe.exec(line);
  if (!m) continue;
  taskRowsBefore += 1;
  allIds.push(Number(m[1]));
  idWidth = Math.max(idWidth, m[1].length);
  // 按列切：[空, TaskID, 名称, 负责, 状态, 产出, 空]；裸 `|` 切错列 → 状态非 ✅ → 跳过（宁漏勿错）。
  const cells = line.split('|').map((c) => c.trim());
  const status = cells[4] ?? '';
  if (!status.startsWith('✅')) continue;
  const t = blame.get(i + 1);
  if (t == null) {
    console.log(`  ⏭ 行 ${i + 1}｜WXG-T-${m[1]}｜状态 ✅ 但无日期证据（未提交 / blame 无元数据）——不动（宁漏勿错）`);
    continue;
  }
  if (t <= cutoff) {
    candidates.push({ idx: i, id: Number(m[1]), line, date: new Date(t * 1000) });
  }
}
const fmt = (d) => d.toISOString().slice(0, 10);

// ── 体积驱动候选（--until-under）：不看年龄，按号序（= 时间序）最老优先删到预算内 ──────
if (UNTIL_UNDER !== null) {
  const dated = eligibleRows();
  const sizeOf = (excluded) => estimateTokens(lines.filter((_, i) => !excluded.has(i)).join(eol));
  const startSize = estimateTokens(lines.join(eol));
  const excluded = new Set();
  for (const c of dated) {
    if (sizeOf(excluded) < UNTIL_UNDER) break;
    excluded.add(c.idx);
  }
  candidates.length = 0;
  candidates.push(...dated.filter((c) => excluded.has(c.idx)));
  console.log(
    `  📉 体积驱动（--until-under=${UNTIL_UNDER}）：台账 ${startSize} tokens，` +
    `计划归档 ${candidates.length} 行 → 预计 ${sizeOf(excluded)} tokens` +
    (sizeOf(excluded) >= UNTIL_UNDER ? '（⚠️ 全部可归档行移出后仍超阈值）' : ''),
  );
}

// ── 归档文件去重集（按表行 Task ID；批次标记行不计）────────────────────────────
const archivedRowRe = /^\|\s*WXG-T-(\d+)\s*\|/;
const existingArchiveIds = new Set();
if (existsSync(ARCHIVE)) {
  for (const line of readFileSync(ARCHIVE, 'utf8').split('\n')) {
    const m = archivedRowRe.exec(line);
    if (m) existingArchiveIds.add(Number(m[1]));
  }
}
let toArchive = candidates.filter((c) => {
  if (existingArchiveIds.has(c.id)) {
    console.log(`  ⚠️ WXG-T-${c.id} 已存在于归档——跳过（不重复入档，宁漏勿错；请人工核查为何主表仍有该行）`);
    return false;
  }
  return true;
});

// ── 全局最大号（主表全部表行 ∪ 归档全部表行，任何状态都占号）──────────────────
const archiveText = existsSync(ARCHIVE) ? readFileSync(ARCHIVE, 'utf8') : '';
let globalMax = 0;
for (const id of allIds) globalMax = Math.max(globalMax, id);
for (const m of archiveText.matchAll(/WXG-T-(\d+)/g)) {
  globalMax = Math.max(globalMax, Number(m[1]));
  idWidth = Math.max(idWidth, m[1].length);
}
const fmtId = (n) => String(n).padStart(idWidth, '0');

// ── 同号守卫（WXG-T-078，backlog「归档器缺同号守卫」）───────────────────────────
// 此前只防「候选已在归档」（跨批次去重），**不防主表内部同号** ⇒ T-032 那种两会话
// 撞用的重号，其两行会被当独立候选各自搬进归档 → 制造重复。本守卫在报告 / 早退
// **之前**扫描「主表 ∪ 归档」的号频次，凡 ≥2 次即**告警**（dry-run 与 --write 都报）；
// 合并语义需人判 ⇒ **只警告、不自动合并**（批次内同号只搬首份见下方二次过滤）。
const idLoc = new Map(); // id -> 出现位置（'主表' / '归档'）
const pushLoc = (id, where) => {
  const arr = idLoc.get(id) ?? [];
  arr.push(where);
  idLoc.set(id, arr);
};
for (const id of allIds) pushLoc(id, '主表');
for (const line of archiveText.split('\n')) {
  const m = archivedRowRe.exec(line);
  if (m) pushLoc(Number(m[1]), '归档');
}
const dupIds = [...idLoc.entries()]
  .filter(([, locs]) => locs.length >= 2)
  .sort((a, b) => a[0] - b[0]);
if (dupIds.length > 0) {
  console.log('⚠️ 同号守卫（tasks:archive **不自动合并**，合并语义需人工判定）：');
  for (const [id, locs] of dupIds) {
    console.log(
      `   ⚠️ WXG-T-${fmtId(id)} 出现 ${locs.length} 次（${locs.join(' + ')}）` +
      '——请人工核查是否撞号：同号行需**重新领号**，本工具仅告警并只归档首份。',
    );
  }
}

// ── 详情节：成对搬运的另一半（WXG-T-065）──────────────────────────────────────
// 只用**已格式化**的 id（`WXG-T-048` 而非 `WXG-T-48`）比对——节标题是三位零填充。
const detailExists = existsSync(DETAIL);
let detailParsed = null;
const detailIds = new Set();
if (detailExists) {
  detailParsed = parseDetail(readFileSync(DETAIL, 'utf8'));
  for (const s of detailParsed.sections) detailIds.add(s.id);
}
const detailArchiveParsed = existsSync(DETAIL_ARCHIVE)
  ? parseDetail(readFileSync(DETAIL_ARCHIVE, 'utf8'))
  : null;
const archivedDetailIds = new Set((detailArchiveParsed?.sections ?? []).map((s) => s.id));
if (detailExists) {
  // ── 详情驱动候选（--detail-until-under）：不看年龄，按号序最老优先删到**详情**低于预算 ──
  //
  // ⚠️ 位置要求（WXG-T-073 的第二次教训）：必须在 `toArchive` **派生之前**重算候选，
  // 否则改了 `candidates` 而 `toArchive` 早已定型 ⇒ 报告列了候选、计划却是 0 行（静默空转）。
  if (DETAIL_UNTIL_UNDER !== null) {
    const detailBaseline = estimateTokens(readFileSync(DETAIL, 'utf8'));
    const scored = eligibleRows().map((c) => ({
      ...c,
      detailTokens: estimateTokens(
        detailParsed.sections.find((s) => s.id === `WXG-T-${fmtId(c.id)}`)?.block ?? '',
      ),
    }));
    const drop = [];
    let shed = 0;
    for (const c of scored) {
      if (detailBaseline - shed < DETAIL_UNTIL_UNDER) break;
      drop.push(c);
      shed += c.detailTokens;
    }
    candidates.length = 0;
    candidates.push(...drop);
    console.log(
      `  📉 详情驱动（--detail-until-under=${DETAIL_UNTIL_UNDER}）：详情 ${detailBaseline} tokens，` +
      `计划归档 ${drop.length} 行 ⇒ 预计 ${detailBaseline - shed} tokens` +
      (detailBaseline - shed >= DETAIL_UNTIL_UNDER ? '（⚠️ 全部可归档行移出后仍超阈值）' : ''),
    );
    // 复用「已在归档则跳过」的守卫（与上方同名分支同语义：保守、不重复入档）。
    toArchive = drop.filter((c) => {
      if (existingArchiveIds.has(c.id)) {
        console.log(`  ⚠️ WXG-T-${c.id} 已存在于归档——跳过（不重复入档，宁漏勿错）`);
        return false;
      }
      return true;
    });
  }

  toArchive = toArchive.filter((c) => {
    const id = `WXG-T-${fmtId(c.id)}`;
    if (archivedDetailIds.has(id)) {
      console.log(`  ⚠️ ${id} 详情节已在归档——跳过（不重复搬运，宁漏勿错）`);
      return false;
    }
    if (!detailIds.has(id)) {
      console.log(
        `  ⚠️ 行 ${c.idx + 1}｜${id}｜主表有行但 ${rel(ROOT, DETAIL)} 无小节——**跳过**` +
        '（搬行会丢正文，宁漏勿错；先跑 `pnpm run check:tasks` 查配对）',
      );
      return false;
    }
    return true;
  });
} else {
  console.log(`  ℹ️ 未找到 ${rel(ROOT, DETAIL)}——本次**只搬行**（不成对；老仓库 / 纯行台账场景）`);
}

// ── 同号守卫·批次内（WXG-T-078）：同号只搬首份，其余留主表交人工合并 ──────────────
// 与「已在归档则跳过」同源（宁漏勿错、不重复入档）；此处补的是**同一批内**同号：
// 主表若有多行同号且均合格，只归档首份，其余行**保留主表**（不自动合并），下方守恒随之成立。
{
  const seenBatch = new Set();
  toArchive = toArchive.filter((c) => {
    const id = fmtId(c.id);
    if (seenBatch.has(c.id)) {
      console.log(
        `  ⚠️ WXG-T-${id} 本批内同号重复行——只归档首份，此行**保留主表**（不自动合并同号，见同号守卫）`,
      );
      return false;
    }
    seenBatch.add(c.id);
    return true;
  });
}

// ── 头注只进不退（台账纪律：单号递增不回收）──────────────────────────────────
// 现有头注若**领先**于主表∪归档（典型场景：某会话先推进头注、对应行还没落盘，或行尚未
// 提交被 blame 视为无证据），一律沿用头注值，**绝不回退**——回退会让已被占用的号再次
// 可领。2026-09-14 实测过一次该形态：头注 T-051 而表内最大 T-050（我把计数器推了但没
// 加行），此时若按表校准就会把号退回 T-050/T-051，直接制造重号。
const headerLeadIdx = lines.findIndex(
  (l) => l.includes('当前已分配至') && l.includes('下一可用号'),
);
const headerLeadMax =
  headerLeadIdx >= 0
    ? Number(/当前已分配至 \*\*WXG-T-(\d+)\*\*/.exec(lines[headerLeadIdx])?.[1] ?? NaN)
    : NaN;
const tableMax = globalMax;
let headerLed = false;
if (Number.isFinite(headerLeadMax) && headerLeadMax > globalMax) {
  globalMax = headerLeadMax;
  headerLed = true;
}

// ── 报告 ───────────────────────────────────────────────────────────────────────
console.log(`TASKS 完成行 30 天归档（tasks:archive，WXG-T-040 R3）${DRY ? '—— dry-run（默认；加 --write 落盘）' : '—— --write 落盘'}`);
console.log(
  `  台账：${rel(ROOT, TASKS)}（任务行 ${taskRowsBefore}）｜归档：${rel(ROOT, ARCHIVE)}（${existingArchiveIds.size} 行）` +
  (detailExists
    ? `｜详情：${rel(ROOT, DETAIL)}（${detailIds.size} 节 → 成对搬运）`
    : '｜详情：未找到（只搬行）'),
);
const ruleText =
  UNTIL_UNDER !== null
    ? `完成判定：**体积驱动**（--until-under=${UNTIL_UNDER}，**忽略年龄**）`
    : `完成判定：git blame committer-time ≤ ${fmt(new Date(cutoff * 1000))}（${DAYS} 天前）`;
console.log(
  `  ${ruleText}｜全局最大号（主表∪归档）：WXG-T-${fmtId(globalMax)}` +
  (headerLed ? `（表内最大 T-${fmtId(tableMax)}，**头注领先故沿用头注**）` : ''),
);
for (const c of candidates) {
  console.log(`  ${existingArchiveIds.has(c.id) ? '⚠️ 已在归档' : '→ 归档'}｜行 ${c.idx + 1}｜WXG-T-${c.id}｜最后修改 ${fmt(c.date)}｜${c.line.slice(0, 60)}…`);
}
if (candidates.length === 0) {
  console.log('✅ 无满足 30 天条件的 ✅ 完成行——无可归档。');
  const headerLine = lines.find((l) => l.includes('当前已分配至') && l.includes('下一可用号'));
  const headerMax = headerLine ? Number(/当前已分配至 \*\*WXG-T-(\d+)\*\*/.exec(headerLine)?.[1] ?? NaN) : NaN;
  if (headerMax !== globalMax) {
    console.log(`⚠️ 头注号（${Number.isNaN(headerMax) ? '缺失/不可解析' : `WXG-T-${fmtId(headerMax)}`}）与全局最大号（WXG-T-${fmtId(globalMax)}）不符——本次 0 行空转未落盘，请手工核对头注或排查重号。`);
  } else {
    console.log('   头注号与全局最大号一致——空转，不落盘（幂等）。');
  }
  process.exit(0);
}
if (DRY) {
  console.log(
    `（dry-run：计划归档 ${toArchive.length} 行` +
    (detailExists ? ` + 详情节 ${toArchive.length} 节` : '（无详情文件，只搬行）') +
    `、头注校准为 当前已分配至 WXG-T-${fmtId(globalMax)} / 下一可用号 WXG-T-${fmtId(globalMax + 1)}；未落盘）`,
  );
  process.exit(0);
}
if (toArchive.length === 0) {
  // 候选全被跳过（已在归档 / 详情文件缺对应小节）：无新增 → 不写任何文件
  // （含头注也不动，保持「0 行不落盘」语义）。
  console.log('✅ 候选行均被跳过（已存在于归档 / 详情缺小节）——本次无新增，不落盘（幂等）。');
  process.exit(0);
}

// ── --write：头注解析（fail loud）──────────────────────────────────────────────
const headerIdx = lines.findIndex((l) => l.includes('当前已分配至') && l.includes('下一可用号'));
// ⚠️ 括注内含中文逗号（如「（120 未启用，跳空合规）」）时 [^，]* 会提前断裂
// （WXG-T-144 实测）⇒ 放宽为非贪婪任意匹配，锚定「，下一可用号」结尾。
if (headerIdx < 0 || !/当前已分配至 \*\*WXG-T-\d+\*\*.*，下一可用号 \*\*WXG-T-\d+\*\*/.test(lines[headerIdx])) {
  console.error('❌ 头注缺少「当前已分配至 **WXG-T-xxx**…，下一可用号 **WXG-T-xxx**」句式——无法校准，不落盘（fail loud）。');
  process.exit(1);
}
const calibratedHeader = lines[headerIdx].replace(
  /当前已分配至 \*\*WXG-T-\d+\*\*[^，]*，下一可用号 \*\*WXG-T-\d+\*\*/,
  `当前已分配至 **WXG-T-${fmtId(globalMax)}**，下一可用号 **WXG-T-${fmtId(globalMax + 1)}**`,
);
// 勘误行：旧纪律文字（「不要只信本注」）残留 → 替换；已是新文字 → 不动。
const erratumOldRe = /不要只信本注/;
const erratumNew =
  '> 勘误（2026-09-13，WXG-T-040 落地后更新）：归档会把老行移出主表——**领号认本注**（下一可用号），' +
  `本注由 \`pnpm run tasks:archive\` 校准为「主表 ∪ 归档全局最大号 + 1」（现全局最大号 WXG-T-${fmtId(globalMax)}）；` +
  '手工领号后请顺手核对本注（可运行 `pnpm run tasks:archive` 校准，0 行时也不落盘）。';
let erratumIdx = lines.findIndex((l) => erratumOldRe.test(l));

// ── --write：构造新台账 + 归档增量（内存中完成，全部校验通过才写盘）────────────
const keepLines = [];
const movedRows = [];
for (let i = 0; i < lines.length; i += 1) {
  if (toArchive.some((c) => c.idx === i)) {
    movedRows.push(lines[i]);
    continue;
  }
  // 单次遍历逐行映射：候选行移出，头注/勘误行替换，其余逐字节保留
  // （用原始下标判断，规避「移行后下标漂移」——勘误行在候选行之后时 splice 偏移会切错位）。
  let line = lines[i];
  if (i === headerIdx) line = calibratedHeader;
  else if (i === erratumIdx) line = erratumNew;
  keepLines.push(line);
}
// 守恒校验（写盘前）
const taskRowsAfter = keepLines.filter((l) => taskRowRe.test(l)).length;
if (taskRowsBefore - taskRowsAfter !== movedRows.length || movedRows.length !== toArchive.length) {
  console.error(`❌ 行数守恒校验失败：主表 ${taskRowsBefore} → ${taskRowsAfter}（减 ${taskRowsBefore - taskRowsAfter}）≠ 归档新增 ${movedRows.length}——不落盘（fail loud）。`);
  process.exit(1);
}
// ── 详情节成对搬运（WXG-T-065）：行搬走则节同批搬走，节数必须等于行数 ──────────
let detailKeptOut = null;
let detailArchiveOut = null;
let takenSections = [];
if (detailExists) {
  const movedIds = toArchive.map((c) => `WXG-T-${fmtId(c.id)}`);
  const { kept, taken } = takeDetailSections(detailParsed, movedIds);
  takenSections = taken;
  if (taken.length !== movedRows.length) {
    console.error(
      `❌ 详情节守恒校验失败：搬走的行 ${movedRows.length} ≠ 搬走的节 ${taken.length}——不落盘` +
      '（fail loud）。**台账与归档文件均未被修改**。',
    );
    process.exit(1);
  }
  detailKeptOut = serializeDetail(kept);
  const base = detailArchiveParsed ?? { preamble: DETAIL_ARCHIVE_HEADER, sections: [] };
  detailArchiveOut = serializeDetail(appendDetailSections(base, taken));
}
// 归档文件：不存在则带头创建；存在则追加批次。
const batchStamp = new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' +08:00';
const batchIds = toArchive.map((c) => `WXG-T-${fmtId(c.id)}`).join('、');
const batchLine = `> 归档批次 ${batchStamp} — ${movedRows.length} 行（${batchIds}）｜判定：git blame committer-time ≥ ${DAYS} 天` +
  (detailExists ? `｜详情节同批搬入 ${rel(ROOT, DETAIL_ARCHIVE)}` : '｜（无详情文件，只搬行）');
let archiveOut = archiveText;
if (!archiveText) {
  archiveOut =
    '# WXG 任务台账归档（tasks:archive 维护，勿手工领号）\n' +
    '\n' +
    '> 由 `pnpm run tasks:archive`（tools/scripts/archive-tasks.mjs）从 `production/TASKS.md` 移入：完成 ≥30 天的 ✅ 行，保留原行全部内容。\n' +
    '> 本文件**不进 ctx 索引面**（`production/archive/` 命中 `lib/context-index.mjs` SKIP_DIRS，WXG-T-029 先例）。\n' +
    `> ⚠️ 全局最大号**含本文件**——领号认 \`production/TASKS.md\` 头注（由 tasks:archive 校准为全局最大号 + 1）。\n` +
    '\n' +
    '| Task ID | 名称 | 负责 | 状态 | 产出 |\n' +
    '|---|---|---|---|---|\n';
}
archiveOut = `${archiveOut.replace(/\n*$/, '\n')}${batchLine}\n${movedRows.join('\n')}\n`;

// ── 落盘（台账原文除候选行与头注两行外逐字节保留）────────────────────────────
mkdirSync(dirname(ARCHIVE), { recursive: true });
writeFileSync(TASKS, keepLines.join(eol), 'utf8');
writeFileSync(ARCHIVE, archiveOut, 'utf8');
if (detailKeptOut !== null) {
  mkdirSync(dirname(DETAIL_ARCHIVE), { recursive: true });
  writeFileSync(DETAIL, detailKeptOut, 'utf8');
  writeFileSync(DETAIL_ARCHIVE, detailArchiveOut, 'utf8');
}
console.log(`✅ 归档完成：主表任务行 ${taskRowsBefore} → ${taskRowsAfter}（减 ${movedRows.length}，守恒校验通过）；归档 → ${rel(ROOT, ARCHIVE)}（现 ${existingArchiveIds.size + movedRows.length} 行）`);
if (detailKeptOut !== null) {
  console.log(
    `   详情节成对搬运：${takenSections.length} 节 → ${rel(ROOT, DETAIL_ARCHIVE)}` +
    `（现 ${archivedDetailIds.size + takenSections.length} 节）｜${rel(ROOT, DETAIL)} 剩 ${detailIds.size - takenSections.length} 节`,
  );
}
console.log(`   头注已校准：当前已分配至 **WXG-T-${fmtId(globalMax)}**，下一可用号 **WXG-T-${fmtId(globalMax + 1)}**（全局最大号含归档文件）${erratumIdx >= 0 ? '；勘误行已改为「领号认本注」纪律' : '（勘误行已为新纪律，未改动）'}`);
console.log('   提醒：tasks:archive 是可选治理，不挂 pre-commit / CI；请把台账与归档文件一并提交。');

// ─────────────────────────────────────────────────────────────────── helpers ──

/**
 * 「可归档行」的唯一口径：表行 + 状态列以 ✅ 开头 + **有日期证据**（blame 命中），按文件序。
 *
 * 为什么抽成一处（WXG-T-073 的初版教训）：三种体积 / 年龄策略各自内联这段筛选时，
 * 我把 `--detail-until-under` 接到了**已被年龄筛过**的 `candidates` 上 ⇒ 默认口径下它是空的，
 * 新旋钮**静默什么都不搬** ✗。口径一处定义，策略只负责"选多少"。
 */
function eligibleRows() {
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = taskRowRe.exec(lines[i]);
    if (!m) continue;
    const cells = lines[i].split('|').map((c) => c.trim());
    if (!(cells[4] ?? '').startsWith('✅')) continue;
    const t = blame.get(i + 1);
    if (t == null) continue; // 无日期证据 → 不当作候选（宁漏勿错）
    out.push({ idx: i, id: Number(m[1]), line: lines[i], date: new Date(t * 1000) });
  }
  return out;
}

/** 一次 git blame --porcelain 取全文件行级 committer-time（秒）；无证据行 → null。
 *  ⚠️ porcelain 是**分组**语义：组头 `hash 起始行 行号 行数` 只出现一次（带元数据），
 *  组内后续行只以 `\t` 内容行输出——必须按组展开到每一行，否则只有组首行有日期。 */
function blameCommitterTimes(file, root) {
  const map = new Map();
  const r = spawnSync('git', ['blame', '--porcelain', '-w', '--', file], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout) {
    console.log('  ⚠️ git blame 不可用（非 git 仓库？）——全部行视为无日期证据，不动（宁漏勿错）');
    return map;
  }
  let group = null; // { hash, nextLine, remaining, time, zero }
  const timeByHash = new Map(); // porcelain 的元数据按 commit 只打印一次（首个组头），
  // 后续同 commit 行只有短记录 `hash 行 行号`（不带 committer-time）——须按 hash 缓存时间。
  for (const line of r.stdout.split('\n')) {
    if (line.startsWith('\t')) {
      // 内容行：把当前组的判定结果记到该行，然后组内行号前移。
      if (group && group.remaining > 0) {
        map.set(group.nextLine, group.zero ? null : group.time);
        group.nextLine += 1;
        group.remaining -= 1;
      }
      continue;
    }
    // 组头/续行：`hash 起始行 行号 [行数]`（续行无「行数」，按 1 处理）。
    const m = /^([0-9a-f]{40})\s+\d+\s+(\d+)(?:\s+(\d+))?$/.exec(line);
    if (m) {
      const hash = m[1];
      group = {
        hash,
        nextLine: Number(m[2]),
        remaining: m[3] == null ? 1 : Number(m[3]),
        time: timeByHash.get(hash) ?? null,
        zero: hash.startsWith('0000'),
      };
      continue;
    }
    if (group && !group.zero && line.startsWith('committer-time ')) {
      group.time = Number(line.slice('committer-time '.length));
      timeByHash.set(group.hash, group.time);
    }
  }
  return map;
}

function gitRoot() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : process.cwd();
}

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
  console.log(`TASKS 完成行 30 天归档器（WXG-T-040 R3）

用法：
  node tools/scripts/archive-tasks.mjs [选项]

选项：
  --write          真实归档落盘（缺省为 dry-run：只打印计划，不改任何文件）
  --days=<N>       完成天数阈值（默认 30；按 git blame committer-time 判定）
  --detail-until-under=<N>
                    体积驱动 · **详情侧**：忽略 --days，按号序「最老优先」归档 ✅ 行（连同其详情
                    小节成对搬走），直到 production/TASKS-DETAIL.md 估值 < N tokens。
                    用于「台账已经很瘦、但详情文件撞 B 项 8000」的治理场景（WXG-T-073）。
  --until-under=<N>  体积驱动：忽略 --days，按号序「最老优先」归档 ✅ 行，
                     直到台账估值 < N tokens（估算口径 = lib/context-tokens.mjs，
                     与 ctx:check B 项**同一个函数**，避免两套计数漂移）。
                     用于「台账已撞 B 项但行都还年轻」的治理场景。
  --tasks=<path>   台账（默认 production/TASKS.md）
  --archive=<path> 归档文件（默认 production/archive/TASKS-archive.md）
  --detail=<path>          详情文件（默认 production/TASKS-DETAIL.md）
  --detail-archive=<path>  详情归档（默认 production/archive/TASKS-DETAIL-archive.md）
  --root=<path>    仓库根（默认 git rev-parse --show-toplevel）

口径：
  • 只移「第一列 WXG-T-\\d+ 且状态列以 ✅ 开头」的表行；🔄 / ⏸ / backlog / 注释行不动。
  • 完成日期 = 行级 git blame committer-time（该行最后修改的提交时间）；无日期证据 → 不动（宁漏勿错）。
  • 真实归档时校准头注：当前已分配至 / 下一可用号 = 主表 ∪ 归档全局最大号（+1），
    勘误行改为「领号认本注，本注由 tasks:archive 校准」——防并行会话只看主表重号。
  • **成对搬运（WXG-T-065）**：主表行 → TASKS-archive.md，其详情小节 → TASKS-DETAIL-archive.md，
    同一批、节数 == 行数（不等不落盘）；主表有行但详情无小节 → 跳过该行（搬了会丢正文）。
    详情文件不存在 → 退化为「只搬行」并明示。
  • 幂等：归档已有同号跳过；0 行可归档 → 空转不落盘；行数/节数守恒校验失败 → fail loud 不落盘。
  • **同号守卫（WXG-T-078）**：写盘前扫「主表 ∪ 归档」号频次，≥2 次即告警；只警告、
    不自动合并（合并需人判）——同批内同号只归档首份，其余行保留主表，请重新领号。
  • 可选治理：不挂 pre-commit / CI 强制执行。`);
}
