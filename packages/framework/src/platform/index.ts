/**
 * Platform entry point and auto-detection.
 *
 * Resolution order:
 *   1. `wx` global present → WeChat mini-game
 *   2. `window`/`document` present → browser
 *   3. otherwise → Node (tests/CI)
 */

import type { Platform } from './platform.js';
import { NodePlatform } from './node.js';
import { WebPlatform } from './web.js';
import { WeappPlatform, isWeapp } from './weapp.js';

export * from './platform.js';
export { NodePlatform } from './node.js';
export { WebPlatform } from './web.js';
export { WeappPlatform, WeappStorage, isWeapp } from './weapp.js';

/** True when a DOM is available. */
export function isBrowser(): boolean {
  const g = globalThis as unknown as { window?: unknown; document?: unknown };
  return typeof g.window !== 'undefined' && typeof g.document !== 'undefined';
}

/** Pick the right platform implementation for the current host. */
export function detectPlatform(): Platform {
  if (isWeapp()) return new WeappPlatform();
  if (isBrowser()) return new WebPlatform();
  return new NodePlatform();
}
