/**
 * DebugLayer — 调试层（UI-24；`docs/architecture/ui-architecture-beads.md` §4 / §12）。
 *
 * 挂在**所有路由之上**（含暂停 / 结算弹窗），两件：
 * - {@link drawPerfOverlay}：帧率 / 帧耗时窄面板。口径沿用 `pause-settings` v1.6 §2.2——
 *   半透明**窄面板**而非全屏遮罩（全屏 α 会改变 fill 负载，测量就不干净）；开关关闭零指令。
 * - {@link drawSafeGuideLines}：安全区三条标定线（顶部 / 胶囊底缘 / Home 条），对局与主菜单共用。
 *
 * 采样不在这里：EMA 单源在 `BeadsGame.sampleFrame`——对局腿由 `game.update` 喂，
 * 菜单腿由 `BeadsShell.update` 单独喂（play.update 不跑）；本层只读结果。
 *
 * ⚠ 迁移期落点 = `src/view/`；UI-25 随风格层搬 `src/ui/kit/`。
 */
import type { RenderModelBuilder } from '@wxgame/framework';
import { DESIGN_W } from '../config/tuning.js';
import { DEBUG_OUTLINE_TILE_HEX, type BeadsPalette } from './palette.js';
import { UI_FONT, UI_SCRIM, scrimFill } from './ui-theme.js';

/** 性能覆层面板几何（设计 px，贴屏顶；`top = builder.height` 动态高）。 */
const PERF_PANEL = { x: 12, dy: -148, w: 316, h: 136, radius: 12 } as const;

/**
 * 性能覆层。`enabled = false` 时零指令（金样本与正常玩法不受影响）。
 * `level` / `detail` 可为空串：菜单腿只有 `phase = 'menu'`，不画空行。
 */
export function drawPerfOverlay(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    enabled: boolean,
    frameMs: number,
    phase: string,
    level: string,
    detail: string,
): void {
    if (!enabled) return;
    const fps = frameMs > 0 ? Math.round(1000 / frameMs) : 0;
    const top = builder.height;
    builder.rect(PERF_PANEL.x, top + PERF_PANEL.dy, PERF_PANEL.w, PERF_PANEL.h, {
        fill: scrimFill(UI_SCRIM.canvas, 0.7),
        radius: PERF_PANEL.radius,
    });
    const line = (y: number, text: string): void => {
        builder.text(PERF_PANEL.x + 16, y, text, {
            fill: palette.text,
            font: UI_FONT.panelToggle,
            align: 'left',
            baseline: 'middle',
        });
    };
    line(top - 38, `fps ${fps} · ${frameMs.toFixed(1)} ms`);
    line(top - 76, level ? `${phase} · ${level}` : phase);
    if (detail) line(top - 114, detail);
}

/**
 * `[WXG-T-444]` 画一个**按钮响应区**框（Debug 开）。用途：报「点不上」时**先看框对不对**，
 * 再怀疑命中逻辑 —— 热区与绘制不同源、容差异常、钮被相邻钮抢，都会在这一层直接看见。
 *
 * 描边色用 `DEBUG_OUTLINE_TILE_HEX`（与标定线同族，⛔ 不进 `palette` 正式调色板）；
 * 线宽 2 设计 px ⇒ 真机约 1 css px，看得见又不糊满钮。只发一条 `rect`（带 `stroke` 无 `fill`），
 * 不参与任何命中判定。
 */
export function drawHitBox(
    builder: RenderModelBuilder,
    x: number,
    y: number,
    w: number,
    h: number,
): void {
    builder.rect(x, y, w, h, { stroke: DEBUG_OUTLINE_TILE_HEX, lineWidth: 2 });
}

/**
 * 安全区标定线：三条线 = 顶部安全区 / 胶囊底缘 / Home 条。入参均 = 距边的设计 px。
 * （原 `view-model::drawSafeGuideLines` 原样搬入，两屏共用同一份。）
 */
export function drawSafeGuideLines(
    builder: RenderModelBuilder,
    H: number,
    st: number,
    cap: number,
    sb: number,
): void {
    const ink = DEBUG_OUTLINE_TILE_HEX;
    const marks = [
        { y: H - st, text: `safe ${st}`, x: 16 },
        { y: H - cap, text: `cap ${cap}`, x: 280 },
        { y: sb, text: `home ${sb}`, x: 16 },
    ];
    for (const m of marks) {
        builder.line(0, m.y, DESIGN_W, m.y, ink, 3);
        const below = m.y > H * 0.5;
        builder.text(m.x, below ? m.y - 18 : m.y + 18, m.text, {
            fill: ink,
            font: UI_FONT.cell,
            align: 'left',
            baseline: 'middle',
        });
    }
}
