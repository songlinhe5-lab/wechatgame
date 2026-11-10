/**
 * `[WXG-T-607]` 选关弹窗**装配门面**（`ui-architecture-beads §5` Presenter→View 边界）。
 *
 * 本文件只做两件事：① 把全局只读投影 `MetaViewData` 收窄成该页专属
 * {@link LevelSelectViewModel}（**同一个预分配对象逐帧覆写**，热路径零分配）；
 * ② 调纯函数 {@link drawLevelsView}。⛔ 此处不含任何绘制逻辑、不判断导航相位。
 *
 * 对外签名逐字不变（`meta-view.ts::LEVELS_PAGE` 的调用点零改动）。
 * 几何单源 = `config/tuning/level-select.ts`（按 Figma `159:3` 稿重排）；
 * 容器位图复用 `LEVEL_DETAIL_TEXTURES.plaque`；九格模板 = `176:19 grid-1`。
 */
import { type RenderModelBuilder } from '../../framework/index';
import { type BeadsPalette } from './palette';
import type { MetaButton, MetaViewData } from './meta-types';
import { createLevelSelectViewModel, updateLevelSelectViewModel } from './level-select-view-model';
import { drawLevelsView } from './level-select-view';

/** 持续型 VM：模块级预分配一次，每帧写入同一对象（§5 D2）。 */
const VM = createLevelSelectViewModel();

export function drawLevelsPage(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    buttons: readonly MetaButton[],
    thumbN: number,
    screenH: number,
): void {
    updateLevelSelectViewModel(VM, data, buttons, screenH, thumbN);
    drawLevelsView(builder, VM, palette);
}
