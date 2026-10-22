/**
 * WXG-T-345 · 工程轨 T-4 / **S-3** — 门票归约纯函数
 * ─────────────────────────────────────────────────────────────────────────────
 * 判据真源（⛔ 本文件零新判据）：
 *  - `docs/architecture/adr/ADR-0034-beads-save-uid-index-flatten.md` **§6 S-3 行**
 *    （六臂：全 3★ 开 / 章内一关 2★ ⇒ 不开 / 空清单两层都假 / 首章无前置 /
 *     追加一关实时归约转假 / boss 与教学关 ⛔ 豁免 = M-17）+ **§6.1 M-16 / M-17**；
 *  - `design/gdd/save-progress.md` §2.6.3 **I5**（门票不落档，实时可算）；
 *  - `design/proposals/star-collect-rule.md` **R7**（满星门槛 = 每关 `STAR_MAX`）。
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

describe('S-3 门票归约 · 六臂', () => {
  it('臂 1：全 3★ ⇒ 开，n/N 全满', () => {
    const out = result();
    arcTicket(allFull(3), slots(0, 1, 2), out);
    expect(out.satisfied).toBe(true);
    expect(out.fullStarCount).toBe(3);
    expect(out.total).toBe(3);
    expect(out.missingCount).toBe(0);
  });

  it('臂 2：章内恰一关 2★ ⇒ 不开（差一关）', () => {
    const out = result();
    arcTicket([STAR_MAX, STAR_MAX - 1, STAR_MAX], slots(0, 1, 2), out);
    expect(out.satisfied).toBe(false);
    expect(out.fullStarCount).toBe(2);
    expect(out.total).toBe(3);
    expect(out.missingCount).toBe(1);
  });

  it('臂 3：空清单 ⇒ 两层都假（票不开 + N=0 不建进度件）', () => {
    const single = result();
    arcTicket(allFull(3), slots(), single);
    expect(single.satisfied, '空清单不得被 `every` 的空真值放行').toBe(false);
    expect(single.total).toBe(0);
    expect(single.fullStarCount).toBe(0);

    // 入口层同一口径：上一章清单存在但为空 ⇒ 同样两层都假。
    const entry = result();
    arcEntryTicket(allFull(3), slots(), entry);
    expect(entry.satisfied).toBe(false);
    expect(entry.total).toBe(0);
  });

  it('臂 4：首章无前置 ⇒ 放行且不建进度件（⛔ 造 0/0）', () => {
    const out = result();
    arcEntryTicket([], undefined, out);
    expect(out.satisfied).toBe(true);
    expect(out.total, '无前置 ⇒ 无 n/N 可言').toBe(0);
    expect(out.fullStarCount).toBe(0);
    expect(out.missingCount).toBe(0);
  });

  it('臂 5：棘轮纯函数侧 —— 追加一关 ⇒ 实时归约转假', () => {
    const before = result();
    arcTicket(allFull(2), slots(0, 1), before);
    expect(before.satisfied).toBe(true);

    // 章内追加一关（槽位 2 尚未得星）⇒ 同一存量星账的归约立即转假。
    const after = result();
    arcTicket(allFull(2), slots(0, 1, 2), after);
    expect(after.satisfied, '追加槽位必须让归约转假（已得入口的保留属 S-4 壳层臂）').toBe(false);
    expect(after.total).toBe(3);
  });

  it('臂 6（M-17）：boss 关与教学关计入 —— 首槽 2★ ⇒ 不开', () => {
    const out = result();
    // 章① 首槽 = 教学关位、末槽 = boss 关位；函数入力无 kind ⇒ 不可能豁免。
    arcTicket([STAR_MAX - 1, STAR_MAX, STAR_MAX], slots(0, 1, 2), out);
    expect(out.satisfied).toBe(false);
    expect(out.missingCount).toBe(1);
  });

  it('臂 6（M-17 镜像）：末槽（boss 位）2★ ⇒ 不开', () => {
    const out = result();
    arcTicket([STAR_MAX, STAR_MAX, STAR_MAX - 1], slots(0, 1, 2), out);
    expect(out.satisfied).toBe(false);
    expect(out.fullStarCount).toBe(2);
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

  it('星值超上限仍算满（钳值已由存档层做，归约只看 >= STAR_MAX）', () => {
    const out = result();
    arcTicket([STAR_MAX + 1], slots(0), out);
    expect(out.satisfied).toBe(true);
  });

  it('「差哪几关」按需回填到调用方数组，且不新建集合', () => {
    const out = result();
    const missing: number[] = [];
    // 星账长度 9：槽 4 满星、槽 5 零星、槽 8 差一星 ⇒ 恰 2 关未满。
    const stars = new Array<number>(9).fill(0);
    stars[4] = STAR_MAX;
    stars[8] = STAR_MAX - 1;
    arcTicket(stars, slots(4, 5, 8), out, missing);
    expect(out.missingCount).toBe(2);
    expect(missing, '回填的是关下标（0-based），供「差哪几关」二次表达').toEqual([5, 8]);
  });

  it('复用同一出参：两次调用不残留上次状态', () => {
    const out = result();
    arcTicket(allFull(2), slots(0, 1), out);
    expect(out.satisfied).toBe(true);
    arcTicket([0, 0], slots(0, 1), out);
    expect(out.satisfied).toBe(false);
    expect(out.fullStarCount).toBe(0);
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
