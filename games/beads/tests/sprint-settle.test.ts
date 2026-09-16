/**
 * S7 冲刺结算面板判据（WXG-T-067）。
 *
 * 冻结来源
 *  - 判据：`gdd/score-combo.md §8-11`「破纪录：sprint 结算分 > S8 最佳 → **NEW BEST 显示且
 *    S8 写入新值**；≤ 最佳 → 不写不显示」；
 *  - 画面：`ux/ux-spec.md §3.5` **左列**——三行（单局 / 最高梯位 / 最高连击）+ 双钮
 *    （再来一局 / 返回关卡），且「冲刺归零：**不出现**续时主钮」；
 *  - 相位：`core-loop §4`（冲刺归零 → 冲刺结算，无续时）；`input-control §2.3`
 *    （GAME_OVER 仅结算面板按钮）；
 *  - 动画：面板入 / 出 200 / 150ms（`ux-spec §5`）。
 *
 * ⚠️ 本文件同时是**旧行为的回归闸门**：冲刺 `GAME_OVER` 此前「任意点击即重开本局」✗
 * （见 `tests/revive.test.ts` 里被本任务改写的同名用例）——§3.5/§2.3 要求只认两个按钮。
 */

import { describe, expect, it } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { DESIGN_H, DESIGN_W, PANEL_BUTTON_H, PANEL_PADDING, TOUCH_MIN } from '../src/config/tuning.js';
import {
  SPRINT_SETTLE_NEW_BEST,
  SPRINT_SETTLE_TITLE,
  SprintSettlePanel,
  formatScore,
  hitSprintSettle,
  sprintSettleLabel,
  sprintSettleLayout,
  sprintSettleRows,
} from '../src/systems/sprint-settle.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { createBeadsHarness, type Harness } from './helpers.js';

/** 短冲刺时长 ⇒ 测试跑得快（advance 步数 = 秒数）。 */
const SPRINT_TIME = 20;

function render(harness: Harness): readonly DrawCommand[] {
  const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
  builder.begin();
  buildBeadsView(builder, harness.game.snapshot, DEFAULT_PALETTE);
  return builder.end().commands;
}

function endSprint(h: Harness): void {
  while (h.game.phase === 'playing') h.advance(1);
  expect(h.game.phase).toBe('game-over');
}

/**
 * 落一颗匹配的珠子（取首个可填格的应填色）。落子不推进时钟 ⇒ 连击窗口不流逝，
 * 连续调用即连续连击（用于造「最高连击」）。
 */
function placeOne(h: Harness): boolean {
  const grid = h.game.grid;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!grid.isFillable(r, c)) continue;
      const slot = h.game.giveTrayBead(grid.requiredColor(r, c));
      if (slot < 0) return false;
      h.game.selectTraySlot(slot);
      return h.game.tapGridCell(r, c);
    }
  }
  return false;
}

function tapSettle(h: Harness, id: 'again' | 'back'): boolean {
  const rect = sprintSettleLayout().buttons.find((b) => b.id === id)!.rect;
  return h.game.tapDesign((rect.xMin + rect.xMax) / 2, (rect.yMin + rect.yMax) / 2);
}

describe('S7 冲刺结算面板（ux-spec §3.5 左列 / score-combo §8-11）', () => {
  it('lays a centred plate with three rows and two ≥TOUCH_MIN buttons inside it', () => {
    const layout = sprintSettleLayout();
    const plate = layout.panel;
    expect((plate.xMin + plate.xMax) / 2).toBe(DESIGN_W / 2);
    expect((plate.yMin + plate.yMax) / 2).toBe(DESIGN_H / 2);

    expect(layout.rows).toHaveLength(3);
    for (let i = 1; i < layout.rows.length; i++) {
      expect(layout.rows[i]!.y).toBeLessThan(layout.rows[i - 1]!.y); // 自上而下
    }
    expect(layout.rows[0]!.y).toBeLessThan(layout.titleY);
    expect(layout.rows[2]!.y).toBeGreaterThan(plate.yMin);

    expect(layout.buttons.map((b) => b.id)).toEqual(['again', 'back']);
    for (const button of layout.buttons) {
      expect(button.rect.yMax - button.rect.yMin).toBe(PANEL_BUTTON_H);
      expect(button.rect.yMax - button.rect.yMin).toBeGreaterThanOrEqual(TOUCH_MIN);
      expect(button.rect.xMin).toBeGreaterThan(plate.xMin);
      expect(button.rect.xMax).toBeLessThan(plate.xMax);
      expect(button.rect.yMin).toBeGreaterThan(plate.yMin);
    }
    // 主钮在左、两钮不重叠；角标落在底板内右侧。
    expect(layout.buttons[0]!.rect.xMax).toBeLessThan(layout.buttons[1]!.rect.xMin);
    expect(layout.badge.xMax).toBeLessThan(plate.xMax);
    expect(layout.badge.yMin).toBeGreaterThan(plate.yMin);
  });

  // BD-45（WXG-T-127）回归：原 120 宽底衬容不下 28px「NEW BEST」（Chrome 实测 147px）
  // ⇒ 白字两端溢出深底、落在白面板上隐形（实测读成「EW BES」，T-124 丙案视觉回归）。
  it('BD-45 回归：NEW BEST 底衬容得下 28px 文字，且不与标题行重叠', () => {
    const layout = sprintSettleLayout();
    const badgeW = layout.badge.xMax - layout.badge.xMin;
    // 147（28px 实测文宽）+ 两侧各 ≈10 填充 ⇒ ≥160；一旦有人缩回 120 本条即红。
    expect(badgeW).toBeGreaterThanOrEqual(160);
    // 标题「冲刺结束」= 40px × 4 字 ⇒ 半宽 80；角标左缘须在其右侧（原回归里文字压标题）。
    expect(layout.badge.xMin).toBeGreaterThanOrEqual(DESIGN_W / 2 + 80);
    // 角标仍在底板内、贴右内缩。
    expect(layout.badge.xMax).toBeLessThanOrEqual(layout.panel.xMax - PANEL_PADDING);
  });

  // BD-45（WXG-T-127）回归（渲染侧）：角标文字**固定 28px**（F7⑤「数字/标题/按钮字号
  // 不随开关变化」）—— 35px 的 E2 放大版实测 183px，会令 168 底衬再度溢出。
  it('BD-45 回归：badge text renders at a fixed 28px font, never the scaled body face', () => {
    const h = createBeadsHarness({ sprintTime: SPRINT_TIME, saveKey: 'wxgame.beads.test.ss-badge' });
    h.game.startSprint();
    expect(placeOne(h)).toBe(true); // score > 0 ⇒ 结算必 NEW BEST
    while (h.game.phase === 'playing') h.advance(1);
    expect(h.game.snapshot.isNewBest).toBe(true);

    const badgeText = render(h).find(
      (c) => c.kind === 'text' && c.text === SPRINT_SETTLE_NEW_BEST,
    ) as Extract<DrawCommand, { kind: 'text' }> | undefined;
    expect(badgeText, 'NEW BEST 文字未渲染（isNewBest 应显示角标）').toBeDefined();
    expect(badgeText!.font).toBe('28px sans-serif');

    // 同源钉：渲染出的角标底衬矩形 == sprintSettleLayout().badge（逐值相等）。
    const badge = sprintSettleLayout().badge;
    const badgeRect = render(h).find(
      (c) =>
        c.kind === 'rect' &&
        c.x === badge.xMin &&
        c.y === badge.yMin &&
        c.w === badge.xMax - badge.xMin &&
        c.h === badge.yMax - badge.yMin,
    );
    expect(badgeRect, '角标底衬矩形与 layout 脱节（两套坐标）').toBeDefined();
  });

  it('formats the three rows exactly as §3.5 shows', () => {
    expect(formatScore(12340)).toBe('12,340');
    expect(formatScore(0)).toBe('0');
    expect(formatScore(-5)).toBe('0');
    expect(sprintSettleRows({ score: 12340, bestStage: 6, bestStreak: 14 })).toEqual([
      '12,340',
      '第 7 梯',
      '▸×5 最高连击 14',
    ]);
    // 无连击（bestStreak=0）时第 3 行给占位，而不是「×1 最高连击 0」。
    expect(sprintSettleRows({ score: 0, bestStage: 0, bestStreak: 0 })[2]).toBe('—');
    expect(sprintSettleLabel('again')).toBe('再来一局');
    expect(sprintSettleLabel('back')).toBe('返回关卡');
    expect(SPRINT_SETTLE_TITLE).toContain('冲刺');
    expect(SPRINT_SETTLE_NEW_BEST).toBe('NEW BEST');
  });

  it('resolves hits only inside the two buttons', () => {
    const layout = sprintSettleLayout();
    const primary = layout.buttons[0]!.rect;
    const secondary = layout.buttons[1]!.rect;
    const centre = (r: { xMin: number; xMax: number; yMin: number; yMax: number }) =>
      [(r.xMin + r.xMax) / 2, (r.yMin + r.yMax) / 2] as const;

    expect(hitSprintSettle(...centre(primary))).toBe('again');
    expect(hitSprintSettle(...centre(secondary))).toBe('back');
    expect(hitSprintSettle(primary.xMax + 5, primary.yMin + 5)).toBeNull(); // 两钮间隙
    expect(hitSprintSettle(DESIGN_W / 2, layout.rows[0]!.y)).toBeNull(); // 内容行
    expect(hitSprintSettle(0, 0)).toBeNull();
  });

  it('ramps 0→1 on open, 1→0 on close, and ignores taps while fading out', () => {
    const panel = new SprintSettlePanel();
    expect(panel.visible).toBe(false);
    expect(panel.progress).toBe(0);
    expect(panel.hitTest(DESIGN_W / 2, 0)).toBeNull();

    panel.open();
    expect(panel.interactive).toBe(true);
    panel.update(100);
    expect(panel.progress).toBeGreaterThan(0);
    expect(panel.progress).toBeLessThan(1);
    panel.update(200);
    expect(panel.progress).toBe(1);

    const rect = sprintSettleLayout().buttons[0]!.rect;
    const centre: [number, number] = [(rect.xMin + rect.xMax) / 2, (rect.yMin + rect.yMax) / 2];
    panel.close();
    expect(panel.interactive).toBe(false);
    expect(panel.hitTest(...centre)).toBeNull();
    panel.update(150);
    expect(panel.visible).toBe(false);
    expect(panel.progress).toBe(0);
  });

  it('opens on sprint timeout with no revive entry and zero response outside the buttons', () => {
    const h = createBeadsHarness({ sprintTime: SPRINT_TIME, saveKey: 'wxgame.beads.test.ss-open' });
    h.game.startSprint();
    endSprint(h);

    expect(h.game.sprintSettle.visible).toBe(true);
    expect(h.game.snapshot.sprintSettleVisible).toBe(true);
    // §3.5：冲刺**不出现**续时主钮 —— 请求续时是 no-op，失败面板也不参与。
    expect(h.game.requestRevive()).toBe(false);
    expect(h.count('level:failed')).toBe(1);

    for (const [x, y] of [
      [20, 20],
      [DESIGN_W / 2, sprintSettleLayout().rows[0]!.y],
    ] as const) {
      expect(h.game.tapDesign(x, y)).toBe(false);
      expect(h.game.phase).toBe('game-over');
    }
  });

  it('§8-11: a score above the best shows NEW BEST and writes it to the save', () => {
    const h = createBeadsHarness({ sprintTime: SPRINT_TIME, saveKey: 'wxgame.beads.test.ss-best' });
    h.game.startSprint();
    expect(placeOne(h)).toBe(true); // 落 1 颗 ⇒ score > 0（最佳初始为 0）
    endSprint(h);

    expect(h.game.isNewBest).toBe(true);
    expect(h.game.snapshot.isNewBest).toBe(true);
    const ended = h.last<{ score: number; settleScore: number; bestStage: number }>('sprint:ended')!;
    expect(ended.score).toBeGreaterThan(0);
    expect(ended.settleScore).toBe(ended.score); // 结算分 = 单局分（§8-11 与 §8-8 同值）
    expect(h.game.sprintBestScore).toBe(ended.score); // 写盘
  });

  it('§8-11: after a relaunch, a score not above the best hides NEW BEST and writes nothing', () => {
    // 借一个 harness 的 storage 传给两个 harness ⇒ 真·「重启」语义（不是「0 > 0」那种弱用例）。
    const shared = createBeadsHarness({
      sprintTime: SPRINT_TIME,
      saveKey: 'wxgame.beads.test.ss-shared-1',
    }).platform.createStorage();
    const KEY = 'wxgame.beads.test.ss-relaunch';

    const first = createBeadsHarness({ sprintTime: SPRINT_TIME, saveKey: KEY, storage: shared });
    first.game.startSprint();
    expect(placeOne(first)).toBe(true);
    endSprint(first);
    const best = first.game.sprintBestScore;
    expect(best).toBeGreaterThan(0);
    expect(first.game.isNewBest).toBe(true);

    // 重启（同一 storage）：一颗不落 ⇒ score 0 ≤ best ⇒ 不显示 NEW BEST、不写盘。
    const second = createBeadsHarness({ sprintTime: SPRINT_TIME, saveKey: KEY, storage: shared });
    expect(second.game.sprintBestScore).toBe(best); // 续读到历史最佳
    second.game.startSprint();
    endSprint(second);
    expect(second.last<{ score: number }>('sprint:ended')!.score).toBe(0);
    expect(second.game.isNewBest).toBe(false);
    expect(second.game.snapshot.isNewBest).toBe(false);
    expect(second.game.sprintBestScore).toBe(best); // 未被 0 覆盖
  });

  it('shows the run’s best stage and best streak, and survives a break', () => {
    const h = createBeadsHarness({ sprintTime: SPRINT_TIME, saveKey: 'wxgame.beads.test.ss-lines' });
    h.game.startSprint();
    expect(placeOne(h)).toBe(true);
    expect(placeOne(h)).toBe(true);
    expect(placeOne(h)).toBe(true);
    expect(h.game.sprintTracker.bestStreak).toBe(3);

    endSprint(h);
    expect(h.game.snapshot.sprintRunBestStreak).toBe(3);
    expect(h.game.snapshot.sprintRunBestStage).toBe(h.game.sprintTracker.bestStage);
    expect(sprintSettleRows({
      score: h.game.snapshot.score,
      bestStage: h.game.snapshot.sprintRunBestStage,
      bestStreak: h.game.snapshot.sprintRunBestStreak,
    })[2]).toBe('▸×2 最高连击 3');
  });

  it('§3.5: 「再来一局」 restarts a fresh sprint, 「返回关卡」 returns to normal', () => {
    const again = createBeadsHarness({ sprintTime: SPRINT_TIME, saveKey: 'wxgame.beads.test.ss-again' });
    again.game.startSprint();
    expect(placeOne(again)).toBe(true);
    endSprint(again);
    expect(tapSettle(again, 'again')).toBe(true);
    expect(again.game.phase).toBe('playing');
    expect(again.game.mode).toBe('sprint');
    expect(again.game.sprintTracker.score).toBe(0); // 新一局
    again.advance(0.2);
    expect(again.game.sprintSettle.visible).toBe(false); // 淡出跑完

    const back = createBeadsHarness({ sprintTime: SPRINT_TIME, saveKey: 'wxgame.beads.test.ss-back' });
    back.game.startSprint();
    endSprint(back);
    expect(tapSettle(back, 'back')).toBe(true);
    expect(back.game.phase).toBe('playing');
    expect(back.game.mode).toBe('normal'); // 「返回关卡」⇒ 回普通战役
  });
});
