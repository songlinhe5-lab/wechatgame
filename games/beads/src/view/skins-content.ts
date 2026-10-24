/**
 * SkinsContent — 装扮馆弹窗内容块（**WXG-T-363** · 正本 = `design/ux/ux-spec.md` v1.25 §3.8）。
 *
 * 与 UI-30 的 `settings-content` / UI-32 的 `signin-content` 同形：收口**标题文案 / 卡区版式 /
 * 卡面绘制**三件；弹窗 chrome（遮罩 / 600×720 底板 / 返回钮）仍住 `meta-view`，卡热区也仍进
 * `meta-view::skinsLayout` ⇒ 绘制与命中恒读同一缓存表。
 *
 * **卡面 = 皮肤自己的 UI 令牌**（`BeadsSkin.tokens` 就是一个完整 `BeadsPalette`）：卡底用该肤的
 * `panel`，卡内画一枚该肤的木钮（`wood` 族 = `woodFace` + `woodText`）并写皮肤名 ⇒ 玩家看到的就是
 * 换上后界面的语言，⛔ 另造一套“预览色”。珠色不入肤（arch.md D4）⇒ ⛔ 画豆画。
 *
 * **拥有态**经 {@link setSkinOwnedResolver} 由宿主注入（判例 = `meta-view::setMenuBitmapResolver`）
 * ⇒ `MetaViewData` **零新增字段**、每帧零分配（L5 / 热路径纪律）。
 *
 * ⛔ 不持有状态：数据由调用方每帧传入；版式由传入的 plate 派生。
 */
import type { RenderModelBuilder } from '@wxgame/framework';
import { SKINS_CARD_H, SKINS_CARD_TOP_INSET, SKIN_PRICES_COINS, UI_CONTAINER } from '../config/tuning.js';
import { registeredSkins } from '../config/skins/registry.js';
import type { BeadsPalette } from './palette.js';
import { SETTINGS_GRID, type SettingsBox } from './settings-content.js';
import { UI_FONT, pressOffset } from './ui-theme.js';
import { drawButton } from './ui-widgets.js';

/** 标题：`tokens.md §7` 无对应键 ⇒ 承 `SIGNIN_TITLE` 判例维持字面（⛔ 不为此新造令牌）。 */
export const SKINS_TITLE = '装扮馆';

/** 卡内节奏（承 `signin-content` 的格内就地写法；外框两值住 `tuning.ts`）。 */
const CARD_PAD = 24;
const CARD_ROW_H = 40;
const CARD_ROW_GAP = 12;

/**
 * 拥有态查询（宿主注入：`BeadsShell` → `MetaState.ownsSkin`）。
 * 缺省全 `false` ⇒ 未买断态显示解锁价、⛔ 视图不自言「已拥有」（同位图腿的保守口径）。
 */
let _skinOwned: (skinId: string) => boolean = () => false;
export function setSkinOwnedResolver(fn?: (skinId: string) => boolean): void {
    _skinOwned = fn ?? (() => false);
}

/**
 * 卡区版式：**列几何共读 `SETTINGS_GRID`**（⛔ 第二套列宽），卡高 / 卡顶缘住 `tuning.ts`；
 * 槽序 = `registeredSkins()` **注册序**（⛔ 页面另排序，判例 = S9 §8-15）。
 *
 * ponytail: 当前只容得下**一行**（`cols` 枚）。注册数 > `SETTINGS_GRID.cols` 时第二行会压进
 * 底部「返回」钮带 ⇒ 届时要改卡高或转整页，不在本批射程。
 */
export function skinCardBoxes(plate: SettingsBox): SettingsBox[] {
    const cols = SETTINGS_GRID.cols;
    const rowW = plate.w - SETTINGS_GRID.sideInset * 2;
    const colW = (rowW - SETTINGS_GRID.colGap * (cols - 1)) / cols;
    const top = plate.y + plate.h - SKINS_CARD_TOP_INSET;
    const n = registeredSkins().length;
    const cards: SettingsBox[] = [];
    for (let i = 0; i < n; i++) {
        const row = (i / cols) | 0;
        const col = i % cols;
        cards.push({
            x: plate.x + SETTINGS_GRID.sideInset + col * (colW + SETTINGS_GRID.colGap),
            y: top - SKINS_CARD_H - row * (SKINS_CARD_H + SETTINGS_GRID.colGap),
            w: colW,
            h: SKINS_CARD_H,
        });
    }
    return cards;
}

/**
 * 状态行四态（ux §3.8）：`穿戴中` / `点击穿戴` / `解锁 {价}` / `不可购买`。
 * 走**文案通道** ⇒ ⛔ 红点、⛔ 新提示位（全局唯一提示位仍 = 签到 `MENU_SIGNIN_DOT_R`）。
 * 价未列入 `SKIN_PRICES_COINS` = 不可购买（非 0 价免费，判例同 `MetaState.buySkin`）。
 */
function statusText(skinId: string, currentSkinId: string): string {
    if (skinId === currentSkinId) return '穿戴中';
    if (_skinOwned(skinId)) return '点击穿戴';
    const price = SKIN_PRICES_COINS[skinId];
    return price === undefined ? '不可购买' : `解锁 ${price}`;
}

/**
 * 画一张皮肤卡（`card` 来自 {@link skinCardBoxes}，与热区同一盒子）。
 * 位置参数而非 spec 对象 = 每帧零分配（`ui-widgets::drawButton` 同口径）。
 *
 * @param pressed 该卡正被按住（`hitTestMeta` 缓存对象身份比对的结果）。
 */
export function drawSkinCard(
    builder: RenderModelBuilder,
    card: SettingsBox,
    skinIndex: number,
    currentSkinId: string,
    pressed: boolean,
    reduceMotion: boolean,
    palette: BeadsPalette,
): void {
    const skin = registeredSkins()[skinIndex];
    if (!skin) return;
    const tokens = skin.tokens;
    const dy = pressOffset(pressed, reduceMotion);
    const top = card.y + card.h;
    // 卡底 = 该肤的纸面（`panel`），描边仍读页面墨 ⇒ 未选中卡恒有一层框。
    builder.rect(card.x, card.y + dy, card.w, card.h, {
        fill: tokens.panel,
        stroke: palette.panelBorder,
        lineWidth: UI_CONTAINER.strokePanel,
        radius: UI_CONTAINER.radiusCard,
    });
    // 行1 = 该肤的木钮本体（木面 + 受光 + 承重线 + 木色字），文案即皮肤名。
    drawButton(
        builder,
        tokens,
        card.x + CARD_PAD,
        top - CARD_PAD - CARD_ROW_H + dy,
        card.w - CARD_PAD * 2,
        CARD_ROW_H,
        'wood',
        UI_CONTAINER.radiusChip,
        skin.label,
        UI_FONT.body,
        pressed,
    );
    // 行2 = 状态行，字用该肤的墨（纸面 + 墨 = 换上后玩家读到的那一层）。
    builder.text(
        card.x + card.w / 2,
        top - CARD_PAD - CARD_ROW_H * 2 - CARD_ROW_GAP + CARD_ROW_H / 2 + dy,
        statusText(skin.id, currentSkinId),
        {
            fill: tokens.text,
            font: UI_FONT.label,
            align: 'center',
            baseline: 'middle',
        },
    );
    // 卡底余量（300 − 2×24 − 2×40 − 12 = 160）留给真美术预览图位 `[待 art]`。
}
