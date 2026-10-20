/**
 * ScreenFrame + NavBar — 页面基础（UI-23；`docs/architecture/ui-architecture-beads.md` §4 / §12）。
 *
 * 两件都只做**布局**，不画背景、不画图标：
 * - {@link screenFrame}：把框架层 `SafeInsets` 的三条安全带转成可直接绘制/命中的矩形（加页面边距），
 *   收口「菜单锚定几何 / 对局常量」两套来源。
 * - {@link navBar}：标题 + 右侧槽 + 可选返回键，**自动避让胶囊**——控件一律排在胶囊矩形之外。
 *
 * ⛔ 迁移期不接线（§1 非目标：不改画面）：现有各页顶栏手算坐标原样保留，本件供 UI-25 总装消费。
 *   调试层挂点属 UI-24 DebugLayer，本批不出。
 *
 * ⚠ 迁移期落点 = `src/view/`；UI-25 随风格层搬 `src/ui/kit/`。
 */
import type { CapsuleRect, SafeInsets } from '../../framework/index';
import type { SafeBand } from '../../framework/index';
import { NAV_BAR_GAP, NAV_BAR_ICON, SAFE_EDGE_MARGIN } from '../config/tuning';

/** 设计坐标矩形（y-up，底边 y），与 RenderModel 的 `rect` 同参。 */
export interface FrameRect {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}

export interface ScreenFrameLayout {
    readonly topBar: FrameRect;
    readonly content: FrameRect;
    readonly bottomBar: FrameRect;
}

/** 安全带 → 去掉左右页面边距的矩形（带本身已含上下界）。 */
export function screenFrame(
    insets: SafeInsets,
    margin: number = SAFE_EDGE_MARGIN,
): ScreenFrameLayout {
    const x = margin;
    const w = Math.max(0, insets.width - margin * 2);
    const of = (band: SafeBand): FrameRect => ({ x, y: band.bottom, w, h: band.height });
    return {
        topBar: of(insets.topBar),
        content: of(insets.content),
        bottomBar: of(insets.bottomBar),
    };
}

export interface NavBarSpec {
    /** 期望栏高（设计 px）；不得超出安全区顶带，超出即压扁到顶带高。 */
    readonly barHeight: number;
    /** 左侧返回键（选关页不用，返回走底部 `back`）。 */
    readonly back?: boolean;
    /** 右侧槽个数（从右往左排，排不下就不排）。 */
    readonly rightSlots?: number;
    readonly iconSize?: number;
    readonly gap?: number;
}

export interface NavBarTitle {
    /** 文字锚点 = 可用区间中心（与 `builder.text` 的中心锚一致）。 */
    readonly x: number;
    readonly y: number;
    /** 避让胶囊与两侧控件后的可用宽度；`0` = 本栏放不下标题。 */
    readonly maxWidth: number;
}

export interface NavBarLayout {
    readonly bar: FrameRect;
    readonly title: NavBarTitle;
    readonly back: FrameRect | null;
    readonly right: readonly FrameRect[];
    /** 退回入参胶囊，便于调用方/单测复核避让结果。 */
    readonly capsule: CapsuleRect | null;
}

export function navBar(insets: SafeInsets, spec: NavBarSpec): NavBarLayout {
    const gap = spec.gap ?? NAV_BAR_GAP;
    const icon = spec.iconSize ?? NAV_BAR_ICON;
    const margin = SAFE_EDGE_MARGIN;
    const h = Math.min(spec.barHeight, insets.topBar.height);
    const bar: FrameRect = {
        x: margin,
        y: insets.topBar.bottom,
        w: Math.max(0, insets.width - margin * 2),
        h,
    };

    // 胶囊与本栏垂直相交才需要避让：按胶囊落在左半/右半/横跨收窄可用横向区间，
    // 保证返回键、右侧槽、标题一律排在胶囊矩形之外。
    const capsule = insets.capsule;
    const barTop = bar.y + bar.h;
    const capsuleInBar = capsule !== null && capsule.bottom < barTop && capsule.top > bar.y;
    let leftEdge = bar.x;
    let rightEdge = insets.width - margin;
    if (capsuleInBar && capsule !== null) {
        const mid = bar.x + bar.w / 2;
        if (capsule.left >= mid) {
            rightEdge = Math.min(rightEdge, capsule.left - gap);
        } else if (capsule.right <= mid) {
            leftEdge = Math.max(leftEdge, capsule.right + gap);
        } else {
            leftEdge = mid;
            rightEdge = mid; // 横跨整栏：本栏没有可用区
        }
    }

    const back: FrameRect | null =
        spec.back && leftEdge + icon <= rightEdge
            ? { x: leftEdge, y: bar.y + (bar.h - icon) / 2, w: icon, h: icon }
            : null;

    const right: FrameRect[] = [];
    let cursor = rightEdge;
    const leftReserved = leftEdge + (back ? icon + gap : 0) + icon + gap;
    for (let i = 0; i < (spec.rightSlots ?? 0); i++) {
        const x = cursor - icon;
        if (x < leftReserved) break; // 不给标题留位就宁可不排，绝不越界
        right.push({ x, y: bar.y + (bar.h - icon) / 2, w: icon, h: icon });
        cursor = x - gap;
    }

    const titleLeft = back ? back.x + back.w + gap : leftEdge + gap;
    const titleRight = right.length > 0 ? right[right.length - 1].x - gap : rightEdge;
    const maxWidth = Math.max(0, titleRight - titleLeft);
    return {
        bar,
        title: {
            x: titleLeft + maxWidth / 2,
            y: bar.y + bar.h / 2,
            maxWidth,
        },
        back,
        right,
        capsule,
    };
}
