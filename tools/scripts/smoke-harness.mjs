#!/usr/bin/env node
/**
 * smoke-harness.mjs — runtime smoke test for the browser dev harness.
 *
 * The harness's HTTP layer is easy to verify with curl; its *module graph* is
 * not. This script proves the graph actually executes: it loads the very same
 * emitted bytes the browser fetches (`dev/harness/dist/**`) inside Node, with a
 * minimal DOM/canvas stub, then asserts that
 *
 *   1. every module in the graph evaluates (no top-level `window` / `cc` /
 *      extensionless-import landmine),
 *   2. the composition root boots the real game, and
 *   3. a real frame is painted — draw calls reach the canvas.
 *
 * Only the DOM and the 2D context are stubbed. Framework, game logic and level
 * data are the real thing. See `lib/harness-runtime.mjs`.
 *
 * USAGE
 *   node tools/scripts/serve-harness.mjs --build-only   # compile first
 *   node tools/scripts/smoke-harness.mjs
 */

import { loadHarness } from './lib/harness-runtime.mjs';

let harness;
try {
  harness = await loadHarness();
} catch (error) {
  console.error(`\n❌ ${error.message}`);
  process.exit(1);
}

const { app, game, calls, rewritten, render } = harness;

console.log('✅ module graph evaluated');
console.log(`   rewrote ${rewritten} × "@wxgame/framework" to per-file relative paths`);

const FRAMES = 5;
const model = render(FRAMES);

const snapshot = game.snapshot ?? {};
const phase = snapshot.phase ?? game.phase;
const bricks = snapshot.totalBricks ?? -1;
const level = (snapshot.levelIndex ?? -1) + 1;

console.log(`✅ boot phase = ${phase}, level ${level}, board has ${bricks} bricks`);
console.log(
  `   painted over ${FRAMES} frames: rect=${calls.rect} arc=${calls.arc} ` +
    `fill=${calls.fill} fillText=${calls.fillText}`,
);

if (model) {
  console.log(`✅ render model produced ${model.commands?.length ?? 0} draw commands`);
} else {
  console.log('⚠️  no render model captured (App.onRender was not invoked)');
}

const problems = [];
if (app.running !== true) problems.push('App is not running after boot');
if (bricks <= 0) problems.push(`board has ${bricks} bricks`);
if (!['ready', 'playing', 'paused'].includes(phase)) problems.push(`unexpected boot phase "${phase}"`);
if (bricks > 0 && bricks !== 30) problems.push(`level 1 board is ${bricks} bricks, expected 30`);
if (!model) problems.push('no render model was produced');
else if ((model.commands?.length ?? 0) <= 0) problems.push('render model has zero draw commands');
if (calls.fill + calls.arc + calls.fillRect + calls.clearRect === 0) {
  problems.push('nothing was painted to the canvas');
}
if (calls.fillText <= 0) problems.push('no text was drawn (HUD/score missing?)');

if (problems.length > 0) {
  console.error(`\n❌ smoke failed:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}

console.log('\n🎉 harness smoke OK');
