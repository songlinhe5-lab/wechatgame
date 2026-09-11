#!/usr/bin/env node
/**
 * 四 IDE 链接完整性检查（agents / skills / memory / AGENTS 指针）。
 * 失败时 exit 1，供 pre-commit 与 Cursor beforeShellExecution 拦提交。
 *
 * Usage: node tools/scripts/check-ide-links.mjs [--json]
 */

import { existsSync, lstatSync, readdirSync, readlinkSync, realpathSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const AS_JSON = process.argv.includes('--json');

const IDE_DIRS = ['.cursor', '.codebuddy', '.workbuddy', '.qoder'];

/** 现役 SubAgent（不含 INDEX） */
const AGENT_NAMES = [
  'studio-orchestrator',
  'design-strategist',
  'engineering-lead',
  'art-director',
  'audio-director',
  'quality-lead',
  'release-ops-lead',
];

/** 挂四 IDE 的 skill（不含存档 game-dev-tool-free） */
const SKILL_NAMES = [
  'wxgame-orchestration',
  'wxgame-gdd-writer',
  'wxgame-ux-spec',
  'wxgame-adr-arch',
  'wxgame-epic-split',
  'wxgame-art-spec-programmatic',
  'wxgame-audio-spec',
  'wxgame-qa-gates',
  'wxgame-release-checklist',
  'indie-game-ost-pack',
  'game-ui-voice-pack',
  'game-studio',
];

/** AGENTS.md 文首四 IDE alwaysApply 指针 */
const RULE_POINTERS = [
  { path: '.cursor/rules/agents-md.mdc', kind: 'file' },
  { path: '.codebuddy/rules/agents-md/RULE.mdc', kind: 'file' },
  { path: '.workbuddy/rules/agents-md/RULE.mdc', kind: 'file' },
  { path: '.qoder/rules/agents-md.md', kind: 'file' },
];

const errors = [];

function abs(...parts) {
  return join(ROOT, ...parts);
}

function fail(msg) {
  errors.push(msg);
}

function isSymlink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

/** 要求 path 为符号链接，相对目标为 expectedRel，且解析后落在 expectedTargetAbs */
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
    if (!allowedNames.has(name)) {
      fail(`${label}: 多余条目 \`${name}\`（未在清单）→ ${relative(ROOT, join(dir, name))}`);
    }
  }
}

// --- agents ---
for (const ide of IDE_DIRS) {
  const dir = abs(ide, 'agents');
  const allowed = new Set(AGENT_NAMES.map((n) => `${n}.md`));
  expectNoExtraSymlinks(dir, allowed, `${ide}/agents`);
  for (const name of AGENT_NAMES) {
    const linkPath = abs(ide, 'agents', `${name}.md`);
    expectRelSymlink(
      linkPath,
      `../../my-agents/${name}.md`,
      abs('my-agents', `${name}.md`),
      `${ide}/agents/${name}.md`,
    );
  }
}

// --- skills ---
for (const ide of IDE_DIRS) {
  const dir = abs(ide, 'skills');
  const allowed = new Set(SKILL_NAMES);
  expectNoExtraSymlinks(dir, allowed, `${ide}/skills`);
  for (const name of SKILL_NAMES) {
    const linkPath = abs(ide, 'skills', name);
    expectRelSymlink(
      linkPath,
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

// --- AGENTS 指针 ---
for (const { path } of RULE_POINTERS) {
  expectFile(abs(path), `规则指针 ${path}`);
}
expectFile(abs('AGENTS.md'), 'AGENTS.md 正本');

// --- 存档 skill 不得挂四 IDE ---
for (const ide of IDE_DIRS) {
  const archived = abs(ide, 'skills', 'game-dev-tool-free');
  if (existsSync(archived) || isSymlink(archived)) {
    fail(`${ide}/skills/game-dev-tool-free: 存档 skill 不应挂 IDE 链接`);
  }
}

const ok = errors.length === 0;
if (AS_JSON) {
  process.stdout.write(JSON.stringify({ ok, errors }, null, 2) + '\n');
} else if (ok) {
  process.stdout.write('check:links OK — 四 IDE agents/skills/memory/规则指针完整\n');
} else {
  process.stderr.write(`check:links FAILED (${errors.length})\n`);
  for (const e of errors) process.stderr.write(`  - ${e}\n`);
}

process.exit(ok ? 0 : 1);
