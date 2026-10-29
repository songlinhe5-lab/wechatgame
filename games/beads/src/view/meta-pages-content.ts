/**
 * 批 1（WXG-T-470/471/472）三个 Meta 弹窗的内容块绘制。
 * 纯绘制、无状态、无热区（只有 panelPage 通用「返回」钮）。
 * 面板几何 = overlayPlate()（600×720 居中）。
 *
 * ⚠ **坐标口径**（WXG-T-478 修正）：设计空间 **y 向上**，`builder.rect(x, y, w, h)` 的
 * `y` = **下缘**、向上长 `h`；文字 `baseline: 'middle'` 的 `y` = 字行中线。
 * ⇒ 内容带自 `CONTENT_TOP_GAP`（板顶下方）起、**逐行 y 递减**往下排。
 * 旧写法用 `plate.y + 80`（板**底**）作起点并递增 y，导致三页内容贴底、列表倒序、
 * 且首行压住返回钮（`plate.y+50 … +138`）——本版按内容带居中根治。
 *
 * 路由/标题单源在 `meta-view.ts`（`panelPage`）；本文件只负责「带内画什么」。
 */
import type { RenderModelBuilder } from '@wxgame/framework';
import { THUMB_MATRIX_N, THUMB_TOP_INSET } from '../config/tuning.js';
import { beadFadedInksFor, type BeadsPalette } from './palette.js';
import type { MetaLayout, MetaViewData } from './meta-types.js';
import { overlayPlate } from './meta-layout.js';
import { drawLevelThumb } from './menu-signage.js';
import { UI_FONT } from './ui-theme.js';

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
 * ⇒ 带中心比板中心高 30；补偿后内容与板视觉居中（三页共用，避免各页各调）。
 */
const CONTENT_CENTER_BIAS = 30;

/* ── 图鉴 ─────────────────────────────────────────────────────────── */
const ALBUM_CELL = 96;
const ALBUM_GAP = 20;
const ALBUM_COLS = 5;
const ALBUM_ROWS = 2;
const ALBUM_ROW_GAP = 24;
/** 底部信息带高（关号 + 星条）。 */
const ALBUM_FOOTER_H = 32;
/** 缩略区高 = 格高 − 顶内缩 − 底带（顶内缩与选关格同档 ⇒ 与 `drawLevelThumb` 同一取顶口径）。 */
const ALBUM_THUMB_H = ALBUM_CELL - THUMB_TOP_INSET - ALBUM_FOOTER_H;
const ALBUM_STAT_H = 40;
const ALBUM_STAT_GAP = 26;

/**
 * 图鉴（album）：`ALBUM_ROWS × ALBUM_COLS` 缩略图墙（每关一格）+ 带底成绩合计。
 * 格内 = 缩略图区（上 `ALBUM_THUMB_H`）+ 星条（下）/ 锁形（未通关）；当前关主色 4px 描边。
 *
 * 缩略图走 `drawLevelThumb`（与选关格**同一聚合表 / 同一 renderer**）：关卡本体由 shell 经
 * `data.albumLevels` 下传（视图 ⛔ 不 import 全局关表）。未通关传灰墨集 ⇒ 珠阵置灰（与锁格同口径）；
 * 无引用（旧调用方 / 合成数据）⇒ 只留语义底占位。
 */
export function drawAlbumContent(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    _layout: MetaLayout,
): void {
    const plate = overlayPlate();
    const bandBottom = plate.y + CONTENT_BOTTOM_GAP;
    const bandH = plate.h - CONTENT_TOP_GAP - CONTENT_BOTTOM_GAP;

    const gridW = ALBUM_COLS * ALBUM_CELL + (ALBUM_COLS - 1) * ALBUM_GAP;
    const startX = plate.x + (plate.w - gridW) / 2;
    const gridH = ALBUM_ROWS * ALBUM_CELL + (ALBUM_ROWS - 1) * ALBUM_ROW_GAP;
    const blockH = gridH + ALBUM_STAT_GAP + ALBUM_STAT_H;
    /** 块上界（带内垂直居中） */
    const blockTop = bandBottom + (bandH + blockH) / 2 - CONTENT_CENTER_BIAS;

    const stars = data.starsByLevel;
    const levelN = stars?.length ?? 0;

    for (let r = 0; r < ALBUM_ROWS; r++) {
        for (let c = 0; c < ALBUM_COLS; c++) {
            const idx = r * ALBUM_COLS + c;
            const x = startX + c * (ALBUM_CELL + ALBUM_GAP);
            // 逐行 y 递减（y 向上 ⇒ 第 0 行在最上）
            const y = blockTop - r * (ALBUM_CELL + ALBUM_ROW_GAP) - ALBUM_CELL;
            const n = stars?.[idx] ?? 0;
            const cleared = n > 0;
            const isCurrent = idx === data.currentLevelIndex;

            builder.rect(x, y, ALBUM_CELL, ALBUM_CELL, {
                fill: palette.slot,
                stroke: isCurrent ? palette.accentPrimary : palette.slotBorder,
                lineWidth: isCurrent ? 4 : 2,
                radius: 12,
                // 通关 / 未通关靠 α 拉开（旧写法 `cleared ? slot : slot` 两边同值 = 无差别）
                alpha: cleared ? 1 : 0.55,
            });

            // 缩略图底槽（语义底：无引用时即最终画面；有引用时留在珠阵下当「图位」衬底）
            builder.rect(
                x + THUMB_TOP_INSET,
                y + ALBUM_CELL - THUMB_TOP_INSET - ALBUM_THUMB_H,
                ALBUM_CELL - THUMB_TOP_INSET * 2,
                ALBUM_THUMB_H,
                {
                    fill: cleared ? palette.slotDashed : palette.locked,
                    alpha: cleared ? 0.45 : 0.3,
                    radius: 8,
                },
            );
            const level = data.albumLevels?.[idx];
            if (level !== undefined) {
                // 珠拼缩略（选关格同一 renderer / 同一聚合表）；未通关走灰墨集
                // （`inkOverride` 同时关闭位图臂：预烘彩图无灰度版）。
                drawLevelThumb(
                    builder,
                    level,
                    x,
                    y,
                    ALBUM_CELL,
                    ALBUM_CELL,
                    THUMB_MATRIX_N,
                    ALBUM_THUMB_H,
                    cleared ? undefined : beadFadedInksFor(level),
                );
            }

            if (!cleared) {
                // 程序化锁形（⛔ 不用 emoji：跨端字形不一、不进程序化图元体系）
                const cx = x + ALBUM_CELL / 2;
                const bodyY = y + ALBUM_CELL - THUMB_TOP_INSET - ALBUM_THUMB_H / 2 - 11;
                builder.rect(cx - 13, bodyY, 26, 20, { fill: palette.locked, radius: 4 });
                builder.rect(cx - 9, bodyY + 20, 18, 8, { stroke: palette.locked, lineWidth: 3, radius: 4 });
            }

            // 下带：关号（左）+ 三段星条（右）。⭐ 旧版画 22px 「★」字形，缩放后仅 ~8px 不可辨；
            // 改块状星条后即便小屏也读得出「几星」。关号对未通关格同样显示（可知哪一关没开）。
            builder.text(x + 10, y + ALBUM_FOOTER_H - 14, `${idx + 1}`, {
                fill: cleared ? palette.textDim : palette.textDisabled,
                font: UI_FONT.cell,
                baseline: 'middle',
            });
            for (let s = 0; s < 3; s++) {
                builder.rect(x + ALBUM_CELL * 0.44 + s * 17, y + 14, 14, 8, {
                    fill: s < n ? palette.accentPrimary : palette.slotBorder,
                    alpha: cleared ? 1 : 0.4,
                    radius: 2,
                });
            }
        }
    }

    // 带底成绩合计（单趟整数累加，零分配）
    let total = 0;
    let clearedCount = 0;
    for (let i = 0; i < levelN; i++) {
        const s = stars?.[i] ?? 0;
        total += s;
        if (s > 0) clearedCount++;
    }
    builder.text(
        plate.x + plate.w / 2,
        blockTop - gridH - ALBUM_STAT_GAP / 2,
        `★${total} / ${levelN * 3} 　 ${clearedCount} / ${levelN} 关`,
        {
            fill: palette.textDim,
            font: UI_FONT.cell,
            align: 'center',
            baseline: 'middle',
        },
    );
}

/* ── 本地榜 ───────────────────────────────────────────────────────── */
const RANK_ROW_H = 42;
const RANK_ROW_GAP = 5;
const RANK_SIDE_PAD = 40;
/** 排序池容量上限（关池现为 10；超出按前 `RANK_MAX` 关截断）。 */
const RANK_MAX = 32;

interface RankItem {
    levelIdx: number;
    stars: number;
}

/**
 * 排序池：模块级复用 ⇒ `buildRenderModel` 热路径**零分配**（不再每帧 new 数组 + 对象）。
 * 脏位 `stars = -1` 恒排末尾，故 in-place `sort` 后取前 n 位即可。
 */
const RANK_POOL: RankItem[] = [];
for (let i = 0; i < RANK_MAX; i++) RANK_POOL.push({ levelIdx: 0, stars: -1 });

/**
 * 本地榜（localRank）：`starsByLevel` 按 **星数降序 / 关号升序** 展开成行。
 * 第 1 名在最上；前三名名次徽章用主色递减 α 分级；未通关行整体压淡；自身行左侧 4px 竖条。
 */
export function drawLocalRankContent(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    _layout: MetaLayout,
): void {
    const plate = overlayPlate();
    const bandBottom = plate.y + CONTENT_BOTTOM_GAP;
    const bandH = plate.h - CONTENT_TOP_GAP - CONTENT_BOTTOM_GAP;

    const stars = data.starsByLevel;
    const n = Math.min(stars?.length ?? 0, RANK_MAX);

    if (n === 0) {
        // 空态显式文案（旧写法直接 return ⇒ 面板只剩标题，读作「坏了」）
        builder.text(plate.x + plate.w / 2, bandBottom + bandH / 2, '暂无记录', {
            fill: palette.textDim,
            font: UI_FONT.button,
            align: 'center',
            baseline: 'middle',
        });
        return;
    }

    for (let i = 0; i < n; i++) {
        RANK_POOL[i]!.levelIdx = i;
        RANK_POOL[i]!.stars = stars![i] ?? 0;
    }
    for (let i = n; i < RANK_MAX; i++) RANK_POOL[i]!.stars = -1;
    RANK_POOL.sort((a, b) => b.stars - a.stars || a.levelIdx - b.levelIdx);

    const rowW = plate.w - RANK_SIDE_PAD * 2;
    const startX = plate.x + RANK_SIDE_PAD;
    const totalH = n * RANK_ROW_H + (n - 1) * RANK_ROW_GAP;
    /** 首行上缘（带内垂直居中 + 板中心补偿） */
    const rowTop = bandBottom + (bandH + totalH) / 2 - CONTENT_CENTER_BIAS;

    for (let rank = 0; rank < n; rank++) {
        const it = RANK_POOL[rank]!;
        const yTop = rowTop - rank * (RANK_ROW_H + RANK_ROW_GAP);
        const y = yTop - RANK_ROW_H;
        const mid = y + RANK_ROW_H / 2;
        const isSelf = it.levelIdx === data.currentLevelIndex;
        const dim = it.stars === 0;

        builder.rect(startX, y, rowW, RANK_ROW_H, {
            fill: isSelf ? palette.accentPrimary : palette.slot,
            radius: 10,
            alpha: isSelf ? 0.16 : dim ? 0.4 : 0.85,
        });
        if (isSelf) {
            // 自身行：淡底 + 左竖条 + 2px 主色框。当前关通常是**未通关**（★0）⇒ 单靠淡底
            // 会被未通关档的 α 一起压暗，加描边后才稳定可辨。
            builder.rect(startX, y, 4, RANK_ROW_H, { fill: palette.accentPrimary, radius: 2 });
            builder.rect(startX, y, rowW, RANK_ROW_H, {
                stroke: palette.accentPrimary,
                lineWidth: 2,
                radius: 10,
            });
        }

        // 名次徽章：前三名主色递减 α，其余回落槽线色
        const medal = rank < 3;
        builder.circle(startX + 30, mid, 15, {
            fill: medal ? palette.accentPrimary : palette.slotBorder,
            alpha: medal ? (rank === 0 ? 1 : rank === 1 ? 0.72 : 0.46) : 0.6,
        });
        builder.text(startX + 30, mid, `${rank + 1}`, {
            fill: medal ? palette.panel : palette.textDim,
            font: UI_FONT.cell,
            align: 'center',
            baseline: 'middle',
        });

        builder.text(startX + 58, mid, `第 ${it.levelIdx + 1} 关`, {
            fill: dim ? palette.textDim : palette.text,
            font: UI_FONT.button,
            baseline: 'middle',
        });

        // 三星级进度条（3 段）
        for (let k = 0; k < 3; k++) {
            builder.rect(startX + rowW - 150 + k * 26, mid - 6, 20, 12, {
                fill: k < it.stars ? palette.accentPrimary : palette.slotBorder,
                radius: 3,
                alpha: dim ? 0.4 : 1,
            });
        }
        builder.text(startX + rowW - 34, mid, `★${it.stars}`, {
            fill: dim ? palette.textDim : palette.accentPrimary,
            font: UI_FONT.cell,
            align: 'right',
            baseline: 'middle',
        });
    }
}

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
