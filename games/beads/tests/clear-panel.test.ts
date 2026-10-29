/**
 * S7 结算·过关面板判据（WXG-T-063；`[WXG-T-509]` 精简重设计）。
 *
 * 冻结来源：`ux/ux-spec.md` §3.4（v1.40：四行内容 + 单钮）、§4（`LEVEL_CLEAR` 等按钮）、
 * §5（星入场逐颗 150ms）。数值与几何镜像在 `config/tuning.ts`。
 *
 * 本文件钉三件事：① 新几何（520×440 / 内容区 400×192 / 320×92 单钮）；
 * ② 内容精简（只留 星 / 用时 / 豆 / 差距提示）；③ 时长文案（<60 秒 → `41秒`，≥60 → `1分05秒`）。
 */

import { describe, expect, it } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import {
  CLEAR_ACTION_H,
  CLEAR_ACTION_W,
  CLEAR_PANEL_SIZE,
  CLEAR_PLAQUE_H,
  CLEAR_PLAQUE_W,
  CLEAR_SECONDARY_H,
  CLEAR_SECONDARY_W,
  DESIGN_H,
  DESIGN_W,
  TOUCH_MIN,
  normalSettleScore,
} from '../src/config/tuning.js';
import {
  CLEAR_PANEL_TITLE,
  ClearPanel,
  clearPanelLabel,
  clearPanelLayout,
  hitClearPanel,
} from '../src/systems/clear-panel.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS } from '../src/view/palette.js';
import { buildBeadsFrame } from '../src/view/view-model.js';
import { formatDurationCn } from '../src/view/ui-theme.js';
import { createBeadsHarness, simpleTestLevel, advancePastClearWave, type Harness } from './helpers.js';

const NORMAL = { lastLevel: false } as const;

function render(harness: Harness, patch: Partial<Harness['game']['snapshot']> = {}): readonly DrawCommand[] {
  const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
  builder.begin();
  buildBeadsFrame(builder, { ...harness.game.snapshot, ...patch }, DEFAULT_PALETTE, DEMO_BEAD_INKS);
  return builder.end().commands;
}

/** 填满整块棋盘（不推进时钟 ⇒ 通关时剩余 = 总量 ⇒ ratio = 1 ⇒ 3★）。 */
function fillBoard(harness: Harness): void {
  const grid = harness.game.grid;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!grid.isFillable(r, c)) continue;
      const slot = harness.game.giveTrayBead(grid.requiredColor(r, c));
      if (slot < 0) throw new Error(`tray full at (${r},${c})`);
      harness.game.selectTraySlot(slot);
      if (!harness.game.tapGridCell(r, c)) throw new Error(`place failed at (${r},${c})`);
    }
  }
}

function tapButton(harness: Harness, id: 'next' | 'sprint', lastLevel = false): boolean {
  const rect = clearPanelLayout({ lastLevel }).buttons.find((b) => b.id === id)!.rect;
  return harness.game.tapDesign((rect.xMin + rect.xMax) / 2, (rect.yMin + rect.yMax) / 2);
}

describe('S7 结算面板 · 精简几何（ux-spec §3.4 v1.41）', () => {
  it('板 520×470 居中；A2 木牌骑上沿；主钮 300×92 + 弱化 150×88', () => {
    const layout = clearPanelLayout(NORMAL);
    const plate = layout.panel;
    expect(plate.xMax - plate.xMin).toBe(CLEAR_PANEL_SIZE.w);
    expect(plate.yMax - plate.yMin).toBe(CLEAR_PANEL_SIZE.h);
    expect((plate.xMin + plate.xMax) / 2).toBe(DESIGN_W / 2);
    expect((plate.yMin + plate.yMax) / 2).toBe(DESIGN_H / 2);
    expect(layout.titleY).toBe(plate.yMax);
    expect(CLEAR_PLAQUE_W).toBe(200);
    expect(CLEAR_PLAQUE_H).toBe(64);

    expect(layout.buttons).toHaveLength(2);
    const [next, menu] = layout.buttons;
    expect(next!.id).toBe('next');
    expect(next!.rect.xMax - next!.rect.xMin).toBe(CLEAR_ACTION_W);
    expect(next!.rect.yMax - next!.rect.yMin).toBe(CLEAR_ACTION_H);
    expect(menu!.id).toBe('menu');
    expect(menu!.rect.xMax - menu!.rect.xMin).toBe(CLEAR_SECONDARY_W);
    expect(menu!.rect.yMax - menu!.rect.yMin).toBe(CLEAR_SECONDARY_H);
    expect(menu!.rect.yMax - menu!.rect.yMin).toBeGreaterThanOrEqual(TOUCH_MIN);
    // 同行、主左次右、都在板内。
    expect((next!.rect.yMin + next!.rect.yMax) / 2).toBe((menu!.rect.yMin + menu!.rect.yMax) / 2);
    expect(next!.rect.xMax).toBeLessThan(menu!.rect.xMin);
    expect(next!.rect.xMin).toBeGreaterThan(plate.xMin);
    expect(menu!.rect.xMax).toBeLessThan(plate.xMax);
  });

  it('四行自上而下：牌 > 星 > 用时 > 豆 >（提示），且全在 400×270 内容区内', () => {
    const l = clearPanelLayout(NORMAL);
    expect(l.titleY).toBeGreaterThan(l.starsY);
    expect(l.starsY).toBeGreaterThan(l.timeY);
    expect(l.timeY).toBeGreaterThan(l.rewardY);
    expect(l.rewardY).toBeGreaterThan(l.hintY);
    expect(l.hintY).toBeGreaterThan(l.buttons[0]!.rect.yMax);

    const inside = (y: number): boolean => y > l.content.yMin && y < l.content.yMax;
    for (const y of [l.starsY, l.timeY, l.rewardY, l.hintY]) expect(inside(y), `y=${y}`).toBe(true);
    expect(l.content.xMax - l.content.xMin).toBe(400);
    expect(l.content.yMax - l.content.yMin).toBe(270);
    expect(l.starsY + 36).toBeLessThan(l.content.yMax);
  });

  it('标题 = 「过关」；主钮 / 弱化次钮文案', () => {
    expect(CLEAR_PANEL_TITLE).toBe('过关');
    expect(clearPanelLabel('next', false)).toBe('下一关');
    expect(clearPanelLabel('next', true)).toBe('查看结果');
    expect(clearPanelLabel('menu', false)).toBe('回主界面');
    expect(clearPanelLabel('sprint', false)).toBe('▶ 去冲刺');
  });

  it('命中两钮；板外 / 原冲刺位零命中', () => {
    const layout = clearPanelLayout(NORMAL);
    const [next, menu] = layout.buttons;
    const centre = (r: { xMin: number; xMax: number; yMin: number; yMax: number }) =>
      [(r.xMin + r.xMax) / 2, (r.yMin + r.yMax) / 2] as const;
    expect(hitClearPanel(...centre(next!.rect), NORMAL)).toBe('next');
    expect(hitClearPanel(...centre(menu!.rect), NORMAL)).toBe('menu');
    expect(hitClearPanel(0, 0, NORMAL)).toBeNull();
    expect(hitClearPanel(next!.rect.xMin - 5, next!.rect.yMin + 5, NORMAL)).toBeNull();
  });
});

describe('S7 结算面板 · 时长文案（[WXG-T-509]）', () => {
  it('formatDurationCn：<60 秒用「秒」，≥60 秒进位，整分省略 00 秒', () => {
    expect(formatDurationCn(0)).toBe('0秒');
    expect(formatDurationCn(41)).toBe('41秒');
    expect(formatDurationCn(59)).toBe('59秒');
    expect(formatDurationCn(60)).toBe('1分');
    expect(formatDurationCn(65)).toBe('1分05秒');
    expect(formatDurationCn(120)).toBe('2分');
    expect(formatDurationCn(125)).toBe('2分05秒');
  });

  it('渲染串 = `用时41秒`（不是 mm:ss），且不含浮点尾数', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ id: 93 })],
      saveKey: 'wxgame.beads.test.cp-time',
    });
    fillBoard(h);
    advancePastClearWave(h);
    const level = h.game.snapshot.finishLevels[0]!;
    // 注入：本关用时 = 41 秒（剩余 = time − 41）⇒ 不依赖帧数。
    const cmds = render(h, { clearRemaining: level.time - 41 });
    const time = cmds.find((c) => c.kind === 'text' && c.text.startsWith('用时')) as
      | Extract<DrawCommand, { kind: 'text' }>
      | undefined;
    expect(time?.text).toBe('用时41秒');
    expect(time!.text).not.toContain(':');
    expect(time!.text).not.toContain('.');
  });

  it('满 3★：不画差距提示；2★：给出「再快N秒可得3★」；续时局不画', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ id: 94 })],
      saveKey: 'wxgame.beads.test.cp-hint',
    });
    fillBoard(h);
    advancePastClearWave(h);
    const level = h.game.snapshot.finishLevels[0]!;
    // 3★（用时 0）⇒ 提示不出现。
    const full = render(h, { clearStars: 3, clearStarsShown: 3, clearRemaining: level.time });
    expect(full.some((c) => c.kind === 'text' && c.text.startsWith('再快'))).toBe(false);

    // 2★：elapsed 220s，3★ 线 210s ⇒ 再快 10 秒。
    const two = render(h, { clearStars: 2, clearStarsShown: 2, clearRemaining: level.time - 220 });
    const hint = two.find((c) => c.kind === 'text' && c.text.startsWith('再快')) as
      | Extract<DrawCommand, { kind: 'text' }>
      | undefined;
    expect(hint?.text).toBe('再快10秒可得3★');

    // 续时局：星级与用时无关 ⇒ 整行不画。
    const revived = render(h, {
      clearStars: 2, clearStarsShown: 2, clearRemaining: level.time - 220, revived: true,
    });
    expect(revived.some((c) => c.kind === 'text' && c.text.startsWith('再快'))).toBe(false);
  });
});

describe('S7 结算面板 · 内容精简（[WXG-T-509]）', () => {
  it('只画四类内容：标题 / 星 / 用时 / 豆；品质分、判星长串、剩余/道具/动作、好友榜全部退场', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ id: 95 })],
      saveKey: 'wxgame.beads.test.cp-clean',
    });
    fillBoard(h);
    advancePastClearWave(h);
    const cmds = render(h, { clearCoins: 45, clearQualityScore: 4200, clearQualityBest: 5000 });

    const texts = cmds.filter((c) => c.kind === 'text').map((c) => String((c as { text?: string }).text ?? ''));
    expect(texts).toContain('过关');
    expect(texts.some((t) => t.startsWith('用时'))).toBe(true);
    expect(texts).toContain('+45 豆');
    for (const banned of ['品质分', '剩余', '动作', '好友', '这关榜', '3★ 用时']) {
      expect(texts.some((t) => t.includes(banned)), `不应再画「${banned}」`).toBe(false);
    }
  });
});

describe('S7 结算面板 · 时序与流转（不改）', () => {
  it('ramps progress 0→1 on open and 1→0 on close, and blocks taps while fading out', () => {
    const panel = new ClearPanel();
    expect(panel.visible).toBe(false);
    expect(panel.progress).toBe(0);
    expect(panel.hitTest(DESIGN_W / 2, 0, NORMAL)).toBeNull();

    panel.open();
    expect(panel.visible).toBe(true);
    expect(panel.interactive).toBe(true);
    panel.update(100);
    expect(panel.progress).toBeGreaterThan(0);
    expect(panel.progress).toBeLessThan(1);
    panel.update(200);
    expect(panel.progress).toBe(1);

    panel.close();
    expect(panel.interactive).toBe(false);
    const primary = clearPanelLayout(NORMAL).buttons[0]!.rect;
    expect(panel.hitTest((primary.xMin + primary.xMax) / 2, (primary.yMin + primary.yMax) / 2, NORMAL)).toBeNull();
    panel.update(150);
    expect(panel.visible).toBe(false);
    expect(panel.progress).toBe(0);
  });

  it('enters stars one every CLEAR_STAR_STEP_MS with a 0→1.2→1 pop', () => {
    const panel = new ClearPanel();
    panel.open();
    expect(panel.starsShown(3)).toBe(1);
    panel.update(150);
    expect(panel.starsShown(3)).toBe(2);
    panel.update(150);
    expect(panel.starsShown(3)).toBe(3);
    panel.update(150);
    expect(panel.starsShown(3)).toBe(3);

    const fresh = new ClearPanel();
    fresh.open();
    expect(fresh.starScale(0)).toBe(0);
    fresh.update(75);
    expect(fresh.starScale(0)).toBeCloseTo(1.2, 6);
    fresh.update(75);
    expect(fresh.starScale(0)).toBe(1);
  });

  it('opens on clear, does NOT auto-advance, and leaves via the single button', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ id: 91 }), simpleTestLevel({ id: 92 })],
      saveKey: 'wxgame.beads.test.cp-1',
    });
    fillBoard(h);
    expect(h.game.phase).toBe('level-clear');
    advancePastClearWave(h);
    expect(h.game.clearPanel.visible).toBe(true);

    h.advance(3);
    expect(h.game.phase).toBe('level-clear');
    expect(h.game.levelIndex).toBe(0);

    expect(h.game.clearPanel.interactive).toBe(true);
    expect(tapButton(h, 'next')).toBe(true);
    expect(h.game.phase).toBe('playing');
    expect(h.game.levelIndex).toBe(1);

    // 原副钮位（主钮右侧）零响应。
    const hidden = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ id: 91 }), simpleTestLevel({ id: 92 })],
      saveKey: 'wxgame.beads.test.cp-2',
    });
    fillBoard(hidden);
    advancePastClearWave(hidden);
    const onlyBtn = clearPanelLayout(NORMAL).buttons[0]!.rect;
    hidden.game.tapDesign(onlyBtn.xMax + 5, onlyBtn.yMin + 5);
    expect(hidden.game.phase).toBe('level-clear');
    expect(hidden.game.mode).toBe('normal');
  });

  it('assembles the settle data the panel shows (§8-2 C7 + stars)', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.cp-3',
    });
    fillBoard(h);
    expect(h.game.lastStars).toBe(3);
    const cleared = h.last<{ ratio: number; stars: number }>('level:cleared')!;
    expect(cleared.stars).toBe(3);
    expect(cleared.ratio).toBeCloseTo(1, 6);
    expect(h.game.lastSettleScore).toBe(
      normalSettleScore(cleared.stars, cleared.ratio, 0, false),
    );
    expect(h.game.lastSettleScore).toBe(4200);
    expect(h.game.snapshot.clearStars).toBe(3);
    expect(h.game.snapshot.clearLastLevel).toBe(true);
  });
});
