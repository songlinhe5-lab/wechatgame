/**
 * Data registry.
 *
 * All designer-authored content (levels, brick types, enemy waves, tuning sets)
 * is registered here and looked up by string id at runtime. Content is *data*,
 * never hard-coded constants in systems — that is what lets a designer ship a
 * new level without touching gameplay code (control-manifest.md → "data-driven").
 */

export interface Identifiable {
  readonly id: string;
}

export class DataRegistry<T extends Identifiable> {
  private readonly _items = new Map<string, T>();
  private readonly _order: string[] = [];

  constructor(public readonly name = 'registry') {}

  /** Register or replace an item. Preserves first-registration ordering. */
  register(item: T): this {
    if (!item || typeof item.id !== 'string' || item.id.length === 0) {
      throw new Error(`${this.name}: item must have a non-empty string id`);
    }
    if (!this._items.has(item.id)) this._order.push(item.id);
    this._items.set(item.id, item);
    return this;
  }

  registerAll(items: readonly T[]): this {
    for (const item of items) this.register(item);
    return this;
  }

  /** Look up by id. Throws with a helpful message when missing. */
  get(id: string): T {
    const item = this._items.get(id);
    if (!item) {
      throw new Error(`${this.name}: no item with id "${id}"`);
    }
    return item;
  }

  /** Look up by id, returning `undefined` instead of throwing. */
  tryGet(id: string): T | undefined {
    return this._items.get(id);
  }

  /** Look up by id, falling back to `fallback`. */
  getOrDefault(id: string, fallback: T): T {
    return this._items.get(id) ?? fallback;
  }

  has(id: string): boolean {
    return this._items.has(id);
  }

  get size(): number {
    return this._items.size;
  }

  /** All items in registration order. */
  all(): readonly T[] {
    return this._order.map((id) => this._items.get(id)!);
  }

  /** Ids in registration order — useful for level-progression sequences. */
  get ids(): readonly string[] {
    return this._order;
  }

  /**
   * Resolve an id list into items, throwing on the first missing id. Used at
   * boot to fail fast on broken content data.
   */
  resolveSequence(ids: readonly string[]): readonly T[] {
    return ids.map((id) => this.get(id));
  }

  clear(): void {
    this._items.clear();
    this._order.length = 0;
  }
}
