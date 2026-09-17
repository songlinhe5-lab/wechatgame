/**
 * 场景级 VFX 包络（WXG-T-146 · T-128「动态质感章」落码②）。
 *
 * 规格正本：`art/assets-spec.md` §1.6.3（`vfx_powerup_sweep`）与 §1.6.4（`vfx_complete_wave`）；
 * 毫秒真源：`design/ux/ux-spec.md` §5「道具生效」400ms /「过关庆祝」800ms + 20ms/列。
 *
 * 本模块只放**纯函数**（进度 → 几何/幅值），不 import `cc`/DOM/`wx`、不持任何状态（L3/L5）；
 * 命令发射留在 `view-model.ts`，逐帧计时槽留在 `game/beads-game.ts`。
 *
 * G2′（§1.6.2a 解环器归位）的相 B **不在此重列公式** —— 规格写「逐字复用 §1.6.1」
 * ⇒ 直接调 `bead-render.ts::fillPopEnvelope`。
 */

import {
  SWEEP_TAN,
  SWEEP_WIDTHS,
  SWEEP_X_FROM,
  SWEEP_X_TO,
  SWEEP_Y_MAX,
  SWEEP_Y_MIN,
  WAVE_COL_DELAY_MS,
  WAVE_LIFT_PX,
  WAVE_MS,
  WAVE_RISE_RATIO,
  WAVE_SCALE_PEAK,
  WAVE_WINDOW_MIN_MS,
} from '../config/tuning.js';

/** 规格只写通用名 `easeInOut(p)`（§1.6.3 未钉具体曲线）⇒ 实现取 **smoothstep**（首末速度 0）。 */
function easeInOut(p: number): number {
  const u = p < 0 ? 0 : p > 1 ? 1 : p;
  return u * u * (3 - 2 * u);
}

/** ease-in（§1.6.2/§1.6.4 的「落下 / 被吸走」侧）：`p²`。 */
function easeIn(p: number): number {
  const u = p < 0 ? 0 : p > 1 ? 1 : p;
  return u * u;
}

/** ease-out（§1.6.4「鼓起」侧）：与 `wrongFlashAlpha` 同族的 `p(2−p)` 写法。 */
function easeOut(p: number): number {
  const u = p < 0 ? 0 : p > 1 ? 1 : p;
  return u * (2 - u);
}

// ───────────────────────────────── G3 `vfx_powerup_sweep`（§1.6.3）

/** 层数固定 3（核心 / 中 / 广）；绘制序 = **反序**（先广后核心 ⇒ 后画的更亮）。 */
export const SWEEP_LAYER_COUNT = 3;

/** 斜带中心线在**底部**（`y = SWEEP_Y_MIN`）处的 x。`p` 为归一化进度。 */
export function sweepCenterX(p: number): number {
  return SWEEP_X_FROM + (SWEEP_X_TO - SWEEP_X_FROM) * easeInOut(p);
}

/**
 * 第 `i` 层（0=核心 / 1=中 / 2=广）的四角写入 `out[0..7]` 并返回 `out`。
 *
 * 斜切方向：y 越大 x 越靠右 ⇒ 顶部相对底部右移 `SWEEP_TAN × (Y_MAX − Y_MIN) ≈ 442px`（20°）。
 * ⚠️ `out` 由调用方**每次新建**：`RenderModelBuilder.polygon()` **按引用**保存 points
 *    （`render-model.ts:150`）⇒ 多帧共用一块 scratch 会让上一帧命令跟着变形。
 */
export function sweepQuad(i: number, centerX: number, out: number[]): number[] {
  const half = (SWEEP_WIDTHS[i] ?? SWEEP_WIDTHS[0]!) / 2;
  out[0] = centerX - half + SWEEP_TAN * SWEEP_Y_MIN;
  out[1] = SWEEP_Y_MIN;
  out[2] = centerX + half + SWEEP_TAN * SWEEP_Y_MIN;
  out[3] = SWEEP_Y_MIN;
  out[4] = centerX + half + SWEEP_TAN * SWEEP_Y_MAX;
  out[5] = SWEEP_Y_MAX;
  out[6] = centerX - half + SWEEP_TAN * SWEEP_Y_MAX;
  out[7] = SWEEP_Y_MAX;
  return out;
}

// ───────────────────────────────── G4 `vfx_complete_wave`（§1.6.4）

/**
 * 单列窗口时长 `W`（§1.6.4「派生」行的**唯一自洽推导**，不新造时长）：
 * `W = max(WAVE_WINDOW_MIN_MS, WAVE_MS − WAVE_COL_DELAY_MS × (cols − 1))`
 * ⇒ cols=13 → 560ms；cols=7 → 680ms；cols=1 → 800ms。
 */
export function waveWindowMs(cols: number): number {
  const c = cols < 1 ? 1 : cols;
  return Math.max(WAVE_WINDOW_MIN_MS, WAVE_MS - WAVE_COL_DELAY_MS * (c - 1));
}

export interface WaveEnvelope {
  /** 珠体缩放（⛔ 不乘 `outer`，见 §1.6.1 层序死结论）。 */
  scale: number;
  /** 微抬（px，单峰 0 往复）。 */
  dy: number;
  /** 该列是否处于动画中（`0 < p < 1`）⇒ 决定是否走 LOD 降层。 */
  active: boolean;
}

/**
 * 第 `j` 列在总时长进度 `t ∈ [0, WAVE_MS]` 下的波形（列错峰 `WAVE_COL_DELAY_MS`）。
 *
 * 结果写入 `out` 并返回 —— 热路径零分配：调用方在循环**外**建一个槽整帧复用。
 */
export function waveEnvelope(
  j: number,
  t: number,
  windowMs: number,
  out: WaveEnvelope,
): WaveEnvelope {
  const tau = t - WAVE_COL_DELAY_MS * j;
  if (tau <= 0) {
    out.scale = 1;
    out.dy = 0;
    out.active = false; // 未轮到 ⇒ 满层静息（波浪前沿的「质感落差」正来自这里）
    return out;
  }
  const p = tau >= windowMs ? 1 : tau / windowMs;
  if (p >= 1) {
    out.scale = 1;
    out.dy = 0;
    out.active = false; // 该列已回静息
    return out;
  }
  out.scale =
    p < WAVE_RISE_RATIO
      ? 1 + (WAVE_SCALE_PEAK - 1) * easeOut(p / WAVE_RISE_RATIO)
      : WAVE_SCALE_PEAK -
        (WAVE_SCALE_PEAK - 1) * easeIn((p - WAVE_RISE_RATIO) / (1 - WAVE_RISE_RATIO));
  out.dy = WAVE_LIFT_PX * Math.sin(Math.PI * p);
  out.active = true;
  return out;
}
