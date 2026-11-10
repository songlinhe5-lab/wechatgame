/**
 * `[WXG-T-609]` 关卡详情橱窗面板（Figma `192:42`）：从稿面拆出的独立资源接入判据。
 *
 * 只钉工程可证面：① 位图就绪 ⇒ 木牌之后恰一条 `showcase` blit，几何单源同 `LEVEL_DETAIL_GEO`；
 * ② 缺图 ⇒ 零 blit（纯木纹牌仍可读，⛔ 不叠程序化第二套玻璃框）。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { DESIGN_H, DESIGN_W, LEVEL_DETAIL_GEO, LEVEL_DETAIL_TEXTURES } from '../src/config/tuning.js';
import { LEVELS } from '../src/config/levels.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { levelDetailPlate } from '../src/view/meta-layout.js';
import { setMenuBitmapResolver } from '../src/view/meta-widgets.js';
import { drawLevelDetailPage } from '../src/view/meta-level-detail-page.js';
import type { MetaViewData } from '../src/view/meta-types.js';

const data = (): MetaViewData => Object.freeze({
    overlay: 'level-detail', detailLevelIndex: 0, detailLevel: LEVELS[0],
    starsByLevel: [], wallSlots: [], wallLevels: [],
    reduceMotion: false, largeText: false,
}) as unknown as MetaViewData;

const frame = (ready: (id: string) => boolean): readonly DrawCommand[] => {
    setMenuBitmapResolver(ready);
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    drawLevelDetailPage(b, data(), DEFAULT_PALETTE, 5, DESIGN_H);
    return b.end().commands;
};
const panels = (cmds: readonly DrawCommand[]) => cmds.filter(
    (c) => c.kind === 'blit' && (c as { textureId: string }).textureId === LEVEL_DETAIL_TEXTURES.showcase,
) as readonly { x: number; y: number; w: number; h: number }[];

afterEach(() => setMenuBitmapResolver(undefined));

describe('WXG-T-609 关卡详情橱窗面板', () => {
    it('位图就绪：恰一条 blit，几何 = Figma 192:42（469×638，帧内 @143,376）', () => {
        const blits = panels(frame((id) => id === LEVEL_DETAIL_TEXTURES.showcase || id === LEVEL_DETAIL_TEXTURES.plaque));
        expect(blits).toHaveLength(1);
        const s = LEVEL_DETAIL_GEO.showcase;
        const plate = levelDetailPlate();
        const plateY = DESIGN_H - LEVEL_DETAIL_GEO.plate.yDown - LEVEL_DETAIL_GEO.plate.h;
        expect(blits[0]!.x).toBe(plate.x + (s.x - LEVEL_DETAIL_GEO.plate.x));
        expect(blits[0]!.y).toBe(plate.y + (DESIGN_H - s.yDown - s.h - plateY));
        expect(blits[0]!.w).toBe(s.w);
        expect(blits[0]!.h).toBe(s.h);
    });

    it('缺图 ⇒ 不叠面板（纯木纹牌仍可读），零 showcase blit', () => {
        expect(panels(frame(() => false))).toHaveLength(0);
    });
});
