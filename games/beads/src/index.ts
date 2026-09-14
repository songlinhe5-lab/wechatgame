/**
 * Beads — public entry point.
 *
 * Consumers:
 *  - the browser dev harness (`dev/harness`, `?game=beads`)
 *  - the (future) Cocos bootstrap
 *  - the test suite
 */

export * from './config/tuning.js';
export * from './config/levels.js';
export * from './config/levels-data.js';

export * from './entities/grid.js';
export * from './entities/tray.js';

export * from './systems/placement.js';
export * from './systems/spawner.js';
export * from './systems/timer.js';
export * from './systems/sprint.js';
export * from './systems/pause-panel.js';
export * from './systems/fail-panel.js';
export * from './systems/powerups.js';
export * from './systems/finish-panel.js';
export * from './systems/sprint-settle.js';
export * from './view/combo-vfx.js';

export * from './game/state.js';
export * from './game/save-schema.js';
export * from './game/beads-game.js';

export * from './view/palette.js';
export * from './view/view-model.js';
