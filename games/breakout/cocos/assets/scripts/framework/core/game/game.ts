/**
 * The `Game` contract — the seam between a mini-game and the framework.
 *
 * A game is *pure simulation + a description of what to draw*. It receives
 * services (events, input, audio, storage, rng, viewport, assets) and must not
 * know which engine is hosting it. The hosting adapter calls, in order, each
 * frame:
 *
 *   1. `update(dt)`             — fixed-timestep simulation
 *   2. `buildRenderModel(b)`    — write the frame's draw commands
 *
 * `buildRenderModel` MUST be read-only with respect to game state. That rule is
 * what keeps the "UI holds no game state" guarantee honest (see ADR-0002).
 */

import type { EventBus, EventMap } from '../events/event-bus';
import type { InputManager } from '../input/input-manager';
import type { AudioScheduler } from '../audio/audio';
import type { Storage } from '../save/storage';
import type { Rng } from '../math/rng';
import type { Viewport } from '../render/viewport';
import type { RenderModelBuilder } from '../render/render-model';
import type { RewardedAdProvider } from '../ads/rewarded-ad';

/**
 * Opaque texture reference resolved by the render adapter. The core never
 * inspects it — it is whatever the platform's asset system hands back.
 */
export type TextureHandle = unknown;

export interface AssetProvider {
  /** True when a logical asset id exists. */
  has(id: string): boolean;
  /** Resolve a logical id to a texture handle, or `undefined`. */
  getTexture(id: string): TextureHandle | undefined;
  /** Escape hatch for loaders that ran ahead of gameplay. */
  getRaw(id: string): unknown;
}

export interface PlatformInfo {
  readonly name: 'web' | 'weapp' | 'node' | 'unknown';
  readonly isMiniGame: boolean;
  /** Safe-area insets in screen pixels (notches); 0 when unknown. */
  readonly safeAreaTop: number;
  readonly safeAreaBottom: number;
}

/** Everything a game may depend on. Constructed by the App, injected once. */
export interface GameServices {
  readonly events: EventBus<EventMap>;
  readonly input: InputManager;
  readonly audio: AudioScheduler;
  readonly storage: Storage;
  readonly rng: Rng;
  readonly viewport: Viewport;
  readonly assets: AssetProvider;
  readonly platform: PlatformInfo;
  /** Optional rewarded-video. Always present; weapp ships a Noop until approved. */
  readonly rewardedAd: RewardedAdProvider;
}

export interface Game {
  /** Stable identifier, also used to namespace save keys. */
  readonly id: string;
  /** Called once, before the first `update`. */
  init(services: GameServices): void;
  /** Fixed-timestep simulation. `dt` is always the loop's `fixedDt`. */
  update(dt: number): void;
  /** Write this frame's draw commands. MUST NOT mutate game state. */
  buildRenderModel(builder: RenderModelBuilder): void;
  /** App moved to the background (WeChat `onHide`). Pause timers here. */
  onPause?(): void;
  /** App returned to the foreground. */
  onResume?(): void;
  /** Tear down; release pooled objects and unsubscribe. */
  dispose?(): void;
}

/** A trivial content-free asset provider, used before real assets load. */
export class NullAssetProvider implements AssetProvider {
  has(): boolean {
    return false;
  }
  getTexture(): TextureHandle | undefined {
    return undefined;
  }
  getRaw(): unknown {
    return undefined;
  }
}

/** Map-backed asset provider — what the dev harness and tests use. */
export class MapAssetProvider implements AssetProvider {
  private readonly _textures = new Map<string, TextureHandle>();
  private readonly _raw = new Map<string, unknown>();

  setTexture(id: string, handle: TextureHandle): this {
    this._textures.set(id, handle);
    return this;
  }

  setRaw(id: string, value: unknown): this {
    this._raw.set(id, value);
    return this;
  }

  has(id: string): boolean {
    return this._textures.has(id) || this._raw.has(id);
  }

  getTexture(id: string): TextureHandle | undefined {
    return this._textures.get(id);
  }

  getRaw(id: string): unknown {
    return this._raw.get(id);
  }
}
