/**
 * Reduced-motion decision table — implementation of
 * `art/assets-spec.md §6.1` (shutdown list) and `§6.2` (keep list),
 * wired to the accessibility commitment D1 in `art/accessibility.md §2`.
 *
 * The switch (`settings.reduceMotion`) is a pure presentation concern: it must
 * never change physics, scoring or level flow. Everything here branches on the
 * boolean and nothing else, so the table is trivially unit-testable and the
 * view layer can render straight from it without knowing the spec.
 *
 * Principle (§6 header): turn off "motion / particles / shake", keep "hit
 * readability" (flash, colour change, score popups). The keep-list entries are
 * hard-wired to their default values and MUST NOT depend on the switch.
 */

/** Default-effect values (assets-spec §6.1 "默认" column). */
export const MOTION_DEFAULTS = {
  /** Screen shake on a bomb blast: ≤120 ms, ≤6 px (D2 red-line compliant). */
  shakeAmplitudePx: 6,
  shakeDurationS: 0.12,
  /** Brick-burst particles: 8–12 per destroy, 160 ms (spec midpoint 10). */
  brickBurstParticles: 10,
  /** Steel spark particles: 6 per hit, 120 ms. */
  steelSparkParticles: 6,
  /** Level-clear confetti: 24 particles, 800 ms. */
  confettiParticles: 24,
  /** Ball trail ghost layers (§B3: high-speed tracking aid). */
  ballTrailLayers: 8,
} as const;

/**
 * Per-frame effect levels the renderer and VFX hooks read.
 *
 * Shutdown-list items become their reduced value (`0` particles / layers,
 * `false` for motion loops) when `reduceMotion` is on; keep-list items stay at
 * their default regardless of the switch.
 */
export interface MotionEffects {
  // ── §6.1 shutdown list (9 items) ──────────────────────────────────────────
  /** 1. Screen shake on bomb blasts (amplitude in px; 0 = off). */
  readonly shakeAmplitudePx: number;
  /** 2. Brick-burst particle count (0 = off; the 160 ms scale-fade remains). */
  readonly brickBurstParticles: number;
  /** 3. Steel-spark particle count (0 = off). */
  readonly steelSparkParticles: number;
  /** 4. Level-clear confetti particle count (0 = off). */
  readonly confettiParticles: number;
  /** 5. Ball trail ghost layers (0 = off; the ball body + outline remain). */
  readonly ballTrailLayers: number;
  /** 6. Bomb shockwave ring (Ø136 / 400 ms); off keeps only the blast flash. */
  readonly bombShockwave: boolean;
  /** 7. Panel scale-in (0.9→1.0); off means a pure alpha fade instead. */
  readonly panelScale: boolean;
  /** 8. Periodic ambient "breathing"/pulsing loops (title neon, launcher bob). */
  readonly ambientPulse: boolean;
  /** 9. Combo-multiplier pulse (1.3× / 120 ms); off = static number change. */
  readonly comboPulse: boolean;

  // ── §6.2 keep list (7 items — always on, never gated by the switch) ──────
  /** Brick/wall hit flash (80 ms, local, <3 Hz — D2-safe). */
  readonly hitFlash: boolean;
  /** Brick 160 ms scale-fade on destroy. */
  readonly brickFadeOut: boolean;
  /** Score popup float (600 ms) + combo number change. */
  readonly scorePopup: boolean;
  /** Damaged brick state (brightness −30% + cracks). */
  readonly damagedState: boolean;
  /** Life-pip / level-number HUD updates. */
  readonly hudStatusUpdates: boolean;
  /** UI alpha fades + the 150 ms pause overlay. */
  readonly uiFade: boolean;
  /** Ball motion & bounces themselves — the game, obviously. */
  readonly ballMotion: boolean;
}

/** Resolve the effect table for a `reduceMotion` switch state. */
export function resolveMotionEffects(reduceMotion: boolean): MotionEffects {
  return {
    // §6.1 — off when reduced, defaults otherwise.
    shakeAmplitudePx: reduceMotion ? 0 : MOTION_DEFAULTS.shakeAmplitudePx,
    brickBurstParticles: reduceMotion ? 0 : MOTION_DEFAULTS.brickBurstParticles,
    steelSparkParticles: reduceMotion ? 0 : MOTION_DEFAULTS.steelSparkParticles,
    confettiParticles: reduceMotion ? 0 : MOTION_DEFAULTS.confettiParticles,
    ballTrailLayers: reduceMotion ? 0 : MOTION_DEFAULTS.ballTrailLayers,
    bombShockwave: !reduceMotion,
    panelScale: !reduceMotion,
    ambientPulse: !reduceMotion,
    comboPulse: !reduceMotion,

    // §6.2 — constants. A regression here is a spec violation, not a style choice.
    hitFlash: true,
    brickFadeOut: true,
    scorePopup: true,
    damagedState: true,
    hudStatusUpdates: true,
    uiFade: true,
    ballMotion: true,
  };
}

/** The table with the switch off — identical to the defaults, exposed for tests. */
export const MOTION_FULL: MotionEffects = resolveMotionEffects(false);

/** Convenience: is any motion (shake/trail/particles) currently suppressed? */
export function isMotionReduced(effects: MotionEffects): boolean {
  return effects.ballTrailLayers === 0 && !effects.bombShockwave && !effects.comboPulse;
}
