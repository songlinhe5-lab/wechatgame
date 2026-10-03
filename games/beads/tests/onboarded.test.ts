import { beforeEach, describe, expect, it } from 'vitest';
import { createBeadsHarness, simpleTestLevel } from './helpers.js';
import { SAVE_KEY } from '../src/game/save-schema.js';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';

/**
 * WXG-T-097 · BD-32 —— 引导判定改显式 `onboarded` 标记。
 *
 * 病灶：旧判定 `runs > 0`，而 `runs` 每次 BOOT 自增 ⇒ 首玩玩家**落子前**杀进程，
 * 重启时 runs=1 被判老玩家 ⇒ 首屏引导永久消失。修后：判定只信 `save.onboarded`
 * （首次落子置 true 并落盘）；v2 存量档（无字段）由 normalize 以 `runs > 0`
 * 一次性迁移。
 */

function v2Doc(runs: number): Record<string, unknown> {
  return {
    version: 2,
    runs,
    maxUnlockedLevel: 1,
    currentLevel: 1,
    sprintBestScore: 0,
    sprintBestStage: 0,
    starsByLevel: [],
    settings: { bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false },
  };
}

describe('WXG-T-097 BD-32 显式引导标记', () => {
  let storage: ReturnType<NodePlatform['createStorage']>;
  beforeEach(() => {
    storage = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }).createStorage();
  });

  it('v2 存量档迁移：runs=5（无字段）⇒ onboarded=true（老玩家不重看引导）', () => {
    storage.set(SAVE_KEY, JSON.stringify(v2Doc(5)));
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: SAVE_KEY,
      storage,
    });
    h.advance(1 / 60);
    expect(h.game.snapshot.onboarding).toBe(false);
  });

  // ⚠ [WXG-T-239 · 2026-10-04 用户裁「先把新手引导留档，实现上先屏蔽掉，后期统一调整」]
  //    `ONBOARDING_ENABLED = false` ⇒ `onboarding`（**显示**标志）恒 false ⇒ 原断言 `true` 前提被推翻。
  // ⇒ 改双重断言：**迁移结果正确**（存档 `onboarded === false`，即该玩家仍属「未引导」）
  //   + **显示层已被开关屏蔽**（`onboarding === false`）。
  // ⚠ 恢复引导（开关置 true）时本腿应改回 `expect(onboarding).toBe(true)`。
  it('v2 存量档迁移：runs=0（从未玩过）⇒ 存档 onboarded=false（未引导）；显示层当前被开关屏蔽', () => {
    storage.set(SAVE_KEY, JSON.stringify(v2Doc(0)));
    const h = createBeadsHarness({
      noAssemble: true,
            levels: [simpleTestLevel()],
            saveKey: SAVE_KEY,
            storage,
    });
    h.advance(1 / 60);
    // ① 迁移结果（**真正的被测对象**，不受屏蔽影响）
    expect(JSON.parse(String(storage.get(SAVE_KEY)))['onboarded']).toBe(false);
    // ② 显示层：屏蔽中
    expect(h.game.snapshot.onboarding).toBe(false);
  });

  it('BD-32 病灶回归：首玩 BOOT（runs 自增落盘）后、**落子前**杀进程 ⇒ 重启引导仍在', () => {
    // BOOT#1：首玩（runs 0→1 落盘），不落子。
    const first = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: SAVE_KEY,
      storage,
    });
    first.advance(1 / 60);
    // [WXG-T-239] 引导显示已屏蔽 ⇒ 断言口径改为「**存档标记**仍为未引导」（本腿真正被测对象）。
    expect(first.game.snapshot.onboarding).toBe(false);
    expect(JSON.parse(String(storage.get(SAVE_KEY)))['onboarded']).toBe(false);
    // ——此处「杀进程」：同一 storage 开新 harness（旧实例弃用，不落子）。
    const second = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: SAVE_KEY,
      storage,
    });
    second.advance(1 / 60);
    // 旧判定 runs>0 会在此 false（永久失引导）；显式标记下**存档仍标记「未引导」**。
    // [WXG-T-239] 引导显示已被 `ONBOARDING_ENABLED = false` 屏蔽 ⇒ 断言改看**存档标记**
    //   （本腿真正被测对象：BD-32 的「BOOT 自增 runs 不得吃掉引导」）。
    // ⚠ 恢复引导时本行应改回 `expect(second.game.snapshot.onboarding).toBe(true)`。
    expect(JSON.parse(String(storage.get(SAVE_KEY)))['onboarded']).toBe(false);
    expect(second.game.snapshot.onboarding).toBe(false);
  });

  it('首次落子置标记并落盘 ⇒ 重启不再见引导', () => {
    const first = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: SAVE_KEY,
      storage,
    });
    first.advance(1 / 60);
    expect(first.game.giveTrayBead(1)).toBeGreaterThanOrEqual(0);
    expect(first.game.selectTraySlot(0)).toBe(true);
    // 任意空格放置（归位裁决通过与否不影响「落子即清引导」）——用首个 fillable。
    const grid = first.game.grid;
    outer: for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (grid.isFillable(r, c)) {
          first.game.tapGridCell(r, c);
          break outer;
        }
      }
    }
    expect(first.game.snapshot.onboarding).toBe(false);
    // 重启：标记已落盘 ⇒ 引导不再出现。
    const second = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: SAVE_KEY,
      storage,
    });
    second.advance(1 / 60);
    expect(second.game.snapshot.onboarding).toBe(false);
  });
});
