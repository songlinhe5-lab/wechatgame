/**
 * S6 — 道具系统（真源：`design/gdd/powerups-v2.md` v2.6 + `systems-index §3.6`
 * **v1.95 换版**，WXG-T-419/429/431）。三件道具（显示名 / 内部名解耦）：
 *
 *  - **熨贴片 `windowRestore`** —— 自动找「错位珠最密集」的 `SIDE`×`SIDE`（6×6）
 *    窗口，窗口内**全部归位**；盘面任一边小于 6 时窗口贴边收缩为整盘。
 *  - **抖豆筛 `randomRestore`** —— 从全部错位珠里随机抽 `RANDOM_RESTORE_COUNT`
 *    （12）颗归位（不足不补）。
 *  - **扫豆刷 `trayRestore`** —— 把**托盘里**的珠子全部归位：目标格空 ⇒ 放入；
 *    被占 ⇒ 换出，换出的珠子随机填到盘面剩余空格（允许制造新错位——守恒的
 *    必要收尾，珠子不消失、不就地改色）。
 *
 * 两条「绝不」（本系统的全部边界）：
 *  - **绝不写网格 / 托盘** —— 它只**点名**要动的格，真正的写入由 `BeadsGame`
 *    经 grid 既有写原语（`retrieve` / `fill` / `setBead`）与 S4 托盘事件执行；
 *    托盘对 S6 **只读**（S4 是唯一写入方，v1.95 推翻「零读写」后收窄为「只读」）。
 *  - **绝不碰时钟** —— 不加时、不冻结（S5 是唯一时间真源，§3.5）。
 *
 * 因此本类**不持有任何权威状态，也不持有任何镜像**。错位珠清单、托盘珠清单、
 * 空格清单、盘面尺寸都由调用方（`BeadsGame`）在**请求那一刻**传入 —— S6 保持
 * **无状态纯函数**：零镜像、零双真源、零失真。
 *
 * **免费额度 = 账号级永久每型 1 次**（§3.6 v1.95 语义变更）：耗尽标志由调用方
 * 从 `BeadsMeta` 注入（{@link setFreeDepleted}），本关内用掉即置位并由调用方落
 * 档；新关 / 失败重试 / 暂停重玩 / 换关**均不恢复**（{@link reset} 不碰它）。
 * 新手引导演示不消耗额度（用户明示例外，`onboarded` 侧防重复）。
 *
 * 随机性唯一来源 = 注入的 `Rng`（铁律 L4，禁 `Math.random`；§8-4 有架构守卫）。
 */

import {
  POWERUP_FREE_USES,
  POWERUP_TYPES,
  RANDOM_RESTORE_COUNT,
  SIDE,
  type PowerupType,
} from '../config/tuning';
import type { Rng } from '../../framework/index';

/**
 * 一颗错位珠的最小描述（S6 只读这三个字段，**不读整个 grid** ⇒ 系统保持无状态，
 * 也便于测试直接构造清单）。
 */
export interface MisplacedBead {
  readonly row: number;
  readonly col: number;
  /** 珠色（= grid 的 `beadColorIdx`），必与其所在格的要求色不同。 */
  readonly colorIdx: number;
}

/** `powerup:used` 载荷里的一格。 */
export interface AffectedCell {
  readonly row: number;
  readonly col: number;
}

/**
 * 托盘里一颗待归位珠的最小描述（`trayRestore` 专用）。调用方（`BeadsGame`）
 * 负责筛掉「目标格锁定 / 不存在」的珠 —— S6 只按给定清单点名。
 */
export interface TrayBead {
  readonly colorIdx: number;
  /** 来源托盘槽号（动手帧 `takeBead` 用；调用方保证与 `holding` 槽一一对应）。 */
  readonly slot: number;
  /** 该珠应去的棋盘格（pattern 目标色 = 该珠颜色，且目前还错/空）。 */
  readonly targetRow: number;
  readonly targetCol: number;
}

/**
 * 一颗托盘珠的**动手指令**（`trayRestore` 同帧执行用，v1.95）：把 `slot` 槽的珠
 * 放进目标格；目标格被占时先把它现有的珠**换出**到 `(evictRow, evictCol)` 空格
 * （`-1` = 无换出，目标格本就空）。plan 一次算好、动手帧**零重算**（同帧状态
 * 与 plan 完全一致 ⇒ 不重消费 `Rng`，§2.2.5-⑥「次数 = 1 + 交换次数」不破）。
 */
export interface TrayMove {
  readonly slot: number;
  readonly targetRow: number;
  readonly targetCol: number;
  readonly evictRow: number;
  readonly evictCol: number;
}

/** 盘面尺寸（`windowRestore` 算最密集窗口用；调用方从 grid 取）。 */
export interface BoardDims {
  readonly rows: number;
  readonly cols: number;
}

/** `trayRestore` / `windowRestore` 需要的额外输入（其余道具忽略）。 */
export interface PowerupInputs {
  /** 托盘珠清单（`trayRestore`）。 */
  readonly tray?: readonly TrayBead[];
  /** 盘面空格清单（`trayRestore` 的换出珠落点候选）。 */
  readonly empties?: readonly AffectedCell[];
  /** 盘面尺寸（`windowRestore`）。 */
  readonly dims?: BoardDims;
}

/** 一次道具请求的判定结果（四种出口互斥；含「无事发生」的两种细分）。 */
export type PowerupOutcome =
  /** 额度未耗尽且确有点名 ⇒ 调用方应执行归位并广播 `powerup:used`。 */
  | {
    readonly kind: 'used';
    readonly type: PowerupType;
    /** 本次点名的格（行主序升序、去重）。`trayRestore` 含换出珠的落格。 */
    readonly affectedCells: readonly AffectedCell[];
    /**
     * `trayRestore` 专用（v1.95 / `powerups-v2 §2.4`）：托盘动手指令清单（槽位序）。
     * 动手帧**零重算**（同帧状态一致 ⇒ 不重消费 Rng）；托盘写入仍归 S4
     * （调用方按指令调 `Tray` 写原语，S6 保持只读）。
     */
    readonly trayPlan?: readonly TrayMove[];
    /** `trayPlan` 里被清空的托盘槽号（`powerup:used.traySlots` 载荷，§2.4）。 */
    readonly traySlots?: readonly number[];
  }
  /** 无可作用对象（棋盘无错位珠 / 托盘空）⇒ 零事件、**零扣次**（拒用不扣判例）。 */
  | { readonly kind: 'empty' }
  /** 免费额度已永久耗尽 ⇒ 仅占位反馈，调用方应弹双通道面板（购买 / 视频）。 */
  | { readonly kind: 'exhausted' }
  /** `type` ∉ `POWERUP_TYPES`，或所需输入（Rng / dims / tray）缺失 ⇒ 忽略 + 警告。 */
  | { readonly kind: 'invalid' };

const isPowerupType = (value: unknown): value is PowerupType =>
  typeof value === 'string' && (POWERUP_TYPES as readonly string[]).includes(value);

/**
 * 卡下方标签文案（**v1.95 三件新道具**；显示名与内部类型名解耦，改名零成本）。
 * 放在本系统而非视图层，与 `pause-panel` 承载自家按钮文案同判例。
 *
 * ⚠️ `assets-spec §1.4` 属美术域，本单禁改 ⇒ 图标名待美术回填（扫豆刷可复用
 * 旧扫帚图标，用户 2026-10-26 拍板「美术零改图」）。
 */
export const POWERUP_LABELS: Readonly<Record<PowerupType, string>> = {
  windowRestore: '熨贴片',
  randomRestore: '抖豆筛',
  trayRestore: '扫豆刷',
};

/** 行主序升序去重（`(row, col)` → 线性键排序）。 */
function toCells(beads: readonly { row: number; col: number }[]): AffectedCell[] {
  const seen = new Set<number>();
  const out: { row: number; col: number; key: number }[] = [];
  for (const b of beads) {
    const key = b.row * 1024 + b.col; // grid ≤ GRID_MAX_COLS(13) ⇒ 键唯一
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ row: b.row, col: b.col, key });
  }
  return out.sort((a, b) => a.key - b.key).map((e) => ({ row: e.row, col: e.col }));
}

export class PowerupSystem {
  private _rng: Rng | null = null;

  /**
   * 账号级免费额度耗尽标志（v1.95 语义：每型永久 1 次）。由调用方从
   * `BeadsMeta` 注入；本关内用掉即置位（{@link request} 成功且走免费腿时），
   * 调用方经 {@link freeDepleted} 读回并落档。
   */
  private _freeDepleted: Record<PowerupType, boolean> = {
    windowRestore: false,
    randomRestore: false,
    trayRestore: false,
  };

  /**
   * **本关**已成功使用次数（免费腿 + 购买腿合计；C7 结算扣分与崩溃快照的口径）。
   * 与「账号级免费额度」是两回事：额度管还能不能白用，这里管本关用了几次。
   */
  private readonly _usedThisLevel: Record<PowerupType, number> = {
    windowRestore: 0,
    randomRestore: 0,
    trayRestore: 0,
  };

  /**
   * 本关豆子购买计数（§3.6 v1.80 → v1.95 **不设上限**，价格是唯一门槛）：
   * 与「本关寿命」同存亡（关内重置、不入存档）。
   */
  private readonly _bought: Record<PowerupType, number> = {
    windowRestore: 0,
    randomRestore: 0,
    trayRestore: 0,
  };

  /** 注入确定性 RNG（`services.rng`；架构 §2 的注入判例）。 */
  attach(rng: Rng): void {
    this._rng = rng;
  }

  // ───────────────────────────────────────────────────────────────── reads

  /** 本关已成功使用次数（只读；C7 结算扣分与崩溃快照都读这里）。 */
  get usedThisLevel(): Readonly<Record<PowerupType, number>> {
    return this._usedThisLevel;
  }

  /** 免费额度耗尽标志（只读；调用方在 request 成功后读回并落档）。 */
  get freeDepleted(): Readonly<Record<PowerupType, boolean>> {
    return this._freeDepleted;
  }

  /** 注入账号级耗尽标志（启动 / 载档后调用一次）。 */
  setFreeDepleted(flags: Partial<Record<PowerupType, boolean>>): void {
    for (const type of POWERUP_TYPES) {
      if (typeof flags[type] === 'boolean') this._freeDepleted[type] = flags[type] as boolean;
    }
  }

  /** 某道具的剩余免费次数（账号级；`0` = 永久耗尽）。 */
  freeUses(type: PowerupType): number {
    return this._freeDepleted[type] ? 0 : POWERUP_FREE_USES;
  }

  /** 本关已成功使用的道具总数（C7 结算扣分的输入；免费 + 购买合计）。 */
  get usedCount(): number {
    let used = 0;
    for (const type of POWERUP_TYPES) used += this._usedThisLevel[type];
    return used;
  }

  /** 某道具本关已豆子购买次数（只读统计）。 */
  bought(type: PowerupType): number {
    return this._bought[type] ?? 0;
  }

  /**
   * 可否豆子购买（v1.95：类型合法 + `trayRestore`/`randomRestore` 有 Rng 即可；
   * **不设次数上限**，价格是唯一门槛）。**不含余额判断** —— 豆子住在
   * `MetaState`，扣款由 shell 注入的购买回调负责。
   */
  canPurchase(type: unknown): boolean {
    if (!isPowerupType(type)) return false;
    if ((type === 'trayRestore' || type === 'randomRestore') && !this._rng) return false;
    return true;
  }

  /**
   * 豆子购买一次：点名规则与 {@link request} 同源，只是**不动免费额度**而推进
   * 购买计数。调用方须先 {@link canPurchase} 且已完成扣款 —— 本方法仅在真的
   * 点名成功时记账，`empty` / `invalid` 出口**零副作用**（沿用「拒用不扣」判例）。
   */
  purchase(
    type: unknown,
    misplaced: readonly MisplacedBead[],
    extra?: PowerupInputs,
  ): PowerupOutcome {
    if (!this.canPurchase(type)) return { kind: 'exhausted' };
    const t = type as PowerupType;
    const pool = Array.isArray(misplaced) ? misplaced : [];
    const selected = this._select(t, pool, extra);
    if (selected === null) return { kind: 'invalid' };
    if (selected.cells.length === 0) return { kind: 'empty' };
    this._bought[t] += 1;
    this._usedThisLevel[t] += 1;
    return this._usedOutcome(t, selected);
  }

  // ─────────────────────────────────────────────────────── 生命周期

  /**
   * 整关重置（§3.5）：只清**本关**计数（购买计数、本关使用计数）。
   * ⛔ **不碰** `_freeDepleted` —— 免费额度是账号级（v1.95 语义变更），新关 /
   * 失败重试 / 暂停重玩 / 换关均不恢复。
   */
  reset(): void {
    for (const type of POWERUP_TYPES) {
      this._usedThisLevel[type] = 0;
      this._bought[type] = 0;
    }
  }

  /**
   * 崩溃快照恢复（D-03）：逐项写回**本关**已用次数，负数钳 0。
   * S6 无镜像 ⇒ 这里就是全部需恢复的关内状态。
   */
  restoreUses(usedThisLevel: Partial<Record<PowerupType, number>>): void {
    for (const type of POWERUP_TYPES) {
      const raw = usedThisLevel[type];
      this._usedThisLevel[type] =
        typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    }
  }

  // ─────────────────────────────────────────────────── 一次原子结算

  /**
   * S2 道具卡点击 → 一次原子结算（单步、无瞄准中间态，§2.3）。
   *
   * 「点名归 S6、动手归调用方」：本方法只从**调用方传入的清单**里挑出本次要
   * 动的格（`affectedCells`），真正的 grid / tray 写入与 `powerup:used` 广播全
   * 归 `BeadsGame`。
   *
   * 选择规则（§3.6 v1.95）：
   *  - `windowRestore` = 错位珠最密集的 `SIDE`×`SIDE` 窗口（贴边收缩；平票取
   *    行号最小、再列号最小 —— 确定性 tie-break，同 seed 复现）；
   *  - `randomRestore` = 用注入 `Rng` 无放回抽 `RANDOM_RESTORE_COUNT` 颗；
   *  - `trayRestore`   = 托盘珠逐颗归位（见 {@link planTray}），换出珠随机填空格。
   *
   * @param misplaced 错位珠清单（行主序）；内部只读，不留存。
   * @param extra     `windowRestore` 需 `dims`；`trayRestore` 需 `tray` + `empties`。
   */
  request(
    type: unknown,
    misplaced: readonly MisplacedBead[],
    extra?: PowerupInputs,
  ): PowerupOutcome {
    if (!isPowerupType(type)) {
      console.warn(`[beads] S6 收到非法道具 type：${String(type)}（忽略，零事件零扣次）`);
      return { kind: 'invalid' };
    }
    if (this.freeUses(type) <= 0) return { kind: 'exhausted' };

    const pool = Array.isArray(misplaced) ? misplaced : [];
    const selected = this._select(type, pool, extra);
    if (selected === null) return { kind: 'invalid' };
    if (selected.cells.length === 0) return { kind: 'empty' };

    // 只有实际点名才扣（§2.5 扣减时机）；免费腿用掉即永久耗尽（账号级）。
    this._usedThisLevel[type] += 1;
    this._freeDepleted[type] = true;
    return this._usedOutcome(type, selected);
  }

  /** used 出口统一组装（免费与购买两条腿同构；`trayRestore` 附带动手计划）。 */
  private _usedOutcome(
    type: PowerupType,
    selected: { cells: readonly AffectedCell[]; trayPlan?: readonly TrayMove[]; traySlots?: readonly number[] },
  ): PowerupOutcome {
    if (type !== 'trayRestore' || !selected.trayPlan) {
      return { kind: 'used', type, affectedCells: selected.cells };
    }
    return {
      kind: 'used',
      type,
      affectedCells: selected.cells,
      trayPlan: selected.trayPlan,
      traySlots: selected.traySlots ?? [],
    };
  }

  /** 点名规则唯一实现（免费与购买两条腿共用）；`null` = 缺必需输入。 */
  private _select(
    type: PowerupType,
    pool: readonly MisplacedBead[],
    extra?: PowerupInputs,
  ): { cells: readonly AffectedCell[]; trayPlan?: readonly TrayMove[]; traySlots?: readonly number[] } | null {
    if (type === 'randomRestore') {
      const rng = this._rng;
      if (!rng) {
        console.warn('[beads] S6 randomRestore 抽取缺少 Rng 注入（忽略，零事件零扣次）');
        return null;
      }
      return { cells: toCells(drawRandom(pool, RANDOM_RESTORE_COUNT, rng)) };
    }
    if (type === 'windowRestore') {
      const dims = extra?.dims;
      if (!dims || !Number.isFinite(dims.rows) || !Number.isFinite(dims.cols) || dims.rows <= 0 || dims.cols <= 0) {
        console.warn('[beads] S6 windowRestore 缺少盘面尺寸 dims（忽略，零事件零扣次）');
        return null;
      }
      return { cells: toCells(densestWindow(pool, dims, SIDE)) };
    }
    // trayRestore
    const rng = this._rng;
    if (!rng) {
      console.warn('[beads] S6 trayRestore 换出珠落格缺少 Rng 注入（忽略，零事件零扣次）');
      return null;
    }
    return this.planTray(extra?.tray ?? [], extra?.empties ?? []);
  }

  /**
   * `trayRestore` 点名计划（§2.2.5，用户原话口径）：托盘珠**逐颗（槽位序）**
   * 归位 —— 目标格在空格清单里 ⇒ 放入；否则 ⇒ 换出（目标格仍归位），换出的珠
   * 从**剩余**空格里随机抽一格落位（允许制造新错位；合法镜像下 `#empty = 托盘珠数`
   * ⇒ 收尾恰好吃满，`evict = -1` 只在镜像漂移的异常序列里出现，不产落格、不凭空造
   * 格）。**入口先校恒等式退化态**：托盘非空而空格为零 ⇒ 直接拒绝（§6 X-9 / §8-27(b)）。
   * 目标格互不重复的假设由调用方保证。
   *
   * 输出 = `{ cells, trayPlan, traySlots }`：`cells`（affectedCells，行主序去重）
   * 供预警高亮；`trayPlan`（动手指令，槽位序）供 S4 同帧执行；`traySlots`（清空
   * 槽号）进 `powerup:used` 载荷。Rng 消费次数 = 1 + 换出次数（§2.2.5-⑥）。
   */
  private planTray(
    tray: readonly TrayBead[],
    empties: readonly AffectedCell[],
  ): { cells: readonly AffectedCell[]; trayPlan: readonly TrayMove[]; traySlots: readonly number[] } {
    // 【§6 X-9 镜像漂移守卫 · 判据 §8-27(b)】守恒恒等式 `#empty ≡ 托盘占用`（§2.2.5-⑥ /
    // §6 X-2）使「托盘非空 ∧ 无空格」在合法盘面态下**结构不可达** ⇒ 进到这一步就是镜像
    // 漂移。裁定 = **拒绝**（零事件、零格变化、零扣次、零扣豆），⛔ 不得「按镜像硬算」——
    // 硬算会给出 `evict = -1` 的换出计划，等于把托盘珠写进 `filled` 格。返回零点名即
    // 由 `request` 走既有 `empty` 出口（扣减时机在点名之后，故零扣次）。
    if (tray.length > 0 && empties.length === 0) {
      console.warn(
        `[beads] S6 powerupMirrorDrift：trayRestore 收到「托盘非空 ∧ 无空格」镜像` +
        `（tray=${tray.length}）⇒ 拒绝裁定（§6 X-9 / §8-27(b)）`,
      );
      return { cells: [], trayPlan: [], traySlots: [] };
    }
    const free = new Set<number>(empties.map((c) => c.row * 1024 + c.col));
    // 【换出珠落点候选 = 空格 ∖ 本 plan 的全部目标格】
    // `_execTrayPlan` 是**倒序**执行（`takeBead` 左移补位 ⇒ 正序会让 plan 里的槽号失效）。plan
    // 时刻若只把「已处理那颗」占用的空格剔出落点池，就会漏掉**后续颗**的目标格：那颗的目标格
    // 恰好是本颗的随机落点时，倒序下后续颗先动手把这格填掉 ⇒ 本颗 `fill(evict…)` 撞上已填格返回
    // false ⇒ 该珠留槽 = 「部分清空」，§8-33(a)「托盘占用恒为 0」与 §8-33(b)「traySlots.length ≡ t」
    // 双双转红（2026-10-28 全量核算实测：12 槽档 2000 次里 372 次留槽、ΔW 少 1）。
    // 守恒恒等式 `#empty ≡ t`（§6 X-2）保证剔除后候选数恰等于需要换出的颗数 ⇒ 合法镜像下不耗尽。
    const targetKeys = new Set<number>(tray.map((b) => b.targetRow * 1024 + b.targetCol));
    const landings = new Set<number>();
    for (const key of free) if (!targetKeys.has(key)) landings.add(key);
    const cells: { row: number; col: number }[] = [];
    const moves: TrayMove[] = [];
    const slots: number[] = [];
    for (const bead of tray) {
      const key = bead.targetRow * 1024 + bead.targetCol;
      if (free.has(key)) {
        // 目标格是空格 ⇒ 直接放入，不产生换出。
        free.delete(key);
        cells.push({ row: bead.targetRow, col: bead.targetCol });
        moves.push({ slot: bead.slot, targetRow: bead.targetRow, targetCol: bead.targetCol, evictRow: -1, evictCol: -1 });
        slots.push(bead.slot);
        continue;
      }
      // 目标格被占 ⇒ 换出（占者进待落位），托盘珠仍归位。
      cells.push({ row: bead.targetRow, col: bead.targetCol });
      let evictRow = -1;
      let evictCol = -1;
      const rest = Array.from(landings);
      if (rest.length > 0) {
        const pick = this._rng!.int(0, rest.length - 1);
        const key2 = rest[pick]!;
        free.delete(key2);
        landings.delete(key2);
        evictRow = Math.floor(key2 / 1024);
        evictCol = key2 % 1024;
        cells.push({ row: evictRow, col: evictCol });
      }
      moves.push({ slot: bead.slot, targetRow: bead.targetRow, targetCol: bead.targetCol, evictRow, evictCol });
      slots.push(bead.slot);
    }
    return { cells: toCells(cells), trayPlan: moves, traySlots: slots };
  }
}

/**
 * `randomRestore`：等概率、**无放回**抽至多 `count` 颗（不足返回全部，不补）。
 * 随机性只来自注入 `rng`（L4）。抽取后按行主序升序返回，使同一组种子的
 * payload 稳定可比（§8-4 确定性判定）。
 */
function drawRandom(pool: readonly MisplacedBead[], count: number, rng: Rng): MisplacedBead[] {
  const rest: MisplacedBead[] = pool.slice();
  const drawn: MisplacedBead[] = [];
  while (drawn.length < count && rest.length > 0) {
    const index = rng.int(0, rest.length - 1);
    drawn.push(rest.splice(index, 1)[0]!);
  }
  return drawn;
}

/**
 * `windowRestore`：在 `rows × cols` 盘面上找**错位珠最密集**的
 * `min(SIDE, rows) × min(SIDE, cols)` 窗口，返回窗口内全部错位珠。
 *
 * - 贴边收缩天然成立：窗口高/宽被钳到盘面，遍历的是全部合法左上角。
 * - 平票 tie-break：**先到者胜**（遍历序 = 行号升序、再列号升序）⇒ 结果确定性
 *   （同 seed / 同输入恒同窗口，§8-19 可断言）。
 * - 窗口内零错位珠 ⇒ 返回空数组（上层转 `empty`，不扣次）。
 */
function densestWindow(
  pool: readonly MisplacedBead[],
  dims: BoardDims,
  side: number,
): MisplacedBead[] {
  const wh = Math.min(side, dims.rows);
  const ww = Math.min(side, dims.cols);
  if (wh <= 0 || ww <= 0) return [];
  let bestR0 = -1;
  let bestC0 = -1;
  let bestCount = 0;
  for (let r0 = 0; r0 + wh <= dims.rows; r0++) {
    for (let c0 = 0; c0 + ww <= dims.cols; c0++) {
      let count = 0;
      for (const b of pool) {
        if (b.row >= r0 && b.row < r0 + wh && b.col >= c0 && b.col < c0 + ww) count += 1;
      }
      if (count > bestCount) {
        bestCount = count;
        bestR0 = r0;
        bestC0 = c0;
      }
    }
  }
  if (bestR0 < 0 || bestCount === 0) return [];
  return pool.filter(
    (b) => b.row >= bestR0 && b.row < bestR0 + wh && b.col >= bestC0 && b.col < bestC0 + ww,
  );
}

/**
 * ⛔ v1.22 作废（WXG-T-137）：`region` 道具消失 ⇒ 本函数零消费方。
 * **死路径保留**（与 `REGION_CLEAR_SLOTS` / `RANDOM_CLEAR_COUNT` 两个死值同口径）：
 * 清槽玩法复活时本函数的几何逻辑即可恢复；删除需连同两个死值与调用面一并清算。
 */
export function regionWindow(anchor: number, capacity: number): [number, number] {
  if (capacity <= 0) return [0, -1];
  const length = Math.min(6, capacity);
  const maxFrom = capacity - length;
  const from = Math.max(0, Math.min(maxFrom, anchor - Math.floor((length - 1) / 2)));
  return [from, from + length - 1];
}
