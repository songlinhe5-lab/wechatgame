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

import { App } from '../../compose/app.js';
import type { Game } from '../../core/game/game.js';
import { CocosRenderModelRenderer } from './cocos-renderer.js';
import { CocosInputBridge } from './input-bridge.js';
import { CocosLoopBridge } from './loop-bridge.js';
import { PooledLabelSource } from './label-pool.js';
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

  /** Subclasses / games override this to supply their Game implementation. */
  protected createGame(): Game {
    throw new Error('Bootstrap.createGame() must be overridden by the game project');
  }

  start(): void {
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
  }

  /** ⚠ Called by the engine when the component's node is destroyed. */
  onDestroy(): void {
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
    const bridge = new CocosInputBridge(this._app.input, {
      now: () => Date.now(),
      // ⚠ Cocos `getUILocation()` uses a bottom-left origin; verify and adjust.
      mapPoint: (x, y) => ({ x, y: DESIGN_HEIGHT - y }),
    });
    this._bridge = bridge;

    // ⚠ Event type constants: Node.EventType.TOUCH_START etc. Verify names.
    this.node.on(
      'touch-start',
      (e: CocosTouchEvent) => bridge.onTouchStart(readTouch(e, this.node)),
      this,
    );
    this.node.on(
      'touch-move',
      (e: CocosTouchEvent) => bridge.onTouchMove(readTouch(e, this.node)),
      this,
    );
    this.node.on(
      'touch-end',
      (e: CocosTouchEvent) => bridge.onTouchEnd(readTouch(e, this.node)),
      this,
    );
    this.node.on(
      'touch-cancel',
      (e: CocosTouchEvent) => bridge.onTouchCancel(readTouch(e, this.node)),
      this,
    );
  }
}

/** ⚠ Minimal structural view of `cc.EventTouch`; verify accessor names. */
interface CocosTouchEvent {
  getID?(): number;
  getUILocation?(): { x: number; y: number };
  getLocation?(): { x: number; y: number };
  getDelta?(): { x: number; y: number };
}

/** ⚠ Normalise a Cocos touch event into the framework's raw pointer shape. */
function readTouch(e: CocosTouchEvent, _node: Node): { id: number; x: number; y: number } {
  const id = e.getID ? e.getID() : 0;
  const p = e.getUILocation ? e.getUILocation() : e.getLocation ? e.getLocation() : { x: 0, y: 0 };
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
