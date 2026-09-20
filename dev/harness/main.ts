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

const renderer = new Canvas2DRenderer(ctx, app.viewport, { pixelRatio: dpr });

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
    hud.textContent =
      `[beads] phase ${s.phase} · ${s.mode} · ${where} · ` +
      `${Math.ceil(s.remaining)}s${s.urgent ? ' !!!' : ''} · ` +
      `score ${s.score} · ×${s.multiplier} (streak ${s.streak}) · ` +
      `tray ${holding}/${s.traySlots.length}${s.trayExpanded ? '+扩展' : ''}`;
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

requestAnimationFrame(frame);

// Expose for console poking during development.
Object.assign(window as unknown as Record<string, unknown>, {
  __breakout: { app, game: breakout, fitCanvas },
  __beads: { app, game: beads, shell: beadsShell, fitCanvas },
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
