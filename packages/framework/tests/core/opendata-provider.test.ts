import { describe, expect, it, vi } from 'vitest';
import { MockOpenDataProvider } from '../../src/core/opendata/mock.js';
import { NoopOpenDataProvider } from '../../src/core/opendata/provider.js';
import { OPEN_DATA_VERSION, isCompatibleOpenDataVersion } from '../../src/core/opendata/protocol.js';
import type {
  HostToOpenData,
  OpenDataTheme,
  OpenDataToHost,
} from '../../src/core/opendata/protocol.js';

const THEME: OpenDataTheme = {
  bg: 'black',
  rowBg: 'gray',
  rowBgSelf: 'dimgray',
  text: 'white',
  accent: 'gold',
  avatarSize: 48,
  rowH: 56,
  fontPx: 16,
};

const INIT: HostToOpenData = {
  type: 'init',
  version: OPEN_DATA_VERSION,
  theme: THEME,
  board: 'settle-total',
};

const QUERY: HostToOpenData = {
  type: 'rank:query',
  board: 'settle-total',
  key: 'L00001',
  order: 'desc',
  limit: 50,
};

describe('NoopOpenDataProvider', () => {
  it('never delivers, never throws, and survives repeated destroy', () => {
    const provider = new NoopOpenDataProvider();
    const spy = vi.fn();
    provider.onMessage(spy);
    expect(() => provider.send(INIT)).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
    provider.destroy();
    provider.destroy();
    expect(() => provider.send(QUERY)).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('MockOpenDataProvider', () => {
  it('replies ready synchronously to init', () => {
    const mock = new MockOpenDataProvider();
    const events: OpenDataToHost[] = [];
    mock.onMessage((event) => events.push(event));
    mock.send(INIT);
    expect(events).toEqual([{ type: 'ready', version: OPEN_DATA_VERSION }]);
  });

  it('reports its configured version verbatim so the host can reject it', () => {
    const mock = new MockOpenDataProvider({ version: 0 });
    const events: OpenDataToHost[] = [];
    mock.onMessage((event) => events.push(event));
    mock.send(INIT);
    expect(events).toEqual([{ type: 'ready', version: 0 }]);
    expect(isCompatibleOpenDataVersion(0)).toBe(false);
  });

  it('replies rank:ready with the configured row count', () => {
    const mock = new MockOpenDataProvider({ rows: 7 });
    const events: OpenDataToHost[] = [];
    mock.onMessage((event) => events.push(event));
    mock.send(QUERY);
    expect(events).toEqual([{ type: 'rank:ready', board: 'settle-total', count: 7 }]);
  });

  it('replies rank:error when a failure code is configured', () => {
    const mock = new MockOpenDataProvider({ failCode: 'api-missing' });
    const events: OpenDataToHost[] = [];
    mock.onMessage((event) => events.push(event));
    mock.send(QUERY);
    expect(events).toEqual([
      { type: 'rank:error', board: 'settle-total', code: 'api-missing' },
    ]);
  });

  it('stops notifying after unsubscribe', () => {
    const mock = new MockOpenDataProvider();
    const spy = vi.fn();
    const unsubscribe = mock.onMessage(spy);
    unsubscribe();
    mock.send(INIT);
    expect(spy).not.toHaveBeenCalled();
  });

  it('records every sent message in order', () => {
    const mock = new MockOpenDataProvider({ autoReply: false });
    const second: HostToOpenData = { type: 'rank:refresh', board: 'settle-total' };
    mock.send(INIT);
    mock.send(second);
    expect(mock.sent).toEqual([INIT, second]);
  });

  it('does not auto-reply when disabled', () => {
    const mock = new MockOpenDataProvider({ autoReply: false });
    const spy = vi.fn();
    mock.onMessage(spy);
    mock.send(QUERY);
    expect(spy).not.toHaveBeenCalled();
  });

  it('replies before send returns (no timers, no awaits)', () => {
    const mock = new MockOpenDataProvider();
    const events: OpenDataToHost[] = [];
    mock.onMessage((event) => events.push(event));
    mock.send(INIT);
    expect(events).toHaveLength(1);
  });
});
