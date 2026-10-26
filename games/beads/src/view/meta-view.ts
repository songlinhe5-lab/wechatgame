/**
 * MetaView 装配门面 — the shell's out-of-run screens (WXG-T-164 批0)：主菜单 + 选关整页 +
 * 签到 / 设置 / 装扮馆 overlay。**WXG-T-420 T7** 起本文件只做「页面表 + 编排」，切片落位：
 *
 * | 片 | 内容 |
 * |---|---|
 * | `meta-types.ts` | 数据契约（{@link MetaViewData} / {@link MetaButton} / {@link MetaLayout}） |
 * | `meta-layout.ts` | 版式几何与缓存（绘制与 `hitTestMeta` 同一张表 ⇒ §20-4 结构性同源） |
 * | `meta-widgets.ts` | 通用控件与文案（钮 / 作品格 / 按下态 / 位图可用性注入） |
 * | `meta-menu.ts` | 主菜单页（顶栏 / 资源条 / 走马灯橱窗 / 木牌 / CTA） |
 * | `meta-levels-page.ts` | 选关整页（ADR-0032 D5 / 版式 P） |
 *
 * Pure render + hit-test geometry, in the same spirit as `systems/pause-panel.ts`:
 * **holds no state**, reads a flat {@link MetaViewData} the shell assembles each frame from
 * `MetaState` + `BeadsGame` getters (L5). 页面选择 = {@link META_PAGES} **表查**，⛔ 在 View 里
 * 串判 `overlay ===` 的存量分支就此收口（control-manifest §20 / `UI_ARCH_EXCEPTIONS` 摘一条）。
 *
 * Frozen sources: ux-spec v1.7 §2 (主菜单 = shell 屏、overlay 栈 设置/签到),
 * systems-index v1.28 §3.14 (体力/币/签到语义)；**EP12-S6 · WXG-T-269-S6 T-2A** 起主菜单
 * 版面 = `menu-architecture.md §5.1–§5.4` + `§6` 文案令牌 + `tokens.md §7`，陈列序 = `level-difficulty.md §5.2`。
 *
 * ⚠ 招牌 / 陈列格两族图元只属菜单屏 ⇒ ⛔ 不进玩法 `buildRenderModel()` 的盘面/托盘命令流
 * （S0 硬约束⑤ / L5），位表真源 `config/sign-glyphs.ts`、聚合口径真源 `view/menu-signage.ts`。
 *
 * 本文件同时是既有导入入口（`src/index.ts` 与测试按 `./view/meta-view.js` 取符号）⇒ 片内
 * 私有符号不外泄，对外形状与切片前逐字一致。
 */

import {
    DESIGN_W,
    THUMB_MATRIX_N,
    type MenuAnchors,
    UI_CONTAINER,
    WALL_ROWS,
} from '../config/tuning.js';
// EP12-S6 · P-7：屏内文案一律读表（`tokens.md §7` / `menu-architecture §6`），⛔ 不散落字面。
import { COPY_TOKENS } from '../config/copy-tokens.js';
import type { RenderModelBuilder } from '@wxgame/framework';
import type { BeadsPalette } from './palette.js';
import { drawSafeGuideLines } from './debug-layer.js';
import { UI_FONT, UI_SCRIM, scrimFill } from './ui-theme.js';
import { drawSettingsContent, isSettingsAction } from './settings-content.js';
import { SIGNIN_TITLE, drawSigninContent } from './signin-content.js';
// WXG-T-363：装扮馆卡面画法单源 `skins-content`（卡热区仍进 `meta-layout` 的 `skinsLayout` ⇒ 画与撞同源）。
import { SKINS_TITLE, drawSkinCard } from './skins-content.js';
import {
    anchoredGeo,
    DEFAULT_MENU_ANCHORS,
    metaLayout,
    overlayPlate,
} from './meta-layout.js';
import { drawMetaButton } from './meta-widgets.js';
import { drawMenuAnchored } from './meta-menu.js';
import { drawLevelsPage } from './meta-levels-page.js';
import type { Box, MetaAction, MetaLayout, MetaOverlay, MetaViewData, MetaViewVariant } from './meta-types.js';

export type { MetaAction, MetaBossState, MetaButton, MetaLayout, MetaOverlay, MetaViewData, MetaViewVariant } from './meta-types.js';
export { hitTestMeta, metaLayout } from './meta-layout.js';
export { heartBarLabel, resetMetaViewWarnings, setMenuBitmapResolver } from './meta-widgets.js';

/**
 * 一页怎么铺。七个入参全是**引用或原值**（每帧调用 ⇒ ⛔ 不组对象、不建闭包，`control-manifest §2` 零分配）；
 * 用不上的尾部参数直接省略（TS 允许少参实现），位置不用的加 `_` 前缀。
 */
type PageDraw = (
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    layout: MetaLayout,
    a: MenuAnchors,
    withSignage: boolean,
    thumbN: number,
) => void;

/** 内容块（弹窗纸面板之上、通用钮之前）：`signin` 七日格 / `settings` 10 钮。 */
type ContentDraw = (builder: RenderModelBuilder, data: MetaViewData, palette: BeadsPalette, layout: MetaLayout) => void;

/**
 * 弹窗三页共用的 chrome：遮罩 → 纸面板 → 标题 → 内容块 → 通用钮。
 *
 * ⚠ **不得在遮罩前补画底页**（判例 WXG-T-324 → 回退 WXG-T-325）：Cocos 端通道是**写死五段**
 * （`Background` → `BlitLayer` → `Graphics` → `BlitLayerUI` → `Labels`，见 `adapters/cocos/bindings.ts`
 * 层序三叠注）⇒ 指令流里的相对序被压成「通道序」，菜单的位图腿与文字永远浮在遮罩之上。
 * 正解 = 容器层（每页面/弹窗一个渲染容器，容器内按层有序、事件按层逆序透传）⇒ **ADR-0033 / UI-60**；
 * 在那之前本分支维持旧观感（实色底 + 遮罩 + 面板，「没半透但不错乱」）。
 *
 * 遮罩只压半透、⛔ 不改 RGB 与 α 档（EP11-S5 U14=丙：仅 `settings` 行读下调档，其余仍旧 0.5）；
 * ⚠️ 遮罩盖**整屏** ⇒ 高读锚定档系高 `a.H`（兜底档 = `DESIGN_H`）。标题基线 = 板顶缘下 50
 * （[WXG-T-339] 修「标题压首行钮带」，净空实算见 `meta-layout::settingsLayout` 注）。
 */
function panelPage(
    title: string,
    scrimAlpha: number,
    content?: ContentDraw,
    skipContentAction?: (id: MetaAction) => boolean,
): PageDraw {
    return (builder, data, palette, layout, a) => {
        builder.rect(0, 0, DESIGN_W, a.H, { fill: scrimFill(UI_SCRIM.overlay, scrimAlpha) });
        const plate = overlayPlate();
        builder.rect(plate.x, plate.y, plate.w, plate.h, { fill: palette.panel, radius: UI_CONTAINER.radiusPanel });
        builder.text(plate.x + plate.w / 2, plate.y + plate.h - 50, title, {
            fill: palette.text,
            font: UI_FONT.overlayTitle,
            align: 'center',
            baseline: 'middle',
        });
        content?.(builder, data, palette, layout);
        for (const b of layout.buttons) {
            // 内容块自己画过的钮（`settings` 十钮）与选关格恒不由本循环铺；未配服务的导入钮不画也不该被点。
            if (skipContentAction?.(b.id)) continue;
            if (b.id === 'pick-level') continue;
            if (b.id === 'studio-import' && !data.studioEnabled) continue;
            // `[WXG-T-363]` 装扮馆卡：卡面 = 皮肤自己的令牌（非通用钮画法），画法单源 `skins-content`。
            if (b.id === 'skin-tap') {
                drawSkinCard(builder, b.box as Box, b.slot ?? -1, data.skinId, data.pressed === b, data.reduceMotion, palette);
                continue;
            }
            drawMetaButton(builder, palette, data, b);
        }
    };
}

/** 主菜单页（`overlay = none`）：几何读调用方同一 `anchors` 派生的 {@link anchoredGeo} ⇒ 与热区恒同源。 */
const MENU_PAGE: PageDraw = (builder, data, palette, _layout, a, withSignage) => {
    drawMenuAnchored(builder, data, palette, anchoredGeo(a), withSignage);
};

/** 选关**整页**：页底 = `palette.background`（不透明）⇒ ⛔ 不画遮罩、不画纸面板，标题住导航栏带。 */
const LEVELS_PAGE: PageDraw = (builder, data, palette, layout, _a, _withSignage, thumbN) => {
    drawLevelsPage(builder, data, palette, layout.buttons, thumbN);
};

/**
 * `overlay → 页面` 表（行序 = 屏序，取代原 `buildMetaView` 的四段 `overlay ===` 串判）。
 * `signin` 的「七日签到」在 `tokens.md §7` **无对应键** ⇒ 维持既有字面，UI-32 起由
 * `signin-content.ts` 单源给出（⛔ 不为此新造令牌）；`skins` 同判例（「装扮馆」= `SKINS_TITLE`）。
 */
const META_PAGES: Record<MetaOverlay, PageDraw> = {
    none: MENU_PAGE,
    levels: LEVELS_PAGE,
    signin: panelPage(SIGNIN_TITLE, UI_SCRIM.alpha, (builder, data, palette, layout) => {
        // UI-32：签到内容块单源（标题 / 7 格版式 / 格绘制）；chrome 仍走弹窗通用腿。
        drawSigninContent(builder, layout.signinCells, data.signinDay, data.canClaim, palette);
    }),
    settings: panelPage(COPY_TOKENS.btn_settings_label, UI_SCRIM.settingsAlpha,
        // UI-30：设置内容块单一实现（10 钮）；返回 / 在线导入仍按弹窗 chrome 单独画。
        (builder, data, palette, layout) => drawSettingsContent(builder, data, palette, layout.buttons),
        isSettingsAction),
    skins: panelPage(SKINS_TITLE, UI_SCRIM.alpha),
};

/**
 * Render one frame of the shell's meta screens. Read-only over `data`.
 * `variant`（缺省 `undefined`）= 同帧差分入参，**生产不传** ⇒ 三档均取 `tuning.ts` 在册默认值。
 */
export function buildMetaView(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    variant?: MetaViewVariant,
): void {
    const rows = variant?.wallRows ?? WALL_ROWS;
    const thumbN = variant?.thumbN ?? THUMB_MATRIX_N;
    const withSignage = variant?.signage !== false;
    // `[WXG-T-280]` 菜单 = 锚定档唯一（shell init 逐机算定下传；直调缺省 ⇒ 模块级兜底档）。
    const A = data.anchors ?? DEFAULT_MENU_ANCHORS;
    builder.setBackground(palette.background);
    // 钮表只在 `metaLayout` 缓存里取（`pressed` 对象身份比对依赖同一引用）。
    const layout = metaLayout(data.overlay, rows);
    // UI-42 前置（WXG-T-314）：菜单 ↔ 选关页转场。`pageFade` = 选关页不透明度，底页恒为主菜单；
    // 淡入 / 淡出都只变选关页（含自身不透明页底）的组透明度，⛔ 不新增动画时钟。
    // `undefined`（缺省）⇒ 原路径逐字不变（金样本 / 封箱基线零漂移）。
    const pageFade = data.pageFade;
    if (pageFade !== undefined && pageFade < 1) {
        MENU_PAGE(builder, data, palette, layout, A, withSignage, thumbN);
        builder.setAlpha(pageFade);
        // 整页不透明：不加这层，淡入时菜单会从格缝里透出来（页底 = 背景色，与静息帧同色）。
        builder.rect(0, 0, DESIGN_W, A.H, { fill: palette.background });
        LEVELS_PAGE(builder, data, palette, layout, A, withSignage, thumbN);
    } else {
        META_PAGES[data.overlay](builder, data, palette, layout, A, withSignage, thumbN);
    }
    // 四条腿历史上都在末尾画标定线 ⇒ 表化后统一提到一处（顺序与内容与改前逐字一致）。
    if (data.debugGuides) drawSafeGuides(builder, A);
}

/**
 * 安全区标定线（设置 Debug 开）。横线 = 设计空间 y-up；数字 = 距屏顶的设计 px
 * （`st` / 胶囊底 / `H − sb`），对着真机截图读。
 */
function drawSafeGuides(builder: RenderModelBuilder, a: MenuAnchors): void {
    // 与对局页共用同一绘制（`debug-layer::drawSafeGuideLines`）⇒ 两屏划线口径不会漂。
    drawSafeGuideLines(builder, a.H, a.st, Math.round(a.H - a.btTopY - 4), a.sb);
}
