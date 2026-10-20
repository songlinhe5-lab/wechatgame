/**
 * 通用按钮控件（UI-21；`docs/architecture/ui-architecture-beads.md` §4「通用控件」）。
 *
 * 合并原 `view-model::drawWoodButton` 与 `meta-view::drawButton`，并收口暂停 / 失败 /
 * 过关三处手写的纸次钮。**四族外观各自逐字保留**，本层只统一入口与默认字色：
 *
 * - `wood`  = T3/T4 木钮：面 + 顶缘受光线（可关）+ 底缘承重线 + 木色字；
 * - `accent` = 菜单主钮：accent 面 + 同色 2px 描边 + 面板色字（按下换 `woodFacePressed`）；
 * - `ghost`  = 菜单次钮：槽面 + `slotBorder` 2px 描边；
 * - `paper`  = T1 纸次钮：纸面 + `panelBorder` 1px 描边。
 *
 * 热路径零分配：全位置参数，不建 spec 对象（与收拢前同口径）。
 * ⛔ 迁移期落 `src/view/`；UI-25 总装时随 `ui-theme` / `modal-frame` 一起搬 `src/ui/kit/`。
 */
import type { RenderModelBuilder } from '@wxgame/framework';
import { UI_CONTAINER } from '../config/tuning.js';
import type { BeadsPalette } from './palette.js';
import { UI_FONT } from './ui-theme.js';

export type ButtonTone = 'wood' | 'accent' | 'ghost' | 'paper';

/**
 * 画一枚按钮（含文案；`label` 省略 = 只画面，图标钮自绘内容）。
 *
 * @param radius 四族各自传本族圆角（木钮 `radiusWood` / 菜单 14 / 纸钮 `radiusCard`）。
 * @param font   省略按族取默认：`wood`/`paper` = `panelButton`，其余 = `button`。
 * @param sheen  仅 `wood`：顶缘受光线，默认开；T4 木钮传 `false`。
 */
export function drawButton(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    x: number,
    y: number,
    w: number,
    h: number,
    tone: ButtonTone,
    radius: number,
    label?: string,
    font?: string,
    pressed = false,
    disabled = false,
    sheen = true,
): void {
    if (tone === 'wood') {
        // 按下态：面换 `woodFacePressed`、受光线隐去；下沉位移由调用方给 y。
        builder.rect(x, y, w, h, { fill: pressed ? palette.woodFacePressed : palette.woodFace, radius });
        if (sheen && !pressed) {
            // 顶缘受光线：y-up ⇒ 顶 = y+h。
            builder.line(
                x + 3, y + h - UI_CONTAINER.strokeSheen / 2,
                x + w - 3, y + h - UI_CONTAINER.strokeSheen / 2,
                palette.woodSheen, UI_CONTAINER.strokeSheen,
            );
        }
        // 底缘承重线：y-up ⇒ 底 = y。
        builder.line(
            x + 3, y + UI_CONTAINER.strokeWoodEdge / 2,
            x + w - 3, y + UI_CONTAINER.strokeWoodEdge / 2,
            palette.woodEdge, UI_CONTAINER.strokeWoodEdge,
        );
        if (label) {
            builder.text(x + w / 2, y + h / 2, label, {
                fill: palette.woodText,
                font: font ?? UI_FONT.panelButton,
                align: 'center',
                baseline: 'middle',
            });
        }
        return;
    }

    if (tone === 'paper') {
        builder.rect(x, y, w, h, {
            fill: pressed ? palette.cardPressed : palette.panel,
            stroke: palette.panelBorder,
            lineWidth: UI_CONTAINER.strokePanel,
            radius,
        });
        if (label) {
            builder.text(x + w / 2, y + h / 2, label, {
                fill: palette.text,
                font: font ?? UI_FONT.panelButton,
                align: 'center',
                baseline: 'middle',
            });
        }
        return;
    }

    // 菜单主钮 / 次钮：同构（2px 描边 + 实心字），只差面、描边与字色。
    const accent = tone === 'accent';
    builder.rect(x, y, w, h, {
        fill: accent
            ? (pressed ? palette.woodFacePressed : palette.accentPrimary)
            : pressed ? palette.cardPressed : palette.slot,
        stroke: accent ? palette.accentPrimary : palette.slotBorder,
        lineWidth: 2,
        radius,
        ...(disabled ? { alpha: 0.5 } : {}),
    });
    if (label) {
        builder.text(x + w / 2, y + h / 2, label, {
            fill: accent ? palette.panel : palette.text,
            font: font ?? UI_FONT.button,
            align: 'center',
            baseline: 'middle',
        });
    }
}

/**
 * 虚线矩形（RenderModel 无 dash 笔 ⇒ 合成 6/4 线段）。
 * 托盘未解锁行与全通关面板的未过关格共用（UI-41 起从 `view-model` 抽出）。
 */
export function drawDashedRect(
    builder: RenderModelBuilder,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
): void {
    const dash = 6;
    const gap = 4;
    const period = dash + gap;
    // Top & bottom edges.
    for (let px = 0; px < w; px += period) {
        const len = Math.min(dash, w - px);
        builder.line(x + px, y, x + px + len, y, color, 1);
        builder.line(x + px, y + h, x + px + len, y + h, color, 1);
    }
    // Left & right edges.
    for (let py = 0; py < h; py += period) {
        const len = Math.min(dash, h - py);
        builder.line(x, y + py, x, y + py + len, color, 1);
        builder.line(x + w, y + py, x + w, y + py + len, color, 1);
    }
}
