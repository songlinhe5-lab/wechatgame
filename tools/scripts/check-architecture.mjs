#!/usr/bin/env node
/**
 * Architecture guard — the executable version of ADR-0002 / ADR-0003.
 *
 * Rules enforced (see docs/architecture/control-manifest.md §0):
 *   L2  packages/framework/src/core/** must not touch cc / wx / DOM / DOM globals,
 *       nor import adapters/ platform/ compose/ (core must run on bare Node).
 *   L3  games/<game>/src/** must not import cc.
 *   L4  no Math.random() anywhere in framework core or game logic.
 *   §3  no #rrggbb colour literals outside a view/palette.ts file.
 *   §5  no bare localStorage / wx.setStorageSync outside the platform layer.
 *   L1  reports any .scene / .prefab present (editor-generated only).
 *   L6  beads internal runtime dependencies: no view ↔ game cycle, no save → view;
 *       registered legacy edges are explicit and must shrink rather than grow.
 *   §20 UI architecture (ADR-0032 §8 / control-manifest §20; beads only):
 *       -1 dialogs with scrim + paper must go through drawModalFrame
 *       -2 no rgba()/rgb() literals outside ui-theme / palette
 *       -3 no screen/overlay/phase comparisons in view/** (registered exceptions aside)
 *       -4 a panel's hit*() must reuse that panel's *Layout()
 *       -5 no _screen / _overlay flags — navigation only through Navigator
 *
 * Usage:
 *   node tools/scripts/check-architecture.mjs [--json] [--strict-scenes] [--selftest]
 *
 * `--selftest` runs the §20 negative samples (each rule must fire) and exits;
 * it is wired into `selftest:fast`, so `pnpm run verify` covers the guard.
 *
 * Exit code 0 = clean, 1 = violations found.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, basename, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', 'dist', 'build', 'library', 'temp', 'local', '.workbuddy']);

const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const STRICT_SCENES = args.includes('--strict-scenes');
const AS_SELFTEST = args.includes('--selftest');

/** Strip line and block comments so documentation examples never trip a rule. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Recursively collect files under `dir` whose name matches `predicate`. */
function walk(dir, predicate, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (predicate(entry.name)) out.push(full);
  }
  return out;
}

const isTs = (name) => /\.(ts|tsx|mts|cts)$/.test(name);
const isScene = (name) => /\.(scene|prefab|meta)$/.test(name);

const violations = [];
const warnings = [];

function report(rule, file, line, message) {
  violations.push({ rule, file: relative(ROOT, file), line, message });
}

/** Read a file as text, returning null when unreadable. */
function read(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** Scan one TypeScript file line by line against the rule set. */
function scanTs(file, rules) {
  const raw = read(file);
  if (raw === null) return;
  const lines = raw.split('\n');
  const cleaned = stripComments(raw).split('\n');

  for (let i = 0; i < lines.length; i++) {
    const text = cleaned[i] ?? '';
    for (const rule of rules) {
      if (rule.pattern.test(text)) {
        report(rule.id, file, i + 1, rule.message);
      }
      rule.pattern.lastIndex = 0;
    }
  }
}

// ─────────────────────────────────────────────────────────── rule definitions

const CC_IMPORT = {
  id: 'L2/L3',
  message: "imports 'cc' — engine code must stay in adapters/cocos/bindings.ts",
  pattern: /(from\s+['"]cc['"])|(require\(\s*['"]cc['"]\s*\))/,
};
const WX_GLOBAL = {
  id: 'L2',
  message: 'touches the wx global — platform differences belong in src/platform',
  pattern: /(from\s+['"]wx['"])|(\bwx\s*\.)/,
};
const DOM_GLOBAL = {
  id: 'L2',
  message: 'touches the DOM — core must run on bare Node',
  pattern: /\b(window|document|localStorage|sessionStorage)\s*[.[]/,
};
const CORE_LAYER_IMPORT = {
  id: 'L2',
  message: 'core imports a higher layer (adapters/platform/compose) — the arrow must point inward',
  pattern: /from\s+['"][^'"]*\/(adapters|platform|compose)\//,
};
const MATH_RANDOM = {
  id: 'L4',
  message: 'uses Math.random() — use services.rng (createRng(seed)) for determinism',
  pattern: /Math\.random\s*\(/,
};
const HEX_COLOR = {
  id: '§3',
  message: 'hard-coded #rrggbb colour — put colours in view/palette.ts',
  pattern: /['"]#[0-9a-fA-F]{3,8}['"]/,
};
const RAW_STORAGE = {
  id: '§5',
  message: 'uses storage API directly — go through the Storage/ SaveManager abstraction',
  pattern: /\b(wx\.setStorageSync|wx\.getStorageSync|localStorage\.setItem|localStorage\.getItem)\s*\(/,
};
const GAME_IMPORT_CC = CC_IMPORT;

// ── §20 UI architecture rules (ADR-0032 §8 / control-manifest §20)
// Only beads is scanned: it is the game that owns the ui/ layer.

/** Registered legacy deviations — see control-manifest §20 "现状" notes (UI-51). */
const UI_ARCH_EXCEPTIONS = new Map([
  ['view/meta-view.ts', '菜单侧 settings/signin chrome 仍直绘、overlay 分支为存量'],
  ['view/view-model.ts', '旧门面 buildBeadsView 按 phase 选结算层'],
]);

/** Files allowed to hold the raw colour / chrome primitives by definition. */
const UI_KIT_FILES = new Set(['view/ui-theme.ts', 'view/palette.ts', 'view/modal-frame.ts']);

const RGB_LITERAL = {
  id: '§20-2',
  message: "遮罩色就地写 rgba()/rgb() —— 只经 UiTheme",
  pattern: /['"](?:rgba?|hsla?)\(/,
};
const NAV_COMPARE = {
  id: '§20-3',
  message: 'View 里出现 screen / overlay / phase 判断 —— 改吃只读 ViewModel',
  pattern: /\b(screen|overlay|phase)\s*[!=]==/,
};
const LEGACY_NAV_FIELD = {
  id: '§20-5',
  message: '壳持导航标志位 —— 屏幕 / 覆盖层只能由 Navigator 栈投影',
  pattern: /\bthis\._(screen|overlay)\b|\b_(screen|overlay)\s*[:=]/,
};

/** Scan comment-stripped text line by line against `rules`. */
function scanSource(source, rules) {
  const lines = stripComments(source).split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    for (const rule of rules) {
      if (rule.pattern.test(lines[i])) hits.push({ rule: rule.id, line: i + 1, message: rule.message });
      rule.pattern.lastIndex = 0;
    }
  }
  return hits;
}

/** 1-based line of the first match, falling back to 1. */
function lineOf(text, pattern) {
  const m = pattern.exec(text);
  return m && m.index !== undefined ? text.slice(0, m.index).split('\n').length : 1;
}

/** §20 violations for one `games/beads/src` file; pure so the selftest shares it. */
function beadsUiViolations(rel, source) {
  const out = [];
  const body = stripComments(source);

  // §20-1: scrim + paper drawn in the same file ⇒ must be ModalFrame.
  if (
    !UI_KIT_FILES.has(rel) &&
    /scrimFill\s*\(/.test(body) &&
    /drawPaperPanel\s*\(/.test(body) &&
    !/drawModalFrame\s*\(/.test(body)
  ) {
    out.push({
      rule: '§20-1',
      line: lineOf(body, /scrimFill\s*\(/),
      message: '自造弹窗（遮罩 + 纸面板）—— 弹窗 chrome 必须走 drawModalFrame',
    });
  }

  // §20-2: colour primitives live in ui-theme / palette only.
  if ((rel.startsWith('view/') || rel.startsWith('ui/')) && !UI_KIT_FILES.has(rel)) {
    out.push(...scanSource(body, [RGB_LITERAL]));
  }

  // §20-3: views must not branch on navigation (registered deviations aside).
  if (rel.startsWith('view/') && !UI_ARCH_EXCEPTIONS.has(rel)) {
    out.push(...scanSource(body, [NAV_COMPARE]));
  }

  // §20-4: a panel's hit*() must reuse that panel's *Layout().
  if (/^systems\/[^/]+\.ts$/.test(rel)) {
    const layout = body.match(/export function (\w*[Ll]ayout)\s*\(/);
    const hit = body.match(/export function (hit\w+)\s*\(/);
    if (layout && hit && hit.index !== undefined) {
      const hitBody = body.slice(hit.index);
      if (!hitBody.includes(`${layout[1]}(`)) {
        out.push({
          rule: '§20-4',
          line: lineOf(body, new RegExp(`export function ${hit[1]}`)),
          message: `命中函数 ${hit[1]} 未复用 ${layout[1]}() —— 绘制与命中必须同布局`,
        });
      }
    }
  }

  // §20-5: no navigation flags anywhere in the game; the stack is the state.
  out.push(...scanSource(body, [LEGACY_NAV_FIELD]));

  return out;
}

/** L6 存量反向边（WXG-T-420）：只放行逐条登记的旧边，新反向 import 必红。 */
const GAME_VIEW_EXCEPTIONS = new Map([
  ['game/beads-shell.ts -> view/meta-view.ts', '旧菜单壳直调 view，待 T7 收敛'],
  ['game/beads-shell.ts -> view/skins-content.ts', '装扮馆拥有态注入，待菜单投影下沉'],
  ['game/beads-shell.ts -> view/bead-render.ts', '壳读取烘焙运行时'],
  ['game/beads-game/game-settings.ts -> view/bead-styles/registry.ts', 'T2 移除：风格校验下沉 config'],
  ['game/beads-game/feedback-fx.ts -> view/combo-vfx.ts', '效果规格暂居 view，后续归域'],
  ['game/beads-game.ts -> view/combo-vfx.ts', '效果规格暂居 view，后续归域'],
  ['game/beads-game.ts -> view/palette.ts', '渲染令牌暂由 Game 传递，T9 再上移绑定'],
  ['game/beads-game.ts -> view/view-model.ts', '旧渲染门面，T9 再上移绑定'],
  ['game/save-schema.ts -> view/bead-styles/registry.ts', 'T2 移除：存档校验不得依赖表现层'],
]);

/** Static relative imports; type-only declarations are erased and do not enter the runtime graph. */
function beadImports(rel, source) {
  const body = stripComments(source);
  const out = [];
  const pattern = /(?:^|\n)\s*(import|export)\s+([^;]+);/g;
  let match;
  while ((match = pattern.exec(body)) !== null) {
    const statement = match[2].trim();
    const spec = statement.match(/\bfrom\s*['"](\.[^'"]+)['"]/) ?? statement.match(/^['"](\.[^'"]+)['"]/);
    if (!spec) continue;
    const target = posix.normalize(posix.join(posix.dirname(rel), spec[1])).replace(/\.js$/, '.ts');
    const line = body.slice(0, match.index).split('\n').length + (match[0].startsWith('\n') ? 1 : 0);
    out.push({ target, typeOnly: /^type\b/.test(statement), line });
  }
  return out;
}

/** L6 direction + runtime-cycle checks; pure so negative samples exercise the production rule. */
function beadsDependencyViolations(files) {
  const out = [];
  const known = new Set(files.map((f) => f.file));
  const graph = new Map();
  for (const entry of files) {
    const imports = beadImports(entry.file, entry.src);
    graph.set(entry.file, imports.filter((i) => !i.typeOnly && known.has(i.target)));
    for (const edge of imports) {
      const key = `${entry.file} -> ${edge.target}`;
      if (entry.file.startsWith('game/save') && edge.target.startsWith('view/') && !GAME_VIEW_EXCEPTIONS.has(key)) {
        out.push({ rule: 'L6-save', file: entry.file, line: edge.line, message: '存档层依赖 view —— id 清单与校验应下沉 config' });
      } else if (!edge.typeOnly && entry.file.startsWith('view/') && edge.target.startsWith('game/')) {
        out.push({ rule: 'L6-direction', file: entry.file, line: edge.line, message: 'view 运行时依赖 game —— 只允许 import type 快照契约' });
      } else if (!edge.typeOnly && entry.file.startsWith('game/') && edge.target.startsWith('view/') && !GAME_VIEW_EXCEPTIONS.has(key)) {
        out.push({ rule: 'L6-direction', file: entry.file, line: edge.line, message: '新增 game → view 运行时依赖 —— 旧边须逐条登记且只减不增' });
      }
    }
  }

  const state = new Map();
  const stack = [];
  const seen = new Set();
  function visit(file) {
    state.set(file, 1);
    stack.push(file);
    for (const edge of graph.get(file) ?? []) {
      if (!state.has(edge.target)) visit(edge.target);
      else if (state.get(edge.target) === 1) {
        const cycle = [...stack.slice(stack.indexOf(edge.target)), edge.target];
        const key = cycle.slice(0, -1).sort().join(' -> ');
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ rule: 'L6-cycle', file, line: edge.line, message: `运行时循环依赖：${cycle.join(' -> ')}` });
        }
      }
    }
    stack.pop();
    state.set(file, 2);
  }
  for (const file of known) if (!state.has(file)) visit(file);
  return out;
}

/** §20/L6 negative samples: every rule must fire, every registered exception must pass. */
function runSelftest() {
  const cases = [
    {
      name: '§20-1 手搓弹窗被拦',
      file: 'view/hand-rolled.ts',
      src: 'const f = scrimFill(rgb, 0.5);\ndrawPaperPanel(b, 0, 0, 10, 10, p);',
      want: '§20-1',
    },
    {
      name: '§20-1 ModalFrame 放行',
      file: 'view/good.ts',
      src: 'scrimFill(rgb, 0.5); drawPaperPanel(b, 0, 0, 1, 1, p); drawModalFrame(b, spec);',
      want: null,
    },
    { name: '§20-2 就地 rgba 被拦', file: 'view/x.ts', src: "const s = 'rgba(0,0,0,0.5)';", want: '§20-2' },
    { name: '§20-2 UiTheme 放行', file: 'view/ui-theme.ts', src: "const s = 'rgba(0,0,0,0.5)';", want: null },
    { name: '§20-3 overlay 判断被拦', file: 'view/y.ts', src: "if (overlay === 'levels') {}", want: '§20-3' },
    { name: '§20-3 !== 判断被拦', file: 'view/y.ts', src: "if (phase !== 'play') {}", want: '§20-3' },
    { name: '§20-3 登记偏离放行', file: 'view/meta-view.ts', src: "if (overlay === 'levels') {}", want: null },
    {
      name: '§20-4 命中另算被拦',
      file: 'systems/x-panel.ts',
      src: 'export function xLayout() { return {}; }\nexport function hitX() { return null; }',
      want: '§20-4',
    },
    {
      name: '§20-4 命中复用布局放行',
      file: 'systems/x-panel.ts',
      src: 'export function xLayout() { return {}; }\nexport function hitX() { const l = xLayout(); return null; }',
      want: null,
    },
    { name: '§20-5 标志位被拦', file: 'game/beads-shell.ts', src: "this._overlay = 'levels';", want: '§20-5' },
    { name: '§20-5 Navigator 放行', file: 'ui/phase-route-binder.ts', src: 'this._nav.push(route);', want: null },
  ];

  let pass = 0;
  let fail = 0;
  for (const c of cases) {
    const got = beadsUiViolations(c.file, c.src).map((v) => v.rule);
    const ok = c.want === null ? got.length === 0 : got.includes(c.want);
    if (ok) pass += 1;
    else fail += 1;
    console.log(`  ${ok ? '✅' : '❌'} ${c.name}${ok ? '' : ` —— got [${got.join(', ')}]`}`);
  }
  const dependencyCases = [
    {
      name: 'L6 view 运行时依赖 game 被拦',
      files: [{ file: 'view/probe.ts', src: "import { x } from '../game/state.js';" }],
      want: 'L6-direction',
    },
    {
      name: 'L6 view 仅类型依赖 game 放行',
      files: [{ file: 'view/probe.ts', src: "import type { BeadsSnapshot } from '../game/state.js';" }],
      want: null,
    },
    {
      name: 'L6 未登记 game → view 被拦',
      files: [{ file: 'game/probe.ts', src: "import { x } from '../view/x.js';" }],
      want: 'L6-direction',
    },
    {
      name: 'L6 已登记存量 game → view 暂时放行',
      files: [{ file: 'game/beads-game.ts', src: "import { buildBeadsView } from '../view/view-model.js';" }],
      want: null,
    },
    {
      name: 'L6 未登记存档 → view 被拦',
      files: [{ file: 'game/save-probe.ts', src: "import { styleById } from '../view/bead-styles/registry.js';" }],
      want: 'L6-save',
    },
    {
      name: 'L6 运行时循环依赖被拦',
      files: [
        { file: 'game/a.ts', src: "import { b } from './b.js';" },
        { file: 'game/b.ts', src: "export { a } from './a.js';" },
      ],
      want: 'L6-cycle',
    },
    {
      name: 'L6 仅类型回边不构成运行时环',
      files: [
        { file: 'game/a.ts', src: "import { b } from './b.js';" },
        { file: 'game/b.ts', src: "import type { A } from './a.js';" },
      ],
      want: null,
    },
    {
      name: 'L6 普通单向依赖放行',
      files: [
        { file: 'game/a.ts', src: "import { b } from '../systems/b.js';" },
        { file: 'systems/b.ts', src: "import { c } from '../config/c.js';" },
        { file: 'config/c.ts', src: 'export const c = 1;' },
      ],
      want: null,
    },
  ];
  for (const c of dependencyCases) {
    const got = beadsDependencyViolations(c.files).map((v) => v.rule);
    const ok = c.want === null ? got.length === 0 : got.includes(c.want);
    if (ok) pass += 1;
    else fail += 1;
    console.log(`  ${ok ? '✅' : '❌'} ${c.name}${ok ? '' : ` —— got [${got.join(', ')}]`}`);
  }

  console.log(`\ncheck-architecture --selftest: PASS=${pass} FAIL=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

if (AS_SELFTEST) runSelftest();

// ─────────────────────────────────────────────────────────── run the checks

const frameworkSrc = join(ROOT, 'packages/framework/src');
const coreDir = join(frameworkSrc, 'core');
const gamesDir = join(ROOT, 'games');

// core: full engine-free rule set
for (const file of walk(coreDir, isTs)) {
  scanTs(file, [CC_IMPORT, WX_GLOBAL, DOM_GLOBAL, CORE_LAYER_IMPORT, MATH_RANDOM, RAW_STORAGE]);
}

// adapters + platform: may touch engines/hosts, but must not import a game
for (const layer of ['adapters', 'platform', 'compose']) {
  for (const file of walk(join(frameworkSrc, layer), isTs)) {
    scanTs(file, [
      {
        id: 'ADR-0002',
        message: 'framework layer imports game code — dependency must point inward',
        pattern: /from\s+['"][^'"]*\.\.\/\.\.\/\.\.\/games\//,
      },
      {
        id: 'L4',
        message: 'uses Math.random() — use the injected Rng instead',
        pattern: /Math\.random\s*\(/,
      },
    ]);
  }
}

// every game: logic must be engine-free, deterministic, colour-free
for (const gameName of safeReaddir(gamesDir)) {
  const gameSrc = join(gamesDir, gameName, 'src');
  if (!existsDir(gameSrc)) continue;
  for (const file of walk(gameSrc, isTs)) {
    const rules = [GAME_IMPORT_CC, WX_GLOBAL, DOM_GLOBAL, MATH_RANDOM, RAW_STORAGE];
    // Colour literals are allowed only where colour is *data*: the palette
    // module and the config/ data tables (brick colours come from the level
    // legend, which is content, not code).
    const isColourHome = basename(file) === 'palette.ts' || isUnderConfig(file);
    if (!isColourHome) rules.push(HEX_COLOR);
    scanTs(file, rules);
  }
}

// beads UI: §20 五条守则（ADR-0032 §8 / control-manifest §20）
const beadsSrc = join(gamesDir, 'beads', 'src');
if (existsDir(beadsSrc)) {
  const dependencyFiles = [];
  for (const file of walk(beadsSrc, isTs)) {
    const rel = relative(beadsSrc, file).split('\\').join('/');
    const raw = read(file);
    if (raw === null) continue;
    dependencyFiles.push({ file: rel, src: raw });
    for (const v of beadsUiViolations(rel, raw)) report(v.rule, file, v.line, v.message);
  }
  for (const v of beadsDependencyViolations(dependencyFiles)) {
    report(v.rule, join(beadsSrc, v.file), v.line, v.message);
  }
}

// scenes / prefabs: report (or fail with --strict-scenes) because they are
// editor-generated only and must never be hand-edited (ADR-0003 / L1).
const sceneFiles = [];
for (const gameName of safeReaddir(gamesDir)) {
  const cocosDir = join(gamesDir, gameName, 'cocos');
  if (!existsDir(cocosDir)) continue;
  for (const file of walk(cocosDir, isScene)) sceneFiles.push(relative(ROOT, file));
}
if (sceneFiles.length > 0) {
  (STRICT_SCENES ? report : warn)(
    'L1',
    join(gamesDir, '<game>', 'cocos'),
    0,
    `found ${sceneFiles.length} editor-generated file(s) (.scene/.prefab/.meta). ` +
    'They must only be produced by Cocos Creator — never hand-edited: ' +
    sceneFiles.slice(0, 8).join(', ') +
    (sceneFiles.length > 8 ? ` … (+${sceneFiles.length - 8})` : ''),
  );
}

function warn(rule, file, line, message) {
  warnings.push({ rule, file: relative(ROOT, file), line, message });
}

function safeReaddir(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function existsDir(dir) {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/** True for `<game>/src/config/**` — the home of authored data tables. */
function isUnderConfig(file) {
  const parts = relative(ROOT, file).split(/[\\/]/);
  const configIndex = parts.lastIndexOf('config');
  return configIndex !== -1 && parts[configIndex + 1] !== undefined;
}

// ─────────────────────────────────────────────────────────── report

if (AS_JSON) {
  console.log(JSON.stringify({ violations, warnings, sceneFiles }, null, 2));
} else {
  for (const w of warnings) {
    console.log(`WARN  [${w.rule}] ${w.file} — ${w.message}`);
  }
  for (const v of violations) {
    console.log(`FAIL  [${v.rule}] ${v.file}:${v.line}\n        ${v.message}`);
  }
  if (violations.length === 0) {
    console.log(
      `check-architecture: OK — no violations` +
      (warnings.length ? ` (${warnings.length} warning${warnings.length === 1 ? '' : 's'})` : ''),
    );
  } else {
    console.log(`\ncheck-architecture: ${violations.length} violation(s) found.`);
  }
}

process.exit(violations.length === 0 ? 0 : 1);
