/**
 * UI-21 通用按钮单测：四族外观与按下 / 禁用 / 无字分支。
 *
 * 金样本只抓静息态，本文件补「按下面色、受光线隐去、禁用 α、图标钮不画字」
 * 这些静息态照不到的分支（假 builder 记录指令，不做像素渲染）。
 */
import { describe, expect, it } from 'vitest';
import type { RenderModelBuilder } from '@wxgame/framework';
import type { BeadsPalette } from '../src/view/palette.js';
import { drawButton } from '../src/view/ui-widgets.js';

const P = {
  woodFace: '#wood',
  woodFacePressed: '#wood-pressed',
  woodSheen: '#sheen',
  woodEdge: '#edge',
  woodText: '#wood-text',
  panel: '#panel',
  panelBorder: '#panel-border',
  cardPressed: '#card-pressed',
  text: '#text',
  accentPrimary: '#accent',
  slot: '#slot',
  slotBorder: '#slot-border',
} as unknown as BeadsPalette;

interface Call {
  readonly kind: 'rect' | 'line' | 'text';
  readonly args: readonly unknown[];
}

function recorder(): { calls: Call[]; builder: RenderModelBuilder } {
  const calls: Call[] = [];
  const push = (kind: Call['kind']) => (...args: unknown[]) => calls.push({ kind, args });
  return {
    calls,
    builder: { rect: push('rect'), line: push('line'), text: push('text') } as unknown as RenderModelBuilder,
  };
}

function opts(call: Call): Record<string, unknown> {
  return call.args[call.kind === 'text' ? 3 : 4] as Record<string, unknown>;
}

describe('drawButton —— 木钮（wood）', () => {
  it('静息态 = 面 + 顶缘受光线 + 底缘承重线 + 木色字', () => {
    const { calls, builder } = recorder();
    drawButton(builder, P, 10, 20, 100, 40, 'wood', 12, '继续', undefined, false);
    expect(calls.map((c) => c.kind)).toEqual(['rect', 'line', 'line', 'text']);
    expect(opts(calls[0]!).fill).toBe(P.woodFace);
    expect(calls[1]!.args[4]).toBe(P.woodSheen);
    expect(calls[2]!.args[4]).toBe(P.woodEdge);
    expect(calls[3]!.args[2]).toBe('继续');
    expect(opts(calls[3]!).fill).toBe(P.woodText);
  });

  it('按下态 = 换面 + 受光线隐去（只剩底缘线）', () => {
    const { calls, builder } = recorder();
    drawButton(builder, P, 0, 0, 100, 40, 'wood', 12, '继续', undefined, true);
    expect(calls.map((c) => c.kind)).toEqual(['rect', 'line', 'text']);
    expect(opts(calls[0]!).fill).toBe(P.woodFacePressed);
    expect(calls[1]!.args[4]).toBe(P.woodEdge);
  });

  it('sheen=false（T4）且无文案 = 面 + 底缘线，不画字', () => {
    const { calls, builder } = recorder();
    drawButton(builder, P, 0, 0, 100, 40, 'wood', 16, undefined, undefined, false, false, false);
    expect(calls.map((c) => c.kind)).toEqual(['rect', 'line']);
  });
});

describe('drawButton —— 纸钮 / 菜单钮', () => {
  it('纸次钮 = 纸面 + panelBorder 1px + 正文色字', () => {
    const { calls, builder } = recorder();
    drawButton(builder, P, 0, 0, 100, 40, 'paper', 16, '重试', undefined, false);
    expect(calls.map((c) => c.kind)).toEqual(['rect', 'text']);
    expect(opts(calls[0]!).fill).toBe(P.panel);
    expect(opts(calls[0]!).stroke).toBe(P.panelBorder);
    expect(opts(calls[0]!).lineWidth).toBe(1);
    expect(opts(calls[1]!).fill).toBe(P.text);
  });

  it('菜单主钮 = accent 面 + 同色 2px 描边 + 面板色字', () => {
    const { calls, builder } = recorder();
    drawButton(builder, P, 0, 0, 100, 40, 'accent', 14, '开始', undefined, false);
    expect(opts(calls[0]!).fill).toBe(P.accentPrimary);
    expect(opts(calls[0]!).stroke).toBe(P.accentPrimary);
    expect(opts(calls[0]!).lineWidth).toBe(2);
    expect(opts(calls[1]!).fill).toBe(P.panel);
  });

  it('菜单次钮 disabled = slot 面 + 50% α', () => {
    const { calls, builder } = recorder();
    drawButton(builder, P, 0, 0, 100, 40, 'ghost', 14, '返回', undefined, false, true);
    expect(opts(calls[0]!).fill).toBe(P.slot);
    expect(opts(calls[0]!).alpha).toBe(0.5);
  });
});
