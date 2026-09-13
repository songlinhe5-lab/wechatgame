/**
 * `@wxgame/framework` public entry point.
 *
 * Import order matters conceptually:
 *   core (engine-free)  ←  adapters (engine-specific)  ←  platform (host-specific)
 *   …with `compose` sitting on top as the one place allowed to know a platform.
 *
 * The dependency arrow never points the other way (see ADR-0002).
 */

export * from './core/index.js';
export * from './platform/index.js';
export * from './compose/app.js';
export * from './adapters/canvas2d/index.js';
export * from './adapters/cocos/index.js';
