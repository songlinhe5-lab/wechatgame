#!/usr/bin/env node
/**
 * sync-framework-to-cocos.mjs — 方案 C（物理拷贝）同步脚本。**多游戏**。
 *
 * WHY THIS EXISTS
 * ---------------
 * Cocos Creator 只编译自己工程 `assets/` 目录下的脚本，而框架源码住在
 * `packages/framework/src/`、玩法源码住在 `games/<game>/src/`。要让 Cocos
 * 工程编译它们，唯一零未知的方式是把源码**物理拷贝**进
 * `games/<game>/cocos/assets/scripts/`（README §2 方案 C，缺口 G1 的基线）。
 *
 * 覆盖范围（WXG-T-053 泛化）：遍历 `games/*`，**只处理已存在 `cocos/` 目录的游戏**；
 * 没建工程的一律**明确跳过并打印**（与 `check-cocos-scripts.mjs` 同一口径），
 * 不静默当成"同步成功"。泛化前本脚本硬编码 `games/breakout`，beads 永远拿不到拷贝件。
 *
 * 拷贝不是 rsync 那么简单，因为两处源码的导入风格在拷贝件里会失效：
 *   1. `games/<game>/src/**` 用裸包名 `import ... from '@wxgame/framework'`
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
 *     Main.scene 里对 Bootstrap 的组件引用会断）；
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
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const GAMES_DIR = resolve(repoRoot, 'games');
const FRAMEWORK_SRC = resolve(repoRoot, 'packages/framework/src');

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
 * Every game directory, with its source tree and Cocos project root.
 * A game without `cocos/` is still listed — the caller decides whether that is
 * a skip (missing project) or a problem.
 */
function discoverGames() {
  return readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((game) => {
      const root = join(GAMES_DIR, game);
      const scriptsOut = join(root, 'cocos', 'assets', 'scripts');
      return {
        game,
        gameSrc: join(root, 'src'),
        cocosDir: join(root, 'cocos'),
        scriptsOut,
        frameworkOut: join(scriptsOut, 'framework'),
        gameOut: join(scriptsOut, 'game'),
      };
    });
}

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
 * Compute the full sync manifest for one game: { destAbsPath: content } for both
 * trees, built from the framework tree and that game's own source tree.
 */
function buildManifest(spec, frameworkFiles, frameworkFileSet) {
  const manifest = new Map(); // destAbs -> content

  for (const rel of frameworkFiles) {
    const text = readFileSync(join(FRAMEWORK_SRC, rel), 'utf8');
    manifest.set(join(spec.frameworkOut, rel), transformSource(text, 'framework', rel, frameworkFileSet));
  }
  for (const rel of walk(spec.gameSrc)) {
    const text = readFileSync(join(spec.gameSrc, rel), 'utf8');
    manifest.set(join(spec.gameOut, rel), transformSource(text, 'game', rel, frameworkFileSet));
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

/** Every file currently on disk under a game's `scripts/{framework,game}`. */
function existingCopies(spec) {
  const list = [];
  for (const root of [spec.frameworkOut, spec.gameOut]) {
    for (const rel of listExisting(root)) list.push(join(root, rel));
  }
  return list;
}

/** `--check` for one game → array of human-readable problems. */
function checkGame(spec, manifest) {
  const problems = [];
  for (const [dest, content] of manifest) {
    let actual = null;
    try {
      actual = readFileSync(dest, 'utf8');
    } catch {
      /* missing */
    }
    if (actual !== content) {
      problems.push(`OUT  ${relative(repoRoot, dest)}${actual === null ? ' (missing)' : ' (differs)'}`);
    }
  }
  for (const abs of existingCopies(spec)) {
    if (!manifest.has(abs) && !abs.endsWith('.meta')) {
      problems.push(`EXTRA ${relative(repoRoot, abs)}（源里已不存在，应删除）`);
    }
  }
  return problems;
}

/** Write one game's manifest; returns {written, kept, removed}. */
function applyGame(spec, manifest) {
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
  // ⚠ 目录也有 .meta（如 `core.meta` 对应 `core/` 目录），其 sibling 是目录，
  //   不在 manifest（只含文件）里——必须用 existsSync 兜底，
  //   否则每次同步都会误删全部目录级 .meta（2026-09-13 实测事故）。
  let removed = 0;
  for (const abs of existingCopies(spec)) {
    if (manifest.has(abs)) continue;
    if (abs.endsWith('.meta')) {
      const sibling = abs.replace(/\.meta$/, '');
      if (manifest.has(sibling) || existsSync(sibling)) continue; // 还有主，保留
    }
    rmSync(abs);
    removed += 1;
  }

  // 清空目录（可能因清理产生）
  pruneEmptyDirs(spec.frameworkOut);
  pruneEmptyDirs(spec.gameOut);

  return { written, kept, removed };
}

function main() {
  if (!existsSync(FRAMEWORK_SRC)) throw new Error(`framework src missing: ${FRAMEWORK_SRC}`);

  const frameworkFiles = walk(FRAMEWORK_SRC);
  const frameworkFileSet = new Set(frameworkFiles);

  const synced = [];
  const skipped = [];
  const problems = [];

  for (const spec of discoverGames()) {
    if (!existsSync(spec.cocosDir)) {
      skipped.push(spec.game);
      continue;
    }
    if (!existsSync(spec.gameSrc)) {
      problems.push(`${spec.game}: 有 cocos/ 工程但缺 src/ —— 无法同步玩法源码`);
      continue;
    }

    const manifest = buildManifest(spec, frameworkFiles, frameworkFileSet);
    const gameCount = [...manifest.keys()].filter((p) => p.startsWith(spec.gameOut)).length;
    const fwCount = manifest.size - gameCount;

    if (checkOnly) {
      const found = checkGame(spec, manifest);
      if (found.length > 0) {
        problems.push(...found.map((p) => `${spec.game}: ${p}`));
      } else {
        synced.push(`${spec.game}（framework ${fwCount} + game ${gameCount}）`);
      }
      continue;
    }

    const { written, kept, removed } = applyGame(spec, manifest);
    synced.push(`${spec.game}（framework ${fwCount} + game ${gameCount}｜写入 ${written}、未变 ${kept}、删除 ${removed}）`);
  }

  const skippedNote =
    skipped.length > 0
      ? `\nℹ️  跳过（尚无 cocos/ 工程）：${skipped.join('、')} —— 建工程见 docs/agent/cocos-setup.md §4`
      : '';

  if (checkOnly) {
    if (problems.length > 0) {
      console.error(
        `❌ cocos/assets/scripts/{framework,game} 与源码不同步（${problems.length} 处）：\n` +
          problems.map((p) => `  ${p}`).join('\n') +
          '\n   运行: node tools/scripts/sync-framework-to-cocos.mjs' +
          skippedNote,
      );
      process.exit(1);
    }
    if (synced.length === 0) {
      console.log(`ℹ️  无可校验的 Cocos 工程（所有游戏均未建工程）。${skippedNote}`);
      return;
    }
    console.log(`✅ 拷贝件与源码一致 — ${synced.join('；')}${skippedNote}`);
    return;
  }

  const detail = synced.length > 0 ? synced.join('；') : '（无可同步的工程）';
  console.log(
    `✅ 同步完成：${detail}` +
      (stripSuffix ? '\n   .js 后缀已剥除' : '\n   .js 后缀已保留（--keep-suffix）') +
      '\n   .meta 由编辑器生成，本脚本永不触碰。' +
      skippedNote,
  );
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
