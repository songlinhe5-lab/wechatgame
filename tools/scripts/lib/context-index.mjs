/**
 * context-index.mjs — shared engine for the graded context index (WXG-T-024).
 *
 * One module builds the section-level index over every committed `.md`, and one
 * verifies that a checked-in `ctx/index.json` still matches the working tree.
 * `build-context-index.mjs` and `check-context-budget.mjs` both import from here
 * so the build and the guard can never disagree.
 *
 * DESIGN NOTES
 * ------------
 * • Section primary key is the **title path** (e.g. `§3.7 星级与结算`), not the
 *   line range — titles survive insertions above; line numbers do not.
 * • Output must be **byte-stable**: no timestamps, files sorted by path,
 *   sections sorted by line, fixed key order, 2-space indent, trailing newline.
 * • A section's line range **includes its descendants** (H2 spans its H3s), so
 *   an agent can read a whole `§3` or just `§3.7`.
 * • **Freshness contract anchors to committed content (WXG-T-026, 2026-09-12).**
 *   Dirty (uncommitted / untracked) files are hashed from their **HEAD blob**, so
 *   the index always describes what CI checks out. See the block below.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimateTokens } from './context-tokens.mjs';

/** Repository root (…/wechatgame). */
export const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

export const INDEX_PATH = join(ROOT, 'ctx', 'index.json');
export const BUDGET_MD_PATH = join(ROOT, 'ctx', 'BUDGET.md');
/** 产物相对路径（索引以相对 POSIX 路径为键；导出供 `ctx:check` 与自指集合对账，WXG-T-112）。 */
export const BUDGET_MD_REL = 'ctx/BUDGET.md';
/**
 * 热门大文件「章节 → 精确行号」速查（WXG-T-036，q-1）。
 *
 * 为什么需要它：ROUTES.md 给的是「意图 → 文件#锚点」，`ctx/index.json` 给的是锚点 → 行号，
 * 但 index.json 是**机器读的全量 JSON**（全部 .md），agent 直接读它代价极高。协议缺的正是
 * 「anchor → startLine/endLine」这一跳。本文件把**热 + 大**文件的这一跳单独摘出来，
 * 使 agent 能 `ROUTES.md → hot-files.md → read_file(offset,limit)` 三步闭链。
 */
export const HOT_FILES_MD_PATH = join(ROOT, 'ctx', 'hot-files.md');
/** 产物相对路径（同上，供对账用）。 */
export const HOT_FILES_MD_REL = 'ctx/hot-files.md';
export const EXEMPT_PATH = join(ROOT, 'ctx', 'budget-exempt.json');
export const ROUTES_PATH = join(ROOT, 'ctx', 'ROUTES.md');
/** 真实使用分布（由 analyze-context-usage.mjs 生成，build/check 消费）。 */
export const DIST_PATH = join(ROOT, 'ctx', 'usage-distribution.json');
/** E3 回归基线（手写配置，仿 budget-exempt.json；须含 reason + taskId）。 */
export const BASELINE_PATH = join(ROOT, 'ctx', 'savings-baseline.json');

export const INDEX_VERSION = 1;

/**
 * Directory names skipped anywhere in the tree.
 *
 * `archive`（WXG-T-029）：知识库归档目录 `knowledge/archive/` **不进索引面**——
 * 归档条目已从活跃读取协议移除，不应再出现在 `ctx/index.json` / `ctx/ROUTES.md` 的可用
 * 章节集合里；置于 SKIP_DIRS 还顺带覆盖未来的 `memory/archive/`。`kb:check` ③ 断言本集合
 * 含 `archive`（导出供其校验，避免两处各写一份）。
 *
 * `_repos`（WXG-T-176）：`my-skills/_repos/**` 是外来 skill 的上游 git 克隆，已由
 * `.gitignore` 忽略（内嵌仓只能记 gitlink，内容会静默丢失）。但**本生成器不读
 * `.gitignore`** —— 它按 `readdirSync` 走盘 + 只跳本集合（逐段 `entry.name` 匹配），
 * 所以“进 .gitignore = 不进索引”在这条链上**不成立**。2026-09-19 实例：vendor 快照入盘后
 * 一次重建就多出 **4.6 万行 / +1.17 MB**（`ctx/index.json` 2.51 MB → 3.68 MB）并被固化进提交。
 * ponytail: 硬编码目录名 = 单一机械开关；新 vendor 目录须同步加这里。
 * 升级路径：改用 `git check-ignore` / `git ls-files` 做唯一真源（价：多一层子进程与平台差异）。
 */
export const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'build',
  'dist',
  'coverage',
  'library',
  'temp',
  'local',
  'profiles',
  'native',
  '.smoke',
  'archive',
  '_repos',
]);

/**
 * Files that ride in the always-on resident layer.
 *
 * 导出（WXG-T-044）：`check-context-budget.mjs` 的 D2（第二跳覆盖率）要用它把
 * always 层从「ROUTES 引用面」中剔除——它们本就每会话整文件进上下文，不需要
 * `hot-files.md` 提供节行号，若计入分母会得到一个永远凑不满的覆盖率。
 * 导出以保持单一真源（生成器与门禁共用同一集合）。
 */
export const ALWAYS_FILES = new Set(['AGENTS.md', 'my-rules/INDEX.md', 'my-rules/agents-md.md']);

/** P0 high-frequency files — read often, big enough to be worth a section route. */
const HOT_FILES = new Set([
  'games/beads/design/gdd/systems-index.md',
  'docs/architecture/architecture-beads.md',
  'docs/architecture/control-manifest.md',
  'production/qa/beads/test-cases.md',
  'production/TASKS.md',
  'memory/MEMORY.md',
]);

/* ── 索引新鲜度契约：锚定「已提交内容（HEAD）」（WXG-T-026，2026-09-12）──────────
 *
 * 缺陷：本地跑 `ctx:build` 时，工作树里可能存在**并发会话未提交**的 .md。旧实现一律按
 *      工作树（未提交）内容算 sha256 入库 → CI 检出 HEAD 内容时哈希不符 → C 索引新鲜度
 *      FAIL（commit edbded7）。根因是**生成器把「部分提交的工作树」当成了真相**，
 *      在并发会话下必现。
 *
 * 契约：`ctx/index.json` 描述的是**已提交内容（HEAD）**。
 *   • 干净文件（已跟踪且无改动）→ 取**工作树**内容（= HEAD 内容，二者等价）；
 *   • dirty 文件（已跟踪但有改动）→ 取 **HEAD blob**（`git show HEAD:<path>`）参与哈希与
 *     token / 行数计算；
 *   • dirty 且 HEAD 不存在的**新文件** → **不入索引**（计入 `newFilesSkipped`）。
 * 效果：CI（干净检出）恒绿；本地 dirty 工作树同样通过校验，但**该文件的索引行号可能与
 *      本地工作树漂移**（索引描述 HEAD，不描述你的未提交改动）。
 *
 * 逃生阀：`--working-tree` 强制**全部**按工作树内容（生成器 / 门禁均支持），用于
 *        「我就是要按本地未提交内容看行号」的场景；此时输出显式标注「非默认模式」。
 *
 * 暂存区模式（WXG-T-032 ⑤，2026-09-13）：`--staged-blobs`——pre-commit 自动重建专用。
 *        背景：拦截式 pre-commit 被证实**结构性不可通过**——索引描述「HEAD」，而任何改被索引
 *        `.md` 的提交其暂存内容必然 ≠ HEAD 锚定的旧索引，只能靠 `--no-verify` 绕过。
 *        故 pre-commit 改为「自动重建 + 重新暂存」：暂存区中的 .md 按**暂存 blob**
 *        （`git show :<path>`，= 即将提交的内容）索引，暂存新文件一并纳入；其余文件维持
 *        committed 契约（未暂存 dirty → HEAD、干净 → 工作树）。产物随本次提交入库，
 *        `ctx:check --staged` 降为兜底终校验。
 */

/**
 * 由本工具自身生成、必须始终按**工作树**内容索引的文件。
 *
 * ⚠️ **凡 `ctx:build` 写盘的 .md 都必须列进本集合**（WXG-T-112；漏登记的后果 = 判例 BD-38）：
 * 少一个 ⇒ 该产物在提交索引里记的是**上一轮字节**，而钩子随后的 `git add` 把它的**新字节**
 * 送进暂存区 → `ctx:check --staged` 首遍必报「暂存内容与索引不一致」→ **每次涉及它的提交都要
 * 提交两遍**（2026-09-15 在 worktree 实测：`memory/INDEX.md` 漏登记时，三种起手——只暂存自有
 * 改动 / 手跑 build 并 add 产物 / 手跑 build 不 add产物——第一遍全红、第二遍才绿）。
 * 该坑不在本地 build 暴露，只惩罚每个提交的人 ⇒ `ctx:check` 有一条机械对账门守住此不变式，勿靠人记。
 * 下表写的是字面量而非 `MEMORY_INDEX_REL`：`lib/memory-index.mjs` 反向 import 本模块，引回来会成环；
 * 两处字面量不漂移由那条对账门守。
 */
export const WORKTREE_AUTHORITATIVE = new Set([
  'ctx/BUDGET.md',
  'ctx/hot-files.md',
  'memory/INDEX.md',
]);

/** 只读运行 git（调用方负责兜底异常）；cwd 固定为仓库根。 */
function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

/**
 * 计算 git 工作区「内容来源判定」所需的集合（三分支模式，WXG-T-026 / WXG-T-032 ⑤）。
 * @param {{mode?: 'committed' | 'working-tree' | 'staged-blobs'}} [opts]
 *   committed（默认）  → 索引描述已提交内容（HEAD）：dirty→HEAD blob、未跟踪→skip；
 *   working-tree      → 逃生阀：视作「无 dirty」，全部按工作树内容；
 *   staged-blobs      → pre-commit 自动重建（WXG-T-032 ⑤）：暂存区中的 .md 按暂存 blob
 *                       （`git show :<path>`，= 即将提交的内容）索引，暂存新文件一并纳入；
 *                       其余文件维持 committed 契约（未暂存 dirty → HEAD、干净 → 工作树）。
 * @returns {{ok: boolean, git: boolean, mode: string, workingTree: boolean,
 *            stagedBlobs: boolean, dirty: Set<string>, untracked: Set<string>,
 *            staged: Map<string, string>}}
 *   ok=false（非 git 仓库 / git 不可用）→ 调用方回退为纯工作树语义（等价干净检出）。
 *   `workingTree`/`stagedBlobs` 为布尔镜像（既有消费方沿用）；`staged` 仅 staged-blobs 模式非空。
 */
export function dirtySet({ mode = 'committed' } = {}) {
  /** committed 契约的 dirty / untracked 集合；git 不可用 → null。 */
  const committedStatus = () => {
    let out;
    try {
      // --no-renames：把重命名拆成 D+A 两条记录，避免 `-z` 下额外的源路径记录解析。
      out = git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames']);
    } catch {
      return null;
    }
    const dirty = new Set();
    const untracked = new Set();
    for (const rec of out.split('\0')) {
      if (!rec) continue;
      const code = rec.slice(0, 2);
      const path = rec.slice(3);
      if (!path) continue;
      dirty.add(path);
      if (code === '??') untracked.add(path);
    }
    return { dirty, untracked };
  };
  if (mode === 'working-tree') {
    return {
      ok: true, git: true, mode, workingTree: true, stagedBlobs: false,
      dirty: new Set(), untracked: new Set(), staged: new Map(),
    };
  }
  if (mode === 'staged-blobs') {
    const base = committedStatus();
    const st = stagedSet();
    if (base == null || !st.ok) {
      return {
        ok: false, git: false, mode, workingTree: false, stagedBlobs: true,
        dirty: new Set(), untracked: new Set(), staged: new Map(),
      };
    }
    return {
      ok: true, git: true, mode, workingTree: false, stagedBlobs: true,
      dirty: base.dirty, untracked: base.untracked, staged: st.staged,
    };
  }
  const base = committedStatus();
  if (base == null) {
    return {
      ok: false, git: false, mode: 'committed', workingTree: false, stagedBlobs: false,
      dirty: new Set(), untracked: new Set(), staged: new Map(),
    };
  }
  return {
    ok: true, git: true, mode: 'committed', workingTree: false, stagedBlobs: false,
    dirty: base.dirty, untracked: base.untracked, staged: new Map(),
  };
}

/** 读取工作树文件内容；缺失 / 读取失败 → null。 */
function readWorktree(relPath) {
  try {
    return readFileSync(join(ROOT, relPath), 'utf8');
  } catch {
    return null;
  }
}

/** 读取 HEAD 中该路径的 blob 内容；HEAD 无此文件（或非 git）→ null。 */
function readHeadBlob(relPath) {
  try {
    return git(['show', `HEAD:${relPath}`]);
  } catch {
    return null;
  }
}

/**
 * 读取**暂存区**（index vs HEAD）的文件状态集合（WXG-T-032 ③，pre-commit 前置校验用）。
 * 只读运行 git；非 git 仓库 / git 不可用 → ok=false（调用方显式降级，不假绿）。
 * @returns {{ok: boolean, git: boolean, staged: Map<string, string>}}
 *   Map<路径, 首字母状态（A/M/D…）>；`--no-renames` 下重命名拆为 D+A 两条。
 */
export function stagedSet() {
  let out;
  try {
    out = git(['diff', '--cached', '--name-status', '-z', '--no-renames']);
  } catch {
    return { ok: false, git: false, staged: new Map() };
  }
  const staged = new Map();
  // `-z` 下 `--name-status` 的状态码与路径是**相邻两条** NUL 记录（如 `M`、`AGENTS.md`）。
  const recs = out.split('\0');
  for (let i = 0; i < recs.length; i += 1) {
    const rec = recs[i];
    if (!rec) continue;
    if (/^[ACDMRTUXB]{1,2}$/.test(rec)) {
      const path = recs[i + 1];
      i += 1;
      if (path) staged.set(path, rec.slice(0, 1));
      continue;
    }
    // 兜底：部分 git 版本为 `XY\tpath` 单条记录。
    const m = /^([ACDMRTUXB]{1,2})\t(.+)$/.exec(rec);
    if (m) staged.set(m[2], m[1].slice(0, 1));
  }
  return { ok: true, git: true, staged };
}

/** 读取暂存区（stage 0）中该路径的 blob 内容；暂存区无此文件（或非 git）→ null。 */
export function readStagedBlob(relPath) {
  try {
    return git(['show', `:${relPath}`]);
  } catch {
    return null;
  }
}

/**
 * 按 WXG-T-026 / WXG-T-032 ⑤ 契约解析某被索引文件的**内容来源**。
 * @returns {{source: 'worktree' | 'head' | 'staged' | 'skip', text: string | null}}
 *   worktree = 取工作树内容；head = 取 HEAD blob；staged = 取暂存 blob（staged-blobs 模式）；
 *   skip = 不入索引（未跟踪新文件 / 内容源缺失）。
 */
export function resolveContent(relPath, gate) {
  const fromWorktree = () => {
    const text = readWorktree(relPath);
    return text == null ? { source: 'skip', text: null } : { source: 'worktree', text };
  };
  // 无 gate / 非 git / 逃生阀 / 本工具生成物 → 一律工作树。
  if (!gate || !gate.ok || gate.workingTree || WORKTREE_AUTHORITATIVE.has(relPath)) {
    return fromWorktree();
  }
  // staged-blobs 模式（WXG-T-032 ⑤）：暂存区条目按**暂存 blob**（= 即将提交的内容）。
  // 暂存 blob 读取失败（不应发生）→ 显式 skip，不静默改用工作树（避免把未暂存内容混进提交索引）。
  if (gate.stagedBlobs && gate.staged.has(relPath)) {
    const text = readStagedBlob(relPath);
    return text == null ? { source: 'skip', text: null } : { source: 'staged', text };
  }
  if (!gate.dirty.has(relPath)) return fromWorktree();
  // dirty：未跟踪（HEAD 无）→ 按契约不入索引。
  if (gate.untracked.has(relPath)) return { source: 'skip', text: null };
  const blob = readHeadBlob(relPath);
  if (blob == null) return { source: 'skip', text: null };
  return { source: 'head', text: blob };
}

/**
 * Budget thresholds (tokens, estimated).
 *
 * ⚠️ agentsMd 口径与裁定依据
 * ---------------------------------------------------
 * WXG-T-024（主理人裁决）：3000 → 3200。原 3000 疑似按「bytes / 4」口径校准，与本题的
 * 估算公式（`context-tokens.mjs`：CJK ≈ 1 token/字、ASCII ≈ 1/4 字符）**口径不一致**，
 * 导致同一份中文常驻文件在两种口径间出现「假性超限」。
 * WXG-T-032（2026-09-13，主理人裁定）：3200 → **2000**。依据：
 *   ① AGENTS.md 属 `always` 常驻层，**每会话整文件付费**，应只保留铁律 / 触发条件 / 路由指针；
 *   ② T-032 把 §5/§6/§8/§9 与 §2 细节逐字迁出至 `docs/agent/{repo-layout,commands,routing}.md`
 *      与 `ctx/ROUTES.md` / `knowledge/INDEX.md`，AGENTS.md 目标全文 ≤1700 估算 tokens；
 *   ③ 2000 在目标值之上留 ~18% 余量（对照旧口径 3200/2980 ≈ 7% 余量的比例尺）。
 * 改动须同步 `ctx/BUDGET.md`（由 ctx:build 生成）。
 */
export const LIMITS = {
  agentsMd: 2000,
  ruleFile: 500,
  fileMax: 8000,

  /*
   * ── hot-files.md 预算（WXG-T-036，q-1）───────────────────────────────────────
   *
   * 口径：`ctx/hot-files.md` 是**协议常驻的第二跳**（每会话读一次，与 ROUTES.md 同性质），
   *       因此它的体积会**直接扣减净收益**（见 analyze-context-usage.mjs 的 `netSavings.protocol`）。
   *       生成器**按优先级贪心填充**，超预算的候选文件**不写入**，并在文末「未收录」清单中
   *       如实列出（agent 改用 `ctx/index.json` 查那些文件），保证文件不会无声膨胀。
   *
   * 定值依据（实测，2026-09-13）：
   *   • 必收录集（`tier:hot` 6 文件 × 62 节）紧凑编码后 ≈2.6k tokens ——**无损**收录。
   *   • 可选池（实测热读或 ≥3000 tok 的非 hot 文件）共 88 个、全收 ≈35k tokens —— 显然不能全收。
   *   • 取 4000 = 必收录集 + 约 1.4k 可选额度（优先「实测读次数高 ∧ 体积大」者，ROI 最高）。
   * 代价须公开：本文件按协议**每会话读一次**计，抬升上限会**直接扣减**应然净收益
   * （`ctx/reads-summary.md §②.1` 同时列出「协议基线（仅 ROUTES）」与「含本表」两行，
   * 便于单独看到本表带来的那部分成本）。该值是**单常量**，增减一行即可调整。
   *
   * 该值同时是 `check-context-budget.mjs` A 项的判定上限；生成器与门禁**共用本常量**，
   * 因此正常路径恒绿，只有手改 / 索引爆炸才会触发。
   */
  // WXG-T-144：ROUTES 引用的文件改为**必收**（强制收录，见 renderHotFiles）⇒
  // 预算上调 4000→4700（常驻观察哨 13500 为软阈值，允许越）。
  hotFilesMaxTokens: 4700,

  /*
   * ── ROUTES.md 常驻预算（WXG-T-039 R5）────────────────────────────────────────
   *
   * 口径：`ctx/ROUTES.md` 是**协议常驻第二跳**（每会话必读一次），其体积直接扣减
   *       净收益（E4 应然列）。审计（2026-09-13）认定其为**无护栏增长点**——它是
   *       **手维护路由表**（被索引但非生成物），此前没有任何体积上限，唯一可能
   *       拦住它的是 B 项通用单文件上限 8000，对现值 6235 形同虚设。
   *
   * 定值依据（实测 2026-09-13，估算 tokens）：
   *   • 现值 6235（WXG-T-044 提交记录：5881 → 6235，协议应然净收益 28.9% → 28.3%）。
   *   • 上限须 ≥ 现值且留合理余量，但要有**真实约束能力**：取 7500 ≈ 现值 +20.3%
   *     （给定建议区间 +15~25% 的中位），且**低于** B 项通用上限 8000——保证
   *     ROUTES 永远先于通用门被拦下，不依赖豁免流程。
   * 该值同时是 check-context-budget.mjs A 项判定上限与 build-context-index.mjs
   * BUDGET.md A 项表展示上限（两侧经 residentLimit() 单一真源，禁止另写一份）。
   */
  routesMd: 7500,

  /*
   * ── 常驻总量观察哨（WXG-T-039 R5，报告项，不阻断）────────────────────────────
   *
   * AGENTS.md + my-rules/*.md + ctx/hot-files.md + ctx/ROUTES.md 是每次会话的
   * **固定常驻开销**。单文件上限各自为政时，总量仍可漂移——各文件同时逼近各自
   * 上限的合计可达 2000 + 500×2 + 4000 + 7500 = 14500。取 **13500** = 现值
   * 12372（2026-09-13 HEAD 实测）的 ≈ +9%、上限合计的 ≈ −7%：先于「上限合计」
   * 触发醒目提示，给瘦身动作留出窗口。**仅提示不阻断**（硬阻断只挂各单文件门）。
   */
  residentTotalSoft: 13500,

  /*
   * ── 第二跳覆盖率下限（WXG-T-044）─────────────────────────────────────────────
   *
   * 口径：`ctx/ROUTES.md` 引用到的文件（去掉 `ctx/` 生成物与 always 常驻层），
   *       有多大比例能在 `ctx/hot-files.md` 里查到 `offset`/`limit`。
   *
   * 为什么是**硬门**而非报告项：它衡量两个产物之间的**衔接完备性**（结构指标），
   *       取值与「历史会话读了什么」无关，故不受 WXG-T-026「E1/E2 行为类指标降级为
   *       报告项」裁定约束。它的退化是**本仓可修的确定性缺陷**——ROUTES 引用了新文件
   *       却忘了让它进第二跳——必须在 PR 处拦下，否则 agent 只能退到机器读的全量
   *       `ctx/index.json`（≈195k 估算 tokens），协议在最需要处断链。
   *
   * 阈值依据：ROUTES 引用面有限（当前 19 个文件），要求 1.0 会把「预算刚好差一行」
   *       也判失败；跌到 0.9 以下意味着至少 2 个路由目标断链，属实质退化。
   */
  hotFilesCoverageMin: 0.9,

  /*
   * ── E 项阈值（WXG-T-026 ④）：分层上下文节省装置的「效果」护栏 ────────────────
   *
   * 口径：token 一律为**估算**（`context-tokens.mjs` 公式：CJK≈1/字、ASCII≈1/4 字符）；
   *       样本 = 本机 IDE 读事件账本 `ctx/reads-ledger.jsonl` → 分布 `ctx/usage-distribution.json`。
   *
   * ⚠️ 裁定留痕（WXG-T-026，2026-09-12，主理人裁定；用于小步收口 E 项阻断语义）
   * ----------------------------------------------------------------
   * 依据：E1（节省率）/E2（护栏）是**行为类指标**，其取值取决于**历史会话分布**
   *       （读哪些文件、读多碎），不是本次改动的因果产物 —— **不应作为无关 PR 的合并硬门**。
   * 处置（分层）：
   *   • E1 + E2 → **报告项**：未达标如实输出 ❌/数字 + WARN，但**不阻断** CI（exit 0）。
   *   • E3（基线回归，见 baselineSavingsTol / baselineCount*Tol）→ **硬门**：劣于容忍带 → FAIL + exit 1。
   *   • A/B/C/D 结构门 → **硬门**（不变）。
   * 注意：以下 E1 阈值常量（0.70 / 0.40）**一个都没改**，仍是报告比对口径，仅把「不达标」的
   *       处置由 FAIL 改为 WARN 报告；判定汇聚处见 `check-context-budget.mjs` 头部与 checkE()。
   */
  // 样本不足阈值：账本读取事件少于此数 → E 项判 WARN（未判定、不假绿），exit 0。
  // 依据：低于 30 次读取时中位数/P10 抖动过大，任何判定都不可复现。
  usageMinSamples: 30,
  // E1 报告项（仅 `fullFile === false` 且能归属章节的锚点式局部读）：单次节省率 中位数 / P10。
  // ⚠️ 裁定（WXG-T-026，2026-09-12）：降级为报告项 —— 未达标只输出 ❌/数字 + WARN，**不阻断** CI；
  //    数值本身**不变**（0.70 / 0.40），仅作报告比对口径。
  savingsMedianPartial: 0.7,
  savingsP10Partial: 0.4,
  // E3 容忍带（**硬门**）：节省率类指标劣于基线超过该「绝对百分点」即 FAIL。依据：率差 ≤2pt 视为采样噪声，
  // 超过 2pt 说明分布实质变差（读得更满/更碎）。
  baselineSavingsTol: 0.02,
  /*
   * E3 容忍带（**硬门**）：**比率类**指标（抖动率 / 大文件整文件读率）劣于基线超过该「绝对百分点」即 FAIL。
   *
   * 口径升级理由（WXG-T-026 复验 F-02）：
   *   基线冻结的是**含活动会话的快照**（`ctx/reads-ledger.jsonl` 至少含 1 个「边写边采」的根会话），
   *   重采（`pnpm run ctx:reads`）会使抖动组数 / 大文件整文件读**计数自然增长**；若沿用计数容忍带
   *   `max(2, 基线×20%)`，样本一漂移就越界 → 误报「真实退化 FAIL」。故判定依据改为**比率**
   *   （分子分母随样本同步增长，近似平稳）：
   *     • 抖动率        = 抖动组数 ÷ 不同 (ide,session,path) 小读组数
   *     • 大文件整文件读率 = 大文件整文件读次数 ÷ 总读次数
   *   **原始计数仍如实展示**（仅供人看/追溯），不再作为判定依据。5pt 依据：比率取值 0–1、样本 ~500，
   *   二项近似标准误 ≈0.02，5pt ≈ 2.5σ，可容采样噪声而不放过实质退化。
   */
  baselineRateTol: 0.05,
  // ── 以下计数容忍带为 **legacy**（仅当基线为旧版 version<2、无比率字段时回退使用，见 checkE）——
  //    新基线一律走 baselineRateTol。
  baselineCountAbsTol: 2,
  baselineCountRelTol: 0.2,
};

/**
 * A 项常驻层单文件的**上限映射**（WXG-T-039 R5）。
 *
 * `build-context-index.mjs`（BUDGET.md §1 表的「上限」列）与
 * `check-context-budget.mjs`（A 项判定）**共用本函数**，保证门禁读数与报表展示
 * 同源、不出现两处硬编码上限。
 *
 * 覆盖面 = always 层（AGENTS.md、my-rules/*.md）+ 协议常驻第二跳两个产物
 * （`ctx/hot-files.md`、`ctx/ROUTES.md`——后者是手维护路由表，唯一护栏即本映射）。
 * @param {string} relPath 仓库相对路径
 * @returns {number} 估算 tokens 上限
 */
export function residentLimit(relPath) {
  if (relPath === 'AGENTS.md') return LIMITS.agentsMd;
  if (relPath === 'ctx/ROUTES.md') return LIMITS.routesMd;
  if (relPath === 'ctx/hot-files.md') return LIMITS.hotFilesMaxTokens;
  return LIMITS.ruleFile;
}

/** 常驻总量观察哨覆盖的**协议常驻第二跳**文件（WXG-T-039 R5；always 层之外追加进 A 项的行）。 */
export const RESIDENT_PROTOCOL_FILES = ['ctx/hot-files.md', 'ctx/ROUTES.md'];

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function toPosix(p) {
  return p.split(sep).join('/');
}

/** Recursively list every `.md` (dot-dirs and SKIP_DIRS excluded), path-sorted. */
export function listMarkdown() {
  const out = [];
  (function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.md')) out.push(toPosix(relative(ROOT, full)));
    }
  })(ROOT);
  return out.sort();
}

function tierFor(relPath) {
  if (ALWAYS_FILES.has(relPath)) return 'always';
  if (HOT_FILES.has(relPath)) return 'hot';
  return 'normal';
}

/** Normalise a heading into its anchor: `3.7 星级与结算` → `§3.7 星级与结算`. */
function makeAnchor(rawTitle) {
  let t = rawTitle.trim().replace(/\s*\{#[^}]+\}\s*$/, '').trim();
  if (t.startsWith('§')) return t;
  const m = /^(\d+(?:\.\d+)*)\.?\s+(.*)$/.exec(t);
  if (m) return `§${m[1]} ${m[2]}`.trim();
  return `§${t}`.trim();
}

/** Collect H1–H3 headings, ignoring any that live inside a fenced code block. */
function parseHeadings(lines) {
  const headings = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (m) headings.push({ level: m[1].length, raw: m[2], line: i + 1 });
  }
  return headings;
}

const isTableRow = (t) => /^\|.*\|\s*$/.test(t);
const isTableSep = (t) => /^\|?[\s:|-]*-{2,}[\s:|-]*\|?\s*$/.test(t);

function cleanInline(text) {
  return text
    .replace(/^[>|*+\-•\s]+/, '')
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First meaningful line after a heading, markdown-flattened, ≤60 chars. */
function firstSentence(lines, startIdx, endIdx) {
  let i = startIdx;
  while (i < endIdx) {
    const raw = lines[i].trim();
    if (!raw) { i += 1; continue; }
    if (/^#{1,3}\s/.test(raw)) break;
    if (/^(```|~~~)/.test(raw)) break;
    if (isTableSep(raw)) { i += 1; continue; }
    // Table header row followed by a separator → use the first data row instead.
    if (isTableRow(raw) && i + 1 < endIdx && isTableSep(lines[i + 1].trim())) {
      const data = cleanInline(lines[i + 2] ?? '');
      return data.length > 60 ? data.slice(0, 60) : data;
    }
    const cleaned = cleanInline(raw);
    if (!cleaned) { i += 1; continue; }
    return cleaned.length > 60 ? cleaned.slice(0, 60) : cleaned;
  }
  return '';
}

/** Keywords from the title + first sentence: backticks, § refs, ids, CJK words. */
function extractKeywords(rawTitle, summary) {
  const out = [];
  const push = (s) => {
    const v = String(s).trim();
    if (v && v.length <= 32 && !out.includes(v)) out.push(v);
  };
  for (const m of rawTitle.matchAll(/`([^`]+)`/g)) push(m[1]);
  for (const m of summary.matchAll(/`([^`]+)`/g)) push(m[1]);
  const both = `${rawTitle} ${summary}`;
  for (const m of both.matchAll(/§\d+(?:\.\d+)*[A-Za-z]?/g)) push(m[0]);
  for (const m of both.matchAll(/[A-Za-z][A-Za-z0-9_]{2,}/g)) push(m[0]);
  for (const m of rawTitle.matchAll(/[\u4e00-\u9fff]{2,6}/g)) push(m[0]);
  return out.slice(0, 6);
}

/** Build the section list for one file's text. */
function buildSections(text) {
  const lines = text.split('\n');
  const headings = parseHeadings(lines);
  const sections = [];
  const seen = new Map();
  for (let i = 0; i < headings.length; i += 1) {
    const h = headings[i];
    let endLine = lines.length;
    for (let j = i + 1; j < headings.length; j += 1) {
      if (headings[j].level <= h.level) { endLine = headings[j].line - 1; break; }
    }
    let anchor = makeAnchor(h.raw);
    if (seen.has(anchor)) {
      const n = seen.get(anchor) + 1;
      seen.set(anchor, n);
      anchor = `${anchor} (${n})`;
    } else {
      seen.set(anchor, 1);
    }
    const body = lines.slice(h.line, endLine).join('\n');
    const summary = firstSentence(lines, h.line, endLine);
    sections.push({
      anchor,
      level: h.level,
      startLine: h.line,
      endLine,
      tokens: estimateTokens(body),
      summary,
      keywords: extractKeywords(h.raw, summary),
    });
  }
  return sections;
}

/**
 * Build one file record from a file's text (pure; reusable + testable).
 *
 * 导出（WXG-T-106）：`split-memory-detail.mjs` 与桩自测需要**与门禁逐字同口径**的节
 * 解析（anchor / tokens）。此前该逻辑在被调方内联复制一份，两份一旦走散就会造出
 * 「隶属标记对不上 anchor」的静默孤儿；改为共用本函数后不可能漂移。
 */
export function makeFileRecord(relPath, text) {
  const trimmed = text.endsWith('\n') ? text.slice(0, -1) : text;
  return {
    path: relPath,
    tokens: estimateTokens(text),
    lines: trimmed.split('\n').length,
    sha256: sha256(text),
    tier: tierFor(relPath),
    sections: buildSections(text),
  };
}

/**
 * Build one file record, choosing its content per the WXG-T-026 contract.
 * @returns {object | null} null when the file is skipped (untracked new file / missing).
 */
export function buildFileRecord(relPath, gate = null) {
  const r = resolveContent(relPath, gate);
  if (r.text == null) return null;
  return makeFileRecord(relPath, r.text);
}

/**
 * Build the whole index object (deterministic + byte-stable).
 * @param {{mode?: 'committed' | 'working-tree' | 'staged-blobs'}} [opts]
 *   mode 语义见 `dirtySet()`；默认 committed（索引描述已提交内容 HEAD，WXG-T-026）；
 *   staged-blobs = pre-commit 自动重建（暂存 .md 按暂存 blob 内容，WXG-T-032 ⑤）。
 * @returns {{index: object, meta: {git: boolean, mode: string, workingTree: boolean,
 *            stagedBlobs: boolean, headIndexed: string[], stagedIndexed: string[],
 *            newFilesSkipped: string[]}}}
 *   `index` 是可序列化产物（**不含** meta，保证字节稳定）；`meta` 仅供调用方打印提示。
 */
export function buildIndex({ mode = 'committed' } = {}) {
  const gate = dirtySet({ mode });
  const headIndexed = [];
  const stagedIndexed = [];
  const newFilesSkipped = [];
  const files = [];
  for (const rel of listMarkdown()) {
    const r = resolveContent(rel, gate);
    if (r.text == null) {
      newFilesSkipped.push(rel);
      continue;
    }
    if (r.source === 'head') headIndexed.push(rel);
    if (r.source === 'staged') stagedIndexed.push(rel);
    files.push(makeFileRecord(rel, r.text));
  }
  return {
    index: {
      version: INDEX_VERSION,
      generatedBy: 'tools/scripts/build-context-index.mjs',
      files,
    },
    meta: {
      git: gate.git,
      mode: gate.mode,
      workingTree: gate.workingTree,
      stagedBlobs: gate.stagedBlobs,
      headIndexed,
      stagedIndexed,
      newFilesSkipped,
    },
  };
}

/** Stable JSON serialisation — 2-space indent, trailing newline, no timestamps. */
export function serializeIndex(index) {
  return `${JSON.stringify(index, null, 2)}\n`;
}

/** Read the committed index, or null when it is absent / unparseable. */
export function readIndex() {
  try {
    return JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Compare the committed index against the repo, using the SAME content contract as
 * `buildIndex` (WXG-T-026): dirty files are checked against their HEAD blob, so a
 * clean CI checkout and a dirty local tree agree. Untracked new `.md` are omitted
 * by contract → not reported as "unindexed".
 * @param {{workingTree?: boolean}} [opts] workingTree=true → 逃生阀：全部按工作树内容。
 * @returns {{stale: {path: string, reason: string}[], unindexed: string[],
 *            headChecked: string[], git: boolean, workingTree: boolean}}
 */
export function freshnessIssues(index, { workingTree = false } = {}) {
  // 注：freshnessIssues 只支持 committed / working-tree 两模式；暂存区校验由
  // check-context-budget.mjs 的 checkStagedFreshness() 承担（--staged，WXG-T-032 ③⑤）。
  const gate = dirtySet(workingTree ? { mode: 'working-tree' } : {});
  const stale = [];
  const indexed = new Set();
  const headChecked = [];
  for (const f of index?.files ?? []) {
    indexed.add(f.path);
    const r = resolveContent(f.path, gate);
    if (r.text == null) {
      stale.push({ path: f.path, reason: r.source === 'skip' ? '文件缺失（HEAD 与工作树均无）' : '文件缺失' });
      continue;
    }
    if (r.source === 'head') headChecked.push(f.path);
    if (sha256(r.text) !== f.sha256) {
      stale.push({
        path: f.path,
        reason: r.source === 'head' ? '内容已变更（HEAD blob 与索引不符）' : '内容已变更（sha256 不符）',
      });
    }
  }
  const unindexed = [];
  for (const p of listMarkdown()) {
    if (indexed.has(p)) continue;
    // 未跟踪新文件（或缺失）按契约不入索引 → 不算「未收录」。
    if (resolveContent(p, gate).text == null) continue;
    unindexed.push(p);
  }
  return { stale, unindexed, headChecked, git: gate.git, workingTree: gate.workingTree };
}

/** Convenience for the guard: does the on-disk file exist? */
export function fileTokens(relPath) {
  const text = readFileSync(join(ROOT, relPath), 'utf8');
  return estimateTokens(text);
}

export function exists(relPath) {
  try {
    statSync(join(ROOT, relPath));
    return true;
  } catch {
    return false;
  }
}

/** 读取真实使用分布（`ctx/usage-distribution.json`）；缺失 / 解析失败 → null。 */
export function readDistribution() {
  try {
    return JSON.parse(readFileSync(DIST_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 解析 `ctx/ROUTES.md` 中的 `路径#锚点` 引用，返回顺次去重的锚点集。
 * 用途：当真实分布样本不足时，`ctx/BUDGET.md §4` 回退展示该「ROUTES 锚点集」，
 * 并在报表显式标注「样本不足」，绝不静默沿用旧硬编码常量。
 * @param {number} limit 最多返回多少条
 * @returns {{path: string, anchor: string}[]}
 */
export function routesAnchorRefs(limit = 15) {
  let text;
  try {
    text = readFileSync(ROUTES_PATH, 'utf8');
  } catch {
    return [];
  }
  const out = [];
  const seen = new Set();
  const re = /((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.md)#([^|\n]*)/g;
  for (const line of text.split('\n')) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      const path = m[1];
      const anchor = m[2].trim();
      if (!anchor) continue;
      const key = `${path}#${anchor}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ path, anchor });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * 解析 `ctx/ROUTES.md` 中被引用到的**文件路径集合**（WXG-T-044）。
 *
 * 为什么需要它：`ctx/hot-files.md` 存在的唯一理由是补齐「ROUTES 锚点 → `offset`/`limit`」
 * 这一跳。若 ROUTES 引用到的文件却查不到行号，agent 只能退到 `ctx/index.json`
 * （全量 JSON，≈195k 估算 tokens，机器读才划算）——协议链路**恰好在最需要的地方断开**。
 * 故「ROUTES 引用面」必须是第二跳收录的**最高优先级**，并由门禁 D2（覆盖率硬门）守住。
 *
 * 与 `routesAnchorRefs()` 的分工：后者按行序返回**前 N 条** `路径#锚点` 供 BUDGET 报表展示；
 * 本函数返回**全量去重路径集合**，作为生成器选池与门禁判据的**唯一真源**（两侧共用，
 * 避免两处各写一份正则而漂移）。
 *
 * 排除项：`ctx/` 下的生成物（自引用会把装置开销滚成雪球，与 renderHotFiles 同口径）。
 * @returns {Set<string>} 去重后的仓库相对路径
 */
export function routesReferencedPaths() {
  let text;
  try {
    text = readFileSync(ROUTES_PATH, 'utf8');
  } catch {
    return new Set();
  }
  const paths = new Set();
  const re = /((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.md)#/g;
  for (const line of text.split('\n')) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      if (!m[1].startsWith('ctx/')) paths.add(m[1]);
    }
  }
  return paths;
}

/* ── ctx/hot-files.md：热门大文件「章节 → 精确行号」速查（WXG-T-036，q-1）────────────
 *
 * 职责边界（避免与既有产物重复）：
 *   • `ctx/ROUTES.md`      —— 意图 → `路径#锚点`（**不**给行号）
 *   • `ctx/index.json`     —— 全量锚点 → 行号（机器读，体量大，agent 不宜直读）
 *   • `ctx/hot-files.md`（本函数）—— **热 + 大**文件的「锚点 → offset/limit」一跳
 * 三者拼起来才是完整链路：ROUTES → hot-files → `read_file(offset, limit)`。
 *
 * 生成规则（确定性 + 字节稳定）：
 *   • **必收录**：`tier === 'hot'` 的文件（协议主路由指向的目标，收了才闭环）。
 *   • **次必收录（WXG-T-044）**：`ctx/ROUTES.md` 引用到的文件——第二跳存在的唯一理由
 *     就是补齐「ROUTES 锚点 → `offset`/`limit`」，故它们排在实测热度之前。
 *   • **可选收录**：实测被读过（`dist.files[].sections[].reads`）或体积 ≥ HOT_FILE_MIN_TOKENS
 *     的 `.md`，按「ROUTES 引用 ↓ / 实测读次数 ↓ / 体积 ↑ / 路径 ↑」贪心填充。
 *   • **排除** `ctx/` 下的生成物（自引用会把装置开销滚成雪球）与 always 常驻层
 *     （AGENTS.md 等本就每会话整文件进上下文，给「节行号」无意义）。
 *   • 超预算候选**不写入**；文末「未收录」**只逐条列 ROUTES 引用到的落选文件**
 *     （它们是协议链路真会断的节点），其余落选文件只给一行计数——旧版逐条列出 84 条
 *     （≈1270 tok）中 77 条与路由读取无关，属纯常驻开销。
 *   • 不带日期：本文件是索引的**纯函数**，才可参与 build 的不动点收敛与 pre-commit 复算。
 */

/** 单文件达到此估算 token 即视为「大文件」，值得配行号速查。 */
export const HOT_FILE_MIN_TOKENS = 3000;

/**
 * 从真实使用分布取「每个文件的实测读次数」。
 * @param {object | null} dist `ctx/usage-distribution.json` 内容
 * @returns {Map<string, number>} path → reads
 */
export function fileReadsFromDist(dist) {
  const m = new Map();
  for (const f of dist?.files ?? []) {
    const reads = (f.sections ?? []).reduce((n, s) => n + (s.reads ?? 0), 0);
    if (reads > 0) m.set(f.path, reads);
  }
  return m;
}

/** 渲染一个文件的行号速查块（不含文档头尾）。 */
function renderHotFileBlock(f, reads) {
  const L = [];
  L.push(
    `## \`${f.path}\` — ${f.lines} 行 / ${f.tokens} tok${reads > 0 ? ` / 实测读 ${reads} 次` : ''}`,
  );
  L.push('');
  if (f.sections.length === 0) {
    L.push('（无可路由小节：整文件读取）');
    L.push('');
    return L;
  }
  // 紧凑单行编码：`锚点=offset+limit`（分隔符 ` · `）。
  // 为什么不用表格：62 行的表格每行多花 ~10 tokens 的管道/对齐开销，
  // 实测 2769 tok（超预算）；紧凑编码在不删任何小节的前提下压到 ~1.9k。
  L.push(f.sections.map((s) => `${s.anchor}=${s.startLine}+${s.endLine - s.startLine + 1}`).join(' · '));
  L.push('');
  return L;
}

/**
 * 渲染 `ctx/hot-files.md` 全文（确定性 + 字节稳定，无时间戳）。
 * @param {{files: object[]}} index `ctx/index.json` 内容
 * @param {object | null} [dist] 真实使用分布；缺失 → 退化为「仅按体积选大文件」
 * @returns {string}
 */
export function renderHotFiles(index, dist = null) {
  const reads = fileReadsFromDist(dist);
  const files = index?.files ?? [];
  // 排除 `ctx/` 生成物（自引用会把装置开销滚成雪球）与 always 常驻层
  // （它们本就每会话整文件进上下文，给「节行号」没有意义，只会白占第二跳预算）。
  const excluded = (p) => p.startsWith('ctx/') || ALWAYS_FILES.has(p);
  // ROUTES 引用面（WXG-T-044）：第二跳的意义就是补齐「ROUTES 锚点 → offset/limit」，
  // 故被 ROUTES 引用到的文件必须优先收录，否则 agent 只能退机器读的全量 index.json。
  const routed = routesReferencedPaths();

  const required = files.filter((f) => f.tier === 'hot' && !excluded(f.path));
  const requiredPaths = new Set(required.map((f) => f.path));
  const optional = files
    .filter(
      (f) =>
        !excluded(f.path) &&
        !requiredPaths.has(f.path) &&
        // 准入（WXG-T-044 追加第一项）：ROUTES 引用的文件**无条件进池**。
        // 旧规则只认「实测读过 ∨ ≥3000 tok」，会让 ROUTES 引用的中小文件
        // （repo-layout / commands / routing / my-agents/INDEX…）全部落选，
        // 协议链路恰好在**最需要它的地方**断开。
        (routed.has(f.path) ||
          (reads.get(f.path) ?? 0) > 0 ||
          f.tokens >= HOT_FILE_MIN_TOKENS),
    )
    .sort(
      (a, b) =>
        // ① ROUTES 引用优先（协议闭环 > 历史热度）
        Number(routed.has(b.path)) - Number(routed.has(a.path)) ||
        // ② 实测读次数降序
        (reads.get(b.path) ?? 0) - (reads.get(a.path) ?? 0) ||
        // ③ 体积**升序**：同热度下先收小的 → 同预算覆盖更多文件。行号按节编码，
        //    小文件常只有 1–3 节，收它几乎不花预算；旧的「大者优先」会把预算
        //    耗尽在少数巨型文件上，反而降低路由目标的覆盖数。
        a.tokens - b.tokens ||
        a.path.localeCompare(b.path),
    );

  const render = (chosen, omitted, overBudget = false) => {
    const L = [];
    L.push('# 热门大文件行号速查（自动生成，勿手改；重建 `pnpm run ctx:build`）');
    L.push('');
    L.push('> **协议第二跳**：`ctx/ROUTES.md` 给「意图 → `文件#锚点`」，本表把锚点换算成可直接用的 `offset` / `limit`。');
    L.push('> 读法：`read_file(path, offset, limit)` —— **只取该节**，勿对大文件无条件整读。');
    L.push('> 行内格式：`锚点=offset+limit`（`limit` 已算好）；` · ` 分隔小节。');
    L.push('> 收录：**热文件 + `ctx/ROUTES.md` 引用到的文件 + 实测热读/大文件**；查不到 → `ctx/index.json`（全量，机器读更划算）。token 为**估算**（CJK≈1/字、ASCII≈1/4 字符）。');
    L.push('');
    L.push(
      `> 体积预算 ≤ ${LIMITS.hotFilesMaxTokens} 估算 tokens（当前 ${chosen.length} 个文件）：本表是协议常驻开销，` +
        '会**直接扣减净收益**（`ctx/reads-summary.md §②.1`），故超预算候选不进本表。',
    );
    if (overBudget) {
      // 诚实失败：必收录集（tier:hot）不可裁撤，若它自己就超预算，只能越界并在门禁 A 项 FAIL。
      L.push(
        '> ⚠️ **已超预算**：必收录集（`tier:hot` 的 6 个文件）本身超出预算，且它们的行号不可省略。' +
          '请调大 `LIMITS.hotFilesMaxTokens`（代价见 §②.1）或裁剪 hot 文件的章节结构。',
      );
    }
    L.push('');
    for (const f of chosen) L.push(...renderHotFileBlock(f, reads.get(f.path) ?? 0));
    // 未收录清单（WXG-T-044 瘦身）：**只逐条列 ROUTES 引用到的落选文件**——
    // 它们是协议链路上真会断的节点，agent 需要知道「这个路由目标要另查 index.json」。
    // 其余落选文件（既非 ROUTES 引用、也未命中热度/体积门槛）对路由读取无动作可执行，
    // 逐条列出纯属常驻开销（旧版 84 条 / ≈1270 tok，其中 77 条属此类）→ 只给一行计数。
    const routedOmitted = omitted.filter((f) => routed.has(f.path));
    const restOmitted = omitted.length - routedOmitted.length;
    if (routedOmitted.length > 0) {
      L.push('## 未收录 · ROUTES 引用的文件（超预算 → 查 `ctx/index.json`）');
      L.push('');
      L.push(
        '> 下列文件被 `ctx/ROUTES.md` 引用，但未进本表；其锚点行号请查 `ctx/index.json`（全量索引，机器读更划算）。',
      );
      L.push('');
      for (const f of routedOmitted) L.push(`- \`${f.path}\`（${f.tokens} tok）`);
      L.push('');
    }
    if (restOmitted > 0) {
      L.push(
        `> 另有 ${restOmitted} 个文件既未被 \`ctx/ROUTES.md\` 引用、也未命中热度/体积门槛，` +
          '与路由读取无关，故不逐条列出（需要时查 `ctx/index.json`）。',
      );
      L.push('');
    }
    return L.join('\n');
  };

  // 选收录集：在 optional 前缀上取「最大的 L 使文档 ≤ 预算」。
  //
  // 为什么是**前缀扫描**而不是逐个贪心：文末「未收录」清单本身占体积，且**后跳过的文件会追加进该清单**。
  // 逐个贪心时，接受第 k 个文件用的是「当时的 omitted」，而后续跳过的文件会把清单撑大 →
  // 最终文档比当时估计的**更大**，从而越界（实测踩坑：自评 ≤4000、落盘 4540）。
  // 前缀扫描保证：每个候选要么进本表、要么进未收录清单，二者只居其一，估计与落盘一致。
  // 大小关于 L 单调（入选块 ≈30×节数 ≫ 未收录行 ≈12 tok），故首次越界即可停。
  let best = 0;
  for (let L = 1; L <= optional.length; L += 1) {
    const doc = render([...required, ...optional.slice(0, L)], optional.slice(L));
    if (estimateTokens(doc) > LIMITS.hotFilesMaxTokens) break;
    best = L;
  }
  // WXG-T-144（D2 断链根治）：ROUTES 引用的文件**必收** —— 它们是协议第二跳的
  // 正道目标；被前缀扫描裁掉的（超预算巨文件：TASKS-DETAIL 15.6k / cocos-setup 7.3k）
  // 若落「未收录」节，D2 硬门仍判断链（生成器与守卫规则不一致）。改为**强制收录**：
  // 文档可能超预算 ⇒ A 项如实 FAIL 并提示调 LIMITS（诚实失败机制已内建）。
  const routedOmitted = optional.slice(best).filter((f) => routed.has(f.path));
  const chosen = [...required, ...optional.slice(0, best), ...routedOmitted];
  const omitted = optional.slice(best).filter((f) => !routed.has(f.path));
  const doc = render(chosen, omitted);
  // 兜底：必收录集自身超预算时如实标注（不得静默越界），由门禁 A 项 FAIL 暴露。
  if (estimateTokens(doc) > LIMITS.hotFilesMaxTokens) return render(chosen, omitted, true);
  return doc;
}
