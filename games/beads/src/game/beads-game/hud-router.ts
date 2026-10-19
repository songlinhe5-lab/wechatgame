/**
 * PLAYING 相位界面控件的点击路由（缩放 / 齿轮 / 道具卡 / 展开按钮），从 `BeadsGame._routeTap` 拆出。
 *
 * 判定顺序（与拆分前逐字一致，不可调换）：
 *  1. 缩放控件（仅 PLAYING）：命中即吞掉，不落盘、不进道具/托盘路由。
 *  2. 齿轮（**所有相位**先于相位分派判定）：PLAYING ⇒ 手动暂停并消费；其余相位命中 ⇒ 吞掉但不计消费
 *     （pause-settings §2.1 / §8-7：其余状态点齿轮 = 忽略，且不得落到相位的通用行为）。
 *  3. 道具卡（仅 PLAYING）：零噪声 —— 超限 / 空作用也在此消化，不落到托盘与网格（§2.6）。
 *  4. 展开按钮（仅 PLAYING）：布局 A（powerups §2.6）⇒ 只给占位轻提示，零事件、零扣次、零广告调用。
 *
 * 返回 `'pass'` 时由 `BeadsGame` 继续相位分派（托盘 / 网格 / 面板）。
 */
import { AUDIO_CLIP_UI_TAP } from '../../config/tuning.js';
import type { PowerupType } from '../../config/tuning.js';
import type { BeadsPhase } from '../state.js';
import type { BoardCameraController } from './board-camera-controller.js';
import { hitExpandButton, hitGear, hitPowerupCard } from './hit-test.js';

/** `pass` 放行；`consumed` 计入本次点击；`swallowed` 吞掉但不计消费。 */
export type HudTapResult = 'pass' | 'consumed' | 'swallowed';

/** 宿主接口：界面控件路由需要的面（由 `BeadsGame` 以 getter / 方法接线）。 */
export interface HudRouterHost {
  readonly board: BoardCameraController;
  /** HUD 带上移量（热区与渲染同源，见 `BeadsGame._hudDy`）。 */
  readonly hudDy: number;
  readonly trayExpanded: boolean;
  sfx(clipId: string): void;
  pauseManual(): void;
  usePowerup(type: PowerupType): void;
  /** 展开按钮的占位轻提示（布局 A：零事件）。 */
  showExpandPlaceholder(): void;
}

export class HudRouter {
  constructor(private readonly _host: HudRouterHost) {}

  route(phase: BeadsPhase, x: number, y: number): HudTapResult {
    const h = this._host;
    const playing = phase === 'playing';

    // 1. 缩放控件（盘面下方净空带）。
    if (playing && h.board.zoomDown(x, y, true)) {
      h.sfx(AUDIO_CLIP_UI_TAP);
      return 'consumed';
    }

    // 2. 齿轮：先于相位分派，非 PLAYING 亦吞掉。
    if (hitGear(x, y, h.hudDy)) {
      if (playing) {
        h.pauseManual();
        return 'consumed';
      }
      return 'swallowed';
    }

    if (!playing) return 'pass';

    // 3. 道具卡。
    const card = hitPowerupCard(x, y);
    if (card) {
      h.sfx(AUDIO_CLIP_UI_TAP);
      h.usePowerup(card);
      return 'consumed';
    }

    // 4. 展开按钮：命中时必为未展开态（`hitExpandButton` 展开态直接返回 false），故无需再判 expanded。
    if (hitExpandButton(x, y, h.trayExpanded)) {
      h.showExpandPlaceholder();
      return 'consumed';
    }

    return 'pass';
  }
}
