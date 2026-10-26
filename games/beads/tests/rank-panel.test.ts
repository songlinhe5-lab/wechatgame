/**
 * WXG-T-432 · S-3 好友榜面板**占位**判据（ADR-0035 §5.2 S-3 / 施工单 §4.1）。
 *
 * 直测 `systems/rank-panel.ts` 的状态机与收发边界；Provider 用框架的
 * `MockOpenDataProvider`（`send` 内**同步**回执 ⇒ 测试零 await、无计时）。
 * 协议面只锁「主域发了什么、收到什么」：`init` / `rank:query` / `render:visible`
 * 的条数与字段，以及失败码到面板状态的映射；好友明细**不进主域**（§3.1）。
 */
import { describe, expect, it, vi } from 'vitest';
import { MockOpenDataProvider, OPEN_DATA_VERSION } from '@wxgame/framework';
import type { HostToOpenData } from '@wxgame/framework';
import {
  RankPanel,
  RANK_QUERY_LIMIT,
  rankPanelLayout,
  rankStatusText,
  rankTheme,
} from '../src/systems/rank-panel.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';

/** 主题对象只造一次（深比较断言用；运行时主题不随面板变）。 */
const THEME = rankTheme(DEFAULT_PALETTE);

function makePanel(openSettings?: () => void): RankPanel {
  return new RankPanel(openSettings ? { theme: THEME, openSettings } : { theme: THEME });
}

function sentOf(mock: MockOpenDataProvider, type: HostToOpenData['type']): HostToOpenData[] {
  return mock.sent.filter((m) => m.type === type);
}

const centre = (r: { xMin: number; xMax: number; yMin: number; yMax: number }): [number, number] => [
  (r.xMin + r.xMax) / 2,
  (r.yMin + r.yMax) / 2,
];

describe('WXG-T-432 S-3 · RankPanel 状态机与 Provider 收发', () => {
  it('无 provider：打开落 unsupported、面板可见，且一条消息都不发', () => {
    const mock = new MockOpenDataProvider({ rows: 3 });
    const panel = makePanel();
    panel.attach(mock);
    panel.attach(null); // 宿主无 openData 能力（Node / web / 旧宿主）
    panel.open('settle-total', '');

    expect(panel.state).toBe('unsupported');
    expect(panel.visible).toBe(true);
    expect(panel.view().visible).toBe(true);
    expect(mock.sent).toEqual([]);
  });

  it('rows:3 ⇒ ready / count=3；render:visible + init + **恰一条** rank:query', () => {
    const mock = new MockOpenDataProvider({ rows: 3 });
    const panel = makePanel();
    panel.attach(mock);
    panel.open('settle-total', '');

    expect(panel.state).toBe('ready');
    expect(panel.count).toBe(3);
    expect(panel.view().state).toBe('ready');
    expect(mock.sent.map((m) => m.type)).toEqual(['render:visible', 'init', 'rank:query']);
    expect(mock.sent[0]).toEqual({ type: 'render:visible', visible: true });
    expect(mock.sent[1]).toEqual({
      type: 'init',
      version: OPEN_DATA_VERSION,
      theme: THEME,
      board: 'settle-total',
    });

    const queries = sentOf(mock, 'rank:query');
    expect(queries).toHaveLength(1);
    expect(queries[0]).toEqual({
      type: 'rank:query',
      board: 'settle-total',
      key: '',
      order: 'desc',
      limit: RANK_QUERY_LIMIT,
    });
    expect(RANK_QUERY_LIMIT).toBe(10);
    expect(rankStatusText('ready', 3)).toBe('共 3 位好友上榜');
  });

  it('rows:0 ⇒ empty（distinct 文案）', () => {
    const mock = new MockOpenDataProvider({ rows: 0 });
    const panel = makePanel();
    panel.attach(mock);
    panel.open('settle-total', '');

    expect(panel.state).toBe('empty');
    expect(panel.count).toBe(0);
    expect(rankStatusText('empty', 0)).toBe('还没有好友上榜，去邀请一位');
  });

  it('failCode: no-auth ⇒ no-auth；api-missing ⇒ fail（不同文案，同一协议码）', () => {
    for (const [code, state, text] of [
      ['no-auth', 'no-auth', '未授权，无法显示好友榜'],
      ['api-missing', 'fail', '好友榜暂时打不开，稍后再试'],
    ] as const) {
      const mock = new MockOpenDataProvider({ rows: 3, failCode: code });
      const panel = makePanel();
      panel.attach(mock);
      panel.open('settle-total', '');
      expect(panel.state).toBe(state);
      expect(sentOf(mock, 'rank:query')).toHaveLength(1);
      expect(rankStatusText(state, 0)).toBe(text);
    }
  });

  it('version:0 ⇒ incompatible，且**不发** rank:query（版本闸门在 query 之前）', () => {
    const mock = new MockOpenDataProvider({ version: 0 });
    const panel = makePanel();
    panel.attach(mock);
    panel.open('settle-total', '');

    expect(panel.state).toBe('incompatible');
    expect(sentOf(mock, 'rank:query')).toEqual([]);
    expect(mock.sent.map((m) => m.type)).toEqual(['render:visible', 'init']);
    expect(rankStatusText('incompatible', 0)).toBe('好友榜版本不匹配，请更新后再试');
  });

  it('close() ⇒ 末条 render:visible{false}；退场期满 visible=false', () => {
    const mock = new MockOpenDataProvider({ rows: 3 });
    const panel = makePanel();
    panel.attach(mock);
    panel.open('settle-total', '');
    panel.close();

    expect(mock.sent[mock.sent.length - 1]).toEqual({ type: 'render:visible', visible: false });
    expect(panel.visible).toBe(true); // 退场期仍绘制
    panel.update(200); // > PANEL_OUT_MS
    expect(panel.visible).toBe(false);
    expect(panel.view().visible).toBe(false);
    expect(panel.progress).toBe(0);
  });

  it('detach() 后回执不再改状态（退订生效）', () => {
    const mock = new MockOpenDataProvider({ rows: 3 });
    const panel = makePanel();
    panel.attach(mock);
    panel.open('settle-total', '');
    expect(panel.state).toBe('ready');

    panel.detach();
    mock.emit({ type: 'rank:error', board: 'settle-total', code: 'api-missing' });
    expect(panel.state).toBe('ready');
    expect(panel.count).toBe(3);
  });

  it('hitTest 命中「返回」；带 openSettings ⇒ settings 钮可命中且钩子只调一次', () => {
    const mock = new MockOpenDataProvider({ rows: 3 });
    const plain = makePanel();
    plain.attach(mock);
    plain.open('settle-total', '');
    const back = rankPanelLayout(false).buttons[0]!.rect;
    expect(plain.hitTest(...centre(back))).toBe('back');
    expect(plain.view().settings).toBe(false);

    const hook = vi.fn();
    const withSettings = makePanel(hook);
    withSettings.attach(mock);
    withSettings.open('settle-total', '');
    expect(withSettings.view().settings).toBe(true);
    const settings = rankPanelLayout(true).buttons[1]!;
    expect(settings.id).toBe('settings');
    expect(withSettings.hitTest(...centre(settings.rect))).toBe('settings');
    withSettings.tap('settings');
    expect(hook).toHaveBeenCalledTimes(1);
  });

  it('其它 board 的回执被忽略（board 不匹配 ⇒ state/count 不变）', () => {
    const mock = new MockOpenDataProvider({ rows: 3 });
    const panel = makePanel();
    panel.attach(mock);
    panel.open('settle', 'lvl-01');
    expect(panel.state).toBe('ready');
    expect(panel.count).toBe(3);
    expect(panel.board).toBe('settle');

    mock.emit({ type: 'rank:ready', board: 'settle-total', count: 9 });
    mock.emit({ type: 'rank:error', board: 'settle-total', code: 'no-auth' });
    expect(panel.state).toBe('ready');
    expect(panel.count).toBe(3);
    expect(panel.view().board).toBe('settle');
  });
});
