/**
 * `[WXG-T-605]` 选关**弹窗**内容（用户 2026-11-09 令：「沿用关卡详情的面板，只是中间区域改成选关页面」）。
 *
 * 容器 = 关卡详情同款木牌（581×1044 烘图 / 纸面板回退），标题同槽同投影，右上 38² 凹槽 ✕ 同件；
 * 中间橱窗换成 3×3 格墙，橱窗下带放判星对照行。几何单源 = `config/tuning/level-select.ts`
 * （木牌 / 标题槽 / 关闭件复用 `level-detail.ts`，⛔ 不复制第二份）。
 *
 * 数据腿与旧版一致（`chapterTitle` / `arcStarGot|Need` / `wallSlots|wallLevels` / `currentLevelIndex`），
 * 零新增快照字段；缩略与格状态沿用 `drawWallCell`（与作品墙同一套）。
 */

import { DESIGN_H, DESIGN_W, LEVEL_DETAIL_GEO, LEVEL_DETAIL_TEXTURES, LEVEL_DETAIL_TITLE_SHADOW, LEVEL_SELECT_GEO, UI_CONTAINER } from '../config/tuning';
import { COPY_TOKENS } from '../config/copy-tokens';
import { type RenderModelBuilder } from '../../framework/index';
import { type BeadsPalette, withAlpha } from './palette';
import { UI_FONT, UI_SCRIM, bodyFont, scrimFill, starCriteriaText } from './ui-theme';
import { drawCloseInset, drawWoodWallCell, isPressed, menuBitmapReady } from './meta-widgets';
import { levelDetailPlate } from './meta-layout';
import type { MetaButton, MetaViewData } from './meta-types';

const GEO = LEVEL_DETAIL_GEO;
/** 木牌未位移时的下缘（设计空间 y_up）⇒ 页内常量一律按「相对木牌下缘」换算。 */
const BASE_PLATE_Y = DESIGN_H - GEO.plate.yDown - GEO.plate.h;
/** 稿面 `cyDown`（中线）→ 相对木牌下缘的偏移（逐机位移不撕裂内容带）。 */
const dyCenter = (cyDown: number): number => DESIGN_H - cyDown - BASE_PLATE_Y;

export function drawLevelsPage(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    buttons: readonly MetaButton[],
    thumbN: number,
    screenH: number,
): void {
    const plate = levelDetailPlate();

    // 遮罩：与详情同档（叠在主菜单底页上）。
    builder.rect(0, 0, DESIGN_W, screenH, { fill: scrimFill(UI_SCRIM.overlay, UI_SCRIM.alpha) });

    // 容器：木牌烘图 / 纸面板回退（同几何）。
    if (menuBitmapReady(LEVEL_DETAIL_TEXTURES.plaque)) {
        builder.blit(LEVEL_DETAIL_TEXTURES.plaque, plate.x, plate.y, plate.w, plate.h);
    } else {
        builder.rect(plate.x, plate.y, plate.w, plate.h, { fill: palette.panel, radius: UI_CONTAINER.radiusPanel });
    }

    // 板标题「选关」：同槽同投影（暖金 + 深棕 DROP_SHADOW）。
    const t = LEVEL_SELECT_GEO.title;
    builder.text(plate.x + (t.cx - GEO.plate.x), plate.y + dyCenter(t.cyDown), COPY_TOKENS.btn_levels_label, {
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

    // 章名 + 星进度（同行）：木面上用深墨（`plateTitleInk`）保证对比。
    const c = LEVEL_SELECT_GEO.chapter;
    if (data.chapterTitle) {
        builder.text(plate.x + (c.cx - GEO.plate.x), plate.y + dyCenter(c.cyDown), data.chapterTitle, {
            fill: palette.plateTitleInk,
            font: UI_FONT.button,
            align: 'center',
            baseline: 'middle',
        });
    }
    if (data.arcStarNeed !== undefined) {
        const p = LEVEL_SELECT_GEO.progress;
        builder.text(plate.x + (p.x - GEO.plate.x), plate.y + dyCenter(p.cyDown), `★ ${data.arcStarGot ?? 0}/${data.arcStarNeed}`, {
            fill: palette.plateTitleInk,
            font: bodyFont(data.largeText, 'sub'),
            align: 'right',
            baseline: 'middle',
        });
    }

    // 判星对照行：与结算面板共读 `starCriteriaText`；取不到当前关 ⇒ 整行不画（⛔ 占位）。
    const curSlot = data.wallSlots.indexOf(data.currentLevelIndex);
    const curLevel = curSlot < 0 ? undefined : data.wallLevels[curSlot];
    if (curLevel !== undefined) {
        const k = LEVEL_SELECT_GEO.criteria;
        builder.text(plate.x + (k.cx - GEO.plate.x), plate.y + dyCenter(k.cyDown), starCriteriaText(curLevel.time, curLevel.starTierK), {
            fill: palette.plateTitleInk,
            font: bodyFont(data.largeText, 'sub'),
            align: 'center',
            baseline: 'middle',
        });
    }

    // 九宫格木托盘（`[WXG-T-606]`）：先铺托盘底板，再逐格画凹槽 ⇒ 九格读成一体。
    const g = LEVEL_SELECT_GEO.grid;
    const st = LEVEL_SELECT_GEO.gridStyle;
    const gridW = 3 * g.cell + 2 * g.gap;
    const gridTop = plate.y + (g.topUp - BASE_PLATE_Y);
    builder.rect(g.left - st.trayPad, gridTop - gridW - st.trayPad, gridW + st.trayPad * 2, gridW + st.trayPad * 2, {
        fill: withAlpha(palette.woodSheen, 0.3),
        stroke: withAlpha(palette.shadowInk, 0.35),
        lineWidth: 1,
        radius: st.trayRadius,
    });

    // 3×3 格墙：几何走 `levelsLayout` 的钮表（绘制与命中同源，⛔ 本块不重建 layout）。
    for (const b of buttons) {
        if (b.id === 'pick-level') drawWoodWallCell(builder, b, data, palette, thumbN);
    }

    // 右上凹槽 ✕：与详情同一件（视觉 38² / 热区另表）。
    const cl = GEO.close;
    drawCloseInset(
        builder,
        palette,
        plate.x + (cl.cx - GEO.plate.x),
        plate.y + dyCenter(cl.cyDown),
        cl.w,
        cl.h,
        cl.arm,
        isPressed(data, 'close-levels'),
    );
}
