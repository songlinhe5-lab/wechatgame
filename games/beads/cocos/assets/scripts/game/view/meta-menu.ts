/**
 * MetaView 主菜单页（WXG-T-420 T7 切出）：顶栏 / 资源条 / 走马灯橱窗 / 木牌 / CTA。
 * 几何一律取自 `meta-layout.ts` 的锚定档，控件画法取自 `meta-widgets.ts` ⇒ 页面只编排、不另算。
 */

import { DESIGN_H, DESIGN_W, type MenuAnchors, MENU_ARC_ART_CONTENT, MENU_ARC_ART_SRC, MENU_BAR_BAKED_LABEL_INSET, MENU_FROST, MENU_FULLSTAR_FRAME, MENU_GRAY_WIPE, MENU_LOCKED_ICON, MENU_PLACEMENT, MENU_PLATE_PILL, MENU_SIGNIN_DOT_R, MENU_TEXTURES, MENU_TOPBAR_ICON_D, MENU_TOPBAR_ROW2_DY, MENU_TOPBAR_VISUAL_D, MENU_TOPBAR_X, MENU_V2_BG_EXPAND, MENU_V2_BG_H, MENU_V2_DESK_FILL,
    SIGN_BEAD_PITCH, menuBackdropTopPad, SIGN_MATRIX_N, THUMB_TOP_INSET, TOUCH_MIN, UI_CONTAINER, WALL_SLOT_DASH, WALL_SLOT_DASH_GAP } from '../config/tuning';
import { COPY_TOKENS } from '../config/copy-tokens';
import { ARC_COMING_SOON } from '../config/arcs';
import { plateFade } from '../config/menu-carousel';
import { frostGrayFx, grayWipeFx, type BlitFx, type RenderModelBuilder } from '../../framework/index';
import { beadFadedInksFor, type BeadsPalette } from './palette';
import { drawBeadText, drawLevelThumb } from './menu-signage';
import { drawGear } from './play-page';
import { type BeadsLevelRaw } from '../config/levels-data';
import { UI_FONT } from './ui-theme';
import { drawButton } from './ui-widgets';
import type { AnchoredMenuGeo } from './meta-layout';
import type { Box, MetaBossState, MetaViewData } from './meta-types';
import { heartBarLabel, isPressed, label, menuBitmapReady, pressDy } from './meta-widgets';

/**
 * `[WXG-T-566 / WXG-T-567]` 三态 fx（模块级常量 / 缓存 ⇒ 键序固定、同进度每帧零分配）。
 * - 未开启 = **磨砂玻璃 + 半透明灰**（叠加管线 `frost(radius=8) + gray(0.3)`：frost 先做 1/4 下采样
 *   模糊，再在 blur 产物上叠 gray 0.3 保留 30% 原色；独立锁形 Sprite 由 `drawLockedBadge` 单独画）；
 * - 推关 = **竖向揭彩**（`grayWipe`，彩色比例 = 已完成小关 / 总小关；用户 2026-11-02 裁）；
 * - 已通关 = 不传 fx（全彩）；⛔ 不传 `gray: 0`（多一个键 = 多一次 sha 漂移，且无效果）。
 */
const MENU_FROST_FX_LOCKED = frostGrayFx(MENU_FROST.radius, MENU_FROST.gray);

/**
 * 揭彩 fx 缓存：键 = 进度千分位。生产侧进度 = `done/total`（离散，章内 ≤ 10 档）
 * ⇒ 缓存 ≤ 11 项；量化只为防「有人喂连续动画进度」把 Map 撑大（0.001 ≈ 0.34px @340）。
 */
const WIPE_FX = new Map<number, BlitFx>();

function wipeFx(done: number | undefined, total: number | undefined): BlitFx {
    const p = done === undefined || total === undefined || total <= 0 ? 0 : done / total;
    const key = Math.round(p * 1000);
    let fx = WIPE_FX.get(key);
    if (fx === undefined) {
        fx = grayWipeFx(key / 1000, MENU_GRAY_WIPE.soft);
        WIPE_FX.set(key, fx);
    }
    return fx;
}

/** `cleared` 与 `fullstar` 都是全彩（不传 fx）—— 满星的差别只在珠圈框，不在灰度。 */
function triStateFx(state: MetaBossState, done?: number, total?: number): BlitFx | undefined {
    if (state === 'locked') return MENU_FROST_FX_LOCKED;
    if (state === 'pushing') return wipeFx(done, total);
    return undefined;
}

/**
 * 资源条（❤ 8/8 ｜ 0 ⊙）。
 *
 * `[WXG-T-585]` v2 背板**已烘**条体本体、上沿受光线、两端铆钉，以及两枚图标
 * （红心 x219..239 / 拼豆白环 x517..538，实测自 `ui_menu_backdrop@2x.png`）
 * ⇒ 本函数**只画两枚数值**，⛔ 不再叠程序化 rect / 描边 / 铆钉 / 图标
 * （叠了就是「假条体压真图案 + 白心盖红心 + 灰圆盖白环」，用户 2026-11-07 判退）。
 * 数值内缩 = 图标宽（20），与烘图标的间隙由 `MENU_V2.bar` 实测框给出。
 * ⚠ 2026-11-07 切生产后 v1 的「程序化条体 + 铆钉 + 图标位图」整条腿已删除。
 */
function drawResourceBar(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    g: Box,
): void {
    const x = g.x;
    const cy = g.y + g.h / 2;
    // 图标已烘进背板 ⇒ 文本自图标外缘再让一个间隙起排（`MENU_BAR_BAKED_LABEL_INSET` = 20+8）。
    builder.text(x + MENU_BAR_BAKED_LABEL_INSET, cy, heartBarLabel(data.stamina, data.staminaMax), {
        fill: palette.barValue,
        font: UI_FONT.labelBold,
        align: 'left',
        baseline: 'middle',
    });
    builder.text(x + g.w - MENU_BAR_BAKED_LABEL_INSET, cy, `${data.coins}`, {
        fill: palette.barValue,
        font: UI_FONT.labelBold,
        align: 'right',
        baseline: 'middle',
    });
}

/**
 * L6 顶栏三钮（§5.1b 落位表）。视觉圆 Ø80 居中于 88×88 热区（推导 2：热区不得互叠）。
 * - **左上 设置**（实装）= 白圆 + 齿轮，齿轮画法与对局页 HUD **同一函数**
 *   （§5.1b 收口 ③：裁的是「入口语义不合并」，不是图元不复用 ⇒ 零新画法、零新美术）；
 * - **右上 签到**（2026-10-22 用户裁：签到入口回归）= 正常态白圆 + `iconCalendar` 日历对勾
 *   （`[WXG-T-497]` 已由信封换日历，信封 `iconMail` 于 `[WXG-T-581]` 删键出包）
 *   + 按下纹；`canClaim` ⇒ 右上 1 枚小圆点（`MENU_SIGNIN_DOT_R`，全局唯一提示位）。
 *   ⛔ 程序化腿**不自造日历/信封图标**（切图规格 B10 权威）⇒ 缺图只留空圆底；
 *   ⛔ 该位不加红点以外的提示（全局唯一提示位 = 该小圆点）。
 * - **右中 装扮馆**（`[WXG-T-365]` 提案 P4-甲：原公告预留位升格）= 与上两颗同构同函数腿
 *   （白圆底 + 按下纹 + 40² 图标）；图标暂以该位原有喇叭顶替 ⇒ `[待 UI 设计]`，⛔ 新画法。
 *   热区已注册（`menuLayoutAnchored` 的 `open-skins`）⇒ 公告语义位被占用属本裁定的已知代价。
 *
 * ⚠ 圆钮无文字 ⇒ 不走 {@link drawButton}（那个是给矩形纸钮用的）。
 * `[WXG-T-280]` 位图腿：`btnCircle` 就绪 ⇒ 底面 blit；`iconSettings` 就绪 ⇒
 * 40² 图标替齿轮。未就绪 ⇒ 程序化腿。
 * 圆心 y = `geo.topbarCy`（与热区同源）；x 档共用 `MENU_TOPBAR_X`。
 */
function drawTopbar(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    geo: AnchoredMenuGeo,
): void {
    const cy = geo.topbarCy; // 热区中心 = 视觉圆中心
    const r = MENU_TOPBAR_VISUAL_D / 2;
    const cxc = MENU_TOPBAR_X.settings + TOUCH_MIN / 2;
    const circleTex = MENU_TEXTURES.btnCircle;
    const circleReady = menuBitmapReady(circleTex);
    // 设置钮按下：底换 pressed 纹（缺 ⇒ normal 纹）/ 程序化换 cardPressed；盘与图标同沉。
    const pressed = isPressed(data, 'open-settings');
    const scy = cy + pressDy(data, pressed);
    if (circleReady) {
        const tex = pressed && menuBitmapReady(MENU_TEXTURES.btnCirclePressed) ? MENU_TEXTURES.btnCirclePressed : circleTex;
        builder.blit(tex, cxc - r, scy - r, MENU_TOPBAR_VISUAL_D, MENU_TOPBAR_VISUAL_D);
    } else {
        builder.circle(cxc, scy, r, {
            fill: pressed ? palette.cardPressed : palette.panel,
            stroke: palette.panelBorder,
            lineWidth: 2,
        });
    }
    const settingsIcon = MENU_TEXTURES.iconSettings;
    if (menuBitmapReady(settingsIcon)) {
        const id = MENU_TOPBAR_ICON_D;
        builder.blit(settingsIcon, cxc - id / 2, scy - id / 2, id, id);
    } else {
        drawGear(builder, cxc, scy, palette);
    }
    // ── 签到 / 每日奖励（[WXG-T-497] 由信封改日历对勾；2026-10-22 用户裁：入口回归；已领当日仍可打开看进度）──
    // 热区常驻（见 `menuLayoutAnchored`），视觉与设置钮同构：底圆 + 40² 图标 + 按下纹。
    const mcx = MENU_TOPBAR_X.mail + TOUCH_MIN / 2;
    const mailPressed = isPressed(data, 'open-signin');
    const mcy = cy + pressDy(data, mailPressed);
    if (circleReady) {
        const tex = mailPressed && menuBitmapReady(MENU_TEXTURES.btnCirclePressed)
            ? MENU_TEXTURES.btnCirclePressed
            : circleTex;
        builder.blit(tex, mcx - r, mcy - r, MENU_TOPBAR_VISUAL_D, MENU_TOPBAR_VISUAL_D);
    } else {
        builder.circle(mcx, mcy, r, {
            fill: mailPressed ? palette.cardPressed : palette.panel,
            stroke: palette.panelBorder,
            lineWidth: 2,
        });
    }
    const signinIcon = MENU_TEXTURES.iconCalendar;
    if (menuBitmapReady(signinIcon)) {
        const id = MENU_TOPBAR_ICON_D;
        builder.blit(signinIcon, mcx - id / 2, mcy - id / 2, id, id);
    }
    // ⛔ 程序化腿不自造日历图标（切图规格 B10 权威）⇒ 缺图只留空圆底，不画替代图形。
    // 未领小圆点：全局唯一提示位（不铺红点/不闪烁；色读既有 `danger`，零新 hex）。
    if (data.canClaim) {
        builder.circle(mcx + r * 0.72, mcy + r * 0.72, MENU_SIGNIN_DOT_R, {
            fill: palette.danger,
            stroke: palette.panel,
            lineWidth: 2,
        });
    }
    // ── 装扮馆入口（`[WXG-T-365]` · 提案 P4-甲 = 原公告预留位升格，坐标零改动）──
    // 与另三钮同构：底圆 + 按下纹 + `MENU_TOPBAR_ICON_D`（= 圆 80²）图标；⛔ 程序化腿不自造
    // 图标（信封判例 = 形状归切图规格权威）⇒ 缺图只留空圆底。
    // 图标 = `ui_icon_skin`（衣架 + 圆领小衫）⇒ [WXG-T-493] 结清自 WXG-T-365 起借
    // `iconSound`（喇叭）顶替的语义错位债（旧口径 `[待 UI 设计]` 见 `ux-spec §3.8` v1.26 记录）。
    const skx = MENU_TOPBAR_X.skins + TOUCH_MIN / 2;
    const skinsPressed = isPressed(data, 'open-skins');
    // `WXG-T-486` 曾迁左列第二枚 ⇒ `WXG-T-487`（2026-10-28）复位「右列第二枚」，与左列好友榜钮同一行距。
    const skcy = cy - MENU_TOPBAR_ROW2_DY + pressDy(data, skinsPressed);
    if (circleReady) {
        const tex = skinsPressed && menuBitmapReady(MENU_TEXTURES.btnCirclePressed)
            ? MENU_TEXTURES.btnCirclePressed
            : circleTex;
        builder.blit(tex, skx - r, skcy - r, MENU_TOPBAR_VISUAL_D, MENU_TOPBAR_VISUAL_D);
    } else {
        builder.circle(skx, skcy, r, {
            fill: skinsPressed ? palette.cardPressed : palette.panel,
            stroke: palette.panelBorder,
            lineWidth: 2,
        });
    }
    const skinsIcon = MENU_TEXTURES.iconSkins;
    if (menuBitmapReady(skinsIcon)) {
        const id = MENU_TOPBAR_ICON_D;
        builder.blit(skinsIcon, skx - id / 2, skcy - id / 2, id, id);
    }
    // ── 好友榜（`WXG-T-487` 用户 2026-10-28 裁：左上第二枚，与 skins 左右对称；左列 2 + 右列 2）──
    // 底圆 / 按下纹与其余三钮同构；图标 `ui_icon_rank`（`[WXG-T-488]` 切图 160² @2x ⇒ 同圆 80 绘制，
    // 领奖台三台阶 + 嵌入圆点表名次位）。缺图 ⇒ 按信封判例「⛔ 程序化腿不自造图标」只留空圆底。
    const rkx = MENU_TOPBAR_X.rank + TOUCH_MIN / 2;
    const rankPressed = isPressed(data, 'open-rank');
    const rkcy = cy - MENU_TOPBAR_ROW2_DY + pressDy(data, rankPressed);
    if (circleReady) {
        const tex = rankPressed && menuBitmapReady(MENU_TEXTURES.btnCirclePressed)
            ? MENU_TEXTURES.btnCirclePressed
            : circleTex;
        builder.blit(tex, rkx - r, rkcy - r, MENU_TOPBAR_VISUAL_D, MENU_TOPBAR_VISUAL_D);
    } else {
        builder.circle(rkx, rkcy, r, {
            fill: rankPressed ? palette.cardPressed : palette.panel,
            stroke: palette.panelBorder,
            lineWidth: 2,
        });
    }
    const rankIcon = MENU_TEXTURES.iconRank;
    if (menuBitmapReady(rankIcon)) {
        const id = MENU_TOPBAR_ICON_D;
        builder.blit(rankIcon, rkx - id / 2, rkcy - id / 2, id, id);
    }
}

/**
 * 虚线空槽（§5.4 口径 2）。RenderModel **无 dash 笔** ⇒ 合成 6/4 线段（同 `view-model::drawDashedRect`
 * 判例；段长/间隔已收进 `tuning.ts::WALL_SLOT_DASH[_GAP]`，与本处**同值不同源**的归并待授权）。
 */
function drawDashedSocket(builder: RenderModelBuilder, b: Box, color: string): void {
    const period = WALL_SLOT_DASH + WALL_SLOT_DASH_GAP;
    const lw = UI_CONTAINER.strokePanel;
    for (let px = 0; px < b.w; px += period) {
        const len = Math.min(WALL_SLOT_DASH, b.w - px);
        builder.line(b.x + px, b.y, b.x + px + len, b.y, color, lw);
        builder.line(b.x + px, b.y + b.h, b.x + px + len, b.y + b.h, color, lw);
    }
    for (let py = 0; py < b.h; py += period) {
        const len = Math.min(WALL_SLOT_DASH, b.h - py);
        builder.line(b.x, b.y + py, b.x, b.y + py + len, color, lw);
        builder.line(b.x + b.w, b.y + py, b.x + b.w, b.y + py + len, color, lw);
    }
}

/**
 * 橱窗 ◀▶（`[WXG-T-280]` 落地单 §3 · `[WXG-T-585]` 切生产后）：
 * **整枚位图**（木圆盘 + 箭头烘在同一张图，左右件像素不同）⇒ 一次 blit 完事，
 * ⛔ 不叠圆底 + 向标两段拼，也⛔ 不画 ◀/▶ 字模降级腿（缺图即露空，按切生产口径不静默降级）。
 * 几何由 {@link anchoredGeo} 传入，本函数不复算。
 */
function drawArrow(
    builder: RenderModelBuilder,
    data: MetaViewData,
    b: Box,
    dir: 'left' | 'right',
): void {
    const pressed = isPressed(data, dir === 'left' ? 'carousel-prev' : 'carousel-next');
    // `[BD-62]` 边界隐藏：首张不画 ◀、末张不画 ▶（与 `_nudge` 的 clamp 语义一致）。
    if (dir === 'left' ? data.carouselFirst : data.carouselLast) return;
    const dy = pressDy(data, pressed);
    const tex = dir === 'left'
        ? (pressed ? MENU_TEXTURES.prevBtnPressed : MENU_TEXTURES.prevBtn)
        : (pressed ? MENU_TEXTURES.nextBtnPressed : MENU_TEXTURES.nextBtn);
    builder.blit(tex, b.x, b.y + dy, b.w, b.h);
}

/**
 * `[WXG-T-579]` 满星态珠圈框：以作品中心为心、边长 = `artW × MENU_FULLSTAR_FRAME.k`。
 * 画在作品**之上**（框图中央是真透明空心，正好露出花心）。
 */
function drawFullStarRing(
    builder: RenderModelBuilder,
    cx: number,
    cy: number,
    artW: number,
    ink: number | undefined,
): void {
    if (!menuBitmapReady(MENU_TEXTURES.arcRing)) return;
    const d = artW * MENU_FULLSTAR_FRAME.k;
    const opts = ink === undefined ? undefined : { alpha: ink };
    builder.blit(MENU_TEXTURES.arcRing, cx - d / 2, cy - d / 2, d, d, opts);
}

/**
 * 锁定态锁形独立 Sprite：画在 frost+gray 合成作品之上，位置居中、宽度 = 作品宽度 × 比例，
 * 高度按纹理宽高比（`MENU_LOCKED_ICON.aspect`）求 —— `[WXG-T-578]` Figma v2 拼豆锁是 192×260
 * 的竖长件，⛔ 不再按方形拉（旧 128² 白盘锁才配方形槽）。
 * ⛔ 不合成进 frost 纹理 —— 锁形是静态图、可独立调尺寸/alpha/动画。
 */
function drawLockedBadge(
    builder: RenderModelBuilder,
    bx: number,
    by: number,
    bw: number,
    ink: number | undefined,
): void {
    if (!menuBitmapReady(MENU_LOCKED_ICON.textureId)) return;
    const w = bw * MENU_LOCKED_ICON.scale;
    const h = w / MENU_LOCKED_ICON.aspect;
    const cx = bx + bw / 2;
    const cy = by + bw / 2;
    const opts = ink === undefined ? undefined : { alpha: ink };
    builder.blit(
        MENU_LOCKED_ICON.textureId,
        cx - w / 2,
        cy - h / 2,
        w, h,
        opts,
    );
}

/**
 * `[WXG-T-522]` 单一作品腿（内景背板位图命中时）：每页只画一件大关图。
 * `[WXG-T-566]` 三态 = **同一张图的灰度差异**（锁定全灰 / 推关竖向揭彩 / 通关全彩），
 * 状态标记（通关飘带 / 锁定小锁 / 中央沙漏）**全部退场**（用户 2026-11-02 裁）；
 * 其余状态靠柜灯强度与（`[WXG-T-598]` 起唯一的）竖向揭彩比例表达 —— 木牌不再印 `N/M`。
 * `arcDone` / `arcTotal` = 该页大关完成度（揭彩比例唯一定义处见 `wipeFx`）。
 */
function drawShowcaseArt(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    g: AnchoredMenuGeo,
    level: BeadsLevelRaw | undefined,
    state: MetaBossState,
    dx: number,
    alpha: number,
    comingSoon: boolean,
    textureId?: string,
    arcDone?: number,
    arcTotal?: number,
): void {
    if (alpha <= 0) return;
    const ink = alpha < 1 ? alpha : undefined;
    const b = g.showcaseArtBox;
    const x = b.x + dx;
    if (comingSoon) {
        drawComingSoonMark(builder, palette, b.x + b.w / 2 + dx, b.y + b.h / 2, ink);
        return;
    }
    if (level !== undefined && textureId !== undefined && menuBitmapReady(textureId)) {
        const fx = triStateFx(state, arcDone, arcTotal);
        const opts = fx === undefined
            ? (ink === undefined ? undefined : { alpha: ink })
            : (ink === undefined ? { fx } : { alpha: ink, fx });
        // `[WXG-T-601]` 原图四周透明留白直接铺框会让图案悬空约 61px ⇒ 按内容宽放大到
        // 「内容恰铺满展品框」，并把**内容底缘**压在 b.y（= 圆台台面，⛔ 不是 blit 框底）。
        const k = b.w / MENU_ARC_ART_CONTENT.w;
        const size = MENU_ARC_ART_SRC * k;
        const bottomInset = MENU_ARC_ART_SRC - MENU_ARC_ART_CONTENT.y - MENU_ARC_ART_CONTENT.h;
        builder.blit(textureId, x + b.w / 2 - size / 2, b.y - bottomInset * k, size, size, opts);
    } else if (level !== undefined) {
        // `[WXG-T-601]` 展品底缘坐圆台台面（图内 y≈844 = 框底）。`drawLevelThumb` 按
        // 「格顶内缩 THUMB_TOP_INSET」定位 ⇒ 传 h = 边长 + 内缩，图案底才恰 = yBottom；
        // 传框高 b.h(314) 会让 325² 图案沉入台面 19px。
        drawLevelThumb(
            builder, level, x, b.y, b.w, b.w + THUMB_TOP_INSET,
            Math.max(level.rows, level.cols), b.w,
            state === 'locked' ? beadFadedInksFor(level) : undefined,
            ink,
        );
    } else {
        drawDashedSocket(builder, { x, y: b.y, w: b.w, h: b.h }, palette.slotDashed);
    }
    // `[WXG-T-567]` 锁定态锁形独立 Sprite（同 drawShowcaseItem 口径，用 showcaseArtBox 尺寸）。
    if (state === 'locked') drawLockedBadge(builder, x, b.y, b.w, ink);
    // `[WXG-T-579]` 满星态珠圈框（同口径，边长随作品框宽缩放 ⇒ 两条腿不各钉一个像素）。
    if (state === 'fullstar') drawFullStarRing(builder, x + b.w / 2, b.y + b.h / 2, b.w, ink);
}

/** 空橱窗中央的置灰花。半径写死，热路径不分配。 */
const SOON_PETALS = 6;
const SOON_RING = 108;
const SOON_CORE_R = 40;
const SOON_PETAL_R = 32;

function drawComingSoonMark(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    cx: number,
    cy: number,
    alpha: number | undefined,
): void {
    const mark = {
        fill: palette.locked,
        stroke: palette.textDim,
        lineWidth: 3,
        ...(alpha === undefined ? {} : { alpha }),
    };
    builder.circle(cx, cy, SOON_CORE_R, mark);
    for (let i = 0; i < SOON_PETALS; i++) {
        const a = (Math.PI * 2 * i) / SOON_PETALS - Math.PI / 2;
        builder.circle(cx + Math.cos(a) * SOON_RING, cy + Math.sin(a) * SOON_RING, SOON_PETAL_R, mark);
    }
}

/** 木牌上的「敬请期待」。`alpha` ≤ 0 不画。
 *
 * `[WXG-T-600]` 字型与**单行关序同档**（{@link PLATE_TITLE_FONT}）。旧稿写死 `UI_FONT.button`（30）
 * 的理由是「提示语不是关名」—— 但两者落的是**同一个槽**（`plateSingleCy`，牌面正中），
 * 30 与 34 并排会看出「同一位置、两套字号」，翻到空橱窗页时牌面会突然缩水一圈。
 */
function drawComingSoonPlate(
    builder: RenderModelBuilder,
    g: AnchoredMenuGeo,
    palette: BeadsPalette,
    alpha: number,
): void {
    if (alpha <= 0) return;
    const a = alpha < 1 ? alpha : undefined;
    builder.text(g.plateCx, g.plateSingleCy, ARC_COMING_SOON, {
        // `[WXG-T-597]` 同压牌面亮木 ⇒ 与关名同墨（`wood_edge` 4.68:1 够用，但既然牌面墨已独立成
        // 令牌，这里跟着走，避免牌上出现两种深棕）。
        fill: palette.plateTitleInk,
        font: PLATE_TITLE_FONT,
        align: 'center',
        baseline: 'middle',
        ...(a === undefined ? {} : { alpha: a }),
    });
}

/**
 * 木牌第一行（关名）字型：**34 粗体**（`[WXG-T-599]`；`[WXG-T-597]` 曾是 40）。
 *
 * 演进：`UI_FONT.button`（30 常规）→ `panelButton`（`bold 30px`，WXG-T-596）→ `plateTitle`
 * （`bold 40px`，WXG-T-597）→ **34px**（本批：用户 2026-11-07 判「相比设计稿，现在字号有点大」）。
 * 40 那批把稿的「1.70 层级」当唯一目标、却没先把「稿像素 ↔ 设计像素」归一，于是整体偏大 19%；
 * 本批按胶囊宽归一（1.32）重算，34px 墨高 ≈29.9 ≈ 稿的 29.5 ⇒ 与稿持平，层级 34/22 = **1.55**。
 */
const PLATE_TITLE_FONT = UI_FONT.plateTitle;
/**
 * 木牌第二行：**胶囊底 + 次行墨**（`[WXG-T-596]` 立件，`[WXG-T-597]` 换稿值，`[WXG-T-599]` 缩档）。
 *
 * 为什么不直接压墨：牌面亮木实测 `(233,164,92)`，旧墨 `wood_face #8A5B34` 压上去只有
 * **2.74:1 ❌**（既有 a11y 缺陷、且违反拆册件 §4 早已定的 `woodText` 口径）。稿的做法是
 * 「深棕胶囊 + 浅暖墨」，`WXG-T-597` 起**改用稿实测值**（`plate_pill #795127` / `plate_sub_ink #E8D098`
 * = **4.61:1** ✓），不再借 `wood_face`/`wood_text`。
 *
 * 几何见 {@link MENU_PLATE_PILL}：宽 130 照稿与拆册件；高 `26 → 33 → 27`。33 是为「次行锁死 28
 * 时保住稿的 0.72 比值」而加厚；本批次行缩到 22（`UI_FONT.plateSub`）⇒ 胶囊按同一比值回落到
 * `22×0.88 / 0.72 ≈ 27`，实得 **0.72** ✓。
 */
function drawPlateSub(
    builder: RenderModelBuilder,
    g: AnchoredMenuGeo,
    palette: BeadsPalette,
    text: string,
    a: number | undefined,
): void {
    builder.rect(g.plateCx - MENU_PLATE_PILL.w / 2, g.plateLine2Cy - MENU_PLATE_PILL.h / 2,
        MENU_PLATE_PILL.w, MENU_PLATE_PILL.h, {
            fill: palette.platePill,
            radius: MENU_PLATE_PILL.h / 2,
            ...(a === undefined ? {} : { alpha: a }),
        });
    builder.text(g.plateCx, g.plateLine2Cy, text, {
        fill: palette.plateSubInk, font: UI_FONT.plateSub, align: 'center', baseline: 'middle',
        ...(a === undefined ? {} : { alpha: a }),
    });
}
/** 木牌上的关名 / 关序（`[WXG-T-598]` 起第二行**恒为关序**）。`alpha` ≤ 0 不画。
 *
 * 只剩两条分支：**有展示名** ⇒ 两行（关名 / `第 N 关`）；**无** ⇒ 单行 `第 N 关`。
 *
 * `[WXG-T-524 §5-A 乙]` 早已裁定「木牌第二行 = 关序『第 N 关』」，`★ n/m`（WXG-T-346）与
 * 大关 `N/M`（WXG-T-566）两个进度件**自木牌退场**（选关页仍保留），但一直没落码。
 * `[WXG-T-598]` 用户令「应该是关序『第 N 关』、胶囊宽度暂不需要增加」⇒ 本批补齐，
 * 函数**不再接进度实参**（传了也没处画）。
 *
 * ⚠ 信息影响（在册已裁，不是丢失 bug）：主菜单木牌不再显示门票 ★ 进度，该读数在选关页
 * （`arc-level-select`）仍有。若日后要回木牌，⛔ 别塞回第二行 —— 应另立第三行或换件。
 *
 * 字号 = 关名 {@link PLATE_TITLE_FONT}（34 粗）/ 次行 `plateSub`（22 粗，`WXG-T-599` 缩档；
 * ⛔ 仍随 E2 放大，见 `menu-layout-implementation-spec §10`）；墨与底 = `plate_sub_ink` / `plate_pill`；
 * 关名墨 = `plateTitleInk`。
 * 宽度：`第 12 关` 在 22px 下 ≈ 75 < 胶囊 130 ⇒ 「宽度暂不增加」的裁定余量更足。
 */
function drawPlateTitle(
    builder: RenderModelBuilder,
    lv: BeadsLevelRaw,
    g: AnchoredMenuGeo,
    palette: BeadsPalette,
    alpha: number,
): void {
    if (alpha <= 0) return;
    const seq = `第 ${lv.id} 关`;
    const a = alpha < 1 ? alpha : undefined;
    if (lv.title) {
        builder.text(g.plateCx, g.plateLine1Cy, lv.title, {
            fill: palette.plateTitleInk, font: PLATE_TITLE_FONT, align: 'center', baseline: 'middle',
            ...(a === undefined ? {} : { alpha: a }),
        });
        drawPlateSub(builder, g, palette, seq, a);
    } else {
        builder.text(g.plateCx, g.plateSingleCy, seq, {
            fill: palette.plateTitleInk, font: PLATE_TITLE_FONT, align: 'center', baseline: 'middle',
            ...(a === undefined ? {} : { alpha: a }),
        });
    }
}

/**
 * `[P0 静态温暖 · 2026-10-30 用户令「太空、要暖，但保持静态」]`
 * 背景 / 陈列层参数。全部低对比、零位图、零动画：脏帧门控照常生效（静止帧零重绘）。
 * 本批为验证参数，拍板后按 art 变更单迁入 `tuning/menu.ts`；⛔ 不新增 palette hex。
 */
const MENU_WARM = {
    deskH: 140,
    deskAlpha: 0.07,
    deskEdgeAlpha: 0.03,
    vignette: 0.032,
    vignetteSpan: 96,
    // 左上斜射光束：一张带 alpha 的暖白图，blit 一次。
    // ⚠ 曾用 8 层同心三角形：每层 alpha 0.0075 只能提亮 0.8/255（bg_base 241 到白共 14 级），
    // 实测量出来完全不可感，却白占 8 个 DrawCall ⇒ 改位图。
    // 图内 alpha 峰值 0.857（241→253 所需）、跳 0–219 共 219 级 ⇒ 无 banding，无需抖动。
    beamW: 400 / 750,
    beamH: 650 / 1334,
    // 陶盆：左下行环境件。宽度按 DESIGN_W 定、高度按图宽高比推导，
    // 底边按锚定高度比例落在地面线上（750×1334 实测：底边距屏底 194）。
    potX: 0.0067,
    potW: 0.140,
    potAspect: 415 / 210,
    potBottom: 0.1454,
    // `[WXG-T-586]` 层板 / 台座 / 落地影 / 光锥 的 8 个参数（`shelfInset` / `shelfH` / `shelfLift` /
    // `riserW` / `riserH` / `shadowW` / `shadowH` / `coneAlpha`）已随 v1 绘制腿删除 ——
    // 这些件全部烘进背板，参数无消费者。
} as const;

/**
 * 背景静态暖层（画在全部内容之下）：整屏木屋背板位 → 否则退回程序化底。
 * `[P0 静态温暖 · 2026-10-31]` 位图腿命中时**不再叠**桌面暖带 / 分界线 / 四角暗角：
 * 这三类已经烘进图里，叠上去会双重压暗（且多 0.51 Mpx 填充）。缺图 ⇒ 原程序化行为逐字不变。
 * 光束与陶盆同理退场：背板里已带左上斜射光与左下陶盆/木箱，再叠会出「双花盆」。
 */
export function drawMenuBackdrop(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    a: MenuAnchors,
): void {
    const hasBackdrop = menuBitmapReady(MENU_TEXTURES.backdrop);
    if (hasBackdrop) {
        // `[WXG-T-585]` 背板 = 750×1334 **整屏烘焙场景**（木屋 / 玻璃柜 / 射灯 / 层板 / 空木牌 /
        // 左右陈设 / 桌面拼豆全在图里）⇒ 只按 1:1 贴，⛔ 不拉高（纵向拉伸会把柜体与圆台拉变形；
        // v1「把背板拉满屏」的腿已随切生产删除）。
        // 先铺一层全屏墙色：背板 + 两条补带之间若出现亚像素缝，也不会透出画布底色（浅米）。
        builder.rect(0, 0, DESIGN_W, a.H, { fill: palette.plaqueFace });
        // 背板不可拉伸（一拉柜体/圆台就变形）。落位判据见 `menuBackdropTopPad`。
        const topPad = menuBackdropTopPad(a.H, a.st, a.btTopY, a.sb);
        const botPad = Math.max(0, a.H - topPad - DESIGN_H);
        if (menuBitmapReady(MENU_TEXTURES.backdropFull)) {
            // `[WXG-T-585]` 甲案：Figma 整张扩图（750×1750）**一次 blit** 覆盖全部机型。
            // 框底 = H − topPad − (E + 1334) ⇒ 图内 y=E 恒落在屏 y=topPad；屏内窗口随 H
            // 自动滑到「上扩 pad + 原 1334 + 下扩 pad」，`MENU_V2.*` 全部 y 读数零改动、零接缝。
            builder.blit(MENU_TEXTURES.backdropFull,
                0, a.H - topPad - (MENU_V2_BG_EXPAND + DESIGN_H),
                DESIGN_W, MENU_V2_BG_H);
        } else {
            // 整图缺失的降级腿：纯色补带 + 原 1334 背板，保证画面不空（正常路径已不需要）。
            if (topPad > 0) builder.rect(0, a.H - topPad, DESIGN_W, topPad, { fill: palette.plaqueFace });
            if (botPad > 0) builder.rect(0, 0, DESIGN_W, botPad, { fill: MENU_V2_DESK_FILL });
            builder.blit(MENU_TEXTURES.backdrop, 0, a.H - topPad - DESIGN_H, DESIGN_W, DESIGN_H);
        }
    } else {
        // 桌面暖带 + 分界线（CTA 后画，会盖住它）
        builder.rect(0, 0, DESIGN_W, MENU_WARM.deskH, {
            fill: palette.woodSheen,
            alpha: MENU_WARM.deskAlpha,
        });
        builder.line(0, MENU_WARM.deskH, DESIGN_W, MENU_WARM.deskH, palette.woodEdge, 1, MENU_WARM.deskEdgeAlpha);
        // 四角暗角：四条边带，把视线压回橱窗
        const v = MENU_WARM.vignette;
        const s = MENU_WARM.vignetteSpan;
        builder.rect(0, 0, DESIGN_W, s, { fill: palette.shadowInk, alpha: v * 0.9 });
        builder.rect(0, a.H - s, DESIGN_W, s, { fill: palette.shadowInk, alpha: v * 0.7 });
        builder.rect(0, 0, s, a.H, { fill: palette.shadowInk, alpha: v * 0.8 });
        builder.rect(DESIGN_W - s, 0, s, a.H, { fill: palette.shadowInk, alpha: v * 0.8 });
    }
    // 左上斜射光束：画在暗角之上（光连边缘一起照亮，否则会被左上两条边带吃掉约 8/255）。
    // 边界与衰减取自 lock-s88 实测（顶边 0.40·W、左边 0.34·H、羽化 170px）。
    // 缺图则该层缺席——光照是润色，不承担任何可读性，⛔ 不用程序化件顶替。
    // 背板自带光照 ⇒ 命中背板时本层不画（否则光束把橱窗中部冲淡）。
    if (!hasBackdrop && menuBitmapReady(MENU_TEXTURES.beam)) {
        builder.blit(MENU_TEXTURES.beam, 0, a.H * (1 - MENU_WARM.beamH),
            DESIGN_W * MENU_WARM.beamW, a.H * MENU_WARM.beamH);
    }
    // 左下陶盆（位图腿）。环境装饰 ⇒ 缺图不画、不占位，也不自造矢量替代件。
    // 背板左下已带陶盆 ⇒ 命中背板时本层不画（否则双花盆压在木箱上）。
    if (!hasBackdrop && menuBitmapReady(MENU_TEXTURES.pot)) {
        const pw = DESIGN_W * MENU_WARM.potW;
        builder.blit(MENU_TEXTURES.pot, DESIGN_W * MENU_WARM.potX,
            a.H * MENU_WARM.potBottom, pw, pw * MENU_WARM.potAspect);
    }
}

export function drawMenuAnchored(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    g: AnchoredMenuGeo,
    withSignage: boolean,
): void {
    drawTopbar(builder, data, palette, g);
    // `[WXG-T-585]` 背板已烘「橱窗木框 + 玻璃 + 射灯 + 层板 + 圆台 + 空木牌」⇒ 程序化柜体系列
    // （落地影 / 窗框 / 层板木托 / 射灯光晕 / 虚线空槽）整体退场，否则双框、双台座、双层板。
    // ⚠ 2026-11-07 切生产后这些 v1 件已从代码删除（`drawCaseShadow` / `drawCaseStage` /
    // `drawCaseLight` / `drawShowcaseItem` / `MENU_CASE_INTERIOR_BAKED` 分支）。
    // 资源条嵌在橱窗顶部（v3.6）：覆盖楣的上 46 px。
    drawResourceBar(builder, data, palette, g.barBox);
    // 走马灯（落地单 §8）：窗框不动，豆画 + 盖章在玻璃内水平滑，裁到 clipBox。
    const state: MetaBossState =
        data.carouselState ?? (data.carouselLevel !== undefined ? 'cleared' : data.maxUnlockedLevel > 0 ? 'pushing' : 'locked');
    const slide = data.reduceMotion ? 0 : (data.carouselDx ?? 0);
    const travel = data.carouselT ?? 0;
    builder.clip(g.clipBox.x, g.clipBox.y, g.clipBox.w, g.clipBox.h);
    // 单一作品腿：台面/内景/射灯已烘进背板 ⇒ 只画一件作品（无光晕/徽章/沙漏/层板）。
    drawShowcaseArt(builder, palette, g, data.carouselLevel, state, slide,
        data.reduceMotion ? 1 - travel : 1, data.carouselComingSoon === true, data.carouselTextureId,
        data.carouselArcDone, data.carouselArcTotal);
    if ((data.carouselPeer !== undefined || data.carouselPeerComingSoon === true) && travel > 0) {
        const sign = data.carouselPeerSign ?? (slide < 0 ? 1 : -1);
        const peerDx = data.reduceMotion ? 0 : slide + sign * g.clipBox.w;
        drawShowcaseArt(
            builder, palette, g, data.carouselPeer, data.carouselPeerState ?? 'cleared',
            peerDx, data.reduceMotion ? travel : 1, data.carouselPeerComingSoon === true,
            data.carouselPeerTextureId, data.carouselPeerArcDone, data.carouselPeerArcTotal,
        );
    }
    builder.unclip();
    // `[WXG-T-585]` 通关章（玻璃右上 90×89.5）：只在「已通关 / 满星」两态盖，
    // 锁定与推关不盖（进度已达意，⛔ 不等于盖章）。
    if (g.sealBox !== undefined && (state === 'cleared' || state === 'fullstar')
        && menuBitmapReady(MENU_TEXTURES.seal)) {
        builder.blit(MENU_TEXTURES.seal, g.sealBox.x, g.sealBox.y, g.sealBox.w, g.sealBox.h);
    }
    // 木牌板固定。文字按 travel 两段淡变（先出后进，不重叠）。
    // `[WXG-T-585]` 背板已烘空白木牌本体 ⇒ 本体 blit 退场（再贴一次会盖住烘好的牌面与铆钉），只留两行文字。
    {
        const fade = plateFade(travel);
        if (data.carouselComingSoon === true) drawComingSoonPlate(builder, g, palette, fade[0]);
        // `[WXG-T-598]` 木牌只吃关名 + 关序；门票 ★ / 大关 N/M 两组读数自木牌退场（选关页仍有），
        // 故不再往下传进度实参。
        else if (data.carouselLevel !== undefined) drawPlateTitle(builder, data.carouselLevel, g, palette, fade[0]);
        if (data.carouselPeerComingSoon === true) drawComingSoonPlate(builder, g, palette, fade[1]);
        else if (data.carouselPeer !== undefined) drawPlateTitle(builder, data.carouselPeer, g, palette, fade[1]);
    }
    // ◀▶ 翻页（热区 = `carousel-prev/next`；无热区语义 ⇒ 壳侧处理）。
    drawArrow(builder, data, g.arrowL, 'left');
    drawArrow(builder, data, g.arrowR, 'right');
    // 招牌：位图优先（`ui_menu_signboard` 1098×722，绳 118）；缺 ⇒ beadText / 系统字体回落
    // （两腿互斥，同静态档；中心 = signBox 中心）。`ui_menu_logo` 960×772 的 v1 件已随切生产退场。
    if (menuBitmapReady(MENU_TEXTURES.signboard)) {
        builder.blit(MENU_TEXTURES.signboard, g.signBox.x, g.signBox.y, g.signBox.w, g.signBox.h);
    } else if (withSignage) {
        // 字样居中于板心（图顶 − boardCyOff），非图框中心（图框含绳，板心偏下）。
        // `[WXG-T-587]` 板心由「绳高 + 板体高」现算（`MENU_PLACEMENT` 单一真源），
        // ⛔ 不再读 `MENU_SIGN_FRAME.boardCyOff` —— 那枚是 v1 的读数（298 高图取 216），
        // 换 v2 的 361 高图后会偏高 ≈23 px（WXG-T-586 登记的同批缺陷）。
        const signCy = g.signBox.y + g.signBox.h
            - (MENU_PLACEMENT.boardOff + (MENU_PLACEMENT.signH - MENU_PLACEMENT.boardOff) / 2);
        const beads = drawBeadText(builder, COPY_TOKENS.app_name, signCy, SIGN_MATRIX_N, SIGN_BEAD_PITCH);
        if (beads === 0) {
            builder.text(DESIGN_W / 2, signCy, COPY_TOKENS.app_name, {
                fill: palette.text,
                font: UI_FONT.title,
                align: 'center',
                baseline: 'middle',
            });
        }
    }
    // slogan 已退场（落地单 v3.5，用户 2026-10-15 裁：五档坐标图本无此元素，SE 档板→条仅 19px 放不下）。
    // CTA：**整枚位图**（源图 756×358 恰为目标尺寸，「开始」已烘进图）+ 浏览态文字；缺 ⇒ 旧纸钮。
    // 按下：pressed 源纹自带台面下移（D=16 源 px，⛔ 不再叠运行时位移）⇒ 文案按 D/源高 同比下沉；
    // 缺 pressed 纹 ⇒ normal 纹 + 运行时下沉（与纸钮同口径）。
    // ⚠ 2026-11-07 切生产后 `ui_btn_start_9s` 九宫腿与 `ctaLabel` 艺术字腿已删除（v2 件非九宫、文字已烘）。
    const ctaPressed = isPressed(data, 'start');
    if (menuBitmapReady(MENU_TEXTURES.ctaV2)) {
        const bakedPress = ctaPressed && menuBitmapReady(MENU_TEXTURES.ctaPressedV2);
        const dy = bakedPress ? 0 : pressDy(data, ctaPressed);
        builder.blit(bakedPress ? MENU_TEXTURES.ctaPressedV2 : MENU_TEXTURES.ctaV2,
            g.ctaBox.x, g.ctaBox.y + dy, g.ctaBox.w, g.ctaBox.h);
        // `[WXG-T-593]` 2026-11-07 用户令「去掉『继续 · 第N关』字样」：整枚 CTA 位图**已烘「开始」**，
        // 任何再叠字都会与烙字压在一起（旧逻辑在离开起点页时叠 `继续 · 第{n}关`）⇒ **恒不叠字**。
        // `textDy`（按下态同比例下沉的写字基准）随之退役 —— 无文字消费方；
        // `carouselOnStartPage` / `startLevelSeq` 字段保留（走马灯其它语义仍用），但 CTA 不再消费。
    } else {
        drawButton(builder, palette, g.ctaBox.x, g.ctaBox.y + pressDy(data, ctaPressed), g.ctaBox.w, g.ctaBox.h, 'accent', 14, label('start', data), UI_FONT.button, ctaPressed);
    }
    // `[WXG-T-432]` 好友榜入口原为 CTA 左侧纸钮（T1 纸面 + 文字），`WXG-T-487` 上提为顶栏圆钮，
    // 绘制已并入 `drawTopbar`（第四枚），此处不再画左下文字钮。
    // `[WXG-T-497]` 版本号已迁设置页脚（`settings-content::drawSettingsAbout`）⇒ 本页不再画，
    // 屏底净空带维持无文字（不注册热区）。
}

