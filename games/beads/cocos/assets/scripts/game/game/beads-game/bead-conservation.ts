/**
 * 珠色守恒哨兵（T-244 二十二批 · 用户令「每次托盘入/出珠结束，珠子前后变化不匹配就要打错误日志」）。
 *
 * 自 `beads-game.ts` 拆出（BeadsGame 重构 · 协作类 ①）：状态独占，依赖只有棋盘与托盘两个只读 getter。
 * 口径：一次搬运命令里珠**只能移动**（盘→托 / 托→盘 / 盘→盘），任一侧凭空增减即写坏。
 * 采样缓冲为实例字段复用 ⇒ **命令边界零分配**（承热路径铁律；明细串只在失败分支拼）。
 */
import { BEAD_COLOR_MAX } from '../../config/tuning';
import type { BeadGrid } from '../../entities/grid';
import type { Tray } from '../../entities/tray';

/** 宿主只需交出「此刻的」棋盘与托盘——换关 / 冲刺换 stage 会重建二者，⛔ 不得缓存引用。 */
export interface BeadConservationHost {
  readonly grid: BeadGrid;
  readonly tray: Tray;
}

export class BeadConservation {
  /** `before` = 搬运命令入口的每色计数，`now` = 收口重采，`base` = 手动体检用的绝对基准。 */
  private readonly _before = new Array<number>(BEAD_COLOR_MAX + 1).fill(0);
  private readonly _now = new Array<number>(BEAD_COLOR_MAX + 1).fill(0);
  private readonly _base = new Array<number>(BEAD_COLOR_MAX + 1).fill(0);
  /** 图案每色目标计数（装配时重算），供 `audit` 做绝对体检。 */
  private readonly _target = new Array<number>(BEAD_COLOR_MAX + 1).fill(0);
  /**
   * `giveTrayBead` 凭空虚造的珠（测试 / harness 夹具专用，非玩法触发源）。
   * 并入体检基准 ⇒ 夹具不误报；而玩法命令里凭空多出的那颗**仍会报**（它不走这里）。
   */
  private readonly _extra = new Array<number>(BEAD_COLOR_MAX + 1).fill(0);
  /** 采样那一刻的棋盘对象身份：换关 / 冲刺换 stage 会重建 grid+tray ⇒ 前后不可比。 */
  private _sampledGrid: BeadGrid | null = null;

  constructor(private readonly _host: BeadConservationHost) {}

  /**
   * 哨兵①（命令**入口**）：采基准并记下棋盘身份。与 `check` 成对使用，
   * ⛔ 只挂**叶级**搬运命令（`retrieveBead` / `_placeSelected` / `_tryDirectFillFromBoard` /
   * `_solveMisplaced`）——复合命令（`retrieveSelectedGroup` 逐颗调 `retrieveBead`）套上会把基准
   * 覆盖掉，造成假红。
   */
  mark(): void {
    this._tally(this._before);
    this._sampledGrid = this._host.grid;
  }

  /**
   * 哨兵②（命令**收口**）：每色与入口基准不符 ⇒ `console.error` 打前后明细。
   * ⛔ **只报不改**（不抛错 / 不回滚 / 不影响裁决）：这是探针；抛错会把一个数据 bug 升级成崩溃。
   * 棋盘身份变了（过关换关 / 冲刺换 stage ⇒ 托盘已重建）不可比，静默跳过。
   */
  check(op: string): void {
    if (this._host.grid !== this._sampledGrid) return;
    this._tally(this._now);
    this._report(op, this._before);
  }

  /**
   * **手动体检**：拿「盘 + 托」实际每色数与**图案每色目标**（另加夹具凭空量）比对。
   * 命令级哨兵只管「一次搬运内不增不减」，本函数管「整张盘对不对得起图案」。
   */
  audit(op: string): boolean {
    const base = this._base;
    for (let i = 0; i < base.length; i++) base[i] = this._target[i] + this._extra[i];
    this._tally(this._now);
    return this._report(op, base);
  }

  /** `giveTrayBead` 夹具钩子：按定义就是「凭空造珠」⇒ 计入体检基准。 */
  noteExtra(colorIdx: number): void {
    this._extra[colorIdx] += 1;
  }

  /**
   * 重算体检基准（图案每色目标 + 凭空量归零）。
   * @param check 是否顺带做一次体检——`false` = 盘此刻故意是空的（冲刺换 stage）
   *   或夹具跳过了装配（`noAssemble`），此时「珠 = 0 / 图案 ≠ 0」属正常。
   */
  resetBaseline(check: boolean): void {
    const target = this._target;
    target.fill(0);
    const grid = this._host.grid;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.cell(r, c);
        if (cell && cell.colorIdx > 0) target[cell.colorIdx] += 1;
      }
    }
    this._extra.fill(0);
    if (check) this.audit('初盘装配');
  }

  /**
   * 把「盘上 filled 珠色 + 托盘 holding 珠色」逐色累加进 `out`。
   * O(rows·cols + capacity)，只在**玩家命令 / 道具逐颗**边界调，不进 `update`/`step`/`buildRenderModel`。
   * index 0 照常计数：「色 0 的珠」本身就是异常，让它出现在明细里而不是被默默吃掉。
   */
  private _tally(out: number[]): void {
    out.fill(0);
    const grid = this._host.grid;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.cell(r, c);
        if (cell && cell.state === 'filled') out[cell.beadColorIdx] += 1;
      }
    }
    const tray = this._host.tray;
    for (let s = 0; s < tray.capacity; s++) {
      const slot = tray.slot(s);
      if (slot && slot.state !== 'free') out[slot.colorIdx] += 1;
    }
  }

  /** 逐色比对 `now` 与 `base`：相符返回 true；不符 `console.error` 明细后返回 false。 */
  private _report(op: string, base: readonly number[]): boolean {
    const now = this._now;
    let bad = false;
    for (let i = 0; i < base.length; i++) {
      if (now[i] !== base[i]) {
        bad = true;
        break;
      }
    }
    if (!bad) return true;
    const diff: string[] = [];
    for (let i = 0; i < base.length; i++) {
      if (now[i] === base[i]) continue;
      diff.push(`色${i}:${base[i]}→${now[i]}`);
    }
    const { grid, tray } = this._host;
    const slots: string[] = [];
    for (let s = 0; s < tray.capacity; s++) {
      const slot = tray.slot(s);
      slots.push(slot && slot.state !== 'free' ? String(slot.colorIdx) : '_');
    }
    console.error(
      `[beads] ⛔ 珠色守恒破坏 · ${op} ⇒ ${diff.join(' ')}` +
      `｜盘 filled=${grid.filledCount}/${grid.fillableTotal}` +
      ` 错位=${grid.misplacedCount}` +
      `｜托 holding=${tray.holdingCount} 槽=[${slots.join('')}]`,
    );
    return false;
  }
}
