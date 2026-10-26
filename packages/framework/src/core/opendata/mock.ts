/**
 * Scriptable open-data provider for Node tests and the browser harness (ADR-0035 S-1).
 *
 * Replies are **synchronous** inside `send` — no timers, so tests never await and
 * no `Math.random()` is involved (L4). The mock deliberately does not judge version
 * compatibility: it echoes the configured version and lets the host decide.
 */

import { OPEN_DATA_VERSION } from './protocol.js';
import type { HostToOpenData, OpenDataToHost, RankErrorCode } from './protocol.js';
import type { OpenDataProvider } from './provider.js';

export interface MockOpenDataOptions {
  /** Defaults to `OPEN_DATA_VERSION`; pass `0` to simulate a mismatched subdomain. */
  readonly version?: number;
  /** Defaults to true. */
  readonly autoReply?: boolean;
  /** `rank:query` reply count. Defaults to 0. */
  readonly rows?: number;
  /** When set, `rank:query` replies `rank:error` instead of `rank:ready`. */
  readonly failCode?: RankErrorCode;
}

export class MockOpenDataProvider implements OpenDataProvider {
  /** Every message passed to `send`, in order — for assertions and debugging. */
  readonly sent: HostToOpenData[] = [];

  private readonly _listeners: Array<(event: OpenDataToHost) => void> = [];
  private readonly _version: number;
  private readonly _autoReply: boolean;
  private readonly _rows: number;
  private readonly _failCode: RankErrorCode | undefined;
  private _destroyed = false;

  constructor(options: MockOpenDataOptions = {}) {
    this._version = options.version ?? OPEN_DATA_VERSION;
    this._autoReply = options.autoReply ?? true;
    this._rows = options.rows ?? 0;
    this._failCode = options.failCode;
  }

  send(message: HostToOpenData): void {
    if (this._destroyed) return;
    this.sent.push(message);
    if (!this._autoReply) return;
    switch (message.type) {
      case 'init':
        this.emit({ type: 'ready', version: this._version });
        return;
      case 'rank:query':
        if (this._failCode) {
          this.emit({ type: 'rank:error', board: message.board, code: this._failCode });
          return;
        }
        this.emit({ type: 'rank:ready', board: message.board, count: this._rows });
        return;
      default:
        return;
    }
  }

  /** Drive the host side manually (tests / harness). */
  emit(event: OpenDataToHost): void {
    if (this._destroyed) return;
    for (const cb of this._listeners) cb(event);
  }

  onMessage(cb: (event: OpenDataToHost) => void): () => void {
    if (this._destroyed) return () => {};
    this._listeners.push(cb);
    return () => {
      const index = this._listeners.indexOf(cb);
      if (index >= 0) this._listeners.splice(index, 1);
    };
  }

  destroy(): void {
    this._destroyed = true;
    this._listeners.length = 0;
  }
}
