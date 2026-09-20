/**
 * 场景级 VFX 包络（WXG-T-146 · T-128「动态质感章」落码②）。
 *
 * 规格正本：`art/assets-spec.md` §1.6.3（`vfx_powerup_sweep`）与 §1.6.4（`vfx_complete_wave`）；
 * 毫秒真源：`design/ux/ux-spec.md` §5「道具生效」400ms /「过关庆祝」800ms + 20ms/列。
 *
 * 本模块只放**纯函数**（进度 → 几何/幅值），不 import `cc`/DOM/`wx`、不持任何状态（L3/L5）；
 * 命令发射留在 `view-model.ts`，逐帧计时槽留在 `game/beads-game.ts`。
 *
 * G2′（§1.6.2a 解环器归位）的相 B **不在此重列落座公式** —— 规格写「逐字复用 §1.6.1」
 * ⇒ 直接调 `bead-render.ts::fillPopEnvelope`；本模块只给逐颗的**局部相位与环 α**。
 */

import {
    CONFETTI_FALL_FACTOR,
    CONFETTI_FADE_START,
    CONFETTI_GOLDEN_ANGLE,
    CONFETTI_GOLDEN_RATIO,
    CONFETTI_H,
    CONFETTI_MAIN_COUNT,
    CONFETTI_SPAWN_STEP_Y,
    CONFETTI_SPIN_TURNS,
    CONFETTI_SWAY_CYCLES,
    CONFETTI_SWAY_PX,
    CONFETTI_W,
    DENIED_PRESS_MS,
    DENIED_PRESS_SCALE_TROUGH,
    DENIED_PRESS_TROUGH_MS,
    DESIGN_H,
    DESIGN_W,
    SOLVER_HINT_MS,
    SOLVER_STAGGER_MS,
    SOLVER_PER_BEAD_MS,
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

// G2′ `vfx_solver_restore`（§1.6.2a）
// ⚠️ 总时长的**单一真源 = `tuning.solverSequenceMs`**（game 侧定计时窗口也要用它）⇒
//    本模块只放「相位 → 幅值」的纯函数，不重复那份公式（漂移先例 = §1.6.4 `lodLayers`）。

/**
 * 相 A 状态环 α：`sin(π·t/200)` ⇒ 单峰、**0 往复**（不违 D2）。
 * D1（`reduceMotion`）**不关停本相**：纯 α 通道、非形变非位移（§1.6.2a D1 行）。
 */
export function solverHintAlpha(tMs: number): number {
    if (tMs <= 0 || tMs >= SOLVER_HINT_MS) return 0;
    return Math.sin((Math.PI * tMs) / SOLVER_HINT_MS);
}

/**
 * 相 B 第 `step` 颗的**局部**落座相位 `p ∈ (0,1)`；未轮到 / 已走完 ⇒ 0。
 * `0` 兼作「未激活」哨兵（与 G1 `placeProgress`、G3/G4 同族约定 ⇒ 视图守卫 `> 0`）。
 * 拿到 `p` 后送 `bead-render.ts::fillPopEnvelope(p, reduceMotion, out)`——相 B 不重列公式。
 */
export function solverBeadProgress(tMs: number, step: number): number {
    const tau = tMs - (SOLVER_HINT_MS + SOLVER_STAGGER_MS * step);
    if (tau <= 0 || tau >= SOLVER_PER_BEAD_MS) return 0;
    return tau / SOLVER_PER_BEAD_MS;
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

// G7 `vfx_denied_press`（§1.6.7）：分段逐帧公式的正本在规格卡，**零位移/零 α/零描边/零色变**
// ⇒ 本函数只产一个 scale（clamp [0.96, 1.00]）；D1 退化环在 `view-model.ts` 消费处分支。

/**
 * 轻压包络（`assets-spec §1.6.7` 逐帧公式）：进度 `p ∈ [0,1]` → scale。
 * `t < 40ms`：`1.00 − 0.04·easeOut(t/40)`；`t ≥ 40ms`：`0.96 + 0.04·easeOut((t−40)/80)`
 * ⇒ 谷 0.96@40ms，两端恒 1.00（与 G1 同族的 ease-out 写法，不二次过冲）。
 */
export function deniedPressScale(p: number): number {
    const u = p < 0 ? 0 : p > 1 ? 1 : p;
    const t = u * DENIED_PRESS_MS;
    return t < DENIED_PRESS_TROUGH_MS
        ? 1 - (1 - DENIED_PRESS_SCALE_TROUGH) * easeOut(t / DENIED_PRESS_TROUGH_MS)
        : DENIED_PRESS_SCALE_TROUGH +
        (1 - DENIED_PRESS_SCALE_TROUGH) *
        easeOut((t - DENIED_PRESS_TROUGH_MS) / (DENIED_PRESS_MS - DENIED_PRESS_TROUGH_MS));
}

// ───────────────────────── G6 结算彩带（§1.6.6 · WXG-T-153）
//
// 零 RNG（L4）：44 枚的位置/相位/错高/层全部由 idx 黄金比派生，同输入同画面；
// 本模块只给「idx + 进度 → 几何」纯函数，颜色数组住 `palette.ts`（消费方在 view-model）。

/** idx ∈ [0,44)：黄金比均布 x = 750 × frac(idx × 0.618)（不聚不空）。 */
export function confettiBaseX(idx: number): number {
    const v = idx * CONFETTI_GOLDEN_RATIO;
    return DESIGN_W * (v - Math.floor(v));
}

/** 黄金角错相（度）：摆动相位与旋转初相同源，相邻枚不齐平。 */
export function confettiPhaseDeg(idx: number): number {
    return idx * CONFETTI_GOLDEN_ANGLE;
}

/** 五档错高（idx mod 5，规格卡原式）：起点在屏底往上阶梯分布，避免齐平运动。 */
export function confettiSpawnY(idx: number): number {
    return DESIGN_H - (idx % 5) * CONFETTI_SPAWN_STEP_Y;
}

/** idx < 36 ⇒ MAIN（面板遮罩之前）；其余 ⇒ FOREGROUND（面板之后）。 */
export function confettiIsForeground(idx: number): boolean {
    return idx >= CONFETTI_MAIN_COUNT;
}

/** 逐帧标量态（复用对象写入；命令只抄标量 ⇒ 与 `WaveState` 同判例）。 */
export interface ConfettiBeadState {
    x: number;
    y: number;
    theta: number;
    alpha: number;
}

/**
 * 逐帧（§1.6.6 公式**字面移植**）：`y = spawnY − 1334×1.15×easeIn(p)` ⇒ y 单调**递减**
 * （设计坐标 **y 向上** ⇒ 递减 = 屏面下落，目视「飘落」与卡文案一致；旧注「递减 = 上行出屏」
 * 系误按 y 向下读，**差异 2 已闭合**——用户 2026-09-17「认可」+ burst v2.1 实证，见 §1.6.6 回写注）。
 * 横向摆动 2 周期；旋转 1.25 转 ⇒ 1.25Hz < 3Hz（D2）；`p ≥ 0.7` 线性淡出防硬切。`p` 钳制 [0,1]。
 */
export function confettiFrame(
    idx: number,
    p: number,
    out: ConfettiBeadState,
): ConfettiBeadState {
    const u = p < 0 ? 0 : p > 1 ? 1 : p;
    const phase = confettiPhaseDeg(idx);
    out.x =
        confettiBaseX(idx) +
        CONFETTI_SWAY_PX *
        Math.sin(2 * Math.PI * (CONFETTI_SWAY_CYCLES * u + phase / 360));
    out.y =
        confettiSpawnY(idx) - DESIGN_H * CONFETTI_FALL_FACTOR * easeIn(u);
    out.theta = 360 * CONFETTI_SPIN_TURNS * u + phase;
    out.alpha =
        u < CONFETTI_FADE_START
            ? 1
            : Math.max(0, 1 - (u - CONFETTI_FADE_START) / (1 - CONFETTI_FADE_START));
    return out;
}

/**
 * 无旋转变换通道 ⇒ 逐帧算四角（规格卡几何式，hw=3/hh=7）。`out` 为 8-float 扁平点列，
 * `off` 指定写入段偏移（默认 0 兼容旧调用）。
 * `[v1.4·WXG-T-128 裁定 B（用户 2026-09-17）]` 支持写入**预分配 scratch 缓冲的段**：
 * 调用方传 `Float32Array(352)` + `off = idx × 8` ⇒ 44 枚各占固定 8-float 段、逐帧整段重写，
 * `polygon()` 以 subarray 视图引用（framework 契约已放宽；段在下一帧前重写安全，见契约注）。
 */
export function confettiQuad(
    cx: number,
    cy: number,
    thetaDeg: number,
    out: number[] | Float32Array,
    off = 0,
): number[] | Float32Array {
    const hw = CONFETTI_W / 2;
    const hh = CONFETTI_H / 2;
    const r = (thetaDeg * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    out[off] = cx - hw * c - hh * s;
    out[off + 1] = cy - hw * s + hh * c;
    out[off + 2] = cx + hw * c - hh * s;
    out[off + 3] = cy + hw * s + hh * c;
    out[off + 4] = cx + hw * c + hh * s;
    out[off + 5] = cy + hw * s - hh * c;
    out[off + 6] = cx - hw * c + hh * s;
    out[off + 7] = cy - hw * s - hh * c;
    return out;
}
