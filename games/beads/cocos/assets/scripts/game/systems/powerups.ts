/**
 * S6 — 道具系统（`design/gdd/powerups.md` v1.1）。
 *
 * 三条「绝不」（本系统的全部边界，来源 §2.1/§2.2/§7 明确边界）：
 *  - **绝不写网格** —— `filled` 是终态（bead-grid §2.2、§3.6）；
 *  - **绝不碰时钟** —— 不加时、不冻结（S5 是唯一时间真源，§3.5）；
 *  - **绝不自己清槽** —— 它只**点名**要清的槽，清槽由 S4 的
 *    `Tray.clearSlots()` 执行（§2.4「清槽动作由 S4 执行」）。
 *
 * 因此本类**不持有任何权威状态**：只有一份**只读镜像**（持有槽集合 + 生效容量 +
 * 选中槽），镜像的输入是设备事件 `tray:spawned` / `bead:placed` / `tray:expanded`
 * （§2.4）。镜像存在的唯一目的是算 `affectedSlots`；真正的写路径全在 S4。
 *
 * 随机性唯一来源 = 注入的 `Rng`（铁律 L4，禁 `Math.random`；§8-4 有架构守卫）。
 */

import {
  POWERUP_FREE_USES,
  POWERUP_TYPES,
  RANDOM_CLEAR_COUNT,
  REGION_CLEAR_SLOTS,
  TRAY_BASE_SLOTS,
  type PowerupType,
} from '../config/tuning';
import type { Rng } from '../../framework/index';

/** 一次道具请求的判定结果（四种出口互斥；含「无事发生」的两种细分）。 */
export type PowerupOutcome =
  /** 次数未耗尽且确有效果 → 调用方应清槽并广播 `powerup:used`。 */
  | { readonly kind: 'used'; readonly type: PowerupType; readonly affectedSlots: readonly number[] }
  /** 作用域内无持有珠 → 零事件、**零扣次**（§2.3 已裁定：拒用不扣）。 */
  | { readonly kind: 'empty' }
  /** 免费次数已尽（或三计数中该 type 为 0）→ 仅 `ad_badge` 占位反馈（§2.6 布局 A）。 */
  | { readonly kind: 'exhausted' }
  /** `type` ∉ `POWERUP_TYPES`，或系统未注入 `Rng` → 忽略 + 警告，不崩溃（§6）。 */
  | { readonly kind: 'invalid' };

const isPowerupType = (value: unknown): value is PowerupType =>
  typeof value === 'string' && (POWERUP_TYPES as readonly string[]).includes(value);

/**
 * 卡下方标签文案（`assets-spec §1.4` 指定，逐字取用）。放在本系统而非视图层，
 * 与 `pause-panel` 承载自家按钮文案同判例：**文案归拥有它的系统**。
 */
export const POWERUP_LABELS: Readonly<Record<PowerupType, string>> = {
  region: '区域消除',
  clearAll: '槽位清空',
  random: '随机消除',
};

export class PowerupSystem {
  /** 只读镜像：当前 hold 着珠的槽（线性索引，行主序，跨基线/扩展行）。 */
  private readonly _holding = new Set<number>();
  /** 生效容量（`tray:expanded` 后含扩展行；§2.1）。 */
  private _capacity = TRAY_BASE_SLOTS;
  /** 选中槽镜像（`region` 的窗口锚点；-1 = 无选中）。 */
  private _anchor = -1;
  private _rng: Rng | null = null;

  /** 三计数器互相独立（§2.5），初值 `POWERUP_FREE_USES`。 */
  private readonly _uses: Record<PowerupType, number> = {
    region: POWERUP_FREE_USES,
    clearAll: POWERUP_FREE_USES,
    random: POWERUP_FREE_USES,
  };

  /** 注入确定性 RNG（`services.rng`；架构 §2 的注入判例）。 */
  attach(rng: Rng): void {
    this._rng = rng;
  }

  // ───────────────────────────────────────────────────────────────── reads

  /** 三计数（只读；`settleScore` 的扣分项与快照都读这里）。 */
  get uses(): Readonly<Record<PowerupType, number>> {
    return this._uses;
  }

  /** 已用次数（`= POWERUP_FREE_USES − uses`）——崩溃快照与 C7 结算读这里。 */
  get used(): Record<PowerupType, number> {
    return {
      region: POWERUP_FREE_USES - this._uses.region,
      clearAll: POWERUP_FREE_USES - this._uses.clearAll,
      random: POWERUP_FREE_USES - this._uses.random,
    };
  }

  /** 本关已成功使用的道具总数（C7 结算扣分的输入）。 */
  get usedCount(): number {
    let used = 0;
    for (const type of POWERUP_TYPES) used += POWERUP_FREE_USES - this._uses[type];
    return used;
  }

  /** 某道具的剩余免费次数（`>= 0`）。 */
  freeUses(type: PowerupType): number {
    return this._uses[type] ?? 0;
  }

  get capacity(): number {
    return this._capacity;
  }

  /** 镜像中的持有槽（升序）——测试与漂移排查用。 */
  get holding(): readonly number[] {
    return [...this._holding].filter((i) => i >= 0 && i < this._capacity).sort((a, b) => a - b);
  }

  // ──────────────────────────────────────────────────────── mirror 输入

  /** `tray:spawned` —— 该槽置 holding。 */
  noteSpawned(slot: number): void {
    if (slot >= 0 && slot < this._capacity) this._holding.add(slot);
  }

  /** `bead:placed` 回执 —— 该槽置 free（选中态随之清除）。 */
  notePlaced(slot: number): void {
    this._holding.delete(slot);
    if (this._anchor === slot) this._anchor = -1;
  }

  /** `tray:selected` —— 记录 `region` 窗口锚点。 */
  noteSelected(slot: number): void {
    this._anchor = slot;
  }

  /** 生效容量变化（`tray:expanded` 与整关重置后的基线容量都走这里）。 */
  noteCapacity(capacity: number): void {
    this._capacity = Math.max(0, capacity);
    for (const slot of [...this._holding]) {
      if (slot >= this._capacity) this._holding.delete(slot);
    }
    if (this._anchor >= this._capacity) this._anchor = -1;
  }

  /**
   * 整关重置（§3.5 重置五项之第 5 项 + §2.5 复位时机）：三计数回
   * `POWERUP_FREE_USES`，镜像随托盘一并清空、容量回基线。
   */
  reset(): void {
    for (const type of POWERUP_TYPES) this._uses[type] = POWERUP_FREE_USES;
    this._holding.clear();
    this._anchor = -1;
    this._capacity = TRAY_BASE_SLOTS;
  }

  /**
   * 崩溃快照恢复（D-03）：逐项写回已用次数，越界钳到
   * `[0, POWERUP_FREE_USES]`。**不**据此重建镜像（镜像是 S4 的投影，
   * 由托盘还原路径的 note 调用驱动——防双真源，与 `needed[]` 同口径）。
   */
  restoreUses(uses: Partial<Record<PowerupType, number>>): void {
    for (const type of POWERUP_TYPES) {
      const raw = uses[type];
      const used = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 0;
      this._uses[type] = POWERUP_FREE_USES - Math.max(0, Math.min(POWERUP_FREE_USES, used));
    }
  }

  // ─────────────────────────────────────────────────────── 一次原子结算

  /**
   * S2 道具卡点击 → 一次原子结算（单步、无瞄准中间态，§2.3）。
   *
   * 调用方（`BeadsGame`）只负责两件事：把 `kind === 'used'` 的
   * `affectedSlots` 交给 S4 清槽，然后广播 `powerup:used`。其余出口零副作用。
   */
  request(type: unknown): PowerupOutcome {
    if (!isPowerupType(type)) {
      console.warn(`[beads] S6 收到非法道具 type：${String(type)}（忽略，零事件零扣次）`);
      return { kind: 'invalid' };
    }
    if (this._uses[type] <= 0) return { kind: 'exhausted' };

    let affectedSlots: number[];
    if (type === 'random') {
      const rng = this._rng;
      if (!rng) {
        console.warn('[beads] S6 random 抽取缺少 Rng 注入（忽略，零事件零扣次）');
        return { kind: 'invalid' };
      }
      affectedSlots = this._drawRandom(rng);
    } else {
      affectedSlots = this._resolveArea(type);
    }
    if (affectedSlots.length === 0) return { kind: 'empty' };

    // 只有实际生效才扣次（§2.5 扣减时机），并同步从镜像摘除（S4 即将清它们）。
    this._uses[type] -= 1;
    for (const slot of affectedSlots) this._holding.delete(slot);
    if (affectedSlots.includes(this._anchor)) this._anchor = -1;
    return { kind: 'used', type, affectedSlots };
  }

  // ────────────────────────────────────────────────────────── internals

  /** `region` / `clearAll` 的纯集合运算（无随机、无副作用）。 */
  private _resolveArea(type: PowerupType): number[] {
    const held = this.holding;
    if (type === 'clearAll') return [...held];

    // region：锚点 = 当前 selected 槽；无选中时 = 线性索引最小的 holding 槽（§2.2）。
    const anchor = this._anchor >= 0 && this._holding.has(this._anchor) ? this._anchor : held[0];
    if (anchor === undefined) return [];
    const [from, to] = regionWindow(anchor, this._capacity);
    return held.filter((slot) => slot >= from && slot <= to);
  }

  /** `random`：等概率、无放回抽至多 `RANDOM_CLEAR_COUNT` 颗（§2.2）。 */
  private _drawRandom(rng: Rng): number[] {
    const pool = [...this.holding];
    const drawn: number[] = [];
    while (drawn.length < RANDOM_CLEAR_COUNT && pool.length > 0) {
      const index = rng.int(0, pool.length - 1);
      drawn.push(pool.splice(index, 1)[0]!);
    }
    return drawn.sort((a, b) => a - b);
  }
}

/**
 * `region` 窗口的**恒长**钳制（§2.2/§8-3）：返回闭合区间 `[from, to]`，长度恒为
 * `REGION_CLEAR_SLOTS`，且完全落在 `[0, capacity - 1]` 内。
 *
 * 实现约定（GDD 未 pin 的偶数窗口偏向）：`REGION_CLEAR_SLOTS` 为偶数时窗口无法
 * 精确居中，本实现取 `from = anchor - floor((n - 1) / 2)`，即锚点左侧 2 格、右侧
 * 3 格。容量不足窗口长度时（非法容量）退化为整个容量。已登记于 `powerups.md` §6。
 */
export function regionWindow(anchor: number, capacity: number): [number, number] {
  if (capacity <= 0) return [0, -1];
  const length = Math.min(REGION_CLEAR_SLOTS, capacity);
  const maxFrom = capacity - length;
  const from = Math.max(0, Math.min(maxFrom, anchor - Math.floor((length - 1) / 2)));
  return [from, from + length - 1];
}
