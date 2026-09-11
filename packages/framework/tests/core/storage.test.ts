import { describe, expect, it } from 'vitest';
import { JsonStorage, MemoryStorage } from '../../src/core/save/storage.js';

describe('MemoryStorage', () => {
  it('stores, reads and removes strings', () => {
    const s = new MemoryStorage();
    expect(s.get('missing')).toBeNull();
    s.set('a', '1');
    expect(s.get('a')).toBe('1');
    s.remove('a');
    expect(s.get('a')).toBeNull();
  });

  it('seeds from an initial record and lists keys', () => {
    const s = new MemoryStorage({ a: '1', b: '2' });
    expect(s.keys().sort()).toEqual(['a', 'b']);
    s.clear();
    expect(s.keys()).toEqual([]);
  });
});

describe('JsonStorage', () => {
  it('round-trips JSON values', () => {
    const json = new JsonStorage(new MemoryStorage());
    expect(json.setJSON('save', { score: 10, levels: [1, 2] })).toBe(true);
    expect(json.getJSON('save', {})).toEqual({ score: 10, levels: [1, 2] });
  });

  it('falls back on missing or corrupt data instead of throwing', () => {
    const backing = new MemoryStorage();
    const json = new JsonStorage(backing);
    expect(json.getJSON('nope', { safe: true })).toEqual({ safe: true });
    backing.set('bad', '{not json');
    expect(json.getJSON('bad', { safe: true })).toEqual({ safe: true });
  });

  it('reports failure when the backing store throws (quota full)', () => {
    const hostile = {
      get: () => null,
      set: () => {
        throw new Error('QuotaExceededError');
      },
      remove: () => {},
      keys: () => [],
      clear: () => {},
    };
    const json = new JsonStorage(hostile);
    expect(json.setString('k', 'v')).toBe(false);
    expect(json.setJSON('k', { a: 1 })).toBe(false);
    expect(json.getString('k')).toBeNull();
  });

  it('exposes the underlying storage', () => {
    const backing = new MemoryStorage();
    expect(new JsonStorage(backing).raw).toBe(backing);
  });

  it('handles circular structures safely', () => {
    const json = new JsonStorage(new MemoryStorage());
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(json.setJSON('c', circular)).toBe(false);
  });
});
