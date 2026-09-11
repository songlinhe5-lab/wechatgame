import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../../src/core/save/storage.js';
import { SaveManager, type SaveDocument } from '../../src/core/save/save-manager.js';

interface Save extends SaveDocument {
  highScore: number;
  unlockedLevel: number;
  muted: boolean;
}

const defaults = (): Save => ({ version: 2, highScore: 0, unlockedLevel: 1, muted: false });

function manager(storage = new MemoryStorage()) {
  return {
    storage,
    mgr: new SaveManager<Save>(storage, {
      key: 'wxgame.test.save',
      version: 2,
      defaults,
      migrations: {
        1: (old) => ({ ...old, unlockedLevel: old['unlockedLevel'] ?? 1, version: 2 }),
      },
    }),
  };
}

describe('SaveManager', () => {
  it('resets to defaults when nothing is stored', () => {
    const { mgr } = manager();
    const result = mgr.load();
    expect(result.wasReset).toBe(true);
    expect(result.data).toEqual(defaults());
    expect(result.migrationsApplied).toEqual([]);
  });

  it('patches, persists and reloads', () => {
    const storage = new MemoryStorage();
    const { mgr } = manager(storage);
    mgr.load();
    mgr.patch({ highScore: 500 });
    expect(mgr.isDirty).toBe(true);
    expect(mgr.save()).toBe(true);
    expect(mgr.isDirty).toBe(false);

    const second = manager(storage).mgr;
    const result = second.load();
    expect(result.wasReset).toBe(false);
    expect(second.data.highScore).toBe(500);
    expect(second.data.unlockedLevel).toBe(1);
  });

  it('migrates an older document version', () => {
    const storage = new MemoryStorage();
    storage.set(
      'wxgame.test.save',
      JSON.stringify({ version: 1, highScore: 900 }),
    );
    const { mgr } = manager(storage);
    const result = mgr.load();
    expect(result.wasReset).toBe(false);
    expect(result.migrationsApplied).toEqual([2]);
    expect(mgr.data.highScore).toBe(900);
    expect(mgr.data.unlockedLevel).toBe(1); // filled from defaults/ migration
  });

  it('refuses a document from a newer build', () => {
    const storage = new MemoryStorage();
    storage.set('wxgame.test.save', JSON.stringify({ version: 99, highScore: 1 }));
    const { mgr } = manager(storage);
    expect(mgr.load().wasReset).toBe(true);
    expect(mgr.data.highScore).toBe(0);
  });

  it('resets when the stored JSON is corrupt', () => {
    const storage = new MemoryStorage();
    storage.set('wxgame.test.save', '!!!not json');
    const { mgr } = manager(storage);
    expect(mgr.load().wasReset).toBe(true);
  });

  it('resets when a migration is missing', () => {
    const storage = new MemoryStorage({ 'k': JSON.stringify({ version: 1 }) });
    const mgr = new SaveManager<Save>(storage, {
      key: 'k',
      version: 3,
      defaults,
      migrations: { 1: (o) => ({ ...o, version: 2 }) },
    });
    expect(mgr.load().wasReset).toBe(true);
  });

  it('runs the optional validator and falls back on failure', () => {
    const storage = new MemoryStorage({
      'k': JSON.stringify({ version: 2, highScore: -5, unlockedLevel: 1, muted: false }),
    });
    const mgr = new SaveManager<Save>(storage, {
      key: 'k',
      version: 2,
      defaults,
      validate: (d) => (d.highScore < 0 ? 'negative high score' : null),
    });
    expect(mgr.load().wasReset).toBe(true);
    expect(mgr.data.highScore).toBe(0);
  });

  it('flush() only writes when dirty', () => {
    const storage = new MemoryStorage();
    const { mgr } = manager(storage);
    mgr.load();
    expect(mgr.flush()).toBe(true);
    expect(storage.get('wxgame.test.save')).toBeNull(); // not dirty → no write
    mgr.patch({ muted: true });
    expect(mgr.flush()).toBe(true);
    expect(storage.get('wxgame.test.save')).not.toBeNull();
  });

  it('reset() clears data and persists defaults', () => {
    const storage = new MemoryStorage();
    const { mgr } = manager(storage);
    mgr.load();
    mgr.patch({ highScore: 42 });
    mgr.reset();
    expect(mgr.data.highScore).toBe(0);
    expect(JSON.parse(storage.get('wxgame.test.save')!).highScore).toBe(0);
  });

  it('erase() removes the document', () => {
    const storage = new MemoryStorage();
    const { mgr } = manager(storage);
    mgr.load();
    mgr.patch({ highScore: 7 });
    mgr.save();
    mgr.erase();
    expect(storage.get('wxgame.test.save')).toBeNull();
    expect(mgr.data).toEqual(defaults());
  });
});
