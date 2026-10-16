/**
 * MetaView — the shell's out-of-run screens (WXG-T-164 批0): 主菜单 + 签到 / 设置
 * overlay. Pure render + hit-test geometry, in the same spirit as
 * `systems/pause-panel.ts`: **holds no state**, reads a flat {@link MetaViewData}
 * the shell assembles each frame from `MetaState` + `BeadsGame` getters (L5).
 *
 * Render and hit-testing share {@link metaLayout}, so the picture and the hot
 * zones can never drift apart. Layouts are cached per overlay (computed once).
 *
 * Frozen sources: ux-spec v1.7 §2 (主菜单 = shell 屏、overlay 栈 设置/签到),
 * systems-index v1.28 §3.14 (体力/币/签到语义)；**EP12-S6 · WXG-T-269-S6 T-2A** 起主菜单
 * 版面 = `menu-architecture.md §5.1–§5.4`（招牌/橱窗作品墙/CTA + 三条硬口径）
 * + `§6` 文案令牌 + `tokens.md §7`，陈列序 = `level-difficulty.md §5.2`。
 *
 * ⚠ **T-2A（纯工程垂直切片）→ T-2B（本批，美术半边）的分工**：T-2A 只摆结构腿（招牌暂用
 * 系统字体读 `app_name` 占位、格内只放编号）；T-2B 起招牌 = **`beadText` 珠拼**（位表真源
 * `config/sign-glyphs.ts` = 林绘澄 T-1，⛔ 本文件不自拟字形）、已解锁格 = **珠拼缩略 + 星**
 * （聚合规则真源 `view/menu-signage.ts` ← T-1 §3.1）。**两族图元只属菜单屏** ⇒ ⛔ 不进玩法
 * `buildRenderModel()` 的盘面/托盘命令流（S0 硬约束⑤ / L5），口径见 `menu-signage.ts` 文件头。
 *
 * Geometry is 派生 (batch-0 functional layout + menu-architecture 线框实测回填; 参考图精修
 * 归后续批次), mirrored constants live in `tuning.ts`（`MENU_*` / `WALL_*` / `SIGN_*` / `THUMB_*` 四组）。
 */

import {
    DESIGN_H,
    DESIGN_W,
    MENU_PLAQUE_BEVEL_INSET,
    MENU_PLAQUE_ICON_INSET,
    MENU_PLAQUE_RIVET_INSET,
    MENU_PLAQUE_RIVET_R,
    MENU_PLAQUE_STROKE,
    MENU_PRIMARY_W,
    MENU_CTA_X,
    MENU_ARROW_ICON,
    MENU_ARROW_VISUAL_D,
    MENU_ARROW_X,
    MENU_BADGE,
    MENU_BAR_FRAME,
    MENU_BAR_H,
    MENU_BAR_ICON_D,
    MENU_BAR_TOP_INSET,
    MENU_BOSS_SLOT,
    MENU_CASE_FRAME,
    MENU_CLIP,
    MENU_CTA_LABEL,
    MENU_CASE_H,
    MENU_CTA_H,
    MENU_CTA_PRESSED_D,
    MENU_CTA_SLICE,
    MENU_CTA_SRC_H,
    UI_PRESS_SINK,
    MENU_BOSS_ART_D,
    MENU_DONE_ICON,
    MENU_LOCK_D,
    MENU_PROGRESS,
    MENU_SEAL,
    MENU_PLATE,
    MENU_PLATE_TITLE,
    MENU_SIGN_FRAME,
    MENU_TEXTURES,
    MENU_TOPBAR_ICON_D,
    type MenuAnchors,
    MENU_TOPBAR_RESERVED_ALPHA,
    MENU_TOPBAR_VISUAL_D,
    MENU_TOPBAR_X,
    SETTINGS_SCRIM_ALPHA,
    SIGNIN_REWARDS,
    SIGN_BEAD_PITCH,
    SIGN_MATRIX_N,
    BEAD_SIZE_LABELS,
    THUMB_MATRIX_N,
    THUMB_STAR_BAND,
    TOUCH_MIN,
    UI_CONTAINER,
    WALL_CELL,
    WALL_COLS,
    WALL_GAP,
    WALL_ROWS,
    WALL_SLOT_DASH,
    WALL_SLOT_DASH_GAP,
    beadStyleLabel,
    menuAnchors,
} from '../config/tuning';
// EP12-S6 · P-7：屏内文案一律读表（`tokens.md §7` / `menu-architecture §6`），⛔ 不散落字面。
import { COPY_TOKENS } from '../config/copy-tokens';
import { THEME_COMING_SOON } from '../config/themes';
import { plateFade } from '../config/menu-carousel';
// EP12-S8：皮肤钮文案单源（`skinLabel` 未注册时回 id 本身，同 `beadStyleLabel` 判例）。
import { skinLabel } from '../config/skins/registry';
// `[WXG-T-280]` CTA 九宫格效果键的唯一构造入口（core 只定义键名，消费在两侧 adapter）。
import { nineSliceFx, type RenderModelBuilder } from '../../framework/index';
import { beadFadedInksFor, DEBUG_OUTLINE_TILE_HEX, type BeadsPalette } from './palette';
import type { SigninReward } from '../game/meta-state';
import type { BeadSizeKind } from '../config/tuning';
// EP12-S6 · T-2B：珠拼图元（招牌 `beadText` + 作品格缩略）的装配入口。本文件只**调用**，
// ⛔ 不在此处复算位表/聚合口径（真源各住 `config/sign-glyphs.ts` 与 `view/menu-signage.ts`）。
import { drawBeadText, drawLevelThumb, resetSignageWarnings } from './menu-signage';
// 顶栏设置钮的齿轮图元 = 对局页 HUD 齿轮**同一程序化画法**（§5.1b 收口 ③：两处**入口语义**不合并，
// 但画法不得各信一份 ⇒ 图元函数复用，零新美术）。
import { drawGear } from './view-model';
import type { BeadsLevelRaw } from '../config/levels-data';

export type MetaOverlay = 'none' | 'signin' | 'settings' | 'levels';

/** Everything the meta screens draw, assembled read-only by the shell. */
export interface MetaViewData {
    readonly stamina: number;
    readonly staminaMax: number;
    readonly coins: number;
    readonly overlay: MetaOverlay;
    /** 当日签到格（`claims % 7`）。 */
    readonly signinDay: number;
    readonly canClaim: boolean;
    // settings overlay（复用 S9 开关集，ux-spec v1.7 §2；debug-info 为 v1.19 菜单侧同串值入口）
    readonly bgmMuted: boolean;
    readonly sfxMuted: boolean;
    readonly reduceMotion: boolean;
    readonly largeText: boolean;
    readonly vibrate: boolean;
    readonly debugInfo: boolean;
    /** 设置 Debug 开关：菜单上画安全区顶 / 胶囊底 / 安全区底三条标定线。 */
    readonly debugGuides: boolean;
    /** EP11-S5 行4 两钮的菜单侧同串值入口（与暂停面板共读同一对 game getter ⇒ 两入口恒一致）。 */
    readonly beadStyle: string;
    readonly beadSize: BeadSizeKind;
    /** EP12-S8 行4 第三钮回显（与暂停面板共读同一 game getter ⇒ 两入口恒一致）。 */
    readonly skinId: string;
    // levels overlay + 主菜单作品墙（选关，#1 · WXG-T-180；EP12-S6 上提进主菜单）——均每帧只读引用，不分配。
    readonly levelCount: number;
    /** 当前关（0-based，play.levelIndex）。 */
    readonly currentLevelIndex: number;
    /** 最高解锁关（1-based）。索引 < maxUnlockedLevel 的关可点。 */
    readonly maxUnlockedLevel: number;
    /** 每关历史星（0-based 索引；稀疏时视图按 `?? 0`）。引用不拷贝。 */
    readonly starsByLevel: readonly number[];
    /**
     * **陈列序映射**（EP12-S6 Deliverable 2）：`wallSlots[槽位] = 关表 0-based 索引`。
     * 单源在 shell（按 `difficultyOf()` 的 DI **升序**、tie 关号升序 ⇒
     * `menu-architecture §3.3` / `level-difficulty §5.2` 九关墙序）；视图**只读引用**，
     * ⛔ 不排序、不拷贝、不持有（L5）。越界槽（`n > WALL_CAPACITY` 的溢出未实现 = S6 Out /
     * 关表短于槽）⇒ `undefined` ⇒ 画虚线空槽。主菜单与 `levels` overlay **共读同一张表**（单序口径）。
     */
    readonly wallSlots: readonly number[];
    /**
     * **槽位 → 关卡引用**（`wallLevels[槽位] = BeadsLevelRaw`，与 {@link wallSlots} 同序同长）。
     * EP12-S6 · T-2B 进场：珠拼缩略需要**关卡 `pattern` 本体**才能聚合（T-1 §3.1）。
     * ⚠ 视图侧**不得**自己 `import { LEVELS }`：宿主可下传自定义关表（`beads-shell.ts::_wallBaseLevels`
     *   判例），视图直读全局关表会与 `play` 实际所用关表漂移 ⇒ 陈列序对、画错图。
     * 表同样由 shell **一次性缓存**（随 `wallSlots` 同批重建）；本字段是每帧只读引用，
     * ⛔ 不拷贝、不持有、不排序（L5）。
     */
    readonly wallLevels: readonly (BeadsLevelRaw | undefined)[];
    /**
     * **走马灯 Boss 图**（`[WXG-T-281]` 用户裁定：走马灯中间只展示 Boss 图、未通关置灰、点图进选关）：
     * `carouselLevel` = 当前陈列关（shell 取进度最远那关，余下已通集反序 ⇒ **每帧零 `difficultyOf`**）；
     * 无可陈列 ⇒ `undefined` ⇒ 虚线空槽。与 {@link wallLevels} 同理 ⇒ 视图 ⛔ 不 `import { LEVELS }`。
     */
    readonly carouselLevel: BeadsLevelRaw | undefined;
    /**
     * `[WXG-T-280]` 逐机落位锚（菜单链，落地单 §2）。shell 在 init/resize 时经
     * `menuAnchors()` 算定一次并恒存 ⇒ 每帧只读引用（⛔ 不得逐帧新建，L5/零分配）。
     * 不传（旧调用方/单测）⇒ 走模块级 {@link DEFAULT_MENU_ANCHORS}（SAFE 常量兑底的锚定档；
     * 第十四批静态档版面已整体退场，⛔ 不再存在第二套菜单几何）。
     * 绘制与 `hitTestMeta` **必须共读同一对象**。
     */
    readonly anchors?: MenuAnchors;
    /**
     * `[WXG-T-280]` Boss 图位三态（缺省视图按在册数据推定：有卡=cleared，有解锁=pushing，余=locked）。
     */
    readonly carouselState?: MetaBossState;
    /**
     * 走马灯视觉偏移（设计 px，正 = 内容右移）。`reduceMotion` 时视图忽略它，改用 {@link carouselT} 淡变。
     * 缺省 0。
     */
    readonly carouselDx?: number;
    /** 0..1，朝相邻项走了多少。木牌文字按它做两段淡变。缺省 0。 */
    readonly carouselT?: number;
    /** 正在露出的相邻项。没有则不画。 */
    readonly carouselPeer?: BeadsLevelRaw;
    readonly carouselPeerState?: MetaBossState;
    /** 相邻项在哪一侧：+1 在右（下一项），-1 在左。缺省按 `carouselDx` 的符号猜。 */
    readonly carouselPeerSign?: -1 | 1;
    /** 下标 = `THEME_LEVEL_MAX` 的空橱窗。中间置灰花，木牌写「敬请期待」。 */
    readonly carouselComingSoon?: boolean;
    readonly carouselPeerComingSoon?: boolean;
    /** 宿主配了 beads-studio 服务地址 ⇒ 设置页画「在线导入」钮（WXG-T-179；缺省不画）。 */
    readonly studioEnabled?: boolean;
    /**
     * **按下态**（P3 · screens.md 控件矩阵「按下」列）：手指按住处的控件 = `hitTestMeta` 返回的
     * **同一缓存对象**（视图按引用比对 ⇒ 零分配）；未按 / 未命中 ⇒ `null` / 缺省。
     */
    readonly pressed?: MetaButton | null;
}

/**
 * **K-6 同帧差分装置的可测参参**（EP12-S6 · T-2B / Deliverable 4）。
 *
 * ⚠ 生产链路（`beads-shell`）**不传 ⇒ 永不命中本分支**，默认值逐字取 `tuning.ts` 的在册档
 * ⇒ 行为/热区/帧内容与本参引入前逐字节一致（`tests/menu-primitives-k6.test.ts` 钉「不传 ≡ 传默认值」）。
 * 存在理由 = 把「图元 +N」钉成**真跑帧的实测差分**（K-051 禁纸面值）：三组对照 =
 * 招牌 beadText on/off、陈列格 3→2 行、缩略 5/4/3 档（= T-1 §3.8 回退序 1/2/3/5）。
 * ⛔ 不得拿本参当运行时降本开关（那会把版面档塞进命路，且越回退序「逐级触发」的口径）。
 */
export interface MetaViewVariant {
    /** 招牌 beadText 开关（false ⇒ 不上珠拼，也不回落文字 ⇒ 纯差分基腿）。 */
    readonly signage?: boolean;
    /** 陈列行数（缺省 `WALL_ROWS`；2 = 回退序 1）。 */
    readonly wallRows?: number;
    /** 缩略字模阵（缺省 `THUMB_MATRIX_N`；4 / 3 = 回退序 2 / 3）。 */
    readonly thumbN?: number;
}

/** A tappable control on a meta screen. */
export type MetaAction =
    | 'start'
    | 'open-signin'
    | 'open-settings'
    | 'open-levels'
    | 'pick-level'
    | 'studio-import'
    /** `[WXG-T-280]` 橱窗 ◀▶ 翻页（落地单 §3；目标集合 = shell 的已通序，视图零语义）。 */
    | 'carousel-prev'
    | 'carousel-next'
    | 'back'
    | 'claim'
    | 'toggle-bgm'
    | 'toggle-sfx'
    | 'toggle-reduce-motion'
    | 'toggle-large-text'
    | 'toggle-vibrate'
    | 'toggle-debug-info'
    /** 设置 Debug：安全区标定线。与 `PausePanelAction` 同串值，shell 走 default → `applySettingsAction`。 */
    | 'toggle-debug-guides'
    /** EP11-S5：与 `PausePanelAction` 同名同语义的选择器钮（行4）；shell 直串值入
     *  `BeadsGame.applySettingsAction`（既有通道，⛔ 不新造动作名）。 */
    | 'cycle-bead-style'
    | 'cycle-bead-size'
    /** EP12-S8 行4 第三枚选择器钮：整套皮肤（与暂停面板同一批 game setter，内容单源）。 */
    | 'cycle-skin';

interface Box {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}

export interface MetaButton {
    readonly id: MetaAction;
    readonly box: Box;
    /**
     * `pick-level` 携带的**墙槽位**（0-based，`0 .. WALL_CAPACITY-1`；其余按钮 undefined）。
     * ⚠ 槽位 **≠ 关索引**：陈列序 = DI 升序 ⇒ 须经 shell 的 `wallSlots` 映射解析。
     * 旧字段名 `levelIndex` 正是 `beads-shell.ts:258`「按槽当关」回归的温床，就此**更名根治**
     * （视图内拿不到、也不该拿到关索引）。
     */
    readonly slot?: number;
}

export interface MetaLayout {
    readonly buttons: readonly MetaButton[];
    /** 签到 overlay 的 7 个日期格（只读展示，非按钮）。 */
    readonly signinCells: readonly Box[];
}

/**
 * `[WXG-T-280]` 橱窗 Boss 图位三态（语义归 shell，视图只读；图形资产待裁 ⇒ 程序化占位）。
 * `locked` 未开启 / `pushing` 推关中 = 右上角徽标；`cleared` 完成 = 另亮中央 boss icon。
 */
export type MetaBossState = 'locked' | 'pushing' | 'cleared';

function box(x: number, y: number, w: number, h: number): Box {
    return { x, y, w, h };
}

function inBox(b: Box, x: number, y: number): boolean {
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

// ─────────────────────────────────────────────────────────── cached layouts

const _layouts = new Map<MetaOverlay, MetaLayout>();
/**
 * **变参布局缓存**（仅供 {@link MetaViewVariant} 的 K-6 差分腿使用）。二级 `Map<overlay, Map<rows, layout>>`
 * ⇒ 非默认档也**只算一次**；键为枚举串与 `number` ⇒ 查表**零字符串拼接分配**（每帧路径走默认档一级缓存）。
 * ⛔ 生产链路不传 variant ⇒ 本缓存恒空。
 */
const _layoutsByRows = new Map<MetaOverlay, Map<number, MetaLayout>>();

const FONT_TITLE = '64px sans-serif';
const FONT_BUTTON = '30px sans-serif';
// ⚠ 旧 `FONT_SMALL`（24px）已于第十一批随 L4 门楣牌改写退场：该档**低于 accessibility E1 地板 28**
//   ⇒ 零消费者后直接删（`noUnusedLocals` 在册）；要更小字号请先解 E1 约束。
const FONT_CELL = '22px sans-serif';
/** `tokens.md §5` `font_label` = 28（slogan / 版本号；字族归 T-2B 美术，本批系统字体占位）。 */
const FONT_LABEL = '28px sans-serif';

/** Panel plate shared by all overlays (centred, below the capsule-avoid band). */
const OVERLAY_W = 600;
const OVERLAY_H = 720;

/**
 * overlay 面板底板（各 overlay 同一块）。**模块级一次算定**：`buildMetaView` 每帧调用 ⇒
 * 旧 `overlayPlate()` 每帧新建一个 Box 对象，属 `control-manifest §2` 热路径分配，就此收敛。
 */
const OVERLAY_PLATE: Box = box(
    (DESIGN_W - OVERLAY_W) / 2,
    (DESIGN_H - OVERLAY_H) / 2,
    OVERLAY_W,
    OVERLAY_H,
);

// ── 作品墙网格几何（`levels` overlay 仍用；主菜单已改为走马灯小卡 ⇒ 框带常量退场）。
//    全部由 `WALL_*` 常量派生，模块级一次算定 ⇒ 每帧只读引用，零分配。数值真源见 `tuning.ts` 本组注释。
/** 网格总宽 = `4×120 + 3×22` = 546（= 旧 `levelsLayout()` 内同值算式）。 */
const WALL_GRID_W = WALL_COLS * WALL_CELL + (WALL_COLS - 1) * WALL_GAP;
// ── 走马灯小卡（menu-architecture §1.3 第五轮终裁：主菜单主区 = 单卡进度展示，卡 = 唯一选关入口）。
//    几何由 {@link anchoredGeo} 逐机算定（`bossBox` 图位 ⇒ `[WXG-T-281]` 旧白卡退场）⇒ 静态档 `CAROUSEL_BOX` 已随锚定档退场。
/** 星级_label 查表（取代旧每帧 `'★'.repeat(n)+'☆'.repeat(3-n)` ⇒ 逐字同串、每帧零字符串分配）。 */
const STAR_LABELS: readonly string[] = ['☆☆☆', '★☆☆', '★★☆', '★★★'];
/** 顶栏预留不实现（公告 / 信箱）两颗的热区**左缘**（只画不注册热区，§5.1b）。 */
const TOPBAR_RESERVED_X: readonly number[] = [MENU_TOPBAR_X.notice, MENU_TOPBAR_X.mail];
/** 预留两颗的图标腿（`[WXG-T-280]` 与 {@link TOPBAR_RESERVED_X} 同序；喇叭暂代公告 = 落地单 §3 C1）。 */
const TOPBAR_RESERVED_ICON: readonly string[] = [MENU_TEXTURES.iconSound, MENU_TEXTURES.iconMail];

/**
 * 生成 `WALL_CAPACITY`（4×3 = 12）个作品格热区。只带**槽位**——关索引由 shell 的
 * `wallSlots` 映射解析 ⇒ 视图侧无从「按槽当关」。
 *
 * 坐标口径（本设计空间 **y 向上**、`box.y` = 下缘）：`topY` = 网格**上沿**（第 1 行格的上边），
 * 第 r 行格下缘 = `topY − WALL_CELL − r×(WALL_CELL+WALL_GAP)` ⇒ 整墙占
 * `[topY − WALL_GRID_H, topY]`（404 高），与 `tuning::WALL_GRID_TOP` 注的框带派生算式一致。
 *
 * `rows`（缺省 `WALL_ROWS`）= K-6 差分腿的陈列行数（回退序 1「格 3→2 行」）⇒ 槽数 `WALL_COLS × rows`，
 * 列几何与行序**逐字不变**（只是少画一行）；默认档 = `WALL_CAPACITY`（4×3 = 12），与本参引入前一致。
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
 * 选关 overlay：与主菜单作品墙**同一组几何、同一 `slot` 口径**（陈列序单源 ⇒ 两屏永不各排一份）。
 * Q5① 后**无菜单入口**，代码与 overlay 保留不删（`levels` 态仍可由宿主/测试驱动）。
 */
function levelsLayout(rows: number): MetaLayout {
    const plate = OVERLAY_PLATE;
    const buttons: MetaButton[] = [];
    pushWallCells(buttons, plate.x + (plate.w - WALL_GRID_W) / 2, plate.y + plate.h - 170, rows);
    // 返回
    const backW = 240;
    buttons.push({ id: 'back', box: box(plate.x + (plate.w - backW) / 2, plate.y + 50, backW, TOUCH_MIN) });
    return { buttons, signinCells: [] };
}

function signinLayout(): MetaLayout {
    const plate = OVERLAY_PLATE;
    const buttons: MetaButton[] = [];
    const cells: Box[] = [];
    // 7 格：4 + 3 居中排布。
    const cellSize = 110;
    const cellGap = 18;
    const rowTopY = plate.y + plate.h - 150;
    for (let i = 0; i < SIGNIN_REWARDS.length; i++) {
        const row = i < 4 ? 0 : 1;
        const col = row === 0 ? i : i - 4;
        const perRow = row === 0 ? 4 : 3;
        const rowW = perRow * cellSize + (perRow - 1) * cellGap;
        const x = plate.x + (plate.w - rowW) / 2 + col * (cellSize + cellGap);
        const y = rowTopY - row * (cellSize + cellGap);
        cells.push(box(x, y, cellSize, cellSize));
    }
    // 领取 + 返回
    const btnW = 240;
    const btnY = plate.y + 60;
    const gap = 30;
    const total = btnW * 2 + gap;
    const left = plate.x + (plate.w - total) / 2;
    buttons.push({ id: 'claim', box: box(left, btnY, btnW, TOUCH_MIN) });
    buttons.push({ id: 'back', box: box(left + btnW + gap, btnY, btnW, TOUCH_MIN) });
    return { buttons, signinCells: cells };
}

function settingsLayout(): MetaLayout {
    const plate = OVERLAY_PLATE;
    const buttons: MetaButton[] = [];
    const ids: MetaAction[] = [
        'toggle-bgm',
        'toggle-sfx',
        'toggle-reduce-motion',
        'toggle-large-text',
        'toggle-vibrate',
        'toggle-debug-info',
        // EP11-S5 / S9 v1.7 §2.2 行4：**内容单源**——选择器钮族与暂停面板同一批
        // game setter（`applySettingsAction` 共用分支），两入口档位永不漂移。
        // EP12-S8 追加第三枚「皮肤」（cycle-skin）。末行空格放 Debug（安全区标定线），
        // 仍是 5 行 × 2 列，plate 高 720 不改。
        'cycle-bead-style',
        'cycle-bead-size',
        'cycle-skin',
        'toggle-debug-guides',
    ];
    // 左右两列（用户 2026-09-25 直派，ux-spec v1.19）：**10 钮 = 5 行 × 2 列**（末行 = 皮肤 + Debug），
    // 总宽/列间 gap 24/行距 `TOUCH_MIN + 16` 均沿用旧口径（任务单：行距沿用、plate 高可复算）。
    // plate 高 **720 不改**，避让实算：`OVERLAY_H` 720 ⇒ plate y∈[307,1027]；
    //   topY = 307+720−150 = 877，行底依次 877 / 773 / 669 / 565 / 461（行高 88）；
    //   ① 顶行上缘 877+88 = 965 < 1027（标题基线 1027−70 = 957，与钮顶 965 的重叠属既有排版，
    //      新增行在**下方**生长 ⇒ 不新增冲突）；② 新底行下缘 461 > 返回钮上缘 307+50+88 = 445
    //      ⇒ 间隙 16 ≥ 0，**不与「返回」/「在线导入」同行族重叠**（EP12-S8 前为 120，仍为正）。
    const rowW = plate.w - 80;
    const rowX = plate.x + 40;
    const colGap = 24;
    const colW = (rowW - colGap) / 2;
    const topY = plate.y + plate.h - 150;
    for (let i = 0; i < ids.length; i++) {
        const col = i % 2;
        const row = (i / 2) | 0;
        buttons.push({
            id: ids[i]!,
            box: box(rowX + col * (colW + colGap), topY - row * (TOUCH_MIN + 16), colW, TOUCH_MIN),
        });
    }
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

function buildLayout(overlay: MetaOverlay, rows: number): MetaLayout {
    return overlay === 'signin' ? signinLayout()
        : overlay === 'settings' ? settingsLayout()
            : overlay === 'levels' ? levelsLayout(rows)
                : menuLayoutAnchored(DEFAULT_MENU_ANCHORS);
}

// ───────────────────────────────────────────────── [WXG-T-280] anchored menu

/**
 * 无 `anchors` 直调（旧调用方/单测）的**模块级兜底锚定档**：全 `null` 入参 ⇒ SAFE 常量进链。
 * 引用恒定 ⇒ {@link anchoredGeo}/{@link menuLayoutAnchored} 的 WeakMap 缓存单例命中（热路径零分配）。
 */
const DEFAULT_MENU_ANCHORS: MenuAnchors = menuAnchors({
    safeTopDp: null,
    capsuleBottomDp: null,
    safeBottomDp: null,
    windowWidthDp: 0,
    designHeight: 0,
});

/**
 * 菜单位图可用性查询（宿主注入：harness 纹注册表 / Cocos carrier）。
 * 缺省全 `false` ⇒ 菜单全部腿走程序化占位 ⇒ 帧内容与位图化之前一致（旧测试套件钉住该等价）。
 */
let _menuBitmapReady: (textureId: string) => boolean = () => false;
export function setMenuBitmapResolver(fn?: (textureId: string) => boolean): void {
    _menuBitmapReady = fn ?? (() => false);
}

/**
 * 锚定几何（**绘制与热区同一对象** ⇒ 永不可漂）。WeakMap 按 anchors 引用缓存
 * ⇒ shell 逐机算定一次恒存 ⇒ 每帧只读引用，零分配（`buildMetaView` 热路径）。
 */
interface AnchoredMenuGeo {
    readonly caseBox: Box;
    readonly bossBox: Box;
    readonly clipBox: Box;
    readonly badgeBox: Box;
    readonly plateBox: Box;
    readonly signBox: Box;
    readonly ctaBox: Box;
    readonly ctaHit: Box;
    readonly arrowL: Box;
    readonly arrowLHit: Box;
    readonly arrowR: Box;
    readonly arrowRHit: Box;
    readonly barBox: Box;
    readonly settingsHit: Box;
    /** 顶栏热区/视觉圆同心 y（= `settingsHit` 中心）。 */
    readonly topbarCy: number;
    /** 完成态 boss icon 圆心 y。 */
    readonly doneCy: number;
    /** 版本号基线 y = CTA 下缘与屏底**净空带**（Δ32 + sb）的中点 ⇒ 恒不侵入 CTA（静态档 `MENU_VERSION_Y` 在系高随档变深后会坐进钮带）。 */
    readonly versionY: number;
}

const _anchoredGeo = new WeakMap<MenuAnchors, AnchoredMenuGeo>();

function anchoredGeo(a: MenuAnchors): AnchoredMenuGeo {
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
    const ctaHit = box(ctaBox.x, ctaBox.y + (MENU_CTA_H - TOUCH_MIN) / 2, MENU_PRIMARY_W, TOUCH_MIN);
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
    const geo: AnchoredMenuGeo = {
        caseBox, bossBox, clipBox, badgeBox, plateBox, signBox, ctaBox, ctaHit,
        arrowL, arrowLHit, arrowR, arrowRHit, barBox, settingsHit,
        topbarCy: settingsHit.y + TOUCH_MIN / 2,
        doneCy: r(a.caseTopY - MENU_DONE_ICON.yOff),
        versionY: r(a.ctaBotY) / 2,
    };
    _anchoredGeo.set(a, geo);
    return geo;
}

/** 锚定主菜单热区版面（与绘制共读 {@link anchoredGeo} ⇒ 「画 A 位、按 B 位」结构性不可能）。 */
const _anchoredLayouts = new WeakMap<MenuAnchors, MetaLayout>();
function menuLayoutAnchored(a: MenuAnchors): MetaLayout {
    const hit = _anchoredLayouts.get(a);
    if (hit !== undefined) return hit;
    const g = anchoredGeo(a);
    const built: MetaLayout = {
        buttons: [
            // `[WXG-T-281]` 白卡退役：点 Boss 图进选关 ⇒ 图位 = `open-levels` 热区（与绘制同一对象）。
            { id: 'open-levels', box: g.bossBox },
            { id: 'start', box: g.ctaHit },
            { id: 'open-settings', box: g.settingsHit },
            { id: 'carousel-prev', box: g.arrowLHit },
            { id: 'carousel-next', box: g.arrowRHit },
        ],
        signinCells: [],
    };
    _anchoredLayouts.set(a, built);
    return built;
}

/**
 * Cached layout for one overlay. `rows` 只服务同帧差分腿（生产不传 ⇒ 走默认档一级缓存）。
 * `[WXG-T-280]` 主菜单 = **锚定档唯一**：第十四批静态档版面与 `topbarTop` 逐机缓存已整体退场，
 * 其余 overlay 的版面不吃逐机参 ⇒ 仍走 {@link _layouts}。
 */
export function metaLayout(
    overlay: MetaOverlay,
    rows: number = WALL_ROWS,
    anchors?: MenuAnchors,
): MetaLayout {
    // 锚定档（shell 实链路传逐机 anchors；直调缺省 ⇒ 模块级兜底档，⛔ 不存在第二套菜单几何）。
    if (overlay === 'none' && rows === WALL_ROWS) return menuLayoutAnchored(anchors ?? DEFAULT_MENU_ANCHORS);
    if (rows === WALL_ROWS) {
        let layout = _layouts.get(overlay);
        if (!layout) {
            layout = buildLayout(overlay, rows);
            _layouts.set(overlay, layout);
        }
        return layout;
    }
    let byRows = _layoutsByRows.get(overlay);
    if (byRows === undefined) {
        byRows = new Map<number, MetaLayout>();
        _layoutsByRows.set(overlay, byRows);
    }
    const cached = byRows.get(rows);
    if (cached !== undefined) return cached;
    const layout = buildLayout(overlay, rows);
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

function label(id: MetaAction, data: MetaViewData): string {
    switch (id) {
        // EP12-S6 · P-7：**钮标签一律读文案表**（`tokens.md §7` / `menu-architecture §6`），⛔ 不落字面。
        case 'start':
            return COPY_TOKENS.btn_start_label;
        case 'open-signin':
            return COPY_TOKENS.btn_signin_label;
        case 'open-settings':
            return COPY_TOKENS.btn_settings_label;
        case 'open-levels':
            // §6 标**退役**（主菜单钮已删 = Q5①「入口隐藏」），但 `levels` overlay 代码保留 ⇒ 仍读表。
            return COPY_TOKENS.btn_levels_label;
        case 'studio-import':
            return '导入';
        case 'claim':
            return data.canClaim ? '领取' : '已领取';
        case 'back':
            return '返回';
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
        case 'toggle-debug-guides':
            return `Debug  ${data.debugGuides ? '开' : '关'}`;
        // EP11-S5 行4 两枚选择器钮：文案与暂停面板（`view-model::panelLabel`）**同字串**（S9 内容单源）；
        // ⛔ 禁写死款数（U16=甲），风格名走 `BEAD_STYLE_LABELS` 单源、未注册时回 id 本身。
        case 'cycle-bead-style':
            return `珠子风格  ${beadStyleLabel(data.beadStyle)}`;
        case 'cycle-bead-size':
            return `豆子尺寸  ${BEAD_SIZE_LABELS[data.beadSize] ?? data.beadSize}`;
        // EP12-S8 行4 第三枚选择器钮：文案与暂停面板（`view-model::panelLabel`）**同字串**（内容单源）；
        // ⛔ 禁写死款数（U16=甲），皮肤名走 `skin.label` 单源、未注册时回 id 本身。
        case 'cycle-skin':
            return `皮肤  ${skinLabel(data.skinId)}`;
        default:
            return '';
    }
}

/** 按下态绘制 y 偏移（y-up ⇒ 下沉为负；`reduceMotion` ⇒ 0，只换面）。 */
function pressDy(data: MetaViewData, pressed: boolean): number {
    return pressed && !data.reduceMotion ? -UI_PRESS_SINK : 0;
}

/** 当前按住的是否为该动作（主菜单锚定档每动作唯一一枚钮 ⇒ 按 id 比对即可）。 */
function isPressed(data: MetaViewData, id: MetaAction): boolean {
    return data.pressed?.id === id;
}

function drawButton(
    builder: RenderModelBuilder,
    b: Box,
    text: string,
    palette: BeadsPalette,
    primary: boolean,
    disabled = false,
    font = FONT_BUTTON,
    pressed = false,
    dy = 0,
): void {
    const y = b.y + dy;
    builder.rect(b.x, y, b.w, b.h, {
        fill: primary
            ? (pressed ? palette.woodFacePressed : palette.accentPrimary)
            : pressed ? palette.cardPressed : palette.slot,
        stroke: primary ? palette.accentPrimary : palette.slotBorder,
        lineWidth: 2,
        radius: 14,
        ...(disabled ? { alpha: 0.5 } : {}),
    });
    builder.text(b.x + b.w / 2, y + b.h / 2, text, {
        fill: primary ? palette.panel : palette.text,
        font,
        align: 'center',
        baseline: 'middle',
    });
}

/**
 * L4 资源条 = **钉在展示窗门楣的一条价目牌**（`menu-architecture §5.1b-2` 第十一批语义 /
 * `[WXG-T-280]` 锚定档几何）。牌体 = `geo.barBox`（条窗一体缝 0，坐在橱窗顶缘） ⇒ 只读、**零热区**。
 *
 * - **图标腿**（落地单 §3 B5/B6）：`iconStamina` / `iconCoin` 位图就绪 ⇒
 *   两端各 blit 一枚 `MENU_BAR_ICON_D`，数值文本**去 emoji**；未就绪 ⇒ 旧 `❤`/`🪙` 文本腿；
 * - **数值字号** = `FONT_LABEL` 28 = accessibility **E1 地板**。⚠ 第九批登记的「26 px」低于
 *   地板 ⇒ 作废（同批注）；图标与数值合为一条 text ⇒ 每端 1 命令（共 2 条，非 4 条）；
 * - **墨色全读 palette**：牌面 `plaque_face` / 描边 `plaque_edge` / 亮线与铆钉 `plaque_bevel` /
 *   字 `wood_text`（对牌面 5.3:1 ✓）⇒ 视图内零 hex 字面（control-manifest §3）。
 */
function drawResourceBar(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    g: Box,
): void {
    const x = g.x;
    const y = g.y;
    const cy = y + g.h / 2;
    builder.rect(x, y, g.w, g.h, {
        fill: palette.plaqueFace,
        stroke: palette.plaqueEdge,
        lineWidth: MENU_PLAQUE_STROKE,
        radius: UI_CONTAINER.radiusChip,
    });
    // 上沿受光线（与描边同档宽）：坐在顶缘描边**内侧**，⛔ 压住圆角段。
    const sheenY = y + g.h - MENU_PLAQUE_STROKE;
    builder.line(
        x + MENU_PLAQUE_BEVEL_INSET, sheenY,
        x + g.w - MENU_PLAQUE_BEVEL_INSET, sheenY,
        palette.plaqueBevel, MENU_PLAQUE_STROKE,
    );
    builder.circle(x + MENU_PLAQUE_RIVET_INSET, cy, MENU_PLAQUE_RIVET_R, { fill: palette.plaqueBevel });
    builder.circle(x + g.w - MENU_PLAQUE_RIVET_INSET, cy, MENU_PLAQUE_RIVET_R, { fill: palette.plaqueBevel });
    const staminaIcon = MENU_TEXTURES.iconStamina;
    const coinIcon = MENU_TEXTURES.iconCoin;
    if (_menuBitmapReady(staminaIcon) && _menuBitmapReady(coinIcon)) {
        const d = MENU_BAR_ICON_D;
        // 铆钉在端缘内 18、半径 3.5。图标从铆钉外缘再让 6，避免心/星压住点。
        const iconX = MENU_PLAQUE_RIVET_INSET + MENU_PLAQUE_RIVET_R + 6;
        builder.blit(staminaIcon, x + iconX, cy - d / 2, d, d);
        builder.blit(coinIcon, x + g.w - iconX - d, cy - d / 2, d, d);
        builder.text(x + iconX + d + 8, cy, `${data.stamina}/${data.staminaMax}`, {
            fill: palette.woodText,
            font: FONT_LABEL,
            align: 'left',
            baseline: 'middle',
        });
        builder.text(x + g.w - iconX - d - 8, cy, `${data.coins}`, {
            fill: palette.woodText,
            font: FONT_LABEL,
            align: 'right',
            baseline: 'middle',
        });
    } else {
        builder.text(x + MENU_PLAQUE_ICON_INSET, cy, `❤ ${data.stamina}/${data.staminaMax}`, {
            fill: palette.woodText,
            font: FONT_LABEL,
            align: 'left',
            baseline: 'middle',
        });
        builder.text(x + g.w - MENU_PLAQUE_ICON_INSET, cy, `${data.coins} 🪙`, {
            fill: palette.woodText,
            font: FONT_LABEL,
            align: 'right',
            baseline: 'middle',
        });
    }
}

/**
 * L6 顶栏三钮（§5.1b 落位表）。视觉圆 **Ø59 居中于 88×88 热区**（推导 2：热区不得互叠）。
 * - **左上 设置**（本批实装）= 白圆 + 齿轮，齿轮画法与对局页 HUD **同一函数**
 *   （§5.1b 收口 ③：裁的是「入口语义不合并」，不是图元不复用 ⇒ 零新画法、零新美术）；
 * - **右上两颗**（公告 / 信箱）= 预留不实现 ⇒ 只画禁用态空圆（α 0.5），⛔ **不画图标**
 *   （图标形状归切图规格 B2/B3，且本批未定取色 ⇒ 零自造）；热区也不注册（见 {@link menuLayoutAnchored}）。
 *
 * ⚠ 圆钮无文字 ⇒ 不走 {@link drawButton}（那个是给矩形纸钮用的）。
 * `[WXG-T-280]` 位图腿：`btnCircle` 就绪 ⇒ 底面 blit（含预留两颗 α=0.5 档）；`iconSettings` 就绪 ⇒
 * 40² 图标替齿轮；预留位图标就绪 ⇒ 同 α 叠 blit。未就绪 ⇒ 程序化腿。
 * 圆心 y = `geo.topbarCy`（与热区同源）；x 档共用 `MENU_TOPBAR_X`。
 */
function drawTopbar(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    geo: AnchoredMenuGeo,
): void {
    const cy = geo.topbarCy; // 热区中心 = 视觉圆中心
    const r = MENU_TOPBAR_VISUAL_D / 2;
    const cxc = MENU_TOPBAR_X.settings + TOUCH_MIN / 2;
    const circleTex = MENU_TEXTURES.btnCircle;
    const circleReady = _menuBitmapReady(circleTex);
    // 设置钮按下：底换 pressed 纹（缺 ⇒ normal 纹）/ 程序化换 cardPressed；盘与图标同沉。
    const pressed = isPressed(data, 'open-settings');
    const scy = cy + pressDy(data, pressed);
    if (circleReady) {
        const tex = pressed && _menuBitmapReady(MENU_TEXTURES.btnCirclePressed) ? MENU_TEXTURES.btnCirclePressed : circleTex;
        builder.blit(tex, cxc - r, scy - r, MENU_TOPBAR_VISUAL_D, MENU_TOPBAR_VISUAL_D);
    } else {
        builder.circle(cxc, scy, r, {
            fill: pressed ? palette.cardPressed : palette.panel,
            stroke: palette.panelBorder,
            lineWidth: 2,
        });
    }
    const settingsIcon = MENU_TEXTURES.iconSettings;
    if (_menuBitmapReady(settingsIcon)) {
        const id = MENU_TOPBAR_ICON_D;
        builder.blit(settingsIcon, cxc - id / 2, scy - id / 2, id, id);
    } else {
        drawGear(builder, cxc, scy, palette);
    }
    // 数组住模块级（`buildMetaView` 每帧走本函数 ⇒ ⛔ 不在热路径 `[a, b]` 现造）。
    for (let i = 0; i < TOPBAR_RESERVED_X.length; i++) {
        const x = TOPBAR_RESERVED_X[i]! + TOUCH_MIN / 2;
        const icon = TOPBAR_RESERVED_ICON[i]!;
        if (circleReady && _menuBitmapReady(icon)) {
            const id = MENU_TOPBAR_ICON_D;
            builder.blit(circleTex, x - r, cy - r, MENU_TOPBAR_VISUAL_D, MENU_TOPBAR_VISUAL_D, {
                alpha: MENU_TOPBAR_RESERVED_ALPHA,
            });
            builder.blit(icon, x - id / 2, cy - id / 2, id, id, { alpha: MENU_TOPBAR_RESERVED_ALPHA });
        } else {
            builder.circle(x, cy, r, {
                fill: palette.panel,
                stroke: palette.slotBorder,
                lineWidth: 2,
                alpha: MENU_TOPBAR_RESERVED_ALPHA,
            });
        }
    }
}

/**
 * 虚线空槽（§5.4 口径 2）。RenderModel **无 dash 笔** ⇒ 合成 6/4 线段（同 `view-model::drawDashedRect`
 * 判例；段长/间隔已收进 `tuning.ts::WALL_SLOT_DASH[_GAP]`，与本处**同值不同源**的归并待授权）。
 */
function drawDashedSocket(builder: RenderModelBuilder, b: Box, color: string): void {
    const period = WALL_SLOT_DASH + WALL_SLOT_DASH_GAP;
    const lw = UI_CONTAINER.strokePanel;
    for (let px = 0; px < b.w; px += period) {
        const len = Math.min(WALL_SLOT_DASH, b.w - px);
        builder.line(b.x + px, b.y, b.x + px + len, b.y, color, lw);
        builder.line(b.x + px, b.y + b.h, b.x + px + len, b.y + b.h, color, lw);
    }
    for (let py = 0; py < b.h; py += period) {
        const len = Math.min(WALL_SLOT_DASH, b.h - py);
        builder.line(b.x, b.y + py, b.x, b.y + py + len, color, lw);
        builder.line(b.x + b.w, b.y + py, b.x + b.w, b.y + py + len, color, lw);
    }
}

/**
 * 橱窗 ◀▶（`[WXG-T-280]` 落地单 §3）：位图腿 = `btnArrow` 底 + 向标 icon；未就绪 ⇒
 * 程序化圆 + ◀/▶ 字模（同纸格语言，零新 hex）。几何由 {@link anchoredGeo} 传入，本函数不复算。
 */
function drawArrow(
    builder: RenderModelBuilder,
    data: MetaViewData,
    b: Box,
    dir: 'left' | 'right',
    palette: BeadsPalette,
): void {
    const pressed = isPressed(data, dir === 'left' ? 'carousel-prev' : 'carousel-next');
    const dy = pressDy(data, pressed);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2 + dy;
    const iconTex = dir === 'left' ? MENU_TEXTURES.iconArrowLeft : MENU_TEXTURES.iconArrowRight;
    if (_menuBitmapReady(MENU_TEXTURES.btnArrow)) {
        const bg = pressed && _menuBitmapReady(MENU_TEXTURES.btnArrowPressed) ? MENU_TEXTURES.btnArrowPressed : MENU_TEXTURES.btnArrow;
        builder.blit(bg, b.x, b.y + dy, b.w, b.h);
        if (_menuBitmapReady(iconTex)) {
            const iw = MENU_ARROW_ICON.w;
            const ih = MENU_ARROW_ICON.h;
            builder.blit(iconTex, cx - iw / 2, cy - ih / 2, iw, ih);
            return;
        }
    } else {
        builder.circle(cx, cy, b.w / 2, {
            fill: pressed ? palette.cardPressed : palette.panel,
            stroke: palette.panelBorder,
            lineWidth: 2,
        });
    }
    builder.text(cx, cy, dir === 'left' ? '◀' : '▶', {
        fill: palette.text,
        font: FONT_BUTTON,
        align: 'center',
        baseline: 'middle',
    });
}

/**
 * 锚定主菜单（`[WXG-T-280]` shell 实链路；施工依据 = 落地单 v3.4 §3）。
 * 每个元素两条腿：位图就绪（{@link setMenuBitmapResolver} 宿主注入）⇒ blit；缺 ⇒ 既有程序化图元。
 * 热区全走 {@link menuLayoutAnchored}（与 `g` 同源），本函数内⛔ 不新建任何命中面。
 * 层序：资源条 → 顶栏 → 橱窗框 → Boss 图位（白板+图）→ 三态徽标 → 木牌 → ◀▶ → 招牌 → slogan → CTA → 版本号。
 */
/**
 * 玻璃里的一项：Boss 原图 + 三态盖章，整体平移 `dx`。原图未装上才回退豆阵。
 * `alpha` < 1 只在 `reduceMotion` 的交叉淡变里出现。
 */
function drawShowcaseItem(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    g: AnchoredMenuGeo,
    level: BeadsLevelRaw | undefined,
    state: MetaBossState,
    dx: number,
    alpha: number,
    comingSoon: boolean,
): void {
    if (alpha <= 0) return;
    const ink = alpha < 1 ? alpha : undefined;
    if (comingSoon) {
        drawComingSoonMark(builder, palette, MENU_DONE_ICON.cx + dx, g.doneCy, ink);
        return;
    }
    if (level !== undefined && _menuBitmapReady(MENU_TEXTURES.bossArt)) {
        const d = MENU_BOSS_ART_D;
        builder.blit(
            MENU_TEXTURES.bossArt,
            MENU_DONE_ICON.cx + dx - d / 2,
            g.doneCy - d / 2,
            d, d,
            ink === undefined ? undefined : { alpha: ink },
        );
    } else if (level !== undefined) {
        drawLevelThumb(
            builder, level, g.bossBox.x + dx, g.bossBox.y, g.bossBox.w, g.bossBox.h,
            Math.max(level.rows, level.cols), g.bossBox.w,
            state === 'locked' ? beadFadedInksFor(level) : undefined,
            ink,
        );
    } else {
        drawDashedSocket(builder, { x: g.bossBox.x + dx, y: g.bossBox.y, w: g.bossBox.w, h: g.bossBox.h }, palette.slotDashed);
    }
    const cx = MENU_DONE_ICON.cx + dx;
    const cy = g.doneCy;
    if (state === 'cleared') {
        const top = g.clipBox.y + g.clipBox.h;
        const x = g.clipBox.x + g.clipBox.w - MENU_SEAL.inset - MENU_SEAL.w + dx;
        const y = top - MENU_SEAL.inset - MENU_SEAL.h;
        if (_menuBitmapReady(MENU_TEXTURES.sealCleared)) {
            builder.blit(MENU_TEXTURES.sealCleared, x, y, MENU_SEAL.w, MENU_SEAL.h, ink === undefined ? undefined : { alpha: ink });
        } else {
            builder.circle(x + MENU_SEAL.w / 2, y + MENU_SEAL.h / 2, 28, { fill: palette.panel, stroke: palette.success, lineWidth: 2 });
            builder.text(x + MENU_SEAL.w / 2, y + MENU_SEAL.h / 2, '通', {
                fill: palette.success, font: FONT_BUTTON, align: 'center', baseline: 'middle',
                ...(ink === undefined ? {} : { alpha: ink }),
            });
        }
        return;
    }
    const locked = state === 'locked';
    const tex = locked ? MENU_TEXTURES.badgeLocked : MENU_TEXTURES.badgeProgress;
    if (_menuBitmapReady(tex)) {
        if (locked) {
            builder.blit(tex, cx - MENU_LOCK_D / 2, cy - MENU_LOCK_D / 2, MENU_LOCK_D, MENU_LOCK_D, ink === undefined ? undefined : { alpha: ink });
        } else {
            const w = MENU_PROGRESS.w;
            const h = MENU_PROGRESS.h;
            // 源图重心不在外接框中心：my 从图片顶边量起，设计空间 y 向上。
            builder.blit(tex, cx - MENU_PROGRESS.mx * w, cy - (1 - MENU_PROGRESS.my) * h, w, h, ink === undefined ? undefined : { alpha: ink });
        }
        return;
    }
    const d = locked ? MENU_LOCK_D : 160;
    builder.circle(cx, cy, d / 2, {
        fill: locked ? palette.slot : palette.accentPrimary,
        stroke: locked ? palette.slotBorder : palette.accentPrimary,
        lineWidth: 2,
    });
    builder.text(cx, cy, locked ? '锁' : '推', {
        fill: locked ? palette.textDim : palette.panel,
        font: FONT_BUTTON, align: 'center', baseline: 'middle',
    });
}

/** 空橱窗中央的置灰花。半径写死，热路径不分配。 */
const SOON_PETALS = 6;
const SOON_RING = 108;
const SOON_CORE_R = 40;
const SOON_PETAL_R = 32;

function drawComingSoonMark(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    cx: number,
    cy: number,
    alpha: number | undefined,
): void {
    const mark = {
        fill: palette.locked,
        stroke: palette.textDim,
        lineWidth: 3,
        ...(alpha === undefined ? {} : { alpha }),
    };
    builder.circle(cx, cy, SOON_CORE_R, mark);
    for (let i = 0; i < SOON_PETALS; i++) {
        const a = (Math.PI * 2 * i) / SOON_PETALS - Math.PI / 2;
        builder.circle(cx + Math.cos(a) * SOON_RING, cy + Math.sin(a) * SOON_RING, SOON_PETAL_R, mark);
    }
}

/** 木牌上的「敬请期待」。`alpha` ≤ 0 不画。 */
function drawComingSoonPlate(
    builder: RenderModelBuilder,
    g: AnchoredMenuGeo,
    palette: BeadsPalette,
    alpha: number,
): void {
    if (alpha <= 0) return;
    const top = g.plateBox.y + g.plateBox.h;
    const a = alpha < 1 ? alpha : undefined;
    builder.text(MENU_PLATE.cx, top - MENU_PLATE_TITLE.singleOff, THEME_COMING_SOON, {
        fill: palette.woodEdge,
        font: FONT_BUTTON,
        align: 'center',
        baseline: 'middle',
        ...(a === undefined ? {} : { alpha: a }),
    });
}

/** 木牌上的关序 / 关名。`alpha` ≤ 0 不画。 */
function drawPlateTitle(
    builder: RenderModelBuilder,
    lv: BeadsLevelRaw,
    g: AnchoredMenuGeo,
    palette: BeadsPalette,
    alpha: number,
): void {
    if (alpha <= 0) return;
    const top = g.plateBox.y + g.plateBox.h;
    const seq = `第 ${lv.id} 关`;
    const a = alpha < 1 ? alpha : undefined;
    if (lv.title) {
        builder.text(MENU_PLATE.cx, top - MENU_PLATE_TITLE.line1Off, seq, {
            fill: palette.woodFace, font: FONT_LABEL, align: 'center', baseline: 'middle',
            ...(a === undefined ? {} : { alpha: a }),
        });
        builder.text(MENU_PLATE.cx, top - MENU_PLATE_TITLE.line2Off, lv.title, {
            fill: palette.woodEdge, font: FONT_BUTTON, align: 'center', baseline: 'middle',
            ...(a === undefined ? {} : { alpha: a }),
        });
    } else {
        builder.text(MENU_PLATE.cx, top - MENU_PLATE_TITLE.singleOff, seq, {
            fill: palette.woodEdge, font: FONT_BUTTON, align: 'center', baseline: 'middle',
            ...(a === undefined ? {} : { alpha: a }),
        });
    }
}

function drawMenuAnchored(
    builder: RenderModelBuilder,
    data: MetaViewData,
    palette: BeadsPalette,
    g: AnchoredMenuGeo,
    withSignage: boolean,
): void {
    drawTopbar(builder, data, palette, g);
    // 展示窗框：位图整件 / 未就绪 ⇒ 虚线空槽（同 §5.4 口径，⛔ 不自造第二套框语言）。
    if (_menuBitmapReady(MENU_TEXTURES.caseFrame)) {
        builder.blit(MENU_TEXTURES.caseFrame, g.caseBox.x, g.caseBox.y, g.caseBox.w, g.caseBox.h);
    } else {
        drawDashedSocket(builder, g.caseBox, palette.slotDashed);
    }
    // 资源条嵌在橱窗顶部（v3.6）：画在窗框之后，覆盖楣的上 46 px。
    drawResourceBar(builder, data, palette, g.barBox);
    // 走马灯（落地单 §8）：窗框不动，豆画 + 盖章在玻璃内水平滑，裁到 clipBox。
    const state: MetaBossState =
        data.carouselState ?? (data.carouselLevel !== undefined ? 'cleared' : data.maxUnlockedLevel > 0 ? 'pushing' : 'locked');
    if (!_menuBitmapReady(MENU_TEXTURES.caseFrame)) {
        builder.rect(g.bossBox.x, g.bossBox.y, g.bossBox.w, g.bossBox.h, {
            fill: palette.slot,
            stroke: palette.slotBorder,
            lineWidth: 2,
            radius: UI_CONTAINER.radiusChip,
        });
    }
    const slide = data.reduceMotion ? 0 : (data.carouselDx ?? 0);
    const travel = data.carouselT ?? 0;
    builder.clip(g.clipBox.x, g.clipBox.y, g.clipBox.w, g.clipBox.h);
    drawShowcaseItem(builder, palette, g, data.carouselLevel, state, slide, data.reduceMotion ? 1 - travel : 1, data.carouselComingSoon === true);
    if ((data.carouselPeer !== undefined || data.carouselPeerComingSoon === true) && travel > 0) {
        const sign = data.carouselPeerSign ?? (slide < 0 ? 1 : -1);
        const peerDx = data.reduceMotion ? 0 : slide + sign * g.clipBox.w;
        drawShowcaseItem(
            builder, palette, g, data.carouselPeer, data.carouselPeerState ?? 'cleared',
            peerDx, data.reduceMotion ? travel : 1, data.carouselPeerComingSoon === true,
        );
    }
    builder.unclip();
    // 木牌板固定。文字按 travel 两段淡变（先出后进，不重叠）。
    if (_menuBitmapReady(MENU_TEXTURES.plate)) {
        builder.blit(MENU_TEXTURES.plate, g.plateBox.x, g.plateBox.y, g.plateBox.w, g.plateBox.h);
        const fade = plateFade(travel);
        if (data.carouselComingSoon === true) drawComingSoonPlate(builder, g, palette, fade[0]);
        else if (data.carouselLevel !== undefined) drawPlateTitle(builder, data.carouselLevel, g, palette, fade[0]);
        if (data.carouselPeerComingSoon === true) drawComingSoonPlate(builder, g, palette, fade[1]);
        else if (data.carouselPeer !== undefined) drawPlateTitle(builder, data.carouselPeer, g, palette, fade[1]);
    }
    // ◀▶ 翻页（热区 = `carousel-prev/next`；无热区语义 ⇒ 壳侧处理）。
    drawArrow(builder, data, g.arrowL, 'left', palette);
    drawArrow(builder, data, g.arrowR, 'right', palette);
    // 招牌：位图 logo 优先；缺 ⇒ beadText / 系统字体回落（两腿互斥，同静态档；中心 = signBox 中心）。
    if (_menuBitmapReady(MENU_TEXTURES.logo)) {
        builder.blit(MENU_TEXTURES.logo, g.signBox.x, g.signBox.y, g.signBox.w, g.signBox.h);
    } else if (withSignage) {
        // 字样居中于板心（图顶 − boardCyOff），非图框中心（图框含绳，板心偏下）。
        const signCy = g.signBox.y + g.signBox.h - MENU_SIGN_FRAME.boardCyOff;
        const beads = drawBeadText(builder, COPY_TOKENS.app_name, signCy, SIGN_MATRIX_N, SIGN_BEAD_PITCH);
        if (beads === 0) {
            builder.text(DESIGN_W / 2, signCy, COPY_TOKENS.app_name, {
                fill: palette.text,
                font: FONT_TITLE,
                align: 'center',
                baseline: 'middle',
            });
        }
    }
    // slogan 已退场（落地单 v3.5，用户 2026-10-15 裁：五档坐标图本无此元素，SE 档板→条仅 19px 放不下）。
    // CTA：九宫格位图（fx 槽 = 唯一拉伸通道）+ 文本；缺 ⇒ 旧纸钮（热区恒 `ctaHit`，与绘制同心）。
    // 按下：pressed 源纹自带台面下移（D=16 源 px，⛔ 不再叠运行时位移）⇒ 文案按 D/源高 同比下沉；
    // 缺 pressed 纹 ⇒ normal 纹 + 运行时下沉（与纸钮同口径）。
    const ctaPressed = isPressed(data, 'start');
    if (_menuBitmapReady(MENU_TEXTURES.cta)) {
        const bakedPress = ctaPressed && _menuBitmapReady(MENU_TEXTURES.ctaPressed);
        const dy = bakedPress ? 0 : pressDy(data, ctaPressed);
        const textDy = bakedPress ? -Math.round((MENU_CTA_PRESSED_D * g.ctaBox.h) / MENU_CTA_SRC_H) : dy;
        builder.blit(bakedPress ? MENU_TEXTURES.ctaPressed : MENU_TEXTURES.cta, g.ctaBox.x, g.ctaBox.y + dy, g.ctaBox.w, g.ctaBox.h, {
            fx: nineSliceFx(MENU_CTA_SLICE.capX, MENU_CTA_SLICE.capY),
        });
        if (_menuBitmapReady(MENU_TEXTURES.ctaLabel)) {
            const lh = MENU_CTA_LABEL.h;
            const lw = lh * MENU_CTA_LABEL.aspect;
            const cx = g.ctaBox.x + g.ctaBox.w / 2;
            const cy = g.ctaBox.y + g.ctaBox.h * (1 - MENU_CTA_LABEL.fromTop) + textDy;
            builder.blit(MENU_TEXTURES.ctaLabel, cx - lw / 2, cy - lh / 2, lw, lh);
        } else {
            builder.text(g.ctaBox.x + g.ctaBox.w / 2, g.ctaBox.y + g.ctaBox.h / 2 + textDy, label('start', data), {
                fill: palette.panel,
                font: FONT_BUTTON,
                align: 'center',
                baseline: 'middle',
            });
        }
    } else {
        drawButton(builder, g.ctaBox, label('start', data), palette, true, false, FONT_BUTTON, ctaPressed, pressDy(data, ctaPressed));
    }
    builder.text(DESIGN_W / 2, g.versionY, COPY_TOKENS.version_label, {
        fill: palette.textDim,
        font: FONT_LABEL,
        align: 'center',
        baseline: 'middle',
    });
}

/** 防御臂告警门（一次性；判例 = `palette.ts::resetPaletteFallbackWarnings`）。 */
let warnedMissingThumbLevel = false;

/** 测试专用：复位本模块的一次性告警门。 */
export function resetMetaViewWarnings(): void {
    warnedMissingThumbLevel = false;
    resetSignageWarnings();
}

/**
 * 作品格（主菜单橱窗与 `levels` overlay **共用同一 renderer** ⇒ 两屏零口径漂）。
 * - **已解锁** = 纸格容器 + **珠拼缩略**（T-1 §3.1 聚合，`view/menu-signage.ts::drawLevelThumb`）+ 星；
 * - **未解锁 / 越界槽** = 虚线空槽（`wall_empty_slot` 无文字⛔ 不加「未解锁」字样、不画🔒）。
 *
 * ⚠ **T-2B 换了格内内容：编号文本退场**（`menu-wall-signage-spec §3.4` 案乙：格几何与热区零变动，
 * 只换内容物）。编号是 T-2A 的**占位**（当时无珠可画）；珠拼缩略就位后它与图竞争同一 84×84 区、
 * 且不传达任何关卡差异 ⇒ 删。陈列序的机械证据改由「缩略与 `wallLevels[slot]` 的聚合表逐条对撞」
 * 提供（见 `tests/meta-menu-wall.test.ts`，比读编号**更强**）。
 * 星位：从旧「格中心 +28」改为**底部星带中心** `box.y + THUMB_STAR_BAND/2`（案乙的分区口径）。
 *
 * @param thumbN 缩略字模阵（生产恒 `THUMB_MATRIX_N`；4 / 3 = K-6 差分与回退序 2/3）
 */
function drawWallCell(
    builder: RenderModelBuilder,
    b: MetaButton,
    data: MetaViewData,
    palette: BeadsPalette,
    thumbN: number,
): void {
    const slot = b.slot;
    const levelIdx: number | undefined = slot === undefined ? undefined : data.wallSlots[slot];
    if (levelIdx === undefined || levelIdx + 1 > data.maxUnlockedLevel) {
        drawDashedSocket(builder, b.box, palette.slotDashed);
        return;
    }
    const isCurrent = levelIdx === data.currentLevelIndex;
    const stars = data.starsByLevel[levelIdx] ?? 0;
    builder.rect(b.box.x, b.box.y, b.box.w, b.box.h, {
        fill: palette.slot,
        stroke: isCurrent ? palette.accentPrimary : palette.slotBorder,
        lineWidth: isCurrent ? 4 : 2,
        radius: UI_CONTAINER.radiusChip,
    });
    const cx = b.box.x + b.box.w / 2;
    const level = slot === undefined ? undefined : data.wallLevels[slot];
    builder.text(cx, b.box.y + THUMB_STAR_BAND / 2, STAR_LABELS[stars] ?? STAR_LABELS[0]!, {
        fill: stars > 0 ? palette.text : palette.textDim,
        font: FONT_CELL,
        align: 'center',
        baseline: 'middle',
    });
    if (level === undefined) {
        // 防御臂（不应发生）：shell 的 `wallLevels` 与 `wallSlots` 同批重建 ⇒ 已解锁槽必有引用。
        // 若宿主只下传了关索引表（旧调用方）⇒ 回落**编号占位**（T-2A 语言，格不空画），一次性告警。
        if (!warnedMissingThumbLevel) {
            warnedMissingThumbLevel = true;
            console.warn(
                '[beads] meta-view: wallSlots 有值但 wallLevels 缺项 ⇒ 该格回落编号占位（珠拼缩略需关卡 pattern 本体，' +
                '见 beads-shell::_rebuildWallSlots；本条仅告警一次）',
            );
        }
        builder.text(cx, b.box.y + b.box.h / 2 - 8, `${levelIdx + 1}`, {
            fill: palette.text,
            font: FONT_BUTTON,
            align: 'center',
            baseline: 'middle',
        });
        return;
    }
    drawLevelThumb(builder, level, b.box.x, b.box.y, b.box.w, b.box.h, thumbN);
}

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
    if (data.overlay === 'none') {
        drawMenuAnchored(builder, data, palette, anchoredGeo(A), withSignage);
        if (data.debugGuides) drawSafeGuides(builder, A);
        return;
    }

    // Overlay：先压暗底层菜单，再画面板。⚠ 遮罩盖**整屏** ⇒ 高读锚定档系高 H（兜底档 = DESIGN_H）。
    // EP11-S5 / ux §3.3 ⑤（U14=丙，Q3=甲）：**设置态遮罩 α 分列**——仅 `settings` overlay
    // 读 `SETTINGS_SCRIM_ALPHA`（初值 0.3 [暂定·待 PT-SKIN-01 真机校准]）；
    // ⚠️ RGB 与其余 overlay **零改动**（菜单侧遮罩历史上就是 `0,0,0`，与 `PANEL_SCRIM_RGB`
    //   不同源，本批不越界统一）， signin/levels 仍读旧 0.5 字面量。
    builder.rect(0, 0, DESIGN_W, A.H, {
        fill:
            data.overlay === 'settings'
                ? `rgba(0,0,0,${SETTINGS_SCRIM_ALPHA})`
                : 'rgba(0,0,0,0.5)',
    });
    const plate = OVERLAY_PLATE;
    builder.rect(plate.x, plate.y, plate.w, plate.h, { fill: palette.panel, radius: 24 });
    // overlay 标题：`levels`/`settings` 读文案表；`signin` 的「七日签到」在 `tokens.md §7` **无对应键**
    // ⇒ 维持既有字面（⛔ 不为此新造令牌，已登记于 T-2A 回传未尽项）。
    const overlayTitle =
        data.overlay === 'signin'
            ? '七日签到'
            : data.overlay === 'levels'
                ? COPY_TOKENS.btn_levels_label
                : COPY_TOKENS.btn_settings_label;
    builder.text(plate.x + plate.w / 2, plate.y + plate.h - 70, overlayTitle, {
        fill: palette.text,
        font: '40px sans-serif',
        align: 'center',
        baseline: 'middle',
    });

    const layout = metaLayout(data.overlay, rows);
    if (data.overlay === 'signin') {
        for (let i = 0; i < layout.signinCells.length; i++) {
            const cell = layout.signinCells[i]!;
            const reward: SigninReward = SIGNIN_REWARDS[i]!;
            const claimed = i < data.signinDay || (i === data.signinDay && !data.canClaim);
            const today = i === data.signinDay;
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
                font: FONT_CELL,
                align: 'center',
                baseline: 'middle',
            });
            builder.text(cell.x + cell.w / 2, cell.y + cell.h / 2 - 16, claimed ? '✓' : rewardText, {
                fill: claimed ? palette.success : palette.text,
                font: FONT_CELL,
                align: 'center',
                baseline: 'middle',
            });
        }
    }

    // 选关 overlay：作品格与主菜单橱窗**同一 renderer**（珠拼缩略 + 星级 + 当前高亮 / 未解锁虚线空槽）；back 走下方通用钮。
    if (data.overlay === 'levels') {
        for (const b of layout.buttons) {
            if (b.id === 'pick-level') drawWallCell(builder, b, data, palette, thumbN);
        }
    }

    for (const b of layout.buttons) {
        if (b.id === 'pick-level') continue; // 选关格已在上方绘制
        if (b.id === 'studio-import' && !data.studioEnabled) continue; // 未配服务 ⇒ 不绘制（也不该被点）
        const primary = b.id === 'claim';
        const disabled = b.id === 'claim' && !data.canClaim;
        // EP11-S5 行4：选择器钮带现档名（如「珠子风格  经典四棱」）⇒ 30px 字模宽于 colW 248，
        // 沿用暂停面板同族做法：小字档（不动已冻结的 plate 几何）。
        const wide = b.id === 'cycle-bead-style' || b.id === 'cycle-bead-size';
        const pressed = data.pressed === b && !disabled;
        drawButton(builder, b.box, label(b.id, data), palette, primary, disabled, wide ? FONT_CELL : FONT_BUTTON, pressed, pressDy(data, pressed));
    }
    if (data.debugGuides) drawSafeGuides(builder, A);
}

/**
 * 安全区标定线（设置 Debug 开）。横线 = 设计空间 y-up；数字 = 距屏顶的设计 px
 * （`st` / 胶囊底 / `H − sb`），对着真机截图读。
 */
function drawSafeGuides(builder: RenderModelBuilder, a: MenuAnchors): void {
    const ink = DEBUG_OUTLINE_TILE_HEX;
    const cap = Math.round(a.H - a.btTopY - 4);
    const marks = [
        { y: a.H - a.st, text: `safe ${a.st}`, x: 16 },
        { y: a.H - cap, text: `cap ${cap}`, x: 280 },
        { y: a.sb, text: `home ${a.sb}`, x: 16 },
    ];
    for (const m of marks) {
        builder.line(0, m.y, DESIGN_W, m.y, ink, 3);
        const below = m.y > a.H * 0.5;
        builder.text(m.x, below ? m.y - 18 : m.y + 18, m.text, {
            fill: ink,
            font: '22px sans-serif',
            align: 'left',
            baseline: 'middle',
        });
    }
}
