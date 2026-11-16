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

import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
    // 编译错误批量输出时默认 1 MB 缓冲会 ENOBUFS ⇒ `status` 变 null，本门会把它误判成
    // 「类型检查失败」并丢掉真正的错误清单（诊断被缓冲问题顶替）。同族 K-183。
    maxBuffer: 32 * 1024 * 1024,
  });
  checked += 1;
  if (result.status === 0) {
    console.log(`✅ ${game}: Cocos 脚本类型检查通过`);
  } else {
    failed += 1;
    console.error(`❌ ${game}: Cocos 脚本类型检查失败\n${result.stdout ?? ''}`);
  }
}

checkClipHooks();

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

/**
 * `[WXG-T-967]` 逐容器裁切（ADR-0037）**宿主实现**的存在性判据。
 *
 * 为什么需要：`UiScopeTreeHooks.createClip` 与 `UiScopeChannels.group` 缺任一 ⇒
 * `UiScopeTree.enterClip()` 恒返回 false ⇒ 渲染器回落**全局** `clipHost`（菜单走马灯蒙版）
 * 并 `carrier.pushClip()` ⇒ 容器内静态位图腿被劫持进走马灯子树 ⇒ **屏上零像素**
 * （实测：设置弹窗 10 枚厚木 cell 底板 + 图标 + 开关全不可见，而 `menuBitmapReady` 为 true、
 * 载体装载 48/51 正常）。该回归在 harness 上**看不见**（Canvas2D 单画布，无容器通道分层），
 * 只有 Cocos 真产物才露 ⇒ 用静态判据兜住「实现被删 / 被回退」，产物级复查见
 * `node tools/scripts/cocos-settings-shot.mjs`（判读：设置弹窗应有 10 枚底板）。
 */
function checkClipHooks() {
  const file = join(repoRoot, 'packages/framework/src/adapters/cocos/bindings.ts');
  if (!existsSync(file)) return;
  const src = readFileSync(file, 'utf8');
  const need = [
    ['createClip: (key, group', 'UiScopeTreeHooks.createClip 注册'],
    ['private _createClip(', '_createClip 实现'],
    ['blitParent: blitNode, group }', '_createScope 回传 group'],
  ];
  const missing = need.filter(([needle]) => !src.includes(needle)).map(([, label]) => label);
  if (missing.length > 0) {
    failed += 1;
    console.error(`❌ Cocos 逐容器裁切宿主实现缺失：${missing.join(' / ')}`);
    console.error('   ⇒ enterClip 会恒 false，容器内静态位图腿回落全局蒙版（WXG-T-967）。');
  } else {
    console.log('✅ Cocos 逐容器裁切宿主实现齐备（createClip / _createClip / group）');
  }
}
