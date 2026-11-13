/**
 * MetaView 版式与几何（WXG-T-420 T7 切出）：**绘制与 `hitTestMeta` 共读同一张缓存表** ⇒ 热区
 * 与画面恒同源（§20-4）。
 *
 * overlay 选择走 `LAYOUT_BUILDERS` **表查**（⛔ 不再串判导航态）⇒ 本文件不带 §20-3 违例；
 * 缓存分两档：默认行数 = 按 anchors 引用（WeakMap，逐机主菜单）；变参行数只服务 K-6 同帧差分腿。
 */

import { DESIGN_H, DESIGN_W, LEVEL_DETAIL_GEO, LEVEL_SELECT_GEO, MENU_TOPBAR_ROW2_DY, MENU_TOPBAR_X, MENU_V2, TOUCH_MIN, WALL_COLS, WALL_ROWS, dialogShiftY, menuAnchors, menuBackdropTopPad, menuPlacementFromAnchors, type MenuAnchors } from '../config/tuning.js';
import { settingsContentButtons, settingsContentHeight, settingsContentViewport, isSettingsAction } from './settings-content.js';
import { signinCellLayout } from './signin-content.js';
import { skinCardBoxes } from './skins-content.js';
import type { Box, MetaButton, MetaLayout, MetaOverlay } from './meta-types.js';
export function box(x: number, y: number, w: number, h: number): Box {
    return { x, y, w, h };
}

/**
 * 盒命中。`pad` = 外扩容差（`[WXG-T-443]` 抬起容差用；默认 0 = 旧口径逐字不变）。
 * ⚠ 只给「已登记的钮」做放松，⛔ 不要拿 `pad > 0` 去铺热区表（相邻钮会互相抢）。
 */
export function inBox(b: Box, x: number, y: number, pad = 0): boolean {
    return x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;
}

// ─────────────────────────────────────────────────────────── cached layouts

/**
 * 默认档版面缓存 = `WeakMap<anchors, Map<overlay, layout>>`（WXG-T-420 T7 收敛）：
 * 主菜单本就按 anchors 缓存，其余 overlay 版面与 anchors 无关 ⇒ 统一一张表，
 * ⛔ 不再按导航态分支选缓存（§20-3）。shell 恒存同一个 anchors ⇒ 每帧命中同一对象
 * （`pressed` 引用比对与热路径零分配依赖此身份）。
 */
const _layoutsByAnchors = new WeakMap<MenuAnchors, Map<MetaOverlay, MetaLayout>>();
/**
 * **变参布局缓存**（仅供 {@link MetaViewVariant} 的 K-6 差分腿使用）。二级 `Map<overlay, Map<rows, layout>>`
 * ⇒ 非默认档也**只算一次**；键为枚举串与 `number` ⇒ 查表**零字符串拼接分配**（每帧路径走默认档一级缓存）。
 * ⛔ 生产链路不传 variant ⇒ 本缓存恒空。
 */
const _layoutsByRows = new Map<MetaOverlay, Map<number, MetaLayout>>();

/**
 * 弹窗纸面板宽高（`signin` / `skins` / `profile` 共用；`settings` 自 v1.9 起改用
 * {@link levelDetailPlate} 木牌；`levels` 自 ADR-0032 D5 起是**整页**，不走纸面板）。
 */
const OVERLAY_W = 600;
const OVERLAY_H = 720;

/**
 * 弹窗纸面板底板（`signin` / `settings` 同一块）。**首次算定后缓用**：`buildMetaView` 每帧调用
 * ⇒ 每帧新建 Box 属 `control-manifest §2` 热路径分配，就此收敛。
 *
 * `[WXG-T-323]` 中心对齐**手机中心** ⇒ 底缘 = 基准居中 + 逐机位移。位移由 `BeadsShell.init`
 * 在任何面板几何首次构造前写入 ⇒ 缓存首次即拿真值（H 运行期不变，见 `dialogShiftY` 注）。
 */
let _overlayPlate: Box | null = null;
export function overlayPlate(): Box {
    if (_overlayPlate === null) {
        _overlayPlate = box(
            (DESIGN_W - OVERLAY_W) / 2,
            (DESIGN_H - OVERLAY_H) / 2 + dialogShiftY(),
            OVERLAY_W,
            OVERLAY_H,
        );
    }
    return _overlayPlate;
}

/**
 * `[WXG-T-602]` 关卡详情**木牌**（Figma 581×1044 @ y下 166）——不复用 {@link overlayPlate}：
 * 木牌比通用纸面板高 324，且底缘按稿距屏底 124（非居中）。逐机只叠 `dialogShiftY()`。
 */
let _levelDetailPlate: Box | null = null;
export function levelDetailPlate(): Box {
    if (_levelDetailPlate === null) {
        const p = LEVEL_DETAIL_GEO.plate;
        _levelDetailPlate = box(p.x, DESIGN_H - p.yDown - p.h + dialogShiftY(), p.w, p.h);
    }
    return _levelDetailPlate;
}

/** `[WXG-T-935]` 设置可视窗（缓存）—— 绘制 / 命中 / 拖拽同读一个 Box 身份，热路径零分配。 */
let _settingsViewportBox: Box | null = null;
export function settingsViewport(): Box {
    if (_settingsViewportBox === null) _settingsViewportBox = settingsContentViewport(levelDetailPlate());
    return _settingsViewportBox;
}

/** `[WXG-T-935]` 设置最大滚动量（缓存；内容不超窗 ⇒ 0）。 */
let _settingsScrollLimit = -1;
export function settingsScrollLimit(): number {
    if (_settingsScrollLimit < 0) {
        _settingsScrollLimit = Math.max(0, settingsContentHeight() - settingsViewport().h);
    }
    return _settingsScrollLimit;
}

/**
 * `[WXG-T-605]` 选关弹窗：**沿用关卡详情木牌**（581×1044、标题槽、右上 38² 凹槽 ✕），
 * 只把中间橱窗换成 3×3 格墙。几何单源 = `config/tuning/level-select.ts`；
 * 关闭 = 右上 ✕ / 点木牌外空白（四条贴边带），**不再有底部返回钮**。
 */
function levelsLayout(rows: number): MetaLayout {
    const g = LEVEL_SELECT_GEO.grid;
    const cb = LEVEL_SELECT_GEO.closeBtn;
    const plate = levelDetailPlate();
    const capacity = WALL_COLS * Math.min(rows, 3);
    const gridShift = dialogShiftY();
    const buttons: MetaButton[] = [];
    for (let slot = 0; slot < capacity; slot++) {
        const row = (slot / WALL_COLS) | 0;
        const col = slot % WALL_COLS;
        buttons.push({
            id: 'pick-level',
            slot,
            // `[WXG-T-607]` 稿面 158×181 / 列 pitch 158 / 行 pitch 194（非正方形格）。
            box: box(
                g.left + col * g.pitchX,
                g.topUp - g.cellH - row * g.pitchY + gridShift,
                g.cellW,
                g.cellH,
            ),
        });
    }
    // `[WXG-T-610]` 关闭 = 稿面底部木质按钮（301×105 @225,1028），与 `drawLevelsView` 的 blit 同源。
    const plateY = DESIGN_H - LEVEL_DETAIL_GEO.plate.yDown - LEVEL_DETAIL_GEO.plate.h;
    buttons.push({
        id: 'close-levels',
        box: box(
            plate.x + (cb.x - LEVEL_DETAIL_GEO.plate.x),
            plate.y + (DESIGN_H - cb.yDown - cb.h - plateY),
            cb.w,
            cb.h,
        ),
    });
    // `[WXG-T-612]` 右上 ✕ 恢复（用户令「叉按钮需要加上」）：与详情页同槽同热区口径
    // （`LEVEL_DETAIL_GEO.close` + `dialogShiftY`，88² 最小触控档，同 `levelDetailLayout` 的
    // `close-detail`）；底部木质钮保留 ⇒ 同 id 两处出口。格墙右缘 612 < ✕ 左缘 578+34 但
    // 行带 y 920..953 不相交（✕ 中心 y_up 1121±44）⇒ 零热区重叠。
    const cl = LEVEL_DETAIL_GEO.close;
    const xHit = TOUCH_MIN;
    buttons.push({
        id: 'close-levels',
        box: box(cl.cx - xHit / 2, DESIGN_H - cl.cyDown + gridShift - xHit / 2, xHit, xHit),
    });
    // 点木牌外空白 = 关闭：四条贴边带（⛔ 全屏钮会吞掉牌内空白点击）。
    buttons.push(
        { id: 'dismiss-levels', box: box(0, plate.y + plate.h, DESIGN_W, DESIGN_H - plate.y - plate.h) },
        { id: 'dismiss-levels', box: box(0, 0, DESIGN_W, plate.y) },
        { id: 'dismiss-levels', box: box(0, plate.y, plate.x, plate.h) },
        { id: 'dismiss-levels', box: box(plate.x + plate.w, plate.y, DESIGN_W - plate.x - plate.w, plate.h) },
    );
    return { buttons, signinCells: [] };
}

function signinLayout(): MetaLayout {
    const plate = overlayPlate();
    const buttons: MetaButton[] = [];
    // 7 格版式单源（UI-32）：4 + 3 居中，几何见 `view/signin-content.ts`。
    const cells = signinCellLayout(plate);
    // 领取 + 返回 ⇒ `[WXG-T-479]` 加「名片」（USER 2026-10-28 裁「乙·拆分」）后改**三钮一行**：
    // 200 宽 ×、间隔 25、整行居中（3×200 + 2×25 = 650 @x50）⇒ 左右各留 50 边距；
    // 顺位 = 名片｜领取｜返回（主行动居中，退出仍最右，与改前「领取在左、返回在右」的相对序一致）。
    const btnW = 200;
    const btnY = plate.y + 60;
    const gap = 25;
    const total = btnW * 3 + gap * 2;
    const left = plate.x + (plate.w - total) / 2;
    buttons.push({ id: 'open-profile', box: box(left, btnY, btnW, TOUCH_MIN) });
    buttons.push({ id: 'claim', box: box(left + btnW + gap, btnY, btnW, TOUCH_MIN) });
    buttons.push({ id: 'back', box: box(left + (btnW + gap) * 2, btnY, btnW, TOUCH_MIN) });
    return { buttons, signinCells: cells };
}

function settingsLayout(): MetaLayout {
    // `[WXG-T-935]` 设置弹窗复用关卡详情木牌（581×1044）：与详情 / 选关同底板、同位（底缘距屏底 124）。
    const plate = levelDetailPlate();
    // UI-30 / `[WXG-T-935]`：内容块单源（`view/settings-content.ts`）= 11 钮 = 6 行 × 2 列
    // （前 5 行 = 10 项玩家设置，末行 = Debug 单钮左对齐）。
    // 避让实算：plate y∈[124,1168]；可视窗 y∈[286,948]（`SETTINGS_GRID.viewTopInset/viewBottomInset`）；
    //   ① 首行上缘 948 < 标题字面下缘 ≈1024 ⇒ 净空 76；
    //   ② 底行下缘 360 > 返回钮上缘 262（plate.y+50+88）⇒ 净空 98，不与「返回」/「在线导入」重叠。
    // 6 行实高 588 < 窗高 662 ⇒ 当前不触发滚动；滚动腿见 `settingsScrollMax` / `drawSettingsScrollbar`。
    const buttons: MetaButton[] = settingsContentButtons(plate);
    // 返回
    const backW = 240;
    buttons.push({
        id: 'back',
        box: box(plate.x + (plate.w - backW) / 2, plate.y + 50, backW, TOUCH_MIN),
    });
    // 在线导入（WXG-T-179 调试入口）：与「返回」同行右侧，**仅宿主配了服务地址时绘制**（钮始终可命中，shell 在未启用时空响）。
    buttons.push({
        id: 'studio-import',
        box: box(plate.x + plate.w - 40 - 130, plate.y + 50, 130, TOUCH_MIN),
    });
    // `[WXG-T-936]` 右上角 ✕：与关卡详情 / 选关同槽（`LEVEL_DETAIL_GEO.close`、88² 最小触控档），
    // 绘制走共用的 `drawCloseInset`；底部「返回」保留 ⇒ 同一关闭语义两个出口。
    const cl = LEVEL_DETAIL_GEO.close;
    buttons.push({
        id: 'close-settings',
        box: box(cl.cx - TOUCH_MIN / 2, DESIGN_H - cl.cyDown + dialogShiftY() - TOUCH_MIN / 2, TOUCH_MIN, TOUCH_MIN),
    });
    // 点木牌外空白 = 关闭：四条贴边带（⛔ 不做全屏钮 —— 会把牌内空白点击也吞掉）。
    buttons.push(
        { id: 'dismiss-settings', box: box(0, plate.y + plate.h, DESIGN_W, DESIGN_H - plate.y - plate.h) },
        { id: 'dismiss-settings', box: box(0, 0, DESIGN_W, plate.y) },
        { id: 'dismiss-settings', box: box(0, plate.y, plate.x, plate.h) },
        {
            id: 'dismiss-settings',
            box: box(plate.x + plate.w, plate.y, DESIGN_W - plate.x - plate.w, plate.h),
        },
    );
    return { buttons, signinCells: [] };
}

/**
 * `[WXG-T-363]` 装扮馆弹窗（ux-spec v1.25 §3.8）：同一 {@link overlayPlate} 底板 + 卡区热区 + 底部返回。
 * 卡区几何单源在 `view/skins-content.ts::skinCardBoxes`（共读 `SETTINGS_GRID` 列宽）；
 * `back` 与 `settings` 的返回**同几何**（240×TOUCH_MIN @ 板底 + 50 居中）。
 */
function skinsLayout(): MetaLayout {
    const plate = overlayPlate();
    const cards = skinCardBoxes(plate);
    const buttons: MetaButton[] = [];
    for (let i = 0; i < cards.length; i++) buttons.push({ id: 'skin-tap', slot: i, box: cards[i]! });
    const backW = 240;
    buttons.push({
        id: 'back',
        box: box(plate.x + (plate.w - backW) / 2, plate.y + 50, backW, TOUCH_MIN),
    });
    return { buttons, signinCells: [] };
}

/**
 * `[WXG-T-602 / T-604]` 关卡详情钮位：按 Figma `92:36` 原值 —— 「开始」326×154 @ x212 / y下1027；
 * 「关闭」是产品补钮（稿上无出口），落木牌右上角**刻入木板的浅槽 ✕**（中心 626 / y_up 1130）；另加「点牌外空白 = 关闭」四条遮罩带。
 * 热区一律 `max(视觉, TOUCH_MIN)` / 刻槽恒取 88 同心包裹（与菜单视零件同判例）。
 * 内容带几何单源 = `config/tuning/level-detail.ts`，⛔ 本文件不另写数字。
 */
function levelDetailLayout(): MetaLayout {
    const start = LEVEL_DETAIL_GEO.start;
    const close = LEVEL_DETAIL_GEO.close;
    const plate = levelDetailPlate();
    const startY = DESIGN_H - start.yDown - start.h + dialogShiftY();
    const closeCy = DESIGN_H - close.cyDown + dialogShiftY();
    const startHitH = Math.max(start.h, TOUCH_MIN);
    const closeHit = TOUCH_MIN; // 刻槽无底板 ⇒ 热区恒取最小触控档
    return {
        buttons: [
            {
                id: 'start-detail',
                box: box(start.x, startY - (startHitH - start.h) / 2, start.w, startHitH),
            },
            {
                id: 'close-detail',
                box: box(close.cx - closeHit / 2, closeCy - closeHit / 2, closeHit, closeHit),
            },
            // 点木牌外空白 = 关闭：四条贴边带（⛔ 不做全屏钮 —— 会把牌内空白点击也吞掉）。
            { id: 'dismiss-detail', box: box(0, plate.y + plate.h, DESIGN_W, DESIGN_H - plate.y - plate.h) },
            { id: 'dismiss-detail', box: box(0, 0, DESIGN_W, plate.y) },
            { id: 'dismiss-detail', box: box(0, plate.y, plate.x, plate.h) },
            {
                id: 'dismiss-detail',
                box: box(plate.x + plate.w, plate.y, DESIGN_W - plate.x - plate.w, plate.h),
            },
        ],
        signinCells: [],
    };
}

/**
 * `[WXG-T-478]` **纯展示弹窗版面**（图鉴 / 本地榜 / 名片）：只有底部「返回」钮。
 * 原三页复用 {@link skinsLayout} ⇒ 多出两张 `skin-tap` 卡热区，且 `panelPage` 对 `skin-tap`
 * 一律调 `drawSkinCard` ⇒ 皮肤卡盖住内容块（2026-10-28 真帧出图暴露）。返回钮几何与
 * `skinsLayout` 逐字一致（240 × `TOUCH_MIN` @ 板底 + 50 居中）。
 */
function infoPageLayout(): MetaLayout {
    const plate = overlayPlate();
    const backW = 240;
    return {
        buttons: [
            { id: 'back', box: box(plate.x + (plate.w - backW) / 2, plate.y + 50, backW, TOUCH_MIN) },
        ],
        signinCells: [],
    };
}

/**
 * overlay → 版面构造器（**表查**，⛔ 不串判导航态）。签名统一吃 `(rows, a)`：
 * 只有 `none`（逐机主菜单）读 `a`、只有 `levels` 读 `rows`，其余页面 = 常量版面 ⇒ 忽略入参
 * （行为与表化前的 `buildLayout` 逐字一致）。
 */
const LAYOUT_BUILDERS: Record<MetaOverlay, (rows: number, a: MenuAnchors) => MetaLayout> = {
    none: (_rows, a) => menuLayoutAnchored(a),
    signin: () => signinLayout(),
    settings: () => settingsLayout(),
    levels: (rows) => levelsLayout(rows),
    skins: () => skinsLayout(),
    // `[WXG-T-470/471/472]` 批 1 三弹窗 → `[WXG-T-501]` 图鉴 / 本地榜下线，只剩名片。
    profile: () => infoPageLayout(),
    // `[WXG-T-601]` 关卡详情弹窗（选关卡卡 → 详情 → 开始）。
    'level-detail': () => levelDetailLayout(),
};

// ───────────────────────────────────────────────── [WXG-T-280] anchored menu

/**
 * 无 `anchors` 直调（旧调用方/单测）的**模块级兜底锚定档**：全 `null` 入参 ⇒ SAFE 常量进链。
 * 引用恒定 ⇒ {@link anchoredGeo}/{@link menuLayoutAnchored} 的 WeakMap 缓存单例命中（热路径零分配）。
 */
export const DEFAULT_MENU_ANCHORS: MenuAnchors = menuAnchors({
    safeTopDp: null,
    capsuleBottomDp: null,
    safeBottomDp: null,
    windowWidthDp: 0,
    designHeight: 0,
});

/**
 * 锚定几何（**绘制与热区同一对象** ⇒ 永不可漂）。WeakMap 按 anchors 引用缓存
 * ⇒ shell 逐机算定一次恒存 ⇒ 每帧只读引用，零分配（`buildMetaView` 热路径）。
 */
export interface AnchoredMenuGeo {
    readonly caseBox: Box;
    readonly bossBox: Box;
    readonly clipBox: Box;
    readonly badgeBox: Box;
    readonly plateBox: Box;
    /**
     * `[WXG-T-585]` 木牌两行文字的落位（v2 背板已烘牌体 ⇒ 本体不画，只按这两行画字）。
     * 现式读 `MENU_V2.plateTitle / plateSub` 两个绝对槽（`[WXG-T-586]` 起 v1 的
     * `plateBox + MENU_PLATE_TITLE` 推导腿与那两个常量都已删除）。
     */
    readonly plateCx: number;
    readonly plateLine1Cy: number;
    readonly plateLine2Cy: number;
    readonly plateSingleCy: number;
    /** `[WXG-T-585]` 通关章框（仅 v2；v1 腿为 `undefined` ⇒ 不画）。 */
    readonly sealBox: Box | undefined;
    readonly signBox: Box;
    readonly ctaBox: Box;
    readonly ctaHit: Box;
    /** `[WXG-T-432]` 主菜单「好友榜」纸钮（CTA 左侧；绘制/热区同对象）。 */
    readonly rankBox: Box;
    /** `[WXG-T-432]` 主菜单「好友榜」纸钮（CTA 左侧；绘制/热区同对象，`[WXG-T-453]` 收回 T-448 下探后恢复）。 */
    readonly rankHit: Box;
    readonly arrowL: Box;
    readonly arrowLHit: Box;
    readonly arrowR: Box;
    readonly arrowRHit: Box;
    readonly barBox: Box;
    /** `[WXG-T-522]` 单一作品框：每页只画一件大关图（以图心定位）。 */
    readonly showcaseArtBox: Box;
    readonly settingsHit: Box;
    /**
     * `[WXG-T-365]` 装扮馆入口热区（顶栏中档 x=560，提案 P4-甲：原公告预留位升格）。
     * 与 `settingsHit` / `mailHit` 同 pitch 88、同一行 y ⇒ 零新坐标推导。
     */
    readonly skinsHit: Box;
    /** 签到信封热区（2026-10-22 入口回归：点击 → 既有 `signin` 弹窗）。 */
    readonly mailHit: Box;
    /** 顶栏热区/视觉圆同心 y（= `settingsHit` 中心）。 */
    readonly topbarCy: number;
    /** 完成态 boss icon 圆心 y。 */
    readonly doneCy: number;
}

const _anchoredGeo = new WeakMap<MenuAnchors, AnchoredMenuGeo>();

export function anchoredGeo(a: MenuAnchors): AnchoredMenuGeo {
    const hit = _anchoredGeo.get(a);
    if (hit !== undefined) return hit;
    const geo = anchoredGeoV2(a);
    _anchoredGeo.set(a, geo);
    return geo;
}

/**
 * `[WXG-T-585]` 主界面几何：**绝对坐标**（`MENU_V2`，坐标图读数）。
 * ⚠ 2026-11-07 切生产后 v1 的链式推导腿已删除（`anchoredGeoV1`）—— 版面不再由
 * `menuAnchors()` 的 gap/sign/case/cta 链推，`MenuAnchors` 现只提供 `H` / `st` / `sb` / `btTopY`
 * 给垂直落位与胶囊避让用。
 * 背板 750×1334 不拉伸，垂直落位由 {@link menuBackdropTopPad} 给（居中优先 + 顶栏避让胶囊下限），
 * 全部件由 `H − topPad − y − h` 翻 y-up ⇒ 与背板逐像素对齐，高屏多出的高度上下同时补。
 * 顶栏四钮**跟随背板**（图内 y=134），⛔ 不独立贴屏顶（那样高屏档钮浮在补墙上、与招牌错开）。
 */
function anchoredGeoV2(a: MenuAnchors): AnchoredMenuGeo {
    const r = Math.round;
    const V = MENU_V2;
    // `[WXG-T-587]` 生产档：招牌 / CTA **脱离背板**独立贴安全区与屏高比例（用户 2026-11-06 三条裁），
    // 其余件仍跟随背板（柜体场景）。
    const place = menuPlacementFromAnchors(a.H, a.st, a.btTopY, a.sb);
    const topPad = menuBackdropTopPad(a.H, a.st, a.btTopY, a.sb);
    /** 背板内量（自屏顶 = `topPad + 图内 y`）→ 设计 y-up（框底）。 */
    const up = (yDown: number, h: number): number => r(a.H - topPad - yDown - h);
    /**
     * `[WXG-T-585]` 视零件热区 = **max(视觉, `TOUCH_MIN`) 同心包裹**。
     * ⛔ 不可「一律缩成 88 见方」：v2 件普遍比 `TOUCH_MIN` 大（CTA 378×179、翻页钮 110×116），
     * 缩成 88 会出现「按钮看得见、边上一圈点不上」，与 `[WXG-T-453]` 收回 T-448 时的
     * 「热区与视觉重合」判定同源（当年踩的就是这类触摸死区）。
     */
    const hitAt = (b: Box): Box => {
        const w = Math.max(b.w, TOUCH_MIN);
        const h = Math.max(b.h, TOUCH_MIN);
        return box(r(b.x + b.w / 2 - w / 2), r(b.y + b.h / 2 - h / 2), w, h);
    };
    const signBox = box(V.sign.x, r(a.H - place.signTop - V.sign.h), V.sign.w, V.sign.h);
    const ctaBox = box(V.cta.x, r(a.H - place.ctaBottom), V.cta.w, V.cta.h);
    const arrowL = box(V.prev.x, up(V.prev.y, V.prev.h), V.prev.w, V.prev.h);
    const arrowR = box(V.next.x, up(V.next.y, V.next.h), V.next.w, V.next.h);
    // 热区与视觉同框（v2 三件均 ≥ `TOUCH_MIN`；v3 档 CTA 只挪位、不改尺寸 ⇒ 同一口径）。
    const ctaHit = hitAt(ctaBox);
    const arrowLHit = hitAt(arrowL);
    const arrowRHit = hitAt(arrowR);
    const clipBox = box(V.clip.x, up(V.clip.y, V.clip.h), V.clip.w, V.clip.h);
    const showcaseArtBox = box(V.art.x, up(V.art.y, V.art.h), V.art.w, V.art.h);
    const sealBox = box(V.seal.x, up(V.seal.y, V.seal.h), V.seal.w, V.seal.h);
    const plateBox = box(V.plateTitle.x, up(V.plateTitle.y, V.plateTitle.h + V.plateSub.h + 7),
        V.plateTitle.w, V.plateTitle.h + V.plateSub.h + 7);
    // 顶栏：常规跟招牌（图内顶缘 y=134），必须避开胶囊底 + `safeGap`；第二行 = `MENU_TOPBAR_ROW2_DY` 下移。
    const btTop = r(a.H - place.topbarTop);
    const settingsHit = box(MENU_TOPBAR_X.settings, btTop - TOUCH_MIN, TOUCH_MIN, TOUCH_MIN);
    const mailHit = box(MENU_TOPBAR_X.mail, btTop - TOUCH_MIN, TOUCH_MIN, TOUCH_MIN);
    const rankBox = box(MENU_TOPBAR_X.rank,
        btTop - TOUCH_MIN - MENU_TOPBAR_ROW2_DY, TOUCH_MIN, TOUCH_MIN);
    const skinsHit = box(MENU_TOPBAR_X.skins,
        btTop - TOUCH_MIN - MENU_TOPBAR_ROW2_DY, TOUCH_MIN, TOUCH_MIN);
    return {
        // v2 腿不画柜体/窗框：`caseBox` / `bossBox` / `badgeBox` 只服务 v1 消费点与 `open-levels` 热区。
        caseBox: box(V.clip.x, clipBox.y, V.clip.w, V.clip.h),
        bossBox: showcaseArtBox,
        clipBox,
        badgeBox: box(V.art.x, up(V.art.y, V.art.h), 0, 0),
        plateBox,
        plateCx: V.plateTitle.x + V.plateTitle.w / 2,
        plateLine1Cy: r(a.H - topPad - (V.plateTitle.y + V.plateTitle.h / 2)),
        plateLine2Cy: r(a.H - topPad - (V.plateSub.y + V.plateSub.h / 2)),
        plateSingleCy: r(a.H - topPad - (V.plateTitle.y + V.plateTitle.h / 2)),
        sealBox,
        signBox, ctaBox, ctaHit,
        rankBox, rankHit: rankBox,
        arrowL, arrowLHit, arrowR, arrowRHit,
        barBox: box(V.bar.x, up(V.bar.y, V.bar.h), V.bar.w, V.bar.h),
        settingsHit, skinsHit, mailHit,
        showcaseArtBox,
        topbarCy: settingsHit.y + TOUCH_MIN / 2,
        doneCy: showcaseArtBox.y + showcaseArtBox.h / 2,
    };
}

/** 锚定主菜单热区版面（与绘制共读 {@link anchoredGeo} ⇒ 「画 A 位、按 B 位」结构性不可能）。
 * 记忆化在 {@link _layoutsByAnchors}（默认档一张表）⇒ 本函数是纯构造。 */
function menuLayoutAnchored(a: MenuAnchors): MetaLayout {
    const g = anchoredGeo(a);
    const built: MetaLayout = {
        buttons: [
            // `[WXG-T-281]` 白卡退役：点 Boss 图进选关 ⇒ 图位 = `open-levels` 热区（与绘制同一对象）。
            { id: 'open-levels', box: g.bossBox },
            { id: 'open-rank', box: g.rankHit },
            { id: 'start', box: g.ctaHit },
            { id: 'open-settings', box: g.settingsHit },
            // `[WXG-T-365]` 装扮馆入口上提顶栏中档（提案 P4-甲）；设置弹窗行5 左格同时回到 `cycle-skin`。
            { id: 'open-skins', box: g.skinsHit },
            // 2026-10-22 用户裁：签到入口回归（信封实装，点开既有 `signin` 弹窗）。
            // 用户同批拍板：**已领当日仍可打开**看进度 ⇒ 热区常驻、不做 canClaim 门控。
            { id: 'open-signin', box: g.mailHit },
            { id: 'carousel-prev', box: g.arrowLHit },
            { id: 'carousel-next', box: g.arrowRHit },
        ],
        signinCells: [],
    };
    return built;
}

/**
 * Cached layout for one overlay. `rows` 只服务同帧差分腿（生产不传 ⇒ 走默认档一张表）。
 * `[WXG-T-280]` 主菜单 = **锚定档唯一**：第十四批静态档版面与 `topbarTop` 逐机缓存已整体退场；
 * WXG-T-420 T7 起默认档全 overlay 同走 {@link _layoutsByAnchors}（其余版面不吃逐机参 ⇒ 恒命中同一 Map）。
 */
export function metaLayout(
    overlay: MetaOverlay,
    rows: number = WALL_ROWS,
    anchors?: MenuAnchors,
): MetaLayout {
    // 锚定档（shell 实链路传逐机 anchors；直调缺省 ⇒ 模块级兜底档，⛔ 不存在第二套菜单几何）。
    const a = anchors ?? DEFAULT_MENU_ANCHORS;
    if (rows === WALL_ROWS) {
        let byOverlay = _layoutsByAnchors.get(a);
        if (byOverlay === undefined) {
            byOverlay = new Map<MetaOverlay, MetaLayout>();
            _layoutsByAnchors.set(a, byOverlay);
        }
        let layout = byOverlay.get(overlay);
        if (layout === undefined) {
            layout = LAYOUT_BUILDERS[overlay](rows, a);
            byOverlay.set(overlay, layout);
        }
        return layout;
    }
    // 变参行数腿：与表化前同口径——不读逐机 anchors（恒 `DEFAULT_MENU_ANCHORS`）、按 overlay 二级缓存。
    let byRows = _layoutsByRows.get(overlay);
    if (byRows === undefined) {
        byRows = new Map<number, MetaLayout>();
        _layoutsByRows.set(overlay, byRows);
    }
    const cached = byRows.get(rows);
    if (cached !== undefined) return cached;
    const layout = LAYOUT_BUILDERS[overlay](rows, DEFAULT_MENU_ANCHORS);
    byRows.set(rows, layout);
    return layout;
}

/**
 * Resolve a tap on the current screen; `null` when nothing is hit. 返回按钮（携 levelIndex）。
 * ⚠ 恒按**默认陈列行数**查表（`WALL_ROWS`）⇒ 与 `buildMetaView` 的默认腿同源；若未来真要启用
 * 变参行数，必须同批改本函数的 rows 入参口径（否则「画 2 行、按 3 行命中」= 热区漂移）。
 * ⚠ `anchors` 必须与 `buildMetaView` 画的**同一对象**（同读 `MetaViewData.anchors`）⇒
 * 否则菜单钮逐机错位；两者均缺省时同落 {@link DEFAULT_MENU_ANCHORS} ⇒ 仍同源。
 * `[WXG-T-935]` `settingsScroll` = 设置可视窗的已滚量（缺省 0 ⇒ 旧调用方逐字不变）。
 */
/**
 * `[WXG-T-935]` `overlay → 内容可视窗` 表（⛔ `overlay ===` 串判；control-manifest §20-3）。
 * 只有 `settings` 有可滚内容窗，其余 overlay 查不到 ⇒ `null`。
 */
const CONTENT_VIEWPORT: Partial<Record<MetaOverlay, () => Box>> = {
    settings: settingsViewport,
};

export function hitTestMeta(
    overlay: MetaOverlay,
    x: number,
    y: number,
    anchors?: MenuAnchors,
    settingsScroll = 0,
): MetaButton | null {
    const buttons = metaLayout(overlay, WALL_ROWS, anchors).buttons;
    // `[WXG-T-935]` 设置内容 = 中间可视窗内的滚动列表：命中点先换算回内容坐标（+scroll），
    // 且必须落在窗内；返回 / 在线导入固定不滚（窗外的点照旧按原位判）。
    const viewportOf = CONTENT_VIEWPORT[overlay];
    const viewport = viewportOf ? viewportOf() : null;
    const inViewport = viewport !== null && y >= viewport.y && y <= viewport.y + viewport.h;
    for (const b of buttons) {
        if (viewport !== null && isSettingsAction(b.id)) {
            if (inViewport && inBox(b.box, x, y + settingsScroll)) return b;
            continue;
        }
        if (inBox(b.box, x, y)) return b;
    }
    return null;
}

// ─────────────────────────────────────────────────────────────── rendering

