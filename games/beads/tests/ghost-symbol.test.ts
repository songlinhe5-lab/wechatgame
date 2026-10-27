/**
 * **E4 幽灵符号开关的最小守卫（WXG-T-434）**
 * ─────────────────────────────────────────────────────────────────────────────
 * 立单出处 = MVP 验收线「幽灵符号设置开关（默认关）」+ `systems-index §3.8`
 * （`EMPTY_GHOST_ALPHA` v1.22 作废 → v1.23 转正为设置开关，用户拍板 A）。
 *
 * 本文件只锁**两条最容易被写坏的事实**（其余交给既有金样本）：
 *  1. 无目标色（托盘槽 / 空格无颜色）⇒ **零图元**，⛔ 不得凭空画一个中性符号；
 *  2. 有目标色 ⇒ 恰一组符号图元，且墨色带 α（读作「坑里的淡符号」而非第二颗珠子）。
 *
 * 「默认关 ⇒ 盘面逐字节不变」由 `ui-golden` 的 `play` 帧承担（快照缺省 false），
 * 不在此重复造第二把尺。
 */
import { describe, it, expect } from 'vitest';
import { RenderModelBuilder } from '@wxgame/framework';
import { drawGhostSymbol } from '../src/view/bead-render.js';
import { DEMO_BEAD_INKS, EMPTY_GHOST_ALPHA } from '../src/view/palette.js';

function commandsOf(draw: (b: RenderModelBuilder) => void) {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  draw(builder);
  return builder.end().commands;
}

describe('E4 幽灵符号（WXG-T-434）', () => {
  it('无目标色 ⇒ 零图元（⛔ 不凭空造中性符号）', () => {
    expect(commandsOf((b) => drawGhostSymbol(b, 100, 100, 30, undefined, DEMO_BEAD_INKS))).toHaveLength(0);
  });

  it('有目标色 ⇒ 恰一组符号图元且墨色带 α（EMPTY_GHOST_ALPHA）', () => {
    const cmds = commandsOf((b) => drawGhostSymbol(b, 100, 100, 30, 1, DEMO_BEAD_INKS));
    expect(cmds.length).toBeGreaterThan(0);
    // 每个图元的墨色都必须是半透明 rgba（α = §3.8 冻结值 ⇒ 不得实心）。
    for (const cmd of cmds) {
      const ink = 'fill' in cmd ? cmd.fill : 'stroke' in cmd ? cmd.stroke : undefined;
      expect(typeof ink).toBe('string');
      expect(ink as string).toContain(`rgba(`);
      expect(ink as string).toContain(`${EMPTY_GHOST_ALPHA}`);
    }
  });

  it('十色皆有符号（色盲冗余通道不得有缺色）', () => {
    for (let colorIdx = 1; colorIdx <= 10; colorIdx++) {
      const cmds = commandsOf((b) => drawGhostSymbol(b, 100, 100, 30, colorIdx, DEMO_BEAD_INKS));
      expect(cmds.length, `colorIdx=${colorIdx}`).toBeGreaterThan(0);
    }
  });
});
