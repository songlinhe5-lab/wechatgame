/**
 * Typed, synchronous event bus.
 *
 * Used for *notification*, never for gameplay state transfer. The authoritative
 * game state lives in the game object; the bus only tells interested parties
 * "this happened" (score changed, life lost, level cleared). UI/render adapters
 * subscribe; they never mutate gameplay state from a handler.
 *
 * See control-manifest.md → "events are notifications, not state".
 */

export type EventMap = Record<string, unknown>;
export type EventHandler<T> = (payload: T) => void;

interface Subscription<T> {
  handler: EventHandler<T>;
  once: boolean;
  /** Tombstone flag so we can unsubscribe safely mid-emit. */
  removed: boolean;
  /** Per-subscriber priority; higher fires first. */
  priority: number;
  order: number;
}

export class EventBus<M extends EventMap = EventMap> {
  private readonly _subs = new Map<keyof M, Subscription<never>[]>();
  private _order = 0;
  /** Non-zero while `emit()` is walking a subscriber list. */
  private _emitDepth = 0;

  /** Subscribe. Returns an unsubscribe function. */
  on<K extends keyof M>(
    type: K,
    handler: EventHandler<M[K]>,
    priority = 0,
  ): () => void {
    return this._add(type, handler, false, priority);
  }

  /** Subscribe for a single delivery. */
  once<K extends keyof M>(type: K, handler: EventHandler<M[K]>, priority = 0): () => void {
    return this._add(type, handler, true, priority);
  }

  /** Unsubscribe a previously registered handler. */
  off<K extends keyof M>(type: K, handler: EventHandler<M[K]>): void {
    const list = this._subs.get(type);
    if (!list) return;
    for (const sub of list) {
      if (sub.handler === (handler as EventHandler<never>)) sub.removed = true;
    }
    this._compact(type);
  }

  /**
   * Emit synchronously. Handlers added during the emit do NOT receive the
   * current event; handlers removed during the emit are skipped. This makes
   * "unsubscribe from inside a handler" safe and predictable.
   */
  emit<K extends keyof M>(type: K, payload: M[K]): void {
    const list = this._subs.get(type);
    if (!list || list.length === 0) return;

    // Snapshot length: new subscribers during this emit must not fire now.
    const count = list.length;
    this._emitDepth++;
    for (let i = 0; i < count; i++) {
      const sub = list[i];
      if (!sub || sub.removed) continue;
      if (sub.once) sub.removed = true;
      (sub.handler as EventHandler<M[K]>)(payload);
    }
    this._emitDepth--;
    this._compact(type);
  }

  /** Number of live subscribers for a type (or all types when omitted). */
  listenerCount<K extends keyof M>(type?: K): number {
    if (type === undefined) {
      let total = 0;
      for (const list of this._subs.values()) {
        for (const sub of list) if (!sub.removed) total++;
      }
      return total;
    }
    const list = this._subs.get(type);
    if (!list) return 0;
    let total = 0;
    for (const sub of list) if (!sub.removed) total++;
    return total;
  }

  removeAll<K extends keyof M>(type?: K): void {
    if (type === undefined) this._subs.clear();
    else this._subs.delete(type);
  }

  private _add<K extends keyof M>(
    type: K,
    handler: EventHandler<M[K]>,
    once: boolean,
    priority: number,
  ): () => void {
    let list = this._subs.get(type) as Subscription<never>[] | undefined;
    if (!list) {
      list = [];
      this._subs.set(type, list);
    }
    const sub: Subscription<never> = {
      handler: handler as EventHandler<never>,
      once,
      removed: false,
      priority,
      order: this._order++,
    };
    // Insert keeping descending priority, ascending registration order.
    let idx = list.length;
    for (let i = 0; i < list.length; i++) {
      if (list[i]!.priority < priority) {
        idx = i;
        break;
      }
    }
    list.splice(idx, 0, sub);
    return () => {
      sub.removed = true;
      this._compact(type);
    };
  }

  private _compact(type: keyof M): void {
    // Never mutate a list while `emit()` is walking it: the loop indexes by
    // position, so shifting entries would skip or double-fire subscribers.
    if (this._emitDepth > 0) return;
    const list = this._subs.get(type);
    if (!list) return;
    let write = 0;
    for (let read = 0; read < list.length; read++) {
      if (!list[read]!.removed) list[write++] = list[read]!;
    }
    list.length = write;
    if (write === 0) this._subs.delete(type);
  }
}
