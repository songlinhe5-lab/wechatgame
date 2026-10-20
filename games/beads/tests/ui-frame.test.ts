import { describe, expect, it } from 'vitest';
import type { CapsuleRect, SafeInsets } from '@wxgame/framework';
import { navBar, screenFrame } from '../src/view/ui-frame.js';
import type { FrameRect } from '../src/view/ui-frame.js';

const W = 750;
const H = 1334;
const TOP = 120;
/** 微信真实胶囊档（= `CAPSULE_AVOID`，y-up）。 */
const CAPSULE_RIGHT: CapsuleRect = { left: 560, right: 750, top: 1334, bottom: 1214 };

function insets(capsule: CapsuleRect | null): SafeInsets {
  const contentTop = Math.min(H - TOP, capsule ? capsule.bottom : H);
  return {
    width: W,
    height: H,
    top: TOP,
    bottom: 0,
    capsule,
    topBar: { bottom: contentTop, top: H, height: H - contentTop },
    content: { bottom: 0, top: contentTop, height: contentTop },
    bottomBar: { bottom: 0, top: 0, height: 0 },
  };
}

function overlaps(r: FrameRect, c: CapsuleRect): boolean {
  return r.x < c.right && r.x + r.w > c.left && r.y < c.top && r.y + r.h > c.bottom;
}

function controls(layout: ReturnType<typeof navBar>): FrameRect[] {
  const out: FrameRect[] = [];
  if (layout.back) out.push(layout.back);
  out.push(...layout.right);
  if (layout.title.maxWidth > 0) {
    out.push({
      x: layout.title.x - layout.title.maxWidth / 2,
      y: layout.title.y - layout.bar.h / 2,
      w: layout.title.maxWidth,
      h: layout.bar.h,
    });
  }
  return out;
}

describe('screenFrame', () => {
  it('三段与安全带同界，左右各让边距', () => {
    const f = screenFrame(insets(null));
    expect(f.topBar).toEqual({ x: 4, y: 1214, w: W - 8, h: 120 });
    expect(f.content).toEqual({ x: 4, y: 0, w: W - 8, h: 1214 });
    expect(f.bottomBar).toEqual({ x: 4, y: 0, w: W - 8, h: 0 });
  });

  it('有胶囊时内容区顶界 = 胶囊底', () => {
    const f = screenFrame(insets(CAPSULE_RIGHT));
    expect(f.content.y + f.content.h).toBe(CAPSULE_RIGHT.bottom);
    expect(f.topBar.y).toBe(CAPSULE_RIGHT.bottom);
  });
});

describe('navBar', () => {
  it('无胶囊：控件贴页面右缘，返回键贴左缘', () => {
    const l = navBar(insets(null), { barHeight: TOP, back: true, rightSlots: 2 });
    expect(l.bar).toEqual({ x: 4, y: 1214, w: W - 8, h: TOP });
    expect(l.back).toEqual({ x: 4, y: 1246, w: 56, h: 56 });
    expect(l.right).toHaveLength(2);
    expect(l.right[0].x + l.right[0].w).toBe(W - 4);
    expect(l.title.maxWidth).toBeGreaterThan(0);
  });

  it('胶囊在右上：所有控件都不入胶囊', () => {
    const l = navBar(insets(CAPSULE_RIGHT), { barHeight: TOP, back: true, rightSlots: 2 });
    expect(l.right).toHaveLength(2);
    expect(l.right[0].x + l.right[0].w).toBe(CAPSULE_RIGHT.left - 8);
    for (const c of controls(l)) expect(overlaps(c, CAPSULE_RIGHT)).toBe(false);
  });

  it('胶囊在左上：返回键挪到胶囊右侧，仍不入胶囊', () => {
    const cap: CapsuleRect = { left: 40, right: 190, top: 1334, bottom: 1214 };
    const l = navBar(insets(cap), { barHeight: TOP, back: true, rightSlots: 1 });
    expect(l.back?.x).toBe(cap.right + 8);
    for (const c of controls(l)) expect(overlaps(c, cap)).toBe(false);
  });

  it('胶囊横跨整栏：不放任何控件，标题宽 0', () => {
    const cap: CapsuleRect = { left: 300, right: 450, top: 1334, bottom: 1214 };
    const l = navBar(insets(cap), { barHeight: TOP, back: true, rightSlots: 2 });
    expect(l.back).toBeNull();
    expect(l.right).toEqual([]);
    expect(l.title.maxWidth).toBe(0);
  });

  it('胶囊不在本栏（人造 insets）：不触发避让', () => {
    const cap: CapsuleRect = { left: 560, right: 750, top: 200, bottom: 100 };
    const l = navBar({ ...insets(null), capsule: cap }, { barHeight: TOP, rightSlots: 2 });
    expect(l.right[0].x + l.right[0].w).toBe(W - 4);
  });

  it('槽多到排不下：只排能排的，不越界不重叠', () => {
    const l = navBar(insets(CAPSULE_RIGHT), { barHeight: TOP, back: true, rightSlots: 20 });
    expect(l.right.length).toBeLessThan(20);
    for (let i = 1; i < l.right.length; i++) {
      expect(l.right[i].x + l.right[i].w).toBeLessThanOrEqual(l.right[i - 1].x - 8);
    }
    for (const c of controls(l)) expect(overlaps(c, CAPSULE_RIGHT)).toBe(false);
  });
});
