/**
 * Cocos adapter — engine-agnostic parts.
 *
 * `bindings.ts` is deliberately NOT re-exported here: it statically imports
 * `cc`, which only resolves inside the Cocos Creator editor. Hosts import it
 * directly from the editor-managed project (see
 * `games/breakout/cocos/README.md`).
 */

export * from './cocos-renderer';
export * from './input-bridge';
export * from './loop-bridge';
export * from './label-pool';
