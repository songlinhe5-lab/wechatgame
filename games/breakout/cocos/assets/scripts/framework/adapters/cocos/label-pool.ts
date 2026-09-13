/**
 * Frame-scoped label pool for the Cocos renderer.
 *
 * `CocosRenderModelRenderer.draw()` calls `releaseAll()` at the start of every
 * frame and `acquire()` for each text command. Net effect: the number of label
 * nodes stays at the frame's high-water mark, and none are allocated per frame
 * after warm-up.
 */

import { ObjectPool } from '../../core/pool/object-pool.js';
import type { CocosLabelLike, CocosLabelSource } from './cocos-renderer.js';

export interface PooledLabelSourceOptions {
  /** Create a new (hidden) label node. */
  readonly create: () => CocosLabelLike;
  /** Pre-create this many labels at construction. */
  readonly initial?: number;
  /** Hide a label when it is released (so recycled nodes do not flash). */
  readonly hide?: (label: CocosLabelLike) => void;
}

export class PooledLabelSource implements CocosLabelSource {
  private readonly _pool: ObjectPool<CocosLabelLike>;
  private readonly _active: CocosLabelLike[] = [];
  private readonly _hide: ((label: CocosLabelLike) => void) | undefined;

  constructor(options: PooledLabelSourceOptions) {
    this._hide = options.hide;
    this._pool = new ObjectPool<CocosLabelLike>(options.create, {
      initial: options.initial ?? 0,
      reset: (label) => {
        label.setVisible(false);
      },
    });
  }

  acquire(): CocosLabelLike {
    const label = this._pool.acquire();
    this._active.push(label);
    return label;
  }

  releaseAll(): void {
    for (const label of this._active) {
      this._hide?.(label);
      this._pool.release(label);
    }
    this._active.length = 0;
  }

  get activeCount(): number {
    return this._active.length;
  }

  get createdCount(): number {
    return this._pool.createdCount;
  }
}
