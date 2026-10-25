/**
 * WXG-T-345 · 工程轨 T-4 / **S-3** — 门票归约纯函数
 * ─────────────────────────────────────────────────────────────────────────────
 * 判据真源（⛔ 本文件零新判据）：
 *  - `design/proposals/star-collect-rule.md` **R7 v0.5**（2026-10-22 用户拍板 A：
 *    门票 = **本章全通关 ∧ 累计星 ≥ 门槛**；门槛 = 满星容量 − floor(关数 × 2 / 3)；
 *    1–2 关短章只要求全通关）；
 *  - `design/gdd/save-progress.md` §2.6.3 **I5**（门票不落档，实时可算）；
 *  - `docs/architecture/adr/ADR-0034-beads-save-uid-index-flatten.md` **§6 S-3 行**
 *    （空清单两层都假 / 首章无前置 / 追加一关转假 / boss 与教学关 ⛔ 豁免 = M-17）
 *    + **§6.1 M-16 / M-17**。
 *
 * 归约集合 = 章清单里的**每一个槽**，boss 关与教学关**不豁免**（M-17）。
 * 本函数的结构性保证：输入只有「星账 + 槽位下标」，**没有 kind、没有章 id**
 * ⇒ 类型上就不存在豁免/按章分支的入口（静态臂见文末）。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  arcTicket,
  arcEntryTicket,
  arcGateStars,
  emptyArcTicketResult,
  type ArcTicketResult,
} from '../src/systems/arc-ticket.js';
import { STAR_MAX } from '../src/config/tuning.js';

/** 调用方复用的出参（生产侧每处恰建一次，热路径零分配）。 */
const result = (): ArcTicketResult => emptyArcTicketResult();

/** 长度 n、每槽满星的星账。 */
function allFull(n: number): number[] {
  const stars: number[] = [];
  for (let i = 0; i < n; i += 1) stars.push(STAR_MAX);
  return stars;
}

/** 章清单槽位（0-based 关下标）——壳层 `_wallSlotsFor` 展开后的形态。 */
const slots = (...idx: number[]): number[] => idx;

describe('S-3 门票门槛派生（R7 v0.5；v0.6 = 21→24，用户 2026-10-25 拍板）', () => {
  it('9 关 ⇒ 24★（满星 27，每三关允许丢一关 ⇒ 留 3 关非满机会）', () => {
    expect(arcGateStars(9)).toBe(24);
  });

  it('6 关 ⇒ 16★ / 3 关 ⇒ 8★（每三关允许丢一关）', () => {
    expect(arcGateStars(6)).toBe(16);
    expect(arcGateStars(3)).toBe(8);
  });

  it('1–2 关短章只要求全通关（门槛 = 关数）', () => {
    expect(arcGateStars(1)).toBe(1);
    expect(arcGateStars(2)).toBe(2);
  });

  it('空章 ⇒ 0（不造门槛；门票由 `total > 0` 另挡）', () => {
    expect(arcGateStars(0)).toBe(0);
  });
});

describe('S-3 门票归约 · 双条件', () => {
  it('臂 1：全 3★ ⇒ 开', () => {
    const out = result();
    arcTicket(allFull(9), slots(0, 1, 2, 3, 4, 5, 6, 7, 8), out);
    expect(out.satisfied).toBe(true);
    expect(out.starSum).toBe(27);
    expect(out.gate).toBe(24);
    expect(out.clearedCount).toBe(9);
    expect(out.missingCount).toBe(0);
  });

  it('臂 2：6 关满星 + 3 关 2★（24★）⇒ 恰好开（= 3 关非满机会的最省力路径）', () => {
    const out = result();
    arcTicket([3, 3, 3, 3, 3, 3, 2, 2, 2], slots(0, 1, 2, 3, 4, 5, 6, 7, 8), out);
    expect(out.satisfied, '24 ≥ 24 且全通关 ⇒ 开门（闭区间）').toBe(true);
    expect(out.starSum).toBe(24);
    expect(out.fullStarCount, '满星关数只作展示，不参与判定').toBe(6);
  });

  it('臂 3：7 关满星 + 2 关 1★（23★，差一颗）⇒ 不开（非满关必须 ≥2★ 才吃得下）', () => {
    const out = result();
    arcTicket([3, 3, 3, 3, 3, 3, 3, 1, 1], slots(0, 1, 2, 3, 4, 5, 6, 7, 8), out);
    expect(out.starSum).toBe(23);
    expect(out.satisfied, '7 满星 + 2 关 1★ = 23 < 24 ⇒ 不开').toBe(false);
  });

  it('臂 4：3 关满星 + 6 关 2★（21★，旧门槛下的最省力路径）⇒ 不开', () => {
    const out = result();
    arcTicket([3, 3, 3, 2, 2, 2, 2, 2, 2], slots(0, 1, 2, 3, 4, 5, 6, 7, 8), out);
    expect(out.satisfied, '旧口径 21★ 的「只打满 3 关」路径已被关闭').toBe(false);
    expect(out.starSum).toBe(21);
    expect(out.gate).toBe(24);
  });

  it('臂 5：总分够但有一关没通 ⇒ 不开（全通关是独立前提）', () => {
    const out = result();
    // 8×3 + 0 = 24★ ≥ 24（总分恰好够），但第 9 槽未通关。
    arcTicket([3, 3, 3, 3, 3, 3, 3, 3, 0], slots(0, 1, 2, 3, 4, 5, 6, 7, 8), out);
    expect(out.satisfied, '⛔ 跳关不能靠总分补').toBe(false);
    expect(out.starSum).toBe(24);
    expect(out.missingCount).toBe(1);
  });

  it('臂 6：空清单 ⇒ 两层都假（票不开 + 不建进度件）', () => {
    const single = result();
    arcTicket(allFull(3), slots(), single);
    expect(single.satisfied, '空清单不得被 `every` 的空真值放行').toBe(false);
    expect(single.total).toBe(0);
    expect(single.gate).toBe(0);

    // 入口层同一口径：上一章清单存在但为空 ⇒ 同样两层都假。
    const entry = result();
    arcEntryTicket(allFull(3), slots(), entry);
    expect(entry.satisfied).toBe(false);
    expect(entry.total).toBe(0);
  });

  it('臂 7：首章无前置 ⇒ 放行且不建进度件（⛔ 造 0/0）', () => {
    const out = result();
    arcEntryTicket([], undefined, out);
    expect(out.satisfied).toBe(true);
    expect(out.total, '无前置 ⇒ 无进度件可言').toBe(0);
    expect(out.gate).toBe(0);
    expect(out.missingCount).toBe(0);
  });

  it('臂 8：棘轮纯函数侧 —— 追加一关（0★）⇒ 实时归约转假', () => {
    const before = result();
    arcTicket(allFull(2), slots(0, 1), before);
    expect(before.satisfied, '2 关短章全通关 ⇒ 开').toBe(true);

    // 章内追加一关（槽位 2 尚未得星）⇒ 同一存量星账的归约立即转假。
    const after = result();
    arcTicket(allFull(2), slots(0, 1, 2), after);
    expect(after.satisfied, '追加槽位必须让归约转假（已得入口的保留属 S-4 壳层臂）').toBe(false);
    expect(after.total).toBe(3);
    expect(after.gate).toBe(8);
  });

  it('臂 9（M-17）：boss 关与教学关计入 —— 首槽 0★ ⇒ 不开', () => {
    const out = result();
    // 章① 首槽 = 教学关位、末槽 = boss 关位；函数入力无 kind ⇒ 不可能豁免。
    arcTicket([0, 3, 3], slots(0, 1, 2), out);
    expect(out.satisfied).toBe(false);
    expect(out.missingCount).toBe(1);
  });

  it('臂 9（M-17 镜像）：末槽（boss 位）0★ ⇒ 不开，哪怕前两槽满星', () => {
    const out = result();
    arcTicket([3, 3, 0], slots(0, 1, 2), out);
    expect(out.satisfied).toBe(false);
    expect(out.starSum).toBe(6);
    expect(out.gate).toBe(8);
  });
});

describe('S-3 边界与复用', () => {
  it('槽位越界（关表比槽位短）⇒ 该槽按 0★ 计，不开', () => {
    const out = result();
    arcTicket(allFull(2), slots(0, 1, 5), out);
    expect(out.satisfied).toBe(false);
    expect(out.total).toBe(3);
    expect(out.missingCount).toBe(1);
  });

  it('星值超上限钳到 STAR_MAX 后参与求和（防非法读数撑爆总分）', () => {
    const out = result();
    arcTicket([STAR_MAX + 100], slots(0), out);
    expect(out.starSum).toBe(STAR_MAX);
    expect(out.satisfied, '1 关短章 ⇒ 全通关即开').toBe(true);
  });

  it('「差哪几关」回填的是**未通关**槽：2★ 不算缺', () => {
    const out = result();
    const missing: number[] = [];
    // 星账长度 9：槽 4 满星、槽 5 零星、槽 8 两星 ⇒ 只有槽 5 未通关。
    const stars = new Array<number>(9).fill(0);
    stars[4] = STAR_MAX;
    stars[8] = STAR_MAX - 1;
    arcTicket(stars, slots(4, 5, 8), out, missing);
    expect(out.missingCount).toBe(1);
    expect(out.clearedCount).toBe(2);
    expect(out.starSum).toBe(STAR_MAX + STAR_MAX - 1);
    expect(missing, '回填的是关下标（0-based），供「差哪几关」二次表达').toEqual([5]);
  });

  it('复用同一出参：两次调用不残留上次状态', () => {
    const out = result();
    arcTicket(allFull(2), slots(0, 1), out);
    expect(out.satisfied).toBe(true);
    arcTicket([0, 0], slots(0, 1), out);
    expect(out.satisfied).toBe(false);
    expect(out.starSum).toBe(0);
    expect(out.clearedCount).toBe(0);
  });
});

describe('S-3 静态臂（M-16 预演 / M-17）', () => {
  const src = readFileSync(new URL('../src/systems/arc-ticket.ts', import.meta.url), 'utf8');
  /** 剥注释后的**代码**文本：静态臂只咬代码，注释里引用判据名（boss / save 等）不算违规。 */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  it('M-16：门票归约的输入里没有章 id（无 ArcEntry / ARCS / .id 读取）', () => {
    expect(/from\s+['"]\.\.\/config\/arcs/.test(code), '⛔ 归约不得 import 章表').toBe(false);
    expect(/\bArcEntry\b/.test(code), '⛔ 归约不得吃章对象').toBe(false);
    expect(/\.id\b/.test(code), '⛔ 归约不得读任何 id 字段').toBe(false);
  });

  it('M-17：归约不认 kind —— 无 boss / 教学 / onboarding 分支', () => {
    expect(/boss|tutorial|onboarding|isBoss|\.kind\b/i.test(code), '⛔ 任何按 kind 豁免都是 M-17 红').toBe(false);
  });

  it('M-16 夹具：只改章 id、不动存档 ⇒ 门票结果不变', () => {
    const stars = [STAR_MAX, STAR_MAX, 0];
    const chapterA = { id: 'mandala', slots: slots(0, 1, 2) };
    const chapterB = { id: 'renamed-in-same-batch', slots: slots(0, 1, 2) };
    const a = result();
    const b = result();
    arcTicket(stars, chapterA.slots, a);
    arcTicket(stars, chapterB.slots, b);
    expect(a).toEqual(b);
    expect(a.satisfied).toBe(false);
  });

  it('I5：门票不落档 —— 纯函数文件无 storage / save / patch 依赖', () => {
    expect(/save|storage|patch|persist/i.test(code), '⛔ 门票是实时归约，不落档').toBe(false);
  });
});
