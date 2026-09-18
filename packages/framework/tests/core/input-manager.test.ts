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

  it('tracks a secondary pointer in slot 1 without touching owner fields', () => {
    const input = new InputManager();
    input.beginFrame();
    input.push(sample(1, 10, 10, 'down'));
    input.push(sample(2, 99, 99, 'down')); // slot 1, not ignored
    input.push(sample(2, 120, 80, 'move')); // slot 1 move
    const s = input.snapshot;
    // Owner (slot 0) semantics unchanged by the second pointer.
    expect(s.x).toBe(10);
    expect(s.y).toBe(10);
    expect(s.justDown).toBe(true); // only the owner claims justDown
    // Slot 1 carries the second pointer independently.
    expect(s.isDown2).toBe(true);
    expect(s.x2).toBe(120);
    expect(s.y2).toBe(80);
    expect(s.dx2).toBe(21); // 120 - 99 (prev seeded at the second finger's down)
    expect(s.dy2).toBe(-19); // 80 - 99
    input.push(sample(1, 20, 20, 'move'));
    expect(input.snapshot.x).toBe(20); // owner still routes
  });

  it('does not set justDown for the second pointer', () => {
    const input = new InputManager();
    input.beginFrame();
    input.push(sample(1, 5, 5, 'down'));
    input.endFrame(1 / 60);
    input.beginFrame();
    input.push(sample(2, 40, 40, 'down'));
    const s = input.snapshot;
    expect(s.justDown).toBe(false); // owner already down last frame
    expect(s.isDown).toBe(true);
    expect(s.isDown2).toBe(true);
  });

  it('does not promote the second pointer to owner when the owner lifts', () => {
    const input = new InputManager();
    input.beginFrame();
    input.push(sample(1, 10, 10, 'down'));
    input.push(sample(2, 50, 50, 'down'));
    input.endFrame(1 / 60);
    input.beginFrame();
    input.push(sample(1, 12, 12, 'up')); // owner lifts, finger 2 still held
    const s = input.snapshot;
    expect(s.isDown).toBe(false); // owner released
    expect(s.justUp).toBe(true);
    expect(s.isDown2).toBe(true); // slot 1 NOT migrated to owner
    // A subsequent move of finger 2 must not become owner motion / justDown.
    input.endFrame(1 / 60);
    input.beginFrame();
    input.push(sample(2, 70, 70, 'move'));
    const s2 = input.snapshot;
    expect(s2.justDown).toBe(false);
    expect(s2.isDown).toBe(false);
    expect(s2.x2).toBe(70);
  });

  it('clears both slots on reset', () => {
    const input = new InputManager();
    input.beginFrame();
    input.push(sample(1, 10, 10, 'down'));
    input.push(sample(2, 60, 60, 'down'));
    input.reset();
    const s = input.snapshot;
    expect(s.isDown).toBe(false);
    expect(s.isDown2).toBe(false);
    expect(s.x2).toBe(0);
    expect(s.y2).toBe(0);
  });

  it('keeps single-pointer sequences free of slot-1 leakage (regression anchor)', () => {
    const input = new InputManager();
    const seq = [
      sample(0, 5, 5, 'down', 0),
      sample(0, 20, 30, 'move', 16),
      sample(0, 40, 40, 'up', 32),
    ];
    for (const s of seq) {
      input.beginFrame();
      input.push(s);
      const snap = input.snapshot;
      // Second slot never activates without a second pointer.
      expect(snap.isDown2).toBe(false);
      expect(snap.x2).toBe(0);
      expect(snap.y2).toBe(0);
      expect(snap.dx2).toBe(0);
      expect(snap.dy2).toBe(0);
      input.endFrame(1 / 60);
    }
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
