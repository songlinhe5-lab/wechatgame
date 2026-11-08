/**
 * `[WXG-T-601]` 关卡详情弹窗内容带（Figma「关卡详情弹窗 v25b」程序化还原）：
 * 副标题「第 N 关」+ 大号缩略图（复用 `drawLevelThumb`，与选关格墙同源）+
 * 判星标准（与结算面板共读 `starCriteriaText`，⛔ 第二套判星式）+
 * 历史星（`STAR_LABELS`，与选关格同语言）+ 道具行（三枚圆徽章 + 可用数角标）。
 *
 * 容器（遮罩 / 纸面板 / 板标题）与通用钮（返回 / 开始）由 `meta-view.ts::panelPage` 负责；
 * 钮几何单源在 `meta-layout.ts::levelDetailLayout`（画与撞同一份）。
 * 数据腿：`MetaViewData.detailLevelIndex` / `detailLevel` / `powerupStocks`（shell 投影，L5）。
 *
 * ⚠ 坐标口径：设计空间 **y 向上**、`box.y` = 下缘。下方常量一律**相对 plate 左下角**，
 * 绘制时再加 `plate.x` / `plate.y` ⇒ 逐机位移（`dialogShiftY`）与板高变更都不会撕裂内容带。
 */

import { DESIGN_W, POWERUP_TYPES } from '../config/tuning.js';
import { type RenderModelBuilder } from '@wxgame/framework';
import { POWERUP_LABELS } from '../systems/powerups.js';
import { type BeadsPalette } from './palette.js';
import { UI_FONT, bodyFont, starCriteriaText } from './ui-theme.js';
import { drawLevelThumb } from './menu-signage.js';
import { STAR_LABELS } from './meta-widgets.js';
import { overlayPlate } from './meta-layout.js';
import type { MetaLayout, MetaViewData } from './meta-types.js';

/**
 * 内容带纵向几何（单源；单位 = 设计 px，**相对 plate 左下角**、y 向上）。
 *
 * 600×720 纸面板实算：
 *  - 底部钮行 `[50, 138]`（`TOUCH_MIN = 88`，与 settings/skins 的返回同档）⇒ 内容地板 158；
 *  - 板标题基线 = `plate.y + 720 − 50`，字面 40（`UI_FONT.overlayTitle`）⇒ 下缘 ≈ 650，
 *    内容天花取 **628**（净空 22）⇒ 副标题 600 不与板标题重叠。
 */
const SUB_Y = 600; // 副标题「第 N 关」中线
const CRITERIA_Y = 556; // 判星标准中线
const THUMB_SIZE = 240; // 缩略图边长（正方形；Figma 295×285 按弹窗内可容宽收敛）
const THUMB_Y = 288; // 缩略图**下缘**
const STARS_Y = 262; // 历史星中线
const ITEM_CY = 200; // 道具行圆心中线（r = 42 ⇒ 占 [158, 242]）
const ITEM_R = 42; // 徽章半径（84 直径，同 Figma ≥ 触控下限的半高）
const ITEM_GAP = 36; // 徽章间净距

/**
 * 道具徽章单字（原型档；切图入 assets 后整行换 blit）。
 * 由 `POWERUP_LABELS` **一次派生** ⇒ 顺序 / 首字与道具系统同源（⛔ 不在此另立第二套名单）；
 * 模块级只算一次 ⇒ 帧内零分配。
 */
const ITEM_GLYPHS: readonly string[] = POWERUP_TYPES.map((t) => POWERUP_LABELS[t].slice(0, 1));
/** `powerupStocks` 缺省档（单测 mock / 未投影 ⇒ 三枚全可用）。 */
const POWERUP_STOCKS_DEFAULT: readonly number[] = POWERUP_TYPES.map(() => 1);

export function drawLevelDetailContent(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    _layout: MetaLayout,
    thumbN: number,
): void {
    const level = data.detailLevel;
    const levelIdx = data.detailLevelIndex ?? -1;
    if (level === undefined || levelIdx < 0) return; // ⛔ 占位
    const plate = overlayPlate();
    const cx = DESIGN_W / 2;
    // 副标题：第 N 关（1-based 展示）
    builder.text(cx, plate.y + SUB_Y, `第 ${levelIdx + 1} 关`, {
        fill: palette.text,
        font: bodyFont(data.largeText, 'sub'),
        align: 'center',
        baseline: 'middle',
    });
    // 判星标准：与选关页 / 结算面板同源一行。
    builder.text(cx, plate.y + CRITERIA_Y, starCriteriaText(level.time, level.starTierK), {
        fill: palette.textDim,
        font: bodyFont(data.largeText, 'sub'),
        align: 'center',
        baseline: 'middle',
    });
    // 大号缩略图：与选关格同一绘制腿（数据同源 ⇒ 图恒一致；area 加大 = 更细的聚合阵）。
    drawLevelThumb(builder, level, cx - THUMB_SIZE / 2, plate.y + THUMB_Y, THUMB_SIZE, THUMB_SIZE, thumbN, THUMB_SIZE);
    // 历史星（本关已得星，与选关格 STAR_LABELS 同语言）。
    const stars = data.starsByLevel[levelIdx] ?? 0;
    builder.text(cx, plate.y + STARS_Y, STAR_LABELS[stars] ?? STAR_LABELS[0]!, {
        fill: stars > 0 ? palette.text : palette.textDim,
        font: UI_FONT.cell,
        align: 'center',
        baseline: 'middle',
    });
    // 道具行：三枚圆徽章 + 右下角可用数（账号级免费每型 1 次 ⇒ 0 = 已用）。
    const rowW = ITEM_GLYPHS.length * ITEM_R * 2 + (ITEM_GLYPHS.length - 1) * ITEM_GAP;
    const stocks = data.powerupStocks ?? POWERUP_STOCKS_DEFAULT;
    let x = cx - rowW / 2 + ITEM_R;
    for (let i = 0; i < ITEM_GLYPHS.length; i++) {
        const cy = plate.y + ITEM_CY;
        builder.circle(x, cy, ITEM_R, {
            fill: palette.slot,
            stroke: palette.slotBorder,
            lineWidth: 2,
        });
        builder.text(x, cy, ITEM_GLYPHS[i]!, {
            fill: palette.text,
            font: UI_FONT.cell,
            align: 'center',
            baseline: 'middle',
        });
        // 角标：可用数（小圆点 + 数字；0 档转灰 = 「已用」，且灰底亮字保证可读）。
        const n = stocks[i] ?? 0;
        const bx = x + ITEM_R * 0.72;
        const by = cy + ITEM_R * 0.72;
        builder.circle(bx, by, 13, { fill: n > 0 ? palette.accentPrimary : palette.textDim });
        builder.text(bx, by, `${n}`, {
            fill: palette.panel,
            font: UI_FONT.cell,
            align: 'center',
            baseline: 'middle',
        });
        x += ITEM_R * 2 + ITEM_GAP;
    }
}
