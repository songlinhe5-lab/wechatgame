/**
 * Engine-free UI mechanisms (ADR-0032 §3).
 *
 * Pure state machines shared by every screen: navigation, modal animation,
 * the press-to-commit gate. Rendering and styling live in the game layer.
 * Kept free of `cc` / DOM / `wx` (L2, enforced by `check:arch`).
 */

export * from './navigator.js';
export * from './modal-lifecycle.js';
export * from './press-tracker.js';
export * from './safe-insets.js';
