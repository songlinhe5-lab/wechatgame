/**
 * 连击特效三档（`score-combo §2.5` + `ux/ux-spec.md §5`）的**纯逻辑**：档位 → 特效规格，
 * 以及「已播毫秒 → 本帧呈现参数」。不持有任何状态、不画任何东西（视图按返回值绘制）。
 *
 * 冻结来源
 *  - 档位与形态（`score-combo §2.5`）：Lv1(×2) 珠面星光粒子 3–5 枚 → Lv2(×3) **伪**震屏
 *    （整屏 scale 1.00→1.015→1.00，**无位移抖动**）→ Lv3(×5) 边缘径向光 + 珠面波浪；
 *  - 时长（`ux-spec §5` 三行）：Lv1 **200ms** / Lv2 **150ms** / Lv3 **350ms**；
 *  - 红线（`systems-index §3.8`，被 `score-combo §8-9` 判据引用）：**无真位移震屏**、闪烁 **≤3Hz**。
 *
 * ⚠️ 两条红线用**结构**落实，不靠注释提醒：
 *  1. Lv2 的呈现量只有 `screenScale` —— {@link ComboPseudoShake} **没有 dx/dy 字段**
 *     ⇒「用位移伪造震屏」在类型层写不出来；
 *  2. 三档都是**单次循环**（0 → 峰值 → 0，播完即止），本模块**没有任何自重复的周期量**
 *     ⇒ 不存在 >3Hz 闪烁来源（周期性闪烁属于告急脉冲 / 满槽呼吸，见 `ux-spec §5`，与本模块无关）。
 *
 * ⚠️ 平台缺口历史（登记台账 WXG-T-074，**已由 WXG-T-132 案 B 收口**）：Lv2 的「整屏 scale」
 * 需要**全局变换通道**，当时 `RenderModelBuilder` 只产出逐图元命令⇒ 该档长期**不呈现**
 * （不假造）。现 `RenderModel.setTransform` 通道已落地，`buildBeadsView` 头部消费本模块的
 * `screenScale`；本模块仍只负责把**值**算对并测对（判据 `§8-9` 的「档位一一对应」半边）。
 *
 * 派生项（GDD / UX 无明文，登记台账）：
 *  · 粒子数取 `COMBO_PARTICLE_COUNT`（§2.5 是 3–5 区间；本模块无 RNG ⇒ 取中值，确定性可测）；
 *  · 多档重叠时**只播最高档**（同一时刻只存在一个 VFX，避免叠加成闪烁）——由 `BeadsGame` 落地。
 */

import {
  COMBO_PARTICLE_COUNT,
  COMBO_SHAKE_SCALE_MAX,
  COMBO_VFX_LV1_MS,
  COMBO_VFX_LV2_MS,
  COMBO_VFX_LV3_MS,
} from '../config/tuning';

/** 三档特效的形态类别（与 `score-combo §2.5` 一一对应）。 */
export type ComboVfxKind = 'particles' | 'pseudoShake' | 'burst';

export interface ComboVfxSpec {
  /** 倍率档位序号：1 = ×2，2 = ×3，3 = ×5（`combo:up.tier` 的取值域）。 */
  readonly tier: number;
  readonly kind: ComboVfxKind;
  readonly durationMs: number;
}

/** 档位 → 规格表（§2.5 形态 + §5 时长；`tier` 越界 → `null`，调用方零动作）。 */
const SPECS: Readonly<Record<number, ComboVfxSpec>> = {
  1: { tier: 1, kind: 'particles', durationMs: COMBO_VFX_LV1_MS },
  2: { tier: 2, kind: 'pseudoShake', durationMs: COMBO_VFX_LV2_MS },
  3: { tier: 3, kind: 'burst', durationMs: COMBO_VFX_LV3_MS },
};

export function comboVfxSpec(tier: number): ComboVfxSpec | null {
  if (!Number.isInteger(tier)) return null;
  return SPECS[tier] ?? null;
}

/** 播放进度 `0..1`（越界钳；`durationMs <= 0` 视为已播完）。 */
export function comboVfxProgress(elapsedMs: number, durationMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 1;
  return Math.min(1, elapsedMs / durationMs);
}

/**
 * Lv2 伪震屏的呈现量。
 *
 * **只有缩放，没有位移** —— 这是 `§3.8` 红线（「震屏不使用」）在类型层的落实：
 * 调用方拿不到 dx/dy，也就不可能把它画成真震屏。
 */
export interface ComboPseudoShake {
  /** 整屏缩放：1.00 → {@link COMBO_SHAKE_SCALE_MAX}（中点）→ 1.00。 */
  readonly screenScale: number;
}

/** 三角波：`progress` 0 → 1.00，0.5 → 峰值，1 → 1.00（单次循环，不自重复）。 */
export function comboPseudoShake(progress: number): ComboPseudoShake {
  const p = Math.max(0, Math.min(1, progress));
  const bump = p <= 0.5 ? p / 0.5 : (1 - p) / 0.5;
  return { screenScale: 1 + (COMBO_SHAKE_SCALE_MAX - 1) * bump };
}

/**
 * Lv1 粒子的**相对落子格心**的偏移（design 空间，y 向上）。
 * 四枚沿四象限均布、随进度**由内向外**散开并整体淡出（视图负责叠到格心、按时长淡出）。
 */
export function comboParticleOffsets(progress: number): readonly { x: number; y: number }[] {
  const p = Math.max(0, Math.min(1, progress));
  const radius = 26 + 34 * p; // 26 → 60（design px）
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < COMBO_PARTICLE_COUNT; i += 1) {
    const angle = (Math.PI / 2) * i + Math.PI / 4 + 0.35 * p; // 四象限均布 + 微旋
    out.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return out;
}

/** Lv3 全屏爆发的两个呈现量：边缘径向光强度（0→1→0）与珠面波浪相位（0→1）。 */
export interface ComboBurst {
  readonly radial: number;
  readonly wave: number;
}

export function comboBurst(progress: number): ComboBurst {
  const p = Math.max(0, Math.min(1, progress));
  const bump = p <= 0.5 ? p / 0.5 : (1 - p) / 0.5;
  return { radial: bump, wave: p };
}
