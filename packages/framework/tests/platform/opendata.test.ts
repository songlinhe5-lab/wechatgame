import { describe, expect, it } from 'vitest';
import { NoopOpenDataProvider } from '../../src/core/opendata/provider.js';
import { NodePlatform } from '../../src/platform/node.js';
import { WebPlatform } from '../../src/platform/web.js';
import { WeappPlatform } from '../../src/platform/weapp.js';

/**
 * S-2: every host exposes `createOpenDataProvider`, and until the real weapp
 * host lands (S-5) all of them degrade to the Noop provider.
 */
describe('platform open-data provider', () => {
  it('Node defaults to Noop', () => {
    const provider = new NodePlatform().createOpenDataProvider?.();
    expect(provider).toBeInstanceOf(NoopOpenDataProvider);
    expect(() => provider?.send({ type: 'rank:refresh', board: 'settle-total' })).not.toThrow();
  });

  it('Web defaults to Noop', () => {
    expect(new WebPlatform().createOpenDataProvider?.()).toBeInstanceOf(NoopOpenDataProvider);
  });

  it('weapp defaults to Noop until S-5 wires the real host', () => {
    expect(new WeappPlatform().createOpenDataProvider?.()).toBeInstanceOf(NoopOpenDataProvider);
  });
});
