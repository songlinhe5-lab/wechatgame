/**
 * Cocos Creator 3.8 render adapter — pure core.
 *
 * Translates the engine-agnostic {@link RenderModel} into calls on an injected
 * `CocosGraphicsLike` plus a pooled set of label objects. Everything here is
 * structural typing: no `import ... from 'cc'`. The real `cc` glue lives in
 * `bindings.ts`, which is excluded from the Node typecheck because the editor
 * types are only available inside Cocos Creator.
 *
 * WHY ONE GRAPHICS NODE:
 * every vector primitive (batches of rects/circles/lines) is drawn by a single
 * `Graphics` component. In Cocos each `Graphics` is a draw call; brick-breaker
 * would otherwise emit 50+ nodes and blow the draw-call budget on low-end
 * Android. Text is the exception (Cocos draws text with `Label` nodes), so
 * labels are pooled and reused.
 */

import type { DrawCommand, RenderModel } from '../../core/render/render-model';
import type { Viewport } from '../../core/render/viewport';

/** Structural colour (Cocos `Color` uses 0–255 channels). */
export interface ColorLike {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Structural view of `cc.Graphics`. */
export interface CocosGraphicsLike {
  clear(): void;
  fillColor: ColorLike;
  strokeColor: ColorLike;
  lineWidth: number;
  rect(x: number, y: number, w: number, h: number): void;
  /** Present on 3.8 but verify the exact name/signature in the editor. */
  roundRect?(x: number, y: number, w: number, h: number, r: number): void;
  circle(x: number, y: number, r: number): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  close(): void;
  fill(): void;
  stroke(): void;
}

/** Structural view of a pooled `cc.Label`. */
export interface CocosLabelLike {
  setText(text: string): void;
  setPosition(x: number, y: number): void;
  setFontSize(size: number): void;
  setColor(color: ColorLike): void;
  setAlign(align: 'left' | 'center' | 'right'): void;
  setVisible(visible: boolean): void;
}

export interface CocosLabelSource {
  /** Borrow a label node for this frame. */
  acquire(): CocosLabelLike;
  /** Return labels not used this frame. */
  releaseAll(): void;
}

export interface CocosColorFactory {
  fromHex(hex: string, alpha?: number): ColorLike;
}

export interface CocosRendererOptions {
  /**
   * Cocos UI space is centred on the canvas (anchor 0.5) whereas the framework
   * design space has its origin at the bottom-left. When true (default) the
   * renderer converts coordinates; set false if the host node is already offset.
   */
  readonly convertToCenteredOrigin?: boolean;
}

export class CocosRenderModelRenderer {
  private readonly _centered: boolean;
  private _labelsUsed = 0;

  constructor(
    private readonly _graphics: CocosGraphicsLike,
    private readonly _labels: CocosLabelSource,
    private readonly _colors: CocosColorFactory,
    private readonly _viewport: Viewport,
    options: CocosRendererOptions = {},
  ) {
    this._centered = options.convertToCenteredOrigin ?? true;
  }

  /** Labels borrowed during the last frame (telemetry / budget checks). */
  get lastLabelCount(): number {
    return this._labelsUsed;
  }

  draw(model: RenderModel): void {
    const g = this._graphics;
    g.clear();
    this._labels.releaseAll();
    this._labelsUsed = 0;

    // Cocos UI space is centred on the canvas; the framework design space has
    // its origin at the bottom-left. The offset converts between the two.
    const ox = this._centered ? -this._viewport.designWidth / 2 : 0;
    const oy = this._centered ? -this._viewport.designHeight / 2 : 0;

    for (const cmd of model.commands) {
      if (cmd.kind === 'text') {
        this._drawText(cmd, ox, oy);
        continue;
      }

      switch (cmd.kind) {
        case 'rect': {
          const x = cmd.x + ox;
          const y = cmd.y + oy;
          if (cmd.radius && cmd.radius > 0 && g.roundRect) {
            g.roundRect(x, y, cmd.w, cmd.h, cmd.radius);
          } else {
            g.rect(x, y, cmd.w, cmd.h);
          }
          this._paint(cmd.fill, cmd.stroke, cmd.lineWidth ?? 1, cmd.alpha);
          break;
        }
        case 'circle': {
          g.circle(cmd.x + ox, cmd.y + oy, cmd.r);
          this._paint(cmd.fill, cmd.stroke, cmd.lineWidth ?? 1, cmd.alpha);
          break;
        }
        case 'line': {
          g.moveTo(cmd.x1 + ox, cmd.y1 + oy);
          g.lineTo(cmd.x2 + ox, cmd.y2 + oy);
          this._paint(undefined, cmd.stroke, cmd.lineWidth, cmd.alpha);
          break;
        }
        case 'polygon': {
          const pts = cmd.points;
          if (pts.length < 4) break;
          g.moveTo(pts[0]! + ox, pts[1]! + oy);
          for (let i = 2; i < pts.length - 1; i += 2) g.lineTo(pts[i]! + ox, pts[i + 1]! + oy);
          g.close();
          this._paint(cmd.fill, cmd.stroke, cmd.lineWidth ?? 1, cmd.alpha);
          break;
        }
      }
    }
  }

  private _drawText(cmd: Extract<DrawCommand, { kind: 'text' }>, ox: number, oy: number): void {
    const label = this._labels.acquire();
    this._labelsUsed++;
    const fontSize = parseFontSize(cmd.font);
    label.setFontSize(fontSize);
    label.setText(cmd.text);
    const { x, y } = this._anchorForText(cmd);
    label.setPosition(x + ox, y + oy);
    label.setColor(this._colors.fromHex(cmd.fill ?? '#ffffff', cmd.alpha ?? 1));
    label.setAlign(cmd.align ?? 'left');
    label.setVisible(true);
  }

  /**
   * Cocos labels are positioned at their anchor point (default centre). We
   * shift by half the (unknown) text extent, so multi-character strings with
   * `align: 'left'` are nudged by an estimate and must be visually verified in
   * the editor (see VERSION.md gap list).
   */
  private _anchorForText(cmd: Extract<DrawCommand, { kind: 'text' }>): { x: number; y: number } {
    const align = cmd.align ?? 'left';
    const baseline = cmd.baseline ?? 'middle';
    const size = parseFontSize(cmd.font);
    const estimatedWidth = cmd.text.length * size * 0.55;
    let x = cmd.x;
    if (align === 'center') x += 0;
    else if (align === 'left') x += estimatedWidth / 2;
    else x -= estimatedWidth / 2;
    let y = cmd.y;
    if (baseline === 'top') y -= size / 2;
    else if (baseline === 'bottom') y += size / 2;
    return { x, y };
  }

  private _paint(fill: string | undefined, stroke: string | undefined, lineWidth: number, alpha: number | undefined): void {
    const g = this._graphics;
    if (fill) {
      g.fillColor = this._colors.fromHex(fill, alpha ?? 1);
      g.fill();
    }
    if (stroke) {
      g.strokeColor = this._colors.fromHex(stroke, alpha ?? 1);
      g.lineWidth = lineWidth;
      g.stroke();
    }
  }
}

/** Parse the leading px size out of a CSS font shorthand. Defaults to 24. */
function parseFontSize(font: string | undefined): number {
  if (!font) return 24;
  const match = /(\d+(?:\.\d+)?)px/.exec(font);
  return match ? Number(match[1]) : 24;
}
