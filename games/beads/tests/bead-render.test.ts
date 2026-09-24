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
  drawTargetTile,
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
    targetColorIdx: 2,
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

  it('降档只砍质感层：命令数下降，但中心孔红线不丢', () => {
    const full = beadWithPad();
    const low = beadWithPad(WAVE_LOD_LAYERS);
    expect(low.length).toBeLessThan(full.length);
    // v1.5-r8 降档集重定：砍 L0a 接触阴影 + L3b rim + L4′ 高光 = **3 条**（旧为 4 条，
    // 因 L4 三条已并为一枚椭圆高光）。
    expect(full.length - low.length).toBe(3);
    // ⛔ 红线：**L1c 中心孔两枚 circle 在降档后逐字段不变**（孔 = 识别特征，任何档不砍）。
    const holes = (cs: typeof full) => cs.filter((c) => c.kind === 'circle');
    expect(holes(low)).toHaveLength(2);
    expect(holes(low)).toEqual(holes(full));
    // 旧「L5 符号红线」随符号层删除作废；「珠下那块垫」已上提为 B0，不在珠体内。
  });
});

describe('bead parameter card (assets-spec §1.1)', () => {
  // §1.1 v1.5-r8：单颗珠 = **12 条图元**（L0a/L0b/L1/L2′ 侧壁/L2×2/L3×2/L3b/L1c 孔×2/L4′）。
  // 与旧卡差异：垫上提为 B0（−1）、L5 符号删除（−1）、L4 三条并一枚（−2）、
  // 新增侧壁（+1）与孔两枚（+2）⇒ 11 → 12。
  it('§1.1 draws the card layers in the documented order', () => {
    const commands = filled(1);
    expect(commands.map((c) => c.kind)).toEqual([
      'rect', // L0a 接触阴影
      'rect', // L0b 投影
      'rect', // L1 主体
      'rect', // L2′ 侧壁（K5）
      'line', // L2 暗倒角 · 下边
      'line', // L2 暗倒角 · 右边
      'line', // L3 亮倒角 · 上边
      'line', // L3 亮倒角 · 左边
      'line', // L3b rim 光 · 上内缘
      'circle', // L1c 孔底（透目标色 / 无目标色则自身下暗）
      'circle', // L1c 孔内壁自阴影
      'rect', // L4′ 偏心椭圆高光（三层并档）
    ]);
    // 符号层已删 ⇒ 不应再出现第 13 条；本例同时间接地钉住“不复活符号/不复活珠内垫”。
    expect(commands).toHaveLength(12);
    expect(commands.some((c) => c.kind === 'polygon')).toBe(false);
  });

  // B0 目标色底图（v1.5-r8）：独立函数、pitch 满铺且方角 ⇒ 相邻格底色无缝相连。
  //
  // ⚠ **恒等档不变式**（`ADR-0020` 附录 A 甲案 / WXG-T-206 后逐字不改）：本例**不传 `size`**
  // ⇒ 吃默认 `BEAD_PITCH`，测的就是 `z = 1` 那一档。甲案只改 `z ≠ 1` 的呈现，因此本例的
  // 职责从「证明无缝」升格为「守住恒等档不被顺手改掉」：任何人动默认值即红。
  // （快照侧同锚见 `view-model.test.ts`；z<1 新行为见下一条与 `view-model.test.ts`。）
  it('§1.1 B0 target tile spans one full pitch with square corners so cells are gapless', () => {
    const tile = emit((b) => drawTargetTile(b, 100, 200, 1))[0]!;
    expect(tile.kind).toBe('rect');
    if (tile.kind !== 'rect') return;
    expect(tile.w).toBe(BEAD_PITCH);
    expect(tile.h).toBe(BEAD_PITCH);
    expect(tile.radius ?? 0).toBe(0);
    // 相邻两格圆心相距 = pitch ⇒ 两砖边缘重合（无缝）；旧写法砖边长 = BEAD_CELL ⇒ 中间空 2px。
    expect(tile.x + tile.w).toBe(100 + BEAD_PITCH / 2);
  });

  // 甲案核心（WXG-T-206）：砖边长是**入参**，必须随相机缩放。旧 bug = 硬编码绝对 52 而格心
  // 来自 `BEAD_PITCH·z` ⇒ `z < 1` 时相邻重叠。本例只钉「入参透传 + 中心不漂 + 零图元增量」；
  // 「相邻不重叠」的不共源强度判据在 `view-model.test.ts`（依 K-042：测试里不重推几何公式）。
  it('甲案（WXG-T-206）：传入缩放格距时 tile 边长随之走，中心与色档不受尺寸影响', () => {
    const SCALED = 42.4; // 一个 z<1 档的格距（取非整数值：防 `Math.round` 浑水摸鱼）
    const identity = emit((b) => drawTargetTile(b, 100, 200, 1))[0]!;
    const tile = emit((b) => drawTargetTile(b, 100, 200, 1, DEMO_BEAD_INKS, SCALED))[0]!;
    expect(tile.kind).toBe('rect');
    if (tile.kind !== 'rect' || identity.kind !== 'rect') return;
    // 仍只一枚图元 ⇒ 零增量（`check:size` 与 §11.2 基线不动）。
    expect(SCALED).toBeLessThan(BEAD_PITCH); // 前置：本例真的在测 z<1 档
    expect(tile.w).toBe(SCALED);
    expect(tile.h).toBe(SCALED);
    expect(tile.radius ?? 0).toBe(0); // 方角不随缩放变
    // 以格心为中心：砖变小不致中点漂移（旧 bug 的另一半 = 珠体居中而底图外伸）。
    expect(tile.x + tile.w / 2).toBeCloseTo(100, 9);
    expect(tile.y + tile.h / 2).toBeCloseTo(200, 9);
    // 色档与边长无关（B0 仍是同一张目标色马赛克）。
    expect(tile.fill).toBe(identity.fill);
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
    // v1.5-r8：L2′ 侧壁插在 L1 与倒角之间 ⇒ 五条线整体后移一位（旧 3–7 → 现 4–8）。
    expect(commands[4]).toMatchObject({ kind: 'line', stroke: dark });
    expect(commands[5]).toMatchObject({ kind: 'line', stroke: dark });
    expect(commands[6]).toMatchObject({ kind: 'line', stroke: light });
    expect(commands[7]).toMatchObject({ kind: 'line', stroke: light });
    expect(commands[8]).toMatchObject({ kind: 'line', stroke: rim }); // L3b rim 光
    // L2 sits on the bottom/right inner edge, L3 on the top/left one.
    const [l2a, l2b, l3a, l3b] = [commands[4]!, commands[5]!, commands[6]!, commands[7]!];
    const flat = (c: (typeof l2a)) => (c.kind === 'line' ? [c.x1, c.y1, c.x2, c.y2] : []);
    expect(flat(l2a)[1]).toBe(flat(l2b)[1]); // L2 bottom: shared y
    expect(flat(l3b)[0]).toBe(flat(l3a)[0]); // L3 left: shared x
  });

  // L4′ 偏心椭圆高光（K6，v1.5-r8 三层并一档）+ L1c 中心孔（K2–K4）。
  it('§1.1 L4′ is a single offset oval highlight and L1c punches one centre hole', () => {
    const size = 50;
    const commands = filled(2, size);
    const left = 100 - size / 2;
    const bottom = 200 - size / 2;
    // L4′：旧 `softHighlight[1]` 的比例与 α 原样沿用（并档不改几何，只减图元数）。
    const g = BEAD_CARD.softHighlight[1]!;
    const bar = commands[11]!;
    expect(bar.kind === 'rect' && bar.x).toBeCloseTo(left + size * g.x, 6);
    expect(bar.kind === 'rect' && bar.y).toBeCloseTo(bottom + size * g.y, 6);
    expect(bar.kind === 'rect' && bar.w).toBeCloseTo(size * g.w, 6);
    expect(bar.kind === 'rect' && bar.h).toBeCloseTo(size * g.h, 6);
    expect(bar.kind === 'rect' && bar.radius).toBeCloseTo(size * g.radius, 6);
    expect(bar.kind === 'rect' && bar.fill).toBe(
      withAlpha(BEAD_HIGHLIGHT_HEX, BEAD_SOFT_HIGHLIGHT_ALPHAS[1]!),
    );
    // L1c：两枚 circle = 孔底（居中）+ 内壁自阴影（偏左上 ⇒ 留右下亮弧）。
    const [hole, shade] = [commands[9]!, commands[10]!];
    const holeR = (size * BEAD_CARD.holeRatio) / 2;
    expect(hole.kind).toBe('circle');
    expect(shade.kind).toBe('circle');
    if (hole.kind !== 'circle' || shade.kind !== 'circle') return;
    expect(hole.x).toBe(100);
    expect(hole.r).toBeCloseTo(holeR, 9);
    expect(shade.r).toBeCloseTo(holeR * 0.86, 9);
    // 设计空间 y 向上 ⇒ 阴影往 +y（视觉上方）、往 −x（左）偏移。
    expect(shade.y).toBeGreaterThan(hole.y);
    expect(shade.x).toBeLessThan(hole.x);
    // 无目标色（托盘珠）⇒ 孔底不再是目标色档；有目标色 ⇒ 两者不同。此处只钉“不越界”。
    expect(holeR).toBeLessThan(size / 2);
  });

  // v1.5-r8：旧 §1.5「符号墨水与珠体同源」判据随 L5 符号层删除而移除（symbols.ts 已删）。

  // §5 抬起三通道（v1.5-r9）：投影变远变淡、接触面收窄变淡、珠体与侧壁微涨，
  // 四个通道共用一个 `liftT` ⇒ 方向必须一致（“平移但阴影不变”就是“突兀”的根源）。
  // ⚠ 显式覆写（G1 包络 / §1.2 selected 的 SELECTED_SHADOW_ALPHA）**优先于 lift 衰减**，
  //   否则本批会静默推翻“选中 = 阴影更深”的 art 语义（见 `§1.2 lift and shadow α` 例）。
  it('§5 lift drives shadow, contact, body and side wall from one height parameter', () => {
    const rest = emit((b) => beadOnPad(b));
    const up = emit((b) =>
      drawFilledBead(b, 100, 200, 1, {
        size: BEAD_CELL,
        targetColorIdx: 2,
        inks: DEMO_BEAD_INKS,
        lift: BEAD_CARD.liftRef,
      }),
    );
    type Rect = Extract<(typeof rest)[number], { kind: 'rect' }>;
    const at = (cmds: typeof rest, i: number): Rect => {
      const c = cmds[i]!;
      expect(c.kind).toBe('rect');
      return c as Rect;
    };
    const alphaOf = (c: Rect): number => Number(/([\d.]+)\)$/.exec(c.fill ?? '')?.[1] ?? NaN);

    // L0a 接触阴影：随高度**收窄**；α 按 §1.2 固定 ⇒ 不随 lift 变（只改几何不改颜色语义）。
    expect(at(up, 0).w).toBeLessThan(at(rest, 0).w);
    expect(alphaOf(at(up, 0))).toBe(alphaOf(at(rest, 0)));
    // L0b 投影：与主体的间距变大（离底面更远）且变淡 —— 注意不能直接比 y：
    // 整颗珠（含主体底边）本来就被 lift 抬高了，“更远”指的是**投影与主体之间的间距**。
    const gap = (cmds: typeof rest): number => at(cmds, 2).y - at(cmds, 1).y;
    expect(gap(up)).toBeGreaterThan(gap(rest));
    expect(alphaOf(at(up, 1))).toBeLessThan(alphaOf(at(rest, 1)));
    // L1 主体放大与 L2′ 侧壁变长（共用同一个 liftT ⇒ 方向一致）。
    expect(at(up, 2).w).toBeGreaterThan(at(rest, 2).w);
    expect(at(up, 3).h).toBeGreaterThan(at(rest, 3).h);
    // 红线：满抬起仍不越格（A5 零重叠前提）：静息 38 × 1.04 = 39.52 < BEAD_CELL。
    expect(at(up, 2).w).toBeLessThan(BEAD_CELL);
    // G1 包络仍为基准、lift 只在其上调制 ⇒ 不传 lift 时逐字段等于旧行为（零回归）。
    expect(emit((b) => beadOnPad(b))).toEqual(rest);
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
    // L0b 投影（index 1）随 selected 加深；L0a 接触阴影（index 0）固定 α 不受影响。
    expect(selected[1]!.kind === 'rect' && selected[1]!.fill).toBe(
      withAlpha(BEAD_SHADOW_HEX, SELECTED_SHADOW_ALPHA),
    );
    expect(selected[0]!.kind === 'rect' && selected[0]!.fill).toBe(
      withAlpha(BEAD_SHADOW_HEX, BEAD_CONTACT_SHADOW_ALPHA),
    );
    // 位移量拿**珠心**比较，不拿底边：§5 后 lift 会把珠体放大（size × 1.0267），
    // 底边因此比心多下移 half-growth —— 拿底边量会得到 178.33 而非 179，不是位移错。
    const centerY = (cmds: typeof plain) =>
      cmds[2]!.kind === 'rect' ? cmds[2]!.y + cmds[2]!.h / 2 : NaN;
    expect(centerY(selected)).toBeCloseTo(centerY(plain) + 4, 6);
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
