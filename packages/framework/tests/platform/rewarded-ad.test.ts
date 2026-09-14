import { describe, expect, it } from 'vitest';
import {
  MockRewardedAdProvider,
  NoopRewardedAdProvider,
} from '../../src/platform/rewarded-ad.js';
import { NodePlatform } from '../../src/platform/node.js';
import { WebPlatform } from '../../src/platform/web.js';
import { WeappPlatform } from '../../src/platform/weapp.js';
import { REWARDED_PLACEMENT } from '../../src/core/ads/rewarded-ad.js';

describe('MockRewardedAdProvider', () => {
  it('complete fires onRewarded then onClose(completed)', () => {
    const ad = new MockRewardedAdProvider(null);
    const order: string[] = [];
    ad.onRewarded(() => order.push('rewarded'));
    ad.onClose((event) => order.push(`close:${event.reason}`));
    ad.onError(() => order.push('error'));
    ad.load(REWARDED_PLACEMENT.failContinue);
    expect(ad.isReady()).toBe(true);
    ad.show();
    expect(ad.showing).toBe(true);
    ad.settle('complete');
    expect(order).toEqual(['rewarded', 'close:completed']);
    expect(ad.showing).toBe(false);
    expect(ad.isReady()).toBe(false);
  });

  it('skip fires close only and stays ready', () => {
    const ad = new MockRewardedAdProvider(null);
    let rewarded = 0;
    let reason = '';
    ad.onRewarded(() => rewarded++);
    ad.onClose((event) => {
      reason = event.reason;
    });
    ad.load('fail-continue');
    ad.show();
    ad.settle('skip');
    expect(rewarded).toBe(0);
    expect(reason).toBe('skipped');
    expect(ad.isReady()).toBe(true);
  });

  it('error fires onError only, never onRewarded', () => {
    const ad = new MockRewardedAdProvider(null);
    let rewarded = 0;
    let errors = 0;
    ad.onRewarded(() => rewarded++);
    ad.onError(() => errors++);
    ad.load('fail-continue');
    ad.show();
    ad.settle('error');
    expect(rewarded).toBe(0);
    expect(errors).toBe(1);
    expect(ad.isReady()).toBe(false);
  });

  it('rejects a second show while already showing', () => {
    const ad = new MockRewardedAdProvider(null);
    let errors = 0;
    ad.onError(() => errors++);
    ad.load('fail-continue');
    ad.show();
    ad.show();
    expect(errors).toBe(1);
    expect(ad.showing).toBe(true);
  });

  it('destroy drops listeners and rejects later show', () => {
    const ad = new MockRewardedAdProvider(null);
    let rewarded = 0;
    ad.onRewarded(() => rewarded++);
    ad.load('fail-continue');
    ad.destroy();
    ad.show();
    ad.settle('complete');
    expect(rewarded).toBe(0);
    expect(ad.isReady()).toBe(false);
  });

  it('autoSettle complete runs inside show()', () => {
    const ad = new MockRewardedAdProvider('complete');
    let rewarded = 0;
    ad.onRewarded(() => rewarded++);
    ad.load('fail-continue');
    ad.show();
    expect(rewarded).toBe(1);
    expect(ad.showing).toBe(false);
  });
});

describe('NoopRewardedAdProvider', () => {
  it('show always errors and never rewards', () => {
    const ad = new NoopRewardedAdProvider();
    let rewarded = 0;
    let errors = 0;
    ad.onRewarded(() => rewarded++);
    ad.onError(() => errors++);
    ad.load('fail-continue');
    expect(ad.isReady()).toBe(false);
    ad.show();
    expect(rewarded).toBe(0);
    expect(errors).toBe(1);
  });
});

describe('Platform factories (WXG-T-058)', () => {
  it('Node waits for settle; Web auto-completes; Weapp is Noop', () => {
    const node = new NodePlatform().createRewardedAdProvider();
    expect(node).toBeInstanceOf(MockRewardedAdProvider);
    let nodeRewarded = 0;
    node.onRewarded(() => nodeRewarded++);
    node.load('fail-continue');
    node.show();
    expect(nodeRewarded).toBe(0);

    const web = new WebPlatform().createRewardedAdProvider();
    expect(web).toBeInstanceOf(MockRewardedAdProvider);
    let webRewarded = 0;
    web.onRewarded(() => webRewarded++);
    web.load('fail-continue');
    web.show();
    expect(webRewarded).toBe(1);

    const weapp = new WeappPlatform().createRewardedAdProvider();
    expect(weapp).toBeInstanceOf(NoopRewardedAdProvider);
    let weappRewarded = 0;
    weapp.onRewarded(() => weappRewarded++);
    weapp.load('fail-continue');
    weapp.show();
    expect(weappRewarded).toBe(0);
  });
});
