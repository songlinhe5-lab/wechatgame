import { describe, expect, it } from 'vitest';

import { DEMO_LEVEL_COUNT } from '../src/config/tuning.js';
import { ARC_COMING_SOON, ARC_OPEN_MAX, ARCS, OPEN_ARCS } from '../src/config/arcs.js';

describe('大关表（EP13-S1 · C-1：清单存表 + 术语改名）', () => {
  it('开放数落在表的前几行，追加式（前序行 id 稳定，tls §8.1 D1）', () => {
    expect(ARC_OPEN_MAX).toBeGreaterThan(0);
    expect(ARCS.length).toBeGreaterThanOrEqual(ARC_OPEN_MAX);
    expect(OPEN_ARCS).toHaveLength(ARC_OPEN_MAX);
    expect(OPEN_ARCS.map((a) => a.id)).toEqual(ARCS.slice(0, ARC_OPEN_MAX).map((a) => a.id));
    expect(ARC_COMING_SOON.length).toBeGreaterThan(0);
    // 表尾追加不破前序行：已有 `id` 序列只增不改不删 ⇒ 钉死首批首行。
    expect(ARCS.map((a) => a.id).slice(0, 1)).toEqual(['mandala']);
  });

  it('每行都有名字、包和图；id 与 textureId 全表不重复', () => {
    const ids = ARCS.map((a) => a.id);
    const tex = ARCS.map((a) => a.textureId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(tex).size).toBe(tex.length);
    for (const a of ARCS) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.bundle.length).toBeGreaterThan(0);
      expect(a.art.length).toBeGreaterThan(0);
    }
  });

  it('关卡清单 = 1-based 连续区间，落现池内且行内有序（Q17=甲，tls §8.1 D9）', () => {
    for (const a of ARCS) {
      expect(a.levelRefs.length).toBeGreaterThan(0);
      let prevEnd = 0;
      for (const [from, to] of a.levelRefs) {
        expect(Number.isInteger(from)).toBe(true);
        expect(Number.isInteger(to)).toBe(true);
        expect(from).toBeGreaterThanOrEqual(1);
        expect(to).toBeGreaterThanOrEqual(from);
        expect(to).toBeLessThanOrEqual(DEMO_LEVEL_COUNT); // 落现池内（不新建关）
        expect(from).toBeGreaterThan(prevEnd);            // 行内区间有序且不相交
        prevEnd = to;
      }
    }
    // 现版唯一裁定行：大关① 曼陀罗 = 关号 1–9（L9 boss 收尾）。
    expect(ARCS[0].levelRefs).toEqual([[1, 9]]);
  });

  it('跨行不重叠：一个小关最多归一个大关（归属只有一处真源，meta-ui §8-2 同型）', () => {
    const seen = new Set<number>();
    for (const a of ARCS) {
      for (const [from, to] of a.levelRefs) {
        for (let n = from; n <= to; n += 1) {
          expect(seen.has(n)).toBe(false);
          seen.add(n);
        }
      }
    }
  });
});
