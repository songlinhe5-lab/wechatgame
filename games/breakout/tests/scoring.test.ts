import { describe, expect, it } from 'vitest';
import { Scorer, levelClearBonus, multiplierFor } from '../src/systems/scoring.js';
import { DEFAULT_TUNING } from '../src/config/tuning.js';

const T = DEFAULT_TUNING;

describe('multiplierFor', () => {
  it('starts at 1 and steps up by comboStep', () => {
    expect(multiplierFor(0, T)).toBe(1);
    expect(multiplierFor(1, T)).toBe(1);
    expect(multiplierFor(T.rules.comboStep - 1, T)).toBe(1);
    expect(multiplierFor(T.rules.comboStep, T)).toBe(1 + T.rules.comboMultiplierStep);
    expect(multiplierFor(T.rules.comboStep * 2, T)).toBe(1 + T.rules.comboMultiplierStep * 2);
  });

  it('matches the frozen §3 combo curve (step 3, +1 per step, cap ×5)', () => {
    expect(T.rules.comboStep).toBe(3);
    expect(T.rules.maxComboMultiplier).toBe(5);
    expect(multiplierFor(0, T)).toBe(1);
    expect(multiplierFor(2, T)).toBe(1);
    expect(multiplierFor(3, T)).toBe(2);
    expect(multiplierFor(5, T)).toBe(2);
    expect(multiplierFor(6, T)).toBe(3);
    expect(multiplierFor(9, T)).toBe(4);
    expect(multiplierFor(12, T)).toBe(5);
    expect(multiplierFor(999, T)).toBe(5);
  });

  it('is capped at the configured maximum', () => {
    expect(multiplierFor(1000, T)).toBe(T.rules.maxComboMultiplier);
  });

  it('is monotonic non-decreasing', () => {
    let previous = multiplierFor(0, T);
    for (let combo = 0; combo < 80; combo++) {
      const value = multiplierFor(combo, T);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('degrades safely with a degenerate comboStep', () => {
    const broken = { ...T, rules: { ...T.rules, comboStep: 0 } };
    expect(multiplierFor(10, broken)).toBe(1);
  });
});

describe('Scorer', () => {
  it('starts empty', () => {
    const s = new Scorer(T);
    expect(s.score).toBe(0);
    expect(s.combo).toBe(0);
    expect(s.multiplier).toBe(1);
  });

  it('awards base score with a x1 multiplier on the first brick', () => {
    const s = new Scorer(T);
    const points = s.onBrickDestroyed(10);
    expect(points).toBe(10);
    expect(s.score).toBe(10);
    expect(s.combo).toBe(1);
  });

  it('grows the multiplier as the chain continues', () => {
    const s = new Scorer(T);
    for (let i = 0; i < T.rules.comboStep; i++) s.onBrickDestroyed(10);
    expect(s.combo).toBe(T.rules.comboStep);
    // §3: 3 combo → ×2.
    expect(s.multiplier).toBe(1 + T.rules.comboMultiplierStep);
    const points = s.onBrickDestroyed(10);
    expect(points).toBe(10 * (1 + T.rules.comboMultiplierStep));
  });

  it('tracks the best combo of the run', () => {
    const s = new Scorer(T);
    for (let i = 0; i < 7; i++) s.onBrickDestroyed(10);
    expect(s.bestCombo).toBe(7);
    s.onPaddleHit();
    for (let i = 0; i < 3; i++) s.onBrickDestroyed(10);
    expect(s.combo).toBe(3);
    expect(s.bestCombo).toBe(7);
  });

  it('resets the chain when the paddle is touched', () => {
    const s = new Scorer(T);
    for (let i = 0; i < 10; i++) s.onBrickDestroyed(10);
    expect(s.multiplier).toBeGreaterThan(1);
    s.onPaddleHit();
    expect(s.combo).toBe(0);
    expect(s.multiplier).toBe(1);
  });

  it('resets the chain when the ball is lost but keeps the score', () => {
    const s = new Scorer(T);
    for (let i = 0; i < 10; i++) s.onBrickDestroyed(10);
    const score = s.score;
    s.onBallLost();
    expect(s.combo).toBe(0);
    expect(s.score).toBe(score);
  });

  it('counts bricks destroyed', () => {
    const s = new Scorer(T);
    s.onBrickDestroyed(10);
    s.onBrickDestroyed(25);
    expect(s.bricksDestroyed).toBe(2);
  });

  it('ignores non-positive bonuses', () => {
    const s = new Scorer(T);
    s.addBonus(0);
    s.addBonus(-100);
    expect(s.score).toBe(0);
    s.addBonus(150);
    expect(s.score).toBe(150);
  });

  it('rounds bonus values', () => {
    const s = new Scorer(T);
    s.addBonus(10.4);
    s.addBonus(10.6);
    expect(s.score).toBe(21);
  });

  it('awards a life bonus at the end of the run', () => {
    const s = new Scorer(T);
    s.onBrickDestroyed(10);
    s.endOfRunBonus(2);
    expect(s.score).toBe(10 + 2 * T.rules.lifeBonus);
  });

  it('reset clears everything', () => {
    const s = new Scorer(T);
    s.onBrickDestroyed(10);
    s.onBrickDestroyed(10);
    s.reset();
    expect([s.score, s.combo, s.bestCombo, s.bricksDestroyed]).toEqual([0, 0, 0, 0]);
  });

  it('resetCombo keeps the score', () => {
    const s = new Scorer(T);
    s.onBrickDestroyed(50);
    s.onBrickDestroyed(50);
    s.resetCombo();
    expect(s.combo).toBe(0);
    expect(s.score).toBe(100);
  });

  it('exposes a read-only view', () => {
    const s = new Scorer(T);
    s.onBrickDestroyed(10);
    expect(s.view).toEqual({ combo: 1, bestCombo: 1, multiplier: 1 });
  });
});

describe('levelClearBonus', () => {
  it('grows with the level index', () => {
    expect(levelClearBonus(T, 1, 0)).toBeGreaterThan(levelClearBonus(T, 0, 0));
  });

  it('pays for remaining lives', () => {
    expect(levelClearBonus(T, 0, 3) - levelClearBonus(T, 0, 0)).toBe(3 * T.rules.lifeBonus);
  });

  it('is always positive', () => {
    expect(levelClearBonus(T, 0, 0)).toBeGreaterThan(0);
  });
});
