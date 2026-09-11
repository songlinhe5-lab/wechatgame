#!/usr/bin/env node
/**
 * serve-harness.mjs — build and serve the browser dev harness.
 *
 * Zero runtime dependencies on purpose: it shells out to the repo's own `tsc`
 * (already a devDependency) to emit ES modules, then serves `dev/harness` with a
 * ~120-line static file server. No bundler, no dev-server framework.
 *
 * The emitted JS is plain ESM, so the browser resolves everything natively. The
 * only indirection is the `@wxgame/framework` bare specifier, which
 * `dev/harness/index.html` maps through an `<script type="importmap">`.
 *
 * USAGE
 *   node tools/scripts/serve-harness.mjs                 # build, then serve
 *   node tools/scripts/serve-harness.mjs --port 3000
 *   node tools/scripts/serve-harness.mjs --no-build      # serve what is on disk
 *   node tools/scripts/serve-harness.mjs --build-only    # compile and exit
 */

import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..', '..');
const HARNESS_DIR = join(ROOT, 'dev', 'harness');
const DIST_DIR = join(HARNESS_DIR, 'dist');
const TSCONFIG = join(ROOT, 'tsconfig.harness.json');

// ───────────────────────────────────────────────────────────────────── options

const argv = process.argv.slice(2);
const hasFlag = (flag) => argv.includes(flag);

function argValue(flag, fallback) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

const PORT = Number(argValue('--port', process.env['PORT'] ?? 4173));
const HOST = argValue('--host', '127.0.0.1');
const SKIP_BUILD = hasFlag('--no-build');
const BUILD_ONLY = hasFlag('--build-only');

// ─────────────────────────────────────────────────────────────────────── build

/** Locate a usable `tsc`: the workspace copies first, then npx as a last resort. */
function findTsc() {
  const candidates = [
    join(ROOT, 'packages', 'framework', 'node_modules', '.bin', 'tsc'),
    join(ROOT, 'games', 'breakout', 'node_modules', '.bin', 'tsc'),
    join(ROOT, 'node_modules', '.bin', 'tsc'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function build() {
  if (!existsSync(TSCONFIG)) {
    console.error(`❌ missing ${TSCONFIG}`);
    process.exit(1);
  }

  const tsc = findTsc();
  const command = tsc ?? 'npx';
  const args = tsc ? ['-p', TSCONFIG] : ['tsc', '-p', TSCONFIG];

  console.log(`🔨 compiling harness (${tsc ? 'local tsc' : 'npx tsc'})…`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' });

  if (result.error) {
    console.error(`❌ could not run tsc: ${result.error.message}`);
    console.error('   tip: run `pnpm install` in the repo root first.');
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error('❌ harness build failed — fix the TypeScript errors above.');
    process.exit(result.status ?? 1);
  }

  const entry = join(DIST_DIR, 'dev', 'harness', 'main.js');
  if (!existsSync(entry)) {
    console.error(`❌ build produced no entry point at ${entry}`);
    process.exit(1);
  }
  console.log('✅ build ok');
}

if (!SKIP_BUILD) build();
if (BUILD_ONLY) {
  process.exit(0);
}

// ────────────────────────────────────────────────────────────────────── server

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Resolve a request path to a real file inside `dev/harness`.
 * Returns `null` on traversal attempts or when nothing matches.
 */
function resolveTarget(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const relative = normalize(decoded).replace(/^([/\\])+/, '');
  let target = join(HARNESS_DIR, relative);

  // Directory traversal guard: the resolved path must stay under the harness dir.
  if (target !== HARNESS_DIR && !target.startsWith(HARNESS_DIR + sep)) return null;

  if (existsSync(target) && statSync(target).isDirectory()) {
    target = join(target, 'index.html');
  }
  if (!existsSync(target) || !statSync(target).isFile()) return null;
  return target;
}

const server = createServer((req, res) => {
  const urlPath = req.url ?? '/';
  const target = resolveTarget(urlPath === '/' ? '/index.html' : urlPath);

  if (!target) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(
      `404 ${urlPath}\n\n` +
        (urlPath.startsWith('/dist')
          ? 'The compiled harness is missing. Run without --no-build to compile it.\n'
          : ''),
    );
    return;
  }

  const type = MIME[extname(target).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, {
    'content-type': type,
    // Sources are recompiled on every run; never let the browser cache them.
    'cache-control': 'no-store',
  });
  createReadStream(target).pipe(res);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ port ${PORT} is already in use — try --port ${PORT + 1}`);
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}/`;
  console.log('');
  console.log(`🎮 Breakout harness → ${url}`);
  console.log('   ←/→ 或拖拽移动挡板 · 空格 发球/重试 · 1–5 跳关');
  console.log('   Ctrl+C 停止');
  console.log('');
});
