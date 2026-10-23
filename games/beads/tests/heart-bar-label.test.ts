/**
 * 资源条「心」端文案（§3.14 v1.80 日限可见）。
 *
 * 判据：
 *  - 满心 ⇒ 广告不可用 ⇒ **不显示次数**（避免「▶5」被读成「现在能看」）；
 *  - 未满心 ⇒ 追 ` ▶N`，含 `▶0`（今日额度用尽 = 明确告知，而非静默隐藏）；
 *  - 未接线（`undefined`）⇒ 退回 `心 n/n`（旧行为，零回归）。
 */
import { describe, expect, it } from 'vitest';
import { heartBarLabel } from '../src/view/meta-view.js';

describe('§3.14 v1.80 · 资源条心端文案', () => {
  it('未接线 ⇒ 只有 n/n（旧行为）', () => {
    expect(heartBarLabel(3, 8, undefined)).toBe('3/8');
    expect(heartBarLabel(8, 8, undefined)).toBe('8/8');
  });

  it('未满心 ⇒ n/n ▶N（含 ▶0）', () => {
    expect(heartBarLabel(0, 8, 5)).toBe('0/8 ▶5');
    expect(heartBarLabel(3, 8, 2)).toBe('3/8 ▶2');
    expect(heartBarLabel(3, 8, 0)).toBe('3/8 ▶0');
  });

  it('满心 ⇒ 不显示次数（广告此时不可用）', () => {
    expect(heartBarLabel(8, 8, 5)).toBe('8/8');
    expect(heartBarLabel(8, 8, 0)).toBe('8/8');
  });
});
