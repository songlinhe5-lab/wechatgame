/**
 * 资源条「心」端文案。
 *
 * §3.14 **v1.99 改判**（用户 2026-11-07 裁定）：广告加心入口**从心的数量旁移走**
 * （改由「点开始按钮时」判断体力并弹框提示）⇒ 本函数**只出 `cur/max`**，`▶N` 全形态退役。
 *
 * 判据：
 *  - 任何持有量都只显示 `cur/max`（不再有 `▶N`，满心/未满心一致）；
 *  - `cur` 可 **> `max`**（看广告加心允许突破上限）⇒ 如实显示 `11/8`；
 *  - 签名只收两参（旧第三参已删，误传由 TS 静态拦下）。
 */
import { describe, expect, it } from 'vitest';
import { heartBarLabel } from '../src/view/meta-view.js';

describe('§3.14 v1.99 · 资源条心端文案（无 ▶N）', () => {
  it('只出 `cur/max`', () => {
    expect(heartBarLabel(3, 8)).toBe('3/8');
    expect(heartBarLabel(0, 8)).toBe('0/8');
    expect(heartBarLabel(8, 8)).toBe('8/8');
  });

  it('广告加心突破上限 ⇒ 如实显示 `>max`（不再是「溢出即弃」）', () => {
    expect(heartBarLabel(11, 8)).toBe('11/8');
    expect(heartBarLabel(13, 8)).toBe('13/8');
  });

  it('⛔ 任何输入都不再产出 `▶`（广告入口不在本处）', () => {
    for (const s of [0, 3, 8, 11]) {
      expect(heartBarLabel(s, 8)).not.toContain('▶');
    }
  });
});
