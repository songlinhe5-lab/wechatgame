#!/usr/bin/env node
/**
 * 四 IDE 链接 + SubAgent frontmatter 完整性检查。
 * 真源：扫描 my-agents/*.md（除 INDEX）与 my-skills 下各包的 SKILL.md（除存档与下划线前缀目录）。
 * 失败时 exit 1，供 pre-commit 与 Cursor beforeShellExecution 拦提交。
 *
 * Usage: node tools/scripts/check-ide-links.mjs [--json]
 */

import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const AS_JSON = process.argv.includes('--json');

const IDE_DIRS = ['.cursor', '.codebuddy', '.workbuddy', '.qoder'];

/** 不挂四 IDE 的 skill 目录 */
const SKILL_ARCHIVED = new Set(['game-dev-tool-free']);

/** Cursor 文档认可的 frontmatter 键；其它键仅警告不失败（跨 IDE 方言待实测） */
const CURSOR_KNOWN_FM_KEYS = new Set([
  'name',
  'description',
  'model',
  'readonly',
  'is_background',
]);

/** 必须 readonly: true（与编排路由表一致） */
const MUST_READONLY = new Set(['studio-orchestrator', 'quality-lead']);

const RULE_POINTERS = [
  {
    path: '.cursor/rules/agents-md.mdc',
    expectedRel: '../../my-rules/agents-md.md',
  },
  {
    path: '.codebuddy/rules/agents-md/RULE.mdc',
    expectedRel: '../../../my-rules/agents-md.md',
  },
  {
    path: '.workbuddy/rules/agents-md/RULE.mdc',
    expectedRel: '../../../my-rules/agents-md.md',
  },
  {
    path: '.qoder/rules/agents-md.md',
    expectedRel: '../../my-rules/agents-md.md',
  },
];

const errors = [];
const warnings = [];

function abs(...parts) {
  return join(ROOT, ...parts);
}

function fail(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function isSymlink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

/** 扫描 my-agents 正本（不含 INDEX.md） */
function discoverAgents() {
  const dir = abs('my-agents');
  if (!existsSync(dir)) {
    fail('my-agents/: 目录缺失');
    return [];
  }
  return readdirSync(dir)
    .filter((n) => n.endsWith('.md') && n !== 'INDEX.md')
    .map((n) => n.replace(/\.md$/, ''))
    .sort();
}

/** 扫描现役 skill（有 SKILL.md；排除 _* 与存档） */
function discoverSkills() {
  const dir = abs('my-skills');
  if (!existsSync(dir)) {
    fail('my-skills/: 目录缺失');
    return [];
  }
  const names = [];
  for (const n of readdirSync(dir)) {
    if (n.startsWith('_') || n.startsWith('.')) continue;
    if (SKILL_ARCHIVED.has(n)) continue;
    const skillMd = join(dir, n, 'SKILL.md');
    if (existsSync(skillMd) && lstatSync(skillMd).isFile()) names.push(n);
  }
  return names.sort();
}

/**
 * 解析 YAML frontmatter（仅支持本仓用到的标量 / `>` 折叠块）。
 * @returns {{ fields: Record<string, string|boolean>, keys: string[] } | null}
 */
function parseFrontmatter(text, label) {
  if (!text.startsWith('---')) {
    fail(`${label}: 缺少 YAML frontmatter（文件须以 --- 开头）`);
    return null;
  }
  const end = text.indexOf('\n---', 3);
  if (end === -1) {
    fail(`${label}: frontmatter 未闭合（找不到结束 ---）`);
    return null;
  }
  const block = text.slice(4, end).replace(/^\n/, '');
  const fields = {};
  const keys = [];
  const lines = block.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) {
      i += 1;
      continue;
    }
    const m = line.match(/^([A-Za-z_][\w]*)\s*:\s*(.*)$/);
    if (!m) {
      fail(`${label}: frontmatter 无法解析行: ${line}`);
      i += 1;
      continue;
    }
    const key = m[1];
    let raw = m[2].trim();
    keys.push(key);
    if (raw === '>' || raw === '|') {
      const folded = [];
      i += 1;
      while (i < lines.length) {
        const cont = lines[i];
        if (/^[A-Za-z_][\w]*\s*:/.test(cont)) break;
        folded.push(cont.replace(/^\s{2}/, ''));
        i += 1;
      }
      fields[key] = folded.join(' ').replace(/\s+/g, ' ').trim();
      continue;
    }
    if (raw === 'true') fields[key] = true;
    else if (raw === 'false') fields[key] = false;
    else if (
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
    ) {
      fields[key] = raw.slice(1, -1);
    } else {
      fields[key] = raw;
    }
    i += 1;
  }
  return { fields, keys };
}

function validateAgentFrontmatter(name) {
  const rel = `my-agents/${name}.md`;
  const path = abs(rel);
  const text = readFileSync(path, 'utf8');
  const parsed = parseFrontmatter(text, rel);
  if (!parsed) return;

  const { fields, keys } = parsed;
  if (fields.name !== name) {
    fail(`${rel}: frontmatter name 应为 \`${name}\`，实际 \`${fields.name ?? '(缺失)'}\``);
  }
  const desc = typeof fields.description === 'string' ? fields.description.trim() : '';
  if (!desc) {
    fail(`${rel}: description 缺失或为空（Cursor 靠它决定是否委派）`);
  }
  if (MUST_READONLY.has(name)) {
    if (fields.readonly !== true) {
      fail(`${rel}: 必须 \`readonly: true\`（编排只读角色）`);
    }
  }

  for (const k of keys) {
    if (!CURSOR_KNOWN_FM_KEYS.has(k)) {
      warn(
        `${rel}: 键 \`${k}\` 非 Cursor 官方 subagent 字段；跨 IDE 方言请实测后再依赖（共享正本勿塞未验证键）`,
      );
    }
  }
}

function expectRelSymlink(linkPath, expectedRel, expectedTargetAbs, label) {
  if (!existsSync(linkPath) && !isSymlink(linkPath)) {
    fail(`${label}: 缺失 ${relative(ROOT, linkPath)}`);
    return;
  }
  if (!isSymlink(linkPath)) {
    fail(`${label}: 应为符号链接，实际为普通文件/目录 → ${relative(ROOT, linkPath)}`);
    return;
  }
  let link;
  try {
    link = readlinkSync(linkPath);
  } catch (e) {
    fail(`${label}: 无法 readlink ${relative(ROOT, linkPath)}: ${e.message}`);
    return;
  }
  if (link !== expectedRel) {
    fail(
      `${label}: 链接目标应为 \`${expectedRel}\`，实际 \`${link}\` → ${relative(ROOT, linkPath)}`,
    );
  }
  let resolved;
  try {
    resolved = realpathSync(linkPath);
  } catch {
    fail(`${label}: 断链（目标不存在）→ ${relative(ROOT, linkPath)} → ${link}`);
    return;
  }
  if (resolve(resolved) !== resolve(expectedTargetAbs)) {
    fail(
      `${label}: 解析目标不符，期望 ${relative(ROOT, expectedTargetAbs)}，得到 ${relative(ROOT, resolved)}`,
    );
  }
}

function expectFile(path, label) {
  if (!existsSync(path) || !lstatSync(path).isFile()) {
    fail(`${label}: 缺少文件 ${relative(ROOT, path)}`);
  }
}

function expectNoExtraSymlinks(dir, allowedNames, label) {
  if (!existsSync(dir)) return;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === '.' || name === '..') continue;
    // 守卫目标 = 「清单外 *symlink*」（防挂错/挂野链接）。IDE 会话可能在
    // skills/ 下落**实体目录**（如 .qoder 生成带 hash 后缀的会话级 skill），
    // 那是环境噪音而非链接拓扑破坏 —— 跳过实体目录，只对 symlink 做清单外检查。
    const ent = join(dir, name);
    if (!isSymlink(ent)) continue;
    if (!allowedNames.has(name)) {
      fail(`${label}: 多余条目 \`${name}\`（未在清单）→ ${relative(ROOT, join(dir, name))}`);
    }
  }
}

/** INDEX.md 表格中的 \`name\` 列须与扫描结果一致 */
function checkAgentsIndex(agentNames) {
  const indexPath = abs('my-agents', 'INDEX.md');
  if (!existsSync(indexPath)) {
    fail('my-agents/INDEX.md: 缺失');
    return;
  }
  const text = readFileSync(indexPath, 'utf8');
  const fromIndex = new Set();
  for (const m of text.matchAll(/^\| `([a-z0-9-]+)` \|/gm)) {
    fromIndex.add(m[1]);
  }
  for (const n of agentNames) {
    if (!fromIndex.has(n)) fail(`my-agents/INDEX.md: 表中缺少 \`${n}\``);
  }
  for (const n of fromIndex) {
    if (!agentNames.includes(n)) {
      fail(`my-agents/INDEX.md: 表有 \`${n}\` 但正本 my-agents/${n}.md 不存在`);
    }
  }
}

/** 编排路由表须覆盖全部 agent name */
function checkOrchestrationRouting(agentNames) {
  const skillPath = abs('my-skills', 'wxgame-orchestration', 'SKILL.md');
  if (!existsSync(skillPath)) {
    fail('my-skills/wxgame-orchestration/SKILL.md: 缺失');
    return;
  }
  const text = readFileSync(skillPath, 'utf8');
  for (const n of agentNames) {
    if (!text.includes(`\`${n}\``)) {
      fail(`wxgame-orchestration 路由表: 未出现 subagent name \`${n}\``);
    }
  }
}

// --- discover ---
const AGENT_NAMES = discoverAgents();
const SKILL_NAMES = discoverSkills();

if (AGENT_NAMES.length === 0) fail('my-agents/: 未发现任何 *.md 正本（除 INDEX）');
if (SKILL_NAMES.length === 0) fail('my-skills/: 未发现任何现役 skill');

for (const name of AGENT_NAMES) {
  validateAgentFrontmatter(name);
}
checkAgentsIndex(AGENT_NAMES);
checkOrchestrationRouting(AGENT_NAMES);

// --- agents links ---
for (const ide of IDE_DIRS) {
  const dir = abs(ide, 'agents');
  const allowed = new Set(AGENT_NAMES.map((n) => `${n}.md`));
  expectNoExtraSymlinks(dir, allowed, `${ide}/agents`);
  for (const name of AGENT_NAMES) {
    expectRelSymlink(
      abs(ide, 'agents', `${name}.md`),
      `../../my-agents/${name}.md`,
      abs('my-agents', `${name}.md`),
      `${ide}/agents/${name}.md`,
    );
  }
}

// --- skills links ---
for (const ide of IDE_DIRS) {
  const dir = abs(ide, 'skills');
  const allowed = new Set(SKILL_NAMES);
  expectNoExtraSymlinks(dir, allowed, `${ide}/skills`);
  for (const name of SKILL_NAMES) {
    expectRelSymlink(
      abs(ide, 'skills', name),
      `../../my-skills/${name}`,
      abs('my-skills', name),
      `${ide}/skills/${name}`,
    );
    expectFile(abs('my-skills', name, 'SKILL.md'), `正本 ${name}/SKILL.md`);
  }
}

// --- memory ---
for (const ide of ['.codebuddy', '.workbuddy', '.qoder']) {
  expectRelSymlink(abs(ide, 'memory'), '../memory', abs('memory'), `${ide}/memory`);
}
expectFile(abs('.cursor', 'memory', 'MEMORY.md'), '.cursor/memory/MEMORY.md（入口指针）');
expectFile(abs('memory', 'MEMORY.md'), 'memory/MEMORY.md 正本');

// --- AGENTS 规则指针（正本 my-rules/agents-md.md）---
expectFile(abs('my-rules', 'agents-md.md'), 'my-rules/agents-md.md 正本');
expectFile(abs('AGENTS.md'), 'AGENTS.md 正本');
for (const { path, expectedRel } of RULE_POINTERS) {
  expectRelSymlink(
    abs(path),
    expectedRel,
    abs('my-rules', 'agents-md.md'),
    `规则指针 ${path}`,
  );
}

// --- 存档 skill 不得挂四 IDE ---
for (const ide of IDE_DIRS) {
  for (const archived of SKILL_ARCHIVED) {
    const p = abs(ide, 'skills', archived);
    if (existsSync(p) || isSymlink(p)) {
      fail(`${ide}/skills/${archived}: 存档 skill 不应挂 IDE 链接`);
    }
  }
}

const ok = errors.length === 0;
const summary = {
  ok,
  agents: AGENT_NAMES,
  skills: SKILL_NAMES,
  errors,
  warnings,
};

if (AS_JSON) {
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
} else if (ok) {
  process.stdout.write(
    `check:links OK — agents=${AGENT_NAMES.length} skills=${SKILL_NAMES.length}；frontmatter / INDEX / 路由表 / 四 IDE 链接完整\n`,
  );
  for (const w of warnings) process.stderr.write(`  warn: ${w}\n`);
} else {
  process.stderr.write(`check:links FAILED (${errors.length})\n`);
  for (const e of errors) process.stderr.write(`  - ${e}\n`);
  for (const w of warnings) process.stderr.write(`  warn: ${w}\n`);
}

process.exit(ok ? 0 : 1);
