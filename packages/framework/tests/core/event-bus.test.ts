import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events/event-bus.js';

interface Events extends Record<string, unknown> {
  score: { value: number };
  brick: { id: string };
  ping: undefined;
}

describe('EventBus', () => {
  it('delivers payloads to subscribers', () => {
    const bus = new EventBus<Events>();
    const spy = vi.fn();
    bus.on('score', spy);
    bus.emit('score', { value: 42 });
    expect(spy).toHaveBeenCalledWith({ value: 42 });
  });

  it('supports unsubscribe via the returned function and off()', () => {
    const bus = new EventBus<Events>();
    const a = vi.fn();
    const b = vi.fn();
    const unsub = bus.on('score', a);
    bus.on('score', b);
    unsub();
    bus.off('score', b);
    bus.emit('score', { value: 1 });
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
    expect(bus.listenerCount('score')).toBe(0);
  });

  it('fires once subscribers exactly once', () => {
    const bus = new EventBus<Events>();
    const spy = vi.fn();
    bus.once('score', spy);
    bus.emit('score', { value: 1 });
    bus.emit('score', { value: 2 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(bus.listenerCount('score')).toBe(0);
  });

  it('orders by descending priority', () => {
    const bus = new EventBus<Events>();
    const order: string[] = [];
    bus.on('score', () => order.push('low'), 0);
    bus.on('score', () => order.push('high'), 10);
    bus.on('score', () => order.push('mid'), 5);
    bus.emit('score', { value: 0 });
    expect(order).toEqual(['high', 'mid', 'low']);
  });

  it('preserves registration order at equal priority', () => {
    const bus = new EventBus<Events>();
    const order: number[] = [];
    bus.on('score', () => order.push(1));
    bus.on('score', () => order.push(2));
    bus.emit('score', { value: 0 });
    expect(order).toEqual([1, 2]);
  });

  it('is safe to unsubscribe from inside a handler', () => {
    const bus = new EventBus<Events>();
    const second = vi.fn();
    const unsubFirst = bus.on('score', () => unsubFirst());
    bus.on('score', second);
    expect(() => bus.emit('score', { value: 1 })).not.toThrow();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does not deliver to handlers added during the current emit', () => {
    const bus = new EventBus<Events>();
    const late = vi.fn();
    bus.on('score', () => bus.on('score', late));
    bus.emit('score', { value: 1 });
    expect(late).not.toHaveBeenCalled();
    bus.emit('score', { value: 2 });
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('counts listeners across all types and clears them', () => {
    const bus = new EventBus<Events>();
    bus.on('score', () => {});
    bus.on('brick', () => {});
    expect(bus.listenerCount()).toBe(2);
    bus.removeAll('score');
    expect(bus.listenerCount('score')).toBe(0);
    bus.removeAll();
    expect(bus.listenerCount()).toBe(0);
  });

  it('no-ops when emitting an event with no subscribers', () => {
    const bus = new EventBus<Events>();
    expect(() => bus.emit('ping', undefined)).not.toThrow();
  });
});
