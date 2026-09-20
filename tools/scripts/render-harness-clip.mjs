#!/usr/bin/env node
/**
 * render-harness-clip.mjs — record real gameplay to an MP4.
 *
 * Boots the same compiled harness the browser loads, auto-plays a level, and
 * pipes every frame through `@resvg/resvg-js` straight into `ffmpeg`. No screen
 * recording, no browser: the pixels come from the engine's own render model.
 *
 * This is the "prove it actually plays" artifact — a static frame shows layout,
 * a clip shows the ball moving, bricks breaking and the score climbing.
 *
 * REQUIRES (dev-machine only; neither is a project dependency)
 *   - `ffmpeg` on PATH
 *   - `@resvg/resvg-js` in the managed Node workspace, e.g.
 *       cd ~/.workbuddy/binaries/node/workspace && npm install @resvg/resvg-js
 *
 * USAGE
 *   node tools/scripts/serve-harness.mjs --build-only
 *   node tools/scripts/render-harness-clip.mjs --level 1 --seconds 8
 */

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { loadHarness, ROOT } from './lib/harness-runtime.mjs';

// ───────────────────────────────────────────────────────────────────── options

const argv = process.argv.slice(2);
function argValue(flag, fallback) {
  const eq = argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

const GAME = argValue('--game', '');
const LEVEL = Number(argValue('--level', 1));
const SECONDS = Number(argValue('--seconds', 8));
const FPS = Number(argValue('--fps', 30));

// ─────────────────────────────────────────────────────── resolve resvg + ffmpeg

const WORKSPACE = process.env['RESVG_WORKSPACE'] ?? join(
  process.env['HOME'] ?? '',
  '.workbuddy/binaries/node/workspace',
);

function loadResvg() {
  const require = createRequire(join(WORKSPACE, 'noop.js'));
  try {
    return require('@resvg/resvg-js');
  } catch {
    console.error(
      '❌ @resvg/resvg-js not found.\n' +
        `   Install it into the managed workspace:\n` +
        `     cd ${WORKSPACE} && npm install @resvg/resvg-js\n` +
        '   Or point RESVG_WORKSPACE at a directory that already has it.',
    );
    process.exit(1);
  }
}

function assertFfmpeg() {
  const probe = spawn('ffmpeg', ['-version'], { stdio: 'ignore' });
  probe.on('error', () => {
    console.error('❌ ffmpeg not found on PATH — install it (brew install ffmpeg).');
    process.exit(1);
  });
}

// ─────────────────────────────────────────────────── reuse the SVG serialiser

const { modelToSvg } = await import('./lib/render-model-svg.mjs');

// ─────────────────────────────────────────────────────────────────────── main

const { Resvg } = loadResvg();
assertFfmpeg();

if (process.argv.slice(2).includes('--help') || !GAME) {
  console.log(
    'render-harness-clip.mjs — record real gameplay to an MP4\n\nUSAGE\n' +
      '  node tools/scripts/render-harness-clip.mjs --game=beads|breakout [--level 1] [--seconds 8] [--fps 30] [--out <file>]\n\n' +
      '--game is REQUIRED (WXG-T-099 / BD-19): the no-argument default was removed on purpose.\n',
  );
  process.exit(GAME ? 0 : 2);
}

const harness = await loadHarness({ game: GAME });
const { game, render, clearScene } = harness;

const levelIndex = Math.min(Math.max(LEVEL, 1), game.levelCount) - 1;
const totalFrames = Math.round(SECONDS * FPS);
const stepsPerFrame = 60 / FPS; // the loop runs at a fixed 60 Hz

const outFile = resolve(ROOT, argValue('--out', `dev/harness/preview/play-level-${levelIndex + 1}.mp4`));
mkdirSync(dirname(outFile), { recursive: true });

game.goToLevel(levelIndex);
if (GAME === 'breakout') game.launch(); // breakout-only API
clearScene();

// Use the framework's own design resolution — never hardcode it.
const { designWidth: W, designHeight: H } = harness.app.viewport;

console.log(`🎬 recording level ${levelIndex + 1} · ${totalFrames} frames @ ${FPS}fps (${SECONDS}s)`);

const ffmpeg = spawn('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe',
  '-vcodec', 'png',
  '-framerate', String(FPS),
  '-i', '-',
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '20',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  outFile,
], { stdio: ['pipe', 'inherit', 'inherit'] });

let ffmpegError = null;
ffmpeg.on('error', (error) => { ffmpegError = error; });

const resvgOptions = {
  fitTo: { mode: 'width', value: W },
  font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica' },
  background: '#0c0b1e',
};

let wrote = 0;
let scoreAtStart = game.score;
let lastPhase = game.phase;

for (let frame = 0; frame < totalFrames; frame += 1) {
  if (GAME === 'breakout') {
    // Perfect auto-play so the clip is a rally, not a death loop.
    game.movePaddleTo(game.ball.x);
  }

  let model = null;
  for (let step = 0; step < stepsPerFrame; step += 1) model = render(1);
  if (!model) continue;

  const png = new Resvg(modelToSvg(model), resvgOptions).render().asPng();
  if (!ffmpeg.stdin.write(png)) {
    // Respect backpressure so we do not buffer hundreds of frames in memory.
    await new Promise((done) => ffmpeg.stdin.once('drain', done));
  }
  wrote += 1;
  lastPhase = game.phase;
}

ffmpeg.stdin.end();
await new Promise((done) => ffmpeg.on('close', done));

if (ffmpegError) {
  console.error(`❌ ffmpeg failed: ${ffmpegError.message}`);
  process.exit(1);
}

const stats = {
  frames: wrote,
  size: `${W}×${H}`,
  phase: lastPhase,
  score: game.score,
  delta: game.score - scoreAtStart,
  destroyed: game.bricksDestroyed,
  out: outFile,
};

console.log('');
console.log(`   frames written : ${stats.frames}`);
console.log(`   resolution     : ${stats.size} @ ${FPS}fps`);
console.log(`   final phase    : ${stats.phase}`);
console.log(`   score gained   : +${stats.delta}`);
console.log(`   bricks broken  : ${stats.destroyed}`);
console.log(`   output         : ${stats.out}`);

if (stats.frames === 0) {
  console.error('\n❌ no frames were encoded');
  process.exit(1);
}
if (stats.delta <= 0) {
  console.error('\n❌ the score never moved during the clip — gameplay is not advancing');
  process.exit(1);
}

console.log('\n🎉 clip rendered');
