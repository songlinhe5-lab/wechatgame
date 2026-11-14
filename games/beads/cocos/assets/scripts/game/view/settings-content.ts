/**
 * SettingsContent — 设置内容块（ADR-0032 §4，UI-30）。
 *
 * 菜单设置弹窗的**按钮集 / 档位文案 / 按钮绘制 / 可视窗与滚动几何**单源
 * （v1.9 起复用关卡详情木牌 581×1044；11 钮 = 单列 11 行，可滚）。
 * 几何仍住 `view/meta-layout.ts`（`levelDetailPlate` + `settingsContentButtons`），
 * 本件只负责菜单档的厚木钮语言（`[WXG-T-938]`）与文案。
 *
 * ⛔ 不持有任何状态：数据由宿主每帧投影（L5）；布局由调用方传入的 plate 派生。
 */
import { nineSliceFx, type RenderModelBuilder } from '../../framework/index';
import {
    BEAD_SIZE_LABELS,
    MENU_TEXTURES,
    SETTINGS_BTN_SLICE,
    beadStyleLabel,
    type BeadSizeKind,
} from '../config/tuning';
import { skinLabel } from '../config/skins/registry';
import { COPY_TOKENS } from '../config/copy-tokens';
import { withAlpha, type BeadsPalette } from './palette';
import { UI_FONT, pressOffset } from './ui-theme';
import { menuBitmapReady } from './bitmap-ready';
import { drawButton } from './ui-widgets';

/**
 * `[WXG-T-434]` E4 幽灵符号开关。v1.8（WXG-T-934）起随暂停面板去设置化迁入菜单设置
 * ⇒ 与其余 10 个设置动作同住 `MENU_ORDER`（菜单 11 钮 = 单列 11 行，末行 Debug）。
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
 * 内容块**列几何单源**（WXG-T-363）：设置弹窗与装扮馆卡区共读这一套列宽/列间/内缩，
 * ⛔ 第二套列宽（`view/skins-content.ts::skinCardBoxes` 是本件之外唯一的消费者）。
 * 列宽 248 的由来是旧 600×820 纸面板；木牌宽 581 ⇒ 列宽 238.5（⛔ 顺手改 `sideInset` / `colGap`）。
 */
export const SETTINGS_GRID = Object.freeze({
    /** 行首内缩（左右同值 ⇒ 行宽 = plate.w − 2×本值）。Figma cell 509 宽 ⇒ (581−509)/2 = 36。 */
    sideInset: 36,
    /** 列间距（单列后不参与布局，保留给共读的装扮馆卡区列宽公式）。 */
    colGap: 24,
    /** 列数（Figma `设置列表` = 单列 cell）。 */
    cols: 1,
    /** 行距（Figma cell pitch 150 − 高 138）。 */
    rowGap: 12,
    /** 单行 cell 高（Figma `设置项cell` 509×138）。 */
    rowH: 138,
    /**
     * 中间**可视窗**（Figma `设置列表` y∈[372,1116]，木牌顶 166 / 底 1210）：上缘距木牌顶 206，
     * 下缘距木牌底 94（版本胶囊上缘 = 底 +100 ⇒ 不压列表）。窗高 = 1044 − 206 − 94 = 744。
     */
    viewTopInset: 206,
    viewBottomInset: 94,
    /**
     * 版本胶囊中线距木牌底（Figma `版本信息` y 1130..1170 ⇒ 中线 1150，木牌底 1210 ⇒ 60）。
     * 胶囊 300×40 居中，⛔ 不注册热区。
     */
    footerFromBottom: 60,
});

/**
 * 菜单变体顺序：**10 钮 = 单列 10 行**（Figma 设置列表 cell 顺序；Debug 位于末行）。
 * ⚠ 改动顺序会重排设置弹窗的按钮位置与金样本 ⇒ 需同批重抓夹具。
 * `[WXG-T-934]` v1.8：幽灵符号随暂停面板去设置化迁入本表；末行 = Debug（dev/QA 工具）。
 * 2026-11-14：震动前移到大字号之前（Figma 同步）。
 * `[WXG-T-943]` 用户令「设置里面皮肤选项不需要」⇒ `cycle-skin` 行退场（换肤唯一入口 = 顶栏装扮馆）。
 */
const MENU_ORDER: readonly SettingsAction[] = [
    'toggle-bgm',
    'toggle-sfx',
    'toggle-reduce-motion',
    'toggle-vibrate',
    'toggle-large-text',
    'toggle-debug-info',
    'cycle-bead-style',
    'cycle-bead-size',
    'toggle-ghost-symbol',
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
 * 菜单版式：按钮从**木牌中间可视窗上缘**往下排（单列、行距 12）。
 * `[WXG-T-935]` 底板换成关卡详情木牌 581×1044 ⇒ 旧 `firstRowFromBottom = 170` 会顶进标题槽，
 * 改由 {@link SETTINGS_GRID.viewTopInset} 定首行上缘。
 */
export function settingsContentButtons(plate: SettingsBox): SettingsButton[] {
    const rowW = plate.w - SETTINGS_GRID.sideInset * 2;
    const rowX = plate.x + SETTINGS_GRID.sideInset;
    const topY = plate.y + plate.h - SETTINGS_GRID.viewTopInset - SETTINGS_GRID.rowH;
    const out: SettingsButton[] = [];
    for (let i = 0; i < MENU_ORDER.length; i++) {
        out.push({
            id: MENU_ORDER[i]!,
            box: {
                x: rowX,
                y: topY - i * (SETTINGS_GRID.rowH + SETTINGS_GRID.rowGap),
                w: rowW,
                h: SETTINGS_GRID.rowH,
            },
        });
    }
    return out;
}

/** `[WXG-T-935]` 中间可视窗（内容裁剪 / 命中 / 滚动条同读这一个框）。 */
export function settingsContentViewport(plate: SettingsBox): SettingsBox {
    return {
        x: plate.x + SETTINGS_GRID.sideInset,
        y: plate.y + SETTINGS_GRID.viewBottomInset,
        w: plate.w - SETTINGS_GRID.sideInset * 2,
        h: plate.h - SETTINGS_GRID.viewTopInset - SETTINGS_GRID.viewBottomInset,
    };
}

/** 11 行 cell 的纵向总高（行高 + 行距）。 */
export function settingsContentHeight(): number {
    const rows = Math.ceil(MENU_ORDER.length / SETTINGS_GRID.cols);
    return rows * SETTINGS_GRID.rowH + (rows - 1) * SETTINGS_GRID.rowGap;
}

/** 最大滚动量；内容不超窗 ⇒ 0（此时手势被钳住、滚动条不画）。 */
export function settingsScrollMax(plate: SettingsBox): number {
    return Math.max(0, settingsContentHeight() - settingsContentViewport(plate).h);
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

/**
 * `[WXG-T-938]` 设置钮 normal 态 = **选关页底部「关闭」钮同款厚木高光底板**。
 *
 * 底板 `MENU_TEXTURES.btnSettings` = 从 `ui_level_select_close@2x` 派生的**无字** 9-slice
 * （235×210、capX 70；中段取无字木面横向交叉淡化，脚本
 * `design/ai-workflows/derive-settings-btn-9slice.py`）⇒ 厚边 / 木纹 / 高光与选关关闭钮同源。
 * 文字仍程序化（关闭钮的字烘死在图里，11 个档位文案无法复用）⇒ 米白字压深棕投影。
 * 按下：同几何 + `pressOffset` 位移，再叠一层深棕半透明压暗（源图无按下态）。
 * 缺图腿：① 新底板未就绪 ⇒ 退回已进包的 `MENU_TEXTURES.btnWood` 9-slice（过渡，Cocos 端
 * 在 `.meta`/构建补齐前走这条）；② 连 `btnWood` 也无（无宿主注册表 / 单测）⇒ 程序化木钮。
 */
export function drawSettingsWoodButton(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    font: string,
    pressed = false,
): void {
    if (menuBitmapReady(MENU_TEXTURES.btnSettings)) {
        builder.blit(MENU_TEXTURES.btnSettings, x, y, w, h, {
            fx: nineSliceFx(SETTINGS_BTN_SLICE.capX),
        });
        if (pressed) {
            builder.rect(x, y, w, h, { fill: withAlpha(palette.shadowInk, 0.18), radius: 18 });
        }
        if (text !== '') builder.text(x + w / 2, y + h / 2, text, {
            fill: palette.woodText,
            font,
            align: 'center',
            baseline: 'middle',
            shadow: {
                color: withAlpha(palette.shadowInk, 0.55),
                offsetX: 0,
                offsetY: -2,
                blur: 2,
            },
        });
        return;
    }
    // 过渡腿：Cocos 端新图未导入 / 未构建时仍用已进包的 `btnWood`（WXG-T-937 同款），
    // 视觉不低于现状；新图导入并注册后可删本段。
    if (menuBitmapReady(MENU_TEXTURES.btnWood)) {
        const tex = pressed && menuBitmapReady(MENU_TEXTURES.btnWoodPressed)
            ? MENU_TEXTURES.btnWoodPressed
            : MENU_TEXTURES.btnWood;
        builder.blit(tex, x, y, w, h, { fx: nineSliceFx(76) });
        if (text !== '') builder.text(x + w / 2, y + h / 2, text, {
            fill: palette.woodText,
            font,
            align: 'center',
            baseline: 'middle',
            shadow: {
                color: withAlpha(palette.shadowInk, 0.55),
                offsetX: 0,
                offsetY: -2,
                blur: 2,
            },
        });
        return;
    }
    drawButton(builder, palette, x, y, w, h, 'wood', 16, text, font, pressed, false);
}

/**
 * 设置项 cell 的组成（Figma `设置项cell` 语义）：名称 / 提示 / 图标 / 开关。
 * `toggle` = `null` ⇒ 无开关（珠子风格 / 豆子尺寸：值写进提示行）。
 * `[WXG-T-943]` 用户令：Debug / 幽灵符号 / 性能信息**不要第二行**；减弱动效第二行改为作用说明。
 */
export interface SettingsCellParts {
    readonly name: string;
    readonly hint: string;
    readonly toggle: boolean | null;
    readonly icon: 'settingsIconMusic' | 'settingsIconSound' | 'settingsIconMotion' | 'settingsIconVibrate' | null;
}

const ON_OFF = (on: boolean): string => (on ? '开' : '关');

export function settingsCellParts(id: SettingsAction, data: SettingsContentData): SettingsCellParts {
    switch (id) {
        case 'toggle-bgm':
            return { name: '音乐', hint: '启用后，播放应用中的背景音乐', toggle: !data.bgmMuted, icon: 'settingsIconMusic' };
        case 'toggle-sfx':
            return { name: '音效', hint: '启用后，播放应用中的提示音', toggle: !data.sfxMuted, icon: 'settingsIconSound' };
        case 'toggle-reduce-motion':
            return { name: '减弱动效', hint: '启用后，减少界面动效', toggle: data.reduceMotion, icon: 'settingsIconMotion' };
        case 'toggle-vibrate':
            return { name: '震动', hint: '启用后，接收提醒时设备会震动', toggle: data.vibrate, icon: 'settingsIconVibrate' };
        case 'toggle-large-text':
            return { name: '大字号', hint: `当前：${ON_OFF(data.largeText)}`, toggle: data.largeText, icon: null };
        case 'toggle-debug-info':
            return { name: '性能信息', hint: '', toggle: data.debugInfo, icon: null };
        case 'cycle-bead-style':
            return { name: '珠子风格', hint: `当前：${beadStyleLabel(data.beadStyle)}`, toggle: null, icon: null };
        case 'cycle-bead-size':
            return { name: '豆子尺寸', hint: `当前：${BEAD_SIZE_LABELS[data.beadSize] ?? data.beadSize}`, toggle: null, icon: null };
        case 'toggle-ghost-symbol':
            return { name: '幽灵符号', hint: '', toggle: !!data.ghostSymbol, icon: null };
        case 'cycle-skin':
            return { name: '皮肤', hint: `当前：${skinLabel(data.skinId)}`, toggle: null, icon: null };
        case 'toggle-debug-guides':
            return { name: 'Debug', hint: '', toggle: data.debugGuides, icon: null };
    }
}

/** `[WXG-T-943]` 有右侧开关的动作（整行不可点，只有开关热区生效）。 */
const TOGGLE_ACTIONS: ReadonlySet<string> = new Set<string>([
    'toggle-bgm',
    'toggle-sfx',
    'toggle-reduce-motion',
    'toggle-vibrate',
    'toggle-large-text',
    'toggle-debug-info',
    'toggle-ghost-symbol',
    'toggle-debug-guides',
]);

export function isToggleAction(id: string): boolean {
    return TOGGLE_ACTIONS.has(id);
}

/**
 * Figma cell 内部几何（相对 cell 左上，单位设计 px）：图标框 (26,28,74×78)、名称 (124,34)、
 * 提示 (124,108)、开关 (371,26,115×65)。
 * `[WXG-T-942]` 图标件补烘 6px 透明边 + 投影（画布 +12）⇒ 图标框同步放大到 74×78 保持图标视觉尺寸。
 * `[WXG-T-943]` 用户令「第二行文字与开关按钮有冲突，开关往上、文字往下」⇒ 开关 33→26、提示 102→108。
 */
const CELL_ICON = { x: 26, y: 28, w: 74, h: 78 } as const;
const CELL_NAME_X = 124;
const CELL_NAME_CY = 60.5; // 名称框 34..87 中线
const CELL_HINT_CY = 108; // 提示行中线（与开关上下错开）
const CELL_TOGGLE = { x: 371, y: 26, w: 115, h: 65 } as const;

/**
 * `[WXG-T-943]` 开关热区：视觉 115×65 扩到 115×88（TOUCH_MIN 地板），中心与视觉开关一致。
 * 有开关的 cell 只有这块热区可点，整行不响应、不亮按下态。
 */
export function settingsToggleHitBox(cell: SettingsBox): SettingsBox {
    const cy = cell.y + cell.h - CELL_TOGGLE.y - CELL_TOGGLE.h / 2;
    const h = Math.max(CELL_TOGGLE.h, 88);
    return { x: cell.x + CELL_TOGGLE.x, y: cy - h / 2, w: CELL_TOGGLE.w, h };
}

/** 图标按框内等比缩放（Figma FIT）。原图尺寸 = 补投影后的 @2x PNG 像素（原尺寸 + 12）。 */
const ICON_SRC: Readonly<Record<NonNullable<SettingsCellParts['icon']>, { w: number; h: number }>> = {
    settingsIconMusic: { w: 109, h: 115 },
    settingsIconSound: { w: 116, h: 105 },
    settingsIconMotion: { w: 114, h: 125 },
    settingsIconVibrate: { w: 125, h: 127 },
};

/**
 * 画一个设置项 cell（Figma `设置项cell`）：木钮底板 + 图标 + 名称 + 提示 + 开关。
 * 位图未就绪的部件各自降级（不画图标 / 程序化开关），不影响文字与热区。
 */
export function drawSettingsCell(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    data: SettingsContentData,
    id: SettingsAction,
    x: number,
    y: number,
    w: number,
    h: number,
    pressed: boolean,
): void {
    const parts = settingsCellParts(id, data);
    const hasToggle = parts.toggle !== null;
    // `[WXG-T-943]` 有开关的行整行不亮按下态（只有开关热区可点）；无开关的循环行保持整行按压。
    drawSettingsWoodButton(builder, palette, x, y, w, h, '', UI_FONT.button, hasToggle ? false : pressed);
    if (parts.icon !== null) {
        const tex = MENU_TEXTURES[parts.icon];
        if (menuBitmapReady(tex)) {
            const src = ICON_SRC[parts.icon];
            const s = Math.min(CELL_ICON.w / src.w, CELL_ICON.h / src.h);
            const iw = src.w * s;
            const ih = src.h * s;
            const ix = x + CELL_ICON.x + (CELL_ICON.w - iw) / 2;
            const iy = y + h - CELL_ICON.y - CELL_ICON.h + (CELL_ICON.h - ih) / 2;
            builder.blit(tex, ix, iy, iw, ih);
        }
    }
    // `[WXG-T-943]` 用户令「文字和 icon 的阴影效果不够立体」⇒ 名称投影加深 + 右下偏移更大。
    const shadow = { color: withAlpha(palette.shadowInk, 0.95), offsetX: 3, offsetY: -4, blur: 3 };
    builder.text(x + CELL_NAME_X, y + h - CELL_NAME_CY, parts.name, {
        fill: palette.woodText,
        font: UI_FONT.settingsName,
        align: 'left',
        baseline: 'middle',
        shadow,
    });
    if (parts.hint !== '') {
        builder.text(x + CELL_NAME_X, y + h - CELL_HINT_CY, parts.hint, {
            fill: withAlpha(palette.woodText, 0.94),
            font: UI_FONT.settingsHint,
            align: 'left',
            baseline: 'middle',
            shadow: { color: withAlpha(palette.shadowInk, 0.8), offsetX: 2, offsetY: -3, blur: 2 },
        });
    }
    if (parts.toggle !== null) drawSettingsToggle(builder, palette, parts.toggle, x, y, h, pressed);
}

/** 开关：位图就绪 ⇒ 开 / 关整图；否则程序化（圆角轨 + 圆钮）。按下只压暗开关本身。 */
function drawSettingsToggle(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    on: boolean,
    x: number,
    y: number,
    h: number,
    pressed: boolean,
): void {
    const { w, h: th } = CELL_TOGGLE;
    const tx = x + CELL_TOGGLE.x;
    const ty = y + h - CELL_TOGGLE.y - th;
    const tex = on ? MENU_TEXTURES.settingsToggleOn : MENU_TEXTURES.settingsToggleOff;
    if (menuBitmapReady(tex)) {
        builder.blit(tex, tx, ty, w, th);
    } else {
        builder.rect(tx, ty, w, th, { fill: on ? palette.success : withAlpha(palette.shadowInk, 0.7), radius: th / 2 });
        const r = th / 2 - 4;
        const cx = on ? tx + w - th / 2 : tx + th / 2;
        builder.circle(cx, ty + th / 2, r, { fill: palette.woodText });
    }
    if (pressed) builder.rect(tx, ty, w, th, { fill: withAlpha(palette.shadowInk, 0.16), radius: th / 2 });
}

/**
 * 画内容块（设置项 cell 列表）；非设置动作（关闭 / 在线导入）由调用方自己画。
 *
 * `[WXG-T-935]` `scroll` = 已上滚的设计 px（内容整体上移）；传 `viewport` 时只跳过**完全在窗外**的行
 * ——半露行照常整行画，裁切由调用方发 `builder.clip(viewport)` 承担（`[ADR-0037]` 逐容器裁切）。
 */
export function drawSettingsContent(
    builder: RenderModelBuilder,
    data: SettingsContentData,
    palette: BeadsPalette,
    buttons: readonly { readonly id: string; readonly box: SettingsBox }[],
    scroll = 0,
    viewport?: SettingsBox,
): void {
    const vBottom = viewport ? viewport.y : 0;
    const vTop = viewport ? viewport.y + viewport.h : 0;
    for (let i = 0; i < buttons.length; i++) {
        const b = buttons[i]!;
        if (!isSettingsAction(b.id)) continue;
        const pressed = data.pressed?.id === b.id;
        // `[WXG-T-943]` 有开关的行整行不响应 ⇒ 既不亮按下态，也不做按下位移；只有开关自身压暗。
        const sink = pressed && !isToggleAction(b.id) ? pressOffset(pressed, data.reduceMotion) : 0;
        // 滚动量 > 0 ⇒ 内容上移（手指上拖 → 露出下方行）；命中换算见 `hitTestMeta` 的 `y - scroll`。
        const y = b.box.y + sink + scroll;
        // 完全在窗外 ⇒ 不落笔（省绘制）；半露行照画，窗外部分由 `clip` 裁掉。
        if (viewport && (y >= vTop || y + b.box.h <= vBottom)) continue;
        drawSettingsCell(builder, palette, data, b.id, b.box.x, y, b.box.w, b.box.h, pressed);
    }
}

/**
 * `[WXG-T-935]` 可视窗右缘滚动条（内容超窗才画）。轨道贴内容列外侧、木牌右内缩带内，
 * 不与任何钮相交；`scroll / max` 直接映射滑块位置（无缓动，滚动量已由 shell 钳制）。
 */
export function drawSettingsScrollbar(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    viewport: SettingsBox,
    scroll: number,
): void {
    const contentH = settingsContentHeight();
    const max = contentH - viewport.h;
    if (max <= 0) return;
    const x = viewport.x + viewport.w + 10;
    const w = 6;
    const y = viewport.y + 4;
    const h = viewport.h - 8;
    builder.rect(x, y, w, h, { fill: withAlpha(palette.slotBorder, 0.45), radius: 3 });
    const thumbH = Math.max(48, (h * viewport.h) / contentH);
    const t = Math.max(0, Math.min(1, scroll / max));
    builder.rect(x, y + (h - thumbH) * (1 - t), w, thumbH, { fill: palette.textDim, radius: 3 });
}

/**
 * `[WXG-T-497]` 设置页脚 = 版本号唯一落点（用户 2026-10-29：「版本信息放到设置里 / 关于信息」）。
 * 主菜单屏底那份已随本批删除 ⇒ 全局不再有第二处版本号。
 * 只读信息行：**不注册热区**，也不参与任何开关/循环。
 *
 * `[WXG-T-940]` 用户令「调整字号位置字色，提示内容符合标准版本信息格式」⇒
 * 文案 `版本 vX.Y.Z · 演示版`（`version_label` 原样，发布腿仍会剥后缀）；字号 22（`UI_FONT.cell`，
 * 版本行属元数据、不占正文 E1 档）；字色 `woodText` 90%（`textDim` 在木面仅 ≈1.8:1，实测不可读）；
 * 中线上移到 `footerFromBottom 34` 避开木牌底缘厚边。
 */
export function drawSettingsAbout(builder: RenderModelBuilder, palette: BeadsPalette, plate: SettingsBox): void {
    // 胶囊 300×40（Figma `版本信息`）：深木底 85% + 2px 深棕描边 + 米白字（22px）。
    const pw = 300;
    const ph = 40;
    const px = plate.x + (plate.w - pw) / 2;
    const py = plate.y + SETTINGS_GRID.footerFromBottom - ph / 2;
    builder.rect(px, py, pw, ph, {
        fill: withAlpha(palette.woodEdge, 0.85),
        stroke: palette.shadowInk,
        lineWidth: 2,
        radius: ph / 2,
    });
    builder.text(px + pw / 2, py + ph / 2, `版本 ${COPY_TOKENS.version_label}`, {
        fill: withAlpha(palette.woodText, 0.9),
        font: UI_FONT.cell,
        align: 'center',
        baseline: 'middle',
        shadow: { color: withAlpha(palette.shadowInk, 0.85), offsetX: 0, offsetY: -2, blur: 2 },
    });
}
