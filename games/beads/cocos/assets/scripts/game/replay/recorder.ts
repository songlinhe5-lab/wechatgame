/**
 * EP15-S3 · 录像录制器（ADR-0038 DEC-3 / `bot-replay §2.3.1–§2.3.2`）。
 *
 * 职责：按 `step` 权威记录输入级事件、起止与清理、上限降级（`truncated` 整份作废）。
 * 录制钩子由 `BeadsGameOptions.onCommandApplied` 上报（命令成功后），本类也**自驱**
 * 相位巡检（{@link ReplayRecorder.tick}）——起点 = 进入 `PLAYING`，终点 = `LEVEL_CLEAR`；
 * `GAME_OVER` 先挂起（可能续时），确认重试/离开才丢弃。
 *
 * 分层铁律（ADR-0038 DEC-1）：本目录 ⛔ `cc` / DOM / `wx` / `window` / `document` /
 * `view/**` / `ui/**` / `palette`；⛔ `Math.random`。对 `BeadsGame` 只 `import type`。
 */

import type { BeadsGame } from '../game/beads-game';
import type { BeadsLevelRaw } from '../config/levels';
import {
  REPLAY_EVENT_BYTES_ESTIMATE,
  REPLAY_FIXED_DT_MS,
  REPLAY_MAX_BYTES,
  REPLAY_MAX_EVENTS,
} from '../config/tuning';
import { levelHash, levelIdOf } from './level-hash';

export type ReplaySource = 'own-last' | 'bot-demo';

/** 录像事件命令值域 = `BotCommand['type'] | 'revive'`（`revive` = 系统时间线事件）。 */
export type ReplayCommand =
  | 'selectBoardBead'
  | 'retrieveSelectedGroup'
  | 'selectTraySlot'
  | 'tapGridCell'
  | 'usePowerup'
  | 'expandTray'
  | 'revive';

export interface ReplayEvent {
  /** 有效对局时间轴（毫秒），量化到 `fixedDtMs`；仅供显示 / seek 输入。 */
  readonly atMs: number;
  /** 权威定位：`round(atMs / fixedDtMs)`。 */
  readonly step: number;
  readonly cmd: ReplayCommand;
  readonly args: Readonly<Record<string, number | string>>;
}

export interface ReplayContext {
  readonly levelIndex: number;
  readonly starsBefore: number;
  readonly revived: boolean;
}

export interface ReplayFinal {
  readonly cleared: boolean;
  readonly failed: boolean;
  readonly remainingMs: number;
  /** 有效动作数（与 ClearPanel `clearActions` 同口径）。 */
  readonly actions: number;
  readonly misplacedLeft: number;
  readonly trayHolding: number;
  /** 仅展示快照，永不写档。 */
  readonly stars?: number;
}

export interface ReplayRecording {
  readonly v: 1;
  readonly source: ReplaySource;
  readonly levelId: string;
  readonly levelHash: string;
  /** 开局时 `services.rng.state` 快照（DEC-6）。 */
  readonly seed: number;
  readonly fixedDtMs: number;
  /** 有效对局时长（不含暂停）。 */
  readonly durationMs: number;
  readonly context: ReplayContext;
  readonly events: readonly ReplayEvent[];
  readonly final: ReplayFinal;
  readonly truncated: boolean;
  readonly policyId?: string;
}

// 内部可变形态（对外只暴露 `ReplayRecording` 的 readonly 类型）。
interface MutableRecording {
  v: 1;
  source: ReplaySource;
  levelId: string;
  levelHash: string;
  seed: number;
  fixedDtMs: number;
  durationMs: number;
  context: { levelIndex: number; starsBefore: number; revived: boolean };
  events: ReplayEvent[];
  final: ReplayFinal;
  truncated: boolean;
  policyId?: string;
}

export interface ReplayRecorderOptions {
  /** 录像种子来源：缺省 `() => 0`（测试显式给 `services.rng.state`）。 */
  readonly seed?: () => number;
  readonly fixedDtMs?: number;
  readonly maxEvents?: number;
  readonly maxBytes?: number;
}

/** 指令参数表（与 `ReplayEvent.args` 同型）。 */
export type ReplayCommandArgs = Readonly<Record<string, number | string>>;

/**
 * 录制器。生命周期：
 * `idle` --进入 PLAYING--> `recording` --LEVEL_CLEAR--> `idle`（`lastRecording` 更新）
 * `recording` --GAME_OVER--> `over` --续时--> `recording` / --重试·离场--> `idle`（丢弃）
 */
export class ReplayRecorder {
  private readonly _seed: () => number;
  private readonly _fixedDtMs: number;
  private readonly _maxEvents: number;
  private readonly _maxBytes: number;
  private _rec: MutableRecording | null = null;
  private _last: ReplayRecording | null = null;
  /** 上一份有效录像（`LEVEL_CLEAR` 产出；重试/重开不覆盖它，直到下一次过关）。 */
  private _state: 'idle' | 'recording' | 'over' = 'idle';
  /** 已入录的续时加时总量（与 `game.reviveBonusSec` 求差 ⇒ 每次续时一条事件）。 */
  private _revivedSec = 0;

  constructor(options: ReplayRecorderOptions = {}) {
    this._seed = options.seed ?? (() => 0);
    this._fixedDtMs = options.fixedDtMs ?? REPLAY_FIXED_DT_MS;
    this._maxEvents = options.maxEvents ?? REPLAY_MAX_EVENTS;
    this._maxBytes = options.maxBytes ?? REPLAY_MAX_BYTES;
  }

  get fixedDtMs(): number {
    return this._fixedDtMs;
  }

  /** 正在录制的录像（只读视图；无 = null）。 */
  get active(): ReplayRecording | null {
    return this._rec;
  }

  /** 上一份有效录像（`LEVEL_CLEAR` 产出）。 */
  get lastRecording(): ReplayRecording | null {
    return this._last;
  }

  /** 相位巡检（由壳层每帧在 `play.update` 之后调用）。 */
  tick(game: BeadsGame): void {
    const phase = game.phase;
    if (this._rec) {
      this._syncRevive(game);
      if (phase === 'level-clear') {
        this._finish(game);
        return;
      }
      if (phase === 'game-over' && this._state === 'recording') {
        this._state = 'over';
        return;
      }
      if (phase === 'boot' || phase === 'finish') {
        this.discard();
        return;
      }
    }
    if (this._state === 'idle') {
      if (phase === 'playing') this._begin(game);
      return;
    }
    if (this._state === 'over' && phase === 'playing') {
      if (game.revived) {
        // 续时（`revive` 事件已在 `_syncRevive` 入录）⇒ 继续同一份录像。
        this._state = 'recording';
        return;
      }
      // 重试 = 新局：旧录像按 GAME_OVER 丢弃（GDD §2.3.2）。
      this.discard();
      this._begin(game);
    }
  }

  /**
   * 公开命令成功后的录制入口（`BeadsGameOptions.onCommandApplied`）。
   * @param elapsedMs 有效对局毫秒（`game.elapsedPlayingMs`）
   */
  record(elapsedMs: number, cmd: ReplayCommand, args: ReplayCommandArgs): void {
    const rec = this._rec;
    if (!rec || rec.truncated) return;
    if (rec.events.length >= this._maxEvents) {
      rec.truncated = true;
      return;
    }
    if ((rec.events.length + 1) * REPLAY_EVENT_BYTES_ESTIMATE > this._maxBytes) {
      rec.truncated = true;
      return;
    }
    rec.events.push(this._event(rec, elapsedMs, cmd, args));
  }

  /** 主动丢弃当前录像（回主菜单 / 离场 / 崩溃恢复等）。 */
  discard(): void {
    this._rec = null;
    this._state = 'idle';
    this._revivedSec = 0;
  }

  /** 清空「上一局」槽位（新局开始前由壳层调用；GDD §2.3.2 清理行）。 */
  clearLast(): void {
    this._last = null;
  }

  private _begin(game: BeadsGame): void {
    const level = game.currentLevel;
    const li = game.levelIndex;
    this._revivedSec = game.reviveBonusSec;
    this._rec = {
      v: 1,
      source: 'own-last',
      levelId: levelIdOf(level),
      levelHash: levelHash(level),
      seed: this._seed(),
      fixedDtMs: this._fixedDtMs,
      durationMs: 0,
      context: { levelIndex: li, starsBefore: game.starsByLevelRaw[li] ?? 0, revived: false },
      events: [],
      final: emptyFinal(),
      truncated: false,
    };
    this._state = 'recording';
  }

  private _finish(game: BeadsGame): void {
    const rec = this._rec;
    if (!rec) return;
    rec.durationMs = game.elapsedPlayingMs;
    rec.context.revived = game.revived;
    rec.final = captureReplayFinal(game);
    // 边界（GDD §6）：`LEVEL_CLEAR` 但零事件 = 无效录像，不占「上一局」槽位。
    if (rec.events.length > 0) this._last = rec;
    this._rec = null;
    this._state = 'idle';
    this._revivedSec = 0;
  }

  private _syncRevive(game: BeadsGame): void {
    const rec = this._rec;
    if (!rec) return;
    const delta = game.reviveBonusSec - this._revivedSec;
    if (delta <= 0) return;
    this._revivedSec = game.reviveBonusSec;
    this.record(game.elapsedPlayingMs, 'revive', { bonusSec: delta });
  }

  private _event(
    rec: MutableRecording,
    elapsedMs: number,
    cmd: ReplayCommand,
    args: ReplayCommandArgs,
  ): ReplayEvent {
    const step = Math.max(0, Math.round(elapsedMs / rec.fixedDtMs));
    return { atMs: step * rec.fixedDtMs, step, cmd, args };
  }
}

function emptyFinal(): ReplayFinal {
  return { cleared: false, failed: false, remainingMs: 0, actions: 0, misplacedLeft: 0, trayHolding: 0 };
}

/** 终局摘要（录制 `final` 与影子重演校验共用同一口径）。 */
export function captureReplayFinal(game: BeadsGame): ReplayFinal {
  const grid = game.grid;
  const tray = game.tray;
  let misplaced = 0;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (grid.isMisplaced(row, col)) misplaced++;
    }
  }
  return {
    cleared: grid.isComplete(),
    failed: game.phase === 'game-over',
    remainingMs: Math.round(game.remaining * 1000),
    actions: game.actionsThisLevel,
    misplacedLeft: misplaced,
    trayHolding: tray.capacity - tray.freeCount,
    stars: game.lastStars,
  };
}

export interface ReplayValidation {
  readonly ok: boolean;
  readonly reason?: string;
}

/** 按 `levelId` 在关表里找关卡（找不到 ⇒ undefined）。 */
export function findReplayLevel(
  levels: readonly BeadsLevelRaw[],
  levelId: string,
): BeadsLevelRaw | undefined {
  for (const level of levels) {
    if (levelIdOf(level) === levelId) return level;
  }
  return undefined;
}

/**
 * 录像防呆（`bot-replay §8-12` / §6 非法数据）：任何一条不满足 ⇒ `invalid`，
 * 入口禁用、不崩溃。`level` 缺失（关表里找不到）按指纹不一致处理。
 */
export function validateRecording(
  rec: ReplayRecording,
  level: BeadsLevelRaw | undefined,
): ReplayValidation {
  if (rec.v !== 1) return { ok: false, reason: 'v' };
  if (!Number.isFinite(rec.seed)) return { ok: false, reason: 'seed' };
  if (!Number.isFinite(rec.fixedDtMs) || rec.fixedDtMs <= 0) return { ok: false, reason: 'fixedDtMs' };
  if (!rec.context || !Number.isFinite(rec.context.starsBefore)) {
    return { ok: false, reason: 'context' };
  }
  if (rec.truncated) return { ok: false, reason: 'truncated' };
  if (rec.events.length === 0) return { ok: false, reason: 'empty' };
  if (!level || levelIdOf(level) !== rec.levelId || levelHash(level) !== rec.levelHash) {
    return { ok: false, reason: 'levelHash' };
  }
  const maxStep = Math.round(rec.durationMs / rec.fixedDtMs) + 1;
  let prev = -1;
  for (const event of rec.events) {
    if (!Number.isFinite(event.step) || event.step < 0 || event.step > maxStep) {
      return { ok: false, reason: 'step-range' };
    }
    if (event.step < prev) return { ok: false, reason: 'step-order' };
    prev = event.step;
    if (event.cmd === 'revive') {
      const bonus = event.args['bonusSec'];
      if (typeof bonus !== 'number' || !Number.isFinite(bonus) || bonus <= 0) {
        return { ok: false, reason: 'revive-bonus' };
      }
    }
  }
  return { ok: true };
}
