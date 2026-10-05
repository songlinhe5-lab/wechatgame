import { describe, expect, it, vi } from 'vitest';
import { CocosRenderModelRenderer, parseColorLiteral } from '../../src/adapters/cocos/cocos-renderer.js';
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
const colors = {
  fromHex: (hex: string, alpha = 1) => {
    const c = parseColorLiteral(hex);
    return {
      r: c.r,
      g: c.g,
      b: c.b,
      a: Math.round(Math.min(1, Math.max(0, c.a * alpha)) * 255),
    };
  },
};

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
