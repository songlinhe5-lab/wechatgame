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
    CAROUSEL_W,
    CAROUSEL_H,
    CAROUSEL_TOP,
    CAROUSEL_THUMB_N,
    CAROUSEL_THUMB_AREA,
    CAROUSEL_TEXT_BAND,
    MENU_PRIMARY_W,
    MENU_PRIMARY_Y,
    MENU_ROW_GAP,
    MENU_SECONDARY_GAP,
    MENU_SECONDARY_W,
    MENU_SLOGAN_Y,
    MENU_TITLE_Y,
    MENU_VERSION_Y,
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
} from '../config/tuning.js';
// EP12-S6 · P-7：屏内文案一律读表（`tokens.md §7` / `menu-architecture §6`），⛔ 不散落字面。
import { COPY_TOKENS } from '../config/copy-tokens.js';
// EP12-S8：皮肤钮文案单源（`skinLabel` 未注册时回 id 本身，同 `beadStyleLabel` 判例）。
import { skinLabel } from '../config/skins/registry.js';
import type { RenderModelBuilder } from '@wxgame/framework';
import type { BeadsPalette } from './palette.js';
import type { SigninReward } from '../game/meta-state.js';
import type { BeadSizeKind } from '../config/tuning.js';
// EP12-S6 · T-2B：珠拼图元（招牌 `beadText` + 作品格缩略）的装配入口。本文件只**调用**，
// ⛔ 不在此处复算位表/聚合口径（真源各住 `config/sign-glyphs.ts` 与 `view/menu-signage.ts`）。
import { drawBeadText, drawLevelThumb, resetSignageWarnings } from './menu-signage.js';
import type { BeadsLevelRaw } from '../config/levels-data.js';

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
     * **走马灯小卡**（menu-architecture §1.3 第五轮）：`carouselLevel` = 已通关集合里 `DI`
     * 最高那关的引用（shell 按已缓存的 DI 升序 `wallSlots` 反序取首个已通槽 ⇒ **每帧零 `difficultyOf`**）；
     * 一关未通 ⇒ `undefined` ⇒ 卡画虚线空卡。与 {@link wallLevels} 同理 ⇒ 视图⛔ 不 `import { LEVELS }`。
     * `carouselCleared` / `carouselTotal` = 进度分子/分母（每帧只读整数，不分配）。
     */
    readonly carouselLevel: BeadsLevelRaw | undefined;
    readonly carouselCleared: number;
    readonly carouselTotal: number;
    /** 宿主配了 beads-studio 服务地址 ⇒ 设置页画「在线导入」钮（WXG-T-179；缺省不画）。 */
    readonly studioEnabled?: boolean;
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
    | 'back'
    | 'claim'
    | 'toggle-bgm'
    | 'toggle-sfx'
    | 'toggle-reduce-motion'
    | 'toggle-large-text'
    | 'toggle-vibrate'
    | 'toggle-debug-info'
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
const FONT_SMALL = '24px sans-serif';
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
// ── 走马灯小卡几何（menu-architecture §1.3 第五轮终裁：主菜单主区 = 单卡进度展示，卡 = 唯一选关入口）。
/** 卡外接框（y 向上 ⇒ `box.y` = 下缘 = `CAROUSEL_TOP − CAROUSEL_H`），模块级一次算定。 */
const CAROUSEL_BOX: Box = box(
    (DESIGN_W - CAROUSEL_W) / 2,
    CAROUSEL_TOP - CAROUSEL_H,
    CAROUSEL_W,
    CAROUSEL_H,
);
/** 星级_label 查表（取代旧每帧 `'★'.repeat(n)+'☆'.repeat(3-n)` ⇒ 逐字同串、每帧零字符串分配）。 */
const STAR_LABELS: readonly string[] = ['☆☆☆', '★☆☆', '★★☆', '★★★'];

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
 * 主菜单版面（menu-architecture §1.3 第五轮终裁后，750×1334，y 向上）：
 * 招牌 → slogan → **走马灯小卡**（原 4×3 作品墙下移 `levels` overlay）→ 主钮 → 次级 2 钮 → 版本号。
 * 走马灯卡 = **菜单唯一选关入口**（热区 = 卡本体，`id = 'open-levels'`）；
 * ⛔ **不设独立选关钮**（一个动作一个控件），§5.4 口径③「零第三入口」仍成立（入口 = 卡本体）。
 */
function menuLayout(_rows: number): MetaLayout {
    const cx = DESIGN_W / 2;
    const buttons: MetaButton[] = [];
    // L1 走马灯小卡（热区 = 卡整块 ⇒ 点卡开选关页；卡内零子按钮）。
    buttons.push({ id: 'open-levels', box: CAROUSEL_BOX });
    // 主钮「开始游戏」= 唯一「继续**当前关**」通道（§5.4 口径 1，语义不变）。
    const primaryY = MENU_PRIMARY_Y;
    buttons.push({ id: 'start', box: box(cx - MENU_PRIMARY_W / 2, primaryY, MENU_PRIMARY_W, TOUCH_MIN) });
    // 次级入口 **3→2 钮**（签到 / 设置）：P-5 收敛 = `2×240 + 24 = 504 ≤ 750`（旧 3 钮 768 ⇒ 每边溢出 9px）。
    const secY = primaryY - TOUCH_MIN - MENU_ROW_GAP;
    const total = MENU_SECONDARY_W * 2 + MENU_SECONDARY_GAP;
    const left = cx - total / 2;
    buttons.push({ id: 'open-signin', box: box(left, secY, MENU_SECONDARY_W, TOUCH_MIN) });
    buttons.push({
        id: 'open-settings',
        box: box(left + MENU_SECONDARY_W + MENU_SECONDARY_GAP, secY, MENU_SECONDARY_W, TOUCH_MIN),
    });
    return { buttons, signinCells: [] };
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
        // EP12-S8 追加第三枚「皮肤」（cycle-skin）⇒ 9 钮 = 4 行 × 2 列 + 末行单格。
        'cycle-bead-style',
        'cycle-bead-size',
        'cycle-skin',
    ];
    // 左右两列（用户 2026-09-25 直派，ux-spec v1.19）：**EP12-S8 后 9 钮 = 4 行 × 2 列 + 末行 1 格**，
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
                : menuLayout(rows);
}

/**
 * Cached layout for one overlay. `rows` 只服务 K-6 差分（生产不传 ⇒ 走默认档一级缓存，
 * 与本参引入前**逐字节一致**）；⛔ 不得当运行时降本开关用（热区口径见 {@link hitTestMeta}）。
 */
export function metaLayout(overlay: MetaOverlay, rows: number = WALL_ROWS): MetaLayout {
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
 */
export function hitTestMeta(overlay: MetaOverlay, x: number, y: number): MetaButton | null {
    for (const b of metaLayout(overlay).buttons) {
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

function drawButton(
    builder: RenderModelBuilder,
    b: Box,
    text: string,
    palette: BeadsPalette,
    primary: boolean,
    disabled = false,
    font = FONT_BUTTON,
): void {
    builder.rect(b.x, b.y, b.w, b.h, {
        fill: primary ? palette.accentPrimary : palette.slot,
        stroke: primary ? palette.accentPrimary : palette.slotBorder,
        lineWidth: 2,
        radius: 14,
        ...(disabled ? { alpha: 0.5 } : {}),
    });
    builder.text(b.x + b.w / 2, b.y + b.h / 2, text, {
        fill: primary ? palette.panel : palette.text,
        font,
        align: 'center',
        baseline: 'middle',
    });
}

/** Draw the resource bar (体力 ❤ / 币 🪙) — shared by menu + overlays. */
function drawResourceBar(builder: RenderModelBuilder, data: MetaViewData, palette: BeadsPalette): void {
    const y = DESIGN_H - 180; // 胶囊避让带（y≥1214）之下
    builder.text(40, y, `❤ ${data.stamina}/${data.staminaMax}`, {
        fill: palette.text,
        font: FONT_SMALL,
        align: 'left',
        baseline: 'middle',
    });
    builder.text(DESIGN_W - 40, y, `🪙 ${data.coins}`, {
        fill: palette.text,
        font: FONT_SMALL,
        align: 'right',
        baseline: 'middle',
    });
}

/**
 * L1 走马灯小卡（menu-architecture §1.3 第五轮终裁）：主菜单唯一选关入口。
 * - 上部 = **落位图**（`data.carouselLevel` 存在 ⇒ `drawLevelThumb` 现推 boss 关成品；
 *   缺 ⇒ `drawDashedSocket` 虚线空卡 = 一关未通语言，同 §5.4 口径 2 无文字）；
 * - 下部文字带 = 进度（`carousel_progress_label` + `${cleared}/${total}`）+ 选关提示（读 `btn_levels_label`）。
 * 卡 = `metaLayout` 里的单热区（`open-levels`）；本函数**不追加子按钮** ⇒ 卡内无第二命中面。
 * 容器/虚线只用既有 token，⛔ 零新 hex；文字基线的小像素偏移同 `drawWallCell` 星位判例。
 */
function drawCarouselCard(builder: RenderModelBuilder, data: MetaViewData, palette: BeadsPalette): void {
    const b = CAROUSEL_BOX;
    // 卡容器（纸格语言：slot 面 + slotBorder，同作品格/次级钮，零新 hex）。
    builder.rect(b.x, b.y, b.w, b.h, {
        fill: palette.slot,
        stroke: palette.slotBorder,
        lineWidth: 2,
        radius: UI_CONTAINER.radiusChip,
    });
    // 落位图区（卡上部，坐在文字带之上）。
    const thumbBottom = b.y + CAROUSEL_TEXT_BAND;
    if (data.carouselLevel !== undefined) {
        drawLevelThumb(
            builder,
            data.carouselLevel,
            b.x,
            thumbBottom,
            b.w,
            CAROUSEL_THUMB_AREA,
            CAROUSEL_THUMB_N,
            CAROUSEL_THUMB_AREA,
        );
    } else {
        drawDashedSocket(
            builder,
            box(b.x + (b.w - CAROUSEL_THUMB_AREA) / 2, thumbBottom, CAROUSEL_THUMB_AREA, CAROUSEL_THUMB_AREA),
            palette.slotDashed,
        );
    }
    // 下部文字带：进度行 + 选关提示行（字面全读令牌，⛔ 不散落）。
    builder.text(b.x + b.w / 2, b.y + CAROUSEL_TEXT_BAND - 28, `${COPY_TOKENS.carousel_progress_label} ${data.carouselCleared}/${data.carouselTotal}`, {
        fill: palette.text,
        font: FONT_LABEL,
        align: 'center',
        baseline: 'middle',
    });
    builder.text(b.x + b.w / 2, b.y + 26, COPY_TOKENS.btn_levels_label, {
        fill: palette.textDim,
        font: FONT_LABEL,
        align: 'center',
        baseline: 'middle',
    });
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
 * `variant`（缺省 `undefined`）= K-6 同帧差分入参，**生产不传** ⇒ 三档均取 `tuning.ts` 在册默认值，
 * 帧内容与热区与本参引入前逐字节一致（`tests/menu-primitives-k6.test.ts` 钉住该等价）。
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
    builder.setBackground(palette.background);
    if (data.overlay === 'none') {
        drawResourceBar(builder, data, palette);
        // L2 招牌（P-7：文案仍**只读 `app_name` 令牌**，⛔ 不散字面）：T-2B 起 = `beadText` 珠拼。
        // `MENU_TITLE_Y` 语义 = **外接框中心**（非 baseline，主理人裁定；见 `menu-signage::signBands`）。
        // 返回 0（位表缺字/档不符）⇒ 回落系统字体，两条腿**互斥**、绝不同屏上两份。
        // ⛔ 不用 UI 墨以外的色：招牌墨 = `DEMO_BEAD_INKS` 档位（零新 hex，S0 约束③）。
        if (withSignage) {
            const beads = drawBeadText(
                builder,
                COPY_TOKENS.app_name,
                MENU_TITLE_Y,
                SIGN_MATRIX_N,
                SIGN_BEAD_PITCH,
            );
            if (beads === 0) {
                builder.text(DESIGN_W / 2, MENU_TITLE_Y, COPY_TOKENS.app_name, {
                    fill: palette.text,
                    font: FONT_TITLE,
                    align: 'center',
                    baseline: 'middle',
                });
            }
        }
        // L2b slogan（`app_slogan` · `font_label` 28 · text_secondary）。
        builder.text(DESIGN_W / 2, MENU_SLOGAN_Y, COPY_TOKENS.app_slogan, {
            fill: palette.textDim,
            font: FONT_LABEL,
            align: 'center',
            baseline: 'middle',
        });
        // L1 走马灯小卡（卡自绘 ⇒ 其热区 `open-levels` 不走通用钮绘制）。
        const menuButtons = metaLayout('none', rows).buttons;
        drawCarouselCard(builder, data, palette);
        // L3 CTA：主钮 + 次级 2 钮（走马灯卡已在上面自绘 ⇒ 跳过 `open-levels`）。
        for (const b of menuButtons) {
            if (b.id === 'open-levels') continue;
            drawButton(builder, b.box, label(b.id, data), palette, b.id === 'start');
        }
        // 底部版本号（`version_label` · `font_label` 28 · text_secondary）。
        builder.text(DESIGN_W / 2, MENU_VERSION_Y, COPY_TOKENS.version_label, {
            fill: palette.textDim,
            font: FONT_LABEL,
            align: 'center',
            baseline: 'middle',
        });
        return;
    }

    // Overlay：先压暗底层菜单，再画面板。
    // EP11-S5 / ux §3.3 ⑤（U14=丙，Q3=甲）：**设置态遮罩 α 分列**——仅 `settings` overlay
    // 读 `SETTINGS_SCRIM_ALPHA`（初值 0.3 [暂定·待 PT-SKIN-01 真机校准]）；
    // ⚠️ RGB 与其余 overlay **零改动**（菜单侧遮罩历史上就是 `0,0,0`，与 `PANEL_SCRIM_RGB`
    //   不同源，本批不越界统一）， signin/levels 仍读旧 0.5 字面量。
    builder.rect(0, 0, DESIGN_W, DESIGN_H, {
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
        drawButton(builder, b.box, label(b.id, data), palette, primary, disabled, wide ? FONT_CELL : FONT_BUTTON);
    }
}
