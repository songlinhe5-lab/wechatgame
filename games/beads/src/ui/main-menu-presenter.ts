/**
 * MainMenuPresenter — 主菜单页 Presenter（ADR-0032 DEC-1，UI-40）。
 *
 * 从 shell 迁出的走马灯状态机：页位 / 拖动位移 / 吸附动画 / 玻璃手势。
 * View（`buildMetaView`）只读 `offset` / `dx` / `t`；壳只把输入事件与毫秒时钟喂进来，
 * 不再持有任何走马灯字段。⚠ 本批不接线 UiRoot 路由（路由归 UI-42）。
 *
 * 页序 = 已开放大关 + 末页空橱窗（EP13-S4，C-2 ③）；页位只在 `[0, pages)` 内变动
 * （`nudge` 与 `release` 都先过 `carouselPage` 的边界判定 ⇒ 无需每帧钳位）。
 *
 * 热路径零分配：全部标量字段；`release` 返回字符串字面量，不建对象。
 */
import { ARC_OPEN_MAX } from '../config/arcs.js';
import { carouselDamp, carouselPage } from '../config/menu-carousel.js';
import { MENU_CAROUSEL, MENU_CLIP } from '../config/tuning.js';

/** 玻璃松手结果：`open` = 点按（壳去开选关）；`page` = 已启动翻页 / 回弹；`none` = 空橱窗零事件。 */
export type GlassRelease = 'open' | 'page' | 'none';

export class MainMenuPresenter {
    /** 页数 = 已开放大关 + 末页空橱窗。 */
    private readonly _pages = ARC_OPEN_MAX + 1;
    private _offset = 0;
    private _dx = 0;
    private _t = 0;
    private _glass = false;
    private _dragging = false;
    private _pressX = 0;
    private _pressY = 0;
    private _lastX = 0;
    private _lastT = 0;
    /** 手指速度（设计 px/ms，正 = 向右）。 */
    private _vx = 0;
    private _animOn = false;
    private _animFrom = 0;
    private _animTo = 0;
    private _animStart = 0;
    private _animDir: -1 | 0 | 1 = 0;

    /** 当前页位（`[0, pages)`）。 */
    get offset(): number {
        return this._offset;
    }

    /** 拖动 / 吸附位移（设计 px；视图直接叠加）。 */
    get dx(): number {
        return this._dx;
    }

    /** 透明度进度 `|dx| / 槽宽`，钳在 `[0, 1]`。 */
    get t(): number {
        return this._t;
    }

    get pages(): number {
        return this._pages;
    }

    /** 玻璃（走马灯卡）手势进行中。 */
    get glass(): boolean {
        return this._glass;
    }

    /** 已判为拖动（越过点按线）。 */
    get dragging(): boolean {
        return this._dragging;
    }

    /** 玻璃按下：终止在途吸附（停在当前位移），记录手势起点。 */
    press(x: number, y: number, now: number): void {
        this._animOn = false;
        this._glass = true;
        this._dragging = false;
        this._pressX = x - this._dx;
        this._pressY = y;
        this._lastX = x;
        this._lastT = now;
        this._vx = 0;
    }

    /** 拖动一帧；越过点按线才判为拖动。@returns 当前是否在拖。 */
    move(x: number, y: number, now: number): boolean {
        if (!this._glass) return false;
        const raw = x - this._pressX;
        const dt = now - this._lastT;
        if (dt > 0) this._vx = (x - this._lastX) / dt;
        this._lastX = x;
        this._lastT = now;
        if (!this._dragging) {
            const adx = raw < 0 ? -raw : raw;
            const ady = y - this._pressY;
            const ay = ady < 0 ? -ady : ady;
            if (adx > MENU_CAROUSEL.tapPx || ay > MENU_CAROUSEL.tapPx) this._dragging = true;
        }
        if (this._dragging) this._setSlide(carouselDamp(raw, this._offset, this._pages));
        return this._dragging;
    }

    /**
     * 松手。`open` 的选关副作用（overlay / 事件 / 转场）归壳；
     * `page` 表示已在内部启动吸附动画，壳无需再动。
     */
    release(now: number): GlassRelease {
        const page = this._dragging ? carouselPage(this._dx, this._vx, this._offset, this._pages) : 0;
        this._glass = false;
        if (!this._dragging) {
            this._dragging = false;
            // 末页空橱窗无大关实体 ⇒ 零事件（R13）。
            return this._offset >= ARC_OPEN_MAX ? 'none' : 'open';
        }
        this._dragging = false;
        this._startAnim(page, now);
        return 'page';
    }

    /** ◀▶ 与滑动松手共用。`page` 0 = 回到当前项；越界不动。 */
    nudge(page: -1 | 0 | 1, now: number): void {
        if (this._animOn || this._dragging) return;
        if (this._offset + page < 0 || this._offset + page >= this._pages) return;
        this._dx = 0;
        this._startAnim(page, now);
    }

    /**
     * `[WXG-T-490]` 启动定位（无动画直接落位）：壳在 `init` 载档后把**起点页**
     *（续玩关所属大关页，`menu-architecture §5.4` 条 4）喂进来；越界钳到 `[0, pages)`。
     * ⛔ 走 `nudge`（那会带吸附动画，开机橱窗逐页划过 = 新缺陷）。
     */
    seek(page: number): void {
        if (page < 0) page = 0;
        if (page >= this._pages) page = this._pages - 1;
        this._offset = page;
    }

    /** 每帧推进吸附（`now` = 毫秒时钟）。 */
    step(now: number): void {
        if (this._dragging) return;
        if (!this._animOn) {
            if (this._dx !== 0 || this._t !== 0) this._setSlide(0);
            return;
        }
        const u = (now - this._animStart) / MENU_CAROUSEL.snapMs;
        if (!(u < 1)) {
            this._offset += this._animDir;
            this._animOn = false;
            this._animDir = 0;
            this._setSlide(0);
            return;
        }
        const inv = 1 - u;
        const e = 1 - inv * inv * inv;
        this._setSlide(this._animFrom + (this._animTo - this._animFrom) * e);
    }

    /** 相邻项在左（-1）/ 右（+1）；没有则 0。 */
    peerSign(): -1 | 0 | 1 {
        if (this._animOn && this._animDir !== 0) return this._animDir;
        if (this._dx > 0) return -1;
        if (this._dx < 0) return 1;
        return 0;
    }

    private _startAnim(page: -1 | 0 | 1, now: number): void {
        this._animFrom = this._dx;
        this._animTo = page === 0 ? 0 : page === 1 ? -MENU_CLIP.w : MENU_CLIP.w;
        this._animDir = page;
        this._animStart = now;
        this._animOn = this._animFrom !== this._animTo;
        if (!this._animOn) this._setSlide(0);
    }

    private _setSlide(dx: number): void {
        this._dx = dx;
        const w = MENU_CLIP.w;
        this._t = w > 0 ? Math.min(1, Math.abs(dx) / w) : 0;
    }
}
