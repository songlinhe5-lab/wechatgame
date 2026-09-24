/**
 * BeadsGame 公共契约类型 —— 事件表 + 构造选项。
 *
 * 从 `beads-game.ts` 抽出：这两个是**对外契约**——`BeadsEvents` 是框架总线的事件表
 * （systems-index §4），`BeadsGameOptions` 是构造选项（`beads-shell.ts` / 测试消费）。
 * 与编排实现分文件，让只依赖类型的消费方不必拉整个游戏类。
 *
 * ⚠️ 内部实现类型（如解环器归位队列 `SolverFxQueue`）**不**在此——它们与留在
 * `beads-game.ts` 的玩法方法（`_armSolverFx` / `_stepSolverFx` / `_solveMisplaced`）
 * 同处，拆开反而割裂内聚（且 `SolverFxQueue` 是 knowledge/lessons/criteria.md 的判例锚点）。
 */

import type { BeadsTuning, StageParams } from '../config/tuning.js';
import type { BeadsLevelRaw } from '../config/levels.js';
import type { BeadsPalette } from '../view/palette.js';

/** Events emitted on the framework bus — systems-index §4 (v1.22 event table). */
export interface BeadsEvents extends Record<string, unknown> {
    'tray:spawned': { slot: number; colorIdx: number };
    /**
     * v1.27 payload 变更（WXG-T-158 用户裁定②）：同色全组选中——`slot` = 被点槽、
     * `count` = 组珠数（与 `board:selected.count` 对称）；整组取消零事件。
     */
    'tray:selected': { slot: number; colorIdx: number; count: number };
    /** v1.22 新增：错位珠选中（选择锚置 `board`，与 `tray:selected` 互斥对称）。 */
    'board:selected': { row: number; col: number; colorIdx: number; count: number };
    /** v1.22 新增：取回入槽（S3/S4 同帧原子，不计分不断连）。 */
    'tray:stored': { slot: number; colorIdx: number; fromRow: number; fromCol: number };
    /** v1.22 payload 变更：`slot` 改可选（托盘路径必带；解环器路径不带，E4）。 */
    'bead:placed': { row: number; col: number; colorIdx: number; slot?: number };
    'bead:rejected': { row: number; col: number; colorIdx: number };
    'tray:full': Record<string, never>;
    'tray:expanded': Record<string, never>;
    'powerup:used': { type: string; affectedCells: readonly { row: number; col: number }[] };
    'timer:tick': { remaining: number };
    'timer:urgent': { remaining: number };
    'level:cleared': { levelId: string; remaining: number; ratio: number; stars: number };
    'level:failed': { levelId: string };
    'game:paused': Record<string, never>;
    'game:resumed': Record<string, never>;
    'combo:up': { streak: number; multiplier: number; tier: number };
    'combo:break': { reason: 'wrong' | 'timeout' };
    'sprint:stage': { stageIndex: number; nextParams: StageParams };
    'sprint:ended': { score: number; bestStage: number; settleScore: number };
    /** §4 meta 事件（systems-index v1.28）：震动开关切换（局外不带 levelId）。 */
    'settings:vibrate': { on: boolean };
}

export interface BeadsGameOptions {
    /** Gameplay tuning. Defaults to {@link DEFAULT_TUNING}. */
    readonly tuning?: BeadsTuning;
    /** Colour palette. Defaults to {@link DEFAULT_PALETTE}. */
    readonly palette?: BeadsPalette;
    /** Level table. Defaults to the shipped 8 levels. */
    readonly levels?: readonly BeadsLevelRaw[];
    /** Save key; overridable so tests get isolated storage. */
    readonly saveKey?: string;
    /**
     * Sprint run length override (C1): legal [90, 120], anything else is
     * rejected at BOOT and falls back to `SPRINT_TIME_DEFAULT`.
     */
    readonly sprintTime?: number;
    /**
     * **测试专用**：跳过 BOOT 期错位装配（levels-spec v1.2 §2.1）。生产路径恒装配；
     * 单测用空盘夹具自由构造场景时置 true。场景需要错位珠时用 grid.setBead /
     * applyMisplacedToGrid 显式装配。
     */
    readonly noBootAssembly?: boolean;
    /**
     * 暂停面板「回主菜单」次钮回调（WXG-T-164 批0，pause-settings v1.3 §8-11）：
     * 玩法层不知道 shell/菜单存在，只上报意图；缺省（无 shell）时按钮无副作用。
     */
    readonly onMenuRequest?: () => void;
    /**
     * 新局开局体力闸门（WXG-T-164，systems-index §3.14）：普通局 retry/restart 前调用，
     * 返回 true=已扣心放行、false=0 心被拒（转而触发 {@link onStaminaRefill} 广告回满再重试）。
     * 缺省（无 shell 的独立 BeadsGame）→ 不设闸门，retry/restart 恒放行（保后向兼容，既有单测不变）。
     */
    readonly canStartRun?: () => boolean;
    /**
     * 体力回满激励位发奖回调（§3.11 第二 live 位 / §3.14）：0 心重试被拒后看完广告调用，
     * 由 shell 执行 `meta.refillStamina()`；缺省则不接广告回满（被拒即无副作用）。
     */
    readonly onStaminaRefill?: () => void;
}
