import { describe, expect, it } from 'vitest';
import { CocosRenderModelRenderer } from '../../src/adapters/cocos/cocos-renderer.js';
import { PooledLabelSource } from '../../src/adapters/cocos/label-pool.js';
import { Viewport } from '../../src/core/render/viewport.js';
import { RenderModelBuilder } from '../../src/core/render/render-model.js';

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

function fakeLabels() {
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
      };
    },
  });
  return { source, created };
}

const colors = {
  fromHex: (hex: string, alpha = 1) => {
    const h = hex.replace('#', '');
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: Math.round(alpha * 255) };
  },
};

function makeSetup() {
  const { g, calls } = fakeGraphics();
  const { source, created } = fakeLabels();
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
});
