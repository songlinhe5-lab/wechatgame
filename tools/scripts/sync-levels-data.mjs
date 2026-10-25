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
 * ── 大关（chapter）配置层（WXG-T-335 §11 / WXG-T-336 CH-S2）─────────────────
 * 目录模式下可选开启（manifest.chapters[] 与 chapters/ 目录**双向绑定**）：
 *   games/<game>/design/levels/chapters/<id>.json      ← 章语义真源（一物一文件）
 *   games/<game>/design/levels/arcs-data.header.txt    ← arcs.ts 的接口模板（手工）
 *   games/<game>/src/config/arcs.ts                    ← 产物（生成；导出手写时代同名）
 *   manifest.chapters[{id,file,order,open}]            ← 章序 / 开放索引
 * 生成契约同 levels-data：header + "\n" + 数据体；数据体 = ARCS + ARC_OPEN_MAX + OPEN_ARCS。
 * title 上移（WXG-T-337 CH-S3）：章 `title` 生成期注入到**章收尾关记录**（追加在对象末尾）；
 * 源关卡 JSON ⛔ 手写 title（断言 8 拒收——展示名唯一真源 = 所属章）。
 * ⇒ 6 个运行时消费点零改动；改大关 = 改 chapters/*.json + manifest 一行，⛔ 不改产物。
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
 *   ⑤ 声明了 `DEMO_LEVEL_COUNT` 的游戏 ⇒ 该值必须 == manifest 当前关数（WXG-T-231 门禁⑤）
 *   ⑥ 目录模式且该游戏有 `difficulty.ts` ⇒ 同类内 `DI` 无退化（可排出严格序；门禁⑥/G6，WXG-T-266）
 *   ⑦ 目录模式且该游戏 tuning 声明 `NORMAL_STEPS_MIN` ⇒ 普通关 `steps` 落区间 / boss 高于阈值 / 首关豁免（门禁⑦，2026-10-10）
 *   ⑨ 目录模式 ⇒ 每条关卡记录**自带稳定身份** `uid`（ADR-0034 §6 S-1 · DEC-1/DEC-2；判据 = `save-progress v1.3 §8-22`）：
 *     token 全表唯一（plate 逐格互异）且序 == `order` 展开序；身份 = 存档记账轴，与数值 `id`（装配下标）解耦
 * 前三条是 K-031 的结构性补丁：**只要游戏加了关卡数据就会被强制登记**。
 * ⇒ ⑥ 需引游戏侧 TS 单一真源 ⇒ `levels:sync`/`levels:check` 带 `--import=./tools/scripts/lib/ts-js-resolve.mjs` 钩子运行。
 *
 * USAGE
 *   node --import=./tools/scripts/lib/ts-js-resolve.mjs tools/scripts/sync-levels-data.mjs              # 全部游戏：写出漂移的产物
 *   node --import=./tools/scripts/lib/ts-js-resolve.mjs tools/scripts/sync-levels-data.mjs --check      # 全部游戏：校验，漂移即 exit 1
 *   （或直接 `pnpm levels:sync` / `pnpm levels:check`；钩子必需理由见上⑥）
 *
 * 退出码：0 = 全部一致（或已写出）；1 = 漂移（--check）或覆盖面断言失败；2 = 用法错误。
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { analyze as analyzePattern, judge as judgePattern } from './lib/pattern-legibility.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const GAMES_DIR = join(root, 'games');

const HEADER_FILE = 'levels-data.header.txt';
const TARGET_REL = 'src/config/levels-data.ts';
const CONST_NAME = 'LEVELS_DATA';
const MANIFEST_FILE = 'manifest.json'; // 目录模式入口（关卡内容管线 P1）
const PALETTE_FILE = 'palette.json';   // 目录模式共享色板
// 大关（chapter）配置层（WXG-T-335 设计 §11 / WXG-T-336 CH-S2 落码）：
const CHAPTERS_DIR = 'chapters';              // 章配置目录（一物一文件；无则整层不生效）
const ARCS_HEADER_FILE = 'arcs-data.header.txt';
const ARCS_TARGET_REL = 'src/config/arcs.ts';
const ARCS_CONST_NAME = 'ARCS';

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
      // ── 大关（chapter）配置层：manifest.chapters[] 与 chapters/ 目录**双向绑定** ──
      // 单向漏配（只有目录或只有索引）都会静默改变「表里有哪些大关」⇒ 必须成对（§11.3）。
      let man = null;
      try {
        man = JSON.parse(readFileSync(manifestPath, 'utf8'));
      } catch (e) {
        problems.push(`${name}：${MANIFEST_FILE} 不是合法 JSON（${e instanceof Error ? e.message : e}）`);
        continue;
      }
      const hasChapters = Array.isArray(man.chapters);
      const chaptersDir = join(levelsDir, CHAPTERS_DIR);
      const hasChaptersDir = isDir(chaptersDir);
      if (hasChapters !== hasChaptersDir) {
        problems.push(
          `${name}：manifest.chapters[] 与 ${CHAPTERS_DIR}/ 目录必须成对（现：chapters=${hasChapters ? '有' : '无'} / 目录=${hasChaptersDir ? '有' : '无'}）—— ` +
          '双向绑定防「空索引」或「孤儿目录」静默改表',
        );
        continue;
      }
      const arcsHeaderPath = join(levelsDir, ARCS_HEADER_FILE);
      const arcsTargetPath = join(GAMES_DIR, name, ARCS_TARGET_REL);
      if (hasChapters) {
        if (!isFile(arcsHeaderPath)) {
          problems.push(`${name}：有 ${CHAPTERS_DIR}/ 但缺 ${ARCS_HEADER_FILE} —— 产物无接口模板`);
          continue;
        }
        if (!isFile(arcsTargetPath)) {
          problems.push(`${name}：有 ${CHAPTERS_DIR}/ 但缺 ${ARCS_TARGET_REL} —— 跑一次不带 --check 的本脚本`);
          continue;
        }
      }
      games.push({
        name, mode: 'dir', manifestPath, levelsDir, headerPath, targetPath, jsonName: MANIFEST_FILE,
        hasChapters, chaptersDir, arcsHeaderPath, arcsTargetPath,
      });
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
  // 定价基准档（§3.5 v1.84）：`tierK` 缺省 = 1（旧 1★ 基准记录，等式不变）；
  // 现值 0.85 = 2★ 档（基础 12 槽步数装进 2★ 时钟 = 紧平衡）。
  const tierK = p.tierK ?? 1;
  const priced = Math.ceil(Math.ceil(p.steps * p.secPerStep) / tierK);
  if (!p.clamped && Math.abs(lv.time - priced) > 1)
    throw new Error(
      `${uid}: time=${lv.time} 与 ceil(ceil(steps=${p.steps} × secPerStep=${p.secPerStep}) ÷ tierK=${tierK})=${priced} 不符 ⇒ 改了 pattern/time 未重跑 beads-bot --patch`,
    );
}

/** 剔除 dev-only 字段（浅拷贝；关卡数据本体不突变）。 */
function stripDevFields(lv) {
  assertPricing(`L${lv.id}`, lv);
  if (!DEV_ONLY_FIELDS.some((k) => k in lv)) return lv;
  const out = {};
  for (const k of Object.keys(lv)) if (!DEV_ONLY_FIELDS.includes(k)) out[k] = lv[k];
  return out;
}

/** 断言 8（CH-S3）：有大关层的游戏，源关卡记录 ⛔ 手写 `title`（展示名唯一真源 = 所属章）。 */
export function assertNoSourceTitle(gameName, file, obj) {
  if ('title' in obj)
    throw new Error(
      `${gameName}: 源关卡 ${file} 手写了 title=${JSON.stringify(obj.title)} —— ` +
      '展示名唯一真源 = 所属章 title（chapters/<id>.json），由生成期注入到章收尾关；' +
      '请从源关卡 JSON 删除该字段（§11.7 / CH-S3）',
    );
}

// ─────────────────── 关卡稳定身份通道（ADR-0034 DEC-1 / DEC-2 · §6 S-1）───────────────────

/**
 * 身份 token 规则（**manifest uid 的纯函数派生，⛔ 不是第二真源**，ADR-0034 DEC-1）：
 *   · `single` / `boss` → uid 原样（如 `L00001`）；
 *   · `plate` 的第 c 格（c ≥ 2）→ `L000NN#c`（c = 该 entry 展开内的 **1-based 格序**，首格不加后缀）。
 * 粒度 = 「装配槽」而非「文件」：一个 plate entry 占多槽，一格一星才谈得上「这一关几星」。
 * @param {string} uid manifest 里的关卡唯一 id
 * @param {number} cellOrdinal 1-based 格序（single/boss 恒为 1）
 * @returns {string}
 */
export function identityToken(uid, cellOrdinal = 1) {
  return cellOrdinal <= 1 ? uid : `${uid}#${cellOrdinal}`;
}

/** 把身份注入为记录**首键**（产物里 `uid` 恒为每条记录第一行 ⇒ 字节序稳定、diff 可读）。 */
function withIdentity(rec, token) {
  if ('uid' in rec)
    throw new Error(
      `${gameNameOf(rec)}: 源关卡记录自带 uid=${JSON.stringify(rec.uid)} —— 身份由生成期从 manifest uid 派生，` +
      '⛔ 不得由内容手写（否则 = 第二真源，§8-22-①）',
    );
  return { uid: token, ...rec };
}

function gameNameOf(rec) {
  return rec && rec.name !== undefined ? `L${rec.id}` : '关卡记录';
}

/**
 * S-1 生成期断言①②（判据源 = `design/gdd/save-progress.md` v1.3 **§8-22-①②**；ADR-0034 §6 S-1）。
 * 纯函数（无 IO、L4 确定性）⇒ 可 `node --test` 直测；由 `expandEntries` 调用 ⇒ `levels:sync` 与
 * `levels:check` 两条路径都咬得住（K-031：门禁必须对「实际生成」生效，不是对人写的清单）。
 *
 *  ① **token 全表唯一**（plate 逐格互异的直接体现）；
 *  ② **token 序 == `order` 展开序** —— 期望值由 `uidSpans`（uid → 装配槽区间）**独立重述** DEC-1 规则导出，
 *     与注入路径（`identityToken`）互不参照 ⇒ 任一路径被改坏即红（变异自证 M-1 打①、M-2 打②，
 *     两臂可分别归因）。
 *
 * ③「一关恰属一章」不在此重复实现：现成腿 = `assembleArcs` 的 `uid 被多章引用` 断言，
 *   其回归自证（新通道没把老守卫弄哑）落在 `sync-levels-data.test.mjs`（变异自证 M-3）。
 *
 * @param {string} gameName
 * @param {string[]} tokens 与 `levels` 同序的身份 token
 * @param {Map<string,{start:number,end:number}>} uidSpans `expandEntries` 构造的 uid → 1-based 闭区间
 */
export function assertLevelIdentities(gameName, tokens, uidSpans) {
  // 断言①：全表唯一（先查 ⇒ 后缀丢失类变异归因到①，不误报成②）
  const seen = new Set();
  for (let i = 0; i < tokens.length; i++) {
    if (seen.has(tokens[i]))
      throw new Error(
        `${gameName}: 身份 token 重复 ${JSON.stringify(tokens[i])}（第 ${i + 1} 槽）—— ` +
        'S-1 断言① 要求全表唯一、plate 逐格互异（ADR-0034 DEC-1；§8-22-①）',
      );
    seen.add(tokens[i]);
  }
  // 断言②：独立导出「第 i 槽应该是谁」，与注入的 token 数组逐位对账
  const expected = [];
  for (const [uid, span] of uidSpans) {
    const slots = span.end - span.start + 1;
    for (let j = 1; j <= slots; j++) expected.push(j === 1 ? uid : `${uid}#${j}`);
  }
  if (tokens.length !== expected.length)
    throw new Error(
      `${gameName}: 身份 token 条数 ${tokens.length} ≠ 装配槽数 ${expected.length} —— ` +
      '每条关卡记录必须恰有一个身份（S-1 断言②；§8-22-②）',
    );
  for (let i = 0; i < expected.length; i++) {
    if (tokens[i] !== expected[i])
      throw new Error(
        `${gameName}: 身份对位失败 —— 第 ${i + 1} 槽注入 ${JSON.stringify(tokens[i])}，` +
        `而 order 展开序派生值 = ${JSON.stringify(expected[i])}（S-1 断言②：` +
        '身份序须与装配槽序一致 ⇒「第 i 格是谁」永远可答，⛔ 需要第二条换算路径才能对位，§8-22-②）',
      );
  }
}

/**
 * CH-S3：章 `title` 注入到该章**收尾关记录**（`levels[]` 末项 uid 的最后一个展开槽 = plate 末 cell；
 * 追加在对象末尾 ⇒ 产物 diff 仅该记录一行）。纯函数（无 IO）⇒ 可 `node --test` 直测。
 * 末项 uid 不在装配表（拼错 / retired）或 title 非法时跳过 —— 该情形由 `assembleArcs` 断言报红，此处不重复报错。
 */
export function injectChapterTitles(levels, chapter, uidSpans) {
  const lastUid = chapter.levels?.[chapter.levels.length - 1];
  const span = lastUid != null ? uidSpans.get(lastUid) : undefined;
  if (!span) return;
  if (typeof chapter.title !== 'string' || chapter.title.length === 0) return;
  levels[span.end - 1].title = chapter.title;
}

/**
 * 目录模式装配内核（关卡内容管线 P1 + 大关层共用）：读 manifest + palette.json + singles/plates，
 * 按 entry.order 展开成与旧单文件**同形同序**的 levels 数组。
 * 装配即断言（任一不成立 throw ⇒ --check/main 硬红，不静默报绿，K-031）：
 *   order 连续 1..N｜uid 唯一｜引用文件存在｜singles/+plates/ 无孤儿文件｜定价溯源与 time 一致｜
 *   身份 token 全表唯一且与装配槽序同命（S-1 断言①②，ADR-0034 DEC-1）。
 * 附带 `uidSpans`：uid → 装配后 1-based 闭区间 [start,end]（plate 占多槽）——大关 levelRefs 的
 * **唯一**换算来源，⛔ 不得另行重数 uid（第二索引 = 第二真源）。
 */
function expandEntries(game) {
  const man = JSON.parse(readFileSync(game.manifestPath, 'utf8'));
  const paletteDoc = JSON.parse(readFileSync(join(game.levelsDir, man.paletteFile), 'utf8'));
  const hasChapters = Array.isArray(man.chapters);
  const entries = [...man.entries].sort((a, b) => a.order - b.order);
  const uids = new Set();
  const referenced = new Set();
  const levels = [];
  const tokens = [];
  const uidSpans = new Map();
  entries.forEach((e, i) => {
    // order：唯一且严格递增（允许退役留空洞，spec §1.2 retired 占位）
    if (i > 0 && e.order <= entries[i - 1].order)
      throw new Error(`${game.name}: manifest order 非严格递增（${entries[i - 1].order} → ${e.order}）`);
    if (uids.has(e.uid)) throw new Error(`${game.name}: uid 重复 ${e.uid}`);
    uids.add(e.uid);
    // K-031：kind/pack 白名单——typo 或非 main 分片不得静默当成 single / 静默进主包
    // kind 三值：single（普通关）｜plate（P2 组合图）｜boss（boss 关，仍为单文件盘，仅供门禁⑦/展示层取用）
    if (e.kind !== 'single' && e.kind !== 'plate' && e.kind !== 'boss')
      throw new Error(`${game.name}: 未知 kind=${JSON.stringify(e.kind)}（${e.uid}），仅允许 single/plate/boss`);
    if (e.pack !== 'main')
      throw new Error(`${game.name}: pack=${JSON.stringify(e.pack)} 分片未实现（P3），P1 仅允许 main：${e.uid}`);
    const fp = join(game.levelsDir, e.file);
    if (referenced.has(e.file)) throw new Error(`${game.name}: 文件被多条 entry 重复引用 ${e.file}`);
    referenced.add(e.file);
    if (e.retired) return; // 退役：保留 order 占位，不校验文件也不进产物
    if (!isFile(fp)) throw new Error(`${game.name}: manifest 引用文件缺失 ${e.file}`);
    const obj = JSON.parse(readFileSync(fp, 'utf8'));
    // 断言 8（CH-S3）：有大关层时源关卡 ⛔ 手写 title（展示名唯一真源 = 章，见 injectChapterTitles）
    if (hasChapters) {
      if (e.kind === 'plate') for (const c of obj.cells) assertNoSourceTitle(game.name, e.file, c);
      else assertNoSourceTitle(game.name, e.file, obj);
    }
    const start = levels.length + 1;
    // S-1（ADR-0034 DEC-1 / DEC-2）：每条关卡记录自带稳定身份 token（= 存档记账轴，与 `id` 轴解耦）。
    // plate 按 1-based 格序逐格派生（首格无后缀、c≥2 加 `#c`）⇒ 「一格一星」有唯一可记名。
    if (e.kind === 'plate') {
      obj.cells.forEach((c, ci) => {
        const token = identityToken(e.uid, ci + 1);
        levels.push(withIdentity(stripDevFields(c), token));
        tokens.push(token);
      });
    } else {
      const token = identityToken(e.uid, 1);
      levels.push(withIdentity(stripDevFields(obj), token));
      tokens.push(token);
    }
    uidSpans.set(e.uid, { start, end: levels.length, kind: e.kind, pack: e.pack });
  });
  // S-1 断言①②（§8-22-①②）：在装配当场一次性对账 ⇒ levels:sync / levels:check 两路同拦。
  assertLevelIdentities(game.name, tokens, uidSpans);
  for (const sub of ['singles', 'plates']) {
    const d = join(game.levelsDir, sub);
    if (!isDir(d)) continue;
    for (const f of readdirSync(d).filter((x) => x.endsWith('.json'))) {
      const relFile = `${sub}/${f}`;
      if (!referenced.has(relFile)) throw new Error(`${game.name}: 孤儿关卡文件 ${relFile} 未被 manifest 引用`);
    }
  }
  // CH-S3：章 title 生成期注入章收尾关记录（`levels-data.ts` 的木牌关名由此派生）
  if (hasChapters) {
    for (const c of man.chapters) {
      let ch = null;
      try {
        ch = JSON.parse(readFileSync(join(game.levelsDir, c.file), 'utf8'));
      } catch {
        continue; // 章文件缺失/非法由 assembleArcs 断言报红（此处不重复报错）
      }
      injectChapterTitles(levels, ch, uidSpans);
    }
  }
  return { man, paletteDoc, entries, levels, uidSpans };
}

/**
 * 目录模式装配（关卡内容管线 P1）：expandEntries 的 LevelsData 薄壳 + 门禁⑤。
 * 导出供单测复用（**不写盘**）。
 */
export function assembleFromManifest(game) {
  const { man, paletteDoc, levels } = expandEntries(game);
  // P1 单份装配语义（分片延 P3）：schemaVersion→产物 LEVELS_DATA.version（非 manifest 自身格式版本，
  // 改 manifest 格式勿 bump 它）；pack 全 main 不参与分片；contentVersion 不进产物（住真源层，为 P2/远程热更预留）。
  const out = { version: man.schemaVersion, gameId: man.gameId, palette: paletteDoc.palette };
  if (man.description !== undefined) out.description = man.description;
  out.levels = levels;
  // 断言⑤（WXG-T-231，2026-10-02）：声明了 `DEMO_LEVEL_COUNT` 的游戏，该值必须 == 当前关数。
  // 为什么加：此前这类漂移**只在事后单测红**（levels / misplaced-assembler / level-import），
  // 生成期无拦截 ⇒ 入关批漏同步常量会静默一段时间（`81b08ed` 入第 9 关漏同步，红了 3 天 4 处才被立项）。
  // 只对**声明了该常量**的游戏生效 ⇒ breakout 等 legacy 单 JSON 模式零影响。
  const tuningPath = join(GAMES_DIR, game.name, 'src', 'config', 'tuning.ts');
  if (isFile(tuningPath)) {
    const declared = /export const DEMO_LEVEL_COUNT = (\d+)/.exec(readFileSync(tuningPath, 'utf8'));
    if (declared && Number(declared[1]) !== levels.length) {
      throw new Error(
        `${game.name}: DEMO_LEVEL_COUNT=${declared[1]} ≠ manifest 当前关数 ${levels.length} —— ` +
        '入关 / 移出关时必须**同批同步**该常量（systems-index §3 同源），' +
        '否则 levels / misplaced-assembler / level-import 三处断言当场红',
      );
    }
  }
  return out;
}

// ─────────────────────────────────────── 大关（chapter）配置层 ────────

/**
 * 章内 uid 序列 → 1-based 连续区间（章内相邻且装配下标连续的段合并为 [from,to]）。
 * 纯函数（无 IO，L4 确定性）⇒ 可 `node --test` 直测。
 */
export function uidSlotsToLevelRefs(uids, uidSpans) {
  const refs = [];
  for (const uid of uids) {
    const span = uidSpans.get(uid);
    if (!span) throw new Error(`uid ${uid} 无装配区间（调用方应先断言归属）`);
    const last = refs[refs.length - 1];
    if (last && span.start === last[1] + 1) last[1] = span.end;
    else refs.push([span.start, span.end]);
  }
  return refs;
}

/** `open:true` 前缀长度（= 本版投放的大关数，产物 `ARC_OPEN_MAX`）。纯函数。 */
export function openPrefixLength(chapters) {
  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  let n = 0;
  for (const c of sorted) {
    if (!c.open) break;
    n += 1;
  }
  return n;
}

/**
 * 断言 1′（CH-S4 抽出为纯函数）：`open:true` 必须自 order 最小起连续成前缀，洞即红
 * （否则「第 2 章开放、第 1 章锁着」类乱序投放会静默发生）。返回 `ARC_OPEN_MAX`。
 */
export function assertOpenPrefix(gameName, chapters) {
  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  const openMax = openPrefixLength(sorted);
  if (sorted.slice(openMax).some((c) => c.open))
    throw new Error(`${gameName}: chapters[].open 必须自 order=1 起连续成前缀（openMax=${openMax} 之后仍有 open:true）`);
  return openMax;
}

/** 章容量断言（纯函数，可 `node --test`）：展开槽位（plate 按 cell 数）超墙容量 = 内容静默不可见。 */
export function checkChapterCapacity(gameName, rows, wallCapacity) {
  for (const r of rows) {
    if (r.slots > wallCapacity)
      throw new Error(
        `${gameName}: 章 ${r.id} 展开 ${r.slots} 槽 > 墙容量 WALL_CAPACITY=${wallCapacity} ⇒ 超出关卡静默不可见（拆章或扩墙）`,
      );
  }
}

/**
 * 断言 5（CH-S4 抽出为纯函数）：章内 pack 必须一致（同章同 pack，禁跨包 §11.4-3）。
 * 注：P1 期上游 `pack!=='main'` 门前置拦截 ⇒ 本断言先绿后守；CH-S5 开包后用夹具「测试内桩」直测。
 */
export function assertChapterPackUniform(gameName, chapterId, packs) {
  for (const p of packs) {
    if (p !== packs[0])
      throw new Error(`${gameName}: 章 ${chapterId} 混包（${packs[0]} + ${p}）—— 同章同 pack，禁跨包（§11.4-3）`);
  }
}

/**
 * 大关配置装配 + 生成期断言集 1–7（§11.5；断言 8「源关卡 ⛔ 手写 title」已随 CH-S3 落在装配内核 expandEntries）。
 * 导出供测试复用（**不写盘**）。
 */
export function assembleArcs(game) {
  const { man, entries, levels, uidSpans } = expandEntries(game);
  const chapters = [...(man.chapters ?? [])].sort((a, b) => a.order - b.order);
  if (chapters.length === 0)
    throw new Error(`${game.name}: manifest.chapters[] 为空 —— 声明了大关层就必须至少 1 章（空表会静默清空橱窗）`);
  // 轴对齐（不变量）：产物 levelRefs 的 1-based 轴 = levels 数组下标 + 1（uid 换算安全的前提）
  levels.forEach((lv, i) => {
    if (lv.id !== i + 1)
      throw new Error(`${game.name}: 轴对齐失败 —— levels[${i}].id=${lv.id} ≠ ${i + 1}（关号轴与装配序不一致）`);
  });
  const arcs = [];
  const capacity = [];
  const seenUid = new Set();
  const seenIds = new Set();
  const seenTex = new Set();
  chapters.forEach((c, i) => {
    if (i > 0 && c.order <= chapters[i - 1].order)
      throw new Error(`${game.name}: chapters[].order 非严格递增（${chapters[i - 1].order} → ${c.order}）`);
    if (seenIds.has(c.id)) throw new Error(`${game.name}: 章 id 重复 ${c.id}`);
    seenIds.add(c.id);
    if (c.file !== `${CHAPTERS_DIR}/${c.id}.json`)
      throw new Error(`${game.name}: 章 file=${JSON.stringify(c.file)} 与 id=${c.id} 不成对（约定 ${CHAPTERS_DIR}/<id>.json）`);
    const fp = join(game.levelsDir, c.file);
    if (!isFile(fp)) throw new Error(`${game.name}: 章文件缺失 ${c.file}`);
    const ch = JSON.parse(readFileSync(fp, 'utf8'));
    if (ch.id !== c.id) throw new Error(`${game.name}: ${c.file} 的 id=${JSON.stringify(ch.id)} ≠ manifest ${c.id}`);
    if (typeof ch.title !== 'string' || ch.title.length === 0)
      throw new Error(`${game.name}: 章 ${c.id} title 为空（橱窗/木牌要显示它）`);
    if (!Array.isArray(ch.levels) || ch.levels.length === 0)
      throw new Error(`${game.name}: 章 ${c.id} levels[] 为空（空章 = 静默空橱窗，禁止）`);
    const kinds = [];
    const packs = [];
    let slots = 0;
    for (const uid of ch.levels) {
      if (seenUid.has(uid)) throw new Error(`${game.name}: uid ${uid} 被多章引用（关只归一个章）`);
      seenUid.add(uid);
      const span = uidSpans.get(uid);
      if (!span) throw new Error(`${game.name}: 章 ${c.id} 引用 uid ${uid} 不在 manifest 或已 retired`);
      packs.push(span.pack);
      kinds.push(span.kind);
      slots += span.end - span.start + 1;
    }
    assertChapterPackUniform(game.name, c.id, packs);
    const bossAt = kinds.flatMap((k, j) => (k === 'boss' ? [j] : []));
    if (bossAt.length !== 1)
      throw new Error(`${game.name}: 章 ${c.id} boss 恰 1 条（现 ${bossAt.length} 条）`);
    if (bossAt[0] !== ch.levels.length - 1)
      throw new Error(`${game.name}: 章 ${c.id} boss 必须是 levels[] 末项（现第 ${bossAt[0] + 1}/${ch.levels.length} 项）`);
    const sc = ch.showcase ?? {};
    for (const k of ['bundle', 'art', 'textureId'])
      if (typeof sc[k] !== 'string' || sc[k].length === 0)
        throw new Error(`${game.name}: 章 ${c.id} showcase.${k} 为空`);
    if (seenTex.has(sc.textureId)) throw new Error(`${game.name}: textureId ${sc.textureId} 全表重复`);
    seenTex.add(sc.textureId);
    if (!isFile(join(game.levelsDir, 'assets', `${sc.art}.png`)))
      throw new Error(`${game.name}: 章 ${c.id} showcase.art=${sc.art} 资产不存在（design/levels/assets/${sc.art}.png）`);
    arcs.push({ id: c.id, title: ch.title, bundle: sc.bundle, art: sc.art, textureId: sc.textureId, levelRefs: uidSlotsToLevelRefs(ch.levels, uidSpans) });
    capacity.push({ id: c.id, slots });
  });
  // 未退役 entry 必须被某章覆盖（否则该关在橱窗墙上不可达）；孤儿章文件反向查
  for (const e of entries) {
    if (!e.retired && !seenUid.has(e.uid))
      throw new Error(`${game.name}: ${e.uid} 未被任何章覆盖 ⇒ 橱窗墙上不可达（登记进某章 levels[]）`);
  }
  if (isDir(game.chaptersDir)) {
    for (const f of readdirSync(game.chaptersDir).filter((x) => x.endsWith('.json'))) {
      const id = f.slice(0, -'.json'.length);
      if (!seenIds.has(id))
        throw new Error(`${game.name}: 孤儿章文件 ${CHAPTERS_DIR}/${f} 未被 manifest.chapters 引用`);
    }
  }
  // open 前缀（ARC_OPEN_MAX）：必须自 order 最小起连续为 true，洞即红（断言 = assertOpenPrefix，CH-S4 抽出）
  const openMax = assertOpenPrefix(game.name, chapters);
  return { arcs, openMax, capacity };
}

/**
 * 大关产物源码：`arcs-data.header.txt`（手写：类型与 ARC_COMING_SOON）+ 生成数据体。
 * 导出名与手写时代逐一同名（ARCS / ARC_OPEN_MAX / OPEN_ARCS / ArcEntry / ARC_COMING_SOON）
 * ⇒ 6 个运行时消费点 + cocos 镜像零改动（§11.5）。数据体风格 = 全游戏统一 render()，⛔ 不得手搓。
 */
export function buildArcsModuleSource(game) {
  // trimEnd：header 尾空白（编辑器差异）不得影响产物字节 ⇒ 模板首尾空白无意义
  const header = readFileSync(game.arcsHeaderPath, 'utf8').trimEnd();
  const { arcs, openMax } = assembleArcs(game);
  const body =
    `export const ${ARCS_CONST_NAME}: readonly ArcEntry[] = ${render(arcs, 0)};\n\n` +
    '/** 本版开放的大关数 = `open:true` 前缀长度（生成派生；真源 = manifest.chapters[].open）。 */\n' +
    `export const ARC_OPEN_MAX = ${openMax};\n\n` +
    '/** 本版实际投放的大关。长度 = {@link ARC_OPEN_MAX}。 */\n' +
    `export const OPEN_ARCS: readonly ArcEntry[] = ${ARCS_CONST_NAME}.slice(0, ARC_OPEN_MAX);\n`;
  return `${header}\n\n${body}`;
}

/** 便于测试：按游戏名取描述对象（返回 null 表示该游戏不参与生成）。 */
export function describeGame(name) {
  const { games } = discover();
  return games.find((g) => g.name === name) ?? null;
}

// ─────────────────────────────────────────────────────────── 主流程 ─────────

/**
 * 门禁⑥（G6，WXG-T-266 EP12-S5）：生成期难度无退化。
 *
 * 判据 = 同类别内 `DI` 严格递增（等价「排序后两两不同」，⛔ **不设任何数值阈值**，§7 G6 第四轮终裁
 * Q7=③）。现池入关序 ≠ 难度序（H-2）⇒ 只断言「可排出严格序（无并列/退化）」，**不断言入关序本身递增**
 * （否则现池当场假红）。类别字段未落（CH-C 延 n>12）⇒ 现池按单一隐含类别处理。
 *
 * 依赖游戏侧 `difficultyOf()` 单一真源（G1）：以**动态字面 `.ts` 路径** import（Node ≥22.18 原生
 * type-stripping 认字面 `.ts`；其内部 `./x.js` 传递引用由 `--import=ts-js-resolve` 钩子接住 ⇒ 只在
 * `levels:sync`/`levels:check` 带钩运行时触发）。**仅目录模式且该游戏有 `difficulty.ts` 才生效** ⇒
 * breakout（单 JSON）与 `node --test`（不调 main）零牵连。任一违规 ⇒ throw（硬红，K-031 同口径）。
 */
async function assertDifficultyChain(games) {
  for (const game of games) {
    if (game.mode !== 'dir') continue;
    const diffPath = join(GAMES_DIR, game.name, 'src', 'game', 'difficulty.ts');
    if (!isFile(diffPath)) continue; // 该游戏无难度真源 ⇒ 门禁⑥ 不适用
    const { difficultyOf } = await import(pathToFileURL(diffPath).href);
    const { levels } = assembleFromManifest(game);
    // 隐含类别分组（CH-C 前恒单类；有 category 字段则按其分组）。
    const rows = [];
    for (const lv of levels) {
      if (!Array.isArray(lv.pattern)) continue; // 非拼豆型关卡（无 pattern）跳过
      rows.push({ id: lv.id, di: difficultyOf(lv).di, category: lv.category ?? '__default__' });
    }
    checkDifficultyDegeneracy(game.name, rows);
  }
}

/**
 * 纯序校验（与 difficultyOf 解耦 ⇒ 无需 TS loader，可 `node --test`）：同类别内 `DI` 排序后须**严格递增**（
 * 等价无并列/无退化）。⛔ 不引用任何生成器目标参数（DI 起点/公差）或数值阈值（G10-① / Q7=③）。违规 throw。
 */
export function checkDifficultyDegeneracy(gameName, rows) {
  const byCat = new Map();
  for (const r of rows) {
    const arr = byCat.get(r.category) ?? [];
    arr.push(r);
    byCat.set(r.category, arr);
  }
  for (const [cat, arr] of byCat) {
    arr.sort((a, b) => a.di - b.di || a.id - b.id); // tie-break = 关号升序（确定性，L4）
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].di <= arr[i - 1].di)
        throw new Error(
          `${gameName}: 门禁⑥（G6）难度退化 —— 类别 ${cat} 内 DI 非严格递增` +
          `（L${arr[i - 1].id}=${arr[i - 1].di} → L${arr[i].id}=${arr[i].di}）：` +
          '新入关不得与同类现关并列或更低（difficultyOf 正本 = 游戏侧单一实现，level-difficulty §3）',
        );
    }
  }
}

/**
 * 门禁⑦（工作量难度闸，2026-10-10 用户裁定）：普通关 `steps` 落区间、boss `steps` 高于阈值、教学关全豁免。
 *
 * 与门禁⑥（G6）**解耦**：⑥ 只锁「DI 可排严格序」（无数值阈值）；⑦ 管「绝对工作量区间」⇒ 量纲不同、
 * 职责不同。⛔ 本闸只读 `steps`（实测工作量真源），不读 `DI`（相对序、残差 ±58%~102% 不足以做绝对区间）。
 * 纯函数（入参预算好）⇒ 可 `node --test` 直测，无需 TS loader。
 *
 * @param gameName
 * @param rows  [{ id, kind:'single'|'plate'|'boss', steps, teaching }]
 * @param bounds { normalMin, normalMax, bossMin }（真源 = 游戏侧 tuning.ts，由调用方读入）
 */
export function checkStepsGate(gameName, rows, bounds) {
  for (const r of rows) {
    if (r.teaching) continue; // 首关 = 教学引导关，全豁免（上下界均跳）
    if (!Number.isFinite(r.steps)) continue; // 无实测 pricing（非拼豆型关）⇒ 不拦
    if (r.kind === 'boss') {
      if (r.steps < bounds.bossMin)
        throw new Error(
          `${gameName}: 门禁⑦ boss L${r.id} steps=${r.steps} < BOSS_STEPS_MIN=${bounds.bossMin} ⇒ boss 未跳档（须 > 普通上限、≥ ${bounds.bossMin}）`,
        );
    } else if (r.steps < bounds.normalMin || r.steps > bounds.normalMax) {
      throw new Error(
        `${gameName}: 门禁⑦ 普通关 L${r.id} steps=${r.steps} 越出 [${bounds.normalMin}, ${bounds.normalMax}] ⇒ 过空或逼近 boss`,
      );
    }
  }
}

/**
 * 门禁⑧（WXG-T-357）：豆面可读性。判据 = `design/levels/pattern-legibility.md §2` 的 T1–T7。
 *
 * ⚠ **默认 WARN 不拦**（现池 legacy 有 4 关不达标，硬门会当场打红所有提交 ⇒ 与「门禁必须先绿」冲突）；
 * `BEADS_LEGIBILITY_STRICT=1` 或 `strict:true` ⇒ 硬红。`strict` 缺省读环境变量，便于 CI 灰度收紧。
 * 与门禁⑦ 分工：⑦ 管工量（`steps`），⑧ 管「看不看得清」，⛔ 两者都不参与定价。
 */
export function checkLegibility(gameName, rows, { strict = process.env.BEADS_LEGIBILITY_STRICT === '1' } = {}) {
    const bad = [];
    for (const r of rows) {
        if (!Array.isArray(r.pattern)) continue; // 非拼豆型关（无 pattern）跳过
        const m = analyzePattern(r.pattern);
        const v = judgePattern(m);
        if (v.ok) continue;
        bad.push(`${r.id}(${v.kind}:${v.fails.map((f) => `${f.k}=${f.value}`).join(',')})`);
    }
    if (!bad.length) return [];
    const msg = `${gameName}: 门禁⑧ 豆面可读性未过 ${bad.length} 关 ⇒ ${bad.join(' ')}`;
    if (strict) throw new Error(`${msg}（放宽口径见 pattern-legibility.md §2；确属设计意图请登记，⛔ 不要调门限凑绿）`);
    console.warn(`⚠ ${msg}\n   （WARN 模式：设 BEADS_LEGIBILITY_STRICT=1 转硬红；正本 design/levels/pattern-legibility.md）`);
    return bad;
}

/**
 * 门禁⑦ 驱动：仅目录模式、且游戏侧 tuning.ts 声明了 `NORMAL_STEPS_MIN` 才生效（breakout / 未声明游戏零牵连）。
 * 直接读原始 manifest + singles（此时 `pricing.steps` 尚未被 stripDevFields 剔除），首关（最小 order 的非退役 entry）= 教学豁免。
 */
async function assertStepsGate(games) {
  for (const game of games) {
    if (game.mode !== 'dir') continue;
    const tunePath = join(GAMES_DIR, game.name, 'src', 'config', 'tuning.ts');
    if (!isFile(tunePath)) continue;
    const t = await import(pathToFileURL(tunePath).href);
    if (!Number.isFinite(t.NORMAL_STEPS_MIN)) continue; // 该游戏未声明门禁⑦ ⇒ 不适用
    const man = JSON.parse(readFileSync(game.manifestPath, 'utf8'));
    const entries = man.entries.filter((e) => !e.retired).sort((a, b) => a.order - b.order);
    const firstOrder = entries.length ? entries[0].order : Infinity; // 首关 = 教学
    const rows = [];
    for (const e of entries) {
      const obj = JSON.parse(readFileSync(join(game.levelsDir, e.file), 'utf8'));
      const cells = e.kind === 'plate' ? obj.cells : [obj];
      for (const c of cells) rows.push({ id: c.id, kind: e.kind, steps: c.pricing?.steps, teaching: e.order === firstOrder });
    }
    checkStepsGate(game.name, rows, { normalMin: t.NORMAL_STEPS_MIN, normalMax: t.NORMAL_STEPS_MAX, bossMin: t.BOSS_STEPS_MIN });
  }
}

/**
 * 门禁⑧ 驱动：目录模式 + 该关有 `pattern` 即参评（breakout 单 JSON / 无 pattern 关零牵连）。
 * 直接读原始 manifest + singles（同门禁⑦，绕开 stripDevFields），章内 plate 逐格展开。
 */
async function assertLegibility(games) {
    for (const game of games) {
        if (game.mode !== 'dir') continue;
        const man = JSON.parse(readFileSync(game.manifestPath, 'utf8'));
        const rows = [];
        for (const e of man.entries) {
            if (e.retired) continue;
            const obj = JSON.parse(readFileSync(join(game.levelsDir, e.file), 'utf8'));
            const cells = e.kind === 'plate' ? obj.cells : [obj];
            for (const c of cells) rows.push({ id: c.id, kind: e.kind, pattern: c.pattern });
        }
        checkLegibility(game.name, rows);
    }
}

/**
 * 断言集 6 驱动：章展开槽位数 ≤ 游戏侧 `WALL_CAPACITY`（超容 = 内容静默不可见，§11.5-6）。
 * 仅目录模式 + 声明了 chapters 层 + tuning 导出 WALL_CAPACITY 才生效（breakout 零牵连）。
 */
async function assertChapterCapacity(games) {
  for (const game of games) {
    if (game.mode !== 'dir' || !game.hasChapters) continue;
    const tunePath = join(GAMES_DIR, game.name, 'src', 'config', 'tuning.ts');
    if (!isFile(tunePath)) continue;
    const t = await import(pathToFileURL(tunePath).href);
    if (!Number.isFinite(t.WALL_CAPACITY)) continue;
    const { capacity } = assembleArcs(game);
    checkChapterCapacity(game.name, capacity, t.WALL_CAPACITY);
  }
}

async function main() {
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

  // 门禁⑥（G6）：难度真源落码后，装配前拦截同类内 DI 并列/退化（§7，WXG-T-266）。
  await assertDifficultyChain(games);
  // 门禁⑦（工作量闸）：普通关 steps 落区间 / boss steps 高于阈值 / 教学首关全豁免（2026-10-10）。
  await assertStepsGate(games);
  // 门禁⑧（可读性）：豆面稀碎/断裂/尺寸不足（默认 WARN，BEADS_LEGIBILITY_STRICT=1 硬红，WXG-T-357）。
  await assertLegibility(games);
  // 大关断言集 6：章展开槽位 ≤ WALL_CAPACITY（§11.5；章断言 1–5/7 在 assembleArcs 内）。
  await assertChapterCapacity(games);

  const drifted = [];
  const inSync = [];
  /** 每游戏的全部目标产物：levels-data.ts +（有章层时）arcs.ts。 */
  const targetsOf = (game) => {
    const targets = [{ path: game.targetPath, expected: buildModuleSource(game), label: game.jsonName }];
    if (game.mode === 'dir' && game.hasChapters)
      targets.push({ path: game.arcsTargetPath, expected: buildArcsModuleSource(game), label: `${CHAPTERS_DIR}/` });
    return targets;
  };

  for (const game of games) {
    for (const t of targetsOf(game)) {
      let actual = null;
      try {
        actual = readFileSync(t.path, 'utf8');
      } catch {
        actual = null;
      }
      if (actual === t.expected) inSync.push({ game, t });
      else drifted.push({ game, t });
    }
  }

  const rel = (p) => p.replace(`${root}/`, '');

  if (CHECK_ONLY) {
    for (const { game, t } of inSync) console.log(`✅ ${game.name}: ${rel(t.path)} 与 ${t.label} 一致`);
    for (const { game, t } of drifted) {
      console.error(`❌ ${game.name}: ${rel(t.path)} 与 ${t.label} 不一致`);
      console.error(`   修：node tools/scripts/sync-levels-data.mjs --game=${game.name}`);
    }
    if (drifted.length) {
      console.error('');
      console.error(`❌ levels:check FAILED —— ${drifted.length} 处产物漂移（${games.length} 款游戏）`);
      process.exit(1);
    }
    console.log('');
    console.log(`✅ levels:check OK —— ${games.length} 款游戏全部一致（${games.map((g) => g.name).join('、')}）`);
    process.exit(0);
  }

  for (const { game, t } of inSync) console.log(`✅ ${game.name}: ${rel(t.path)} 已一致，跳过`);
  for (const { game, t } of drifted) {
    writeFileSync(t.path, t.expected, 'utf8');
    console.log(`✍️  ${game.name}: 写出 ${rel(t.path)}`);
  }
  console.log('');
  console.log(
    drifted.length
      ? `✅ 已同步 ${drifted.length} 处产物（${[...new Set(drifted.map((d) => d.game.name))].join('、')}）`
      : `✅ 全部一致，无需改动（${games.length} 款游戏）`,
  );
}

// 仅直接调用时执行（守卫的必要性见文件头「副作用守卫」）。
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error(`❌ ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
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

用法（⑥ 需引游戏侧 TS 单一真源 ⇒ 带钩子；等价 pnpm levels:sync / levels:check）：
  node --import=./tools/scripts/lib/ts-js-resolve.mjs tools/scripts/sync-levels-data.mjs                # 写出全部漂移的产物
  node --import=./tools/scripts/lib/ts-js-resolve.mjs tools/scripts/sync-levels-data.mjs --check        # 只校验，漂移即 exit 1
  node --import=./tools/scripts/lib/ts-js-resolve.mjs tools/scripts/sync-levels-data.mjs --game=<name>  # 只处理某款游戏

每游戏的文件约定（新增游戏**不需要改本脚本**）——**两种真源模式**：
  【目录模式】design/levels/manifest.json + palette.json + singles/ + plates/  ← beads（P1 起）
     manifest.entries[{uid,kind,file,pack,order}] 为关卡唯一顺序真源；Plate 展开为 N 个 cell
  【大关层·可选】design/levels/chapters/<id>.json + arcs-data.header.txt      ← 仅 manifest.chapters[]
     与 chapters/ 同时存在时生效（双向绑定）；产物 src/config/arcs.ts 导出手写时代同名
  【单 JSON 模式】games/<game>/design/levels/<任意名>.json（恰 1 个）      ← breakout 等 legacy
  两模式共用：design/levels/levels-data.header.txt（TS 接口模板）+ src/config/levels-data.ts（产物）

生成契约（逐字节固定）：
  header 模板 + "\\n" + "export const ${CONST_NAME}: LevelsData = " + render(json) + ";\\n"
  渲染风格全游戏统一（双引号 / 数组多行 / 6.0→6）——产物不得手搓。

覆盖面断言（任一不成立即 exit 1）：
  ① 有关卡 json ⇒ 必须有 header 模板  ② 有真源 ⇒ 必须有产物
  ③ 有 header 模板 ⇒ 必须有真源  ④ 无 manifest.json 时顶层关卡 .json 必须唯一（有 manifest 走目录模式）
  ⑤ 声明了 DEMO_LEVEL_COUNT 的游戏 ⇒ 该值 == manifest 当前关数（防入关批漏同步常量）
  ⑥ 目录模式且该游戏有 difficulty.ts ⇒ 同类内 DI 无退化（可排严格序，⛔无数值阈值；WXG-T-266 门禁⑥/G6）
  ⑦ 目录模式且该游戏声明 NORMAL_STEPS_MIN ⇒ 普通关 steps 落区间、boss steps≥BOSS_STEPS_MIN、首关教学豁免（门禁⑦）
  ⑧ 目录模式且有 chapters/ ⇒ 章断言集（§11.5；WXG-T-336/337）：order/open 前缀｜uid 恰一归属｜
     boss=末项｜同章同 pack｜槽位 ≤ WALL_CAPACITY｜showcase 齐备且资产存在｜源关卡 ⛔ 手写 title（断言 8）
  ⑨ 目录模式 ⇒ 每条关卡记录自带身份 token（ADR-0034 S-1；判据 = save-progress v1.3 §8-22）：
     ① token 全表唯一（plate 逐格互异，c≥2 加 #c） ② token 序 == order 展开序
     ③「一关恰属一章」沿用 ⑧ 的现成腿（新通道不得把它弄哑 = 回归自证）

真源：各游戏 design/gdd/systems-index.md §3（冻结常量）。`);
}
