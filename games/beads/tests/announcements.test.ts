import { describe, expect, it } from 'vitest';

import { ANNOUNCEMENTS } from '../src/config/announcements.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 公告表不变式（WXG-T-495）。
 *
 * 表当前为空 ⇒ 本组断言恒真；**新增一条公告即自动进入校验**。改动本表后跑
 * `npx vitest run tests/announcements.test.ts` 即可，无需改测试。
 */
describe('公告内容表（U19① 已裁 = 本地随包文案表）', () => {
  it('id 全表唯一且非空（一经发布不改不删不复用）', () => {
    const ids = ANNOUNCEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ANNOUNCEMENTS) {
      expect(a.id.trim().length).toBeGreaterThan(0);
    }
  });

  it('date 为合法 YYYY-MM-DD（拒绝 2 月 30 日这类越界日）', () => {
    for (const a of ANNOUNCEMENTS) {
      expect(a.date).toMatch(DATE_RE);
      const t = Date.parse(`${a.date}T00:00:00Z`);
      expect(Number.isNaN(t)).toBe(false);
      expect(new Date(t).toISOString().slice(0, 10)).toBe(a.date);
    }
  });

  it('title / body 非空（空条目不上屏）', () => {
    for (const a of ANNOUNCEMENTS) {
      expect(a.title.trim().length).toBeGreaterThan(0);
      expect(a.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('数组顺序 = 展示顺序（新在上）：日期非递增', () => {
    for (let i = 1; i < ANNOUNCEMENTS.length; i++) {
      expect(ANNOUNCEMENTS[i - 1]!.date >= ANNOUNCEMENTS[i]!.date).toBe(true);
    }
  });
});
