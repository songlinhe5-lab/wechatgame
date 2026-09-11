#!/usr/bin/env node
/**
 * Cursor beforeShellExecution：
 * - git commit → 先跑 check:links，失败则 deny
 * - --no-verify / 危险 git / 粗暴 rm → deny
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(chunks.join('')));
  });
}

function out(obj) {
  process.stdout.write(JSON.stringify(obj));
}

const raw = await readStdin();
let input = {};
try {
  input = JSON.parse(raw || '{}');
} catch {
  out({
    permission: 'deny',
    user_message: 'Hooks: 无法解析 shell 输入 JSON',
    agent_message: 'beforeShellExecution hook received invalid JSON; denying for failClosed safety.',
  });
  process.exit(0);
}

const command = String(input.command ?? '');

function deny(user, agent) {
  out({ permission: 'deny', user_message: user, agent_message: agent });
  process.exit(0);
}

function allow() {
  out({ permission: 'allow' });
  process.exit(0);
}

// 禁止绕过 hooks（含 git commit -n）
if (
  /\b--no-verify\b/.test(command) ||
  (/\bgit\s+commit\b/.test(command) && /(?:^|[\s])-n(?:[\s]|$)/.test(command))
) {
  deny(
    '禁止使用 --no-verify / -n 绕过 pre-commit（含 check:links）。',
    'Do not bypass git hooks. Fix check:links failures instead of --no-verify.',
  );
}

if (/\bgit\s+push\b/.test(command) && /\s--force(-with-lease)?\b|\s-f\b/.test(command)) {
  deny(
    '禁止 force push（需用户在对话中明确要求）。',
    'Force push blocked by project hook unless the user explicitly requested it.',
  );
}

if (/\bgit\s+reset\s+--hard\b/.test(command)) {
  deny(
    '禁止 git reset --hard（破坏性操作）。',
    'Hard reset blocked by project shell hook.',
  );
}

if (/\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)*-?rf\b|\brm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+)*-?fr\b/.test(command)) {
  if (/\brm\s+.*\//.test(command) || /\brm\s+.*\.\./.test(command)) {
    deny(
      '禁止危险 rm -rf（请改用更窄路径或请用户确认）。',
      'Broad rm -rf blocked by project shell hook.',
    );
  }
}

// 任意 git commit：先跑四 IDE 链接检查
if (/\bgit\s+commit\b/.test(command)) {
  const r = spawnSync(process.execPath, ['tools/scripts/check-ide-links.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    const detail = (r.stderr || r.stdout || '').trim().slice(0, 2000);
    deny(
      `check:links 未通过，已阻止 git commit。\n${detail}`,
      `Blocked git commit: IDE link check failed.\n${detail}`,
    );
  }
}

allow();
