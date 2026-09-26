/**
 * knowledge-ledger.mjs — shared engine for the knowledge-base lifecycle ledger
 * (WXG-T-029).
 *
 * 治理目标：给 `knowledge/` 沉淀层加**访问时间戳 + 访问次数**，支持
 *   「过时 / 长期未访问 → 归档（不再进索引面）」以及
 *   「新增条目命中归档条目 → 重新激活并优化」的闭环。
 *
 * 本模块是 kb-sync / kb-collect / kb-touch / kb-audit / kb-archive /
 * kb-reactivate / kb-check 七个脚本的**共享解析 / 序列化层**：一处定义条目
 * 身份、条目区间、ledger schema（含固定键序）与相似度算法，杜绝「生成器与门禁
 * 各写一份、彼此漂移」。纯 Node ESM、**零新增依赖**，风格对齐
 * lib/context-index.mjs / lib/reads-ledger.mjs。
 *
 * ── 四个口径（用户 2026-09-12 拍板，写死不可违反）────────────────────────
 * 1. 访问采集 = 自动 + 显式兼顾：主 `kb:collect`（解析 ctx/reads-ledger.jsonl），
 *    辅 `kb:touch`（供其他 IDE / 手工补录）。
 * 2. 条目身份 = 行内显式 ID `[K-001]`（三位补零、递增不回收，类比 WXG-T-xxx）。
 * 3. 归档判定 = 90 天未访问 **且** 访问次数 ≤1，**必须人工确认**（脚本只出候选）。
 * 4. 归档形态 = 移入 `knowledge/archive/` 并从索引面排除（ctx SKIP_DIRS 含 archive）。
 *
 * ── thresholds 依据（注释留痕；JSON 不放注释，故记于此）──────────────────
 * 三个常量 `archiveIdleDays=90`、`archiveMaxAccess=1`、`reactivateSimilarity=0.34`
 * 的依据 = **用户 2026-09-12 裁定 + 本单 WXG-T-029**。
 *   • 90 天 / 访问次数 ≤1：够长以滤掉季度性复用，够短以清理真死条目；
 *   • 0.34：标题+关键词 Jaccard 的经验阈值，低于此不再视为「疑似重复」。
 * 门槛**只出候选、不自动归档**：归档动作必须经 `kb:archive --ids=… --reason=…`
 * 显式人工确认（与 AGENTS.md「不擅自删除高影响产物」一致）。
 *
 * ── 陈旧判定的诚实边界 ──────────────────────────────────────────────────
 * • `ctx/reads-ledger.jsonl` 的读事件**不含时间戳**（见 lib/reads-ledger.mjs），
 *   故 `kb:collect` 只能把 `lastAccess` 记为**运行日**（观察日粒度），无法还原真实
 *   访问时刻；`accessSources` 相应记 `ledger:<运行日>`。
 * • 只在账本中出现过的访问才被计入：账本**无法覆盖不写转录的 IDE**（Qoder /
 *   CodeBuddy），故「未访问」可能实为「未被观察」。归档前必须人工复核。
 *
 * ── seen：让 kb:collect 幂等（WXG-T-029 收口）──────────────────────────────
 * 缺陷：旧 kb:collect 只做**单轮内**同会话去重；跨运行（哪怕无新读）会把账本里
 *   既有的 (会话, 条目) 再计一遍 → `accessCount` 随重跑膨胀。而 `accessCount`
 *   正是归档判定的输入（> archiveMaxAccess 即出局）→ 膨胀会让**该归档的条目
 *   永不入候选**，是**正确性缺陷**，非风格问题。
 * 修法：条目新增 `seen` 字段（ENTRY_FIELDS），持久记录**已计入**的 (会话, 条目) 对；
 *   kb:collect 命中即跳过（不 +1、不刷新 lastAccess），故连跑两次计数不变、且
 *   第二次 attributed=0 → **不写盘 → ledger 字节稳定**。
 * 元素格式统一为 `"<主体>#<YYYY-MM-DD>"`（日期 = 观察日，仅供追溯）。**主体分两类**
 *   （本模块显式区分，见 `EXPLICIT_SEEN_PREFIXES` / `isExplicitSeenSubject`）：
 *     • **采集主体（collect）**：`kb:collect` 写入，主体 = 读事件账本里的**会话标识**
 *       （IDE 转录相对路径去 `.jsonl`，如 `S1`）。**参与**同会话去重（`seenHasSession`
 *       只看这类主体）。
 *     • **显式动作主体（explicit）**：`kb:touch` / `kb:reactivate` 写入，主体带 `touch:` /
 *       `reactivate:` 前缀（如 `touch:WXG-T-099#2026-02-01`、`reactivate:2026-03-02#2026-03-02`）。
 *       它们是**采集之外的显式 +1**，**不参与**采集去重——否则一条触碰留痕会被误判成
 *       「某会话已计过」而吞掉真实采集。
 * **去重只看采集主体的 `<session>` 部分**（见 `seenSession`）——日期不参与身份，正是为了
 *   守住「同一 (会话, 条目) 只计一次」的既有语义、保证**跨天/跨运行**都幂等。
 * 两类主体都**留痕于 seen**，故 `accessCount === seen.length` 对**所有条目**严格成立
 *   （kb:check ⑥，**无豁免分支**）。
 * 兼容：旧 ledger 无 `seen` 字段 → `normalizeLedgerEntry` 按**空数组**读入，
 *   **不报错、不重置既有 accessCount / lastAccess / accessSources**。
 *
 * ── contentHash + events + CHANGELOG（WXG-T-029 追加范围，2026-09-12）──────────
 * 需求：沉淀知识库时必须产出「变更统计」——**新增 / 修改 / 激活 / 归档**四类。
 * • 条目新增 `contentHash`：条目正文（标题行 + 正文行）**规范化后**的 sha256，用于判定
 *   「修改」。规范化 = 逐行去行尾空白 + 统一 `\n` + **剔除归档元信息行**（`> 归档于 …`）
 *   + 去首尾空行；**不含** `file` / `lastAccess` 等元数据（改元数据不算「修改」）。
 * • 顶层新增 `events`（**append-only**，键序固定、置于字段区末尾）：每次 kb:sync 把本轮的
 *   added / updated **各自合并为一条** event（`kind` 互斥，无法共用一条）；kb:archive /
 *   kb:reactivate 各追加一条 archived / reactivated event。`taskId` 可为 `null`。
 * • `knowledge/CHANGELOG.md` 由 kb:sync 生成（人读、**勿手改**）：日期倒序 → 同日按 Task ID 分组。
 * • 「新增 / 修改」由 sync **现算**（对比既有 `contentHash`）；「激活 / 归档」sync **不自行推断**，
 *   只汇总 `events` 中**运行日**已记录的 reactivated / archived。
 * • 兼容：旧 ledger 无 `contentHash` → 首次 sync **一次性补齐基线**，且**不生成 added event**
 *   （它们早已入库，避免伪造「本次新增」）；`events` 缺失 → 按空数组读入。
 *
 * ── accessSources 截断（R4，WXG-T-038，2026-09-13 审计对策）────────────────
 * 缺陷：`accessSources` **只增不减**——每次访问追加去重后的来源标签，随日期 / 任务数
 *   无限膨胀；该文件被 ctx 索引覆盖 → 属「真雷」。
 * 对策：**lib 层统一收口**——`normalizeLedgerEntry`（所有写盘路径的必经序列化点，
 *   见 `serializeLedger`）把 `accessSources` 截断为**保留尾部最近 `ACCESS_SOURCES_MAX` 个**；
 *   写入方（kb:collect / kb:touch / kb:reactivate）统一走 `appendAccessSource`。
 *   • `N=12`：来源标签已按 `kind:值` 去重，增长上限 ≈ 每条目每天 1 个 `ledger:<日>` +
 *     显式动作标签；12 个最近来源足以覆盖两周级访问追溯（kb:audit 只用 lastAccess /
 *     accessCount，**不用** accessSources），且把单条目来源块稳定在几百字节内。
 *   • **语义不变**：`accessCount` 仍累计所有访问、`seen` **不截断**（⑥ 严格一致的前提）、
 *     `lastAccess` 不变；截断只影响「来源留痕」这一展示性字段。
 *   • **幂等**：截断是纯函数（超限 → slice 保留尾部；未超限 → 原样），重复运行不丢
 *     accessCount、不二次截断。
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ROOT } from './context-index.mjs';

export { ROOT };

/** ledger schema 版本（结构变更 +1；扩展一律追加字段，不动既有键）。 */
export const LEDGER_VERSION = 1;

export const KNOWLEDGE_DIR = join(ROOT, 'knowledge');
/** 入库的 ledger（脚本维护；固定键序、无生成时间戳，字节稳定）。 */
export const LEDGER_PATH = join(KNOWLEDGE_DIR, 'ledger.json');
/** 活跃条目索引（人读协议 + kb:sync 生成的活跃表块）。 */
export const INDEX_PATH = join(KNOWLEDGE_DIR, 'INDEX.md');
export const ARCHIVE_DIR = join(KNOWLEDGE_DIR, 'archive');
export const ARCHIVE_INDEX_PATH = join(ARCHIVE_DIR, 'INDEX.md');

/**
 * 活跃条目源文件（**列表顺序即补号顺序**：lessons 各分片 → patterns，跨文件连续编号）。
 * 每条同时给出它的归档文件（同源文件条目归档到对应文件末尾）。
 *
 * **WXG-T-111：lessons 已按行内标签分片**到 `knowledge/lessons/<shard>.md`，故本表
 * 改为**动态枚举**该目录（`knowledge/lessons.md` 只剩指针页、**不 entries** ⇒ 不入表）：
 *   • 目录不存在 ⇒ 回退旧布局单文件 `knowledge/lessons.md`（**不假绿亦不砸错**：
 *     新克隆或尚未跑迁移脚本时行为与分片前一致）；
 *   • 已知片按 `LESSONS_SHARD_ORDER` 排（补号顺序**必须稳定**，否则新条目落位文件会漂），
 *     未知片按名序追加在后（新标签自建片 ⇒ 无需改码即可被采集）；
 *   • **归档仍单份**：各 lessons 片共用 `knowledge/archive/lessons-archived.md`
 *     （`label` 一律 `lessons`，`archiveHeader(label)` 才不会长出多个归档抬头）。
 * 条目身份仍是全局单一的 `[K-0NN]` 命名空间：分片只改**正文落位**，不改编号语义；
 * `contentHash` 不含 `file` 等元数据 ⇒ 改落位**不算「修改」**，不会造出伪 `updated`。
 */
export const LESSONS_DIR = join(KNOWLEDGE_DIR, 'lessons');
/** 已知分片顺序（正本映射见 `tools/scripts/split-knowledge-lessons.mjs::TAG_TO_SHARD`，改一侧必同步另一侧）。 */
export const LESSONS_SHARD_ORDER = ['toolchain', 'process', 'criteria', 'testing', 'cross-ide', 'environment', 'onboarding', 'engine-cocos'];
const LESSONS_ARCHIVE = 'knowledge/archive/lessons-archived.md';
const LESSONS_ARCHIVE_ABS = join(ARCHIVE_DIR, 'lessons-archived.md');

/** 片名 → 展示标签（`INDEX.md` 活跃表「分片」列、kb:archive 日志）；未分片文件 → `null`。 */
export function shardOf(file) {
  const f = String(file ?? '');
  if (!f.startsWith('knowledge/lessons/')) return null;
  return f.slice('knowledge/lessons/'.length).replace(/\.md$/, '');
}

/** 活跃表「分片」列取值：lessons 片取片名，未分片（旧布局）落 `lessons`，patterns 落 `patterns`。 */
export function shardCellOf(file) {
  return shardOf(file) ?? (String(file ?? '') === 'knowledge/patterns.md' ? 'patterns' : 'lessons');
}

function lessonsSourceFiles() {
  if (!existsSync(LESSONS_DIR)) {
    return [
      {
        file: 'knowledge/lessons.md',
        abs: join(KNOWLEDGE_DIR, 'lessons.md'),
        archive: LESSONS_ARCHIVE,
        archiveAbs: LESSONS_ARCHIVE_ABS,
        label: 'lessons',
        shard: null,
      },
    ];
  }
  const names = readdirSync(LESSONS_DIR)
    .filter((n) => n.endsWith('.md'))
    .sort((a, b) => {
      const ai = LESSONS_SHARD_ORDER.indexOf(a.replace(/\.md$/, ''));
      const bi = LESSONS_SHARD_ORDER.indexOf(b.replace(/\.md$/, ''));
      if (ai !== -1 || bi !== -1) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      return a < b ? -1 : a > b ? 1 : 0;
    });
  return names.map((n) => {
    const shard = n.replace(/\.md$/, '');
    return {
      file: `knowledge/lessons/${n}`,
      abs: join(LESSONS_DIR, n),
      archive: LESSONS_ARCHIVE,
      archiveAbs: LESSONS_ARCHIVE_ABS,
      label: 'lessons',
      shard,
    };
  });
}

export const ACTIVE_FILES = [
  ...lessonsSourceFiles(),
  {
    file: 'knowledge/patterns.md',
    abs: join(KNOWLEDGE_DIR, 'patterns.md'),
    archive: 'knowledge/archive/patterns-archived.md',
    archiveAbs: join(ARCHIVE_DIR, 'patterns-archived.md'),
    label: 'patterns',
    shard: 'patterns',
  },
];

/** ledger 顶层键序（**字节稳定**；`events` 为追加日志，置于**字段区末尾**）。 */
export const LEDGER_FIELDS = ['version', 'nextId', 'thresholds', 'entries', 'events'];
/** 单条目键序（固定；无生成时间戳，业务日期除外）。 */
export const ENTRY_FIELDS = [
  'id',
  'state',
  'file',
  'category',
  'title',
  'contentHash',
  'sourceTask',
  'addedDate',
  'lastAccess',
  'accessCount',
  'accessSources',
  'seen',
  'archivedDate',
  'archiveReason',
  'reactivatedDate',
];
export const THRESHOLD_FIELDS = ['archiveIdleDays', 'archiveMaxAccess', 'reactivateSimilarity'];

/** 单条 event 键序（固定；`note` 缺失时写 `null`，保证字节稳定）。 */
export const EVENT_FIELDS = ['date', 'taskId', 'kind', 'ids', 'note'];
/** 合法 event 类型（四类闭环）。 */
export const EVENT_KINDS = ['added', 'updated', 'reactivated', 'archived'];
/** `taskId` 形态（或 `null`）。 */
export const TASK_ID_RE = /^WXG-T-\d+$/;
/** `date` 形态。 */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** 人读变更日志（**由 kb:sync 生成，勿手改**）。 */
export const CHANGELOG_PATH = join(KNOWLEDGE_DIR, 'CHANGELOG.md');

/** 默认阈值（依据见文件头注释：用户 2026-09-12 裁定 + WXG-T-029）。 */
export const DEFAULT_THRESHOLDS = {
  archiveIdleDays: 90,
  archiveMaxAccess: 1,
  reactivateSimilarity: 0.34,
};

/** INDEX.md 活跃表块标记（kb:sync 只重写标记之间，块外协议文字保持不动）。 */
export const ACTIVE_START = '<!-- kb:active:start（由 pnpm run kb:sync 生成，勿手改）-->';
export const ACTIVE_END = '<!-- kb:active:end -->';

/** 合法 ID 形态：`K-001`…（三位补零）。 */
export const ID_RE = /^K-\d{3}$/;

export function formatId(n) {
  return `K-${String(n).padStart(3, '0')}`;
}
export function parseIdNum(id) {
  const m = /^K-(\d+)$/.exec(String(id));
  return m ? Number(m[1]) : NaN;
}

// ─────────────────────────────────────────────────────────── CLI helpers ────────

/**
 * 极简 `--k=v` / `--flag` 解析；非 `--` 开头的并入 positional。
 * 用法约定：`pnpm run kb:touch -- K-001 K-003` → positional = ['K-001','K-003']。
 */
export function parseArgs(list) {
  const positional = [];
  const opts = {};
  for (const a of list) {
    const m = /^--([^=]+)(?:=([\s\S]*))?$/.exec(a);
    if (m) opts[m[1]] = m[2] === undefined ? true : m[2];
    else positional.push(a);
  }
  return { positional, opts };
}

export function todayISO(override) {
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** `b - a` 的天数（按 UTC 零点，避免时区/夏令时抖动）。 */
export function daysBetween(a, b) {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

// ────────────────────────────────────────────────────────── markdown 解析 ──────

/**
 * 条目标题行：
 *   `- **[类别][K-005] 标题**（来源 WXG-T-0xx，2026-09-12）`
 *   `- **[K-005] 标题**（…）`（patterns 无行内类别）
 * 行内类别 `[类别]` 与 ID `[K-xxx]` 均为可选（补号前无 ID；patterns 无类别）。
 * 负向先行 `(?!K-\d+\])` 防止 `[K-005]` 被误当类别。
 */
const TITLE_RE =
  /^- \*\*(?:\[(?!K-\d+\])([^\]]+)\])?(?:\[(K-\d+)\])?\s*([\s\S]*?)\*\*([\s\S]*)$/;

/** 解析一条标题行；非条目标题 → null。 */
export function parseEntryTitleLine(line) {
  const m = TITLE_RE.exec(line);
  if (!m) return null;
  return {
    inlineCategory: m[1] ?? null,
    id: m[2] ?? null,
    title: (m[3] ?? '').trim(),
    after: m[4] ?? '',
  };
}

/** 归档元信息行（kb:archive 写入；kb:reactivate 读回时剥离）。 */
export const ARCHIVED_META_RE = /^>\s*归档于\s/;

/**
 * 解析一份知识库 markdown（活跃或归档），返回条目列表（含行区间）。
 *
 * **条目边界**：从标题行起，含其后**缩进子行**（现象 / 根因 / 规避）与
 * **引用行**（`>` 归档元信息），到下一个标题行 / H2 小标题 / 非缩进正文行前止；
 * 末尾空行不计入条目。
 *
 * @returns {{file: string, lines: string[], entries: Entry[]}}
 *   Entry.startLine / endLine 均为 **1-based 闭区间**。
 */
export function parseKnowledgeFile(text, file) {
  const lines = text.split('\n');
  const entries = [];
  let section = null;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) {
      section = h[1].trim();
      i += 1;
      continue;
    }
    const t = parseEntryTitleLine(line);
    if (t) {
      const startLine = i + 1;
      let j = i + 1;
      while (j < lines.length) {
        const l = lines[j];
        if (l === '' || /^\s/.test(l) || /^>/.test(l)) {
          j += 1;
          continue;
        }
        break;
      }
      let end = j; // 0-based 独占上界
      while (end - 1 > i && lines[end - 1].trim() === '') end -= 1; // 去尾部空行
      const bodyLines = lines.slice(i + 1, end);
      const taskMatch = line.match(/WXG-T-\d+/);
      const dateMatch = line.match(/\d{4}-\d{2}-\d{2}/);
      entries.push({
        id: t.id,
        inlineCategory: t.inlineCategory,
        section,
        category: t.inlineCategory ?? section ?? null,
        title: t.title,
        after: t.after,
        sourceTask: taskMatch ? taskMatch[0] : null,
        addedDate: dateMatch ? dateMatch[0] : null,
        startLine,
        endLine: end, // 1-based 闭区间末行
        raw: line,
        bodyLines,
      });
      i = end;
      continue;
    }
    i += 1;
  }
  return { file, lines, entries };
}

/** 在标题行内、`[类别]` 之后（无类别则 `**` 之后）插入 `[K-xxx]`。 */
export function inscribeId(line, id) {
  const m = /^(- \*\*)(\[[^\]]+\])?(\s*)([\s\S]*)$/.exec(line);
  if (!m) return line;
  const [, head, cat, ws, rest] = m;
  if (cat) return `${head}${cat}[${id}]${ws}${rest}`;
  return `${head}[${id}] ${rest}`;
}

/** 条目的 0-based 行区间 [start, end]（闭区间）。 */
export function entryLineRange(entry) {
  return [entry.startLine - 1, entry.endLine - 1];
}

/**
 * 从行数组中删除一个条目，并在接缝处收敛多余空行（保持排版整洁）。
 * @returns {string[]} 新行数组
 */
export function removeEntryLines(lines, entry) {
  const [start, end] = entryLineRange(entry);
  const out = [...lines.slice(0, start), ...lines.slice(end + 1)];
  if (start - 1 >= 0 && start < out.length && out[start - 1] === '' && out[start] === '') {
    out.splice(start, 1);
  }
  return out;
}

/**
 * 把一个条目文本块插入到 `category` 小标题分区末尾（找不到则追加到文件尾）。
 * 用于 kb:reactivate 保持类别分区。
 * @param {string[]} lines
 * @param {string|null} category
 * @param {string[]} entryLines
 */
export function insertIntoCategory(lines, category, entryLines) {
  // 定位 `## <category>`
  let head = -1;
  for (let k = 0; k < lines.length; k += 1) {
    const h = /^##\s+(.+?)\s*$/.exec(lines[k]);
    if (h && category && h[1].trim() === category) {
      head = k;
      break;
    }
  }
  if (head === -1) {
    // 追加到文件尾（去掉尾部空行再补一个空行分隔）
    const out = [...lines];
    while (out.length && out[out.length - 1].trim() === '') out.pop();
    out.push('', ...entryLines, '');
    return out;
  }
  // 该分区结束 = 下一个 `## ` 之前
  let tail = lines.length;
  for (let k = head + 1; k < lines.length; k += 1) {
    if (/^##\s+/.test(lines[k])) {
      tail = k;
      break;
    }
  }
  // 在 tail 之前回退空行，插在最后一条正文之后
  let insertAt = tail;
  while (insertAt - 1 > head && lines[insertAt - 1].trim() === '') insertAt -= 1;
  const out = [...lines.slice(0, insertAt), '', ...entryLines, ...lines.slice(insertAt)];
  return out;
}

// ────────────────────────────────────────────── contentHash（「修改」判定）──────

/**
 * 条目正文的**规范化文本**（contentHash 的输入，口径写死不可漂移）：
 *   1. 逐行去**行尾空白**（`[ \t]+$`）；
 *   2. 剔除**归档元信息行**（`> 归档于 …`）——归档/激活的元信息不算「正文」；
 *   3. 去**首尾空行**；
 *   4. 以 `\n` 连接（统一换行）。
 * ⚠️ 标题行**原样**参与（含行内 `[K-xxx]` 与 `[类别]`）：ID 一经分配不再变动，
 *    故标题文本变化（或行内类别变化）即视为「正文修改」，语义正确且可复现。
 * @param {string[]} lines 标题行 + 正文行（顺序即文件顺序）
 */
export function normalizeEntryContent(lines) {
  const out = [];
  for (const raw of Array.isArray(lines) ? lines : []) {
    const l = String(raw).replace(/[ \t]+$/, '');
    if (ARCHIVED_META_RE.test(l)) continue;
    out.push(l);
  }
  while (out.length > 0 && out[0].trim() === '') out.shift();
  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
  return out.join('\n');
}

/** 规范化正文的 sha256（hex，64 字符）。 */
export function contentHashOf(lines) {
  return createHash('sha256').update(normalizeEntryContent(lines), 'utf8').digest('hex');
}

/** 一条**已解析条目**（parseKnowledgeFile 产出）的 contentHash。 */
export function entryContentHash(entry) {
  return contentHashOf([entry?.raw ?? '', ...(entry?.bodyLines ?? [])]);
}

// ───────────────────────────────────────────────────────── ledger 读 / 写 ─────

function defaultForField(k) {
  if (k === 'accessCount') return 0;
  if (k === 'accessSources') return [];
  if (k === 'seen') return [];
  if (k === 'state') return 'active';
  return null;
}

/** 数组型字段（缺省 / 类型异常均收敛为空数组，杜绝脏数据传播）。 */
const ARRAY_FIELDS = new Set(['accessSources', 'seen']);

/**
 * `accessSources` 截断上限（R4，WXG-T-038）：保留**尾部最近 N 个**来源标签。
 * N=12 的依据见文件头「accessSources 截断」段；`seen` **不受此限**（⑥ 严格一致的前提）。
 */
export const ACCESS_SOURCES_MAX = 12;

/**
 * 截断来源标签数组至最近 `ACCESS_SOURCES_MAX` 个（纯函数；未超限原样返回）。
 * 只用于 `accessSources`；`seen` 绝不截断。
 */
export function trimAccessSources(arr) {
  const a = Array.isArray(arr) ? arr : [];
  return a.length > ACCESS_SOURCES_MAX ? a.slice(a.length - ACCESS_SOURCES_MAX) : a;
}

/**
 * 追加一个**去重**来源标签并截断保留最近 N 个（R4 统一收口）。
 * 所有写 `accessSources` 的路径（kb:collect / kb:touch / kb:reactivate）一律走此函数，
 * 不再各自内联 push；原「同标签不重复追加」语义保持不变。
 * @returns {string[]} 截断后的 accessSources（原地引用）
 */
export function appendAccessSource(entry, tag) {
  const arr = Array.isArray(entry.accessSources) ? entry.accessSources : [];
  if (!arr.includes(tag)) arr.push(tag);
  entry.accessSources = trimAccessSources(arr);
  return entry.accessSources;
}

/**
 * 归一化单条目：补齐缺失键、固定键序。
 * 旧 ledger（无 `seen`）→ 按空数组读入，**不报错、不动既有访问数据**。
 * R4（WXG-T-038）：`accessSources` 在此**统一截断**为最近 `ACCESS_SOURCES_MAX` 个
 * （本函数是 `serializeLedger` 的必经点 → 所有写盘路径自动收敛；`seen` 不截断）。
 */
export function normalizeLedgerEntry(e) {
  const out = {};
  for (const k of ENTRY_FIELDS) {
    let v = Object.prototype.hasOwnProperty.call(e, k) && e[k] !== undefined ? e[k] : defaultForField(k);
    if (ARRAY_FIELDS.has(k) && !Array.isArray(v)) v = [];
    if (k === 'accessSources') v = trimAccessSources(v);
    out[k] = v;
  }
  return out;
}

// ────────────────────────────────────────────────────── events（追加日志）──────

/**
 * 归一化单条 event：固定键序 `date / taskId / kind / ids / note`。
 * • `ids` 非数组 → `[]`；元素一律转字符串。
 * • `taskId` / `note` 非字符串 → `null`（**始终写出** null，保持字节稳定）。
 * 注意：本函数只做**形状**归一，不做合法性判定（合法性由 kb:check ⑦ 负责）。
 */
export function normalizeEvent(e) {
  const src = e ?? {};
  return {
    date: typeof src.date === 'string' ? src.date : null,
    taskId: typeof src.taskId === 'string' ? src.taskId : null,
    kind: typeof src.kind === 'string' ? src.kind : null,
    ids: Array.isArray(src.ids) ? src.ids.map(String) : [],
    note: typeof src.note === 'string' ? src.note : null,
  };
}

/** 归一化 events 数组（缺失 / 非数组 → 空数组）。 */
export function normalizeEvents(arr) {
  return (Array.isArray(arr) ? arr : []).map(normalizeEvent);
}

/** 构造一条 event（含键序固定与形状归一）。 */
export function makeEvent({ date, taskId = null, kind, ids = [], note = null }) {
  return normalizeEvent({ date, taskId, kind, ids, note });
}

// ─────────────────────────────────────── seen（访问审计 / 采集去重日志）────
/**
 * 构造 seen 元素：`"<主体>#<YYYY-MM-DD>"`（日期 = 观察日，仅供追溯）。
 * `<主体>` 既可为**采集会话标识**（kb:collect），亦可为**显式动作主体**
 * （`touch:…` / `reactivate:…`，kb:touch / kb:reactivate）——见文件头「seen」段。
 */
export function seenToken(subject, day) {
  return `${subject}#${day}`;
}

/** 显式动作主体前缀（`kb:touch` / `kb:reactivate` 写入的 seen 主体）。 */
export const EXPLICIT_SEEN_PREFIXES = ['touch:', 'reactivate:'];

/** 该 seen 主体是否来自**显式动作**（touch / reactivate）而非采集。 */
export function isExplicitSeenSubject(subject) {
  const s = String(subject);
  return EXPLICIT_SEEN_PREFIXES.some((p) => s.startsWith(p));
}

/** 从 seen 元素取回**主体部分**（去掉尾部 `#YYYY-MM-DD`）；无日期后缀则原样返回。 */
export function seenSession(el) {
  const m = /^(.*)#\d{4}-\d{2}-\d{2}$/.exec(String(el));
  return m ? m[1] : String(el);
}

/**
 * 该条目是否**已由某「采集会话」计入**：只比对**采集主体**（忽略观察日，且**跳过**
 * `touch:` / `reactivate:` 这类显式动作主体）。这是「同一 (会话, 条目) 只计一次」
 * 跨运行/跨天的判定依据，也是 `kb:collect` 幂等的基础——显式动作留痕**不得**影响
 * 采集判重（否则一条 touch 可能被误判成「某会话已计过」，令真实采集被漏计）。
 */
export function seenHasSession(seenArr, session) {
  const target = String(session);
  return (Array.isArray(seenArr) ? seenArr : [])
    .map((el) => seenSession(el))
    .some((subject) => !isExplicitSeenSubject(subject) && subject === target);
}

export function normalizeThresholds(t) {
  const src = t ?? {};
  const out = {};
  for (const k of THRESHOLD_FIELDS) {
    out[k] = Number.isFinite(src[k]) ? src[k] : DEFAULT_THRESHOLDS[k];
  }
  return out;
}

export function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const an = parseIdNum(a.id);
    const bn = parseIdNum(b.id);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    if (Number.isFinite(an)) return -1;
    if (Number.isFinite(bn)) return 1;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function emptyLedger() {
  return {
    version: LEDGER_VERSION,
    nextId: 1,
    thresholds: { ...DEFAULT_THRESHOLDS },
    entries: [],
    events: [],
  };
}

/** 读 ledger；缺失 / 解析失败 → null（调用方决定是否报错）。 */
export function readLedger() {
  if (!existsSync(LEDGER_PATH)) return null;
  try {
    return JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 稳定序列化：固定键序（version/nextId/thresholds/entries/**events**）、条目按 ID 升序、
 * events **保持追加序**（append-only，不排序）、无时间戳。
 */
export function serializeLedger(ledger) {
  const ordered = {
    version: LEDGER_VERSION,
    nextId: ledger.nextId,
    thresholds: normalizeThresholds(ledger.thresholds),
    entries: sortEntries(ledger.entries ?? []).map(normalizeLedgerEntry),
    events: normalizeEvents(ledger.events),
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

export function writeLedger(ledger) {
  mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  writeFileSync(LEDGER_PATH, serializeLedger(ledger), 'utf8');
}

// ────────────────────────────────────────────────────────── 相似度（Jaccard）───

/**
 * 分词：ASCII 词（≥2 字符，小写）+ CJK 二元组（单字串保留单字）。
 * 用于「标题 + 关键词」的 Jaccard 相似度（归档命中检测）。
 */
export function tokenize(text) {
  const toks = new Set();
  const s = String(text ?? '').toLowerCase();
  for (const m of s.matchAll(/[a-z0-9_]{2,}/g)) toks.add(m[0]);
  for (const m of s.matchAll(/[\u4e00-\u9fff]+/g)) {
    const run = m[0];
    if (run.length === 1) toks.add(run);
    for (let i = 0; i + 1 < run.length; i += 1) toks.add(run.slice(i, i + 2));
  }
  return toks;
}

/** Jaccard 相似度 |A∩B| / |A∪B|；任一为空 → 0。 */
export function jaccard(a, b) {
  const A = a instanceof Set ? a : tokenize(a);
  const B = b instanceof Set ? b : tokenize(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** 条目的「标题 + 关键词」指纹（关键词 ≈ 类别分区名）。 */
export function entryFingerprint(e) {
  return tokenize(`${e.title ?? ''} ${e.category ?? ''}`);
}

// ───────────────────────────────────────────────────── 索引块 / 归档清单 ───────

function escCell(s) {
  return String(s ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim() || '—';
}

/** 渲染 INDEX.md 的活跃条目表块（含标记行）。 */
export function renderActiveBlock(entries) {
  const rows = sortEntries(entries.filter((e) => e.state === 'active'));
  const L = [];
  L.push(ACTIVE_START);
  L.push('| ID | 类别 | 分片 | 标题 | 来源 | 最后访问 | 次数 | 状态 |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const e of rows) {
    L.push(
      `| ${e.id} | ${escCell(e.category)} | ${escCell(shardCellOf(e.file))} | ${escCell(e.title)} | ${escCell(e.sourceTask)} | ` +
      `${escCell(e.lastAccess)} | ${e.accessCount ?? 0} | ${e.state ?? 'active'} |`,
    );
  }
  L.push(ACTIVE_END);
  return L.join('\n');
}

/** 只重写标记块之间的内容；块外协议文字保持不动。标记缺失 → 追加到文件末尾。 */
export function rewriteActiveBlock(text, block) {
  const s = text.indexOf(ACTIVE_START);
  const e = text.indexOf(ACTIVE_END);
  if (s === -1 || e === -1 || e < s) {
    const sep = text.endsWith('\n') ? '' : '\n';
    return `${text}${sep}\n${block}\n`;
  }
  const before = text.slice(0, s);
  const after = text.slice(e + ACTIVE_END.length);
  return `${before}${block}${after}`;
}

/** 渲染 knowledge/archive/INDEX.md（归档清单，供人查询）。 */
export function renderArchiveIndex(entries) {
  const rows = sortEntries(entries.filter((e) => e.state === 'archived'));
  const L = [];
  L.push('# knowledge/archive/ — 归档条目清单（由 kb:sync / kb:archive / kb:reactivate 维护，勿手改）');
  L.push('');
  L.push('> 归档条目已从活跃索引面排除（ctx 索引 `SKIP_DIRS` 含 `archive`，不再进 `ctx/index.json`）。');
  L.push('> 需要重新启用：`pnpm run kb:reactivate -- --ids=<ID> --reason="…"`。');
  L.push('');
  L.push('| ID | 类别 | 标题 | 归档日 | 原因 | 原访问次数 |');
  L.push('|---|---|---|---|---|---|');
  for (const e of rows) {
    L.push(
      `| ${e.id} | ${escCell(e.category)} | ${escCell(e.title)} | ${escCell(e.archivedDate)} | ` +
      `${escCell(e.archiveReason)} | ${e.accessCount ?? 0} |`,
    );
  }
  L.push('');
  return L.join('\n');
}

// ───────────────────────────────────────────── CHANGELOG（人读变更日志）─────────

/** 四类变更的中文标签（`kind` → 标签）。 */
export const KIND_LABELS = {
  added: '新增',
  updated: '修改',
  reactivated: '激活',
  archived: '归档',
};

/**
 * 渲染 `knowledge/CHANGELOG.md`（**由 kb:sync 生成，勿手改**）。
 * 结构：头部（生成方式 + 统计口径）→ 日期**倒序** → 同日按 **Task ID** 分组 → 逐条
 * `kind` + 条目 ID + 标题 + `note`。**无生成时间戳**（字节稳定：仅由 events + 台账决定）。
 *
 * @param {object[]} events ledger.events（append-only，按追加序传入）
 * @param {object[]} entries ledger.entries（供 id → 标题 查表）
 */
export function renderChangelog(events, entries) {
  const byId = new Map((entries ?? []).map((e) => [String(e.id), e]));
  const evs = normalizeEvents(events);
  const L = [];
  L.push('# knowledge/CHANGELOG.md — 知识库变更日志');
  L.push('');
  L.push('> **本文件由 `pnpm run kb:sync` 生成，请勿手改**（手改会被下次 sync 覆盖）。');
  L.push('> 统计口径：`added` 新增条目 ／ `updated` 修改条目（正文变化，按 `contentHash` 判定）');
  L.push('> ／ `reactivated` 从归档重新激活 ／ `archived` 归档。');
  L.push('> 数据源 = `knowledge/ledger.json` 的 `events`（**append-only** 追加日志）+ 条目台账（标题取自台账）；');
  L.push('> 日期倒序，同一日期内按 Task ID 分组。');
  L.push('');
  if (evs.length === 0) {
    L.push('（暂无变更记录：`ledger.json` 的 `events` 为空。）');
    L.push('');
    return L.join('\n');
  }
  const byDate = new Map();
  for (const ev of evs) {
    const d = ev.date ?? '（无日期）';
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(ev);
  }
  const dates = [...byDate.keys()].sort((a, b) => String(b).localeCompare(String(a))); // 日期倒序
  for (const d of dates) {
    L.push(`## ${d}`);
    L.push('');
    const byTask = new Map();
    for (const ev of byDate.get(d)) {
      const key = ev.taskId ?? '（无任务号）';
      if (!byTask.has(key)) byTask.set(key, []);
      byTask.get(key).push(ev);
    }
    const tasks = [...byTask.keys()].sort((a, b) => String(a).localeCompare(String(b)));
    for (const t of tasks) {
      L.push(`### ${t}`);
      L.push('');
      for (const ev of byTask.get(t)) {
        const label = KIND_LABELS[ev.kind] ?? ev.kind ?? '未知';
        const items = ev.ids.map((id) => {
          const e = byId.get(String(id));
          return e ? `${id}「${e.title}」` : `${id}「（台账无此条目）」`;
        });
        const note = ev.note ? ` —— ${ev.note}` : '';
        L.push(`- **${label}**（${ev.kind}）：${items.length ? items.join('、') : '（无 ID）'}${note}`);
      }
      L.push('');
    }
  }
  return L.join('\n');
}

// ─────────────────────────────────────────────────────── 归档文件读写 ────────────

function archiveHeader(label) {
  return (
    `# ${label} 归档（由 kb:archive 搬入 / kb:reactivate 搬出；勿手改）\n\n` +
    '> 归档条目**原文完整保留**；标题行下附一行归档元信息（`> 归档于 YYYY-MM-DD（原因：…）`）。\n' +
    '> 本目录已被 ctx 索引 `SKIP_DIRS` 排除，不在 `ctx/index.json` 中。\n'
  );
}

/** 读归档文件（缺失 → 返回带表头的初始内容）。 */
export function readArchiveFile(abs, label) {
  if (!existsSync(abs)) return archiveHeader(label);
  const t = readFileSync(abs, 'utf8');
  return t.trim() ? t : archiveHeader(label);
}

/** 归档一个条目：标题行 + 归档元信息 + 正文，追加到归档文件末尾。 */
export function appendArchivedEntry(archiveText, entry, { date, reason }) {
  const block = [entry.raw, `> 归档于 ${date}（原因：${reason}）`, ...entry.bodyLines];
  const base = archiveText.endsWith('\n') ? archiveText : `${archiveText}\n`;
  return `${base}\n${block.join('\n')}\n`;
}

/** 从归档条目正文中剥离归档元信息行（reactivate 时恢复原文）。 */
export function stripArchivedMeta(entry) {
  return entry.bodyLines.filter((l) => !ARCHIVED_META_RE.test(l));
}

// ─────────────────────────────────────────────────────────── 杂项 ──────────────

export function readText(abs) {
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}
