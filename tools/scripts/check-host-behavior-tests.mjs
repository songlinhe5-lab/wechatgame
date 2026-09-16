#!/usr/bin/env node
/**
 * check-host-behavior-tests.mjs — `control-manifest §17`「新宿主 / 新引擎适配器接入必须有
 * **Node 行为测试**」这条硬要求的**机械守卫**（WXG-T-110 / P2 / 工程侧）。
 *
 * ── 为什么存在 ───────────────────────────────────────────────────────────────
 * §17（WXG-T-107 落盘）有一条硬要求：
 *   「新宿主 / 新引擎适配器接入必须同形态复刻：纯函数 + `tests/adapters/<引擎>-touch-normalize.test.ts`
 *     的 **Node 行为测试**」，并明令 **禁止只用源码级正则 / 文本断言锁语义**（缺陷 C1 就是这么漏的）。
 *
 * 但该约束此前**只能靠 §12 提交前自查表人工执行** —— 而「清单写了但无人对照」正是 C1 潜伏至今的
 * 成因模式（一条断言只活在注释与 ADR 引用里，没人机械核对）。本脚本把 §12 那一行变成**可执行的核对**。
 *
 * ── ⚠️ 用户裁定（2026-09-15，硬约束，不得偏离）────────────────────────────────
 *   先做 **warn 级**观察一轮，**不做 fail-closed**。
 *   理由：当前只有 Cocos 一个宿主适配器，fail-closed 无真阳性、易成噪声。
 *   ⇒ 默认：发现缺口只打 `WARN`，**退出码仍为 0**（不阻断 verify）。
 *   ⇒ 升级条件见运行输出「④ 何时可升 fail-closed」，判据已机械化（含归一化模块的适配器数 ≥ 2）。
 *   ⇒ `--fail-on-gap` 是**预留的升级开关**（默认关闭，verify 不传它）——升级 = 在 STEPS 里加这一个参数。
 *
 * ── 判定口径（本守卫认什么，见输出「② 判定口径」）───────────────────────────────
 *  ① **哪些适配器进检查面**：`packages/framework/src/adapters/<引擎>/` 下任何 `.ts`（非测试）文件，
 *     只要满足其一即视为「输入/触摸归一化模块」：
 *       (a) 文件名（去扩展名）含 `normaliz`（i 不敏感）—— §17 本身规定的命名约定；或
 *       (b) 文件**导出了名字含 `normaliz` 的函数**（AST 判 `export function` / `export const`）。
 *     注：这里用文本/AST 做的是**「有没有这类模块」的探测（detector）**，不是「语义对不对」的断言 ——
 *     §17 禁止的是**拿正则当语义交付的证据**，不是禁止在守卫里识别文件。语义一律交给配对的行为测试。
 *  ② **什么算「配对」**：`packages/framework/tests/**` 下的测试文件，且：
 *       (a) 静态 `import` 的模块路径**解析到**该归一化模块（支持 `./x.js` → `x.ts` 的 ESM 约定写法）；**且**
 *       (b) 从它 `import` 了至少一个**值绑定**（`import type` 不算）；**且**
 *       (c) 在测试体里**真的调用了**该绑定（`fn(...)` 或 `ns.fn(...)`）；**且**
 *       (d) 文件里有 `it(` / `test(` 用例。
 *  ③ **什么不算**（一律不计配对）：
 *       · 只 `import type` / 只引用常量，从不调用 ⇒ `NOT_BEHAVIOR_TEST`；
 *       · 只 `readFileSync(源码)` + `toMatch(/…/)` 这类**源码级正则 / 文本断言** ⇒ `NOT_BEHAVIOR_TEST`
 *         （§17 明令其不能当交付；输出里会单独点名 `疑似源码级断言`）。
 *
 * ── 已知局限（诚实登记，不是「已解决」）──────────────────────────────────────
 *  · ② 的 (b)(c) 是**静态近似**：断言「import 且调用」不等于「断言真的覆盖了 ÷dpr 与 y 翻转」。
 *    它把 §17 的两条硬要求（纯函数 + 行为测试存在）机械化了，但**判别力仍在测试文件自己身上**。
 *    真正的判别力证据是配对测试的**反例用例**（见 `tests/adapters/cocos-touch-normalize.test.ts` 的
 *    ②反向锁 / ⑨镜像反证，以及探针 `production/qa/beads/cocos-input-probe.mjs` 的 SELF-01）。
 *  · 不检查归一化模块的**纯度**（不 import `cc` / 不碰 DOM）；那是另一条（§17 的纯函数要求），
 *    L2/L3 与 `check:arch` 有各自覆盖面，本守卫不越界。
 *  · 「源码级正则」的识别是启发式（`readFileSync(` / 正则实参的 `toMatch`/`match`），只用于**输出说明**，
 *    不参与是否计配对的判定（判定只看 ②(b)(c)）。
 *
 * ── 用法 / 退出码 ───────────────────────────────────────────────────────────
 *   node tools/scripts/check-host-behavior-tests.mjs                # 默认：WARN 不阻断
 *   node tools/scripts/check-host-behavior-tests.mjs --fail-on-gap  # 预留升级开关（有缺口 ⇒ 退出 1）
 *   node tools/scripts/check-host-behavior-tests.mjs --json
 *   node tools/scripts/check-host-behavior-tests.mjs --selftest     # 合成 fixture 自测（红→绿双向）
 *   node tools/scripts/check-host-behavior-tests.mjs --root=<dir>
 *
 *   退出码：0 = 无缺口，或（默认口径下）有缺口但只 WARN；
 *           1 = 有缺口且传了 `--fail-on-gap`；
 *           2 = 用法错误 / 扫描面缺失（**不得当绿**）。
 *
 * 机读标记：stdout 最后打一行 `STATUS: OK | WARN | FAIL`（供 `tools/scripts/verify-all.mjs` 聚合；
 * WARN 是观察项 —— 聚合器把它记 WARN，**不计 PASS、也不影响退出码**）。
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..', '..');

const ADAPTERS_REL = 'packages/framework/src/adapters';
const TESTS_REL = 'packages/framework/tests';
/** 升级 fail-closed 的机械化判据：**含输入归一化模块的适配器**数量达到此值。 */
const FAIL_CLOSED_AT_HOSTS = 2;

const require = createRequire(import.meta.url);
const ts = require('typescript');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const argOf = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};

if (has('-h') || has('--help')) {
  console.log(
    [
      '用法：node tools/scripts/check-host-behavior-tests.mjs [选项]',
      '',
      'control-manifest §17 的机械守卫：每个含「输入/触摸归一化模块」的引擎适配器，',
      '必须配对一份**行为测试**（禁止用源码级正则断言充数）。',
      '',
      '  （默认）          WARN 级：有缺口只告警，退出码 0（用户裁定 2026-09-15：观察一轮）',
      '  --fail-on-gap    预留的升级开关：有缺口 ⇒ 退出 1（**verify 不传它**）',
      '  --json           机读输出',
      '  --selftest       合成 fixture 自测（正例静默 / 反例必 WARN，双向）',
      '  --root=<dir>     扫描根（默认仓库根）',
      '',
      '机读标记：STATUS: OK | WARN | FAIL',
    ].join('\n'),
  );
  process.exit(0);
}

const ROOT = resolve(argOf('root', DEFAULT_ROOT));
const AS_JSON = has('--json');
const FAIL_ON_GAP = has('--fail-on-gap');

/** 真正的执行在文件末尾（`main()`）—— 避免顶层语句早于下方的 `const` 缓存声明执行（TDZ）。 */

// ─────────────────────────────────────────────────────────── 扫描（真实仓库）───

const posix = (p) => p.split(sep).join('/');
const relOf = (root, abs) => posix(relative(root, abs));

function listDirs(abs) {
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function listFilesRec(abs, pred) {
  const out = [];
  const walk = (dir) => {
    let ents = [];
    try {
      ents = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (!e.isSymbolicLink() && pred(e.name)) out.push(p);
    }
  };
  walk(abs);
  return out.sort();
}

/** 读成统一形状：`{ rel, content }`（rel = 相对 root 的 posix 路径）。 */
function loadRepoModel(root) {
  const adaptersAbs = join(root, ADAPTERS_REL);
  const testsAbs = join(root, TESTS_REL);
  const adapterDirs = listDirs(adaptersAbs).map((engine) => ({
    engine,
    files: listFilesRec(join(adaptersAbs, engine), (f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f) && !/\.d\.ts$/.test(f))
      .map((abs) => ({ rel: relOf(root, abs), content: readFileSync(abs, 'utf8') })),
  }));
  const testFiles = listFilesRec(testsAbs, (f) => /\.test\.[cm]?ts$/.test(f))
    .map((abs) => ({ rel: relOf(root, abs), content: readFileSync(abs, 'utf8') }));
  return { adapterDirs, testFiles };
}

// ─────────────────────────────────────────────────────────────── 分析（纯）───

/**
 * @param {{adapterDirs: {engine: string, files: {rel: string, content: string}[]}[],
 *          testFiles: {rel: string, content: string}[]}} model
 */
function analyze(model) {
  const parsedTests = model.testFiles.map((t) => ({ rel: t.rel, ...parseTest(t) }));

  const adapters = model.adapterDirs.map((a) => {
    const modules = a.files
      .filter(isNormalizationModule)
      .map((f) => {
        // 三档证据：值导入并**调用**（真配对）／只 import（含 import type）／只对源码文本做断言。
        const hits = parsedTests.map((t) => ({
          t,
          calls: t.callsTo(f.rel),
          anyImport: t.importsModuleAny(f.rel),
          valueImport: t.hasValueImport(f.rel),
          pseudo: t.sourceScansModule(f.rel),
        }));
        const imports = hits.filter((h) => h.anyImport);
        const pseudo = hits.filter((h) => !h.anyImport && h.pseudo);
        const paired = hits.find((h) => h.valueImport && h.calls > 0 && h.t.testCallCount > 0) || null;

        let note;
        let reason;
        if (paired) {
          reason = null;
          note = `${paired.t.rel}（值导入该模块的绑定中被**实际调用** ${paired.calls} 个；it/test 用例 ${paired.t.testCallCount} 个）`;
        } else if (imports.length) {
          reason = 'NOT_BEHAVIOR_TEST';
          note = imports.map((h) => `${h.t.rel}（import 了该模块，但值调用 ${h.calls} 处${h.valueImport ? '' : '、且只有 import type'}；`
            + `it/test 用例 ${h.t.testCallCount} 个${h.t.sourceScan ? '；另含源码级断言' : ''}）`).join('；')
            + ' —— 导入而未调用，不构成行为测试';
        } else if (pseudo.length) {
          reason = 'SOURCE_REGEX_ONLY';
          note = pseudo.map((h) => `${h.t.rel}（只对源码文本做正则/文本断言，无 import、无调用）`).join('；')
            + ' —— §17 明令：源码级正则断言判别力近似为零（缺陷 C1 就是这么漏的），不能当交付';
        } else {
          reason = 'MISSING_TEST';
          note = 'tests/ 下无任何文件 import 该模块（也未见针对它的源码级断言）';
        }

        return {
          module: f.rel,
          paired: paired
            ? { test: paired.t.rel, calls: paired.calls, testCallCount: paired.t.testCallCount, sourceScan: paired.t.sourceScan }
            : null,
          reason,
          note,
          sourceRegexOnly: pseudo.length > 0,
        };
      });
    return { engine: a.engine, files: a.files.length, modules };
  });

  const gaps = [];
  for (const a of adapters) {
    for (const m of a.modules) {
      if (!m.paired) gaps.push({ engine: a.engine, module: m.module, reason: m.reason, note: m.note, sourceRegexOnly: m.sourceRegexOnly });
    }
  }
  const hosts = adapters.filter((a) => a.modules.length > 0).length;
  return { adapters, gaps, hosts, adaptersTotal: adapters.length, failClosedAt: FAIL_CLOSED_AT_HOSTS };
}

/** 判断是否「输入/触摸归一化模块」：命名约定 **或** 导出了名字含 normaliz 的函数。 */
function isNormalizationModule(file) {
  const stem = basename(file.rel).replace(/\.[cm]?ts$/, '');
  if (/normaliz/i.test(stem)) return true;
  return exportedNames(file).some((n) => /normaliz/i.test(n));
}

/** 按 `rel` 缓存；**内容变了就重解析**（自测会复用同一路径喂不同内容，不能吃陈缓存）。 */
const exportNameCache = new Map();
function exportedNames(file) {
  const hit = exportNameCache.get(file.rel);
  if (hit && hit.content === file.content) return hit.names;
  const sf = parse(file);
  const names = [];
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && isExported(st)) names.push(st.name.text);
    if (ts.isVariableStatement(st) && isExported(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) names.push(d.name.text);
    }
  }
  exportNameCache.set(file.rel, { content: file.content, names });
  return names;
}

function isExported(node) {
  return !!node.modifiers && node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

const sfCache = new Map();
function parse(file) {
  const hit = sfCache.get(file.rel);
  if (hit && hit.content === file.content) return hit.sf;
  const sf = ts.createSourceFile(file.rel, file.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  sfCache.set(file.rel, { content: file.content, sf });
  return sf;
}

/**
 * 解析测试文件：值绑定 / 命名空间绑定 / 被调用的标识符 / 用例数 / 是否疑似源码级断言。
 * 只看**静态形态**（import + 调用），不看断言内容 —— 断言判别力归测试文件自己。
 */
function parseTest(file) {
  const sf = parse(file);
  const decls = []; // { specifier, values: string[], namespaces: string[] }
  const calledIdents = new Set();
  const calledProps = new Set();
  /** 疑似「源码级断言」引用的文本（readFileSync 的路径参数 / toMatch 的正则字面量）。 */
  const sourceScanRefs = [];
  let testCallCount = 0;
  let sourceScan = false;

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const values = [];
      const namespaces = [];
      const clause = node.importClause;
      if (clause && !clause.isTypeOnly) {
        if (clause.name) values.push(clause.name.text); // default import
        const nb = clause.namedBindings;
        if (nb) {
          if (ts.isNamespaceImport(nb)) namespaces.push(nb.name.text);
          else for (const el of nb.elements) if (!el.isTypeOnly) values.push((el.propertyName ?? el.name).text);
        }
      }
      decls.push({ specifier: node.moduleSpecifier.text, values, namespaces });
    } else if (ts.isCallExpression(node)) {
      const c = node.expression;
      const isRead = ts.isIdentifier(c) && c.text === 'readFileSync';
      const isMatch = ts.isPropertyAccessExpression(c) && (c.name.text === 'toMatch' || c.name.text === 'match');
      if (isRead || isMatch) {
        for (const a of node.arguments) {
          if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) sourceScanRefs.push(a.text);
          else if (ts.isRegularExpressionLiteral(a)) sourceScanRefs.push(a.text);
        }
      }
      if (isRead) sourceScan = true;
      if (isMatch && node.arguments.some((a) => ts.isRegularExpressionLiteral(a))) sourceScan = true;

      if (ts.isIdentifier(c)) {
        calledIdents.add(c.text);
        if (c.text === 'it' || c.text === 'test') testCallCount += 1;
      } else if (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression)) {
        const prop = `${c.expression.text}.${c.name.text}`;
        calledProps.add(prop);
        if (/^(it|test|describe)\./.test(prop)) testCallCount += 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);

  /** 该测试文件是否有 import 语句指向目标模块（含 `import type`、含无绑定形态）。 */
  const importsModuleAny = (targetRel) => decls.some((d) => resolvesTo(d.specifier, file.rel, targetRel));

  /** 该测试文件是否**值导入**了目标模块（`import type` 不算、无值绑定不算）。 */
  const hasValueImport = (targetRel) => decls.some((d) => resolvesTo(d.specifier, file.rel, targetRel)
    && (d.values.length > 0 || d.namespaces.length > 0));

  /** 该测试文件是否只对**目标模块的源码文本**做断言（readFileSync 路径 / 正则里出现模块文件名）。 */
  const sourceScansModule = (targetRel) => {
    const stem = basename(targetRel).replace(/\.[cm]?ts$/, '');
    return sourceScanRefs.some((ref) => ref.includes(stem));
  };

  /** 值导入的绑定里有几个被真的调用了（`fn(...)` 或 `ns.fn(...)`）。 */
  const callsTo = (targetRel) => {
    let n = 0;
    for (const d of decls) {
      if (!resolvesTo(d.specifier, file.rel, targetRel)) continue;
      for (const v of d.values) if (calledIdents.has(v)) n += 1;
      for (const ns of d.namespaces) if (Array.from(calledProps).some((p) => p.startsWith(`${ns}.`))) n += 1;
    }
    return n;
  };

  return { importsModuleAny, hasValueImport, sourceScansModule, callsTo, testCallCount, sourceScan };
}

/** `./x.js` → `x.ts` 等等价解析（仓库测试用 NodeNext 风格写 `.js` 扩展名）。 */
function resolvesTo(specifier, fromRel, targetRel) {
  if (!specifier.startsWith('.')) return false;
  const base = normalize(join(dirname(fromRel), specifier)).split(sep).join('/');
  const cands = [
    base,
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.js$/, '.tsx'),
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
  ];
  return cands.includes(targetRel);
}

// ───────────────────────────────────────────────────────────── 输出 / 汇总 ───

function emit(report, { root, json, failOnGap }) {
  if (json) {
    console.log(JSON.stringify({ ...report, root, failOnGap }, null, 2));
  } else {
    renderText(report);
  }

  const clean = report.gaps.length === 0;
  const status = clean ? 'OK' : failOnGap ? 'FAIL' : 'WARN';
  if (!json) console.log(`STATUS: ${status}`);
  // 用户裁定 2026-09-15：默认 **WARN 不阻断** ⇒ 有缺口也退出 0；
  // 只有在显式传 `--fail-on-gap`（升级开关，verify 不传）时才有缺口 ⇒ 退出 1。
  return clean ? 0 : failOnGap ? 1 : 0;
}

function renderText(r) {
  const line = (s = '') => console.log(s);
  line('════════ 宿主行为测试守卫（control-manifest §17 · WXG-T-110）════════');
  line(`模式：${FAIL_ON_GAP ? '⚠️ 已开启 --fail-on-gap（有缺口即退出 1）' : 'WARN（观察一轮，**不阻断**；用户裁定 2026-09-15）'}`);
  line(`扫描：${ADAPTERS_REL}/*/  共 ${r.adaptersTotal} 个适配器目录`);
  line('');

  line('① 适配器明细');
  for (const a of r.adapters) {
    if (a.modules.length === 0) {
      line(`  ➖ ${a.engine.padEnd(9)} 无输入/触摸归一化模块 → 不适用（跳过，不计缺口）`);
      continue;
    }
    line(`  ${a.modules.every((m) => m.paired) ? '✅' : '⚠️'} ${a.engine.padEnd(9)} 归一化模块 ${a.modules.length} 个`);
    for (const m of a.modules) {
      line(`       · ${m.module}`);
      if (m.paired) {
        line(`         配对行为测试：${m.paired.test}（值导入该模块的绑定中被**实际调用** ${m.paired.calls} 个；it/test 用例 ${m.paired.testCallCount} 个）`);
      } else {
        line(`         ${m.reason === 'MISSING_TEST' ? '✗ 无配对' : '✗ 无**行为**测试'}：${m.note}`);
      }
    }
  }
  line('');

  line('② 判定口径（本守卫认什么算「配对的行为测试」）');
  line('  · 模块进检查面：适配器目录下文件名含 normaliz，或导出了名字含 normaliz 的函数；');
  line('  · 配对 = tests/ 下某测试文件 ①import 路径解析到该模块 ②导入了**值**绑定（import type 不算）');
  line('           ③在测试体里**真的调用**了该绑定 ④文件里有 it(/test( 用例；');
  line('  · 不算配对的：只 import 类型 / 只引用常量从不调用（NOT_BEHAVIOR_TEST）；');
  line('    只 readFileSync(源码) + toMatch(/…/) 这类**源码级正则 / 文本断言** = §17 明令不能当交付（输出会点名）。');
  line('');

  if (r.gaps.length === 0) {
    line('③ 结论：✅ 无缺口 —— 全部含归一化模块的适配器都配了 Node 行为测试。');
  } else {
    line(`③ 结论：⚠️ WARN 缺口 ${r.gaps.length} 项（**不阻断**，退出码仍为 0）`);
    for (const g of r.gaps) {
      line(`  [${g.reason}] adapter=${g.engine} 模块 ${g.module}`);
      line(`      期望：tests/adapters/<引擎>-touch-normalize.test.ts（或等价**行为**测试）`);
      line(`      现状：${g.note}${g.sourceRegexOnly ? '  ⚠️ 疑似源码级正则断言充数（§17 已明令禁止）' : ''}`);
    }
  }
  line('');

  line('④ 何时可升 fail-closed（用户裁定：先 warn 观察一轮，**不得擅自升级为阻断**）');
  const met = r.hosts >= r.failClosedAt;
  line(`  触发条件 1（主判据，已机械化）：**含输入归一化模块的宿主适配器**数 ≥ ${r.failClosedAt}。`);
  line(`      现状：${r.hosts} 个（${r.hosts ? r.adapters.filter((a) => a.modules.length).map((a) => a.engine).join('、') : '无'}）`
    + ` ⇒ 条件${met ? '**已满足**（可提复评升 fail-closed）' : '未满足（仍是观察期）'}。`);
  line('      理由：第二个宿主出现后，「无配对」才是真阳性而非噪声（第一个宿主接入时它看起来是纯开销，§17 §4.2(2)）。');
  line('  触发条件 2：同一宿主在 CI 上出现过一次真实的「漏写行为测试」回归。');
  line('  触发条件 3：`§17` 复评（ADR-0011 §5）结论要求收紧时。');
  line(`  升级方式（一行）：verify STEPS 中把该步骤改为 \`check:host-tests --fail-on-gap\`，并把本脚本的 WARN 语义改判 FAIL。`);
  line('');

  line(`汇总：适配器 ${r.adaptersTotal} 个 ｜ 含归一化模块 ${r.hosts} 个 ｜ 缺口 ${r.gaps.length} 项 ｜ `
    + `PASS ${r.adapters.filter((a) => a.modules.length && a.modules.every((m) => m.paired)).length} ｜ WARN ${r.gaps.length ? 1 : 0}`);
}

// ─────────────────────────────────────────────────────────────── 自测 ───────

/**
 * 合成 fixture 自测（不读仓库、不写文件）：证明本守卫**双向**成立 ——
 *   正例（模块 + 行为测试）⇒ 无缺口；反例（缺文件 / 源码级正则充数 / 只 import 不调用）⇒ 必 WARN。
 * 本仓吃过「判别力为零的守卫/探针」的亏（C1、K-036），故守卫自身也必须自证能红。
 */
function runSelftest() {
  const MOD = 'packages/framework/src/adapters/cocos/touch-normalize.ts';
  const modContent = 'export function normalizeCocosTouch(raw, space) { return { x: raw.x / space.dpr, y: space.canvasHeightCss - raw.y / space.dpr }; }\n';
  const behaviorTest = [
    "import { describe, expect, it } from 'vitest';",
    "import { normalizeCocosTouch } from '../../src/adapters/cocos/touch-normalize.js';",
    "describe('t', () => { it('a', () => { expect(normalizeCocosTouch({ x: 4, y: 4 }, { canvasHeightCss: 10, dpr: 2 }).y).toBe(8); }); });",
  ].join('\n');
  const typeOnlyTest = [
    "import { describe, expect, it } from 'vitest';",
    "import type { CocosTouchSpace } from '../../src/adapters/cocos/touch-normalize.js';",
    "describe('t', () => { it('a', () => { const x: CocosTouchSpace | null = null; expect(x).toBeNull(); }); });",
  ].join('\n');
  const importNoCallTest = [
    "import { describe, expect, it } from 'vitest';",
    "import { normalizeCocosTouch } from '../../src/adapters/cocos/touch-normalize.js';",
    "describe('t', () => { it('a', () => { expect(typeof normalizeCocosTouch).toBe('function'); }); });",
  ].join('\n');
  const sourceRegexTest = [
    "import { readFileSync } from 'node:fs';",
    "import { describe, expect, it } from 'vitest';",
    "describe('t', () => { it('a', () => { const src = readFileSync('packages/framework/src/adapters/cocos/touch-normalize.ts', 'utf8'); expect(src).toMatch(/canvasHeightCss - raw\\.y/); }); });",
  ].join('\n');
  const base = () => ({
    adapterDirs: [
      { engine: 'cocos', files: [{ rel: MOD, content: modContent }, { rel: 'packages/framework/src/adapters/cocos/input-bridge.ts', content: 'export class CocosInputBridge {}\n' }] },
      { engine: 'canvas2d', files: [{ rel: 'packages/framework/src/adapters/canvas2d/canvas2d-renderer.ts', content: 'export class Canvas2DRenderer {}\n' }] },
    ],
    testFiles: [],
  });

  const cases = [];
  const check = (name, cond, extra = '') => {
    cases.push({ name, ok: !!cond });
    console.log(`  ${cond ? '✅' : '❌'} ${name}${extra ? `　${extra}` : ''}`);
  };

  const m1 = base();
  m1.testFiles.push({ rel: 'packages/framework/tests/adapters/cocos-touch-normalize.test.ts', content: behaviorTest });
  const r1 = analyze(m1);
  check('1 正例：模块 + 行为测试（import 并调用）⇒ 零缺口', r1.gaps.length === 0, `gaps=${JSON.stringify(r1.gaps.map((g) => g.reason))}`);
  check('2 正例：canvas2d 无归一化模块 ⇒ 不误报', r1.adapters.find((a) => a.engine === 'canvas2d').modules.length === 0);
  check('3 正例：归一化模块被识别且配对指向该测试文件',
    r1.adapters[0].modules[0]?.paired?.test === 'packages/framework/tests/adapters/cocos-touch-normalize.test.ts');

  const m2 = base();
  const r2 = analyze(m2);
  check('4 反例：测试文件被移除/改名 ⇒ MISSING_TEST', r2.gaps.length === 1 && r2.gaps[0].reason === 'MISSING_TEST', `gaps=${JSON.stringify(r2.gaps.map((g) => g.reason))}`);

  const m3 = base();
  m3.testFiles.push({ rel: 'packages/framework/tests/adapters/cocos-touch-normalize.test.ts', content: sourceRegexTest });
  const r3 = analyze(m3);
  check('5 反例：源码级正则断言充数 ⇒ SOURCE_REGEX_ONLY 且被点名',
    r3.gaps.length === 1 && r3.gaps[0].reason === 'SOURCE_REGEX_ONLY' && r3.gaps[0].sourceRegexOnly === true);

  const m4 = base();
  m4.testFiles.push({ rel: 'packages/framework/tests/adapters/cocos-touch-normalize.test.ts', content: typeOnlyTest });
  const r4 = analyze(m4);
  check('6 反例：只 import type、从不调用 ⇒ NOT_BEHAVIOR_TEST', r4.gaps.length === 1 && r4.gaps[0].reason === 'NOT_BEHAVIOR_TEST' && r4.gaps[0].sourceRegexOnly === false);

  const m4b = base();
  m4b.testFiles.push({ rel: 'packages/framework/tests/adapters/cocos-touch-normalize.test.ts', content: importNoCallTest });
  const r4b = analyze(m4b);
  check('6b 反例：值导入但不调用（只 `typeof fn`）⇒ NOT_BEHAVIOR_TEST',
    r4b.gaps.length === 1 && r4b.gaps[0].reason === 'NOT_BEHAVIOR_TEST' && r4b.gaps[0].sourceRegexOnly === false);

  const m5 = base();
  m5.testFiles.push({ rel: 'packages/framework/tests/adapters/cocos-touch-normalize.test.ts', content: behaviorTest });
  m5.adapterDirs.push({ engine: 'unity', files: [{ rel: 'packages/framework/src/adapters/unity/touch-normalize.ts', content: 'export function normalizeUnityTouch(raw, space) { return raw; }\n' }] });
  const r5 = analyze(m5);
  check('7 泛化：第二个宿主（unity）无配对 ⇒ MISSING_TEST，且升级判据显示已满足',
    r5.gaps.length === 1 && r5.gaps[0].engine === 'unity' && r5.hosts >= r5.failClosedAt);

  const m6 = base();
  m6.testFiles.push({ rel: 'packages/framework/tests/adapters/cocos-touch-normalize.test.ts', content: behaviorTest });
  m6.adapterDirs[0].files.push({ rel: 'packages/framework/src/adapters/cocos/pointer-normalize.ts', content: 'export const normalizePointer = (p) => p;\n' });
  const r6 = analyze(m6);
  check('8 多模块：第二个归一化模块（无配对）仍被抓到', r6.gaps.length === 1 && r6.gaps[0].module.endsWith('pointer-normalize.ts'));

  const pass = cases.filter((c) => c.ok).length;
  console.log(`\n[守卫自测] ${pass}/${cases.length} 通过`);
  if (pass !== cases.length) console.error('❌ 守卫自身承诺不成立 —— 不许把「判别力为零的守卫」再发一次（C1 / K-036）');
  return pass === cases.length ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────── 入口 ───────
// 放在文件末尾：顶层语句必须晚于上方所有 `const` 缓存声明执行（否则 TDZ）。

function main() {
  if (has('--selftest')) return runSelftest();
  if (!existsSync(join(ROOT, ADAPTERS_REL))) {
    console.error(`❌ 扫描面缺失：${ADAPTERS_REL}（root=${ROOT}）—— 守卫无对象可查，不得当绿`);
    return 2;
  }
  const report = analyze(loadRepoModel(ROOT));
  return emit(report, { root: ROOT, json: AS_JSON, failOnGap: FAIL_ON_GAP });
}

process.exit(main());
