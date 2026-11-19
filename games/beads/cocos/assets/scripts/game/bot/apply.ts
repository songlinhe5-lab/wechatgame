/**
 * S11 命令适配器（EP15-S1）：把策略意图落成 `BeadsGame` 公开命令。
 *
 * 分层铁律：只调公开命令（ADR-0038 §1.2 事实表）；不碰内部字段。
 * `retrieveSelectedGroup` 的现公开签名无 `slot` 形参（固定入 `tray.firstFree()`）⇒
 * `args.slot` 必须等于 `firstFree()`，否则返回 false（ADR-0038 §4.3 末条，⛔ 不为此新增公开方法）。
 */

import type { BeadsGame } from '../game/beads-game';
import type { BotCommand } from './types';

/** @returns 该命令是否被 `BeadsGame` 接受（true 才计一次有效动作）。 */
export function applyBotCommand(game: BeadsGame, cmd: BotCommand): boolean {
  switch (cmd.type) {
    case 'selectBoardBead':
      return game.selectBoardBead(cmd.row, cmd.col);
    case 'retrieveSelectedGroup':
      return game.tray.firstFree() === cmd.slot && game.retrieveSelectedGroup();
    case 'selectTraySlot':
      return game.selectTraySlot(cmd.slot);
    case 'tapGridCell':
      return game.tapGridCell(cmd.row, cmd.col);
    case 'usePowerup':
      return game.usePowerup(cmd.powerup);
    case 'expandTray':
      return game.expandTray();
  }
}
