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
}

/** Draw a {@link RenderModel} onto a 2D context. */
export class Canvas2DRenderer {
  private readonly _applyTransform: boolean;

  constructor(
    private readonly _ctx: Canvas2DLike,
    private readonly _viewport: Viewport,
    options: Canvas2DRendererOptions = {},
  ) {
    this._applyTransform = options.applyViewportTransform ?? true;
  }

  /** Render one frame. Does not clear unless the model has a background. */
  draw(model: RenderModel): void {
    const ctx = this._ctx;
    const fit = this._viewport.fit;

    ctx.save();
    if (this._applyTransform) {
      ctx.setTransform(fit.scale, 0, 0, -fit.scale, fit.offsetX, fit.offsetY + fit.viewHeight);
    }

    if (model.background) {
      ctx.fillStyle = model.background;
      ctx.fillRect(0, 0, this._viewport.designWidth, this._viewport.designHeight);
    }

    for (const cmd of model.commands) {
      this._drawCommand(cmd);
    }

    ctx.restore();
  }

  private _drawCommand(cmd: DrawCommand): void {
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
        const pts = cmd.points;
        if (pts.length < 4) break;
        ctx.beginPath();
        ctx.moveTo(pts[0]!, pts[1]!);
        for (let i = 2; i < pts.length - 1; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
        ctx.closePath();
        this._paint(cmd.fill, cmd.stroke, cmd.lineWidth ?? 1, cmd.alpha);
        break;
      }
      case 'text': {
        ctx.globalAlpha = cmd.alpha ?? 1;
        ctx.fillStyle = cmd.fill ?? '#ffffff';
        ctx.font = cmd.font ?? '24px sans-serif';
        ctx.textAlign = cmd.align ?? 'left';
        ctx.textBaseline = cmd.baseline ?? 'middle';
        ctx.fillText(cmd.text, cmd.x, cmd.y);
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
