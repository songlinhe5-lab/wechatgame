/**
 * `[WXG-T-602]` 关卡详情弹窗（Figma「关卡详情弹窗 v25b」· 文件 `PBIK3RbfGlfzFsAnd97ZsP` · 节点 `92:36`）：
 * 木牌容器 + 板标题 + 副标题（大关名·第 N 关）+ 橱窗缩略 + 星级行 + 时限 + 道具行 + 开始 / 返回。
 *
 * 几何单源 = `config/tuning/level-detail.ts`（与 `meta-layout.ts::levelDetailLayout` 共读）。
 * 位图缺省腿：木牌 → 纸面板、开始 → 通用主钮、星 → `STAR_LABELS` 文字 —— **同几何换皮**，⛔ 不做第二套版式。
 * 数据腿：`MetaViewData.detailLevelIndex` / `detailLevel` / `detailChapterTitle` / `powerupStocks` / `starsByLevel`（L5）。
 *
 * ⚠ 坐标口径：设计空间 y 向上、`box.y` = 下缘。下列纵向偏移一律**相对木牌下缘**，
 * 绘制时加 `plate.y` ⇒ 逐机位移（`dialogShiftY`）不会撕裂内容带。
 */

import { DESIGN_H, LEVEL_DETAIL_GEO, LEVEL_DETAIL_TEXTURES, LEVEL_DETAIL_TITLE_SHADOW, POWERUP_TILE_TEXTURES, POWERUP_TYPES, THUMB_TOP_INSET } from '../config/tuning.js';
import { type RenderModelBuilder } from '@wxgame/framework';
import { POWERUP_LABELS } from '../systems/powerups.js';
import { type BeadsPalette, withAlpha } from './palette.js';
import { UI_FONT, formatTime } from './ui-theme.js';
import { drawLevelThumb } from './menu-signage.js';
import { STAR_LABELS, drawCloseInset, drawModalPlate, isPressed, label, menuBitmapReady } from './meta-widgets.js';
import { drawButton } from './ui-widgets.js';
import { levelDetailPlate } from './meta-layout.js';
import type { MetaViewData } from './meta-types.js';

const GEO = LEVEL_DETAIL_GEO;
/** 木牌下缘在设计空间里的 y（= 124；稿面 y下 166 + 高 1044）。 */
const PLATE_Y = DESIGN_H - GEO.plate.yDown - GEO.plate.h;
/** 稿面 `yDown` 的**下缘** → 相对木牌下缘的偏移。 */
const dyBottom = (yDown: number, h: number): number => DESIGN_H - yDown - h - PLATE_Y;
/** 稿面 `cyDown`（中线）→ 相对木牌下缘的偏移。 */
const dyCenter = (cyDown: number): number => DESIGN_H - cyDown - PLATE_Y;

const TITLE_DY = dyCenter(GEO.title.cyDown); // 932
const SUB_DY = dyCenter(GEO.subtitle.cyDown); // 843
/** `[WXG-T-609]` 橱窗面板下缘（稿 376+638=1014 ⇒ 相对木牌 196）。 */
const SHOWCASE_DY = dyBottom(GEO.showcase.yDown, GEO.showcase.h);
const THUMB_DY = dyBottom(GEO.thumb.yDown, GEO.thumb.h); // 405
const STARS_DY = dyBottom(GEO.stars.yDown, GEO.stars.h); // 292
const TIME_DY = dyCenter(GEO.time.cyDown); // 300
const ITEMS_DY = dyBottom(GEO.items.yDown, GEO.items.size); // 214
const START_DY = dyBottom(GEO.start.yDown, GEO.start.h); // 29
const CLOSE_DY = dyCenter(GEO.close.cyDown); // 1006（y_up 中心 1130）
/** 标题投影偏移（稿面 y 向下 ⇒ 视图 y 向上取负）；blur 不落（文字管线单色填充，硬边近似）。 */
const TITLE_SHADOW_DX = LEVEL_DETAIL_TITLE_SHADOW.dx;
const TITLE_SHADOW_DY = -LEVEL_DETAIL_TITLE_SHADOW.dyDown;
/** 星级行合宽（3 枚 + 两缝）与中轴；文字回退档据此居中。 */
const STARS_W = GEO.stars.count * GEO.stars.size + (GEO.stars.count - 1) * GEO.stars.gap;
/** 道具行合宽。 */
const ITEMS_W = POWERUP_TYPES.length * GEO.items.size + (POWERUP_TYPES.length - 1) * GEO.items.gap;

/**
 * 道具徽章单字（**仅**位图缺省腿用；切图在册时整行 blit）。
 * 由 `POWERUP_LABELS` 一次派生 ⇒ 顺序 / 首字与道具系统同源，模块级只算一次（帧内零分配）。
 */
const ITEM_GLYPHS: readonly string[] = POWERUP_TYPES.map((t) => POWERUP_LABELS[t].slice(0, 1));
/** `powerupStocks` 缺省档（单测 mock / 未投影 ⇒ 三枚全可用）。 */
const POWERUP_STOCKS_DEFAULT: readonly number[] = POWERUP_TYPES.map(() => 1);

export function drawLevelDetailPage(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    thumbN: number,
    screenH: number,
): void {
    const level = data.detailLevel;
    const levelIdx = data.detailLevelIndex ?? -1;
    if (level === undefined || levelIdx < 0) return; // ⛔ 占位
    const plate = levelDetailPlate();

    // 遮罩 + 容器（新版木牌烘图：纯木纹 + 标题槽 + 铆钉，⛔ 旧版牌内烘入的空橱窗已拆出）：
    // 与选关页共用 `drawModalPlate`（`[WXG-T-612]` 用户令「背景框绘制共用逻辑」）。
    drawModalPlate(builder, palette, plate, screenH);

    // `[WXG-T-609]` 橱窗面板（Figma 192:42）：稿层序在木牌之后、缩略 / 星级 / 道具之前。
    // 缺图 ⇒ 不画（纯木纹牌仍可读，⛔ 不叠程序化第二套玻璃框）。
    if (menuBitmapReady(LEVEL_DETAIL_TEXTURES.showcase)) {
        builder.blit(LEVEL_DETAIL_TEXTURES.showcase,
            plate.x + (GEO.showcase.x - GEO.plate.x),
            plate.y + SHOWCASE_DY,
            GEO.showcase.w, GEO.showcase.h);
    }

    // 板标题：稿 64px ExtraBold 暖金；canvas 无 Chiron 字族 ⇒ bold 64 系统字。
    // 投影（Figma 95:59 DROP_SHADOW #5A2F0D α0.80 +9,+7 blur3）走 `TextCommand.shadow`
    // 最小契约：Canvas 原生阴影（含 blur）/ Cocos 双 Label / SVG 双 text。
    // 两枚 INNER_SHADOW 仍不实现（文字命令只有单色填充，规格 §4.1 / §9-6）。
    const titleX = plate.x + (GEO.title.cx - GEO.plate.x);
    const titleY = plate.y + TITLE_DY;
    builder.text(titleX, titleY, '关卡详情', {
        fill: palette.plateSubInk,
        font: UI_FONT.detailTitle,
        align: 'center',
        baseline: 'middle',
        shadow: {
            color: withAlpha(palette.plateTitleInk, LEVEL_DETAIL_TITLE_SHADOW.alpha),
            offsetX: TITLE_SHADOW_DX,
            offsetY: TITLE_SHADOW_DY,
            blur: LEVEL_DETAIL_TITLE_SHADOW.blur,
        },
    });

    // 副标题：大关名·第 N 关（稿 28 Bold 深藏青；大关名缺省 ⇒ 只显关序）。
    const chapter = data.detailChapterTitle;
    const subtitle = chapter ? `${chapter}·第 ${levelIdx + 1} 关` : `第 ${levelIdx + 1} 关`;
    builder.text(plate.x + (GEO.subtitle.cx - GEO.plate.x), plate.y + SUB_DY, subtitle, {
        fill: palette.text,
        font: data.largeText ? UI_FONT.bodyLarge : UI_FONT.labelBold,
        align: 'center',
        baseline: 'middle',
    });

    // 橱窗内容：关卡缩略（与选关格同一绘制腿）；垂直居中于玻璃窗 ⇒ 下缘先抬 (h − area)/2。
    const thumb = GEO.thumb;
    drawLevelThumb(
        builder,
        level,
        plate.x + (thumb.x - GEO.plate.x),
        plate.y + THUMB_DY + (thumb.h - thumb.area) / 2,
        thumb.w,
        thumb.area + THUMB_TOP_INSET,
        thumbN,
        thumb.area,
    );

    // 星级行：得星 = 实心金，未得 = 空心描边（稿 58×60，净距 9）；缺图 ⇒ 文字档同位居中。
    const stars = data.starsByLevel[levelIdx] ?? 0;
    const s = GEO.stars;
    if (menuBitmapReady(LEVEL_DETAIL_TEXTURES.starFilled) && menuBitmapReady(LEVEL_DETAIL_TEXTURES.starEmpty)) {
        const sx = plate.x + (s.x - GEO.plate.x);
        for (let i = 0; i < s.count; i++) {
            builder.blit(
                i < stars ? LEVEL_DETAIL_TEXTURES.starFilled : LEVEL_DETAIL_TEXTURES.starEmpty,
                sx + i * (s.size + s.gap),
                plate.y + STARS_DY,
                s.size,
                s.h,
            );
        }
    } else {
        builder.text(plate.x + (s.x - GEO.plate.x) + STARS_W / 2, plate.y + STARS_DY + s.h / 2, STAR_LABELS[stars] ?? STAR_LABELS[0]!, {
            fill: stars > 0 ? palette.plateTitleInk : palette.textDim,
            font: UI_FONT.cell,
            align: 'center',
            baseline: 'middle',
        });
    }

    // 时限：稿 14px（低于可读地板）⇒ 取 22 档；按稿左缘锚（x=482），⛔ 居中会压第三枚星。
    builder.text(plate.x + (GEO.time.x - GEO.plate.x), plate.y + TIME_DY, `时限：${formatTime(level.time)}`, {
        fill: palette.plateTitleInk,
        font: UI_FONT.cell,
        align: 'left',
        baseline: 'middle',
    });

    // 道具行：三枚 84×84（框图含木框 + 米底 + 本体）；可用数角标贴右上角、24×24 r8。
    const stocks = data.powerupStocks ?? POWERUP_STOCKS_DEFAULT;
    const it = GEO.items;
    const rowLeft = plate.x + (it.cx - GEO.plate.x) - ITEMS_W / 2;
    const itemY = plate.y + ITEMS_DY;
    for (let i = 0; i < POWERUP_TYPES.length; i++) {
        const x = rowLeft + i * (it.size + it.gap);
        const texId = POWERUP_TILE_TEXTURES[POWERUP_TYPES[i]!];
        if (menuBitmapReady(texId)) {
            builder.blit(texId, x, itemY, it.size, it.size);
        } else {
            const cx = x + it.size / 2;
            const cy = itemY + it.size / 2;
            builder.circle(cx, cy, it.size / 2, { fill: palette.slot, stroke: palette.slotBorder, lineWidth: 2 });
            builder.text(cx, cy, ITEM_GLYPHS[i]!, {
                fill: palette.text,
                font: UI_FONT.cell,
                align: 'center',
                baseline: 'middle',
            });
        }
        // 角标：可用数（0 档转灰 = 「已用」，灰底亮字保证可读）。
        const n = stocks[i] ?? 0;
        const bd = GEO.badge.size;
        const bx = x + it.size - bd;
        const by = itemY + it.size - bd;
        builder.rect(bx, by, bd, bd, { fill: n > 0 ? palette.text : palette.textDim, radius: GEO.badge.radius });
        builder.text(bx + bd / 2, by + bd / 2, `${n}`, {
            fill: palette.woodText,
            font: UI_FONT.badge,
            align: 'center',
            baseline: 'middle',
        });
    }

    // 「开始」：稿 326×154 整枚烘字；缺图 ⇒ 通用主钮同几何（文案走 `label()` 令牌表）。
    const st = GEO.start;
    const startX = plate.x + (st.x - GEO.plate.x);
    const startY = plate.y + START_DY;
    const startPressed = data.pressed?.id === 'start-detail';
    if (menuBitmapReady(LEVEL_DETAIL_TEXTURES.start)) {
        builder.blit(LEVEL_DETAIL_TEXTURES.start, startX, startY, st.w, st.h);
    } else {
        drawButton(builder, palette, startX, startY, st.w, st.h, 'accent', 14, label('start-detail', data), UI_FONT.button, startPressed, false);
    }

    // 「关闭」：木牌右上框带内嵌 38² 凹槽（与选关页共用 `drawCloseInset`）。
    const cl = GEO.close;
    drawCloseInset(
        builder,
        palette,
        plate.x + (cl.cx - GEO.plate.x),
        plate.y + CLOSE_DY,
        cl.w,
        cl.h,
        cl.arm,
        isPressed(data, 'close-detail'),
    );
}
