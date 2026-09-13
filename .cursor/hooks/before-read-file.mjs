#!/usr/bin/env node
/**
 * Cursor `beforeReadFile` **log-only 探针**（WXG-T-036，q-3）。
 *
 * 唯一目的：实测该事件的 stdin 载荷**是否含 `offset` / `limit`（或等价行区间字段）**。
 * 缺口来源：`docs/agent/context-instrumentation-survey.md` §4「共同缺口」指出四家 IDE 的随附文档
 * 均未列明读事件的区间字段 → 需一次实测才能判定 hook 埋点能否替代转录解析。
 *
 * 铁律（零风险设计，违反即事故）：
 *   1. **恒放行**：始终输出 `{"permission":"allow"}`，任何分支都**不得** deny/ask。
 *      `hooks.json` 亦设 `failClosed:false` —— 探针崩了也**不能**挡住读文件。
 *   2. **不写账本**：只写 `.read-probe.jsonl`（gitignore 内），**不碰** `ctx/reads-ledger.jsonl`，
 *      不改采集/分析口径、不改任何门禁语义。
 *   3. **不落正文**：只记键名/类型/长度；疑似正文的键一律 `<redacted>`。
 *   4. **限额**：日志超过 `MAX_LOG_BYTES` 自动截断，避免长期驻留把仓库撑大。
 *
 * 用法：无需手动调用（由 `.cursor/hooks.json` 注册）。实测步骤见文件末尾注释。
 */

import { appendFileSync, renameSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 探针日志（gitignore 内，不属项目资产）。 */
const LOG_PATH = fileURLToPath(new URL('./.read-probe.jsonl', import.meta.url));
const MAX_LOG_BYTES = 1_000_000;
/** 单值字符串最长记录长度；超出只记长度。 */
const MAX_STR = 120;
/** 递归展开深度上限。 */
const MAX_DEPTH = 2;
/** 疑似文件正文的键（只记长度，绝不落内容）。 */
const CONTENT_KEY_RE = /(content|text|body|code|patch|source|file_content)/i;
/** 行区间候选键（本探针要回答的问题就是它们存在与否）。 */
const RANGE_KEY_RE = /^(offset|limit|start_?line|end_?line|line_?start|line_?end|from_?line|to_?line|range|line_?range)$/i;

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(chunks.join('')));
    // 兜底：stdin 不关闭也不至于挂死（hook 超时前主动放行）。
    setTimeout(() => resolve(chunks.join('')), 3000).unref?.();
  });
}

/** 脱敏：保留结构信号（键名/类型/长度），丢弃正文。 */
function sanitize(v, depth = 0) {
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.length <= MAX_STR ? v : `<string len=${v.length}>`;
  if (Array.isArray(v)) {
    if (depth >= MAX_DEPTH) return `<array len=${v.length}>`;
    return { __array: v.length, head: v.slice(0, 5).map((x) => sanitize(x, depth + 1)) };
  }
  if (typeof v === 'object') {
    if (depth >= MAX_DEPTH) return `<object keys=${Object.keys(v).length}>`;
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (CONTENT_KEY_RE.test(k)) {
        const len = typeof x === 'string' ? x.length : null;
        o[k] = len == null ? '<redacted>' : `<redacted len=${len}>`;
      } else {
        o[k] = sanitize(x, depth + 1);
      }
    }
    return o;
  }
  return `<${typeof v}>`;
}

/** 在载荷中递归搜集「行区间候选键」→ {key: value}。 */
function collectRangeFields(v, depth = 0, acc = {}) {
  if (depth > MAX_DEPTH + 1 || v === null || typeof v !== 'object') return acc;
  if (Array.isArray(v)) {
    v.slice(0, 5).forEach((x) => collectRangeFields(x, depth + 1, acc));
    return acc;
  }
  for (const [k, x] of Object.entries(v)) {
    if (RANGE_KEY_RE.test(k)) acc[k] = typeof x === 'object' ? `<${typeof x}>` : x;
    else if (x && typeof x === 'object') collectRangeFields(x, depth + 1, acc);
  }
  return acc;
}

/** 沿「路径键」候选取值（复用既有 pre-tool-use 的提取链，便于横向比对）。 */
function extractPath(input) {
  const ti = input.tool_input ?? input.arguments ?? input.input ?? {};
  const cands = [ti.path, ti.file_path, ti.filePath, ti.target_file, ti.uri, input.path];
  return cands.find((p) => typeof p === 'string' && p) ?? null;
}

function writeLog(line) {
  try {
    try {
      if (statSync(LOG_PATH).size > MAX_LOG_BYTES) renameSync(LOG_PATH, `${LOG_PATH}.1`);
    } catch {
      /* 文件不存在 → 首次写入 */
    }
    appendFileSync(LOG_PATH, `${line}\n`, 'utf8');
  } catch {
    /* 记录失败绝不影响放行 */
  }
}

let input = {};
let raw = '';
try {
  raw = await readStdin();
  input = JSON.parse(raw || '{}');
} catch {
  input = { __parse_failed: true, __raw_len: raw.length };
}

try {
  const toolInput = input.tool_input ?? input.arguments ?? input.input ?? {};
  writeLog(
    JSON.stringify({
      ts: new Date().toISOString(),
      event: 'beforeReadFile',
      // 事件名/工具名的实际键位在各 IDE 间不一致 → 原样记录顶层键，便于实测后对齐 survey 表
      topKeys: Object.keys(input),
      toolName: input.tool_name ?? input.toolName ?? input.tool ?? null,
      path: extractPath(input),
      // ★ 本探针的核心产出：区间字段存在与否
      rangeFields: collectRangeFields(input),
      hasRange: Object.keys(collectRangeFields(input)).length > 0,
      payload: sanitize(input),
    }),
  );
} catch {
  /* 同上：探针自身异常不影响放行 */
}

process.stdout.write(JSON.stringify({ permission: 'allow' }));
process.exit(0);

/* ─────────────────────────────────────────────────────────────────────────────
 * 实测步骤（跑一次即得结论，随后据结论决定是否升级为真实埋点）：
 *   1. 在 Cursor 里发起**一次带 offset/limit 的读**（例如对大文件读指定行区间）。
 *   2. `cat .cursor/hooks/.read-probe.jsonl` 看最后一行：
 *        • `hasRange:true`  → 载荷含区间字段，hook 埋点**可拿到精确区间**，可替代转录解析；
 *        • `hasRange:false` → 只能拿到 path，埋点仅能补「读了哪个文件」的一阶信号，
 *                             精确区间仍以转录解析为准（结论回写 survey §4 那张表）。
 *   3. 结论落 `docs/agent/context-instrumentation-survey.md`（把 `[待实测]` 改成实测值）。
 * 关停：从 `.cursor/hooks.json` 移除 `beforeReadFile` 项即可（本文件无副作用，留着也不影响）。
 * ───────────────────────────────────────────────────────────────────────────── */
