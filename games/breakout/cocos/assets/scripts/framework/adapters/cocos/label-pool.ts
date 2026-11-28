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
 *
 * `[WXG-T-1125]` **按序号复用（⛔ 不用 `ObjectPool` 的栈序）**：旧实现把「回收」做成
 * 「逐枚 `setVisible(false)`」，而 `ObjectPool.acquire` 是后进先出 ⇒ 相邻两帧的
 * 「池位 ↔ 文本」**整表翻转**，脏门永远打不中：每帧 N 次 `setText`（触发文本重排）
 * + 2N 次 `node.active` 翻转。真机 `文 3.0ms` 就是这么来的（T-1118 已把 9ms 降到
 * 3ms，剩下的 3ms 是翻转账）。现在第 i 条文字恒用第 i 枚节点、复用位**不隐藏**，
 * 只有「本帧没用到的尾段」才关一次 ⇒ 同内容连画两帧引擎零调用。
 */

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
  private readonly _create: () => CocosLabelLike;
  private readonly _labels: CocosLabelLike[] = [];
  private readonly _hide: ((label: CocosLabelLike) => void) | undefined;
  /** 本帧已借出的枚数（= 下一个要借的序号）。 */
  private _used = 0;
  /** 当前可见的连续前缀长度。 */
  private _shown = 0;
  /** 本帧已 `endFrame()` 收尾（二次截止与「本层本帧没画」的区分靠它）。 */
  private _closed = false;

  constructor(options: PooledLabelSourceOptions) {
    this._create = options.create;
    this._hide = options.hide;
    const initial = options.initial ?? 0;
    for (let i = 0; i < initial; i += 1) {
      const label = memoizeLabel(options.create());
      label.setVisible(false); // 未借出前不进渲染批；首借时脏门放行一次
      this._labels.push(label);
    }
  }

  acquire(): CocosLabelLike {
    let label = this._labels[this._used];
    if (label === undefined) {
      label = memoizeLabel(this._create());
      this._labels.push(label);
    }
    this._used += 1;
    this._closed = false;
    return label;
  }

  /**
   * 帧尾：只隐藏「本帧没用上」的尾段 —— 复用位一概不动。这样相邻两帧的
   * `setVisible(true)` 会被脏门拦掉，引擎零 `active` 翻转；隐藏仍发生在**本帧内**，
   * 不留一帧残影。同一帧内二次调用是 no-op（默认层与 `_labels` 常是同一个池）。
   */
  endFrame(): void {
    if (this._closed) return;
    this._closed = true;
    this._trim(this._used);
  }

  /**
   * 帧首：本层**本帧没画过**（上一帧没 `endFrame`）⇒ 全隐藏；画过的层已由
   * `endFrame()` 收过尾，这里什么都不做。
   */
  releaseAll(): void {
    if (this._closed) {
      this._closed = false;
      return;
    }
    this._trim(0);
  }

  private _trim(keep: number): void {
    for (let i = keep; i < this._shown; i += 1) {
      const label = this._labels[i]!;
      if (this._hide) this._hide(label);
      else label.setVisible(false);
    }
    this._shown = keep;
    this._used = 0;
  }

  /** 本帧借出的 label 数。 */
  get activeCount(): number {
    return this._used;
  }

  get createdCount(): number {
    return this._labels.length;
  }
}
