/**
 * SettingsContent — 设置内容块（ADR-0032 §4，UI-30）。
 *
 * 菜单设置弹窗的**按钮集 / 档位文案 / 按钮绘制 / 可视窗与滚动几何**单源
 * （v1.9 起复用关卡详情木牌 581×1044；11 钮 = 6 行 × 2 列）。
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
    TOUCH_MIN,
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
 * 内容块**列几何单源**（WXG-T-363）：设置弹窗与装扮馆卡区共读这一套列宽/列间/内缩，
 * ⛔ 第二套列宽（`view/skins-content.ts::skinCardBoxes` 是本件之外唯一的消费者）。
 * 列宽 248 的由来是旧 600×820 纸面板；木牌宽 581 ⇒ 列宽 238.5（⛔ 顺手改 `sideInset` / `colGap`）。
 */
export const SETTINGS_GRID = Object.freeze({
    /** 行首内缩（左右同值 ⇒ 行宽 = plate.w − 2×本值）。 */
    sideInset: 40,
    /** 列间距。 */
    colGap: 24,
    /** 列数。 */
    cols: 2,
    /** 行距。 */
    rowGap: 12,
    /**
     * `[WXG-T-935]` 中间**可视窗**上缘距木牌顶缘：标题槽（稿 `cyDown 278`、字高 64）下缘
     * ≈ 板顶 −112−32 = −144 ⇒ 取 220 留 76 净空；下缘距板底 162（返回钮上缘 = 板底 +138，
     * 净空 24）。窗高 = 1044 − 220 − 162 = 662；11 钮 6 行实高 588 ⇒ 当前不触发滚动。
     */
    viewTopInset: 220,
    viewBottomInset: 162,
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
 * 菜单版式：按钮从**木牌中间可视窗上缘**往下排（两列、行距 12）。
 * `[WXG-T-935]` 底板换成关卡详情木牌 581×1044 ⇒ 旧 `firstRowFromBottom = 170` 会顶进标题槽，
 * 改由 {@link SETTINGS_GRID.viewTopInset} 定首行上缘。
 */
export function settingsContentButtons(plate: SettingsBox): SettingsButton[] {
    const rowW = plate.w - SETTINGS_GRID.sideInset * 2;
    const rowX = plate.x + SETTINGS_GRID.sideInset;
    const colGap = SETTINGS_GRID.colGap;
    const colW = (rowW - colGap * (SETTINGS_GRID.cols - 1)) / SETTINGS_GRID.cols;
    const topY = plate.y + plate.h - SETTINGS_GRID.viewTopInset - TOUCH_MIN;
    const out: SettingsButton[] = [];
    for (let i = 0; i < MENU_ORDER.length; i++) {
        const col = i % 2;
        const row = (i / 2) | 0;
        out.push({
            id: MENU_ORDER[i]!,
            box: {
                x: rowX + col * (colW + colGap),
                y: topY - row * (TOUCH_MIN + SETTINGS_GRID.rowGap),
                w: colW,
                h: TOUCH_MIN,
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

/** 6 行按钮的纵向总高（行高 + 行距；⛔ 含返回 / 导入）。 */
export function settingsContentHeight(): number {
    const rows = Math.ceil(MENU_ORDER.length / SETTINGS_GRID.cols);
    return rows * TOUCH_MIN + (rows - 1) * SETTINGS_GRID.rowGap;
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
        builder.text(x + w / 2, y + h / 2, text, {
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
        builder.text(x + w / 2, y + h / 2, text, {
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
 * 画内容块；非设置动作（返回 / 在线导入）由调用方自己画。
 *
 * `[WXG-T-935]` `scroll` = 已上滚的设计 px（内容整体上移）；传 `viewport` 时逐钮做**手工裁剪**
 * （裁掉的部分不画、部分露出的钮只画可见矩形且不画字）——⛔ 不用 `builder.clip`：
 * 弹窗在容器内，Cocos 端会画到容器外（ADR-0033 / `ui-container-order` 硬门）。
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
        const wide = b.id === 'cycle-bead-style' || b.id === 'cycle-bead-size';
        const y = b.box.y + pressOffset(pressed, data.reduceMotion) - scroll;
        if (viewport) {
            const bottom = y;
            const top = y + b.box.h;
            if (bottom >= vTop || top <= vBottom) continue;
            if (bottom < vBottom || top > vTop) {
                // 部分露出：只画可见矩形（方角 = 被窗缘截断），字等整枚露出再画。
                const iy = Math.max(bottom, vBottom);
                const iTop = Math.min(top, vTop);
                builder.rect(b.box.x, iy, b.box.w, iTop - iy, {
                    fill: pressed ? palette.woodFacePressed : palette.woodFace,
                });
                continue;
            }
        }
        drawSettingsWoodButton(
            builder,
            palette,
            b.box.x,
            y,
            b.box.w,
            b.box.h,
            settingsContentLabel(b.id, data),
            wide ? UI_FONT.cell : UI_FONT.button,
            pressed,
        );
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
