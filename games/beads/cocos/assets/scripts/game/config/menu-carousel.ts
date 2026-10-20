/**
 * 主菜单走马灯的纯计算（落地单 §8）。状态由 `MainMenuPresenter` 持有，视图只读偏移。
 */
import { MENU_CAROUSEL, MENU_CLIP } from './tuning';

/** 翻页：-1 上一项，+1 下一项，0 回弹。`vx` = 设计 px/ms，正 = 手指向右。到头返回 0。 */
export function carouselPage(dx: number, vx: number, index: number, count: number): -1 | 0 | 1 {
    const w = MENU_CLIP.w;
    const flick = Math.abs(vx) >= MENU_CAROUSEL.flickPxPerMs;
    let page: -1 | 0 | 1 = 0;
    if (flick && vx < 0) page = 1;
    else if (flick && vx > 0) page = -1;
    else if (dx <= -w * MENU_CAROUSEL.pageFrac) page = 1;
    else if (dx >= w * MENU_CAROUSEL.pageFrac) page = -1;
    if (index + page < 0 || index + page >= count) return 0;
    return page;
}

/** 到头只跟住手指的一部分，并且不超过一槽宽。 */
export function carouselDamp(dx: number, index: number, count: number): number {
    const w = MENU_CLIP.w;
    let x = dx;
    if ((index <= 0 && x > 0) || (index >= count - 1 && x < 0)) x *= MENU_CAROUSEL.endFollow;
    if (x > w) x = w;
    else if (x < -w) x = -w;
    return x;
}

/**
 * 木牌两段透明度。返回值是模块级复用数组，调用方当场读完。
 * 0→0.5 旧字淡出，0.5→1 新字淡入，两段不重叠。
 */
const FADE: [number, number] = [1, 0];
export function plateFade(t: number): readonly [number, number] {
    const u = t < 0 ? 0 : t > 1 ? 1 : t;
    FADE[0] = Math.max(0, 1 - 2 * u);
    FADE[1] = Math.max(0, 2 * u - 1);
    return FADE;
}
