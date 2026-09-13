#!/usr/bin/env node
/**
 * sync-framework-to-cocos.mjs — 方案 C（物理拷贝）同步脚本。
 *
 * WHY THIS EXISTS
 * ---------------
 * Cocos Creator 只编译自己工程 `assets/` 目录下的脚本，而框架源码住在
 * `packages/framework/src/`、玩法源码住在 `games/breakout/src/`。要让 Cocos
 * 工程编译它们，唯一零未知的方式是把源码**物理拷贝**进
 * `games/breakout/cocos/assets/scripts/`（README §2 方案 C，缺口 G1 的基线）。
 *
 * 拷贝不是 rsync 那么简单，因为两处源码的导入风格在拷贝件里会失效：
 *   1. `games/breakout/src/**` 用裸包名 `import ... from '@wxgame/framework'`
 *      —— 拷贝件里没有 node_modules，必须改写为指向 `framework/` 拷贝目录
 *      的相对路径（按目标文件深度计算）。
 *   2. 所有相对导入带 `.js` 后缀（ESM 风格）。已实测 TS 5.6 在
 *      `moduleResolution: "node"`（Cocos temp/tsconfig.cocos.json 的取值）下
 *      能解析 `.js` → `.ts` 映射，因此**默认原样保留**；Cocos 自有构建管线
 *      是否同样解析仍未在真机构建中验证（登记在 VERSION.md G1）。若实测不认，
 *      用 `--strip-suffix` 产出无后缀拷贝件。注意：strip 只影响拷贝件，Node
 *      侧 vitest / tsc 始终读原始 `src/`（经 paths alias），不受影响。
 *
 * 红线（L1）：`.meta` 只能由编辑器生成。本脚本：
 *   - 不生成、不改写任何 `.meta`；
 *   - 同步时**保留**已存在的 `.meta`（编辑器生成的 UUID 不得丢失，否则
 *     Main.scene 里对 BreakoutBootstrap 的组件引用会断）；
 *   - 只清理"源里已不存在"的拷贝文件；其孤儿 `.meta` 一并删除（编辑器会
 *     把无主 `.meta` 报为导入错误）。
 *
 * USAGE
 *   node tools/scripts/sync-framework-to-cocos.mjs            # 同步（幂等；默认剥 .js 后缀）
 *   node tools/scripts/sync-framework-to-cocos.mjs --check    # 校验一致性，漂移则 exit 1（CI 用）
 *   node tools/scripts/sync-framework-to-cocos.mjs --keep-suffix  # 保留 .js 后缀（逃生阀）
 *
 *   ⚠️ 默认 strip 是实测裁决（2026-09-13）：Cocos 3.8.8 编辑器**编译期**可解析
 *   `.js`→`.ts`（tsc 亦可通过），但**执行期** SystemJS 加载器按字面量找 `.js`
 *   文件 → 23 个导入全挂、组件注册失败。无后缀导入是 Cocos 项目惯例。
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const FRAMEWORK_SRC = resolve(repoRoot, 'packages/framework/src');
const GAME_SRC = resolve(repoRoot, 'games/breakout/src');
const SCRIPTS_OUT = resolve(repoRoot, 'games/breakout/cocos/assets/scripts');
const FRAMEWORK_OUT = resolve(SCRIPTS_OUT, 'framework');
const GAME_OUT = resolve(SCRIPTS_OUT, 'game');

/** Never copy these; `.meta` is editor-owned (L1). */
const EXCLUDED = new Set(['.DS_Store']);
function isExcluded(name) {
  return EXCLUDED.has(name) || name.endsWith('.meta');
}

/** Walk a directory, returning relative posix paths of all includable files. */
function walk(dir, base = dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (isExcluded(entry.name)) continue;
    const abs = join(dir, entry.name);
    const rel = relative(base, abs).split('\\').join('/');
    if (entry.isDirectory()) walk(abs, base, acc);
    else acc.push(rel);
  }
  return acc;
}

const stripSuffix = !process.argv.includes('--keep-suffix');
const checkOnly = process.argv.includes('--check');

/**
 * Rewrite a bare-package import into a relative path into the framework copy.
 * `@wxgame/framework`            → `<rel>/framework/index.js`
 * `@wxgame/framework/<sub>`      → `<rel>/framework/<sub>.js`（若存在同名 .ts 文件）
 *                                   或 `<rel>/framework/<sub>/index.js`（目录模块）
 * `<rel>` 由拷贝文件在 game/ 里的深度决定，保证指向 scripts/framework/。
 */
function rewriteBareFrameworkImport(spec, fileRelToGameOut, frameworkFiles) {
  const m = spec.match(/^@wxgame\/framework(?:\/(.+))?$/);
  if (!m) return null;
  const depth = fileRelToGameOut.split('/').length - 1; // fileRel 含文件名
  const relPrefix = '../'.repeat(depth + 1); // 逃出 game/ 到 scripts/
  const sub = m[1];
  let target;
  if (!sub) {
    target = 'framework/index.js';
  } else if (frameworkFiles.has(`${sub}.ts`)) {
    target = `framework/${sub}.js`;
  } else {
    target = `framework/${sub}/index.js`;
  }
  return `${relPrefix}${target}`;
}

/** Apply the copy-time transforms to one file's source text. Returns new text. */
function transformSource(text, srcKind, fileRel, frameworkFiles) {
  let out = text;

  if (srcKind === 'game') {
    // 1) 裸包名 → 框架拷贝目录的相对路径。
    out = out.replace(
      /(['"])@wxgame\/framework(?:\/[^'"]*)?\1/g,
      (whole, quote) => {
        // 先取原始 spec 算目标，再整体替换
        const spec = whole.slice(1, -1);
        const rewritten = rewriteBareFrameworkImport(spec, fileRel, frameworkFiles);
        return rewritten ? `${quote}${rewritten}${quote}` : whole;
      },
    );
  }

  // 2) 可选：剥掉相对导入的 .js 后缀（仅当 --strip-suffix）。
  if (stripSuffix) {
    out = out.replace(
      /(from\s+|import\s*\(\s*)(['"])(\.\.?\/[^'"]+)\.js\2/g,
      (_m, head, quote, path) => `${head}${quote}${path}${quote}`,
    );
  }
  return out;
}

/**
 * Compute the full sync manifest: { destAbsPath: content } for both trees,
 * plus the set of destination files that must exist after sync.
 */
function buildManifest() {
  if (!existsSync(FRAMEWORK_SRC)) throw new Error(`framework src missing: ${FRAMEWORK_SRC}`);
  if (!existsSync(GAME_SRC)) throw new Error(`game src missing: ${GAME_SRC}`);

  const fwFiles = walk(FRAMEWORK_SRC);
  const fwFileSet = new Set(fwFiles);
  const gameFiles = walk(GAME_SRC);

  const manifest = new Map(); // destAbs -> content

  for (const rel of fwFiles) {
    const text = readFileSync(join(FRAMEWORK_SRC, rel), 'utf8');
    manifest.set(join(FRAMEWORK_OUT, rel), transformSource(text, 'framework', rel, fwFileSet));
  }
  for (const rel of gameFiles) {
    const text = readFileSync(join(GAME_SRC, rel), 'utf8');
    manifest.set(join(GAME_OUT, rel), transformSource(text, 'game', rel, fwFileSet));
  }
  return manifest;
}

/** List existing files under a dir (recursively), excluding nothing. */
function listExisting(dir, base = dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = relative(base, abs).split('\\').join('/');
    if (entry.isDirectory()) listExisting(abs, base, acc);
    else acc.push(rel);
  }
  return acc;
}

function main() {
  const manifest = buildManifest();

  // ---- 现状盘点（含 .meta）----
  const existingFw = listExisting(FRAMEWORK_OUT);
  const existingGame = listExisting(GAME_OUT);
  const existingAll = [...existingFw.map((r) => join(FRAMEWORK_OUT, r)), ...existingGame.map((r) => join(GAME_OUT, r))];
  const existingSet = new Set(existingAll);

  // ---- --check：逐文件比对 + 检查多余拷贝件 ----
  if (checkOnly) {
    const problems = [];
    for (const [dest, content] of manifest) {
      let actual = null;
      try {
        actual = readFileSync(dest, 'utf8');
      } catch {
        /* missing */
      }
      if (actual !== content) {
        problems.push(
          `  OUT  ${relative(repoRoot, dest)}${actual === null ? ' (missing)' : ' (differs)'}`,
        );
      }
    }
    for (const abs of existingAll) {
      if (!manifest.has(abs) && !abs.endsWith('.meta')) {
        problems.push(`  EXTRA ${relative(repoRoot, abs)}（源里已不存在，应删除）`);
      }
    }
    if (problems.length > 0) {
      console.error(
        `❌ cocos/assets/scripts/{framework,game} 与源码不同步（${problems.length} 处）：\n` +
          problems.join('\n') +
          '\n   运行: node tools/scripts/sync-framework-to-cocos.mjs',
      );
      process.exit(1);
    }
    console.log(
      `✅ 拷贝件与源码一致（framework ${manifest.size - gameFilesCount(manifest)} 个 + game ${gameFilesCount(manifest)} 个文件）`,
    );
    return;
  }

  // ---- 同步 ----
  let written = 0;
  let kept = 0;
  for (const [dest, content] of manifest) {
    let actual = null;
    try {
      actual = readFileSync(dest, 'utf8');
    } catch {
      /* missing */
    }
    if (actual === content) {
      kept += 1;
      continue;
    }
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content, 'utf8');
    written += 1;
  }

  // 清理源里已不存在的拷贝件；对应孤儿 .meta 一起删。
  let removed = 0;
  for (const abs of existingAll) {
    if (manifest.has(abs)) continue;
    if (abs.endsWith('.meta')) {
      const sibling = abs.replace(/\.meta$/, '');
      if (manifest.has(sibling) || existingSet.has(sibling)) continue; // 还有主，保留
    }
    rmSync(abs);
    removed += 1;
  }

  // 清空目录（可能因清理产生）
  pruneEmptyDirs(FRAMEWORK_OUT);
  pruneEmptyDirs(GAME_OUT);

  console.log(
    `✅ 同步完成：写入 ${written}、未变 ${kept}、删除 ${removed}` +
      (stripSuffix ? '（.js 后缀已剥除）' : '') +
      '。.meta 由编辑器生成，本脚本永不触碰。',
  );
}

function gameFilesCount(manifest) {
  let n = 0;
  for (const p of manifest.keys()) if (p.startsWith(GAME_OUT)) n += 1;
  return n;
}

function pruneEmptyDirs(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) pruneEmptyDirs(join(dir, entry.name));
  }
  if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
}

// 仅直接调用时执行 main（便于未来测试导入内部函数）。
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
