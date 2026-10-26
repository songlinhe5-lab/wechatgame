import { describe, expect, it, vi } from 'vitest';
import {
  MockRewardedAdProvider,
  NoopRewardedAdProvider,
} from '../../src/platform/rewarded-ad.js';
import { NodePlatform } from '../../src/platform/node.js';
import { WebPlatform } from '../../src/platform/web.js';
import { WeappPlatform, WxgRewardedAdProvider } from '../../src/platform/weapp.js';
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

// ─── WXG-T-402: WxgRewardedAdProvider ──────────────────────────────────────

/** 构造一个模拟微信 createRewardedVideoAd 返回值的对象。 */
function mockWxVideoAd() {
  const onLoadCbs: Array<() => void> = [];
  const onErrorCbs: Array<(res: { errMsg?: string; errCode?: number }) => void> = [];
  const onCloseCbs: Array<(res: { isEnded: boolean }) => void> = [];
  let loadResolve: ((v: unknown) => void) | null = null;
  let loadReject: ((e: unknown) => void) | null = null;
  let showResolve: ((v: unknown) => void) | null = null;
  let showReject: ((e: unknown) => void) | null = null;
  let adUnitIdArg: string | undefined;

  const instance = {
    load: (opts?: { adUnitId?: string }) => {
      adUnitIdArg = opts?.adUnitId;
      return new Promise<unknown>((resolve, reject) => {
        loadResolve = resolve;
        loadReject = reject;
      });
    },
    show: () => new Promise<unknown>((resolve, reject) => {
      showResolve = resolve;
      showReject = reject;
    }),
    onLoad: (cb: () => void) => { onLoadCbs.push(cb); },
    offLoad: (_cb: () => void) => { },
    onError: (cb: (res: { errMsg?: string; errCode?: number }) => void) => { onErrorCbs.push(cb); },
    offError: (_cb: (res: { errMsg?: string; errCode?: number }) => void) => { },
    onClose: (cb: (res: { isEnded: boolean }) => void) => { onCloseCbs.push(cb); },
    offClose: (_cb: (res: { isEnded: boolean }) => void) => { },
    destroy: vi.fn(),
    // 测试辅助方法（不在接口里，cast as any）
    _simulateLoadSuccess: () => { loadResolve?.(undefined); loadResolve = null; },
    _simulateLoadFail: (e: unknown = new Error('load fail')) => { loadReject?.(e); loadReject = null; },
    _simulateShowSuccess: () => { showResolve?.(undefined); showResolve = null; },
    _simulateShowFail: (e: unknown = new Error('show fail')) => { showReject?.(e); showReject = null; },
    _simulateClose: (isEnded: boolean) => { for (const cb of onCloseCbs) cb({ isEnded }); },
    _simulateWxError: (errMsg: string, errCode = 1) => {
      for (const cb of onErrorCbs) cb({ errMsg, errCode });
    },
    _adUnitIdArg: () => adUnitIdArg,
  };
  return instance as typeof instance & {
    _simulateLoadSuccess(): void;
    _simulateLoadFail(e?: unknown): void;
    _simulateShowSuccess(): void;
    _simulateShowFail(e?: unknown): void;
    _simulateClose(isEnded: boolean): void;
    _simulateWxError(errMsg: string, errCode?: number): void;
    _adUnitIdArg(): string | undefined;
  };
}

describe('WxgRewardedAdProvider (WXG-T-402)', () => {
  it('factory returns Noop when wx.createRewardedVideoAd is absent', () => {
    const provider = new WeappPlatform().createRewardedAdProvider();
    expect(provider).toBeInstanceOf(NoopRewardedAdProvider);
  });

  it('factory returns WxgRewardedAdProvider when API is present', () => {
    const mock = mockWxVideoAd();
    const wx = { createRewardedVideoAd: () => mock } as any;
    const provider = new WeappPlatform(wx).createRewardedAdProvider();
    expect(provider).toBeInstanceOf(WxgRewardedAdProvider);
  });

  it('factory passes adUnitId through', () => {
    const mock = mockWxVideoAd();
    const wx = { createRewardedVideoAd: () => mock } as any;
    const provider = new WeappPlatform(wx, { adUnitId: 'ad-123' }).createRewardedAdProvider();
    expect(provider).toBeInstanceOf(WxgRewardedAdProvider);
    provider.load('fail-continue');
    expect(mock._adUnitIdArg()).toBe('ad-123');
  });

  it('load resolve sets isReady true', async () => {
    const mock = mockWxVideoAd();
    const provider = new WxgRewardedAdProvider(() => mock);
    expect(provider.isReady()).toBe(false);
    provider.load('fail-continue');
    mock._simulateLoadSuccess();
    // Promise 微任务需要等一下
    await Promise.resolve();
    expect(provider.isReady()).toBe(true);
    provider.destroy();
  });

  it('load reject triggers onError and keeps not-ready', async () => {
    const mock = mockWxVideoAd();
    const provider = new WxgRewardedAdProvider(() => mock);
    let errors = 0;
    provider.onError(() => errors++);
    provider.load('fail-continue');
    mock._simulateLoadFail(new Error('no network'));
    // Promise reject → .catch → _emitError 是两层微任务
    await Promise.resolve().then(() => Promise.resolve());
    expect(errors).toBe(1);
    expect(provider.isReady()).toBe(false);
    provider.destroy();
  });

  it('show triggers onRewarded + onClose(completed) when isEnded=true', async () => {
    const mock = mockWxVideoAd();
    const provider = new WxgRewardedAdProvider(() => mock);
    const order: string[] = [];
    provider.onRewarded(() => order.push('rewarded'));
    provider.onClose((e) => order.push(`close:${e.reason}`));
    provider.load('fail-continue');
    mock._simulateLoadSuccess();
    await Promise.resolve();

    provider.show();
    mock._simulateShowSuccess();
    mock._simulateClose(true); // isEnded → 看完了
    // 事件是同步桥接
    expect(order).toEqual(['rewarded', 'close:completed']);
    expect(provider.isReady()).toBe(false);
    provider.destroy();
  });

  it('show triggers only onClose(skipped) when isEnded=false', async () => {
    const mock = mockWxVideoAd();
    const provider = new WxgRewardedAdProvider(() => mock);
    let rewarded = 0;
    let reason = '';
    provider.onRewarded(() => rewarded++);
    provider.onClose((e) => { reason = e.reason; });
    provider.load('fail-continue');
    mock._simulateLoadSuccess();
    await Promise.resolve();

    provider.show();
    mock._simulateShowSuccess();
    mock._simulateClose(false); // 中途退出
    expect(rewarded).toBe(0);
    expect(reason).toBe('skipped');
    provider.destroy();
  });

  it('show rejects when not ready', () => {
    const mock = mockWxVideoAd();
    const provider = new WxgRewardedAdProvider(() => mock);
    let errors = 0;
    provider.onError(() => errors++);
    provider.show(); // 未 load
    expect(errors).toBe(1);
    provider.destroy();
  });

  it('destroy drops listeners and rejects later show', async () => {
    const mock = mockWxVideoAd();
    const provider = new WxgRewardedAdProvider(() => mock);
    let rewarded = 0;
    provider.onRewarded(() => rewarded++);
    provider.load('fail-continue');
    mock._simulateLoadSuccess();
    await Promise.resolve();

    provider.destroy();
    expect(mock.destroy).toHaveBeenCalled();

    // 销毁后 listeners 已清空（_errors/_rewarded/_closed 全被 length=0 干掉）
    // 重新注册以验证 destroy 后的 show 仍会触发 onError
    let postDestroyErrors = 0;
    provider.onError(() => postDestroyErrors++);
    provider.show();
    expect(postDestroyErrors).toBe(1);
    expect(rewarded).toBe(0);
  });

  it('wx onError callback bridges to provider onError', () => {
    const mock = mockWxVideoAd();
    const provider = new WxgRewardedAdProvider(() => mock);
    let errors = 0;
    provider.onError(() => errors++);
    mock._simulateWxError('ad no fill', 1004);
    expect(errors).toBe(1);
    provider.destroy();
  });
});
