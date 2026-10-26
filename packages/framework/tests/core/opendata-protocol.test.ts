import { describe, expect, it } from 'vitest';
import {
  OPEN_DATA_VERSION,
  RANK_ERROR_CODES,
  isCompatibleOpenDataVersion,
  isOpenDataToHost,
} from '../../src/core/opendata/protocol.js';
import type {
  HostToOpenData,
  OpenDataTheme,
  OpenDataToHost,
  RankBoard,
  RankErrorCode,
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

/** Compile-time completeness sentinels: every union member must be listed. */
const HOST_MESSAGES: readonly HostToOpenData[] = [
  { type: 'init', version: OPEN_DATA_VERSION, theme: THEME, board: 'settle-total' },
  { type: 'rank:query', board: 'settle-total', key: 'L00001', order: 'desc', limit: 50 },
  { type: 'rank:refresh', board: 'settle-total' },
  { type: 'render:resize', width: 320, height: 480, dpr: 2 },
  { type: 'render:visible', visible: true },
];

const CHILD_MESSAGES: readonly OpenDataToHost[] = [
  { type: 'ready', version: OPEN_DATA_VERSION },
  { type: 'rank:ready', board: 'settle-total', count: 3 },
  { type: 'rank:error', board: 'settle', code: 'no-auth' },
];

const RANK_BOARDS: readonly RankBoard[] = ['settle', 'settle-total', 'sprint'];

describe('opendata protocol shape', () => {
  it('declares all host→subdomain and subdomain→host message kinds', () => {
    expect(HOST_MESSAGES.map((message) => message.type)).toEqual([
      'init',
      'rank:query',
      'rank:refresh',
      'render:resize',
      'render:visible',
    ]);
    expect(CHILD_MESSAGES.map((message) => message.type)).toEqual([
      'ready',
      'rank:ready',
      'rank:error',
    ]);
    expect(RANK_BOARDS).toEqual(['settle', 'settle-total', 'sprint']);
    expect([...RANK_ERROR_CODES]).toEqual(['no-auth', 'empty', 'api-missing', 'fail']);
  });

  it('pins the handshake version to 1', () => {
    expect(OPEN_DATA_VERSION).toBe(1);
  });

  it('accepts every valid subdomain→host event', () => {
    const code: RankErrorCode = 'fail';
    expect(isOpenDataToHost({ type: 'ready', version: 1 })).toBe(true);
    expect(isOpenDataToHost({ type: 'rank:ready', board: 'settle-total', count: 0 })).toBe(true);
    expect(isOpenDataToHost({ type: 'rank:error', board: 'sprint', code })).toBe(true);
  });

  it('rejects malformed or unknown subdomain→host events without throwing', () => {
    const invalid: readonly unknown[] = [
      { type: 'nope' },
      { type: 'rank:ready', count: 3 },
      { type: 'rank:ready', board: 'settle-total', count: Number.NaN },
      { type: 'rank:ready', board: 'settle-total', count: -1 },
      { type: 'rank:error', board: 'settle', code: 'unknown-code' },
      { type: 'ready', version: '1' },
      null,
      [],
    ];
    for (const value of invalid) {
      expect(() => isOpenDataToHost(value)).not.toThrow();
      expect(isOpenDataToHost(value)).toBe(false);
    }
  });

  it('only treats the current version as compatible', () => {
    expect(isCompatibleOpenDataVersion(OPEN_DATA_VERSION)).toBe(true);
    expect(isCompatibleOpenDataVersion(0)).toBe(false);
    expect(isCompatibleOpenDataVersion(2)).toBe(false);
    expect(isCompatibleOpenDataVersion('1')).toBe(false);
    expect(isCompatibleOpenDataVersion(undefined)).toBe(false);
    expect(isCompatibleOpenDataVersion(null)).toBe(false);
  });
});
