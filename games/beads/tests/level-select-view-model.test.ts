/**
 * `[WXG-T-607]` 选关弹窗 View/ViewModel 契约（用户令「按照 view-viewmodel 模式实现」）。
 * 判据只钉工程可证面：① 持续型 VM 逐帧复用同一预分配对象；② `grid-1` 模板九格复用、
 * 与命中同源；③ 纹理未注册 ⇒ 程序化木托盘降级腿（零 blit）。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { DESIGN_H, DESIGN_W, LEVEL_DETAIL_TEXTURES, LEVEL_SELECT_GEO, LEVEL_SELECT_TEXTURES, WALL_ROWS } from '../src/config/tuning.js';
import { LEVELS } from '../src/config/levels.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { metaLayout } from '../src/view/meta-view.js';
import { setMenuBitmapResolver } from '../src/view/meta-widgets.js';
import { createLevelSelectViewModel, updateLevelSelectViewModel } from '../src/view/level-select-view-model.js';
import { drawLevelsView } from '../src/view/level-select-view.js';
import type { MetaViewData } from '../src/view/meta-types.js';

const data = (): MetaViewData => Object.freeze({
    stamina: 5, staminaMax: 5, coins: 0, overlay: 'levels' as const,
    signinDay: 0, canClaim: false, bgmMuted: false, sfxMuted: false,
    reduceMotion: false, largeText: false, vibrate: true, debugInfo: false, debugGuides: false,
    beadStyle: 'facet-4', beadSize: 'full' as const, skinId: 'tokens',
    levelCount: LEVELS.length, currentLevelIndex: 0, maxUnlockedLevel: LEVELS.length,
    starsByLevel: [], wallSlots: [0, 1, 2, 3, 4, 5, 6, 7, 8], wallLevels: LEVELS.slice(0, 9),
    chapterTitle: '曼陀罗', arcStarGot: 3, arcStarNeed: 9,
}) as unknown as MetaViewData;

const buttons = metaLayout('levels', WALL_ROWS).buttons;
const frame = (ready: (id: string) => boolean, override: Partial<MetaViewData> = {}): readonly DrawCommand[] => {
    setMenuBitmapResolver(ready);
    const vm = createLevelSelectViewModel();
    updateLevelSelectViewModel(vm, { ...data(), ...override } as MetaViewData, buttons, DESIGN_H, 5);
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    drawLevelsView(b, vm, DEFAULT_PALETTE);
    return b.end().commands;
};
const cellBlits = (cmds: readonly DrawCommand[]) => cmds.filter(
    (c) => c.kind === 'blit' && (c as { textureId: string }).textureId === LEVEL_SELECT_TEXTURES.cell,
) as readonly { x: number; y: number; w: number; h: number }[];

afterEach(() => setMenuBitmapResolver(undefined));

describe('WXG-T-607 选关弹窗 View/ViewModel', () => {
    it('持续型 VM：逐帧写入同一预分配对象，九格零新建', () => {
        const vm = createLevelSelectViewModel();
        const cell0 = vm.cells[0];
        updateLevelSelectViewModel(vm, data(), buttons, DESIGN_H, 5);
        updateLevelSelectViewModel(vm, data(), buttons, DESIGN_H + 1, 4);
        expect(vm.cells).toHaveLength(9);
        expect(vm.cells[0]).toBe(cell0);
        expect(vm.screenH).toBe(DESIGN_H + 1);
        expect(vm.thumbN).toBe(4);
        expect(vm.cells[0]!.locked).toBe(false);
        expect(vm.cells[0]!.current).toBe(true);
    });

    it('`grid-1` 模板九格复用：9 条 cell blit，尺寸 158×177、底缘与命中框同源', () => {
        const blits = cellBlits(frame((id) => id === LEVEL_SELECT_TEXTURES.cell || id === LEVEL_DETAIL_TEXTURES.plaque));
        expect(blits).toHaveLength(9);
        const g = LEVEL_SELECT_GEO.grid;
        const picks = buttons.filter((b) => b.id === 'pick-level');
        for (let i = 0; i < 9; i += 1) {
            expect(blits[i]!.w).toBe(g.cellW);
            expect(blits[i]!.h).toBe(LEVEL_SELECT_GEO.cellArt.h);
            expect(blits[i]!.x).toBe(picks[i]!.box.x);
            expect(blits[i]!.y).toBe(picks[i]!.box.y);
        }
    });

    it('纹理未注册 ⇒ 程序化木托盘降级腿（零 cell blit）', () => {
        expect(cellBlits(frame(() => false))).toHaveLength(0);
    });

    const countBlit = (cmds: readonly DrawCommand[], id: string): number =>
        cmds.filter((c) => c.kind === 'blit' && (c as { textureId?: string }).textureId === id).length;

    it('`[WXG-T-610]` 位图腿：背板 / 三态格底 / 双星 / 底部关闭按钮全部就位', () => {
        const cmds = frame(() => true);
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.tray), '九宫格背板').toBe(1);
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.closeBtn), '底部关闭按钮').toBe(1);
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.cell), '旧通用模板退场').toBe(0);
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.cellCurrent), '当前关亮金').toBe(1);
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.cellNormal), '普通橙').toBe(8);
        expect(
            countBlit(cmds, LEVEL_SELECT_TEXTURES.starFilled) + countBlit(cmds, LEVEL_SELECT_TEXTURES.starEmpty),
            '9 格 × 3 枚星',
        ).toBe(27);
    });

    it('`[WXG-T-610]` 锁定态走灰色格底（8 锁 + 1 当前）', () => {
        const cmds = frame(() => true, { maxUnlockedLevel: 1 });
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.cellLocked), '未解锁灰').toBe(8);
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.cellCurrent), '当前关亮金').toBe(1);
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.cellNormal)).toBe(0);
    });
});
