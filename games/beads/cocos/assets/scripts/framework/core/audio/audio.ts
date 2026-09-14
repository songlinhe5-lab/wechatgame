/**
 * Audio scheduler.
 *
 * Gameplay requests sounds by *clip id*; the platform adapter decides how to
 * play them. The core adds two things native APIs lack and every mini-game
 * needs:
 *
 *  1. **Dedup / rate limiting** — a 60-hit-per-second brick stream must not fire
 *     60 identical `hit` sounds or we exhaust WeChat's `InnerAudioContext` pool.
 *  2. **Frame-batched dispatch** — requests are collected during update and
 *     flushed once per frame, so systems never block on audio.
 */

export interface AudioPlayOptions {
  readonly volume?: number;
  readonly loop?: boolean;
  /** Rate-limit window in seconds; identical clips inside it are dropped. */
  readonly minInterval?: number;
}

/** Lowest-level sink implemented by platform adapters. */
export interface AudioBackend {
  play(clipId: string, opts: Required<Pick<AudioPlayOptions, 'volume' | 'loop'>>): void;
  stop(clipId: string): void;
  stopAll(): void;
}

/** No-op backend used in tests and when audio is muted/unavailable. */
export class NullAudioBackend implements AudioBackend {
  readonly played: string[] = [];
  play(clipId: string): void {
    this.played.push(clipId);
  }
  stop(): void {}
  stopAll(): void {}
}

interface PendingRequest {
  clipId: string;
  volume: number;
  loop: boolean;
  minInterval: number;
}

export class AudioScheduler {
  private readonly _pending: PendingRequest[] = [];
  private readonly _lastPlayed = new Map<string, number>();
  private _time = 0;
  private _masterVolume = 1;
  private _muted = false;
  /** Hard cap on distinct sounds dispatched in a single frame. */
  private _maxPerFrame: number;

  constructor(
    private readonly _backend: AudioBackend = new NullAudioBackend(),
    options: { maxPerFrame?: number } = {},
  ) {
    this._maxPerFrame = options.maxPerFrame ?? 6;
  }

  get masterVolume(): number {
    return this._masterVolume;
  }

  setMasterVolume(v: number): void {
    this._masterVolume = v < 0 ? 0 : v > 1 ? 1 : v;
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (muted) {
      this._pending.length = 0;
      this._backend.stopAll();
    }
  }

  /**
   * Queue a sound for this frame. Duplicate clips within their `minInterval`
   * window are dropped.
   */
  play(clipId: string, opts: AudioPlayOptions = {}): void {
    if (this._muted) return;
    const minInterval = opts.minInterval ?? 0;
    if (minInterval > 0) {
      const last = this._lastPlayed.get(clipId);
      if (last !== undefined && this._time - last < minInterval) return;
    }
    this._pending.push({
      clipId,
      volume: opts.volume ?? 1,
      loop: opts.loop ?? false,
      minInterval,
    });
  }

  /** Dispatch queued sounds. Call once per frame, after gameplay update. */
  flush(dt: number): void {
    this._time += dt;
    if (this._pending.length === 0) return;

    const dispatched = new Set<string>();
    let count = 0;
    for (const req of this._pending) {
      if (count >= this._maxPerFrame) break;
      if (dispatched.has(req.clipId)) continue;
      dispatched.add(req.clipId);
      count++;
      this._lastPlayed.set(req.clipId, this._time);
      this._backend.play(req.clipId, {
        volume: req.volume * this._masterVolume,
        loop: req.loop,
      });
    }
    this._pending.length = 0;
  }

  stop(clipId: string): void {
    this._backend.stop(clipId);
  }

  stopAll(): void {
    this._backend.stopAll();
  }

  /** Number of queued-but-not-yet-flushed requests (diagnostics/tests). */
  get pendingCount(): number {
    return this._pending.length;
  }
}
