/**
 * 「候选色系宏」= 品牌 mm ↔ dip 单一真源守卫（ADR-0021，WXG-T-206 续）。
 *
 * 真源链：`games/beads/art/<slug>.json`（`beadMm`）→ `tools/scripts/sync-palettes.mjs`
 * 的唯一 `dip(mm)`（6.4 dip/mm、取偶）→ 两份产物 `BRANDS`（本仓游戏侧，经
 * `view/palette.ts` re-export）与 `apps/beads-studio/public/brands.json`（studio 前端）。
 *
 * ⚠ 判据写法依 **K-042**（几何单一真源化后测试失去自证能力，须另配**不依赖该真源**的
 * 不变量守卫）：下面的 `FROZEN_MM` / `DIP_LADDER` 是**用户 2026-09-24 裁定的期望值字面量**，
 * 只作断言锚点，**不参与任何生产代码的派生**（生产侧只有一份 dip 实现，住在生成器里）。
 * 换 mm 或改阶梯 ⇒ 本文件必须同时改，否则红 —— 这正是「第二双眼」的职责。
 *
 * 另：本表**不得**被渲染层消费（§3.3 `BEAD_CELL=50/GAP=2/PITCH=52` 各自冻结），
 * 故这里只验「读得到、读得对、三处一致」。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BRANDS, getBeadBrand } from '../src/view/palette.js';

/** 用户裁定的品牌物理珠径（mm）；`artkal-r` 取其 `_note` 的 5mm（目录在册、功能 pending）。 */
const FROZEN_MM: { readonly [slug: string]: number } = {
  'artkal-s': 5,
  'artkal-c': 2.6,
  'artkal-a': 2.6,
  'artkal-m': 2.6,
  'artkal-r': 5,
  'hama-midi': 5,
  'hama-mini': 3,
  'hama-maxi': 10,
  'perler': 5,
  'perler-mini': 2.6,
  'perler-caps': 5,
  'nabbi': 5,
  'yant': 2.6,
  'mard': 5,
  'diamond-dotz': 2.88,
};

/** 偶数整数 dip 阶梯（系数 6.4 dip/mm、取偶）：唯一被冻结的五档。 */
const DIP_LADDER: { readonly [mm: string]: number } = {
  2.6: 16,
  2.88: 18,
  3: 20,
  5: 32,
  10: 64,
};

const artJson = (slug: string) =>
  JSON.parse(readFileSync(new URL(`../art/${slug}.json`, import.meta.url), 'utf8')) as {
    name?: string;
    family?: string;
    beadMm?: number;
  };

describe('候选色系宏 BRANDS（mm↔dip 单一真源 · ADR-0021）', () => {
  it('15 个品牌全在册，mm 与用户裁定一致、dip 与冻结阶梯一致', () => {
    const slugs = Object.keys(FROZEN_MM);
    expect(Object.keys(BRANDS).sort()).toEqual(slugs.slice().sort());
    for (const slug of slugs) {
      const b = getBeadBrand(slug)!;
      expect(b, slug).toBeTruthy();
      expect(b.mm, slug).toBe(FROZEN_MM[slug]);
      expect(b.slug, slug).toBe(slug);
      expect(b.name, slug).toBeTruthy();
      expect(b.family, slug).toBeTruthy();
      const ladder = DIP_LADDER[String(b.mm)];
      expect(ladder, `${slug} mm=${b.mm} 不在冻结阶梯内`).toBeDefined();
      expect(b.dip, slug).toBe(ladder);
      expect(b.colors, slug).toBeGreaterThan(1);
    }
  });

  it('产物 ↔ 真源：BRANDS 的 mm/name/family 与 art/<slug>.json 一致', () => {
    for (const slug of Object.keys(BRANDS)) {
      const j = artJson(slug);
      const b = BRANDS[slug]!;
      expect(j.beadMm, slug).toBe(b.mm);
      expect(j.name, slug).toBe(b.name);
      expect(j.family, slug).toBe(b.family);
    }
  });

  it('studio 侧 brands.json 与游戏侧 BRANDS 同批同值（两处消费一份真源）', () => {
    const file = new URL('../../../apps/beads-studio/public/brands.json', import.meta.url);
    const j = JSON.parse(readFileSync(file, 'utf8')) as { brands: Array<Record<string, number | string | boolean>> };
    expect(j.brands.map((b) => b.slug).sort()).toEqual(Object.keys(BRANDS).sort());
    for (const s of j.brands) {
      const b = BRANDS[String(s.slug)]!;
      expect(s.mm, String(s.slug)).toBe(b.mm);
      expect(s.dip, String(s.slug)).toBe(b.dip);
      expect(s.name, String(s.slug)).toBe(b.name);
      expect(s.family, String(s.slug)).toBe(b.family);
      expect(s.colors, String(s.slug)).toBe(b.colors);
      expect(!!s.pending, String(s.slug)).toBe(!!b.pending);
    }
  });

  it('色数 = 该品牌 codes 条数（studio 下拉标签与量化上限同源，不再散写）', () => {
    for (const slug of Object.keys(BRANDS)) {
      const j = artJson(slug);
      const codes = (j as unknown as { codes?: string[] }).codes ?? [];
      expect(BRANDS[slug]!.colors, slug).toBe(codes.length);
    }
  });

  it('getBeadBrand 未知 slug → null（与 getBeadPalette 同口径）', () => {
    expect(getBeadBrand('nope')).toBeNull();
  });

  it('artkal-r 唯一 pending：在册但不开放功能', () => {
    const pending = Object.keys(BRANDS).filter((s) => BRANDS[s]!.pending);
    expect(pending).toEqual(['artkal-r']);
  });
});
