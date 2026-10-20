/**
 * Safe-area bands in design space (ADR-0032 §3).
 *
 * One pure conversion from {@link PlatformInfo} (logical px, origin top-left)
 * plus {@link Viewport} (design units), cached so a device / viewport change is
 * computed once. Every band is y-up (origin bottom-left), matching the render
 * model; the capsule rect is flipped to the same orientation.
 *
 * `PlatformInfo` insets of `0` are honest values (no notch / no home bar); a
 * missing capsule is `null`, never a zero rect.
 */
import type { CapsuleRect, PlatformInfo } from '../game/game.js';
import type { FitResult, Viewport } from '../render/viewport.js';

/** Half-open vertical band in design px (y-up). */
export interface SafeBand {
    readonly bottom: number;
    readonly top: number;
    readonly height: number;
}

export interface SafeInsets {
    readonly width: number;
    readonly height: number;
    /** Top inset (design px); `0` = no notch. */
    readonly top: number;
    /** Bottom inset (home bar / Android keys); `0` = none. */
    readonly bottom: number;
    /** Capsule rect in design px, y-up; `null` = host has no capsule (⛔ not a zero rect). */
    readonly capsule: CapsuleRect | null;
    /** Reserved top band `contentTop..height` (status bar + capsule). */
    readonly topBar: SafeBand;
    /** Safe content band `bottom..contentTop`. */
    readonly content: SafeBand;
    /** Reserved bottom band `0..bottom`. */
    readonly bottomBar: SafeBand;
}

/** Pure: `PlatformInfo` + fitted `Viewport` → design-space bands. */
export function computeSafeInsets(platform: PlatformInfo, viewport: Viewport): SafeInsets {
    const width = viewport.designWidth;
    const height = viewport.designHeight;
    // dp → design units: the design rect is scaled uniformly, so 1/scale is the
    // honest ratio even on letterboxed screens (width ratio is not, on tablets).
    const scale = viewport.fit.scale;
    const k = scale > 0 ? 1 / scale : 1;
    const top = clamp(platform.safeAreaTop * k, 0, height);
    const bottom = clamp(platform.safeAreaBottom * k, 0, height);
    const capsule = platform.capsuleRectDp ? toDesignRect(platform.capsuleRectDp, k, height) : null;
    // Content stops at the lower of the safe top and the capsule bottom edge.
    const contentTop = clamp(
        Math.min(height - top, capsule !== null ? capsule.bottom : height),
        bottom,
        height,
    );
    return {
        width,
        height,
        top,
        bottom,
        capsule,
        topBar: { bottom: contentTop, top: height, height: height - contentTop },
        content: { bottom, top: contentTop, height: contentTop - bottom },
        bottomBar: { bottom: 0, top: bottom, height: bottom },
    };
}

/** Caches one result per (`PlatformInfo` instance, `Viewport.fit` identity). */
export class SafeInsetsCache {
    private _platform: PlatformInfo | null = null;
    private _fit: FitResult | null = null;
    private _insets: SafeInsets | null = null;

    get(platform: PlatformInfo, viewport: Viewport): SafeInsets {
        if (this._insets !== null && this._platform === platform && this._fit === viewport.fit) {
            return this._insets;
        }
        this._platform = platform;
        this._fit = viewport.fit;
        this._insets = computeSafeInsets(platform, viewport);
        return this._insets;
    }
}

/** Source rect is y-down from the top-left; flip into y-up design space. */
function toDesignRect(rect: CapsuleRect, k: number, height: number): CapsuleRect {
    return {
        left: rect.left * k,
        right: rect.right * k,
        bottom: height - rect.bottom * k,
        top: height - rect.top * k,
    };
}

function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return value < min ? min : value > max ? max : value;
}
