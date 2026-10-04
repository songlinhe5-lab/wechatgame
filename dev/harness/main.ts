/**
 * Breakout browser dev harness.
 *
 * Boots the real game through the real framework composition root — the same
 * `App` / `GameServices` graph the WeChat build uses — and paints it with the
 * Canvas2D render adapter. Nothing here is game logic: this file only wires
 * DOM events into `InputManager`, drives the loop, and draws a debug HUD.
 *
 * Why it exists: you can iterate on gameplay and level data in a browser with no
 * Cocos editor and no WeChat developer tools installed. See ./README.md.
 */

import { App, Canvas2DRenderer } from '@wxgame/framework';
import {
  TintSpriteCache,
  createTintBlitResolver,
  type BlitCommand,
  type TextureRegistry,
  type TintCanvasFactory,
} from '@wxgame/framework';
import { DEMO_BEAD_INKS } from '../../games/beads/src/view/palette.js';
import {
  MASK_SCHEMA_VERSION,
  tintFx,
  type BeadMaskGauge,
} from '@wxgame/framework';
import { setBeadTintRuntime, createWhitelistBeadTintRuntime } from '../../games/beads/src/view/bead-render.js';
import { createBreakoutGame, type BreakoutGame } from '../../games/breakout/src/index.js';
import { createBeadsShell, type BeadsShell } from '../../games/beads/src/index.js';

// ─────────────────────────────────────────────────────────────── DOM handles

function must<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`harness: missing element "${selector}"`);
  return el;
}

const canvas = must<HTMLCanvasElement>('#stage');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('harness: 2D canvas context unavailable');

const hud = must<HTMLDivElement>('#hud');

// ─────────────────────────────────────────────────────────────────── the game

// Game selection: `?game=beads` boots beads; everything else stays breakout
// (the long-standing default — existing bookmarks/links keep working).
// `window.location` is read defensively: the smoke-test DOM stub has none.
const harnessQuery =
  typeof window.location?.search === 'string' ? window.location.search : '';
const harnessParams = new URLSearchParams(harnessQuery);
const isBeads = harnessParams.get('game') === 'beads';
// `?meta=menu` boots beads straight into the shell's main menu (批0 路由验证)；
// 默认 'play' 保持首启直进玩法红线。
const game = isBeads
  ? createBeadsShell({
    initialScreen: harnessParams.get('meta') === 'menu' ? 'menu' : 'play',
    // ?studio=http://localhost:8787 ⇒ 主菜单设置页出「导入」钮（WXG-T-179 beads-studio 在线导入）。
    ...(harnessParams.get('studio') ? { studio: { baseUrl: harnessParams.get('studio')! } } : {}),
  })
  : createBreakoutGame();
/** Narrowed aliases — every use site is guarded by `isBeads`. */
const breakout = game as BreakoutGame;
const beadsShell = game as BeadsShell;
const beads = beadsShell.play;
const app = new App({
  game,
  designWidth: 750,
  designHeight: 1334,
  seed: 'harness',
});

/** Device pixel ratio, capped so a 3× phone does not melt the canvas. */
const dpr = Math.min(window.devicePixelRatio || 1, 2);

/* ─────────────────────────────────────────────── [WXG-T-226 EP12-B3] tint 臂装配
 *
 * 原理：tint 臂的命令**早就发得出**（`blit(maskId, rect, { fx })`），渲染器也**早就
 * 消费得了**（`BlitResolver`）。缺的只有两段数据流：① 谁提供 mask 像素与合成器；
 * ② 谁预热。宿主（这里 = harness）补上这两段，游戏侧不需要任何 canvas 知识。
 *
 * ⛔ 默认安全：?tint=off（默认即 on，但要显式关时用）—— 不装配 ⇒ 带 `fx` 的 blit
 * 被跳过 ⇒ 矢量臂逐字节不变（V-5 绿线锚）。真机侧另有 S5 载体（延后册 D1/D10）。
 */
const tintEnabled = harnessParams.get('tint') !== 'off';

/** 4 张定稿 mask 的逻辑 id（正本 = `bead-tint-mask.ts` 的 DEC-5 白名单）。 */
const MASK_IDS: readonly string[] = [
  `mask__bead__holed__v${MASK_SCHEMA_VERSION}`,
  `mask__bead__holeless__v${MASK_SCHEMA_VERSION}`,
  `mask__grid__holed__v${MASK_SCHEMA_VERSION}`,
  `mask__grid__holeless__v${MASK_SCHEMA_VERSION}`,
];
const MASK_URL_PREFIX = '/mask-assets/';
const MASK_FILE: Readonly<Record<BeadMaskGauge, { bead: string; grid: string }>> = {
  holed: { bead: 'bead-hole-tint-128-mask.png', grid: 'grid-hole-tint-128-mask.png' },
  holeless: { bead: 'bead-holeless-tint-128-mask.png', grid: 'grid-holeless-tint-128-mask.png' },
};

/** mask 纹理注册表（mask 逻辑 id → 可 drawImage 的 ImageBitmap）。 */
const maskRegistry = new Map<string, object>();
/** 装配读数（供 HUD / 控制台；⛔ 非热路径）。 */
const tintStats = {
  loaded: 0,
  ready: false,
  failed: [] as string[],
  prewarmed: 0,
  prewarmMs: 0,
  /** 活体读数：每帧刷新（`stats` 是 cache 的机械计数）。 */
  refresh() {
    const st = tintCache.stats;
    this.misses = st.misses;
    this.evictions = st.evictions;
    this.errors = st.errors;
    this.sprites = st.sprites;
  },
  misses: 0,
  evictions: 0,
  errors: 0,
  sprites: 0,
};

const maskSource = { get: (id: string): object | undefined => maskRegistry.get(id) };
const tintCache = new TintSpriteCache(
  // 离屏 canvas 工厂（结构化注入 ⇒ framework/core 层 ⛔ 不碰 DOM，L2 合规）
  {
    createCanvas(w: number, h: number) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c as unknown as ReturnType<TintCanvasFactory['createCanvas']>;
    },
  },
  maskSource,
  // `ImageData` 是浏览器能力 ⇒ 宿主注入（framework ⛔ 不假设 lib.dom）
  {
    createImageData: (w: number, h: number) => new ImageData(w, h),
    // ⚠ 实测结论（2026-10-03 A/B 截图，见 temp/tint-wiring/sim-flip.mjs）：
    // **不预镜像** 才是对的 —— `blit` 分支的翻转与帧级 y 翻转**相抵**（两翻 = 恒等），
    // 因此纹理须为**屏幕朝向**，而定稿 mask PNG 正是屏幕朝向。
    // 曾按「blit 会翻转 ⇒ 需预镜像」的推理加过 `flipY: true`，结果是**光影反了**（已回退）。
    // `?flip=1` 保留为反证开关。
    flipY: harnessParams.get('flip') === '1',
  },
);
const blitResolver = createTintBlitResolver(tintCache, maskSource as TextureRegistry);

/**
 * 装 mask → 装 tint 运行时 → 预热 ⇒ 三步**串行**。
 *
 * ⛔ 运行时**在 mask 就绪之后才注入**（不是「先注入、边加载边生效」）：
 * 否则前几帧会「部分格走 tint、部分格跳过」= 观感 pop。加载失败 ⇒ 永不注入 ⇒ 恒矢量臂。
 */
if (isBeads && tintEnabled) {
  // ⛔ 不静默：整链失败也要在控制台留痕（否则「看起来没生效」无从排查）
  void loadMasks()
    .then(() => {
      if (tintStats.failed.length > 0) {
        console.warn('[tint] mask 加载失败 ⇒ tint 臂不注入（保持矢量臂）', tintStats.failed);
        return;
      }
      setBeadTintRuntime(createWhitelistBeadTintRuntime((maskId) =>
        maskRegistry.has(maskId) ? maskId : undefined,
      ));
      prewarmTint();
      console.info(
        `[tint] 已装配：${tintStats.loaded}/4 mask · 预烘 ${tintStats.prewarmed} 条 ${tintStats.prewarmMs.toFixed(1)}ms`,
      );
    })
    .catch((err) => { tintStats.failed.push(String(err)); console.warn('[tint] 装配链异常', err); });
}

/**
 * 加载 4 张 mask（`<img>` + `decode()`）。
 *
 * ## 为什么不用 `fetch` + `createImageBitmap`（2026-10-03 接线实测后改）
 *
 * 首版用 `fetch` → `blob` → `createImageBitmap`，在浏览器里**没生效且无从排查**（HUD 只显示
 * 「加载失败」，控制台无痕）。`Image` + `decode()` 是**最广兼容**的一条路（无 blob、无
 * `createImageBitmap` 依赖），失败时还有 `onerror` 兜底 ⇒ 失败必留痕。
 *
 * `decode()` 需要图片已在文档中（否则部分浏览器不发事件）⇒ 走 `Object.assign` 挂载。
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // 部分浏览器要图片「在文档里」才 resolve decode()
      if (!img.isConnected) { Object.assign(document.body, img); }
      img.decode().then(() => resolve(img), () => resolve(img));
    };
    img.onerror = () => reject(new Error(`img load failed: ${url}`));
    img.src = url;
  });
}

async function loadMasks(): Promise<void> {
  const pairs: ReadonlyArray<readonly [BeadMaskGauge, 'bead' | 'grid']> = [
    ['holed', 'bead'], ['holed', 'grid'],
    ['holeless', 'bead'], ['holeless', 'grid'],
  ];
  await Promise.all(pairs.map(async ([gauge, kind]) => {
    const id = `mask__${kind}__${gauge}__v${MASK_SCHEMA_VERSION}`;
    const file = `${MASK_URL_PREFIX}${MASK_FILE[gauge][kind]}`;
    try {
      const img = await loadImage(file);
      if (img.naturalWidth === 0) throw new Error(`naturalWidth=0 (${file})`);
      maskRegistry.set(id, img as unknown as object);
      tintStats.loaded += 1;
    } catch (err) {
      // ⛔ 不静默：加载失败会让 tint 臂「看起来没生效」，必须在 HUD + 控制台可见
      tintStats.failed.push(`${id}(${String(err)})`);
      console.warn('[tint] mask 加载失败', id, file, err);
    }
  }));
  tintStats.ready = true;
}

/**
 * 加载页预热（延后册 D8 / D10）：把「白名单 mask × 珠色集」在进盘前烘完 ⇒ 首帧零合成。
 * 预热能力是注入式设计**白送**的（直接调 resolver），⛔ 仓内无专用 prewarm API。
 * ⚠ 计时用宿主 `performance.now()` —— framework ⛔ 不碰时钟（时钟是宿主能力）。
 */
function prewarmTint(): void {
  const colors = DEMO_BEAD_INKS.hexes;
  const t0 = performance.now();
  let n = 0;
  for (const maskId of MASK_IDS) {
    for (const c of colors) {
      const cmd: BlitCommand = { kind: 'blit', textureId: maskId, x: 0, y: 0, w: 0, h: 0, fx: tintFx(c) };
      if (blitResolver.resolve(cmd) !== undefined) n += 1;
    }
  }
  tintStats.prewarmMs = performance.now() - t0;
  tintStats.prewarmed = n;
}

const renderer = new Canvas2DRenderer(ctx, app.viewport, {
  pixelRatio: dpr,
  blitResolver,
});

app.onRender = (model) => {
  renderer.draw(model);
};

/**
 * Match the canvas backing store to the window.
 *
 * Screen space is CSS px end-to-end (ADR-0011): the viewport is told the CSS
 * size, and `App.start()` re-fits it from `platform.getScreenSize()` — which is
 * CSS px on every host — so a pointer event's `clientX/clientY` maps straight
 * through. The extra resolution lives only in the backing store (`cssW * dpr`),
 * which `Canvas2DRenderer` absorbs via its `pixelRatio`; DPR never reaches the
 * viewport or the input manager.
 */
function fitCanvas(): void {
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  const w = Math.max(1, Math.floor(cssW * dpr));
  const h = Math.max(1, Math.floor(cssH * dpr));

  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;

  app.resize(cssW, cssH);
}

window.addEventListener('resize', fitCanvas);
fitCanvas();

// ────────────────────────────────────────────────────────────────── pointer

let lastPointerId = 0;

function pushPointer(event: PointerEvent, phase: 'down' | 'move' | 'up' | 'cancel'): void {
  lastPointerId = event.pointerId;
  // `clientX/clientY` are already CSS px — the exact screen space the viewport
  // fits to. Multiplying by DPR here was GAP-07: the input manager maps the
  // device-px value through a CSS-px viewport and lands off-board.
  app.input.push({
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    phase,
    time: performance.now(),
  });
}

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture?.(event.pointerId);
  pushPointer(event, 'down');
  event.preventDefault();
});

canvas.addEventListener('pointermove', (event) => {
  pushPointer(event, 'move');
});

canvas.addEventListener('pointerup', (event) => {
  pushPointer(event, 'up');
});

canvas.addEventListener('pointercancel', (event) => {
  pushPointer(event, 'cancel');
});

// Touch scrolling would fight the drag-to-move paddle.
canvas.addEventListener('touchstart', (event) => event.preventDefault(), { passive: false });
canvas.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });

// ───────────────────────── keyboard: ←/→ move, Space acts (launch/retry/resume)

const held = new Set<string>();
/** Keyboard-driven paddle X, in design units. Independent of the pointer. */
let keyboardX = 375;

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    if (!isBeads) {
      held.add(event.key);
      event.preventDefault();
    }
    return;
  }
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    // Same intent as a tap, expressed through the public command API.
    if (isBeads) {
      switch (beads.phase) {
        case 'paused':
          beads.onResume();
          break;
        case 'game-over':
          beads.retryLevel();
          break;
        case 'finish':
          beads.restartRun();
          break;
        default:
          break;
      }
      return;
    }
    switch (breakout.phase) {
      case 'ready':
        breakout.launch();
        break;
      case 'game-over':
        breakout.retryLevel();
        break;
      case 'victory':
        breakout.restartRun();
        break;
      case 'paused':
        breakout.onResume();
        break;
      default:
        break;
    }
    return;
  }
  if (event.key >= '1' && event.key <= '5') {
    goToLevel(Number(event.key) - 1);
  }
});

window.addEventListener('keyup', (event) => {
  held.delete(event.key);
});

/** Feed held arrow keys into the paddle every frame. */
function applyKeyboard(dt: number): void {
  if (isBeads) return; // beads has no paddle — taps only
  const SPEED = 900; // design units per second
  let moved = false;
  if (held.has('ArrowLeft')) {
    keyboardX -= SPEED * dt;
    moved = true;
  }
  if (held.has('ArrowRight')) {
    keyboardX += SPEED * dt;
    moved = true;
  }
  if (moved) {
    breakout.movePaddleTo(keyboardX);
  } else {
    // Keep the keyboard cursor aligned with wherever the pointer left the paddle.
    keyboardX = breakout.paddle.x;
  }
  if (lastPointerId !== 0 && !app.input.isDown) lastPointerId = 0;
}

// ────────────────────────────────────────────────────────── debug HUD + buttons

function renderHud(): void {
  if (isBeads) {
    const s = beads.snapshot;
    const holding = s.traySlots.filter((t) => t.state !== 'free').length;
    const where =
      s.mode === 'sprint'
        ? `stage ${s.stageIndex + 1}`
        : `level ${s.levelIndex + 1}/${s.levelCount}`;
    const t = tintStats;
    const tintLine = tintEnabled
      ? (t.failed.length > 0
        ? ` · tint ⛔加载失败 ${t.failed.length}`
        : (t.ready
          ? ` · tint ${t.loaded}/4 mask · 预烘 ${t.prewarmed}/${t.prewarmMs.toFixed(1)}ms · miss ${t.misses} evict ${t.evictions} err ${t.errors}`
          : ' · tint 加载中…'))
      : ' · tint off';
    if (t.ready) t.refresh();
    hud.textContent =
      `[beads] phase ${s.phase} · ${s.mode} · ${where} · ` +
      `${Math.ceil(s.remaining)}s${s.urgent ? ' !!!' : ''} · ` +
      `score ${s.score} · ×${s.multiplier} (streak ${s.streak}) · ` +
      `tray ${holding}/${s.traySlots.length}${s.trayExpanded ? '+扩展' : ''}` +
      tintLine;
    return;
  }
  const s = breakout.snapshot;
  hud.textContent =
    `phase ${s.phase}  ·  level ${s.levelIndex + 1}/${s.levelCount}  ·  ` +
    `score ${s.score}  ·  lives ${s.lives}  ·  combo ${s.combo} (×${s.multiplier})  ·  ` +
    `bricks ${s.remainingBricks}/${s.totalBricks}  ·  ball r${s.ballRadius}`;
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-level]')) {
  button.addEventListener('click', () => {
    goToLevel(Number(button.dataset['level']) - 1);
    canvas.focus();
  });
}

must<HTMLButtonElement>('#restart').addEventListener('click', () => {
  restartRun();
});

/**
 * Level/restart routing. The shell (beads) does not re-expose the play command
 * API — it is the frozen `Game`; harness dev buttons reach through to `play`.
 */
function goToLevel(index: number): void {
  if (isBeads) beads.goToLevel(index);
  else breakout.goToLevel(index);
}

function restartRun(): void {
  if (isBeads) beads.restartRun();
  else breakout.restartRun();
}

// ─────────────────────────────────────────────────────────────── frame driver

/**
 * The framework `App` owns its own rAF loop and calls `onRender` itself, so all
 * we add per frame is the keyboard steering and the HUD refresh.
 */
let lastFrame = performance.now();
function frame(): void {
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;

  applyKeyboard(dt);
  renderHud();
  requestAnimationFrame(frame);
}

app.start();

// Sprint entry: ?game=beads&mode=sprint boots straight into the endless ladder.
if (isBeads && new URLSearchParams(harnessQuery).get('mode') === 'sprint') {
  beads.startSprint();
}

// Debug 虚线轮廓：harness 里**默认开**（仅 dev 页面；游戏侧 `debugOutlines` 仍默认 false，不漏进真机/构建）。
// 品红=固定 BEAD_PITCH 诊断参照、青=缩放 gridCell；`?dbg=off` 关；运行时亦可 `__beads.game.setDebugOutlines(b)`。
if (isBeads && new URLSearchParams(harnessQuery).get('dbg') !== 'off') {
  beads.setDebugOutlines(true);
}

// DEBUG 性能覆层：`?dbg=info` 开（真机无 query，走暂停面板行 4 或运行时
// `__beads.game.setDebugInfo(b)`；设置经 settings.debugInfo 持久化，跨重启保留）。
// 注：`?dbg=off` 同时关掉两者；`?dbg=info` 单独给出 outlines+info 组合（dev 页面可接受）。
if (isBeads && new URLSearchParams(harnessQuery).get('dbg') === 'info') {
  beads.setDebugInfo(true);
}

// `?zoom=N` 直接设相机倍率（跳过滑杆交互）⇒ headless 截图可按指定倍率出图。
// 用途：白线是**分数设备像素**相位现象（zoom × dpr × 窗口宽的函数），必须能定点复现才谈量化。
// 放在 `app.start()` 之后调用，避免首帧用旧 zoom 渲染一帧再跳变。
{
  const z = Number(new URLSearchParams(harnessQuery).get('zoom'));
  if (Number.isFinite(z) && z > 0) beads.setZoomForDebug(z);
}

// `?lift=1` 自动选中第一颗错位珠 ⇒ **选中态在 headless 可达**。
// 起因（WXG-T-236 二轮）：抬起槽/影的观感问题必须**实际看图**判定，而 headless 点不了一颗珠
// ⇒ 此前所有「选中态」验证都只能靠命令流取数、无法看图。本参数是**测具**（dev-only，不进构建）。
// ⛔ 用 `selectBoardBead` 的返回值找错位格（不复制 `isMisplaced` 谓词，见 K-055 同型判例）。
if (isBeads && new URLSearchParams(harnessQuery).get('lift') === '1') {
  const snap = beadsShell.play.snapshot;
  // `SnapshotCell` 无 row/col（按位置索引）⇒ 行列由 index 与 `gridCols` 派生。
  outer: for (let i = 0; i < snap.cells.length; i++) {
    const c = snap.cells[i]!;
    if (c.state !== 'filled' || c.beadColorIdx === c.colorIdx) continue; // 非错位 ⇒ 跳过
    if (beadsShell.play.selectBoardBead(Math.floor(i / snap.gridCols), i % snap.gridCols)) break outer;
  }
}



// TEMP-DEBUG（WXG-T-244 诊断 · dev-only 测具，不进构建）：组落座动画观测 + 一键复现。
//
// 用途（2026-10-04 用户报「还是没有变化」）：把「动画有没有被触发」变成**屏幕上的一行字**，不用猜。
// · 面板每帧显示：相位时钟、登记数/环号序、托盘 holding 数、mode；
// · 「R」键或自动跑一次**一键复现**：托盘注入 3 颗同色珠 → 选中 → 点第一个对色空格（走真链 `tapDesign`）。
//
// ⛔ 若面板显示 `groupLand=0` ⟹ 入口条件没满足（单颗走 G1 单槽，见 `beads-game.ts:2809` 的
//   `if (groupSize > 1)`）；若 `groupLand>0` 但画面无变化 ⟹ 消费链（view-model.ts:984-987/1119）问题。
const GLD = isBeads && new URLSearchParams(harnessQuery).get('gldbg') === '1';
if (GLD) {
  const play = beadsShell.play;
  const box = document.createElement('div');
  box.id = 'gldbg';
  box.style.cssText =
    'position:fixed;left:4px;bottom:4px;z-index:99;font:11px/1.45 monospace;color:#7CFC7C;' +
    'background:rgba(0,0,0,.74);padding:6px 9px;white-space:pre;border-radius:6px;pointer-events:none';
  document.body.appendChild(box);
  (window as unknown as { __gldKick?: () => void }).__gldKick = () => {
    // ⚠ **按「空格的目標色」注入同色珠**（首版挑首格目标色 ⟹ 与空格色不匹配 ⟹ 走 rejected
    //   ⟹ 永远不落座 ⟹ 误报「无对色空格」。这正是「点了没变化」最常见的原因：**颜色不匹配**。
    const s0 = play.snapshot;
    const i0 = s0.cells.findIndex((c) => c.state === 'empty' && c.colorIdx > 0);
    if (i0 < 0) {
      box.textContent += `\n[repro] 盘面无空格（满盘）`;
      return;
    }
    const color = s0.cells[i0]!.colorIdx;
    let slot = -1;
    for (let k = 0; k < 3; k += 1) {
      const r = play.giveTrayBead(color);
      if (k === 0) slot = r;
    }
    play.selectTraySlot(slot);
    const s1 = play.snapshot;
    const i = s1.cells.findIndex((c) => c.state === 'empty' && c.colorIdx === color);
    if (i < 0) {
      box.textContent += `\n[repro] 注入后无对色空格`;
      return;
    }
    const row = Math.floor(i / s1.gridCols);
    const col = i % s1.gridCols;
    const x = s1.gridLeft + 15 + 32 * col; // BEAD_CELL/2 + BEAD_PITCH（测试 cellCenter 同式）
    const y = s1.gridTop - 15 - 32 * row;
    const consumed = play.tapDesign(x, y);
    box.textContent += `\n[repro] 色${color} 珠3 选中槽${slot} → 点(${row},${col}) consumed=${consumed}`;
  };
  window.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'r' || (e as KeyboardEvent).key === 'R') {
      (window as unknown as { __gldKick?: () => void }).__gldKick?.();
    }
  });
  const tick = (): void => {
    const s = play.snapshot;
    const holding = s.traySlots.filter((t) => t.state === 'holding').length;
    const filled = s.cells.filter((c) => c.state === 'filled').length;
    box.textContent = [
      `gld  mode=${s.mode}`,
      `groupLand=${s.groupLandCount} elapsed=${s.groupLandElapsedMs.toFixed(0)}ms`,
      `steps=[${Array.from(s.groupLandSteps.slice(0, 4)).join(',')}]`,
      `cells=[${Array.from(s.groupLandRows.slice(0, 3)).map((r, k) => `${r},${s.groupLandCols[k]}`).join(' ')}]`,
      `tray holding=${holding} filled=${filled}/${s.cells.length}`,
      // 空格按目标色分布：一眼看出「点哪个色能落座」
      `空格色=${(() => {
        const m = new Map<number, number>();
        for (const c of s.cells) if (c.state === 'empty' && c.colorIdx > 0) m.set(c.colorIdx, (m.get(c.colorIdx) ?? 0) + 1);
        return [...m.entries()].map(([k, v]) => `${k}×${v}`).join(' ') || '无';
      })()}`,
      // ★ 选中色 vs 空格色：**色不匹配 ⟹ judgePlacement rejected ⟹ 不落珠 ⟹ 队列不登记**
      //   （这是「点了没变化」第二大原因；面板必须同框显示两者）
      `选中色=${(() => {
        const h = s.traySlots.filter((t) => t.state === 'holding');
        const c = [...new Set(h.map((t) => t.colorIdx))];
        const em = new Set(
          s.cells.filter((x) => x.state === 'empty' && x.colorIdx > 0).map((x) => x.colorIdx),
        );
        if (c.length === 0) return '无（先点托盘珠）';
        return `${c.join('/')} → ${c.some((x) => em.has(x)) ? '✅ 有对色空格可落' : '⛔ 无对色空格（点了会被拒）'}`;
      })()}`,
      '按 R = 一键复现（自动按空格色注珠）',
    ].join('\n');
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(() => (window as unknown as { __gldKick?: () => void }).__gldKick?.(), 400);
}

requestAnimationFrame(frame);

// Expose for console poking during development.
Object.assign(window as unknown as Record<string, unknown>, {
  __breakout: { app, game: breakout, fitCanvas },
  __beads: {
    app, game: beads, shell: beadsShell, fitCanvas,
    // `[WXG-T-226]` tint 臂自诊断：控制台可读 `__beads.tint.stats` / `__beads.tint.registry`
    tint: { stats: tintStats, registry: maskRegistry, cache: tintCache, resolver: blitResolver },
  },
});

// eslint-disable-next-line no-console
console.info(
  '%c wxgame harness ready ',
  'background:#4cc9f0;color:#0b1021;font-weight:bold',
  `\n  game: ${isBeads ? 'beads' : 'breakout'} · add ?game=beads to the URL to switch`,
  isBeads
    ? // Aligned with the implementation above (L138-152) and gdd/pause-settings.md §2.1
    // (single-channel pause: the HUD gear is the ONLY entry; there is no second one).
    // The previous text claimed "Space pauses/resumes", which was wrong twice over:
    // in `playing` the switch hits `default: break` (no pause), and in `paused`
    // `onResume()` is a deliberate no-op (WXG-T-055 D-04 — the panel button is the
    // only exit). WXG-T-082.
    '\n  tap a tray bead then a board cell · Space = retry (game-over) / restart (finish) · pause is gear-only'
    : '\n  ←/→ or drag to move · Space to launch/retry · 1–5 to jump levels',
  '\n  window.__breakout / window.__beads expose { app, game, fitCanvas }',
);
