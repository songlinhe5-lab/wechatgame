/**
 * `legacy-ten` —— 十层旧模型的**封箱对照臂**（WXG-T-211-S3 / EP11-S3 · §12.9 步 3 · §12.2 C6/C9）
 * ─────────────────────────────────────────────────────────────────────────────
 * **它是什么**：四棱转正前 `bead-render::drawFilledBead` 的十层实现（L0a 接触阴影 → L0b 投影
 * → L1 主体 → L2′ 侧壁 → L2×2 暗倒角 → L3×2 亮倒角 → L3b rim → L1c 双枚孔 → L4′ 软高光），
 * **逐字搬家**到本模块，函数体与本文件的历史版本**一行未改**（含注释与算式顺序）。
 *
 * **它为什么存在**（两条，都不是「留个后路」的模糊说法）：
 *  1. **对照验收基准** = §12.9 步 3 原话「`legacy-ten` 对照 = 『什么都没变』」——
 *     转正改动渲染链后，本臂产出的命令流必须与改码前 HEAD **逐字节等值**，
 *     否则「变化只来自珠体族换肤」这句结论无法被证伪（证据 `temp/wxg-t-211-s3/`，方法 = ADR-0024 J-5）。
 *  2. **回退阀**：存活到 **S7 真机回评**（用户裁定，非 S3 done 即删）。
 *
 * ⛔ **它不是玩家可选风格**：不进 `bead-styles/registry.ts` 的 `REGISTRY`。现契约语义 =
 *   **注册即出池**（`registeredStyleIds()` 同时是 S9 §8-19「注册数 ≤ 1 ⇒ 钮不呈现」的计数真源，
 *   且 `tests/bead-style-pool.test.ts:193` 已有该前提哨兵）⇒ 若把十层注册进去，U16 设置钮
 *   就会看见它（触 §12.8-⑤「不进玩家池」）。故本臂 = **registry 外的对照通道**，只由
 *   `tests/*` 与本文件的调用方显式使用；**生产渲染链（`drawFilledBead`）不 import 本模块**
 *   ⇒ 结构上不可能被玩法路径触达。回退 = 在 `bead-render.ts` 的调用点改一行（ADR-0023 §6.3
 *   「在 registry 里翻默认」的字面出入已作为处置点回传主理人）。
 *
 * ⚠ **旧层集无法用 `BeadStyle` 描述符表达**（本单为什么不进 registry 的第二条理由）：
 *   十层含 `line` 图元（倒角/rim）、`stroke`-only rect、以及**真 α** 层（L0a/L0b/L4′）
 *   与**双枚**孔（K2–K4 的乙口径），而 `contract.ts::BeadStyleLayer` 只准
 *   `rect|polygon|circle` 三态 + 只 `fill` + 单孔。硬塞 = 改契约语义 ⇒ 越权。
 *
 * §K.5 台账中「随十层退役」的判据（L0a/L0b/L2′/L3b rim/L4′）的**承重迁移**目标就是本臂：
 * 那些几何与通道在本臂里仍然真实存在，因此判据不删、只改述为「legacy-ten 臂 + 新基线负向防复活」。
 */
import type { RenderModelBuilder } from '../../../framework/index';
import { BEAD_CARD, BEAD_CELL, BEAD_DRAW_INSET } from '../../config/tuning';
import {
  BEAD_BEVEL_DARK_MIX,
  BEAD_BEVEL_LIGHT_MIX,
  BEAD_CONTACT_SHADOW_ALPHA,
  BEAD_HIGHLIGHT_HEX,
  BEAD_RIM_MIX,
  BEAD_SHADOW_ALPHA,
  BEAD_SHADOW_HEX,
  BEAD_SOFT_HIGHLIGHT_ALPHAS,
  beadColorOf,
  DEMO_BEAD_INKS,
  endpointOf,
  mix,
  withAlpha,
} from '../palette';
import type { FilledBeadOptions } from '../bead-render';

/** 对照臂标签（仅用于测试与取证命名；⛔ 不是 `registry` 的 styleId）。 */
export const LEGACY_TEN_ID = 'legacy-ten';

/**
 * 十层珠体（§1.1 旧模型）—— `bead-render::drawFilledBead` 转正前的原样实现。
 *
 * ⚠ **v1.5-r8（2026-09-23 用户拍板）：L5 符号层已整层删除**。此前非色相通道只长在珠上
 * （`emitSymbol` 全仓唯一调用点），而目标侧（L11 垫）只有颜色 ⇒ 玩家比对「这颗珠属于这格吗」
 * 时拿不到形状信号，三重编码实际只覆盖一半。本批改为**连续目标色底图**承担该职责，
 * 代价与色盲口径见 `art/accessibility.md` 末条修订。
 */
export function drawLegacyTenBead(
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
