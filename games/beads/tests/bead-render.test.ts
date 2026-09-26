/**
 * Bead parameter card — `art/assets-spec.md` §1.1 + §1.2（**逐层几何判据**）.
 *
 * The card is the contract between `art/` and the renderer: layer order, ratios and
 * minimum features are all spec-fixed, so they are asserted here by command
 * inspection rather than by eyeballing the harness.
 *
 * ⚠ **WXG-T-211-S3（四棱转正）后本文件分两臂**（正本 = `production/qa/beads/test-cases.md §K.5`）：
 *  - **`legacy-ten` 对照臂**：§1.1 十层的逐层几何判据**一条不删**，改指
 *    `bead-styles/legacy-ten.ts::drawLegacyTenBead`（承重迁移，⛔ 强度不降）。
 *    这些判据在四棱基线上**没有承载体**（无接触阴影/投影/侧壁/倒角线/rim/软高光），
 *    留在新臂上会退化成平凡真（`K-060`）。`it` 标题一律带 `[legacy-ten]` 前缀作行锚。
 *  - **四棱新基线臂**（`drawFilledBead` → `registry` → `facet-4`）：新增层序与 kind 白名单
 *    判据，锚 `assets-spec §7.11.1` 甲口径（6 命令 / 0 真 α）。
 *  - **两臂共有**的渲染侧通道（B0 底图、inset 作域、色表锁、凹槽/锁定槽）仍走 `drawFilledBead`。
 *
 * 十二行台账的**逐行落点表**（旧锚 ↔ 新锚 ↔ 负向防复活）在 `tests/bead-style-ledger.test.ts`；
 * 封箱等值证据（sha256）在 `tests/bead-style-seal.test.ts`。
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { RenderModelBuilder, polygonVertices, type PolygonCommand } from '@wxgame/framework';
import {
  BEAD_CELL,
  BEAD_DRAW_INSET,
  BEAD_GAP,
  BEAD_LOD_CELL,
  BEAD_LOD_HYST,
  BEAD_PITCH,
  BEAD_STYLE_MAX_ALPHA_LAYERS,
  BEAD_STYLE_MAX_COMMANDS,
  FACET4_FACET_INSET,
  FACET4_FACET_RIGHT_MIX,
  FACET4_PLATE_MIX,
  TRAY_SLOT,
  nextBeadLod,
  ZOOM_LOD_LAYERS,
} from '../src/config/tuning.js';
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
  endpointOf,
  mix,
  withAlpha,
} from '../src/view/palette.js';
import { drawLegacyTenBead } from '../src/view/bead-styles/legacy-ten.js';
import { DEFAULT_BEAD_STYLE } from '../src/view/bead-styles/registry.js';
import { isRealAlphaLayer } from '../src/view/bead-styles/contract.js';
// v1.5-r8：L5 符号层已删 ⇒ `view/symbols.ts` 不再存在，不得重新引入。

function emit(draw: (builder: RenderModelBuilder) => void) {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  draw(builder);
  return builder.end().commands;
}

/**
 * 同上，但保留整个 `RenderModel`：`polygon` 顶点住在模型级 arena（ADR-0024 值语义），
 * 命令只带 `offset/count` ⇒ 要读顶点必须经 `polygonVertices(model, cmd)` 解引用。
 */
function emitModel(draw: (builder: RenderModelBuilder) => void) {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  draw(builder);
  const model = builder.end();
  return { model, commands: model.commands };
}

const filled = (colorIdx: number, size = BEAD_CELL) =>
  emit((b) => drawFilledBead(b, 100, 200, colorIdx, { size }));

/**
 * **对照臂**（十层封箱）：§1.1 的逐层几何判据一律打这里。
 * ⛔ `legacy-ten` 不在 `registry` 内（注册即出池 ⇒ 会触 U16 玩家钮），只由测试显式调用。
 */
const legacy = (colorIdx: number, size = BEAD_CELL) =>
  emit((b) => drawLegacyTenBead(b, 100, 200, colorIdx, { size }));

/** 带 L11 垫的盘上珠（= 出货关的实际形态），可选降档层数。 */
function beadOnPad(b: RenderModelBuilder, lod?: number): void {
  drawFilledBead(b, 100, 200, 1, {
    size: BEAD_CELL,
    targetColorIdx: 2,
    inks: DEMO_BEAD_INKS,
    ...(lod === undefined ? {} : { lodLayers: lod }),
  });
}

/** 同夹具的十层对照臂版本（通道字段与 `beadOnPad` 逐项一致，唯一变量 = 风格）。 */
function legacyOnPad(b: RenderModelBuilder, lod?: number): void {
  drawLegacyTenBead(b, 100, 200, 1, {
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
  const legacyWithPad = (lod?: number) =>
    emit((b) => legacyOnPad(b, lod));

  it('滞回状态机（§3.8 v1.57 公式化：降档 < 27、升档 ≥ 29.5）⇒ 阈值带内不跳变（防 D2 闪烁红线）', () => {
    // 阈值不再写死 45/47.5（那是 50/52 基快照）；本例只钉**行为形状**，
    // 数值一律从 `BEAD_LOD_CELL / BEAD_LOD_HYST` 派生 ⇒ 换基尺时自动跟随。
    expect(nextBeadLod(BEAD_LOD_CELL - 1, false)).toBe(true); // 跨过阈值 ⇒ 降档
    expect(nextBeadLod(BEAD_LOD_CELL + BEAD_LOD_HYST - 1, true)).toBe(true); // 带内保持降档，不闪回满层
    expect(nextBeadLod(BEAD_LOD_CELL + BEAD_LOD_HYST + 1, true)).toBe(false); // 越过带宽才升档
    expect(nextBeadLod(BEAD_LOD_CELL + 1, false)).toBe(false); // 同一点不降档 ⇒ 无双稳振荡
  });

  // ⚠️ **P0 捕获器（WXG-T-207-A）**：若有人只翻 `BEAD_CELL` 而忘翻 `BEAD_LOD_CELL`
  //（旧 45 > 新静息档 30），下一条当场红 ⇒ 盘面永久降档、质感层集体缺席不再可能静默入库。
  it('§3.3 v1.57 P0 不变式：静息档（zoom=1 ⇒ cell = BEAD_CELL）**不降档**', () => {
    expect(nextBeadLod(BEAD_CELL, false)).toBe(false);
    expect(nextBeadLod(BEAD_CELL, true)).toBe(false); // 升档侧也回满层（带内不卡死）
    expect(BEAD_LOD_CELL).toBeLessThan(BEAD_CELL); // 降档只能发生在 zoom<1 侧
    expect(BEAD_LOD_CELL).toBe(BEAD_CELL * 0.9); // 出身 = ADR-0017 起点 zoom 0.9（比例、非绝对地板）
    expect(BEAD_CELL).toBe(BEAD_PITCH - BEAD_GAP); // 基尺同尺链（LOD 跟随此链派生）
  });

  // ⚠ **S3 承重迁移**：本例断的是「降档**砍哪三层**」，而可砍集（L0a/L3b/L4′）只存在于
  //   十层 ⇒ 改指 `legacy-ten` 臂（台账外连带，回传登记）。
  it('[legacy-ten] 降档只砍质感层：命令数下降，但中心孔红线不丢', () => {
    const full = legacyWithPad();
    const low = legacyWithPad(ZOOM_LOD_LAYERS); // C7 拆名：此例走 zoom LOD 降层路径（同值 7）
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

  // 四棱新基线（`facet-4`）**只有 6 命令 / 0 真 α ⇒ 无可砍集**（≤ C7 命令上限 7）：
  // `lodLayers` 通道照旧透进契约，但在本风格上是**结构性 no-op**。
  // ⚠ 本例是「诚实登记」而非「省略」：渲染侧不静默吃掉入参（`contract.ts` 已写该约定），
  //   而是由本判据正面钉住**传 / 不传逐字节等值**。若日后引入需降档的风格，本例应随之改写。
  it('四棱基线：`lodLayers` 为结构性 no-op（传 / 不传逐字节等值）', () => {
    const full = beadWithPad();
    const low = beadWithPad(ZOOM_LOD_LAYERS);
    const waveLow = beadWithPad(ZOOM_LOD_LAYERS - 3);
    expect(low).toEqual(full);
    expect(waveLow).toEqual(full);
    // 同时钉住“不是空珠”：no-op 的前提是本臂真的画了 6 条。
    expect(full).toHaveLength(6);
  });
});

describe('bead parameter card (assets-spec §1.1)', () => {
  // §1.1 v1.5-r8：单颗珠 = **12 条图元**（L0a/L0b/L1/L2′ 侧壁/L2×2/L3×2/L3b/L1c 孔×2/L4′）。
  // 与旧卡差异：垫上提为 B0（−1）、L5 符号删除（−1）、L4 三条并一枚（−2）、
  // 新增侧壁（+1）与孔两枚（+2）⇒ 11 → 12。
  // ⚠ **S3：本例不再断当前盘面**，而是钉住封箱对照臂的层集结构（⛔ 不得随新基线改写）：
  //   它同时是「legacy-ten 仍是那十层」的结构锚，逐字节证据另见 `bead-style-seal.test.ts`。
  it('[legacy-ten] §1.1 draws the card layers in the documented order', () => {
    const commands = legacy(1);
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

  /* ─────────────────────────────────────────────────────────────────────
   * 以下为 **四棱新基线臂**（转正后 `drawFilledBead` 的真实输出）。
   * 正本 = `assets-spec §7.11.1` 行 1–6（甲口径 6 命令 / 0 真 α）。
   * ⚠ 旧 `tests:131 toHaveLength(12)` / `tests:132 无 polygon` 两条在此**改述 + 反转**：
   *   前者 → 6 条白名单序；后者 → **kind 白名单 + 条数上限**（ADR-0023 M-5），
   *   且反转同批由下方 `TC-STY-12` 几何判据承接（⛔ 净放宽，§K.5 附行）。
   * ───────────────────────────────────────────────────────────────────── */

  // §K.5 行 3–8：层序 = 底 rect → 上/左/右/下 polygon → 孔 circle。
  it('四棱新基线：6 条层序 = rect → polygon×4 → circle（§7.11.1 绘制序）', () => {
    const commands = filled(1);
    expect(commands.map((c) => c.kind)).toEqual([
      'rect', // #1 底 plate（`mix(base, −0.34)`，暗底兼描边 ⇒ 排除出 C12 统计域）
      'polygon', // #2 上刻面 `endpoints.lit`
      'polygon', // #3 左刻面 `endpoints.base`
      'polygon', // #4 右刻面 `mix(base, −0.16)`
      'polygon', // #5 下刻面 `endpoints.edge`
      'circle', // #6 单孔（甲口径，孔底 = 目标色 `pit`）
    ]);
    expect(commands).toHaveLength(6);
  });

  // 旧 `:132`「无 polygon」的**改述形态**（ADR-0023 M-5）：kind 白名单 + 条数上限。
  // 拦的是“新基线里混进旧层族图元”（line / stroke-only rect / 多一枚 circle），
  // 而不是“拦 polygon”⇒ 语义从“禁某种图元”升为“只允许可枚举集 + 不触门”。
  it('四棱新基线：kind 白名单 {rect,polygon,circle} + 条数 ≤ 7 + 真 α ≤ 2（旧「无 polygon」改述）', () => {
    const ALLOWED = new Set(['rect', 'polygon', 'circle']);
    for (const colorIdx of [1, 5, 10]) {
      for (const targetColorIdx of [undefined, 2]) {
        const commands = emit((b) =>
          drawFilledBead(b, 100, 200, colorIdx, {
            size: BEAD_CELL,
            inks: DEMO_BEAD_INKS,
            ...(targetColorIdx === undefined ? {} : { targetColorIdx }),
          }),
        );
        expect(commands.length).toBeLessThanOrEqual(BEAD_STYLE_MAX_COMMANDS);
        for (const c of commands) {
          expect(ALLOWED.has(c.kind), `kind=${c.kind} ∈ 白名单`).toBe(true);
        }
        // 真 α 计数口径引自 `contract.ts::isRealAlphaLayer`（= 门禁 `probe()` 同式，K-042）。
        const layers = DEFAULT_BEAD_STYLE.beadLayers({
          inks: DEMO_BEAD_INKS,
          colorIdx,
          targetColorIdx,
          size: BEAD_CELL,
        });
        expect(layers.filter(isRealAlphaLayer).length).toBeLessThanOrEqual(BEAD_STYLE_MAX_ALPHA_LAYERS);
        // 本风格实测就 **等于** 6/0：纸面与实算不符即红（⛔ 不拿上限当现状）。
        expect(layers).toHaveLength(6);
        expect(layers.filter(isRealAlphaLayer)).toHaveLength(0);
      }
    }
  });

  // §K.5 行 7 的**凸感唯一载体**：墨序必须是**有序序列**（集合断言不足以锁序）。
  it('四棱新基线：刻面墨序有序序列 = lit → base → −0.16 → edge（上亮→左本→右中暗→下暗）', () => {
    const base = beadColorOf(DEMO_BEAD_INKS, 4);
    const e = endpointOf(DEMO_BEAD_INKS, 4);
    const inks = filled(4).filter((c) => c.kind === 'polygon').map((c) => (c as { fill: string }).fill);
    expect(inks).toEqual([e.lit, e.base, mix(base, FACET4_FACET_RIGHT_MIX), e.edge]);
    // 四档互不相同（否则“序”无意义）且都属本格端点族/同族 mix 派生（C3 零新色）。
    expect(new Set(inks).size).toBe(4);
  });

  // §K.5 行 3：主体锥点重指 —— base 不再由「第 3 条 rect」承载。
  it('四棱新基线：底 rect 不是主体色（承重迁移的正面登记）', () => {
    const plate = filled(1)[0]!;
    expect(plate.kind === 'rect' && plate.fill).toBe(mix(beadColorOf(DEMO_BEAD_INKS, 1), FACET4_PLATE_MIX));
    // ⛔ 不得把“第一条 fill == base”当判据（那是已作废的 C12 强读法）。
    expect((plate as { fill: string }).fill).not.toBe(beadColorOf(DEMO_BEAD_INKS, 1));
    // 左刻面才是 base 承载体（行 3 「新 3 polygon = endpoints.base」）。
    const left = filled(1)[2]!;
    expect(
      left.kind === 'polygon' && left.fill,
    ).toBe(beadColorOf(DEMO_BEAD_INKS, 1));
  });

  // §7.11.1 几何：四枚三角 = (角A, 角B, 格心)，四角内缩 `FACET4_FACET_INSET × S`。
  // ⚠ 顶点经 `polygonVertices` 读（命令只存 arena `offset/count`，ADR-0024 值语义）。
  it('四棱新基线：四枚三角共第三顶点于珠心，且直角边两角内缩 0.09S', () => {
    const size = 50;
    const i2 = size * FACET4_FACET_INSET;
    const h = size / 2;
    const { model, commands } = emitModel((b) => drawFilledBead(b, 100, 200, 1, { size }));
    const polys = commands.filter((c) => c.kind === 'polygon') as readonly PolygonCommand[];
    expect(polys).toHaveLength(4);
    const vertsOf = (cmd: PolygonCommand): number[] => Array.from(polygonVertices(model, cmd));
    for (const p of polys) {
      const v = vertsOf(p);
      expect(v).toHaveLength(6);
      // 第三顶点（v[4], v[5]）恒 = 珠心（局部系原点 (0,0) 已由渲染侧平移到 (100,200)）。
      expect(v[4]).toBeCloseTo(100, 9);
      expect(v[5]).toBeCloseTo(200, 9);
    }
    // 内缩后的角坐标（上刻面 = 左上角 → 右上角）。
    const top = vertsOf(polys[0]!);
    expect(top[0]).toBeCloseTo(100 - h + i2, 6);
    expect(top[1]).toBeCloseTo(200 + h - i2, 6);
    expect(top[2]).toBeCloseTo(100 + h - i2, 6);
    expect(top[3]).toBeCloseTo(200 + h - i2, 6);
  });

  // §K.5 行 10（红线）+ 行 11（已采甲）：单枚 `circle` 且孔底 = 目标色 `pit`。
  it('四棱新基线：孔 = 恰 1 枚 circle 且孔底 = 目标色 pit（K3；仅“有 circle”无判别力）', () => {
    const size = 50;
    const board = emit((b) =>
      drawFilledBead(b, 100, 200, 1, { size, targetColorIdx: 3, inks: DEMO_BEAD_INKS }),
    );
    const holes = board.filter((c) => c.kind === 'circle');
    expect(holes).toHaveLength(1); // 乙口径双孔随十层退役 ⇒ 恰 1 枚
    const hole = holes[0]!;
    expect(hole.kind === 'circle' && hole.fill).toBe(endpointOf(DEMO_BEAD_INKS, 3).pit);
    // ⛔ 不是白孔（`18` spike 曾写 `#FFFFFF` 字面量 ⇒ 同式反例在此会红）。
    expect(hole.kind === 'circle' && hole.fill).not.toBe('#FFFFFF');
    // 孔径唯一真源 = 卡（spike 旧口径 0.17 常量已删）；⚠ 吃的是**绘制边长**（盘面珠已内缩）。
    const drawn = size - 2 * BEAD_DRAW_INSET;
    expect(hole.kind === 'circle' && hole.r).toBeCloseTo((drawn * BEAD_CARD.holeRatio) / 2, 9);
    // 无目标色（托盘珠）⇒ 回落本格 `pit`（端点表内色，C3 零新色）。
    const tray = emit((b) => drawFilledBead(b, 100, 200, 1, { size, inks: DEMO_BEAD_INKS }));
    const trayHoles = tray.filter((c) => c.kind === 'circle');
    expect(trayHoles).toHaveLength(1);
    expect(trayHoles[0]!.kind === 'circle' && trayHoles[0]!.fill).toBe(endpointOf(DEMO_BEAD_INKS, 1).pit);
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
    // 一个 z<1 档的格距。⚠ **v1.57（WXG-T-207-A）不再写死 42.4**：旧值在 32 基下已不是
    // “缩放档”（42.4 > 32，前置断言当场红）。改为**随基尺派生的非整数比例**（取旧 52 基
    // 14×14 盘的 fit ≈ 0.815 作比例源，仍保持“非整数值：防 `Math.round` 浑水摸鱼”的原意）。
    const SCALED = BEAD_PITCH * 0.815;
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
  // §K.5 行 1：新基线**无承载体** ⇒ 判据改指对照臂；负向防复活在 ledger 文件。
  it('[legacy-ten] §1.1 L0a lays a contact-shadow strip just below the bead', () => {
    const size = 50;
    const contact = legacy(1, size)[0]!;
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

  // L0b 投影：偏移 −3/64×BEAD，α 0.15。（§K.5 行 2：改指对照臂）
  it('[legacy-ten] §1.1 L0b offsets the drop shadow by 3/64 of the edge at α 0.15', () => {
    const size = 50;
    const commands = legacy(1, size);
    const shadow = commands[1]!;
    expect(shadow.kind === 'rect' && shadow.y).toBeCloseTo(200 - size / 2 - size * BEAD_CARD.shadowDy, 6);
    expect(shadow.kind === 'rect' && shadow.fill).toBe(withAlpha(BEAD_SHADOW_HEX, BEAD_SHADOW_ALPHA));
    expect(shadow.kind === 'rect' && shadow.radius).toBe(Math.round(size * BEAD_CARD.radius));
  });

  // L1 主体：基色取自色板索引，圆角 round(BEAD × 0.22)。（§K.5 行 3：改指对照臂）
  it('[legacy-ten] §1.1 L1 fills the body with the palette colour for that index', () => {
    for (const colorIdx of [1, 5, 10]) {
      const body = legacy(colorIdx)[2]!;
      expect(body.kind === 'rect' && body.fill).toBe(beadColorOf(DEMO_BEAD_INKS, colorIdx));
    }
  });

  // L2/L3 倒角：以基色为基准分别向黑/白偏移，并各覆盖两条边。（§K.5 行 5–9：改指对照臂）
  it('[legacy-ten] §1.1 L2/L3/L3b tint the bevels and rim from the base colour', () => {
    const base = beadColorOf(DEMO_BEAD_INKS, 4);
    const commands = legacy(4);
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
  // §K.5 行 10–12：新基线 = 单枚孔、无软高光 ⇒ 本例整条改指对照臂（乙口径双孔在此仍真）。
  it('[legacy-ten] §1.1 L4′ is a single offset oval highlight and L1c punches one centre hole', () => {
    const size = 50;
    const commands = legacy(2, size);
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
  // ⚠ **§K.5 台账外连带（回传登记）**：本例断的四个通道里三个（阴影/接触/侧壁）只存在于
  //   十层 ⇒ 整条改指对照臂；新基线侧的 lift 行为另见下方两例。
  it('[legacy-ten] §5 lift drives shadow, contact, body and side wall from one height parameter', () => {
    const rest = emit((b) => legacyOnPad(b));
    const up = emit((b) =>
      drawLegacyTenBead(b, 100, 200, 1, {
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
    expect(emit((b) => legacyOnPad(b))).toEqual(rest);
  });

  // 四棱新基线上的 `lift`：**只剩平移 + 尺寸增益两通道**（都在渲染侧算，与风格无关）。
  // 本例同时是「如实不透传」的正面登记：阴影族四个通道字段在六条输出上**无承载体**。
  it('四棱新基线：lift = 平移 + 尺寸增益（阴影族四通道无承载体 ⇒ 透传不改输出）', () => {
    const rest = emit((b) => beadOnPad(b));
    const up = emit((b) =>
      drawFilledBead(b, 100, 200, 1, {
        size: BEAD_CELL,
        targetColorIdx: 2,
        inks: DEMO_BEAD_INKS,
        lift: BEAD_CARD.liftRef,
      }),
    );
    // ① 平移：拿珠心量（孔心 = 珠心；四角三角的共点也 = 珠心）⇒ 恰好一个 lift。
    const holeY = (cs: typeof rest): number =>
      (cs.find((c) => c.kind === 'circle') as { y: number }).y;
    expect(holeY(up) - holeY(rest)).toBeCloseTo(BEAD_CARD.liftRef, 9);
    // ② 尺寸增益：底 rect 边长随 `liftScaleGain` 增长，且满抬起仍不越格（A5 前提）。
    const plateW = (cs: typeof rest): number =>
      (cs.find((c) => c.kind === 'rect') as { w: number }).w;
    const drawn = BEAD_CELL - 2 * BEAD_DRAW_INSET;
    expect(plateW(up)).toBeCloseTo(drawn * (1 + BEAD_CARD.liftScaleGain), 6);
    expect(plateW(up)).toBeGreaterThan(plateW(rest));
    expect(plateW(up)).toBeLessThan(BEAD_CELL);
    // ③ ⛔ 不静默吃入参也不静默造墨：四个阴影族通道传与不传 ⇒ 逐字节相同。
    const withShadowChannels = emit((b) =>
      drawFilledBead(b, 100, 200, 1, {
        size: BEAD_CELL,
        targetColorIdx: 2,
        inks: DEMO_BEAD_INKS,
        shadowAlpha: 0.9,
        contactAlpha: 0.9,
        contactWidth: 3,
        shadowDy: 0.5,
      }),
    );
    expect(withShadowChannels).toEqual(rest);
    // ④ 而且 lift 不会把阴影族“买回来”：条数不变、真 α 仍为 0。
    expect(up).toHaveLength(rest.length);
    expect(up.some((c) => (c.alpha ?? 1) < 1)).toBe(false);
  });

  // §1.1 最小特征约束：线宽 ≥ 2px —— 托盘尺寸（44px 珠）是最小使用场景。
  // ⚠ **§K.5 行 5–8**：新基线零 `line` 图元 ⇒ 本例留在新臂上就是平凡真（K-060）。
  //   改指对照臂；新基线侧的对应门 = 上方 kind 白名单（`line` 不允复活）。
  it('[legacy-ten] §1.1 keeps every card stroke ≥ 2px at the smallest bead size', () => {
    for (const size of [BEAD_CELL, TRAY_BEAD_SIZE]) {
      const commands = legacy(1, size);
      // 阳性对照（K.1a）：本臂确实有受该地板约束的图元，否则断言无对象。
      expect(commands.some((c) => c.kind === 'line')).toBe(true);
      for (const cmd of commands) {
        if (cmd.kind === 'line') expect(cmd.lineWidth).toBeGreaterThanOrEqual(BEAD_CARD.minStroke);
        if (cmd.kind === 'circle' && cmd.lineWidth !== undefined) {
          expect(cmd.lineWidth).toBeGreaterThanOrEqual(BEAD_CARD.minStroke);
        }
      }
    }
  });

  // §1.2 selected：整体上移 4px + L0 投影加深。
  it('[legacy-ten] §1.2 lift and shadow α follow the selected state', () => {
    const plain = legacy(1);
    const selected = emit((b) =>
      drawLegacyTenBead(b, 100, 200, 1, { size: BEAD_CELL, lift: 4, shadowAlpha: SELECTED_SHADOW_ALPHA }),
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

  // ─────────────────────────── TC-SKT-01（§12.9 步 2・assets-spec §7.11.7-D2 P0）───────────────
  //
  // 凹槽明暗线 **y 向**回归（判据正本 = `production/qa/beads/test-cases.md §K.4` TC-SKT-01）。
  // 设计空间 **y 轴向上** ⇒ 「凹」的正确读法 = 暗线走上缘、亮线走下缘（`y_dark > y_lit`）；
  // 现码曾长期反向（S3 暗线在 `bottom+inset` 下缘、S4 亮线在 `bottom+size−inset` 上缘 ⇒
  // 与珠体同向、§1.9.4 通道 2 失活）。上方 :348/:385 两条旧例只断言墨色与命令序、从不判 y
  // ⇒ 换向必假绿（K-035/K-060 同族），本例把方向本身锁死。
  //
  // 两条实现纪律（TC-SKT-01 原文）：
  // ① **按墨色分派**暗/亮（暗 = `edge` 族墨、亮 = `lit` 族墨），不按命令下标 ⇒ 换序不影响判别；
  // ② ⛔ 禁写成「两线 y 不相等」——换向态同样满足、零判别力；必须是方向断言 `y_dark > y_lit`。
  // 枚数按 `tilePainted` 两口径分别构造（K-041：4/5 钉错即假红；E 单 §7.11.5 对照行）。
  describe('TC-SKT-01 凹槽明暗线 y 向（凹读感 = 上暗下亮，y 向上 ⇒ y_dark > y_lit）', () => {
    type LineCmd = { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; lineWidth: number };
    /** 取凹槽两枚 line，按**墨色**分派暗/亮（墨色不在端点集内 = 构造失效，当场红）。 */
    const darkLitByInk = (cmds: readonly unknown[], darkInk: string, litInk: string): { dark: LineCmd; lit: LineCmd } => {
      const lines = cmds.filter((c): c is LineCmd => (c as { kind: string }).kind === 'line');
      expect(lines).toHaveLength(2);
      const dark = lines.find((l) => l.stroke === darkInk);
      const lit = lines.find((l) => l.stroke === litInk);
      expect(dark, `暗线墨 ${darkInk} 未在场`).toBeDefined();
      expect(lit, `亮线墨 ${litInk} 未在场`).toBeDefined();
      return { dark: dark!, lit: lit! };
    };

    it('托盘空槽口径（tilePainted=false ⇒ 自带大底 = 5 命令）：y_dark > y_lit', () => {
      const empty = emit((b) => drawEmptySocket(b, 100, 200, DEFAULT_PALETTE));
      // 枚数口径先钉死（K-041 次数轴 ±0）：大底 rect + S2 坑底 + S1 暗缘框 + S3/S4 两线 = 5。
      expect(empty).toHaveLength(5);
      const { dark, lit } = darkLitByInk(
        empty,
        mix(DEFAULT_PALETTE.slot, -0.3),   // 中性槽的 edge 族墨（neutralEndpoints）
        mix(DEFAULT_PALETTE.slot, 0.38),   // lit 族墨（SOCKET_LIT_MIX）
      );
      // 方向硬断言（差值、非存在性）：暗线在亮线**上方** = 凹。
      expect(dark.y1).toBeGreaterThan(lit.y1);
      expect(dark.y2).toBeGreaterThan(lit.y2);
    });

    it('网格空格口径（tilePainted=true ⇒ B0 已铺不刷底 = 4 命令）：y_dark > y_lit', () => {
      const idx = 1; // 奶白 ○
      const base = beadColorOf(DEMO_BEAD_INKS, idx);
      const grid = emit((b) => drawEmptySocket(b, 100, 200, DEFAULT_PALETTE, BEAD_CELL, idx, DEMO_BEAD_INKS, true));
      // 枚数口径：S2 坑底 + S1 暗缘框 + S3/S4 两线 = 4（大底由 B0 `drawTargetTile` 承担）。
      expect(grid).toHaveLength(4);
      const { dark, lit } = darkLitByInk(grid, mix(base, -0.3), mix(base, 0.38));
      expect(dark.y1).toBeGreaterThan(lit.y1);
      expect(dark.y2).toBeGreaterThan(lit.y2);
    });
  });

  // 可复现：同一输入两次渲染逐字节一致。
  it('is a pure function of its arguments', () => {
    expect(filled(7)).toEqual(filled(7));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WXG-T-207-A · **art 四条硬约束**（正本 = `art/assets-spec.md §1.10.9`，林绘澄 2026-09-24）。
//
// 这四条都是「过程约束的物化」：它们约的是**换尺一批改动不得拆升**，而不是某个像素值。
// 把它们从注释升级成断言的理由 = K-013（能机器查的不靠人记）；尤其第 ② 条，
// 「同提交」本身无法被测，但**成对锁**可以让“只改一半”当场红。
// ─────────────────────────────────────────────────────────────────────────────
describe('v1.57 art 硬约束（assets-spec §1.10.9 四条）', () => {
  /** 与渲染层同式的线宽地板（`bead-render` 内 `stroke()`：地板是绝对值、不随尺缩）。 */
  const strokeOf = (ratio: number, size: number) => Math.max(BEAD_CARD.minStroke, size * ratio);
  /** 序不变式裁判：**只允许可等，不允许反向**（钳同值 = 合法退化态）。 */
  const assertBevelOrder = (dark: number, light: number, rim: number): void => {
    if (!(dark >= light && light >= rim)) throw new Error('bevel width order violated');
  };

  // ① 倒角线宽**序**：暗 ≥ 亮 ≥ rim。反转 = 受光边被暗倒角压住 ⇒ 形体读反（光从左上）。
  it('① 序不变式：暗倒角 ≥ 亮倒角 ≥ rim（钳同值合法、序反转非法）', () => {
    const d = BEAD_CARD.bevelWidthDark;
    const l = BEAD_CARD.bevelWidthLight;
    const r = BEAD_CARD.rimWidth;
    assertBevelOrder(d, l, r); // 真卡必过
    expect(() => assertBevelOrder(r, l, d)).toThrow(); // 判别力自证：反序必被拒
    // 旧 52 基与新 32 基都不得因换尺而失序（换尺只改分母不改**序**）。
    for (const size of [50, BEAD_CELL, BEAD_CELL - 2 * BEAD_DRAW_INSET]) {
      const [sd, sl, sr] = [d, l, r].map((x) => strokeOf(x, size));
      expect(sd >= sl && sl >= sr).toBe(true);
    }
    // ⚠ **诚实登记 v1.57 已知代价（不是 bug，不得据此判绿）**：在新静息档绘制边长上
    // 三档全被 `minStroke=2` 钳成同宽 ⇒ 质感层次抹平（assets-spec §1.10.3 案 A /
    // 变更单 §2.3-2）。207-B 若选「分母 64→32」或「minStroke→1」，**本行期望值必须跟着改**。
    const drawn = BEAD_CELL - 2 * BEAD_DRAW_INSET;
    expect([strokeOf(d, drawn), strokeOf(l, drawn), strokeOf(r, drawn)]).toEqual([2, 2, 2]);
  });

  // ② 同批性：`BEAD_DRAW_INSET` 与 `BEAD_CARD.holeRatio` **互为对冲**，必须同提交。
  //    单条断言同时钉两值 ⇒ “只改一个”必红（把「同提交」变成机器可查的成对锁）。
  //    ⚠ 本例**故意复述两个数字**：它们不是 §3 镜像，而是「成对」这个约束的载体；
  //    任一值换档必须与另一值同批，并同步本行（正本 = assets-spec §1.10.2 / §1.10.4）。
  it('② 同批性：BEAD_DRAW_INSET 与 holeRatio 成对（v1.57 锁定值 4 / 0.44）', () => {
    expect([BEAD_DRAW_INSET, BEAD_CARD.holeRatio]).toEqual([4, 0.44]);
    // 再钉两个**派生读数**，防「两值都改但改错方向」：绘制边长与孔半径（设计 px）。
    expect(BEAD_CELL - 2 * BEAD_DRAW_INSET).toBe(22);
    expect(((BEAD_CELL - 2 * BEAD_DRAW_INSET) * BEAD_CARD.holeRatio) / 2).toBeCloseTo(4.84, 6);
  });

  // ③ inset 作用域：仅作用于**传 `targetColorIdx` 的盘面珠**；托盘珠恒 0。
  // ⚠ **两臂共有**：`inset` 在渲染侧算进 `size` 后才是风格入参 ⇒ 本例**双臂都跑**
  //   （旧只钉十层一条腿，新基线上静默失效 = 净放宽）；取“第一条 rect”作珠体外缘代理：
  //   新基线 #1 = plate rect、旧臂 L0b/L1 与之同宽（⛔ 不再按位置硬锚“第 3 条 = 主体”，§K.5 行 3）。
  it('③ inset 作域：仅盘面珠内缩，托盘珠（无 targetColorIdx）恒满幅（双臂）', () => {
    const bodyW = (cs: ReturnType<typeof emit>): number => {
      const c = cs.find((x) => x.kind === 'rect');
      return c && c.kind === 'rect' ? c.w : Number.NaN;
    };
    const board = emit((b) =>
      drawFilledBead(b, 100, 200, 1, { size: BEAD_CELL, targetColorIdx: 2, inks: DEMO_BEAD_INKS }),
    );
    const tray = emit((b) =>
      drawFilledBead(b, 100, 200, 1, { size: TRAY_BEAD_SIZE, inks: DEMO_BEAD_INKS }),
    );
    expect(bodyW(board)).toBe(BEAD_CELL - 2 * BEAD_DRAW_INSET); // 22 = 盘面珠内缩
    expect(bodyW(tray)).toBe(TRAY_BEAD_SIZE); // 44 = 托盘珠不缩（inset 恒 0）
    expect(bodyW(filled(1))).toBe(BEAD_CELL); // 不传目标色也不缩
    // 钉住**方向**：若有人给托盘也吃 inset，v1.57 后两个尺子会重排（此腿当场红）。
    expect(bodyW(tray)).toBeGreaterThan(bodyW(board));
    // 对照臂同尺：inset 属渲染侧 ⇒ 两臂的**珠体外缘**必须同一个值
    // （旧臂取 L1 主体 = 第 3 条，第 1 条是窄条接触阴影 ⇒ 不可直接比 index）。
    const legacyBodyW = (cs: ReturnType<typeof emit>): number => {
      const c = cs[2];
      return c && c.kind === 'rect' ? c.w : Number.NaN;
    };
    const legacyBoard = emit((b) =>
      drawLegacyTenBead(b, 100, 200, 1, { size: BEAD_CELL, targetColorIdx: 2, inks: DEMO_BEAD_INKS }),
    );
    const legacyTray = emit((b) =>
      drawLegacyTenBead(b, 100, 200, 1, { size: TRAY_BEAD_SIZE, inks: DEMO_BEAD_INKS }),
    );
    expect(legacyBodyW(legacyBoard)).toBe(bodyW(board));
    expect(legacyBodyW(legacyTray)).toBe(bodyW(tray));
  });

  // ④ 禁改色表：`view/palette.ts` 的 hex 家族在本批（及任何未走 art 单的批次）**一位不动**。
  //    实现 = 源码指纹锁（而不是把色表拄进测试 ⇒ 避免第二条真源，K-012）：
  //    先看掉注释（换尺批大量改注，不得误伤），再对**代码里的 hex 序列**取计数 + 摘要。
  //    要改色表 = 走 art 单（assets-spec §1.9.7①）并同步本快照；两值同改不会默默偷渡。
  it('④ 色表锁：palette.ts 代码内 hex 条数与指纹不变（§1.9.7①）', () => {
    const src = readFileSync(new URL('../src/view/palette.ts', import.meta.url), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const hexes = code.match(/#[0-9A-Fa-f]{6}/g) ?? [];
    expect(hexes.length).toBe(37);
    expect(createHash('sha1').update(hexes.join('|')).digest('hex').slice(0, 12)).toBe('fd5a0def780d');
  });
});
