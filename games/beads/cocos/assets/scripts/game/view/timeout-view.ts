/**
 * `[WXG-T-614]` 倒计时结束弹窗 **View**（`ui-architecture-beads §5`）——Figma「倒计时结束弹窗」
 * 页 `225:126` · 抠图层 `231:281`（文件 `PBIK3RbfGlfzFsAnd97ZsP`）。规格正本 = `design/ux/timeout-panel-spec.md`。
 *
 * 纯函数 `(builder, viewModel, palette)`：⛔ 不 import 快照 / shell / 游戏对象，
 * ⛔ 不出现 `overlay ===` / `phase ===` 导航判断，⛔ 不持有状态。展示数据全来自
 * {@link TimeoutViewModel}（只读）；钮框由 VM 透传 `failPanelLayout` ⇒ **绘制与命中同源**。
 *
 * 稿层序：遮罩 → 木牌（九宫格）→ 板标题 → 说明行 → 续时钮 → 重试钮 → 一次性提示。
 * 位图未注册 ⇒ 逐元素**同几何**程序化回退（木牌 → 纸面板、钮 → 纯色圆角面），⛔ 不做第二套版式。
 *
 * ⚠ 坐标口径：`TIMEOUT_GEO` 存**牌内相对锚**（y 向下）⇒ 本文件统一换算
 * `yUp = plate.yMin + plateH − yDown`；钮内文字锚同法（相对钮顶）。逐机位移只动牌框，内容不撕裂。
 */
import { nineSliceFx, type RenderModelBuilder } from '../../framework/index';
import {
    LEVEL_DETAIL_TITLE_SHADOW,
    TIMEOUT_GEO,
    TIMEOUT_TEXTURES,
    UI_CONTAINER,
} from '../config/tuning';
import { STAR_GOLD, withAlpha, type BeadsPalette } from './palette';
import { UI_FONT, UI_SCRIM, bodyFont, drawPaperPanel } from './ui-theme';
import { drawModalScrim } from './modal-frame';
import { menuBitmapReady } from './meta-widgets';
import type { TimeoutButtonViewModel, TimeoutViewModel } from './timeout-view-model';

const GEO = TIMEOUT_GEO;
/** 木牌九宫格（模块级一次）：两档共用同一张位图，仅重试档纵向压中段（端帽保住标题带与底铆钉）。 */
const PLAQUE_FX = nineSliceFx(GEO.slice.capX, GEO.slice.capY);
/**
 * 文字描边的四向垫底偏移（设计 px）。稿 `233:39/40/49` 均带 SOLID stroke，而 `TextCommand`
 * 只有 `shadow` 无 stroke ⇒ 用「四向深墨垫底 + 面字」复刻（术式同 `drawCloseInset` 的双 pass 嵌线）。
 * 这不只是像稿：绿钮面自带高光渐变，实测奶油墨压亮部只有 2.13:1，**垫底后字对深墨 10.63:1**
 * （字形矩形取样法与全表见规格 §4.3；⛔ 整条横带取样会混入木框高光，min 假掉到 1.16）。
 */
const STROKE_OFFSETS: readonly (readonly [number, number])[] = [[-2, 0], [2, 0], [0, -2], [0, 2]];
/** 稿钮内文字 DROP_SHADOW：`#3B1E05` α0.8 · offset(0,+3) · blur 0（y 向下 ⇒ 视图取负）。 */
const TEXT_SHADOW_ALPHA = 0.8;
const TEXT_SHADOW_DY = -3;

/** 描边字（四向垫底 + 面字带硬投影）。`shadow` 传已含 α 的色串。 */
function drawStrokedText(
    builder: RenderModelBuilder,
    x: number,
    y: number,
    text: string,
    fill: string,
    stroke: string,
    font: string,
    shadow: string,
): void {
    for (let i = 0; i < STROKE_OFFSETS.length; i += 1) {
        const o = STROKE_OFFSETS[i]!;
        builder.text(x + o[0], y + o[1], text, { fill: stroke, font, align: 'center', baseline: 'middle' });
    }
    builder.text(x, y, text, {
        fill,
        font,
        align: 'center',
        baseline: 'middle',
        shadow: { color: shadow, offsetX: 0, offsetY: TEXT_SHADOW_DY, blur: 0 },
    });
}

/**
 * 单枚钮：面（位图 / 回退纯色 / 禁用灰）+ 主行 + 副行。
 * 文字横锚：**位图腿**用稿面 `textCx`（让开左侧烘入的 ▶ / 循环箭头图标，实测图标占 0–153.5 / 0–136.5）；
 * 回退与禁用腿无图标 ⇒ 回到钮心（⛔ 不留一段莫名左偏）。
 */
function drawTimeoutButton(
    builder: RenderModelBuilder,
    b: TimeoutButtonViewModel,
    palette: BeadsPalette,
): void {
    const r = b.rect;
    const x = r.xMin;
    const w = r.xMax - r.xMin;
    const h = r.yMax - r.yMin;
    const y = r.yMin + b.pressDy;
    const primary = b.id === 'revive';
    const geo = primary ? GEO.continueBtn : GEO.retryBtn;
    const font = primary ? UI_FONT.timeoutAction : UI_FONT.timeoutRetry;
    const titleY = y + h - geo.titleCyDown;

    // EP12-S4 禁用态（广告在播）：面 `woodFaceDisabled` + 字 `woodText`@60%，无描边无投影
    //（screens.md §4 矩阵 T3「禁用」列 = 可点性消失双通道；对比属 R-8 登记豁免）。
    if (b.disabled) {
        builder.rect(x, y, w, h, { fill: palette.woodFaceDisabled, radius: GEO.radius.button });
        builder.text(x + w / 2, titleY, b.label, {
            fill: withAlpha(palette.woodText, 0.6),
            font,
            align: 'center',
            baseline: 'middle',
        });
        return;
    }

    const tex = primary ? TIMEOUT_TEXTURES.continueBtn : TIMEOUT_TEXTURES.retryBtn;
    const bitmap = menuBitmapReady(tex);
    if (bitmap) {
        builder.blit(tex, x, y, w, h);
    } else {
        // 回退面取既有令牌（成功绿 / 引导蓝）；亮面 ⇒ 墨换深藏青（实测 5.65 / 3.41:1 ✓）。
        builder.rect(x, y, w, h, {
            fill: primary ? palette.success : palette.hintBlue,
            radius: GEO.radius.button,
        });
    }
    const textX = bitmap ? x + geo.textCx : x + w / 2;
    const shadow = withAlpha(palette.shadowInk, TEXT_SHADOW_ALPHA);
    drawStrokedText(
        builder, textX, titleY, b.label,
        bitmap ? palette.woodText : palette.text,
        palette.plateTitleInk, font, shadow,
    );
    // 副行只续时钮有（稿 `233:40`）：金墨压深绿 min 4.37 / mean 4.77 ✓（22 bold 属大字号档 ⇒ 门 3:1）；
    // 描边墨取 `shadowInk`（≈稿 #3B2A05）。
    if (b.hint) {
        drawStrokedText(
            builder, textX, y + h - GEO.continueBtn.hintCyDown, b.hint,
            bitmap ? STAR_GOLD : palette.text,
            palette.shadowInk, UI_FONT.plateSub, shadow,
        );
    }
}

export function drawTimeoutView(
    builder: RenderModelBuilder,
    vm: TimeoutViewModel,
    palette: BeadsPalette,
): void {
    const p = vm.plate;
    const x = p.xMin;
    const y = p.yMin;
    const w = p.xMax - p.xMin;
    const h = p.yMax - p.yMin;
    const cx = x + w / 2;

    // 遮罩走画布侧族（与暂停 / 结算同档，⛔ 不用菜单 overlay 黑）；容器 = 木牌位图或纸面板回退。
    drawModalScrim(builder, UI_SCRIM.canvas, UI_SCRIM.alpha);
    if (menuBitmapReady(TIMEOUT_TEXTURES.plaque)) {
        builder.blit(TIMEOUT_TEXTURES.plaque, x, y, w, h, { fx: PLAQUE_FX });
    } else {
        drawPaperPanel(builder, x, y, w, h, palette, GEO.radius.plate, UI_CONTAINER.shadowAlphaPanel);
    }

    // 板标题「时间到」：稿 64 ExtraBold 暖奶油 + DROP_SHADOW(+9,+7 blur3 α0.8)（与详情页同参 ⇒ 复用常量）。
    // 墨取 `woodText`：字形矩形实测 min 3.78:1 ✓（`plateSubInk` 同区 min 2.68 ✗，故⛔ 不沿用兄弟页墨）。
    // 两枚 INNER_SHADOW 仍不实现（文字命令只有单色填充，同详情页规格 §4.1 缺口）。
    builder.text(cx, y + h - GEO.title.cyDown, vm.title, {
        fill: palette.woodText,
        font: UI_FONT.detailTitle,
        align: 'center',
        baseline: 'middle',
        shadow: {
            color: withAlpha(palette.plateTitleInk, LEVEL_DETAIL_TITLE_SHADOW.alpha),
            offsetX: LEVEL_DETAIL_TITLE_SHADOW.dx,
            offsetY: -LEVEL_DETAIL_TITLE_SHADOW.dyDown,
            blur: LEVEL_DETAIL_TITLE_SHADOW.blur,
        },
    });

    // 说明行「本关已续时」（仅重试档，产品补文案）：亮木面上单墨够不到 3:1（`woodText` 实测 min 2.73）
    // ⇒ 与钮内字同术式描边垫底。字号随 `largeText`（属说明类，非按钮族）。
    if (vm.subtitle) {
        drawStrokedText(
            builder, cx, y + h - GEO.subtitleCyDown, vm.subtitle,
            palette.woodText, palette.plateTitleInk, bodyFont(vm.largeText, 'sub'),
            withAlpha(palette.shadowInk, TEXT_SHADOW_ALPHA),
        );
    }

    for (let i = 0; i < vm.buttonCount; i += 1) {
        drawTimeoutButton(builder, vm.buttons[i]!, palette);
    }

    // 一次性提示（如 Noop 广告「即将开放」）：牌底留白带中线，实测奶油墨 min 3.26（22）/ 3.04（28）✓ 大字号档。
    if (vm.hint) {
        builder.text(cx, y + GEO.hintCyFromBottom, vm.hint, {
            fill: palette.woodText,
            font: bodyFont(vm.largeText, 'sub'),
            align: 'center',
            baseline: 'middle',
        });
    }
}