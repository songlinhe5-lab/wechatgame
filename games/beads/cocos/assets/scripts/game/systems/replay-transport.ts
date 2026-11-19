/**
 * EP15-S4/S5 · 回放页传输带命中（`ux/bot-replay-spec.md §3.2`）。
 *
 * 纯几何、零渲染依赖 ⇒ 壳层可直用（⛔ 壳不必 import `view/**`，守 L6 方向）；
 * 与 `view/replay-page.ts` 共用 `config/tuning/replay-ui.ts` 的同一组矩形。
 */

import {
  REPLAY_END_PRIMARY,
  REPLAY_END_SECONDARY,
  REPLAY_EXIT_RECT,
  REPLAY_PLAY_RECT,
  REPLAY_PROGRESS_HIT,
  REPLAY_SPEED_RECT,
} from '../config/tuning';

export type ReplayHit = 'exit' | 'toggle' | 'seek' | 'speed' | 'end-primary' | 'end-secondary' | null;

export function hitReplayPage(x: number, y: number, ended: boolean): ReplayHit {
  if (ended) {
    if (inRect(REPLAY_END_PRIMARY, x, y)) return 'end-primary';
    if (inRect(REPLAY_END_SECONDARY, x, y)) return 'end-secondary';
    return null; // 结束条期：条外零响应
  }
  if (inRect(REPLAY_EXIT_RECT, x, y)) return 'exit';
  if (inRect(REPLAY_PLAY_RECT, x, y)) return 'toggle';
  if (inRect(REPLAY_PROGRESS_HIT, x, y)) return 'seek';
  if (inRect(REPLAY_SPEED_RECT, x, y)) return 'speed';
  return null;
}

function inRect(r: { x: number; bottom: number; w: number; h: number }, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.bottom && y <= r.bottom + r.h;
}
