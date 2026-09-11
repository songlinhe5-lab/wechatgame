import { describe, expect, it, vi } from 'vitest';
import { SceneStack, type Scene } from '../../src/core/scene/scene-stack.js';

function scene(name: string, hooks: Partial<Scene> = {}): Scene & { updates: number } {
  const s = {
    name,
    updates: 0,
    update(dt: number) {
      void dt;
      s.updates++;
    },
    ...hooks,
  };
  return s as Scene & { updates: number };
}

describe('SceneStack', () => {
  it('pushes, tracks depth and exposes top', () => {
    const stack = new SceneStack();
    const hud = scene('hud');
    stack.push(hud);
    expect(stack.depth).toBe(1);
    expect(stack.top).toBe(hud);
    expect(stack.scenes).toHaveLength(1);
  });

  it('pauses the scene below and resumes it on pop', () => {
    const stack = new SceneStack();
    const onPause = vi.fn();
    const onResume = vi.fn();
    const base = scene('level', { onPause, onResume });
    stack.push(base);
    const overlay = scene('pause-menu');
    stack.push(overlay);
    expect(onPause).toHaveBeenCalledTimes(1);
    stack.pop();
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(stack.top).toBe(base);
  });

  it('updates only the top scene', () => {
    const stack = new SceneStack();
    const a = scene('a');
    const b = scene('b');
    stack.push(a);
    stack.push(b);
    stack.update(1 / 60);
    expect(b.updates).toBe(1);
    expect(a.updates).toBe(0);
  });

  it('runs onExit when popped', () => {
    const stack = new SceneStack();
    const onExit = vi.fn();
    stack.push(scene('x', { onExit }));
    stack.pop();
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(stack.depth).toBe(0);
  });

  it('defers pop() requested from inside update()', () => {
    const stack = new SceneStack();
    stack.push(
      scene('inner', {
        update: () => {
          stack.pop();
        },
      }),
    );
    stack.update(1 / 60);
    expect(stack.depth).toBe(0);
  });

  it('replace() swaps the top and runs exit/enter', () => {
    const stack = new SceneStack();
    const exitA = vi.fn();
    const enterB = vi.fn();
    stack.push(scene('a', { onExit: exitA }));
    stack.replace(scene('b', { onEnter: enterB }));
    expect(exitA).toHaveBeenCalledTimes(1);
    expect(enterB).toHaveBeenCalledTimes(1);
    expect(stack.top?.name).toBe('b');
    expect(stack.depth).toBe(1);
  });

  it('replace() on an empty stack behaves like push', () => {
    const stack = new SceneStack();
    stack.replace(scene('only'));
    expect(stack.depth).toBe(1);
    expect(stack.top?.name).toBe('only');
  });

  it('clear() empties the stack and pop() on empty is undefined', () => {
    const stack = new SceneStack();
    stack.push(scene('a'));
    stack.push(scene('b'));
    stack.clear();
    expect(stack.depth).toBe(0);
    expect(stack.pop()).toBeUndefined();
  });
});
