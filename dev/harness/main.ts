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
import { createBreakoutGame } from '../../games/breakout/src/index.js';

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

const game = createBreakoutGame();
const app = new App({
  game,
  designWidth: 750,
  designHeight: 1334,
  seed: 'harness',
});

const renderer = new Canvas2DRenderer(ctx, app.viewport);

/** Device pixel ratio, capped so a 3× phone does not melt the canvas. */
const dpr = Math.min(window.devicePixelRatio || 1, 2);

app.onRender = (model) => {
  renderer.draw(model);
};

/**
 * Match the canvas backing store to the window.
 *
 * The viewport is told the size in *device* pixels, so `fit.scale` already
 * includes the DPR and the renderer's transform lands correctly. Pointer events
 * arrive in CSS pixels, so they are scaled up before being fed to the input
 * manager — that keeps a single consistent coordinate space.
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

  app.resize(w, h);
}

window.addEventListener('resize', fitCanvas);
fitCanvas();

// ────────────────────────────────────────────────────────────────── pointer

let lastPointerId = 0;

function pushPointer(event: PointerEvent, phase: 'down' | 'move' | 'up' | 'cancel'): void {
  lastPointerId = event.pointerId;
  app.input.push({
    id: event.pointerId,
    x: event.clientX * dpr,
    y: event.clientY * dpr,
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
    held.add(event.key);
    event.preventDefault();
    return;
  }
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    // Same intent as a tap, expressed through the public command API.
    switch (game.phase) {
      case 'ready':
        game.launch();
        break;
      case 'game-over':
        game.retryLevel();
        break;
      case 'victory':
        game.restartRun();
        break;
      case 'paused':
        game.onResume();
        break;
      default:
        break;
    }
    return;
  }
  if (event.key >= '1' && event.key <= '5') {
    game.goToLevel(Number(event.key) - 1);
  }
});

window.addEventListener('keyup', (event) => {
  held.delete(event.key);
});

/** Feed held arrow keys into the paddle every frame. */
function applyKeyboard(dt: number): void {
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
    game.movePaddleTo(keyboardX);
  } else {
    // Keep the keyboard cursor aligned with wherever the pointer left the paddle.
    keyboardX = game.paddle.x;
  }
  if (lastPointerId !== 0 && !app.input.isDown) lastPointerId = 0;
}

// ────────────────────────────────────────────────────────── debug HUD + buttons

function renderHud(): void {
  const s = game.snapshot;
  hud.textContent =
    `phase ${s.phase}  ·  level ${s.levelIndex + 1}/${s.levelCount}  ·  ` +
    `score ${s.score}  ·  lives ${s.lives}  ·  combo ${s.combo} (×${s.multiplier})  ·  ` +
    `bricks ${s.remainingBricks}/${s.totalBricks}  ·  ball r${s.ballRadius}`;
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-level]')) {
  button.addEventListener('click', () => {
    game.goToLevel(Number(button.dataset['level']) - 1);
    canvas.focus();
  });
}

must<HTMLButtonElement>('#restart').addEventListener('click', () => {
  game.restartRun();
});

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
requestAnimationFrame(frame);

// Expose for console poking during development.
Object.assign(window as unknown as Record<string, unknown>, {
  __breakout: { app, game, fitCanvas },
});

// eslint-disable-next-line no-console
console.info(
  '%c Breakout harness ready ',
  'background:#4cc9f0;color:#0b1021;font-weight:bold',
  '\n  ←/→ or drag to move · Space to launch/retry · 1–5 to jump levels',
  '\n  window.__breakout exposes { app, game, fitCanvas }',
);
