/**
 * MetaView 版式与几何（WXG-T-420 T7 切出）：**绘制与 `hitTestMeta` 共读同一张缓存表** ⇒ 热区
 * 与画面恒同源（§20-4）。
 *
 * overlay 选择走 `LAYOUT_BUILDERS` **表查**（⛔ 不再串判导航态）⇒ 本文件不带 §20-3 违例；
 * 缓存分两档：默认行数 = 按 anchors 引用（WeakMap，逐机主菜单）；变参行数只服务 K-6 同帧差分腿。
 */

import { DESIGN_H, DESIGN_W, MENU_TOPBAR_ROW2_DY, MENU_TOPBAR_X, MENU_V2, TOUCH_MIN, WALL_CELL, WALL_COLS, WALL_GAP, WALL_ROWS, dialogShiftY, menuAnchors, menuBackdropTopPad, menuPlacementFromAnchors, type MenuAnchors } from '../config/tuning';
import { settingsContentButtons } from './settings-content';
import { signinCellLayout } from './signin-content';
import { skinCardBoxes } from './skins-content';
import type { Box, MetaButton, MetaLayout, MetaOverlay } from './meta-types';
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
 * 生成 `WALL_COLS × rows` 个作品格热区（选关**弹窗**，格 = `WALL_CELL` / 间距 = `WALL_GAP`，与作品墙同一套）。
 * 只带**槽位**——关索引由 shell 的 `wallSlots` 映射解析 ⇒ 视图侧无从「按槽当关」。
 *
 * 坐标口径（本设计空间 **y 向上**、`box.y` = 下缘）：`topY` = 网格**上沿**（第 1 行格的上边），
 * 第 r 行格下缘 = `topY − WALL_CELL − r×(WALL_CELL+WALL_GAP)`。
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
                startX + col * (WALL_CELL + WALL_GAP),
                topY - WALL_CELL - row * (WALL_CELL + WALL_GAP),
                WALL_CELL,
                WALL_CELL,
            ),
        });
    }
}

/**
 * 选关**弹窗**版面度量（单源，绘制与热区共读；`[WXG-T-503]` 改判）。
 * 正本 = `design/ux/level-select-page-layout.md` v0.7 §2：600×720 纸面板内 3×3 格
 * （`WALL_CELL` 120 / `WALL_GAP` 22）、返回 240×88 @ 板底 +50；章名与星进度 **同行**，
 * 判星对照行在网格上方（两行信息）。
 */
export interface LevelsPanelMetrics {
    readonly plate: Box;
    readonly gridLeft: number;
    readonly gridTop: number;
    readonly gridW: number;
    readonly gridH: number;
    readonly cell: number;
    readonly gap: number;
    readonly backY: number;
    readonly backW: number;
    readonly backH: number;
    readonly chapterY: number;
    readonly progressY: number;
    readonly criteriaY: number;
}

export function levelsPanelMetrics(rows: number = WALL_ROWS): LevelsPanelMetrics {
    const plate = overlayPlate();
    const gridW = WALL_COLS * WALL_CELL + (WALL_COLS - 1) * WALL_GAP;
    const gridH = rows * WALL_CELL + (rows - 1) * WALL_GAP;
    const gridLeft = plate.x + (plate.w - gridW) / 2;
    const backY = plate.y + 50;
    const gridTop = backY + TOUCH_MIN + 12 + gridH;
    return {
        plate,
        gridLeft,
        gridTop,
        gridW,
        gridH,
        cell: WALL_CELL,
        gap: WALL_GAP,
        backY,
        backW: 240,
        backH: TOUCH_MIN,
        chapterY: gridTop + 64,
        progressY: gridTop + 64,
        criteriaY: gridTop + 24,
    };
}

/**
 * 选关**弹窗**：格墙 + 居中返回（标题 / 遮罩 / 纸面板由 `panelPage` 负责）。
 * `[WXG-T-501]` 图鉴 / 本地榜两入口下线 ⇒ 底排只剩返回。
 */
function levelsLayout(rows: number): MetaLayout {
    const m = levelsPanelMetrics(rows);
    const buttons: MetaButton[] = [];
    pushWallCells(buttons, m.gridLeft, m.gridTop, rows);
    buttons.push({
        id: 'back',
        box: box((DESIGN_W - m.backW) / 2, m.backY, m.backW, m.backH),
    });
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
 * `[WXG-T-601]` 关卡详情弹窗钮行：**板底一行两枚** —— 返回（左，200）+ 开始 CTA（右，300），
 * 与 settings / skins 的返回同档（`plate.y + 50`、`TOUCH_MIN`）。整行 520 居中 ⇒ 左右各留 40。
 *
 * ⚠ 之所以**不**把返回放板顶：`panelPage` 的板标题住在 `plate.y + plate.h − 50`（中线），
 * 顶部 88 高的钮带必与其上下叠压；底部行同时满足「不压标题」与「与其余弹窗返回同位置」。
 * 内容带（副标题 / 缩略 / 星级 / 道具行）的纵向几何单源在 `view/meta-level-detail-page.ts`，
 * 其地板 = 本行上缘（50 + `TOUCH_MIN`）再留 20。
 */
function levelDetailLayout(): MetaLayout {
    const plate = overlayPlate();
    const backW = 200;
    const ctaW = 300;
    const gap = 20;
    const left = plate.x + (plate.w - (backW + gap + ctaW)) / 2;
    return {
        buttons: [
            { id: 'back', box: box(left, plate.y + 50, backW, TOUCH_MIN) },
            { id: 'start-detail', box: box(left + backW + gap, plate.y + 50, ctaW, TOUCH_MIN) },
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

