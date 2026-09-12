/**
 * Shared test helpers.
 *
 * Builds a fully wired `GameServices` bundle backed by the Node platform, so
 * game tests exercise the real framework services (event bus, input manager,
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
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { BreakoutGame } from '../src/game/breakout-game.js';
import type { LevelDef } from '@wxgame/framework';

export interface Harness {
  readonly services: GameServices;
  readonly game: BreakoutGame;
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
  /** Last payload emitted for a type. */
  last<T = unknown>(type: string): T | undefined;
}

export interface HarnessOptions {
  seed?: string;
  saveKey?: string;
  levels?: readonly LevelDef[];
  /**
   * Share a storage instance between harnesses to simulate a relaunch: two
   * harnesses backed by the same `Storage` see each other's saved documents.
   */
  storage?: ReturnType<NodePlatform['createStorage']>;
}

export function createHarness(options: HarnessOptions = {}): Harness {
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
    rng: createRng(options.seed ?? 'test-seed'),
    viewport: new Viewport(750, 1334),
    assets: new NullAssetProvider(),
    platform: platform.info,
  };

  const game = new BreakoutGame({
    saveKey: options.saveKey ?? 'wxgame.breakout.test.save',
    ...(options.levels ? { levels: options.levels } : {}),
  });

  const emitted: { type: string; payload: unknown }[] = [];
  const tracked: string[] = [
    'run:start',
    'level:start',
    'level:clear',
    'score:changed',
    'combo:changed',
    'brick:damaged',
    'brick:destroyed',
    'steel:hit',
    'ball:launched',
    'ball:lost',
    'paddle:hit',
    'wall:hit',
    'game:over',
    'victory',
    'save:written',
    'settings:changed',
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
    last<T = unknown>(type: string): T | undefined {
      for (let i = emitted.length - 1; i >= 0; i--) {
        if (emitted[i]!.type === type) return emitted[i]!.payload as T;
      }
      return undefined;
    },
  };

  return harness;
}

/** A one-brick test level: full control over what the ball can hit. */
export function singleBrickLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test-single',
    name: 'Single',
    layout: ['1'],
    legend: { '1': { hp: 1, score: 10, color: '#4cc9f0' } },
    ...overrides,
  };
}

/**
 * Teleport the ball to just below `target` and fire it straight up. Used to make
 * collision tests deterministic instead of relying on a physics chain.
 */
export function aimAt(game: BreakoutGame, target: { x: number; y: number; height: number }): void {
  game.ball.x = target.x;
  game.ball.y = target.y - target.height / 2 - game.ball.radius - 2;
  game.ball.vx = 0;
  game.ball.vy = 600;
  game.ball.launched = true;
}
