/**
 * S11 机器人策略契约（EP15-S1）—— 与 `gdd/bot-replay.md §2.2.2` 逐字对齐。
 *
 * 分层铁律（ADR-0038 DEC-1）：本目录只做**纯逻辑**——
 * ⛔ import `cc` / DOM / `wx` / `window` / `document` / `view/**` / `ui/**` / `palette`；
 * ⛔ 消费 `services.rng` / `Math.random`（L4）；对 `BeadsGame` 只 `import type`。
 * 策略可无头运行：Node 单测与回放影子共用同一份实现。
 */

import type { PowerupType } from '../config/tuning';

export interface BotObservation {
  readonly levelId: string;
  readonly seed: number;
  readonly remainingMs: number;
  readonly grid: {
    readonly cols: number;
    readonly rows: number;
    readonly cells: readonly {
      readonly row: number;
      readonly col: number;
      readonly state: 'empty' | 'filled' | 'locked';
      /** filled 时有效（珠色），否则 -1。 */
      readonly colorIdx: number;
      /** 底色；锁定/void 为 -1。 */
      readonly requiredColorIdx: number;
    }[];
  };
  readonly tray: {
    readonly capacity: number;
    readonly slots: readonly {
      readonly index: number;
      readonly state: 'free' | 'holding';
      readonly colorIdx: number;
    }[];
  };
  readonly selection: {
    readonly kind: 'none' | 'board' | 'tray';
    readonly row?: number;
    readonly col?: number;
    readonly slot?: number;
  };
  readonly powerups: readonly { readonly type: PowerupType; readonly usable: boolean }[];
}

export type BotCommand =
  | { readonly type: 'selectBoardBead'; readonly row: number; readonly col: number }
  | { readonly type: 'retrieveSelectedGroup'; readonly slot: number }
  | { readonly type: 'selectTraySlot'; readonly slot: number }
  | { readonly type: 'tapGridCell'; readonly row: number; readonly col: number }
  | { readonly type: 'usePowerup'; readonly powerup: PowerupType }
  | { readonly type: 'expandTray' };

/** 一次「人类可感知的批量动作」= 1–2 条原语命令，按序在连续固定步执行。 */
export interface BotAction {
  readonly commands: readonly BotCommand[];
}

export interface BotPolicy {
  readonly id: string;
  readonly version: number;
  /** null = 当前观测下无合法动作（卡死）。纯函数：不得改写入参、不得读时钟/随机数。 */
  decide(obs: BotObservation): BotAction | null;
}
