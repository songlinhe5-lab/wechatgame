/**
 * Open-data provider contract — engine-free (ADR-0035 §5.2 S-1).
 *
 * Real host wiring lives in `platform/` (S-2/S-5). Nothing here may import
 * `platform/*` or touch `wx`/DOM (L2).
 */

import type { HostToOpenData, OpenDataToHost } from './protocol';

export interface OpenDataProvider {
  /** Host → subdomain. Fire-and-forget; implementations must not serialize business data here. */
  send(message: HostToOpenData): void;
  /**
   * Subdomain → host status replies. Returns an unsubscribe function.
   * Subscriber exceptions are the subscriber's responsibility (same rule as EventBus).
   */
  onMessage(cb: (event: OpenDataToHost) => void): () => void;
  /** Idempotent. After destroy, `send` is silently dropped and `onMessage` never fires. */
  destroy(): void;
}

/** Node / web / hosts without an open data domain: accepts everything, delivers nothing. */
export class NoopOpenDataProvider implements OpenDataProvider {
  send(_message: HostToOpenData): void {}

  onMessage(_cb: (event: OpenDataToHost) => void): () => void {
    return () => {};
  }

  destroy(): void {}
}
