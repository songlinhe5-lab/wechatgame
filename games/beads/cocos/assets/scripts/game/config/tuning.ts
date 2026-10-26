/**
 * Beads tuning — every gameplay number lives here, none in the systems.
 *
 * ⚠️ AUTHORITY: every constant below is a mirror of
 * `design/gdd/systems-index.md §3` (the frozen single source of truth; sprint
 * constants C1–C8 frozen in §3.10, WXG-T-020). If a value here disagrees with
 * §3, **§3 wins** and this file is the bug. Do not invent values here; add them
 * to §3 first.
 *
 * Units are *design-space* units (see the framework `Viewport`). The design
 * resolution is 750 × 1334 (portrait). Design-space origin is the
 * **bottom-left**, y grows upward.
 */

export * from './tuning/layout';
export * from './tuning/visual';
export * from './tuning/board';
export * from './tuning/gameplay';
export * from './tuning/menu';
export * from './tuning/motion';
export * from './tuning/bead-style';
export * from './tuning/audio';
export * from './tuning/powerup-layout';
