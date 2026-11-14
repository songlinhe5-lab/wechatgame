/**
 * `[WXG-T-935]` 设置弹窗**装配门面**（`ui-architecture-beads §5` Presenter→View 边界）。
 *
 * 用户令：设置对话框底板与关卡详情页 / 选关页**共用同一块木牌**；内容按钮单列 cell 列表，
 * 超过中间可视窗高度 ⇒ 作为滚动控件上下滚动。
 *
 * 几何单源 = `view/settings-content.ts`（`SETTINGS_GRID` / `settingsContentViewport`）；
 * 底板 = `meta-layout::levelDetailPlate`（581×1044，底缘距屏底 124，逐机只叠 `dialogShiftY`）；
 * 遮罩 / 木牌位图 = `meta-widgets::drawModalPlate`（与详情 / 选关同一绘制腿）。
 *
 * `[ADR-0037]` 滚动列表用 `builder.clip` 逐容器裁切（容器内的裁切子树 + 后置层）：
 * 拖动时半行 cell 照样画、只按窗矩形裁像素 ⇒ 不再需要「整行完整才画」。
 * ⛔ 容器外仍禁止 `builder.clip`（全局 clipHost 会把位图挂到容器外，ADR-0033）。
 */
import { DESIGN_H, LEVEL_DETAIL_GEO, LEVEL_DETAIL_TITLE_SHADOW } from '../config/tuning.js';
import { type RenderModelBuilder } from '@wxgame/framework';
import { withAlpha, type BeadsPalette } from './palette.js';
import { UI_FONT, UI_SCRIM, pressOffset } from './ui-theme.js';
import { drawCloseInset, drawModalPlate, label } from './meta-widgets.js';
import { levelDetailPlate, settingsViewport } from './meta-layout.js';
import {
    drawSettingsAbout,
    drawSettingsContent,
    drawSettingsScrollbar,
    drawSettingsWoodButton,
    isSettingsAction,
} from './settings-content.js';
import { COPY_TOKENS } from '../config/copy-tokens.js';
import type { MetaLayout, MetaViewData } from './meta-types.js';

const GEO = LEVEL_DETAIL_GEO;
/** 木牌未位移时的下缘（设计空间 y_up）⇒ 标题锚按「相对木牌下缘」换算。 */
const BASE_PLATE_Y = DESIGN_H - GEO.plate.yDown - GEO.plate.h;
/** 板标题槽中线（稿 `cyDown 278`）相对木牌下缘的偏移。 */
const TITLE_DY = DESIGN_H - GEO.title.cyDown - BASE_PLATE_Y;
/** 右上 ✕ 槽中线（稿 `cyDown 213`）相对木牌下缘的偏移。 */
const CLOSE_DY = DESIGN_H - GEO.close.cyDown - BASE_PLATE_Y;

export function drawSettingsPage(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    layout: MetaLayout,
    screenH: number,
): void {
    const plate = levelDetailPlate();

    // 遮罩 + 木牌容器：设置沿用自家 0.3 遮罩（`[WXG-T-935]` 只换底板，不换遮罩档）。
    drawModalPlate(builder, palette, plate, screenH, UI_SCRIM.settingsAlpha);

    // 板标题「设置」：与详情 / 选关同槽同投影（暖金 + 深棕 DROP_SHADOW）。
    builder.text(plate.x + (GEO.title.cx - GEO.plate.x), plate.y + TITLE_DY, COPY_TOKENS.btn_settings_label, {
        fill: palette.plateSubInk,
        font: UI_FONT.detailTitle,
        align: 'center',
        baseline: 'middle',
        shadow: {
            color: withAlpha(palette.plateTitleInk, LEVEL_DETAIL_TITLE_SHADOW.alpha),
            offsetX: LEVEL_DETAIL_TITLE_SHADOW.dx,
            offsetY: -LEVEL_DETAIL_TITLE_SHADOW.dyDown,
            blur: LEVEL_DETAIL_TITLE_SHADOW.blur,
        },
    });

    // 中间可视窗：内容块（滚动 + 逐容器裁切）→ 滚动条（内容超窗才画，裁切外）。
    const scroll = data.settingsScroll ?? 0;
    const viewport = settingsViewport();
    builder.clip(viewport.x, viewport.y, viewport.w, viewport.h);
    drawSettingsContent(builder, data, palette, layout.buttons, scroll, viewport);
    builder.unclip();
    drawSettingsScrollbar(builder, palette, viewport, scroll);

    // 固定 chrome：仅在线导入（调试入口，宿主配了服务地址才画；不随内容滚动）。
    // `[WXG-T-935]` 底部「返回」已删（Figma 设置页 2026-11-14）：关闭 = 右上 ✕ / 点木牌外。
    for (const b of layout.buttons) {
        if (isSettingsAction(b.id)) continue;
        if (b.id === 'close-settings' || b.id === 'dismiss-settings') continue;
        if (b.id === 'studio-import' && !data.studioEnabled) continue;
        const pressed = data.pressed === b;
        const by = b.box.y + pressOffset(pressed, data.reduceMotion);
        drawSettingsWoodButton(
            builder,
            palette,
            b.box.x,
            by,
            b.box.w,
            b.box.h,
            label(b.id, data),
            UI_FONT.button,
            pressed,
        );
    }

    // `[WXG-T-936]` 右上 ✕：与关卡详情 / 选关共用 `drawCloseInset` 画法与槽位。
    const cl = GEO.close;
    drawCloseInset(
        builder,
        palette,
        plate.x + (cl.cx - GEO.plate.x),
        plate.y + CLOSE_DY,
        cl.w,
        cl.h,
        cl.arm,
        data.pressed?.id === 'close-settings',
    );

    // 页脚「关于 · 版本」= 版本号唯一落点（只读、无热区）。
    drawSettingsAbout(builder, palette, plate);
}
