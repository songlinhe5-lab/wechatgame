/**
 * DebugLayer — 调试层（UI-24；`docs/architecture/ui-architecture-beads.md` §4 / §12）。
 *
 * 挂在**所有路由之上**（含暂停 / 结算弹窗），两件：
 * - {@link drawPerfOverlay}：帧率 / 帧耗时窄面板。口径沿用 `pause-settings` v1.6 §2.2——
 *   半透明**窄面板**而非全屏遮罩（全屏 α 会改变 fill 负载，测量就不干净）；开关关闭零指令。
 * - {@link drawSafeGuideLines}：安全区三条标定线（顶部 / 胶囊底缘 / Home 条），对局与主菜单共用。
 *
 * 采样不在这里：EMA 单源在 `BeadsGame`（`[WXG-T-1108]` 口径 = 宿主壁钟的
 * 渲染帧间隔，由 `BeadsShell.buildRenderModel` 每渲染帧喂一次）；本层只读结果。
 * `[WXG-T-1110]` 第四行「绘 X ms · N 次」同理只读：数来自 `App.onRender` 的计时
 * 投影（`GameServices.readDrawCost`），游戏侧不自己量。
 *
 * ⚠ 迁移期落点 = `src/view/`；UI-25 随风格层搬 `src/ui/kit/`。
 */
import type { DrawCostBreakdown, RenderModelBuilder } from '../../framework/index';
import { DESIGN_W } from '../config/tuning';
import { DEBUG_OUTLINE_TILE_HEX, type BeadsPalette } from './palette';
import { UI_DEBUG_HIT_FILL, UI_FONT, UI_SCRIM, scrimFill } from './ui-theme';

/**
 * 性能覆层面板几何（设计 px，贴屏顶；`top = builder.height` 动态高）。
 *
 * `[WXG-T-1110]` 三行 → 四行（绘制成本行）：面板 136 → 174、`dy` −148 → −186；
 * `[WXG-T-1111]` 四行 → 五行（分段行）：174 → 212、`dy` −186 → −224；
 * `[WXG-T-1113]` 五行 → 六行（探针行 tick/引）：面板随行数以 38 递增（`rows` 计数）。
 * 行距恒 38，
 * `⛔` 别改小——22px 字号下 38 是「两行不粘」的下限（黄金比 1.7）。细分行只在
 * 宿主真的回投分段时间时出现（全 0 ⇒ 未接线，不画空白槽）。
 */
const PERF_PANEL = { x: 12, w: 316, radius: 12 } as const;
const PERF_ROW_GAP = 38;

/**
 * 性能覆层。`enabled = false` 时零指令（金样本与正常玩法不受影响）。
 * `level` / `detail` 可为空串：菜单腿只有 `phase = 'menu'`，不画空行。
 * `drawMs = 0`（未接线 / 首帧前）时不出绘制成本行 —— 该行按需追加，不占空槽。
 */
export function drawPerfOverlay(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    enabled: boolean,
    frameMs: number,
    phase: string,
    level: string,
    detail: string,
    drawMs = 0,
    paintCalls = 0,
    commands = 0,
    breakdown: DrawCostBreakdown | null = null,
    tickMs = 0,
    engineDrawMs = 0,
    idleMs = 0,
): void {
    if (!enabled) return;
    const fps = frameMs > 0 ? Math.round(1000 / frameMs) : 0;
    const top = builder.height;
    // `[WXG-T-1111]` 分段行存在与否决定面板高度；四段全 0 = 宿主没回投 ⇒ 不画空槽。
    const segmented = drawMs > 0 && breakdown !== null
        && breakdown.vectorMs + breakdown.blitMs + breakdown.textMs + breakdown.scopeMs > 0;
    // `[WXG-T-1113]` 探针行：tick 段 / 引擎渲染段任一非 0 才画（未接线不占空槽）。
    const probed = tickMs > 0 || engineDrawMs > 0;
    const rows = 5 + (segmented ? 1 : 0) + (probed ? 1 : 0);
    const panelDy = -(PERF_ROW_GAP * rows - 4);
    const panelH = PERF_ROW_GAP * rows - 16;
    builder.rect(PERF_PANEL.x, top + panelDy, PERF_PANEL.w, panelH, {
        fill: scrimFill(UI_SCRIM.canvas, 0.7),
        radius: PERF_PANEL.radius,
    });
    const line = (y: number, text: string): void => {
        builder.text(PERF_PANEL.x + 16, y, text, {
            // 面板底 = 画布遮罩 rgba(42,46,67,0.7)；`palette.text` 同值 ⇒ 深底深字看不见。
            // 用深底专用米白 `bannerText`（#FDF6E9），与遮罩对比 ≈ 9:1。
            fill: palette.bannerText,
            font: UI_FONT.panelToggle,
            align: 'left',
            baseline: 'middle',
        });
    };
    // 逐行下移 38：空行不占槽（否则菜单腿会出现一段空白）。
    let y = top - PERF_ROW_GAP;
    line(y, `fps ${fps} · ${frameMs.toFixed(1)} ms`);
    y -= PERF_ROW_GAP;
    line(y, level ? `${phase} · ${level}` : phase);
    if (detail) {
        y -= PERF_ROW_GAP;
        line(y, detail);
    }
    if (drawMs > 0) {
        y -= PERF_ROW_GAP;
        // `[WXG-T-1110]` 判读口径：`绘` 与 `fps` 的 ms 一升一降才叫「宿主变慢」；
        // 两者同升 ⇒ 这一帧是**我们画慢的**（几何/上传），才轮到批处理或缓存腿。
        line(y, `绘 ${drawMs.toFixed(1)}ms · ${paintCalls}笔/${commands}令`);
    }
    if (segmented) {
        y -= PERF_ROW_GAP;
        const b = breakdown!;
        // `[WXG-T-1111]` 四段同帧读数（⛔ 不做 EMA）：一眼看出 22.8ms 落在哪条腿。
        line(y, `矢 ${b.vectorMs.toFixed(1)} 位 ${b.blitMs.toFixed(1)} 文 ${b.textMs.toFixed(1)} 余 ${b.scopeMs.toFixed(1)}ms`);
    }
    if (probed) {
        y -= PERF_ROW_GAP;
        // `[WXG-T-1113/1114]` 判读口径：`帧 ≈ tick + 引 + 空`（三者相位不重叠）。
        // `tick` 大 ⇒ 瓶颈在我们的固定步/建模/onRender（看分段行）；`引` 大 ⇒ 引擎渲染段
        // （batcher 提交 / mesh 上传）；`空` 大 ⇒ 该段 JS 不执行，GPU/present 反压或宿主
        // 调度推迟 rAF（顶点量超 GPU 吞吐的指纹）。`空` 未量到时不画（不误导成 0）。
        const probe = [`tick ${tickMs.toFixed(1)}`, `引 ${engineDrawMs.toFixed(1)}`];
        if (idleMs > 0) probe.push(`空 ${idleMs.toFixed(1)}`);
        line(y, `${probe.join(' ')}ms`);
    }
}

/**
 * `[WXG-T-444]` 画一个**按钮响应区**框（Debug 开）。用途：报「点不上」时**先看框对不对**，
 * 再怀疑命中逻辑 —— 热区与绘制不同源、容差异常、钮被相邻钮抢，都会在这一层直接看见。
 *
 * 描边色用 `DEBUG_OUTLINE_TILE_HEX`（与标定线同族，⛔ 不进 `palette` 正式调色板）；
 * 线宽 2 设计 px ⇒ 真机约 1 css px，看得见又不糊满钮。不参与任何命中判定。
 *
 * `[WXG-T-449]` 加**半透明填充**（`UI_DEBUG_HIT_FILL`）：只描边时，热区与视觉框（底部一行
 * 上沿差 2、下沿差 32）几乎重合，看不出「多出来的一截」；填一层 14% 品红后，热区覆盖范围
 * 一眼可辨，且仍能看清底下的按钮本身（α 低，不遮字）。⛔ 不要改成实色填充。
 */
export function drawHitBox(
    builder: RenderModelBuilder,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string = UI_DEBUG_HIT_FILL,
): void {
    builder.rect(x, y, w, h, { stroke: DEBUG_OUTLINE_TILE_HEX, lineWidth: 2, fill });
}

/**
 * `[WXG-T-445]` **触点探针**：把「游戏认为你点在哪」画出来（十字 + 圆环 + 命中的钮 id）。
 *
 * 用于把「按钮边内点不上」这类**感觉**变成读数：探针十字与手指实际位置重合 ⇒ 热区/命中逻辑问题；
 * 十字整体偏移（越靠边偏得越多）⇒ 手指→设计坐标换算问题（`Viewport.screenToDesign` / 宿主归一化），
 * ⛔ 不该去改热区。与 `bindings` 的 `__WXG_TOUCH_DEBUG` 同口径，但走统一渲染层 ⇒ 三宿主都能看。
 */
export function drawTapTrace(
    builder: RenderModelBuilder,
    x: number,
    y: number,
    label: string,
    ink: string,
    font: string,
): void {
    const r = 26;
    builder.line(x - r, y, x + r, y, ink, 3);
    builder.line(x, y - r, x, y + r, ink, 3);
    builder.circle(x, y, r * 0.55, { stroke: ink, lineWidth: 3 });
    builder.text(x + r + 6, y + r, label, {
        fill: ink,
        font,
        align: 'left',
        baseline: 'middle',
    });
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
