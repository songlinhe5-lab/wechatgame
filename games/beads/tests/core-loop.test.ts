/**
 * S1 core-loop §8 criteria (gdd/core-loop.md §8, quoted verbatim in test names).
 */

import { describe, it, expect } from 'vitest';
import { createBeadsHarness, simpleTestLevel, firstEmptyCell, placeColor, burnToRemaining } from './helpers.js';
import { gridLayoutFor } from '../src/config/tuning.js';
import { SAVE_KEY } from '../src/game/save-schema.js';

describe('S1 core-loop', () => {
  // §8.1 冷启动无存档 → 直接进入第 1 关 PLAYING，全程无主菜单；有存档 → 续进已解锁最远关。
  it('§8-1 cold start with no save enters level 1; a save resumes the furthest level', () => {
    // 关表用**受控 3 关夹具**而非出货关表：本例断言的是「续进已解锁最远关」，
    // 写死 `toBe(2)` 却隐含「出货关表 ≥ 3 关」——§3.7 v1.46 pre-release 重置后关表
    // 会逐张入关而变动（现 1 关），不该连带改动本判据。先例：board-input-timing
    // 的 `noAssemble + levels: [simpleTestLevel()]` 写法（冷/热启动共用一份，钳制语义不变）。
    const levels = [simpleTestLevel({ id: 91 }), simpleTestLevel({ id: 92 }), simpleTestLevel({ id: 93 })];
    // Cold start: no document in storage → level 1, straight into PLAYING.
    const cold = createBeadsHarness({
      noAssemble: true, levels, saveKey: 'wxgame.beads.test.s1cold'
    });
    expect(cold.game.phase).toBe('playing');
    expect(cold.game.levelIndex).toBe(0);

    // Warm start: a save with currentLevel = 3 resumes there.
    const storage = cold.platform.createStorage();
    storage.set(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        runs: 5,
        maxUnlockedLevel: 3,
        currentLevel: 3,
        sprintBestScore: 0,
        sprintBestStage: 0,
      }),
    );
    const warm = createBeadsHarness({
      noAssemble: true, levels, saveKey: SAVE_KEY, storage
    });
    expect(warm.game.phase).toBe('playing');
    expect(warm.game.levelIndex).toBe(2);
  });

  // playtest 计量件（校准 SEC_PER_TAP 用）：玩家在 PLAYING 里每点一下计一（**含误点**），
  // 换关归零。口径 = 真路由 `_handleTap`（与玩家触摸同一条路）；四个公开命令的旁路没有
  // 「点」这个概念 ⇒ 不计（placeColor / bot 那类驱动不会污染读数）。
  // 另加一个**定星口径**计量 `actionsThisLevel`：只计四个公开玩法命令返回 true 的那次，
  // 与 `beads-bot` 完全同口径，因此可与关卡真源 `pricing.actions` 直接对表。
  it('§8-附 本局点击计数：玩法点击含误点都计、公开命令旁路不计、换关归零；有效动作只计真改变了世界的', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel(), simpleTestLevel({ id: 92 })],
      saveKey: 'wxgame.beads.test.s1taps',
    });
    const cell = firstEmptyCell(h.game)!;
    // 设计数点必须用**游戏自己的相机**推格心（命中函数 = `hitGridCell(_layout, _camera.zoom, …)`）；
    // 不拼相机则坐标落在格外 ⇒ tap 被静默忽略，测出来的是「没命中」而不是「没计数」。
    const cam = (h.game as unknown as { _camera: { zoom: number; offsetX: number; offsetY: number } })._camera;
    const layout = gridLayoutFor(h.game.grid.cols, h.game.grid.rows, cam);
    const p = { x: layout.colCenterX(cell.col), y: layout.rowCenterY(cell.row) };
    expect(h.game.debugHitCell(p.x, p.y), '探针坐标未命中目标格').toEqual({ row: cell.row, col: cell.col });

    // 未选托盘珠 ⇒ 点空格只给前置缺口轻提示（零事件、不消费），但**玩家确实点了一下** ⇒ 计数。
    expect(h.game.tapDesign(p.x, p.y)).toBe(false);
    expect(h.game.tapsThisLevel).toBe(1);
    // 定星口径（有效动作）与点计不同：什么都没改变 ⇒ 不计。
    expect(h.game.actionsThisLevel).toBe(0);

    // 旁路命令（giveTrayBead / selectTraySlot）不是「点击」⇒ 不动点计数；
    // 但它是四个公开命令之一且返回 true ⇒ **有效动作要计**（与 beads-bot `CMDS` 同口径）。
    const slot = h.game.giveTrayBead(h.game.grid.requiredColor(cell.row, cell.col));
    expect(h.game.selectTraySlot(slot)).toBe(true);
    expect(h.game.tapsThisLevel).toBe(1);
    expect(h.game.actionsThisLevel).toBe(1);

    // 点格落子 = 又一下。注意不断言 `tapDesign` 返回值：它 = 「相位变了 ∥ _consumedTap」，
    // 而托盘落子不置 `_consumedTap`（既有口径）⇒ 这里只断言计量与盘面事实。
    h.game.tapDesign(p.x, p.y);
    expect(h.game.tapsThisLevel).toBe(2);
    expect(h.game.actionsThisLevel).toBe(2);
    expect(h.game.grid.cell(cell.row, cell.col)!.state).toBe('filled');

    // 误点（落在格外、什么都不消费）⇒ **只加点不点动作**：这就是定星不能用 `clearTaps` 的理由。
    h.game.tapDesign(p.x + 9000, p.y);
    expect(h.game.tapsThisLevel).toBe(3);
    expect(h.game.actionsThisLevel).toBe(2);

    // 换关 ⇒ 两个计量同步归零（与相机/托盘同一「装配即复位」口径）。
    h.game.goToLevel(1);
    expect(h.game.tapsThisLevel).toBe(0);
    expect(h.game.actionsThisLevel).toBe(0);
  });

  // §8.5 可填格全满瞬间无论剩余时间多少 → 必进 LEVEL_CLEAR（同帧归零场景以 cleared 优先，
  // 用例：设剩余 0.01s 时放最后一颗）。
  it('§8-5 clearing the last cell with ~0.01s left → LEVEL_CLEAR, cleared beats same-frame zero', () => {
    // v2.0（WXG-T-136）：供料关停 ⇒ 夹具珠一律走 giveTrayBead 死路径直接投放，
    // 不再依赖「供料补珠」维持连打（原注释「every spawn is a still-needed colour」作废）。
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ decoys: [] })],
      saveKey: 'wxgame.beads.test.s1clear',
    });
    const game = harness.game;

    // Play the pattern down to its LAST empty cell (direct feed, no time passes).
    while (game.grid.filledCount < game.grid.fillableTotal - 1 && game.phase === 'playing') {
      const cell = firstEmptyCell(game)!;
      expect(
        placeColor(game, game.grid.requiredColor(cell.row, cell.col), cell.row, cell.col),
      ).toBe(true);
    }
    expect(game.grid.filledCount).toBe(game.grid.fillableTotal - 1);

    // Burn the countdown to ≈0.01–0.03 s. The step target keeps the final 1/60
    // step from overshooting 0.
    burnToRemaining(harness, 0.03);
    expect(game.remaining).toBeGreaterThan(0);
    expect(game.remaining).toBeLessThanOrEqual(0.05);
    expect(game.phase).toBe('playing');

    // The last cell: seed the matching bead via the dead path and place it —
    // cleared wins the same-frame race.
    const last = firstEmptyCell(game)!;
    expect(
      placeColor(game, game.grid.requiredColor(last.row, last.col), last.row, last.col),
    ).toBe(true);
    expect(game.phase).toBe('level-clear');
    expect(harness.count('level:cleared')).toBe(1);
    expect(harness.count('level:failed')).toBe(0);

    // Letting time pass afterwards never converts a clear into a failure.
    harness.advance(1);
    expect(game.phase).toBe('level-clear');
    expect(harness.count('level:failed')).toBe(0);
  });

  // §8.9 关卡数据含 BEAD_CHARSET 之外字符或全锁定格 → BOOT 拒绝进入该关（校验器报错，
  // 错误含关卡 id + 行列）。
  it('§8-9 illegal charset or all-locked levels are refused at BOOT (id + row + col in error)', () => {
    // Illegal character 'Z'.
    const badChar = createBeadsHarness({
      noAssemble: true,
      levels: [
        simpleTestLevel({ id: 91, pattern: ['123123', '123123', 'Z23123', '123123', '123123'] }),
      ],
      saveKey: 'wxgame.beads.test.s1bad1',
    });
    expect(badChar.game.phase).toBe('boot');
    expect(badChar.game.bootError).toContain('L91');
    expect(badChar.game.bootError).toContain('row2');
    expect(badChar.game.bootError).toContain('col0');

    // All-locked pattern (no fillable cell).
    const allLocked = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ id: 92, pattern: ['xxxxxx', 'xxxxxx', 'xxxxxx', 'xxxxxx', 'xxxxxx'] })],
      saveKey: 'wxgame.beads.test.s1bad2',
    });
    expect(allLocked.game.phase).toBe('boot');
    expect(allLocked.game.bootError).toContain('L92');

    // A valid table boots normally (control).
    const ok = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.s1ok',
    });
    expect(ok.game.phase).toBe('playing');
  });
});
