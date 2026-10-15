/**
 * Design-space viewport with letterbox fitting.
 *
 * WeChat mini-games run on every aspect ratio from 19.5:9 phones to tablets.
 * Shipping a *fixed design resolution* plus letterboxing means:
 *  - gameplay maths is resolution-independent and deterministic,
 *  - the same level data lays out identically everywhere,
 *  - only one conversion point (screen ↔ design) needs testing.
 *
 * Design space origin is bottom-left, matching Cocos's default 2D origin.
 */

export interface FitResult {
  /** Uniform scale factor from design units to screen pixels. */
  readonly scale: number;
  /** Screen-pixel offset of the design rect's bottom-left corner. */
  readonly offsetX: number;
  readonly offsetY: number;
  /** Size of the design rect on screen, in pixels. */
  readonly viewWidth: number;
  readonly viewHeight: number;
  /** Total screen size the viewport was fitted to. */
  readonly screenWidth: number;
  readonly screenHeight: number;
}

export class Viewport {
  readonly designWidth: number;
  /**
   * `[WXG-T-280]` 设计高。静态档（默认）= 构造值恒定 + letterbox；
   * `dynamicHeight` 档 = 每次 `resize` 按屏幅重算（`designWidth × 屏高/屏宽`，
   * 不低于构造基准值 ⇒ 宽屏矮屏退回信箱老路）。菜单链式（底锚 CTA）需要真全屏高。
   */
  designHeight: number;
  /** 构造基准高（动态档的下限与回落档）。 */
  readonly baseDesignHeight: number;
  private readonly _dynamicHeight: boolean;
  private _fit: FitResult;

  constructor(designWidth: number, designHeight: number, dynamicHeight = false) {
    if (designWidth <= 0 || designHeight <= 0) {
      throw new Error('Viewport: design size must be positive');
    }
    this.designWidth = designWidth;
    this.designHeight = designHeight;
    this.baseDesignHeight = designHeight;
    this._dynamicHeight = dynamicHeight;
    this._fit = {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      viewWidth: designWidth,
      viewHeight: designHeight,
      screenWidth: designWidth,
      screenHeight: designHeight,
    };
  }

  get fit(): FitResult {
    return this._fit;
  }

  /** Aspect ratio of the design canvas (width / height). */
  get designAspect(): number {
    return this.designWidth / this.designHeight;
  }

  /**
   * Recompute the fit for a screen size.
   * @param cover when true, scale to *cover* the screen (overflow is cropped)
   *              instead of letterboxing; used for full-bleed backgrounds.
   */
  resize(screenWidth: number, screenHeight: number, cover = false): FitResult {
    // 动态档：先按屏幅重算设计高（宽恒定 ⇒ scale 分母不变），再走原换算。
    // ⚠ 本方法内**两次**读写 designHeight 是刻意的：fit 必须与最终高同帧一致。
    if (this._dynamicHeight && screenWidth > 0 && screenHeight > 0) {
      this.designHeight = Math.max(
        this.baseDesignHeight,
        Math.round((this.designWidth * screenHeight) / screenWidth),
      );
    }
    const sx = screenWidth / this.designWidth;
    const sy = screenHeight / this.designHeight;
    const scale = cover ? Math.max(sx, sy) : Math.min(sx, sy);
    const viewWidth = this.designWidth * scale;
    const viewHeight = this.designHeight * scale;
    this._fit = {
      scale,
      offsetX: (screenWidth - viewWidth) / 2,
      offsetY: (screenHeight - viewHeight) / 2,
      viewWidth,
      viewHeight,
      screenWidth,
      screenHeight,
    };
    return this._fit;
  }

  /** Screen pixels → design units (mutates and returns `out`). */
  screenToDesign(out: { x: number; y: number }, screenX: number, screenY: number): { x: number; y: number } {
    const f = this._fit;
    out.x = (screenX - f.offsetX) / f.scale;
    out.y = this.designHeight - (screenY - f.offsetY) / f.scale;
    return out;
  }

  /** Design units → screen pixels (mutates and returns `out`). */
  designToScreen(out: { x: number; y: number }, designX: number, designY: number): { x: number; y: number } {
    const f = this._fit;
    out.x = designX * f.scale + f.offsetX;
    out.y = (this.designHeight - designY) * f.scale + f.offsetY;
    return out;
  }

  /** True when a screen point lies inside the letterboxed design rect. */
  containsScreenPoint(screenX: number, screenY: number): boolean {
    const f = this._fit;
    return (
      screenX >= f.offsetX &&
      screenX <= f.offsetX + f.viewWidth &&
      screenY >= f.offsetY &&
      screenY <= f.offsetY + f.viewHeight
    );
  }
}
