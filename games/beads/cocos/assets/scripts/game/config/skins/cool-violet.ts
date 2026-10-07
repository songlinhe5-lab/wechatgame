/**
 * EP12-S8 · 第二肤「冷紫灰」（`cool-violet`）。
 *
 * **裁定（用户 2026-10-07，WXG-T-268 批 2）**：冷紫灰**不退役**——由「全局默认」
 * 收编为皮肤池可选肤（EP12-S1 换值批把默认底换成了暖纸，本模块保住旧值的可玩性）。
 *
 * **取值史证（逐值核对）**：全部 18 字段 = EP12-S1 改动前的 `DEFAULT_PALETTE`
 * （git 史证 = `HEAD e8b81a9:games/beads/src/view/palette.ts`，即 `s3_frame_recheck_17`
 * 复评所锚的改码前工作树值）。`tests/skin-system.test.ts` 以同一组史证值逐字段钉住，
 * 本模块与史证漂移即红。托盘槽 `traySlot #4A5060` 等 S1 前后同值字段照抄史证
 * （显式优于派生，arch.md D1 负面后果条已接受重复字面）。
 */
import type { BeadsPalette } from '../../view/palette';
import type { BeadsSkin } from './registry';

const COOL_VIOLET_TOKENS: BeadsPalette = Object.freeze({
    background: '#ECEAF3', // bg_base 冷紫灰（v1.3 丙案「双色温对撞」定稿值）
    panel: '#FFFFFF', // panel_surface
    panelBorder: '#E2DFF0', // panel_border 1px
    slot: '#F7F6FB',
    slotBorder: '#D8D5E6',
    traySlot: '#4A5060', // 托盘槽底（WXG-T-261 二批定稿，与肤无关）
    slotDashed: '#C9C5DA',
    locked: '#B9B4CC',
    text: '#2A2E43',
    textDim: '#6E7288',
    accentPrimary: '#2A2E43', // accent_primary（S1 前为深藏青，未并入木色）
    accentPurple: '#7C6FD9',
    success: '#3FBF6B',
    danger: '#E8434A',
    hintBlue: '#3D7BF5',
    adBadge: '#2A2E43', // ad_badge 深藏青（S1 前）
    bannerBackdrop: '#33333D',
    bannerText: '#FDF6E9',
});

export const COOL_VIOLET_SKIN: BeadsSkin = Object.freeze({
    id: 'cool-violet',
    label: '冷紫灰',
    tokens: COOL_VIOLET_TOKENS,
});
