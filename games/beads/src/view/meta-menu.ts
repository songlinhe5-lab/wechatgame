/**
 * MetaView 主菜单页（WXG-T-420 T7 切出）：顶栏 / 资源条 / 走马灯橱窗 / 木牌 / CTA。
 * 几何一律取自 `meta-layout.ts` 的锚定档，控件画法取自 `meta-widgets.ts` ⇒ 页面只编排、不另算。
 */

import { DESIGN_W, MENU_ARROW_ICON, MENU_BAR_ICON_D, MENU_BOSS_ART_D, MENU_CTA_LABEL, MENU_CTA_PRESSED_D, MENU_CTA_SLICE, MENU_CTA_SRC_H, MENU_DONE_ICON, MENU_LOCK_D, MENU_PLAQUE_BEVEL_INSET, MENU_PLAQUE_ICON_INSET, MENU_PLAQUE_RIVET_INSET, MENU_PLAQUE_RIVET_R, MENU_PLAQUE_STROKE, MENU_PLATE, MENU_PLATE_TITLE, MENU_PROGRESS, MENU_SEAL, MENU_SIGNIN_DOT_R, MENU_SIGN_FRAME, MENU_TEXTURES, MENU_TOPBAR_ICON_D, MENU_TOPBAR_VISUAL_D, MENU_TOPBAR_X, SIGN_BEAD_PITCH, SIGN_MATRIX_N, TOUCH_MIN, UI_CONTAINER, WALL_SLOT_DASH, WALL_SLOT_DASH_GAP } from '../config/tuning.js';
import { COPY_TOKENS } from '../config/copy-tokens.js';
import { ARC_COMING_SOON } from '../config/arcs.js';
import { plateFade } from '../config/menu-carousel.js';
import { nineSliceFx, type RenderModelBuilder } from '@wxgame/framework';
import { beadFadedInksFor, type BeadsPalette } from './palette.js';
import { drawBeadText, drawLevelThumb } from './menu-signage.js';
import { drawGear } from './play-page.js';
import { type BeadsLevelRaw } from '../config/levels-data.js';
import { UI_FONT } from './ui-theme.js';
import { drawButton } from './ui-widgets.js';
import type { AnchoredMenuGeo } from './meta-layout.js';
import type { Box, MetaBossState, MetaViewData } from './meta-types.js';
import { heartBarLabel, isPressed, label, menuBitmapReady, pressDy } from './meta-widgets.js';
function drawResourceBar(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    g: Box,
): void {
    const x = g.x;
    const y = g.y;
    const cy = y + g.h / 2;
    builder.rect(x, y, g.w, g.h, {
        fill: palette.plaqueFace,
        stroke: palette.plaqueEdge,
        lineWidth: MENU_PLAQUE_STROKE,
        radius: UI_CONTAINER.radiusChip,
    });
    // 上沿受光线（与描边同档宽）：坐在顶缘描边**内侧**，⛔ 压住圆角段。
    const sheenY = y + g.h - MENU_PLAQUE_STROKE;
    builder.line(
        x + MENU_PLAQUE_BEVEL_INSET, sheenY,
        x + g.w - MENU_PLAQUE_BEVEL_INSET, sheenY,
        palette.plaqueBevel, MENU_PLAQUE_STROKE,
    );
    builder.circle(x + MENU_PLAQUE_RIVET_INSET, cy, MENU_PLAQUE_RIVET_R, { fill: palette.plaqueBevel });
    builder.circle(x + g.w - MENU_PLAQUE_RIVET_INSET, cy, MENU_PLAQUE_RIVET_R, { fill: palette.plaqueBevel });
    const staminaIcon = MENU_TEXTURES.iconStamina;
    const coinIcon = MENU_TEXTURES.iconCoin;
    if (menuBitmapReady(staminaIcon) && menuBitmapReady(coinIcon)) {
        const d = MENU_BAR_ICON_D;
        // 铆钉在端缘内 18、半径 3.5。图标从铆钉外缘再让 6，避免心/星压住点。
        const iconX = MENU_PLAQUE_RIVET_INSET + MENU_PLAQUE_RIVET_R + 6;
        builder.blit(staminaIcon, x + iconX, cy - d / 2, d, d);
        builder.blit(coinIcon, x + g.w - iconX - d, cy - d / 2, d, d);
        builder.text(x + iconX + d + 8, cy, heartBarLabel(data.stamina, data.staminaMax, data.heartAdsLeft), {
            fill: palette.woodText,
            font: UI_FONT.label,
            align: 'left',
            baseline: 'middle',
        });
        builder.text(x + g.w - iconX - d - 8, cy, `${data.coins}`, {
            fill: palette.woodText,
            font: UI_FONT.label,
            align: 'right',
            baseline: 'middle',
        });
    } else {
        builder.text(x + MENU_PLAQUE_ICON_INSET, cy, `❤ ${heartBarLabel(data.stamina, data.staminaMax, data.heartAdsLeft)}`, {
            fill: palette.woodText,
            font: UI_FONT.label,
            align: 'left',
            baseline: 'middle',
        });
        builder.text(x + g.w - MENU_PLAQUE_ICON_INSET, cy, `${data.coins} 🪙`, {
            fill: palette.woodText,
            font: UI_FONT.label,
            align: 'right',
            baseline: 'middle',
        });
    }
}

/**
 * L6 顶栏三钮（§5.1b 落位表）。视觉圆 Ø80 居中于 88×88 热区（推导 2：热区不得互叠）。
 * - **左上 设置**（实装）= 白圆 + 齿轮，齿轮画法与对局页 HUD **同一函数**
 *   （§5.1b 收口 ③：裁的是「入口语义不合并」，不是图元不复用 ⇒ 零新画法、零新美术）；
 * - **右上 信箱**（2026-10-22 用户裁：签到入口回归）= 正常态白圆 + `ui_icon_mail`（切图已交付）
 *   + 按下纹；`canClaim` ⇒ 右上 1 枚小圆点（`MENU_SIGNIN_DOT_R`，全局唯一提示位）。
 *   ⛔ 程序化腿**不自造信封图标**（切图规格 B2/B3 权威）⇒ 缺图只留空圆底；
 *   ⛔ 该位不加红点（全局唯一提示位 = 信封小圆点）。
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
    // ── 签到信封（2026-10-22 用户裁：入口回归；已领当日仍可打开看进度）──
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
    const mailIcon = MENU_TEXTURES.iconMail;
    if (menuBitmapReady(mailIcon)) {
        const id = MENU_TOPBAR_ICON_D;
        builder.blit(mailIcon, mcx - id / 2, mcy - id / 2, id, id);
    }
    // ⛔ 程序化腿不自造信封图标（切图规格 B2/B3 权威）⇒ 缺图只留空圆底，不画替代图形。
    // 未领小圆点：全局唯一提示位（不铺红点/不闪烁；色读既有 `danger`，零新 hex）。
    if (data.canClaim) {
        builder.circle(mcx + r * 0.72, mcy + r * 0.72, MENU_SIGNIN_DOT_R, {
            fill: palette.danger,
            stroke: palette.panel,
            lineWidth: 2,
        });
    }
    // ── 装扮馆入口（`[WXG-T-365]` · 提案 P4-甲 = 原公告预留位升格，坐标零改动）──
    // 与设置 / 信封三同构：底圆 + 按下纹 + 40² 图标；⛔ 程序化腿不自造图标（信封判例
    // = 形状归切图规格权威）⇒ 缺图只留空圆底。
    // ⚠ 图标暂用该位原有的 `MENU_TEXTURES.iconSound`（喇叭）顶替 ⇒ 语义错位属已知代价
    // `[待 UI 设计]`（用户 2026-10-24 令「先用原入口图标代替，晚点再对 UI 设计」）。
    const skx = MENU_TOPBAR_X.skins + TOUCH_MIN / 2;
    const skinsPressed = isPressed(data, 'open-skins');
    const skcy = cy + pressDy(data, skinsPressed);
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
    const skinsIcon = MENU_TEXTURES.iconSound;
    if (menuBitmapReady(skinsIcon)) {
        const id = MENU_TOPBAR_ICON_D;
        builder.blit(skinsIcon, skx - id / 2, skcy - id / 2, id, id);
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
 * 橱窗 ◀▶（`[WXG-T-280]` 落地单 §3）：位图腿 = `btnArrow` 底 + 向标 icon；未就绪 ⇒
 * 程序化圆 + ◀/▶ 字模（同纸格语言，零新 hex）。几何由 {@link anchoredGeo} 传入，本函数不复算。
 */
function drawArrow(
    builder: RenderModelBuilder,
    data: MetaViewData,
    b: Box,
    dir: 'left' | 'right',
    palette: BeadsPalette,
): void {
    const pressed = isPressed(data, dir === 'left' ? 'carousel-prev' : 'carousel-next');
    // `[BD-62]` 边界隐藏：首张不画 ◀、末张不画 ▶（与 `_nudge` 的 clamp 语义一致）。
    if (dir === 'left' ? data.carouselFirst : data.carouselLast) return;
    const dy = pressDy(data, pressed);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2 + dy;
    const iconTex = dir === 'left' ? MENU_TEXTURES.iconArrowLeft : MENU_TEXTURES.iconArrowRight;
    if (menuBitmapReady(MENU_TEXTURES.btnArrow)) {
        const bg = pressed && menuBitmapReady(MENU_TEXTURES.btnArrowPressed) ? MENU_TEXTURES.btnArrowPressed : MENU_TEXTURES.btnArrow;
        builder.blit(bg, b.x, b.y + dy, b.w, b.h);
        if (menuBitmapReady(iconTex)) {
            const iw = MENU_ARROW_ICON.w;
            const ih = MENU_ARROW_ICON.h;
            builder.blit(iconTex, cx - iw / 2, cy - ih / 2, iw, ih);
            return;
        }
    } else {
        builder.circle(cx, cy, b.w / 2, {
            fill: pressed ? palette.cardPressed : palette.panel,
            stroke: palette.panelBorder,
            lineWidth: 2,
        });
    }
    builder.text(cx, cy, dir === 'left' ? '◀' : '▶', {
        fill: palette.text,
        font: UI_FONT.button,
        align: 'center',
        baseline: 'middle',
    });
}

/**
 * 锚定主菜单（`[WXG-T-280]` shell 实链路；施工依据 = 落地单 v3.4 §3）。
 * 每个元素两条腿：位图就绪（{@link setMenuBitmapResolver} 宿主注入）⇒ blit；缺 ⇒ 既有程序化图元。
 * 热区全走 {@link menuLayoutAnchored}（与 `g` 同源），本函数内⛔ 不新建任何命中面。
 * 层序：资源条 → 顶栏 → 橱窗框 → Boss 图位（白板+图）→ 三态徽标 → 木牌 → ◀▶ → 招牌 → slogan → CTA → 版本号。
 */
/**
 * 玻璃里的一项：Boss 原图 + 三态盖章，整体平移 `dx`。原图未装上才回退豆阵。
 * `alpha` < 1 只在 `reduceMotion` 的交叉淡变里出现。
 */
function drawShowcaseItem(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    g: AnchoredMenuGeo,
    level: BeadsLevelRaw | undefined,
    state: MetaBossState,
    dx: number,
    alpha: number,
    comingSoon: boolean,
    textureId?: string,
): void {
    if (alpha <= 0) return;
    const ink = alpha < 1 ? alpha : undefined;
    if (comingSoon) {
        drawComingSoonMark(builder, palette, MENU_DONE_ICON.cx + dx, g.doneCy, ink);
        return;
    }
    if (level !== undefined && textureId !== undefined && menuBitmapReady(textureId)) {
        const d = MENU_BOSS_ART_D;
        builder.blit(
            textureId,
            MENU_DONE_ICON.cx + dx - d / 2,
            g.doneCy - d / 2,
            d, d,
            ink === undefined ? undefined : { alpha: ink },
        );
    } else if (level !== undefined) {
        drawLevelThumb(
            builder, level, g.bossBox.x + dx, g.bossBox.y, g.bossBox.w, g.bossBox.h,
            Math.max(level.rows, level.cols), g.bossBox.w,
            state === 'locked' ? beadFadedInksFor(level) : undefined,
            ink,
        );
    } else {
        drawDashedSocket(builder, { x: g.bossBox.x + dx, y: g.bossBox.y, w: g.bossBox.w, h: g.bossBox.h }, palette.slotDashed);
    }
    const cx = MENU_DONE_ICON.cx + dx;
    const cy = g.doneCy;
    if (state === 'cleared') {
        const top = g.clipBox.y + g.clipBox.h;
        const x = g.clipBox.x + g.clipBox.w - MENU_SEAL.inset - MENU_SEAL.w + dx;
        const y = top - MENU_SEAL.inset - MENU_SEAL.h;
        if (menuBitmapReady(MENU_TEXTURES.sealCleared)) {
            builder.blit(MENU_TEXTURES.sealCleared, x, y, MENU_SEAL.w, MENU_SEAL.h, ink === undefined ? undefined : { alpha: ink });
        } else {
            builder.circle(x + MENU_SEAL.w / 2, y + MENU_SEAL.h / 2, 28, { fill: palette.panel, stroke: palette.success, lineWidth: 2 });
            builder.text(x + MENU_SEAL.w / 2, y + MENU_SEAL.h / 2, '通', {
                fill: palette.success, font: UI_FONT.button, align: 'center', baseline: 'middle',
                ...(ink === undefined ? {} : { alpha: ink }),
            });
        }
        return;
    }
    const locked = state === 'locked';
    const tex = locked ? MENU_TEXTURES.badgeLocked : MENU_TEXTURES.badgeProgress;
    if (menuBitmapReady(tex)) {
        if (locked) {
            builder.blit(tex, cx - MENU_LOCK_D / 2, cy - MENU_LOCK_D / 2, MENU_LOCK_D, MENU_LOCK_D, ink === undefined ? undefined : { alpha: ink });
        } else {
            const w = MENU_PROGRESS.w;
            const h = MENU_PROGRESS.h;
            // 源图重心不在外接框中心：my 从图片顶边量起，设计空间 y 向上。
            builder.blit(tex, cx - MENU_PROGRESS.mx * w, cy - (1 - MENU_PROGRESS.my) * h, w, h, ink === undefined ? undefined : { alpha: ink });
        }
        return;
    }
    const d = locked ? MENU_LOCK_D : 160;
    builder.circle(cx, cy, d / 2, {
        fill: locked ? palette.slot : palette.accentPrimary,
        stroke: locked ? palette.slotBorder : palette.accentPrimary,
        lineWidth: 2,
    });
    builder.text(cx, cy, locked ? '锁' : '推', {
        fill: locked ? palette.textDim : palette.panel,
        font: UI_FONT.button, align: 'center', baseline: 'middle',
    });
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

/** 木牌上的「敬请期待」。`alpha` ≤ 0 不画。 */
function drawComingSoonPlate(
    builder: RenderModelBuilder,
    g: AnchoredMenuGeo,
    palette: BeadsPalette,
    alpha: number,
): void {
    if (alpha <= 0) return;
    const top = g.plateBox.y + g.plateBox.h;
    const a = alpha < 1 ? alpha : undefined;
    builder.text(MENU_PLATE.cx, top - MENU_PLATE_TITLE.singleOff, ARC_COMING_SOON, {
        fill: palette.woodEdge,
        font: UI_FONT.button,
        align: 'center',
        baseline: 'middle',
        ...(a === undefined ? {} : { alpha: a }),
    });
}

/** 木牌上的关序 / 关名（有累计星进度件时上移到第一行，进度落第二行）。`alpha` ≤ 0 不画。
 * `[WXG-T-346]` 进度件：两行槽复用 `MENU_PLATE_TITLE.line1Off/line2Off`（在册常量，零新数值）；
 * 数字直接拼 `★ n/门槛`，与顶栏 `❤ n/n` 同族（无新文案令牌）。缺省不传 ⇒ 原单行逐字不变。
 * `[art 批·TODO-8 已裁]` 第二行字号 / 色 = `font_label` 28 + `wood_face`（木牌定尺，⛔ 随 E2 放大，
 * 理由与对比度自证见 `art/specs/menu-layout-implementation-spec.md §10`）。 */
function drawPlateTitle(
    builder: RenderModelBuilder,
    lv: BeadsLevelRaw,
    g: AnchoredMenuGeo,
    palette: BeadsPalette,
    alpha: number,
    starGot?: number,
    starNeed?: number,
): void {
    if (alpha <= 0) return;
    const top = g.plateBox.y + g.plateBox.h;
    const seq = `第 ${lv.id} 关`;
    const a = alpha < 1 ? alpha : undefined;
    if (lv.title && starNeed !== undefined) {
        builder.text(MENU_PLATE.cx, top - MENU_PLATE_TITLE.line1Off, lv.title, {
            fill: palette.woodEdge, font: UI_FONT.button, align: 'center', baseline: 'middle',
            ...(a === undefined ? {} : { alpha: a }),
        });
        builder.text(MENU_PLATE.cx, top - MENU_PLATE_TITLE.line2Off, `★ ${starGot ?? 0}/${starNeed}`, {
            fill: palette.woodFace, font: UI_FONT.sub, align: 'center', baseline: 'middle',
            ...(a === undefined ? {} : { alpha: a }),
        });
    } else if (lv.title) {
        // (b) 有展示名 ⇒ 只画名字、隐关序（用户 2026-10-21 裁；偏离 v3.7「关序+关名两行」原型）。
        builder.text(MENU_PLATE.cx, top - MENU_PLATE_TITLE.singleOff, lv.title, {
            fill: palette.woodEdge, font: UI_FONT.button, align: 'center', baseline: 'middle',
            ...(a === undefined ? {} : { alpha: a }),
        });
    } else {
        builder.text(MENU_PLATE.cx, top - MENU_PLATE_TITLE.singleOff, seq, {
            fill: palette.woodEdge, font: UI_FONT.button, align: 'center', baseline: 'middle',
            ...(a === undefined ? {} : { alpha: a }),
        });
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
    // 展示窗框：位图整件 / 未就绪 ⇒ 虚线空槽（同 §5.4 口径，⛔ 不自造第二套框语言）。
    if (menuBitmapReady(MENU_TEXTURES.caseFrame)) {
        builder.blit(MENU_TEXTURES.caseFrame, g.caseBox.x, g.caseBox.y, g.caseBox.w, g.caseBox.h);
    } else {
        drawDashedSocket(builder, g.caseBox, palette.slotDashed);
    }
    // 资源条嵌在橱窗顶部（v3.6）：画在窗框之后，覆盖楣的上 46 px。
    drawResourceBar(builder, data, palette, g.barBox);
    // 走马灯（落地单 §8）：窗框不动，豆画 + 盖章在玻璃内水平滑，裁到 clipBox。
    const state: MetaBossState =
        data.carouselState ?? (data.carouselLevel !== undefined ? 'cleared' : data.maxUnlockedLevel > 0 ? 'pushing' : 'locked');
    if (!menuBitmapReady(MENU_TEXTURES.caseFrame)) {
        builder.rect(g.bossBox.x, g.bossBox.y, g.bossBox.w, g.bossBox.h, {
            fill: palette.slot,
            stroke: palette.slotBorder,
            lineWidth: 2,
            radius: UI_CONTAINER.radiusChip,
        });
    }
    const slide = data.reduceMotion ? 0 : (data.carouselDx ?? 0);
    const travel = data.carouselT ?? 0;
    builder.clip(g.clipBox.x, g.clipBox.y, g.clipBox.w, g.clipBox.h);
    drawShowcaseItem(builder, palette, g, data.carouselLevel, state, slide, data.reduceMotion ? 1 - travel : 1, data.carouselComingSoon === true, data.carouselTextureId);
    if ((data.carouselPeer !== undefined || data.carouselPeerComingSoon === true) && travel > 0) {
        const sign = data.carouselPeerSign ?? (slide < 0 ? 1 : -1);
        const peerDx = data.reduceMotion ? 0 : slide + sign * g.clipBox.w;
        drawShowcaseItem(
            builder, palette, g, data.carouselPeer, data.carouselPeerState ?? 'cleared',
            peerDx, data.reduceMotion ? travel : 1, data.carouselPeerComingSoon === true,
            data.carouselPeerTextureId,
        );
    }
    builder.unclip();
    // 木牌板固定。文字按 travel 两段淡变（先出后进，不重叠）。
    if (menuBitmapReady(MENU_TEXTURES.plate)) {
        builder.blit(MENU_TEXTURES.plate, g.plateBox.x, g.plateBox.y, g.plateBox.w, g.plateBox.h);
        const fade = plateFade(travel);
        if (data.carouselComingSoon === true) drawComingSoonPlate(builder, g, palette, fade[0]);
        else if (data.carouselLevel !== undefined) drawPlateTitle(builder, data.carouselLevel, g, palette, fade[0], data.arcStarGot, data.arcStarNeed);
        if (data.carouselPeerComingSoon === true) drawComingSoonPlate(builder, g, palette, fade[1]);
        else if (data.carouselPeer !== undefined) drawPlateTitle(builder, data.carouselPeer, g, palette, fade[1]);
    }
    // ◀▶ 翻页（热区 = `carousel-prev/next`；无热区语义 ⇒ 壳侧处理）。
    drawArrow(builder, data, g.arrowL, 'left', palette);
    drawArrow(builder, data, g.arrowR, 'right', palette);
    // 招牌：位图 logo 优先；缺 ⇒ beadText / 系统字体回落（两腿互斥，同静态档；中心 = signBox 中心）。
    if (menuBitmapReady(MENU_TEXTURES.logo)) {
        builder.blit(MENU_TEXTURES.logo, g.signBox.x, g.signBox.y, g.signBox.w, g.signBox.h);
    } else if (withSignage) {
        // 字样居中于板心（图顶 − boardCyOff），非图框中心（图框含绳，板心偏下）。
        const signCy = g.signBox.y + g.signBox.h - MENU_SIGN_FRAME.boardCyOff;
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
    // CTA：九宫格位图（fx 槽 = 唯一拉伸通道）+ 文本；缺 ⇒ 旧纸钮（热区恒 `ctaHit`，与绘制同心）。
    // 按下：pressed 源纹自带台面下移（D=16 源 px，⛔ 不再叠运行时位移）⇒ 文案按 D/源高 同比下沉；
    // 缺 pressed 纹 ⇒ normal 纹 + 运行时下沉（与纸钮同口径）。
    const ctaPressed = isPressed(data, 'start');
    if (menuBitmapReady(MENU_TEXTURES.cta)) {
        const bakedPress = ctaPressed && menuBitmapReady(MENU_TEXTURES.ctaPressed);
        const dy = bakedPress ? 0 : pressDy(data, ctaPressed);
        const textDy = bakedPress ? -Math.round((MENU_CTA_PRESSED_D * g.ctaBox.h) / MENU_CTA_SRC_H) : dy;
        builder.blit(bakedPress ? MENU_TEXTURES.ctaPressed : MENU_TEXTURES.cta, g.ctaBox.x, g.ctaBox.y + dy, g.ctaBox.w, g.ctaBox.h, {
            fx: nineSliceFx(MENU_CTA_SLICE.capX, MENU_CTA_SLICE.capY),
        });
        if (menuBitmapReady(MENU_TEXTURES.ctaLabel)) {
            const lh = MENU_CTA_LABEL.h;
            const lw = lh * MENU_CTA_LABEL.aspect;
            const cx = g.ctaBox.x + g.ctaBox.w / 2;
            const cy = g.ctaBox.y + g.ctaBox.h * (1 - MENU_CTA_LABEL.fromTop) + textDy;
            builder.blit(MENU_TEXTURES.ctaLabel, cx - lw / 2, cy - lh / 2, lw, lh);
        } else {
            builder.text(g.ctaBox.x + g.ctaBox.w / 2, g.ctaBox.y + g.ctaBox.h / 2 + textDy, label('start', data), {
                fill: palette.panel,
                font: UI_FONT.button,
                align: 'center',
                baseline: 'middle',
            });
        }
    } else {
        drawButton(builder, palette, g.ctaBox.x, g.ctaBox.y + pressDy(data, ctaPressed), g.ctaBox.w, g.ctaBox.h, 'accent', 14, label('start', data), UI_FONT.button, ctaPressed);
    }
    // `[WXG-T-432]` 好友榜入口：CTA 左侧纸钮（T1 纸面；标签为菜单侧短名）。
    const rankPressed = isPressed(data, 'open-rank');
    drawButton(
        builder, palette, g.rankBox.x, g.rankBox.y + pressDy(data, rankPressed),
        g.rankBox.w, g.rankBox.h, 'paper', UI_CONTAINER.radiusCard,
        '好友榜', UI_FONT.button, rankPressed,
    );
    builder.text(DESIGN_W / 2, g.versionY, COPY_TOKENS.version_label, {
        fill: palette.textDim,
        font: UI_FONT.label,
        align: 'center',
        baseline: 'middle',
    });
}

