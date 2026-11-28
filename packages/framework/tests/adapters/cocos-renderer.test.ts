import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CocosRenderModelRenderer, createColorFactory, parseColorLiteral } from '../../src/adapters/cocos/cocos-renderer.js';
import { PooledLabelSource } from '../../src/adapters/cocos/label-pool.js';
import { Viewport } from '../../src/core/render/viewport.js';
import { RenderModelBuilder } from '../../src/core/render/render-model.js';
import type { BlitCommand } from '../../src/core/render/render-model.js';

function fakeGraphics() {
  const calls: string[] = [];
  const state = {
    fill: { r: 0, g: 0, b: 0, a: 255 },
    stroke: { r: 0, g: 0, b: 0, a: 255 },
    lineWidth: 0,
  };
  const g = {
    get fillColor() {
      return state.fill;
    },
    set fillColor(v: { r: number; g: number; b: number; a: number }) {
      state.fill = v;
    },
    get strokeColor() {
      return state.stroke;
    },
    set strokeColor(v: { r: number; g: number; b: number; a: number }) {
      state.stroke = v;
    },
    get lineWidth() {
      return state.lineWidth;
    },
    set lineWidth(v: number) {
      state.lineWidth = v;
    },
    clear: () => calls.push('clear'),
    rect: (x: number, y: number, w: number, h: number) => calls.push(`rect(${x},${y},${w},${h})`),
    roundRect: (x: number, y: number, w: number, h: number, r: number) =>
      calls.push(`roundRect(${x},${y},${w},${h},${r})`),
    circle: (x: number, y: number, r: number) => calls.push(`circle(${x},${y},${r})`),
    moveTo: (x: number, y: number) => calls.push(`moveTo(${x},${y})`),
    lineTo: (x: number, y: number) => calls.push(`lineTo(${x},${y})`),
    close: () => calls.push('close'),
    fill: () => calls.push('fill'),
    stroke: () => calls.push('stroke'),
  };
  return { g, calls, state };
}

function fakeLabels(measure?: (text: string, fontSize: number) => number) {
  const created: {
    text: string;
    x: number;
    y: number;
    size: number;
    color: { r: number; g: number; b: number; a: number };
    align: string;
    visible: boolean;
  }[] = [];
  const source = new PooledLabelSource({
    initial: 0,
    create: () => {
      const rec = { text: '', x: 0, y: 0, size: 0, color: { r: 0, g: 0, b: 0, a: 0 }, align: '', visible: false };
      created.push(rec);
      return {
        setText: (t: string) => {
          rec.text = t;
        },
        setPosition: (x: number, y: number) => {
          rec.x = x;
          rec.y = y;
        },
        setFontSize: (s: number) => {
          rec.size = s;
        },
        setColor: (c: { r: number; g: number; b: number; a: number }) => {
          rec.color = c;
        },
        setAlign: (a: string) => {
          rec.align = a;
        },
        setVisible: (v: boolean) => {
          rec.visible = v;
        },
        ...(measure ? { measureWidth: (t: string, s: number) => measure(t, s) } : {}),
      };
    },
  });
  return { source, created };
}

// BD-50 判例：mock 必须走与宿主同一条解析（parseColorLiteral），不得再手抄 hex-only 缺陷实现。
const colors = createColorFactory((r, g, b, a) => ({ r, g, b, a }));

function makeSetup(measure?: (text: string, fontSize: number) => number) {
  const { g, calls } = fakeGraphics();
  const { source, created } = fakeLabels(measure);
  const viewport = new Viewport(200, 400);
  viewport.resize(200, 400);
  const renderer = new CocosRenderModelRenderer(g, source, colors, viewport);
  return { g, calls, source, created, renderer };
}

describe('CocosRenderModelRenderer', () => {
  it('clears the graphics each frame', () => {
    const { renderer, calls } = makeSetup();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    renderer.draw(b.end());
    expect(calls[0]).toBe('clear');
  });

  it('offsets design-space coordinates to the centred Cocos origin', () => {
    const { renderer, calls } = makeSetup(); // design 200x400 → offset (-100, -200)
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.rect(0, 0, 10, 10, { fill: '#ffffff' });
    b.circle(50, 100, 5, { fill: '#ffffff' });
    renderer.draw(b.end());
    expect(calls).toContain('rect(-100,-200,10,10)');
    expect(calls).toContain('circle(-50,-100,5)');
  });

  it('can disable the centred-origin conversion', () => {
    const { g, calls } = fakeGraphics();
    const { source } = fakeLabels();
    const viewport = new Viewport(200, 400);
    const renderer = new CocosRenderModelRenderer(g, source, colors, viewport, {
      convertToCenteredOrigin: false,
    });
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.circle(50, 100, 5, { fill: '#ffffff' });
    renderer.draw(b.end());
    expect(calls).toContain('circle(50,100,5)');
  });

  // [WXG-T-252 / ADR-0030 DEC-2] blit 只能「交出」，不能在本 adapter 里落地。
  // 这三条就是 DEC-2 的验收判据：注入必交接 / 未注入零绘制调用 + warn 一次 /
  // [WXG-T-253] 帧边界逐帧告知（钩子可选：不实现的载体零调用）。
  it('hands every blit to an injected carrier, passing the command through untouched', () => {
    const { g, calls } = fakeGraphics();
    const { source } = fakeLabels();
    const viewport = new Viewport(200, 400);
    const taken: { cmd: BlitCommand; x: number; y: number }[] = [];
    let frames = 0;
    const renderer = new CocosRenderModelRenderer(g, source, colors, viewport, {
      blitCarrier: {
        accept: (cmd: BlitCommand, x: number, y: number) => {
          taken.push({ cmd, x, y });
        },
        beginFrame: () => {
          frames++;
        },
      },
    });
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.blit('bead-0', 10, 20, 30, 30);
    const model = b.end();
    renderer.draw(model);
    // 零拷贝：交出的就是原命令对象（fx 槽在内，渲染器不拆不辨）。
    expect(taken.length).toBe(1);
    expect(taken[0]!.cmd).toBe(model.commands[0]);
    // 坐标走与其他分支同一套居中换算（design 200x400 → offset (-100, -200)）。
    expect(taken[0]!.x).toBe(-90);
    expect(taken[0]!.y).toBe(-180);
    // blit 完全不碰 Graphics。
    expect(calls).toEqual(['clear']);
    // 帧边界：每调一次 `draw()` 告知一次，且在本帧第一条命令之前（S5′-1 靠它收节点）。
    expect(frames).toBe(1);
    renderer.draw(model);
    expect(frames).toBe(2);
    expect(taken.length).toBe(2);
  });

  it('keeps warn-once skip when no carrier is injected', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
    const { renderer, calls } = makeSetup();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.blit('bead-0', 10, 20, 30, 30);
    const model = b.end();
    renderer.draw(model);
    renderer.draw(model);
    expect(calls).toEqual(['clear', 'clear']);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('prefers roundRect when a radius is supplied', () => {
    const { renderer, calls } = makeSetup();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.rect(0, 0, 20, 20, { fill: '#ffffff', radius: 6 });
    renderer.draw(b.end());
    expect(calls.some((c) => c.startsWith('roundRect('))).toBe(true);
  });

  it('emits fill and stroke for painted shapes', () => {
    const { renderer, calls, g } = makeSetup();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.rect(0, 0, 4, 4, { fill: '#ff0000', stroke: '#00ff00', lineWidth: 3 });
    renderer.draw(b.end());
    expect(calls).toContain('fill');
    expect(calls).toContain('stroke');
    expect(g.lineWidth).toBe(3);
    expect(g.fillColor).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(g.strokeColor).toEqual({ r: 0, g: 255, b: 0, a: 255 });
  });

  it('carries alpha into the colour channel', () => {
    const { renderer, g } = makeSetup();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.rect(0, 0, 4, 4, { fill: '#ffffff', alpha: 0.5 });
    renderer.draw(b.end());
    expect(g.fillColor.a).toBe(128);
  });

  it('draws lines and polygons through moveTo/lineTo', () => {
    const { renderer, calls } = makeSetup();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.line(0, 0, 10, 10, '#ffffff', 1);
    b.polygon([0, 0, 10, 0, 5, 10], { fill: '#ffffff' });
    renderer.draw(b.end());
    expect(calls).toContain('moveTo(-100,-200)');
    expect(calls).toContain('lineTo(-90,-190)');
    expect(calls).toContain('close');
  });

  it('skips degenerate polygons', () => {
    const { renderer, calls } = makeSetup();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.polygon([0, 0], { fill: '#ffffff' });
    renderer.draw(b.end());
    expect(calls.some((c) => c.startsWith('close'))).toBe(false);
  });

  /**
   * ADR-0024 §6-J5「迁移前后行为逐字不变」的 **adapter 侧取证**（加严，非 ADR 字面清单）：
   * §11.2 的 SVG 逐字节对拍读的是 `RenderModel`，**不经过**任何 adapter ⇒ 循环边界与门限
   * 的等价性必须在此钉住，否则「迁完仍全绿」可以是假绿。
   * 红法：① 把 `for (k = 1; k < count; …)` 写错（起点/终点差一个顶点）⇒ `toEqual` 当场红；
   *      ② 退回「按引用存 points」⇒ 第二枚复用 scratch 时第一枚跟着变形 ⇒ 同样红；
   *      ③ 把 skip 门从 `count < 2` 改成 `count < 3` ⇒ 奇数长度那条（2 顶点）少画 ⇒ 红；
   *      ④ skip 判定挪到 `moveTo` 之后 ⇒ 末条不会出现 ⇒ 红。
   */
  it('emits the exact vertex sequence for polygons sharing one scratch array (ADR-0024 J-5)', () => {
    const { renderer, calls } = makeSetup();
    const b = new RenderModelBuilder(200, 400);
    const scratch: number[] = [0, 0, 10, 0, 5, 10];
    b.begin();
    b.polygon(scratch, { fill: '#ffffff' });
    for (let k = 0; k < 6; k += 1) scratch[k] += 20; // 复用同一数组（旧契约下会串形）
    b.polygon(scratch, { fill: '#ffffff' });
    b.polygon([1, 1, 2, 2, 3], { fill: '#ffffff' }); // 奇数长度 ⇒ 尾浮点被丢弃，2 顶点照画
    b.polygon([4, 4, 5], { fill: '#ffffff' }); // count = 1 ⇒ skip（旧 length 3 < 4 同结论）
    renderer.draw(b.end());
    expect(calls.filter((c) => /^(moveTo|lineTo|close)/.test(c))).toEqual([
      'moveTo(-100,-200)', 'lineTo(-90,-200)', 'lineTo(-95,-190)', 'close',
      'moveTo(-80,-180)', 'lineTo(-70,-180)', 'lineTo(-75,-170)', 'close',
      'moveTo(-99,-199)', 'lineTo(-98,-198)', 'close',
    ]);
  });

  it('positions text labels and reports the label count', () => {
    const { renderer, created } = makeSetup();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.text(20, 30, 'SCORE', { fill: '#ffff00', font: '18px sans', align: 'center' });
    renderer.draw(b.end());
    const label = created[0]!;
    expect(label.text).toBe('SCORE');
    expect(label.size).toBe(18);
    expect(label.visible).toBe(true);
    expect(label.color).toEqual({ r: 255, g: 255, b: 0, a: 255 });
    expect(renderer.lastLabelCount).toBe(1);
  });

  it('[WXG-T-604] 文字投影：多借一枚标签画偏移副本（影子先创建 = 先绘制）', () => {
    const { renderer, created } = makeSetup();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.text(20, 30, 'S', {
      fill: '#ffffff',
      font: '20px sans',
      align: 'center',
      shadow: { color: '#000000', offsetX: 9, offsetY: -7 },
    });
    renderer.draw(b.end());
    expect(renderer.lastLabelCount).toBe(2);
    // 中心原点换算 ox/oy = (-100,-200)：影子 (29,23)、主字 (20,30)。
    expect(created[0]).toMatchObject({ text: 'S', x: -71, y: -177, visible: true });
    expect(created[1]).toMatchObject({ text: 'S', x: -80, y: -170, visible: true });
    expect(created[0]!.color).not.toEqual(created[1]!.color);
  });

  it('reuses pooled labels across frames (no unbounded growth)', () => {
    const { renderer, created } = makeSetup();
    for (let frame = 0; frame < 5; frame++) {
      const b = new RenderModelBuilder(200, 400);
      b.begin();
      b.text(0, 0, 'A', { fill: '#fff' });
      b.text(0, 10, 'B', { fill: '#fff' });
      renderer.draw(b.end());
    }
    expect(created.length).toBe(2); // 2 labels total, reused 5x
  });

  it('hides labels that are no longer used', () => {
    const { renderer, created } = makeSetup();
    const withText = new RenderModelBuilder(200, 400);
    withText.begin();
    withText.text(0, 0, 'A', { fill: '#fff' });
    renderer.draw(withText.end());
    expect(created[0]!.visible).toBe(true);

    const empty = new RenderModelBuilder(200, 400);
    empty.begin();
    renderer.draw(empty.end());
    expect(created[0]!.visible).toBe(false);
    expect(renderer.lastLabelCount).toBe(0);
  });

  // ── BD-50（裁定②排障 · WXG-T-156）：rgba() 字面量在 Cocos 色彩工厂被解析成纯黑 ──
  it('parses rgba() fill strings, keeping channels and embedded alpha (BD-50)', () => {
    const { renderer, g } = makeSetup();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.polygon([0, 0, 10, 0, 5, 10], { fill: 'rgba(63,191,107,0.42)' });
    renderer.draw(b.end());
    expect(g.fillColor.r).toBe(63);
    expect(g.fillColor.g).toBe(191);
    expect(g.fillColor.b).toBe(107);
    expect(g.fillColor.a).toBe(Math.round(0.42 * 255));
  });

  it('multiplies embedded alpha with the command alpha (canvas2d globalAlpha parity)', () => {
    const { renderer, g } = makeSetup();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.rect(0, 0, 4, 4, { fill: 'rgba(255,255,255,0.5)', alpha: 0.5 });
    renderer.draw(b.end());
    expect(g.fillColor.a).toBe(Math.round(0.25 * 255));
  });

  it('parses #rgb / #rrggbb / rgb() and rejects garbage without NaN channels', () => {
    expect(parseColorLiteral('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColorLiteral('#FFD23F')).toEqual({ r: 255, g: 210, b: 63, a: 1 });
    expect(parseColorLiteral('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30, a: 1 });
    const bad = parseColorLiteral('not-a-color');
    expect(bad).toEqual({ r: 0, g: 0, b: 0, a: 1 }); // 与旧行为一致的黑底兜底，但绝不再 NaN
  });

  it('颜色工厂按色串与量化后的 alpha 缓存，同一档复用同一实例', () => {
    let created = 0;
    const f = createColorFactory((r, g, b, a) => {
      created += 1;
      return { r, g, b, a };
    });
    const first = f.fromHex('#FFD23F', 0.501);
    expect(first).toEqual({ r: 255, g: 210, b: 63, a: Math.round(0.501 * 255) });
    expect(f.fromHex('#FFD23F', 0.502), '同一 8-bit alpha 档应复用').toBe(first);
    expect(created).toBe(1);
    expect(f.fromHex('rgba(255,255,255,0.5)', 0.5)).toEqual({
      r: 255, g: 255, b: 255, a: Math.round(0.25 * 255),
    });
    expect(created).toBe(2);
    for (let i = 0; i <= 1000; i += 1) f.fromHex('#fff', i / 1000);
    expect(created, 'alpha 必须量化到 8-bit，缓存不能随浮点帧数无界增长').toBeLessThanOrEqual(258);
  });

  // ── G3 可测半（WXG-T-077）：`_anchorForText` 消费宿主注入的实测宽度 ──
  it('nudges left/right text by the host-measured width, symmetrically (G3)', () => {
    // 注入一个与 0.55 不同斜率的测量出口；若渲染器真消费它，偏移应与降级值不同。
    const seen: [string, number][] = [];
    const { renderer, created } = makeSetup((t, s) => {
      seen.push([t, s]);
      return t.length * s * 0.6; // 'ABCD' @20px → 48
    });
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.text(10, 30, 'ABCD', { fill: '#fff', font: '20px sans', align: 'left' });
    b.text(10, 60, 'ABCD', { fill: '#fff', font: '20px sans', align: 'right' });
    renderer.draw(b.end());

    const half = (4 * 20 * 0.6) / 2; // 24
    // design→centered: ox = -100（viewport 200x400）。左对齐右移 half，右对齐左移 half。
    expect(created[0]!.x).toBeCloseTo(10 + half - 100);
    expect(created[1]!.x).toBeCloseTo(10 - half - 100);
    expect(created[0]!.x - created[1]!.x).toBeCloseTo(2 * half); // 严格对称
    // 测量入参为原文与解析后的字号（验证字号解析喂入测量）。
    expect(seen).toEqual([
      ['ABCD', 20],
      ['ABCD', 20],
    ]);
  });

  it('falls back to the character estimate when the host injects no measurement (G3 open)', () => {
    const { renderer, created } = makeSetup(); // 无 measureWidth
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.text(10, 30, 'ABCD', { fill: '#fff', font: '20px sans', align: 'left' });
    renderer.draw(b.end());
    const estHalf = (4 * 20 * 0.55) / 2; // 22
    expect(created[0]!.x).toBeCloseTo(10 + estHalf - 100);
    // 与实测路径（10+24-100=-66）不同，证明两分支选型正确。
    expect(created[0]!.x).not.toBeCloseTo(10 + 24 - 100);
  });

  // ── `[WXG-T-1118]` 文本通道：居中不测宽、同文本同字号按 label 缓存 ──
  it('居中文字不测宽（偏移恒 0，测量是死计算）', () => {
    const seen: string[] = [];
    const { renderer, created } = makeSetup((t, s) => {
      seen.push(`${t}@${s}`);
      return t.length * s * 0.6;
    });
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.text(100, 30, 'ABCD', { fill: '#fff', font: '20px sans', align: 'center' });
    renderer.draw(b.end());
    expect(seen).toEqual([]);
    expect(created[0]!.x).toBeCloseTo(100 - 100); // x 原样（只做居中换算）
  });

  it('同文本同字号跨帧只问宿主一次（缓存），文本变才重测', () => {
    const seen: string[] = [];
    const { renderer, created } = makeSetup((t, s) => {
      seen.push(`${t}@${s}`);
      return t.length * s * 0.6;
    });
    const draw = (label: string) => {
      const b = new RenderModelBuilder(200, 400);
      b.begin();
      b.text(10, 30, label, { fill: '#fff', font: '20px sans', align: 'left' });
      renderer.draw(b.end());
    };
    draw('ABCD');
    draw('ABCD'); // 同标签复用同一池位 ⇒ 命中缓存，不再回问宿主
    expect(seen).toEqual(['ABCD@20']);
    // 缓存命中不影响版式：两帧锚点一致。
    const half = (4 * 20 * 0.6) / 2;
    expect(created[0]!.x).toBeCloseTo(10 + half - 100);
    draw('ABCDE'); // 文本变 ⇒ 重测一次
    expect(seen).toEqual(['ABCD@20', 'ABCDE@20']);
  });
});

// ── WXG-T-132 / ADR-0014：transformHost 逐帧幂等分派 ──────────────────

describe('CocosRenderModelRenderer transformHost', () => {
  function makeHosted() {
    const { g, calls } = fakeGraphics();
    const { source, created } = fakeLabels();
    const hostCalls: string[] = [];
    const viewport = new Viewport(200, 400);
    viewport.resize(200, 400);
    const renderer = new CocosRenderModelRenderer(g, source, colors, viewport, {
      transformHost: {
        applyFrameTransform: (s, ax, ay) => hostCalls.push(`apply(${s},${ax},${ay})`),
        resetFrameTransform: () => hostCalls.push('reset'),
      },
    });
    return { g, calls, created, hostCalls, renderer };
  }

  it('dispatches applyFrameTransform with scale + design anchor on transform frames', () => {
    const { renderer, hostCalls } = makeHosted();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.setTransform(1.015, 100, 200);
    b.rect(0, 0, 10, 10, { fill: '#fff' });
    renderer.draw(b.end());
    expect(hostCalls).toEqual(['apply(1.015,100,200)']);
  });

  it('resets to identity on the very next transform-free frame (no stale scale)', () => {
    const { renderer, hostCalls } = makeHosted();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.setTransform(1.015, 100, 200);
    renderer.draw(b.end());
    b.begin();
    b.rect(0, 0, 10, 10, { fill: '#fff' });
    renderer.draw(b.end());
    expect(hostCalls).toEqual(['apply(1.015,100,200)', 'reset']);
  });

  it('dispatches only the idempotent reset when the model carries no transform', () => {
    const { renderer, hostCalls } = makeHosted();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.rect(0, 0, 10, 10, { fill: '#fff' });
    renderer.draw(b.end());
    // 未接宿主的调用方（breakout）路径不变：无 host 时构造不报错（makeSetup 未传），
    // 有 host 但无变换 ⇒ 只应看到幂等 reset。
    expect(hostCalls).toEqual(['reset']);
  });
});

// ── WXG-T-256 / ADR-0030 S5′-3→S5′-4：底图提交体（`backGraphics`）─────────────
//
// Cocos 只有 `Graphics` 一个提交体时，blit 载体整层压在它下面 ⇒ 「桌面」（面板底/内阴影）
// 会把 sprite 珠子整块盖掉（托盘实测只剩接触影）。本组钉的是路由本身：
// 带 `back` 的 rect/line 必进底图体，其余一律留在主层，未注入的宿主逐字节等价于旧行为。
describe('CocosRenderModelRenderer backGraphics（底图通道）', () => {
  function makeLayered() {
    const main = fakeGraphics();
    const back = fakeGraphics();
    const { source } = fakeLabels();
    const viewport = new Viewport(200, 400);
    viewport.resize(200, 400);
    const renderer = new CocosRenderModelRenderer(main.g, source, colors, viewport, {
      backGraphics: back.g,
    });
    return { main, back, renderer };
  }

  it('routes back-marked rect/line to the bottom layer and keeps the rest on Graphics', () => {
    const { main, back, renderer } = makeLayered();
    const b = new RenderModelBuilder(200, 400);
    b.begin('#ffffff');
    b.rect(0, 0, 10, 10, { fill: '#fff', radius: 18, back: true }); // 托盘面板底
    b.line(0, 0, 10, 0, '#000000', 2, undefined, true); // 白瓷内阴影
    b.rect(20, 20, 10, 10, { fill: '#fff' }); // HUD
    b.line(0, 100, 10, 100, '#000000', 1); // HUD 描边
    renderer.draw(b.end());
    // 底图层：全屏底色 rect + 面板（走 roundRect）+ 内阴影线，⛔ 不得混进 HUD。
    expect(back.calls).toEqual([
      'clear',
      'rect(-100,-200,200,400)',
      'fill',
      'roundRect(-100,-200,10,10,18)',
      'fill',
      'moveTo(-100,-200)',
      'lineTo(-90,-200)',
      'stroke',
    ]);
    // 主层：只剩 HUD（坐标同源）。
    expect(main.calls).toEqual(['clear', 'rect(-80,-180,10,10)', 'fill', 'moveTo(-100,-100)', 'lineTo(-90,-100)', 'stroke']);
  });

  it('falls back to the main Graphics when the host injects no backGraphics', () => {
    const { renderer, calls } = makeSetup();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.rect(0, 0, 10, 10, { fill: '#fff', back: true });
    renderer.draw(b.end());
    expect(calls).toContain('rect(-100,-200,10,10)');
  });
});

// `[WXG-T-1122]` tile 之上、珠之下的中间矢量层：抬起影靠它压在珠位图下面，
// ⛔ 不改 `back`（会被不透明底 tile 吃掉）；carrier off 的宿主仍走主 Graphics。
describe('CocosRenderModelRenderer tileOverlayGraphics（中间矢量通道）', () => {
  const frame = () => {
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.polygon([0, 0, 10, 0, 10, 10], { fill: '#000000', overTiles: true });
    return b.end();
  };
  const emptyFrame = () => {
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    return b.end();
  };

  function make(withCarrier: boolean) {
    const main = fakeGraphics();
    const overlay = fakeGraphics();
    const { source } = fakeLabels();
    const viewport = new Viewport(200, 400);
    viewport.resize(200, 400);
    const renderer = new CocosRenderModelRenderer(main.g, source, colors, viewport, {
      tileOverlayGraphics: overlay.g,
      ...(withCarrier ? { blitCarrier: { accept: () => {}, beginFrame: () => {}, endFrame: () => {} } } : {}),
    });
    return { mainCalls: main.calls, overlayCalls: overlay.calls, renderer };
  }

  it('有载体 ⇒ overTiles polygon 落中间层，主层不画', () => {
    const s = make(true);
    s.renderer.draw(frame());
    expect(s.overlayCalls).toContain('moveTo(-100,-200)');
    expect(s.mainCalls.filter((c) => c.startsWith('moveTo'))).toHaveLength(0);
  });

  it('抬起结束后中间层清屏一次，随后连续空帧不再重复清屏', () => {
    const s = make(true);
    s.renderer.draw(frame());
    expect(s.overlayCalls.filter((c) => c.startsWith('moveTo'))).toHaveLength(1);
    s.renderer.draw(emptyFrame());
    s.renderer.draw(emptyFrame());
    expect(s.overlayCalls.filter((c) => c === 'clear'), '只在上一帧写过影时清一次').toHaveLength(1);
    expect(s.overlayCalls.filter((c) => c.startsWith('moveTo')), '空帧不得留下旧影').toHaveLength(1);
  });

  it('静态守卫：中间层清屏必须由“上一帧写过”标志门控', () => {
    const src = readFileSync(new URL('../../src/adapters/cocos/cocos-renderer.ts', import.meta.url), 'utf8');
    expect(src).toContain('if (this._tileOverlayUsed && this._tileOverlay) this._tileOverlay.clear();');
    expect(src).not.toContain('if (this._blitCarrier && this._tileOverlay) this._tileOverlay.clear();');
    expect(src).toContain('this._tileOverlayUsed = true;');
  });

  it('无载体 ⇒ 回落主层（carrier off 逐字节不变）', () => {
    const s = make(false);
    s.renderer.draw(frame());
    expect(s.mainCalls).toContain('moveTo(-100,-200)');
    expect(s.overlayCalls.filter((c) => c.startsWith('moveTo'))).toHaveLength(0);
  });
});

// ── WXG-T-1112：载体帧边界 beginFrame / endFrame 配对 ────────────────────────
describe('CocosRenderModelRenderer 载体 endFrame', () => {
  function makeWithCarrier() {
    const { g } = fakeGraphics();
    const { source } = fakeLabels();
    const viewport = new Viewport(200, 400);
    const events: string[] = [];
    const renderer = new CocosRenderModelRenderer(g, source, colors, viewport, {
      blitCarrier: {
        accept: () => { events.push('accept'); },
        beginFrame: () => { events.push('begin'); },
        endFrame: () => { events.push('end'); },
      },
    });
    return { renderer, events };
  }

  it('一次 draw 恰好 begin→accept→end 各按序一次（差分复用契约）', () => {
    const { renderer, events } = makeWithCarrier();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.rect(0, 0, 10, 10, { fill: '#fff' });
    b.blit('tex', 0, 0, 10, 10);
    b.blit('tex', 5, 0, 10, 10);
    renderer.draw(b.end());
    expect(events).toEqual(['begin', 'accept', 'accept', 'end']);
    // 再来一帧：begin 重置 → end 收尾，事件序列同形（载体据此外推差分）。
    const b2 = new RenderModelBuilder(200, 400);
    b2.begin();
    renderer.draw(b2.end());
    expect(events.slice(4)).toEqual(['begin', 'end']);
  });

  it('载体未实现 endFrame ⇒ draw 末尾零调用（可选契约，旧行为逐字节不变）', () => {
    const { g } = fakeGraphics();
    const { source } = fakeLabels();
    const viewport = new Viewport(200, 400);
    const events: string[] = [];
    const renderer = new CocosRenderModelRenderer(g, source, colors, viewport, {
      blitCarrier: { accept: () => { events.push('accept'); } },
    });
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    renderer.draw(b.end());
    expect(events).toEqual([]);
  });
});

// ── WXG-T-1111：分段计时探针（矢量 / 位图 / 文字 / 其余）────────────────────
describe('CocosRenderModelRenderer 分段计时', () => {
  function setup() {
    let t = 0;
    let reads = 0;
    const clock = (): number => {
      reads += 1;
      t += 2; // 每次读表前进 2 ms ⇒ 每条命令的耗时恰好 2 ms（可机检）
      return t;
    };
    const { g } = fakeGraphics();
    const { source } = fakeLabels();
    const viewport = new Viewport(200, 400);
    const accepted: string[] = [];
    const renderer = new CocosRenderModelRenderer(g, source, colors, viewport, {
      clock,
      blitCarrier: { accept: () => { accepted.push('blit'); } },
    });
    return { renderer, reads: () => reads, accepted };
  }

  it('未开 measureBreakdown ⇒ clock 一次都不读，分段全 0（release 零开销）', () => {
    const { renderer, reads } = setup();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.rect(0, 0, 10, 10, { fill: '#fff' });
    renderer.draw(b.end());
    expect(reads()).toBe(0);
    expect(renderer.lastBreakdown).toMatchObject({
      vectorMs: 0, blitMs: 0, textMs: 0, scopeMs: 0,
      vectorCalls: 0, blitCalls: 0, textCalls: 0,
    });
  });

  it('开后逐命令归类，四段之和 = 帧内卡表总量；下一帧重置', () => {
    const { renderer, reads, accepted } = setup();
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.beginContainer('probe');
    b.rect(0, 0, 10, 10, { fill: '#fff', stroke: '#000' });
    b.text(1, 2, 'x', { fill: '#fff' });
    b.blit('tex', 0, 0, 10, 10);
    b.endContainer();
    const model = b.end();

    renderer.measureBreakdown = true;
    renderer.draw(model);
    const before = reads();
    const d = renderer.lastBreakdown;
    // 帧首前后各 1 次 + 5 条命令 × 2 次 = 12 次读表；每段 2 ms。
    expect(before).toBe(12);
    expect(d).toMatchObject({
      vectorMs: 2, blitMs: 2, textMs: 2, scopeMs: 6,
      vectorCalls: 1, blitCalls: 1, textCalls: 1,
    });
    expect(d.vectorMs + d.blitMs + d.textMs + d.scopeMs).toBe(12);
    expect(accepted).toEqual(['blit']);

    // 同一对象逐帧覆写，不累积、不新建。
    const same = renderer.lastBreakdown;
    renderer.draw(model);
    expect(renderer.lastBreakdown).toBe(same);
    expect(renderer.lastBreakdown).toMatchObject({ vectorMs: 2, scopeMs: 6 });
  });
});

// `[WXG-T-1115]` Outline 静态层冻结协议：几何签名（back polygon 顶点/色哈希）相同 ⇒
// 不清屏、不重画，只把节点平移 `model.backPan`（引擎 setPosition 无等值短路 ⇒
// 渲染器自行等值门控）；签名变 ⇒ 解冻清屏重画一次。back 的 rect/line 冻结帧照画。
describe('CocosRenderModelRenderer Outline 静态层（WXG-T-1115）', () => {
  // viewport 200×400、居中原点 ⇒ ox=-100, oy=-200。
  function makeOutlineSetup() {
    const { g, calls } = fakeGraphics();
    const { source } = fakeLabels();
    const outlineRec = fakeGraphics();
    const positions: string[] = [];
    const outline = {
      ...outlineRec.g,
      node: { setPosition: (x: number, y: number, z?: number) => positions.push(`(${x},${y},${z ?? 0})`) },
    };
    const viewport = new Viewport(200, 400);
    viewport.resize(200, 400);
    const renderer = new CocosRenderModelRenderer(g, source, colors, viewport, { outlineGraphics: outline });
    return { g, calls, outlineCalls: outlineRec.calls, positions, renderer };
  }

  /** 一帧：一个 back polygon（可选 pan / 可选几何变体）。 */
  const frame = (pan: { x: number; y: number } | undefined, yBottom = 120) => {
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    if (pan) b.setBackPan(pan.x, pan.y);
    b.polygon([10, 100, 30, 100, 30, yBottom, 10, yBottom], { fill: '#111111', back: true });
    return b.end();
  };

  const clears = (cs: readonly string[]): number => cs.filter((c) => c === 'clear').length;
  const polys = (cs: readonly string[]): number => cs.filter((c) => c.startsWith('moveTo')).length;

  it('首帧重建；同几何换 pan ⇒ 冻结只平移节点；同 pan ⇒ 全免', () => {
    const s = makeOutlineSetup();
    s.renderer.draw(frame({ x: 0, y: 0 }));
    expect(s.outlineCalls).toContain('clear');
    expect(polys(s.outlineCalls)).toBe(1);
    // `[WXG-T-1116]` 顶点发**原始设计坐标**：居中偏移（ox/oy）只由节点位承担一次。
    // 两边都加 = 偏移算两遍 ⇒ 真机描边整层画到左下（本行即防复发的钉子）。
    expect(s.outlineCalls).toContain('moveTo(10,100)');
    expect(s.outlineCalls).not.toContain('moveTo(-90,-100)');
    expect(s.positions).toEqual(['(-100,-200,0)']);

    s.renderer.draw(frame({ x: 5, y: 0 }));
    expect(clears(s.outlineCalls)).toBe(1); // 不清屏
    expect(polys(s.outlineCalls)).toBe(1); // 不重画
    expect(s.positions).toEqual(['(-100,-200,0)', '(-95,-200,0)']);

    s.renderer.draw(frame({ x: 5, y: 0 }));
    expect(clears(s.outlineCalls)).toBe(1); // 同 pan：连节点位都不动
    expect(s.positions).toHaveLength(2);
  });

  it('几何变 ⇒ 解冻重建；无 backPan 的帧（菜单）走清屏路径且节点位回落 ox/oy', () => {
    const s = makeOutlineSetup();
    s.renderer.draw(frame({ x: 3, y: 4 }));
    s.renderer.draw(frame({ x: 3, y: 4 }, 130)); // 顶点变 ⇒ 签名变 ⇒ 重建
    expect(clears(s.outlineCalls)).toBe(2);
    expect(polys(s.outlineCalls)).toBe(2);
    expect(s.positions).toEqual(['(-97,-196,0)', '(-97,-196,0)']); // 重建帧重落同位

    s.renderer.draw(frame(undefined)); // 菜单帧：无 backPan、无 back poly ⇒ 清屏 + 回 (ox,oy)
    expect(clears(s.outlineCalls)).toBe(3);
    expect(s.positions).toEqual(['(-97,-196,0)', '(-97,-196,0)', '(-100,-200,0)']);
  });

  it('冻结帧里 back 的 rect/line 照画（回落主 Graphics，屏幕空间不随 pan）', () => {
    const s = makeOutlineSetup();
    s.renderer.draw(frame({ x: 0, y: 0 }));
    const mainBefore = s.calls.length;
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.setBackPan(0, 0);
    b.polygon([10, 100, 30, 100, 30, 120, 10, 120], { fill: '#111111', back: true }); // 同几何 ⇒ 冻结跳画
    b.rect(0, 0, 10, 10, { fill: '#222222', back: true }); // 屏幕 space 面板底：照画
    s.renderer.draw(b.end());
    expect(clears(s.outlineCalls)).toBe(1); // outline 不清屏
    expect(s.calls.length).toBeGreaterThan(mainBefore); // rect 落主 Graphics
    expect(s.calls).toContain('rect(-100,-200,10,10)');
  });
});
