/**
 * `@wxgame/framework` public entry point.
 *
 * Import order matters conceptually:
 *   core (engine-free)  ←  adapters (engine-specific)  ←  platform (host-specific)
 *   …with `compose` sitting on top as the one place allowed to know a platform.
 *
 * The dependency arrow never points the other way (see ADR-0002).
 */

export * from './core/index';
export * from './platform/index';
export * from './compose/app';
export * from './adapters/canvas2d/index';
export * from './adapters/cocos/index';
