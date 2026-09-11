import { describe, expect, it } from 'vitest';
import { RenderModelBuilder } from '../../src/core/render/render-model.js';

describe('RenderModelBuilder', () => {
  it('starts empty and records the design size', () => {
    const b = new RenderModelBuilder(750, 1334);
    const model = b.end();
    expect(model.designWidth).toBe(750);
    expect(model.designHeight).toBe(1334);
    expect(model.commands).toEqual([]);
  });

  it('emits rect/circle/line/text/polygon commands', () => {
    const b = new RenderModelBuilder(100, 100);
    b.begin('#000');
    b.rect(0, 0, 10, 10, { fill: '#fff', radius: 2 });
    b.circle(5, 5, 3, { fill: '#f00' });
    b.line(0, 0, 10, 10, '#0f0', 2);
    b.text(1, 2, 'hi', { align: 'center' });
    b.polygon([0, 0, 10, 0, 5, 10], { fill: '#00f' });
    const model = b.end();
    expect(model.background).toBe('#000');
    expect(model.commands.map((c) => c.kind)).toEqual([
      'rect',
      'circle',
      'line',
      'text',
      'polygon',
    ]);
  });

  it('omits the background when unset', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    expect('background' in b.end()).toBe(false);
  });

  it('begin() clears previous commands', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    b.rect(0, 0, 1, 1, { fill: '#fff' });
    expect(b.count).toBe(1);
    b.begin();
    expect(b.count).toBe(0);
    expect(b.end().commands).toEqual([]);
  });

  it('supports setBackground and resize', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    b.setBackground('#123456');
    b.resize(200, 300);
    const model = b.end();
    expect(model.background).toBe('#123456');
    expect(model.designWidth).toBe(200);
    expect(model.designHeight).toBe(300);
  });

  it('freezes the produced model and its command list', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    b.circle(0, 0, 1, { fill: '#fff' });
    const model = b.end();
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.commands)).toBe(true);
  });

  it('returns a snapshot independent of later mutations', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    b.circle(0, 0, 1, { fill: '#fff' });
    const first = b.end();
    b.begin();
    b.circle(9, 9, 2, { fill: '#000' });
    expect(first.commands).toHaveLength(1);
    expect((first.commands[0] as { x: number }).x).toBe(0);
  });

  it('passes through optional alpha on every primitive', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    b.rect(0, 0, 1, 1, { fill: '#fff', alpha: 0.5 });
    b.circle(0, 0, 1, { fill: '#fff', alpha: 0.25 });
    b.line(0, 0, 1, 1, '#fff', 1, 0.75);
    b.text(0, 0, 'x', { alpha: 0.1 });
    b.polygon([0, 0, 1, 1, 2, 0], { fill: '#fff', alpha: 0.9 });
    const model = b.end();
    expect(model.commands.map((c) => (c as { alpha?: number }).alpha)).toEqual([
      0.5, 0.25, 0.75, 0.1, 0.9,
    ]);
  });
});
