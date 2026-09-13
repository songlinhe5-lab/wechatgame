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
  Label,
  Node,
  UITransform,
} from 'cc';

import { App } from '../../compose/app';
import type { Game } from '../../core/game/game';
import { CocosRenderModelRenderer } from './cocos-renderer';
import { CocosInputBridge } from './input-bridge';
import { CocosLoopBridge } from './loop-bridge';
import { PooledLabelSource } from './label-pool';
import { detectPlatform } from '../../platform/index';

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
    // Must run AFTER the loop starts: CocosLoopBridge.start() calls App.start(),
    // which re-fits the viewport to platform.getScreenSize(). Doing this any
    // earlier gets silently overwritten (observed 2026-09-13).
    this._fitToGameCanvas();
    if (!this._resizeBound) {
      const target = (globalThis as { addEventListener?: (t: string, l: () => void) => void })
        .addEventListener;
      if (target) {
        target.call(globalThis, 'resize', this._onWindowResize);
        this._resizeBound = true;
      }
    }

  /**
   * Align the framework screen space with `EventTouch.getLocation()`.
   *
   * getLocation() reports CSS px **relative to the game canvas element**,
   * while the auto-detected Web platform reports the whole window — on the
   * editor preview the canvas sits offset inside the page, so every input x/y
   * was off by the canvas offset (observed 2026-09-13: click at page x=600
   * delivered raw x=335). Resizing the viewport to the canvas element makes
   * both spaces agree. On WeChat the canvas is fullscreen, so this is a no-op.
   */
  private _fitToGameCanvas(): void {
    if (!this._app) return;
    const canvas = (cc.game as unknown as { canvas?: { clientWidth: number; clientHeight: number } })
      .canvas;
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

  private _bindInput(): void {
    if (!this._app) return;
    // No mapPoint: RawPointerInput is screen CSS px (top-left origin) and
    // getLocation() already delivers exactly that. Viewport.screenToDesign
    // owns the screen→design conversion (incl. the y flip) — flipping y here
    // too would cancel it out and invert the y axis (fixed 2026-09-13).
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
      (e: CocosTouchEvent) => bridge.onTouchStart(readTouch(e, this.node)),
      this,
    );
    host.on(
      'touch-move',
      (e: CocosTouchEvent) => bridge.onTouchMove(readTouch(e, this.node)),
      this,
    );
    host.on(
      'touch-end',
      (e: CocosTouchEvent) => bridge.onTouchEnd(readTouch(e, this.node)),
      this,
    );
    host.on(
      'touch-cancel',
      (e: CocosTouchEvent) => bridge.onTouchCancel(readTouch(e, this.node)),
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

/**
 * Normalise a Cocos touch event into the framework's raw pointer shape.
 *
 * `getLocation()` returns screen CSS px with a top-left origin — exactly the
 * `RawPointerInput` contract. Do NOT use `getUILocation()`: it returns UI
 * space (bottom-left, Canvas-relative units) whose mapping depends on the
 * host Canvas configuration. Empirically confirmed in 3.8.8 preview
 * (2026-09-13): paddle x tracked getLocation coordinates exactly.
 */
function readTouch(e: CocosTouchEvent, _node: Node): { id: number; x: number; y: number } {
  const id = e.getID ? e.getID() : 0;
  const p = e.getLocation ? e.getLocation() : { x: 0, y: 0 };
  return { id, x: p.x, y: p.y };
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
    setAlign: (_align: 'left' | 'center' | 'right') => {
      // ⚠ Enum mapping (Label.HorizontalAlign) to be confirmed.
    },
    setVisible: (visible: boolean) => {
      label.node.active = visible;
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
