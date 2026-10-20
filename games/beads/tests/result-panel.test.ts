/**
 * 结算弹窗共享骨架判据（WXG-T-307 / UI-33）。
 *
 * 正本 = `docs/architecture/ui-architecture-beads.md` §12 UI-33（过关 / 失败 / 冲刺结算 /
 * 全通关四个弹窗「共享结果骨架」；验收 = 四界面金样本对拍 + 意图一一对应）与 ADR-0032 §1
 * 第四行（「弹窗动画各面板自带 ⇒ 同一件事四份实现」）。
 *
 * 本文件只钉**共享**这件事：三个持时钟的结算面板走同一套开合口径、逐项入场走同一公式
 * （步长由调用方给）；各自的布局 / 命中 / 文案仍由 `*-panel.test.ts` 守。失败面板无开合
 * 时钟（由相位直接驱动），故不在此列。
 */
import { describe, expect, it } from 'vitest';
import {
  CLEAR_STAR_STEP_MS,
  FINISH_LEVEL_STEP_MS,
  PANEL_IN_MS,
  PANEL_OUT_MS,
} from '../src/config/tuning.js';
import { ClearPanel } from '../src/systems/clear-panel.js';
import { FinishPanel } from '../src/systems/finish-panel.js';
import { ResultPanelClock } from '../src/systems/result-panel.js';
import { SprintSettlePanel } from '../src/systems/sprint-settle.js';

const PANELS = [
  { name: 'ClearPanel', make: () => new ClearPanel() },
  { name: 'SprintSettlePanel', make: () => new SprintSettlePanel() },
  { name: 'FinishPanel', make: () => new FinishPanel() },
] as const;

describe('UI-33 结算弹窗共享骨架', () => {
  for (const { name, make } of PANELS) {
    it(`${name}：入场即可点 / 进度 0→1 / 退场零响应 / 退场后归零`, () => {
      const panel = make();
      expect(panel.visible).toBe(false);
      expect(panel.progress).toBe(0);
      expect(panel.interactive).toBe(false);

      panel.open();
      expect(panel.visible).toBe(true);
      expect(panel.interactive).toBe(true); // 旧口径：入场帧起即可点
      expect(panel.progress).toBe(0);
      panel.update(PANEL_IN_MS / 2);
      expect(panel.progress).toBeCloseTo(0.5);
      panel.update(PANEL_IN_MS);
      expect(panel.progress).toBe(1);
      expect(panel.interactive).toBe(true);

      panel.close();
      expect(panel.interactive).toBe(false); // 淡出期不接受点击
      panel.update(PANEL_OUT_MS);
      expect(panel.visible).toBe(false);
      expect(panel.progress).toBe(0);
    });
  }

  it('逐项入场同一公式：星级逐颗（150ms）与通关逐关（150ms）都由骨架排出', () => {
    const clear = new ClearPanel();
    clear.open();
    expect(clear.starsShown(3)).toBe(1); // 第 1 颗在 t=0 入场
    clear.update(CLEAR_STAR_STEP_MS);
    expect(clear.starsShown(3)).toBe(2);
    clear.update(CLEAR_STAR_STEP_MS * 2);
    expect(clear.starsShown(3)).toBe(3); // 上限 = 星级

    const finish = new FinishPanel();
    finish.open();
    expect(finish.rowsShown(8)).toBe(1);
    finish.update(FINISH_LEVEL_STEP_MS);
    expect(finish.rowsShown(8)).toBe(2); // 上限 = 关卡数
    finish.update(FINISH_LEVEL_STEP_MS * 10);
    expect(finish.rowsShown(8)).toBe(8);

    // 两档步长的弹跳同为 0 → 1.2 → 1（同一公式，只差步长）。
    const star = new ClearPanel();
    star.open();
    star.update(CLEAR_STAR_STEP_MS / 2);
    expect(star.starScale(0)).toBeCloseTo(1.2, 6);
    const row = new FinishPanel();
    row.open();
    row.update(FINISH_LEVEL_STEP_MS / 2);
    expect(row.rowPopScale(0)).toBeCloseTo(1.2, 6);
  });

  it('骨架：退场中入场项归零，隐藏后进度与入场计时一并归零', () => {
    const clock = new ResultPanelClock();
    clock.open();
    clock.update(PANEL_IN_MS + CLEAR_STAR_STEP_MS * 2);
    expect(clock.popsShown(3, CLEAR_STAR_STEP_MS)).toBe(3);

    clock.close();
    expect(clock.popsShown(3, CLEAR_STAR_STEP_MS)).toBe(0); // 退场中不再入场
    clock.update(PANEL_OUT_MS);
    expect(clock.visible).toBe(false);
    expect(clock.progress).toBe(0);
    expect(clock.popsShown(3, CLEAR_STAR_STEP_MS)).toBe(0);
    expect(clock.popScale(0, CLEAR_STAR_STEP_MS)).toBe(0);
  });
});
