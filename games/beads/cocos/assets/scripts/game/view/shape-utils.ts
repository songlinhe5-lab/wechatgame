/**
 * 程序化多边形原语（UI-41）：`starPoints` 被对局页（魔法棒图标）、结算面板（星级行）与
 * 通关画面（逐关星）共用，`arcPoints` 被道具磁铁图标使用。独立成件，避免
 * `view-model` ⇄ `play-page` 循环依赖。
 *
 * `[WXG-T-947]` 热路径（结算面板每颗星 4 层）改用 {@link starPointsInto} 写入预分配
 * `Float32Array`，⛔ 不再每层新建数组；`starPoints` 保留给低频调用点。
 */

/** Points along a circular arc (design space, y grows upward). */
export function arcPoints(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): number[] {
    const steps = 10;
    const points: number[] = [];
    for (let i = 0; i <= steps; i++) {
        const deg = fromDeg + ((toDeg - fromDeg) * i) / steps;
        const rad = (deg * Math.PI) / 180;
        points.push(cx + r * Math.cos(rad), cy + r * Math.sin(rad));
    }
    return points;
}

/** Regular n-point star polygon, first point at `startDeg`. */
export function starPoints(
    cx: number,
    cy: number,
    r: number,
    points: number,
    startDeg: number,
): number[] {
    const coords: number[] = [];
    for (let i = 0; i < points * 2; i++) {
        const rad = ((startDeg + (i * 180) / points) * Math.PI) / 180;
        const radius = i % 2 === 0 ? r : r * 0.382; // 五角星内接半径比
        coords.push(cx + radius * Math.cos(rad), cy + radius * Math.sin(rad));
    }
    return coords;
}

/**
 * `[WXG-T-947]` 与 {@link starPoints} 同形，但写进调用方预分配的 `out`（长度 ≥ points×2）
 * ⇒ 热路径零分配。⚠ 用 `number[]` 而非 `Float32Array`：`RenderModel.vertices` 是
 * **Float64Array**，走 f32 scratch 会先把顶点降精度、改变金样本 sha；`number[]` 保持
 * double 精度 ⇒ 与旧写法逐字节同值。`RenderModelBuilder.polygon` 建令当刻即拷进
 * 帧内 arena（ADR-0024），因此同一 scratch 可连续复用于多层星形。
 */
export function starPointsInto(
    out: number[],
    cx: number,
    cy: number,
    r: number,
    points: number,
    startDeg: number,
): number[] {
    for (let i = 0; i < points * 2; i++) {
        const rad = ((startDeg + (i * 180) / points) * Math.PI) / 180;
        const radius = i % 2 === 0 ? r : r * 0.382;
        out[i * 2] = cx + radius * Math.cos(rad);
        out[i * 2 + 1] = cy + radius * Math.sin(rad);
    }
    return out;
}
