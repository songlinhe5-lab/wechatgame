/**
 * Type-check the Cocos project's script copies.
 *
 * WHY THIS EXISTS (2026-09-13 incident): `packages/framework/src` excludes
 * `adapters/cocos/bindings.ts` from its own tsc run (it imports `cc`), and the
 * copies under each game's `cocos/assets/scripts` were never typechecked at
 * all — so a syntax error introduced by a sync shipped straight into the
 * where it broke the whole SystemJS module graph (blank preview). This script
 * closes that hole.
 *
 * The editor-generated `temp/tsconfig.cocos.json` and `temp/declarations` are
 * not committed, so on a clean checkout (CI) there is nothing to check
 * against: we skip loudly instead of failing.
 *
 * Usage:
 *   node tools/scripts/check-cocos-scripts.mjs [--strict]
 *   --strict  exit non-zero when prerequisites are missing (CI with editor).
 */

import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const strict = process.argv.includes('--strict');

const gamesDir = join(repoRoot, 'games');
let checked = 0;
let skipped = 0;
let failed = 0;

for (const game of readDirs(gamesDir)) {
  const project = join(gamesDir, game, 'cocos');
  const checkConfig = join(project, 'tsconfig.check.json');
  if (!existsSync(checkConfig)) continue;

  const editorConfig = join(project, 'temp', 'tsconfig.cocos.json');
  const declarations = join(project, 'temp', 'declarations', 'cc.d.ts');
  if (!existsSync(editorConfig) || !existsSync(declarations)) {
    skipped += 1;
    console.log(
      `ℹ️  ${game}: 跳过——编辑器产物缺失（${existsSync(editorConfig) ? '' : 'temp/tsconfig.cocos.json '}${
        existsSync(declarations) ? '' : 'temp/declarations/cc.d.ts'
      }）。在未开过编辑器的干净检出上这是正常的。`,
    );
    continue;
  }

  const tsc = join(repoRoot, 'node_modules', '.bin', 'tsc');
  if (!existsSync(tsc)) {
    console.error('❌ 未找到 node_modules/.bin/tsc，请先 pnpm install。');
    process.exit(1);
  }

  const result = spawnSync(tsc, ['-p', checkConfig, '--noEmit'], {
    cwd: project,
    encoding: 'utf8',
  });
  checked += 1;
  if (result.status === 0) {
    console.log(`✅ ${game}: Cocos 脚本类型检查通过`);
  } else {
    failed += 1;
    console.error(`❌ ${game}: Cocos 脚本类型检查失败\n${result.stdout ?? ''}`);
  }
}

if (failed > 0) process.exit(1);
if (checked === 0 && skipped > 0 && strict) {
  console.error('❌ --strict 下不允许跳过：编辑器产物缺失。');
  process.exit(1);
}
console.log(`cocos:check — 检查 ${checked}、跳过 ${skipped}、失败 ${failed}`);

function readDirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}
