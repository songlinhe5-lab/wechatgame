#!/usr/bin/env node
/**
 * check-secrets.mjs — 密钥入仓守卫（WXG-T-047 ②）。
 *
 * 本文件是两条既有红线的**机械化**（此前两处都只写了「有校验脚本」，脚本却不存在）：
 *   · `docs/architecture/control-manifest.md` §10
 *       ❌ 不把任何密钥、AppSecret、CDN 私有地址写进客户端代码
 *       ✅ 校验脚本：`tools/scripts/check-secrets.mjs`      ← 本文件
 *   · `docs/architecture/adr/ADR-0010` §4.2-5 / 控制清单 §15（微信侧承接）
 *       AppID / 上传私钥**严禁入仓**：只经环境变量
 *       （WECHAT_APPID / WECHAT_PRIVATE_KEY(_PATH)）或预览页 UI 提供
 *
 * ── 扫描面 = 「会不会入仓」，不是「磁盘上有没有」────────────────────────────
 *   默认取 `git ls-files --cached --others --exclude-standard`
 *     = 已跟踪 ∪（未跟踪且**未被忽略**）
 *   前者已经在仓库里，后者按定义迟早会被提交 —— 这两个集合才是红线关心的。
 *   被 `.gitignore` 覆盖的文件**不扫**：它们进不了提交，扫了只制造噪声。
 *   ⇒ 因此**没有** `--staged` 模式：本模式严格强于「只看暂存区」。
 *   （对照 `check-context-budget.mjs --staged`：那里判「暂存内容 == 索引」，语义
 *     必须绑定暂存区；这里判「会不会入仓」，绑定的是 ignore 边界。两者不可类推。）
 *   ⇒ `--root=<dir>` 仅供 `--selftest` 指向桩仓库，正常路径勿用。
 *
 * ── 两级严重性（刻意区分，避免把文档引用当成事故）──────────────────────────
 *   FAIL（exit 1）：
 *     · 敏感**文件名**进入上述文件集（*.key / *.pem / *.p12 / *.pfx / *.jks /
 *       *.keystore / id_rsa* / private.`<appid>`.key）
 *     · 内容含 **PEM 私钥块**（BEGIN … PRIVATE KEY）
 *     · 内容含高置信度**密钥赋值**（键名含 secret / apiKey / accessKey /
 *       privateKey / uploadKey，且右侧是 ≥16 字符的引号字面量）
 *     · **微信 AppID**（`wx` 后接 16 位十六进制）出现在**代码 / 配置**文件里
 *   WARN（不阻断，exit 仍 0）：
 *     · 同一条 AppID 规则命中 **`.md` 文档** —— 文档里出现 AppID 字样是合法的，
 *       但需人工核对是不是真值；真值请改为环境变量引用。
 *
 * ── 刻意不做（避免造伪判据）──────────────────────────────────────────────
 *   · 不扫被 ignore 的文件（见上），因此「临时丢一个 key 进仓库」只要已被
 *     ignore 规则覆盖就不会误报；未被覆盖则**应当**报 —— 那确实会被提交。
 *   · **不做熵检测 / 通用长随机串启发式**：误报会把红线门禁变成噪声源，
 *     结局必然有人加 `--no-verify`（`knowledge/lessons.md` K-025：豁免一旦存在，
 *     后续真实不一致会被它一起放过）。
 *   · **不提供 per-line 豁免注释**：本脚本守的是红线，没有「这次不算」的通道。
 *   · `control-manifest.md` §10 同句提到的「CDN 私有地址」**未实现**：该词无
 *     可判定的定义，硬做就是伪判据；且 MCP 侧的回环红线已由 `check:mcp` 的 C3
 *     机械执行。此处如实声明为未覆盖，不假装覆盖了。
 *
 * 用法：
 *   node tools/scripts/check-secrets.mjs              # 全仓（pre-commit / verify / CI）
 *   node tools/scripts/check-secrets.mjs --json       # 机读输出
 *   node tools/scripts/check-secrets.mjs --selftest   # 桩自测（临时 git 仓库，不碰本仓）
 *
 * 退出码：0 = 干净（可能含 WARN）；1 = 命中 FAIL；2 = 用法错误。
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** 超过此字节数的文件不读内容（密钥不会这么大；避免啃大二进制）。 */
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

/** 敏感文件名（会入仓即 FAIL）。 */
export const SENSITIVE_NAMES = [
  { re: /\.(key|pem|p12|pfx|jks|keystore|ppk)$/i, label: '密钥/证书文件' },
  { re: /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i, label: 'SSH 私钥' },
  { re: /^\.env(\.|$)/i, label: 'dotenv 文件' },
];

/** 内容规则。regex 一律**非 global**，故无 lastIndex 状态问题。 */
export const CONTENT_RULES = [
  {
    id: 'PRIVATE-KEY-BLOCK',
    // 注意：本行**不可**写成完整的 PEM 首行字面量，否则脚本会命中自己。
    pattern: /-----BEGIN\s+[A-Z ]{0,24}PRIVATE KEY-----/,
    message: '含 PEM 私钥块 —— 私钥只能放仓库外，经环境变量或预览页 UI 提供',
  },
  {
    id: 'SECRET-ASSIGNMENT',
    pattern:
      /(app_?secret|appSecret|secret_?key|secretKey|api_?key|apiKey|access_?key|accessKey|private_?key|privateKey|upload_?key|uploadKey)\s*[:=]\s*['"][A-Za-z0-9_\-+/=]{16,}['"]/i,
    message: '疑似密钥字面量赋值 —— 改走环境变量，勿写入仓库',
  },
  {
    id: 'WECHAT-APPID',
    pattern: /\bwx[0-9a-f]{16}\b/,
    message: '微信 AppID 出现在仓库中（ADR-0010 §4.2-5：AppID 与私钥同样严禁入仓）',
    docsAreWarnOnly: true,
  },
];

const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) {
  printHelp();
  process.exit(0);
}
if (argv.includes('--selftest')) runSelftest();

const AS_JSON = argv.includes('--json');
const rootArg = argv.find((a) => a.startsWith('--root='));
const ROOT = rootArg ? rootArg.slice('--root='.length) : DEFAULT_ROOT;

/** ── 采集 ─────────────────────────────────────────────────────────────── */

/**
 * 会入仓的文件集：已跟踪 ∪ 未跟踪且未被忽略。
 * 返回仓库相对路径（posix 分隔符）；git 不可用时如实报错而非静默放行。
 */
export function collectFiles(root) {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split('\0')
    .filter(Boolean)
    .map((p) => p.split('\\').join('/'))
    .sort();
}

/** 读文本内容；二进制（含 NUL）或超限或不可读 → null。 */
function readText(abs) {
  try {
    if (statSync(abs).size > MAX_TEXT_BYTES) return null;
    const buf = readFileSync(abs);
    if (buf.subarray(0, 8192).includes(0)) return null; // 二进制
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

/** ── 规则应用 ─────────────────────────────────────────────────────────── */

/** 文件名规则（纯函数）。 */
export function matchName(relPath) {
  const base = relPath.split('/').pop() ?? '';
  const hits = [];
  for (const n of SENSITIVE_NAMES) {
    if (n.re.test(base) || n.re.test(relPath)) hits.push({ id: 'SENSITIVE-FILE', label: n.label });
  }
  return hits;
}

/**
 * 内容规则（纯函数）。
 * `docsAreWarnOnly` 的规则命中 `.md` 时降级为 warn —— 文档引用 AppID 字样合法。
 */
export function matchContent(relPath, text) {
  const isDoc = /\.md$/i.test(relPath);
  const hits = [];
  for (const rule of CONTENT_RULES) {
    const m = rule.pattern.exec(text);
    if (!m) continue;
    const line = text.slice(0, m.index).split('\n').length;
    const level = rule.docsAreWarnOnly && isDoc ? 'warn' : 'fail';
    hits.push({ id: rule.id, level, line, path: relPath, message: rule.message });
  }
  return hits;
}

/** ── 主流程 ───────────────────────────────────────────────────────────── */

const violations = [];
const warnings = [];
let scanned = 0;
let skipped = 0;

let files;
try {
  files = collectFiles(ROOT);
} catch (err) {
  console.error(`❌ check-secrets 无法枚举文件（git 不可用或 ${ROOT} 不是仓库）：${err.message}`);
  process.exit(2);
}

for (const rel of files) {
  for (const hit of matchName(rel)) {
    violations.push({ ...hit, path: rel, line: 0, message: `${hit.label}会随提交入库` });
  }
  const text = readText(join(ROOT, rel.split('/').join(sep)));
  if (text === null) {
    skipped += 1;
    continue;
  }
  scanned += 1;
  for (const hit of matchContent(rel, text)) {
    (hit.level === 'warn' ? warnings : violations).push(hit);
  }
}

/** ── 报告 ─────────────────────────────────────────────────────────────── */

if (AS_JSON) {
  console.log(JSON.stringify({ root: ROOT, scanned, skipped, violations, warnings }, null, 2));
} else {
  for (const w of warnings) {
    console.log(`WARN  [${w.id}] ${w.path}${w.line ? `:${w.line}` : ''}\n        ${w.message}`);
  }
  for (const v of violations) {
    console.log(`FAIL  [${v.id}] ${v.path}${v.line ? `:${v.line}` : ''}\n        ${v.message}`);
  }
  console.log('');
  if (violations.length) {
    console.log(`❌ check-secrets: ${violations.length} 处红线命中（扫描 ${scanned} 个文本文件，跳过二进制/超限 ${skipped}）`);
    console.log('   处置：把密钥/AppID 移出仓库，改经环境变量（WECHAT_APPID / WECHAT_PRIVATE_KEY_PATH）');
    console.log('   或预览页 UI 提供；若某文件本不该被跟踪，先补 .gitignore 再 git rm --cached。');
  } else {
    console.log(
      `✅ check-secrets: OK —— 无密钥入仓（扫描 ${scanned} 个文本文件，跳过二进制/超限 ${skipped}` +
        `${warnings.length ? `；${warnings.length} 处 WARN 待人工核对` : ''}）`,
    );
  }
}

process.exit(violations.length === 0 ? 0 : 1);

// ─────────────────────────────────────────────────────────── 自测 ───────────

function runSelftest() {
  const cases = [];
  const check = (name, cond) => cases.push({ name, ok: !!cond });
  const tmp = mkdtempSync(join(tmpdir(), 'wxg-secrets-selftest-'));

  try {
    // §A 文件名规则（纯函数）
    check('A1 *.key 命中', matchName('private.wx123.key').length > 0);
    check('A2 *.pem 命中', matchName('certs/server.pem').length > 0);
    check('A3 id_rsa 命中', matchName('deploy/id_rsa').length > 0);
    check('A4 .env 命中', matchName('.env').length > 0);
    check('A5 普通 ts 不命中', matchName('games/breakout/src/index.ts').length === 0);
    check('A6 名为 key 的源码文件不误报', matchName('src/keyboard.ts').length === 0);

    // §B 内容规则（纯函数）
    // ⚠️ 合成样本**必须拼接成串**，不能写字面量：本脚本会扫自己（见 B8），
    //    完整字面量会让夹具反过来命中规则（本轮首跑即如此）。
    const F = (...parts) => parts.join('');
    const PEM_SAMPLE = F('-----BEGIN RSA ', 'PRIV', 'ATE KEY-----', '\nMIIabc\n');
    const SECRET_SAMPLE = F('const appSecret = "', 'a'.repeat(20), '";');
    const SHORT_SAMPLE = F('const apiKey = "', 'short', '";');
    const APPID_CODE_SAMPLE = F('const id = "wx', '00000000000000ff', '";');
    const APPID_DOC_SAMPLE = F('你的 appid 形如 wx', '00000000000000ff');

    check('B1 PEM 私钥块命中', matchContent('a.ts', PEM_SAMPLE).some((h) => h.id === 'PRIVATE-KEY-BLOCK'));
    check('B2 密钥赋值命中', matchContent('a.ts', SECRET_SAMPLE).some((h) => h.id === 'SECRET-ASSIGNMENT'));
    check('B3 短字符串不命中（防噪声）', matchContent('a.ts', SHORT_SAMPLE).length === 0);
    check('B4 代码里的 AppID 为 fail', matchContent('a.ts', APPID_CODE_SAMPLE).some((h) => h.level === 'fail'));
    check('B5 文档里的 AppID 降级为 warn', matchContent('doc.md', APPID_DOC_SAMPLE).every((h) => h.level === 'warn'));
    check('B6 命中行号正确', matchContent('a.ts', `line1\n${SECRET_SAMPLE}`)[0].line === 2);
    check('B7 干净代码零命中', matchContent('a.ts', 'export const x = 1;\n').length === 0);
    check(
      'B8 本脚本自身不命中自己',
      matchContent('check-secrets.mjs', readFileSync(fileURLToPath(import.meta.url), 'utf8')).length === 0,
    );

    // §C 端到端（桩 git 仓库：验证「未跟踪且未被忽略」确实被采集）
    execFileSync('git', ['init', '-q'], { cwd: tmp });
    execFileSync('git', ['config', 'user.email', 'selftest@local'], { cwd: tmp });
    execFileSync('git', ['config', 'user.name', 'selftest'], { cwd: tmp });
    writeFileSync(join(tmp, '.gitignore'), '*.key\n');
    mkdirSync(join(tmp, 'src'), { recursive: true });
    writeFileSync(join(tmp, 'src', 'clean.ts'), 'export const ok = true;\n');
    writeFileSync(join(tmp, 'dropped.key'), 'IGNORED-BY-GITIGNORE\n');
    writeFileSync(join(tmp, 'leak.ts'), `${SECRET_SAMPLE}\n`);
    const collected = collectFiles(tmp);
    check('C1 采集含已跟踪与未跟踪文件', collected.includes('src/clean.ts') && collected.includes('leak.ts'));
    check('C2 被 .gitignore 覆盖的 *.key 不入扫描面', !collected.includes('dropped.key'));
    const e2e = collected.flatMap((rel) => matchContent(rel, readFileSync(join(tmp, rel), 'utf8')));
    check('C3 端到端抓到密钥文件', e2e.some((h) => h.id === 'SECRET-ASSIGNMENT' && h.path === 'leak.ts'));
    check('C4 端到端不误报干净文件', !e2e.some((h) => h.path === 'src/clean.ts'));
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
    console.error(`❌ check-secrets --selftest FAILED：${failed.length}/${cases.length} 未通过`);
    process.exit(1);
  }
  console.log(`✅ check-secrets --selftest OK（${cases.length}/${cases.length}）`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────── helpers ────────

function printHelp() {
  console.log(`密钥入仓守卫（WXG-T-047 ②）— 机械化 control-manifest §10 / ADR-0010 §4.2-5

用法：
  node tools/scripts/check-secrets.mjs [选项]

选项：
  --json              机读输出
  --selftest          桩自测（临时 git 仓库 + 纯函数断言，不碰本仓）
  --root=<dir>        覆盖仓库根（仅供自测；正常路径勿用）
  -h, --help          本帮助

扫描面：
  git ls-files --cached --others --exclude-standard
  = 已跟踪 ∪ 未跟踪且未被忽略 → 即「会不会入仓」；被 .gitignore 覆盖的文件不扫。
  因此不需要 --staged 模式（本模式严格更强）。

FAIL：敏感文件名 / PEM 私钥块 / 密钥赋值 / 代码里的微信 AppID
WARN：文档（.md）里的微信 AppID（需人工核对是否真值）

未覆盖（如实声明）：control-manifest §10 同句的「CDN 私有地址」无判定定义，未实现。`);
}
