/**
 * MainMenuPresenter（UI-40）：走马灯状态机从 shell 迁出后的边界行为。
 *
 * 判据 = 迁移前逐条不变：10px 点按线 / 30% 翻页阈值 / 快甩 / 末页空橱窗零事件 /
 * 吸附在途按下即停。Presenter 不读时钟，全部时间由测试显式传入。
 */
import { describe, expect, it } from 'vitest';
import { ARC_OPEN_MAX } from '../src/config/arcs.js';
import { MENU_CAROUSEL, MENU_CLIP } from '../src/config/tuning.js';
import { MainMenuPresenter } from '../src/ui/main-menu-presenter.js';

const W = MENU_CLIP.w;
const SNAP = MENU_CAROUSEL.snapMs;

/** 按下 → 横拖到 `x` → 松手（默认 100ms 拖行，速度可辨）。 */
function swipe(p: MainMenuPresenter, x0: number, x: number, t = 0): void {
    p.press(x0, 500, t);
    p.move(x, 500, t + 100);
    p.release(t + 150);
}

describe('MainMenuPresenter（UI-40 走马灯状态机）', () => {
    it('点按进选关；末页空橱窗松手零事件', () => {
        const p = new MainMenuPresenter();
        p.press(100, 500, 0);
        expect(p.release(16)).toBe('open');
        expect(p.offset).toBe(0);

        // 末页（空橱窗）= 下标 `ARC_OPEN_MAX` ⇒ 翻 `ARC_OPEN_MAX` 次到顶（旧单大关版只需一次）。
        for (let i = 1; i <= ARC_OPEN_MAX; i += 1) {
            p.nudge(1, 1000);
            p.step(1000 + SNAP);
        }
        expect(p.offset).toBe(ARC_OPEN_MAX);
        p.press(100, 500, 2000);
        expect(p.release(2016)).toBe('none');
    });

    it('位移不到 10px = 点按，不进拖动', () => {
        const p = new MainMenuPresenter();
        p.press(100, 500, 0);
        expect(p.move(100 + MENU_CAROUSEL.tapPx - 1, 500, 16)).toBe(false);
        expect(p.release(32)).toBe('open');
    });

    it('过点按线但不足 30% ⇒ 回弹，不换页', () => {
        const p = new MainMenuPresenter();
        swipe(p, 300, 300 - 40);
        expect(p.dragging).toBe(false);
        expect(p.dx).toBeCloseTo(-40);
        p.step(150 + SNAP);
        expect(p.offset).toBe(0);
        expect(p.dx).toBe(0);
    });

    it('过 30% ⇒ 吸附翻页：中点仍在途，终点页位 +1、位移归零', () => {
        const p = new MainMenuPresenter();
        swipe(p, 300, 300 - (W * 0.3 + 10));
        expect(p.offset).toBe(0);
        p.step(150 + SNAP / 2);
        expect(p.dx).toBeLessThan(0);
        expect(p.dx).toBeGreaterThan(-W);
        p.step(150 + SNAP);
        expect(p.offset).toBe(1);
        expect(p.dx).toBe(0);
        expect(p.t).toBe(0);
    });

    it('吸附在途按下即停，不把半程算成翻页', () => {
        const p = new MainMenuPresenter();
        swipe(p, 300, 300 - (W * 0.3 + 10));
        p.step(150 + SNAP / 2);
        expect(p.dx).not.toBe(0);
        p.press(100, 500, 150 + SNAP / 2 + 1);
        p.step(150 + SNAP);
        expect(p.offset).toBe(0);
        expect(p.dx).toBe(0);
    });

    it('首/末页到头：快甩与 ◀▶ 都不越界', () => {
        const p = new MainMenuPresenter();
        // 首项向右快甩（vx = 2.5 > 0.6 ⇒ 请求上一页）⇒ carouselPage 回 0。
        p.press(100, 500, 0);
        p.move(150, 500, 20);
        p.release(20);
        p.step(20 + SNAP);
        expect(p.offset).toBe(0);
        // 末页再 nudge 无效。
        p.nudge(1, 1000);
        p.step(1000 + SNAP);
        p.nudge(1, 2000);
        p.step(2000 + SNAP);
        expect(p.offset).toBe(p.pages - 1);
    });
});
