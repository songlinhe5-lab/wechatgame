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
 *
 * Usage:
 *   node tools/scripts/check-architecture.mjs [--json] [--strict-scenes]
 *
 * Exit code 0 = clean, 1 = violations found.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', 'dist', 'build', 'library', 'temp', 'local', '.workbuddy']);

const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const STRICT_SCENES = args.includes('--strict-scenes');

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
