/**
 * Render model — the contract between gameplay and any renderer.
 *
 * Gameplay produces a *description* of what should be on screen (a flat list of
 * draw commands in design space). Renderers consume it. Gameplay never knows
 * whether the consumer is Cocos `Graphics`, Canvas2D, or a test spy.
 *
 * This is the mechanism behind the rule "the UI layer holds no game state"
 * (control-manifest.md): the model is produced fresh each frame from the
 * authoritative state, and thrown away afterwards. It is never mutated by UI
 * code and never read back by gameplay.
 */

export interface RectCommand {
  readonly kind: 'rect';
  /** Bottom-left corner X in design space. */
  readonly x: number;
  /** Bottom-left corner Y in design space. */
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly lineWidth?: number;
  /** Corner radius; 0 (default) means square corners. */
  readonly radius?: number;
  /** 0..1 opacity applied to fill (and stroke). */
  readonly alpha?: number;
}

export interface CircleCommand {
  readonly kind: 'circle';
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly lineWidth?: number;
  readonly alpha?: number;
}

export interface LineCommand {
  readonly kind: 'line';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly stroke: string;
  readonly lineWidth: number;
  readonly alpha?: number;
}

export type TextAlign = 'left' | 'center' | 'right';
export type TextBaseline = 'top' | 'middle' | 'bottom';

export interface TextCommand {
  readonly kind: 'text';
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly fill?: string;
  readonly font?: string;
  readonly align?: TextAlign;
  readonly baseline?: TextBaseline;
  readonly alpha?: number;
}

export interface PolygonCommand {
  readonly kind: 'polygon';
  /** Flat [x0, y0, x1, y1, ...] list in design space. */
  readonly points: readonly number[];
  readonly fill?: string;
  readonly stroke?: string;
  readonly lineWidth?: number;
  readonly alpha?: number;
}

export type DrawCommand =
  | RectCommand
  | CircleCommand
  | LineCommand
  | TextCommand
  | PolygonCommand;

/** A full frame description, in design-space units. */
export interface RenderModel {
  readonly designWidth: number;
  readonly designHeight: number;
  /** Optional background fill applied before the command list. */
  readonly background?: string;
  /**
   * Optional whole-frame transform (WXG-T-132 / ADR-0014) applied by renderers
   * **before** background and commands — i.e. the background participates, so a
   * scale > 1 about an interior anchor can never open black bands inside the
   * design rect. Absent ⇒ identity. Design-space anchor point; uniform scale.
   */
  readonly transform?: RenderTransform;
  readonly commands: readonly DrawCommand[];
}

/**
 * Whole-frame uniform scale about a design-space anchor:
 * `p' = anchor + (p − anchor) · scale`. Translation/rotation are deliberately
 * **not** offered — the only specced consumer is beads G5 「伪震屏」
 * (`art-bible §7.3.5`, scale-only red line: no dx/dy may ever appear).
 */
export interface RenderTransform {
  readonly scale: number;
  readonly anchorX: number;
  readonly anchorY: number;
}

/**
 * Accumulator that builds a {@link RenderModel} without per-frame allocation of
 * intermediate arrays: `begin()` clears the backing array, systems `push()`,
 * `end()` returns a frozen view.
 *
 * > Only ONE `RenderModel` should be alive per frame; it is reused, not stored.
 * > Renderers must copy anything they need to keep beyond the current frame.
 */
export class RenderModelBuilder {
  private readonly _commands: DrawCommand[] = [];
  private _background: string | undefined;
  // Transform slots stay as scalars (hot-path zero-allocation, ADR-0014):
  // `setTransform` is called every active frame; identity frames must not
  // allocate anything and emit no `transform` field at all.
  private _tScale = 1;
  private _tAx = 0;
  private _tAy = 0;
  private _width: number;
  private _height: number;

  constructor(designWidth: number, designHeight: number) {
    this._width = designWidth;
    this._height = designHeight;
  }

  resize(w: number, h: number): void {
    this._width = w;
    this._height = h;
  }

  begin(background?: string): void {
    this._commands.length = 0;
    this._background = background;
    this._tScale = 1;
    this._tAx = 0;
    this._tAy = 0;
  }

  /** Set/replace the frame background fill. */
  setBackground(color: string | undefined): void {
    this._background = color;
  }

  /**
   * Request a whole-frame uniform scale about a design-space anchor
   * (WXG-T-132 / ADR-0014). Scalar params on purpose — an object argument would
   * allocate every active frame. `scale === 1` keeps the frame identity (no
   * `transform` field in {@link end}, renderers take the exact old path).
   * Reset to identity by {@link begin}.
   */
  setTransform(scale: number, anchorX: number, anchorY: number): void {
    this._tScale = scale;
    this._tAx = anchorX;
    this._tAy = anchorY;
  }

  rect(x: number, y: number, w: number, h: number, cmd: Omit<RectCommand, 'kind' | 'x' | 'y' | 'w' | 'h'> = {}): void {
    this._commands.push({ kind: 'rect', x, y, w, h, ...cmd });
  }

  circle(x: number, y: number, r: number, cmd: Omit<CircleCommand, 'kind' | 'x' | 'y' | 'r'> = {}): void {
    this._commands.push({ kind: 'circle', x, y, r, ...cmd });
  }

  line(x1: number, y1: number, x2: number, y2: number, stroke: string, lineWidth = 1, alpha?: number): void {
    this._commands.push({ kind: 'line', x1, y1, x2, y2, stroke, lineWidth, ...(alpha !== undefined ? { alpha } : {}) });
  }

  text(
    x: number,
    y: number,
    text: string,
    cmd: Omit<TextCommand, 'kind' | 'x' | 'y' | 'text'> = {},
  ): void {
    this._commands.push({ kind: 'text', x, y, text, ...cmd });
  }

  polygon(points: readonly number[], cmd: Omit<PolygonCommand, 'kind' | 'points'> = {}): void {
    this._commands.push({ kind: 'polygon', points, ...cmd });
  }

  get count(): number {
    return this._commands.length;
  }

  /** Freeze and return the current frame. */
  end(): RenderModel {
    return Object.freeze({
      designWidth: this._width,
      designHeight: this._height,
      ...(this._background !== undefined ? { background: this._background } : {}),
      // The one small per-frame transform object only exists on *active*
      // effect frames (beads G5: a 150 ms window); identity frames allocate none.
      ...(this._tScale !== 1 ? {
        transform: Object.freeze({ scale: this._tScale, anchorX: this._tAx, anchorY: this._tAy }),
      } : {}),
      commands: Object.freeze([...this._commands]),
    });
  }
}

/** An empty model — handy default/placeholder. */
export const EMPTY_RENDER_MODEL: RenderModel = Object.freeze({
  designWidth: 0,
  designHeight: 0,
  commands: Object.freeze([]),
});
