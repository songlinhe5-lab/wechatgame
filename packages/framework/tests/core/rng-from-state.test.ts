import { describe, expect, it } from 'vitest';
import { createRng, createRngFromState } from '../../src/core/math/rng.js';

describe('createRngFromState（EP15-S3 / ADR-0038 DEC-6）', () => {
  it('从 Rng.state 重建后与持续使用同一实例的后续流逐位一致', () => {
    const original = createRng('beads-replay');
    for (let i = 0; i < 17; i++) original.next();

    const snapshot = original.state;
    const rebuilt = createRngFromState(snapshot);

    for (let i = 0; i < 32; i++) {
      expect(rebuilt.next()).toBe(original.next());
    }
  });

  it('仓库式快照往返：state → 重建 → state 不变', () => {
    const rng = createRng(42);
    rng.next();
    const state = rng.state;
    expect(createRngFromState(state).state).toBe(state >>> 0);
  });

  it('0 也是合法状态（不套 createRng 的 0 种子兜底）', () => {
    const rng = createRngFromState(0);
    expect(rng.state).toBe(0);
    expect(Number.isFinite(rng.next())).toBe(true);
  });
});
