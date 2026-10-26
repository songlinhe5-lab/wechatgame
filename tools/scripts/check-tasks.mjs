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
 *      （标题须**裸写**；写成 `## WXG-T-0NN · 副标题` 会被 `parseDetail` 漏认，门会给出定位提示 —— WXG-T-381）
 *   D. 详情**不得**残留已归档 id 的小节（正常由 `tasks:archive` 成对搬走；`--prune` 补搬）
 *   E. 详情归档**不得**有「行归档里不存在」的 id（成对搬运脱钩检测，WXG-T-065）
 *   F. 头注号**不得落后**于主表 ∪ 归档全局最大号（防领号重号，WXG-T-070；领先合法只出 note）
 *   G. **backlog 卫生**（WXG-T-076）：结项即移除（不留删除线占位）+ 每行 ≤160 字符
 *   H. 主表行数**观察哨**（report-only，不阻断——「结构门硬、行为门软」惯例）
 *   I. **提交署号必须在册**（WXG-T-349 / K-137 追记）：最近 N 笔（默认 40，`--commits=` 可调）
 *      提交信息里出现的 `WXG-T-NNN`，逐个要求在「主表 ∪ BACKLOG ∪ 详情节 ∪ 行归档 ∪ 详情归档」里存在。
 *      动机（真事）：2026-10-22 三笔提交署 `WXG-T-346` 而台账当时**无此号** ⇒ A–H 全过、全量门禁十九项全绿。
 *      署号写法含连写（`WXG-T-257~260` 区间 / `WXG-T-222/268/269` 并列链）⇒ 逐段展开，否则漏半数。
 *      ⚠ `--staged` 下**降级为 note**（WXG-T-407）：本项校的是仓库级欠账（提交史 vs 台账），不是「本笔
 *      索引自洽」；共享工作树里对方「代码已入库、台账行还在工作树」时索引面必缺该号 ⇒ 拦住无关本单。
 *      硬拦不丢：不带 `--staged`（= `verify` 口径）仍是 failure。
 *   J. **BACKLOG 行格式**（WXG-T-407）：未排期提案表的行也得 5 列（与主表同构）。
 *
 * 用法：
 *   node tools/scripts/check-tasks.mjs             # 校验（verify 内调用，读**工作树**）
 *   node tools/scripts/check-tasks.mjs --staged     # 读**索引**（= 即将入库的内容）——pre-commit 专用（WXG-T-399）
 *       理由：共享工作树下 `git commit` 提交的是索引，工作树里常捏着并发会话的 WIP；
 *       读工作树会因对方未提交改动误拦本单，读索引才能接住「台账被扫走一侧」的撕裂态。
 *       ⚠ 与 `--prune` 互斥（写盘动作不能跑在索引面）；I 项在本模式只披露不拦（见上）。
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
// BACKLOG（未排期提案表，WXG-T-407 拆出）：**占号、但不要求配详情节**。
// 拆表动机：归档器只搬 ✅ 行，而提案/留档类行（📝📋📌📄🧪🔵⚠⏸）永远不为 ✅ ⇒ 堆在主表里
// 使「行数观察哨 20」成为不可达目标。行搬过来后其详情节仍留在 TASKS-DETAIL.md，所以 BACKLOG
// 必须入「行侧集合」，否则那些节全被误判为孤儿详情。
const BACKLOG = path.join(ROOT, 'production/BACKLOG.md');
const rel = (p) => path.relative(ROOT, p);

/** 名称单元格的字符上限（标题，不是段落）。 */
const TITLE_MAX = 60;
/** backlog 行字符上限（WXG-T-076）：只写「是什么 / 谁发现 / 下一步」，长分析开任务再写。 */
const BACKLOG_ROW_MAX = 160;
/** I 项默认回溯提交数：一~两周的开发量。窗口越大越可能括到**历史上真未登**的老号（参主表头注
 *  「用过号未自登主表清单」），那部分已不可追改 ⇒ 40 取的是「能拦住新事故」与「不因历史债长红」的折中。 */
const COMMIT_SCAN_DEFAULT = 40;

/**
 * 从一段提交信息文本里展开全部署号（`WXG-T-<数字>`，含 `~` 区间与 `/` `、` 并列）。
 * 单源（判例 K-073 / K-089）：I 项（扫提交窗口）与 K 项（只校本笔消息）共用，⛔ 两处各写一份正则。
 *
 * 只匹配 `WXG-T-<数字>` 前缀会漏掉本仓常见的连写署号（`WXG-T-257~260` 区间、
 * `WXG-T-222/268/269` 并列链）——200 笔窗口实测因此放过 281/287 两个未登号，故逐段展开。
 * 分隔符只认 `~` `/` `、`：全史 788 笔里 en dash / 半角连字符连写零命中（实测），
 * 扩字符集会误伤「WXG-T-047 - 说明」。
 * ponytail: 上限三处——区间跨度 >10 只取两端；`~` 会把区间内未署的号一并算进 cited（当批连续任务才这么写，现册全绿）；
 * 「在册」只认四处结构面，正文/`### ` 子节里的号不算（K-137 追记）。要让宽窗口跑绿，先把头注披露清单改成每号一行的机器可读格式。
 */
function citeIdsFrom(text) {
  const cited = new Set();
  for (const m of text.matchAll(/WXG-T-(\d+)((?:\s*[~/、]\s*\d+)*)/g)) {
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
  return cited;
}

// `--commit-msg=<file>`（WXG-T-409）与 `--staged` 同一权威面：读的也是**索引**（= 本笔即将提交的内容）。
const STAGED_MODE = process.argv.includes('--staged') || process.argv.some((a) => a.startsWith('--commit-msg='));
const readIndex = (p) => {
  // 索引里没有该路径（未跟踪 / 已删）与「文件不存在」同义，统一给空串；
  // ⚙ stderr 必须屏蔽：`git show :<不存在的路径>` 会把「致命错误：…」打到终端，
  //    而这不是本门的诊断（实测于临时仓库：四个台账路径缺两个归档时输出被污染）。
  try {
    return execFileSync('git', ['show', `:${path.relative(ROOT, p)}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
};
const read = (p) =>
  STAGED_MODE ? readIndex(p) : existsSync(p) ? readFileSync(p, 'utf8') : '';
const idNum = (id) => Number.parseInt(id.replace('WXG-T-', ''), 10);

function splitCells(line) {
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return body.split(/(?<!\\)\|/).map((c) => c.trim());
}

/**
 * 「列数不对」的定位提示（WXG-T-381，实测踩坑）：只报「列数 4 ≠ 5」无法定位，现场得逐字符数。
 * 两种成因方向相反，故分别点名：
 *   · 全角竖线 `｜`（中文输入法）= **不是**分隔符 ⇒ 两格并一格（列数变**少**）；
 *   · 行内未转义的半角 `|`（常见于抄命令 / 管道） = 多切一刀（列数变**多**）。
 */
function cellCountHint(line, len) {
  if (len > 5) {
    return ' ——行内**未转义的半角 `|`** 被当成分隔符（常见于行内抄命令 / 管道）；转义为 `\\|` 或改写成文字';
  }
  if (/｜/.test(line)) {
    return ' ——行内有**全角竖线「｜」**：它不是分隔符，会把两格并成一格；请改半角 `|`';
  }
  return '';
}

/**
 * 详情节标题「形似而不被识别」的提示（WXG-T-381）：`parseDetail` 只认裸 `## WXG-T-0NN`，
 * 写成 `## WXG-T-380 · 副标题` 会被漏认 ⇒ 门报「没有小节」与实际（明明在）相反，最易误诊。
 * @returns {string} 空串 = 没找到形似标题
 */
function strayHeadingHint(detailText, id) {
  const re = new RegExp(`^##\\s+${id}(?!\\d)(?=\\s*\\S)(.*)$`);
  const lines = String(detailText).split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const m = re.exec(lines[i]);
    if (m) {
      return ` ——但第 ${i + 1} 行是 \`## ${id}${m[1].trim() ? ' ' + m[1].trim() : ''}\`：` +
        `标题必须**裸写** \`## ${id}\`（解析器只认这一种形状），副标题请另起一行加粗`;
    }
  }
  return '';
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
    failures.push(`A: ${id} 列数 ${cells.length} ≠ 5（表头为 id/名称/负责/状态/产出）${cellCountHint(line, cells.length)}`);
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
const detailText = read(DETAIL);
const detailParsed = parseDetail(detailText);
const detailIds = new Set(detailParsed.sections.map((s) => s.id));
const archiveText = read(ARCHIVE);
const archivedIds = new Set(
  [...archiveText.matchAll(/^\|\s*(WXG-T-\d+)\s*\|/gm)].map((m) => m[1]),
);
const detailArchiveIds = new Set(parseDetail(read(DETAIL_ARCHIVE)).sections.map((s) => s.id));

for (const { id } of rows) {
  if (!detailIds.has(id)) {
    failures.push(
      `C: 主表有 ${id}，但 ${rel(DETAIL)} 里没有 ## ${id} 小节${strayHeadingHint(detailText, id)}`,
    );
  }
}

const rowIds = new Set(rows.map((r) => r.id));
const backlogText = read(BACKLOG);
const backlogIds = new Set(
  [...backlogText.matchAll(/^\|\s*(WXG-T-\d+)\s*\|/gm)].map((m) => m[1]),
);
for (const line of backlogText.split('\n')) {
  if (!/^\|\s*WXG-T-\d+\s*\|/.test(line)) continue;
  const cells = splitCells(line);
  if (cells.length !== 5) failures.push(`J: BACKLOG 行 ${cells[0]} 列数 ${cells.length} ≠ 5（同主表格式）`);
}
const staleSections = [...detailIds].filter((id) => !rowIds.has(id) && !backlogIds.has(id));
for (const id of staleSections) {
  if (archivedIds.has(id)) {
    failures.push(
      `D: ${id} 已归档，详情小节应一并搬走 —— 跑「pnpm run tasks:archive --write」` +
      `（成对搬运）；已归档行补搬用「pnpm run check:tasks -- --prune」`,
    );
  } else {
    failures.push(`C: 详情有 ## ${id} 小节，但主表与 BACKLOG 均无此行（孤儿详情）`);
  }
}

// E：详情归档的 id 必须在行归档里有行（否则成对搬运脱钩——两个归档各说一套）。
for (const id of detailArchiveIds) {
  if (!archivedIds.has(id)) {
    failures.push(`E: 详情归档有 ${id} 的节，但行归档无该行 —— 成对搬运脱钩，请人工核对两个归档`);
  }
}

// F：头注号**不得落后**于「主表 ∪ BACKLOG ∪ 归档」的全局最大号（防领号重号，WXG-T-070）。
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
  ...[...backlogIds].map(idNum),
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
// ⚠ 本条**只指路、不写死阈值**（判例 K-089 追记，WXG-T-400）：旧文案硬编码
// `--detail-until-under=7000 --write`，而该驱动分支不看年龄、按号序一路删到底——
// 详情文件涨到 202239 tok 后，7000 与 40000/80000 实测同读数（一次搬空 49 行，含当天两笔），
// 照抄这条「收敛建议」反而把结果推向意图对面。真数字由 `tasks:archive` 的 dry-run 自己报。
const ROW_SENTINEL = 20;
if (rows.length > ROW_SENTINEL) {
  notes.push(
    `H: 主表 ${rows.length} 行 > 观察哨 ${ROW_SENTINEL} —— 该归档/收敛了：` +
    '先跑**不带 `--write`** 的 `pnpm run tasks:archive -- --days=<N>`（或 `--until-under=<上限以下>`），' +
    '读它自己打印的「计划归档 N 行 → 预计 X tokens」再拍档位；' +
    '确认无误才补 `--write`（成对搬详情节，守恒校验不过不落盘）',
  );
}

// I：提交信息署的号必须在册（主表 ∪ 详情节 ∪ 行归档 ∪ 详情归档）。K-137 及其 WXG-T-346 追记。
// 为什么要抓提交信息而不是只校台账内部：A–H 全是「台账自洽」门，而事故形态是「代码已入库、
// 台账无此行」——两边从不对撞就永远看不出来（K-137④ 手工做法的机械化）。
const commitScan = Number(/--commits=(\d+)/.exec(process.argv.join(' '))?.[1] ?? COMMIT_SCAN_DEFAULT);
const registeredIds = new Set([...rowIds, ...backlogIds, ...detailIds, ...archivedIds, ...detailArchiveIds]);
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
    const cited = citeIdsFrom(subjects);
    const orphans = [...cited].filter((id) => !registeredIds.has(id)).sort();
    if (orphans.length > 0) {
      const msg =
        `I: 最近 ${commitScan} 笔提交信息署了 ${orphans.join('、')}，但台账不在册（主表/BACKLOG/详情节/两个归档四处均无）—— ` +
        '补登主表行 + `## <号>` 详情节，或把已归档的成对搬回（K-137）；' +
        '若属头注「用过号未自登主表清单」已披露的老号 ⇒ 按 K-137 只披露不代填，缩窗口到默认即不拦';
      // --staged 下**降级为 note**（WXG-T-407）：I 项是「提交史 vs 台账」的**仓库级**对撞，不是「本笔索引
      // 自洽」判据。共享工作树里对方常「代码已提交、台账行还在工作树」⇒ 索引面必缺该号，
      // 于是**别人的欠账拦住了本单**（实测：本批被 402/403 拦下，pre-commit exit 1）。
      // 硬拦不丢：默认（工作树）模式仍是 failure，`verify` 与 `check:tasks` 照旧红。
      if (STAGED_MODE) {
        notes.push(`${msg}（${process.argv.includes('--staged') ? '--staged' : '--commit-msg'}：仓库级欠账，披露不拦；硬拦见不带参数的「pnpm run check:tasks」）`);
      } else {
        failures.push(msg);
      }
    } else {
      notes.push(`I: 最近 ${commitScan} 笔提交共署 ${cited.size} 个号，全部在册`);
    }
  }
}

// ── K：本笔提交信息署的号必须在册（--commit-msg=<file>，WXG-T-409）───────────────
// 为什么要单独一项：I 项在 --staged 只能降级为 note——它扫的是提交**窗口**，里面常有
// 他人欠账，不该拦住本单（判例 K-137）；但「本笔消息自己署的号」与本单可解耦，能硬拦。
// 权威面 = 索引 ⇒「台账行还在工作树、没 git add」这种撕裂会在 commit-msg 就被拦下，
// 而不是等提交完再靠事后发现（判例 K-045：共享工作树里未提交 ≠ 我的，暂存也不算拥有）。
// 只拦「本笔署了但不在册」：无号消息放行（那是 commitlint 的 task-id 规则管的事）。
const MSG_FILE = /--commit-msg=(\S+)/.exec(process.argv.join(' '))?.[1];
if (MSG_FILE) {
  const mine = [...citeIdsFrom(readFileSync(path.resolve(ROOT, MSG_FILE), 'utf8'))].sort();
  if (mine.length === 0) {
    notes.push('K: 本笔未署 WXG-T 号 ⇒ 不校（commitlint 另有 task-id 规则）');
  } else {
    const orphans = mine.filter((id) => !registeredIds.has(id));
    if (orphans.length > 0) {
      failures.push(
        `K: 本笔提交信息署 ${orphans.join('、')}，但**索引面**台账不在册（主表 / BACKLOG / 详情节 / 两个归档均无）——` +
        '先把登记面 `git add` 进本笔（`production/TASKS.md` + `production/TASKS-DETAIL.md`，提案行则 `BACKLOG.md`）再提交（判例 K-045 / K-137）',
      );
    } else {
      notes.push(`K: 本笔署号 ${mine.join('、')} 均在册`);
    }
  }
}

// ── --prune：补搬（不是删）────────────────────────────────────────────────────
// WXG-T-065 起语义变更：早先 --prune 是**删除**残留小节 ✗（会丢任务正文）。既然成对搬运
// 已有落点（详情归档），补搬就是唯一不丢信息的修复动作。
if (process.argv.includes('--prune')) {
  if (STAGED_MODE) {
    console.error('❌ --prune（写盘）与 --staged（读索引）互斥：前者要改工作树文件，后者要拿索引当权威面。');
    process.exit(1);
  }
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
