/**
 * SettingsContent — 设置内容块（ADR-0032 §4，UI-30）。
 *
 * 菜单设置弹窗的**按钮集 / 档位文案 / 按钮绘制**单源（v1.8 起 11 钮 = 6 行 × 2 列）。
 * 几何仍住 `view/meta-layout.ts`（`settingsPlate` + `settingsContentButtons`），
 * 本件只负责菜单档的 ghost 纸钮语言与文案。
 *
 * ⛔ 不持有任何状态：数据由宿主每帧投影（L5）；布局由调用方传入的 plate 派生。
 */
import type { RenderModelBuilder } from '@wxgame/framework';
import {
    BEAD_SIZE_LABELS,
    TOUCH_MIN,
    beadStyleLabel,
    type BeadSizeKind,
} from '../config/tuning.js';
import { skinLabel } from '../config/skins/registry.js';
import { COPY_TOKENS } from '../config/copy-tokens.js';
import type { BeadsPalette } from './palette.js';
import { UI_FONT, pressOffset } from './ui-theme.js';
import { drawButton } from './ui-widgets.js';

/**
 * `[WXG-T-434]` E4 幽灵符号开关。v1.8（WXG-T-934）起随暂停面板去设置化迁入菜单设置
 * ⇒ 与其余 10 个设置动作同住 `MENU_ORDER`（菜单 11 钮 = 6 行 × 2 列，末行 Debug 单钮）。
 */
export type SettingsAction =
    | 'toggle-bgm'
    | 'toggle-sfx'
    | 'toggle-reduce-motion'
    | 'toggle-large-text'
    | 'toggle-vibrate'
    | 'toggle-debug-info'
    | 'cycle-bead-style'
    | 'cycle-bead-size'
    | 'cycle-skin'
    | 'toggle-debug-guides'
    | 'toggle-ghost-symbol';

/** 宿主投影：设置弹窗与暂停面板的同名字段子集（结构兼容，⛔ 不复制对象）。 */
export interface SettingsContentData {
    readonly bgmMuted: boolean;
    readonly sfxMuted: boolean;
    readonly reduceMotion: boolean;
    readonly largeText: boolean;
    readonly vibrate: boolean;
    readonly debugInfo: boolean;
    readonly debugGuides: boolean;
    /**
     * `[WXG-T-434]` E4 幽灵符号开关。**可选**：缺省 = 关（旧夹具免填；
     * 判读一律用真值判断，⛔ 不写 `=== false`）。
     */
    readonly ghostSymbol?: boolean;
    readonly beadStyle: string;
    readonly beadSize: BeadSizeKind;
    readonly skinId: string;
    /** 当前按住的钮（只读；无则 `null`）。 */
    readonly pressed?: { readonly id: string } | null;
}

export interface SettingsBox {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}

export interface SettingsButton {
    readonly id: SettingsAction;
    readonly box: SettingsBox;
}

/**
 * 内容块**列几何单源**（WXG-T-363）：设置弹窗 11 钮与装扮馆卡区共读这一套列宽/列间/内缩，
 * ⛔ 第二套列宽（`view/skins-content.ts::skinCardBoxes` 是本件之外唯一的消费者）。
 * 数值 = 工作树实测读数（`metaLayout('settings')` 首行左格 `{x:115,y:857,w:248,h:88}`）的由来，⛔ 顺手改。
 */
export const SETTINGS_GRID = Object.freeze({
    /** 行首内缩（左右同值 ⇒ 行宽 = plate.w − 2×本值）。 */
    sideInset: 40,
    /** 列间距。 */
    colGap: 24,
    /** 列数。 */
    cols: 2,
    /** 首行钮下缘距 plate 底缘（= `plate.y + plate.h − 170`，避让实算见 `meta-view::settingsLayout` 注）。 */
    firstRowFromBottom: 170,
    /**
     * `[WXG-T-497]` 页脚「关于」中线距 plate 底缘。返回钮下缘 = 50（`meta-layout::settingsLayout`）、
     * 页脚 28px 字面上下缘 = 30±14 ⇒ 与返回钮净空 6px、距板底 16px（⛔ 不注册热区）。
     */
    footerFromBottom: 30,
});

/**
 * 菜单变体顺序：**11 钮 = 6 行 × 2 列**（前 5 行 = 10 项玩家设置，末行 = Debug 单钮左对齐）。
 * ⚠ 改动顺序会重排设置弹窗的按钮位置与金样本 ⇒ 需同批重抓夹具。
 * `[WXG-T-934]` v1.8：幽灵符号随暂停面板去设置化迁入本表；末行单钮 = Debug（dev/QA 工具）。
 */
const MENU_ORDER: readonly SettingsAction[] = [
    'toggle-bgm',
    'toggle-sfx',
    'toggle-reduce-motion',
    'toggle-large-text',
    'toggle-vibrate',
    'toggle-debug-info',
    'cycle-bead-style',
    'cycle-bead-size',
    'toggle-ghost-symbol',
    'cycle-skin',
    'toggle-debug-guides',
];

/**
 * 设置动作**全集**（= 排布表；保留 `isSettingsAction` 作为 type guard，
 * ⛔ 不得再从暂停面板另开一份排布表）。
 */
const ACTION_SET: ReadonlySet<string> = new Set<string>(MENU_ORDER);

export function isSettingsAction(id: string): id is SettingsAction {
    return ACTION_SET.has(id);
}

/**
 * 菜单版式：plate 内 80 边距、列间 24、行距 12（[WXG-T-339] 由 −150 / +16 收紧，修「标题压首行」；
 * 避让实算与三处净空 12 见 `meta-view::settingsLayout` 注）。
 */
export function settingsContentButtons(plate: SettingsBox): SettingsButton[] {
    const rowW = plate.w - SETTINGS_GRID.sideInset * 2;
    const rowX = plate.x + SETTINGS_GRID.sideInset;
    const colGap = SETTINGS_GRID.colGap;
    const colW = (rowW - colGap * (SETTINGS_GRID.cols - 1)) / SETTINGS_GRID.cols;
    const topY = plate.y + plate.h - SETTINGS_GRID.firstRowFromBottom;
    const out: SettingsButton[] = [];
    for (let i = 0; i < MENU_ORDER.length; i++) {
        const col = i % 2;
        const row = (i / 2) | 0;
        out.push({
            id: MENU_ORDER[i]!,
            box: {
                x: rowX + col * (colW + colGap),
                y: topY - row * (TOUCH_MIN + 12),
                w: colW,
                h: TOUCH_MIN,
            },
        });
    }
    return out;
}

/**
 * 档位文案单源（菜单设置弹窗）。
 * 风格 / 尺寸 / 皮肤名走各自注册表（⛔ 不写死款数，U16=甲）。
 */
export function settingsContentLabel(id: SettingsAction, data: SettingsContentData): string {
    switch (id) {
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
        case 'toggle-debug-info':
            return `性能信息  ${data.debugInfo ? '开' : '关'}`;
        case 'cycle-bead-style':
            return `珠子风格  ${beadStyleLabel(data.beadStyle)}`;
        case 'cycle-bead-size':
            return `豆子尺寸  ${BEAD_SIZE_LABELS[data.beadSize] ?? data.beadSize}`;
        case 'cycle-skin':
            return `皮肤  ${skinLabel(data.skinId)}`;
        case 'toggle-debug-guides':
            return `Debug  ${data.debugGuides ? '开' : '关'}`;
        case 'toggle-ghost-symbol':
            return `幽灵符号  ${data.ghostSymbol ? '开' : '关'}`;
    }
}

/** 画内容块；非设置动作（返回 / 在线导入）由调用方自己画。 */
export function drawSettingsContent(
    builder: RenderModelBuilder,
    data: SettingsContentData,
    palette: BeadsPalette,
    buttons: readonly { readonly id: string; readonly box: SettingsBox }[],
): void {
    for (let i = 0; i < buttons.length; i++) {
        const b = buttons[i]!;
        if (!isSettingsAction(b.id)) continue;
        const pressed = data.pressed?.id === b.id;
        const wide = b.id === 'cycle-bead-style' || b.id === 'cycle-bead-size';
        drawButton(
            builder,
            palette,
            b.box.x,
            b.box.y + pressOffset(pressed, data.reduceMotion),
            b.box.w,
            b.box.h,
            'ghost',
            14,
            settingsContentLabel(b.id, data),
            wide ? UI_FONT.cell : UI_FONT.button,
            pressed,
            false,
        );
    }
}

/**
 * `[WXG-T-497]` 设置页脚「关于」= 版本号唯一落点（用户 2026-10-29：「版本信息放到设置里 / 关于信息」）。
 * 主菜单屏底那份已随本批删除 ⇒ 全局不再有第二处版本号。
 * 只读信息行：**不注册热区**，也不参与任何开关/循环。
 */
export function drawSettingsAbout(builder: RenderModelBuilder, palette: BeadsPalette, plate: SettingsBox): void {
    builder.text(plate.x + plate.w / 2, plate.y + SETTINGS_GRID.footerFromBottom, `关于 · ${COPY_TOKENS.version_label}`, {
        fill: palette.textDim,
        font: UI_FONT.label,
        align: 'center',
        baseline: 'middle',
    });
}
