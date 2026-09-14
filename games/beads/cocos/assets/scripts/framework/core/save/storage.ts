/**
 * Storage abstraction.
 *
 * The core never touches `localStorage` or `wx.setStorageSync` directly — it
 * goes through this interface so the same save code runs in Node (tests), the
 * browser (dev harness) and WeChat (mini-game). Platform implementations live in
 * `src/platform`.
 */

export interface Storage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** All keys this storage owns, used for namespaced cleanup/telemetry. */
  keys(): string[];
  clear(): void;
}

/** In-memory storage — used by tests and as a last-resort fallback. */
export class MemoryStorage implements Storage {
  private readonly _map = new Map<string, string>();

  constructor(initial?: Record<string, string>) {
    if (initial) for (const [k, v] of Object.entries(initial)) this._map.set(k, v);
  }

  get(key: string): string | null {
    return this._map.has(key) ? this._map.get(key)! : null;
  }

  set(key: string, value: string): void {
    this._map.set(key, value);
  }

  remove(key: string): void {
    this._map.delete(key);
  }

  keys(): string[] {
    // Convert the iterator with `Array.from`; a spread is not allowed here: the
    // Cocos ES5 build lowers a spread of a non-array iterable into a concat form
    // that does not expand it, so this returned a single key on device.
    // See ADR-0012 and tools/scripts/check-es5-spread.mjs.
    return Array.from(this._map.keys());
  }

  clear(): void {
    this._map.clear();
  }
}

/**
 * Wraps any Storage in a `getJSON`/`setJSON` convenience layer plus quota-safe
 * error handling. Storage engines in mini-games throw on quota overflow — we
 * swallow that and report it through the return value so gameplay never crashes
 * because a high-score table could not be written.
 */
export class JsonStorage {
  constructor(private readonly _storage: Storage) { }

  get raw(): Storage {
    return this._storage;
  }

  getString(key: string): string | null {
    try {
      return this._storage.get(key);
    } catch {
      return null;
    }
  }

  setString(key: string, value: string): boolean {
    try {
      this._storage.set(key, value);
      return true;
    } catch {
      return false;
    }
  }

  getJSON<T>(key: string, fallback: T): T {
    const raw = this.getString(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  setJSON(key: string, value: unknown): boolean {
    let serialised: string;
    try {
      serialised = JSON.stringify(value);
    } catch {
      return false;
    }
    return this.setString(key, serialised);
  }
}
