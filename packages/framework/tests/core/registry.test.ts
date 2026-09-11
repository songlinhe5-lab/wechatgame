import { describe, expect, it } from 'vitest';
import { DataRegistry } from '../../src/core/config/registry.js';

interface Level {
  id: string;
  name: string;
}

const l1: Level = { id: 'l1', name: 'One' };
const l2: Level = { id: 'l2', name: 'Two' };

describe('DataRegistry', () => {
  it('registers and retrieves by id', () => {
    const reg = new DataRegistry<Level>('levels');
    reg.register(l1);
    expect(reg.get('l1')).toBe(l1);
    expect(reg.has('l1')).toBe(true);
    expect(reg.size).toBe(1);
  });

  it('rejects items without a usable id', () => {
    const reg = new DataRegistry<Level>('levels');
    expect(() => reg.register({ id: '', name: 'x' })).toThrow(/non-empty string id/);
  });

  it('registers many and preserves order', () => {
    const reg = new DataRegistry<Level>('levels');
    reg.registerAll([l1, l2]);
    expect(reg.ids).toEqual(['l1', 'l2']);
    expect(reg.all()).toEqual([l1, l2]);
  });

  it('replaces an item without changing its order', () => {
    const reg = new DataRegistry<Level>('levels');
    reg.registerAll([l1, l2]);
    const l1b: Level = { id: 'l1', name: 'One (revised)' };
    reg.register(l1b);
    expect(reg.ids).toEqual(['l1', 'l2']);
    expect(reg.get('l1').name).toBe('One (revised)');
    expect(reg.size).toBe(2);
  });

  it('throws on missing get but supports tryGet and getOrDefault', () => {
    const reg = new DataRegistry<Level>('levels');
    reg.register(l1);
    expect(() => reg.get('nope')).toThrow(/no item with id "nope"/);
    expect(reg.tryGet('nope')).toBeUndefined();
    expect(reg.getOrDefault('nope', l2)).toBe(l2);
  });

  it('resolves a sequence and throws on the first missing id', () => {
    const reg = new DataRegistry<Level>('levels');
    reg.registerAll([l1, l2]);
    expect(reg.resolveSequence(['l2', 'l1'])).toEqual([l2, l1]);
    expect(() => reg.resolveSequence(['l1', 'ghost'])).toThrow(/ghost/);
  });

  it('clears all entries', () => {
    const reg = new DataRegistry<Level>('levels');
    reg.registerAll([l1, l2]);
    reg.clear();
    expect(reg.size).toBe(0);
    expect(reg.ids).toEqual([]);
  });
});
