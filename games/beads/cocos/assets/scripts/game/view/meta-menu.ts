/**
 * MetaView 主菜单页（WXG-T-420 T7 切出）：顶栏 / 资源条 / 走马灯橱窗 / 木牌 / CTA。
 * 几何一律取自 `meta-layout.ts` 的锚定档，控件画法取自 `meta-widgets.ts` ⇒ 页面只编排、不另算。
 */

import { DESIGN_W, type MenuAnchors, MENU_ARROW_ICON, MENU_BAR_ICON_D, MENU_BOSS_ART_D, MENU_CTA_LABEL, MENU_CTA_PRESSED_D, MENU_CTA_SLICE, MENU_CTA_SRC_H, MENU_DONE_ICON, MENU_LOCK_D, MENU_PLAQUE_BEVEL_INSET, MENU_PLAQUE_ICON_INSET, MENU_PLAQUE_RIVET_INSET, MENU_PLAQUE_RIVET_R, MENU_PLAQUE_STROKE, MENU_PLATE, MENU_PLATE_TITLE, MENU_PROGRESS, MENU_SEAL, MENU_SIGNIN_DOT_R, MENU_SIGN_FRAME, MENU_TEXTURES, MENU_TOPBAR_ICON_D, MENU_TOPBAR_ROW2_DY, MENU_TOPBAR_VISUAL_D, MENU_TOPBAR_X, SIGN_BEAD_PITCH, SIGN_MATRIX_N, TOUCH_MIN, UI_CONTAINER, WALL_SLOT_DASH, WALL_SLOT_DASH_GAP } from '../config/tuning';
import { COPY_TOKENS } from '../config/copy-tokens';
import { ARC_COMING_SOON } from '../config/arcs';
import { plateFade } from '../config/menu-carousel';
import { nineSliceFx, type RenderModelBuilder } from '../../framework/index';
import { beadFadedInksFor, type BeadsPalette } from './palette';
import { drawBeadText, drawLevelThumb } from './menu-signage';
import { drawGear } from './play-page';
import { type BeadsLevelRaw } from '../config/levels-data';
import { UI_FONT } from './ui-theme';
import { drawButton } from './ui-widgets';
import type { AnchoredMenuGeo } from './meta-layout';
import type { Box, MetaBossState, MetaViewData } from './meta-types';
import { heartBarLabel, isPressed, label, menuBitmapReady, pressDy } from './meta-widgets';
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
    shelfInset: 10,
    shelfH: 12,
    // 层板对齐 Boss 图**可视底部**（不是 clip 底）：l9 原图 alpha bbox 44..211/256、
    // MENU_BOSS_ART_D 540、doneCy 偏移 394 ⇒ 可视底 = clipBox.y + 114。
    // 换 Boss 图（不同 bbox）时需重标此值，否则作品会悬空或压住台面。
    shelfLift: 114,
    riserW: 240,
    riserH: 16,
    shadowW: 300,
    shadowH: 16,
    coneAlpha: 0.018,
} as const;

/**
 * 背景静态暖层（画在全部内容之下）：桌面暖带 + 左上斜射光束 + 四角暗角 + 陶盆。
 * 全部低对比、零动画 ⇒ 首帧/状态变化才重绘（脏帧门控照常生效）。
 */
export function drawMenuBackdrop(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    a: MenuAnchors,
): void {
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
    // 左上斜射光束：画在暗角之上（光连边缘一起照亮，否则会被左上两条边带吃掉约 8/255）。
    // 边界与衰减取自 lock-s88 实测（顶边 0.40·W、左边 0.34·H、羽化 170px）。
    // 缺图则该层缺席——光照是润色，不承担任何可读性，⛔ 不用程序化件顶替。
    if (menuBitmapReady(MENU_TEXTURES.beam)) {
        builder.blit(MENU_TEXTURES.beam, 0, a.H * (1 - MENU_WARM.beamH),
            DESIGN_W * MENU_WARM.beamW, a.H * MENU_WARM.beamH);
    }
    // 左下陶盆（位图腿）。环境装饰 ⇒ 缺图不画、不占位，也不自造矢量替代件。
    if (menuBitmapReady(MENU_TEXTURES.pot)) {
        const pw = DESIGN_W * MENU_WARM.potW;
        builder.blit(MENU_TEXTURES.pot, DESIGN_W * MENU_WARM.potX,
            a.H * MENU_WARM.potBottom, pw, pw * MENU_WARM.potAspect);
    }
}

/** 橱窗落地投影（画在窗框之前，只露出框下缘）。 */
function drawCaseShadow(builder: RenderModelBuilder, palette: BeadsPalette, g: AnchoredMenuGeo): void {
    const { caseBox } = g;
    builder.rect(caseBox.x + caseBox.w * 0.2, caseBox.y - 10, caseBox.w * 0.6, 20, {
        fill: palette.shadowInk,
        alpha: 0.07,
        radius: 10,
    });
}

/** 橱窗陈列层（画在作品之后）：层板 + 木托 + 接触阴影。 */
function drawCaseStage(builder: RenderModelBuilder, palette: BeadsPalette, g: AnchoredMenuGeo): void {
    const { clipBox } = g;
    const cx = clipBox.x + clipBox.w / 2;
    const shelfY = clipBox.y + MENU_WARM.shelfLift;
    builder.rect(clipBox.x + MENU_WARM.shelfInset, shelfY,
        clipBox.w - MENU_WARM.shelfInset * 2, MENU_WARM.shelfH, {
            fill: palette.woodSheen,
            radius: 6,
        });
    builder.line(clipBox.x + MENU_WARM.shelfInset, shelfY,
        clipBox.x + clipBox.w - MENU_WARM.shelfInset, shelfY, palette.woodEdge, 1, 0.55);
    builder.rect(cx - MENU_WARM.riserW / 2, shelfY + MENU_WARM.shelfH - 4,
        MENU_WARM.riserW, MENU_WARM.riserH, {
            fill: palette.woodFace,
            alpha: 0.45,
            radius: MENU_WARM.riserH / 2,
        });
    builder.rect(cx - MENU_WARM.shadowW / 2, shelfY + MENU_WARM.shelfH,
        MENU_WARM.shadowW, MENU_WARM.shadowH, {
            fill: palette.shadowInk,
            alpha: 0.10,
            radius: MENU_WARM.shadowH / 2,
        });
}

/** 橱窗射灯光锥（画在作品之后）：两层圆叠出中心提亮，被 clip 裁到玻璃内。 */
function drawCaseLight(builder: RenderModelBuilder, palette: BeadsPalette, g: AnchoredMenuGeo): void {
    const { clipBox } = g;
    const cx = clipBox.x + clipBox.w / 2;
    builder.circle(cx, clipBox.y + clipBox.h * 0.68, clipBox.w * 0.42, {
        fill: palette.woodText,
        alpha: MENU_WARM.coneAlpha,
    });
    builder.circle(cx, clipBox.y + clipBox.h * 0.72, clipBox.w * 0.26, {
        fill: palette.woodText,
        alpha: MENU_WARM.coneAlpha * 0.7,
    });
}

export function drawMenuAnchored(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    g: AnchoredMenuGeo,
    withSignage: boolean,
): void {
    drawTopbar(builder, data, palette, g);
    drawCaseShadow(builder, palette, g);
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
    // 射灯光晕先于作品：只落在背板上，不改变作品本身颜色（避免在平涂块上出硬弧）。
    drawCaseLight(builder, palette, g);
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
    drawCaseStage(builder, palette, g);
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
        // `[WXG-T-490]` 浏览态（§5.4 条 4）：艺术字切图恒写「开始游戏」⇒ 离开起点页时不画，
        // 让位下方文字腿（`label('start')` 已切 `继续 · 第{n}关`）；缺省字段 = 起点页 ⇒ 逐字不变。
        if (data.carouselOnStartPage !== false && menuBitmapReady(MENU_TEXTURES.ctaLabel)) {
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
    // `[WXG-T-432]` 好友榜入口原为 CTA 左侧纸钮（T1 纸面 + 文字），`WXG-T-487` 上提为顶栏圆钮，
    // 绘制已并入 `drawTopbar`（第四枚），此处不再画左下文字钮。
    // `[WXG-T-497]` 版本号已迁设置页脚（`settings-content::drawSettingsAbout`）⇒ 本页不再画，
    // 屏底净空带维持无文字（不注册热区）。
}

