/**
 * Breakout — public entry point.
 *
 * Consumers:
 *  - the Cocos bootstrap (`games/breakout/cocos/assets/scripts/BreakoutBootstrap.ts`)
 *  - the browser dev harness (`dev/harness`)
 *  - the test suite
 */

export * from './config/tuning.js';
export * from './config/levels.js';
export * from './config/levels-data.js';

export * from './entities/ball.js';
export * from './entities/paddle.js';

export * from './systems/physics.js';
export * from './systems/explosion.js';
export * from './systems/scoring.js';
export * from './systems/motion.js';

export * from './game/state.js';
export * from './game/save-schema.js';
export * from './game/breakout-game.js';

export * from './view/palette.js';
export * from './view/view-model.js';
