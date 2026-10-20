/**
 * ResultPanelClock — 四个结算弹窗共享的**开合 / 入场骨架**（UI-33）。
 *
 * 收口两件（ADR-0032 §1「弹窗动画各面板自带 ⇒ 同一件事四份实现」）：
 *  1. **开合状态机**：改用框架 `ModalLifecycle`（时长仍由本模块给 `PANEL_IN_MS` /
 *     `PANEL_OUT_MS`）—— `ClearPanel` / `SprintSettlePanel` / `FinishPanel` 自持的状态类退役；
 *  2. **逐项入场节奏**：星级逐颗（`CLEAR_STAR_STEP_MS`）与通关逐关（`FINISH_LEVEL_STEP_MS`）
 *     本是同一公式两份实现 ⇒ 合为 `popsShown` / `popScale`，步长由调用方传入。
 *
 * ⛔ 布局与命中纯函数仍住各自 `*-panel.ts`（§8：就地保留、由 Presenter 调用），本模块不猜几何。
 * 失败面板无开合时钟（由相位直接驱动，旧实现亦然）⇒ 不持本骨架。
 *
 * 口径与旧实现逐条一致：`open()` 当帧即可点（入场期也算）、退场期零响应、未显示时
 * `progress = 0`；唯一有意变化 = 入场中途反向时从当前进度续走（旧实现跳回 0）。
 */
import { ModalLifecycle } from '@wxgame/framework';
import { PANEL_IN_MS, PANEL_OUT_MS } from '../config/tuning.js';

export class ResultPanelClock {
  private readonly _modal = new ModalLifecycle();
  /** 自打开起的毫秒数（逐项入场计时用；退场中按旧口径从 0 重计）。 */
  private _elapsedMs = 0;

  open(): void {
    this._elapsedMs = 0;
    this._modal.open(PANEL_IN_MS);
  }

  close(): void {
    if (this._modal.phase === 'closed') return;
    this._elapsedMs = 0;
    this._modal.close(PANEL_OUT_MS);
  }

  update(dtMs: number): void {
    if (!this.visible) return;
    const step = Math.max(0, dtMs);
    this._elapsedMs += step;
    this._modal.update(step);
    if (!this.visible) this._elapsedMs = 0;
  }

  /** True while anything is drawn (including the exit fade). */
  get visible(): boolean {
    return this._modal.phase !== 'closed';
  }

  /** True while the panel accepts taps — **including the entrance ramp**. */
  get interactive(): boolean {
    return this._modal.phase === 'open' || this._modal.phase === 'opening';
  }

  /** 0 → 1 on the way in, 1 → 0 on the way out;未显示 = 0。 */
  get progress(): number {
    return this._modal.progress;
  }

  /**
   * 已入场项数（`0..count`）：第 `i` 项在 `i × stepMs` 时入场；退场中恒 0。
   */
  popsShown(count: number, stepMs: number): number {
    if (this._modal.phase === 'closed' || this._modal.phase === 'closing') return 0;
    let shown = 0;
    for (let i = 0; i < count; i++) {
      if (this._elapsedMs >= i * stepMs) shown = i + 1;
    }
    return shown;
  }

  /** 第 `index` 项的入场缩放（`stepMs` 内 0 → 1.2 → 1；之后恒 1）。 */
  popScale(index: number, stepMs: number): number {
    if (this._modal.phase === 'closed') return 0;
    const local = (this._elapsedMs - index * stepMs) / stepMs;
    if (local <= 0) return 0;
    if (local >= 1) return 1;
    return local < 0.5 ? (local / 0.5) * 1.2 : 1.2 - 0.2 * ((local - 0.5) / 0.5);
  }
}
