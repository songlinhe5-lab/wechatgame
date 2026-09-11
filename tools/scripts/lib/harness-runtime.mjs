/**
 * harness-runtime.mjs — load the compiled browser harness inside Node.
 *
 * Shared by `smoke-harness.mjs` (runtime assertions) and
 * `render-harness-frame.mjs` (SVG preview). Both need the same three things:
 *
 *   1. the emitted bytes from `dev/harness/dist`, with the browser-only
 *      `@wxgame/framework` importmap specifier rewritten to a module-relative
 *      path so Node's ESM resolver can follow it;
 *   2. a minimal DOM/canvas stub, just enough for `WebPlatform` + the Canvas2D
 *      renderer to boot;
 *   3. the `window.__breakout` handle the harness exposes.
 *
 * The stub deliberately records draw-call counts so callers can assert that
 * something was actually painted.
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '..', '..', '..');
export const DIST = join(ROOT, 'dev', 'harness', 'dist');
export const STAGE = join(ROOT, 'dev', 'harness', '.smoke');

/** The one bare specifier `dev/harness/index.html` maps through its importmap. */
const IMPORTMAP_BARE = '@wxgame/framework';
/** Framework entry inside the emitted tree, relative to DIST. */
const FRAMEWORK_ENTRY = 'packages/framework/src/index.js';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/**
 * Copy `dev/harness/dist` into a scratch dir, rewriting the importmap-only
 * specifier into correct module-relative form for each file's depth.
 *
 * @returns {{ rewritten: number, strayBare: string[] }}
 */
function stageDist() {
  rmSync(STAGE, { recursive: true, force: true });
  mkdirSync(STAGE, { recursive: true });

  const strayBare = new Set();
  let rewritten = 0;

  for (const file of walk(DIST)) {
    const rel = relative(DIST, file);
    const target = join(STAGE, rel);
    mkdirSync(dirname(target), { recursive: true });

    if (!file.endsWith('.js')) {
      writeFileSync(target, readFileSync(file));
      continue;
    }

    // A browser importmap resolves `@wxgame/framework` against the *document*,
    // but Node resolves relative specifiers against the *importing module* — so
    // the replacement has to be computed per file depth, not copied verbatim.
    let frameworkSpec = relative(dirname(rel), FRAMEWORK_ENTRY).split(sep).join('/');
    if (!frameworkSpec.startsWith('.')) frameworkSpec = `./${frameworkSpec}`;

    // Line-anchored on purpose: emitted ESM begins every import at a line start,
    // which keeps prose like `no import ... from 'cc'` in JSDoc from being
    // mistaken for a real dependency.
    const patched = readFileSync(file, 'utf8').replace(
      /^([ \t]*(?:import|export)[^\n'"]*?from[ \t]*['"])([^'"]+)(['"])/gm,
      (match, pre, spec, post) => {
        if (spec === IMPORTMAP_BARE) {
          rewritten += 1;
          return pre + frameworkSpec + post;
        }
        if (!spec.startsWith('.')) strayBare.add(spec);
        return match;
      },
    );

    writeFileSync(target, patched);
  }

  return { rewritten, strayBare: [...strayBare] };
}

/** Draw-call counters, mutated by the stub context. */
function makeCounters() {
  return { save: 0, restore: 0, fillRect: 0, clearRect: 0, rect: 0, arc: 0, fill: 0, stroke: 0, fillText: 0, moveTo: 0, lineTo: 0 };
}

function makeContext(calls) {
  const state = {
    fillStyle: '#000', strokeStyle: '#000',
    lineWidth: 1, globalAlpha: 1, font: '10px sans-serif',
    textAlign: 'left', textBaseline: 'middle',
  };
  const handler = {
    get(target, key) {
      if (key in state) return state[key];
      if (typeof key === 'symbol') return undefined;
      return (...args) => {
        if (Object.hasOwn(calls, key)) calls[key] += 1;
        return undefined;
      };
    },
    set(_target, key, value) {
      state[key] = value;
      return true;
    },
  };
  return new Proxy({}, handler);
}

/**
 * Boot the harness under Node stubs.
 *
 * @returns {Promise<{
 *   app: any, game: any, calls: Record<string, number>,
 *   rewritten: number, strayBare: string[],
 *   render: (frames?: number) => any,   // step N frames, return the last render model
 *   clearScene: () => void,
 * }>}
 */
export async function loadHarness() {
  if (!existsSync(join(DIST, 'dev', 'harness', 'main.js'))) {
    throw new Error('no compiled harness — run: node tools/scripts/serve-harness.mjs --build-only');
  }

  const { rewritten, strayBare } = stageDist();
  if (strayBare.length > 0) {
    throw new Error(
      `emitted graph needs bare specifiers the harness importmap does not map:\n  ${strayBare.join('\n  ')}`,
    );
  }

  const calls = makeCounters();
  const elements = new Map();

  function makeElement(selector) {
    return {
      selector,
      style: {},
      dataset: { level: '1' },
      width: 750,
      height: 1334,
      textContent: '',
      focus() {},
      setPointerCapture() {},
      addEventListener() {},
      removeEventListener() {},
      getContext: () => makeContext(calls),
      querySelectorAll: () => [],
    };
  }

  globalThis.window = {
    innerWidth: 750,
    innerHeight: 1334,
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, makeElement(selector));
      return elements.get(selector);
    },
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => makeElement('created'),
  };
  if (!globalThis.performance) globalThis.performance = { now: () => 0 };

  // rAF is queued but never auto-drained: callers drive the loop via app.tick()
  // so frame counts stay deterministic.
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};

  const entry = pathToFileURL(join(STAGE, 'dev', 'harness', 'main.js')).href;
  const namespace = await import(entry);
  const exposed = globalThis.window.__breakout ?? namespace.__breakout;

  if (!exposed?.app || !exposed?.game) {
    throw new Error('harness booted but did not expose { app, game } on window.__breakout');
  }

  const { app, game } = exposed;

  let model = null;
  const innerOnRender = app.onRender;
  app.onRender = (m, alpha) => {
    model = m;
    innerOnRender?.(m, alpha);
  };

  return {
    app,
    game,
    calls,
    rewritten,
    strayBare,
    /** Advance N fixed steps (each renders once) and return the last render model. */
    render(frames = 1) {
      for (let i = 0; i < frames; i += 1) app.tick(1 / 60);
      return model;
    },
    clearScene() {
      model = null;
      for (const key of Object.keys(calls)) calls[key] = 0;
    },
  };
}
