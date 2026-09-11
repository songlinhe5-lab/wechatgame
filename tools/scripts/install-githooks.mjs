#!/usr/bin/env node
/**
 * 为本仓库设置 `git config core.hooksPath .githooks`，
 * 使 Cursor / CodeBuddy / WorkBuddy / Qoder / 终端 共用同一套 pre-commit。
 *
 * 由 package.json `prepare` 触发；亦可手动：node tools/scripts/install-githooks.mjs
 */

import { chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const hooksDir = join(ROOT, '.githooks');
const preCommit = join(hooksDir, 'pre-commit');

if (!existsSync(join(ROOT, '.git'))) {
  process.stdout.write('install-githooks: 非 git 仓库，跳过\n');
  process.exit(0);
}

if (!existsSync(preCommit)) {
  process.stderr.write('install-githooks: 缺少 .githooks/pre-commit\n');
  process.exit(1);
}

const r = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
  cwd: ROOT,
  encoding: 'utf8',
});

if (r.status !== 0) {
  process.stderr.write(`install-githooks: git config 失败\n${r.stderr || ''}`);
  process.exit(1);
}

try {
  chmodSync(preCommit, 0o755);
} catch {
  /* Windows / 无权限时 git 仍可通过 sh 调用 */
}

process.stdout.write('install-githooks: core.hooksPath=.githooks OK\n');
