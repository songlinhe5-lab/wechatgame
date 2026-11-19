/**
 * EP15-S4 · 回放页 / 托管徽标几何（`ux/bot-replay-spec.md` §3.2 / §3.3 / §3.4）。
 *
 * ⚠️ 本文件是**呈现几何**，不进 `systems-index §3`；数值逐字取自 UX 规格表。
 * y 轴向上（设计空间 750×1334）。
 */

import { DESIGN_H, DESIGN_W } from './layout';

export interface ReplayRect {
  readonly x: number;
  readonly bottom: number;
  readonly w: number;
  readonly h: number;
}

const rect = (x: number, bottom: number, w: number, h: number): ReplayRect => ({ x, bottom, w, h });

/** 左上退出钮 88×88，x∈[24,112]、y∈[1222,1310]。 */
export const REPLAY_EXIT_RECT = rect(24, 1222, 88, 88);
/** 播放/暂停 96×96，x∈[40,136]、y∈[76,172]。 */
export const REPLAY_PLAY_RECT = rect(40, 76, 96, 96);
/** 倍速钮 112×88，x∈[600,712]、y∈[80,168]。 */
export const REPLAY_SPEED_RECT = rect(600, 80, 112, 88);
/** 进度条热区（88 高，点击/拖动定位），x∈[160,584]、y∈[80,168]。 */
export const REPLAY_PROGRESS_HIT = rect(160, 80, 424, 88);
/** 进度条视觉细条 8px，y∈[126,134]。 */
export const REPLAY_PROGRESS_TRACK = rect(160, 126, 424, 8);

/** 结束条 560×240，x∈[95,655]、y∈[420,660]。 */
export const REPLAY_END_PANEL = rect(95, 420, 560, 240);
export const REPLAY_END_PRIMARY = rect(143, 470, 220, 92);
export const REPLAY_END_SECONDARY = rect(387, 470, 220, 92);

/**
 * 传输带/道具带覆盖：y∈[0,260] 整幅铺底色（盖住道具卡 + 展开钮 + 标签行）。
 * 顶部 y∈[1100,1334] 盖住 HUD（星级 / 豆 / 心 / 齿轮）；标题随后画在其上。
 */
export const REPLAY_COVER_BOTTOM = rect(0, 0, DESIGN_W, 260);
export const REPLAY_COVER_TOP = rect(0, 1100, DESIGN_W, DESIGN_H - 1100);

/** 托管徽标 132×56，x∈[309,441]、y∈[1150,1206]（非按钮、零热区）。 */
export const ASSIST_BADGE = rect(309, 1150, 132, 56);
