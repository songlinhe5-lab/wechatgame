/**
 * 棋盘相机 · 缩放控件 · 手势（WXG-T-169 / ADR-0015 丁-3 + C-3(a)）。
 *
 * 自 `beads-game.ts` 拆出（BeadsGame 重构 · 协作类 ③）：相机态（唯一真源）、棋盘区
 * tap / 单指平移 / 双指捏合的状态机、缩放控件（1:1 / 适配 / 滑杆）与其拖拽态。
 * 相机每次变化经宿主 `layoutChanged()` 回到 BeadsGame 重算 `_layout` 与 LOD 档
 * （布局与 LOD 仍归 BeadsGame：它们也被渲染 / 命中共用）。
 *
 * 边界：本类**不判定**区外按钮（托盘 / 道具 / 面板）—— 那是输入路由（`_readInput`）的事；
 * 本类只处理「棋盘区 + 缩放控件带」的几何与手势。棋盘 tap 的玩法提交经宿主 `handleTap`。
 *
 * 热路径零分配：屏幕→设计坐标用本类自带的 `_pt` scratch；所有 tap / 手势字段均预分配。
 */
import type { InputSnapshot, Viewport } from '@wxgame/framework';
import {
  BOARD_TAP_MOVE_THRESHOLD,
  IDENTITY_CAMERA,
  ZOOM_TAP_MIN,
  zoomControlLayout,
  type BoardCamera,
} from '../../config/tuning.js';
import type { BeadGrid } from '../../entities/grid.js';
import {
  applyPan,
  applyPinch,
  clampCamera,
  createGesture,
  fitCamera,
  resetCamera,
  resetGesture,
  setCameraZoom,
  zoomAtPoint,
  zoomFromSliderT,
  type Gesture,
} from '../../systems/board-camera.js';

export interface BoardCameraHost {
  /** 当前棋盘（换关 / 冲刺换 stage 会替换，故惰性读）。 */
  readonly grid: BeadGrid;
  /** 当前是否 PLAYING（低倍 tap 聚焦与棋盘 tap 提交只在 PLAYING 生效）。 */
  readonly playing: boolean;
  /** 棋盘 tap 的玩法入口（BeadsGame 的 `_handleTap`：计量 + 路由）。 */
  handleTap(x: number, y: number): void;
  /** 相机变化后：BeadsGame 重算 `_layout` 与 `_beadLod`。 */
  layoutChanged(): void;
}

export type ZoomControlHit = 'reset' | 'fit' | 'track' | null;

export class BoardCameraController {
  private readonly _cam: BoardCamera = { ...IDENTITY_CAMERA };
  private readonly _gesture: Gesture = createGesture();
  /** 屏幕→设计坐标 scratch（⛔ 不外泄；不复用宿主的 `_pointer`）。 */
  private readonly _pt = { x: 0, y: 0 };
  private readonly _tapStart = { x: 0, y: 0 };
  private _tapActive = false; // owner pressed inside the board region → tap deferred to lift
  private _tapMoved = false; // single-finger drag past threshold → pan, suppress tap
  private _pinched = false; // a second finger joined → pinch, suppress tap
  /** 手指落在 slider 轨道上 → 拖拽映射 x→zoom（吞掉棋盘 tap/pan/pinch）。 */
  private _zoomSliderDrag = false;
  /**
   * 调试专用逐帧累计（`debugGestureState` 读）：pan 分支跑了多少帧、pan 总位移、
   * 进过 drag 态的帧数。预分配常量字段，热路径**零分配**，不影响行为。
   */
  private readonly _dbgPan = { frames: 0, dxSum: 0, movedFrames: 0 };

  constructor(private readonly _host: BoardCameraHost) {}

  /** 相机只读视图（布局 / 命中 / 快照读它；写入只经本类方法）。 */
  get camera(): Readonly<BoardCamera> {
    return this._cam;
  }

  /** 调试只读：棋盘 tap 登记态与捏合锚距（`debugGestureState` 读）。 */
  get tapActive(): boolean {
    return this._tapActive;
  }
  get tapMoved(): boolean {
    return this._tapMoved;
  }
  get pinched(): boolean {
    return this._pinched;
  }
  get pinchDist0(): number {
    return this._gesture.pinchDist0;
  }
  get dbgPan(): Readonly<{ frames: number; dxSum: number; movedFrames: number }> {
    return this._dbgPan;
  }

  /**
   * 装配复位（换关 / 新局 / 重试 / 冲刺换 stage 共用）：相机回 fit 初始 + 清棋盘 tap 标志。
   * 口径保持原样：**不**清滑杆拖拽态与调试累计；调用方随后自行重算布局（`_layout`）。
   */
  resetForAssembly(): void {
    fitCamera(this._cam, this._host.grid.cols, this._host.grid.rows);
    resetGesture(this._gesture);
    this._tapActive = false;
    this._tapMoved = false;
    this._pinched = false;
  }

  /** 缩放控件命中（热区各 88×88）：`reset`「1:1」/ `fit` 适配 / `track` slider。 */
  zoomHit(x: number, y: number): ZoomControlHit {
    const zc = zoomControlLayout();
    const inside = (r: { x: number; y: number; w: number; h: number }): boolean =>
      x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    if (inside(zc.reset)) return 'reset';
    if (inside(zc.fit)) return 'fit';
    if (inside(zc.track)) return 'track';
    return null;
  }

  /**
   * 缩放控件按下处理；返回 true = 事件已消费（不进棋盘 tap/pan/pinch）。
   * `justUp`（同帧 down+up，WXG-T-170 口径）时 track 只做一次性提交、不进拖拽态。
   */
  zoomDown(x: number, y: number, justUp: boolean): boolean {
    const hit = this.zoomHit(x, y);
    if (!hit) return false;
    if (hit === 'reset') {
      resetCamera(this._cam);
      clampCamera(this._cam, this._host.grid.cols, this._host.grid.rows);
      this._changed();
    } else if (hit === 'fit') {
      fitCamera(this._cam, this._host.grid.cols, this._host.grid.rows);
      this._changed();
    } else {
      this._applySlider(x);
      this._zoomSliderDrag = !justUp;
    }
    return true;
  }

  /**
   * DEBUG 直设倍率（`setZoomForDebug`）：与滑杆设出的状态完全同构（同一 `setCameraZoom` +
   * 同一布局重算），越界由 `setCameraZoom` 自带 clamp 兜住。
   */
  setZoom(zoom: number): void {
    setCameraZoom(this._cam, zoom, this._host.grid.cols, this._host.grid.rows);
    this._changed();
  }

  /**
   * 滑杆拖拽中（按住）：返回 true = 已消费。抬起即退出拖拽态。
   * 与 `boardHeld` 互斥由调用方保证顺序（滑杆优先，同原口径）。
   */
  sliderHeld(snap: InputSnapshot, vp: Viewport): boolean {
    if (!this._zoomSliderDrag || !snap.isDown) return false;
    vp.screenToDesign(this._pt, snap.x, snap.y);
    this._applySlider(this._pt.x);
    if (snap.justUp) this._zoomSliderDrag = false;
    return true;
  }

  /**
   * 棋盘区按下（调用方已判定 PLAYING + 落在 PUZZLE_BAND）：登记 tap 态，不提交；
   * 同帧已抬起（即时 tap）⇒ 当场提交。
   */
  pressBoard(x: number, y: number, justUp: boolean): void {
    this._tapActive = true;
    this._tapMoved = false;
    this._pinched = false;
    this._tapStart.x = x;
    this._tapStart.y = y;
    // WXG-T-170 / F1：同一固定步内 down+up = 即时 tap，当场提交。
    // 同帧抬起时 `InputRouter.readFrame` 会提前 return，不走抬起收尾（releaseTap → endGesture），
    // 所以收尾必须在此完成；否则 `_tapActive` 悬挂，之后托盘上的拖拽会被当成棋盘平移。
    if (justUp) {
      this._commitTap(x, y);
      this.endGesture();
    }
  }

  /**
   * 棋盘 tap 登记态的按住腿：双指 = 捏合；单指越阈值 = 平移；未越阈值 = 等待抬起定 tap。
   * 返回 true = 本帧已消费（调用方应直接 return）。
   */
  boardHeld(snap: InputSnapshot, vp: Viewport): boolean {
    if (!this._tapActive || !snap.isDown) return false;
    if (snap.isDown2) {
      this._pinched = true;
      if (applyPinch(snap, this._cam, this._gesture)) this._changed();
      return true;
    }
    vp.screenToDesign(this._pt, snap.x, snap.y);
    if (!this._tapMoved) {
      // WXG-T-171 / F2：度量形态 = **切比雪夫 L∞ = max(|dx|,|dy|)**（GDD `input-control §2.1` v2.5 字面对齐）。
      const moved = Math.max(
        Math.abs(this._pt.x - this._tapStart.x),
        Math.abs(this._pt.y - this._tapStart.y),
      );
      if (moved >= BOARD_TAP_MOVE_THRESHOLD) this._tapMoved = true;
    }
    if (this._tapMoved) {
      // 单指拖拽 → 平移相机（screen dx/dy → design：/scale、y 翻向）。
      const scale = vp.fit.scale || 1;
      this._dbgPan.frames += 1;
      this._dbgPan.dxSum += snap.dx / scale;
      applyPan(snap.dx / scale, -snap.dy / scale, this._cam, this._host.grid.cols, this._host.grid.rows);
      this._changed();
    } else {
      this._dbgPan.movedFrames += 1;
    }
    return true;
  }

  /**
   * 抬起时的棋盘 tap 提交：登记中且未拖、未捏 ⇒ 在抬起点提交。
   * ⚠ 调用方顺序固定为 `releaseTap → 区外按钮抬起门 → endGesture`（原口径）。
   */
  releaseTap(snap: InputSnapshot, vp: Viewport): void {
    if (this._tapActive && !this._tapMoved && !this._pinched) {
      vp.screenToDesign(this._pt, snap.x, snap.y);
      this._commitTap(this._pt.x, this._pt.y);
    }
  }

  /** 抬起收尾：清 tap / 捏合 / 滑杆拖拽态、调试累计与捏合锚。 */
  endGesture(): void {
    this._tapActive = false;
    this._tapMoved = false;
    this._pinched = false;
    this._zoomSliderDrag = false;
    this._dbgPan.frames = 0;
    this._dbgPan.dxSum = 0;
    this._dbgPan.movedFrames = 0;
    resetGesture(this._gesture);
  }

  /**
   * 棋盘区 tap 提交口：低倍（`zoom < ZOOM_TAP_MIN`，PLAYING）下不放珠，改以点击处为焦点放大到 1.0
   * （相机态、零玩法指令，计量口径同 drag/捏合，不占 `_tapsPlaying`）；否则交宿主 `handleTap`。
   */
  private _commitTap(x: number, y: number): void {
    if (this._host.playing && this._cam.zoom < ZOOM_TAP_MIN) {
      zoomAtPoint(this._cam, x, y, 1, this._host.grid.cols, this._host.grid.rows);
      this._changed();
      return;
    }
    this._host.handleTap(x, y);
  }

  /** slider x（设计空间）→ zoom：轨道线性映射绝对档 `[CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX]`（§3.3 v1.59）。 */
  private _applySlider(x: number): void {
    const track = zoomControlLayout().track;
    setCameraZoom(
      this._cam,
      zoomFromSliderT((x - track.x) / track.w),
      this._host.grid.cols,
      this._host.grid.rows,
    );
    this._changed();
  }

  private _changed(): void {
    this._host.layoutChanged();
  }
}
