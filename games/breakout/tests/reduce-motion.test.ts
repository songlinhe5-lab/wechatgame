/**
 * Reduced-motion switch (accessibility D1) — assets-spec.md §6.1/§6.2.
 *
 * Covers the TC-A11Y family that can be exercised on Node:
 *   - the §6.1/§6.2 effect table for both switch states
 *   - persistence through the settings channel (TC-A11Y-05)
 *   - legacy-save migration (missing field repairs to `false` and writes back)
 *   - live behaviour: shake/trail shutdown, keep-list invariance
 *
 * The two G4-critical criteria (TC-A11Y-01/02) are asserted in
 * `g4-regression.test.ts`; this file holds the supporting coverage.
 */

import { describe, expect, it } from 'vitest';

import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createHarness, aimAt } from './helpers.js';
import {
  MOTION_DEFAULTS,
  MOTION_FULL,
  isMotionReduced,
  resolveMotionEffects,
} from '../src/systems/motion.js';
import { SAVE_KEY } from '../src/game/save-schema.js';
import type { LevelDef } from '@wxgame/framework';

/** One normal brick + one bomb brick — the shake source. */
const BOMB_LEVEL: LevelDef = {
  id: 'qa-bomb',
  name: 'Bomb',
  layout: ['NB'],
  legend: {
    N: { hp: 1, score: 100, color: '#4cc9f0' },
    B: { hp: 1, score: 150, color: '#ff6b3d' },
  },
};

/** A save document with `reduceMotion: true` preloaded into storage. */
function storageWithReduceMotion(on: boolean) {
  const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
  const storage = platform.createStorage();
  storage.set(
    SAVE_KEY,
    JSON.stringify({
      version: 1,
      currentLevel: 1,
      maxUnlockedLevel: 1,
      settings: { reduceMotion: on },
      stats: { runs: 1 },
    }),
  );
  return storage;
}

// ───────────────────────────────────────────── effect table (§6.1 / §6.2)

describe('motion effect table (assets-spec §6.1/§6.2)', () => {
  it('with the switch OFF, every effect plays at its default level', () => {
    const m = resolveMotionEffects(false);
    expect(m).toEqual(MOTION_FULL); // resolveMotionEffects(false) is the canonical full table
    expect(m.shakeAmplitudePx).toBe(MOTION_DEFAULTS.shakeAmplitudePx);
    expect(m.brickBurstParticles).toBeGreaterThan(0);
    expect(m.steelSparkParticles).toBeGreaterThan(0);
    expect(m.confettiParticles).toBeGreaterThan(0);
    expect(m.ballTrailLayers).toBe(MOTION_DEFAULTS.ballTrailLayers);
    expect(m.bombShockwave).toBe(true);
    expect(m.panelScale).toBe(true);
    expect(m.ambientPulse).toBe(true);
    expect(m.comboPulse).toBe(true);
  });

  it('with the switch ON, all 9 shutdown-list items are off (§6.1)', () => {
    const m = resolveMotionEffects(true);
    expect(m.shakeAmplitudePx).toBe(0);
    expect(m.brickBurstParticles).toBe(0);
    expect(m.steelSparkParticles).toBe(0);
    expect(m.confettiParticles).toBe(0);
    expect(m.ballTrailLayers).toBe(0);
    expect(m.bombShockwave).toBe(false);
    expect(m.panelScale).toBe(false);
    expect(m.ambientPulse).toBe(false);
    expect(m.comboPulse).toBe(false);
    expect(isMotionReduced(m)).toBe(true);
  });

  it('the 7 keep-list items are INVARIANT — true with the switch on or off (§6.2)', () => {
    const off = resolveMotionEffects(false);
    const on = resolveMotionEffects(true);
    for (const key of [
      'hitFlash',
      'brickFadeOut',
      'scorePopup',
      'damagedState',
      'hudStatusUpdates',
      'uiFade',
      'ballMotion',
    ] as const) {
      expect(off[key]).toBe(true);
      expect(on[key]).toBe(true);
    }
  });
});

// ───────────────────────────────────────────── persistence (TC-A11Y-05)

describe('reduce-motion persistence (settings channel, TC-A11Y-05)', () => {
  it('setReduceMotion writes through the save and survives a relaunch', () => {
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const storage = platform.createStorage();
    const h = createHarness({ storage, saveKey: SAVE_KEY });
    expect(h.game.reduceMotion).toBe(false);

    h.game.setReduceMotion(true);
    expect(h.count('settings:changed')).toBe(1);
    const written = JSON.parse(storage.get(SAVE_KEY)!);
    expect(written.settings.reduceMotion).toBe(true);

    // Relaunch: a fresh game over the same storage adopts the saved switch.
    const h2 = createHarness({ storage, saveKey: SAVE_KEY });
    expect(h2.game.reduceMotion).toBe(true);
    expect(h2.game.snapshot.motion.ballTrailLayers).toBe(0);
  });

  it('a legacy save without the field defaults to false and repairs on write-back', () => {
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const storage = platform.createStorage();
    storage.set(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        currentLevel: 1,
        maxUnlockedLevel: 1,
        settings: { sfx: true, music: true, vibrate: true, controlMode: 'absolute' },
        stats: { runs: 1 },
      }),
    );

    const h = createHarness({ storage, saveKey: SAVE_KEY });
    expect(h.game.reduceMotion).toBe(false);
    // §6.8: the repair is written back exactly once, so the document now
    // carries the field and a second boot sees no change.
    const written = JSON.parse(storage.get(SAVE_KEY)!);
    expect(written.settings.reduceMotion).toBe(false);
  });
});

// ───────────────────────────────────────────── live behaviour

describe('reduce-motion live behaviour (assets-spec §6.1/§6.2)', () => {
  it('a bomb blast shakes the arena when the switch is OFF', () => {
    const h = createHarness({ levels: [BOMB_LEVEL] });
    h.game.launch();
    const bomb = h.game.bricks.find((b) => b.type === 'B')!;
    aimAt(h.game, bomb);
    h.advance(0.05);
    expect(h.game.snapshot.shakeAmplitude).toBeGreaterThan(0);
  });

  it('with the switch ON, a bomb blast produces zero shake and an empty trail (§6.1)', () => {
    const h = createHarness({ storage: storageWithReduceMotion(true), saveKey: SAVE_KEY, levels: [BOMB_LEVEL] });
    expect(h.game.reduceMotion).toBe(true);
    h.game.launch();
    const bomb = h.game.bricks.find((b) => b.type === 'B')!;
    aimAt(h.game, bomb);
    h.advance(0.3);
    expect(h.game.snapshot.shakeAmplitude).toBe(0);
    expect(h.game.snapshot.ballTrail).toHaveLength(0);
  });

  it('with the switch ON, the keep-list feedback still plays (§6.2)', () => {
    const h = createHarness({ storage: storageWithReduceMotion(true), saveKey: SAVE_KEY, levels: [BOMB_LEVEL] });
    h.game.launch();
    const normal = h.game.bricks.find((b) => b.type === 'N')!;
    aimAt(h.game, normal);
    h.advance(0.3);

    // Core feedback is intact: the brick actually broke, score moved, and the
    // ball is still flying (ballMotion).
    expect(normal.destroyed).toBe(true);
    expect(h.count('brick:destroyed')).toBeGreaterThanOrEqual(1);
    expect(h.count('score:changed')).toBeGreaterThanOrEqual(1);
    expect(h.game.ball.launched).toBe(true);
  });

  it('with the switch OFF, the trail records up to the default layer count', () => {
    const h = createHarness({ levels: [BOMB_LEVEL] });
    h.game.launch();
    h.advance(0.2);
    const trail = h.game.snapshot.ballTrail;
    expect(trail.length).toBeGreaterThan(0);
    expect(trail.length).toBeLessThanOrEqual(MOTION_DEFAULTS.ballTrailLayers);
  });
});
