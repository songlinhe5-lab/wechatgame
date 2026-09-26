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
 *   接触阴影…）**一个都不用改**，绝对像素量只有 `BEAD_DRAW_INSET`（6→4）与 `minStroke`（不缩）。
 * ⚠ 但「比率制 ⇒ 观感等比」是**推论不是实测**：`minStroke = 2` 这条绝对地板会吃掉小珠子上的
 *   比率差（30px 珠上 `bevelWidthLight 4/64 = 1.875`、`rimWidth 3/64 = 1.406` 均被钳成 2
 *   ⇒ 三档倒角同宽）⇒ 已登记 `[待林绘澄/真机]`，`assets-spec §1.10.3`。
 *   ⚠ 四棱转正后**盘上珠不再有 line 图元**（facet-4 = 1 rect + 4 polygon + 1 circle）
 *   ⇒ 上述地板效应对新基线只适用于 `drawEmptySocket` 的 S1/S3/S4 线与 `drawLockedBead` 斜线；
 *   十层侧的该登记随 `legacy-ten` 臂保留（对照通道内仍然真实）。
 */

import type { RenderModelBuilder } from '@wxgame/framework';
import {
  BEAD_CARD,
  BEAD_CELL,
  BEAD_DRAW_INSET,
  BEAD_PITCH,
  SOCKET_CARD,
  TRAY_BEAD_SIZE,
} from '../config/tuning.js';
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
import { DEFAULT_BEAD_STYLE } from './bead-styles/registry.js';
import type { WritableBeadStyleInput } from './bead-styles/contract.js';
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
} from './palette.js';

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
   * §5 抬起的高度参量：`lift` 归一化到「一次完整抬起」。
   * 负 `lift` 不视为「陷下去」⇒ 钳到 0（当前无调用方传负值，防误用）。
   */
  const liftT = Math.max(0, lift) / BEAD_CARD.liftRef;
  // 珠体四边内缩，露出四周的 B0 底图（= 该格目标色）；无目标色（托盘珠）保持满幅。
  // G1：`scale` **只作用珠体**（见 `FilledBeadOptions.scale` 的层序死结论禁令）。
  const inset = options.targetColorIdx !== undefined ? BEAD_DRAW_INSET : 0;
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
  const layers = DEFAULT_BEAD_STYLE.beadLayers(styleInput);

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const alpha = layer.alpha;
    if (layer.kind === 'rect') {
      const radius = layer.radius ?? 0;
      if (alpha === undefined) {
        builder.rect(cx + layer.x, y + layer.y, layer.w, layer.h, { fill: layer.fill, radius });
      } else {
        builder.rect(cx + layer.x, y + layer.y, layer.w, layer.h, { fill: layer.fill, radius, alpha });
      }
    } else if (layer.kind === 'circle') {
      if (alpha === undefined) {
        builder.circle(cx + layer.cx, y + layer.cy, layer.r, { fill: layer.fill });
      } else {
        builder.circle(cx + layer.cx, y + layer.cy, layer.r, { fill: layer.fill, alpha });
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
  // ⚠ **WXG-T-211-B1 / EP11-S1（P0 换向修复，assets-spec §7.11.7-D2）**：设计空间 y 向上，
  // 旧码把暗线画在 `bottom + inset`（下缘）、亮线画在 `bottom + size − inset`（上缘）
  // ⇒ 凹槽与珠体**同向**、§1.9.4 通道 2（空/珠区分主轴）失活；两线 y 已对调为
  // **暗上亮下**，方向由 `tests/bead-render.test.ts` TC-SKT-01 的 `y_dark > y_lit` 锁死
  // （旧墨色断言拦不住换向，K-035/K-060）。墨色档不改（D3 口径漂移归 art 对齐单）。
  const shadeWidth = Math.max(BEAD_CARD.minStroke, size * SOCKET_CARD.shadeWidth);
  builder.line(
    left + inset,
    bottom + size - inset,
    left + size - inset,
    bottom + size - inset,
    endpoints.edge,
    shadeWidth,
  );

  // S4 下内缘受光亮线（亮，凹感下半）。
  builder.line(
    left + inset,
    bottom + inset,
    left + size - inset,
    bottom + inset,
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
