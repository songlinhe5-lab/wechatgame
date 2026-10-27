/**
 * ModalFrame — 弹窗基础（UI-22；`docs/architecture/ui-architecture-beads.md` §4 / §12）。
 *
 * 收口四件：**遮罩 + 纸面板 + 进出场几何 + 点击屏障**；内容区由调用方用返回的
 * {@link ModalFrameGeometry} 自绘（标题、按钮、行），本层不猜内容。
 *
 * ⛔ 视觉零漂移：进出场算式与收拢前 `drawPausePanel` **逐字同形**（验收 = 逐帧一致）；
 *    `modalFrameLayout(panel, 1)` 必须还原静止态边界（金样本十态守）。
 *
 * ⚠ 迁移期落点 = `src/view/`（与 `ui-theme.ts` 同处）；UI-25 总装时随风格层一起搬入
 *   `src/ui/kit/`，本批不提前建半迁移目录。
 */
import type { RenderModelBuilder } from '../../framework/index';
import { DESIGN_W, PANEL_SCALE_FROM } from '../config/tuning';
import type { BeadsPalette } from './palette';
import { drawPaperPanel, scrimFill } from './ui-theme';
import type { UiScrimRgb } from './ui-theme';

/** 静止态面板边界（与 `systems/*-panel` 的 `PanelRect` 同形，零转换消费）。 */
export interface ModalPanelBounds {
    readonly xMin: number;
    readonly yMin: number;
    readonly xMax: number;
    readonly yMax: number;
}

/** 缩放后面板几何（设计坐标 y-up）；内容区按 `scale` 与 `cx/cy` 同比换算。 */
export interface ModalFrameGeometry {
    readonly cx: number;
    readonly cy: number;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly scale: number;
}

/**
 * 进出场几何：绕面板中心从 `scaleFrom`（默认 `PANEL_SCALE_FROM` = 0.9）线性到 1.0。
 * `progress` 先 clamp 到 0..1（与旧实现同一上限/下限）。
 */
export function modalFrameLayout(
    panel: ModalPanelBounds,
    progress: number,
    scaleFrom = PANEL_SCALE_FROM,
): ModalFrameGeometry {
    const t = Math.max(0, Math.min(1, progress));
    const cx = (panel.xMin + panel.xMax) / 2;
    const cy = (panel.yMin + panel.yMax) / 2;
    const scale = scaleFrom + (1 - scaleFrom) * t;
    const w = (panel.xMax - panel.xMin) * scale;
    const h = (panel.yMax - panel.yMin) * scale;
    return { cx, cy, x: cx - w / 2, y: cy - h / 2, w, h, scale };
}

/**
 * `[WXG-T-443]` **面板内 → 屏幕**换算（对话框框架契约，正本 `ui-architecture-beads.md §4`）。
 *
 * 弹窗进出场把**面板**绕中心缩到 `scaleFrom`（0.9→1）；内容也必须同比缩放，⛔ 不得直接把
 * 布局里的静态坐标 / 字号交给 `builder` —— 否则面板缩了、文字绕锚点不动（真机可见：
 * 面板边缘与文字脱开）。**凡是「从 layout 静态值取的」一律过本族；由已换算的 box 派生的
 * 坐标天然正确**（如按钮文字画在 `bx + bw/2`）。
 *
 * `scale === 1` ⇒ **原值返回**（{@link frameFont} 返回**同一引用**）⇒ 静息帧零漂移、零分配，
 * 与 `RenderModelBuilder.setAlpha` 的「1 = 原样」同一条纪律。
 */
export function frameX(geo: ModalFrameGeometry, x: number): number {
    return geo.scale === 1 ? x : geo.cx + (x - geo.cx) * geo.scale;
}

/** 见 {@link frameX}。 */
export function frameY(geo: ModalFrameGeometry, y: number): number {
    return geo.scale === 1 ? y : geo.cy + (y - geo.cy) * geo.scale;
}

/** 面板内**长度**（宽 / 高 / 圆角 / 描边）→ 屏幕长度。见 {@link frameX}。 */
export function frameLen(geo: ModalFrameGeometry, v: number): number {
    return geo.scale === 1 ? v : v * geo.scale;
}

/**
 * 面板内**字号串** → 屏幕字号串（只改其中的 `NNpx`，保留 `bold` 等前缀）。
 * `scale === 1` ⇒ 返回**同一引用**（`===`，不是 `==`）⇒ 静息帧命令流逐字节不变。
 */
export function frameFont(geo: ModalFrameGeometry, font: string): string {
    if (geo.scale === 1) return font;
    return font.replace(/(\d+(?:\.\d+)?)px/, (_m, px: string) => `${Math.round(Number(px) * geo.scale * 10) / 10}px`);
}

/** 全屏遮罩；`alpha` 由调用方按档位与进度算好（设置档 = `settingsAlpha * t`）。 */
export function drawModalScrim(
    builder: RenderModelBuilder,
    rgb: UiScrimRgb,
    alpha: number,
): void {
    builder.rect(0, 0, DESIGN_W, builder.height, {
        fill: scrimFill(rgb, alpha),
    });
}

export interface ModalFrameSpec {
    /** 静止态边界（命中与布局共用；动画期不另算）。 */
    readonly panel: ModalPanelBounds;
    /** 0..1 开合进度（`ModalLifecycle` 输出；`t=1` = 静止态）。 */
    readonly progress: number;
    readonly scrimRgb: UiScrimRgb;
    /** 已含进度的遮罩 α。 */
    readonly scrimAlpha: number;
    readonly palette: BeadsPalette;
    readonly radius: number;
    readonly shadowAlpha: number;
    readonly scaleFrom?: number;
}

/** 遮罩 + 纸面板，返回内容区几何。 */
export function drawModalFrame(
    builder: RenderModelBuilder,
    spec: ModalFrameSpec,
): ModalFrameGeometry {
    const geo = modalFrameLayout(spec.panel, spec.progress, spec.scaleFrom);
    drawModalScrim(builder, spec.scrimRgb, spec.scrimAlpha);
    drawPaperPanel(builder, geo.x, geo.y, geo.w, geo.h, spec.palette, spec.radius, spec.shadowAlpha);
    return geo;
}

export type ModalHit = 'content' | 'block' | 'dismiss';

/**
 * 点击屏障：面板内 = `content`（交 Presenter 继续命中按钮）；面板外默认 `block`（吞掉）。
 * `dismissOnScrim` 打开时面板外返回 `dismiss`；本批所有弹窗**保持关闭**（暂停面板
 * 「其余零响应」口径）。命中用**静止态**边界，与 `systems/*-panel` 的命中面同源。
 */
export function modalHitTest(
    panel: ModalPanelBounds,
    x: number,
    y: number,
    dismissOnScrim = false,
): ModalHit {
    if (x >= panel.xMin && x <= panel.xMax && y >= panel.yMin && y <= panel.yMax) return 'content';
    return dismissOnScrim ? 'dismiss' : 'block';
}
