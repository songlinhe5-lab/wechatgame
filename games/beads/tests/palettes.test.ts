/**
 * 色板注册表与关卡色板解析（v1.40 品牌引用制）——真源 `games/beads/art/*.json`，
 * 产物 `src/config/palettes-data.ts`（紧缩+混淆自解码，门禁 `palettes:check` 防漂移）。
 *
 * 这里只断言「游戏侧读得到、读得对」：
 *   ① 品牌注册表可读：codes/palette 同长、hex 合法；
 *   ② getBeadPalette 未知 slug → null；
 *   ③ beadInksFor：无品牌引用关卡 → 回落 demo 默认色板（LEVELS_DATA.palette 十色）；
 *      带 slug+paletteCodes → 从注册表解析 hex；未知 slug/色号 → 炭黑兜底。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BeadsLevelRaw } from '../src/config/levels-data.js';
import {
  DEMO_BEAD_INKS,
  PALETTES,
  beadColorOf,
  beadInksFor,
  endpointOf,
  getBeadPalette,
  resetPaletteFallbackWarnings,
} from '../src/view/palette.js';
import { LEVELS_DATA } from '../src/config/levels-data.js';
import { charOfColor } from '../src/config/levels.js';

const BRAND_SLUGS = ['artkal-s', 'artkal-c', 'artkal-m', 'artkal-a', 'artkal-r', 'hama-midi', 'perler'];

describe('色板注册表（v1.40 品牌引用制）', () => {
  it('品牌色板游戏侧可读：codes 与 palette 同长、hex 格式合法', () => {
    for (const slug of BRAND_SLUGS) {
      const p = getBeadPalette(slug)!;
      expect(p, slug).toBeTruthy();
      expect(p.codes.length, slug).toBe(p.palette.length);
      expect(p.palette.length, slug).toBeGreaterThan(2);
      for (const hex of p.palette) expect(hex, slug).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('getBeadPalette 未知 slug → null', () => {
    expect(getBeadPalette('nope')).toBeNull();
  });
});

describe('关卡色板解析 beadInksFor（v1.40）', () => {
  it('无品牌引用的关卡回落 demo 默认色板（十色）', () => {
    const level = { id: 1, cols: 5, rows: 5, pattern: ['11111'] } as unknown as BeadsLevelRaw;
    const inks = beadInksFor(level);
    expect(inks.hexes.length).toBe(10);
    expect([...inks.hexes]).toEqual([...DEMO_BEAD_INKS.hexes]);
    expect(inks.endpoints.length).toBe(inks.hexes.length);
    expect(endpointOf(inks, 1).base).toBe(beadColorOf(inks, 1));
  });

  it('slug+paletteCodes 从注册表解析品牌 hex（紧凑序）', () => {
    const artkalS = PALETTES['artkal-s']!;
    const codes = [artkalS.codes[0]!, artkalS.codes[1]!, artkalS.codes[2]!];
    const level = {
      id: 2,
      cols: 3,
      rows: 1,
      pattern: ['123'],
      palette: 'artkal-s',
      paletteCodes: codes,
    } as unknown as BeadsLevelRaw;
    const inks = beadInksFor(level);
    expect([...inks.hexes]).toEqual([artkalS.palette[0], artkalS.palette[1], artkalS.palette[2]]);
    expect(beadColorOf(inks, 1)).toBe(artkalS.palette[0]);
  });

  it('未知 slug → 全炭黑兜底（防御，BOOT 校验会先行拦截）', () => {
    const level = {
      id: 3,
      cols: 2,
      rows: 1,
      pattern: ['11'],
      palette: 'ghost-brand',
      paletteCodes: ['X1'],
    } as unknown as BeadsLevelRaw;
    const inks = beadInksFor(level);
    expect(beadColorOf(inks, 1)).toBe(beadColorOf(DEMO_BEAD_INKS, 1));
  });
});

/**
 * 护栏 B2（§3.2 v1.55 连带，正本 §2.6-ⓑ / §5-B2）：三处兜底不得再**全静默**。
 *
 * 行为不变（仍返炭黑 / demo 色板 —— B1 才是拒收层，本层是第二层）；变的只是
 * 「出声」。一次性门⇒ 正常路径零分配、也不会在帧率上刷日志。
 */
describe('B2 · 静默兑底告警（§3.2 v1.55 护栏）', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  const msgs = (): string[] => warn.mock.calls.map((c: unknown[]) => String(c[0]));

  beforeEach(() => {
    resetPaletteFallbackWarnings();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
  });

  it('正常路径不刷日志：demo 关加载与 colorIdx 0（void/locked 常规入参）均静默', () => {
    const level = { id: 4, cols: 3, rows: 1, pattern: ['123'] } as unknown as BeadsLevelRaw;
    const inks = beadInksFor(level);
    expect(beadColorOf(inks, 0)).toBe('#33333D'); // 行为与 v1.54 一致（炭黑兜底）
    expect(endpointOf(inks, 0).base).toBe('#33333D');
    expect(warn).not.toHaveBeenCalled();
  });

  it('colorIdx 越上界 ⇒ 告警一次（beadColorOf / endpointOf 共用同一门，不重复刷）', () => {
    const inks = DEMO_BEAD_INKS;
    const over = inks.hexes.length + 1;
    expect(beadColorOf(inks, over)).toBe('#33333D');
    expect(msgs().filter((m) => m.includes('beadColorOf')).length).toBe(1);
    expect(endpointOf(inks, over).base).toBe('#33333D');
    expect(endpointOf(inks, over + 1).base).toBe('#33333D');
    expect(msgs().length).toBe(1); // 仍只一条
  });

  it('无品牌引用但 pattern 最大索引越出 demo 色板 ⇒ 告警点名两件事（回落链 + 炭黑）', () => {
    const demoLen = LEVELS_DATA.palette?.length ?? 0;
    expect(demoLen).toBeGreaterThanOrEqual(3);
    const row = `${'1'.repeat(5)}${charOfColor(demoLen + 1)}`;
    const level = {
      id: 5,
      cols: row.length,
      rows: 1,
      pattern: [row],
    } as unknown as BeadsLevelRaw;
    const inks = beadInksFor(level);
    expect(inks.hexes.length).toBe(demoLen); // 行为不变：仍回落 demo
    const m = msgs().join(' ');
    expect(m).toContain('回落 demo 色板');
    expect(m).toContain(`最大色索引 = ${demoLen + 1}`);
    expect(m).toContain('#33333D');
  });

  it('demo 色板内的无引用关 ⇒ 不告警（现 8 关形态，不得每次加载刷噪声）', () => {
    beadInksFor({ id: 6, cols: 3, rows: 1, pattern: ['123'] } as unknown as BeadsLevelRaw);
    expect(warn).not.toHaveBeenCalled();
  });

  it('未知色号 ⇒ 告警点名色号与 slug', () => {
    const level = {
      id: 7,
      cols: 1,
      rows: 1,
      pattern: ['1'],
      palette: 'artkal-s',
      paletteCodes: ['NO-SUCH-CODE'],
    } as unknown as BeadsLevelRaw;
    const inks = beadInksFor(level);
    expect(inks.hexes[0]).toBe('#33333D');
    const m = msgs().join(' ');
    expect(m).toContain('NO-SUCH-CODE');
    expect(m).toContain('artkal-s');
  });
});
