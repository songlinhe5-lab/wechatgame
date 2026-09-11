import { describe, expect, it } from 'vitest';
import { InputManager, type PointerSample } from '../../src/core/input/input-manager.js';

function sample(
  id: number,
  x: number,
  y: number,
  phase: PointerSample['phase'],
  time = 0,
): PointerSample {
  return { id, x, y, phase, time };
}

describe('InputManager', () => {
  it('starts idle', () => {
    const input = new InputManager();
    const s = input.snapshot;
    expect(s.isDown).toBe(false);
    expect(s.justDown).toBe(false);
    expect(input.isDown).toBe(false);
  });

  it('reports justDown for exactly one frame', () => {
    const input = new InputManager();
    input.beginFrame();
    input.push(sample(0, 10, 20, 'down', 100));
    expect(input.snapshot.justDown).toBe(true);
    expect(input.snapshot.isDown).toBe(true);
    input.endFrame(1 / 60);

    input.beginFrame();
    expect(input.snapshot.justDown).toBe(false);
    expect(input.snapshot.isDown).toBe(true);
  });

  it('accumulates hold time while pressed', () => {
    const input = new InputManager();
    input.beginFrame();
    input.push(sample(0, 0, 0, 'down'));
    input.endFrame(0.1);
    input.beginFrame();
    input.endFrame(0.1);
    expect(input.snapshot.holdTime).toBeCloseTo(0.2, 6);
  });

  it('tracks movement and per-frame delta', () => {
    const input = new InputManager();
    input.beginFrame();
    input.push(sample(0, 100, 100, 'down'));
    input.endFrame(1 / 60);

    input.beginFrame();
    input.push(sample(0, 130, 90, 'move'));
    const s = input.snapshot;
    expect(s.x).toBe(130);
    expect(s.y).toBe(90);
    expect(s.dx).toBe(30);
    expect(s.dy).toBe(-10);
    input.endFrame(1 / 60);
  });

  it('reports justUp on release', () => {
    const input = new InputManager();
    input.beginFrame();
    input.push(sample(0, 1, 1, 'down'));
    input.endFrame(1 / 60);

    input.beginFrame();
    input.push(sample(0, 1, 1, 'up'));
    expect(input.snapshot.justUp).toBe(true);
    expect(input.snapshot.isDown).toBe(false);
  });

  it('does not report justUp on the press frame', () => {
    const input = new InputManager();
    input.beginFrame();
    input.push(sample(0, 1, 1, 'down'));
    expect(input.snapshot.justUp).toBe(false);
    expect(input.snapshot.justDown).toBe(true);
  });

  it('ignores secondary pointers while one is active', () => {
    const input = new InputManager();
    input.beginFrame();
    input.push(sample(1, 10, 10, 'down'));
    input.push(sample(2, 99, 99, 'down')); // ignored
    input.push(sample(2, 99, 99, 'move')); // ignored (not the owner)
    const s = input.snapshot;
    expect(s.x).toBe(10);
    expect(s.y).toBe(10);
    input.push(sample(1, 20, 20, 'move'));
    expect(input.snapshot.x).toBe(20);
  });

  it('treats cancel as a release', () => {
    const input = new InputManager();
    input.beginFrame();
    input.push(sample(1, 5, 5, 'down'));
    input.endFrame(1 / 60);
    input.beginFrame();
    input.push(sample(1, 5, 5, 'cancel'));
    expect(input.snapshot.isDown).toBe(false);
    expect(input.snapshot.justUp).toBe(true);
  });

  it('allows a new gesture after release', () => {
    const input = new InputManager();
    input.beginFrame();
    input.push(sample(1, 0, 0, 'down'));
    input.endFrame(1 / 60);
    input.beginFrame();
    input.push(sample(1, 0, 0, 'up'));
    input.endFrame(1 / 60);
    input.beginFrame();
    input.push(sample(2, 50, 50, 'down'));
    expect(input.snapshot.isDown).toBe(true);
    expect(input.snapshot.x).toBe(50);
  });

  it('snapshots are frozen', () => {
    const input = new InputManager();
    input.beginFrame();
    const s = input.snapshot;
    expect(Object.isFrozen(s)).toBe(true);
  });

  it('exposes the press timestamp while held', () => {
    const input = new InputManager();
    input.beginFrame();
    input.push(sample(0, 0, 0, 'down', 1234));
    expect(input.downTimestamp).toBe(1234);
  });
});
