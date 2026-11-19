/**
 * EP15-S2 · 机器人驱动（ADR-0038 DEC-4/5 · `bot-replay §2.2.4`）。
 *
 * 两条腿共用本类：
 * - **托管（assist）**：仅在 `phase==='playing' && game.assist==='bot'` 出手；每拍
 *   `BOT_STEP_INTERVAL_MS` 调一次 `decide()`，`BotAction` 的命令按序在**连续两拍**
 *   施加（满足 `core-loop §2.2.2`「每帧最多 1 条输入指令」）；
 * - **演示（demo）**：由 `replay/demo.ts` 用同一驱动在影子实例上无头跑完整局。
 *
 * 停机口径：`decide()==null` 连续 `BOT_STUCK_LIMIT` 次 ⇒ `'stuck'`；动作数触顶
 * `BOT_MAX_MOVES` ⇒ `'exhausted'`。调用方（壳层）负责「自动暂停 + 关闭托管 + 轻提示」。
 *
 * 分层：纯逻辑，只 `import type` `BeadsGame`，⛔ 不持 UI / 事件 / RNG。
 */

import type { BeadsGame } from '../game/beads-game';
import { BOT_MAX_MOVES, BOT_STEP_INTERVAL_MS, BOT_STUCK_LIMIT } from '../config/tuning';
import { applyBotCommand } from './apply';
import { observeGame } from './observe';
import { createBotPolicy } from './registry';
import type { BotCommand, BotPolicy } from './types';

/** `''` = 本拍无动作；其余 = 本拍结果（`stuck` / `exhausted` 由调用方收口）。 */
export type BotDriverEvent = '' | 'acted' | 'stuck' | 'exhausted';

export interface BotDriverOptions {
  readonly policy?: BotPolicy;
  readonly stepIntervalMs?: number;
  readonly stuckLimit?: number;
  readonly maxMoves?: number;
}

export class BotDriver {
  private readonly _policy: BotPolicy;
  private readonly _intervalMs: number;
  private readonly _stuckLimit: number;
  private readonly _maxMoves: number;
  private _queue: BotCommand[] = [];
  private _accMs = 0;
  private _moves = 0;
  private _stuckRepeats = 0;

  constructor(options: BotDriverOptions = {}) {
    this._policy = options.policy ?? createBotPolicy();
    this._intervalMs = options.stepIntervalMs ?? BOT_STEP_INTERVAL_MS;
    this._stuckLimit = options.stuckLimit ?? BOT_STUCK_LIMIT;
    this._maxMoves = options.maxMoves ?? BOT_MAX_MOVES;
  }

  /** 已施加的 `BotAction` 数（演示/托管一致口径）。 */
  get moves(): number {
    return this._moves;
  }

  /** 重新计时（开始托管 / 换局 / 重试）。 */
  reset(): void {
    this._queue = [];
    this._accMs = 0;
    this._moves = 0;
    this._stuckRepeats = 0;
  }

  get policyId(): string {
    return this._policy.id;
  }

  /**
   * 推进一拍（`dtMs` = 帧间隔毫秒）。返回本拍结果：
   * - `'acted'`：本拍施加了一条命令（一条 `BotAction` 最多跨两拍）；
   * - `'stuck'`：连续无合法动作触顶（宿主应自动暂停并关闭托管）；
   * - `'exhausted'`：`BOT_MAX_MOVES` 触顶；
   * - `''`：未到拍 / 非托管 / 非 PLAYING。
   */
  tick(dtMs: number, game: BeadsGame): BotDriverEvent {
    if (game.phase !== 'playing' || game.assist !== 'bot') return '';
    // 一条 BotAction 的后续命令占用后续拍：每拍最多 1 条公开命令。
    if (this._queue.length > 0) {
      applyBotCommand(game, this._queue.shift()!);
      return 'acted';
    }
    this._accMs += Math.max(0, dtMs);
    if (this._accMs < this._intervalMs) return '';
    this._accMs = 0;
    if (this._moves >= this._maxMoves) return 'exhausted';
    const action = this._policy.decide(observeGame(game));
    if (!action || action.commands.length === 0) {
      this._stuckRepeats += 1;
      return this._stuckRepeats >= this._stuckLimit ? 'stuck' : '';
    }
    this._stuckRepeats = 0;
    this._moves += 1;
    this._queue = action.commands.slice(1);
    applyBotCommand(game, action.commands[0]!);
    return 'acted';
  }
}
