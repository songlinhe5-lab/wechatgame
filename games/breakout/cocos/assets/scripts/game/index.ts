/**
 * Breakout — public entry point.
 *
 * Consumers:
 *  - the Cocos bootstrap (`games/breakout/cocos/assets/scripts/BreakoutBootstrap.ts`)
 *  - the browser dev harness (`dev/harness`)
 *  - the test suite
 */

export * from './config/tuning';
export * from './config/levels';
export * from './config/levels-data';

export * from './entities/ball';
export * from './entities/paddle';

export * from './systems/physics';
export * from './systems/explosion';
export * from './systems/scoring';
export * from './systems/motion';
export * from './systems/powerups';

export * from './game/state';
export * from './game/save-schema';
export * from './game/breakout-game';

export * from './view/palette';
export * from './view/view-model';
