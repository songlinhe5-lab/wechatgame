/**
 * **格内占比标准 · 拦截判据**（正本 = `art/cell-standard.md` §2/§3 · WXG-T-214 用户 2026-09-26 拍板）
 * ─────────────────────────────────────────────────────────────────────────────
 * 本文件是 J1–J7 的**常驻门**：全部为**解析计算**（只吃 `tuning.ts` 真源常量，零渲染、零夹具）
 * ⇒ 恒等档数值钉死、跑得快、与渲染实现解耦（实现怎么画，格内面积账必须仍是这些数）。
 *
 * ⛔ **变更纪律（`cell-standard.md` §4）**：本文件任何钉值/门槛的修改，必须同批提供
 *   ①调研对照图与面积账 ②原因说明 ③`cell-standard.md` 同步 ④台账登记。
 *   只改代码不改文档 = 本门红 + 文档脱钩（K-035 同族）。
 *
 * 口径：格径 32（B0 满铺、方角）/ 格 30 = 珠体边长基准 / 珠面 = 30 − 2×inset；
 * 圆角方面积 = `面² − (4−π)·圆角²`；底透 = 环（格径² − 珠外廓）+ 孔（π·r²）。
 */
import { describe, it, expect } from 'vitest';
import {
  BEAD_CARD,
  BEAD_CELL,
  BEAD_DRAW_INSET,
  BEAD_DRAW_INSET_SMALL,
  BEAD_PITCH,
} from '../src/config/tuning.js';

const TILE = BEAD_PITCH * BEAD_PITCH;
const RING_FLOOR_PX = 2; // J1：环宽地板（1.0 CSS px）
const BG_FLOOR_PCT = 30; // J2：底透占比地板（⚠ 代理指标，非感知标准）
const FACE_FLOOR_PCT = 70; // J5：珠面/格径 地板（「豆子基本覆盖格子」）
/** 圆角方面积 = a² − (4−π)·r²（四角削去量还给底色）。 */
const roundedSqArea = (a: number, r: number): number => a * a - (4 - Math.PI) * r * r;

/** 从真源常量还原一档的格内面积账（与 `bead-render`/`facet-4` 的派生同式）。 */
function account(inset: number, hole: boolean) {
  const face = BEAD_CELL - 2 * inset;
  const corner = Math.round(face * BEAD_CARD.radius);
  const holeR = hole ? Math.round((face * BEAD_CARD.holeRatio) / 2) : 0;
  const foot = roundedSqArea(face, corner);
  const holeA = hole ? Math.PI * holeR * holeR : 0;
  const ink = foot - holeA;
  const ringW = (BEAD_PITCH - face) / 2;
  const ring = TILE - foot;
  const bg = ring + holeA;
  const socket = face - 2 * Math.max(BEAD_CARD.minStroke, BEAD_CELL * 0.07);
  return { face, corner, holeR, holeD: 2 * holeR, ink, ringW, ring, bg, socket };
}

// 确认值（§2）：两档的钉值。⛔ 修改须走 `cell-standard.md` §4 变更纪律。
const FULL = account(BEAD_DRAW_INSET, true);
const SMALL = account(BEAD_DRAW_INSET_SMALL, false);

describe('格内占比标准（cell-standard.md §2 确认值）', () => {
  it('钉值：有孔（inset 2 ⇒ 面 26 / 孔 ⌀12 / 圆角 8）', () => {
    expect(BEAD_DRAW_INSET).toBe(2);
    expect(FULL.face).toBe(26);
    expect(FULL.face / BEAD_PITCH).toBeCloseTo(0.8125, 6);
    expect(FULL.holeD).toBe(12); // 取整后偶数（0.44 真源派生 11.44 → 12）
    expect(FULL.corner).toBe(8);
    expect(FULL.socket).toBeCloseTo(21.8, 6);
  });

  it('钉值：无孔（inset 3 ⇒ 面 24 / 圆角 7 / 无孔）', () => {
    expect(BEAD_DRAW_INSET_SMALL).toBe(3);
    expect(SMALL.face).toBe(24);
    expect(SMALL.face / BEAD_PITCH).toBeCloseTo(0.75, 6);
    expect(SMALL.holeR).toBe(0);
    expect(SMALL.corner).toBe(7);
    expect(SMALL.socket).toBeCloseTo(19.8, 6);
  });

  it('J4：孔径恒为偶数整数设计 px（两档通式，不止钉恒等档）', () => {
    for (const face of [16, 20, 24, 26, 28, 30, 44]) {
      const r = Math.round((face * BEAD_CARD.holeRatio) / 2);
      expect((2 * r) % 2).toBe(0);
    }
  });

  it('J1+J2+J5+J6：两档全部过线（环 ≥2 / 底透 ≥30% / 面 ≥70% 格径 / 珠:底 ∈ [40,60]）', () => {
    for (const a of [FULL, SMALL]) {
      expect(a.ringW).toBeGreaterThanOrEqual(RING_FLOOR_PX);
      expect((a.bg / TILE) * 100).toBeGreaterThanOrEqual(BG_FLOOR_PCT);
      expect((a.face / BEAD_PITCH) * 100).toBeGreaterThanOrEqual(FACE_FLOOR_PCT);
      const beadPct = (a.ink / TILE) * 100;
      const bgPct = (a.bg / TILE) * 100;
      expect(beadPct).toBeGreaterThanOrEqual(40);
      expect(beadPct).toBeLessThanOrEqual(60);
      expect(beadPct + bgPct).toBeCloseTo(100, 6);
    }
  });

  it('J2/J6 实测占位（诚实登记：改常量后这两行会给出新占比，须回写文档 §2）', () => {
    // 有孔 508.0/516.0 ⇒ 49.6:50.4；无孔 533.9/490.1 ⇒ 52.1:47.9（圆角修正口径，非方角近似）。
    expect(FULL.ink).toBeCloseTo(508.0, 0);
    expect(FULL.bg).toBeCloseTo(516.0, 0);
    expect(SMALL.ink).toBeCloseTo(533.9, 0);
    expect(SMALL.bg).toBeCloseTo(490.1, 0);
  });

  it('J3/J7 锚点在场（正判据住在各自的宿主文件，本门只防"被删"）', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const read = (p: string): string =>
      fs.readFileSync(path.resolve(__dirname, p), 'utf8');
    // J3：坑 ⊂ 珠（包围盒）判据必须在 bead-render.test.ts 在场。
    expect(read('bead-render.test.ts')).toMatch(/豆坑恒小于珠体/);
    // J7：inset × holeRatio 成对锁必须在场。
    expect(read('bead-render.test.ts')).toMatch(/同批性：BEAD_DRAW_INSET 与 holeRatio 成对/);
    // 凹槽随档恒 ⊂ 珠（豆径档判据的新口径）必须在场。
    expect(read('bead-style-settings.test.ts')).toMatch(/凹槽随档但恒 ⊂ 珠体/);
    // 标准文档本体必须在场（⛔ 文档被删/改名 = 判据失去正本）。
    expect(read(path.join('..', 'art', 'cell-standard.md'))).toMatch(/格内占比标准/);
  });
});
