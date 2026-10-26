/**
 * MetaView 选关**整页**（WXG-T-420 T7 切出；ADR-0032 D5 / 版式 P）：页底不透明 ⇒ ⛔ 遮罩与纸面板。
 * 格墙与通用钮共读 `meta-layout.ts` 传入的钮表（⛔ 本页不得重建 layout ⇒ 对象身份比对依赖同引用）。
 */

import { DESIGN_W, LEVELS_GRID_TOP, LEVELS_NAV_H, LEVELS_NAV_TOP } from '../config/tuning.js';
import { COPY_TOKENS } from '../config/copy-tokens.js';
import { type RenderModelBuilder } from '@wxgame/framework';
import { type BeadsPalette } from './palette.js';
import { UI_FONT, bodyFont, starCriteriaText } from './ui-theme.js';
import type { MetaButton, MetaViewData } from './meta-types.js';
import { drawMetaButton, drawWallCell } from './meta-widgets.js';
/**
 * 选关**整页**内容（版式 P）：导航带标题 + 3×3 格墙 + 底部 `back`。
 * 淡入 / 淡出（WXG-T-314）与静息帧**同一函数** ⇒ 转场终点与无转场帧逐字一致。
 */
export function drawLevelsPage(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    buttons: readonly MetaButton[],
    thumbN: number,
): void {
    // 标题带顶缘优先读逐机锚（`btTopY` = 胶囊底缘派生），无接口宿主落 `LEVELS_NAV_TOP` 兜底。
    const navTop = data.anchors?.btTopY ?? LEVELS_NAV_TOP;
    builder.text(DESIGN_W / 2, navTop - LEVELS_NAV_H / 2, COPY_TOKENS.btn_levels_label, {
        fill: palette.text,
        font: UI_FONT.overlayTitle,
        align: 'center',
        baseline: 'middle',
    });
    // `[WXG-T-340]` 空带 [LEVELS_GRID_TOP, navTop−NAV_H] 大关名（§11.4：R1 原样；R2 无值不建节点）。
    // 带内 y / 字号属 art 批 `[TODO]` ⇒ 本批取带中心 + 页头同档字（接线批，视觉微调另批）。
    if (data.chapterTitle) {
        builder.text(DESIGN_W / 2, (LEVELS_GRID_TOP + navTop - LEVELS_NAV_H) / 2, data.chapterTitle, {
            fill: palette.text,
            font: UI_FONT.overlayTitle,
            align: 'center',
            baseline: 'middle',
        });
    }
    // `[WXG-T-346]` 累计星进度件（`ux v1.11 §4.1（3）甲臂`）：章名下方一行，只读、零热区。
    // 位置派生自既有标题带高 `LEVELS_NAV_H / 2`（不新增版面常量）。
    // `[art 批·TODO-8 已裁]` 字号 = `font_label` 28，随 E2 大字→ 35（`bodyFont`）；色 = `text_secondary`（对暖纸底
    // ≈ 3.9:1，28px 属大字号 ≥ 3:1 达标）⇒ 正本 = `art/specs/menu-layout-implementation-spec.md §10`。
    if (data.arcStarNeed !== undefined) {
        builder.text(DESIGN_W / 2, (LEVELS_GRID_TOP + navTop - LEVELS_NAV_H) / 2 - LEVELS_NAV_H / 2, `★ ${data.arcStarGot ?? 0}/${data.arcStarNeed}`, {
            fill: palette.textDim,
            font: bodyFont(data.largeText, 'sub'),
            align: 'center',
            baseline: 'middle',
        });
    }
    // `[WXG-T-356]` 判星对照行（正本 = `design/ux/level-select-page-layout.md` v0.6 §2）。
    // **不在格内**：星带分栏需要 ≥ 28px（accessibility E1 floor，22px 已 F7⑤ 作废），
    // 而 28px 下 `★★★` ≈ 84 + `≤03:30` ≈ 94 = 178 > 格宽 170 ⇒ 几何不成立（v0.5 因此作废）。
    // 行位 = 带中心再下移一个 `LEVELS_NAV_H`（= 884，派生常量、零新数值），与进度件同档同色。
    // 成串与结算面板**共读** `starCriteriaText`（⛔ 第二套判星式）；数据腿只用视图已有的
    // `wallSlots` / `wallLevels` ⇒ **零新增快照字段**（视图 ⛔ `import { LEVELS }`，判例同 EP12-S6 T-2B）。
    const curSlot = data.wallSlots.indexOf(data.currentLevelIndex);
    const curLevel = curSlot < 0 ? undefined : data.wallLevels[curSlot];
    if (curLevel !== undefined) {
        builder.text(DESIGN_W / 2, (LEVELS_GRID_TOP + navTop - LEVELS_NAV_H) / 2 - LEVELS_NAV_H, starCriteriaText(curLevel.time, curLevel.starTierK), {
            fill: palette.textDim,
            font: bodyFont(data.largeText, 'sub'),
            align: 'center',
            baseline: 'middle',
        });
    }
    // 作品格与旧橱窗**同一 renderer**（珠拼缩略 + 星级 + 当前高亮 / 未解锁锁格）；back 走通用钮。
    // ⚠ 钮取自调用方的 `metaLayout` 缓存（⛔ 不在此重建 `levelsLayout`）⇒ `pressed` 对象身份比对仍成立。
    for (const b of buttons) {
        if (b.id === 'pick-level') drawWallCell(builder, b, data, palette, thumbN);
        else drawMetaButton(builder, palette, data, b);
    }
}

