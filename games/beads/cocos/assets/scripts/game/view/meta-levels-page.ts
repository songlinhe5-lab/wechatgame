/**
 * MetaView 选关**弹窗**内容块（`[WXG-T-503]` 改判回弹窗；正本 = `design/ux/level-select-page-layout.md` v0.7 §2）。
 *
 * 标题 / 遮罩 / 纸面板 / 返回钮由 `meta-view::panelPage` 负责；本块只画：
 * **章名 + 星进度（同行）→ 判星对照行 → 3×3 格墙**。
 * 格墙与通用钮共读 `meta-layout` 传入的钮表（⛔ 本块不得重建 layout ⇒ 对象身份比对依赖同引用）。
 */

import { DESIGN_W } from '../config/tuning';
import { type RenderModelBuilder } from '../../framework/index';
import { type BeadsPalette } from './palette';
import { UI_FONT, bodyFont, starCriteriaText } from './ui-theme';
import type { MetaButton, MetaViewData } from './meta-types';
import { drawWallCell } from './meta-widgets';
import { levelsPanelMetrics } from './meta-layout';

export function drawLevelsContent(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    buttons: readonly MetaButton[],
    thumbN: number,
): void {
    const m = levelsPanelMetrics();
    // 章名（居中）+ 星进度（同行右侧小字）：弹窗横向 600，章名降到 button 档（30）避开右侧读数。
    if (data.chapterTitle) {
        builder.text(DESIGN_W / 2, m.chapterY, data.chapterTitle, {
            fill: palette.text,
            font: UI_FONT.button,
            align: 'center',
            baseline: 'middle',
        });
    }
    if (data.arcStarNeed !== undefined) {
        builder.text(m.plate.x + m.plate.w - 40, m.progressY, `★ ${data.arcStarGot ?? 0}/${data.arcStarNeed}`, {
            fill: palette.textDim,
            font: bodyFont(data.largeText, 'sub'),
            align: 'right',
            baseline: 'middle',
        });
    }
    // 判星对照：与结算面板**共读** `starCriteriaText`（⛔ 第二套判星式）；数据腿只用视图已有的
    // `wallSlots` / `wallLevels` ⇒ 零新增快照字段。取不到当前关 ⇒ 整行不画（⛔ 占位）。
    const curSlot = data.wallSlots.indexOf(data.currentLevelIndex);
    const curLevel = curSlot < 0 ? undefined : data.wallLevels[curSlot];
    if (curLevel !== undefined) {
        builder.text(DESIGN_W / 2, m.criteriaY, starCriteriaText(curLevel.time, curLevel.starTierK), {
            fill: palette.textDim,
            font: bodyFont(data.largeText, 'sub'),
            align: 'center',
            baseline: 'middle',
        });
    }
    // 作品格（`pick-level`）由本块画；返回 / 其它通用钮由 `panelPage` 的画钮循环铺。
    for (const b of buttons) {
        if (b.id === 'pick-level') drawWallCell(builder, b, data, palette, thumbN);
    }
}
