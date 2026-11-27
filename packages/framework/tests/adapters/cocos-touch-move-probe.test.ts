import { afterEach, describe, expect, it, vi } from 'vitest';
import { TouchMoveProbe } from '../../src/core/performance/performance.js';

vi.mock('cc', () => {
  class Component {}
  class Node {}
  const decorator = () => (): void => {};
  return {
    _decorator: { ccclass: decorator, property: decorator },
    Color: class {},
    Component,
    Graphics: class {},
    HorizontalTextAlignment: { LEFT: 0, CENTER: 1, RIGHT: 2 },
    input: {},
    Input: { EventType: {} },
    Label: class {},
    Node,
    UITransform: class {},
    screen: { devicePixelRatio: 1 },
  };
});

interface BootstrapLike {
  prototype: object;
}

const bindingsPath = '../../src/adapters/cocos/bindings.js';

interface MoveHost {
  _touchProbe: TouchMoveProbe;
  _touchProbeGlobal: Record<string, unknown> | null;
  _bridge: unknown;
  _inputBound: boolean;
  _resizeBound: boolean;
  _loop: unknown;
  _app: unknown;
  _onTouchMove(e: unknown): void;
  onDestroy(): void;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as Record<string, unknown>).__touchProbe;
});

describe('Bootstrap._onTouchMove · 诊断计数接线', () => {
  it('桥接未就绪时也先计一次宿主入口，不读坐标、不改变原输入行为', async () => {
    const { Bootstrap } = await import(bindingsPath) as { Bootstrap: BootstrapLike };
    const host = Object.create(Bootstrap.prototype) as MoveHost;
    const probe = new TouchMoveProbe();
    host._touchProbe = probe;
    host._bridge = null;
    vi.spyOn(Date, 'now').mockReturnValue(100);
    probe.start(100);

    host._onTouchMove({});

    expect(probe.report()).toBe('count=1 elapsedMs=0.0 hz=0.0 maxGapMs=0.0');
  });

  it('onDestroy 复位探针并移除本实例注册的全局接口', async () => {
    const { Bootstrap } = await import(bindingsPath) as { Bootstrap: BootstrapLike };
    const host = Object.create(Bootstrap.prototype) as MoveHost;
    const probe = new TouchMoveProbe();
    const api = { start: vi.fn(), stop: vi.fn(), reset: vi.fn(), report: vi.fn() };
    host._touchProbe = probe;
    host._touchProbeGlobal = api;
    host._inputBound = false;
    host._resizeBound = false;
    host._loop = null;
    host._app = null;
    (globalThis as Record<string, unknown>).__touchProbe = api;
    probe.start(0);
    probe.sample(0);

    host.onDestroy();

    expect(probe.report()).toBe('count=0 elapsedMs=0.0 hz=0.0 maxGapMs=0.0');
    expect((globalThis as Record<string, unknown>).__touchProbe).toBeUndefined();
  });

  it('onDestroy 不误删后启动实例的全局接口', async () => {
    const { Bootstrap } = await import(bindingsPath) as { Bootstrap: BootstrapLike };
    const host = Object.create(Bootstrap.prototype) as MoveHost;
    const newerApi = { start: vi.fn(), stop: vi.fn(), reset: vi.fn(), report: vi.fn() };
    host._touchProbe = new TouchMoveProbe();
    host._touchProbeGlobal = { start: vi.fn(), stop: vi.fn(), reset: vi.fn(), report: vi.fn() };
    host._inputBound = false;
    host._resizeBound = false;
    host._loop = null;
    host._app = null;
    (globalThis as Record<string, unknown>).__touchProbe = newerApi;

    host.onDestroy();

    expect((globalThis as Record<string, unknown>).__touchProbe).toBe(newerApi);
  });
});
