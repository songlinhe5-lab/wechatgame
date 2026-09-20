/**
 * Versioned save manager.
 *
 * Every save document carries a `version`. When the shipped schema changes,
 * register a migration from N → N+1; `SaveManager` replays migrations in order.
 * Unknown/invalid documents fall back to defaults instead of throwing, so a
 * corrupt save on a user's phone never bricks the game.
 */

import type { Storage } from './storage';
import { JsonStorage } from './storage';

/** A save document must expose a numeric schema version and an id. */
export interface SaveDocument {
  version: number;
}

/**
 * Upgrades a v`n` document to v`n+1`. Receives and returns loose records; the
 * manager merges the result over defaults and re-validates afterwards.
 */
export type Migration = (oldData: Record<string, unknown>) => Record<string, unknown>;

export interface SaveManagerOptions<T extends SaveDocument> {
  /** Storage key; namespace it, e.g. `wxgame.breakout.save`. */
  readonly key: string;
  /** Current schema version. Must be >= 1. */
  readonly version: number;
  /** Factory returning a fresh default document (must carry `version`). */
  readonly defaults: () => T;
  /** `version → migration` map. Migration `n` upgrades a v`n` doc to v`n+1`. */
  readonly migrations?: Readonly<Record<number, Migration>>;
  /**
   * Optional validator run after migrations. Return an error string to reject
   * the doc and fall back to defaults.
   */
  readonly validate?: (data: T) => string | null;
}

export interface SaveLoadResult<T> {
  readonly data: T;
  /** True when the on-disk document was missing/unreadable/invalid. */
  readonly wasReset: boolean;
  /** Migrations applied, in order (empty when none were needed). */
  readonly migrationsApplied: readonly number[];
}

export class SaveManager<T extends SaveDocument> {
  private readonly _json: JsonStorage;
  private readonly _options: SaveManagerOptions<T>;
  private _data: T;
  private _dirty = false;

  constructor(storage: Storage, options: SaveManagerOptions<T>) {
    this._json = new JsonStorage(storage);
    this._options = options;
    this._data = options.defaults();
  }

  /** Current in-memory document. Mutate via {@link patch} or `save`. */
  get data(): Readonly<T> {
    return this._data;
  }

  get isDirty(): boolean {
    return this._dirty;
  }

  /** Read + migrate + validate. Never throws. */
  load(): SaveLoadResult<T> {
    const { key, version, defaults, migrations, validate } = this._options;
    const raw = this._json.getJSON<Record<string, unknown> | null>(key, null);
    const applied: number[] = [];

    if (raw === null || typeof raw !== 'object') {
      this._data = defaults();
      this._dirty = false;
      return { data: this._data, wasReset: true, migrationsApplied: applied };
    }

    let doc = raw;
    let current = typeof doc['version'] === 'number' ? (doc['version'] as number) : 0;

    if (current > version) {
      // Document written by a *newer* build — refuse and reset rather than
      // silently dropping fields we do not understand.
      this._data = defaults();
      this._dirty = false;
      return { data: this._data, wasReset: true, migrationsApplied: applied };
    }

    while (current < version) {
      const migrate = migrations?.[current];
      if (!migrate) {
        this._data = defaults();
        this._dirty = false;
        return { data: this._data, wasReset: true, migrationsApplied: applied };
      }
      doc = migrate(doc);
      current = typeof doc['version'] === 'number' ? (doc['version'] as number) : current + 1;
      applied.push(current);
    }

    // Merge over defaults so newly-added fields get sane values.
    const merged = { ...defaults(), ...doc } as T;
    merged.version = version;

    const error = validate?.(merged) ?? null;
    if (error) {
      this._data = defaults();
      this._dirty = false;
      return { data: this._data, wasReset: true, migrationsApplied: applied };
    }

    this._data = merged;
    this._dirty = false;
    return { data: this._data, wasReset: false, migrationsApplied: applied };
  }

  /** Shallow-merge a patch into the document and mark it dirty. */
  patch(partial: Partial<T>): T {
    this._data = { ...this._data, ...partial, version: this._options.version };
    this._dirty = true;
    return this._data;
  }

  /** Persist the current document. Returns false on quota/IO failure. */
  save(): boolean {
    const ok = this._json.setJSON(this._options.key, this._data);
    if (ok) this._dirty = false;
    return ok;
  }

  /** Persist only when something changed since the last write. */
  flush(): boolean {
    return this._dirty ? this.save() : true;
  }

  /** Reset to defaults and persist immediately. */
  reset(): T {
    this._data = this._options.defaults();
    this._dirty = true;
    this.save();
    return this._data;
  }

  /** Remove the document entirely. */
  erase(): void {
    this._json.raw.remove(this._options.key);
    this._data = this._options.defaults();
    this._dirty = false;
  }
}
