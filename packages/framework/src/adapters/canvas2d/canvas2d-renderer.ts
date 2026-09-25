/**
 * Canvas2D render adapter.
 *
 * Consumes the engine-agnostic {@link RenderModel} and paints it with the
 * standard 2D context API. Two consumers:
 *  - the browser dev harness (`dev/harness`), for visual iteration without the
 *    Cocos editor installed;
 *  - unit tests, via a recording mock context (see
 *    `tests/adapters/canvas2d-renderer.test.ts`).
 *
 * The context type is declared structurally rather than importing lib.dom types
 * so this file stays runnable under Node.
 */

import type { DrawCommand, RenderModel } from '../../core/render/render-model.js';
import type { Viewport } from '../../core/render/viewport.js';

/**
 * A canvas paint style: a CSS colour string, or an opaque `CanvasGradient` /
 * `CanvasPattern`.
 *
 * Declared as `string | object` rather than `string` so a real
 * `CanvasRenderingContext2D` (whose `fillStyle` is a three-way union) is
 * structurally assignable to {@link Canvas2DLike} without pulling lib.dom into
 * this file. The renderer only ever *writes* these properties.
 */
export type CanvasPaintStyle = string | object;

/** The subset of `CanvasRenderingContext2D` this renderer uses. */
export interface Canvas2DLike {
  save(): void;
  restore(): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  closePath(): void;
  rect(x: number, y: number, w: number, h: number): void;
  arc(x: number, y: number, r: number, startAngle: number, endAngle: number): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  fill(): void;
  stroke(): void;
  fillText(text: string, x: number, y: number): void;
  fillStyle: CanvasPaintStyle;
  strokeStyle: CanvasPaintStyle;
  lineWidth: number;
  globalAlpha: number;
  font: string;
  textAlign: string;
  textBaseline: string;
}

export interface Canvas2DRendererOptions {
  /**
   * When true, applies the viewport letterbox transform (scale + y-flip so
   * design space origin is bottom-left). Set false if the host already
   * configured a matching transform.
   */
  readonly applyViewportTransform?: boolean;
  /**
   * Device pixel ratio the host baked into the canvas backing store
   * (`canvas.width === cssWidth * pixelRatio`). The viewport fit is in CSS px
   * (ADR-0011 §3), so the drawing transform is prefixed by this factor to land
   * in device pixels. DPR is a renderer concern only — it never enters
   * {@link Viewport} or `InputManager` (L2). Defaults to 1.
   */
  readonly pixelRatio?: number;
}

/** Draw a {@link RenderModel} onto a 2D context. */
export class Canvas2DRenderer {
  private readonly _applyTransform: boolean;
  private readonly _dpr: number;

  constructor(
    private readonly _ctx: Canvas2DLike,
    private readonly _viewport: Viewport,
    options: Canvas2DRendererOptions = {},
  ) {
    this._applyTransform = options.applyViewportTransform ?? true;
    this._dpr = options.pixelRatio && options.pixelRatio > 0 ? options.pixelRatio : 1;
  }

  /** Render one frame. Does not clear unless the model has a background. */
  draw(model: RenderModel): void {
    const ctx = this._ctx;
    const fit = this._viewport.fit;
    const dpr = this._dpr;

    ctx.save();
    if (this._applyTransform) {
      // `fit` is expressed in CSS px (ADR-0011 §3); the backing store is
      // CSS px × dpr, so every axis — scale *and* translation — is prefixed by
      // dpr. With dpr = 1 this collapses to the plain CSS-px letterbox.
      const s = fit.scale * dpr;
      ctx.setTransform(s, 0, 0, -s, fit.offsetX * dpr, (fit.offsetY + fit.viewHeight) * dpr);
    }

    // Whole-frame transform (WXG-T-132 / ADR-0014): composed *after* the fit
    // matrix so it operates in design coordinates regardless of the y-flip.
    // Applied before the background ⇒ the background participates, and a
    // scale > 1 about an interior anchor only ever pushes content edges outward
    // (overflow is clipped by the canvas) — the letterbox bands sit outside the
    // transformed design rect and stay untouched. Absent ⇒ exact old path.
    const t = model.transform;
    if (t) {
      ctx.translate(t.anchorX, t.anchorY);
      ctx.scale(t.scale, t.scale);
      ctx.translate(-t.anchorX, -t.anchorY);
    }

    if (model.background) {
      ctx.fillStyle = model.background;
      ctx.fillRect(0, 0, this._viewport.designWidth, this._viewport.designHeight);
    }

    for (const cmd of model.commands) {
      this._drawCommand(cmd, model.vertices);
    }

    ctx.restore();
  }

  private _drawCommand(cmd: DrawCommand, verts: Float64Array): void {
    const ctx = this._ctx;
    switch (cmd.kind) {
      case 'rect': {
        ctx.beginPath();
        if (cmd.radius && cmd.radius > 0) this._roundedRect(cmd.x, cmd.y, cmd.w, cmd.h, cmd.radius);
        else ctx.rect(cmd.x, cmd.y, cmd.w, cmd.h);
        this._paint(cmd.fill, cmd.stroke, cmd.lineWidth ?? 1, cmd.alpha);
        break;
      }
      case 'circle': {
        ctx.beginPath();
        ctx.arc(cmd.x, cmd.y, cmd.r, 0, Math.PI * 2);
        this._paint(cmd.fill, cmd.stroke, cmd.lineWidth ?? 1, cmd.alpha);
        break;
      }
      case 'line': {
        ctx.beginPath();
        ctx.moveTo(cmd.x1, cmd.y1);
        ctx.lineTo(cmd.x2, cmd.y2);
        ctx.globalAlpha = cmd.alpha ?? 1;
        ctx.strokeStyle = cmd.stroke;
        ctx.lineWidth = cmd.lineWidth;
        ctx.stroke();
        break;
      }
      case 'polygon': {
        // Arena spelling of the old `pts.length < 4` gate; skip behaviour is kept
        // verbatim (ADR-0024 DEC-4). `verts` is passed in rather than reached for
        // via a helper: a per-command view would allocate on the hot path.
        const n = cmd.count;
        if (n < 2) break;
        const o = cmd.offset;
        ctx.beginPath();
        ctx.moveTo(verts[o]!, verts[o + 1]!);
        for (let k = 1; k < n; k += 1) ctx.lineTo(verts[o + k * 2]!, verts[o + k * 2 + 1]!);
        ctx.closePath();
        this._paint(cmd.fill, cmd.stroke, cmd.lineWidth ?? 1, cmd.alpha);
        break;
      }
      case 'text': {
        ctx.globalAlpha = cmd.alpha ?? 1;
        ctx.fillStyle = cmd.fill ?? '#ffffff';
        ctx.font = cmd.font ?? '24px sans-serif';
        ctx.textAlign = cmd.align ?? 'left';
        let baseline = cmd.baseline ?? 'middle';
        if (this._applyTransform) {
          // The design transform flips Y (y-up). Left as-is that mirrors every
          // glyph vertically (GAP-08). Undo the flip *locally* around the
          // anchor so only text is affected — the global matrix must stay
          // flipped or the vector symbols ▲▽♥◐ break (ADR-0011 §4.2.5).
          // Re-flipping inverts the vertical baseline, so top/bottom swap.
          ctx.save();
          ctx.translate(cmd.x, cmd.y);
          ctx.scale(1, -1);
          if (baseline === 'top') baseline = 'bottom';
          else if (baseline === 'bottom') baseline = 'top';
          ctx.textBaseline = baseline;
          ctx.fillText(cmd.text, 0, 0);
          ctx.restore();
        } else {
          ctx.textBaseline = baseline;
          ctx.fillText(cmd.text, cmd.x, cmd.y);
        }
        break;
      }
    }
  }

  private _paint(fill: string | undefined, stroke: string | undefined, lineWidth: number, alpha: number | undefined): void {
    const ctx = this._ctx;
    ctx.globalAlpha = alpha ?? 1;
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  private _roundedRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this._ctx;
    const radius = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arc(x + w - radius, y + radius, radius, -Math.PI / 2, 0);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arc(x + w - radius, y + h - radius, radius, 0, Math.PI / 2);
    ctx.lineTo(x + radius, y + h);
    ctx.arc(x + radius, y + h - radius, radius, Math.PI / 2, Math.PI);
    ctx.lineTo(x, y + radius);
    ctx.arc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5);
    ctx.closePath();
  }
}
