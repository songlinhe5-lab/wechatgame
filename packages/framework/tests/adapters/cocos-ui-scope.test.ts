/**
 * UI-60 P0 · RenderModel 的「容器 + 段」两级语法与 Cocos 作用域映射
 * （正本 = `docs/architecture/adr/ADR-0033-ui-container-layer-ordering.md` DEC-1…5 / DEC-9）。
 *
 * 钉死四件事：
 *  ① 语法：`beginContainer` / `beginSegment` 落进指令流且保序，并被脏帧门控看见；
 *  ② 兼容：**未注入 scopeHost 的宿主**（breakout 与一切未接线场景）对新 kind 静默忽略，
 *     其余命令的绘制序列逐字不变 ⇒ P0 落地 = 真机零漂移；
 *  ③ 路由：注入 scopeHost 后，矢量与文字按**当前作用域**落笔，出容器回默认层
 *     （默认层就是今天的单层 `Graphics` / `Labels` / `BlitLayerUI`）；
 *  ④ DEC-5：Label 的 sibling 序 = **该作用域内**的帧内计数（不再随池历史漂移）。
 *
 * ⚠ `bindings.ts` 里的 cc 腿（真节点树）不在本文件覆盖范围——它需要编辑器/真机；
 *   设备侧层序读数按 ADR-0033 DEC-8 登记为 [R]，⛔ 不得据此宣称真机层级已修好。
 */

import { describe, expect, it } from 'vitest';
import {
  CocosRenderModelRenderer,
  parseColorLiteral,
  type CocosGraphicsLike,
  type CocosLabelSource,
  type CocosUiScopeHostLike,
  type CocosUiScopeLike,
} from '../../src/adapters/cocos/cocos-renderer.js';
import { PooledLabelSource } from '../../src/adapters/cocos/label-pool.js';
import { Viewport } from '../../src/core/render/viewport.js';
import { RenderModelBuilder } from '../../src/core/render/render-model.js';
import type { UiSegment } from '../../src/core/render/render-model.js';

const colors = {
  fromHex: (hex: string, alpha = 1) => {
    const c = parseColorLiteral(hex);
    return { r: c.r, g: c.g, b: c.b, a: Math.round(Math.min(1, Math.max(0, c.a * alpha)) * 255) };
  },
};

interface PaintSink {
  texts: string[];
  siblings: string[];
}

/** 记录落笔顺序的假 Graphics（与 cocos-renderer.test.ts 同形，只取本文件用得上的方法）。 */
function fakeGraphics(tag: string) {
  const calls: string[] = [];
  const state = { fill: { r: 0, g: 0, b: 0, a: 255 }, stroke: { r: 0, g: 0, b: 0, a: 255 }, lineWidth: 0 };
  const g = {
    get fillColor() { return state.fill; },
    set fillColor(v: typeof state.fill) { state.fill = v; },
    get strokeColor() { return state.stroke; },
    set strokeColor(v: typeof state.fill) { state.stroke = v; },
    get lineWidth() { return state.lineWidth; },
    set lineWidth(v: number) { state.lineWidth = v; },
    clear: () => { calls.push(`${tag}:clear`); },
    rect: (x: number, y: number, w: number, h: number) => { calls.push(`${tag}:rect(${x},${y},${w},${h})`); },
    circle: (x: number, y: number, r: number) => { calls.push(`${tag}:circle(${x},${y},${r})`); },
    moveTo: (x: number, y: number) => { calls.push(`${tag}:moveTo(${x},${y})`); },
    lineTo: (x: number, y: number) => { calls.push(`${tag}:lineTo(${x},${y})`); },
    close: () => { calls.push(`${tag}:close`); },
    fill: () => { calls.push(`${tag}:fill`); },
    stroke: () => { calls.push(`${tag}:stroke`); },
  } as unknown as CocosGraphicsLike;
  return { g, calls };
}

/** 记录 setText / setSiblingIndex 的假标签池（每作用域一份）。 */
function fakeLabelPool(tag: string, sink: PaintSink): CocosLabelSource {
  return new PooledLabelSource({
    initial: 0,
    create: () => ({
        setText: (t: string) => { sink.texts.push(`${tag}:${t}`); },
        setPosition: () => {},
        setFontSize: () => {},
        setColor: () => {},
        setAlign: () => {},
        setVisible: () => {},
        setSiblingIndex: (i: number) => { sink.siblings.push(`${tag}#${i}`); },
      }),
  });
}

interface FakeScope extends CocosUiScopeLike {
  readonly tag: string;
  readonly calls: string[];
}

/**
 * 假作用域宿主：语义与 `bindings.ts` 的真宿主一致——
 * 默认作用域 = 旧单层路径；`enterContainer` 开容器（未标段即归容器默认段）；
 * `enterSegment` 在其下再开段；`exitScope` 出栈；帧首清空所有层并归还标签。
 */
class FakeScopeHost implements CocosUiScopeHostLike {
  readonly defaultScope: FakeScope;
  readonly sink: PaintSink = { texts: [], siblings: [] };
  private readonly _scopes = new Map<string, FakeScope>();
  private readonly _stack: string[] = [];

  constructor() {
    this.defaultScope = this._make('default');
  }

  private _make(tag: string): FakeScope {
    const { g, calls } = fakeGraphics(tag);
    return { tag, graphics: g, labels: fakeLabelPool(tag, this.sink), calls };
  }

  private _enter(key: string): void {
    if (!this._scopes.has(key)) this._scopes.set(key, this._make(key));
    this._stack.push(key);
  }

  beginFrame(): void {
    this._stack.length = 0;
    this.sink.texts.length = 0;
    this.sink.siblings.length = 0;
    const all = [this.defaultScope, ...this._scopes.values()];
    for (const s of all) { s.calls.length = 0; s.labels.releaseAll(); }
  }

  enterContainer(id: string): void { this._enter(`c:${id}`); }

  enterSegment(segment: UiSegment): void {
    this._enter(`${this._stack[this._stack.length - 1] ?? 'default'}·${segment}`);
  }

  /** 本假宿主把段当作嵌套层（与 `UiScopeTree` 的「段挂在容器下」同序），两种退出都是出栈。 */
  exitSegment(): void { this._stack.pop(); }

  exitContainer(): void { this._stack.pop(); }

  get current(): CocosUiScopeLike {
    const key = this._stack[this._stack.length - 1];
    return key ? this._scopes.get(key)! : this.defaultScope;
  }

  callsOf(tag: string): readonly string[] {
    return tag === 'default' ? this.defaultScope.calls : this._scopes.get(tag)!.calls;
  }
}

/**
 * 一段真实形状的指令流：容器外两条 rect + 一条文字（默认层），容器内 hud 一段、
 * modal 一段（modal 里两条文字）——用来验路由、sibling 计数与「实际落笔作用域数」。
 */
function buildStream(): RenderModelBuilder {
  const b = new RenderModelBuilder(200, 400);
  b.begin();
  b.rect(0, 0, 10, 10, { fill: '#ffffff' });
  b.beginContainer('menu');
  b.beginSegment('hud');
  b.rect(20, 20, 10, 10, { fill: '#ffffff' });
  b.text(30, 30, 'A');
  b.endSegment();
  b.beginSegment('modal');
  b.rect(40, 40, 10, 10, { fill: '#ffffff' });
  b.text(50, 50, 'B');
  b.text(60, 60, 'C');
  b.endSegment();
  b.endContainer();
  b.rect(70, 70, 10, 10, { fill: '#ffffff' });
  b.text(80, 80, 'D');
  return b;
}

function viewport(): Viewport {
  const v = new Viewport(200, 400);
  v.resize(200, 400);
  return v;
}

describe('UI-60 P0 — 容器 / 段语法（RenderModel）', () => {
  it('四条语法糖按调用顺序落进指令流，kind 名固定', () => {
    const b = new RenderModelBuilder(200, 400);
    b.begin();
    b.beginContainer('menu');
    b.beginSegment('hud');
    b.rect(0, 0, 1, 1, { fill: '#ffffff' });
    b.endSegment();
    b.endContainer();
    expect(b.end().commands.map((c) => c.kind)).toEqual([
      'container', 'segment', 'rect', 'segmentEnd', 'containerEnd',
    ]);
  });

  it('层级变化必须被脏帧门控看见：同几何不同容器 ⇒ signature 不同', () => {
    const wrap = (id: string): number => {
      const b = new RenderModelBuilder(200, 400);
      b.begin();
      b.beginContainer(id);
      b.rect(0, 0, 10, 10, { fill: '#ffffff' });
      b.endContainer();
      return b.signature();
    };
    expect(wrap('menu')).not.toBe(wrap('play'));
  });
});

describe('UI-60 P0 — Cocos 作用域映射', () => {
  it('未注入 scopeHost ⇒ 新 kind 静默忽略，其余绘制逐字等价（P0 真机零漂移的根据）', () => {
    const plain = new RenderModelBuilder(200, 400);
    plain.begin();
    plain.rect(0, 0, 10, 10, { fill: '#ffffff' });
    plain.rect(20, 20, 10, 10, { fill: '#ffffff' });
    plain.rect(40, 40, 10, 10, { fill: '#ffffff' });
    plain.rect(70, 70, 10, 10, { fill: '#ffffff' });

    const sink = { texts: [], siblings: [] };
    const { g: g1, calls: calls1 } = fakeGraphics('a');
    const r1 = new CocosRenderModelRenderer(g1, fakeLabelPool('a', sink), colors, viewport());
    r1.draw(plain.end());

    const { g: g2, calls: calls2 } = fakeGraphics('a');
    const r2 = new CocosRenderModelRenderer(g2, fakeLabelPool('a', sink), colors, viewport());
    r2.draw(buildStream().end());
    // 容器 / 段命令一条不多画、一条不少画：与不含层级命令的同一批图元逐字一致
    expect(calls2).toEqual(calls1);
  });

  it('注入 scopeHost ⇒ 矢量与文字按当前作用域落笔，出容器回默认层', () => {
    const host = new FakeScopeHost();
    const renderer = new CocosRenderModelRenderer(
      fakeGraphics('ignored').g, fakeLabelPool('ignored', host.sink), colors, viewport(), { scopeHost: host },
    );
    renderer.draw(buildStream().end());

    // 默认层只收容器外那两条 rect（首、尾）
    expect(host.callsOf('default').filter((c) => c.startsWith('default:rect('))).toHaveLength(2);
    // 容器自身的层在本指令流里不该收到 rect（全部图元都在段内）
    expect(host.callsOf('c:menu').filter((c) => c.includes('rect('))).toHaveLength(0);
    // 中坐标已换到中点原点（视口 200×400 ⇒ ox −100 / oy −200）：(20,20)→(−80,−180)、(40,40)→(−60,−160)
    expect(host.callsOf('c:menu·hud').some((c) => c.includes('rect(-80,-180,10,10)'))).toBe(true);
    expect(host.callsOf('c:menu·modal').some((c) => c.includes('rect(-60,-160,10,10)'))).toBe(true);
    expect(host.sink.texts).toEqual(['c:menu·hud:A', 'c:menu·modal:B', 'c:menu·modal:C', 'default:D']);
  });

  it('DEC-5：sibling 序 = 该作用域内的帧内计数，换作用域重新归零', () => {
    const host = new FakeScopeHost();
    const renderer = new CocosRenderModelRenderer(
      fakeGraphics('ignored').g, fakeLabelPool('ignored', host.sink), colors, viewport(), { scopeHost: host },
    );
    renderer.draw(buildStream().end());
    // sibling 在 setText 之前写入 ⇒ 两个数组各自按命令序记录，逐位对齐即同一张标签
    expect(host.sink.siblings).toEqual([
      'c:menu·hud#0',
      'c:menu·modal#0',
      'c:menu·modal#1',
      'default#0',
    ]);
    expect(host.sink.texts).toEqual([
      'c:menu·hud:A',
      'c:menu·modal:B',
      'c:menu·modal:C',
      'default:D',
    ]);
  });

  it('draw call 实测出口：lastScopeCount = 本帧真正落过笔的作用域数', () => {
    const host = new FakeScopeHost();
    const renderer = new CocosRenderModelRenderer(
      fakeGraphics('ignored').g, fakeLabelPool('ignored', host.sink), colors, viewport(), { scopeHost: host },
    );
    renderer.draw(buildStream().end());
    // default + hud 段 + modal 段；c:menu 本层没收到任何图元 ⇒ 不计
    expect(renderer.lastScopeCount).toBe(3);

    const solo = new CocosRenderModelRenderer(
      fakeGraphics('s').g, fakeLabelPool('s', { texts: [], siblings: [] }), colors, viewport(),
    );
    solo.draw(buildStream().end());
    expect(solo.lastScopeCount).toBe(1);
  });
});
