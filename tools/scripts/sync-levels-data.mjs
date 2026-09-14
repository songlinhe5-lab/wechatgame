#!/usr/bin/env node
/**
 * sync-levels-data.mjs — regenerate each game's `src/config/levels-data.ts`
 * from its authoritative design JSON.
 *
 * WHY THIS EXISTS
 * ---------------
 * A game's `design/levels/*.json` is the single source of truth for level
 * content (frozen by that game's `design/gdd/systems-index.md §3`). But importing
 * a `.json` file *outside* `src/` does not work in every consumer we must
 * support:
 *   - Cocos Creator only loads assets that live under its `assets/` tree and
 *     requires a `.json` asset type;
 *   - a raw browser ESM module cannot import JSON without an import attribute.
 *
 * So we generate a plain TypeScript module that `src/` imports normally. The
 * generated file is a **build artifact**; the JSON stays authoritative.
 *
 * ── ⚠️ WXG-T-048：本脚本已泛化为「多游戏驱动器」────────────────────────────
 * 此前它把 `games/breakout/...` 的路径与 TS 接口**硬编码在脚本里**，导致：
 *   · 第二款游戏（beads）**有完整的关卡 JSON 与产物，却完全没有门禁**——
 *     `levels:check` 只校验 breakout，且**静默报绿**（`verify` 里也报绿）。
 *     这属 `knowledge/lessons.md` K-031 族：「清单是人写的枚举，且没有断言
 *     会因漏项而红」。
 *   · 补上门禁后**第一次运行即抓到真实漂移**：beads 的产物与其真源不一致，
 *     且此前一路绿灯（含 `verify` 与 beads 自身 40 个单测）。
 * 现在改为**每游戏自带内容 + 通用遍历**：
 *
 *   games/<game>/design/levels/<任意名>.json          ← 真源（每游戏恰好 1 个）
 *   games/<game>/design/levels/levels-data.header.txt ← **该游戏的 TS 接口模板**
 *                                                       （手工维护，不生成）
 *   games/<game>/src/config/levels-data.ts            ← 产物（生成）
 *
 * 生成规则（逐字节固定）：
 *   产物 = header 模板 + "\n" + "export const LEVELS_DATA: LevelsData = " + render(json) + ";\n"
 *
 * ⇒ **新增游戏零改本脚本**：放好 JSON 与 header 模板即被自动纳入门禁。
 * ⇒ **漏项会报红**（见下「覆盖面断言」），不再静默失效。
 *
 * ⚠️ 渲染风格是**全游戏统一**的（`JSON.stringify` 语义 ⇒ 双引号、数组多行、`6.0`→`6`）。
 * 各游戏的 header 模板可以不同，但**数据体必须由本脚本渲染**，不得手搓产物 ——
 * 否则 `--check` 会持续报红（这正是 beads 曾经的处境）。
 *
 * ── 副作用守卫（**不要移除**）────────────────────────────────────────────
 * 本模块导出 `buildModuleSource()` / `describeGame()` 供测试复用，因此所有
 * 写盘行为必须在 `main()` 内、且**仅当直接调用时**执行。违反此约定会让
 * 「import 一次 = 改一次文件」——WXG-T-048 首版漏了该守卫，实测中一次 import
 * 就改写了 beads 的产物。
 *
 * ── 覆盖面断言（门禁真身）────────────────────────────────────────────────
 * 对「文件系统里实际是什么」作断言，任一不成立即 **exit 1**：
 *   ① 有 `design/levels/*.json` ⇒ **必须**有 `levels-data.header.txt`
 *   ② 有 `design/levels/*.json` ⇒ **必须**有 `src/config/levels-data.ts`
 *   ③ 有 `levels-data.header.txt` ⇒ **必须**有 JSON（孤儿模板）
 *   ④ `design/levels/` 下 `.json` 必须**恰好 1 个**（多个则歧义）
 * 前三条是 K-031 的结构性补丁：**只要游戏加了关卡数据就会被强制登记**。
 *
 * USAGE
 *   node tools/scripts/sync-levels-data.mjs              # 全部游戏：写出漂移的产物
 *   node tools/scripts/sync-levels-data.mjs --check      # 全部游戏：校验，漂移即 exit 1
 *   node tools/scripts/sync-levels-data.mjs --game=beads # 只处理某款游戏
 *
 * 退出码：0 = 全部一致（或已写出）；1 = 漂移（--check）或覆盖面断言失败；2 = 用法错误。
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const GAMES_DIR = join(root, 'games');

const HEADER_FILE = 'levels-data.header.txt';
const TARGET_REL = 'src/config/levels-data.ts';
const CONST_NAME = 'LEVELS_DATA';

const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) {
  printHelp();
  process.exit(0);
}
const CHECK_ONLY = argv.includes('--check');
const gameFilter = argv.find((a) => a.startsWith('--game='))?.slice('--game='.length) ?? null;

// ─────────────────────────────────────────────────────────── 发现 ───────────

/**
 * 发现需要生成器的游戏。判据是**文件系统**（有没有关卡 JSON），
 * 不是人写的清单 —— 这正是 K-031 的修法。
 */
function discover() {
  const games = [];
  const problems = [];

  let names = [];
  try {
    names = readdirSync(GAMES_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort();
  } catch {
    return { games, problems: [`无法读取 ${GAMES_DIR}`] };
  }

  for (const name of names) {
    if (gameFilter && name !== gameFilter) continue;

    const levelsDir = join(GAMES_DIR, name, 'design', 'levels');
    const headerPath = join(levelsDir, HEADER_FILE);
    const targetPath = join(GAMES_DIR, name, TARGET_REL);
    const jsonFiles = isDir(levelsDir) ? listJson(levelsDir) : [];
    const hasHeader = isFile(headerPath);
    const hasTarget = isFile(targetPath);

    // 与生成器无关的游戏（无 JSON / 无 header）→ 跳过
    if (jsonFiles.length === 0 && !hasHeader) continue;

    // 断言 ④：真源必须唯一（各游戏文件名不同，故不能靠固定名）
    if (jsonFiles.length > 1) {
      problems.push(
        `${name}：design/levels/ 下有 ${jsonFiles.length} 个 .json（${jsonFiles.join('、')}）—— ` +
          '真源必须唯一，请删掉多余文件或明确保留哪一个',
      );
      continue;
    }

    // 断言 ① / ③：JSON 与 header 模板必须成对
    if (jsonFiles.length === 1 && !hasHeader) {
      problems.push(
        `${name}：有 ${jsonFiles[0]} 但缺 ${HEADER_FILE} —— ` +
          '**该游戏的关卡产物没有任何门禁**（K-031 族静默失效）。' +
          `处置：把该游戏 levels-data.ts 的头部（\`export const ${CONST_NAME}\` 之前的部分）` +
          `原样另存为 design/levels/${HEADER_FILE}（须逐字节一致），再跑一次本脚本`,
      );
      continue;
    }
    if (jsonFiles.length === 0 && hasHeader) {
      problems.push(`${name}：有 ${HEADER_FILE} 但 design/levels/ 下无 .json —— 孤儿模板，请补回真源或删除模板`);
      continue;
    }

    // 断言 ②：产物必须存在
    if (!hasTarget) {
      problems.push(`${name}：缺 ${TARGET_REL} —— 真源在但产物没生成（跑一次不带 --check 的本脚本）`);
      continue;
    }

    games.push({ name, jsonPath: join(levelsDir, jsonFiles[0]), jsonName: jsonFiles[0], headerPath, targetPath });
  }

  if (gameFilter && games.length === 0 && problems.length === 0) {
    problems.push(`--game=${gameFilter} 未匹配到任何需要生成器的游戏（检查游戏名，或该游戏尚未添加关卡 JSON）`);
  }
  return { games, problems };
}

// ─────────────────────────────────────────────────────────── 渲染 ───────────

/** Render a JS value as pretty, deterministic TypeScript source. */
function render(value, indent = 0) {
  const pad = '  '.repeat(indent);
  const inner = '  '.repeat(indent + 1);

  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((v) => `${inner}${render(v, indent + 1)}`);
    return `[\n${items.join(',\n')},\n${pad}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    const items = keys.map(
      (k) => `${inner}${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${render(value[k], indent + 1)}`,
    );
    return `{\n${items.join(',\n')},\n${pad}}`;
  }
  return JSON.stringify(value);
}

/**
 * Build the exact source text for one game's generated module.
 * 逐字节契约见文件头。导出以便测试复用（**不写盘**）。
 */
export function buildModuleSource(game) {
  const header = readFileSync(game.headerPath, 'utf8');
  const data = JSON.parse(readFileSync(game.jsonPath, 'utf8'));
  return `${header}\nexport const ${CONST_NAME}: LevelsData = ${render(data, 0)};\n`;
}

/** 便于测试：按游戏名取描述对象（返回 null 表示该游戏不参与生成）。 */
export function describeGame(name) {
  const { games } = discover();
  return games.find((g) => g.name === name) ?? null;
}

// ─────────────────────────────────────────────────────────── 主流程 ─────────

function main() {
  const { games, problems } = discover();

  if (problems.length) {
    console.error('❌ levels 生成器覆盖面断言失败（WXG-T-048）：');
    for (const p of problems) console.error(`   · ${p}`);
    console.error('');
    console.error('   这些断言存在的理由：此前脚本把路径硬编码成 breakout，导致第二款游戏有真源、');
    console.error('   有产物、却完全没有门禁，而且门禁照绿。断言把「漏登记」从静默变成报红。');
    process.exit(1);
  }

  if (games.length === 0) {
    console.log('（没有游戏带 design/levels/ 真源，跳过）');
    process.exit(0);
  }

  const drifted = [];
  const inSync = [];

  for (const game of games) {
    const expected = buildModuleSource(game);
    let actual = null;
    try {
      actual = readFileSync(game.targetPath, 'utf8');
    } catch {
      actual = null;
    }
    if (actual === expected) inSync.push(game);
    else drifted.push({ game, expected });
  }

  const rel = (p) => p.replace(`${root}/`, '');

  if (CHECK_ONLY) {
    for (const g of inSync) console.log(`✅ ${g.name}: ${rel(g.targetPath)} 与 ${g.jsonName} 一致`);
    for (const { game } of drifted) {
      console.error(`❌ ${game.name}: ${rel(game.targetPath)} 与 ${game.jsonName} 不一致`);
      console.error(`   修：node tools/scripts/sync-levels-data.mjs --game=${game.name}`);
    }
    if (drifted.length) {
      console.error('');
      console.error(`❌ levels:check FAILED —— ${drifted.length}/${games.length} 款游戏漂移`);
      process.exit(1);
    }
    console.log('');
    console.log(`✅ levels:check OK —— ${games.length} 款游戏全部一致（${games.map((g) => g.name).join('、')}）`);
    process.exit(0);
  }

  for (const g of inSync) console.log(`✅ ${g.name}: 已一致，跳过`);
  for (const { game, expected } of drifted) {
    writeFileSync(game.targetPath, expected, 'utf8');
    console.log(`✍️  ${game.name}: 写出 ${rel(game.targetPath)}`);
  }
  console.log('');
  console.log(
    drifted.length
      ? `✅ 已同步 ${drifted.length} 款游戏（${drifted.map((d) => d.game.name).join('、')}）`
      : `✅ 全部一致，无需改动（${games.length} 款游戏）`,
  );
}

// 仅直接调用时执行（守卫的必要性见文件头「副作用守卫」）。
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}

// ─────────────────────────────────────────────────────────── helpers ────────

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function listJson(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function printHelp() {
  console.log(`关卡产物生成器（多游戏驱动器，WXG-T-048）

用法：
  node tools/scripts/sync-levels-data.mjs                # 写出全部漂移的产物
  node tools/scripts/sync-levels-data.mjs --check        # 只校验，漂移即 exit 1
  node tools/scripts/sync-levels-data.mjs --game=<name>  # 只处理某款游戏

每游戏的文件约定（新增游戏**不需要改本脚本**）：
  games/<game>/design/levels/<任意名>.json          真源（每游戏恰好 1 个）
  games/<game>/design/levels/levels-data.header.txt 该游戏的 TS 接口模板（手工维护）
  games/<game>/src/config/levels-data.ts            产物（生成）

生成契约（逐字节固定）：
  header 模板 + "\\n" + "export const ${CONST_NAME}: LevelsData = " + render(json) + ";\\n"
  渲染风格全游戏统一（双引号 / 数组多行 / 6.0→6）——产物不得手搓。

覆盖面断言（任一不成立即 exit 1）：
  ① 有 .json ⇒ 必须有 header 模板  ② 有 .json ⇒ 必须有产物
  ③ 有 header 模板 ⇒ 必须有 .json  ④ design/levels/ 下 .json 必须唯一

真源：各游戏 design/gdd/systems-index.md §3（冻结常量）。`);
}
