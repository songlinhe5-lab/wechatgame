/**
 * `[WXG-T-607]` 选关弹窗 **View**（`ui-architecture-beads §5`）；`[WXG-T-610]` 按 Figma `159:3`
 * 补齐九宫格背板 / 底部关闭按钮 / 关卡名字控件。
 *
 * 纯函数 `(builder, viewModel, palette)`：⛔ 不 import `MetaViewData` / shell / 游戏对象，
 * ⛔ 不出现 `overlay ===` / `phase ===` 导航判断，⛔ 不持有状态。所有展示数据来自
 * {@link LevelSelectViewModel}（只读）；布局 / 命中同源的格框由 VM 透传 `levelsLayout`。
 *
 * 稿层序（`159:5 抠图层`）：对话框背景 → 九宫格背板 → 九格 → 关闭按钮 → 文字。
 * 位图未注册 ⇒ 逐元素同几何程序化回退（⛔ 不做第二套版式）。
 */
import { DESIGN_H, DESIGN_W, LEVEL_DETAIL_GEO, LEVEL_DETAIL_TEXTURES, LEVEL_DETAIL_TITLE_SHADOW, LEVEL_SELECT_GEO, LEVEL_SELECT_TEXTURES, UI_CONTAINER } from '../config/tuning.js';
import { type RenderModelBuilder } from '@wxgame/framework';
import { type BeadsPalette, withAlpha } from './palette.js';
import { UI_FONT, UI_SCRIM, bodyFont, scrimFill } from './ui-theme.js';
import { drawLevelSelectCell, menuBitmapReady } from './meta-widgets.js';
import type { LevelSelectViewModel } from './level-select-view-model.js';

const GEO = LEVEL_DETAIL_GEO;
/** 木牌未位移时的下缘（设计空间 y_up）⇒ 页内锚一律按「相对木牌下缘」换算。 */
const BASE_PLATE_Y = DESIGN_H - GEO.plate.yDown - GEO.plate.h;
/** 稿面 `cyDown`（中线）→ 相对木牌下缘的偏移（逐机位移不撕裂内容带）。 */
const dyCenter = (cyDown: number): number => DESIGN_H - cyDown - BASE_PLATE_Y;
/** 稿面「下缘」→ 相对木牌下缘的偏移（`box.y` 口径）。 */
const dyBottom = (yDown: number, h: number): number => DESIGN_H - yDown - h - BASE_PLATE_Y;

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

    // `[WXG-T-610]` 九宫格背板（稿 `164:63`，506×597）：在九格之前叠，缺图不画。
    const tr = LEVEL_SELECT_GEO.tray;
    if (menuBitmapReady(LEVEL_SELECT_TEXTURES.tray)) {
        builder.blit(LEVEL_SELECT_TEXTURES.tray,
            plate.x + (tr.x - GEO.plate.x), plate.y + dyBottom(tr.yDown, tr.h), tr.w, tr.h);
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

    // `[WXG-T-610]` 关卡名字控件（稿 `159:10`，34 高、深蓝 SOLID）。
    // `[WXG-T-611]` 用户令「居中显示」⇒ 木牌中轴（title.cx=380，同标题）；稿面 84 宽槽
    // @278 左锚退场（K-053 留档）。文字由 VM 给（大关名逐页变）⇒ ⛔ 不吃稿里写死的字样位图。
    if (vm.chapter) {
        const n = LEVEL_SELECT_GEO.name;
        builder.text(plate.x + (LEVEL_SELECT_GEO.title.cx - GEO.plate.x), plate.y + dyCenter(n.yDown + n.h / 2), vm.chapter, {
            fill: n.ink, font: bodyFont(vm.largeText, 'sub'), align: 'center', baseline: 'middle',
        });
    }
    if (vm.starProgress) {
        const p = LEVEL_SELECT_GEO.progress;
        builder.text(plate.x + (p.x - GEO.plate.x), plate.y + dyCenter(p.cyDown), vm.starProgress, {
            fill: palette.plateTitleInk, font: bodyFont(vm.largeText, 'sub'), align: 'right', baseline: 'middle',
        });
    }

    // 3×3 格墙：`grid-1` 三态模板九格复用（位图就绪）；缺图 ⇒ 程序化木托盘降级腿。
    // 格框与命中同源（VM 透传 `levelsLayout` 的 `MetaButton.box`）⇒ 不重建布局。
    for (let i = 0; i < vm.cellCount; i += 1) {
        drawLevelSelectCell(builder, vm.cells[i]!, vm, palette, LEVEL_SELECT_TEXTURES.cell);
    }

    // `[WXG-T-610]` 底部关闭按钮（稿 `160:48`，301×105 @225,1028，整枚烘字）。
    // 旧右上 38² 凹槽 ✕ 随稿退场（K-053 留档）。缺图 ⇒ 同几何程序化木钮。
    const cb = LEVEL_SELECT_GEO.closeBtn;
    const bx = plate.x + (cb.x - GEO.plate.x);
    const by = plate.y + dyBottom(cb.yDown, cb.h);
    if (menuBitmapReady(LEVEL_SELECT_TEXTURES.closeBtn)) {
        builder.blit(LEVEL_SELECT_TEXTURES.closeBtn, bx, by, cb.w, cb.h);
    } else {
        builder.rect(bx, by, cb.w, cb.h, { fill: palette.woodSheen, radius: 16 });
        builder.text(bx + cb.w / 2, by + cb.h / 2, '关闭', {
            fill: palette.plateSubInk, font: UI_FONT.button, align: 'center', baseline: 'middle',
        });
    }
}
