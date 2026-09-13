/**
 * Engine-agnostic framework core.
 *
 * Nothing in this folder may import `cc`, touch the DOM, or reference `wx`.
 * Enforced by review + the `no-engine-imports-in-core` check in
 * `tools/scripts/verify.mjs`.
 */

export * from './math/index.js';
export * from './loop/game-loop.js';
export * from './events/event-bus.js';
export * from './fsm/state-machine.js';
export * from './scene/scene-stack.js';
export * from './input/input-manager.js';
export * from './pool/object-pool.js';
export * from './save/storage.js';
export * from './save/save-manager.js';
export * from './config/registry.js';
export * from './config/level.js';
export * from './audio/audio.js';
export * from './render/viewport.js';
export * from './render/render-model.js';
export * from './game/game.js';
