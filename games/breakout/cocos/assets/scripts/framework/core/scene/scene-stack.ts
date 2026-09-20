/**
 * Scene stack (screen/layer stack).
 *
 * A mini-game rarely has "one screen". It has HUD → level → pause overlay →
 * result dialog. Modelling that as a stack means:
 *  - the top scene owns input,
 *  - scenes below are suspended (not updated, not drawn as "active"),
 *  - popping returns you exactly where you were.
 *
 * The stack is engine-agnostic: a `Scene` is a lifecycle contract, not a Cocos
 * `Scene` asset. The Cocos adapter maps each stack entry to a node subtree that
 * it builds from code (see ADR-0003).
 */

export interface Scene {
  readonly name: string;
  /** Make the scene visible/active. */
  onEnter?(): void;
  /** Tear the scene down; release pooled resources here. */
  onExit?(): void;
  /** Another scene was pushed on top of this one. */
  onPause?(): void;
  /** The scene above was popped; this scene is on top again. */
  onResume?(): void;
  /** Advance simulation. Only called for the top scene. */
  update?(dt: number): void;
}

export class SceneStack {
  private readonly _stack: Scene[] = [];
  /** Scenes that requested a pop during the current update — applied after. */
  private readonly _pendingPop: number[] = [];
  private _updating = false;

  get depth(): number {
    return this._stack.length;
  }

  get top(): Scene | undefined {
    return this._stack[this._stack.length - 1];
  }

  /** Read-only view for render adapters (bottom → top). */
  get scenes(): readonly Scene[] {
    return this._stack;
  }

  push(scene: Scene): void {
    this.top?.onPause?.();
    this._stack.push(scene);
    scene.onEnter?.();
  }

  /**
   * Request removal of the top scene. Applied immediately unless we are inside
   * `update()`, in which case it is deferred to the end of the tick so the
   * caller cannot mutate the stack mid-iteration.
   */
  pop(): Scene | undefined {
    if (this._stack.length === 0) return undefined;
    if (this._updating) {
      this._pendingPop.push(1);
      return undefined;
    }
    return this._doPop();
  }

  /** Swap the top scene, running exit/enter in the correct order. */
  replace(scene: Scene): void {
    const hadTop = this._stack.length > 0;
    const old = this._doPop();
    this.push(scene);
    if (!hadTop) old?.onExit?.();
  }

  /** Pop everything. */
  clear(): void {
    while (this._stack.length > 0) this._doPop();
    this._pendingPop.length = 0;
  }

  /** Update only the top scene; deferred pops are flushed at the end. */
  update(dt: number): void {
    this._updating = true;
    this.top?.update?.(dt);
    this._updating = false;
    while (this._pendingPop.length > 0) {
      this._pendingPop.pop();
      this._doPop();
    }
  }

  private _doPop(): Scene | undefined {
    const scene = this._stack.pop();
    if (!scene) return undefined;
    scene.onExit?.();
    this.top?.onResume?.();
    return scene;
  }
}
