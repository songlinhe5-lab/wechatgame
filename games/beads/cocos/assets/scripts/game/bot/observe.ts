/**
 * S11 观测适配器（EP15-S1）：把 `BeadsGame` 的只读 getter 拍成纯数据 `BotObservation`。
 *
 * 分层铁律：只读、不写状态；`BeadsGame` 仅 `import type`（运行时只调实例上的公开 getter）。
 * 每次 `decide()` 前拍一次（托管 450ms/次、演示离线预计算）⇒ 非逐帧热路径，允许分配。
 */

import { POWERUP_TYPES } from '../config/tuning';
import type { BeadsGame } from '../game/beads-game';
import type { BotObservation } from './types';

export function observeGame(game: BeadsGame): BotObservation {
  const grid = game.grid;
  const cells: Array<BotObservation['grid']['cells'][number]> = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cell(row, col)!;
      // locked 同时覆盖 `x`（锁定珠）与 `.`（void）：对策略而言都不可填、底色无意义。
      cells.push({
        row,
        col,
        state: cell.state,
        colorIdx: cell.state === 'filled' ? cell.beadColorIdx : -1,
        requiredColorIdx: cell.state === 'locked' ? -1 : cell.colorIdx,
      });
    }
  }

  const tray = game.tray;
  const slots: Array<BotObservation['tray']['slots'][number]> = [];
  for (let index = 0; index < tray.capacity; index++) {
    const slot = tray.slot(index)!;
    const free = slot.state === 'free';
    slots.push({ index, state: free ? 'free' : 'holding', colorIdx: free ? 0 : slot.colorIdx });
  }

  const kind = game.selection;
  const board = game.boardSelected;
  const selection: BotObservation['selection'] =
    kind === 'board' && board
      ? { kind, row: board.row, col: board.col }
      : kind === 'tray'
        ? { kind, slot: tray.selectedSlot }
        : { kind: 'none' };

  const level = game.currentLevel;
  return {
    levelId: level.uid !== '' ? level.uid : String(level.id),
    // 策略本身不消费随机数（§2.2.3 规则 5）；录制层另行取 `services.rng.state`（ADR-0038 DEC-6）。
    seed: 0,
    remainingMs: game.remaining * 1000,
    grid: { cols: grid.cols, rows: grid.rows, cells },
    tray: { capacity: tray.capacity, slots },
    selection,
    powerups: POWERUP_TYPES.map((type) => ({ type, usable: game.powerups.freeUses(type) > 0 })),
  };
}
