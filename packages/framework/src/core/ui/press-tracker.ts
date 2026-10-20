/**
 * "Press → release on the same target commits" gate (`input-control` v2.13).
 *
 * Caller flow per frame:
 *  - `begin(id)` on the press frame with whatever is under the pointer,
 *  - `end(id)` on the release frame with whatever is under the pointer then.
 * `end` returns the target only when it matches the registered one; releasing
 * off the target (or on a different one) returns `null` = zero events.
 *
 * Same-frame press+release is just `begin(id)` then `end(id)` — instant tap.
 * `cancel()` handles interrupts (phase change, re-assembly).
 */
export class PressTracker<T> {
    private _target: T | null = null;

    /** Currently pressed target, for pressed-state visuals. */
    get pressed(): T | null {
        return this._target;
    }

    begin(target: T): void {
        this._target = target;
    }

    /** Release. Returns the committed target, or `null` when nothing commits. */
    end(hit: T | null): T | null {
        const target = this._target;
        this._target = null;
        return target !== null && hit !== null && hit === target ? target : null;
    }

    cancel(): void {
        this._target = null;
    }
}
