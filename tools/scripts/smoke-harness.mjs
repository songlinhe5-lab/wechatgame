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
 * **It covers every game the harness can select**, not just the default one.
 * Before this, only breakout was booted and beads' `?game=beads` branch — its HUD,
 * keyboard handling, sprint entry and `createBeadsGame()` wiring — had no CI
 * coverage at all while `dev/harness/main.ts` carried branches for both.
 *
 * Only the DOM and the 2D context are stubbed. Framework, game logic and level
 * data are the real thing. See `lib/harness-runtime.mjs`.
 *
 * USAGE
 *   node tools/scripts/serve-harness.mjs --build-only   # compile first
 *   node tools/scripts/smoke-harness.mjs
 */

import { loadHarness } from './lib/harness-runtime.mjs';

const FRAMES = 5;

/**
 * One entry per selectable game. `check()` receives that game's own snapshot
 * shape and returns `{ problems, summary }` — the shared canvas/app checks are
 * applied to every game on top of it.
 */
const GAMES = [
  {
    id: 'breakout',
    check(snapshot) {
      const problems = [];
      const phase = snapshot.phase ?? '';
      const bricks = snapshot.totalBricks ?? -1;
      if (!['ready', 'playing', 'paused'].includes(phase)) {
        problems.push(`unexpected boot phase "${phase}"`);
      }
      if (bricks <= 0) problems.push(`board has ${bricks} bricks`);
      if (bricks > 0 && bricks !== 30) {
        problems.push(`level 1 board is ${bricks} bricks, expected 30`);
      }
      const level = (snapshot.levelIndex ?? -1) + 1;
      return { problems, summary: `phase ${phase}, level ${level}, ${bricks} bricks` };
    },
  },
  {
    id: 'beads',
    check(snapshot) {
      const problems = [];
      const phase = snapshot.phase ?? '';
      const cols = snapshot.gridCols ?? 0;
      const rows = snapshot.gridRows ?? 0;
      const cells = snapshot.cells?.length ?? 0;
      const tray = snapshot.traySlots?.length ?? 0;
      if (phase !== 'playing') problems.push(`unexpected boot phase "${phase}"`);
      if (cols <= 0 || rows <= 0) problems.push(`board is ${cols}×${rows}`);
      if (cells !== cols * rows) {
        problems.push(`snapshot carries ${cells} cells for a ${cols}×${rows} board`);
      }
      if (tray < 12) problems.push(`tray has ${tray} slots, expected ≥ 12`);
      return {
        problems,
        summary: `${cols}×${rows} board, ${cells} cells, ${tray} tray slots, phase ${phase}`,
      };
    },
  },
];

let failed = false;

for (const game of GAMES) {
  console.log(`\n── ${game.id} ${'─'.repeat(52)}`);

  let harness;
  try {
    harness = await loadHarness({ game: game.id });
  } catch (error) {
    console.error(`❌ ${game.id}: ${error.message}`);
    failed = true;
    continue;
  }

  const { app, game: instance, calls, rewritten, render } = harness;
  console.log('✅ module graph evaluated');
  console.log(`   rewrote ${rewritten} × "@wxgame/framework" to per-file relative paths`);

  const model = render(FRAMES);
  const snapshot = instance.snapshot ?? {};
  const { problems, summary } = game.check(snapshot);

  console.log(`✅ boot: ${summary}`);
  console.log(
    `   painted over ${FRAMES} frames: rect=${calls.rect} arc=${calls.arc} ` +
      `fill=${calls.fill} fillText=${calls.fillText}`,
  );
  if (model) console.log(`✅ render model produced ${model.commands?.length ?? 0} draw commands`);

  // Shared checks — identical for every game.
  if (app.running !== true) problems.push('App is not running after boot');
  if (!model) problems.push('no render model was produced');
  else if ((model.commands?.length ?? 0) <= 0) problems.push('render model has zero draw commands');
  if (calls.fill + calls.arc + calls.fillRect + calls.clearRect === 0) {
    problems.push('nothing was painted to the canvas');
  }
  if (calls.fillText <= 0) problems.push('no text was drawn (HUD missing?)');

  if (problems.length > 0) {
    console.error(`❌ ${game.id} smoke failed:\n  - ${problems.join('\n  - ')}`);
    failed = true;
  } else {
    console.log(`🎉 ${game.id} smoke OK`);
  }
}

if (failed) process.exit(1);

console.log(`\n🎉 harness smoke OK — ${GAMES.map((g) => g.id).join(', ')}`);
