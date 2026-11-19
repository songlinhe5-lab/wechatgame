/**
 * EP15-S4/S5 · 回放页渲染绑定（壳 → `ui/` → `view/`；守 L6 方向）。
 *
 * 壳层只递只读数据（影子快照 / 关卡 / 视图模型），⛔ 不 import `view/**`。
 */

import type { RenderModelBuilder } from '@wxgame/framework';
import type { BeadsLevelRaw } from '../config/levels.js';
import type { BeadsSnapshot } from '../game/state.js';
import type { ReplayViewModel } from '../replay/view-model.js';
import type { BeadsPalette } from '../view/palette.js';
import { renderReplayPage, type ReplayRenderSource } from '../view/replay-page.js';

export function renderReplayBinding(
  source: ReplayRenderSource,
  palette: BeadsPalette,
  builder: RenderModelBuilder,
): void {
  renderReplayPage(source, palette, builder);
}

export type { ReplayRenderSource };
export type { BeadsSnapshot, BeadsLevelRaw, ReplayViewModel };
