/**
 * P0 静态温暖 · 整屏木屋背板（2026-10-31）— `drawMenuBackdrop` 的两条腿。
 *
 * 判据真源（⛔ 本文件零新数值）：
 *  - `games/beads/src/view/meta-menu.ts` `drawMenuBackdrop` 顶部注释：位图腿命中 ⇒
 *    不再叠桌面暖带 / 分界线 / 四角暗角（图里已烘）；光束与陶盆同理退场（背板自带）；
 *  - 同函数注释末句「缺图 ⇒ 原程序化行为逐字不变」= 宿主未注册 `MENU_TEXTURES.backdrop`
 *    （Cocos 未导入该图）时，画面必须回到今天的 6 条程序化底，⛔ 不空白、不崩。
 *
 * 口径：`menuBitmapReady` 走 `setMenuBitmapResolver` 注入 ⇒ 本文件用一个按 id 白名单的
 * 假 resolver，与宿主 `BITMAP_ASSETS` 的「未登记 = false」语义同构。
 */

import { describe, it, expect, afterEach } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { DESIGN_W, MENU_TEXTURES, menuAnchors } from '../src/config/tuning.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { drawMenuBackdrop } from '../src/view/meta-menu.js';
import { setMenuBitmapResolver } from '../src/view/meta-widgets.js';

const ANCHORS = menuAnchors({
    safeTopDp: 44, capsuleBottomDp: 88, safeBottomDp: 34,
    windowWidthDp: 375, designHeight: 1334,
});

/** 假宿主：只有列出的 textureId 「已导入」。 */
const hostWith = (...ids: readonly string[]): void => {
    const allow = new Set(ids);
    setMenuBitmapResolver((id) => allow.has(id));
};

const frame = (): readonly DrawCommand[] => {
    const b = new RenderModelBuilder(DESIGN_W, ANCHORS.H);
    b.begin();
    drawMenuBackdrop(b, DEFAULT_PALETTE, ANCHORS);
    return b.end().commands;
};

const blits = (cmds: readonly DrawCommand[]): readonly string[] =>
    cmds.filter((c) => c.kind === 'blit').map((c) => (c as { textureId: string }).textureId);

const count = (cmds: readonly DrawCommand[], kind: 'rect' | 'line'): number =>
    cmds.filter((c) => c.kind === kind).length;

afterEach(() => {
    setMenuBitmapResolver(undefined);
});

describe('P0 静态温暖 · 背板两条腿', () => {
    it('缺背板（宿主未注册）：程序化底逐字保留 = 5 rect + 1 line，且零 blit', () => {
        hostWith();
        const cmds = frame();
        expect(count(cmds, 'rect'), '桌面暖带 + 四条暗角带').toBe(5);
        expect(count(cmds, 'line'), '桌面分界线').toBe(1);
        expect(blits(cmds)).toEqual([]);
    });

    it('命中背板：整屏一次 blit，程序化底全退场（暖带/暗角/分界线一条不留）', () => {
        hostWith(MENU_TEXTURES.backdrop);
        const cmds = frame();
        expect(blits(cmds)).toEqual([MENU_TEXTURES.backdrop]);
        expect(count(cmds, 'rect'), '叠上去会双重压暗 ⇒ 必须为 0').toBe(0);
        expect(count(cmds, 'line')).toBe(0);

        const full = cmds.find((c) => c.kind === 'blit') as { x: number; y: number; w: number; h: number };
        expect([full.x, full.y, full.w, full.h]).toEqual([0, 0, DESIGN_W, ANCHORS.H]);
    });

    it('命中背板：光束与陶盆一并退场（背板自带，否则双花盆）', () => {
        hostWith(MENU_TEXTURES.backdrop, MENU_TEXTURES.beam, MENU_TEXTURES.pot);
        const cmds = frame();
        expect(blits(cmds)).toEqual([MENU_TEXTURES.backdrop]);
    });

    it('无背板但有光束/陶盆：两层照旧各画一次（回落腿不吞掉既有装饰）', () => {
        hostWith(MENU_TEXTURES.beam, MENU_TEXTURES.pot);
        const cmds = frame();
        expect(blits(cmds)).toEqual([MENU_TEXTURES.beam, MENU_TEXTURES.pot]);
        expect(count(cmds, 'rect')).toBe(5);
        expect(count(cmds, 'line')).toBe(1);
    });
});
