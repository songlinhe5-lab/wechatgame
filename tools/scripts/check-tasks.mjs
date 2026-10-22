#!/usr/bin/env node
/**
 * check-tasks.mjs — 台账「标题制 + 详情分片」的机械门（WXG-T-064）。
 *
 * 背景：`production/TASKS.md` 曾 **81% 体积是任务行详情**（16 行 ≈ 5334 tok、中位行 389），
 * 而 `tasks:archive` 只清**已完成**行 ⇒ 每个新任务仍带入 400–600 tok ⇒ 反复撞 `ctx:check`
 * B 项单文件 8000。拆分后主表只留标题（≈ 2.2k tok），正文落 `production/TASKS-DETAIL.md`
 * 一任务一节；本脚本把「标题制」与「配对纪律」变成**机械强制**，不靠自觉。
 *
 * 检查（任一不过 → exit 1）：
 *   A. 主表任务行的**名称单元格 ≤ 60 字符**（标题，不是段落）
 *   B. 主表任务行**连续**（表内不得有空行打断 Markdown 表格——历史上真实发生过）
 *   C. **配对**：主表每行 ⇔ 详情文件同名小节（`## WXG-T-0NN`）
 *   D. 详情**不得**残留已归档 id 的小节（正常由 `tasks:archive` 成对搬走；`--prune` 补搬）
 *   E. 详情归档**不得**有「行归档里不存在」的 id（成对搬运脱钩检测，WXG-T-065）
 *   F. 头注号**不得落后**于主表 ∪ 归档全局最大号（防领号重号，WXG-T-070；领先合法只出 note）
 *   G. **backlog 卫生**（WXG-T-076）：结项即移除（不留删除线占位）+ 每行 ≤160 字符
 *   H. 主表行数**观察哨**（report-only，不阻断——「结构门硬、行为门软」惯例）
 *   I. **提交署号必须在册**（WXG-T-349 / K-137 追记）：最近 N 笔（默认 40，`--commits=` 可调）
 *      提交信息里出现的 `WXG-T-NNN`，逐个要求在「主表 ∪ 详情节 ∪ 行归档 ∪ 详情归档」里存在。
 *      动机（真事）：2026-10-22 三笔提交署 `WXG-T-346` 而台账当时**无此号** ⇒ A–H 全过、全量门禁十九项全绿。
 *      署号写法含连写（`WXG-T-257~260` 区间 / `WXG-T-222/268/269` 并列链）⇒ 逐段展开，否则漏半数。
 *
 * 用法：
 *   node tools/scripts/check-tasks.mjs             # 校验（verify 内调用）
 *   node tools/scripts/check-tasks.mjs --commits=200   # 放宽 I 项窗口（反事实自证 / 排障用）
 *   node tools/scripts/check-tasks.mjs --prune     # 把「已归档却仍留在详情文件」的小节**搬进**
 *                                                  # 详情归档（**搬，不是删**——删会丢任务正文）
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  DETAIL_ARCHIVE_HEADER,
  appendDetailSections,
  parseDetail,
  serializeDetail,
  takeDetailSections,
} from './lib/tasks-detail.mjs';

const ROOT = process.cwd();
const LEDGER = path.join(ROOT, 'production/TASKS.md');
const DETAIL = path.join(ROOT, 'production/TASKS-DETAIL.md');
const ARCHIVE = path.join(ROOT, 'production/archive/TASKS-archive.md');
const DETAIL_ARCHIVE = path.join(ROOT, 'production/archive/TASKS-DETAIL-archive.md');
const rel = (p) => path.relative(ROOT, p);

/** 名称单元格的字符上限（标题，不是段落）。 */
const TITLE_MAX = 60;
/** backlog 行字符上限（WXG-T-076）：只写「是什么 / 谁发现 / 下一步」，长分析开任务再写。 */
const BACKLOG_ROW_MAX = 160;
/** I 项默认回溯提交数：一~两周的开发量。窗口越大越可能括到**历史上真未登**的老号（参主表头注
 *  「用过号未自登主表清单」），那部分已不可追改 ⇒ 40 取的是「能拦住新事故」与「不因历史债长红」的折中。 */
const COMMIT_SCAN_DEFAULT = 40;

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const idNum = (id) => Number.parseInt(id.replace('WXG-T-', ''), 10);

function splitCells(line) {
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return body.split(/(?<!\\)\|/).map((c) => c.trim());
}

const failures = [];
const notes = [];

// ── 主表 ─────────────────────────────────────────────────────────────────────
const ledgerLines = read(LEDGER).split('\n');
const rows = [];
for (let i = 0; i < ledgerLines.length; i++) {
  const line = ledgerLines[i];
  if (!/^\|\s*WXG-T-\d+\s*\|/.test(line)) continue;
  const cells = splitCells(line);
  const id = cells[0];
  const title = cells[1] ?? '';
  rows.push({ id, title, line: i + 1 });
  if (cells.length !== 5) {
    failures.push(`A: ${id} 列数 ${cells.length} ≠ 5（表头为 id/名称/负责/状态/产出）`);
  }
  const plain = title.replace(/\*\*/g, '');
  if (plain.length > TITLE_MAX) {
    failures.push(
      `A: ${id} 名称 ${plain.length} 字符 > ${TITLE_MAX} —— 主表是**标题制**，正文请写进 ` +
        `production/TASKS-DETAIL.md 的 ## ${id} 小节`,
    );
  }
}

// 行连续性（表内空行会把 Markdown 表格截断）
for (let k = 1; k < rows.length; k++) {
  if (rows[k].line - rows[k - 1].line !== 1) {
    failures.push(
      `B: 主表第 ${rows[k - 1].line} 行与第 ${rows[k].line} 行之间有空洞` +
        `（表内不得有空行/夹注，会把表格截断）`,
    );
  }
}

// ── 详情 ─────────────────────────────────────────────────────────────────────
const detailParsed = parseDetail(read(DETAIL));
const detailIds = new Set(detailParsed.sections.map((s) => s.id));
const archiveText = read(ARCHIVE);
const archivedIds = new Set(
  [...archiveText.matchAll(/^\|\s*(WXG-T-\d+)\s*\|/gm)].map((m) => m[1]),
);
const detailArchiveIds = new Set(parseDetail(read(DETAIL_ARCHIVE)).sections.map((s) => s.id));

for (const { id } of rows) {
  if (!detailIds.has(id)) {
    failures.push(`C: 主表有 ${id}，但 ${rel(DETAIL)} 里没有 ## ${id} 小节`);
  }
}

const rowIds = new Set(rows.map((r) => r.id));
const staleSections = [...detailIds].filter((id) => !rowIds.has(id));
for (const id of staleSections) {
  if (archivedIds.has(id)) {
    failures.push(
      `D: ${id} 已归档，详情小节应一并搬走 —— 跑「pnpm run tasks:archive --write」` +
        `（成对搬运）；已归档行补搬用「pnpm run check:tasks -- --prune」`,
    );
  } else {
    failures.push(`C: 详情有 ## ${id} 小节，但主表无此行（孤儿详情）`);
  }
}

// E：详情归档的 id 必须在行归档里有行（否则成对搬运脱钩——两个归档各说一套）。
for (const id of detailArchiveIds) {
  if (!archivedIds.has(id)) {
    failures.push(`E: 详情归档有 ${id} 的节，但行归档无该行 —— 成对搬运脱钩，请人工核对两个归档`);
  }
}

// F：头注号**不得落后**于「主表 ∪ 归档」的全局最大号（防领号重号，WXG-T-070）。
// 动机（真事）：之前三次台账编辑用 `str.replace` 改头注，**静默没匹配上**（那三次漏了 `assert`），
// 头注停在 T-066 而表内已到 T-069 —— 唯一会告警的 `tasks:archive` 平时不跑 ⇒ 没人发现。
// 方向性：头注**领先**是合法的（某会话先推进头注、对应行还没落盘；archive 亦明写「只进不退」），
// 只有**落后**才是危险的（等于把已占用的号重新释放）。
const headerMax = (() => {
  const m = /当前已分配至 \*\*WXG-T-(\d+)\*\*/.exec(ledgerLines.join('\n'));
  return m ? Number.parseInt(m[1], 10) : null;
})();
const globalMax = Math.max(
  0,
  ...rows.map((r) => idNum(r.id)),
  ...[...archiveText.matchAll(/^\|\s*(WXG-T-\d+)\s*\|/gm)].map((m) => idNum(m[1])),
);
const pad3 = (n) => `WXG-T-${String(n).padStart(3, '0')}`;
if (headerMax === null) {
  failures.push('F: 主表头注缺「当前已分配至 **WXG-T-xxx**」句式 —— tasks:archive 无法校准');
} else if (headerMax < globalMax) {
  failures.push(
    `F: 头注号 ${pad3(headerMax)} **落后**于主表∪归档全局最大号 ${pad3(globalMax)} —— ` +
      '潜在重号：跑 `pnpm run tasks:archive`（0 行时只告警不落盘）或手工改头注',
  );
} else if (headerMax > globalMax) {
  notes.push(`F: 头注号 ${pad3(headerMax)} 领先全局最大号 ${pad3(globalMax)}（合法：头注只进不退）`);
}

// G：backlog 卫生（WXG-T-076）——「结项即移除」+ 行长上限。
// 动机（实测）：backlog 是台账里唯一没有门的段；一条**已结项**的删除线占位行曾占全文 16%（383 tok）。
const backlogStart = ledgerLines.findIndex((l) => l.startsWith('## 待排'));
if (backlogStart < 0) {
  notes.push('G: 主表无 backlog 段（## 待排）——跳过 backlog 卫生检查');
} else {
  for (let i = backlogStart + 1; i < ledgerLines.length; i += 1) {
    const line = ledgerLines[i];
    if (line.startsWith('## ')) break; // 到下一节为止
    if (!line.startsWith('| **')) continue; // 只看事项行（表头 / 分隔线不管）
    if (line.includes('~~')) {
      failures.push(
        `G: backlog 行 ${i + 1} 用删除线占位「已结项」——结项即**移除**整行，不留尸体`,
      );
    }
    const len = [...line].length;
    if (len > BACKLOG_ROW_MAX) {
      failures.push(
        `G: backlog 行 ${i + 1} ${len} 字符 > 上限 ${BACKLOG_ROW_MAX} —— ` +
          '只写「是什么 / 谁发现 / 下一步动作」，长分析开任务再写',
      );
    }
  }
}

// H（观察哨，report-only）：主表行数提醒。只 WARN 不阻断 —— 对齐本仓「结构门硬、行为门软」
// 惯例（WXG-T-026 裁定）：行数取决于开发节奏，不该成为无关提交的硬门。
const ROW_SENTINEL = 20;
if (rows.length > ROW_SENTINEL) {
  notes.push(
    `H: 主表 ${rows.length} 行 > 观察哨 ${ROW_SENTINEL} —— 该归档/收敛了：` +
      '`pnpm run tasks:archive -- --detail-until-under=7000 --write`',
  );
}

// I：提交信息署的号必须在册（主表 ∪ 详情节 ∪ 行归档 ∪ 详情归档）。K-137 及其 WXG-T-346 追记。
// 为什么要抓提交信息而不是只校台账内部：A–H 全是「台账自洽」门，而事故形态是「代码已入库、
// 台账无此行」——两边从不对撞就永远看不出来（K-137④ 手工做法的机械化）。
const commitScan = Number(/--commits=(\d+)/.exec(process.argv.join(' '))?.[1] ?? COMMIT_SCAN_DEFAULT);
const registeredIds = new Set([...rowIds, ...detailIds, ...archivedIds, ...detailArchiveIds]);
{
  let subjects = '';
  try {
    subjects = execFileSync('git', ['log', `-n${commitScan}`, '--format=%s'], {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    notes.push(`I: 跳过（git log 不可用 —— 非 git 目录或浅克隆）`);
  }
  if (subjects) {
    // 只匹配 `WXG-T-<数字>` 前缀会漏掉本仓常见的连写署号（`WXG-T-257~260` 区间、
    // `WXG-T-222/268/269` 并列链）——200 笔窗口实测因此放过 281/287 两个未登号，故逐段展开。
    // 分隔符只认 `~` `/` `、`：全史 788 笔里 en dash / 半角连字符连写零命中（实测），扩字符集会误伤「WXG-T-047 - 说明」。
    // ponytail: 上限三处——区间跨度 >10 只取两端；`~` 会把区间内未署的号一并算进 cited（当批连续任务才这么写，现册全绿）；
    // 「在册」只认四处结构面，正文/`### ` 子节里的号不算（K-137 追记）。要让宽窗口跑绿，先把头注披露清单改成每号一行的机器可读格式。
    const cited = new Set();
    for (const m of subjects.matchAll(/WXG-T-(\d+)((?:\s*[~/、]\s*\d+)*)/g)) {
      let prev = Number(m[1]);
      cited.add(pad3(prev));
      for (const t of m[2].matchAll(/([~/、])\s*(\d+)/g)) {
        const n = Number(t[2]);
        // `~` 当区间（区间跨度封顶 10 防误伤），`/` `、` 当并列
        if (t[1] === '~' && n >= prev && n - prev <= 10) for (let k = prev; k <= n; k++) cited.add(pad3(k));
        else cited.add(pad3(n));
        prev = n;
      }
    }
    const orphans = [...cited].filter((id) => !registeredIds.has(id)).sort();
    if (orphans.length > 0) {
      failures.push(
        `I: 最近 ${commitScan} 笔提交信息署了 ${orphans.join('、')}，但台账不在册（主表/详情节/两个归档四处均无）—— ` +
          '补登主表行 + `## <号>` 详情节，或把已归档的成对搬回（K-137）；' +
          '若属头注「用过号未自登主表清单」已披露的老号 ⇒ 按 K-137 只披露不代填，缩窗口到默认即不拦',
      );
    } else {
      notes.push(`I: 最近 ${commitScan} 笔提交共署 ${cited.size} 个号，全部在册`);
    }
  }
}

// ── --prune：补搬（不是删）────────────────────────────────────────────────────
// WXG-T-065 起语义变更：早先 --prune 是**删除**残留小节 ✗（会丢任务正文）。既然成对搬运
// 已有落点（详情归档），补搬就是唯一不丢信息的修复动作。
if (process.argv.includes('--prune')) {
  const stale = staleSections.filter((id) => archivedIds.has(id));
  if (stale.length === 0) {
    console.log('check:tasks --prune — 无需补搬（没有「已归档但详情仍在」的条目）');
    process.exit(0);
  }
  const { kept, taken } = takeDetailSections(detailParsed, stale);
  const base = existsSync(DETAIL_ARCHIVE)
    ? parseDetail(read(DETAIL_ARCHIVE))
    : { preamble: DETAIL_ARCHIVE_HEADER, sections: [] };
  writeFileSync(DETAIL, serializeDetail(kept), 'utf8');
  mkdirSync(path.dirname(DETAIL_ARCHIVE), { recursive: true });
  writeFileSync(DETAIL_ARCHIVE, serializeDetail(appendDetailSections(base, taken)), 'utf8');
  console.log(
    `check:tasks --prune — 已把 ${taken.length} 个残留小节**搬入** ${rel(DETAIL_ARCHIVE)}` +
      `（正文未丢）：${taken.map((s) => s.id).join('、')}`,
  );
  process.exit(0);
}

// ── 结论 ─────────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`❌ check:tasks FAILED（${failures.length}）`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `✅ check:tasks OK —— 主表 ${rows.length} 行（名称均 ≤ ${TITLE_MAX} 字符且连续）、` +
    `详情 ${detailIds.size} 节，配对完整` +
    (detailArchiveIds.size > 0 ? `；详情归档 ${detailArchiveIds.size} 节与行归档成对` : ''),
);
for (const n of notes) console.log(`  note: ${n}`);
