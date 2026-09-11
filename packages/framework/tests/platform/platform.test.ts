import { describe, expect, it } from 'vitest';
import { NodePlatform } from '../../src/platform/node.js';
import { WebPlatform } from '../../src/platform/web.js';
import { WeappPlatform, WeappStorage, isWeapp } from '../../src/platform/weapp.js';
import { detectPlatform, isBrowser } from '../../src/platform/index.js';
import { MemoryStorage } from '../../src/core/save/storage.js';

describe('Platform detection', () => {
  it('resolves to Node outside a browser and without wx', () => {
    expect(isWeapp()).toBe(false);
    expect(isBrowser()).toBe(false);
    const platform = detectPlatform();
    expect(platform.info.name).toBe('node');
    expect(platform.info.isMiniGame).toBe(false);
  });
});

describe('NodePlatform', () => {
  it('provides memory storage and a null audio backend', () => {
    const platform = new NodePlatform();
    const storage = platform.createStorage();
    storage.set('k', 'v');
    expect(storage.get('k')).toBe('v');
    expect(platform.createAudioBackend()).toBeTypeOf('object');
  });

  it('uses a manual clock and pumps one frame at a time', () => {
    const platform = new NodePlatform();
    const seen: number[] = [];
    platform.requestFrame((dt) => seen.push(dt));
    expect(platform.hasPendingFrame).toBe(true);
    expect(platform.pump(16)).toBe(true);
    expect(seen).toEqual([16]);
    expect(platform.now()).toBe(16);
    expect(platform.hasPendingFrame).toBe(false);
    expect(platform.pump(16)).toBe(false); // nothing pending
  });

  it('cancels a pending frame', () => {
    const platform = new NodePlatform();
    const handle = platform.requestFrame(() => {});
    handle.cancel();
    expect(platform.hasPendingFrame).toBe(false);
  });

  it('reports the configured screen size', () => {
    const platform = new NodePlatform({ width: 800, height: 600, pixelRatio: 3 });
    expect(platform.getScreenSize()).toEqual({ width: 800, height: 600, pixelRatio: 3 });
  });

  it('is silent when logging', () => {
    expect(() => new NodePlatform().log('info', 'hello')).not.toThrow();
  });
});

describe('WebPlatform (headless)', () => {
  it('falls back to injected storage', () => {
    const storage = new MemoryStorage();
    const platform = new WebPlatform({ storage });
    platform.createStorage().set('a', '1');
    expect(storage.get('a')).toBe('1');
    expect(platform.info.name).toBe('web');
  });

  it('reports fallback metrics without a DOM', () => {
    const platform = new WebPlatform();
    const size = platform.getScreenSize();
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });

  it('schedules frames through a timer fallback', async () => {
    const platform = new WebPlatform();
    const dt = await new Promise<number>((resolve) => {
      platform.requestFrame(resolve);
    });
    expect(dt).toBeGreaterThan(0);
  });

  it('exposes no-op lifecycle hooks without a DOM', () => {
    const platform = new WebPlatform();
    expect(platform.onHide(() => {})).toBeTypeOf('function');
    expect(platform.onShow(() => {})).toBeTypeOf('function');
  });
});

interface FakeWx {
  store: Map<string, string>;
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: string): void;
  removeStorageSync(key: string): void;
  getStorageInfoSync(): { keys: string[] };
  getWindowInfo(): {
    windowWidth: number;
    windowHeight: number;
    pixelRatio: number;
    screenHeight: number;
    safeArea: { top: number; bottom: number };
  };
  onHide(cb: () => void): void;
  offHide(cb: () => void): void;
  onShow(cb: () => void): void;
  offShow(cb: () => void): void;
}

function fakeWx(): FakeWx {
  const store = new Map<string, string>();
  return {
    store,
    getStorageSync: (k) => store.get(k) ?? '',
    setStorageSync: (k, v) => void store.set(k, v),
    removeStorageSync: (k) => void store.delete(k),
    getStorageInfoSync: () => ({ keys: [...store.keys()] }),
    getWindowInfo: () => ({
      windowWidth: 390,
      windowHeight: 844,
      pixelRatio: 3,
      screenHeight: 844,
      safeArea: { top: 47, bottom: 810 },
    }),
    onHide: () => {},
    offHide: () => {},
    onShow: () => {},
    offShow: () => {},
  };
}

describe('WeappStorage', () => {
  it('reads, writes, removes and lists keys', () => {
    const wx = fakeWx();
    const storage = new WeappStorage(wx);
    expect(storage.get('missing')).toBeNull();
    storage.set('a', '1');
    expect(storage.get('a')).toBe('1');
    expect(storage.keys()).toEqual(['a']);
    storage.remove('a');
    expect(storage.keys()).toEqual([]);
  });

  it('swallows host errors', () => {
    const hostile = {
      getStorageSync: () => {
        throw new Error('boom');
      },
      setStorageSync: () => {},
      removeStorageSync: () => {
        throw new Error('boom');
      },
      getStorageInfoSync: () => {
        throw new Error('boom');
      },
    };
    const storage = new WeappStorage(hostile as never);
    expect(storage.get('x')).toBeNull();
    expect(storage.keys()).toEqual([]);
    expect(() => storage.remove('x')).not.toThrow();
  });

  it('clear() removes every key', () => {
    const wx = fakeWx();
    const storage = new WeappStorage(wx);
    storage.set('a', '1');
    storage.set('b', '2');
    storage.clear();
    expect(storage.keys()).toEqual([]);
  });
});

describe('WeappPlatform', () => {
  it('derives screen metrics and safe-area insets from wx', () => {
    const platform = new WeappPlatform(fakeWx());
    expect(platform.info.name).toBe('weapp');
    expect(platform.info.isMiniGame).toBe(true);
    expect(platform.info.safeAreaTop).toBe(47);
    expect(platform.info.safeAreaBottom).toBe(844 - 810);
    expect(platform.getScreenSize()).toEqual({ width: 390, height: 844, pixelRatio: 3 });
  });

  it('degrades gracefully without a wx global', () => {
    const platform = new WeappPlatform(undefined);
    expect(platform.info.safeAreaTop).toBe(0);
    expect(platform.getScreenSize().width).toBeGreaterThan(0);
    expect(platform.createStorage()).toBeInstanceOf(MemoryStorage);
  });

  it('registers and unregisters lifecycle hooks', () => {
    const platform = new WeappPlatform(fakeWx());
    const unsubHide = platform.onHide(() => {});
    const unsubShow = platform.onShow(() => {});
    expect(() => {
      unsubHide();
      unsubShow();
    }).not.toThrow();
  });
});
