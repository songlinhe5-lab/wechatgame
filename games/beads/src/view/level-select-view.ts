/**
 * `[WXG-T-607]` 选关弹窗 **View**（`ui-architecture-beads §5`）。
 *
 * 纯函数 `(builder, viewModel, palette)`：⛔ 不 import `MetaViewData` / shell / 游戏对象，
 * ⛔ 不出现 `overlay ===` / `phase ===` 导航判断，⛔ 不持有状态。所有展示数据来自
 * {@link LevelSelectViewModel}（只读）；布局 / 命中同源的格框由 VM 透传 `levelsLayout`。
 *
 * 容器 = 关卡详情同款木牌位图（用户令「复用关卡详情页的对话框背景图」）；
 * 九宫格 = Figma `159:3` page 的 `176:19 grid-1` 模板层（`185:36` 木纹底）九格复用，
 * 编号 / 缩略 / 星级 / 锁 / 当前关全部数据驱动；纹理未注册 ⇒ 程序化木托盘降级腿。
 */
import { DESIGN_H, DESIGN_W, LEVEL_DETAIL_GEO, LEVEL_DETAIL_TEXTURES, LEVEL_DETAIL_TITLE_SHADOW, LEVEL_SELECT_GEO, LEVEL_SELECT_TEXTURES, UI_CONTAINER } from '../config/tuning.js';
import { type RenderModelBuilder } from '@wxgame/framework';
import { type BeadsPalette, withAlpha } from './palette.js';
import { UI_FONT, UI_SCRIM, bodyFont, scrimFill } from './ui-theme.js';
import { drawCloseInset, drawLevelSelectCell, menuBitmapReady } from './meta-widgets.js';
import type { LevelSelectViewModel } from './level-select-view-model.js';

const GEO = LEVEL_DETAIL_GEO;
/** 木牌未位移时的下缘（设计空间 y_up）⇒ 页内锚一律按「相对木牌下缘」换算。 */
const BASE_PLATE_Y = DESIGN_H - GEO.plate.yDown - GEO.plate.h;
/** 稿面 `cyDown`（中线）→ 相对木牌下缘的偏移（逐机位移不撕裂内容带）。 */
const dyCenter = (cyDown: number): number => DESIGN_H - cyDown - BASE_PLATE_Y;

export function drawLevelsView(
    builder: RenderModelBuilder,
    vm: LevelSelectViewModel,
    palette: BeadsPalette,
): void {
    const plate = vm.plate;

    // 遮罩：与详情同档（叠在主菜单底页上）。
    builder.rect(0, 0, DESIGN_W, vm.screenH, { fill: scrimFill(UI_SCRIM.overlay, UI_SCRIM.alpha) });

    // 容器：复用关卡详情对话框背景图 / 纸面板回退（同几何）。
    if (menuBitmapReady(LEVEL_DETAIL_TEXTURES.plaque)) {
        builder.blit(LEVEL_DETAIL_TEXTURES.plaque, plate.x, plate.y, plate.w, plate.h);
    } else {
        builder.rect(plate.x, plate.y, plate.w, plate.h, { fill: palette.panel, radius: UI_CONTAINER.radiusPanel });
    }

    // 板标题「选关」：同槽同投影（暖金 + 深棕 DROP_SHADOW）。
    const t = LEVEL_SELECT_GEO.title;
    builder.text(plate.x + (t.cx - GEO.plate.x), plate.y + dyCenter(t.cyDown), vm.title, {
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

    // 章名 + 星进度（同行）：木面上用深墨保证对比。
    const c = LEVEL_SELECT_GEO.chapter;
    if (vm.chapter) {
        builder.text(plate.x + (c.cx - GEO.plate.x), plate.y + dyCenter(c.cyDown), vm.chapter, {
            fill: palette.plateTitleInk, font: UI_FONT.button, align: 'center', baseline: 'middle',
        });
    }
    if (vm.starProgress) {
        const p = LEVEL_SELECT_GEO.progress;
        builder.text(plate.x + (p.x - GEO.plate.x), plate.y + dyCenter(p.cyDown), vm.starProgress, {
            fill: palette.plateTitleInk, font: bodyFont(vm.largeText, 'sub'), align: 'right', baseline: 'middle',
        });
    }

    // 3×3 格墙：`grid-1` 模板九格复用（位图就绪）；缺图 ⇒ 程序化木托盘降级腿。
    // 格框与命中同源（VM 透传 `levelsLayout` 的 `MetaButton.box`）⇒ 不重建布局。
    for (let i = 0; i < vm.cellCount; i += 1) {
        drawLevelSelectCell(builder, vm.cells[i]!, vm, palette, LEVEL_SELECT_TEXTURES.cell);
    }

    // 右上凹槽 ✕：与详情同一件（视觉 38² / 热区另表）。
    const cl = GEO.close;
    drawCloseInset(
        builder, palette,
        plate.x + (cl.cx - GEO.plate.x), plate.y + dyCenter(cl.cyDown),
        cl.w, cl.h, cl.arm, vm.closePressed,
    );
}
