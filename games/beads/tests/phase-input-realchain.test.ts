/**
 * 面板四相位 · **真链**输入触达判据（WXG-T-100 / BD-34）。
 *
 * 为什么需要这个文件（缺陷 BD-34，沉淀 K-038）：
 *   `_readInput()` 此前全仓唯一调用点在 `_stepPlaying()` 内 ⇒ `paused` / `game-over` /
 *   `level-clear` / `finish` 四相位**根本不读输入**，面板按钮的真链点击（浏览器指针、
 *   微信 touch）被 `InputManager.endFrame()` 丢弃而非延后 ⇒ 真人在浏览器里过第一关后
 *   **点不动结算面板**；点齿轮进暂停后，面板是唯一出口 ⇒ **永久卡死**。
 *   既有面板单测与探针一律走 `game.tapDesign()`（旁路 = 直连 `_handleTap`），
 *   ⇒ 旁路恒绿、真链恒断，长期无人测到。
 *
 * 本文件补的就是那条缺失的**真链口径**：用
 *   `input.beginFrame()` → `input.push({phase:'down'})` → `game.update(dt)` → `input.endFrame(dt)`
 * （`tapInFrame`，与 `App._fixedUpdate` = `beginFrame → game.update` / `tick → endFrame` 同形）
 * 在四相位各点面板按钮中心，并断言结果与**同坐标 `tapDesign()`** 一致 ⇒ 双口径对照。
 *
 * 判据来源（每条红例逐条对应）：
 *  - `gdd/input-control.md §2.3 状态门禁`：`PAUSED` 仅暂停面板按钮；`LEVEL_CLEAR` /
 *    `GAME_OVER` / `FINISH` 仅结算/失败面板按钮；`BOOT` 全部忽略；
 *  - `gdd/input-control.md §8-8`：「PAUSED 状态点击托盘/网格/道具：全部忽略；**仅面板按钮响应**」；
 *  - `gdd/pause-settings.md §2.1/§2.2`：齿轮唯一入口（仅 `PLAYING` 有效）；面板按钮清单
 *    继续 / 重玩本关 / 音乐 / 音效（+ 行3 可访问性开关与去冲刺）；遮罩吃掉其余一切；
 *  - `ux/ux-spec.md §4` 矩阵：`LEVEL_CLEAR | 下一关 / 去冲刺`；`FINISH | 去冲刺 / 重玩第 1 关`；
 *    `GAME_OVER | 续时 / 重试本关`；
 *  - `gdd/core-loop.md §2.2.2` / `gdd/pause-settings.md §6` 帧内序：
 *      **输入（段内序：状态指令 → 玩法事件）→ 连击窗 → 供料 → 计时**
 *    ⇒ 读输入必须**先于** `machine.update()`（本单把 `_readInput()` 上提到 `update()` 头部即守此序）。
 *
 * ⚠️ 本文件是**红→绿闸门**：改动前四条真链断言必须红（`tapDesign` 侧恒绿作对照）；
 *    只有真链绿了才算接通，不许用 `tapDesign` 冒充。
 */

import { describe, expect, it } from 'vitest';
import { GEAR_HIT_SIZE, HUD_BAND } from '../src/config/tuning.js';
import { pausePanelLayout, type PanelRect, type PausePanelAction } from '../src/systems/pause-panel.js';
import { clearPanelLayout } from '../src/systems/clear-panel.js';
import { finishPanelLayout } from '../src/systems/finish-panel.js';
import { failPanelLayout } from '../src/systems/fail-panel.js';
import { createBeadsHarness, simpleTestLevel, tapInFrame, advancePastClearWave, type Harness } from './helpers.js';

// ─────────────────────────────────────────────────────────────────────── helpers

/** 与 `App` 默认固定步长同值（`App._fixedUpdate` / `helpers.advance` 同口径）。 */
const STEP = 1 / 60;

function centre(rect: PanelRect): { x: number; y: number } {
  return { x: (rect.xMin + rect.xMax) / 2, y: (rect.yMin + rect.yMax) / 2 };
}

/** 齿轮热区中心（`pause-settings §2.1`，仅 `PLAYING` 有效）。 */
function gearPoint(): { x: number; y: number } {
  return { x: GEAR_HIT_SIZE / 2, y: (HUD_BAND.yMin + HUD_BAND.yMax) / 2 };
}

function pauseButton(id: PausePanelAction): { x: number; y: number } {
  const button = pausePanelLayout('normal').buttons.find((b) => b.id === id);
  if (!button) throw new Error(`pause panel: no button "${id}"`);
  return centre(button.rect);
}

function clearButton(id: 'next' | 'sprint', lastLevel: boolean): { x: number; y: number } {
  const button = clearPanelLayout({ lastLevel }).buttons.find((b) => b.id === id);
  if (!button) throw new Error(`clear panel: no button "${id}"`);
  return centre(button.rect);
}

function finishButton(id: 'replay' | 'sprint', levelCount: number): { x: number; y: number } {
  const button = finishPanelLayout(levelCount).buttons.find((b) => b.id === id);
  if (!button) throw new Error(`finish panel: no button "${id}"`);
  return centre(button.rect);
}

function failButton(id: 'revive' | 'retry', reviveAvailable: boolean): { x: number; y: number } {
  const button = failPanelLayout(reviveAvailable).buttons.find((b) => b.id === id);
  if (!button) throw new Error(`fail panel: no button "${id}"`);
  return centre(button.rect);
}

/** 面板外的遮罩点：四套面板布局都不含它（用来钉「面板外零响应」）。 */
const SCRIM_POINT = { x: 375, y: 1250 } as const;

/**
 * 造一对**同态** harness：`real` 走真链、`bypass` 走 `tapDesign`。
 * 两者同 seed / 同关卡 / 同装配序 ⇒ 装配完成后相位与内部态一致（每次断言前核对）。
 */
function mkPair(saveKey: string, levels: readonly ReturnType<typeof simpleTestLevel>[]): {
  real: Harness;
  bypass: Harness;
} {
  return {
    real: createBeadsHarness({
      noAssemble: true, levels, saveKey: `${saveKey}.real`
    }),
    bypass: createBeadsHarness({
      noAssemble: true, levels, saveKey: `${saveKey}.bypass`
    }),
  };
}

const TWO_LEVELS = [simpleTestLevel({ id: 90 }), simpleTestLevel({ id: 91 })];

/** 装配：暂停（齿轮走 `tapDesign` —— 面板相位之前，`PLAYING` 侧旁路即等价）。 */
function setupPaused(h: Harness): void {
  const gear = gearPoint();
  expect(h.game.tapDesign(gear.x, gear.y)).toBe(true);
  expect(h.game.phase).toBe('paused');
}

/** 装配：跑到 `GAME_OVER`（不注入输入，令倒计时自然归零）。 */
function setupGameOver(h: Harness): void {
  let guard = 0;
  while (h.game.phase === 'playing') {
    h.advance(0.5);
    if (++guard > 2000) throw new Error('setupGameOver: ran away');
  }
  expect(h.game.phase).toBe('game-over');
}

/** 装配：填满整块棋盘 ⇒ 进 `LEVEL_CLEAR`。 */
function setupLevelClear(h: Harness): void {
  const grid = h.game.grid;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (!grid.isFillable(row, col)) continue;
      const slot = h.game.giveTrayBead(grid.requiredColor(row, col));
      if (slot < 0) throw new Error(`setupLevelClear: tray full at (${row},${col})`);
      h.game.selectTraySlot(slot);
      if (!h.game.tapGridCell(row, col)) throw new Error(`setupLevelClear: rejected (${row},${col})`);
    }
  }
  expect(h.game.phase).toBe('level-clear');
  // 裁定 1（WXG-T-146）：面板要等 G4 波浪演完才开 ⇒ 装配阶段就推过门，
  // 后面的「点面板按钮」才能命中（本文件测的是输入路由链，不是面板延迟本身）。
  advancePastClearWave(h);
}

/** 装配：单关表填满 → 结算面板主钮（末关文案「查看结果」）⇒ 进 `FINISH`。 */
function setupFinish(h: Harness): void {
  setupLevelClear(h);
  const next = clearButton('next', true);
  expect(h.game.tapDesign(next.x, next.y)).toBe(true);
  expect(h.game.phase).toBe('finish');
}

// ────────────────────────────────────────────────────────────────── 判据 ①–④

describe('面板四相位 · 真链输入触达（input-control §2.3 / §8-8|pause-settings §2.1|ux-spec §4）', () => {
  // §2.3「PAUSED：仅暂停面板按钮」。这条正是 BD-34 登记的「永久卡死」场景：
  // 暂停面板是唯一出口 ⇒ 真链收不到「继续」= 出不去。
  it('paused：真链点「继续」→ 真回 playing（与同坐标 tapDesign 一致）', () => {
    const { real, bypass } = mkPair('wxgame.beads.test.rc-paused', TWO_LEVELS);
    setupPaused(real);
    setupPaused(bypass);
    expect(real.game.phase).toBe(bypass.game.phase);

    const resume = pauseButton('resume');
    const before = real.emitted.length;
    tapInFrame(real, resume.x, resume.y); // ← 真链：beginFrame → push(down) → update → endFrame
    bypass.game.tapDesign(resume.x, resume.y); // ← 旁路对照

    expect(real.game.phase).toBe('playing'); // 改码前此断言红（相位仍 paused）
    expect(bypass.game.phase).toBe('playing');
    expect(real.game.phase).toBe(bypass.game.phase);
    expect(real.count('game:resumed')).toBe(1);
    expect(bypass.count('game:resumed')).toBe(1);
    expect(real.emitted.length).toBeGreaterThan(before);
  });

  // §2.2 面板按钮清单：开关类按钮（不改相位）在真链下同样必须生效并即写档。
  it('paused：真链点「音乐开关」→ bgmMuted 取反并即写档（与 tapDesign 一致）', () => {
    const { real, bypass } = mkPair('wxgame.beads.test.rc-paused-bgm', TWO_LEVELS);
    setupPaused(real);
    setupPaused(bypass);
    expect(real.game.bgmMuted).toBe(false);

    const bgm = pauseButton('toggle-bgm');
    tapInFrame(real, bgm.x, bgm.y);
    bypass.game.tapDesign(bgm.x, bgm.y);

    expect(real.game.bgmMuted).toBe(true); // 改码前此断言红（仍 false）
    expect(bypass.game.bgmMuted).toBe(true);
    expect(real.game.snapshot.bgmMuted).toBe(true);
    const saved = JSON.parse(real.storage.get('wxgame.beads.test.rc-paused-bgm.real') as string) as {
      settings: { bgmMuted: boolean };
    };
    expect(saved.settings.bgmMuted).toBe(true);
  });

  // §2.3「GAME_OVER：仅结算/失败面板按钮」（ux-spec §4：续时 / 重试本关）。
  it('game-over：真链点「重试本关」→ 真回 playing 且本关重开（与同坐标 tapDesign 一致）', () => {
    const { real, bypass } = mkPair('wxgame.beads.test.rc-over', TWO_LEVELS);
    setupGameOver(real);
    setupGameOver(bypass);
    expect(real.game.phase).toBe(bypass.game.phase);
    expect(real.game.remaining).toBeLessThanOrEqual(0);

    const retry = failButton('retry', true);
    tapInFrame(real, retry.x, retry.y);
    bypass.game.tapDesign(retry.x, retry.y);

    expect(real.game.phase).toBe('playing'); // 改码前此断言红
    expect(bypass.game.phase).toBe('playing');
    expect(real.game.levelIndex).toBe(bypass.game.levelIndex);
    expect(real.game.remaining).toBeGreaterThan(0); // 本关重开：倒计时回满
    // ⚠️ 真链与旁路在此**不应**精确相等，差恰 1 帧 dt：真链的重试发生在 `update()` 的
    // 输入段内 ⇒ 同帧随后照常跑「连击窗 → 供料 → 计时」把本帧 dt tick 掉；而 `tapDesign`
    // 在帧外发生、不消耗 dt。这正是「输入先于计时」帧内序（`pause-settings §6`）的
    // 可观测后果，也与 §8-2「≤1 帧 dt may be consumed by the resume frame itself」同口径。
    const delta = bypass.game.remaining - real.game.remaining;
    expect(delta).toBeGreaterThanOrEqual(0);
    expect(delta).toBeLessThanOrEqual(STEP + 1e-9);
  });

  // §2.3「LEVEL_CLEAR：仅结算面板按钮」（ux-spec §4：下一关 / 去冲刺）。
  it('level-clear：真链点「下一关」→ 真进第 2 关（与同坐标 tapDesign 一致）', () => {
    const { real, bypass } = mkPair('wxgame.beads.test.rc-clear', TWO_LEVELS);
    setupLevelClear(real);
    setupLevelClear(bypass);
    expect(real.game.phase).toBe(bypass.game.phase);

    const next = clearButton('next', false);
    tapInFrame(real, next.x, next.y);
    bypass.game.tapDesign(next.x, next.y);

    expect(real.game.phase).toBe('playing'); // 改码前此断言红
    expect(bypass.game.phase).toBe('playing');
    expect(real.game.levelIndex).toBe(1);
    expect(real.game.levelIndex).toBe(bypass.game.levelIndex);
  });

  // §2.3「FINISH：仅面板按钮」（ux-spec §4：去冲刺 / 重玩第 1 关）。
  it('finish：真链点「重玩第 1 关」→ 真回第 1 关 playing（与同坐标 tapDesign 一致）', () => {
    const levels = [simpleTestLevel()];
    const { real, bypass } = mkPair('wxgame.beads.test.rc-finish', levels);
    setupFinish(real);
    setupFinish(bypass);
    expect(real.game.phase).toBe(bypass.game.phase);

    const replay = finishButton('replay', levels.length);
    tapInFrame(real, replay.x, replay.y);
    bypass.game.tapDesign(replay.x, replay.y);

    expect(real.game.phase).toBe('playing'); // 改码前此断言红
    expect(bypass.game.phase).toBe('playing');
    expect(real.game.levelIndex).toBe(0);
    expect(real.game.levelIndex).toBe(bypass.game.levelIndex);
  });
});

// ────────────────────────────────────────────── 负向闸门：面板外零响应（四相位）

describe('面板四相位 · 真链「面板外零响应」（input-control §2.3 / pause-settings §2.2）', () => {
  const cases: {
    name: string;
    key: string;
    levels: readonly ReturnType<typeof simpleTestLevel>[];
    setup: (h: Harness) => void;
    phase: string;
  }[] = [
      { name: 'paused', key: 'rc-n-paused', levels: TWO_LEVELS, setup: setupPaused, phase: 'paused' },
      { name: 'game-over', key: 'rc-n-over', levels: TWO_LEVELS, setup: setupGameOver, phase: 'game-over' },
      { name: 'level-clear', key: 'rc-n-clear', levels: TWO_LEVELS, setup: setupLevelClear, phase: 'level-clear' },
      { name: 'finish', key: 'rc-n-finish', levels: [simpleTestLevel()], setup: setupFinish, phase: 'finish' },
    ];

  for (const c of cases) {
    it(`${c.name}：真链点面板外（遮罩/空白）→ 零事件、零相位变化`, () => {
      const h = createBeadsHarness({
        noAssemble: true, levels: c.levels, saveKey: `wxgame.beads.test.${c.key}`
      });
      c.setup(h);
      expect(h.game.phase).toBe(c.phase);

      const before = h.emitted.length;
      tapInFrame(h, SCRIM_POINT.x, SCRIM_POINT.y);

      expect(h.game.phase).toBe(c.phase); // 未误推进 / 未误重开
      expect(h.emitted.length).toBe(before); // 零事件
    });
  }
});
