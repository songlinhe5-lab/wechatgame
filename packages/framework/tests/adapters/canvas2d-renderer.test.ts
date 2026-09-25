import { describe, expect, it } from 'vitest';
import { Canvas2DRenderer, type Canvas2DLike } from '../../src/adapters/canvas2d/canvas2d-renderer.js';
import { Viewport } from '../../src/core/render/viewport.js';
import { RenderModelBuilder } from '../../src/core/render/render-model.js';

/** Records every call made against the context, in order. */
function mockCtx() {
  const calls: string[] = [];
  const record = (name: string) => (...args: unknown[]) => {
    calls.push(`${name}(${args.join(',')})`);
  };
  const ctx: Canvas2DLike = {
    save: record('save'),
    restore: record('restore'),
    setTransform: record('setTransform'),
    clearRect: record('clearRect'),
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    rect: record('rect'),
    arc: record('arc'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    translate: record('translate'),
    scale: record('scale'),
    fill: record('fill'),
    stroke: record('stroke'),
    fillText: record('fillText'),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
  };
  return { ctx, calls };
}

function makeRenderer() {
  const { ctx, calls } = mockCtx();
  const viewport = new Viewport(100, 100);
  viewport.resize(100, 100); // scale 1
  const renderer = new Canvas2DRenderer(ctx, viewport);
  return { ctx, calls, renderer, viewport };
}

describe('Canvas2DRenderer', () => {
  it('wraps drawing in save/restore', () => {
    const { renderer, calls } = makeRenderer();
    const b = new RenderModelBuilder(100, 100);
    b.begin();
    renderer.draw(b.end());
    expect(calls[0]).toBe('save()');
    expect(calls[1]).toMatch(/^setTransform\(1,0,0,-1,0,100\)$/);
    expect(calls[calls.length - 1]).toBe('restore()');
  });

  it('fills the background in design space when present', () => {
    const { renderer, calls } = makeRenderer();
    const b = new RenderModelBuilder(100, 100);
    b.begin('#101010');
    renderer.draw(b.end());
    expect(calls).toContain('fillRect(0,0,100,100)');
  });

  it('draws a filled + stroked rect', () => {
    const { renderer, calls, ctx } = makeRenderer();
    const b = new RenderModelBuilder(100, 100);
    b.begin();
    b.rect(10, 20, 30, 40, { fill: '#fff', stroke: '#000', lineWidth: 2 });
    renderer.draw(b.end());
    expect(calls).toContain('rect(10,20,30,40)');
    expect(calls).toContain('fill()');
    expect(calls).toContain('stroke()');
    expect(ctx.fillStyle).toBe('#fff');
  });

  it('uses a rounded path when a radius is given', () => {
    const { renderer, calls } = makeRenderer();
    const b = new RenderModelBuilder(100, 100);
    b.begin();
    b.rect(0, 0, 20, 20, { fill: '#fff', radius: 4 });
    renderer.draw(b.end());
    expect(calls.some((c) => c.startsWith('rect('))).toBe(false);
    expect(calls.filter((c) => c.startsWith('arc(')).length).toBeGreaterThanOrEqual(4);
  });

  it('draws circles and lines', () => {
    const { renderer, calls } = makeRenderer();
    const b = new RenderModelBuilder(100, 100);
    b.begin();
    b.circle(50, 50, 10, { fill: '#f00' });
    b.line(0, 0, 100, 100, '#0f0', 3);
    renderer.draw(b.end());
    expect(calls).toContain('arc(50,50,10,0,6.283185307179586)');
    expect(calls).toContain('moveTo(0,0)');
    expect(calls).toContain('lineTo(100,100)');
  });

  it('draws polygons and skips degenerate ones', () => {
    const { renderer, calls } = makeRenderer();
    const b = new RenderModelBuilder(100, 100);
    b.begin();
    b.polygon([0, 0, 10, 0, 5, 10], { fill: '#00f' });
    b.polygon([0, 0], { fill: '#000' }); // too few points
    renderer.draw(b.end());
    expect(calls.filter((c) => c === 'closePath()')).toHaveLength(1);
    expect(calls).toContain('lineTo(5,10)');
  });

  /**
   * ADR-0024 §6-J5 的 **canvas2d 侧取证**（与 cocos 同名判据成对，理由：SVG 对拍不经过
   * adapter）。额外钉住一条旧行为：**skip 发生在 `beginPath()` 之前**——退化多边形不得
   * 清空上一条路径。红法同 cocos 侧注（循环边界 / 按引用回归 / 门限改 < 3 / skip 后置）。
   */
  it('emits the exact vertex sequence for polygons sharing one scratch array (ADR-0024 J-5)', () => {
    const { renderer, calls } = makeRenderer();
    const b = new RenderModelBuilder(100, 100);
    const scratch: number[] = [0, 0, 10, 0, 5, 10];
    b.begin();
    b.polygon(scratch, { fill: '#00f' });
    for (let k = 0; k < 6; k += 1) scratch[k] += 20; // 复用同一数组（旧契约下会串形）
    b.polygon(scratch, { fill: '#0f0' });
    b.polygon([1, 1, 2, 2, 3], { fill: '#f00' }); // 奇数长度 ⇒ 尾浮点被丢弃（口径逐字不变）
    b.polygon([4, 4, 5], { fill: '#fff' }); // count = 1 ⇒ skip，且不开新路径
    renderer.draw(b.end());
    expect(calls.filter((c) => /^(beginPath|moveTo|lineTo|closePath)/.test(c))).toEqual([
      'beginPath()', 'moveTo(0,0)', 'lineTo(10,0)', 'lineTo(5,10)', 'closePath()',
      'beginPath()', 'moveTo(20,20)', 'lineTo(30,20)', 'lineTo(25,30)', 'closePath()',
      'beginPath()', 'moveTo(1,1)', 'lineTo(2,2)', 'closePath()',
    ]);
  });

  it('undoes the y-flip for text locally and swaps vertical baselines', () => {
    const { ctx, calls, renderer } = makeRenderer();
    const b = new RenderModelBuilder(100, 100);
    b.begin();
    b.text(10, 20, 'SCORE', { fill: '#ff0', font: '18px sans', align: 'center', baseline: 'top', alpha: 0.5 });
    renderer.draw(b.end());
    // GAP-08: the glyph is painted at the local origin after translate→(10,20)
    // + scale(1,-1), so the anchor lives in the transform, not the fillText args.
    expect(calls).toContain('translate(10,20)');
    expect(calls).toContain('scale(1,-1)');
    expect(calls).toContain('fillText(SCORE,0,0)');
    // Re-flipping inverts the vertical baseline: 'top' → 'bottom'.
    expect(ctx.textBaseline).toBe('bottom');
    expect(ctx.textAlign).toBe('center');
    expect(ctx.font).toBe('18px sans');
    expect(ctx.globalAlpha).toBe(0.5);
  });

  it('keeps horizontal/alphabetic baselines untouched under the local re-flip', () => {
    const { ctx, renderer } = makeRenderer();
    const b = new RenderModelBuilder(100, 100);
    b.begin();
    b.text(10, 20, 'OK', { baseline: 'middle' });
    renderer.draw(b.end());
    expect(ctx.textBaseline).toBe('middle');
  });

  it('can skip the viewport transform when the host already applied one', () => {
    const { ctx, calls } = mockCtx();
    const viewport = new Viewport(100, 100);
    const renderer = new Canvas2DRenderer(ctx, viewport, { applyViewportTransform: false });
    const b = new RenderModelBuilder(100, 100);
    b.begin();
    renderer.draw(b.end());
    expect(calls.some((c) => c.startsWith('setTransform('))).toBe(false);
  });

  it('renders text un-flipped when the host already applied no viewport transform', () => {
    const { ctx, calls } = mockCtx();
    const viewport = new Viewport(100, 100);
    const renderer = new Canvas2DRenderer(ctx, viewport, { applyViewportTransform: false });
    const b = new RenderModelBuilder(100, 100);
    b.begin();
    b.text(10, 20, 'SCORE', { baseline: 'top' });
    renderer.draw(b.end());
    // No global flip to undo → paint at the raw anchor, baseline unchanged.
    expect(calls).toContain('fillText(SCORE,10,20)');
    expect(calls.some((c) => c.startsWith('scale('))).toBe(false);
    expect(ctx.textBaseline).toBe('top');
  });

  it('prefixes the whole transform by pixelRatio to land in the device backing store', () => {
    const { ctx, calls } = mockCtx();
    const viewport = new Viewport(100, 100);
    viewport.resize(200, 100); // letterbox: scale 1, offsetX 50, offsetY 0
    const renderer = new Canvas2DRenderer(ctx, viewport, { pixelRatio: 2 });
    const b = new RenderModelBuilder(100, 100);
    b.begin();
    renderer.draw(b.end());
    // ADR-0011 §3: fit is CSS px; scale *and* both translation terms scale by dpr.
    expect(calls[1]).toBe('setTransform(2,0,0,-2,100,200)');
  });

  it('never leaks an unbalanced save/restore', () => {
    const { renderer, calls } = makeRenderer();
    const b = new RenderModelBuilder(100, 100);
    b.begin();
    b.rect(0, 0, 1, 1, { fill: '#fff' });
    b.circle(0, 0, 1, { fill: '#fff' });
    b.text(0, 0, 'x');
    renderer.draw(b.end());
    const saves = calls.filter((c) => c === 'save()').length;
    const restores = calls.filter((c) => c === 'restore()').length;
    // Text now carries its own local pair (ADR-0011 §4.2.4), so >1 each…
    expect(saves).toBeGreaterThan(1);
    // …but every save is still matched by a restore.
    expect(saves).toBe(restores);
  });

  // ── WXG-T-132 / ADR-0014：全局变换消费 ────────────────────────────

  it('composes the frame transform after the fit matrix, before the background', () => {
    const { renderer, calls } = makeRenderer();
    const b = new RenderModelBuilder(100, 100);
    b.begin('#101010');
    b.setTransform(1.015, 50, 50);
    b.rect(0, 0, 1, 1, { fill: '#fff' });
    renderer.draw(b.end());
    const bg = calls.indexOf('fillRect(0,0,100,100)');
    expect(calls[0]).toBe('save()');
    expect(calls[1]).toBe('setTransform(1,0,0,-1,0,100)'); // fit 先（dpr 1）
    expect(calls[2]).toBe('translate(50,50)');
    expect(calls[3]).toBe('scale(1.015,1.015)');
    expect(calls[4]).toBe('translate(-50,-50)');
    expect(bg).toBe(5); // 背景参与变换（零黑边结论的承重前提，ADR-0014 §3.2）
    expect(calls[calls.length - 1]).toBe('restore()');
  });

  it('takes the exact old path when the model has no transform', () => {
    const { renderer, calls } = makeRenderer();
    const b = new RenderModelBuilder(100, 100);
    b.begin();
    b.rect(0, 0, 1, 1, { fill: '#fff' });
    renderer.draw(b.end());
    // 无文本 ⇒ 全局变换之外不应出现任何 scale/translate 调用。
    expect(calls.filter((c) => c.startsWith('scale(') || c.startsWith('translate('))).toEqual([]);
  });
});
