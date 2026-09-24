/**
 * Bead parameter card — the six layers of `assets-spec.md` §1.1, plus the two
 * non-`filled` state variants of §1.2.
 *
 * One bead = L0a 接触阴影 → L0b 投影 → L1 主体 → L2 暗倒角 → L3 亮倒角 → L3b rim 光
 * → L4a/b/c 软高光（三层递减 α），drawn in that order.
 * ⚠ 原第十层「**L5 符号**」已随 `bead-visual-style-spec` **v1.5-r8（2026-09-23）整层删除**
 *   （WXG-T-203 `c8d2fe8`）⇒ 本卡现为九层；本行旧文残留于 WXG-T-207-A 注释核销批清除
 *   （**层数与渲染基尺无关**，故 §11.2 图元基线不因 v1.57 复算）。
 * Everything here is a **pure function of its arguments**: it reads
 * no game state and returns nothing (control-manifest §8) — which is what makes
 * the card testable by command inspection alone (`tests/bead-render.test.ts`).
 *
 * Geometry is expressed as **ratios of the bead edge**, derived from the 64px
 * reference frame §1.1 works in (r = `BEAD_CARD.radius`×BEAD, shadow dy = 3/64×BEAD, …). That
 * keeps one card implementation correct at every size the game uses:
 * `BEAD_CELL = PITCH − GAP = 30` on the board, `TRAY_BEAD_SIZE = TRAY_SLOT − 4 = 44` in the tray.
 * ⚠ **v1.57（WXG-T-207-A）渲染基尺 50/52 → 30/32**：比率制量（radius / 五档线宽 / 孔比 /
 *   接触阴影…）**一个都不用改**，绝对像素量只有 `BEAD_DRAW_INSET`（6→4）与 `minStroke`（不缩）。
 * ⚠ 但「比率制 ⇒ 观感等比」是**推论不是实测**：`minStroke = 2` 这条绝对地板会吃掉小珠子上的
 *   比率差（30px 珠上 `bevelWidthLight 4/64 = 1.875`、`rimWidth 3/64 = 1.406` 均被钳成 2
 *   ⇒ 三档倒角同宽）⇒ 已登记 `[待林绘澄/真机]`，`assets-spec §1.10.3`。
 */

import type { RenderModelBuilder } from '@wxgame/framework';
import { BEAD_CELL, BEAD_DRAW_INSET, BEAD_PITCH, SELECT_LIFT_PX, SOCKET_CARD, TRAY_BEAD_SIZE } from '../config/tuning.js';
import {
  FILL_POP_CONTACT_A_PEAK,
  FILL_POP_CONTACT_W_PEAK,
  FILL_POP_MS,
  FILL_POP_PRESS_MS,
  FILL_POP_SCALE_START,
  FILL_POP_SCALE_TROUGH,
  FILL_POP_SHADOW_A_TROUGH,
  FILL_POP_SHADOW_DY_MIN,
} from '../config/tuning.js';
import {
  BEAD_BEVEL_DARK_MIX,
  BEAD_BEVEL_LIGHT_MIX,
  BEAD_CONTACT_SHADOW_ALPHA,
  BEAD_HIGHLIGHT_HEX,
  DEBUG_OUTLINE_SOCKET_HEX,
  DEBUG_OUTLINE_TILE_HEX,
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
} from './palette.js';

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
  /**
   * L3b rim 光（v1.3 新增）：上内缘单线，内缩 1/64。线宽 **2/64 → 3/64**（「06 珐琅·金属
   * 包边」加粗上缘高光边）。
   *
   * ⚠️ **旧括注的加粗理由是「错基注释」，WXG-T-207-A 核销（正本判定 = `assets-spec §1.10 ②`，
   * 林绘澄）**：原文写「2/64 在 50px 珠上被 `minStroke=2` 钳住 ⇒ 无变化，3/64 才真变粗」。
   * 该算式把分母当成 `BEAD_CELL`，**而实装分母是绘制边长** `(outer − 2×inset)`（见本卡
   * `:410` `size` 与 `:428` `stroke()`）⇒ 旧 50 基盘面上 `size = 50 − 2×6 = 38`，
   * `38×2/64 = 1.19` 与 `38×3/64 = 1.78` **双双钳到 2.00** —— 那次加粗在盘面对照上
   * **从来就是 no-op**（不是「换尺后才失效」）。唯一名义越线处是托盘珠（`size = 44`、
   * `inset = 0`）：`44×3/64 = 2.0625`，超地板 0.0625 设计 px ≈ 0.03 CSS px ⇒ 不可辨。
   * ⇒ 本句**不得再作为「比例线宽有效」的先例引用**（K-035 族「假绿登记」）。
   *
   * v1.57 换 30 基后现状（同一算式）：盘面 `size = 30 − 2×4 = 22` ⇒ `22×{5,4,3}/64 =
   * {1.72,1.38,1.03}` 全部 < 2 ⇒ **三档倒角 + rim 一起钳平为 2**（层集只剩方向/墨差/同心
   * 内缩序在承载，`assets-spec §1.10.3` 因此裁「比例不动、地板不动」）。**不在本单解**：
   * 分母 64→32 翻倍、或 `minStroke`→1 弃地板，两条出路均 `[待林绘澄/真机]`。
   */
  rimInset: 1 / 64,
  rimWidth: 3 / 64,
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
   * 之前完全没做。
   *
   * **0.36 → 0.44（v1.57 / WXG-T-207-A；art 起始值正本 = `assets-spec §1.10.4`）**：
   * 0.44 是 Midi 实物真比（孔 ⌀2.2 / 豆 ⌀5），旧值 0.36 是「小屏怕吃掉色面」的**保守一档**；
   * 在 30px 珠上按实物真比反推，孔**半径** = `(30−2×4)×0.44/2 = 4.84` 设计px（旧尺
   * `(50−12)×0.36/2 = 6.84`）⇒ 绝对孔径仍缩 29%。**⚠ `[待真机]`**：真机 scale≈0.5 下直径
   * ≈4.8 CSS px，与当初判 `inset=2`「看不见」只差一档 ⇒ 禁止以「比例没变」判绿（K-035/K-040）。
   * ⚠️ **硬约束②（`assets-spec §1.10.9`）：本值与 `BEAD_DRAW_INSET` 互为对冲，必须同提交**
   * （削 inset ⇒ 珠面变大 ⇒ 孔绝对值变大）；分开改会留下混合口径、真机无法归因
   * ⇒ 由 `tests/bead-render.test.ts` 的同批性断言钉住。
   */
  holeRatio: 0.44,
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
  /**
   * **§5 抬起三通道（`bead-visual-style-spec` v1.5-r9）** —— 以 `liftRef` 为“一次完整抬起”
   * 归一化，使高度语言随离开底面的距离连续变化（旧模型只平移，不透明物体凭空挪几 px
   * 就是“突兀”的来源）。
   *
   * ⚠ `liftRef` = **`tuning.SELECT_LIFT_PX`（单一真源）**，与 view-model 给 `draft.lift` 的值同源；
   *   波浪的 `WAVE_LIFT_PX = 3` ⇒ liftT = 0.5（半高 ⇒ 半量的阴影响应）。
   *   抬起量改动时三通道响应强度自动跟着改，不会漂耦。
   */
  liftRef: SELECT_LIFT_PX,
  /** 抬到 `liftRef` 时珠体额外放大 4%（与 G1 落座包络的 scale 相乘，峰值合计仍 < 1.12 ≪ 格宽）。 */
  liftScaleGain: 0.04,
  /** 投影偏移放大倍数（150%）与 α 衰减（40%）：离得越远，影子越大越淡。 */
  liftShadowDyGain: 1.5,
  liftShadowFade: 0.4,
  /** 接触阴影收窄（35%）：离地后接触面应变小而不是留着黑块。
   * ⚠ **不衰减它的 α** —— §1.2 已把 L0a 定调为「固定 α 不受 lift 影响」（本批上一版
   *   试图连 α 一起淡掉，被 `§1.2 lift and shadow α` 判据拦下）。只改宽度，不改颜色语义。 */
  liftContactShrink: 0.35,
  /** 侧壁在满抬起时多长出 90%（与上面四通道共用 `liftT` ⇒ 方向一致）。 */
  wallLiftGain: 0.9,
  /** §1.1 最小特征约束: no stroke below 2 design px. */
  minStroke: 2,
} as const;

/**
 * Tray bead edge — §3.4 `TRAY_SLOT − 4`。
 *
 * ⚠️ **v1.57（WXG-T-207-A）真源上移 `config/tuning.ts`**（K-012 补漏：本值一直被
 * `view-model.ts` 与 `tests/bead-render.test.ts` 消费，却住在 view 层、不在 §3 冻结表内）。
 * 本行降为**再导出**（保留旧 import 路径，不拆消费者），不得在此重算公式。
 * ⚠ 其中「4」= 槽内单边内缩 2px，是**未标定的绝对值**，本单零改动 ⇒ `[待林绘澄]`。
 */
export { TRAY_BEAD_SIZE };

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
   * 传入即降层 —— 砍 L0a / L3b / L4a / L4b，保 L0b + L1 + L2 + L3 + L4c
   * （旧文此处还列了 **L5 符号**，该层已随 v1.5-r8 整层删除 ⇒ WXG-T-207-A 注释核销；
   *   保留集是否因此重数为 6 归 art/QA **另案**，本单不动 `WAVE_LOD_LAYERS` 的值）。
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
 * 方角 + 边长 = **格距** 是为了相邻无缝：圆心相距恰为一个格距 ⇒ 两砖边缘正好相接。
 *
 * **边长是入参、不是常量**（`ADR-0020` 附录 A **甲案**，WXG-T-206，用户 2026-09-24 批准「现在就修」）：
 * 旧写法硬编码绝对 `BEAD_PITCH = 52`，而它必须服务的格心来自相机缩放后的 `BEAD_PITCH·z`
 *（`gridLayoutFor`）⇒ `z < 1` 时砖比格距宽、相邻砖互相重叠，珠体（缩放 `gridCell`）也随之
 * 看着不居中、底色透不出来 = 用户报告三症状的**共同根因**。现由调用点 `drawGrid` 传
 * `snap.gridPitch`，tile 与 `drawFilledBead` / `drawEmptySocket` 所用的缩放 `gridCell` 同尺
 * ⇒ 相邻恰好相接、零重叠。
 * **默认值仍取 `BEAD_PITCH`** ⇒ 不传尺寸即 `z = 1` 恒等档**逐位不变**（旧快照与既有断言零漂移；
 * 「1 点击 = 1 珠逐分复现」类判据的前提）。恒等档不变式由 `tests/view-model.test.ts` 守。
 *
 * ⛔ 不参与 `lift`、不参与 `scale`（§1.6.1 层序死结论；旧 bug = 抬珠把底一起抬走）。
 * 零新 hex（复用端点表 `edge`，与空坑暗缘同源）；零图元增量（仍是一枚 rect）。
 */
export function drawTargetTile(
  builder: RenderModelBuilder,
  cx: number,
  cy: number,
  colorIdx: number,
  inks: BeadInks = DEMO_BEAD_INKS,
  size: number = BEAD_PITCH,
): void {
  builder.rect(cx - size / 2, cy - size / 2, size, size, {
    fill: endpointOf(inks, colorIdx).edge,
    radius: 0,
  });
}

// DEBUG 轮廓墨色真源在 `view/palette.ts`（arch §3：色值只进 palette）：DEBUG_OUTLINE_*_HEX。

/**
 * DEBUG ONLY（`BeadsGame.setDebugOutlines(true)`）：虚线描出**格底图 tile** 与
 * **珠/槽轮廓** 两层，供肉眼判断缩放后 tile 与格距错位导致的相邻重叠 / 珠体不居中。
 * 纯读参数、不持状态（合 L5）；正常玩法 `snap.debugOutlines === false` ⇒ 从不调用。
 *
 * ⚠ tile 轮廓**仍按固定 `BEAD_PITCH` 画**（品红），是刻意与 `drawEmptySocket` / `drawFilledBead`
 * 所用的缩放 `cellSize`（即 `gridCell`，青）对照。**甲案（WXG-T-206）后**真实底图 `drawTargetTile`
 * 已改吃相机缩放（`size = snap.gridPitch`），故**品红框不再是底图当前实画尺寸**，而是「若 tile
 * 仍不缩放会怎样」的**诊断参照**——它与青色缩放轮廓的宽度差，即低倍率下底图曾致相邻重叠/不居中的可视化。
 */
export function drawDebugCellOutline(
  builder: RenderModelBuilder,
  cx: number,
  cy: number,
  cellSize: number,
): void {
  dashedRect(builder, cx, cy, BEAD_PITCH, DEBUG_OUTLINE_TILE_HEX);
  dashedRect(builder, cx, cy, cellSize, DEBUG_OUTLINE_SOCKET_HEX);
}

function dashedRect(
  builder: RenderModelBuilder,
  cx: number,
  cy: number,
  size: number,
  color: string,
): void {
  const half = size / 2;
  const x0 = cx - half;
  const y0 = cy - half;
  const x1 = cx + half;
  const y1 = cy + half;
  dashEdge(builder, x0, y0, x1, y0, color);
  dashEdge(builder, x1, y0, x1, y1, color);
  dashEdge(builder, x1, y1, x0, y1, color);
  dashEdge(builder, x0, y1, x0, y0, color);
}

/** 沿一条边按「画一段 / 空一段」逐段发 `line`（无 setLineDash 通道，只能手拼）。 */
function dashEdge(
  builder: RenderModelBuilder,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len <= 0) return;
  const ux = dx / len;
  const uy = dy / len;
  const dash = Math.max(3, len / 8);
  const period = dash * 2;
  for (let t = 0; t < len; t += period) {
    const seg = Math.min(dash, len - t);
    builder.line(x0 + ux * t, y0 + uy * t, x0 + ux * (t + seg), y0 + uy * (t + seg), color, 1.5);
  }
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
  const lift = options.lift ?? 0;
  const y = cy + lift;
  /**
   * §5 抬起三通道的高度参量：`lift` 归一化到“一次完整抬起”。
   * 负 `lift` 不视为“陷下去”⇒ 钳到 0（当前无调用方传负值，防误用）。
   * D1（`reduceMotion`）**不需在此特批**：本批只建“通道↔高度”的静态映射，
   * 没有任何自发动画与 α 往复（D2 风险）；抬起本身变缓需要 `lift` 自带斜坡，见 §5 注记。
   */
  const liftT = Math.max(0, lift) / BEAD_CARD.liftRef;

  // ⚠ **v1.5-r8（`bead-visual-style-spec` B0）**：旧的“珠下先画一块垫”已**上提为 B0 底图**
  //   （`drawTargetTile`，由 view-model 对每个可填格调，与有无豆无关）⇒ 本函数不再画垫。
  //   保留的理由：垫锁格心、不吃 lift/scale（§1.6.1 P0 陷阱 #2）—— 同样适用于 B0。
  // 珠体四边内缩，露出四周的 B0 底图（= 该格目标色）；无目标色（托盘珠）保持满幅。
  // G1：`scale` **只作用珠体**（见上方禁令）。
  const inset = options.targetColorIdx !== undefined ? BEAD_DRAW_INSET : 0;
  const size = (outer - inset * 2) * (options.scale ?? 1) * (1 + BEAD_CARD.liftScaleGain * liftT);
  const left = cx - size / 2;
  const bottom = y - size / 2;
  // §5：四个阴影/接触通道随高度连续变化。
  // ⚠ **显式覆写优先于 lift 调制**：G1 落座包络（`fillPopEnvelope`）与 `selected` 的
  //   `SELECTED_SHADOW_ALPHA` 都是 art 侧已经定过的语义（「抬起 + 阴影更深 = 重量/强调」），
  //   而 lift 的物理结论是“抬高 ⇒ 影子变淡”⇒ 两者同现时必须让**覆写赢**，
  //   否则本批会静默推翻 §1.2 的选中语义（上一版实现就踩了这个坑，由判据拦下）。
  //   未覆写的通道（如 G4 波浪期）才吃 lift 衰减。
  const contactAlpha = options.contactAlpha ?? BEAD_CONTACT_SHADOW_ALPHA;
  const contactWidth = options.contactWidth ?? BEAD_CARD.contactW * (1 - BEAD_CARD.liftContactShrink * liftT);
  const shadowDy = options.shadowDy ?? BEAD_CARD.shadowDy * (1 + BEAD_CARD.liftShadowDyGain * liftT);
  const shadowAlpha = options.shadowAlpha !== undefined
    ? options.shadowAlpha
    : BEAD_SHADOW_ALPHA * (1 - BEAD_CARD.liftShadowFade * liftT);
  // 圆角统一按**绘出边长**派生（K1）：旧网格珠走「垫圆角 − inset」得到 5 ⇒ 近乎方角；
  // 底图已是方角连续一张，同心约束无对象 ⇒ 网格珠与托盘珠同公式，不再区分。
  const radius = Math.round(size * BEAD_CARD.radius);
  const stroke = (ratio: number) => Math.max(BEAD_CARD.minStroke, size * ratio);
  // G4 LOD：`lodLayers` 传入即走降档集（值本身在本轮只有一个档位 ⇒ 不作分支表）。
  const lod = options.lodLayers !== undefined;

  // L0a 接触阴影 — 贴底窄条，让珠"坐"在面上（v1.3 · F4）；α / 宽比可由 G1 包络覆写，
  // 未覆写时宽度再受 §5 抬起收窄（α 按 §1.2 固定，不受 lift 影响）。
  // G4 LOD：本层属可砍集（α 最小的软阴影，集体波浪期看不出差）。G1 不动此层归属。
  if (!lod) {
    builder.rect(
      left + size * BEAD_CARD.contactX,
      bottom + size * BEAD_CARD.contactY,
      size * contactWidth,
      size * BEAD_CARD.contactH,
      {
        fill: withAlpha(BEAD_SHADOW_HEX, contactAlpha),
        radius: Math.round(radius * BEAD_CARD.contactRadiusScale),
      },
    );
  }

  // L0b 投影 — offset down by 3/64 of the edge, no stroke（G1：偏移与 α 同步联动；
  // §5：抬起越高 ⇒ 影子推得越远、同时变淡）。
  builder.rect(left, bottom - size * shadowDy, size, size, {
    fill: withAlpha(BEAD_SHADOW_HEX, shadowAlpha),
    radius,
  });

  // L1 主体.
  builder.rect(left, bottom, size, size, { fill: base, radius });

  // L2′ 侧壁（K5）——珠体下缘一条比 L2 暗倒角更深的带，把“圆角方块”读成“有高度的体”。
  // §5：静息高 `size × wallRatio`；抬起时接近线性长到 ×1.9（升得越高越看得到侧面），
  // 与投影/接触阴影同一 `liftT` ⇒ 三个通道同向，不会“平移但侧面不变”那种断裂感。
  // ⚠ 不额外吃 `scale`（已在 `size` 内）；无自发动画 ⇒ 不受 D1 口径约束。
  const wallH = size * BEAD_CARD.wallRatio * (1 + BEAD_CARD.wallLiftGain * liftT);
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
