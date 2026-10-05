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
 *
 * WHY AN OPTIONAL *SECOND* ONE ([WXG-T-256 / ADR-0030 S5′-3]):
 * `model.background` has always been part of the render model and the canvas2d
 * host has always painted it — the Cocos host silently ignored it, so the two
 * ends showed different base colours. A flat base fill must sit **under** the
 * blit carrier (beads), while the vector UI must sit **above** it; one
 * `Graphics` cannot do both. Hosts that need the base fill inject a second
 * `Graphics` via {@link CocosRendererOptions.backGraphics}; hosts that don't
 * (breakout, every unwired scene) are byte-identical to before.
 */

import type { BlitCommand, DrawCommand, RenderModel } from '../../core/render/render-model.js';
import type { Viewport } from '../../core/render/viewport.js';

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
  /**
   * `[WXG-T-252 / ADR-0030 DEC-2]` **blit 载体缝**（宿主注入）。Cocos `Graphics` 没有
   * `drawImage`，所以 `blit` 命令在本 adapter 里**无法自行落地**——它只能被**交出**。
   *
   * - 有 carrier ⇒ 每条 `blit` 交出一次（坐标已换算到 Cocos UI 空间，与其他分支同源）。
   * - 无 carrier ⇒ 与本批之前的行为**逐字节等价**（warn-once + skip），
   *   breakout 与任何未接线的宿主渲染结果零漂移。
   *
   * ⛔ **总责语义**（承 `ADR-0029 §8.1`）：返回 `void`，⛔ 不得“没接住就回落”——
   * 带 `fx` 的命令回落 = 用错色。图集 / 节点池 / 材质全在宿主实现里（S5′），
   * 本缝只回答一个问题：「加第 N 种载体要改框架几处」⇒ **0 处**。
   */
  readonly blitCarrier?: CocosBlitCarrierLike;
  /**
   * `[WXG-T-256 / ADR-0030 S5′-3 → S5′-4]` **底图提交体**（宿主注入，可选）。宿主把它挂在
   * 节点树的**最底层**（blit 载体之下），本 adapter 每帧往上头填两类图元：
   * ① 一条 `model.background` 的全屏 rect（底色恒在珠下）；
   * ② 任何带 `back: true` 的 `rect` / `line`（桌面级图元，如托盘白瓷面板底与其内阴影）。
   * 缺省 ⇒ ② 回落普通 `Graphics`（与旧宿主逐字节等价；引擎清屏色归宿主自己定）。
   */
  readonly backGraphics?: CocosGraphicsLike;
}

/**
 * Structural view of "take one blit command off the render model".
 * Mirrors {@link CocosTransformHostLike}: scalar/structural args only, no `cc`,
 * no allocation on the hot path — the host owns the pool lifecycle.
 */
export interface CocosBlitCarrierLike {
  /**
   * Hand one blit over. `x` / `y` are the command's bottom-left corner **already
   * offset into Cocos UI space** (same `ox`/`oy` the vector branches use);
   * `w` / `h` / `alpha` / `fx` stay on the command (y-up design space, unscaled).
   *
   * ponytail: 帧边界由 `beginFrame()` 告知（`[WXG-T-253]` 补上）——实现体需要「上一帧
   * 用剩的节点本帧开头收掉」，而宿主不是它自己驱动的（`bindings.ts` 每帧调 `draw()`），
   * 所以这一刀必须由框架递。可选方法：不实现 = 与 T-252 落地时逐字节等价。
   */
  accept(cmd: BlitCommand, x: number, y: number): void;
  /**
   * Called once at the top of every `draw()` **before** any command is handed
   * over — the carrier's frame-start hook (reclaim / hide leftover pool nodes).
   * Optional: absent ⇒ the renderer calls nothing and behaviour is unchanged.
   */
  beginFrame?(): void;
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
  private readonly _blitCarrier: CocosBlitCarrierLike | undefined;
  private readonly _back: CocosGraphicsLike | undefined;
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
    this._blitCarrier = options.blitCarrier;
    this._back = options.backGraphics;
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
    // [WXG-T-253 / ADR-0030 S5′-1] 帧边界告知：载体在本帧第一条命令交出前收上一帧的剩节点。
    // 没实现 `beginFrame` 的载体 ⇒ 这里零调用，行为与 T-252 落地时相同。
    const carrier = this._blitCarrier;
    if (carrier && carrier.beginFrame) carrier.beginFrame();

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

    // [WXG-T-256] 底图：与 canvas2d 同源语义（那里是一帧起手的 fillRect）。坐标走同一对
    // ox/oy ⇒ 与其他分支共用一次换算；无 backGraphics 的宿主一行不多跑。
    const back = this._back;
    if (back) {
      back.clear();
      if (model.background) {
        back.fillColor = this._colors.fromHex(model.background, 1);
        back.rect(ox, oy, this._viewport.designWidth, this._viewport.designHeight);
        back.fill();
      }
    }

    // Vertex arena (ADR-0024): indexed directly below — no per-command view.
    const verts = model.vertices;

    for (const cmd of model.commands) {
      if (cmd.kind === 'text') {
        this._drawText(cmd, ox, oy);
        continue;
      }

      switch (cmd.kind) {
        case 'rect': {
          const x = cmd.x + ox;
          const y = cmd.y + oy;
          // [WXG-T-256 / ADR-0030 S5′-4] `back` 图元（桌面底）沉到 blit 之下；
          // 未注入底图提交体的宿主 ⇒ 回落本层，与旧行为逐字节等价。
          const t = cmd.back ? (back ?? g) : g;
          if (cmd.radius && cmd.radius > 0 && t.roundRect) {
            t.roundRect(x, y, cmd.w, cmd.h, cmd.radius);
          } else {
            t.rect(x, y, cmd.w, cmd.h);
          }
          this._paint(t, cmd.fill, cmd.stroke, cmd.lineWidth ?? 1, cmd.alpha);
          break;
        }
        case 'circle': {
          g.circle(cmd.x + ox, cmd.y + oy, cmd.r);
          this._paint(g, cmd.fill, cmd.stroke, cmd.lineWidth ?? 1, cmd.alpha);
          break;
        }
        case 'line': {
          // 与 `rect` 同口径：桌面内阴影线跟着面板底一起沉底，否则会画在珠面上。
          const t = cmd.back ? (back ?? g) : g;
          t.moveTo(cmd.x1 + ox, cmd.y1 + oy);
          t.lineTo(cmd.x2 + ox, cmd.y2 + oy);
          this._paint(t, undefined, cmd.stroke, cmd.lineWidth, cmd.alpha);
          break;
        }
        case 'polygon': {
          // `count` is a vertex count; the skip gate is the arena-side spelling of
          // the old `pts.length < 4` (count < 2 ⇔ length < 4) — behaviour is
          // unchanged on purpose (ADR-0024 DEC-4).
          const n = cmd.count;
          if (n < 2) break;
          const o = cmd.offset;
          g.moveTo(verts[o]! + ox, verts[o + 1]! + oy);
          for (let k = 1; k < n; k += 1) g.lineTo(verts[o + k * 2]! + ox, verts[o + k * 2 + 1]! + oy);
          g.close();
          this._paint(g, cmd.fill, cmd.stroke, cmd.lineWidth ?? 1, cmd.alpha);
          break;
        }
        case 'blit': {
          // [WXG-T-220 / ADR-0026] Cocos `Graphics` does not support `drawImage`.
          // [WXG-T-252 / ADR-0030 DEC-2] The command can only leave this adapter via an
          // injected carrier; without one the behaviour is byte-identical to before
          // (warn once, skip) so every unwired host keeps its current output.
          if (this._blitCarrier) {
            this._blitCarrier.accept(cmd, cmd.x + ox, cmd.y + oy);
            break;
          }
          if (!this._blitWarned) {
            console.warn('[CocosRenderer] `blit` command not supported on Cocos Graphics (ADR-0026 §4.2). Skipping.');
            this._blitWarned = true;
          }
          break;
        }
      }
    }
  }
  private _blitWarned = false;

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

  private _paint(
    g: CocosGraphicsLike,
    fill: string | undefined,
    stroke: string | undefined,
    lineWidth: number,
    alpha: number | undefined,
  ): void {
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
