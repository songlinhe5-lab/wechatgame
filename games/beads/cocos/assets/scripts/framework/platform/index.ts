/**
 * Platform entry point and auto-detection.
 *
 * Resolution order:
 *   1. `wx` global present → WeChat mini-game
 *   2. `window`/`document` present → browser
 *   3. otherwise → Node (tests/CI)
 */

import type { Platform } from './platform';
import { NodePlatform } from './node';
import { WebPlatform } from './web';
import { WeappPlatform, isWeapp } from './weapp';

export * from './platform';
export { SynthAudioBackend } from './audio-synth';
export type {
  SynthBuffer,
  SynthBufferSource,
  SynthContext,
  SynthInnerAudio,
  SynthFilter,
  SynthGain,
  SynthHost,
  SynthNode,
  SynthParam,
} from './audio-synth';
export { MockRewardedAdProvider, NoopRewardedAdProvider } from './rewarded-ad';
export type { MockAdOutcome } from './rewarded-ad';
export { NodePlatform } from './node';
export { WebPlatform } from './web';
export { WeappPlatform, WeappStorage, isWeapp } from './weapp';

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
