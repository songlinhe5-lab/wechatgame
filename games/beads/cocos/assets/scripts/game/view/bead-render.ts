/**
 * Bead parameter card — the six layers of `assets-spec.md` §1.1, plus the two
 * non-`filled` state variants of §1.2.
 *
 * One bead = L0a 接触阴影 → L0b 投影 → L1 主体 → L2 暗倒角 → L3 亮倒角 → L3b rim 光
 * → L4a/b/c 软高光（三层递减 α）→ L5 符号, drawn in that order (v1.3 十层卡 · F4 质感升级).
 * Everything here is a **pure function of its arguments**: it reads
 * no game state and returns nothing (control-manifest §8) — which is what makes
 * the card testable by command inspection alone (`tests/bead-render.test.ts`).
 *
 * Geometry is expressed as **ratios of the bead edge**, derived from the 64px
 * reference frame §1.1 works in (r = 0.22×BEAD, shadow dy = 3/64×BEAD, …). That
 * keeps one card implementation correct at every size the game uses:
 * `BEAD_CELL = 50` on the board, `TRAY_SLOT − 4 = 44` in the tray.
 */

import type { RenderModelBuilder } from '../../framework/index';
import { BEAD_CELL, BEAD_DRAW_INSET, BEAD_PITCH, SOCKET_CARD, TRAY_SLOT } from '../config/tuning';
import {
  FILL_POP_CONTACT_A_PEAK,
  FILL_POP_CONTACT_W_PEAK,
  FILL_POP_MS,
  FILL_POP_PRESS_MS,
  FILL_POP_SCALE_START,
  FILL_POP_SCALE_TROUGH,
  FILL_POP_SHADOW_A_TROUGH,
  FILL_POP_SHADOW_DY_MIN,
} from '../config/tuning';
import {
  BEAD_BEVEL_DARK_MIX,
  BEAD_BEVEL_LIGHT_MIX,
  BEAD_CONTACT_SHADOW_ALPHA,
  BEAD_HIGHLIGHT_HEX,
  BEAD_RIM_MIX,
  BEAD_SHADOW_ALPHA,
  BEAD_SHADOW_ALPHA_SELECTED,
  BEAD_SHADOW_HEX,
  BEAD_SOFT_HIGHLIGHT_ALPHAS,
  beadColorOf,
  DEMO_BEAD_INKS,
  endpointOf,
  mix,
  SOCKET_EDGE_DARK_MIX,
  SOCKET_LIT_MIX,
  SOCKET_PIT_DARKEN,
  withAlpha,
  type BeadInks,
  type BeadsPalette,
} from './palette';

/**
 * §1.1 layer geometry, as fractions of the bead edge. Source values are the
 * spec's 64px example (`r = round(BEAD × 0.22)`, insets 1.5 / 1, widths 3 / 2,
 * highlight at 0.10 / 0.62 with size 0.80 × 0.26 and radius 0.13).
 */
export const BEAD_CARD = {
  /**
   * Corner radius as a fraction of the **drawn** bead edge.
   *
   * **0.22 → 0.30（`bead-visual-style-spec` K1，用户 2026-09-23 拍板）**。旧值在网格
   * 珠上还叠加了「同心倒推」（珠圆角 = 垫圆角 − inset），实际得到 `50×0.22−6 = 5`，
   * 在 38px 珠上近乎方角 ⇒ 用户直接判为“变成正方形”。新模型里底图是方角连续一张，
   * 同心约束已无对象 ⇒ 网格珠与托盘珠共用同一公式 `round(size × radius)`。
   * 实物熔合后是**圆角方**，不是正圆（参考图仍偏圆，以本值与真机为准）。
   */
  radius: 0.30,
  /** L0a 接触阴影（v1.3 · F4）：贴底窄条，x/y/w/h 为边长比例，radius = 主圆角 × 0.5。 */
  contactX: 0.06,
  contactY: -0.02,
  contactW: 0.88,
  contactH: 0.1,
  contactRadiusScale: 0.5,
  /** L0b shadow vertical offset (spec: `y − 3` in the 64 frame). */
  shadowDy: 3 / 64,
  /** L2 inset from the bottom/right inner edge (v1.3: 2/64, was 1.5). */
  bevelInsetDark: 2 / 64,
  /** L3 inset from the top/left inner edge (v1.3: 1.5/64, was 1). */
  bevelInsetLight: 1.5 / 64,
  /** L2 stroke width (v1.3: 5/64, was 3). */
  bevelWidthDark: 5 / 64,
  /** L3 stroke width (v1.3: 4/64, was 2). */
  bevelWidthLight: 4 / 64,
  /** L3b rim 光（v1.3 新增）：上内缘单线，内缩 1/64、线宽 2/64。 */
  rimInset: 1 / 64,
  rimWidth: 2 / 64,
  /**
   * L4a/b/c 软高光三层（v1.3 · F4，取代硬边单高光条）：外扩递减、中心递增叠层模拟柔光。
   * x/y/w/h/radius 均为边长比例，α 见 {@link BEAD_SOFT_HIGHLIGHT_ALPHAS}。
   */
  softHighlight: Object.freeze([
    { x: 0.06, y: 0.52, w: 0.82, h: 0.38, radius: 0.19 },
    { x: 0.1, y: 0.6, w: 0.72, h: 0.26, radius: 0.13 },
    { x: 0.16, y: 0.68, w: 0.56, h: 0.14, radius: 0.07 },
  ] as const),
  /**
   * **L1c 中心孔（`bead-visual-style-spec` K2–K4）** —— 实物拼豆最强的识别特征，
   * 之前完全没做。孔径比例 0.36 从 Midi 实物（⌀5 / 孔 ⌀2.2 = 0.44）收一档，
   * 避免小屏上吃掉色面；真机嫌小再评估升到 0.44。`[待真机]`
   */
  holeRatio: 0.36,
  /** 孔内壁自阴影的偏移量（半径比例）与 α；光从左上 ⇒ 阴影偏左上，留出右下亮弧。 */
  holeShadeOffset: 0.22,
  holeShadeAlpha: 0.3,
  /**
   * **L2′ 侧壁高度**（K5）——实物是硬币状，有一条竖向侧壁；旧模型只靠同色压暗倒角，
   * 读作“斜切边”不读作“厚度”。`lift` 时按 `1 + lift/size` 拉长（§5 空间语言）。
   */
  wallRatio: 0.1,
  /** 侧壁与托盘珠孔底的下暗量（复用既有 mix 族，**零新 hex**）。 */
  wallDarkMix: -0.42,
  holeDarkMix: -0.5,
  /** §1.1 最小特征约束: no stroke below 2 design px. */
  minStroke: 2,
} as const;

/** Tray bead edge — §1.3 `tray_slot` 同 BEAD（内缩 4）. */
export const TRAY_BEAD_SIZE = TRAY_SLOT - 4;

export interface FilledBeadOptions {
  /** Bead edge length; defaults to `BEAD_CELL` (board size). */
  readonly size?: number;
  /** Extra upward offset in design units (tray `selected` lift, §1.2: 4px). */
  readonly lift?: number;
  /** L0 shadow opacity override; `selected` passes the darker α (§1.2). */
  readonly shadowAlpha?: number;
  /**
   * **L1c 孔底透出的目标色**（`bead-visual-style-spec` K3，用户 2026-09-23 拍板）。
   * 旧名 `padColorIdx`（L11 垫）；垫已升为 B0 底图（`drawTargetTile`），本参现在的唯一职责
   * = 通孔物理上透下去、看见该格目标色 ⇒ 珠子自带“我该变成什么色”的对照物。
   * 不传（托盘珠）⇒ 孔底走自身下暗档，不透色。
   */
  readonly targetColorIdx?: number;
  /**
   * 珠色墨水组（v1.40 关卡色板）：hex 表 + 预烘焙端点。缺省 ⇒ demo 默认色板
   * （`LEVELS_DATA.palette`）。调用方（view-model）每帧复用同一引用 ⇒ 零分配。
   */
  readonly inks?: BeadInks;
  /**
   * G1 落座回弹的**珠体**缩放（`assets-spec §1.6.1`，默认 1）。⛔ **严禁改乘 `outer`**：
   * `outer` 同时驱动 **L11 垫**，垫若随珠同缩 ⇒ 「垫缝」读数与珠体同步 ⇒ 目标色
   * 谜面在 120ms 内被自己抹除，且同格目标色浓度周期性呼吸（违 `accessibility` A1）
   * ⇒ 层序死结论：**垫不参与 scale / 不参与 lift / 恒锁格缘 / 恒画**。
   */
  readonly scale?: number;
  /** G1：L0a 接触阴影 α 覆写（静息 = `BEAD_CONTACT_SHADOW_ALPHA`）。 */
  readonly contactAlpha?: number;
  /** G1：L0a 接触阴影**宽比**覆写（静息 = `BEAD_CARD.contactW` = 0.88）。 */
  readonly contactWidth?: number;
  /** G1：L0b 投影纵向偏移覆写（`/64` 归一比例，静息 = `BEAD_CARD.shadowDy` = 3/64）。 */
  readonly shadowDy?: number;
  /**
   * G4 波浪期的 **LOD 降档**（`assets-spec §1.6.4` / `WAVE_LOD_LAYERS = 7`，WXG-T-146）：
   * 传入即降层 —— 砍 L0a / L3b / L4a / L4b，保 L0b + L1 + L2 + L3 + L4c + L5。
   * ⛔ **L11 垫绝不进可砍集**（静态谜面载体 ⇒ 本标志**不影响**上方垫的绘制）。
   * 本轮只预埋 G4 这一档（裁定 5）；G2 的 α 阈值 4 层档 = 规格保留、不实现。
   */
  readonly lodLayers?: number;
}

/** 段内插值。**模块级函数而非局部闭包** = 逐帧调用零分配（热路径铁律）。 */
function lerpMix(a: number, b: number, e: number): number {
  return a + (b - a) * e;
}

/**
 * G1 `vfx_fill_pop` 的逐帧包络（`assets-spec §1.6.1`，WXG-T-128）。
 *
 * 两段、全程**单调、不二次过冲**（裁定 7：`1.06` = 规格起点值、非过冲量）：
 *   · 压下 `0 → 40ms`：scale `1.06 → 0.96`、L0a α `0.12 → 0.18`、宽比 `0.88 → 0.92`、
 *     L0b α `0.15 → 0.12`、偏移 `3/64 → 2/64`；
 *   · 回弹 `40 → 120ms`：上述各项**反向回静息**（scale `0.96 → 1.00`）。
 * 缓动 = ease-out（`t·(2−t)`，与 `view-model.wrongFlashAlpha` 同族写法）。
 *
 * **D1（`reduceMotion`）**：关 scale 与 L0b 联动（形变 / 位移 = 运动通道），**仅保留**
 * L0a 的 α 单峰（振幅 ≤0.06，属 α 通道、0 往复 ⇒ 不触 D2）。
 *
 * 结果写入调用方持有的 `out` 槽 ⇒ `buildRenderModel` 热路径**零分配**。
 * 末尾三道**硬钳**防浮点漂移越界（§1.6.1 clamp 行：重叠与 α 越界）。
 */
export interface FillPopEnvelope {
  scale: number;
  contactAlpha: number;
  contactWidth: number;
  shadowAlpha: number;
  shadowDy: number;
}

export function fillPopEnvelope(
  p: number,
  reduceMotion: boolean,
  out: FillPopEnvelope,
): FillPopEnvelope {
  const ms = Math.min(1, Math.max(0, p)) * FILL_POP_MS;
  const press = ms <= FILL_POP_PRESS_MS;
  const raw = press
    ? ms / FILL_POP_PRESS_MS
    : (ms - FILL_POP_PRESS_MS) / (FILL_POP_MS - FILL_POP_PRESS_MS);
  const u = Math.min(1, Math.max(0, raw));
  const e = u * (2 - u); // ease-out

  // 静息值先入槽：D1 分支只需不覆写运动通道，无需逐字段判断。
  out.scale = 1;
  out.contactWidth = BEAD_CARD.contactW;
  out.shadowAlpha = BEAD_SHADOW_ALPHA;
  out.shadowDy = BEAD_CARD.shadowDy;

  // L0a α：两模式都走单峰（0.12 → 0.18 → 0.12）。
  out.contactAlpha = lerpMix(
    press ? BEAD_CONTACT_SHADOW_ALPHA : FILL_POP_CONTACT_A_PEAK,
    press ? FILL_POP_CONTACT_A_PEAK : BEAD_CONTACT_SHADOW_ALPHA,
    e,
  );

  if (!reduceMotion) {
    out.scale = lerpMix(
      press ? FILL_POP_SCALE_START : FILL_POP_SCALE_TROUGH,
      press ? FILL_POP_SCALE_TROUGH : 1,
      e,
    );
    out.contactWidth = lerpMix(
      press ? BEAD_CARD.contactW : FILL_POP_CONTACT_W_PEAK,
      press ? FILL_POP_CONTACT_W_PEAK : BEAD_CARD.contactW,
      e,
    );
    out.shadowAlpha = lerpMix(
      press ? BEAD_SHADOW_ALPHA : FILL_POP_SHADOW_A_TROUGH,
      press ? FILL_POP_SHADOW_A_TROUGH : BEAD_SHADOW_ALPHA,
      e,
    );
    out.shadowDy = lerpMix(
      press ? BEAD_CARD.shadowDy : FILL_POP_SHADOW_DY_MIN / 64,
      press ? FILL_POP_SHADOW_DY_MIN / 64 : BEAD_CARD.shadowDy,
      e,
    );
  }

  // 硬钳（§1.6.1：scale ∈ [0.96,1.06]、contactA ∈ [0.12,0.18]、shadowA ∈ [0.12,0.15]）。
  out.scale = Math.min(FILL_POP_SCALE_START, Math.max(FILL_POP_SCALE_TROUGH, out.scale));
  out.contactAlpha = Math.min(
    FILL_POP_CONTACT_A_PEAK,
    Math.max(BEAD_CONTACT_SHADOW_ALPHA, out.contactAlpha),
  );
  out.shadowAlpha = Math.min(
    BEAD_SHADOW_ALPHA,
    Math.max(FILL_POP_SHADOW_A_TROUGH, out.shadowAlpha),
  );
  return out;
}

/**
 * **B0 连续目标色底图**（`bead-visual-style-spec` §1 / K8，用户 2026-09-23 拍板）。
 *
 * 旧模型下“这一格要什么色”只有两个不一致的载体：`filled` 靠珠周 6px 缝（每格一个圆角块，
 * 格与格之间还有 `BEAD_GAP=2` 的缝）⇒ 底色被切碎；`empty` 靠亮 `base` 凹坑。
 * 两边**色档与几何都不一致** ⇒ 有豆/无豆看着是两张图。
 *
 * 本函数对**每个可填格**画一块 pitch 满铺、方角、恒为 `edge = mix(base, −0.30)` 的图元，
 * **与格内有无豆无关** ⇒ 整片谜面连成一张目标色马赛克（实物拼豆图纸的读法）。
 * 方角 + 边长 = `BEAD_PITCH` 是为了相邻无缝：圆心相距恰为 pitch ⇒ 两垫边缘重合。
 *
 * ⛔ 不参与 `lift`、不参与 `scale`（§1.6.1 层序死结论；旧 bug = 抬珠把底一起抬走）。
 * 零新 hex（复用端点表 `edge`，与空坑暗缘同源）。
 */
export function drawTargetTile(
  builder: RenderModelBuilder,
  cx: number,
  cy: number,
  colorIdx: number,
  inks: BeadInks = DEMO_BEAD_INKS,
): void {
  builder.rect(cx - BEAD_PITCH / 2, cy - BEAD_PITCH / 2, BEAD_PITCH, BEAD_PITCH, {
    fill: endpointOf(inks, colorIdx).edge,
    radius: 0,
  });
}

/**
 * Draw a complete `filled` bead (§1.1) centred on `(cx, cy)`.
 *
 * ⚠ **v1.5-r8（2026-09-23 用户拍板）：L5 符号层已整层删除**。此前非色相通道只长在珠上
 * （`emitSymbol` 全仓唯一调用点），而目标侧（L11 垫）只有颜色 ⇒ 玩家比对「这颗珠属于这格吗」
 * 时拿不到形状信号，三重编码实际只覆盖一半。本批改为**连续目标色底图**承担该职责，
 * 代价与色盲口径见 `art/accessibility.md` 末条修订。
 */
export function drawFilledBead(
  builder: RenderModelBuilder,
  cx: number,
  cy: number,
  colorIdx: number,
  options: FilledBeadOptions = {},
): void {
  const outer = options.size ?? BEAD_CELL;
  const inks = options.inks ?? DEMO_BEAD_INKS;
  const base = beadColorOf(inks, colorIdx);
  const y = cy + (options.lift ?? 0);

  // ⚠ **v1.5-r8（`bead-visual-style-spec` B0）**：旧的“珠下先画一块垫”已**上提为 B0 底图**
  //   （`drawTargetTile`，由 view-model 对每个可填格调，与有无豆无关）⇒ 本函数不再画垫。
  //   保留的理由：垫锁格心、不吃 lift/scale（§1.6.1 P0 陷阱 #2）—— 同样适用于 B0。
  // 珠体四边内缩，露出四周的 B0 底图（= 该格目标色）；无目标色（托盘珠）保持满幅。
  // G1：`scale` **只作用珠体**（见上方禁令）。
  const inset = options.targetColorIdx !== undefined ? BEAD_DRAW_INSET : 0;
  const size = (outer - inset * 2) * (options.scale ?? 1);
  const left = cx - size / 2;
  const bottom = y - size / 2;
  // 圆角统一按**绘出边长**派生（K1）：旧网格珠走「垫圆角 − inset」得到 5 ⇒ 近乎方角；
  // 底图已是方角连续一张，同心约束无对象 ⇒ 网格珠与托盘珠同公式，不再区分。
  const radius = Math.round(size * BEAD_CARD.radius);
  const stroke = (ratio: number) => Math.max(BEAD_CARD.minStroke, size * ratio);
  // G4 LOD：`lodLayers` 传入即走降档集（值本身在本轮只有一个档位 ⇒ 不作分支表）。
  const lod = options.lodLayers !== undefined;

  // L0a 接触阴影 — 贴底窄条，让珠"坐"在面上（v1.3 · F4）；α / 宽比可由 G1 包络覆写。
  // G4 LOD：本层属可砍集（α 最小的软阴影，集体波浪期看不出差）。G1 不动此层归属。
  if (!lod) {
    builder.rect(
      left + size * BEAD_CARD.contactX,
      bottom + size * BEAD_CARD.contactY,
      size * (options.contactWidth ?? BEAD_CARD.contactW),
      size * BEAD_CARD.contactH,
      {
        fill: withAlpha(BEAD_SHADOW_HEX, options.contactAlpha ?? BEAD_CONTACT_SHADOW_ALPHA),
        radius: Math.round(radius * BEAD_CARD.contactRadiusScale),
      },
    );
  }

  // L0b 投影 — offset down by 3/64 of the edge, no stroke（G1：偏移与 α 同步联动）。
  builder.rect(left, bottom - size * (options.shadowDy ?? BEAD_CARD.shadowDy), size, size, {
    fill: withAlpha(BEAD_SHADOW_HEX, options.shadowAlpha ?? BEAD_SHADOW_ALPHA),
    radius,
  });

  // L1 主体.
  builder.rect(left, bottom, size, size, { fill: base, radius });

  // L2′ 侧壁（K5）——珠体下缘一条比 L2 暗倒角更深的带，把“圆角方块”读成“有高度的体”。
  // `lift` 时按 `1 + lift/size` 拉长 ⇒ 抬起得越高、露出的侧壁越多（§5 空间语言）。
  // ⚠ 不随 `scale` 额外放大（已在 `size` 内），也不参与 D1 例外：它是静息形状的一部分。
  const wallH =
    size * BEAD_CARD.wallRatio * (1 + (options.lift ?? 0) / Math.max(1, outer));
  builder.rect(left, bottom, size, wallH, {
    fill: mix(base, BEAD_CARD.wallDarkMix),
    radius: Math.max(1, radius * 0.6),
  });

  // L2 暗倒角 — bottom + right inner edges, tinted toward black.
  const insetDark = size * BEAD_CARD.bevelInsetDark;
  const dark = mix(base, BEAD_BEVEL_DARK_MIX);
  const darkWidth = stroke(BEAD_CARD.bevelWidthDark);
  builder.line(left + insetDark, bottom + insetDark, left + size - insetDark, bottom + insetDark, dark, darkWidth);
  builder.line(
    left + size - insetDark,
    bottom + insetDark,
    left + size - insetDark,
    bottom + size - insetDark,
    dark,
    darkWidth,
  );

  // L3 亮倒角 — top + left inner edges, tinted toward white.
  const insetLight = size * BEAD_CARD.bevelInsetLight;
  const light = mix(base, BEAD_BEVEL_LIGHT_MIX);
  const lightWidth = stroke(BEAD_CARD.bevelWidthLight);
  builder.line(
    left + insetLight,
    bottom + size - insetLight,
    left + size - insetLight,
    bottom + size - insetLight,
    light,
    lightWidth,
  );
  builder.line(
    left + insetLight,
    bottom + insetLight,
    left + insetLight,
    bottom + size - insetLight,
    light,
    lightWidth,
  );

  // L3b rim 光 — top inner edge single line, brighter than L3 (v1.3 · F4)。G4 LOD：可砍集。
  if (!lod) {
    const insetRim = size * BEAD_CARD.rimInset;
    const rim = mix(base, BEAD_RIM_MIX);
    builder.line(
      left + insetRim,
      bottom + size - insetRim,
      left + size - insetRim,
      bottom + size - insetRim,
      rim,
      stroke(BEAD_CARD.rimWidth),
    );
  }

  // L1c 中心孔（K2–K4）——两枚 `circle` 叠出“孔 + 内壁自阴影”：
  //   ① 孔底 = 该格目标色的 pit 档（K3 “通孔物理上透下去”）；无目标色（托盘珠）→ 自身下暗档。
  //   ② 阴影圆偏左上（设计空间 y 向上）⇒ 留出**右下亮弧**，与“光从左上”一致。
  // ⛔ 本层是**识别红线**（ADR-0017 红线段）：LOD 降档也不砍。
  const holeR = (size * BEAD_CARD.holeRatio) / 2;
  const holeBottom =
    options.targetColorIdx !== undefined
      ? endpointOf(inks, options.targetColorIdx).pit
      : mix(base, BEAD_CARD.holeDarkMix);
  builder.circle(cx, y, holeR, { fill: holeBottom });
  builder.circle(
    cx - holeR * BEAD_CARD.holeShadeOffset,
    y + holeR * BEAD_CARD.holeShadeOffset,
    holeR * 0.86,
    { fill: BEAD_SHADOW_HEX, alpha: BEAD_CARD.holeShadeAlpha },
  );

  // L4′ 偏心椭圆高光（K6）——**三层亮条并成一枚**（净 −2 图元/珠）：左上单块拉长椭圆，
  // α 取原中档。旧 L4a–c 的几何仍留在 `BEAD_CARD.softHighlight` 供回退与历史比对。
  // G4 LOD：属质感层，降档可砍。
  if (!lod) {
    const g = BEAD_CARD.softHighlight[1]!;
    builder.rect(left + size * g.x, bottom + size * g.y, size * g.w, size * g.h, {
      fill: withAlpha(BEAD_HIGHLIGHT_HEX, BEAD_SOFT_HIGHLIGHT_ALPHAS[1]!),
      radius: size * g.radius,
    });
  }
}

export function drawEmptySocket(
  builder: RenderModelBuilder,
  cx: number,
  cy: number,
  palette: BeadsPalette,
  size: number = BEAD_CELL,
  colorIdx?: number,
  inks: BeadInks = DEMO_BEAD_INKS,
  /**
   * B0 底图已由 `drawTargetTile` 画过 ⇒ 跳过本函数自带的亮 `base` 外块（v1.5-r8）。
   * 网格空格传 true；托盘空槽（无 `colorIdx`）保持 false，自己带底。
   */
  tilePainted = false,
): void {
  const left = cx - size / 2;
  const bottom = cy - size / 2;
  const radius = Math.round(size * BEAD_CARD.radius);
  const base = colorIdx === undefined ? palette.slot : beadColorOf(inks, colorIdx);
  const endpoints = colorIdx === undefined ? neutralEndpoints(palette) : endpointOf(inks, colorIdx);

  // S2 坑底（先画大底，S1 框压在其上）：内缩 6% 的 `pit` 填充。
  const inset = size * SOCKET_CARD.pitInset;
  // B0 已铺 ⇒ 不再刷亮 `base`（否则“有豆/无豆”又是两张图）。零新 hex。
  if (!tilePainted) {
    builder.rect(left, bottom, size, size, { fill: base, radius });
  }
  builder.rect(left + inset, bottom + inset, size - inset * 2, size - inset * 2, {
    fill: endpoints.pit,
    radius: Math.max(2, Math.round((size - inset * 2) * BEAD_CARD.radius * 0.8)),
  });

  // S1 暗缘框（外框线，压住 S2 边界）。
  builder.rect(left, bottom, size, size, {
    stroke: endpoints.edge,
    lineWidth: Math.max(BEAD_CARD.minStroke, size * SOCKET_CARD.edgeWidth),
    radius,
  });

  // S3 上内缘内阴影线（暗，凹感上半）。
  const shadeWidth = Math.max(BEAD_CARD.minStroke, size * SOCKET_CARD.shadeWidth);
  builder.line(
    left + inset,
    bottom + inset,
    left + size - inset,
    bottom + inset,
    endpoints.edge,
    shadeWidth,
  );

  // S4 下内缘受光亮线（亮，凹感下半）。
  builder.line(
    left + inset,
    bottom + size - inset,
    left + size - inset,
    bottom + size - inset,
    endpoints.lit,
    Math.max(BEAD_CARD.minStroke, size * SOCKET_CARD.litWidth),
  );
}

/**
 * 托盘空槽（无目标色）的中性端点：由中性 `slot` 色推导（非珠色预烘焙表）。
 */
function neutralEndpoints(palette: BeadsPalette): { edge: string; pit: string; lit: string } {
  return {
    edge: mix(palette.slot, -SOCKET_EDGE_DARK_MIX),
    pit: mix(palette.slot, -(SOCKET_EDGE_DARK_MIX + SOCKET_PIT_DARKEN)),
    lit: mix(palette.slot, SOCKET_LIT_MIX),
  };
}

/**
 * Draw a `locked` bead (§1.2): flat locked fill + 45° hatch, **no highlight and no
 * symbol** — the pattern's decoration must not compete with real beads.
 *
 * Note: §1.2 specifies the body as `mix(base, 灰紫 B9B4CC, 0.60)`, but a locked cell
 * carries `colorIdx = 0` (`entities/grid.ts` — `x`/`.` have no colour), so no
 * `base` exists to mix. `palette.locked` is used instead; the mismatch is
 * registered in the ledger rather than papered over with an invented base colour.
 */
export function drawLockedBead(
  builder: RenderModelBuilder,
  cx: number,
  cy: number,
  palette: BeadsPalette,
  size: number = BEAD_CELL,
): void {
  const left = cx - size / 2;
  const bottom = cy - size / 2;
  const inset = size * 0.16;
  builder.rect(left, bottom, size, size, {
    fill: palette.locked,
    radius: Math.round(size * BEAD_CARD.radius),
  });
  const hatch = withAlpha(palette.background, 0.9);
  builder.line(left + inset, bottom + inset, left + size - inset, bottom + size - inset, hatch, 2);
  builder.line(left + size - inset, bottom + inset, left + inset, bottom + size - inset, hatch, 2);
}

/** L0 shadow opacity for a selected bead (§1.2 selected row). */
export const SELECTED_SHADOW_ALPHA = BEAD_SHADOW_ALPHA_SELECTED;

/**
 * §1.2 状态外描边环（`hint` 蓝 / `wrong` danger 复用）：圆角矩形、**只描边不填充**
 * → 中心透明，露出下层（目标色底 / 已填珠）。`alpha` 承载呼吸/闪灼相位。
 */
export function drawStateRing(
  builder: RenderModelBuilder,
  cx: number,
  cy: number,
  size: number,
  stroke: string,
  alpha = 1,
  lineWidth = 2,
): void {
  const radius = Math.round(size * BEAD_CARD.radius);
  builder.rect(cx - size / 2, cy - size / 2, size, size, {
    stroke,
    lineWidth,
    radius,
    alpha,
  });
}
