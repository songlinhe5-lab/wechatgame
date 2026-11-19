/**
 * EP15-S3 · 回放播放器（ADR-0038 DEC-3/DEC-8 / `bot-replay §2.3.3–§2.3.4`）。
 *
 * 语义：
 * - **`step` 权威**：命令按 `step` 精确注入；`atMs` 只服务进度条 / 时间标签。
 * - **倍速只缩放呈现时钟**：`tick(dtMs)` 累加 `dtMs × speed`，注入粒度恒为 `fixedDtMs`。
 * - **seek = 从头重演**：销毁影子 → 按 `levelId / seed / context` 重建 → 空跑到目标 step。
 * - **播放到头**：停在最终帧，不自动循环；终局校验用 {@link ReplayPlayer.checkFinal}。
 *
 * 分层铁律：⛔ `cc` / DOM / `wx` / `window` / `document` / `view/**` / `ui/**` / `palette`。
 */

import type { BeadsSnapshot } from '../game/state';
import type { BeadsLevelRaw } from '../config/levels';
import type { BeadsTuning, PowerupType } from '../config/tuning';
import { REPLAY_FIXED_DT_MS, REPLAY_SPEEDS } from '../config/tuning';
import { applyBotCommand } from '../bot/apply';
import type { BotCommand } from '../bot/types';
import {
  captureReplayFinal,
  findReplayLevel,
  validateRecording,
  type ReplayEvent,
  type ReplayFinal,
  type ReplayRecording,
} from './recorder';
import { createReplaySandboxGame, type ReplaySandbox } from './sandbox';

export interface ReplayPlayerOptions {
  readonly levels: readonly BeadsLevelRaw[];
  readonly tuning?: BeadsTuning;
  readonly width?: number;
  readonly height?: number;
}

export interface ReplayFinalCheck {
  readonly ok: boolean;
  /** 不一致字段名（`cleared` / `remainingMs` / `actions` / `misplacedLeft` / `trayHolding` / `grid` / `tray`）。 */
  readonly diffs: readonly string[];
  readonly actual: ReplayFinal;
}

/**
 * 播放器。默认进入即播放（S4 的「进入回放页」语义）；UI 只读本类的 get 与
 * `snapshot`，⛔ 不直接操作影子实例。
 */
export class ReplayPlayer {
  readonly recording: ReplayRecording;
  private readonly _options: ReplayPlayerOptions;
  private readonly _fixedDtMs: number;
  private readonly _durationStep: number;
  private readonly _valid: boolean;
  private readonly _invalidReason: string;
  private _sandbox: ReplaySandbox | null = null;
  /** 影子已推进的步数（= 当前呈现 step）。 */
  private _step = 0;
  /** 下一条待注入事件下标（事件表只读、按 step 非降序）。 */
  private _nextEvent = 0;
  private _accMs = 0;
  private _playing = true;
  private _ended = false;
  private _speed = 1;
  private _finalCheck: ReplayFinalCheck | null = null;

  constructor(rec: ReplayRecording, options: ReplayPlayerOptions) {
    this.recording = rec;
    this._options = options;
    this._fixedDtMs = rec.fixedDtMs > 0 ? rec.fixedDtMs : REPLAY_FIXED_DT_MS;
    this._durationStep = Math.max(0, Math.round(rec.durationMs / this._fixedDtMs));
    const verdict = validateRecording(rec, findReplayLevel(options.levels, rec.levelId));
    this._valid = verdict.ok;
    this._invalidReason = verdict.reason ?? '';
    if (this._valid) this._rebuild();
  }

  get valid(): boolean {
    return this._valid;
  }

  get invalidReason(): string {
    return this._invalidReason;
  }

  get playing(): boolean {
    return this._playing && !this._ended && this._valid;
  }

  get ended(): boolean {
    return this._ended;
  }

  get speed(): number {
    return this._speed;
  }

  get step(): number {
    return this._step;
  }

  get durationStep(): number {
    return this._durationStep;
  }

  get atMs(): number {
    return this._step * this._fixedDtMs;
  }

  get durationMs(): number {
    return this.recording.durationMs;
  }

  get progress(): number {
    return this._durationStep > 0 ? Math.min(1, this._step / this._durationStep) : 1;
  }

  /** 影子只读快照（⛔ 不写渲染层；UI 侧用与对局页同序同参的绑定构建画面）。 */
  get snapshot(): Readonly<BeadsSnapshot> | null {
    return this._sandbox?.game.snapshot ?? null;
  }

  /** 终局校验结果（播完后可读；未播完 = null）。 */
  get finalCheck(): ReplayFinalCheck | null {
    return this._finalCheck;
  }

  play(): void {
    if (!this._valid || this._ended) return;
    this._playing = true;
  }

  pause(): void {
    this._playing = false;
  }

  /** 倍速档（`REPLAY_SPEEDS` 之外的值忽略）。 */
  setSpeed(speed: number): void {
    if (REPLAY_SPEEDS.indexOf(speed) < 0) return;
    this._speed = speed;
  }

  /** seek（从头重演）：钳到 `[0, durationStep]`，松手才提交（拖动中暂停归 UI）。 */
  seek(step: number): void {
    if (!this._valid) return;
    const target = Math.max(0, Math.min(Math.round(step), this._durationStep));
    this._rebuild();
    for (let i = 0; i < target; i++) this._advance();
    this._accMs = 0;
    this._ended = target >= this._durationStep;
    this._finalCheck = this._ended ? this._checkFinal() : null;
  }

  /** 呈现时钟推进（`dtMs` = 帧间隔毫秒）。 */
  tick(dtMs: number): void {
    if (!this._valid || !this._playing || this._ended || dtMs <= 0) return;
    this._accMs += dtMs * this._speed;
    while (this._accMs >= this._fixedDtMs && !this._ended) {
      this._accMs -= this._fixedDtMs;
      this._advance();
    }
  }

  dispose(): void {
    this._sandbox?.dispose();
    this._sandbox = null;
  }

  // ─────────────────────────────────────────────────────────────── internals

  private _rebuild(): void {
    this._sandbox?.dispose();
    this._sandbox = createReplaySandboxGame(this.recording, this._options);
    this._step = 0;
    this._nextEvent = 0;
    this._accMs = 0;
    this._ended = false;
    this._finalCheck = null;
    this._injectAt(this._step);
  }

  private _advance(): void {
    const sandbox = this._sandbox;
    if (!sandbox || this._ended) return;
    sandbox.game.update(this._fixedDtMs / 1000);
    this._step += 1;
    // 注入本步事件（含终局那一步：录制侧最后一条命令也 stamp 在当前 step）。
    this._injectAt(this._step);
    if (this._step >= this._durationStep) {
      this._ended = true;
      this._finalCheck = this._checkFinal();
    }
  }

  /** 注入所有 `step <= 当前步` 的未消费事件（按录制顺序）。 */
  private _injectAt(step: number): void {
    const sandbox = this._sandbox;
    if (!sandbox) return;
    const events = this.recording.events;
    while (this._nextEvent < events.length && events[this._nextEvent]!.step <= step) {
      this._applyEvent(sandbox, events[this._nextEvent]!);
      this._nextEvent += 1;
    }
  }

  private _applyEvent(sandbox: ReplaySandbox, event: ReplayEvent): void {
    if (event.cmd === 'revive') {
      const bonus = event.args['bonusSec'];
      if (typeof bonus === 'number' && bonus > 0) sandbox.game.applySandboxRevive(bonus);
      return;
    }
    applyBotCommand(sandbox.game, toBotCommand(event));
  }

  private _checkFinal(): ReplayFinalCheck {
    const sandbox = this._sandbox;
    const expected = this.recording.final;
    if (!sandbox) return { ok: false, diffs: ['sandbox'], actual: expected };
    const actual = captureReplayFinal(sandbox.game);
    const diffs: string[] = [];
    if (actual.cleared !== expected.cleared) diffs.push('cleared');
    // `[WXG-T-994]` 剩余时间允许 **±1 个 fixedDt**（两端各自 round 到 ms ⇒ 再放宽 1ms）：
    // 录像 step = round(elapsed/fixedDt)，重演按整步消费 ⇒ 续时（`revive`）与终局落在
    // 半拍边界时会有一步量化偏差（≤17ms）。HUD 按「向上取整秒」显示，视觉恒同；
    // 权威判据（cleared / actions / misplaced / tray）仍严格。
    if (Math.abs(actual.remainingMs - expected.remainingMs) > this._fixedDtMs + 1) {
      diffs.push('remainingMs');
    }
    if (actual.actions !== expected.actions) diffs.push('actions');
    if (actual.misplacedLeft !== expected.misplacedLeft) diffs.push('misplacedLeft');
    if (actual.trayHolding !== expected.trayHolding) diffs.push('trayHolding');
    if (sandbox.game.grid.isComplete() !== expected.cleared) diffs.push('grid');
    return { ok: diffs.length === 0, diffs, actual };
  }
}

function toBotCommand(event: ReplayEvent): BotCommand {
  const args = event.args;
  const num = (key: string): number => {
    const value = args[key];
    return typeof value === 'number' ? value : 0;
  };
  switch (event.cmd) {
    case 'selectBoardBead':
      return { type: 'selectBoardBead', row: num('row'), col: num('col') };
    case 'tapGridCell':
      return { type: 'tapGridCell', row: num('row'), col: num('col') };
    case 'retrieveSelectedGroup':
      return { type: 'retrieveSelectedGroup', slot: num('slot') };
    case 'selectTraySlot':
      return { type: 'selectTraySlot', slot: num('slot') };
    case 'usePowerup':
      return { type: 'usePowerup', powerup: String(args['powerup']) as PowerupType };
    case 'expandTray':
      return { type: 'expandTray' };
    default:
      // 'revive' 已在上游分流；其余值 = 录像损坏（validate 已拦）。
      return { type: 'expandTray' };
  }
}
