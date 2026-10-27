/**
 * SigninContent — 签到弹窗内容块（ADR-0032 §4「SigninModal 签到」，UI-32）。
 *
 * 收口三件：**标题文案 / 7 格版式 / 格绘制**（与 UI-30 的 `settings-content` 同形）。
 * 弹窗 chrome（遮罩 / 底板 / 领取 / 返回钮）仍住 `meta-view`：签到底板的历史画法是
 * **无投影、无描边**的素面 rect，与 `ModalFrame` 的纸面板不同形 —— 按 §9-5「视觉统一不夹带」
 * 本批不换底盘；签到入口已退役（Q5①，`ux-spec` §5.1b）⇒ 也不引入开合时钟（无真实开启动线）。
 *
 * ⛔ 不持有状态（L5）：数据由宿主每帧投影；版式由调用方传入的 plate 派生。
 */
import type { RenderModelBuilder } from '../../framework/index';
import { SIGNIN_REWARDS } from '../config/tuning';
import type { BeadsPalette } from './palette';
import { UI_FONT } from './ui-theme';

/** 标题：`tokens.md §7` 无对应键 ⇒ 维持既有字面（⛔ 不为此新造令牌）。 */
export const SIGNIN_TITLE = '七日签到';

export interface SigninBox {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}

/** 7 格：4 + 3 居中排布（格 110 / 间距 18，相对静止态 plate 派生）。
 *
 * `[WXG-T-460]` 标题/格带分离：格顶（row 0 上缘 = rowTopY + 110）曾落在板顶下 40，
 * 而 `panelPage` 标题基线在板顶下 50、字形自基线**向上**延 ⇒ 格顶越基线 10px
 * （真机读作「七日签到」压首行格）。修 = rowTopY −150→−180 ⇒ 格顶 = 板顶下 70，
 * 落基线下 20px；标题带（板顶 ~50+字高）/ 格带 / 钮带（板底 +60）三带互不越界。
 */
export function signinCellLayout(plate: SigninBox): SigninBox[] {
    const cellSize = 110;
    const cellGap = 18;
    const rowTopY = plate.y + plate.h - 180;
    const cells: SigninBox[] = [];
    for (let i = 0; i < SIGNIN_REWARDS.length; i++) {
        const row = i < 4 ? 0 : 1;
        const col = row === 0 ? i : i - 4;
        const perRow = row === 0 ? 4 : 3;
        const rowW = perRow * cellSize + (perRow - 1) * cellGap;
        cells.push({
            x: plate.x + (plate.w - rowW) / 2 + col * (cellSize + cellGap),
            y: rowTopY - row * (cellSize + cellGap),
            w: cellSize,
            h: cellSize,
        });
    }
    return cells;
}

/**
 * 格绘制：已领 = 灰底 + ✓（α 0.6）；今日 = 主色 4px 描边；未领 = 奖励文案（❤ 优先于 🪙）。
 * 指令顺序与收拢前 `buildMetaView` 的 signin 分支逐字同序（金样本门）。
 */
export function drawSigninContent(
    builder: RenderModelBuilder,
    cells: readonly SigninBox[],
    signinDay: number,
    canClaim: boolean,
    palette: BeadsPalette,
): void {
    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]!;
        const reward = SIGNIN_REWARDS[i]!;
        const claimed = i < signinDay || (i === signinDay && !canClaim);
        const today = i === signinDay;
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
            font: UI_FONT.cell,
            align: 'center',
            baseline: 'middle',
        });
        builder.text(cell.x + cell.w / 2, cell.y + cell.h / 2 - 16, claimed ? '✓' : rewardText, {
            fill: claimed ? palette.success : palette.text,
            font: UI_FONT.cell,
            align: 'center',
            baseline: 'middle',
        });
    }
}
