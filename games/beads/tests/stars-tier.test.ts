/**
 * EP14-S1 · 星级结算新制集成臂（§3.7 v1.78 / star-collect-rule R1–R5，WXG-T-288 立项）。
 *
 * 判据源 = `design/gdd/score-combo.md §8-1`（v1.78 四臂族）中**需要玩法接线**的两臂：
 * ①「下次主动进入档 = 本关历史最高 +1（封顶 3★）」——经存档往返模拟重进；
 * ②「失败不续时 = 本局无星」——失败重试后仍无星、不写档。
 * 纯函数臂（三线两侧采样 / 续时保底 / 越界归一）在 `tuning.test.ts`，本文件不重复。
 */
import { describe, expect, it } from 'vitest';
import { createBeadsHarness, placeColor, simpleTestLevel } from './helpers';
import type { BeadsGame } from '../src/game/beads-game';

type Harness = ReturnType<typeof createBeadsHarness>;

/** 逐格正填整盘（同 `revive.test.ts` 判例；不耗游戏时间 ⇒ 用时 ≈ 已 advance 秒数）。 */
function fillBoard(game: BeadsGame): void {
  for (let row = 0; row < game.grid.rows; row++) {
    for (let col = 0; col < game.grid.cols; col++) {
      if (!game.grid.isFillable(row, col)) continue;
      placeColor(game, game.grid.requiredColor(row, col), row, col);
    }
  }
}

/** 把倒计时跑到 game-over（不续时腿）。 */
function expire(harness: Harness): void {
  while (harness.game.phase === 'playing') harness.advance(0.5);
  expect(harness.game.phase).toBe('game-over');
}

function makeHarness(saveKey: string, relaunchFrom?: Harness): Harness {
  return createBeadsHarness({
    noAssemble: true,
    levels: [simpleTestLevel()], // time = 300 ⇒ 3★ 线 210 / 2★ 线 255
    saveKey,
    // 重开模拟 = 共享 storage 实例（helpers :53-54 判例；同 saveKey 不共盘读不到）。
    storage: relaunchFrom?.storage,
  });
}

describe('星级新制集成（§3.7 v1.78 · EP14-S1）', () => {
  it('快通（用时 ≤3★ 线）⇒ 1★ 档进场当场跳 3★，且下次进场 = 3★ 档（封顶）', () => {
    const key = 'wxgame.beads.test.stars-tier.fast';
    const h1 = makeHarness(key);
    expect(h1.game.tierThisLevel).toBe(1); // 新档 = 无历史 +1
    fillBoard(h1.game); // 用时 ≈ 0 ≤ 210
    expect(h1.game.phase).toBe('level-clear');
    const payload = h1.last<{ stars: number }>('level:cleared')!;
    expect(payload.stars).toBe(3); // 旧制此处只会给 1★（选档即定星）
    // 重进（经存档往返）：档 = 历史最高 3 + 1 ⇒ 封顶 3★
    const h2 = makeHarness(key, h1);
    expect(h2.game.tierThisLevel).toBe(3);
  });

  it('慢通（用时 >2★ 线）⇒ 拿 1★；下次进场 2★ 档；再 2★ 通关 ⇒ 再进 3★ 档', () => {
    const key = 'wxgame.beads.test.stars-tier.slow';
    const h1 = makeHarness(key);
    // 耗 260s（> 2★ 线 255、< 倒计时 300）后填盘 ⇒ 用时判 1★
    for (let i = 0; i < 520; i++) h1.advance(0.5);
    fillBoard(h1.game);
    expect(h1.game.phase).toBe('level-clear');
    expect(h1.last<{ stars: number }>('level:cleared')!.stars).toBe(1);
    const h2 = makeHarness(key, h1);
    expect(h2.game.tierThisLevel).toBe(2); // 1★ + 1
    // 2★ 档 total = 255：立刻填盘用时 ≈ 0 ⇒ 按用时跳 3★（R1：档只收紧时钟，不压星）
    fillBoard(h2.game);
    expect(h2.last<{ stars: number }>('level:cleared')!.stars).toBe(3);
    const h3 = makeHarness(key, h2);
    expect(h3.game.tierThisLevel).toBe(3);
  });

  it('超时失败且不续时 ⇒ 无星、不写历史（重试进场仍 1★ 档）', () => {
    const key = 'wxgame.beads.test.stars-tier.fail';
    const h1 = makeHarness(key);
    expire(h1);
    expect(h1.last<{ stars: number }>('level:cleared')).toBeUndefined();
    expect(h1.game.retryLevel()).toBe(true); // 重试 = 主动重进腿
    expect(h1.game.tierThisLevel).toBe(1); // 无星历史 ⇒ 仍 1★
    expect(h1.game.phase).toBe('playing');
  });
});
