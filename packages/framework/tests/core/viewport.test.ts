import { describe, expect, it } from 'vitest';
import { Viewport } from '../../src/core/render/viewport.js';

describe('Viewport', () => {
  it('rejects a degenerate design size', () => {
    expect(() => new Viewport(0, 100)).toThrow(/positive/);
  });

  it('letterboxes to fit inside the screen', () => {
    const vp = new Viewport(1000, 1000);
    const fit = vp.resize(2000, 1000);
    expect(fit.scale).toBe(1);
    expect(fit.viewWidth).toBe(1000);
    expect(fit.viewHeight).toBe(1000);
    expect(fit.offsetX).toBe(500); // centred horizontally
    expect(fit.offsetY).toBe(0);
  });

  it('covers the screen when cover=true', () => {
    const vp = new Viewport(1000, 1000);
    const fit = vp.resize(2000, 1000, true);
    expect(fit.scale).toBe(2);
    expect(fit.viewWidth).toBe(2000);
    expect(fit.offsetY).toBe(-500); // overflows vertically
  });

  it('converts screen → design with a Y flip, and back', () => {
    const vp = new Viewport(750, 1334);
    vp.resize(750, 1334); // scale 1, no letterbox
    const out = { x: 0, y: 0 };
    vp.screenToDesign(out, 100, 100);
    expect(out.x).toBeCloseTo(100, 6);
    expect(out.y).toBeCloseTo(1334 - 100, 6);

    vp.designToScreen(out, 100, 1334 - 100);
    expect(out.x).toBeCloseTo(100, 6);
    expect(out.y).toBeCloseTo(100, 6);
  });

  it('round-trips through a letterboxed, scaled fit', () => {
    const vp = new Viewport(750, 1334);
    vp.resize(1080, 1920); // different aspect → letterbox
    const out = { x: 0, y: 0 };
    vp.screenToDesign(out, 540, 960);
    const design = { x: out.x, y: out.y };
    vp.designToScreen(out, design.x, design.y);
    expect(out.x).toBeCloseTo(540, 6);
    expect(out.y).toBeCloseTo(960, 6);
  });

  it('containsScreenPoint respects the letterbox rect', () => {
    const vp = new Viewport(1000, 1000);
    vp.resize(2000, 1000); // view rect spans x ∈ [500, 1500]
    expect(vp.containsScreenPoint(1000, 500)).toBe(true);
    expect(vp.containsScreenPoint(100, 500)).toBe(false);
    expect(vp.containsScreenPoint(1000, 1200)).toBe(false);
  });

  it('reports the design aspect ratio', () => {
    expect(new Viewport(750, 1500).designAspect).toBe(0.5);
  });
});
