/**
 * 珠体与槽的**几何尺子** + **层集回放器**（`assets-spec.md §1.1/§1.2` ·
 * `bead-visual-style-spec §7.11.1` · EP11-S3 转正）
 * ─────────────────────────────────────────────────────────────────────────
 * **S3 起的分工**（§12.9 步 3，本文件的核心改动）：
 *  · 本文件**不再硬编码任何珠体层集**。`drawFilledBead` = 算尺 →
 *    `DEFAULT_BEAD_STYLE.beadLayers(...)` → 逐层回放（真源在 `bead-styles/`）。
 *  · 旧十层（L0a 接触阴影 → L0b 投影 → L1 主体 → L2′ 侧壁 → L2×2 暗倒角 → L3×2 亮倒角
 *    → L3b rim → L1c 双枚孔 → L4′ 软高光）已**逐字封入** `bead-styles/legacy-ten.ts`：
 *    对照验收基准 + S7 真机回评前的回退阀；⛔ 不进 registry、不进玩家可选池。
 *  · 珠参数卡 `BEAD_CARD` **真源已上移 `config/tuning.ts`**（本行旧文为
 *    「住在本文件」，于 WXG-T-211-S3 核销）。动因 = 风格模块需要 `radius` / `holeRatio`，
 *    而它们原先住在 `bead-render.ts` ⇒ `registry.ts` 反向 import 本文件即成**循环依赖**；
 *    同时满足 §12.2 C4「系数只准住 tuning」（v1.57 `TRAY_BEAD_SIZE` 同族判例）。
 *    本文件只留**再导出**，旧 import 路径零消费者受损。
 *
 * Everything here is a **pure function of its arguments**: it reads
 * no game state and returns nothing (control-manifest L5) — which is what makes
 * the card testable by command inspection alone (`tests/bead-render.test.ts`).
 *
 * Geometry is expressed as **ratios of the bead edge**, derived from the 64px
 * reference frame §1.1 works in (r = `BEAD_CARD.radius`×BEAD, shadow dy = 3/64×BEAD, …). That
 * keeps one card implementation correct at every size the game uses:
 * `BEAD_CELL = PITCH − GAP = 30` on the board, `TRAY_BEAD_SIZE = TRAY_SLOT − 4 = 44` in the tray.
 * ⚠ **v1.57（WXG-T-207-A）渲染基尺 50/52 → 30/32**：比率制量（radius / 五档线宽 / 孔比 /
 *   接触阴影…）**一个都不用改**，绝对像素量只有 `minStroke`（不缩）与 `BEAD_DRAW_INSET`
 *   （v1.57 6→4；**zoom 上线后改按 `outer/BEAD_CELL` 等比缩放**，静息档仍 = 4px，见下）。
 *   ⚠ 盘面珠的底图 tile 全程比例制（`snap.gridPitch`）⇒ inset 若不随格径缩，珠/背景比例就会
 *   随 zoom 漂移（这是 WXG-T-169 真机反馈的失配来源）。
 * ⚠ 但「比率制 ⇒ 观感等比」是**推论不是实测**：`minStroke = 2` 这条绝对地板会吃掉小珠子上的
 *   比率差（30px 珠上 `bevelWidthLight 4/64 = 1.875`、`rimWidth 3/64 = 1.406` 均被钳成 2
 *   ⇒ 三档倒角同宽）⇒ 已登记 `[待林绘澄/真机]`，`assets-spec §1.10.3`。
 *   ⚠ 四棱转正后**盘上珠不再有 line 图元**（facet-4 = 1 rect + 4 polygon + 1 circle）
 *   ⇒ 上述地板效应对新基线只适用于 `drawEmptySocket` 的 S1/S3/S4 线与 `drawLockedBead` 斜线；
 *   十层侧的该登记随 `legacy-ten` 臂保留（对照通道内仍然真实）。
 */

import type { RenderModelBuilder } from '../../framework/index';
import {
  BEAD_CARD,
  BEAD_CELL,
  BEAD_DRAW_INSET,
  BEAD_PITCH,
  SOCKET_CARD,
  TRAY_BEAD_SIZE,
} from '../config/tuning';
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
import { DEFAULT_BEAD_STYLE, DEFAULT_BEAD_STYLE_ID, styleById } from './bead-styles/registry';
import type { WritableBeadStyleInput } from './bead-styles/contract';
import {
  BEAD_CONTACT_SHADOW_ALPHA,
  DEBUG_OUTLINE_SOCKET_HEX,
  DEBUG_OUTLINE_TILE_HEX,
  BEAD_SHADOW_ALPHA,
  BEAD_SHADOW_ALPHA_SELECTED,
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
 * 珠参数卡 —— 真源已上移 `config/tuning.ts`（v1.57 `TRAY_BEAD_SIZE` 判例 + §12.2 C4
 * 「系数只准住 tuning」；本批直接动因 = `bead-styles/facet-4.ts` 需要 `radius` / `holeRatio`
 * 两个几何系数，而 `registry.ts` 反过来 import 本文件会成**循环依赖**）。
 * 本行降为**再导出**（保留旧 import 路径，不拆 `tests/*` 与 `view-model` 消费者）。
 */
export { BEAD_CARD };


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
  /**
   * L0b 投影 α 覆写；`selected` 传更暗档（§1.2）。
   * ⚠ **EP11-S3 转正后：本通道在四棱层集下无承载体**（facet-4 无阴影层）⇒ 只对
   *   `legacy-ten` 臂有效；字段保留是因为盘/托的选中语义仍住在十层对照侧（⛔ 不得
   *   删 ⇒ 删了回退阀就失真）。本函数**不往风格输入透传**（见 `drawFilledBead` 注）。
   */
  readonly shadowAlpha?: number;
  /**
   * **孔底透出的目标色**（`bead-visual-style-spec` K3，用户 2026-09-23 拍板）。
   * 旧名 `padColorIdx`（L11 垫）；垫已升为 B0 底图（`drawTargetTile`），本参现在的唯一职责
   * = 通孔物理上透下去、看见该格目标色 ⇒ 珠子自带“我该变成什么色”的对照物。
   * 不传（托盘珠）：
   *  · **四棱（现默认）**⇒ 按 `contract.ts::BeadStyleInput.targetColorIdx` 口径回落**本格**
   *    `pit`（仍是端点表内色 ⇒ C3 零新色）；
   *  · `legacy-ten` 臂 ⇒ 走自身下暗档 `mix(base, holeDarkMix)`（乙口径旧行为）。
   * ⚠ 本参另有一条几何副作用：传入 ⇒ 珠体吃 `BEAD_DRAW_INSET` 内缩以露出 B0 底图。
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
  /**
   * G1：L0a 接触阴影 α 覆写（静息 = `BEAD_CONTACT_SHADOW_ALPHA`）。
   * ⚠ **S3 后无承载体**（四棱层集 0 真 α）⇒  legacy-ten 专用通道，同上注。
   */
  readonly contactAlpha?: number;
  /** G1：L0a 接触阴影**宽比**覆写（静息 = `BEAD_CARD.contactW` = 0.88）。⚠ legacy-ten 专用（同上）。 */
  readonly contactWidth?: number;
  /** G1：L0b 投影纵向偏移覆写（`/64` 归一，静息 = `BEAD_CARD.shadowDy` = 3/64）。⚠ legacy-ten 专用（同上）。 */
  readonly shadowDy?: number;
  /**
   * **LOD 降档通道**（`assets-spec §1.6.4`，WXG-T-146；C7 拆名后波浪 = `WAVE_BEAD_LOD_LAYERS = 7`、
   * zoom = `ZOOM_LOD_LAYERS = 7` 各自一名）：
   *  · 旧十层：传入即砍 L0a / L3b / L4a / L4b，保 L0b + L1 + L2 + L3 + L4c（可砍集真源
   *    已随十层搬入 `bead-styles/legacy-ten.ts`）。
   *  · **四棱（现默认）= 结构性 no-op**：6 命令 / 0 真 α ≤ 7 ⇒ 无可砍集。本字段仍**照原样
   *    透传给风格**（`BeadStyleInput.lodLayers`，砍哪几层由风格自己定 ⇒ 渲染侧不判语义，
   *    控制清单 L5），并由判据正面钉住「传 / 不传 ⇒ 输出逐字节等值」
   *    （⛔ 拿掉通道 / 静默吃掉都算净放宽，§K.5 四类强度纪律）。
   * ⛔ **B0 底图绝不进可砍集**（静态谜面载体 ⇒ 本标志**不影响**上方垫的绘制）。
   */
  readonly lodLayers?: number;
  /**
   * **风格 id**（EP11-S5 / S9 v1.7 §2.2 行4 左格；真源 = snapshot `beadStyle`，由
   * `save-schema::normalizeSettings` 保证已注册）。
   * 不传 ⇒ `DEFAULT_BEAD_STYLE`（托盘珠等未接线的调用方保持现行为）。
   * ⚠ **下一帧生效、零过渡**（S6 / `bead-visual-style-spec §12.4`，ux §5 动效表零新行）：
   *   本函数是每帧重建的纯函数 ⇒ 不传 ⇒ 本帧就是新皮，天然无补间、⛔ 不得引入插值。
   * ⚠ 未注册 id 回落默认档 = **渲染侧最后防线**（权威降级在 `normalizeSettings`）；
   *   该分支的存在不由本文件静默吞掉 ⇒ `tests/bead-style-settings.test.ts` 钉住。
   */
  readonly styleId?: string;
  /**
   * **内缩基准覆写**（EP11-S5 行4 右格「豆径档」）：不传 ⇒ `BEAD_DRAW_INSET`（满豆）；
   * 小豆档由调用方传 `BEAD_DRAW_INSET_SMALL`。⛔ 不引入第二把尺子（ADR-0023 DEC-7）：
   * 仍走同一条「基准 × 格径 / `BEAD_CELL`」等比通道，只换基准值。
   * ⚠ 仅对**传 `targetColorIdx` 的盘面珠**有效（inset 分支同门）⇒ 托盘珠恒满幅、不随档。
   */
  readonly drawInset?: number;
  /**
   * **不画孔层**（EP11-S5：「满豆有孔 / 小豆无孔」= `assets-spec §7.11` 豆径作用域正文）。
   * 实现为按 `contract.ts::BeadLayerRole === 'hole'` 跳过 ⇒ ⛔ 不靠风格内重推端点公式
   * （K-042），也不需为小豆另立一套风格（档与风格正交）。
   */
  readonly hideHole?: boolean;
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

/**
 * 选中抬起的**格级分离影**（`bead-visual-style-spec §5` 空间语言 · 实施记录 §11.6）。
 *
 * **为什么落在格级、而不是往珠体层集里加阴影层**：四棱转正（S8）后默认皮肤 `facet-4`
 * = 6 命令 / 0 真 α，§5 的「投影 / 接触阴影 / 侧壁」三条高度通道在默认皮肤下**无承载体**
 *（`FilledBeadOptions.shadowAlpha` 等同源注）⇒ 抬起只剩「平移 + 4% 放大」，不透明物体
 * 凭空挪几 px 就是用户报的「突兀」。本函数把「影物分离」这一条补回来，且：
 *  ① **零新色** —— 影色 = 本格目标色的 `pit` 端点（模块级预烘焙查表，热路径零分配），
 *    与同格的凹槽坑底同源 ⇒ 读作「这颗影躺在该格面上」；
 *  ② **0 真 α** —— 实色图元，不破四棱基线的「0 α」结构不变式；
 *  ③ **不占珠体命令预算** —— `§12.6` 计数口径 = 珠体命令数（底图另计）⇒ **C7 双指标零影响**；
 *  ④ **与风格无关** ⇒ 已注册皮肤全量共用，无需按 styleId 参数化（C8 面零新增）。
 *
 * 影**钉在格面静息足迹**（不随 `lift` 平移）⇒ 珠升多少露多少，分离量本身就是高度读数。
 *
 * ⛔ 只在 `lift > 0` 时调用（静息也画 = 珠下多一块黑 skirt）；⛔ 不参与 `scale`/pop 包络
 *（同 B0 判例，§1.6.1 层序死结论）。**托盘珠不走本函数**：白面板上落暗色珠档读作污渍
 *（`CONFETTI_COLORS` 同判例），且托盘无底图可依。
 */
export function drawLiftGroundShadow(
  builder: RenderModelBuilder,
  cx: number,
  cy: number,
  outer: number,
  targetColorIdx: number,
  inks: BeadInks,
): void {
  const w = outer * BEAD_CARD.liftShadowW;
  const h = outer * BEAD_CARD.liftShadowH;
  builder.rect(
    cx + outer * BEAD_CARD.liftShadowDx - w / 2,
    cy - outer * BEAD_CARD.liftShadowDy - h / 2,
    w,
    h,
    {
      fill: endpointOf(inks, targetColorIdx).pit,
      radius: Math.round(h / 2),
    },
  );
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
 * 逐珠复用的**风格输入槽**（C2 热路径零分配）。
 *
 * ⛔ 不得改回「每次调用新建对象字面量 / spread」：spread 既触 `check:es5-spread`
 * 又是每珠每帧一次堆分配。本槽的生命周期 = 下面 `drawFilledBead` 的一次调用
 * （写完立刻被层集循环消费完，⛔ 不逃逸、不入任何长期容器）。
 */
const styleInput: WritableBeadStyleInput = {
  inks: DEMO_BEAD_INKS,
  colorIdx: 1,
  targetColorIdx: undefined,
  size: BEAD_CELL,
  lodLayers: undefined,
};

/**
 * 画一颗 `filled` 珠（§1.1 · `bead-visual-style-spec §7.11.1` 甲口径层集），锚点 `(cx, cy)`。
 *
 * **EP11-S3 转正后本函数只做三件事**（§12.9 步 3；⛔ 不再持有任何一层硬编码层集）：
 *  1. **算尺** —— `lift` / `scale` / `BEAD_DRAW_INSET` 三条通道合成绘出边长 `size`，
 *     y 位移 = `cy + lift`。尺子留在渲染侧：它是**入参的纯函数**，不是风格的几何
 *     （风格只见 `size`，因而同一风格在盘 22 / 托 44 / zoom 缩放档下都成立）。
 *  2. **取层集** —— `DEFAULT_BEAD_STYLE.beadLayers(...)`（真源 = `bead-styles/registry.ts`
 *     → `bead-styles/facet-4.ts`；C9「升级即换肤」= 翻默认即换皮，本函数零改动）。
 *  3. **回放** —— 逐层映射到 builder 的三个出口 `rect` / `polygon3` / `circle`
 *     （格心局部系 → 世界系：`x` 加 `cx`、`y` 加 `cy + lift`）。
 *     ⚠ **`rect` / `circle` 另透传 `stroke` / `lineWidth`**（§12.9 步 4 为 `18` 线稿描边开的
 *     字段，`contract.ts::BeadStyleLayer` 两条定死约束之一）；`polygon` 分支**无描边出口**
 *     ⇒ 刻面必须是不透明顶面（C12 统计域与 J-3 不串形判据的隐含前提）。
 *
 * ⚠ **热路径零分配（C2）**：层集本身是风格的模块级 scratch，输入槽同上 ⇒ 每珠每帧
 *   0 次层集/输入对象分配。成立前提是 `ADR-0024` 的 polygon **值拷贝**语义：builder 取到
 *   的是六个 number 的副本，下一珠改写 scratch 不会串形（判据 J-1/J-3 钉死；
 *   `tests/bead-style-pool.test.ts` 的 `describe('C2 零分配机械锚 …')` 钉「两次调用返回同一实例」
 *   = 零分配的机械证据，WXG-T-211-S3 补建，变异自证 M-C/M-D 见 `temp/wxg-t-211-s3/17-c2-mutation.txt`）。
 * ⚠ **B0 底图不在本函数**：`drawTargetTile` 由 view-model 对每个可填格独立调（v1.5-r8），
 *   与珠体层集无关 ⇒ 垫锁格心、不吃 lift / scale（§1.6.1 层序死结论）。
 * ⚠ **旧十层实现**已封入 `bead-styles/legacy-ten.ts`（对照臂 + S7 真机回评前的回退阀；
 *   ⛔ 不进 registry、不进玩家可选池、生产渲染链不 import 它）。`FilledBeadOptions` 的
 *   `contactAlpha` / `contactWidth` / `shadowAlpha` / `shadowDy` 四条通道在四棱层集下
 *   **无承载体**（facet-4 无阴影/接触层、0 真 α）⇒ 它们现在只对 legacy-ten 臂有效，
 *   本函数**如实不透传**（不假装 G1 包络仍在换肤后的珠上生效）。
 */
export function drawFilledBead(
  builder: RenderModelBuilder,
  cx: number,
  cy: number,
  colorIdx: number,
  options: FilledBeadOptions = {},
): void {
  const outer = options.size ?? BEAD_CELL;
  const lift = options.lift ?? 0;
  const y = cy + lift;
  /**
   * §5 抬起的高度参量：`lift` 归一化到「**当前档的一次完整抬起**」。
   * 负 `lift` 不视为「陷下去」⇒ 钳到 0（当前无调用方传负值，防误用）。
   *
   * ⚠ **分母随档等比**（`liftRef × outer / BEAD_CELL`，与下方 `inset` 同一条归一通道）：
   *   `liftRef` 是静息档（`BEAD_CELL`）基准，而调用侧的 `lift` 已按 `view-model::liftScale`
   *   缩过 ⇒ 分母若仍取静息值，胀档下 `liftT` 会 > 1 ⇒ 放大通道超发（z=3 实算：`liftScaleGain`
   *   4% → 12%，越过 C5「scale 峰值合计 < 1.12」前提，且「珠—影」间隙占格径比例由 0.0787
   *   掉到 0.0493 = 各档不同形）。归一后 `liftT` = 进格比例（[0,1]），**各档自相似**；
   *   `Math.min(1, ·)` 再把 C5 峰值前提在任何档钉住（恒等档取值逐位不变：`6×30/(6×30) = 1`）。
   *
   * ⚠ 对照臂 `bead-styles/legacy-ten.ts` 内的同名算式**不改**（“逐字封入、函数体一行未改”
   *   就是回退阀的定义）⇒ 它的四条通道在胀档仍按静息档归一，差异只在对照臂可见，登记于此。
   */
  const liftT = Math.min(1, (Math.max(0, lift) * BEAD_CELL) / (BEAD_CARD.liftRef * outer));
  // 珠体四边内缩，露出四周的 B0 底图（= 该格目标色）；无目标色（托盘珠）保持满幅。
  // ⚠ **inset 随格径等比**（WXG-T-169 zoom 上线后的裁定更替，替 ADR-0015 C-5「保持绝对」）：
  //   旧实现吃绝对 4px ⇒ 珠/底图比例随 zoom 漂移（珠面/格距 = (30z−8)/32z：zoom 1 = 68.8%，
  //   大盘 fit 档 z ≈ 0.6 只剩 52% ⇒ 「缩小时豆子比背景小很多」）。`outer/BEAD_CELL` 归一后
  //   静息档恒 = 4（逐字节不变），且珠面恒为格径
  //   73.3% ⇒ 比例锁死；`FACE_MIN` 护栏因此在比例制下永不触发（保持「预留未启用」）。
  // G1：`scale` **只作用珠体**（见 `FilledBeadOptions.scale` 的层序死结论禁令）。
  // EP11-S5：内缩**基准**可由豆径档覆写（`drawInset`），等比通道本身不变（ADR-0023 DEC-7）。
  const inset =
    options.targetColorIdx !== undefined
      ? ((options.drawInset ?? BEAD_DRAW_INSET) * outer) / BEAD_CELL
      : 0;
  const size = (outer - inset * 2) * (options.scale ?? 1) * (1 + BEAD_CARD.liftScaleGain * liftT);

  styleInput.inks = options.inks ?? DEMO_BEAD_INKS;
  styleInput.colorIdx = colorIdx;
  styleInput.targetColorIdx = options.targetColorIdx;
  styleInput.size = size;
  // G4 波浪降档 / ADR-0017 zoom LOD：通道**照原样透传**给风格（值 = `WAVE_BEAD_LOD_LAYERS`
  // 或 `ZOOM_LOD_LAYERS`，由调用侧选，本函数不判阈值、不换算）。
  // facet-4 = 6 命令 / 0 真 α ≤ 7 ⇒ 对本风格是**结构性 no-op**，由判据正面钉住
  // （「传 lodLayers ⇒ 输出与不传逐字节等值」）；真正的降档语义仍在 legacy-ten 臂。
  styleInput.lodLayers = options.lodLayers;
  // EP11-S5 **换肤路径**：按 `styleId` 查 registry 取层集（不传 / 未注册 ⇒ 默认档）。
  // `styleById` = 预建 `Map.get` ⇒ 每珠一次查表仍零分配（C2）；⛔ 不用 `registeredStyleIds()`
  // （它含 `.map`，每次调用一次堆分配）。
  const style =
    options.styleId === undefined || options.styleId === DEFAULT_BEAD_STYLE_ID
      ? DEFAULT_BEAD_STYLE
      : styleById(options.styleId) ?? DEFAULT_BEAD_STYLE;
  const layers = style.beadLayers(styleInput);
  const hideHole = options.hideHole === true;

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    // 小豆档无孔（`assets-spec §7.11`）：按 role 跳过 ⇒ 满豆档（不传本参）命令流逐字节不变。
    if (hideHole && layer.role === 'hole') continue;
    const alpha = layer.alpha;
    if (layer.kind === 'rect') {
      const radius = layer.radius ?? 0;
      // 描边透传（WXG-T-211-S4 / `assets-spec §7.11.3`）：`fill + stroke` **同路径 = 仍 1 命令**
      // （§7.11 读法②）⇒ 命令数与真 α 计数均不因 stroke 而变。无描边的层传 `undefined`：
      // 两个 renderer 均走 `if (stroke)` 分支 ⇒ 不画；且本仓所有命令比对都经
      // `JSON.stringify`（`bead-style-seal.test.ts::serialize`），**undefined 值不落字段**
      // ⇒ 四棱/`13` 的整帧命令流逐字节不变（seal 基准不受本批影响，正面预期由该测试守）。
      if (alpha === undefined) {
        builder.rect(cx + layer.x, y + layer.y, layer.w, layer.h, { fill: layer.fill, radius, stroke: layer.stroke, lineWidth: layer.lineWidth });
      } else {
        builder.rect(cx + layer.x, y + layer.y, layer.w, layer.h, { fill: layer.fill, radius, alpha, stroke: layer.stroke, lineWidth: layer.lineWidth });
      }
    } else if (layer.kind === 'circle') {
      if (alpha === undefined) {
        builder.circle(cx + layer.cx, y + layer.cy, layer.r, { fill: layer.fill, stroke: layer.stroke, lineWidth: layer.lineWidth });
      } else {
        builder.circle(cx + layer.cx, y + layer.cy, layer.r, { fill: layer.fill, alpha, stroke: layer.stroke, lineWidth: layer.lineWidth });
      }
    } else {
      const p = layer.points;
      if (alpha === undefined) {
        builder.polygon3(
          cx + p[0], y + p[1], cx + p[2], y + p[3], cx + p[4], y + p[5],
          { fill: layer.fill },
        );
      } else {
        builder.polygon3(
          cx + p[0], y + p[1], cx + p[2], y + p[3], cx + p[4], y + p[5],
          { fill: layer.fill, alpha },
        );
      }
    }
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
  /**
   * **同格「有豆时」的珠体内缩基准**（`BEAD_DRAW_INSET` / `_SMALL`，与 `drawFilledBead`
   * 的 `drawInset` 同口径；不传 = 0 = 无珠可对照的托盘槽）。
   *
   * ⚠ **用户裁定 2026-09-26（WXG-T-214 补）：豆坑恒比豆子小一圈，有豆时看不到豆坑。**
   * 旧实现把坑画在**格径**（`snap.gridCell` = 30）上，而珠体绘制边长只有
   * `30 − 2×4 = 22` ⇒ 空槽的暗块（坑底 26.4）**比珠体还大**，有豆/无豆根本不是一张图，
   * 「豆 vs 底图」的边界被一个比豆还大的坑抢读（旧 v1.5-r8 的「一张图」目标直接落空）。
   * 本参使坑外廓从**珠体绘制边长**再退一圈 ⇒ 珠落下时把坑整块盖住（几何上恒被覆盖）。
   */
  beadInset = 0,
): void {
  /**
   * 坑外廓（**整条不变式的落点**）：
   *   `珠体绘制边长 = size − 2×(beadInset × size / BEAD_CELL)`（与 `drawFilledBead` 同尺，
   *    含 zoom 与豆径档 ⇒ 大盘/小豆档自动跟随）；
   *   `坑 = 珠体绘制边长 − 2 × relief`（`relief` = 一圈，见 `SOCKET_CARD.relief`）。
   * ⇒ **坑 ⊂ 珠** 恒成立（含圆角：珠半径 `0.30S` > 坑半径 `0.30s`）。
   */
  const beadFace = size - (beadInset * size) / BEAD_CELL * 2;
  const relief = Math.max(BEAD_CARD.minStroke, size * SOCKET_CARD.relief);
  const s = Math.max(BEAD_CARD.minStroke * 2, beadFace - relief * 2);
  const left = cx - s / 2;
  const bottom = cy - s / 2;
  const radius = Math.round(s * BEAD_CARD.radius);
  const base = colorIdx === undefined ? palette.slot : beadColorOf(inks, colorIdx);
  const endpoints = colorIdx === undefined ? neutralEndpoints(palette) : endpointOf(inks, colorIdx);
  /**
   * 暗缘墨（S1 外框线 / S3 上内缘内阴影）——**WXG-T-214（2026-09-26 用户拍板）**：
   * B0 底图铺设时（`tilePainted`）底图墨 = 本格 `edge` ⇒ 旧写法把这两笔画成
   * **自己的背景色**（逐字同色，不可见）⇒ 凹坑只剩「暗底 + 一条下亮线」，
   * B1 修好的「暗上亮下」双线只剩一半。改取 `pit`（比 `edge` 深两档，零新 hex、
   * 与 S2 坑底同源）⇒ 凹感恢复。托盘空槽（`tilePainted = false`，自带亮 `base` 外块）
   * **保持 `edge` 不变**（白面板上 `pit` 过重），逐字节不变。
   */
  const shadeInk = tilePainted ? endpoints.pit : endpoints.edge;

  // S2 坑底（先画大底，S1 框压在其上）：内缩 6% 的 `pit` 填充。
  // ⚠ 坑的全部几何走 `s`（坑外廓），**不用 `size`**（= 格径）——见 `beadInset` 参注。
  const inset = s * SOCKET_CARD.pitInset;
  // B0 已铺 ⇒ 不再刷亮 `base`（否则“有豆/无豆”又是两张图）。零新 hex。
  // 托盘槽的「大底」= 槽体本身（不是坑）⇒ 仍按 `size` 画，不随坑缩小。
  if (!tilePainted) {
    builder.rect(cx - size / 2, cy - size / 2, size, size, {
      fill: base,
      radius: Math.round(size * BEAD_CARD.radius),
    });
  }
  builder.rect(left + inset, bottom + inset, s - inset * 2, s - inset * 2, {
    fill: endpoints.pit,
    radius: Math.max(2, Math.round((s - inset * 2) * BEAD_CARD.radius * 0.8)),
  });

  // S1 暗缘框（外框线，压住 S2 边界）。
  builder.rect(left, bottom, s, s, {
    stroke: shadeInk,
    lineWidth: Math.max(BEAD_CARD.minStroke, s * SOCKET_CARD.edgeWidth),
    radius,
  });

  // S3 上内缘内阴影线（暗，凹感上半）。
  // ⚠ **WXG-T-211-B1 / EP11-S1（P0 换向修复，assets-spec §7.11.7-D2）**：设计空间 y 向上，
  // 旧码把暗线画在 `bottom + inset`（下缘）、亮线画在 `bottom + size − inset`（上缘）
  // ⇒ 凹槽与珠体**同向**、§1.9.4 通道 2（空/珠区分主轴）失活；两线 y 已对调为
  // **暗上亮下**，方向由 `tests/bead-render.test.ts` TC-SKT-01 的 `y_dark > y_lit` 锁死
  // （旧墨色断言拦不住换向，K-035/K-060）。墨色档不改（D3 口径漂移归 art 对齐单）。
  // ⚠ WXG-T-214：墨改取 `shadeInk`（底图铺设 = `pit`）—— 旧 `edge` 在 B0 底图上不可见（见其注）。
  const shadeWidth = Math.max(BEAD_CARD.minStroke, s * SOCKET_CARD.shadeWidth);
  builder.line(
    left + inset,
    bottom + s - inset,
    left + s - inset,
    bottom + s - inset,
    shadeInk,
    shadeWidth,
  );

  // S4 下内缘受光亮线（亮，凹感下半）。
  builder.line(
    left + inset,
    bottom + inset,
    left + s - inset,
    bottom + inset,
    endpoints.lit,
    Math.max(BEAD_CARD.minStroke, s * SOCKET_CARD.litWidth),
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
