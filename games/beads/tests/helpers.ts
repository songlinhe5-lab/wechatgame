/**
 * Shared test helpers.
 *
 * Builds a fully wired `GameServices` bundle backed by the Node platform, so
 * beads tests exercise the real framework services (event bus, input manager,
 * audio scheduler, save manager) rather than hand-rolled doubles.
 */

import {
  EventBus,
  InputManager,
  AudioScheduler,
  NullAudioBackend,
  NullAssetProvider,
  createRng,
  Viewport,
  type EventMap,
  type GameServices,
  type RewardedAdProvider,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { BeadsGame } from '../src/game/beads-game.js';
import type { BeadsLevelRaw } from '../src/config/levels.js';

export interface Harness {
  readonly services: GameServices;
  readonly game: BeadsGame;
  readonly audio: NullAudioBackend;
  readonly events: EventBus<EventMap>;
  readonly input: InputManager;
  readonly storage: ReturnType<NodePlatform['createStorage']>;
  readonly platform: NodePlatform;
  /** Advance the game by `seconds` in fixed 1/60 steps. */
  advance(seconds: number, step?: number): void;
  /** Record every emitted event. */
  readonly emitted: { type: string; payload: unknown }[];
  /** Count emissions of a given type. */
  count(type: string): number;
  /** All payloads emitted for a type. */
  all<T = unknown>(type: string): T[];
  /** Last payload emitted for a type. */
  last<T = unknown>(type: string): T | undefined;
}

export interface HarnessOptions {
  seed?: string;
  saveKey?: string;
  levels?: readonly BeadsLevelRaw[];
  /** Sprint run length override (C1 validation input). */
  sprintTime?: number;
  /** Share a storage instance between harnesses to simulate a relaunch. */
  storage?: ReturnType<NodePlatform['createStorage']>;
  /** Override the platform rewarded-ad (default = Node Mock pending settle). */
  rewardedAd?: RewardedAdProvider;
}

export function createBeadsHarness(options: HarnessOptions = {}): Harness {
  const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
  const storage = options.storage ?? platform.createStorage();
  const events = new EventBus<EventMap>();
  const input = new InputManager();
  const audioBackend = new NullAudioBackend();
  const audio = new AudioScheduler(audioBackend);

  const services: GameServices = {
    events,
    input,
    audio,
    storage,
    rng: createRng(options.seed ?? 'beads-test-seed'),
    viewport: new Viewport(750, 1334),
    assets: new NullAssetProvider(),
    platform: platform.info,
    rewardedAd: options.rewardedAd ?? platform.createRewardedAdProvider(),
  };

  const game = new BeadsGame({
    saveKey: options.saveKey ?? 'wxgame.beads.test.save',
    ...(options.levels ? { levels: options.levels } : {}),
    ...(options.sprintTime !== undefined ? { sprintTime: options.sprintTime } : {}),
  });

  const emitted: { type: string; payload: unknown }[] = [];
  const tracked = [
    'tray:spawned',
    'tray:selected',
    'bead:placed',
    'bead:rejected',
    'tray:full',
    'tray:expanded',
    'powerup:used',
    'timer:tick',
    'timer:urgent',
    'level:cleared',
    'level:failed',
    'game:paused',
    'game:resumed',
    'combo:up',
    'combo:break',
    'sprint:stage',
    'sprint:ended',
  ];
  for (const type of tracked) {
    events.on(type, (payload) => emitted.push({ type, payload }));
  }

  game.init(services);

  const harness: Harness = {
    services,
    game,
    audio: audioBackend,
    events,
    input,
    storage,
    platform,
    emitted,
    advance(seconds: number, step = 1 / 60): void {
      const steps = Math.max(1, Math.round(seconds / step));
      for (let i = 0; i < steps; i++) {
        input.beginFrame();
        game.update(step);
        input.endFrame(step);
      }
    },
    count(type: string): number {
      return emitted.filter((e) => e.type === type).length;
    },
    all<T>(type: string): T[] {
      return emitted.filter((e) => e.type === type).map((e) => e.payload as T);
    },
    last<T>(type: string): T | undefined {
      for (let i = emitted.length - 1; i >= 0; i--) {
        if (emitted[i]!.type === type) return emitted[i]!.payload as T;
      }
      return undefined;
    },
  };

  return harness;
}

/**
 * A minimal valid test level: 6×5, three colours (validator floor), full
 * rectangular pattern so every cell is fillable. `decoy` adds one decoy colour.
 */
export function simpleTestLevel(overrides: Partial<BeadsLevelRaw> = {}): BeadsLevelRaw {
  return {
    id: 90,
    name: '测试关',
    cols: 6,
    rows: 5,
    time: 300,
    spawnInterval: 4.0,
    decoys: [],
    pattern: ['123123', '123123', '123123', '123123', '123123'],
    ...overrides,
  };
}

/**
 * Convenience: give a specific colour into the tray, select it, and place it
 * at (row, col). Returns true when the placement was accepted.
 */
export function placeColor(
  game: BeadsGame,
  colorIdx: number,
  row: number,
  col: number,
): boolean {
  const slot = game.giveTrayBead(colorIdx);
  if (slot < 0) return false;
  if (!game.selectTraySlot(slot)) return false;
  return game.tapGridCell(row, col);
}

/**
 * Place one tray bead that matches any still-empty cell, if the tray holds
 * one. Returns true when a placement landed.
 */
export function placeAnyMatching(game: BeadsGame): boolean {
  const tray = game.tray;
  for (let slot = 0; slot < tray.capacity; slot++) {
    const s = tray.slot(slot)!;
    if (s.state === 'free') continue;
    for (let row = 0; row < game.grid.rows; row++) {
      for (let col = 0; col < game.grid.cols; col++) {
        if (!game.grid.isFillable(row, col)) continue;
        if (game.grid.requiredColor(row, col) !== s.colorIdx) continue;
        if (!game.selectTraySlot(slot)) continue;
        return game.tapGridCell(row, col);
      }
    }
  }
  return false;
}

/**
 * Advance the game one 1/60 step at a time until `remaining <= target`.
 * With `placeWhileBurning` the loop also plays matching beads each step
 * (keeps the tray breathing like a real player) — off by default so callers
 * can control exactly which placement completes the board.
 */
export function burnToRemaining(
  harness: ReturnType<typeof createBeadsHarness>,
  targetRemaining: number,
  placeWhileBurning = false,
): void {
  let guard = 0;
  while (harness.game.remaining > targetRemaining && harness.game.phase === 'playing') {
    harness.advance(1 / 60);
    if (placeWhileBurning) placeAnyMatching(harness.game);
    if (++guard > 60 * 600) throw new Error('burnToRemaining: ran away');
  }
}
