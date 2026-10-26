/**
 * 快照分片契约（WXG-T-420 T8）。
 *
 * 立单出处 = `docs/architecture/beads-arch-review-2026-10-26.md` §5-2 / §6 T8：
 * `BeadsSnapshot` 144 个字段（T8 立项时 143，`[WXG-T-432]` 又加了 `rankPanel`）把**对局 + 面板 + 菜单 + 调试 + 特效**混在一处 ⇒
 * 「只读」守住了（L5），「最小可见」没守住，且加一个字段要横跨四层找位置。
 *
 * **分片落在三面，⛔ 不改运行形状**（判据「渲染指令逐字节一致」+ §6「明确不做：
 * 不重写渲染层」）：
 *  ① 契约面 —— 本文件把字段按归属登记成五张清单，`BeadsSnapshot` 仍是那一份扁平对象；
 *  ② 写出面 —— `snapshot-projection.ts` 按片拆成五个投影函数，形参取本文件的
 *     `Pick` 分片类型 ⇒ 越片写字段是**编译错误**（结构性「加一个字段只动一层」）；
 *  ③ 预分配面 —— `state.ts::createSnapshot` 按片建初始值，稳定缓冲（cells /
 *     traySlots / solver / groupLand / denied 数组）归属所在片自己预分配，逐帧只写值。
 *
 * 读侧（view）可选窄化：`SnapshotPlay` 等分片类型即视图的「最小可见面」——
 * `BeadsSnapshot` 结构上可赋给任一分片（interface 字段全集 ⊇ 分片），故消费方
 * 按需收 `SnapshotFx & SnapshotDebug` 这类交集即可只看见自己要读的字段。
 *
 * 归属口径 = **真源在哪**，不是谁在读：`beadStyle`/`beadSize` 同时供对局页渲染，
 * 但真源是设置档 ⇒ 归 `menu`；`debugGuides` 供菜单画标定线，但真源是调试开关 ⇒ 归 `debug`。
 *
 * 记账纪律：新增字段必须登记进**恰好一片**，否则 `tests/snapshot-shards.test.ts`
 * 的覆盖体检当场红（漏登记 = missing、双登记 = duplicated、清单写了不存在的字段 = unknown）。
 */

import type { BeadsSnapshot } from './state';

// ─────────────────────────────────────────── 片一 · 对局（play-page HUD / 棋盘 / 托盘）
export const PLAY_SHARD_FIELDS = [
    'phase', 'phaseElapsed', 'mode',
    'levelIndex', 'levelId', 'levelName', 'levelCount',
    'remaining', 'timeTotal', 'urgent',
    'gridCols', 'gridRows', 'cells',
    'gridLeft', 'gridTop', 'gridPitch', 'gridCell',
    'beadLodLayers', 'zoomSliderT', 'camZoom', 'hudDy',
    'traySlots', 'trayExpanded', 'trayCanExpand', 'traySelected',
    'boardSelectedRow', 'boardSelectedCol', 'boardGroupRows', 'boardGroupCols', 'boardGroupCount',
    'powerupFreeUses', 'powerupHint',
    'score', 'multiplier', 'streak', 'stageIndex', 'sprintBestScore', 'isNewBest',
    'onboarding', 'hintRow', 'hintCol', 'guideSlot',
    // 契约内嵌的只读 tuning 引用（各片共用，投影 ⛔ 不重写，仅构造期注入）。
    'tuning',
] as const;

// ─────────────────────────────────────────── 片二 · 面板族（暂停 / 结算 / 通关 / 冲刺结算 / 失败）
export const PANEL_SHARD_FIELDS = [
    'panelVisible', 'panelProgress', 'panelInteractive',
    'buyConfirmPrice',
    'clearPanelVisible', 'clearPanelProgress', 'clearPanelInteractive',
    'clearStars', 'clearStarsShown', 'clearStarPopScale',
    'clearQualityScore', 'clearQualityBest',
    'clearRemaining', 'clearPowerupsUsed', 'clearActions', 'clearTaps',
    'clearCoins', 'clearCoinReason', 'clearCoinsCapped', 'clearLastLevel',
    'finishPanelVisible', 'finishPanelProgress', 'finishPanelInteractive',
    'finishStars', 'finishRowsShown', 'finishRowPopScale', 'finishLevels',
    'pressedButton',
    'sprintSettleVisible', 'sprintSettleProgress', 'sprintSettleInteractive',
    'sprintRunBestStage', 'sprintRunBestStreak',
    'banner', 'subBanner', 'bootError',
    'reviveAvailable', 'revived', 'watchingAd', 'failHint',
    // `[WXG-T-432]` S-3 好友榜面板只读视图（真源 = `RankPanel.view()`）⇒ 面板侧。
    'rankPanel',
] as const;

// ─────────────────────────────────────────── 片三 · 菜单 / 设置回显（真源 = GameSettings + meta 存档）
export const MENU_SHARD_FIELDS = [
    'bgmMuted', 'sfxMuted', 'reduceMotion', 'largeText', 'vibrate',
    'beadStyle', 'beadSize', 'skinId',
    'starsTotal',
] as const;

// ─────────────────────────────────────────── 片四 · 调试与度量
export const DEBUG_SHARD_FIELDS = [
    'debugOutlines', 'debugInfo', 'debugGuides', 'perfFrameMs',
    'safeTop', 'capsuleBottom', 'safeBottom',
] as const;

// ─────────────────────────────────────────── 片五 · 特效与反馈时序（单调进度 / 定长槽）
export const FX_SHARD_FIELDS = [
    'comboVfxKind', 'comboVfxProgress', 'comboVfxRow', 'comboVfxCol',
    'pulseClock',
    'wrongRow', 'wrongCol', 'wrongProgress',
    'placeRow', 'placeCol', 'placeProgress', 'liftProgress',
    'solverProgress', 'solverCellRows', 'solverCellCols', 'solverCellCount',
    'solverLandRows', 'solverLandCols', 'solverLandSteps', 'solverLandCount',
    'groupLandRows', 'groupLandCols', 'groupLandSteps', 'groupLandCount', 'groupLandElapsedMs',
    'trayLandSlots', 'trayLandSteps', 'trayLandCount', 'trayLandElapsedMs',
    'sweepProgress', 'confettiProgress', 'waveProgress',
    'colorWaveProgress', 'colorWaveColorIdx', 'colorCueMode', 'colorLockedMask',
    'deniedRows', 'deniedCols', 'deniedProgress', 'deniedCount',
    'tapHintText', 'tapHintRow', 'tapHintCol', 'tapHintAnchor',
] as const;

/** 五片清单登记处（覆盖体检与投影拆分的唯一索引）。 */
export const SNAPSHOT_SHARDS = {
    play: PLAY_SHARD_FIELDS,
    panel: PANEL_SHARD_FIELDS,
    menu: MENU_SHARD_FIELDS,
    debug: DEBUG_SHARD_FIELDS,
    fx: FX_SHARD_FIELDS,
} as const;

export type SnapshotShardName = keyof typeof SNAPSHOT_SHARDS;

/** 分片读/写面：`Pick` 自 `BeadsSnapshot` ⇒ 字段名写错当场编译红（清单 ⊆ 契约）。 */
export type SnapshotPlay = Pick<BeadsSnapshot, (typeof PLAY_SHARD_FIELDS)[number]>;
export type SnapshotPanel = Pick<BeadsSnapshot, (typeof PANEL_SHARD_FIELDS)[number]>;
export type SnapshotMenu = Pick<BeadsSnapshot, (typeof MENU_SHARD_FIELDS)[number]>;
export type SnapshotDebug = Pick<BeadsSnapshot, (typeof DEBUG_SHARD_FIELDS)[number]>;
export type SnapshotFx = Pick<BeadsSnapshot, (typeof FX_SHARD_FIELDS)[number]>;

/** 覆盖体检报告（⛔ 不进热路径：只在测试 / 工具里调用，内部用集合去重）。 */
export interface ShardCoverageReport {
    /** 契约里有、任何片都没登记的字段（= 加字段忘了登记）。 */
    readonly missing: readonly string[];
    /** 被两片及以上同时登记的字段（= 归属未定，投影会互相越片）。 */
    readonly duplicated: readonly string[];
    /** 清单里登记了、契约却不存在的字段（= 改名/删字段留下的陈旧项）。 */
    readonly unknown: readonly string[];
    readonly ok: boolean;
}

/**
 * 用契约的实际键集对拍分片清单：三态皆空 ⇒ 分片与契约同构（每字段恰好属于一片）。
 * 入参是 `readonly string[]` + 可选登记表（默认用 `SNAPSHOT_SHARDS`），故同一条腿可拿
 * **合成键集 / 合成清单**做阳性对照（K-144：只测「真的通过」不足以证明体检有效）。
 */
export function inspectShardCoverage(
    contractKeys: readonly string[],
    shards: Readonly<Record<string, readonly string[]>> = SNAPSHOT_SHARDS,
): ShardCoverageReport {
    const seen = new Set<string>();
    const duplicated = new Set<string>();
    for (const fields of Object.values(shards)) {
        for (const field of fields) {
            if (seen.has(field)) duplicated.add(field);
            else seen.add(field);
        }
    }
    const contract = new Set(contractKeys);
    const missing: string[] = [];
    for (const key of contractKeys) if (!seen.has(key)) missing.push(key);
    const unknown: string[] = [];
    for (const field of seen) if (!contract.has(field)) unknown.push(field);
    return { missing, duplicated: Array.from(duplicated), unknown, ok: missing.length === 0 && duplicated.size === 0 && unknown.length === 0 };
}
