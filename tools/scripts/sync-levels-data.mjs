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
const MANIFEST_FILE = 'manifest.json'; // 目录模式入口（关卡内容管线 P1）
const PALETTE_FILE = 'palette.json';   // 目录模式共享色板

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

    const manifestPath = join(levelsDir, MANIFEST_FILE);
    const hasManifest = isFile(manifestPath);
    // 关卡 json 集：排除目录模式的入口 manifest.json 与共享 palette.json
    const levelJsons = jsonFiles.filter((f) => f !== MANIFEST_FILE && f !== PALETTE_FILE);

    // 与生成器无关的游戏（无关卡 json / 无 manifest / 无 header）→ 跳过
    if (levelJsons.length === 0 && !hasManifest && !hasHeader) continue;

    // ── 目录模式（有 manifest.json）：manifest 为关卡唯一顺序真源 ──
    if (hasManifest) {
      if (levelJsons.length > 0) {
        problems.push(
          `${name}：目录模式（有 ${MANIFEST_FILE}）却仍有顶层关卡 json：${levelJsons.join('、')} —— ` +
          '二者歧义，只保留 manifest 驱动（删除多余顶层关卡 json）',
        );
        continue;
      }
      if (!hasHeader) {
        problems.push(`${name}：目录模式缺 ${HEADER_FILE} —— 产物无接口模板`);
        continue;
      }
      if (!hasTarget) {
        problems.push(`${name}：目录模式缺 ${TARGET_REL} —— 跑一次不带 --check 的本脚本`);
        continue;
      }
      games.push({ name, mode: 'dir', manifestPath, levelsDir, headerPath, targetPath, jsonName: MANIFEST_FILE });
      continue;
    }

    // ── 单 JSON 模式（legacy，如 breakout）：断言④真源唯一 ──
    if (levelJsons.length > 1) {
      problems.push(
        `${name}：无 ${MANIFEST_FILE} 且 design/levels/ 下有 ${levelJsons.length} 个关卡 .json（${levelJsons.join('、')}）—— ` +
        `真源要么恰好 1 个，要么改用 ${MANIFEST_FILE} 目录模式`,
      );
      continue;
    }

    // 断言 ① / ③：JSON 与 header 模板必须成对
    if (levelJsons.length === 1 && !hasHeader) {
      problems.push(
        `${name}：有 ${levelJsons[0]} 但缺 ${HEADER_FILE} —— ` +
        '**该游戏的关卡产物没有任何门禁**（K-031 族静默失效）。' +
        `处置：把该游戏 levels-data.ts 的头部（\`export const ${CONST_NAME}\` 之前的部分）` +
        `原样另存为 design/levels/${HEADER_FILE}（须逐字节一致），再跑一次本脚本`,
      );
      continue;
    }
    if (levelJsons.length === 0 && hasHeader) {
      problems.push(`${name}：有 ${HEADER_FILE} 但 design/levels/ 下无 .json —— 孤儿模板，请补回真源或删除模板`);
      continue;
    }

    // 断言 ②：产物必须存在
    if (!hasTarget) {
      problems.push(`${name}：缺 ${TARGET_REL} —— 真源在但产物没生成（跑一次不带 --check 的本脚本）`);
      continue;
    }

    games.push({ name, mode: 'single', jsonPath: join(levelsDir, levelJsons[0]), jsonName: levelJsons[0], headerPath, targetPath });
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
  const data =
    game.mode === 'dir' ? assembleFromManifest(game) : JSON.parse(readFileSync(game.jsonPath, 'utf8'));
  return `${header}\nexport const ${CONST_NAME}: LevelsData = ${render(data, 0)};\n`;
}

/**
 * dev-only 真源字段：随关卡 JSON 落盘（取证/审计用），**不进产物**。
 * `pricing` = 定价溯源块（生成期 bot 实测动作数/下界/当时单价，或 playtest 实测用时），
 * 运行期无人读 ⇒ 进包体 = 白付体积与镜像同步成本。构造器 = `beads-bot.ts::pricingOf`。
 */
const DEV_ONLY_FIELDS = ['pricing'];

/**
 * 装配前校验定价溯源与 `time` 一致（**dev 侧断言，不走 BOOT**：BOOT 拿到的产物已被剔过
 * `pricing`，看不见溯源）。任一不成立 ⇒ throw，与 K-031 同口径：硬红不静默报绿。
 *
 * 语义 = **溯源记录**，不是活公式：`secPerStep` 随当时写定，后续回调 `SEC_PER_STEP`
 * 不致旧关集体报红（v0.3 已允许逐关按实测 `t_act × k` 定价，不再要求全表同单价）。
 */
export function assertPricing(uid, lv) {
  const p = lv.pricing;
  if (!p) return; // 无溯源块（老关卡 / breakout）⇒ 不断言
  if (!Number.isInteger(lv.time) || lv.time <= 0)
    throw new Error(`${uid}: time=${JSON.stringify(lv.time)} 非法`);
  if (p.source === 'playtest') {
    if (!(p.tAct > 0) || !(p.k > 0))
      throw new Error(`${uid}: pricing.source=playtest 但缺 tAct/k（§5.0 公式 v0.4）`);
    if (Math.abs(lv.time - Math.round(p.tAct * p.k)) > 1)
      throw new Error(`${uid}: time=${lv.time} 与 playtest 定价 round(tAct=${p.tAct} × k=${p.k}) 不符 ⇒ 改了 time 未回写溯源`);
    return;
  }
  if (p.source !== 'bot')
    throw new Error(`${uid}: pricing.source=${JSON.stringify(p.source)} 未知（仅 bot/playtest）`);
  if (!(Number.isInteger(p.steps) && p.steps > 0) || !(p.secPerStep > 0))
    throw new Error(`${uid}: pricing.source=bot 但 steps/secPerStep 非法`);
  // 下界不变式：可达步数不可能少于「错位连通组数」这个可证明下界 ⇒ 破了就是 bot 或度量写错
  if (p.stepsLB > p.steps)
    throw new Error(`${uid}: stepsLB=${p.stepsLB} > steps=${p.steps} ⇒ 错位组数下界被突破，疑回归`);
  if (p.cleared === false)
    throw new Error(`${uid}: pricing.cleared=false ⇒ 可解性未证实，不可入关（§5.0 硬拦闸）`);
  if (!p.clamped && Math.abs(lv.time - Math.round(p.steps * p.secPerStep)) > 1)
    throw new Error(`${uid}: time=${lv.time} 与 round(steps=${p.steps} × secPerStep=${p.secPerStep}) 不符 ⇒ 改了 pattern/time 未重跑 beads-bot --patch`);
}

/** 剔除 dev-only 字段（浅拷贝；关卡数据本体不突变）。 */
function stripDevFields(lv) {
  assertPricing(`L${lv.id}`, lv);
  if (!DEV_ONLY_FIELDS.some((k) => k in lv)) return lv;
  const out = {};
  for (const k of Object.keys(lv)) if (!DEV_ONLY_FIELDS.includes(k)) out[k] = lv[k];
  return out;
}

/**
 * 目录模式装配（关卡内容管线 P1）：读 manifest + palette.json + singles/plates，
 * 按 entry.order 展开成与旧单文件**同形同序**的 LevelsData 对象。
 * 装配即断言（任一不成立 throw ⇒ --check/main 硬红，不静默报绿，K-031）：
 *   order 连续 1..N｜uid 唯一｜引用文件存在｜singles/+plates/ 无孤儿文件｜定价溯源与 time 一致。
 * 导出供单测复用（**不写盘**）。
 */

export function assembleFromManifest(game) {
  const man = JSON.parse(readFileSync(game.manifestPath, 'utf8'));
  const paletteDoc = JSON.parse(readFileSync(join(game.levelsDir, man.paletteFile), 'utf8'));
  const entries = [...man.entries].sort((a, b) => a.order - b.order);
  const uids = new Set();
  const referenced = new Set();
  const levels = [];
  entries.forEach((e, i) => {
    // order：唯一且严格递增（允许退役留空洞，spec §1.2 retired 占位）
    if (i > 0 && e.order <= entries[i - 1].order)
      throw new Error(`${game.name}: manifest order 非严格递增（${entries[i - 1].order} → ${e.order}）`);
    if (uids.has(e.uid)) throw new Error(`${game.name}: uid 重复 ${e.uid}`);
    uids.add(e.uid);
    // K-031：kind/pack 白名单——typo 或非 main 分片不得静默当成 single / 静默进主包
    if (e.kind !== 'single' && e.kind !== 'plate')
      throw new Error(`${game.name}: 未知 kind=${JSON.stringify(e.kind)}（${e.uid}），仅允许 single/plate`);
    if (e.pack !== 'main')
      throw new Error(`${game.name}: pack=${JSON.stringify(e.pack)} 分片未实现（P3），P1 仅允许 main：${e.uid}`);
    const fp = join(game.levelsDir, e.file);
    if (referenced.has(e.file)) throw new Error(`${game.name}: 文件被多条 entry 重复引用 ${e.file}`);
    referenced.add(e.file);
    if (e.retired) return; // 退役：保留 order 占位，不校验文件也不进产物
    if (!isFile(fp)) throw new Error(`${game.name}: manifest 引用文件缺失 ${e.file}`);
    const obj = JSON.parse(readFileSync(fp, 'utf8'));
    if (e.kind === 'plate') for (const c of obj.cells) levels.push(stripDevFields(c)); // P2 填；P1 无 plate
    else levels.push(stripDevFields(obj));
  });
  for (const sub of ['singles', 'plates']) {
    const d = join(game.levelsDir, sub);
    if (!isDir(d)) continue;
    for (const f of readdirSync(d).filter((x) => x.endsWith('.json'))) {
      const relFile = `${sub}/${f}`;
      if (!referenced.has(relFile)) throw new Error(`${game.name}: 孤儿关卡文件 ${relFile} 未被 manifest 引用`);
    }
  }
  // P1 单份装配语义（分片延 P3）：schemaVersion→产物 LEVELS_DATA.version（非 manifest 自身格式版本，
  // 改 manifest 格式勿 bump 它）；pack 全 main 不参与分片；contentVersion 不进产物（住真源层，为 P2/远程热更预留）。
  const out = { version: man.schemaVersion, gameId: man.gameId, palette: paletteDoc.palette };
  if (man.description !== undefined) out.description = man.description;
  out.levels = levels;
  return out;
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

每游戏的文件约定（新增游戏**不需要改本脚本**）——**两种真源模式**：
  【目录模式】design/levels/manifest.json + palette.json + singles/ + plates/  ← beads（P1 起）
     manifest.entries[{uid,kind,file,pack,order}] 为关卡唯一顺序真源；Plate 展开为 N 个 cell
  【单 JSON 模式】games/<game>/design/levels/<任意名>.json（恰 1 个）      ← breakout 等 legacy
  两模式共用：design/levels/levels-data.header.txt（TS 接口模板）+ src/config/levels-data.ts（产物）

生成契约（逐字节固定）：
  header 模板 + "\\n" + "export const ${CONST_NAME}: LevelsData = " + render(json) + ";\\n"
  渲染风格全游戏统一（双引号 / 数组多行 / 6.0→6）——产物不得手搓。

覆盖面断言（任一不成立即 exit 1）：
  ① 有关卡 json ⇒ 必须有 header 模板  ② 有真源 ⇒ 必须有产物
  ③ 有 header 模板 ⇒ 必须有真源  ④ 无 manifest.json 时顶层关卡 .json 必须唯一（有 manifest 走目录模式）

真源：各游戏 design/gdd/systems-index.md §3（冻结常量）。`);
}
