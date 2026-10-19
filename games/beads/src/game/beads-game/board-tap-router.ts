/**
 * PLAYING 相位的托盘 / 网格点击分派（5a 错位珠选取 · 5b 空格归位 · 5c 就位忽略 · 托盘 4a/4b），
 * 从 `BeadsGame._routeTap` 拆出。
 *
 * 职责：根据点击落点与当前锚（`BoardAnchor` = 棋盘选豆点，托盘选中 = `tray.selectedSlot`）决定
 * 派发到哪条玩法动作：选取 / 换选 / 取回 / 归位 / 盘内直填 / 轻提示。
 * 边界：归位裁决（`_placeSelected`）、选取 / 取回的规则本体仍在 `BeadsGame`，经
 * {@link BoardTapRouterHost} 注入；本类只做「哪条路」的判定与对应的表现层登记。
 *
 * ⚠ 分支次序与拆分前逐字一致（托盘带 4a/4b；网格 5a/5b/5c；5b 内先托盘锚归位、再盘内直填、再轻提示）。
 */
import { planGroupFill } from '../../systems/placement.js';
import { TAP_HINT_NO_SELECTION_TEXT } from '../../config/tuning.js';
import type { BeadGrid } from '../../entities/grid.js';
import type { Tray } from '../../entities/tray.js';
import type { BeadsEvents } from '../beads-game-types.js';
import type { GameMode } from '../state.js';
import type { FeedbackFx } from './feedback-fx.js';

/** 棋盘选豆锚（拾取锚）：`row/col` 为展示用头珠，`anchorRow/Col` 为选豆点（建立后恒定）。 */
export interface BoardAnchor {
  row: number;
  col: number;
  /** 选豆点（拾取锚）：建立后恒定，消费序 BFS 的唯一根。 */
  anchorRow: number;
  anchorCol: number;
  /** 组色 = 锚珠色（组内恒同色）。 */
  color: number;
  /** 消费序（拾取时一次算好，已消费的前缀随锚更新裁掉）；渲染层只当集合用。 */
  order: readonly { row: number; col: number }[];
}

/** 宿主接口：托盘 / 网格分派需要的状态面与动作入口（由 `BeadsGame` 以 getter / 方法接线）。 */
export interface BoardTapRouterHost {
  readonly grid: BeadGrid;
  readonly tray: Tray;
  boardSelected: BoardAnchor | null;
  readonly fx: FeedbackFx;
  readonly mode: GameMode;
  emit<K extends keyof BeadsEvents>(type: K, payload: BeadsEvents[K]): void;
  checkConservation(op: string): void;
  completeStage(): void;
  requestLevelClear(): void;
  countAction(ok: boolean): boolean;
  placeSelected(row: number, col: number): boolean;
  selectTraySlot(slot: number): boolean;
  selectBoardBead(row: number, col: number): boolean;
  retrieveSelectedGroup(): boolean;
  /** 本次点击已被消费（直填路径）。 */
  markConsumed(): void;
  armDenied(row: number, col: number): void;
}

export class BoardTapRouter {
  constructor(private readonly _host: BoardTapRouterHost) {}

  /**
   * 路由 4 · 托盘带内部分支（input-control §2.1 v2.0，Epic T-133 E2；带级次序不变）：
   *  - **4a holding 槽** → 选中/换选（发 `tray:selected`，锚置 tray）。**满槽不例外**
   *    （WXG-T-187：旧 §8-11「满槽吞任意槽」门已删——它把禁「取回」扩成禁「换选」，
   *    而 board 锚无取消路径（`selectBoardBead` 幂等）⇒ 满槽 + 锚 = board 时托盘
   *    永久点不动（用户 2026-09-22 真机死锁实报）。满槽禁「取回」由 4b「无空槽
   *    可点」几何保证，input-control §2.4/§8-11 v2.9 同批收窄）。
   *  - **4b 空槽 且 锚 = board** → 取回（`retrieveBead`，E1 API；成功即清 board
   *    锚——珠已离格，锚不得指向空格）。
   *  - **4b 空槽 且 锚 ∈ {tray, none}** → 零事件忽略。GDD 4b 对此写「无效落点
   *    轻提示」，但轻提示通道 `FeedbackFx.showTapHint` 只有 cell / expand 两种锚点几何，
   *    托盘锚点属 E6 视觉面（本单禁改 view）⇒ 按任务口径先零事件忽略，已回传登记。
   */
  routeTraySlot(slot: number): void {
    const traySlot = this._host.tray.slot(slot)!;
    if (traySlot.state !== 'free') {
      // 4a holding —— 换选即转移（§8-12），**满槽不例外**（WXG-T-187：旧 §8-11
      // 「满槽 + 锚 = board 吞任意槽」门已删。它把禁「取回」扩成禁「换选」，而
      // board 锚无取消路径（`selectBoardBead` 幂等）⇒ 托盘满 + 锚 = board 时
      // 托盘永久点不动 = 玩法死锁（用户 2026-09-22 真机实报「托盘完全无法选
      // 中」）。满槽禁「取回」由 4b「无空槽可点」几何保证，无需状态门。）
      this._host.selectTraySlot(slot);
      return;
    }
    const anchor = this._host.boardSelected;
    if (!anchor) return; // 4b 无 board 锚：零事件忽略（见方法头注）
    // v2.4（WXG-T-204）：点击的空槽 = 4b 取回触发（落位由 S4 自动归类，slot 不再下传）；
    // 容量不足 ⇒ 按消费序前缀部分收纳（能收几颗收几颗）。
    this._host.retrieveSelectedGroup();
  }

  /**
   * 路由 5 · 网格带内部分支（input-control §2.1 v2.0；带级次序不变）：
   *  - **5a `filled(错位)`** → `selectBoardBead`（锚置 board，发 `board:selected`）。
   *    错位判定**只用 grid 派生谓词** `isMisplaced`，不在路由层复制逻辑。
   *  - **5b `empty`** → 锚 = tray ⇒ `_placeSelected`（S3 裁决 placed/rejected）；
   *    锚 ∈ {board, none} ⇒ 归位前置缺口轻提示（零事件，仅可落空格——§8-7），
   *    分支体见 `_routeGridEmpty`（`_placeSelected` 的 slot<0 分支已迁来）。
   *  - **5c locked / `filled(就位)`** → 极轻非惩罚反馈忽略（§2.4 裁定 4）。G7 极轻
   *    反馈通道**已落码**（WXG-T-152 / `assets-spec §1.6.7`）⇒ 出口接 `_armDeniedFx`
   *    （scale 1.00→0.96→1.00 + `sfx_denied`；**零事件零状态写**红线不变）。
   */
  routeGridCell(row: number, col: number): void {
    if (this._host.grid.isMisplaced(row, col)) {
      this._host.selectBoardBead(row, col); // 5a
      return;
    }
    if (this._host.grid.isFillable(row, col)) {
      this.routeGridEmpty(row, col); // 5b
      return;
    }
    // 5c：locked / void / filled(就位) —— 零事件零状态写；G7 极轻反馈出口
    //（void / 越界不触发的守卫集中在 `_armDeniedFx`，§1.6.7 非触发集）。
    this._host.armDenied(row, col);
  }

  /**
   * 5b 空格分支体，真链（`_routeGridCell`）与旁路（`tapGridCell`）共用：
   * 锚 = tray → 归位请求；否则归位前置缺口轻提示（BD-16，`TAP_HINT_NO_SELECTION_TEXT`，
   * 仅 fillable 格给——锁定/就位格走 5c 的零事件口径，两判据交界 = §8-7；真链 5b
   * 只在 empty 格到达本方法，fillable 复核是给旁路保住旧判据）。
   * 自 `_placeSelected` 的 `slot<0` 分支**迁来**（v2.0：「无选中」语义由锚表达，
   * S3 收到的归位请求必带 tray 锚；此处是迁移落点而非新增行为）。
   * @returns true only when the placement was accepted.
   */
  routeGridEmpty(row: number, col: number): boolean {
    // 有效动作计量放在汇合处：真链 `_routeTap` 直调本函数（不经 `tapGridCell`），
    // 包在调用方会让**玩家落子不计**；包在本函数出口 ⇒ 真链与四个公开命令同口径。
    if (this._host.tray.selectedSlot >= 0) return this._host.countAction(this._host.placeSelected(row, col));
    // 【WXG-T-162 用户裁定 · 直填放开任意距离】board 锚：组非空 ⇒ 点「对应颜色的空格」
    // （不限距）直接归位，组保持逐颗续填。未消费（null/false）⇒ 走既有轻提示。
    const direct = this.tryDirectFill(row, col);
    if (direct !== null) return this._host.countAction(direct);
    if (this._host.grid.isFillable(row, col)) {
      // [WXG-T-241 · 2026-10-04 用户报「提示先选一颗，但盘面上已经有选中的珠子了」]
      //
      // 病灶：本分支的 `TAP_HINT_NO_SELECTION_TEXT`（先选一颗珠子）只在**真的没选中**时成立。
      // 而 `_tryDirectFillFromBoard` 在「**board 锚存活** + 点的是**错色空格**」时**也返回
      // `null`**（第 2342 行 `target.colorIdx !== anchor.color` ⇒ 不消费）⇒ 玩家**明明已选中**
      // 却被告知「先选一颗」⇒ **提示与画面直接矛盾**。
      //
      // 修法：按「调用返回后 `_boardSelected` 是否**仍存活**」分流 ——
      //  · 存活 ⇒ 玩家已选中，点的是**错色格** ⇒ 播**错珠动画**（GAP-04 `wrong` 态，与
      //    `_placeSelected` 的 `mismatch` 分支**同一通道** `FeedbackFx.armWrong`），⛔ 不给文案。
      //  · 已清（组员全死 ⇒ `_tryDirectFillFromBoard` 内 2337-2340 自行清锚）或从无
      //    ⇒ 「先选一颗珠子」成立，文案保留。
      // ⚠ 判据用**调用后**的锚状态而非「进来前」：组员全死那条路径会清锚 ⇒ 必须落到文案侧，
      //   否则会对一个已不存在的选中态播错珠动画。
      if (this._host.boardSelected) this._host.fx.armWrong(row, col);
      else this._host.fx.showTapHint(TAP_HINT_NO_SELECTION_TEXT, row, col);
    }
    return false;
  }

  /**
   * 【WXG-T-162 用户裁定（2026-09-18）· 直填任意距离】board 锚直填：
   * 点「对应颜色（= 组色）的空格」（**不限距**，覆盖 WXG-T-157 的 ≤2 门）⇒ 组内错位珠
   * 直接归位（`retrieve` + `fill` 同帧两写，`_filledCount` 不变、misplaced −1、无中间态外泄）。
   * - **【用户裁定 2026-09-20 · 选豆点固定 + 同序配对】**（修 WXG-T-180 整片填写的消费序）：
   *   目标序 = 被点格 + BFS 连通同色空格（`planGroupFill` 由近及远）；组员消费序 =
   *   拾取时一次算好（见下）。两者**同序配对**——消费序首颗填最近目标，视觉上
   *   「从选豆点一片揭起、由近及远归位」（旧「逐目标就近取珠」作废）。
   * - **【WXG-T-186 用户裁定】消费序口径改写**：旧的「距选豆点**切比雪夫**升序」是几何距，
   *   与组定义（8 向连通块）不同度量 ⇒ 拐弯组会「跳缺口隔空取物」、同圈层行主序先吃最
   *   左上珠。改用 `planConsumeOrder` 剥皮序（沿组连通的图上距离 ⇒ 不吃割点 ⇒ 同层
   *   押后引路珠），与取回落槽共用同一份序。
   * - **组保持**：被填珠移出 `order`；锚珠被填 ⇒ 仅**头珠**（`row/col`，展示坐标）转移到
   *   剩余组首（不重发 `board:selected` —— 快照坐标下一帧跟随）；**选豆点不改**；组空 ⇒ 锚清除。
   * - 归位可能达成零错位 ⇒ cleared-priority（core-loop §2.2.2，同 `_placeSelected`）。
   * - 底色不匹配 ⇒ 不消费（null），走既有「无对应路径」轻提示口径。
   * @returns true = 已直填；false = 已消费但拒绝（取珠/落盘失败防御面）；null = 与 board 锚无关（调用方续走旧路径）。
   */
  private tryDirectFill(row: number, col: number): boolean | null {
    const anchor = this._host.boardSelected;
    if (!anchor) return null;
    // 组员存活复核（solver / region / 其它消费可能中途清珠）：`filter` 保序 ⇒ 仍是消费序
    const alive = anchor.order.filter((c) => {
      const cell = this._host.grid.cell(c.row, c.col);
      return !!cell && cell.state === 'filled' && cell.beadColorIdx === anchor.color && cell.beadColorIdx !== cell.colorIdx;
    });
    if (alive.length === 0) {
      this._host.boardSelected = null;
      return null;
    }
    const target = this._host.grid.cell(row, col);
    if (!target || target.void || target.state !== 'empty' || target.colorIdx !== anchor.color) return null; // 非对应色空格 ⇒ 不消费
    this._host.markConsumed(); // 直填已消费本次点击

    // 【#3 · WXG-T-180 用户裁定】一次点击 = **组批量归位**：填被点空格 + 其 8 向连通的
    // 同色空格一片（上限 = 组内可用错位珠数），对齐托盘侧 `planGroupFill` 连续填充手感。
    // 旧「逐颗续填（一点一格）」放宽为整片；retrieve+fill 同帧两写（消费序见下方同序配对）。
    const targets: { row: number; col: number }[] = [{ row, col }];
    const extra = planGroupFill(this._host.grid, row, col, anchor.color, alive.length - 1);
    for (const e of extra) targets.push(e);

    // 【WXG-T-186 用户裁定】消费序 = 拾取时一次算好的剥皮序（`anchor.order`，上面的存活
    // 复核 `filter` 天然保序）——与取回落槽共用。目标序 = 被点格 + BFS 由近及远；
    // 与消费序同序配对：consumption[i] 填 targets[i]。
    const consumption = alive;
    const ar = anchor.anchorRow;
    const ac = anchor.anchorCol;
    let placedAny = false;
    let used = 0;
    for (const t of targets) {
      const cell = this._host.grid.cell(t.row, t.col);
      if (!cell || cell.state !== 'empty' || cell.colorIdx !== anchor.color) continue; // 复核（被点格外均为 BFS 收集的同色空格）
      const src = consumption[used]!;
      const bead = this._host.grid.retrieve(src.row, src.col);
      if (!bead || !this._host.grid.fill(t.row, t.col, bead)) {
        if (bead) this._host.grid.fill(src.row, src.col, bead); // 防御回滚（理论不可达：目标已验 empty）
        continue; // 该员不消费，余序不变
      }
      used++;
      // [T-244] 表现层登记：step = BFS 序（targets[0] = 被点格 ⇒ 「从当前点击的槽开始扩展」）。
      // [T-244] 表现层登记：step = 落珠序（targets[0] = 被点格 ⇒ 「从当前点击的槽开始」）。
      // [T-244 修正四批] step = **落珠序号**（同托盘路径口径）
      this._host.fx.pushGroupLand(t.row, t.col, used - 1);
      this._host.emit('bead:placed', { row: t.row, col: t.col, colorIdx: bead }); // 盘内移动不经托盘 ⇒ 无 slot
      placedAny = true;
      if (used >= consumption.length) break;
    }
    if (!placedAny) return false;
    this._host.checkConservation('盘内直填 directFill'); // 在过关/换 stage 转换**之前**核（转换会重建棋盘）

    // 锚更新：组空 ⇒ 清；否则**头珠**（row/col，展示用）改指剩余组首（消费序），
    // 选豆点 anchorRow/Col 恒不变（用户裁定 2026-09-20）。
    if (used >= consumption.length) {
      this._host.boardSelected = null;
    } else {
      const head = consumption[used]!;
      this._host.boardSelected = {
        row: head.row,
        col: head.col,
        anchorRow: ar,
        anchorCol: ac,
        color: anchor.color,
        order: consumption.slice(used),
      };
    }
    // 归位后可能达成零错位 ⇒ cleared-priority（core-loop §2.2.2）
    if (this._host.grid.isComplete()) {
      if (this._host.mode === 'sprint') this._host.completeStage();
      else this._host.requestLevelClear();
    }
    return true;
  }
}
