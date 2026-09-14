/**
 * Engine-agnostic framework core.
 *
 * Nothing in this folder may import `cc`, touch the DOM, or reference `wx`.
 * Enforced by review + the `no-engine-imports-in-core` check in
 * `tools/scripts/verify.mjs`.
 */

export * from './math/index';
export * from './loop/game-loop';
export * from './events/event-bus';
export * from './fsm/state-machine';
export * from './scene/scene-stack';
export * from './input/input-manager';
export * from './pool/object-pool';
export * from './save/storage';
export * from './save/save-manager';
export * from './config/registry';
export * from './config/level';
export * from './audio/audio';
export * from './render/viewport';
export * from './render/render-model';
export * from './game/game';
export * from './ads/rewarded-ad';
