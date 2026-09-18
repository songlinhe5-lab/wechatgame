/**
 * MetaView — the shell's out-of-run screens (WXG-T-164 批0): 主菜单 + 签到 / 设置
 * overlay. Pure render + hit-test geometry, in the same spirit as
 * `systems/pause-panel.ts`: **holds no state**, reads a flat {@link MetaViewData}
 * the shell assembles each frame from `MetaState` + `BeadsGame` getters (L5).
 *
 * Render and hit-testing share {@link metaLayout}, so the picture and the hot
 * zones can never drift apart. Layouts are cached per overlay (computed once).
 *
 * Frozen sources: ux-spec v1.7 §2 (主菜单 = shell 屏、overlay 栈 设置/签到),
 * systems-index v1.28 §3.14 (体力/币/签到语义). Geometry here is 派生 (batch-0
 * functional layout; 参考图精修归后续批次), mirrored constants live in `tuning.ts`.
 */

import {
    DESIGN_H,
    DESIGN_W,
    MENU_PRIMARY_W,
    MENU_ROW_GAP,
    MENU_SECONDARY_W,
    SIGNIN_REWARDS,
    TOUCH_MIN,
} from '../config/tuning';
import type { RenderModelBuilder } from '../../framework/index';
import type { BeadsPalette } from './palette';
import type { SigninReward } from '../game/meta-state';

export type MetaOverlay = 'none' | 'signin' | 'settings';

/** Everything the meta screens draw, assembled read-only by the shell. */
export interface MetaViewData {
    readonly stamina: number;
    readonly staminaMax: number;
    readonly coins: number;
    readonly overlay: MetaOverlay;
    /** 当日签到格（`claims % 7`）。 */
    readonly signinDay: number;
    readonly canClaim: boolean;
    // settings overlay（复用 S9 五开关，ux-spec v1.7 §2）
    readonly bgmMuted: boolean;
    readonly sfxMuted: boolean;
    readonly reduceMotion: boolean;
    readonly largeText: boolean;
    readonly vibrate: boolean;
}

/** A tappable control on a meta screen. */
export type MetaAction =
    | 'start'
    | 'open-signin'
    | 'open-settings'
    | 'back'
    | 'claim'
    | 'toggle-bgm'
    | 'toggle-sfx'
    | 'toggle-reduce-motion'
    | 'toggle-large-text'
    | 'toggle-vibrate';

interface Box {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}

export interface MetaButton {
    readonly id: MetaAction;
    readonly box: Box;
}

export interface MetaLayout {
    readonly buttons: readonly MetaButton[];
    /** 签到 overlay 的 7 个日期格（只读展示，非按钮）。 */
    readonly signinCells: readonly Box[];
}

function box(x: number, y: number, w: number, h: number): Box {
    return { x, y, w, h };
}

function inBox(b: Box, x: number, y: number): boolean {
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

// ─────────────────────────────────────────────────────────── cached layouts

const _layouts = new Map<MetaOverlay, MetaLayout>();

const FONT_TITLE = '64px sans-serif';
const FONT_BUTTON = '30px sans-serif';
const FONT_SMALL = '24px sans-serif';
const FONT_CELL = '22px sans-serif';

/** Panel plate shared by both overlays (centred, below the capsule-avoid band). */
const OVERLAY_W = 600;
const OVERLAY_H = 720;

function overlayPlate(): Box {
    return box((DESIGN_W - OVERLAY_W) / 2, (DESIGN_H - OVERLAY_H) / 2, OVERLAY_W, OVERLAY_H);
}

function menuLayout(): MetaLayout {
    const cx = DESIGN_W / 2;
    const buttons: MetaButton[] = [];
    // 主钮「开始游戏」
    const primaryY = 700;
    buttons.push({ id: 'start', box: box(cx - MENU_PRIMARY_W / 2, primaryY, MENU_PRIMARY_W, TOUCH_MIN) });
    // 次级入口：签到 / 设置（并排居中）
    const secY = primaryY - TOUCH_MIN - MENU_ROW_GAP;
    const gap = 30;
    const total = MENU_SECONDARY_W * 2 + gap;
    const left = cx - total / 2;
    buttons.push({ id: 'open-signin', box: box(left, secY, MENU_SECONDARY_W, TOUCH_MIN) });
    buttons.push({ id: 'open-settings', box: box(left + MENU_SECONDARY_W + gap, secY, MENU_SECONDARY_W, TOUCH_MIN) });
    return { buttons, signinCells: [] };
}

function signinLayout(): MetaLayout {
    const plate = overlayPlate();
    const buttons: MetaButton[] = [];
    const cells: Box[] = [];
    // 7 格：4 + 3 居中排布。
    const cellSize = 110;
    const cellGap = 18;
    const rowTopY = plate.y + plate.h - 150;
    for (let i = 0; i < SIGNIN_REWARDS.length; i++) {
        const row = i < 4 ? 0 : 1;
        const col = row === 0 ? i : i - 4;
        const perRow = row === 0 ? 4 : 3;
        const rowW = perRow * cellSize + (perRow - 1) * cellGap;
        const x = plate.x + (plate.w - rowW) / 2 + col * (cellSize + cellGap);
        const y = rowTopY - row * (cellSize + cellGap);
        cells.push(box(x, y, cellSize, cellSize));
    }
    // 领取 + 返回
    const btnW = 240;
    const btnY = plate.y + 60;
    const gap = 30;
    const total = btnW * 2 + gap;
    const left = plate.x + (plate.w - total) / 2;
    buttons.push({ id: 'claim', box: box(left, btnY, btnW, TOUCH_MIN) });
    buttons.push({ id: 'back', box: box(left + btnW + gap, btnY, btnW, TOUCH_MIN) });
    return { buttons, signinCells: cells };
}

function settingsLayout(): MetaLayout {
    const plate = overlayPlate();
    const buttons: MetaButton[] = [];
    const rowW = plate.w - 80;
    const rowX = plate.x + 40;
    const ids: MetaAction[] = [
        'toggle-bgm',
        'toggle-sfx',
        'toggle-reduce-motion',
        'toggle-large-text',
        'toggle-vibrate',
    ];
    const topY = plate.y + plate.h - 150;
    for (let i = 0; i < ids.length; i++) {
        buttons.push({ id: ids[i]!, box: box(rowX, topY - i * (TOUCH_MIN + 16), rowW, TOUCH_MIN) });
    }
    // 返回
    const backW = 240;
    buttons.push({
        id: 'back',
        box: box(plate.x + (plate.w - backW) / 2, plate.y + 50, backW, TOUCH_MIN),
    });
    return { buttons, signinCells: [] };
}

/** Cached layout for one overlay. */
export function metaLayout(overlay: MetaOverlay): MetaLayout {
    let layout = _layouts.get(overlay);
    if (!layout) {
        layout = overlay === 'signin' ? signinLayout() : overlay === 'settings' ? settingsLayout() : menuLayout();
        _layouts.set(overlay, layout);
    }
    return layout;
}

/** Resolve a tap on the current screen; `null` when nothing is hit. */
export function hitTestMeta(overlay: MetaOverlay, x: number, y: number): MetaAction | null {
    for (const b of metaLayout(overlay).buttons) {
        if (inBox(b.box, x, y)) return b.id;
    }
    return null;
}

// ─────────────────────────────────────────────────────────────── rendering

function label(id: MetaAction, data: MetaViewData): string {
    switch (id) {
        case 'start':
            return '开始游戏';
        case 'open-signin':
            return '签到';
        case 'open-settings':
            return '设置';
        case 'claim':
            return data.canClaim ? '领取' : '已领取';
        case 'back':
            return '返回';
        case 'toggle-bgm':
            return `音乐  ${data.bgmMuted ? '关' : '开'}`;
        case 'toggle-sfx':
            return `音效  ${data.sfxMuted ? '关' : '开'}`;
        case 'toggle-reduce-motion':
            return `减弱动效  ${data.reduceMotion ? '开' : '关'}`;
        case 'toggle-large-text':
            return `大字号  ${data.largeText ? '开' : '关'}`;
        case 'toggle-vibrate':
            return `震动  ${data.vibrate ? '开' : '关'}`;
        default:
            return '';
    }
}

function drawButton(
    builder: RenderModelBuilder,
    b: Box,
    text: string,
    palette: BeadsPalette,
    primary: boolean,
    disabled = false,
): void {
    builder.rect(b.x, b.y, b.w, b.h, {
        fill: primary ? palette.accentPrimary : palette.slot,
        stroke: primary ? palette.accentPrimary : palette.slotBorder,
        lineWidth: 2,
        radius: 14,
        ...(disabled ? { alpha: 0.5 } : {}),
    });
    builder.text(b.x + b.w / 2, b.y + b.h / 2, text, {
        fill: primary ? palette.panel : palette.text,
        font: FONT_BUTTON,
        align: 'center',
        baseline: 'middle',
    });
}

/** Draw the resource bar (体力 ❤ / 币 🪙) — shared by menu + overlays. */
function drawResourceBar(builder: RenderModelBuilder, data: MetaViewData, palette: BeadsPalette): void {
    const y = DESIGN_H - 180; // 胶囊避让带（y≥1214）之下
    builder.text(40, y, `❤ ${data.stamina}/${data.staminaMax}`, {
        fill: palette.text,
        font: FONT_SMALL,
        align: 'left',
        baseline: 'middle',
    });
    builder.text(DESIGN_W - 40, y, `🪙 ${data.coins}`, {
        fill: palette.text,
        font: FONT_SMALL,
        align: 'right',
        baseline: 'middle',
    });
}

/** Render one frame of the shell's meta screens. Read-only over `data`. */
export function buildMetaView(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
): void {
    builder.setBackground(palette.background);
    if (data.overlay === 'none') {
        drawResourceBar(builder, data, palette);
        builder.text(DESIGN_W / 2, 980, '拼豆', {
            fill: palette.text,
            font: FONT_TITLE,
            align: 'center',
            baseline: 'middle',
        });
        for (const b of metaLayout('none').buttons) {
            drawButton(builder, b.box, label(b.id, data), palette, b.id === 'start');
        }
        return;
    }

    // Overlay：先压暗底层菜单，再画面板。
    builder.rect(0, 0, DESIGN_W, DESIGN_H, { fill: 'rgba(0,0,0,0.5)' });
    const plate = overlayPlate();
    builder.rect(plate.x, plate.y, plate.w, plate.h, { fill: palette.panel, radius: 24 });
    builder.text(plate.x + plate.w / 2, plate.y + plate.h - 70, data.overlay === 'signin' ? '七日签到' : '设置', {
        fill: palette.text,
        font: '40px sans-serif',
        align: 'center',
        baseline: 'middle',
    });

    const layout = metaLayout(data.overlay);
    if (data.overlay === 'signin') {
        for (let i = 0; i < layout.signinCells.length; i++) {
            const cell = layout.signinCells[i]!;
            const reward: SigninReward = SIGNIN_REWARDS[i]!;
            const claimed = i < data.signinDay || (i === data.signinDay && !data.canClaim);
            const today = i === data.signinDay;
            builder.rect(cell.x, cell.y, cell.w, cell.h, {
                fill: claimed ? palette.slot : palette.panel,
                stroke: today ? palette.accentPrimary : palette.slotBorder,
                lineWidth: today ? 4 : 2,
                radius: 12,
                ...(claimed ? { alpha: 0.6 } : {}),
            });
            const rewardText = reward.hearts > 0 ? `❤${reward.hearts}` : `🪙${reward.coins}`;
            builder.text(cell.x + cell.w / 2, cell.y + cell.h / 2 + 12, `第${i + 1}天`, {
                fill: palette.textDim,
                font: FONT_CELL,
                align: 'center',
                baseline: 'middle',
            });
            builder.text(cell.x + cell.w / 2, cell.y + cell.h / 2 - 16, claimed ? '✓' : rewardText, {
                fill: claimed ? palette.success : palette.text,
                font: FONT_CELL,
                align: 'center',
                baseline: 'middle',
            });
        }
    }

    for (const b of layout.buttons) {
        const primary = b.id === 'claim';
        const disabled = b.id === 'claim' && !data.canClaim;
        drawButton(builder, b.box, label(b.id, data), palette, primary, disabled);
    }
}
