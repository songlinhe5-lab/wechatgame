/**
 * SettingsContent — 设置内容块（ADR-0032 §4，UI-30）。
 *
 * 设置弹窗与暂停面板共用的三件：**按钮集 / 档位文案 / 按钮绘制**。
 * 版式按场景出变体：`menu`（5 行 × 2 列，设置弹窗，UI-30）与 `pause`（五行，
 * UI-31）。版式几何仍住 `systems/pause-panel.ts`（§8：布局与命中纯函数就地保留），
 * 本件只负责**同一种钮在两个场景画成各自的语言**：菜单档 = ghost 纸钮，
 * 暂停档 = 开关 chip（选中木底）/ 选择器纸钮。
 *
 * ⛔ 不持有任何状态：数据由宿主每帧投影（L5）；布局由调用方传入的 plate 派生。
 */
import type { RenderModelBuilder } from '../../framework/index';
import {
    BEAD_SIZE_LABELS,
    TOUCH_MIN,
    UI_CONTAINER,
    beadStyleLabel,
    type BeadSizeKind,
} from '../config/tuning';
import { skinLabel } from '../config/skins/registry';
import type { BeadsPalette } from './palette';
import { UI_FONT, pressOffset } from './ui-theme';
import { drawButton } from './ui-widgets';

/**
 * 内容块里的设置动作（顺序即绘制 / 命中顺序）。
 * `open-skins`（WXG-T-363）= 装扮馆入口，**已于 WXG-T-365 上提顶栏中档**（提案 P4-甲）
 * ⇒ 不在本排布表里（顶栏 = 无字圆钮，⛔ 文案通道）；行5 左格回到 `cycle-skin`（循环切已买断肤）。
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
    | 'toggle-debug-guides';

/** 宿主投影：设置弹窗与暂停面板的同名字段子集（结构兼容，⛔ 不复制对象）。 */
export interface SettingsContentData {
    readonly bgmMuted: boolean;
    readonly sfxMuted: boolean;
    readonly reduceMotion: boolean;
    readonly largeText: boolean;
    readonly vibrate: boolean;
    readonly debugInfo: boolean;
    readonly debugGuides: boolean;
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
 * 内容块**列几何单源**（WXG-T-363）：设置弹窗 10 钮与装扮馆卡区共读这一套列宽/列间/内缩，
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
});

/**
 * 菜单变体顺序：**10 钮 = 5 行 × 2 列**（末行 = 皮肤循环钮 + Debug）。
 * ⚠ 改动顺序会重排设置弹窗的按钮位置与金样本 ⇒ 需同批重抓夹具。
 * 行5 左格曾于 WXG-T-363 临时换为 `open-skins`（当时顶栏入口未落），**WXG-T-365 已回退**：
 * 文案 / 几何 / 字档 / 色逐字回到该批之前，而动作 id 不进 RenderModel 指令流
 * ⇒ `settings` 金样本逐字不变（实测：本批改后对拍仍绿）。
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
    'cycle-skin',
    'toggle-debug-guides',
];

// ⚠ `MENU_ORDER` 只管**设置弹窗的排布**；暂停面板行4 的换肤循环钮仍属 SettingsAction（UI-31 由
// `view-model::isSettingsAction` 逐钮派发到 chip 小字档）⇒ 排布表与全集可以不等。
// 漏成员的代价实测可见（WXG-T-363）：`isSettingsAction('cycle-skin')` 判假 ⇒ 暂停面板该钮
// 落回通用主/次钮腿（字档 22px → bold 30px），`pause` 金样本整帧漂。
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
 * 档位文案单源：设置弹窗 `meta-view::label` 与暂停面板 `view-model::panelLabel` 同串。
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
    }
}

/** 暂停档的开关族 = chip 钮（选中 = 木底白字）。 */
const PAUSE_CHIPS: ReadonlySet<string> = new Set<string>([
    'toggle-bgm',
    'toggle-sfx',
    'toggle-reduce-motion',
    'toggle-large-text',
    'toggle-vibrate',
    'toggle-debug-info',
]);

/** 暂停档的小字族（长文案：3 格单元放不下标准 30px 字面）。 */
const PAUSE_SMALL_FONT: ReadonlySet<string> = new Set<string>([
    'toggle-reduce-motion',
    'toggle-large-text',
    'toggle-vibrate',
    'toggle-debug-info',
    'cycle-bead-style',
    'cycle-bead-size',
    'cycle-skin',
]);

function chipOn(id: SettingsAction, data: SettingsContentData): boolean {
    switch (id) {
        case 'toggle-bgm':
            return !data.bgmMuted;
        case 'toggle-sfx':
            return !data.sfxMuted;
        case 'toggle-reduce-motion':
            return data.reduceMotion;
        case 'toggle-large-text':
            return data.largeText;
        case 'toggle-vibrate':
            return data.vibrate;
        case 'toggle-debug-info':
            return data.debugInfo;
        default:
            return false;
    }
}

/**
 * 暂停档：画**一枚**设置钮（几何由 `systems/pause-panel.ts` 传入的静止态盒子 × 缩放后坐标）。
 * 逐钮调用而非整块，是为了让调用方按旧顺序穿插非设置钮（继续 / 重玩 / 回主菜单）——
 * 指令流逐字不变，金样本零差异。
 */
export function drawPauseSettingButton(
    builder: RenderModelBuilder,
    data: SettingsContentData,
    palette: BeadsPalette,
    id: SettingsAction,
    x: number,
    y: number,
    w: number,
    h: number,
    pressed: boolean,
): void {
    const label = settingsContentLabel(id, data);
    const font = PAUSE_SMALL_FONT.has(id) ? UI_FONT.panelToggle : UI_FONT.panelButton;
    const by = y + pressOffset(pressed, data.reduceMotion);
    if (PAUSE_CHIPS.has(id)) {
        const on = chipOn(id, data);
        builder.rect(x, by, w, h, {
            fill: on ? (pressed ? palette.woodFacePressed : palette.woodFace) : pressed ? palette.cardPressed : palette.panel,
            ...(on ? {} : { stroke: palette.panelBorder, lineWidth: UI_CONTAINER.strokePanel }),
            radius: UI_CONTAINER.radiusChip,
        });
        builder.text(x + w / 2, by + h / 2, label, {
            fill: on ? palette.woodText : palette.textDim,
            font,
            align: 'center',
            baseline: 'middle',
        });
        return;
    }
    // 选择器钮：T1 纸钮，值字面即状态（screens.md §143）。
    drawButton(builder, palette, x, by, w, h, 'paper', UI_CONTAINER.radiusCard, label, font, pressed);
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
