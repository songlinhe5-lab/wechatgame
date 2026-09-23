/**
 * Bead parameter card — `art/assets-spec.md` §1.1（v1.3 十层逐层落码）+ §1.2（状态参数）.
 *
 * The card is the contract between `art/` and the renderer: layer order, ratios and
 * minimum features are all spec-fixed, so they are asserted here by command
 * inspection rather than by eyeballing the harness.
 */

import { describe, it, expect } from 'vitest';
import { RenderModelBuilder } from '@wxgame/framework';
import { BEAD_CELL, BEAD_PITCH, TRAY_SLOT, nextBeadLod, WAVE_LOD_LAYERS } from '../src/config/tuning.js';
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
  BEAD_CONTACT_SHADOW_ALPHA,
  BEAD_HIGHLIGHT_HEX,
  BEAD_RIM_MIX,
  BEAD_SHADOW_ALPHA,
  BEAD_SHADOW_HEX,
  BEAD_SOFT_HIGHLIGHT_ALPHAS,
  DEFAULT_PALETTE,
  beadColorOf,
  DEMO_BEAD_INKS,
  mix,
  withAlpha,
} from '../src/view/palette.js';
// v1.5-r8：L5 符号层已删 ⇒ `view/symbols.ts` 不再存在，不得重新引入。

function emit(draw: (builder: RenderModelBuilder) => void) {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  draw(builder);
  return builder.end().commands;
}

const filled = (colorIdx: number, size = BEAD_CELL) =>
  emit((b) => drawFilledBead(b, 100, 200, colorIdx, { size }));

/** 带 L11 垫的盘上珠（= 出货关的实际形态），可选降档层数。 */
function beadOnPad(b: RenderModelBuilder, lod?: number): void {
  drawFilledBead(b, 100, 200, 1, {
    size: BEAD_CELL,
    padColorIdx: 2,
    inks: DEMO_BEAD_INKS,
    ...(lod === undefined ? {} : { lodLayers: lod }),
  });
}

describe('zoom 自适应 LOD 通道（ADR-0017 甲案 · 大盘手势卡顿优化）', () => {
  const beadWithPad = (lod?: number) =>
    emit((b) =>
      beadOnPad(b, lod),
    );

  it('滞回状态机：降档 < 45、升档 ≥ 47.5 ⇒ 阈值带内不跳变（防 D2 闪烁红线）', () => {
    expect(nextBeadLod(44, false)).toBe(true); // 满层侧跨过阈值 ⇒ 降档
    expect(nextBeadLod(46, true)).toBe(true); // 带内保持降档，不闪回满层
    expect(nextBeadLod(48, true)).toBe(false); // 越过带宽才升档
    expect(nextBeadLod(46, false)).toBe(false); // 同一点不降档 ⇒ 无双稳振荡
  });

  it('降档只砍质感层：命令数下降，但 L11 目标色垫红线不丢', () => {
    const full = beadWithPad();
    const low = beadWithPad(WAVE_LOD_LAYERS);
    expect(low.length).toBeLessThan(full.length);
    // L11 目标色垫：两版首条逐字段相同（垫不参与 LOD，也不参与 scale / lift）
    expect(low[0]).toEqual(full[0]);
    // v1.5-r8：旧「L5 符号红线」随符号层删除而作废（非色相通道改由连续底图承担）。
  });
});

describe('bead parameter card (assets-spec §1.1)', () => {
  // §1.1（v1.3 十层卡）：单颗珠 = 11 条图元按序（L0a/L0b/L1/L2×2/L3×2/L3b/L4a-c），L5 之后补齐。
  it('§1.1 draws the ten card layers in the documented order', () => {
    const commands = filled(1);
    expect(commands.map((c) => c.kind).slice(0, 11)).toEqual([
      'rect', // L0a 接触阴影
      'rect', // L0b 投影
      'rect', // L1 主体
      'line', // L2 暗倒角 · 下边
      'line', // L2 暗倒角 · 右边
      'line', // L3 亮倒角 · 上边
      'line', // L3 亮倒角 · 左边
      'line', // L3b rim 光 · 上内缘
      'rect', // L4a 软高光·广
      'rect', // L4b 软高光·中
      'rect', // L4c 软高光·核
    ]);
    // v1.5-r8：L5 符号层已删 ⇒ 十层卡即全部，珠体图元数恰为 11（无尾部符号）。
    expect(commands).toHaveLength(11);
  });

  // L11 目标色垫（v1.5-r8）：按 pitch 满铺且方角 ⇒ 相邻格底色无缝相连。
  it('§1.1 L11 pad tiles at pitch with square corners so cell colours are gapless', () => {
    const pad = emit((b) => beadOnPad(b))[0]!;
    expect(pad.kind).toBe('rect');
    if (pad.kind !== 'rect') return;
    expect(pad.w).toBe(BEAD_PITCH);
    expect(pad.h).toBe(BEAD_PITCH);
    expect(pad.radius ?? 0).toBe(0);
    // 相邻两格圆心相距 = pitch ⇒ 两垫边缘重合（无缝）；旧写法垫边长 = BEAD_CELL ⇒ 中间空 2px。
    expect(pad.x + pad.w).toBe(100 + BEAD_PITCH / 2);
    expect(BEAD_PITCH - pad.w).toBe(0);
  });

  // L0a 接触阴影：贴底窄条（y = bottom + contactY×BEAD），α 0.12，圆角 = 主圆角 × 0.5。
  it('§1.1 L0a lays a contact-shadow strip just below the bead', () => {
    const size = 50;
    const contact = filled(1, size)[0]!;
    const left = 100 - size / 2;
    const bottom = 200 - size / 2;
    expect(contact.kind === 'rect' && contact.x).toBeCloseTo(left + size * BEAD_CARD.contactX, 6);
    expect(contact.kind === 'rect' && contact.y).toBeCloseTo(bottom + size * BEAD_CARD.contactY, 6);
    expect(contact.kind === 'rect' && contact.w).toBeCloseTo(size * BEAD_CARD.contactW, 6);
    expect(contact.kind === 'rect' && contact.h).toBeCloseTo(size * BEAD_CARD.contactH, 6);
    expect(contact.kind === 'rect' && contact.fill).toBe(withAlpha(BEAD_SHADOW_HEX, BEAD_CONTACT_SHADOW_ALPHA));
    expect(contact.kind === 'rect' && contact.radius).toBe(
      Math.round(Math.round(size * BEAD_CARD.radius) * BEAD_CARD.contactRadiusScale),
    );
  });

  // L0b 投影：偏移 −3/64×BEAD，α 0.15。
  it('§1.1 L0b offsets the drop shadow by 3/64 of the edge at α 0.15', () => {
    const size = 50;
    const commands = filled(1, size);
    const shadow = commands[1]!;
    expect(shadow.kind === 'rect' && shadow.y).toBeCloseTo(200 - size / 2 - size * BEAD_CARD.shadowDy, 6);
    expect(shadow.kind === 'rect' && shadow.fill).toBe(withAlpha(BEAD_SHADOW_HEX, BEAD_SHADOW_ALPHA));
    expect(shadow.kind === 'rect' && shadow.radius).toBe(Math.round(size * BEAD_CARD.radius));
  });

  // L1 主体：基色取自色板索引，圆角 round(BEAD × 0.22)。
  it('§1.1 L1 fills the body with the palette colour for that index', () => {
    for (const colorIdx of [1, 5, 10]) {
      const body = filled(colorIdx)[2]!;
      expect(body.kind === 'rect' && body.fill).toBe(beadColorOf(DEMO_BEAD_INKS, colorIdx));
    }
  });

  // L2/L3 倒角：以基色为基准分别向黑/白偏移，并各覆盖两条边。
  it('§1.1 L2/L3/L3b tint the bevels and rim from the base colour', () => {
    const base = beadColorOf(DEMO_BEAD_INKS, 4);
    const commands = filled(4);
    const dark = mix(base, BEAD_BEVEL_DARK_MIX);
    const light = mix(base, BEAD_BEVEL_LIGHT_MIX);
    const rim = mix(base, BEAD_RIM_MIX);
    expect(commands[3]).toMatchObject({ kind: 'line', stroke: dark });
    expect(commands[4]).toMatchObject({ kind: 'line', stroke: dark });
    expect(commands[5]).toMatchObject({ kind: 'line', stroke: light });
    expect(commands[6]).toMatchObject({ kind: 'line', stroke: light });
    expect(commands[7]).toMatchObject({ kind: 'line', stroke: rim }); // L3b rim 光
    // L2 sits on the bottom/right inner edge, L3 on the top/left one.
    const [l2a, l2b, l3a, l3b] = [commands[3]!, commands[4]!, commands[5]!, commands[6]!];
    const flat = (c: (typeof l2a)) => (c.kind === 'line' ? [c.x1, c.y1, c.x2, c.y2] : []);
    expect(flat(l2a)[1]).toBe(flat(l2b)[1]); // L2 bottom: shared y
    expect(flat(l3b)[0]).toBe(flat(l3a)[0]); // L3 left: shared x
  });

  // L4a/b/c 软高光：三层按 BEAD_CARD.softHighlight 比例定位，α 由 BEAD_SOFT_HIGHLIGHT_ALPHAS 逐层递变。
  it('§1.1 L4a/b/c stack three soft-highlight bars by edge ratios', () => {
    const size = 50;
    const commands = filled(2, size);
    const left = 100 - size / 2;
    const bottom = 200 - size / 2;
    for (let i = 0; i < BEAD_CARD.softHighlight.length; i++) {
      const g = BEAD_CARD.softHighlight[i]!;
      const bar = commands[8 + i]!;
      expect(bar.kind === 'rect' && bar.x).toBeCloseTo(left + size * g.x, 6);
      expect(bar.kind === 'rect' && bar.y).toBeCloseTo(bottom + size * g.y, 6);
      expect(bar.kind === 'rect' && bar.w).toBeCloseTo(size * g.w, 6);
      expect(bar.kind === 'rect' && bar.h).toBeCloseTo(size * g.h, 6);
      expect(bar.kind === 'rect' && bar.radius).toBeCloseTo(size * g.radius, 6);
      expect(bar.kind === 'rect' && bar.fill).toBe(withAlpha(BEAD_HIGHLIGHT_HEX, BEAD_SOFT_HIGHLIGHT_ALPHAS[i]!));
    }
  });

  // v1.5-r8：旧 §1.5「符号墨水与珠体同源」判据随 L5 符号层删除而移除（symbols.ts 已删）。

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
    // L0b 投影（index 1）随 selected 加深；L0a 接触阴影（index 0）固定 α 不受影响。
    expect(selected[1]!.kind === 'rect' && selected[1]!.fill).toBe(
      withAlpha(BEAD_SHADOW_HEX, SELECTED_SHADOW_ALPHA),
    );
    expect(selected[0]!.kind === 'rect' && selected[0]!.fill).toBe(
      withAlpha(BEAD_SHADOW_HEX, BEAD_CONTACT_SHADOW_ALPHA),
    );
    const bodyY = (cmds: typeof plain) => (cmds[2]!.kind === 'rect' ? cmds[2]!.y : NaN);
    expect(bodyY(selected)).toBeCloseTo(bodyY(plain) + 4, 6);
  });

  // §1.2 empty 且无目标色（= 托盘空槽）：仅主体 + 描边，**无符号无倒角**；
  // §1.2 locked：主体 + 斜纹，**无高光无符号**。
  it('§1.2 empty (no target) 中性四层凹陷卡（v1.5-r5 改写：原「仅主体+描边」随 E1/E4 作废）', () => {
    const empty = emit((b) => drawEmptySocket(b, 100, 200, DEFAULT_PALETTE));
    // v1.5 四层：大底 → pit 内缩填充 → S1 暗缘框 → S3/S4 明暗线（共 5 命令）。
    expect(empty).toHaveLength(5);
    // 大底 = 中性 slot 纯色（无 stroke；旧 E1 tint 已作废）。
    expect(empty[0]).toMatchObject({ kind: 'rect', fill: DEFAULT_PALETTE.slot });
    // S2 坑底 = 中性色暗一档。
    expect(empty[1]!.kind).toBe('rect');
    // S1 暗缘框 = stroke-only（中性 edge）。
    expect(empty[2]).toMatchObject({ kind: 'rect', stroke: mix(DEFAULT_PALETTE.slot, -0.3) });
    // S3/S4 明暗方向：上暗下亮（线 y 序 + 墨色）。
    expect(empty[3]!.kind).toBe('line');
    expect(empty[4]!.kind).toBe('line');
    // 无幽灵符号（a11y 降级，accessibility v1.5）。
    expect(empty.some((c) => c.kind === 'circle')).toBe(false);
    // 无软高光（不读作珠）。
    expect(
      empty.some(
        (c) =>
          c.kind === 'rect' && BEAD_SOFT_HIGHLIGHT_ALPHAS.some((a) => c.fill === withAlpha(BEAD_HIGHLIGHT_HEX, a)),
      ),
    ).toBe(false);

    const locked = emit((b) => drawLockedBead(b, 100, 200, DEFAULT_PALETTE));
    expect(locked.map((c) => c.kind)).toEqual(['rect', 'line', 'line']);
    // No soft highlight: none of the L4a/b/c fills appear on a locked cell.
    expect(
      locked.some(
        (c) =>
          c.kind === 'rect' && BEAD_SOFT_HIGHLIGHT_ALPHAS.some((a) => c.fill === withAlpha(BEAD_HIGHLIGHT_HEX, a)),
      ),
    ).toBe(false);
  });

  // §1.2 empty + 目标色（T-085 / §3.8）：传入 colorIdx → E1 目标色底 + E4 幽灵符号（α0.20），
  // 未填态即读出该格要填的颜色；形态仍无投影/倒角/高光 → 不误读为已填珠。
  it('§1.2 empty socket with a target colour paints 纯色底 + 四层凹陷卡（v1.5-r5 改写：E1 tint/E4 ghost 作废）', () => {
    const idx = 1; // 奶白 ○
    const cmds = emit((b) => drawEmptySocket(b, 100, 200, DEFAULT_PALETTE, BEAD_CELL, idx));
    // 大底 = 目标色纯色直填（旧 E1 42% 混色已作废）。
    const base = cmds.find((c) => c.kind === 'rect');
    expect(base).toMatchObject({ kind: 'rect', fill: beadColorOf(DEMO_BEAD_INKS, idx) });
    // E4 幽灵符号已删除（用户 2026-09-16 裁定，accessibility v1.5 降档登记）。
    expect(cmds.some((c) => c.kind === 'circle')).toBe(false);
    // S1 暗缘框 = stroke-only，墨 = mix(底色,#000,0.30)（端点表 edge）。
    const edge = cmds.find((c) => c.kind === 'rect' && c.stroke !== undefined);
    expect(edge).toMatchObject({ kind: 'rect', stroke: mix(beadColorOf(DEMO_BEAD_INKS, idx), -0.3) });
    // S3/S4 明暗方向：上暗下亮。
    const lines = cmds.filter((c) => c.kind === 'line');
    expect(lines).toHaveLength(2);
    expect((lines[0] as { stroke: string }).stroke).toBe(mix(beadColorOf(DEMO_BEAD_INKS, idx), -0.3));
    expect((lines[1] as { stroke: string }).stroke).toBe(mix(beadColorOf(DEMO_BEAD_INKS, idx), 0.38));
    // 形态区分仍在：无软高光（不读作珠）。
    expect(
      cmds.some(
        (c) =>
          c.kind === 'rect' && BEAD_SOFT_HIGHLIGHT_ALPHAS.some((a) => c.fill === withAlpha(BEAD_HIGHLIGHT_HEX, a)),
      ),
    ).toBe(false);
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
