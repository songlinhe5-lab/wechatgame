/**
 * MetaView 版式与几何（WXG-T-420 T7 切出）：**绘制与 `hitTestMeta` 共读同一张缓存表** ⇒ 热区
 * 与画面恒同源（§20-4）。
 *
 * overlay 选择走 `LAYOUT_BUILDERS` **表查**（⛔ 不再串判导航态）⇒ 本文件不带 §20-3 违例；
 * 缓存分两档：默认行数 = 按 anchors 引用（WeakMap，逐机主菜单）；变参行数只服务 K-6 同帧差分腿。
 */

import { DESIGN_H, DESIGN_W, LEVELS_BACK_BOTTOM, LEVELS_BACK_W, LEVELS_CELL, LEVELS_GAP, LEVELS_GRID_LEFT, LEVELS_GRID_TOP, MENU_ARROW_VISUAL_D, MENU_ARROW_X, MENU_BADGE, MENU_BAR_FRAME, MENU_BAR_H, MENU_BAR_TOP_INSET, MENU_BOSS_SLOT, MENU_CASE_FRAME, MENU_CASE_H, MENU_CLIP, MENU_CTA_H, MENU_CTA_X, MENU_DONE_ICON, MENU_PLATE, MENU_PRIMARY_W, MENU_SIGN_FRAME, MENU_TOPBAR_ROW2_DY, MENU_TOPBAR_X, TOUCH_MIN, WALL_COLS, WALL_ROWS, dialogShiftY, menuAnchors, type MenuAnchors } from '../config/tuning.js';
import { settingsContentButtons } from './settings-content.js';
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
 * 弹窗纸面板宽高（`signin` / `settings` / `skins` 共用；`levels` 自 ADR-0032 D5 起是**整页**，不走纸面板）。
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
 * 生成 `WALL_COLS × rows` 个作品格热区（选关**整页**，版式 P：格 `LEVELS_CELL` / 间距 `LEVELS_GAP`）。
 * 只带**槽位**——关索引由 shell 的 `wallSlots` 映射解析 ⇒ 视图侧无从「按槽当关」。
 *
 * 坐标口径（本设计空间 **y 向上**、`box.y` = 下缘）：`topY` = 网格**上沿**（第 1 行格的上边），
 * 第 r 行格下缘 = `topY − LEVELS_CELL − r×(LEVELS_CELL+LEVELS_GAP)` ⇒ 整墙占
 * `[topY − 570, topY]`（3 行 ⇒ 570 高，= 确认单 §2 的 y∈[252,822]）。
 *
 * `rows`（缺省 `WALL_ROWS`）= K-6 差分腿的陈列行数（回退序 1「格 3→2 行」）⇒ 槽数 `WALL_COLS × rows`，
 * 列几何与行序**逐字不变**（只是少画一行）；默认档 = `WALL_CAPACITY`（3×3 = 9）。
 */
function pushWallCells(buttons: MetaButton[], startX: number, topY: number, rows: number): void {
    const capacity = WALL_COLS * rows;
    for (let slot = 0; slot < capacity; slot++) {
        const row = (slot / WALL_COLS) | 0;
        const col = slot % WALL_COLS;
        buttons.push({
            id: 'pick-level',
            slot,
            box: box(
                startX + col * (LEVELS_CELL + LEVELS_GAP),
                topY - LEVELS_CELL - row * (LEVELS_CELL + LEVELS_GAP),
                LEVELS_CELL,
                LEVELS_CELL,
            ),
        });
    }
}

/**
 * 选关**整页**（ADR-0032 D5 / 版式 P）：格墙直接落不透明页底 ⇒ ⛔ 无遮罩、无纸面板。
 * 版面数值唯一真源 = `design/ux/level-select-page-layout.md` v0.3 §2；页专用常量 = `tuning::LEVELS_*`
 * （⛔ 不改共享 `WALL_CELL` / `WALL_CAPACITY`；缩略 134 走 `drawLevelThumb` 既有 `area` 入参）。
 * 入口仍由 shell 的 `levels` 态驱动（UiRoot 页面路由接线归 UI-40 / UI-42，本批不改路由语义）。
 */
function levelsLayout(rows: number): MetaLayout {
    const buttons: MetaButton[] = [];
    pushWallCells(buttons, LEVELS_GRID_LEFT, LEVELS_GRID_TOP, rows);
    // 返回（导航栏只放标题 ⇒ 返回仍走底部 `back`，240×88）
    const backX = (DESIGN_W - LEVELS_BACK_W) / 2;
    buttons.push({
        id: 'back',
        box: box(backX, LEVELS_BACK_BOTTOM, LEVELS_BACK_W, TOUCH_MIN),
    });
    // `[WXG-T-501]` **图鉴 / 本地榜两入口下线**（用户 2026-10-29：「本地榜应该没啥用」+「图鉴是每小关陈列、无专属设计」）
    // ⇒ 底排只留居中返回（原三钮同行两侧的几何随入口一并删除；底排不再靠近安全区两侧）。
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
    const plate = overlayPlate();
    // UI-30：内容块单源（`view/settings-content.ts`）= 10 钮 = 5 行 × 2 列（末行 = 皮肤 + Debug）。
    // plate 高 **720 不改**，避让实算（[WXG-T-339] 清零「标题压首行」——修前标题中心 1027−70 = 957
    //   落进首行钮带 [877,965]，叠 28；用户真机报「设置标题与第一行按钮重叠」）：`OVERLAY_H` 720
    //   ⇒ plate y∈[307,1027]；标题基线 1027−50 = 977（字面 40 ⇒ 下缘 957）；topY = 307+720−170 =
    //   857，行底依次 857 / 757 / 657 / 557 / 457（行距 12）；
    //   ① 顶行上缘 857+88 = 945 < 957 ⇒ **净空 12**（新增行仍在**下方**生长 ⇒ 不新增冲突）；
    //   ② 底行下缘 457 > 返回钮上缘 307+50+88 = 445 ⇒ **净空 12 ≥ 0**，不与「返回」/「在线导入」
    //      同行族重叠（EP12-S8 前为 120，仍为正）。
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
    const r = Math.round;
    const caseBox = box(MENU_CASE_FRAME.x, r(a.caseTopY) - MENU_CASE_H, MENU_CASE_FRAME.w, MENU_CASE_H);
    const bossBox = box(MENU_BOSS_SLOT.x, r(a.caseTopY - MENU_BOSS_SLOT.yOff) - MENU_BOSS_SLOT.h, MENU_BOSS_SLOT.w, MENU_BOSS_SLOT.h);
    const clipBox = box(MENU_CLIP.x, r(a.caseTopY - MENU_CLIP.yOff) - MENU_CLIP.h, MENU_CLIP.w, MENU_CLIP.h);
    const badgeBox = box(MENU_BADGE.x, r(a.caseTopY - MENU_BADGE.yOff) - MENU_BADGE.d, MENU_BADGE.d, MENU_BADGE.d);
    const plateBox = box(MENU_PLATE.cx - MENU_PLATE.w / 2, r(a.caseTopY - MENU_PLATE.yOff) - MENU_PLATE.h, MENU_PLATE.w, MENU_PLATE.h);
    // 招牌图框：图顶 = 结顶 + bowYOff（绳向上伸出结顶）；y-up 下框底 = 图顶 − h。
    const signBox = box(MENU_SIGN_FRAME.x, r(a.signTopY + MENU_SIGN_FRAME.bowYOff) - MENU_SIGN_FRAME.h, MENU_SIGN_FRAME.w, MENU_SIGN_FRAME.h);
    const ctaBox = box(MENU_CTA_X, r(a.ctaBotY), MENU_PRIMARY_W, MENU_CTA_H);
    // `WXG-T-487`（用户裁「把好友榜放到左上设计一个图标按钮，左上右上各两枚平衡入口」）：
    // 好友榜自 CTA 左侧**纸面文字钮**（140×88）上提为**顶栏圆钮** = 左上第二枚，视觉 80 / 热区 88
    // 与其余三钮同构。`rankBox` / `rankHit` 字段名保留（仍「绘制/热区同对象」）。
    const rankBox = box(
        MENU_TOPBAR_X.rank,
        r(a.btTopY) - TOUCH_MIN - MENU_TOPBAR_ROW2_DY,
        TOUCH_MIN,
        TOUCH_MIN,
    );
    // `[WXG-T-453]` **收回 `[WXG-T-448]` 的底隙下探**：热区回归与视觉重合（上下各内缩 2 设计 px，
    // `open-rank` 恢复「绘制/热区同对象」）。当初下探是为补「按钮下半点不上」，真因后来钉死为
    // Cocos 节点命中的 letterbox 死区（`[WXG-T-451]` 改全局 input 已修）⇒ 下探失去收益，只剩
    // 「框比按钮大一圈、点版本号带误触按钮」的观感/语义代价（用户 2026-10-27 拍板收回）。
    // 底隙 32（`MENU_CHAIN_GAP_BOTTOM`）= CTA 与屏底的净空带（`[WXG-T-497]` 版本号已迁设置页脚 ⇒ 该带现无文字、仍不响应）。
    const ctaHit = box(ctaBox.x, ctaBox.y + (MENU_CTA_H - TOUCH_MIN) / 2, MENU_PRIMARY_W, TOUCH_MIN);
    const rankHit = rankBox;
    const arrowY = r(a.caseCenterY) - MENU_ARROW_VISUAL_D / 2;
    const arrowL = box(MENU_ARROW_X.left, arrowY, MENU_ARROW_VISUAL_D, MENU_ARROW_VISUAL_D);
    const arrowR = box(MENU_ARROW_X.right, arrowY, MENU_ARROW_VISUAL_D, MENU_ARROW_VISUAL_D);
    const arrowPad = (TOUCH_MIN - MENU_ARROW_VISUAL_D) / 2;
    const arrowLHit = box(arrowL.x - arrowPad, arrowY - arrowPad, TOUCH_MIN, TOUCH_MIN);
    const arrowRHit = box(arrowR.x - arrowPad, arrowY - arrowPad, TOUCH_MIN, TOUCH_MIN);
    const barBox = box(
        MENU_BAR_FRAME.x,
        r(a.barTopY) - MENU_BAR_TOP_INSET - MENU_BAR_H,
        MENU_BAR_FRAME.w,
        MENU_BAR_H,
    );
    const settingsHit = box(MENU_TOPBAR_X.settings, r(a.btTopY) - TOUCH_MIN, TOUCH_MIN, TOUCH_MIN);
    const skinsHit = box(
        MENU_TOPBAR_X.skins,
        r(a.btTopY) - TOUCH_MIN - MENU_TOPBAR_ROW2_DY,
        TOUCH_MIN,
        TOUCH_MIN,
    );
    const mailHit = box(MENU_TOPBAR_X.mail, r(a.btTopY) - TOUCH_MIN, TOUCH_MIN, TOUCH_MIN);
    const geo: AnchoredMenuGeo = {
        caseBox, bossBox, clipBox, badgeBox, plateBox, signBox, ctaBox, ctaHit,
        rankBox, rankHit,
        arrowL, arrowLHit, arrowR, arrowRHit, barBox, settingsHit, skinsHit, mailHit,
        topbarCy: settingsHit.y + TOUCH_MIN / 2,
        doneCy: r(a.caseTopY - MENU_DONE_ICON.yOff),
    };
    _anchoredGeo.set(a, geo);
    return geo;
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
 */
export function hitTestMeta(
    overlay: MetaOverlay,
    x: number,
    y: number,
    anchors?: MenuAnchors,
): MetaButton | null {
    for (const b of metaLayout(overlay, WALL_ROWS, anchors).buttons) {
        if (inBox(b.box, x, y)) return b;
    }
    return null;
}

// ─────────────────────────────────────────────────────────────── rendering

