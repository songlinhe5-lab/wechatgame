/**
 * Finite state machine.
 *
 * Every mini-game in the matrix has the same top-level shape — a small, explicit
 * set of phases with legal transitions. Encoding it as data (a transition table)
 * makes illegal transitions impossible and makes the whole flow testable.
 *
 * See `games/breakout/src/game/state.ts` for a concrete instance.
 */

export interface StateDef<C, S extends string> {
  /** Called when this state becomes active. */
  onEnter?(ctx: C, from: S | null): void;
  /** Called when leaving this state. */
  onExit?(ctx: C, to: S): void;
  /** Called every tick while active. */
  onUpdate?(ctx: C, dt: number): void;
}

export interface TransitionEvent<S extends string> {
  readonly from: S;
  readonly to: S;
}

export interface StateMachineOptions<S extends string> {
  /** Map of `from` → allowed `to` states. Omit `from` to declare no transitions. */
  readonly transitions: Readonly<Record<S, readonly S[]>>;
  /** Fired after a successful transition. */
  readonly onTransition?: (e: TransitionEvent<S>) => void;
}

export class StateMachine<C, S extends string> {
  private readonly _ctx: C;
  private readonly _states = new Map<S, StateDef<C, S>>();
  private readonly _transitions: Readonly<Record<S, readonly S[]>>;
  private readonly _onTransition: ((e: TransitionEvent<S>) => void) | undefined;
  private _current: S;
  private _elapsed = 0;

  constructor(ctx: C, initial: S, options: StateMachineOptions<S>) {
    this._ctx = ctx;
    this._current = initial;
    this._transitions = options.transitions;
    this._onTransition = options.onTransition;
  }

  get current(): S {
    return this._current;
  }

  /** Seconds spent in the current state. */
  get elapsed(): number {
    return this._elapsed;
  }

  /**
   * Restore the phase timer.
   *
   * Transitions always clear `elapsed`, which is right for a fresh phase but
   * wrong for pause/resume: a banner with 0.7 s left must resume with 0.7 s
   * left, not restart its countdown. Callers that stash the value before
   * pausing can put it back here.
   */
  set elapsed(seconds: number) {
    this._elapsed = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  }

  get context(): C {
    return this._ctx;
  }

  addState(name: S, def: StateDef<C, S>): this {
    this._states.set(name, def);
    return this;
  }

  is(state: S): boolean {
    return this._current === state;
  }

  /** True when `to` is reachable from the current state via a declared edge. */
  can(to: S): boolean {
    const allowed = this._transitions[this._current];
    return !!allowed && allowed.includes(to);
  }

  /** Force the machine into `to` without consulting the transition table. */
  reset(to: S): void {
    const from = this._current;
    this._states.get(from)?.onExit?.(this._ctx, to);
    this._current = to;
    this._elapsed = 0;
    this._states.get(to)?.onEnter?.(this._ctx, from);
    this._onTransition?.({ from, to });
  }

  /**
   * Attempt a transition. Returns `false` (and changes nothing) when the edge
   * is not declared — callers can therefore ignore spurious double-triggers.
   */
  transition(to: S): boolean {
    if (to === this._current) return false;
    if (!this.can(to)) return false;
    const from = this._current;
    this._states.get(from)?.onExit?.(this._ctx, to);
    this._current = to;
    this._elapsed = 0;
    this._states.get(to)?.onEnter?.(this._ctx, from);
    this._onTransition?.({ from, to });
    return true;
  }

  /** Drive `onEnter` for the initial state. Call once after all states are added. */
  start(): void {
    this._elapsed = 0;
    this._states.get(this._current)?.onEnter?.(this._ctx, null);
  }

  update(dt: number): void {
    this._elapsed += dt;
    this._states.get(this._current)?.onUpdate?.(this._ctx, dt);
  }
}
