/**
 * RankView — 好友榜面板**占位视图**（ADR-0035 §5.2 S-3）。
 *
 * 只画占位：遮罩 + 纸面板 + 标题 / 副标 / 状态行 / 按钮；**无好友行、无名次**
 * （子域只回 `count`，ADR-0035 §3.1 最小隐私面）。布局与命中同源在
 * `systems/rank-panel.ts`（`rankPanelLayout` / `hitRankPanel`），本层不另算几何。
 *
 * 进出场几何走 `drawModalFrame`（与暂停面板同一算式）；进度只读 `view.progress`，
 * 本层不自持计时。颜色一律取自 `palette` / `UI_SCRIM`（零 hex 字面量）。
 */
import type { RenderModelBuilder } from '@wxgame/framework';
import { UI_CONTAINER } from '../config/tuning.js';
import type { RankPanelView } from '../systems/rank-panel.js';
import {
    RANK_BUTTON_BACK,
    RANK_BUTTON_SETTINGS,
    RANK_PANEL_SUBTITLE_LEVEL,
    RANK_PANEL_SUBTITLE_TOTAL,
    RANK_PANEL_TITLE,
    rankPanelLayout,
    rankStatusText,
} from '../systems/rank-panel.js';
import { drawModalFrame, frameFont, frameLen, frameX, frameY } from './modal-frame.js';
import type { BeadsPalette } from './palette.js';
import { UI_FONT, UI_SCRIM, bodyFont } from './ui-theme.js';
import { drawButton } from './ui-widgets.js';

/** 画好友榜面板（`view.visible === false` ⇒ 整屏不画）。 */
export function drawRankPanel(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    view: RankPanelView,
): void {
    if (!view.visible) return;
    const layout = rankPanelLayout(view.settings);
    const t = Math.max(0, Math.min(1, view.progress));
    const geo = drawModalFrame(builder, {
        panel: layout.panel,
        progress: t,
        scrimRgb: UI_SCRIM.canvas,
        scrimAlpha: UI_SCRIM.alpha * t,
        palette,
        radius: UI_CONTAINER.radiusPanel,
        shadowAlpha: UI_CONTAINER.shadowAlphaPanel,
    });

    // `[WXG-T-443]` 内容与面板同比伸缩：位置/字号一律过 `frame*`（`scale === 1` 时逐字不变）。
    builder.text(geo.cx, frameY(geo, layout.titleY), RANK_PANEL_TITLE, {
        fill: palette.text,
        font: frameFont(geo, UI_FONT.panelTitle),
        align: 'center',
        baseline: 'middle',
    });

    // 榜单面板不发大字号（`RankPanelView` 无 `largeText`）⇒ 副标 / 状态行回落默认档。
    const subFont = frameFont(geo, bodyFont(false, 'sub'));

    builder.text(
        geo.cx,
        frameY(geo, layout.subtitleY),
        view.board === 'settle-total' ? RANK_PANEL_SUBTITLE_TOTAL : RANK_PANEL_SUBTITLE_LEVEL,
        {
            fill: palette.textDim,
            font: subFont,
            align: 'center',
            baseline: 'middle',
        },
    );

    // `ready` 走计数文案，`loading` 只换文案、不画进度条（无计时，进度只读过场）。
    builder.text(geo.cx, frameY(geo, layout.statusY), rankStatusText(view.state, view.count), {
        fill: palette.text,
        font: subFont,
        align: 'center',
        baseline: 'middle',
    });

    for (const button of layout.buttons) {
        const bw = frameLen(geo, button.rect.xMax - button.rect.xMin);
        const bh = frameLen(geo, button.rect.yMax - button.rect.yMin);
        const bx = frameX(geo, button.rect.xMin);
        const by = frameY(geo, button.rect.yMin);
        // S-3 恒无 settings 钮；此处仍按 `layout.buttons` 通用派发，S-5 接钩子即生效。
        if (button.id === 'back') {
            drawButton(
                builder, palette, bx, by, bw, bh, 'paper', UI_CONTAINER.radiusCard,
                RANK_BUTTON_BACK, frameFont(geo, UI_FONT.panelButton), false,
            );
        } else {
            drawButton(
                builder, palette, bx, by, bw, bh, 'wood', UI_CONTAINER.radiusWood,
                RANK_BUTTON_SETTINGS, frameFont(geo, UI_FONT.panelButton), false,
            );
        }
    }
}
