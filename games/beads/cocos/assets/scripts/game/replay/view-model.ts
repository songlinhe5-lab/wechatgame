/**
 * EP15-S3 · 回放只读视图模型（ADR-0038 DEC-1/DEC-8）：UI 的**唯一**数据入口。
 *
 * UI ⛔ import `bot/**` 的 `decide()` / 策略实现；只消费本文件的类型与
 * {@link writeReplayViewModel} 写出的只读对象（预分配、原地写，热路径零分配）。
 */

import type { BeadsLevelRaw } from '../config/levels';
import type { BeadsPhase } from '../game/state';
import { findReplayLevel, validateRecording, type ReplayRecording, type ReplaySource } from './recorder';
import type { ReplayPlayer } from './player';

/** 回放入口可用态（`ClearPanel` / 主菜单只读，S4 消费）。 */
export interface ReplayEntryState {
  readonly available: boolean;
  /** 不可用原因（`empty` = 无录像 / `truncated` / `levelHash` / …）。 */
  readonly reason: string;
}

/** 入口判定：录像存在 + 防呆全过（§8-8 置灰 / §8-12 禁用）。 */
export function replayEntryState(
  rec: ReplayRecording | null,
  levels: readonly BeadsLevelRaw[],
): ReplayEntryState {
  if (!rec) return { available: false, reason: 'empty' };
  const verdict = validateRecording(rec, findReplayLevel(levels, rec.levelId));
  return verdict.ok ? { available: true, reason: '' } : { available: false, reason: verdict.reason ?? 'invalid' };
}

/** 回放页只读模型（预分配；`writeReplayViewModel` 原地写，⛔ 每帧新建）。 */
export interface ReplayViewModel {
  visible: boolean;
  valid: boolean;
  invalidReason: string;
  source: ReplaySource | '';
  playing: boolean;
  ended: boolean;
  speed: number;
  step: number;
  durationStep: number;
  atMs: number;
  durationMs: number;
  progress: number;
  /** 影子相位（`level-clear` / `game-over` 作为「播放到头」信号）。 */
  phase: BeadsPhase;
  levelId: string;
  levelName: string;
  remaining: number;
  actions: number;
  puzzleCols: number;
  puzzleRows: number;
}

export function createReplayViewModel(): ReplayViewModel {
  return {
    visible: false,
    valid: false,
    invalidReason: '',
    source: '',
    playing: false,
    ended: false,
    speed: 1,
    step: 0,
    durationStep: 0,
    atMs: 0,
    durationMs: 0,
    progress: 0,
    phase: 'boot',
    levelId: '',
    levelName: '',
    remaining: 0,
    actions: 0,
    puzzleCols: 0,
    puzzleRows: 0,
  };
}

/** 原地写入（UI 每帧调用；player 为空 = 隐藏）。 */
export function writeReplayViewModel(
  out: ReplayViewModel,
  player: ReplayPlayer | null,
): ReplayViewModel {
  if (!player) {
    out.visible = false;
    out.playing = false;
    return out;
  }
  const snapshot = player.snapshot;
  out.visible = true;
  out.valid = player.valid;
  out.invalidReason = player.invalidReason;
  out.source = player.recording.source;
  out.playing = player.playing;
  out.ended = player.ended;
  out.speed = player.speed;
  out.step = player.step;
  out.durationStep = player.durationStep;
  out.atMs = player.atMs;
  out.durationMs = player.durationMs;
  out.progress = player.progress;
  out.phase = snapshot?.phase ?? 'boot';
  out.levelId = snapshot?.levelId ?? player.recording.levelId;
  out.levelName = snapshot?.levelName ?? '';
  out.remaining = snapshot?.remaining ?? 0;
  out.actions = player.recording.final.actions;
  out.puzzleCols = snapshot?.gridCols ?? 0;
  out.puzzleRows = snapshot?.gridRows ?? 0;
  return out;
}
