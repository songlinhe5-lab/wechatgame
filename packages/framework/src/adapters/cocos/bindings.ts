/**
 * ============================================================================
 *  UNVERIFIED — requires Cocos Creator 3.8 editor to compile and run.
 * ============================================================================
 *
 * This is the ONLY file in the framework that imports `cc`. It is excluded from
 * the Node `tsc --noEmit` run (see packages/framework/tsconfig.json `exclude`)
 * and is never imported by tests, because the `cc` module only exists inside a
 * Cocos Creator project.
 *
 * Every call below is marked ⚠ where the exact API name/signature could not be
 * confirmed without the editor. See
 * docs/engine-reference/cocos/VERSION.md → "Knowledge gaps / to verify".
 *
 * USAGE (in a Cocos game project):
 *   1. Add `Bootstrap.ts` under `assets/scripts/`.
 *   2. Create an empty scene, add ONE node, attach `Bootstrap` to it.
 *   3. That is the entire scene — every other node is built here from code
 *      (see ADR-0003: empty scene + code-driven construction).
 */

import {
  _decorator,
  Color,
  Component,
  Graphics,
  HorizontalTextAlignment,
  Label,
  Node,
  UITransform,
  // WXG-T-104：`screen.devicePixelRatio` 是输入源（`pal/input`）同引擎同源的 DPR，
  // 归一化必须用它，不要自己复刻 `min(dpr, 2)` 的封顶规则。
  screen,
} from 'cc';

import { App } from '../../compose/app.js';
import type { Game } from '../../core/game/game.js';
import { CocosRenderModelRenderer } from './cocos-renderer.js';
import { CocosInputBridge } from './input-bridge.js';
import { CocosLoopBridge } from './loop-bridge.js';
import { PooledLabelSource } from './label-pool.js';
import type { CocosTouchSpace, CocosTouchSpaceWx } from './touch-normalize.js';
import { normalizeCocosTouch, normalizeCocosTouchWx } from './touch-normalize.js';
import { detectPlatform } from '../../platform/index.js';

const { ccclass, property } = _decorator;

/** Design resolution — keep in sync with the platform adapter config. */
const DESIGN_WIDTH = 750;
const DESIGN_HEIGHT = 1334;

@ccclass('Bootstrap')
export class Bootstrap extends Component {
  /** ⚠ Injected by the editor scene; assigns the concrete game implementation. */
  @property
  public autoStart = true;

  private _app: App | null = null;
  private _loop: CocosLoopBridge | null = null;
  private _graphics: Graphics | null = null;
  private _renderer: CocosRenderModelRenderer | null = null;
  private _bridge: CocosInputBridge | null = null;
  private _labels: PooledLabelSource | null = null;
  private _resizeBound = false;

  /** Bound once in `launch()`; re-fits the viewport when the page resizes. */
  private readonly _onWindowResize = (): void => this._fitToGameCanvas();

  /** Subclasses / games override this to supply their Game implementation. */
  protected createGame(): Game {
    throw new Error('Bootstrap.createGame() must be overridden by the game project');
  }

  start(): void {
    // The renderer converts design space (bottom-left origin) to the canvas
    // centre by subtracting designWidth/2, designHeight/2. That maths assumes
    // THIS node sits exactly at the Canvas centre — i.e. position (0,0) for a
    // default 3.x Canvas. Any other offset double-shifts the whole scene
    // (observed 2026-09-13: bricks clipped to the bottom-left).
    const p = this.node.position;
    if (Math.abs(p.x) > 0.5 || Math.abs(p.y) > 0.5) {
      console.warn(
        `[Bootstrap] node position (${p.x}, ${p.y}) is not (0, 0). ` +
        'The renderer assumes the Bootstrap node sits at the Canvas centre. ' +
        'Reset Position to (0, 0, 0) in the Inspector or the scene will render offset.',
      );
    }
    this._buildGraph();
    if (this.autoStart) this.launch(this.createGame());
  }

  launch(game: Game): void {
    const app = new App({
      game,
      platform: detectPlatform(),
      designWidth: DESIGN_WIDTH,
      designHeight: DESIGN_HEIGHT,
    });

    app.onRender = (model) => {
      this._renderer?.draw(model);
    };

    this._app = app;
    this._bindRenderer();
    this._bindInput();
    this._loop = new CocosLoopBridge(app, this);
    this._loop.start();
    // Must run AFTER the loop starts: CocosLoopBridge.start() calls
    // App.startHostDriven() (WXG-T-122), which re-fits the viewport to
    // platform.getScreenSize(). Doing this any earlier gets silently
    // overwritten (observed 2026-09-13).
    this._fitToGameCanvas();
    if (!this._resizeBound) {
      const target = (globalThis as { addEventListener?: (t: string, l: () => void) => void })
        .addEventListener;
      if (target) {
        target.call(globalThis, 'resize', this._onWindowResize);
        this._resizeBound = true;
      }
    }
  }

  /**
   * Align the framework screen space with `EventTouch.getLocation()`.
   *
   * getLocation() is **canvas-relative** but in *device* px (`× dpr`), not CSS
   * px — corrected 2026-09-15 (WXG-T-104): the old text claimed CSS px, which
   * is one half of the defect (the other half being the bottom-left origin).
   * The canvas-relative part is still true and is why this matters: the
   * auto-detected Web platform reports the whole window, so on the editor
   * preview the canvas sits offset inside the page and every input x/y was off
   * by the canvas offset (observed 2026-09-13: click at page x=600 delivered
   * raw x=335). Resizing the viewport to the canvas element makes both spaces
   * agree; the device-px part is undone in `readTouch()` (÷ dpr).
   * On WeChat the canvas is fullscreen, so this is a no-op.
   */
  private _fitToGameCanvas(): void {
    if (!this._app) return;
    // `cc.game.canvas` is typed inconsistently across editor-generated
    // declarations, so read the element from the DOM instead. WeChat has no
    // `document` — there the canvas is fullscreen and the platform-reported
    // screen size is already correct, so this is a no-op.
    const doc = (globalThis as {
      document?: { querySelector(s: string): { clientWidth: number; clientHeight: number } | null };
    }).document;
    const canvas = doc?.querySelector('#GameCanvas');
    if (!canvas || !canvas.clientWidth || !canvas.clientHeight) return;
    this._app.resize(canvas.clientWidth, canvas.clientHeight);
  }

  /** ⚠ Called by the engine when the component's node is destroyed. */
  onDestroy(): void {
    if (this._resizeBound) {
      const target = (globalThis as { removeEventListener?: (t: string, l: () => void) => void })
        .removeEventListener;
      target?.call(globalThis, 'resize', this._onWindowResize);
      this._resizeBound = false;
    }
    this._loop?.stop();
    this._app?.dispose();
    this._app = null;
    this._loop = null;
  }

  private _buildGraph(): void {
    const root = new Node('GameRoot');
    this.node.addChild(root);
    // ⚠ UITransform content size must match the design resolution for UI-space
    //   hit testing to line up with our design coordinates.
    const transform = root.addComponent(UITransform);
    transform.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);

    const graphicsNode = new Node('Graphics');
    root.addChild(graphicsNode);
    this._graphics = graphicsNode.addComponent(Graphics);

    const labelRoot = new Node('Labels');
    root.addChild(labelRoot);

    this._labels = new PooledLabelSource({
      initial: 8,
      create: () => {
        const node = new Node('Label');
        labelRoot.addChild(node);
        const label = node.addComponent(Label);
        label.string = '';
        return wrapLabel(label);
      },
      hide: (label) => label.setVisible(false),
    });

    // The renderer needs a Viewport. Reuse the App's viewport by constructing
    // the App first, then binding the renderer in `launch()`.
    // ⚠ For simplicity here we create the renderer lazily inside launch().
  }

  /** Called by `launch()` after the App (and its viewport) exist. */
  private _bindRenderer(): void {
    if (!this._app || !this._graphics || !this._labels) return;
    this._renderer = new CocosRenderModelRenderer(
      this._graphics,
      this._labels,
      {
        fromHex: (hex, alpha = 1) => {
          // ⚠ Colour.fromHEX exists in 3.8; parse fallback kept for safety.
          const c = parseHex(hex);
          return new Color(c.r, c.g, c.b, Math.round(alpha * 255));
        },
      },
      this._app.viewport,
    );
  }

  /**
   * 输入归一化所需的宿主量（WXG-T-104）。
   *
   * 高度取 `viewport.fit.screenHeight`：它由 `_fitToGameCanvas()` 用
   * `#GameCanvas.clientHeight`（**CSS px**）设置，与 `platform.getScreenSize()`
   * 同口径；微信侧无 `document` 时保持平台屏幕尺寸（同为 CSS px）。
   * DPR 取引擎自己的 `screen.devicePixelRatio`（web 封顶 2、小游戏不封顶），
   * 与 `pal/input` 的输入源同源 —— 不要在适配层复刻封顶规则。
   */
  private _touchSpace(): CocosTouchSpaceWx {
    const canvasHeightCss = this._app ? this._app.viewport.fit.screenHeight : 0;
    const dpr = engineDpr();
    // WXG-T-129：微信宿主需 `wx.getWindowInfo().windowHeight`（逻辑 px）参与引擎
    // 混合式坐标的逆变换；非微信环境填 canvasHeightCss（占位，web 分支不读它）。
    const wxGlobal = (globalThis as { wx?: { getWindowInfo?: () => { windowHeight: number } } }).wx;
    const windowHeight = wxGlobal?.getWindowInfo?.().windowHeight ?? canvasHeightCss;
    return { canvasHeightCss, dpr, windowHeight };
  }

  private _bindInput(): void {
    if (!this._app) return;
    // No mapPoint: the normalisation lives in `normalizeCocosTouch()` (a pure,
    // Node-testable function) so that the coordinate contract can be *tested*
    // instead of asserted in a comment.
    //
    // getLocation() is **canvas-relative · device px · BOTTOM-LEFT origin**
    // (measured 2026-09-15, Cocos 3.8.8 web-mobile), while `RawPointerInput`
    // wants **screen CSS px · top-left origin** ⇒ `readTouch()` must both
    // flip y and divide by dpr. The previous comment claimed the opposite
    // ("getLocation() already delivers top-left CSS px") — that was wrong and
    // is the root cause of defect C1; see ADR-0011 §1.1 (corrected).
    const bridge = new CocosInputBridge(this._app.input, {
      now: () => Date.now(),
    });
    this._bridge = bridge;

    // Touch listeners only fire when touch-start lands inside the listening
    // node's UITransform rect. `this.node` is the 750×1334 design rect, which
    // leaves the letterbox bands dead on wide screens (observed 2026-09-13 in
    // the desktop preview). Prefer the Canvas node — its UITransform always
    // covers the full visible rect — and fall back to this.node.
    const canvasNode = this.node.scene.getChildByName('Canvas');
    const host = canvasNode ?? this.node;

    // ⚠ Event type constants: Node.EventType.TOUCH_START etc. Verified in
    // 3.8.8: the dash form ('touch-start') is correct.
    host.on(
      'touch-start',
      (e: CocosTouchEvent) => bridge.onTouchStart(readTouch(e, this._touchSpace())),
      this,
    );
    host.on(
      'touch-move',
      (e: CocosTouchEvent) => bridge.onTouchMove(readTouch(e, this._touchSpace())),
      this,
    );
    host.on(
      'touch-end',
      (e: CocosTouchEvent) => bridge.onTouchEnd(readTouch(e, this._touchSpace())),
      this,
    );
    host.on(
      'touch-cancel',
      (e: CocosTouchEvent) => bridge.onTouchCancel(readTouch(e, this._touchSpace())),
      this,
    );
  }
}

/** ⚠ Minimal structural view of `cc.EventTouch`; verify accessor names. */
interface CocosTouchEvent {
  getID?(): number;
  getLocation?(): { x: number; y: number };
  getDelta?(): { x: number; y: number };
}

let _dprWarned = false;

/**
 * 引擎生效的 DPR（`pal/input` 的输入源用的就是 `screenAdapter.devicePixelRatio`：
 * web = `min(window.devicePixelRatio, 2)`、小游戏 = `getWindowInfo().pixelRatio`）。
 *
 * 必须与输入源**同源**：用平台层那个未封顶的 `devicePixelRatio` 会在 dpr=3 的
 * 机器上留下 1.5 倍缩放误差。取不到有效值时退化为 1（只翻 y，不缩放）并 **warn
 * 一次** —— 静默错缩放比 warn 更难查。
 */
function engineDpr(): number {
  const dpr = screen.devicePixelRatio;
  if (Number.isFinite(dpr) && dpr > 0) return dpr;
  if (!_dprWarned) {
    _dprWarned = true;
    console.warn(
      `[Bootstrap] screen.devicePixelRatio = ${String(dpr)} 不可用于输入归一化，` +
      '本次按 1 处理 —— 高 DPR 设备上点击会整体放大（WXG-T-104）。',
    );
  }
  return 1;
}

/**
 * Normalise a Cocos touch event into the framework's raw pointer shape.
 *
 * `getLocation()` is **canvas-relative · device px · bottom-left origin**
 * (measured 2026-09-15 on a real web-mobile build; the old claim that it was
 * top-left CSS px is false and is defect C1, WXG-T-104). `RawPointerInput`
 * wants **screen CSS px · top-left origin**, so the value is normalised by
 * {@link normalizeCocosTouch} (÷ dpr, then flip y). `Viewport.screenToDesign`
 * still owns screen→design and its own y flip — flipping here is required, not
 * a double flip.
 *
 * Do NOT use `getUILocation()`: it is the engine's FIXED_HEIGHT UI space
 * (bottom-left, design units, dpr-independent) which does **not** subtract the
 * letterbox offset, so it is not the framework's design space either.
 */
function readTouch(
  e: CocosTouchEvent,
  space: CocosTouchSpaceWx,
): { id: number; x: number; y: number } {
  const id = e.getID ? e.getID() : 0;
  const p = e.getLocation ? e.getLocation() : { x: 0, y: 0 };
  // WXG-T-129：微信宿主的引擎坐标是量纲混合态（见 touch-normalize.ts wx 分支注释），
  // 须走 wx 逆变换；web 分支行为一字不变。以 wx 全局存在性判定宿主（构建产物运行
  // 在微信环境下 `wx` 恒存在，且该判定与 pal/minigame 的 WECHAT 常量同源可靠）。
  const isWx = typeof (globalThis as { wx?: unknown }).wx !== 'undefined';
  const q = isWx ? normalizeCocosTouchWx(p, space) : normalizeCocosTouch(p, space);
  return { id, x: q.x, y: q.y };
}

/** Wrap a `cc.Label` in the structural `CocosLabelLike` interface. */
function wrapLabel(label: Label) {
  return {
    setText: (text: string) => {
      label.string = text;
    },
    setPosition: (x: number, y: number) => {
      label.node.setPosition(x, y);
    },
    setFontSize: (size: number) => {
      label.fontSize = size;
    },
    setColor: (c: { r: number; g: number; b: number; a: number }) => {
      // ⚠ `Label.color` exists; may need `label.color = new Color(...)`.
      label.color = new Color(c.r, c.g, c.b, c.a);
    },
    setAlign: (align: 'left' | 'center' | 'right') => {
      // [G3 · WXG-T-077 编辑器半落码] 接入 cc.Label 真实对齐枚举
      // （HorizontalTextAlignment，T-050 已纠正枚举真名）。未知值回退 CENTER。
      const mapped =
        HorizontalTextAlignment[align.toUpperCase()] ?? HorizontalTextAlignment.CENTER;
      label.horizontalAlign = mapped;
    },
    setVisible: (visible: boolean) => {
      label.node.active = visible;
    },
    measureWidth: (text: string, fontSize: number) => {
      // [G3 · WXG-T-077 编辑器半落码] 调用序保证 renderer 已先 setFontSize/setText
      // （cocos-renderer.ts :165-166），此处回读 UITransform.width 即真实文本宽
      // （T-050 判例：以引擎实测为准）。返回 0/负值时 _measureTextWidth 会自动
      // 退回 FALLBACK_CHAR_WIDTH_RATIO 估算，故 UITransform 缺失无需额外防御。
      void text;
      void fontSize;
      label.updateRenderData(true);
      const ut = label.node.getComponent(UITransform);
      return ut ? ut.width : 0;
    },
  };
}

/** Parse `#rgb` / `#rrggbb` into 0–255 channels. */
function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
