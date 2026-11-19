/**
 * EP15-S3 · 回放影子沙箱（ADR-0038 DEC-2）。
 *
 * 影子实例 = 完整 `BeadsGame` + **隔离 noop 服务**：内存存档、按录像种子重建的
 * 确定性 RNG、私有事件总线、无音频后端、无广告 / 开放数据 / 触觉 —— 存档 / 钱包 /
 * 体力 / 发豆 / 崩溃快照一律不产生外部可观测副作用（`replaySandbox` 在游戏侧短路）。
 *
 * 分层：装配只住 `replay/**`（ADR-0038 DEC-1），⛔ 不住 `bot/**`；本文件是
 * `src/replay/**` 里**唯一**允许运行时构造 `BeadsGame` 的位置。
 */

import {
  AudioScheduler,
  EventBus,
  InputManager,
  MemoryStorage,
  NullAssetProvider,
  NullAudioBackend,
  Viewport,
  createRngFromState,
  type GameServices,
  type RewardedAdProvider,
} from '@wxgame/framework';
import { createBeadsGame } from '../game/beads-game.js';
import type { BeadsGame } from '../game/beads-game.js';
import type { BeadsLevelRaw } from '../config/levels.js';
import type { BeadsTuning } from '../config/tuning.js';
import type { ReplayContext, ReplayRecording } from './recorder.js';

/** 影子宿主平台事实（无刘海 / 无胶囊 / 无广告位 ⇒ 零主机分支）。 */
const SANDBOX_PLATFORM = {
  name: 'node' as const,
  isMiniGame: false,
  safeAreaTop: 0,
  safeAreaBottom: 0,
  capsuleBottomDp: null,
  capsuleRectDp: null,
  rewardedAdConfigured: false,
};

/** 永不发奖的广告位（影子不接广告；`requestTrayExpand` 也不应被调用）。 */
const NOOP_AD: RewardedAdProvider = {
  load() {},
  isReady() {
    return false;
  },
  show() {},
  onRewarded() {
    return () => {};
  },
  onClose() {
    return () => {};
  },
  onError() {
    return () => {};
  },
  destroy() {},
};

export interface ReplaySandboxOptions {
  readonly levels: readonly BeadsLevelRaw[];
  readonly tuning?: BeadsTuning;
  readonly width?: number;
  readonly height?: number;
}

export interface ReplaySandbox {
  readonly game: BeadsGame;
  readonly services: GameServices;
  /** 销毁影子实例（会话退出 / seek 重建）。 */
  dispose(): void;
}

/**
 * 装配影子实例：`init` 后按录像 `context` 装配目标关（必须在 `goToLevel` **之前**
 * 注入 `starsBefore`，三档时钟才与录制时一致）。
 */
export function createReplaySandboxGame(
  rec: Pick<ReplayRecording, 'seed' | 'context'>,
  options: ReplaySandboxOptions,
): ReplaySandbox {
  const viewport = new Viewport(options.width ?? 750, options.height ?? 1334);
  const services: GameServices = {
    events: new EventBus(),
    input: new InputManager(),
    audio: new AudioScheduler(new NullAudioBackend()),
    storage: new MemoryStorage(),
    // DEC-6：按**状态**重建（⛔ 不用 createRng(seed) 重新哈希）。
    rng: createRngFromState(rec.seed),
    viewport,
    assets: new NullAssetProvider(),
    platform: SANDBOX_PLATFORM,
    rewardedAd: NOOP_AD,
  };
  const game = createBeadsGame({
    replaySandbox: true,
    levels: options.levels,
    saveKey: 'wxgame.beads.replay.sandbox',
    ...(options.tuning ? { tuning: options.tuning } : {}),
  });
  game.init(services);
  game.applyReplayContext(rec.context);
  game.goToLevel(rec.context.levelIndex);
  return {
    game,
    services,
    dispose(): void {
      game.dispose();
    },
  };
}

/** `ReplayContext` 的只读装配说明（供 UI / 测试阅读，不参与逻辑）。 */
export type { ReplayContext };
