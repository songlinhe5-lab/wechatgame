/**
 * S7 结算·过关面板判据（WXG-T-063）。
 *
 * 冻结来源：`ux/ux-spec.md` §3.4（面板内容与双钮）、§4（流转表 ⇒ `LEVEL_CLEAR` **等按钮**）、
 * §5（星入场逐颗 150ms）。数值与几何镜像在 `config/tuning.ts`。
 *
 * ⚠️ 本文件替代的旧行为：`LEVEL_CLEAR` 曾是「1.4s 后自动进下一关」的占位——§4 的流转表
 * 写的是「LEVEL_CLEAR → 下一关 / 去冲刺*(U1) → 玩法·n+1 / 玩法·冲刺」，故**存在不推进**
 * 与**两条按钮出口**两个方向都要钉住（第一条是这次改动的回归闸门）。
 */

import { describe, expect, it } from 'vitest';
import {
  DESIGN_H,
  DESIGN_W,
  PANEL_BUTTON_H,
  PANEL_SIZE,
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
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';

const NORMAL = { lastLevel: false } as const;

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

describe('S7 结算·过关面板（ux-spec §3.4/§4/§5）', () => {
  it('lays the plate on panel_dialog with two ≥TOUCH_MIN buttons inside it', () => {
    const layout = clearPanelLayout(NORMAL);
    const plate = layout.panel;
    expect(plate.xMax - plate.xMin).toBe(PANEL_SIZE.w);
    expect(plate.yMax - plate.yMin).toBe(PANEL_SIZE.h);
    expect((plate.xMin + plate.xMax) / 2).toBe(DESIGN_W / 2);
    expect((plate.yMin + plate.yMax) / 2).toBe(DESIGN_H / 2);

    expect(layout.buttons).toHaveLength(2);
    for (const button of layout.buttons) {
      expect(button.rect.yMax - button.rect.yMin).toBe(PANEL_BUTTON_H);
      expect(button.rect.yMax - button.rect.yMin).toBeGreaterThanOrEqual(TOUCH_MIN);
      // 按钮完全落在底板内。
      expect(button.rect.xMin).toBeGreaterThan(plate.xMin);
      expect(button.rect.xMax).toBeLessThan(plate.xMax);
      expect(button.rect.yMin).toBeGreaterThan(plate.yMin);
    }
    // 主/副钮不重叠，且主钮在左（视觉优先级序）。
    expect(layout.buttons[0]!.rect.xMax).toBeLessThan(layout.buttons[1]!.rect.xMin);
    // 标题/星级/信息三行自上而下排布（y 向上）。
    expect(layout.titleY).toBeGreaterThan(layout.starsY);
    expect(layout.starsY).toBeGreaterThan(layout.infoY);
  });

  it('switches the primary label on the last level only', () => {
    expect(clearPanelLabel('next', false)).toBe('下一关');
    expect(clearPanelLabel('next', true)).toBe('查看结果');
    expect(clearPanelLabel('sprint', false)).toBe('▶ 去冲刺');
    expect(CLEAR_PANEL_TITLE).toContain('闯关成功');
  });

  it('resolves hits only inside the two buttons', () => {
    const layout = clearPanelLayout(NORMAL);
    const primary = layout.buttons[0]!.rect;
    const secondary = layout.buttons[1]!.rect;
    const centre = (r: { xMin: number; xMax: number; yMin: number; yMax: number }) =>
      [(r.xMin + r.xMax) / 2, (r.yMin + r.yMax) / 2] as const;

    expect(hitClearPanel(...centre(primary), NORMAL)).toBe('next');
    expect(hitClearPanel(...centre(secondary), NORMAL)).toBe('sprint');
    // 底板空白处（两钮之间的间隙中心 = 无命中）。
    expect(hitClearPanel(primary.xMax + 5, primary.yMin + 5, NORMAL)).toBeNull();
    expect(hitClearPanel(0, 0, NORMAL)).toBeNull();
  });

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
    expect(panel.interactive).toBe(false); // 淡出期不接受点击
    const layout = clearPanelLayout(NORMAL);
    const primary = layout.buttons[0]!.rect;
    expect(panel.hitTest((primary.xMin + primary.xMax) / 2, (primary.yMin + primary.yMax) / 2, NORMAL)).toBeNull();
    panel.update(150);
    expect(panel.visible).toBe(false);
    expect(panel.progress).toBe(0);
  });

  it('enters stars one every CLEAR_STAR_STEP_MS with a 0→1.2→1 pop', () => {
    const panel = new ClearPanel();
    panel.open();
    // 第 1 颗在 t=0 入场（ux-spec §5「逐颗 150ms」⇒ 三颗共 450ms），其余每 150ms 一颗。
    expect(panel.starsShown(3)).toBe(1);
    panel.update(150);
    expect(panel.starsShown(3)).toBe(2);
    panel.update(150);
    expect(panel.starsShown(3)).toBe(3);
    panel.update(150); // 再等也不会多出第 4 颗（上限 = 星级）
    expect(panel.starsShown(3)).toBe(3);

    const fresh = new ClearPanel();
    fresh.open();
    expect(fresh.starScale(0)).toBe(0); // 还没入场
    fresh.update(75); // 半程 ⇒ 冲到 1.2
    expect(fresh.starScale(0)).toBeCloseTo(1.2, 6);
    fresh.update(75); // 全程结束 ⇒ 回到 1
    expect(fresh.starScale(0)).toBe(1);
  });

  it('opens on clear, does NOT auto-advance, and leaves via either button', () => {
    // ① 2 关表：过关后面板开、时间流逝不推进；点主钮 → 第 2 关。
    const h = createBeadsHarness({
      levels: [simpleTestLevel({ id: 91 }), simpleTestLevel({ id: 92 })],
      saveKey: 'wxgame.beads.test.cp-1',
    });
    fillBoard(h);
    expect(h.game.phase).toBe('level-clear');
    expect(h.game.clearPanel.visible).toBe(true);

    h.advance(3); // 旧实现会在 1.4s 自动进下一关 —— 现在必须原地等按钮
    expect(h.game.phase).toBe('level-clear');
    expect(h.game.levelIndex).toBe(0);

    expect(h.game.clearPanel.interactive).toBe(true);
    expect(tapButton(h, 'next')).toBe(true);
    expect(h.game.phase).toBe('playing');
    expect(h.game.levelIndex).toBe(1);

    // ② 同一出口也用于「去冲刺」（U1 第二处入口）。
    const sprint = createBeadsHarness({
      levels: [simpleTestLevel({ id: 91 }), simpleTestLevel({ id: 92 })],
      saveKey: 'wxgame.beads.test.cp-2',
    });
    fillBoard(sprint);
    expect(tapButton(sprint, 'sprint')).toBe(true);
    expect(sprint.game.phase).toBe('playing');
    expect(sprint.game.mode).toBe('sprint');
  });

  it('assembles the settle data the panel shows (§8-2 C7 + stars)', () => {
    const h = createBeadsHarness({
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.cp-3',
    });
    fillBoard(h);

    // 不推进时钟 ⇒ remaining = 总量 ⇒ ratio = 1 ⇒ 3★；未用道具 / 未扩托盘。
    expect(h.game.lastStars).toBe(3);
    const cleared = h.last<{ ratio: number; stars: number }>('level:cleared')!;
    expect(cleared.stars).toBe(3);
    expect(cleared.ratio).toBeCloseTo(1, 6);
    expect(h.game.lastSettleScore).toBe(
      normalSettleScore(cleared.stars, cleared.ratio, 0, false),
    );
    // C7：3×1000 + round(1×1000) − 0 + 200（未用扩展）= 4200。
    expect(h.game.lastSettleScore).toBe(4200);

    // 快照同步给视图的料：星级与「道具 n/3」分母。
    expect(h.game.snapshot.clearStars).toBe(3);
    expect(h.game.snapshot.clearLastLevel).toBe(true);
  });
});
