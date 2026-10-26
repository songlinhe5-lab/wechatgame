/**
 * D-03 崩溃快照 IO（WXG-T-059，提案 §2–§4）：把局内可序列化子集写进 storage、
 * BOOT 时读回并校验、校验通过则盖回权威状态。
 *
 * 持有：`CrashSnapshotStore`（存取 + 版本/位图校验，见 `../crash-snapshot.ts`）。
 * 不持有：任何局内状态。读写一律经 {@link CrashSnapshotHost}（由 `BeadsGame` 在构造时
 * 用 getter / setter 接线，热路径零分配；本模块只在 onPause / BOOT / 过关失败清档时触发）。
 *
 * ⛔ 位图只收**可填格**（`locked` 与 `void` 由图案重建，防双真源）；`needed[]` 恢复时重算、不从快照读。
 */
import type { Storage } from '@wxgame/framework';
import { BeadGrid } from '../../entities/grid.js';
import { Tray, type SlotState } from '../../entities/tray.js';
import { PowerupSystem } from '../../systems/powerups.js';
import { SprintTracker } from '../../systems/sprint.js';
import { GameTimer } from '../../systems/timer.js';
import { Spawner } from '../../systems/spawner.js';
import { buildStagePattern, type BeadsLevelRaw } from '../../config/levels.js';
import type { BeadsPhase, GameMode } from '../state.js';
import {
  CrashSnapshotStore,
  decodeFilledBits,
  encodeFilledBits,
  type CrashSnapshot,
} from '../crash-snapshot.js';

/**
 * 宿主接口：崩溃快照需要读写的最小局内状态面。`BeadsGame` 以 getter / setter 对象字面量接线。
 * 读写的是 `BeadsGame` 的权威字段（不在本模块持有副本）。
 */
export interface CrashSnapshotHost {
  readonly phase: BeadsPhase;
  readonly levels: readonly BeadsLevelRaw[];
  readonly grid: BeadGrid;
  readonly tray: Tray;
  readonly sprint: SprintTracker;
  readonly timer: GameTimer;
  readonly spawner: Spawner;
  readonly powerups: PowerupSystem;
  mode: GameMode;
  levelIndex: number;
  pauseIntent: 'manual' | 'system' | null;
  reviveCount: number;
  reviveBonusSec: number;
  isNewBest: boolean;
  /** 冲刺恢复：装载舞台图案（与 `BeadsGame._loadStage` 同一入口）。 */
  loadStage(stageIndex: number): void;
  /** 普通关恢复：装配关卡（与 `BeadsGame._setupLevel` 同一入口）。 */
  setupLevel(index: number): void;
  /** 恢复后停在 PAUSED（`machine.reset('paused')`，触发面板出场与 `game:paused`）。 */
  resetToPaused(): void;
}

export class CrashSnapshotIO {
  private _store: CrashSnapshotStore | null = null;

  constructor(private readonly _host: CrashSnapshotHost) {}

  /** `init()` 时绑定 storage（与 `SaveManager` 同源）。 */
  attach(storage: Storage): void {
    this._store = new CrashSnapshotStore(storage);
  }

  /**
   * D-03：重开本局 / 重玩 / 跳关 / 开新冲刺 / 过关 / 失败 ⇒ 旧快照失效。
   * 与 `write()` 的相位门互补：`write()` 在非 PLAYING/PAUSED 相位也会删。
   */
  clear(): void {
    this._store?.clear();
  }

  /**
   * 只在 PLAYING / PAUSED 写快照；其余相位（BOOT / LEVEL_CLEAR / GAME_OVER / FINISH）
   * **删除**既有快照（提案 §3 表）——否则过关前的残局会覆盖下次启动。
   */
  write(): void {
    const store = this._store;
    if (!store) return;
    const phase = this._host.phase;
    if (phase !== 'playing' && phase !== 'paused') {
      store.clear();
      return;
    }
    // 写失败静默（微信 storage 配额）：本局内存态继续，与 S8 §6 同口径。
    store.write(this.capture());
  }

  /**
   * BOOT 恢复（提案 §4）：校验通过则装配局内态并**停在 PAUSED**，返回 true；
   * 否则返回 false，由 `BeadsGame._boot()` 走常规新局（坏档已被 `read()` 清掉）。
   */
  restore(): boolean {
    const store = this._store;
    if (!store) return false;
    const snapshot = store.read({
      levelCount: this._host.levels.length,
      fillableCountFor: (spec) => this.fillableCountFor(spec.mode, spec.levelIndex, spec.stageIndex),
    });
    if (!snapshot) return false;

    if (!this.apply(snapshot)) {
      store.clear();
      return false;
    }
    // 杀进程后一律按「系统打断」展示面板（提案 §2）。
    this._host.pauseIntent = 'system';
    this._host.resetToPaused();
    return true;
  }

  /** 该关可填格数（快照位图长度校验用）；索引非法 → 0。 */
  private crashFillableCountFor(index: number): number {
    const level = this._host.levels[index];
    if (!level) return 0;
    return new BeadGrid(level.pattern).fillableTotal;
  }

  /**
   * 快照位图应有长度：普通关按关卡表，**冲刺按舞台图案**
   * （`buildStagePattern(stageIndex)`——与 `levelIndex` 无关；见 `CrashContext` 注释）。
   */
  private fillableCountFor(mode: GameMode, levelIndex: number, stageIndex: number): number {
    if (mode === 'sprint') {
      return new BeadGrid(buildStagePattern(stageIndex).pattern).fillableTotal;
    }
    return this.crashFillableCountFor(levelIndex);
  }

  /** 抓取局内可序列化子集（提案 §2 字段表 + 2 项增补，见 `crash-snapshot.ts` 文件头）。 */
  private capture(): CrashSnapshot {
    const h = this._host;
    const grid = h.grid;
    const tray = h.tray;

    // 只收**可填格**：`locked`（x）与 `.` void 由图案重建，禁止另存（防双真源）。
    const filled: boolean[] = [];
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.cell(r, c);
        if (!cell || cell.void || cell.state === 'locked') continue;
        filled.push(cell.state === 'filled');
      }
    }

    // [T-244 · 2026-10-04 用户令「打印日志确认托盘落珠」时探针实测踩到] ⛔ **旧写法有坑**：
    //   空槽也填 `colorIdx: 0` ⟹ 从快照**无法区分「空槽」与「色 0 的珠」**（本次托盘珠色恰为 0
    //   ⟹ 探针据此误判「托盘全空」，实为字段不承载该信息）。⟹ 补 `state`（`SnapshotSlot` 本就
    //   定义了该字段，只是从没被填）⟹ 任何基于快照的托盘断言自此可靠。
    const traySlots: { state: SlotState; colorIdx: number }[] = [];
    for (let i = 0; i < tray.capacity; i++) {
      const slot = tray.slot(i);
      traySlots.push(
        slot ? { state: slot.state, colorIdx: slot.colorIdx } : { state: 'free' as SlotState, colorIdx: 0 },
      );
    }

    const sprint = h.sprint;
    return {
      version: 1,
      // 提案写 `platform.now()`；`GameServices` 未暴露时钟，且 TTL 未启用 ⇒ 用 Date.now()。
      writtenAtMs: Date.now(),
      mode: h.mode,
      levelIndex: h.levelIndex,
      pauseIntent: h.pauseIntent ?? 'system',
      gridFilled: encodeFilledBits(filled),
      traySlots,
      trayExpanded: tray.expanded,
      traySelected: tray.selectedSlot,
      remaining: h.timer.remaining,
      timeTotal: h.timer.total,
      spawnAcc: h.spawner.acc,
      spawnInterval: h.spawner.interval,
      spawnFullReported: h.spawner.fullReported,
      // S6 已入 `src`（WXG-T-060）⇒ 真值；v1.95 字段语义 = **本关已用次数**（免费腿
      // + 购买腿合计；账号级免费额度不入快照——它住 meta 档，恢复时由 shell 注入）。
      powerupUses: h.powerups.usedThisLevel,
      reviveCount: h.reviveCount,
      reviveBonusSec: h.reviveBonusSec,
      sprint:
        h.mode === 'sprint'
          ? {
            streak: sprint.streak,
            multiplier: sprint.multiplier,
            tier: sprint.tier,
            score: sprint.score,
            stageIndex: sprint.stageIndex,
            bestStage: sprint.bestStage,
            bestStreak: sprint.bestStreak,
            windowRemaining: sprint.windowRemaining,
          }
          : null,
    };
  }

  /** 把校验过的快照盖回权威状态；返回 false = 与现行关卡表对不上（丢快照）。 */
  private apply(snapshot: CrashSnapshot): boolean {
    const h = this._host;
    const bits = decodeFilledBits(
      snapshot.gridFilled,
      this.fillableCountFor(snapshot.mode, snapshot.levelIndex, snapshot.sprint?.stageIndex ?? 0),
    );
    if (!bits) return false;

    h.mode = snapshot.mode;
    if (snapshot.mode === 'sprint') {
      const sprint = snapshot.sprint;
      if (!sprint) return false;
      h.sprint.reset();
      h.loadStage(sprint.stageIndex);
      h.sprint.restore(sprint);
      h.timer.reset(Math.max(snapshot.timeTotal, 0));
    } else {
      const level = h.levels[snapshot.levelIndex];
      if (!level) return false;
      // v2.0 供料关停（WXG-T-136）⇒ 旧「供料心跳比对」判据随死路径删除。
      h.levelIndex = snapshot.levelIndex;
      h.setupLevel(snapshot.levelIndex);
      h.timer.reset(Math.max(snapshot.timeTotal, 0));
    }

    // 倒计时：`GameTimer` 没有 remaining setter ⇒ 用 `reset(total)` 再 `tick` 掉差值
    // （差值 ≥ 0；tick 内部 clamp 到 0，其返回值此处无需消费）。
    const delta = snapshot.timeTotal - snapshot.remaining;
    if (delta > 0) h.timer.tick(delta);

    // 位图按图案 zip 盖回（只盖可填格）。
    const grid = h.grid;
    let k = 0;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.cell(r, c);
        if (!cell || cell.void || cell.state === 'locked') continue;
        if (bits[k]) grid.fill(r, c);
        k += 1;
      }
    }
    if (k !== bits.length) return false;

    // needed[] **重算**（提案 §2：绝不从快照恢复，防双真源）。
    h.tray.initNeeded(grid.neededColorCounts());

    // 托盘：先逐档扩容到快照容量（§3.4 v1.83 三档 12/24/48），再逐槽还原（`colorIdx = 0` 即 free）。
    while (h.tray.capacity < snapshot.traySlots.length && h.tray.expand()) { /* 升一档 */ }
    // v1.22（WXG-T-137）：S6 已无托盘镜像（道具目标 = 棋盘错位珠）⇒ 这里不再
    // 逐槽喂镜像，只恢复三计数（`restoreUses`）。托盘槽由上面的逐槽还原独立恢复。
    h.powerups.restoreUses(snapshot.powerupUses);

    // 供料：**先 interval 再 acc**（`interval` setter 会把累加器清零）。
    h.spawner.interval = snapshot.spawnInterval;
    h.spawner.acc = snapshot.spawnAcc;
    h.spawner.fullReported = snapshot.spawnFullReported;

    h.reviveCount = snapshot.reviveCount;
    h.reviveBonusSec = snapshot.reviveBonusSec;
    h.isNewBest = false;
    return true;
  }
}
