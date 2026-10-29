/**
 * 批 1（WXG-T-472）**名片**弹窗的内容块绘制。
 * `[WXG-T-501]`（2026-10-29 用户裁）：**图鉴 / 本地榜两页下线**（本地榜与首页好友榜重叠；
 * 图鉴是「每小关自动缩略图墙」、无专属美术）⇒ 本文件只剩名片一页；未来若做图鉴，
 * 按「大关级作品图」重新设计，不做每小关陈列。
 *
 * 纯绘制、无状态、无热区（只有 `panelPage` 通用「返回」钮）。
 * 面板几何 = `overlayPlate()`（600×720 居中）。
 *
 * ⚠ **坐标口径**（WXG-T-478 修正）：设计空间 **y 向上**，`builder.rect(x, y, w, h)` 的
 * `y` = **下缘**、向上长 `h`；文字 `baseline: 'middle'` 的 `y` = 字行中线。
 * ⇒ 内容带自 `CONTENT_TOP_GAP`（板顶下方）起、**逐行 y 递减**往下排。
 *
 * 路由/标题单源在 `meta-view.ts`（`panelPage`）；本文件只负责「带内画什么」。
 */
import type { RenderModelBuilder } from '../../framework/index';
import { type BeadsPalette } from './palette';
import type { MetaLayout, MetaViewData } from './meta-types';
import { overlayPlate } from './meta-layout';
import { UI_FONT } from './ui-theme';

/**
 * 名片标题单源（`[WXG-T-477]` 补，WXG-T-476 首轮 review 的 F1）。
 * 真源 = `tokens.md §7`；本处 = 运行时可 import 的**消费副本**。
 * 判例同 `SIGNIN_TITLE` / `SKINS_TITLE` ⇒ `meta-view.ts` 只读常量，⛔ **不再内联字面**。
 */
export const PROFILE_TITLE = '名片';

/**
 * 内容带上界 = 板顶下 90（`panelPage` 标题基线在板顶下 50，40px 字形自基线向上延约 20
 * ⇒ 顶沿留 20px 净空）。
 */
const CONTENT_TOP_GAP = 90;
/**
 * 内容带下界 = 板底上移 150。返回钮占 `plate.y+50 … +138`（240×`TOUCH_MIN`88）
 * ⇒ 带底留 12px 净空，画面与热区不再叠。
 */
const CONTENT_BOTTOM_GAP = 150;
/**
 * 内容块整体**下移**量。带下界要让返回钮 138（88 高 + 50 偏移）而带上界只要让标题 ~70
 * ⇒ 带中心比板中心高 30；补偿后内容与板视觉居中。
 */
const CONTENT_CENTER_BIAS = 30;

/* ── 名片 ─────────────────────────────────────────────────────────── */
const PROFILE_PAD_X = 40;
const PROFILE_CARD_GAP = 12;
const PROFILE_CARD_H = 92;
const PROFILE_SIGNIN_TITLE_GAP = 34;
const PROFILE_SIGNIN_CELL = 56;
const PROFILE_SIGNIN_GAP = 14;
const PROFILE_SIGNIN_N = 7;

/**
 * 名片（profile）：2×2 统计卡（累计星 / 通关关数 / 体力 / 钱包）+ 签到周期带。
 *
 * 2 列而非 4 列：旧版卡宽 `(600-80-30)/4 = 122.5`，30px 字下 `◆1240` 必溢出；
 * 2 列后卡宽 254，四位数仍有余量。数值字号走 `UI_FONT.hud`（bold 30）。
 */
export function drawProfileContent(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    _layout: MetaLayout,
): void {
    const plate = overlayPlate();
    const bandBottom = plate.y + CONTENT_BOTTOM_GAP;
    const bandH = plate.h - CONTENT_TOP_GAP - CONTENT_BOTTOM_GAP;

    const cardW = (plate.w - PROFILE_PAD_X * 2 - PROFILE_CARD_GAP) / 2;
    const blockH =
        PROFILE_CARD_H * 2 + PROFILE_CARD_GAP + PROFILE_SIGNIN_TITLE_GAP + PROFILE_SIGNIN_CELL;
    /** 块上界（带内垂直居中 + 板中心补偿） */
    const blockTop = bandBottom + (bandH + blockH) / 2 - CONTENT_CENTER_BIAS;

    const totalStars = data.totalStars ?? 0;
    const clearedCount = data.clearedCount ?? 0;
    const levelN = data.starsByLevel?.length ?? 0;

    const leftX = plate.x + PROFILE_PAD_X;
    const rightX = leftX + cardW + PROFILE_CARD_GAP;

    drawStatCard(builder, leftX, blockTop - PROFILE_CARD_H, cardW, PROFILE_CARD_H, '累计星', `★${totalStars}`, palette);
    drawStatCard(builder, rightX, blockTop - PROFILE_CARD_H, cardW, PROFILE_CARD_H, '通关关数', `${clearedCount} / ${levelN}`, palette);

    const row2Top = blockTop - PROFILE_CARD_H - PROFILE_CARD_GAP;
    drawStatCard(builder, leftX, row2Top - PROFILE_CARD_H, cardW, PROFILE_CARD_H, '体力', `♥${data.stamina} / ${data.staminaMax}`, palette);
    // 货币名「豆子」为项目统一对外名（copy-tokens.ts powerup_buy_confirm_title / 用户 2026-10-22 拍板）⇒ HUD 顶栏 + 签到带（🪙 emoji）+ 此处三轨同口径。
    drawStatCard(builder, rightX, row2Top - PROFILE_CARD_H, cardW, PROFILE_CARD_H, '豆子', `◆${data.coins}`, palette);

    // 签到带：区标题（左）+ 周期读数（右）+ 7 格
    const signinTitleY = row2Top - PROFILE_CARD_H - PROFILE_SIGNIN_TITLE_GAP / 2;
    builder.text(leftX, signinTitleY, '签到周期', {
        fill: palette.text,
        font: UI_FONT.button,
        baseline: 'middle',
    });
    builder.text(plate.x + plate.w - PROFILE_PAD_X, signinTitleY, `第 ${data.signinDay + 1} / ${PROFILE_SIGNIN_N} 天`, {
        fill: palette.textDim,
        font: UI_FONT.cell,
        align: 'right',
        baseline: 'middle',
    });

    const cellW = PROFILE_SIGNIN_CELL;
    const totalW = PROFILE_SIGNIN_N * cellW + (PROFILE_SIGNIN_N - 1) * PROFILE_SIGNIN_GAP;
    const startX = plate.x + (plate.w - totalW) / 2;
    const cellTop = signinTitleY - 22 - 8;
    const y = cellTop - cellW;

    for (let i = 0; i < PROFILE_SIGNIN_N; i++) {
        const x = startX + i * (cellW + PROFILE_SIGNIN_GAP);
        // TODO(WXG-T-478)：`signinDay` 是 `claims % 7`（当日在周期内的格），跨周时
        // `i < signinDay` 会把「本周已签」与「上周已签」混同 —— 需与 `signin-content` 原版口径对齐。
        const claimed = i < data.signinDay || (i === data.signinDay && !data.canClaim);
        const today = i === data.signinDay;
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

/** 名片小卡 —— 纯绘制，不进 meta-layout。`y` = 下缘（y 向上口径）。 */
function drawStatCard(
    builder: RenderModelBuilder,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    value: string,
    palette: BeadsPalette,
): void {
    builder.rect(x, y, w, h, { fill: palette.slot, radius: 12 });
    builder.text(x + w / 2, y + h * 0.68, label, {
        fill: palette.textDim,
        font: UI_FONT.cell,
        align: 'center',
        baseline: 'middle',
    });
    builder.text(x + w / 2, y + h * 0.3, value, {
        fill: palette.text,
        font: UI_FONT.hud,
        align: 'center',
        baseline: 'middle',
    });
}
