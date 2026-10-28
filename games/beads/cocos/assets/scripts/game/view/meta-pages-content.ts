/**
 * 批 1（WXG-T-470/471/472）三个 Meta 弹窗的内容块绘制。
 * 纯绘制、无状态、无热区（只有 panelPage 通用「返回」钮）。
 * 面板几何 = overlayPlate()（600×720 居中），内部偏移硬编码。
 *
 * | 函数 | overlay | 内容 |
 * |---|---|---|
 * | drawAlbumContent | album | 10 关缩略图墙 + 每关星级 |
 * | drawLocalRankContent | localRank | 每关星级排序 + 自身高亮 |
 * | drawProfileContent | profile | 累计星/通关/体力/钱包/签到 |
 */

import type { RenderModelBuilder } from '../../framework/index';
import type { BeadsPalette } from './palette';
import type { MetaLayout, MetaViewData } from './meta-types';
import { overlayPlate } from './meta-layout';
import { UI_FONT } from './ui-theme';

/**
 * 三页标题单源（`[WXG-T-477]` 补，WXG-T-476 首轮 review 的 F1）。
 *
 * 真源 = `tokens.md §7`（本批新补三键）；本处 = 运行时可 import 的**消费副本**。
 * 判例同 `SIGNIN_TITLE` / `SKINS_TITLE` ⇒ `meta-view.ts` 只读常量，⛔ **不再内联字面**
 * （守卫：`meta-menu-wall.test.ts` 断言视图侧无 `panelPage('<标题>'` 裸字面）。
 */
export const ALBUM_TITLE = '图鉴';
export const LOCAL_RANK_TITLE = '本地榜';
export const PROFILE_TITLE = '名片';

/** 面板标题下沿：panelPage 标题画在 plate.y + plate.h - 50，这里从标题下 30 起。 */
const TITLE_BOTTOM_OFFSET = 80;

/**
 * 图鉴（album）：10 关缩略图 2×5 网格（每关 = 一个 ARC 内的 level）。
 * 缩略图尺寸 = 100×100，间距 20，整体居中。
 * 通关 ★n，未通关灰底 + 锁图标，当前关高亮边框。
 */
export function drawAlbumContent(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    _layout: MetaLayout,
): void {
    const plate = overlayPlate();
    const contentTop = plate.y + TITLE_BOTTOM_OFFSET;
    const cellSize = 100;
    const gap = 20;
    const cols = 5;
    const rows = 2;
    const gridW = cols * cellSize + (cols - 1) * gap;
    const startX = plate.x + (plate.w - gridW) / 2;
    const startY = contentTop;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const idx = row * cols + col;
            const x = startX + col * (cellSize + gap);
            const y = startY + row * (cellSize + gap);
            const stars = data.starsByLevel?.[idx] ?? 0;
            const cleared = stars > 0;
            const isCurrent = idx === data.currentLevelIndex;

            // 缩略图底
            builder.rect(x, y, cellSize, cellSize, {
                fill: cleared ? palette.slot : palette.slot,
                stroke: isCurrent ? palette.accentPrimary : palette.slotBorder,
                lineWidth: isCurrent ? 4 : 2,
                radius: 12,
                alpha: cleared ? 1 : 0.4,
            });
            // 锁 / 关号 / 星级
            if (!cleared) {
                builder.text(x + cellSize / 2, y + cellSize / 2, '🔒', {
                    font: UI_FONT.button,
                    align: 'center',
                    baseline: 'middle',
                });
            } else {
                builder.text(x + cellSize / 2, y + cellSize / 2 - 8, `${idx + 1}`, {
                    fill: palette.textDim,
                    font: UI_FONT.cell,
                    align: 'center',
                    baseline: 'middle',
                });
                builder.text(x + cellSize / 2, y + cellSize / 2 + 14, `★${stars}`, {
                    fill: palette.accentPrimary,
                    font: UI_FONT.button,
                    align: 'center',
                    baseline: 'middle',
                });
            }
        }
    }
}

/**
 * 本地榜（localRank）：starsByLevel 展开排序 → 行列表。
 * 每行 = 排名序号 + 关卡名（或关号）+ ★n，自身行高亮。
 */
export function drawLocalRankContent(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    _layout: MetaLayout,
): void {
    const plate = overlayPlate();
    const contentTop = plate.y + TITLE_BOTTOM_OFFSET;
    const rowH = 48;
    const rowGap = 8;
    const rowW = plate.w - 80;
    const startX = plate.x + 40;

    // 展开排序：从 data.starsByLevel 只读引用构造（10 关规模，零性能压力）
    const stars = data.starsByLevel;
    if (!stars || stars.length === 0) return;
    const items: { levelIdx: number; stars: number; cleared: boolean }[] = [];
    for (let i = 0; i < stars.length; i++) {
        items.push({ levelIdx: i, stars: stars[i] ?? 0, cleared: (stars[i] ?? 0) > 0 });
    }
    items.sort((a, b) => b.stars - a.stars || a.levelIdx - b.levelIdx);

    for (let rank = 0; rank < items.length; rank++) {
        const it = items[rank]!;
        const y = contentTop + rank * (rowH + rowGap);
        const isSelf = it.levelIdx === data.currentLevelIndex;

        builder.rect(startX, y, rowW, rowH, {
            fill: isSelf ? palette.accentPrimary : palette.slot,
            radius: 10,
            alpha: isSelf ? 0.15 : 0.6,
        });

        builder.text(startX + 30, y + rowH / 2, `${rank + 1}`, {
            fill: isSelf ? palette.accentPrimary : palette.textDim,
            font: UI_FONT.button,
            align: 'center',
            baseline: 'middle',
        });
        builder.text(startX + rowW - 50, y + rowH / 2, `★${it.stars}`, {
            fill: it.cleared ? palette.accentPrimary : palette.textDim,
            font: UI_FONT.button,
            align: 'right',
            baseline: 'middle',
        });
        builder.text(startX + 80, y + rowH / 2, `第 ${it.levelIdx + 1} 关`, {
            fill: palette.text,
            font: UI_FONT.button,
            baseline: 'middle',
        });
    }
}

/**
 * 名片（profile）：五块统计卡水平排列。
 * 累计星 ★ / 通关关数 / 体力胶囊 ♥ / 钱包胶囊 ◆ / 签到周期（7 格）。
 */
export function drawProfileContent(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    _layout: MetaLayout,
): void {
    const plate = overlayPlate();
    const contentTop = plate.y + TITLE_BOTTOM_OFFSET;
    const padX = 40;
    const cardW = (plate.w - padX * 2 - 30) / 4;
    const cardH = 120;
    const gap = 10;

    // 1. 累计星
    const totalStars = data.totalStars ?? 0;
    drawStatCard(builder, pad(plate, padX + 0 * (cardW + gap), contentTop, cardW, cardH), '累计星', `★${totalStars}`, palette);
    // 2. 通关关数
    const clearedCount = data.clearedCount ?? 0;
    drawStatCard(builder, pad(plate, padX + 1 * (cardW + gap), contentTop, cardW, cardH), '通关', `${clearedCount}`, palette);
    // 3. 体力
    drawStatCard(builder, pad(plate, padX + 2 * (cardW + gap), contentTop, cardW, cardH), '体力', `♥${data.stamina}/${data.staminaMax}`, palette);
    // 4. 钱包
    drawStatCard(builder, pad(plate, padX + 3 * (cardW + gap), contentTop, cardW, cardH), '豆子', `◆${data.coins}`, palette);

    // 5. 签到周期（下一行，通宽）
    const signinTop = contentTop + cardH + 30;
    const cellW = 60;
    const cellGap = 12;
    const signinTotalW = 7 * cellW + 6 * cellGap;
    const signinStartX = plate.x + (plate.w - signinTotalW) / 2;
    const signinDay = data.signinDay % 7;
    const canClaim = data.canClaim;

    for (let i = 0; i < 7; i++) {
        const x = signinStartX + i * (cellW + cellGap);
        const y = signinTop;
        const claimed = i < signinDay || (i === signinDay && !canClaim);
        const today = i === signinDay;
        builder.rect(x, y, cellW, cellW, {
            fill: claimed ? palette.slot : palette.panel,
            stroke: today ? palette.accentPrimary : palette.slotBorder,
            lineWidth: today ? 4 : 2,
            radius: 10,
            alpha: claimed ? 0.5 : 1,
        });
        builder.text(x + cellW / 2, y + cellW / 2, claimed ? '✓' : `${i + 1}`, {
            fill: claimed ? palette.textDim : palette.text,
            font: UI_FONT.cell,
            align: 'center',
            baseline: 'middle',
        });
    }
}

/** 名片小卡 —— 纯绘制，不进 meta-layout。 */
function drawStatCard(
    builder: RenderModelBuilder,
    rect: { x: number; y: number; w: number; h: number },
    label: string,
    value: string,
    palette: BeadsPalette,
): void {
    builder.rect(rect.x, rect.y, rect.w, rect.h, {
        fill: palette.slot,
        radius: 12,
    });
    builder.text(rect.x + rect.w / 2, rect.y + rect.h * 0.35, label, {
        fill: palette.textDim,
        font: UI_FONT.cell,
        align: 'center',
        baseline: 'middle',
    });
    builder.text(rect.x + rect.w / 2, rect.y + rect.h * 0.7, value, {
        fill: palette.text,
        font: UI_FONT.button,
        align: 'center',
        baseline: 'middle',
    });
}

/** 面板内绝对定位小工具。 */
function pad(
    plate: { x: number; y: number },
    x: number,
    y: number,
    w: number,
    h: number,
): { x: number; y: number; w: number; h: number } {
    return { x: plate.x + x, y: plate.y + y, w, h };
}
