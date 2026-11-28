/**
 * Frame-scoped label pool for the Cocos renderer.
 *
 * `CocosRenderModelRenderer.draw()` calls `releaseAll()` at the start of every
 * frame and `acquire()` for each text command. Net effect: the number of label
 * nodes stays at the frame's high-water mark, and none are allocated per frame
 * after warm-up.
 *
 * `[WXG-T-1118]` **setter 脏门**：每个池化 label 外面套一层记住「最近一次写入值」的
 * 包装（见 {@link memoizeLabel}）。理由 = 真机分段读数「文」段 9ms/帧：帧间大量
 * 标签内容逐字不变（LV / ★ / 标题 / 道具计数），而引擎每个 setter 都会把节点标脏
 * （`color` / `string` / `node.setPosition` 尤其），白白触发重排与重绘。值不变
 * ⇒ 一个引擎调用都不发。包装层是节点状态的**唯一写入者**，所以缓存的「上次值」
 * 恒等于节点真值（池复用跨帧同样成立）。
 */

import { ObjectPool } from '../../core/pool/object-pool';
import type { CocosLabelLike, CocosLabelSource } from './cocos-renderer';

export interface PooledLabelSourceOptions {
  /** Create a new (hidden) label node. */
  readonly create: () => CocosLabelLike;
  /** Pre-create this many labels at construction. */
  readonly initial?: number;
  /** Hide a label when it is released (so recycled nodes do not flash). */
  readonly hide?: (label: CocosLabelLike) => void;
}

/**
 * `[WXG-T-1118]` 给一个 label 套 setter 脏门。初值用「不可能等于任何真实写入」的哨兵
 * （`null` / `NaN` / `''`）⇒ 第一次写入必定透传，不会吞掉首帧内容。
 */
function memoizeLabel(label: CocosLabelLike): CocosLabelLike {
  let text: string | null = null;
  let px = Number.NaN;
  let py = Number.NaN;
  let size = Number.NaN;
  let cr = Number.NaN;
  let cg = Number.NaN;
  let cb = Number.NaN;
  let ca = Number.NaN;
  let align = '';
  let visible: boolean | null = null;
  let sibling = Number.NaN;

  const memo: CocosLabelLike = {
    setText(next: string): void {
      if (text === next) return;
      text = next;
      label.setText(next);
    },
    setPosition(x: number, y: number): void {
      if (px === x && py === y) return;
      px = x;
      py = y;
      label.setPosition(x, y);
    },
    setFontSize(next: number): void {
      if (size === next) return;
      size = next;
      label.setFontSize(next);
    },
    setColor(color): void {
      if (cr === color.r && cg === color.g && cb === color.b && ca === color.a) return;
      cr = color.r;
      cg = color.g;
      cb = color.b;
      ca = color.a;
      label.setColor(color);
    },
    setAlign(next): void {
      if (align === next) return;
      align = next;
      label.setAlign(next);
    },
    setVisible(next: boolean): void {
      if (visible === next) return;
      visible = next;
      label.setVisible(next);
    },
  };
  const setSiblingIndex = label.setSiblingIndex;
  if (setSiblingIndex) {
    memo.setSiblingIndex = (index: number): void => {
      if (sibling === index) return;
      sibling = index;
      setSiblingIndex.call(label, index);
    };
  }
  const measureWidth = label.measureWidth;
  if (measureWidth) {
    // 测量出口只是读：原样转发（渲染器自己按 label 缓存宽度，见 `_textWidth`）。
    memo.measureWidth = (t: string, s: number): number => measureWidth.call(label, t, s);
  }
  return memo;
}

export class PooledLabelSource implements CocosLabelSource {
  private readonly _pool: ObjectPool<CocosLabelLike>;
  private readonly _active: CocosLabelLike[] = [];
  private readonly _hide: ((label: CocosLabelLike) => void) | undefined;

  constructor(options: PooledLabelSourceOptions) {
    this._hide = options.hide;
    this._pool = new ObjectPool<CocosLabelLike>(() => memoizeLabel(options.create()), {
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
