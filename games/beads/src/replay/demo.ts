/**
 * EP15-S2 · 演示预计算（ADR-0038 DEC-4 · `bot-replay §2.2.4` 演示半边）。
 *
 * 在**影子沙箱**里用 `BotDriver` 无头跑完整局，产出 `bot-demo` 录像；跑不完整局 /
 * 卡死 / 溢出 ⇒ 返回 `null`（「不生成、不播半局」，GDD §2.2.4 / §6）。
 *
 * 关卡 = 调用方指定的**当前最远解锁关**（`BOT_DEMO_LEVEL='farthest-unlocked'`）；
 * seed = `hash(levelId + REPLAY_DEMO_SEED_SALT)`（同关每次演示逐帧一致）。
 * 影子侧零存档 / 零钱包 / 零体力（复用 S3 沙箱），演示录像驻内存、不占「上一局」槽。
 */

import { hashSeed } from '@wxgame/framework';
import type { BeadsLevelRaw } from '../config/levels.js';
import type { BeadsTuning } from '../config/tuning.js';
import { REPLAY_DEMO_SEED_SALT, REPLAY_FIXED_DT_MS, BOT_MAX_MOVES, BOT_STEP_INTERVAL_MS } from '../config/tuning.js';
import { BotDriver } from '../bot/driver.js';
import { levelIdOf } from './level-hash.js';
import { ReplayRecorder, type ReplayRecording } from './recorder.js';
import { createReplaySandboxGame } from './sandbox.js';

export interface BotDemoOptions {
  readonly levels: readonly BeadsLevelRaw[];
  readonly levelIndex: number;
  /** 关卡当前星数（三档时钟与录制一致；只影响影子内存镜像）。 */
  readonly starsBefore: number;
  readonly tuning?: BeadsTuning;
  readonly maxMoves?: number;
  readonly stepIntervalMs?: number;
}

/**
 * 预计算一局演示录像。
 * @returns 完整过关的 `bot-demo` 录像；任何失败口径 ⇒ `null`。
 */
export function precomputeBotDemo(options: BotDemoOptions): ReplayRecording | null {
  const level = options.levels[options.levelIndex];
  if (!level) return null;
  const seed = hashSeed(levelIdOf(level) + REPLAY_DEMO_SEED_SALT) >>> 0;
  const context = { levelIndex: options.levelIndex, starsBefore: options.starsBefore, revived: false };
  const recorder = new ReplayRecorder({ source: 'bot-demo', seed: () => seed });
  const sandbox = createReplaySandboxGame(
    { seed, context },
    {
      levels: options.levels,
      ...(options.tuning ? { tuning: options.tuning } : {}),
      onCommandApplied: (type, args, elapsedMs) => recorder.record(elapsedMs, type, args),
    },
  );
  const game = sandbox.game;
  const driver = new BotDriver({
    ...(options.maxMoves !== undefined ? { maxMoves: options.maxMoves } : {}),
    ...(options.stepIntervalMs !== undefined ? { stepIntervalMs: options.stepIntervalMs } : {}),
  });
  game.setAssist('bot');
  recorder.tick(game);
  const dtMs = REPLAY_FIXED_DT_MS;
  // 保护圈：BOT_MAX_MOVES × 每动作两拍 × 每拍一拍间隔（换算成固定步），再留 2 倍余量。
  const intervalMs = options.stepIntervalMs ?? BOT_STEP_INTERVAL_MS;
  const guardMax = (options.maxMoves ?? BOT_MAX_MOVES) * 2 * Math.ceil(intervalMs / dtMs) * 2;
  let guard = 0;
  let failed = false;
  while (game.phase === 'playing' && guard++ < guardMax) {
    game.update(dtMs / 1000);
    if (game.phase !== 'playing') break;
    const event = driver.tick(dtMs, game);
    if (event === 'stuck' || event === 'exhausted') {
      failed = true;
      break;
    }
    recorder.tick(game);
  }
  recorder.tick(game);
  const rec = recorder.lastRecording;
  sandbox.dispose();
  if (failed || guard >= guardMax || !rec || rec.source !== 'bot-demo' || !rec.final.cleared) {
    recorder.discard();
    return null;
  }
  return rec;
}
