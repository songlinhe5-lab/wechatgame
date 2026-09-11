import { describe, expect, it } from 'vitest';
import { AudioScheduler, NullAudioBackend } from '../../src/core/audio/audio.js';

describe('AudioScheduler', () => {
  it('queues and dispatches once per frame', () => {
    const backend = new NullAudioBackend();
    const audio = new AudioScheduler(backend);
    audio.play('bounce');
    audio.play('brick');
    expect(audio.pendingCount).toBe(2);
    expect(backend.played).toEqual([]);
    audio.flush(1 / 60);
    expect(backend.played).toEqual(['bounce', 'brick']);
    expect(audio.pendingCount).toBe(0);
  });

  it('deduplicates identical clips within one frame', () => {
    const backend = new NullAudioBackend();
    const audio = new AudioScheduler(backend);
    for (let i = 0; i < 50; i++) audio.play('brick');
    audio.flush(1 / 60);
    expect(backend.played).toEqual(['brick']);
  });

  it('rate-limits repeats across frames via minInterval', () => {
    const backend = new NullAudioBackend();
    const audio = new AudioScheduler(backend);
    audio.play('hit', { minInterval: 0.05 });
    audio.flush(0.016);
    audio.play('hit', { minInterval: 0.05 });
    audio.flush(0.016);
    expect(backend.played).toEqual(['hit']);
    audio.flush(0.05); // enough time has passed
    audio.play('hit', { minInterval: 0.05 });
    audio.flush(0.001);
    expect(backend.played).toEqual(['hit', 'hit']);
  });

  it('caps the number of distinct sounds per frame', () => {
    const backend = new NullAudioBackend();
    const audio = new AudioScheduler(backend, { maxPerFrame: 2 });
    audio.play('a');
    audio.play('b');
    audio.play('c');
    audio.flush(1 / 60);
    expect(backend.played).toEqual(['a', 'b']);
  });

  it('applies the master volume', () => {
    const received: number[] = [];
    const backend = {
      play: (_id: string, opts: { volume: number }) => received.push(opts.volume),
      stop: () => {},
      stopAll: () => {},
    };
    const audio = new AudioScheduler(backend);
    audio.setMasterVolume(0.5);
    audio.play('x', { volume: 0.8 });
    audio.flush(1 / 60);
    expect(received[0]).toBeCloseTo(0.4, 6);
  });

  it('clamps the master volume', () => {
    const audio = new AudioScheduler();
    audio.setMasterVolume(5);
    expect(audio.masterVolume).toBe(1);
    audio.setMasterVolume(-1);
    expect(audio.masterVolume).toBe(0);
  });

  it('drops queued sounds and stops the backend when muted', () => {
    const backend = new NullAudioBackend();
    const audio = new AudioScheduler(backend);
    audio.setMuted(true);
    audio.play('x');
    expect(audio.pendingCount).toBe(0);
    audio.flush(1 / 60);
    expect(backend.played).toEqual([]);
  });

  it('forwards stop/stopAll to the backend', () => {
    let stopped: string | null = null;
    let stoppedAll = false;
    const backend = {
      play: () => {},
      stop: (id: string) => {
        stopped = id;
      },
      stopAll: () => {
        stoppedAll = true;
      },
    };
    const audio = new AudioScheduler(backend);
    audio.stop('music');
    audio.stopAll();
    expect(stopped).toBe('music');
    expect(stoppedAll).toBe(true);
  });

  it('no-ops flush when nothing is queued', () => {
    const backend = new NullAudioBackend();
    const audio = new AudioScheduler(backend);
    expect(() => audio.flush(1 / 60)).not.toThrow();
    expect(backend.played).toEqual([]);
  });
});
