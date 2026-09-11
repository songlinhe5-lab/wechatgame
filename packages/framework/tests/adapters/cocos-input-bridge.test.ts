import { describe, expect, it } from 'vitest';
import { CocosInputBridge } from '../../src/adapters/cocos/input-bridge.js';
import { InputManager } from '../../src/core/input/input-manager.js';

function setup(mapPoint?: (x: number, y: number) => { x: number; y: number }) {
  const input = new InputManager();
  let now = 1000;
  const bridge = new CocosInputBridge(input, {
    now: () => now,
    ...(mapPoint ? { mapPoint } : {}),
  });
  return { input, bridge, setNow: (v: number) => (now = v) };
}

describe('CocosInputBridge', () => {
  it('forwards a touch down/move/up as a gesture', () => {
    const { input, bridge } = setup();
    input.beginFrame();
    bridge.onTouchStart({ id: 1, x: 10, y: 20 });
    expect(input.snapshot.justDown).toBe(true);
    expect(input.snapshot.x).toBe(10);

    bridge.onTouchMove({ id: 1, x: 30, y: 40 });
    expect(input.snapshot.x).toBe(30);
    expect(input.snapshot.y).toBe(40);

    input.endFrame(1 / 60);
    input.beginFrame();
    bridge.onTouchEnd({ id: 1, x: 30, y: 40 });
    expect(input.snapshot.justUp).toBe(true);
  });

  it('maps cancel onto a release', () => {
    const { input, bridge } = setup();
    input.beginFrame();
    bridge.onTouchStart({ id: 1, x: 0, y: 0 });
    input.endFrame(1 / 60);
    input.beginFrame();
    bridge.onTouchCancel({ id: 1, x: 0, y: 0 });
    expect(input.snapshot.isDown).toBe(false);
    expect(input.snapshot.justUp).toBe(true);
  });

  it('applies the optional coordinate remap', () => {
    const { input, bridge } = setup((x, y) => ({ x, y: 1334 - y }));
    input.beginFrame();
    bridge.onTouchStart({ id: 1, x: 100, y: 100 });
    expect(input.snapshot.y).toBe(1234);
  });

  it('supports a generic handle() call', () => {
    const { input, bridge } = setup();
    input.beginFrame();
    bridge.handle('down', { id: 2, x: 5, y: 5 });
    expect(input.snapshot.isDown).toBe(true);
    expect(input.snapshot.x).toBe(5);
  });

  it('stamps samples with the injected clock', () => {
    const { input, bridge, setNow } = setup();
    input.beginFrame();
    setNow(4242);
    bridge.onTouchStart({ id: 1, x: 1, y: 1 });
    expect(input.downTimestamp).toBe(4242);
  });

  it('ignores a second pointer while the first is active', () => {
    const { input, bridge } = setup();
    input.beginFrame();
    bridge.onTouchStart({ id: 1, x: 1, y: 1 });
    bridge.onTouchStart({ id: 2, x: 99, y: 99 });
    expect(input.snapshot.x).toBe(1);
  });
});
