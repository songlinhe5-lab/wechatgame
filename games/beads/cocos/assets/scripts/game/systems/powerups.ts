/**
 * S6 — 道具系统（`design/gdd/powerups.md`；**v1.22 解环器反转**，WXG-T-137）。
 *
 * 三条「绝不」（本系统的全部边界，来源 §2.1/§2.2/§7 明确边界）：
 *  - **绝不写网格** —— 它只**点名**要归位的错位珠，真正的写入由 `BeadsGame`
 *    经 grid 既有写原语（`retrieve` / `fill` / `setBead`）执行（bead-grid §2.2）；
 *  - **绝不碰时钟** —— 不加时、不冻结（S5 是唯一时间真源，§3.5）；
 *  - **绝不碰托盘** —— v1.22：道具目标 = **棋盘错位珠**，托盘零读零写（托盘是
 *    纯解谜缓冲，tray-spawner v2.0 §2.2）。
 *
 * 因此本类**不持有任何权威状态，也不持有任何镜像**。错位珠清单由调用方
 * （`BeadsGame`）在**请求那一刻**从 grid 取（行主序）并作为参数传入 —— 这是
 * v1.22 对旧「托盘只读镜像」的替换：镜像（含 `noteSpawned` / `notePlaced` /
 * `noteSelected` / `noteCapacity`）的唯一用途是算 tray 作用域，道具目标改为棋盘后
 * 该用途消失，**连带消解 E3 移交的 `noteSpawned` 失真**（v2.0 供料关停后主循环
 * 恒不喂 `tray:spawned`，镜像只剩 `giveTrayBead` 死路径可喂 ⇒ 恒与托盘失同步）。
 * 改为「调用方传清单」后 S6 是**无状态纯函数**：零镜像、零双真源、零失真。
 *
 * 随机性唯一来源 = 注入的 `Rng`（铁律 L4，禁 `Math.random`；§8-4 有架构守卫）。
 */

import {
  POWERUP_FREE_USES,
  POWERUP_TYPES,
  SOLVER_PLUS_COUNT,
  SOLVER_RANDOM_COUNT,
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

/** 一次道具请求的判定结果（四种出口互斥；含「无事发生」的两种细分）。 */
export type PowerupOutcome =
  /** 次数未耗尽且确有点名 ⇒ 调用方应执行归位并广播 `powerup:used`。 */
  | {
      readonly kind: 'used';
      readonly type: PowerupType;
      /** 本次点名的错位珠所在格（行主序升序、去重）。 */
      readonly affectedCells: readonly AffectedCell[];
    }
  /** 棋盘无错位珠（或清单为空）⇒ 零事件、**零扣次**（§2.3 已裁定：拒用不扣）。 */
  | { readonly kind: 'empty' }
  /** 免费次数已尽（或三计数中该 type 为 0）⇒ 仅 `ad_badge` 占位反馈（§2.6 布局 A）。 */
  | { readonly kind: 'exhausted' }
  /** `type` ∉ `POWERUP_TYPES`，或 `solverRandom` 未注入 `Rng` ⇒ 忽略 + 警告，不崩溃（§6）。 */
  | { readonly kind: 'invalid' };

const isPowerupType = (value: unknown): value is PowerupType =>
  typeof value === 'string' && (POWERUP_TYPES as readonly string[]).includes(value);

/**
 * 卡下方标签文案（**v1.22 解环器语义**）。放在本系统而非视图层，与 `pause-panel`
 * 承载自家按钮文案同判例：**文案归拥有它的系统**。
 *
 * ⚠️ 待美术 / 文案确认：原文案源自 `assets-spec §1.4`（「区域消除 / 槽位清空 /
 * 随机消除」），随 §3.6 语义反转改为「解环 / 解环 ×3 / 随机解环」；`assets-spec §1.4`
 * 属美术域，本单禁改 ⇒ 新文案**尚未落 §1.4**，需 Oleksandr / 策划确认后再回填 §1.4。
 */
export const POWERUP_LABELS: Readonly<Record<PowerupType, string>> = {
  solver: '解环',
  solverPlus: '解环 ×3',
  solverRandom: '随机解环',
};

/** 每型一次最多点名几颗（由 `POWERUP_TYPES` 与 §3.6 v1.22 冻结值导出）。 */
function selectCount(type: PowerupType): number {
  if (type === 'solverPlus') return SOLVER_PLUS_COUNT;
  if (type === 'solverRandom') return SOLVER_RANDOM_COUNT;
  return 1; // `solver`
}

/** 行主序升序去重（`(row, col)` → 线性键 `row * stride + col` 排序无需 stride）。 */
function toCells(beads: readonly MisplacedBead[]): AffectedCell[] {
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

  /** 三计数器互相独立（§2.5），初值 `POWERUP_FREE_USES`。 */
  private readonly _uses: Record<PowerupType, number> = {
    solver: POWERUP_FREE_USES,
    solverPlus: POWERUP_FREE_USES,
    solverRandom: POWERUP_FREE_USES,
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
      solver: POWERUP_FREE_USES - this._uses.solver,
      solverPlus: POWERUP_FREE_USES - this._uses.solverPlus,
      solverRandom: POWERUP_FREE_USES - this._uses.solverRandom,
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

  // ─────────────────────────────────────────────────────── 生命周期

  /** 整关重置（§3.5 重置五项之第 5 项 + §2.5 复位时机）：三计数回 `POWERUP_FREE_USES`。 */
  reset(): void {
    for (const type of POWERUP_TYPES) this._uses[type] = POWERUP_FREE_USES;
  }

  /**
   * 崩溃快照恢复（D-03）：逐项写回已用次数，越界钳到 `[0, POWERUP_FREE_USES]`。
   * v1.22：S6 已无镜像 ⇒ 这里就是全部需恢复的状态（无双真源可言）。
   */
  restoreUses(uses: Partial<Record<PowerupType, number>>): void {
    for (const type of POWERUP_TYPES) {
      const raw = uses[type];
      const used = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 0;
      this._uses[type] = POWERUP_FREE_USES - Math.max(0, Math.min(POWERUP_FREE_USES, used));
    }
  }

  // ─────────────────────────────────────────────────── 一次原子结算

  /**
   * S2 道具卡点击 → 一次原子结算（单步、无瞄准中间态，§2.3）。
   *
   * 「点名归 S6、动手归调用方」：本方法只从**调用方传入的错位珠清单**里按下述规则
   * 挑出本次要归位的那些（`affectedCells`），真正的 grid 写入与 `bead:placed` /
   * `powerup:used` 广播全归 `BeadsGame`（T-137）。
   *
   * 选择规则（§3.6 v1.22）：
   *  - `solver`       = 清单首颗（调用方按行主序传 ⇒ 行主序第 1 颗）；
   *  - `solverPlus`   = 清单前 `SOLVER_PLUS_COUNT` 颗（不足不补）；
   *  - `solverRandom` = 用注入 `Rng` 无放回抽 `SOLVER_RANDOM_COUNT` 颗（不足不补）。
   *
   * @param misplaced 错位珠清单（**行主序**）；内部只读，不留存。
   */
  request(type: unknown, misplaced: readonly MisplacedBead[]): PowerupOutcome {
    if (!isPowerupType(type)) {
      console.warn(`[beads] S6 收到非法道具 type：${String(type)}（忽略，零事件零扣次）`);
      return { kind: 'invalid' };
    }
    if (this._uses[type] <= 0) return { kind: 'exhausted' };

    const pool = Array.isArray(misplaced) ? misplaced : [];
    let selected: readonly MisplacedBead[];
    if (type === 'solverRandom') {
      const rng = this._rng;
      if (!rng) {
        console.warn('[beads] S6 solverRandom 抽取缺少 Rng 注入（忽略，零事件零扣次）');
        return { kind: 'invalid' };
      }
      selected = drawRandom(pool, SOLVER_RANDOM_COUNT, rng);
    } else {
      selected = pool.slice(0, selectCount(type));
    }
    if (selected.length === 0) return { kind: 'empty' };

    // 只有实际点名才扣次（§2.5 扣减时机）。
    this._uses[type] -= 1;
    return { kind: 'used', type, affectedCells: toCells(selected) };
  }
}

/**
 * `solverRandom`：等概率、**无放回**抽至多 `count` 颗（不足返回全部，不补）。
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
 * ⛔ v1.22 作废（WXG-T-137）：`region` 道具消失 ⇒ 本函数零消费方。
 * **死路径保留**（与 `REGION_CLEAR_SLOTS` / `RANDOM_CLEAR_COUNT` 两个死值同口径）：
 * 清槽玩法复活时本绿化<｜hy_place▁holder▁no▁2｜> v1.6 几何routing即可恢复；删除需连同两个死值与调用面
 * 一并清算。勿在本 रोज़名称为非 region 的道具上误用。
 */
export function regionWindow(anchor: number, capacity: number): [number, number] {
  if (capacity <= 0) return [0, -1];
  const length = Math.min(6, capacity);
  const maxFrom = capacity - length;
  const from = Math.max(0, Math.min(maxFrom, anchor - Math.floor((length - 1) / 2)));
  return [from, from + length - 1];
}
