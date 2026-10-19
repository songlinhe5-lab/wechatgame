/**
 * 输入协议（WXG-T-295 抬起提交门 + 计量 + 指针缓存），从 `BeadsGame` 拆出。
 *
 * 职责边界：
 *  - 本类负责：每帧读取输入快照、区外按钮「按下登记 → 抬起同钮才提交」的门、
 *    棋盘区按压交给 `BoardCameraController`、`tapsPlaying` 计量（PLAYING 口径）。
 *  - 本类**不**负责：控件映射（`BeadsGame._hitUiControl`：依赖面板与相位）、
 *    路由分派（`BeadsGame._routeTap`：会调玩法动作）。二者经 {@link InputRouterHost} 注入。
 *
 * ⚠ 提交门的按下腿与抬起腿必须用同一套 `hitUiControl`（同帧 down+up = 即时 tap 也走此口径）。
 */
import type { GameServices } from '../../../framework/index';
import { PUZZLE_BAND } from '../../config/tuning';
import type { BeadsPhase } from '../state';
import type { BoardCameraController } from './board-camera-controller';

/** 宿主接口：输入协议需要的最小面（由 `BeadsGame` 以 getter / 方法接线，热路径零分配）。 */
export interface InputRouterHost {
  readonly phase: BeadsPhase;
  readonly services: GameServices | null;
  readonly board: BoardCameraController;
  /** 按下腿 / 抬起腿共用的控件映射；返回控件 id，非按钮 / 无命中 ⇒ `''`。 */
  hitUiControl(x: number, y: number): string;
  /** 路由分派（`BeadsGame._routeTap`）：计量之后调用，不在本类判定业务。 */
  dispatchTap(x: number, y: number): void;
}

export class InputRouter {
  /** Scratch point for screen → design conversion (never retained). */
  private readonly _pointer = { x: 0, y: 0 };
  /**
   * **抬起提交门**（WXG-T-295 · `input-control §2.1` v2.13）：区外**按钮类控件**（齿轮 / 缩放
   * 「1:1」「适配」/ 道具卡 / 扩展位 / 各类面板钮）按下**只登记**控件 id，抬起帧**仍落在同一控件**
   * 才派发；拖出、换钮、期间相位已变 ⇒ 取消。`''` = 无登记。
   * ⛔ 非按钮（托盘槽 / 棋盘格 / 遮罩空白 / slider 轨）不进本门，按下即提交口径逐字不变。
   */
  private _uiPressTarget = '';
  /**
   * 本局「被消费的点击」计数（playtest 计量件）。只在 PLAYING 相位累加 ——
   * 暂停/菜单/结算面板的点击不算玩法操作。
   *
   * **为何存在**：`beads-bot` 的 `taps` 已被实测推翻为「人类下界」口径（三关带用时
   * 实测：人类 1.6–1.8 s/击、人类击数 ≈ 0.60–0.76 × bot taps）⇒ 校准 `SEC_PER_TAP`
   * 需要真实的 (击, 秒) 对，而手记点击数不可靠（同一关两次报 30 / 44）。
   * ⚠️ 纯统计：不进 `systems-index §3`、不参与任何裁决/星级/存档。
   */
  private _tapsPlaying = 0;

  constructor(private readonly _host: InputRouterHost) {}

  /** PLAYING 口径的输入计数（含误点与只触到轻提示的无效点）。 */
  get tapsPlaying(): number {
    return this._tapsPlaying;
  }

  /** 换关 / 重试 / 新局 / 冲刺换关：计量归零。 */
  resetTapCount(): void {
    this._tapsPlaying = 0;
  }

  /** 抬起提交门不得跨装配存活（在途按压到新盘上会指向不存在的控件）。 */
  cancelPress(): void {
    this._uiPressTarget = '';
  }

  /** Read one frame of input and route it (input-control §2.1, short-circuit).
   *  WXG-T-169 / ADR-0015 C-3(a): 棋盘区 tap 抬起才提交；WXG-T-295 / v2.13: 区外**按钮**同样
   *  抬起才提交（抬起点须仍是按下那颗钮），区外非按钮（托盘槽 / 格 / 遮罩 / slider 轨）仍按下即提交。
   *  双指 = 捏合缩放、单指位移 ≥ 阈值 = 平移，均只写相机、不产玩法指令。 */
  readFrame(): void {
    const services = this._host.services;
    if (!services) return;
    const snap = services.input.snapshot;
    const vp = services.viewport;
    const playing = this._host.phase === 'playing';

    if (snap.justDown) {
      vp.screenToDesign(this._pointer, snap.x, snap.y);
      // slider 轨 = 拖拽控件：按下即进入拖拽态（协作类 `zoomDown` 置位），不受抬起提交门影响；
      // 同排的「1:1」/「适配」是按钮 ⇒ 落到下面的抬起门。
      if (playing && this._host.board.zoomHit(this._pointer.x, this._pointer.y) === 'track') {
        this._host.board.zoomDown(this._pointer.x, this._pointer.y, !!snap.justUp);
        return;
      }
      // 棋盘区起手域 = PUZZLE_BAND 整块（不限「命中某格」）：真机拖拽可从盘面任意处起手。
      const onBoard =
        playing && this._pointer.y >= PUZZLE_BAND.yMin && this._pointer.y <= PUZZLE_BAND.yMax;
      if (onBoard) {
        // 棋盘区按下 → 登记，不提交；抬起为 tap，中途越阈值转拖拽、次指落下转捏合。
        // WXG-T-170 / F1：同帧 down+up（即时 tap）在协作类内当场提交。
        this._host.board.pressBoard(this._pointer.x, this._pointer.y, !!snap.justUp);
        return;
      } else {
        // 区外：按钮只登记，抬起且仍落在同一钮才提交（WXG-T-295 / `input-control` v2.13）；
        // 非按钮（托盘槽 / 棋盘格 / 遮罩空白）走 `handleTap` = 按下即提交，语义不变。
        const target = this._host.hitUiControl(this._pointer.x, this._pointer.y);
        if (target === '') {
          this.handleTap(this._pointer.x, this._pointer.y);
          return;
        }
        this._uiPressTarget = target;
        // WXG-T-170 口径：同一固定步内 down+up 到达 = 一次即时 tap，本帧当场走抬起腿。
        if (snap.justUp) this.commitUiTap();
        return;
      }
    }

    if (this._host.board.sliderHeld(snap, vp)) return;
    if (this._host.board.boardHeld(snap, vp)) return;

    if (snap.justUp) {
      this._host.board.releaseTap(snap, vp); // 棋盘区 tap：抬起提交（v2.11 低倍档先过缩放门）
      this.commitUiTap(); // 区外按钮：抬起且仍是同一钮才提交，否则取消（WXG-T-295）
      this._host.board.endGesture();
    }
  }

  /**
   * 抬起提交门的**抬起腿**：抬起点解析出的控件与按下时登记的**同一个**才派发（在**抬起点**
   * 走既有 `handleTap` ⇒ 指令语义、门禁、SFX 全沿用路由原腿，本函数不判定任何业务）。
   * 拖出热区 / 拖到别的钮 / 按住期间相位变化 ⇒ 静默取消（零事件、零扣次、零 SFX）。
   */
  private commitUiTap(): void {
    const target = this._uiPressTarget;
    if (target === '') return;
    this._uiPressTarget = '';
    const services = this._host.services;
    if (!services) return;
    const snap = services.input.snapshot;
    services.viewport.screenToDesign(this._pointer, snap.x, snap.y);
    if (this._host.hitUiControl(this._pointer.x, this._pointer.y) !== target) return;
    this.handleTap(this._pointer.x, this._pointer.y);
  }

  /**
   * 唯一触摸收口：路由 + 计量。
   *
   * 口径 = **玩家在 PLAYING 里点了一下**（含误点与只触到轻提示的无效点）——
   * 不拿 `_consumedTap` 当条件：那个标志只覆盖部分分支（托盘落子成功也不置它），
   * 用它计数会漏掉最高频的动作；而人类的误点恰恰是 `beads-bot`「只计成功命令」
   * 口径里没计入的那部分，不量它就对不上账。
   */
  handleTap(x: number, y: number): void {
    if (this._host.phase === 'playing') this._tapsPlaying++;
    this._host.dispatchTap(x, y);
  }
}
