/**
 * SPIKE（WXG-T-247 / ADR-0030 S0·S2）：**三臂载体同宿主性能取证**。
 *
 * 三臂（同一宿主 = 真实 Cocos web-mobile 产物 + 真实 GPU，⛔ 不是模型推演）：
 *
 * | 臂   | 名字     | 珠子画法 | 面板/文字 | 取数点 |
 * |------|----------|----------|-----------|--------|
 * | `V`  | 矢量臂（今日生产） | `cc.Graphics` 每帧全量重放 | `cc.Graphics` + `Label` 池 | `drawMs` = 重放本身 |
 * | `C`  | **丙′** 离屏 canvas + 上传 | 同源 `Canvas2DRenderer` 画进离屏 canvas → `Texture2D.uploadData` → **一枚满幅 quad** | 同上（**整帧进 canvas**，Label 池隐藏） | `drawMs` = canvas 重放；`uploadMs` = 单列 |
 * | `A`  | **甲′** 按色图集 + Sprite 池 | 一张 8×8×128² 图集（CPU 预合成 = 与 harness **同一份** `TintSpriteCache`）+ 逐珠 `Sprite` 节点 | `cc.Graphics`（**只换珠面**，在册 甲′ 的定义） | `drawMs` = 节点改写；批处理由引擎做 |
 *
 * ⚠ **试错件**：URL 带 `bench=1` 才生效，默认零开销；⛔ 不进玩法状态、⛔ 不进 framework 镜像
 *   （`framework:sync` 只覆盖 `scripts/framework` 与 `scripts/game`，本目录不在面内）。
 * ⚠ **档位 = `[E]` 桌面 web-mobile**：真引擎真 GPU，但**不是低端机** ⇒ `ADR-0022 D2`
 *   的「≥2 台低端同向」**不因本组读数而达线**（ADR-0030 §5.0 明令）。
 * ⚠ 已知简化（spike 口径，如实登记）：`blit` 的 `alpha` 未接（现网珠面 blit 不带 alpha）；
 *   图集按「首次见到才合成 + 整张重传」，预热帧内完成 ⇒ 采样窗口内 `atlasUploads` 应为 0；
 *   甲′ 的 Sprite 节点插在 Graphics 之后 ⇒ HUD 面板若画在珠子**之上**（矢量臂的命令序）此处会盖不住。
 *
 * `[WXG-T-249]` **甲″ 收益上界档**（`?layers=beads` 或驱动 `--layers=full,beads`，仅对 `atlas` 臂有意义）：
 * `full` = 在册 甲′ 形态（珠面走 Sprite 池，非 blit 命令照旧每帧喂 `cc.Graphics` + `Label` 池）；
 * `beads` = **非珠层整体不提交**（`cc.Graphics` 组件停用 + `Label` 节点隐藏，只剩 Sprite 池）。
 * ⇒ `beads` 档**画面不完整**（底图/HUD 均消失），⛔ 不是可 shipped 形态；它的唯一用途 =
 * 给「静态底图烘一次 + UI 仅脏帧重放」的**合并收益设上界**，把在册 `dc 16` 拆成「矢量层 / 珠池」两份。
 */

import {
    Director, Node, Rect, Size, Sprite, SpriteFrame, Texture2D, UITransform,
    director, js, screen,
} from 'cc';

import { Canvas2DRenderer } from '../framework/adapters/canvas2d/canvas2d-renderer';
import { TintSpriteCache } from '../framework/adapters/canvas2d/tint-sprite-cache';
import { createTintBlitResolver } from '../framework/adapters/canvas2d/tint-blit-resolver';
import { MASK_CANONICAL_SIZE, MASK_SCHEMA_VERSION } from '../framework/core/bake/mask-spec';
import { tintFxBase } from '../framework/core/bake/tint-composite';
import { createWhitelistBeadTintRuntime, setBeadTintRuntime } from '../game/view/bead-render';

type AnyObj = Record<string, any>;

const ARM_NAMES = ['vector', 'canvas', 'atlas'] as const;
type ArmName = (typeof ARM_NAMES)[number];

/** 4 张定稿 mask 的逻辑 id（正本 = `bead-tint-mask.ts` 的 DEC-5 白名单）。 */
const MASK_IDS: readonly string[] = [
    `mask__bead__holed__v${MASK_SCHEMA_VERSION}`,
    `mask__bead__holeless__v${MASK_SCHEMA_VERSION}`,
    `mask__grid__holed__v${MASK_SCHEMA_VERSION}`,
    `mask__grid__holeless__v${MASK_SCHEMA_VERSION}`,
];
const MASK_FILE: Record<string, string> = {
    'mask__bead__holed': 'bead-hole-tint-128-mask.png',
    'mask__bead__holeless': 'bead-holeless-tint-128-mask.png',
    'mask__grid__holed': 'grid-hole-tint-128-mask.png',
    'mask__grid__holeless': 'grid-holeless-tint-128-mask.png',
};
const ATLAS_COLS = 8;
const ATLAS_ROWS = 8;

const search: string = (globalThis as AnyObj).location?.search ?? '';
const qp = (k: string): string | null =>
    new URLSearchParams(search).get(k);

function pct(sorted: number[], p: number): number {
    if (!sorted.length) return 0;
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

/**
 * `EXT_disjoint_timer_query_webgl2` 的读取常量：走 WebGL2 原生 query，
 * 因此 `QUERY_RESULT_AVAILABLE`(0x8867) / `QUERY_RESULT`(0x8866) 是核心枚举；
 * 旧版 WebGL1 扩展才把它们挂在 ext 对象上 ⇒ 两边都取。
 */
const AVAIL = 0x8867;
const RESULT = 0x8866;
/**
 * beginQuery/endQuery 的 target。⚠ 本宿主（Chromium + ANGLE Metal）实测：
 * `EXT_disjoint_timer_query_webgl2` 原型上只有
 * `[QUERY_COUNTER_BITS_EXT, TIME_ELAPSED_EXT, TIMESTAMP_EXT, GPU_DISJOINT_EXT, queryCounterEXT]`
 * ⇒ 目标名是 **`TIME_ELAPSED_EXT`**（写成 MDN 文档常见的 `TIME_RESULT_EXT` 会读为
 * undefined ⇒ beginQuery 报 INVALID_OPERATION 1282 / INVALID_ENUM 1280）。
 */
const TQ_TARGET = (ext: AnyObj): number | null =>
    ext.TIME_ELAPSED_EXT ?? ext.TIME_EXT ?? ext.TIME_RESULT_EXT ?? null;

/** 单臂一次采样的完整读数（Node 侧驱动直接 JSON 化落盘）。 */
interface CaseResult {
    arm: string;
    zoom: number;
    frames: number;
    cmdsPerFrame: number;
    blitsPerFrame: number;
    drawCalls: number;
    tris: number;
    drawMs: { p50: number; p95: number; max: number };
    frameMs: { p50: number; p95: number };
    gpuMs: { p50: number; p95: number; n: number } | null;
    uploadMs: { p50: number; p95: number; n: number } | null;
    uploadBytesPerFrame: number;
    atlasCells: number;
    atlasUploads: number;
    spriteNodes: number;
    tintSprites: number;
    filledCells: number;
    gpuMethod: string;
    /** 采样窗口内「渲染模型真的变了」的帧数（= 丙′ 脏帧门控理论上能省下多少上传）。*/
    modelChanges: number;
    /**
     * `[WXG-T-248]` 门控开着时，`onRender` 真的被调了几帧 ⇒ 与 `frames` 的差就是省下的重画。
     * （关档时恒等于 `frames`。）
     */
    drawnFrames: number;
    /** `[WXG-T-248]` 本组读数采于门控开(`true`)还是关(`false`)。 */
    gate: boolean;
    /** `[WXG-T-249]` 甲 臂的层形态：`full` = 在册 甲′；`beads` = 非珠层不提交（上界档，见文件头）。 */
    atlasLayers: string;
    /**
     * `[WXG-T-248]` 整帧 CPU（`App.tick` = 定步模拟 + 建模型 + 画）——门控只省得掉「画」，
     * 省不掉「建」，所以判收益必须看这一列，⛔ 不能只报 `drawMs`。
     */
    tickMs: { p50: number; p95: number; n: number };
    disturb: boolean;
}

class CarrierBench {
    private _boot: AnyObj | null = null;
    private _app: AnyObj | null = null;
    private _origOnRender: ((model: AnyObj) => void) | null = null;
    private _gfxComp: AnyObj | null = null;
    private _labelsNode: Node | null = null;
    private _root: Node | null = null;

    private _arm: ArmName = 'vector';
    private _zoom = 1;
    /** `[WXG-T-249]` `beads` ⇒ 甲 臂只提交珠池，非珠层整体停用。 */
    private _atlasLayers: 'full' | 'beads' = 'full';

    // 丙′ 资产
    private _canvas: HTMLCanvasElement | null = null;
    private _canvasCtx: AnyObj = null;
    private _canvasTex: Texture2D | null = null;
    private _canvasFrame: SpriteFrame | null = null;
    private _canvasNode: Node | null = null;
    private _c2d: Canvas2DRenderer | null = null;
    private _canvasScale = 1;

    // 甲′ 资产
    private _atlasCanvas: HTMLCanvasElement | null = null;
    private _atlasCtx: AnyObj = null;
    private _atlasTex: Texture2D | null = null;
    private _atlasNode: Node | null = null;
    private _cells = new Map<string, SpriteFrame>();
    private _pool: Sprite[] = [];
    private _poolUsed = 0;

    // 共用：tint 装配（与 harness 同一份代码 = DEC-3 同源）
    private _masks = new Map<string, object>();
    private _tintCache: TintSpriteCache | null = null;
    private _resolver: ReturnType<typeof createTintBlitResolver> | null = null;

    // 采样
    private _drawMs: number[] = [];
    private _frameMs: number[] = [];
    private _tickMs: number[] = [];
    private _drawnFrames = 0;
    private _origTick: ((dt: number) => number) | null = null;
    private _gpuMs: number[] = [];
    private _uploadMs: number[] = [];
    private _lastDrawCalls = 0;
    private _lastTris = 0;
    private _lastCmds = 0;
    private _lastBlits = 0;
    private _uploads = 0;
    private _atlasUploads = 0;
    private _frameTick = 0;
    private _lastFrameT = 0;
    private _probeGpu = false;
    private _disturb = false;
    private _modelSig = '';
    private _modelChanges = 0;
    private _gl: AnyObj = null;
    /** GPU 真计时：`EXT_disjoint_timer_query_webgl2`（本机实测可用），拿不到则退 `gl.finish()`。
     *  ⚠ `finish()` 在本宿主读为 ≈ 0（无判别力），所以这不是等价的降级。*/
    private _tq: AnyObj = null;
    private _tqTarget: number | null = null;
    private _query: AnyObj = null;
    private _pending: AnyObj[] = [];
    private _gpuMethod = 'none';
    private _sampling = false;

    // ── 生命周期 ────────────────────────────────────────────────────────────

    attach(boot: AnyObj): void {
        this._boot = boot;
        this._app = boot._app;
        this._root = boot._root as Node;
        this._gfxComp = boot._graphics;
        this._labelsNode = this._root.getChildByName('Labels');
        this._origOnRender = this._app.onRender as (m: AnyObj) => void;
        // `[WXG-T-248]` 整帧 CPU 采样：`CocosLoopBridge` 每次调都现取 `app.tick` 属性
        // ⇒ 在这里换掉它就能包住「定步 + 建模型 + 画」的全程。
        const app = this._app as AnyObj;
        this._origTick = (app.tick as (dt: number) => number).bind(app);
        app.tick = (dt: number): number => {
            const t0 = performance.now();
            const steps = this._origTick!(dt);
            if (this._sampling) this._tickMs.push(performance.now() - t0);
            return steps;
        };
        if (qp('gate') === 'off') this.setGate(false);
        if (qp('layers') === 'beads') this._atlasLayers = 'beads';
        this._gl = this._findGl();
        director.on(Director.EVENT_AFTER_DRAW, this._onAfterDraw, this);
        (globalThis as AnyObj).__BENCH = this._api();
        console.log(`[BENCH] attached arm=${this._arm}`);
    }

    private _findGl(): AnyObj {
        const cvs = (globalThis as AnyObj).document?.querySelector('#GameCanvas');
        if (!cvs) return null;
        const gl = cvs.getContext('webgl2') || cvs.getContext('webgl') || null;
        if (gl) {
            const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
                || gl.getExtension('EXT_disjoint_timer_query');
            const target = ext ? TQ_TARGET(ext) : null;
            if (ext && target !== null && typeof gl.createQuery === 'function') {
                this._tq = ext;
                this._tqTarget = target;
                this._gpuMethod = 'timer';
            } else {
                this._gpuMethod = gl.finish ? 'finish' : 'none';
            }
        }
        return gl;
    }

    /** 宿主事实（含 S0 必采项 `screen.devicePixelRatio` 实读）。 */
    host(): AnyObj {
        const app = this._app;
        const vp = app ? app.viewport : null;
        const fit = vp ? vp.fit : null;
        const cvs = (globalThis as AnyObj).document?.querySelector('#GameCanvas');
        const cssW = (globalThis as AnyObj).innerWidth ?? 0;
        const cssH = (globalThis as AnyObj).innerHeight ?? 0;
        let gpu = 'n/a';
        if (this._gl) {
            const d = this._gl.getExtension('WEBGL_debug_renderer_info');
            gpu = d ? String(this._gl.getParameter(d.UNMASKED_RENDERER_WEBGL)).slice(0, 64) : 'no-ext';
        }
        return {
            engine: 'cocos-web-mobile',
            ccScreenDevicePixelRatio: (screen as AnyObj).devicePixelRatio,
            domDevicePixelRatio: (globalThis as AnyObj).devicePixelRatio,
            canvasBackbuffer: cvs ? [cvs.width, cvs.height] : null,
            cssViewport: [cssW, cssH],
            design: vp ? [vp.designWidth, vp.designHeight] : null,
            fitScale: fit ? fit.scale : null,
            gpuRenderer: gpu,
            gpuIsSoftware: /swiftshader|software|llvm/i.test(gpu),
            gpuProbeMethod: this._gpuMethod,
            webgl2: !!(globalThis as AnyObj).WebGL2RenderingContext
                && this._gl instanceof (globalThis as AnyObj).WebGL2RenderingContext,
        };
    }

    // ── 装配（mask → tint 运行时 → 三臂资产）────────────────────────────────

    async ensureMasks(): Promise<number> {
        if (this._masks.size > 0) return this._masks.size;
        const base = qp('maskbase') ?? '/mask-assets/';
        await Promise.all(MASK_IDS.map(async (id) => {
            const file = MASK_FILE[id.replace(/__v\d+$/, '')];
            const img = await new Promise<object>((resolve, reject) => {
                const el = (globalThis as AnyObj).document.createElement('img');
                el.onload = () => resolve(el);
                el.onerror = () => reject(new Error(`mask load failed: ${base}${file}`));
                el.src = `${base}${file}`;
            }).catch((e) => { console.warn('[BENCH]', String(e)); return undefined; });
            if (img) this._masks.set(id, img);
        }));
        const maskSource = { get: (id: string): object | undefined => this._masks.get(id) };
        this._tintCache = new TintSpriteCache(
            {
                createCanvas: (w: number, h: number) => {
                    const c = (globalThis as AnyObj).document.createElement('canvas');
                    c.width = w; c.height = h;
                    return c as any;
                },
            },
            maskSource,
            {
                createImageData: (w: number, h: number) => new ((globalThis as AnyObj).ImageData)(w, h),
                flipY: false,
            },
        );
        this._resolver = createTintBlitResolver(this._tintCache, maskSource as any);
        return this._masks.size;
    }

    private _ensureCanvasAssets(): void {
        if (this._canvasNode) return;
        const app = this._app!;
        const fit = app.viewport.fit;
        const cvs = (globalThis as AnyObj).document.querySelector('#GameCanvas');
        // 离屏 canvas = 与屏幕上画布同尺寸（backbuffer 设备像素），dpr 由 pixelRatio 吸收。
        this._canvasScale = cvs.clientWidth ? cvs.width / cvs.clientWidth : 1;
        const w = Math.max(2, Math.round(fit.screenWidth * this._canvasScale));
        const h = Math.max(2, Math.round(fit.screenHeight * this._canvasScale));
        const c = (globalThis as AnyObj).document.createElement('canvas');
        c.width = w; c.height = h;
        this._canvas = c;
        this._canvasCtx = c.getContext('2d');
        this._c2d = new Canvas2DRenderer(this._canvasCtx as any, app.viewport, {
            pixelRatio: this._canvasScale,
            blitResolver: this._resolver!,
        });
        const tex = new Texture2D();
        tex.reset({ width: w, height: h });
        tex.uploadData(c);
        this._canvasTex = tex;
        const sf = new SpriteFrame();
        sf.reset({ texture: tex, originalSize: new Size(w, h), rect: new Rect(0, 0, w, h) });
        sf.packable = false;
        this._canvasFrame = sf;
        const n = new Node('BenchFrame');
        this._root!.addChild(n);
        const ut = n.addComponent(UITransform);
        // 满幅：屏幕 CSS 尺寸换算回设计空间（fit.scale 是 design→css 的统一缩放）。
        ut.setContentSize(fit.screenWidth / fit.scale, fit.screenHeight / fit.scale);
        const sp = n.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.type = Sprite.Type.SIMPLE;
        sp.spriteFrame = sf;
        this._canvasNode = n;
        console.log(`[BENCH] canvas arm ready: ${w}x${h} backbuffer (scale=${this._canvasScale.toFixed(2)})`);
    }

    private _ensureAtlasAssets(): void {
        if (this._atlasNode) return;
        const c = (globalThis as AnyObj).document.createElement('canvas');
        c.width = ATLAS_COLS * MASK_CANONICAL_SIZE;
        c.height = ATLAS_ROWS * MASK_CANONICAL_SIZE;
        this._atlasCanvas = c;
        this._atlasCtx = c.getContext('2d');
        const tex = new Texture2D();
        tex.reset({ width: c.width, height: c.height });
        tex.uploadData(c);
        this._atlasTex = tex;
        const n = new Node('BenchAtlas');
        this._root!.addChild(n);
        this._atlasNode = n;
    }

    /** `maskId|base` → 图集格（首见合成 + 整张重传；⚠ 只在预热期发生）。 */
    private _cell(key: string, maskId: string, base: string): SpriteFrame | undefined {
        let sf = this._cells.get(key);
        if (sf) return sf;
        if (this._cells.size >= ATLAS_COLS * ATLAS_ROWS) return undefined;
        const sprite = this._tintCache!.get(maskId, base) as HTMLCanvasElement | undefined;
        if (!sprite) return undefined;
        const idx = this._cells.size;
        const col = idx % ATLAS_COLS;
        const row = Math.floor(idx / ATLAS_COLS);
        this._atlasCtx.drawImage(sprite, col * MASK_CANONICAL_SIZE, row * MASK_CANONICAL_SIZE);
        this._atlasTex!.uploadData(this._atlasCanvas);
        this._atlasUploads++;
        sf = new SpriteFrame();
        sf.reset({
            texture: this._atlasTex,
            originalSize: new Size(MASK_CANONICAL_SIZE, MASK_CANONICAL_SIZE),
            rect: new Rect(col * MASK_CANONICAL_SIZE, row * MASK_CANONICAL_SIZE, MASK_CANONICAL_SIZE, MASK_CANONICAL_SIZE),
        });
        sf.packable = false;
        this._cells.set(key, sf);
        return sf;
    }

    private _poolSprite(): Sprite {
        let sp = this._pool[this._poolUsed];
        if (!sp) {
            const n = new Node(`B${this._pool.length}`);
            this._atlasNode!.addChild(n);
            n.addComponent(UITransform);
            sp = n.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.type = Sprite.Type.SIMPLE;
            this._pool.push(sp);
        }
        this._poolUsed++;
        return sp;
    }

    // ── 臂切换 ──────────────────────────────────────────────────────────────

    async setArm(arm: ArmName): Promise<void> {
        // ⚠ 先备资产、**最后**才改 `this._arm`：中途有 `await`（载 mask 图），
        //   提前改会在那个窗口里拿空 `_c2d` 去画（实测报 `null.draw`）。
        // tint 运行时只在 C/A 注入：V 必须 = 今日生产模型（12 命令/珠），否则「现状」被改掉。
        if (arm === 'vector') {
            setBeadTintRuntime(undefined);
        } else {
            await this.ensureMasks();
            if (this._masks.size < MASK_IDS.length) {
                console.warn(`[BENCH] mask 只有 ${this._masks.size}/${MASK_IDS.length} 张 ⇒ C/A 读数失真`);
            }
            const has = (id: string) => (this._masks.has(id) ? id : undefined);
            setBeadTintRuntime(createWhitelistBeadTintRuntime(has));
        }
        if (arm === 'canvas') this._ensureCanvasAssets();
        if (arm === 'atlas') this._ensureAtlasAssets();
        this._arm = arm;

        // 场景侧显隐（全在 `_syncLayers`，⛔ 不在这里再补一刀）
        this._syncLayers();
        this._app!.onRender = (m: AnyObj) => { this._draw(m); };
        console.log(`[BENCH] arm=${arm}`);
    }

    /** 进盘：主菜单默认停 `menu` 屏 ⇒ 盘面读数全 0。`startGame()` 扣 1 心（bench 可接受）。 */
    enterPlay(): string {
        const g = this._app?.game as AnyObj;
        if (!g) return 'no-game';
        if (g.screen !== 'play') {
            const ok = g.startGame ? g.startGame() : false;
            if (!ok) { g._screen = 'play'; g.play?.goToLevel?.(0); }
        }
        return String(g.screen);
    }

    /**
     * `app.game` = **BeadsShell**（`screen`/`startGame` 在它身上）；
     * 盘面真身是 `shell.play` = **BeadsGame**（`snapshot`/`setZoomForDebug`）。
     * 取错一层就是本次冒烟 `filled 0 / zoom 不生效` 的真因。
     */
    private _play(): AnyObj | null {
        return (this._app?.game as AnyObj)?.play ?? null;
    }

    phase(): AnyObj {
        const g = this._app?.game as AnyObj;
        return { screen: String(g?.screen), filled: this._filled(), blits: this._lastBlits, cmds: this._lastCmds };
    }

    private _filled(): number {
        const snap = this._play()?.snapshot as AnyObj | undefined;
        let n = 0;
        if (snap?.cells) for (const c of snap.cells) if (!c.void && c.state === 'filled') n++;
        return n;
    }

    setZoom(z: number): boolean {
        this._zoom = z;
        const play = this._play();
        if (play?.setZoomForDebug) { play.setZoomForDebug(z); return true; }
        console.warn('[BENCH] setZoomForDebug 不存在 ⇒ zoom 矩阵退化为单点');
        return false;
    }

    /**
     * 场景侧显隐（`setArm` 与 `setAtlasLayers` **共用**，两处各写一遍必漂）。
     *
     * `[WXG-T-249]` `atlas` + `beads` ⇒ 必须**关组件**：`CocosRenderModelRenderer.draw()` 里才做
     * `g.clear()`，不喂命令只会让上一帧内容继续提交 ⇒ 读数不是上界而是「冻住的矢量层」。
     */
    private _syncLayers(): void {
        const arm = this._arm;
        const gfxOn = arm !== 'canvas' && !(arm === 'atlas' && this._atlasLayers === 'beads');
        if (this._gfxComp) (this._gfxComp as AnyObj).enabled = gfxOn;
        if (this._labelsNode) (this._labelsNode as AnyObj).active = gfxOn;
        if (this._canvasNode) (this._canvasNode as AnyObj).active = arm === 'canvas';
        if (this._atlasNode) (this._atlasNode as AnyObj).active = arm === 'atlas';
        if (arm !== 'atlas') {
            for (const s of this._pool) (s.node as AnyObj).active = false;
        }
    }

    /**
     * `[WXG-T-249]` 甲″ 上界档开关（与 `setGate` 同性质：⛔ 生产路径零调用方，只给取证面）。
     * @returns 生效后的层形态
     */
    setAtlasLayers(v: 'full' | 'beads'): string {
        this._atlasLayers = v === 'beads' ? 'beads' : 'full';
        this._syncLayers();
        return this._atlasLayers;
    }

    /**
     * `[WXG-T-248]` A/B 同一把尺：`App.dirtyGate` 是框架留的 kill switch，
     * 关档 = 逐帧重画（247 第七刀读数的口径），开档 = 干净帧不重画。
     * 翻它的只有本试错件（`?gate=off` 或驱动脚本调 `setGate`），⛔ 生产路径零调用方。
     */
    setGate(on: boolean): boolean {
        const app = this._app as AnyObj | null;
        if (!app) return false;
        app.dirtyGate = on;
        return Boolean(app.dirtyGate);
    }

    // ── 每帧 ────────────────────────────────────────────────────────────────

    private _draw(model: AnyObj): void {
        const t0 = performance.now();
        if (this._sampling) this._drawnFrames++;
        // 查询起点：放在载体工作**之前**，终点在 `EVENT_AFTER_DRAW`（引擎自己提交完）
        // ⇒ 该区间涵盖：载体 CPU 工作 + uploadData + 本帧全部 draw call 的 GPU 执行。
        if (this._probeGpu && this._tq && this._sampling && !this._query) {
            this._query = this._gl.createQuery();
            this._gl.beginQuery(this._tqTarget, this._query);
        }
        let blits = 0;
        for (const c of model.commands) if (c.kind === 'blit') blits++;
        this._lastCmds = model.commands.length;
        this._lastBlits = blits;

        if (this._arm === 'canvas') {
            this._c2d!.draw(model as never);
            const u0 = performance.now();
            this._canvasTex!.uploadData(this._canvas!);
            const u1 = performance.now();
            if (this._sampling) {
                this._uploadMs.push(u1 - u0);
                this._uploads++;
            }
        } else if (this._arm === 'vector') {
            // 现状：今日生产路径原样跑（只加计数，不改行为）。
            (this._boot._renderer as AnyObj).draw(model);
        } else {
            // 甲′：UI 仍走 Graphics（blit 被 Cocos 渲染器 warn-skip），珠面 → Sprite 池。
            // `[WXG-T-249]` `layers=beads` 时整段不跑（组件已在 `_syncLayers` 关掉）⇒ 读的是上界。
            if (this._atlasLayers === 'full') (this._boot._renderer as AnyObj).draw(model);
            this._poolUsed = 0;
            const ox = -(this._app.viewport.designWidth ?? 750) / 2;
            const oy = -(this._app.viewport.designHeight ?? 1334) / 2;
            for (const cmd of model.commands) {
                if (cmd.kind !== 'blit') continue;
                const base = tintFxBase(cmd.fx);
                if (base === undefined) continue;
                const sf = this._cell(cmd.textureId + '|' + base, cmd.textureId, base);
                if (sf === undefined) continue;
                const sp = this._poolSprite();
                if (!(sp.node as AnyObj).active) (sp.node as AnyObj).active = true;
                const ut = sp.node.getComponent(UITransform)!;
                ut.setContentSize(cmd.w, cmd.h);
                sp.spriteFrame = sf;
                sp.node.setPosition(cmd.x + cmd.w / 2 + ox, cmd.y + cmd.h / 2 + oy, 0);
            }
            for (let i = this._poolUsed; i < this._pool.length; i++) {
                if ((this._pool[i].node as AnyObj).active) (this._pool[i].node as AnyObj).active = false;
            }
        }
        const t1 = performance.now();
        if (this._sampling) this._drawMs.push(t1 - t0);
        // 脏帧门控的**上限**估计：模型与上一帧逐字相同 ⇒ 该帧连上传都可省。
        // ⚠ 放在计时**之后**，不污染 drawMs（本身要几 ms 的 stringify）。
        if (this._sampling) {
            const sig = JSON.stringify(model);
            if (sig !== this._modelSig) { this._modelChanges++; this._modelSig = sig; }
        }
    }

    private _onAfterDraw(): void {
        const now = performance.now();
        if (this._lastFrameT > 0 && this._sampling) this._frameMs.push(now - this._lastFrameT);
        this._lastFrameT = now;
        const dev = (director.root as unknown as AnyObj).device as AnyObj;
        this._lastDrawCalls = dev.numDrawCalls;
        this._lastTris = dev.numTris;
        this._frameTick++;
        if (!this._probeGpu || !this._gl) return;
        if (this._tq) {
            try {
                if (this._query) {
                    this._gl.endQuery(this._tqTarget);
                    this._pending.push(this._query);
                    this._query = null;
                }
                // 结果乱序就绪：只从队头收，未就绪则等下一帧（不堵渲染）。
                while (this._pending.length) {
                    const q = this._pending[0];
                    if (!this._gl.getQueryParameter(q, AVAIL)) break;
                    this._pending.shift();
                    if (!this._gl.getParameter(this._tq.GPU_DISJOINT_EXT)) {
                        this._gpuMs.push(this._gl.getQueryParameter(q, RESULT) / 1e6);
                    }
                }
            } catch (e) {
                // 探针不能拖垮渲染环；降级一次就说清楚。
                console.warn(`[BENCH] timer query 失败 ⇒ 本组无 GPU 档读数：${String(e)}`);
                this._tq = null; this._query = null; this._pending = [];
                this._gpuMethod = 'timer-failed';
            }
        } else if (this._sampling && this._frameTick % 4 === 0) {
            const g0 = performance.now();
            this._gl.finish();
            this._gpuMs.push(performance.now() - g0);
        }
    }

    private _resetSamples(): void {
        this._drawMs = []; this._frameMs = []; this._gpuMs = []; this._uploadMs = [];
        this._tickMs = []; this._drawnFrames = 0;
        this._uploads = 0; this._atlasUploads = this._cells.size ? this._atlasUploads : 0;
        // 上一臂可能残留一支未结束的查询：当场结束并丢掉引用，不把它计进本臂窗口。
        if (this._query && this._tq) { this._gl.endQuery(this._tqTarget); this._query = null; }
        this._pending = [];
        this._modelSig = '';
        this._modelChanges = 0;
        this._sampling = false;
        this._lastFrameT = 0;
    }

    private _snapshot(frames: number): CaseResult {
        const srt = (a: number[]) => a.slice().sort((x, y) => x - y);
        const d = srt(this._drawMs), f = srt(this._frameMs), g = srt(this._gpuMs), u = srt(this._uploadMs);
        const tk = srt(this._tickMs);
        const canvasBytes = this._canvas ? this._canvas.width * this._canvas.height * 4 : 0;
        const st = this._tintCache?.stats;
        const filled = this._filled();
        return {
            arm: this._arm,
            zoom: this._zoom,
            frames,
            cmdsPerFrame: this._lastCmds,
            blitsPerFrame: this._lastBlits,
            drawCalls: this._lastDrawCalls,
            tris: this._lastTris,
            drawMs: { p50: pct(d, 0.5), p95: pct(d, 0.95), max: d.length ? d[d.length - 1] : 0 },
            frameMs: { p50: pct(f, 0.5), p95: pct(f, 0.95) },
            gpuMs: g.length ? { p50: pct(g, 0.5), p95: pct(g, 0.95), n: g.length } : null,
            uploadMs: u.length ? { p50: pct(u, 0.5), p95: pct(u, 0.95), n: u.length } : null,
            uploadBytesPerFrame: this._arm === 'canvas' ? canvasBytes : 0,
            atlasCells: this._cells.size,
            atlasUploads: this._atlasUploads,
            spriteNodes: this._pool.length,
            tintSprites: st ? st.sprites : 0,
            filledCells: filled,
            gpuMethod: this._gpuMethod,
            modelChanges: this._modelChanges,
            drawnFrames: this._drawnFrames,
            gate: Boolean((this._app as AnyObj | null)?.dirtyGate),
            atlasLayers: this._atlasLayers,
            tickMs: { p50: pct(tk, 0.5), p95: pct(tk, 0.95), n: tk.length },
            disturb: this._disturb,
        };
    }

    /**
     * 一次完整采样：预热 warmup 帧（脏合成/图集建格都发生在这段）→ 复位计数 →
     * 量 frames 帧。⛔ 不等 rAF：用 `EVENT_AFTER_DRAW` 计数推进。
     */
    runCase(o: { arm: ArmName; zoom: number; frames: number; warmup: number; gpu: boolean; disturb?: boolean }): Promise<CaseResult> {
        return new Promise((resolve) => {
            this._probeGpu = o.gpu;
            this._disturb = !!o.disturb;
            void this.setArm(o.arm).then(() => {
                this.setZoom(o.zoom);
                this._resetSamples();
                let n = 0;
                const step = (): void => {
                    if (n === o.warmup) { this._sampling = true; this._atlasUploads = 0; this._frameTick = 0; }
                    if (n >= o.warmup + o.frames) {
                        const r = this._snapshot(this._sampling ? o.frames : 0);
                        this._sampling = false;
                        resolve(r);
                        return;
                    }
                    // 最坏档：每帧拖一下相机缩放 ⇒ 全盘几何都变 ⇒ `modelChanges ≈ frames`。
                    // （静置档实测 chg 只 3–4/150 ⇒ 两臂的「白做」比例差在这里分开）
                    if (this._disturb && this._sampling) {
                        const p = this._play();
                        p?.setZoomForDebug?.(this._zoom + (n % 2 ? 0.004 : -0.004));
                    }
                    n++;
                    requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            });
        });
    }

    private _api(): AnyObj {
        const self = this;
        return {
            host: () => self.host(),
            enterPlay: () => self.enterPlay(),
            phase: () => self.phase(),
            setArm: (a: ArmName) => self.setArm(a),
            setGate: (on: boolean) => self.setGate(on),
            gate: () => Boolean((self._app as AnyObj | null)?.dirtyGate),
            setAtlasLayers: (v: 'full' | 'beads') => self.setAtlasLayers(v),
            atlasLayers: () => self._atlasLayers,
            runCase: (o: AnyObj) => self.runCase(o as never),
            stats: () => ({ ...self._snapshot(0), host: self.host() }),
            caps: () => self._gl
                ? {
                    maxTextureSize: self._gl.getParameter(0x0D33),
                    maxVertexAttribs: self._gl.getParameter(0x8869),
                    timerQuery: !!(self._gl.getExtension('EXT_disjoint_timer_query_webgl2')),
                    timerQueryTarget: self._tqTarget,
                    timerQueryExtKeys: self._tq ? Object.getOwnPropertyNames(Object.getPrototypeOf(self._tq)) : null,
                    gpuDisjoint: self._tq ? self._gl.getParameter(self._tq.GPU_DISJOINT_EXT) : null,
                }
                : null,
        };
    }
}

/** 由 `BeadsBootstrap`（或本文件自轮询）在 App 起来后调用。 */
export function installCarrierBench(boot: AnyObj): CarrierBench {
    const b = new CarrierBench();
    b.attach(boot);
    return b;
}

/** 入口：仅 `?bench=1` 生效；轮询等 `_app`（Bootstrap.launch 之后才存在）。 */
export function maybeInstallCarrierBench(): void {
    if (!/[?&]bench=1\b/.test(search)) return;
    let tries = 0;
    const boot = (): void => {
        const scene = director.getScene() as unknown as AnyObj;
        // 路径与 `cocos-vfx-burst.mjs` 的 `__game()` 同款：Canvas → GameRoot（挂 Bootstrap 的那一枚）。
        const gameRoot = (scene?._children || []).find((n: AnyObj) => n.name === 'Canvas')
            ?.getChildByName?.('GameRoot');
        const comp = gameRoot?.getComponent(js.getClassByName('BeadsBootstrap') as any);
        if (comp?._app) { installCarrierBench(comp); return; }
        if (++tries < 80) setTimeout(boot, 100);
        else console.warn('[BENCH] GameRoot/BeadsBootstrap 6s 内未就绪');
    };
    setTimeout(boot, 200);
}
