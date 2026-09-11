#!/usr/bin/env node
/**
 * render-harness-frame.mjs — export real gameplay frames as SVG.
 *
 * Why: the browser harness is the primary way to *play* the game, but a
 * screenshot needs a browser. This script produces a faithful visual instead,
 * straight from the engine's own output — it boots the same compiled harness the
 * browser loads, auto-plays each level for a few seconds, and serialises the
 * resulting {@link RenderModel} into SVG.
 *
 * These are NOT mockups: every rect, circle and glyph comes from the game's
 * render model, in design space, converted 1:1.
 *
 * USAGE
 *   node tools/scripts/serve-harness.mjs --build-only
 *   node tools/scripts/render-harness-frame.mjs [--frames 240] [--out <dir>]
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { loadHarness, ROOT } from './lib/harness-runtime.mjs';
import { modelToSvg } from './lib/render-model-svg.mjs';

// ───────────────────────────────────────────────────────────────────── options

const argv = process.argv.slice(2);
function argValue(flag, fallback) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

const FRAMES = Number(argValue('--frames', 240)); // 4 s at 60 Hz
const OUT_DIR = resolve(ROOT, argValue('--out', 'dev/harness/preview'));

// ─────────────────────────────────────────────────────────────────────── main

const harness = await loadHarness();
const { game, render, clearScene } = harness;

const levelCount = game.levelCount;
console.log(`🎬 rendering ${levelCount} levels × ${FRAMES} frames (${(FRAMES / 60).toFixed(1)} s auto-play each)`);

mkdirSync(OUT_DIR, { recursive: true });

const summary = [];

for (let index = 0; index < levelCount; index += 1) {
  game.goToLevel(index);
  game.launch();
  clearScene();

  let model = null;
  for (let frame = 0; frame < FRAMES; frame += 1) {
    // Perfect auto-play: park the paddle under the ball so the frame we capture
    // is mid-rally rather than mid-death.
    game.movePaddleTo(game.ball.x);
    model = render(1);
    if (game.phase === 'game-over' || game.phase === 'victory') break;
  }

  if (!model) {
    console.error(`❌ level ${index + 1}: no render model was produced`);
    process.exit(1);
  }

  const svg = modelToSvg(model);
  const file = join(OUT_DIR, `level-${index + 1}.svg`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, svg);

  const snapshot = game.snapshot ?? {};
  summary.push({
    level: index + 1,
    file,
    phase: snapshot.phase ?? game.phase,
    score: snapshot.score ?? game.score,
    destroyed: snapshot.bricksDestroyed ?? game.bricksDestroyed,
    remaining: snapshot.remainingBricks ?? game.remainingBricks,
    total: snapshot.totalBricks ?? game.totalBricks,
    commands: model.commands.length,
  });
}

console.log('');
console.log('  lvl  phase       score   destroyed  remaining  draw cmds  file');
for (const row of summary) {
  console.log(
    `   ${String(row.level).padStart(2)}  ${String(row.phase).padEnd(11)} ` +
      `${String(row.score).padStart(5)}   ${String(row.destroyed).padStart(9)}  ` +
      `${String(`${row.remaining}/${row.total}`).padStart(9)}  ${String(row.commands).padStart(9)}  ` +
      `preview/level-${row.level}.svg`,
  );
}

// A level that never got past `ready` means launch() or the physics loop is
// broken — that is exactly the class of bug a visual export should catch.
const stuck = summary.filter((row) => row.phase === 'ready');
if (stuck.length > 0) {
  console.error(`\n❌ levels never left the 'ready' phase: ${stuck.map((r) => r.level).join(', ')}`);
  process.exit(1);
}
const idle = summary.filter((row) => row.destroyed === 0);
if (idle.length === summary.length) {
  console.error('\n❌ not a single brick was destroyed in any level — the loop is not running');
  process.exit(1);
}

console.log(`\n🎉 wrote ${summary.length} SVG previews to ${OUT_DIR}`);
