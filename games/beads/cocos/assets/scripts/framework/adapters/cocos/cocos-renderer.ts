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
  /**
   * 可选的文本测量出口。正道是由宿主（`bindings.ts` 用真实 `cc.Label` /
   * `UITransform`）实现，返回文本在当前字号下的**真实像素宽**（G3·待编辑器半）。
   * 未提供时 `_anchorForText` 退化为按字符数估算（见 `FALLBACK_CHAR_WIDTH_RATIO`）。
   */
  measureWidth?(text: string, fontSize: number): number;
}

export interface CocosLabelSource {
  /** Borrow a label node for this frame. */
  acquire(): CocosLabelLike;
  /** Return labels not used this frame. */
  releaseAll(): void;
}

export interface CocosColorFactory {
  /**
   * Parse a CSS-ish colour literal (`#rgb` / `#rrggbb` / `rgb()` / `rgba()`) into a
   * structural colour. `alpha` multiplies any alpha **embedded in the string**
   * (canvas2d `globalAlpha` parity — see {@link parseColorLiteral}).
   * Historical name `fromHex` is kept; it was the BD-50 bug that hex-only parsing
   * silently turned the view's `rgba()` fills into opaque black on Cocos.
   */
  fromHex(hex: string, alpha?: number): ColorLike;
}

export interface CocosRendererOptions {
  /**
   * Cocos UI space is centred on the canvas (anchor 0.5) whereas the framework
   * design space has its origin at the bottom-left. When true (default) the
   * renderer converts coordinates; set false if the host node is already offset.
   */
  readonly convertToCenteredOrigin?: boolean;
  /**
   * Whole-frame transform executor (WXG-T-132 / ADR-0014), implemented by the
   * host (`bindings.ts` scales the GameRoot node — **node scaling**, not
   * per-command maths: mapping coordinates here would need per-label
   * `setFontSize` every frame, re-triggering TTF re-rasterisation, plus manual
   * scaling of every w/h/r/lineWidth — a wider and less faithful surface).
   * Absent ⇒ `model.transform` is ignored (breakout and every host that has
   * not wired the node path keep rendering as before).
   */
  readonly transformHost?: CocosTransformHostLike;
}

/**
 * Structural view of "apply one whole-frame scale to the scene container"
 * (design-space anchor; the host owns the zero-allocation guarantee — scalar
 * args only, and MUST reset to identity when the frame has no transform).
 */
export interface CocosTransformHostLike {
  applyFrameTransform(scale: number, anchorX: number, anchorY: number): void;
  resetFrameTransform(): void;
}

/**
 * G3 降级估算系数：仅当宿主**未**注入 `label.measureWidth` 时用于估算文本宽。
 * 对 CJK/等宽字体近似成立，对比例字体不准——这正是 G3 未关闭的根因，真实
 * 测量由 `bindings.ts`（待编辑器半）接上后，本降级分支不再命中。
 */
const FALLBACK_CHAR_WIDTH_RATIO = 0.55;

export class CocosRenderModelRenderer {
  private readonly _centered: boolean;
  private readonly _transformHost: CocosTransformHostLike | undefined;
  private _labelsUsed = 0;

  constructor(
    private readonly _graphics: CocosGraphicsLike,
    private readonly _labels: CocosLabelSource,
    private readonly _colors: CocosColorFactory,
    private readonly _viewport: Viewport,
    options: CocosRendererOptions = {},
  ) {
    this._centered = options.convertToCenteredOrigin ?? true;
    this._transformHost = options.transformHost;
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

    // Per-frame dispatch, both branches idempotent: a stale scale from the
    // previous shake frame must never survive a transform-free frame.
    if (this._transformHost) {
      const t = model.transform;
      if (t) this._transformHost.applyFrameTransform(t.scale, t.anchorX, t.anchorY);
      else this._transformHost.resetFrameTransform();
    }

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
    const { x, y } = this._anchorForText(cmd, label);
    label.setPosition(x + ox, y + oy);
    label.setColor(this._colors.fromHex(cmd.fill ?? '#ffffff', cmd.alpha ?? 1));
    label.setAlign(cmd.align ?? 'left');
    label.setVisible(true);
  }

  /**
   * Cocos 标签默认以锚点（中心）定位：左对齐需把中心右移半字宽、右对齐左移半
   * 字宽，才能让文本边缘落在 `cmd.x`。偏移量用**文本实测宽**（`_measureTextWidth`，
   * 优先宿主注入的 `measureWidth`），而非旧的按字符数估算。
   */
  private _anchorForText(
    cmd: Extract<DrawCommand, { kind: 'text' }>,
    label: CocosLabelLike,
  ): { x: number; y: number } {
    const align = cmd.align ?? 'left';
    const baseline = cmd.baseline ?? 'middle';
    const size = parseFontSize(cmd.font);
    const textWidth = this._measureTextWidth(cmd.text, size, label);
    let x = cmd.x;
    if (align === 'center') x += 0;
    else if (align === 'left') x += textWidth / 2;
    else x -= textWidth / 2;
    let y = cmd.y;
    if (baseline === 'top') y -= size / 2;
    else if (baseline === 'bottom') y += size / 2;
    return { x, y };
  }

  /**
   * 文本宽度：优先用宿主注入的实测出口（G3 正道），否则退回保守估算。
   * 放在 `_drawText` 中 `setText` 之后调用，宿主可基于已设文本回读真实尺寸。
   */
  private _measureTextWidth(
    text: string,
    fontSize: number,
    label: CocosLabelLike,
  ): number {
    const measure = label.measureWidth;
    if (measure) {
      const w = measure.call(label, text, fontSize);
      if (typeof w === 'number' && w > 0) return w;
    }
    return text.length * fontSize * FALLBACK_CHAR_WIDTH_RATIO;
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

/**
 * BD-50（裁定②排障 · WXG-T-156）：引擎无关的颜色字面量解析。
 *
 * 视图层大量经 `withAlpha()` 产出 `rgba(r,g,b,a)` 串（彩带/光晕/面板遮罩等），
 * canvas2d 渲染器直接喂 CSS 引擎天然兼容；而旧 Cocos 宿主 `parseHex` 只识
 * `#rrggbb`，`parseInt('rgba(…', 16)` → NaN → **不透明纯黑**（彩带“未渲染”真因）。
 * 本函数供宿主 `bindings.ts` 的色彩工厂复用，保证与 canvas2d 合成语义一致：
 * 嵌入 α 与命令级 alpha **相乘**（对应 `globalAlpha × fillStyle rgba`）。
 *
 * 支持：`#rgb` / `#rrggbb` / `rgb(r,g,b)` / `rgba(r,g,b,a)`；其余一律黑不透明兑底
 * （与旧行为可观察一致，但绝不产生 NaN 通道）。
 */
export function parseColorLiteral(input: string): { r: number; g: number; b: number; a: number } {
  const s = input.trim();
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3) h = h[0]! + h[0] + h[1]! + h[1] + h[2]! + h[2];
    if (/^[0-9a-fA-F]{6}$/.test(h)) {
      const n = parseInt(h, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
  }
  const m = /^rgba?\(([^)]*)\)$/i.exec(s);
  if (m) {
    const parts = (m[1] ?? '').split(',').map((p) => Number(p.trim()));
    if (parts.length >= 3 && parts.every((v, i) => Number.isFinite(v) && (i === 3 ? v >= 0 && v <= 1 : v >= 0 && v <= 255))) {
      const [r, g, b] = parts as [number, number, number];
      const a = parts.length >= 4 ? (parts[3] as number) : 1;
      return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}
