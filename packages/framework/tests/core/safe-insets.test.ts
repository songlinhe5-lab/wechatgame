import { describe, expect, it } from 'vitest';
import type { PlatformInfo } from '../../src/core/game/game.js';
import { Viewport } from '../../src/core/render/viewport.js';
import { SafeInsetsCache, computeSafeInsets } from '../../src/core/ui/safe-insets.js';

function platform(overrides: Partial<PlatformInfo> = {}): PlatformInfo {
  return {
    name: 'weapp',
    isMiniGame: true,
    safeAreaTop: 47,
    safeAreaBottom: 34,
    capsuleBottomDp: 83,
    capsuleRectDp: { left: 278, top: 51, right: 365, bottom: 83 },
    ...overrides,
  };
}

/** 390×844 dp phone, 750×1334 design → scale 0.52, k = 1/0.52 ≈ 1.923. */
function phone(): Viewport {
  const viewport = new Viewport(750, 1334);
  viewport.resize(390, 844);
  return viewport;
}

describe('computeSafeInsets', () => {
  it('converts dp insets and the capsule rect into design space (y-up)', () => {
    const insets = computeSafeInsets(platform(), phone());
    expect(insets.width).toBe(750);
    expect(insets.height).toBe(1334);
    expect(insets.top).toBeCloseTo(90.3846, 3);
    expect(insets.bottom).toBeCloseTo(65.3846, 3);
    expect(insets.capsule?.left).toBeCloseTo(534.6154, 3);
    expect(insets.capsule?.right).toBeCloseTo(701.9231, 3);
    // y flipped: capsule bottom (y-up) sits below its top edge.
    expect(insets.capsule?.bottom).toBeCloseTo(1174.3846, 3);
    expect(insets.capsule?.top).toBeCloseTo(1235.9231, 3);
  });

  it('splits the screen into topBar / content / bottomBar bands', () => {
    const insets = computeSafeInsets(platform(), phone());
    expect(insets.topBar).toEqual({
      bottom: insets.content.top,
      top: 1334,
      height: 1334 - insets.content.top,
    });
    expect(insets.content.bottom).toBeCloseTo(65.3846, 3);
    expect(insets.content.top).toBeCloseTo(1174.3846, 3);
    expect(insets.content.height).toBeCloseTo(1109, 3);
    expect(insets.bottomBar).toEqual({
      bottom: 0,
      top: insets.bottom,
      height: insets.bottom,
    });
  });

  it('stops the content at the safe top when that is lower than the capsule', () => {
    const insets = computeSafeInsets(
      platform({ capsuleBottomDp: 40, capsuleRectDp: { left: 278, top: 20, right: 365, bottom: 40 } }),
      phone(),
    );
    expect(insets.content.top).toBeCloseTo(1334 - 90.3846, 3); // safe top wins
    expect(insets.capsule).not.toBeNull();
  });

  it('keeps the capsule null (not a zero rect) when the host has none', () => {
    const insets = computeSafeInsets(
      platform({
        name: 'node',
        isMiniGame: false,
        safeAreaTop: 0,
        safeAreaBottom: 0,
        capsuleBottomDp: null,
        capsuleRectDp: null,
      }),
      phone(),
    );
    expect(insets.capsule).toBeNull();
    expect(insets.top).toBe(0);
    expect(insets.bottom).toBe(0);
    expect(insets.topBar.height).toBe(0);
    expect(insets.content.height).toBe(1334);
  });

  it('uses 1/scale (not the width ratio) on letterboxed screens', () => {
    const viewport = new Viewport(750, 1334);
    viewport.resize(1024, 768); // height-limited: scale = 768/1334
    const insets = computeSafeInsets(platform(), viewport);
    expect(insets.top).toBeCloseTo(47 / (768 / 1334), 3);
  });

  it('clamps insets that exceed the screen', () => {
    const insets = computeSafeInsets(platform({ safeAreaTop: 10_000 }), phone());
    expect(insets.content.height).toBe(0);
    expect(insets.content.top).toBe(insets.bottom);
    expect(insets.topBar.height).toBeCloseTo(1334 - insets.bottom, 6);
  });
});

describe('SafeInsetsCache', () => {
  it('reuses the result until the platform or viewport changes', () => {
    const cache = new SafeInsetsCache();
    const p = platform();
    const viewport = phone();
    const first = cache.get(p, viewport);
    expect(cache.get(p, viewport)).toBe(first);
    viewport.resize(390, 900);
    const second = cache.get(p, viewport);
    expect(second).not.toBe(first);
    expect(cache.get(platform(), viewport)).not.toBe(second);
  });
});
