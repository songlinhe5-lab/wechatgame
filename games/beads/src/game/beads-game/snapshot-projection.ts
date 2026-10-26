/**
 * 快照投影（协作模块）—— 把权威游戏状态**原地**拷进 `BeadsSnapshot`（视图只读消费面，L5）。
 * 自 `beads-game.ts::_syncSnapshot` 抽出（WXG-T-420 T6），并按快照分片拆成五段写出（T8）。
 * 快照契约字段全集（`state.ts` 是唯一真源，归属清单见
 * `game/snapshot-shards.ts`），投影只写值、**不增删键**，且**复用同一 `s` 对象与其稳定缓冲（cells /
 * traySlots / powerupFreeUses / solver 数组）——`_syncSnapshot` 每帧经 `buildRenderModel`
 * 走一遍，故热路径**零新增分配**是硬红线（维度 / 容量变更时的原地重建是唯一例外）。
 *
 * 为什么是**模块函数 + 一次性 getter 宿主**而非协作类：本模块零实例状态（纯投影），
 * 与 `hit-test.ts` / `effects-dispatch.ts` 同型（⛔ 不为「统一形态」造无状态壳）。投影
 * 读 ~47 个主类私有成员、扇入极宽（结算块一处即十余源）⇒ 逐参数传递会退化成长签名，
 * 故沿用 `_fx` / `_board` / `_hud` 的**既有惯例**：主类在构造期一次性造一个 getter 宿主
 * （`SnapshotSource`），逐帧只读不建 ⇒ 既授予私有读访问、又不把私有成员公开化（守封装），
 * 且宿主本身零分配。`machine` 结构化为投影实际读取的两字段（状态机泛型持 `BeadsGame`
 * ⇒ 回指主类型会成环）；`solverFx` 结构化为 `SolverFxView`（队形是本类私有细节，不外溢）。
 *
 * 迁移纪律：函数体自 `_syncSnapshot` **逐行搬移**，仅把 `this._X` → `src.X`、
 * `BeadsGame.ONBOARDING_ENABLED` → `src.onboardingEnabled`，**不重排、不改算式、不动注释**
 * （逐字段对拍一致由 `snapshot-projection.test.ts` 的独立不变量 + 既有 20+ 读
 * `game.snapshot` 的用例集体守）。
 */
import type { BeadsPhase, BeadsSnapshot, GameMode } from '../state.js';
import type {
    SnapshotDebug,
    SnapshotFx,
    SnapshotMenu,
    SnapshotPanel,
    SnapshotPlay,
} from '../snapshot-shards.js';
import { bannerFor } from '../state.js';
import { levelIdOf, type BeadsLevelRaw } from '../../config/levels.js';
import {
    powerupBuyPrice,
    REVIVE_MAX_PER_LEVEL,
    TIMER_URGENT_T,
    ZOOM_LOD_LAYERS,
    type GridLayout,
    type PowerupType,
} from '../../config/tuning.js';
import { sliderTFromZoom } from '../../systems/board-camera.js';
import type { BeadGrid } from '../../entities/grid.js';
import type { Tray } from '../../entities/tray.js';
import type { PowerupSystem } from '../../systems/powerups.js';
import type { GameTimer } from '../../systems/timer.js';
import type { SprintTracker } from '../../systems/sprint.js';
import type { PausePanel } from '../../systems/pause-panel.js';
import type { ClearPanel } from '../../systems/clear-panel.js';
import type { FinishPanel } from '../../systems/finish-panel.js';
import type { SprintSettlePanel } from '../../systems/sprint-settle.js';
import type { RankPanel } from '../../systems/rank-panel.js';
import type { ClearCoinGrant } from '../meta-state.js';
import type { GameSettings } from './game-settings.js';
import type { BoardCameraController } from './board-camera-controller.js';
import type { FeedbackFx } from './feedback-fx.js';
import type { InputRouter } from './input-router.js';
import type { BoardAnchor } from './board-tap-router.js';

/**
 * G2′ 解环器序列中投影实际读取的形状（结构子集，避免把主类私有的 `SolverFxQueue` 外溢）。
 * 宿主 `get solverFx()` 返回本类实例 ⇐ 结构兼容。
 */
export interface SolverFxView {
    readonly elapsedMs: number;
    readonly totalMs: number;
    readonly count: number;
    readonly landCount: number;
    readonly cellRows: readonly number[];
    readonly cellCols: readonly number[];
    readonly landRows: readonly number[];
    readonly landCols: readonly number[];
    readonly landSteps: readonly number[];
}

/**
 * 投影的读访问面：`_syncSnapshot` 原读取的全部主类状态，逐字段以 getter 暴露。
 * 由 `BeadsGame` 在构造期一次性装配（`get` 闭包回指 `self._X`）⇒ 逐帧读不建。
 */
export interface SnapshotSource {
    // 相位机：泛型持 BeadsGame ⇒ 只结构化投影读的两字段（current/elapsed），不回指主类型。
    readonly machine: { readonly current: BeadsPhase; readonly elapsed: number };
    readonly mode: GameMode;
    readonly levelIndex: number;
    readonly levels: readonly BeadsLevelRaw[];
    readonly stageIndex: number;
    readonly starsByLevel: readonly number[];
    readonly levelKeys: readonly string[];
    readonly timer: GameTimer;
    readonly grid: BeadGrid;
    readonly layout: GridLayout;
    readonly board: BoardCameraController;
    readonly tray: Tray;
    readonly powerups: PowerupSystem;
    readonly powerupHint: string;
    readonly pendingBuy: PowerupType | null;
    readonly clearPanel: ClearPanel;
    readonly finishPanel: FinishPanel;
    readonly sprintSettle: SprintSettlePanel;
    readonly sprint: SprintTracker;
    readonly panel: PausePanel;
    readonly settings: GameSettings;
    readonly fx: FeedbackFx;
    readonly input: InputRouter;
    readonly solverFx: SolverFxView | null;
    readonly boardSelected: BoardAnchor | null;
    readonly clearCoins: ClearCoinGrant | null;
    readonly lastStars: number;
    readonly lastSettleScore: number;
    readonly settleBestByUid: Readonly<Record<string, number>>;
    readonly actionsPlaying: number;
    readonly pressedButton: string | null;
    readonly sprintBestScore: number;
    readonly isNewBest: boolean;
    readonly debugOutlines: boolean;
    readonly frameMs: number;
    readonly hudDy: number;
    readonly safeTop: number;
    readonly capsuleBottom: number;
    readonly safeBottom: number;
    readonly bootErrors: readonly string[];
    readonly reviveCount: number;
    readonly watchingAd: boolean;
    readonly failHint: string;
    readonly beadLod: boolean;
    readonly onboardDone: boolean;
    readonly onboardingEnabled: boolean;
    /** `[WXG-T-432]` 好友榜面板占位状态机（投影只读 `view()`）。 */
    readonly rankPanel: RankPanel;
}

/**
 * 把权威状态原地投影进 `s`（⛔ 不返回新对象、不改 `s` 的引用身份）。调用方（`_syncSnapshot`）
 * 传入常驻的 `this._snapshot` 与一次性装配的 `src`，逐帧复用 ⇒ 零新增分配。
 *
 * WXG-T-420 T8：投影体按**分片**拆成五个函数（契约见 `../snapshot-shards.ts`），每片形参
 * 取分片面 ⇒ **越片写字段是编译错误**，新增字段只需落到它所属的那一片。
 * 调用序 = 对局 → 面板 → 菜单 → 调试 → 特效，与 T6 的写出序在数据上等价：
 * 片内自读的缓冲（`cells` / `traySlots` / `finishStars` / `solverCellRows`）在同一片内
 * 先写后用；原本跨块读 `s.phase` 的三处（banner / revive 门 / 引导门）改直读权威源
 * `src.machine.current`（`projectPlayShard` 已在本帧先写入同值 ⇒ 逐字节不变）。
 */
export function projectSnapshot(s: BeadsSnapshot, src: SnapshotSource): void {
    projectPlayShard(s, src);
    projectPanelShard(s, src);
    projectMenuShard(s, src);
    projectDebugShard(s, src);
    projectFxShard(s, src);
}

/** 片一 · 对局：相位 / 关卡 / 计时 / 棋盘 / 托盘 / 选择锚 / 相机 / 道具体 / 首屏引导。 */
function projectPlayShard(s: SnapshotPlay, src: SnapshotSource): void {
    s.phase = src.machine.current;
    s.phaseElapsed = src.machine.elapsed;
    s.mode = src.mode;
    s.levelIndex = src.levelIndex;
    const currentLevel = src.levels[src.levelIndex];
    s.levelId = src.mode === 'sprint' ? 'sprint' : currentLevel ? levelIdOf(currentLevel) : '';
    s.levelName =
        src.mode === 'sprint'
            ? `冲刺 STAGE ${src.stageIndex + 1}`
            : (currentLevel?.name ?? '');
    s.levelCount = src.levels.length;

    s.remaining = Math.max(0, Math.ceil(src.timer.remaining - 1e-9));
    s.timeTotal = src.timer.total;
    s.urgent = src.timer.remaining <= TIMER_URGENT_T && src.timer.remaining > 0;

    // Grid cells (rebuild the flat buffer only when dimensions change).
    const cellsNeeded = src.grid.rows * src.grid.cols;
    if (s.gridCols !== src.grid.cols || s.gridRows !== src.grid.rows) {
        s.gridCols = src.grid.cols;
        s.gridRows = src.grid.rows;
        s.cells = [];
        for (let i = 0; i < cellsNeeded; i++) {
            s.cells.push({ state: 'empty', colorIdx: 0, beadColorIdx: 0, void: false });
        }
    }
    for (let i = 0; i < cellsNeeded; i++) {
        const row = Math.floor(i / src.grid.cols);
        const col = i % src.grid.cols;
        const cell = src.grid.cell(row, col)!;
        const out = s.cells[i]!;
        out.state = cell.state;
        out.colorIdx = cell.colorIdx;
        out.beadColorIdx = cell.beadColorIdx;
        out.void = cell.void;
    }
    s.gridLeft = src.layout.left;
    s.gridTop = src.layout.top;
    // Camera-scaled spacing/size so the render path matches `hitGridCell` exactly
    // at any zoom (丁-3). = BEAD_PITCH/BEAD_CELL at identity → snapshot byte-identical.
    s.gridPitch = src.layout.pitch;
    s.gridCell = src.layout.cell;
    s.beadLodLayers = src.beadLod ? ZOOM_LOD_LAYERS : 0; // 0 = 满层；视图只读不判阈值（C7 拆名：zoom LOD 用 ZOOM_LOD_LAYERS，不再蹭波浪常量）
    // 缩放控件（盘面下方净空带）：slider 位置与倍率读数，视图只读（L5）。
    s.zoomSliderT = sliderTFromZoom(src.board.camera.zoom);
    s.camZoom = src.board.camera.zoom;

    // S6 cards: remaining free uses per powerup（v1.95 = 账号级永久额度，0 ⇒ 视图
    // 压暗卡片并走双通道面板）+ the one-shot over-limit hint.
    s.powerupFreeUses.windowRestore = src.powerups.freeUses('windowRestore');
    s.powerupFreeUses.randomRestore = src.powerups.freeUses('randomRestore');
    s.powerupFreeUses.trayRestore = src.powerups.freeUses('trayRestore');
    s.powerupHint = src.powerupHint;

    // Tray slots (rebuild on capacity change, i.e. expansion).
    if (s.traySlots.length !== src.tray.capacity) {
        s.traySlots = [];
        for (let i = 0; i < src.tray.capacity; i++) {
            s.traySlots.push({ state: 'free', colorIdx: 0 });
        }
    }
    for (let i = 0; i < src.tray.capacity; i++) {
        const slot = src.tray.slot(i)!;
        const out = s.traySlots[i]!;
        out.state = slot.state;
        out.colorIdx = slot.colorIdx;
    }
    s.trayExpanded = src.tray.expanded;
    s.trayCanExpand = src.tray.canExpand;
    s.traySelected = src.tray.selectedSlot;
    // v2.0 统一选择锚 · board 侧（E2）：E6 据此画错位珠高亮；-1 = 无。
    // 与 traySelected 三值互斥（input-control §2.1），至多一侧 ≥ 0。
    s.boardSelectedRow = src.boardSelected ? src.boardSelected.row : -1;
    // WXG-T-148 ③：连通组快照（预分配容量，写值不新建 —— 热路径零分配）。
    const grp = src.boardSelected?.order;
    s.boardGroupCount = grp ? Math.min(grp.length, s.boardGroupRows.length) : 0;
    if (grp) {
        for (let gi = 0; gi < s.boardGroupCount; gi++) {
            s.boardGroupRows[gi] = grp[gi]!.row;
            s.boardGroupCols[gi] = grp[gi]!.col;
        }
    }
    s.boardSelectedCol = src.boardSelected ? src.boardSelected.col : -1;

    // Sprint HUD (normal mode keeps zeros — the view hides the block).
    s.score = src.mode === 'sprint' ? src.sprint.score : 0;
    s.multiplier = src.mode === 'sprint' ? src.sprint.multiplier : 1;
    s.streak = src.mode === 'sprint' ? src.sprint.streak : 0;
    s.stageIndex = src.stageIndex;
    s.sprintBestScore = src.sprintBestScore;
    s.isNewBest = src.isNewBest;
    s.hudDy = src.hudDy; // 动态高 + 胶囊避让：HUD 带与齿轮热区同读（`hitGear`）

    // GAP-03 首屏引导：仅普通模式 PLAYING、首玩且本会话未落过子时激活（§6.3）。
    // [WXG-T-239] `ONBOARDING_ENABLED = false` ⇒ 引导**显示已屏蔽**（设计与规格全留档，恢复见该常量头注）。
    // ⛔ 短路顺序刻意「开关在前」：关闭时**完全不进**引导算法（`hintRow`/`hintCol`/`guideSlot` 保持 -1）
    //   ⇒ 零额外计算、且从根上排除「引导半途生效」。（相位门原读 `s.phase`，本批改读权威源
    //   `src.machine.current` —— 同帧同值 ⇒ 逐字节不变。）
    s.onboarding =
        src.onboardingEnabled
        && src.mode === 'normal'
        && src.machine.current === 'playing'
        && !src.onboardDone;
    if (s.onboarding) {
        // 首珠 = 托盘当前持有的最前一颗（GAP-02 首供落点）；其色决定单一目标格。
        let guideSlot = -1;
        let firstColor = -1;
        for (let i = 0; i < s.traySlots.length; i++) {
            const sl = s.traySlots[i]!;
            if (sl.state !== 'free') {
                guideSlot = i;
                firstColor = sl.colorIdx;
                break;
            }
        }
        s.guideSlot = guideSlot;
        if (firstColor >= 0) {
            // 行主序首个匹配该色的可填空槽（单一指向 = 引导设计原则，避免多格同亮）。
            for (let i = 0; i < s.gridRows && s.hintRow < 0; i++) {
                for (let j = 0; j < s.gridCols; j++) {
                    const c = s.cells[i * s.gridCols + j]!;
                    if (!c.void && c.state === 'empty' && c.colorIdx === firstColor) {
                        s.hintRow = i;
                        s.hintCol = j;
                        break;
                    }
                }
            }
        }
    } else {
        s.hintRow = -1;
        s.hintCol = -1;
        s.guideSlot = -1;
    }
}

/** 片二 · 面板族：购买确认 / 结算 / 通关 / 冲刺结算 / 暂停 / 失败横幅。 */
function projectPanelShard(s: SnapshotPanel, src: SnapshotSource): void {
    // 购买确认弹窗（ux-spec §3.7）：0 = 关；>0 = 该型单价，视图直接印进标题。
    s.buyConfirmPrice = src.pendingBuy ? powerupBuyPrice(src.pendingBuy) : 0;

    // S7 结算·过关面板（ux-spec §3.4）：数据 + 动画进度一起进快照，视图只读。
    s.clearPanelVisible = src.clearPanel.visible;
    s.clearPanelProgress = src.clearPanel.progress;
    s.clearPanelInteractive = src.clearPanel.interactive;
    s.clearStars = src.lastStars;
    // 品质分单榜（ADR-0035 Q1=B）：本局分 + 本关历史最佳（刚在通关帧更新过）。
    s.clearQualityScore = src.lastSettleScore;
    s.clearQualityBest =
        src.settleBestByUid[src.levelKeys[src.levelIndex] ?? ''] ?? src.lastSettleScore;
    s.clearCoins = src.clearCoins?.coins ?? 0;
    s.clearCoinReason = src.clearCoins?.reason ?? '';
    s.clearCoinsCapped = src.clearCoins?.capped ?? false;
    const shown = src.clearPanel.starsShown(src.lastStars);
    s.clearStarsShown = shown;
    s.clearStarPopScale = shown > 0 ? src.clearPanel.starScale(shown - 1) : 1;
    // BD-47（WXG-T-127）：结算面板「剩余 mm:ss」不吃浮点尾数 —— 快照层即取整，
    // 口径与上方 s.remaining 一致（ceil − 1e-9，倒计时显示不提前归零）；
    // formatTime 的 floor 只是视图兜底，两层都补（T-118 前发现、本单补登）。
    s.clearRemaining = Math.max(0, Math.ceil(src.timer.remaining - 1e-9));
    s.clearPowerupsUsed = src.powerups.usedCount;
    s.clearTaps = src.input.tapsPlaying; // playtest 计量（含误点的输入计数）
    s.clearActions = src.actionsPlaying; // 定星口径（与 `pricing.actions` 同口径）
    s.clearLastLevel = src.levelIndex >= src.levels.length - 1;

    // S7 通关画面（ux-spec §3.6）：总览数据 + 逐关入场进度一起进快照，视图只读。
    s.finishPanelVisible = src.finishPanel.visible;
    s.finishPanelProgress = src.finishPanel.progress;
    s.finishPanelInteractive = src.finishPanel.interactive;
    if (s.finishStars.length !== src.levels.length) {
        s.finishStars = new Array<number>(src.levels.length).fill(0);
    }
    for (let i = 0; i < s.finishStars.length; i++) {
        s.finishStars[i] = src.starsByLevel[i] ?? 0;
    }
    const finishRows = src.finishPanel.rowsShown(src.levels.length);
    s.finishRowsShown = finishRows;
    s.finishRowPopScale = finishRows > 0 ? src.finishPanel.rowPopScale(finishRows - 1) : 1;
    s.finishLevels = src.levels; // S7 陈列条：只读引用（视图 ⛔ 不 import LEVELS）
    s.pressedButton = src.pressedButton;
    // `[WXG-T-432]` 好友榜面板占位（S-3）：七态 / 计数 / 所属榜单一并进快照，视图只读。
    s.rankPanel = src.rankPanel.view();

    // S7 冲刺结算面板（ux-spec §3.5 左列）：内容行数据 + 入/出进度一起进快照。
    s.sprintSettleVisible = src.sprintSettle.visible;
    s.sprintSettleProgress = src.sprintSettle.progress;
    s.sprintSettleInteractive = src.sprintSettle.interactive;
    s.sprintRunBestStage = src.sprint.bestStage;
    s.sprintRunBestStreak = src.sprint.bestStreak;

    s.panelVisible = src.panel.visible;
    s.panelProgress = src.panel.progress;
    s.panelInteractive = src.panel.interactive;

    const copy = bannerFor(src.machine.current, src.levelIndex >= src.levels.length - 1);
    s.banner = copy.banner;
    s.subBanner = copy.sub;
    s.bootError = src.bootErrors.join('; ');
    s.reviveAvailable =
        src.machine.current === 'game-over' && src.mode === 'normal' && src.reviveCount < REVIVE_MAX_PER_LEVEL;
    s.revived = src.reviveCount > 0;
    s.watchingAd = src.watchingAd;
    s.failHint = src.failHint;
}

/**
 * 片三 · 菜单 / 设置回显：顶栏与装扮馆文案、无障碍与震动开关、总星数。
 * 这些值同时供对局页渲染（如 `beadStyle` / `reduceMotion`）⇒ 分片按**真源**归类，
 * 读侧（view）拿的仍是整份 `BeadsSnapshot`，不因此少看字段。
 */
function projectMenuShard(s: SnapshotMenu, src: SnapshotSource): void {
    // 总星数（EP14-S2 · R6 = Σ 各关历史最高）：局部累加，热路径零分配（L5 / 控制清单）。
    let starsTotal = 0;
    for (let i = 0; i < src.starsByLevel.length; i++) starsTotal += src.starsByLevel[i]!;
    s.starsTotal = starsTotal;

    s.bgmMuted = src.settings.values.bgmMuted;
    s.sfxMuted = src.settings.values.sfxMuted;
    s.reduceMotion = src.settings.values.reduceMotion;
    s.largeText = src.settings.values.largeText;
    s.vibrate = src.settings.values.vibrate;
    // EP11-S5 行4 两钮的档位回显 + view 换肤渲染的 styleId 入口（L5：view 只读、不判定）。
    s.beadStyle = src.settings.values.beadStyle;
    s.beadSize = src.settings.values.beadSize;
    // EP12-S8：皮肤 id 回显（钮文案单源 = `skin.label`；渲染走 palette 实例，不经本值查表）。
    s.skinId = src.settings.values.skinId;
}

/** 片四 · 调试与度量：开关回显 + 逐机安全区 / 胶囊深度（只服务标定线与性能覆层）。 */
function projectDebugShard(s: SnapshotDebug, src: SnapshotSource): void {
    s.debugOutlines = src.debugOutlines;
    s.debugInfo = src.settings.values.debugInfo;
    s.debugGuides = src.settings.values.debugGuides;
    s.perfFrameMs = src.frameMs;
    s.safeTop = src.safeTop;
    s.capsuleBottom = src.capsuleBottom;
    s.safeBottom = src.safeBottom;
}

/** 片五 · 特效与反馈时序：单调进度 + 定长槽（曲线在 view 侧推导，L5）。 */
function projectFxShard(s: SnapshotFx, src: SnapshotSource): void {
    src.fx.writeSnapshot(s); // 连击 / 反馈计时 / 单色提示 / 轻提示（协作类投影，只写特效片）

    // G2′ 解环器：一条单调进度 + 两组定长格坐标（相序曲线在 view 侧推导，L5）。
    // 不活跃 ⇒ count 归零且数组填 -1（零残留，同 G1 槽置 null 口径）。
    const sfx = src.solverFx;
    s.solverProgress = sfx ? Math.min(1, sfx.elapsedMs / sfx.totalMs) : 0;
    s.solverCellCount = sfx ? sfx.count : 0;
    s.solverLandCount = sfx ? sfx.landCount : 0;
    for (let i = 0; i < s.solverCellRows.length; i++) {
        s.solverCellRows[i] = sfx ? sfx.cellRows[i]! : -1;
        s.solverCellCols[i] = sfx ? sfx.cellCols[i]! : -1;
    }
    for (let i = 0; i < s.solverLandRows.length; i++) {
        s.solverLandRows[i] = sfx && i < sfx.landCount ? sfx.landRows[i]! : -1;
        s.solverLandCols[i] = sfx && i < sfx.landCount ? sfx.landCols[i]! : -1;
        s.solverLandSteps[i] = sfx && i < sfx.landCount ? sfx.landSteps[i]! : -1;
    }
}
