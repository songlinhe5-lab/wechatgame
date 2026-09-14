/**
 * Bead parameter card — `art/assets-spec.md` §1.1（六层逐层落码）+ §1.2（状态参数）.
 *
 * The card is the contract between `art/` and the renderer: layer order, ratios and
 * minimum features are all spec-fixed, so they are asserted here by command
 * inspection rather than by eyeballing the harness.
 */

import { describe, it, expect } from 'vitest';
import { RenderModelBuilder } from '@wxgame/framework';
import { BEAD_CELL, TRAY_SLOT } from '../src/config/tuning.js';
import {
  BEAD_CARD,
  SELECTED_SHADOW_ALPHA,
  TRAY_BEAD_SIZE,
  drawEmptySocket,
  drawFilledBead,
  drawLockedBead,
} from '../src/view/bead-render.js';
import {
  BEAD_BEVEL_DARK_MIX,
  BEAD_BEVEL_LIGHT_MIX,
  BEAD_HIGHLIGHT_ALPHA,
  BEAD_HIGHLIGHT_HEX,
  BEAD_SHADOW_ALPHA,
  BEAD_SHADOW_HEX,
  DEFAULT_PALETTE,
  beadColor,
  mix,
  withAlpha,
} from '../src/view/palette.js';
import { symbolInk } from '../src/view/symbols.js';

function emit(draw: (builder: RenderModelBuilder) => void) {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  draw(builder);
  return builder.end().commands;
}

const filled = (colorIdx: number, size = BEAD_CELL) =>
  emit((b) => drawFilledBead(b, 100, 200, colorIdx, { size }));

describe('bead parameter card (assets-spec §1.1)', () => {
  // §1.1：单颗珠 = 6 层按序绘制。前 7 条指令即 L0–L4，L5 之后补齐。
  it('§1.1 draws the six layers in the documented order', () => {
    const commands = filled(1);
    expect(commands.map((c) => c.kind).slice(0, 7)).toEqual([
      'rect', // L0 投影
      'rect', // L1 主体
      'line', // L2 暗倒角 · 下边
      'line', // L2 暗倒角 · 右边
      'line', // L3 亮倒角 · 上边
      'line', // L3 亮倒角 · 左边
      'rect', // L4 高光条
    ]);
    // L5 符号 — at least one command after L4, for every colour.
    expect(commands.length).toBeGreaterThan(7);
  });

  // L0 投影：偏移 −3/64×BEAD，α 0.15。
  it('§1.1 L0 offsets the shadow by 3/64 of the edge at α 0.15', () => {
    const size = 50;
    const commands = filled(1, size);
    const shadow = commands[0]!;
    expect(shadow.kind === 'rect' && shadow.y).toBeCloseTo(200 - size / 2 - size * BEAD_CARD.shadowDy, 6);
    expect(shadow.kind === 'rect' && shadow.fill).toBe(withAlpha(BEAD_SHADOW_HEX, BEAD_SHADOW_ALPHA));
    expect(shadow.kind === 'rect' && shadow.radius).toBe(Math.round(size * BEAD_CARD.radius));
  });

  // L1 主体：基色取自色板索引，圆角 round(BEAD × 0.22)。
  it('§1.1 L1 fills the body with the palette colour for that index', () => {
    for (const colorIdx of [1, 5, 10]) {
      const body = filled(colorIdx)[1]!;
      expect(body.kind === 'rect' && body.fill).toBe(beadColor(colorIdx));
    }
  });

  // L2/L3 倒角：以基色为基准分别向黑/白偏移，并各覆盖两条边。
  it('§1.1 L2/L3 tint the bevels from the base colour on two edges each', () => {
    const base = beadColor(4);
    const commands = filled(4);
    const dark = mix(base, BEAD_BEVEL_DARK_MIX);
    const light = mix(base, BEAD_BEVEL_LIGHT_MIX);
    expect(commands[2]).toMatchObject({ kind: 'line', stroke: dark });
    expect(commands[3]).toMatchObject({ kind: 'line', stroke: dark });
    expect(commands[4]).toMatchObject({ kind: 'line', stroke: light });
    expect(commands[5]).toMatchObject({ kind: 'line', stroke: light });
    // L2 sits on the bottom/right inner edge, L3 on the top/left one.
    const [l2a, l2b, l3a, l3b] = [commands[2]!, commands[3]!, commands[4]!, commands[5]!];
    const flat = (c: (typeof l2a)) => (c.kind === 'line' ? [c.x1, c.y1, c.x2, c.y2] : []);
    expect(flat(l2a)[1]).toBe(flat(l2b)[1]); // L2 bottom: shared y
    expect(flat(l3b)[0]).toBe(flat(l3a)[0]); // L3 left: shared x
  });

  // L4 高光条：位置/尺寸/圆角全部按 BEAD 比例（0.10 / 0.62 / 0.80 / 0.26 / 0.13）。
  it('§1.1 L4 places the highlight bar by edge ratios', () => {
    const size = 50;
    const bar = filled(2, size)[6]!;
    const left = 100 - size / 2;
    const bottom = 200 - size / 2;
    expect(bar.kind === 'rect' && bar.x).toBeCloseTo(left + size * BEAD_CARD.highlightX, 6);
    expect(bar.kind === 'rect' && bar.y).toBeCloseTo(bottom + size * BEAD_CARD.highlightY, 6);
    expect(bar.kind === 'rect' && bar.w).toBeCloseTo(size * BEAD_CARD.highlightW, 6);
    expect(bar.kind === 'rect' && bar.h).toBeCloseTo(size * BEAD_CARD.highlightH, 6);
    expect(bar.kind === 'rect' && bar.radius).toBeCloseTo(size * BEAD_CARD.highlightRadius, 6);
    expect(bar.kind === 'rect' && bar.fill).toBe(withAlpha(BEAD_HIGHLIGHT_HEX, BEAD_HIGHLIGHT_ALPHA));
  });

  // L5 符号：颜色与符号必须同源（同一索引派生），否则会出现「橙珠配星形」这类错配。
  it('§1.5 derives the symbol ink from the very same colour as the body', () => {
    for (let colorIdx = 1; colorIdx <= 10; colorIdx++) {
      const commands = filled(colorIdx);
      const symbol = commands[commands.length - 1]!;
      const inkInUse =
        symbol.kind === 'circle'
          ? (symbol.stroke ?? symbol.fill)
          : symbol.kind === 'line'
            ? symbol.stroke
            : symbol.kind === 'rect'
              ? symbol.fill
              : symbol.kind === 'polygon'
                ? symbol.fill
                : undefined;
      expect(inkInUse, `colour ${colorIdx}`).toBe(symbolInk(beadColor(colorIdx)).color);
    }
  });

  // §1.1 最小特征约束：线宽 ≥ 2px —— 托盘尺寸（44px 珠）是最小使用场景。
  it('§1.1 keeps every card stroke ≥ 2px at the smallest bead size', () => {
    for (const size of [BEAD_CELL, TRAY_BEAD_SIZE]) {
      for (const cmd of filled(1, size)) {
        if (cmd.kind === 'line') expect(cmd.lineWidth).toBeGreaterThanOrEqual(BEAD_CARD.minStroke);
        if (cmd.kind === 'circle' && cmd.lineWidth !== undefined) {
          expect(cmd.lineWidth).toBeGreaterThanOrEqual(BEAD_CARD.minStroke);
        }
      }
    }
  });

  // §1.2 selected：整体上移 4px + L0 投影加深。
  it('§1.2 lift and shadow α follow the selected state', () => {
    const plain = filled(1);
    const selected = emit((b) =>
      drawFilledBead(b, 100, 200, 1, { size: BEAD_CELL, lift: 4, shadowAlpha: SELECTED_SHADOW_ALPHA }),
    );
    expect(selected[0]!.kind === 'rect' && selected[0]!.fill).toBe(
      withAlpha(BEAD_SHADOW_HEX, SELECTED_SHADOW_ALPHA),
    );
    const bodyY = (cmds: typeof plain) => (cmds[1]!.kind === 'rect' ? cmds[1]!.y : NaN);
    expect(bodyY(selected)).toBeCloseTo(bodyY(plain) + 4, 6);
  });

  // §1.2 empty：仅主体 + 描边，**无符号无倒角**；§1.2 locked：主体 + 斜纹，**无高光无符号**。
  it('§1.2 empty and locked states carry no symbol and no highlight', () => {
    const empty = emit((b) => drawEmptySocket(b, 100, 200, DEFAULT_PALETTE));
    expect(empty).toHaveLength(1);
    expect(empty[0]).toMatchObject({
      kind: 'rect',
      fill: DEFAULT_PALETTE.slot,
      stroke: DEFAULT_PALETTE.slotBorder,
      lineWidth: 1,
    });

    const locked = emit((b) => drawLockedBead(b, 100, 200, DEFAULT_PALETTE));
    expect(locked.map((c) => c.kind)).toEqual(['rect', 'line', 'line']);
    // No highlight bar: the only fill commands are the body (L1 equivalent).
    expect(locked.some((c) => c.kind === 'rect' && c.fill === withAlpha(BEAD_HIGHLIGHT_HEX, BEAD_HIGHLIGHT_ALPHA))).toBe(false);
  });

  // §1.3：托盘珠 = 同 BEAD 内缩 4；尺寸常量必须由 TRAY_SLOT 派生，不能是散落的魔法数。
  it('§1.3 derives the tray bead size from the tray slot', () => {
    expect(TRAY_BEAD_SIZE).toBe(TRAY_SLOT - 4);
  });

  // 可复现：同一输入两次渲染逐字节一致。
  it('is a pure function of its arguments', () => {
    expect(filled(7)).toEqual(filled(7));
  });
});
