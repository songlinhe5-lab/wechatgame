/**
 * **§K.5 十二条层序判据迁移台账 —— 逐行落点**（WXG-T-211-S3 / EP11-S3 · §12.2 C6）
 * ─────────────────────────────────────────────────────────────────────────────
 * 正本 = `production/qa/beads/test-cases.md` §K.5（行 1–12 + 附行）与 §K.5.1 四条迁移验收门。
 * 本文件是「四棱转正后旧十层判据去哪里了」的**唯一逐行答案**：每行一个 `it`，
 * 标题自带 `［§K.5 行 N·强度类别］`，正文第一行必写**旧锚位置**与**新承载体**。
 *
 * **纪律**（§11.3 沿用 + K-040/K-053/K-060）：
 *  - 每行必须归入「同强度 / 更强 / 改述 / 作废+负向防复活」四类之一，⛔ 禁止净删；
 *  - **作废行的负向断言必须可被"复活"变异判红** ⇒ 本文件每条负向门都配一个
 *    `mutant*` 变异臂（同一判定函数喂违规输入 ⇒ 必 throw），否则判据无判别力（K-060）；
 *  - 判定式一律写成**纯函数**（吃层集/命令 + 逐风格参数），⛔ 不得把"当前实现"抄成断言；
 *  - 数值只准引用 `tuning.ts` 命名常量与 `palette` 派生（K-042 真源单一），⛔ 裸字面量。
 *
 * 两臂命名（与 `bead-render.test.ts` 一致）：
 *  - **新基线臂** = `DEFAULT_BEAD_STYLE`（`facet-4`，`drawFilledBead` 真实消费）；
 *  - **对照臂** = `drawLegacyTenBead`（十层封箱，⛔ 不在 registry、不触 U16 玩家钮）。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  RenderModelBuilder,
  polygonVertices,
  type DrawCommand,
  type PolygonCommand,
  type RenderModel,
} from '@wxgame/framework';
import {
  BEAD_CARD,
  BEAD_CELL,
  BEAD_STYLE_MAX_ALPHA_LAYERS,
  BEAD_STYLE_MAX_COMMANDS,
  FACET4_FACET_RIGHT_MIX,
  FACET4_PLATE_MIX,
} from '../src/config/tuning.js';
import {
  BEAD_BEVEL_LIGHT_MIX,
  BEAD_HIGHLIGHT_HEX,
  BEAD_RIM_MIX,
  BEAD_SHADOW_HEX,
  BEAD_SOFT_HIGHLIGHT_ALPHAS,
  DEFAULT_PALETTE,
  DEMO_BEAD_INKS,
  beadColorOf,
  endpointOf,
  mix,
  withAlpha,
} from '../src/view/palette.js';
import { DEFAULT_BEAD_STYLE } from '../src/view/bead-styles/registry.js';
import {
  endpointFamily,
  isRealAlphaLayer,
  type BeadStyleInput,
  type BeadStyleLayer,
} from '../src/view/bead-styles/contract.js';
import { drawEmptySocket, drawFilledBead } from '../src/view/bead-render.js';
import { drawLegacyTenBead } from '../src/view/bead-styles/legacy-ten.js';

/* ────────────────────────── 夹具与判定式（可被变异臂复用） ────────────────────────── */

const SIZE = BEAD_CELL;

/** 取新基线层集的**深拷贝**（`beadLayers` 返回复用 scratch ⇒ 留档必须先拷，契约已写明）。 */
function layersOf(input: Partial<BeadStyleInput> & { inks: BeadStyleInput['inks']; colorIdx: number }): BeadStyleLayer[] {
  return DEFAULT_BEAD_STYLE.beadLayers({ size: SIZE, ...input }).map((l) => ({
    ...l,
    ...(l.kind === 'polygon' ? { points: [...l.points] as typeof l.points } : {}),
  }));
}

const baseLayers = () =>
  layersOf({ inks: DEMO_BEAD_INKS, colorIdx: 1, targetColorIdx: 2 });

const realAlphaLayers = (ls: readonly BeadStyleLayer[]) => ls.filter(isRealAlphaLayer);

/**
 * **行 1 / 行 11 共用的负向门**：珠体族不含任何真 α 层。
 * L0a 接触阴影（`alpha<1` 的贴底窄条）与孔内壁自阴影（`alpha 0.3`）都以「真 α 层」的形态
 * 被本式拦住 ⇒ 本断言**即 C7 α 计数门的一部分**（§K.5 行 1 原文），⛔ 不得删。
 */
function assertNoRealAlphaLayer(ls: readonly BeadStyleLayer[], styleId: string): void {
  const bad = realAlphaLayers(ls);
  if (bad.length > 0) {
    throw new Error(
      `[${styleId}] 复活了 ${bad.length} 枚真 α 层（kind=${bad.map((l) => l.kind).join(',')}），` +
        `超出逐风格 α 预算 ⇒ 触 C7 门（上限 ${BEAD_STYLE_MAX_ALPHA_LAYERS}）`,
    );
  }
}

/**
 * **行 2 的逐风格参数化判定**（C8：两臂 ⛔ 不得共用一条泛断言）。
 * `policy.dropShadow` = 该风格**允许的投影/接触族真 α 层数**，逐风格给定。
 */
const DROP_SHADOW_POLICY: Readonly<Record<string, { readonly dropShadowLayers: number }>> = {
  // 四棱 = §7.11.1 无投影族。
  'facet-4': { dropShadowLayers: 0 },
  // `18`（珐琅）= §K.5 行 2 / 7.11.3 行 1：自身硬投影 1 枚（`alpha 0.22`）且**计入真 α**。
  // ⚠ 该风格归 §12.9 步 4 注册 ⇒ 此处只作**判定式的第二臂参数**与变异自证用，
  //   不代表 `18` 已出池；出池时由步 4 用同一函数跑真实层集。
  '18-enamel': { dropShadowLayers: 1 },
};

function assertDropShadowBudget(
  ls: readonly BeadStyleLayer[],
  styleId: string,
): void {
  const policy = DROP_SHADOW_POLICY[styleId];
  if (!policy) throw new Error(`风格 ${styleId} 未登记投影政策（⛔ 不得默认放行）`);
  const n = realAlphaLayers(ls).length;
  if (n !== policy.dropShadowLayers) {
    throw new Error(
      `[${styleId}] 投影/接触族真 α 层数 = ${n}，政策 = ${policy.dropShadowLayers}` +
        `（逐风格参数化，⛔ 不得与别的风格共用泛断言）`,
    );
  }
}

/** 变异臂用：一枚"复活"的 L0a 接触阴影（几何与墨水逐字取自十层）。 */
function mutantContactShadow(): BeadStyleLayer {
  return {
    kind: 'rect',
    role: 'plate',
    x: -SIZE / 2 + SIZE * BEAD_CARD.contactX,
    y: -SIZE / 2 + SIZE * BEAD_CARD.contactY,
    w: SIZE * BEAD_CARD.contactW,
    h: SIZE * BEAD_CARD.contactH,
    fill: withAlpha(BEAD_SHADOW_HEX, 0.12),
    radius: Math.round(SIZE * BEAD_CARD.radius * BEAD_CARD.contactRadiusScale),
    alpha: 0.12,
  };
}

/** 变异臂用：十层 L0b 硬投影（`18` 政策下合法、四棱政策下违规）。 */
function mutantHardShadow(): BeadStyleLayer {
  return {
    kind: 'rect',
    role: 'plate',
    x: -SIZE / 2,
    y: -SIZE / 2 - SIZE * BEAD_CARD.shadowDy,
    w: SIZE,
    h: SIZE,
    fill: BEAD_SHADOW_HEX,
    alpha: 0.22,
  };
}

/** 变异臂用：十层 L2′ 侧壁（行 4 的复活对象）。 */
function mutantSideWall(): BeadStyleLayer {
  return {
    kind: 'rect',
    role: 'plate',
    x: -SIZE / 2,
    y: -SIZE / 2,
    w: SIZE,
    h: SIZE * BEAD_CARD.wallRatio,
    fill: mix(beadColorOf(DEMO_BEAD_INKS, 1), BEAD_CARD.wallDarkMix),
  };
}

/** 变异臂用：十层 L4′ 偏心软高光（行 12 的复活对象）。 */
function mutantSoftHighlight(): BeadStyleLayer {
  const g = BEAD_CARD.softHighlight[1]!;
  return {
    kind: 'rect',
    role: 'facet',
    x: -SIZE / 2 + SIZE * g.x,
    y: -SIZE / 2 + SIZE * g.y,
    w: SIZE * g.w,
    h: SIZE * g.h,
    fill: withAlpha(BEAD_HIGHLIGHT_HEX, BEAD_SOFT_HIGHLIGHT_ALPHAS[1]!),
    alpha: BEAD_SOFT_HIGHLIGHT_ALPHAS[1]!,
    radius: SIZE * g.radius,
  };
}

/* ────────────────────────────── 行 5–8：位置绑定的墨序判定 ────────────────────────────── */

type Quad = 'top' | 'left' | 'right' | 'bottom';

/**
 * 由顶点判定一枚三角刻面**占据哪四分之一**（§7.11.1 几何 = (角A, 角B, 格心)）：
 * 两枚非格心顶点即该面的两个角，按它们的符号定象限。⛔ 不按数组位置硬锚。
 */
function facetQuadrant(p: BeadStyleLayer): Quad {
  if (p.kind !== 'polygon') throw new Error('非 polygon 层不参与刻面象限判定');
  const v = p.points;
  const corners = [
    [v[0]!, v[1]!],
    [v[2]!, v[3]!],
  ] as const;
  const [ax, ay] = corners[0];
  const [bx, by] = corners[1];
  const abs = (n: number) => Math.abs(n);
  // 两角同 y ⇒ 水平边（上/下）；两角同 x ⇒ 竖直边（左/右）。
  if (abs(ay - by) < 1e-9) return ay > 0 ? 'top' : 'bottom';
  if (abs(ax - bx) < 1e-9) return ax < 0 ? 'left' : 'right';
  throw new Error(`刻面两角既不同 x 也不同 y（ax=${ax},ay=${ay},bx=${bx},by=${by}）⇒ 不是四分之一面`);
}

/**
 * **行 7 的墨序锚（凸感唯一载体）**：按象限取出四枚刻面的墨色，与**有序序列**逐一比对。
 * 序 = 上 `lit` → 左 `base` → 右 `mix(base,−0.16)` → 下 `edge`（上亮→左本→右中暗→下暗）。
 */
function assertInkOrder(
  ls: readonly BeadStyleLayer[],
  expected: Record<Quad, string>,
  styleId: string,
): void {
  const facets = ls.filter((l) => l.role === 'facet');
  const got: Partial<Record<Quad, string>> = {};
  for (const f of facets) got[facetQuadrant(f)] = f.fill;
  for (const q of ['top', 'left', 'right', 'bottom'] as const) {
    if (got[q] === undefined) throw new Error(`[${styleId}] 缺 ${q} 四分之一刻面（层数收益 ≠ 可以少一层）`);
    if (got[q] !== expected[q]) {
      throw new Error(
        `[${styleId}] ${q} 面墨色 = ${got[q]}，应为 ${expected[q]} ⇒ 明暗序被打乱` +
          `（凸感唯一载体，§7.11.1 核对结论；序不符即红）`,
      );
    }
  }
}

/** ⛔ 线族（`line` / `stroke`）不复活：新基线 kind 白名单（旧 `tests:132` 的改述形态）。 */
function assertKindWhitelist(ls: readonly BeadStyleLayer[], styleId: string): void {
  const ALLOWED: readonly string[] = ['rect', 'polygon', 'circle'];
  for (const l of ls) {
    if (!ALLOWED.includes(l.kind)) throw new Error(`[${styleId}] 出现白名单外 kind=${l.kind}`);
    if ('stroke' in l && (l as { stroke?: string }).stroke !== undefined) {
      throw new Error(`[${styleId}] 出现 stroke-only 层（倒角线族已退役，§K.5 行 5–8）`);
    }
  }
}

/** 枚数/条数上限（C7）：实测值另钉，⛔ 不得拿上限当现状。 */
function assertWithinBudget(ls: readonly BeadStyleLayer[], styleId: string): void {
  if (ls.length > BEAD_STYLE_MAX_COMMANDS) {
    throw new Error(`[${styleId}] 命令数 ${ls.length} > 上限 ${BEAD_STYLE_MAX_COMMANDS}`);
  }
  const n = realAlphaLayers(ls).length;
  if (n > BEAD_STYLE_MAX_ALPHA_LAYERS) {
    throw new Error(`[${styleId}] 真 α 层数 ${n} > 上限 ${BEAD_STYLE_MAX_ALPHA_LAYERS}`);
  }
}

/* ────────────────────────────── 行 9：三系数静态哨 ────────────────────────────── */

/**
 * 行 9 作废的**连带硬后果**（7.13 取证）：`BEAD_RIM_MIX` / `BEAD_BEVEL_LIGHT_MIX` /
 * `rimWidth` 三系数在四棱基线上**根本没有可调对象** ⇒ 06 珐琅「重推系数」的第一步是
 * **承载层选型（P-1）**，不是调数。本式 = 可机检的那一半：源文件里不得出现这些符号。
 */
const RIM_FAMILY_SYMBOLS = ['BEAD_RIM_MIX', 'BEAD_BEVEL_LIGHT_MIX', 'rimWidth'] as const;

function assertNoRimFamilyConsumer(source: string, file: string): void {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const hit = RIM_FAMILY_SYMBOLS.filter((s) => code.includes(s));
  if (hit.length > 0) throw new Error(`${file} 仍是 rim 线族系数的消费者：${hit.join(', ')}`);
}

/* ────────────────────────────── 附行：J-3 多珠不串形 ────────────────────────────── */

interface BeadSpec {
  readonly cx: number;
  readonly cy: number;
  readonly colorIdx: number;
}

/** 同一 builder 上画多颗珠（走**真渲染链** `drawFilledBead`，⛔ 不在测试里自己回放层集）。 */
type Drawer = (b: RenderModelBuilder, cx: number, cy: number, colorIdx: number) => void;

const realDrawer: Drawer = (b, cx, cy, colorIdx) =>
  drawFilledBead(b, cx, cy, colorIdx, { size: SIZE, targetColorIdx: 2, inks: DEMO_BEAD_INKS });

function drawBeads(
  draw: Drawer,
  beads: readonly BeadSpec[],
): { model: RenderModel; commands: readonly DrawCommand[] } {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  for (const b of beads) draw(builder, b.cx, b.cy, b.colorIdx);
  const model = builder.end();
  return { model, commands: model.commands };
}

/**
 * **ADR-0024 §6 J-3 / TC-STY-12**：逐颗断言「同珠 4 枚刻面的**顶点并集**质心 == 该颗格心」。
 * ⛔ 禁拿单枚三角形心替代（左/右面的形心并不落在格心，正是"串形"缺陷的可见形态）；
 * ⛔ 禁在本测试重推刻面几何公式（K-042）⇒ 只读命令顶点做均值。
 */
function assertNoShearedBeads(
  model: RenderModel,
  polys: readonly PolygonCommand[],
  beads: readonly BeadSpec[],
): void {
  const per = 4;
  if (polys.length !== beads.length * per) {
    throw new Error(`polygon 数 ${polys.length} ≠ 珠数 ${beads.length} × ${per} ⇒ 有珠缺刻面或串了批次`);
  }
  for (let i = 0; i < beads.length; i++) {
    const group = polys.slice(i * per, (i + 1) * per);
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const g of group) {
      const v = polygonVertices(model, g);
      for (let k = 0; k + 1 < v.length; k += 2) {
        sx += v[k]!;
        sy += v[k + 1]!;
        n += 1;
      }
    }
    const cx = sx / n;
    const cy = sy / n;
    if (Math.abs(cx - beads[i]!.cx) > 1e-6 || Math.abs(cy - beads[i]!.cy) > 1e-6) {
      throw new Error(
        `第 ${i + 1} 颗（格心 ${beads[i]!.cx},${beads[i]!.cy}）刻面顶点并集质心 = ${cx},${cy}` +
          ` ⇒ 多珠串形（J-3 红线）`,
      );
    }
  }
}

/* ═════════════════════════════════ 12 行台账 + 附行 ═════════════════════════════════ */

describe('§K.5 十二行迁移台账（EP11-S3 四棱转正 · 逐行落点）', () => {
  // ── 行 1｜L0a 接触阴影｜作废 + 负向防复活 ──────────────────────────────
  // 旧锚：`bead-render.test.ts`「[legacy-ten] §1.1 L0a lays a contact-shadow strip…」（承重迁移目标）
  // 新承载体：无（四棱不含投影族）⇒ 负向断言 = 珠体族不含真 α 层，**即 α 计数门的一部分**。
  it('［§K.5 行 1·作废+负向］珠体族不含 α<1 的接触阴影（负向门可被复活变异判红）', () => {
    const ls = baseLayers();
    expect(() => assertNoRealAlphaLayer(ls, 'facet-4')).not.toThrow();
    // 变异自证（K-060）：把十层 L0a 塞回来 ⇒ 同一条判定必须红。
    expect(() => assertNoRealAlphaLayer([...ls, mutantContactShadow()], 'facet-4')).toThrow(
      /复活了 1 枚真 α 层/,
    );
    // 且红在"复活层"本身：删掉它立刻转绿（证明不是恒红的废断言）。
    expect(realAlphaLayers(ls)).toHaveLength(0);
  });

  // ── 行 2｜L0b 投影｜作废 + 负向防复活（**逐风格参数化**）──────────────
  // 判据按 styleId 参数化（C8）：四棱臂断"无"、`18` 臂断"恰 1 枚且计入真 α"。
  // ⛔ 两臂不得共用一条泛断言 ⇒ 同一函数、两个政策值，各自可被反向变异判红。
  it('［§K.5 行 2·作废+负向·逐风格参数化］投影族政策：四棱 = 0 枚、18 臂 = 恰 1 枚且计真 α', () => {
    const ls = baseLayers();
    expect(() => assertDropShadowBudget(ls, 'facet-4')).not.toThrow();
    // 四棱臂变异：复活一枚硬投影 ⇒ 按四棱政策红。
    expect(() => assertDropShadowBudget([...ls, mutantHardShadow()], 'facet-4')).toThrow(
      /facet-4.*投影\/接触族真 α 层数 = 1，政策 = 0/,
    );
    // 18 臂（步 4 出池前用构造层集跑同一函数）：恰 1 枚合法；两枚 ⇒ 红。
    const enamel = [...ls, mutantHardShadow()];
    expect(() => assertDropShadowBudget(enamel, '18-enamel')).not.toThrow();
    expect(() => assertDropShadowBudget([...enamel, mutantHardShadow()], '18-enamel')).toThrow(
      /18-enamel.*= 2，政策 = 1/,
    );
    // 两臂政策值确实不同 ⇒ 证明"泛断言"不成立（同一条数据在一臂绿、另一臂红）。
    expect(() => assertDropShadowBudget(enamel, 'facet-4')).toThrow();
    expect(() => assertDropShadowBudget(ls, '18-enamel')).toThrow();
    // 未登记政策的风格 ⇒ 直接红（⛔ 不得默认放行）。
    expect(() => assertDropShadowBudget(ls, 'unknown-style')).toThrow(/未登记投影政策/);
  });

  // ── 行 3｜L1 主体｜改述（承重迁移）──────────────────────────────────
  // 旧锚：`tests:203-208`（取"第 3 条 rect = 基色"）⇒ 已改指对照臂。
  // 新承载体：#1 `rect` 满格 `mix(base,−0.34)`（暗底兼描边，role=plate）+ #3 `polygon` = `base`。
  // ⛔ 层序判据不得再按位置硬锚"第 3 条 = 主体"⇒ 主体由 **role** 与 C12 占比认定法识别。
  it('［§K.5 行 3·改述·承重迁移］主体锚点重指：plate ≠ base，base 由 facet 承载', () => {
    const ls = baseLayers();
    const base = beadColorOf(DEMO_BEAD_INKS, 1);
    const plates = ls.filter((l) => l.role === 'plate');
    expect(plates).toHaveLength(1);
    expect(plates[0]!.kind).toBe('rect');
    expect(plates[0]!.fill).toBe(mix(base, FACET4_PLATE_MIX)); // = mix(base,−0.34)（命名常量，非裸字面量）
    expect(plates[0]!.fill).not.toBe(base); // 第 1 条不是主体（旧"第 3 条 = 基色"不再成立）
    // base 的真实承载体 = 一枚 facet（按 role 找，⛔ 不按 index 找）。
    expect(ls.filter((l) => l.role === 'facet' && l.fill === base)).toHaveLength(1);
    // C12 认定域（facet 族）四色全属本格端点同族（真源 = `endpointFamily`，⛔ 不另列清单）。
    const family = new Set(endpointFamily(DEMO_BEAD_INKS, 1));
    const facetFills = ls.filter((l) => l.role === 'facet').map((l) => l.fill);
    expect(facetFills).toHaveLength(4);
    for (const f of facetFills) {
      expect(family.has(f) || f === mix(base, FACET4_FACET_RIGHT_MIX), `墨色 ${f} 越出同族`).toBe(true);
    }
    // 变异自证：把 plate 涂成 base（伪装"第一条就是主体"）⇒ 承重迁移登记被破，必须红。
    const mutant = ls.map((l) => (l.role === 'plate' ? { ...l, fill: base } : l));
    expect(mutant.find((l) => l.role === 'plate')!.fill).toBe(base);
    expect(
      // 判定式：plate 层不得等于 base（否则 C12 统计域与底衬无法区分）。
      () => {
        for (const l of mutant) if (l.role === 'plate' && l.fill === base) throw new Error('plate 涂成 base ⇒ 主体锚点又被按位置硬锚');
      },
    ).toThrow();
  });

  // ── 行 4｜L2′ 侧壁｜作废 + 负向防复活 ────────────────────────────────
  // 旧锚：`tests:211-228`（第 4 条 rect 侧壁）⇒ 已改指对照臂。
  // 新基线：凸起由四枚刻面墨序承担 ⇒ 断言「珠体族只有一枚 rect」，第 4 条不可能再是 rect 侧壁。
  it('［§K.5 行 4·作废+负向］第 4 条不得再出现 rect 侧壁（rect 计数 = 1）', () => {
    const ls = baseLayers();
    const rects = ls.filter((l) => l.kind === 'rect');
    expect(rects).toHaveLength(1); // 只有底衬 ⇒ 位置 2–5 全为 polygon
    expect(ls[3]!.kind).toBe('polygon');
    // 变异自证：插回十层 L2′ 侧壁 ⇒ 判红。
    expect(() => {
      const m = [...ls, mutantSideWall()];
      const r = m.filter((l) => l.kind === 'rect');
      if (r.length !== 1) throw new Error(`rect 计数 = ${r.length}（侧壁复活，§K.5 行 4 负向门）`);
    }).toThrow(/侧壁复活/);
    // 同时钉住“枚数不会偷越 C7 预算”：真臂 6 条；塞到 8 条 ⇒ 枚数门红。
    expect(() => assertWithinBudget(ls, 'facet-4')).not.toThrow();
    expect(() => assertWithinBudget([...ls, ...ls.slice(0, 2)], 'facet-4')).toThrow(/命令数 8 > 上限 7/);
  });

  // ── 行 5｜L2 暗倒角·下边｜改述（kind 换，语义保）───────────────────
  // 新承载体 = 下四分之一 `polygon`，fill = `endpoints.edge`（语义锚「下四分之一为暗端」）。
  it('［§K.5 行 5·改述］暗端语义锚保留：下四分之一 = polygon 且 fill = endpoints.edge', () => {
    const ls = baseLayers();
    const e = endpointOf(DEMO_BEAD_INKS, 1);
    const bottom = ls.filter((l) => l.role === 'facet' && l.kind === 'polygon' && facetQuadrant(l) === 'bottom');
    expect(bottom).toHaveLength(1);
    expect(bottom[0]!.fill).toBe(e.edge);
    // 线判据不得原样沿用：本层 kind 必是 polygon，`line` 在白名单外。
    expect(bottom[0]!.kind).toBe('polygon');
    // 变异自证：下面换成亮端 ⇒ 语义锚红。
    const mutant = ls.map((l) => (l.kind === 'polygon' && facetQuadrant(l) === 'bottom' ? { ...l, fill: e.lit } : l));
    expect(() =>
      assertInkOrder(mutant, { top: e.lit, left: beadColorOf(DEMO_BEAD_INKS, 1), right: mix(e.base, FACET4_FACET_RIGHT_MIX), bottom: e.edge }, 'facet-4'),
    ).toThrow(/bottom 面墨色/);
  });

  // ── 行 6｜L2 暗倒角·右边｜改述（⚠ 表外系数 −0.16 已归位 tuning）─────
  it('［§K.5 行 6·改述］右四分之一 = mix(base, FACET4_FACET_RIGHT_MIX)（系数已入 tuning，⛔ 裸字面量）', () => {
    const ls = baseLayers();
    const base = beadColorOf(DEMO_BEAD_INKS, 1);
    const right = ls.filter((l) => l.role === 'facet' && facetQuadrant(l) === 'right');
    expect(right).toHaveLength(1);
    expect(right[0]!.fill).toBe(mix(base, FACET4_FACET_RIGHT_MIX));
    expect(FACET4_FACET_RIGHT_MIX).toBe(-0.16); // 与 §7.11.1 行 4 的表外系数同值（命名常量，非就地字面量）
    // 变异自证：右面误用 edge（= 与下面同色）⇒ 判红（四枚墨色必须四档分明）。
    const e = endpointOf(DEMO_BEAD_INKS, 1);
    const mutant = ls.map((l) => (l.role === 'facet' && facetQuadrant(l) === 'right' ? { ...l, fill: e.edge } : l));
    expect(() =>
      assertInkOrder(mutant, { top: e.lit, left: base, right: mix(base, FACET4_FACET_RIGHT_MIX), bottom: e.edge }, 'facet-4'),
    ).toThrow(/right 面墨色/);
  });

  // ── 行 7｜L3 亮倒角·上边｜改述：**墨序必须作有序序列断言** ──────────
  it('［§K.5 行 7·改述］墨序有序序列 lit → base → −0.16 → edge（集合断言不足以锁序）', () => {
    const ls = baseLayers();
    const base = beadColorOf(DEMO_BEAD_INKS, 1);
    const e = endpointOf(DEMO_BEAD_INKS, 1);
    const expected = { top: e.lit, left: base, right: mix(base, FACET4_FACET_RIGHT_MIX), bottom: e.edge };
    expect(() => assertInkOrder(ls, expected, 'facet-4')).not.toThrow();
    // 序 = 数组绘制序也必须是 上→左→右→下（#2–#5，§7.11.1 行 2–5）。
    expect(ls.filter((l) => l.role === 'facet').map((l) => facetQuadrant(l))).toEqual(['top', 'left', 'right', 'bottom']);
    // 变异自证 ①：上/下墨色互换（集合不变、序变）⇒ 只有**有序**断言能拦（防"集合断言"假绿）。
    const swapped = ls.map((l) => {
      if (l.kind !== 'polygon' || l.role !== 'facet') return l;
      const q = facetQuadrant(l);
      if (q === 'top') return { ...l, fill: e.edge };
      if (q === 'bottom') return { ...l, fill: e.lit };
      return l;
    });
    expect(new Set(swapped.filter((l) => l.role === 'facet').map((l) => l.fill))).toEqual(
      new Set(ls.filter((l) => l.role === 'facet').map((l) => l.fill)),
    ); // 集合确实没变 ⇒ 证伪"只比集合"的弱判据
    expect(() => assertInkOrder(swapped, expected, 'facet-4')).toThrow(/序不符|面墨色/);
    // 变异自证 ②：少一层（把"层数收益"误读成"可以少画"）⇒ 同样判红。
    const missingBottom = ls.filter((l) => !(l.kind === 'polygon' && l.role === 'facet' && facetQuadrant(l) === 'bottom'));
    expect(() => assertInkOrder(missingBottom, expected, 'facet-4')).toThrow(/缺 bottom 四分之一刻面/);
  });

  // ── 行 8｜L3 亮倒角·左边｜改述（两枚并一枚：4 line → 4 polygon 映射逐条写明）──
  it('［§K.5 行 8·改述］4 line → 4 polygon 的逐条映射（枚数不降级，两枚亮倒角并一枚 base 面）', () => {
    const ls = baseLayers();
    // 映射表（旧十层 5 条 line 中的 4 条 → 新 4 枚 polygon；第 5 条 rim 见行 9）。
    const MAPPING: ReadonlyArray<{ readonly old: string; readonly newKind: 'polygon'; readonly quadrant: Quad }> = [
      { old: 'L2 暗倒角·下边（line）', newKind: 'polygon', quadrant: 'bottom' },
      { old: 'L2 暗倒角·右边（line）', newKind: 'polygon', quadrant: 'right' },
      { old: 'L3 亮倒角·上边（line）', newKind: 'polygon', quadrant: 'top' },
      { old: 'L3 亮倒角·左边（line）＋并入左面 base', newKind: 'polygon', quadrant: 'left' },
    ];
    const quads = ls.filter((l) => l.role === 'facet').map((l) => facetQuadrant(l));
    expect(quads).toHaveLength(4); // 旧 4 line → 新 4 polygon：枚数**等值**（−1 来自 rim，见行 9）
    for (const m of MAPPING) expect(quads).toContain(m.quadrant);
    // 旧臂侧对照：十层确实是 5 条 line（含 rim）⇒ 4→4 的"少一条"只可能来自 rim，不是降级。
    const ten = legacyLayersCommands();
    expect(ten.filter((c) => c.kind === 'line')).toHaveLength(5);
    // 变异自证：把左面（并档后那枚）删掉 ⇒ 枚数 3，映射表当场红。
    const mutant = ls.filter((l) => !(l.kind === 'polygon' && l.role === 'facet' && facetQuadrant(l) === 'left'));
    expect(mutant.filter((l) => l.role === 'facet')).toHaveLength(3);
    expect(() => assertKindWhitelist(mutant, 'facet-4')).not.toThrow(); // kind 门不拦少画 ⇒ 必须靠枚数门
    expect(() => assertInkOrder(mutant, {
      top: endpointOf(DEMO_BEAD_INKS, 1).lit,
      left: beadColorOf(DEMO_BEAD_INKS, 1),
      right: mix(beadColorOf(DEMO_BEAD_INKS, 1), FACET4_FACET_RIGHT_MIX),
      bottom: endpointOf(DEMO_BEAD_INKS, 1).edge,
    }, 'facet-4')).toThrow(/缺 left 四分之一刻面/);
  });

  // ── 行 9｜L3b rim 光｜作废 + **连带硬后果登记** ──────────────────────
  // 7.13 取证：三系数在四棱基线**没有可调对象** ⇒ 06 珐琅第一步是**选型（P-1）**、不是调数。
  // ⚠ 本行作废必须在 K.6 出池门引用里体现，否则会被读成"06 只差调数"（登记在下方注释与回传）。
  it('［§K.5 行 9·作废+连带登记］rim 三系数在四棱基线零消费者（静态哨 + 对照臂阳性在场）', () => {
    const facet4Src = readFileSync(new URL('../src/view/bead-styles/facet-4.ts', import.meta.url), 'utf8');
    expect(() => assertNoRimFamilyConsumer(facet4Src, 'facet-4.ts')).not.toThrow();
    // 新基线层集零 stroke / 零 line 图元（= 线族确实没有承载体）。
    const ls = baseLayers();
    expect(() => assertKindWhitelist(ls, 'facet-4')).not.toThrow();
    expect(ls.some((l) => 'stroke' in l)).toBe(false);
    // **阳性对照**（K.1a）：同一哨在对照臂上必须命中，否则本门可能恒不成立而假绿。
    const legacySrc = readFileSync(new URL('../src/view/bead-styles/legacy-ten.ts', import.meta.url), 'utf8');
    expect(() => assertNoRimFamilyConsumer(legacySrc, 'legacy-ten.ts')).toThrow(/BEAD_RIM_MIX/);
    // 变异自证：把 rim 线族塞进四棱源文件 ⇒ 判红（注：下面是**源码文本**臂，⛔ 不会真编译）。
    expect(() =>
      assertNoRimFamilyConsumer(`${facet4Src}\nconst rim = mix(base, BEAD_RIM_MIX);`, 'facet-4.ts(变异臂)'),
    ).toThrow(/facet-4\.ts\(变异臂\)/);
    // 三系数本身仍留在 palette / 卡（06 与对照臂要用）⇒ 本行作废 ≠ 删常量。
    expect(BEAD_RIM_MIX).toBeTypeOf('number');
    expect(BEAD_BEVEL_LIGHT_MIX).toBeTypeOf('number');
    expect(BEAD_CARD.rimWidth).toBeTypeOf('number');
  });

  // ── 行 10｜L1c 孔底｜改述（**红线改述**）────────────────────────────
  // 旧锚：`tests:231-261` 的"两枚 circle"⇒ 改指对照臂；新红线 = 至少 1 枚 circle **且底色 = 目标色 pit**。
  // ⚠ 孔径 0.17↔0.22 之争 = `[待定·不判]`（S9 §5 / C5 待真机 A/B）⇒ 只钉"唯一真源 = 卡"的派生式。
  it('［§K.5 行 10·改述·红线］孔 = ≥1 枚 circle 且孔底 = 目标色 pit（仅"有 circle"无判别力）', () => {
    const ls = baseLayers();
    const holes = ls.filter((l) => l.role === 'hole');
    expect(holes.length).toBeGreaterThanOrEqual(1);
    expect(holes.every((h) => h.kind === 'circle')).toBe(true);
    expect(holes[0]!.fill).toBe(endpointOf(DEMO_BEAD_INKS, 2).pit); // 目标格（本夹具 targetColorIdx=2）
    // 半径**派生**（⛔ 不写死 0.17/0.22：孔径之争归真机 A/B）。
    expect(holes[0]!.kind === 'circle' && holes[0]!.r).toBe((SIZE * BEAD_CARD.holeRatio) / 2);
    // 变异自证 ①：白孔（`18` spike 曾写 `#FFFFFF` 字面量的违例形态）⇒ 判红。
    const white = ls.map((l) => (l.role === 'hole' ? { ...l, fill: '#FFFFFF' } : l));
    expect(() => assertHoleIsPitOfTarget(white, 2)).toThrow(/应为目标色 pit/);
    // 变异自证 ②：孔底退回自身 base（S2 照抄 spike 的乙口径）⇒ 同样判红。
    const selfBase = ls.map((l) => (l.role === 'hole' ? { ...l, fill: beadColorOf(DEMO_BEAD_INKS, 1) } : l));
    expect(() => assertHoleIsPitOfTarget(selfBase, 2)).toThrow(/应为目标色 pit/);
    // 变异自证 ③：不画孔（小豆档误用到满豆档）⇒ 同样判红。
    expect(() => assertHoleIsPitOfTarget(ls.filter((l) => l.role !== 'hole'), 2)).toThrow(/没画孔/);
    // 无目标色 ⇒ 契约口径 `targetColorIdx ?? colorIdx` 回落本格 pit（仍是端点表内色，C3 零新色）。
    const tray = layersOf({ inks: DEMO_BEAD_INKS, colorIdx: 3 });
    expect(tray.find((l) => l.role === 'hole')!.fill).toBe(endpointOf(DEMO_BEAD_INKS, 3).pit);
  });

  /** 行 10 的判定式（吃层集 + 目标格，可喂变异臂）。 */
  function assertHoleIsPitOfTarget(ls: readonly BeadStyleLayer[], targetColorIdx: number): void {
    const holes = ls.filter((l) => l.role === 'hole');
    if (holes.length < 1) throw new Error('满豆档没画孔 ⇒ 触识别红线（C5/C6）');
    const want = endpointOf(DEMO_BEAD_INKS, targetColorIdx).pit;
    for (const h of holes) {
      if (h.fill !== want) throw new Error(`孔底 = ${h.fill}，应为目标色 pit ${want}（K3 透色；白孔/自身色孔均判红）`);
    }
  }

  // ── 行 11｜L1c 孔内壁自阴影｜**D4 双口径 ⇒ 已采甲，登记已接受代价** ──
  // 采甲（用户 2026-09-26 裁定）：孔 = 单枚 circle ⇒「孔内壁深感」通道随十层退役**消失**。
  // ⚠ 该代价 = `[待真机]`（观感归 Playtest），且**必须**在 §6 差分记录显式记账 ⇒ 本例的
  //   机械腿 = 枚数与真 α 计数，二者任一回到乙口径数值即红（= 逼一次"重新记账"）。
  it('［§K.5 行 11·待裁已采甲］单枚孔 + 零真 α（回到乙口径即红 ⇒ 强制重新记账）', () => {
    const ls = baseLayers();
    expect(ls.filter((l) => l.role === 'hole')).toHaveLength(1); // 乙口径 = 2 枚
    expect(realAlphaLayers(ls)).toHaveLength(0); // 乙口径 = 1 枚（内壁 alpha 0.3 真 α）
    // 十层对照臂仍在：双枚孔 + 内壁真 α（通道未消失，只是移出主盘）。
    const tenHoles = legacyLayerSet().filter((l) => l.role === 'hole');
    expect(tenHoles.length).toBeGreaterThan(1);
    // ⚠ 已接受代价登记（⛔ 不是 bug、⛔ 不得据此反推"四棱必须有内壁"）：
    //   「孔内壁深感」= 旧 L1c 第 2 枚 circle（`BEAD_SHADOW_HEX` + `alpha 0.3`）的唯一职责，
    //   新基线无该层 ⇒ 观感是否劣化 = Playtest `[待真机]` 观察项（S7 真机回评）。
    expect(tenHoles.some((l) => (l.alpha ?? 1) < 1)).toBe(true);
  });

  // ── 行 12｜L4′ 偏心椭圆高光｜作废 + 负向防复活（**方向不可反用**）────
  // 现码「无软高光 ⇒ 不读作珠」的负向断言（`bead-render.test.ts` 凹槽例）防的是
  // "凹槽被画成珠" ⇒ ⛔ 不得改读为"四棱必须有高光"。新基线该断言仍为**负向门**。
  it('［§K.5 行 12·作废+负向］四棱无软高光（负向门方向不变，可被复活变异判红）', () => {
    const ls = baseLayers();
    const hl = withAlpha(BEAD_HIGHLIGHT_HEX, BEAD_SOFT_HIGHLIGHT_ALPHAS[1]!);
    expect(ls.some((l) => l.fill === hl)).toBe(false);
    expect(() => assertNoRealAlphaLayer(ls, 'facet-4')).not.toThrow();
    // 变异自证：复活 L4′ 软高光 ⇒ 双重红（真 α 门 + 高光墨色门）。
    const revived = [...ls, mutantSoftHighlight()];
    expect(() => assertNoRealAlphaLayer(revived, 'facet-4')).toThrow();
    expect(revived.some((l) => l.fill === hl)).toBe(true);
    // 方向自证（⛔ 不得反用）：凹槽臂**依然**无软高光 = 同一枚负向门，两臂各自成立。
    const socket = emitCommands((b) => drawEmptySocket(b, 100, 200, DEFAULT_PALETTE));
    expect(socket.length).toBeGreaterThan(0); // 阳性对照：凹槽确实画了东西
    expect(socket.some((c) => c.kind === 'rect' && c.fill === hl)).toBe(false);
  });

  // ── 附行｜`tests:132`「无 polygon」反转 ⇒ **同批**由 TC-STY-12 / J-3 承接 ──
  // 旧断言拦的是"polygon 缺位"，新断言拦的是"polygon 串形"⇒ 语义不等，⛔ 不得称"等价替换"
  // （K-040 ②）⇒ 本单**同批**落 J-3 几何判据（正本 = ADR-0024 §6 / QA TC-STY-12）。
  it('［§K.5 附行·作废→TC-STY-12 承接］多珠不串形：逐颗刻面顶点并集质心 == 该颗格心', () => {
    const beads: BeadSpec[] = [
      { cx: 100, cy: 200, colorIdx: 1 },
      { cx: 152, cy: 200, colorIdx: 4 },
      { cx: 204, cy: 304, colorIdx: 7 },
    ];
    const { model, commands } = drawBeads(realDrawer, beads);
    const polys = commands.filter((c) => c.kind === 'polygon') as readonly PolygonCommand[];
    expect(polys).toHaveLength(beads.length * 4);
    expect(() => assertNoShearedBeads(model, polys, beads)).not.toThrow();
    // 变异自证（串形缺陷形态）：第 2 颗复用第 1 颗的顶点 ⇒ 并集质心偏离该颗格心 ⇒ 必红。
    const sheared = new RenderModelBuilder(750, 1334);
    sheared.begin();
    const first = drawBeads(realDrawer, [beads[0]!]);
    const firstPolys = first.commands.filter((c) => c.kind === 'polygon') as readonly PolygonCommand[];
    for (const p of firstPolys) {
      const v = Array.from(polygonVertices(first.model, p));
      sheared.polygon3(v[0]!, v[1]!, v[2]!, v[3]!, v[4]!, v[5]!, { fill: p.fill });
    }
    const shearedModel = sheared.end();
    const shearedPolys = shearedModel.commands.filter((c) => c.kind === 'polygon') as readonly PolygonCommand[];
    expect(() =>
      assertNoShearedBeads(shearedModel, [...polys.slice(0, 4), ...shearedPolys], beads.slice(0, 2)),
    ).toThrow(/串形/);
    // ⛔ 禁单枚均值替代（形心 ≠ 格心 是本判据的判别力来源，此处正面自证）。
    const single = polygonVertices(model, polys[1]!); // 左面：两角同在左缘 ⇒ 形心偏左
    const singleCx = (single[0]! + single[2]! + single[4]!) / 3;
    expect(Math.abs(singleCx - beads[0]!.cx)).toBeGreaterThan(1);
  });
});

/* ────────────────────────── 附：本文件用到的最小夹具出口 ────────────────────────── */

function emitCommands(draw: (builder: RenderModelBuilder) => void): readonly DrawCommand[] {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  draw(builder);
  return builder.end().commands;
}

/** 十层臂的命令流（行 8 的 5 条 line 对照）。 */
function legacyLayersCommands(): readonly DrawCommand[] {
  return emitCommands((b) => drawLegacyTenBead(b, 100, 200, 1, { size: SIZE, targetColorIdx: 2, inks: DEMO_BEAD_INKS }));
}

/**
 * 十层臂的**层集等价物**（行 11 用：把命令流映射回 role 语义）。
 * ⚠ 十层不经 `BeadStyle` 契约（含 line/stroke/双孔，契约表达不了，见 `legacy-ten.ts` 头注）
 *   ⇒ 这里只做"孔族"的粗归类：两枚 circle = 孔底 + 内壁自阴影。
 */
function legacyLayerSet(): Array<{ kind: string; alpha?: number; role: string }> {
  return legacyLayersCommands()
    .filter((c) => c.kind === 'circle')
    .map((c) => ({ kind: c.kind, alpha: c.alpha, role: 'hole' }));
}
