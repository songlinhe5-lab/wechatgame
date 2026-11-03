/**
 * `[WXG-T-567 2026-11-03 拆分 Step 2]` mask-field.ts → mask-geometry.ts。
 *
 * 逐字复制原始 mask-field.ts L47-111（纯数学 + 光照场函数）。
 * 所有函数声明逐字复制，避免循环 import（模块解耦比 DRY 更重要）。
 */

// ─── 基础数学工具（逐字复制） ───────────────────────────────────────────

export function clamp01(v: number): number {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** C `(int)` = 向零截断。 */
export function cInt(v: number): number {
    return Math.trunc(v);
}

/** Python `round()` = 银行家舍入（half-to-even）；`rounded_rectangle` 的坐标预处理。 */
export function pyround(v: number): number {
    const f = Math.floor(v);
    const diff = v - f;
    if (diff > 0.5) return f + 1;
    if (diff < 0.5) return f;
    return f % 2 === 0 ? f : f + 1;
}

/** `Draw.c`: `ROUND_UP(f) = (int)(f >= 0 ? f + 0.5 : f - 0.5)`。 */
export function roundUp(v: number): number {
    return cInt(v >= 0 ? v + 0.5 : v - 0.5);
}

/** `Draw.c`: `ROUND_DOWN(f) = (int)(f >= 0 ? ceil(f - 0.5) : -ceil(|f| - 0.5))`。 */
export function roundDown(v: number): number {
    return v >= 0 ? Math.ceil(v - 0.5) : -Math.ceil(Math.abs(v) - 0.5);
}

/** 定稿 py 的 `int(v * 255)`（向零截断）+ CLIP8。 */
export function to8(v: number): number {
    const t = cInt(v * 255);
    return t < 0 ? 0 : t > 255 ? 255 : t;
}

// ─── 光照场（承定稿 py：`light_map` / `facet_light` / `UP_W`） ─────────────

/** 连续受光系数 0..1：余弦，峰 = 图像左上（`atan2` 的 y 向下 ⇒ 峰角 225°）。 */
export function cosineLight(dx: number, dy: number): number {
    return 0.5 + 0.5 * Math.cos(Math.atan2(dy, dx) - (225 * Math.PI) / 180);
}

/**
 * 外框用的**左/右扇隶属度** —— 与定稿 py 的 `_left_w` / `_right_w` **同式直算**
 * （facet-4 同构亮度场：上 1.0 / 右 0.74 / 下 0.37 / 左 0，方向权重 `×2` 后 clip 到 0..1）。
 *
 * ⚠ **⛔ 不可写成 `1 − up − right − down`（四扇补集）**：四扇权重之和并不恒为 1，在**对角线 45°**
 * 上三扇全为 0 ⇒ 补集式会给出 `left = 1`，而 py 的直算式给出 0。外框恰好在这条对角线上取值
 * （四个圆角的 45° 点）⇒ 用补集式会把外框 d 从 0.42 抬到 0.63，实测在 128 产物上造成
 * 四角弧各约 900 像素、R 通道 Δ 最大 57（已实测复现并修正）。
 */
export function frameSideWeights(dx: number, dy: number): { left: number; right: number } {
    const r = Math.sqrt(dx * dx + dy * dy) + 1e-6;
    const ux = dx / r;
    const uy = dy / r;
    return {
        left: clamp01((-ux - Math.abs(uy)) * 2),
        right: clamp01((ux - Math.abs(uy)) * 2),
    };
}

/** 上扇隶属度 `UP_W`（外框受光提亮用；⛔ 不用余弦 —— 见定稿 py 注：正上 0.85 与本体 0.38 差 0.06 = 接缝台阶）。 */
export function upMembership(dx: number, dy: number): number {
    const r = Math.sqrt(dx * dx + dy * dy) + 1e-6;
    return clamp01((-dy / r - Math.abs(dx / r)) * 2);
}
