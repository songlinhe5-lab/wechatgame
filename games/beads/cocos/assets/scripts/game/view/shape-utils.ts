/**
 * 程序化多边形原语（UI-41）：`starPoints` 被对局页（魔法棒图标）与结算面板（星级行）共用，
 * `arcPoints` 被道具磁铁图标使用。独立成件，避免 `view-model` ⇄ `play-page` 循环依赖。
 * 纯函数、零分配约束与搬迁前逐字一致。
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
