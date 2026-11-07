/**
 * `[WXG-T-566]` 主菜单走马灯三态：同一张大关 PNG 的灰度 / 模糊差异 + 柜灯强度 + 木牌 `N/M`。
 *
 * 用户 2026-11-02 裁决：
 *  - 未开启 = **磨砂玻璃**（`frost`：1/4 下采样模糊 + 全灰；用户 2026-11-03 裁）；
 *  - 推关 = **竖向揭彩**（`grayWipe`，彩色自下而上，比例 = 已完成小关 / 总小关）；
 *  - 通关 = 全彩（不传 fx）；
 *  - 状态标记全部退场（右上角徽标 / 通关飘带 / 居中沙漏）。
 *
 * 判档口径 = `_arcState`（首关已解锁未通关仍属推关，此时 done 可为 0）⇒ 进度数字与灰度档
 * 互不推导，本文件分别断言。
 */

import { describe, expect, it, afterEach } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { buildMetaView, setMenuBitmapResolver, type MetaViewData } from '../src/view/meta-view.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { LEVELS } from '../src/config/levels.js';
import { ARCS } from '../src/config/arcs.js';
import { DESIGN_H, DESIGN_W, MENU_FROST, MENU_GRAY_WIPE, MENU_LOCKED_ICON, MENU_TEXTURES } from '../src/config/tuning.js';

const data = (extra: Partial<MetaViewData> = {}): MetaViewData => ({
    stamina: 5, staminaMax: 5, coins: 0, overlay: 'none', signinDay: 0, canClaim: false,
    bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true,
    debugInfo: false, debugGuides: false, beadStyle: 'facet-4', beadSize: 'full', skinId: 'tokens',
    levelCount: LEVELS.length, currentLevelIndex: 0, maxUnlockedLevel: 1,
    starsByLevel: [], wallSlots: [], wallLevels: [],
    carouselLevel: LEVELS[0], carouselState: 'pushing',
    carouselTextureId: ARCS[0].textureId,
    ...extra,
});

const frame = (d: MetaViewData): readonly DrawCommand[] => {
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    buildMetaView(b, d, DEFAULT_PALETTE);
    return b.end().commands;
};

const artOf = (cmds: readonly DrawCommand[], textureId: string = ARCS[0].textureId):
    { fx?: Record<string, unknown> } | undefined =>
    cmds.find((c) => c.kind === 'blit' && (c as { textureId: string }).textureId === textureId) as
        { fx?: Record<string, unknown> } | undefined;

const caseLight = (cmds: readonly DrawCommand[]): number[] =>
    cmds.filter((c) => c.kind === 'circle' && c.fill === DEFAULT_PALETTE.woodText)
        .map((c) => (c as { alpha?: number }).alpha ?? 1);

afterEach(() => setMenuBitmapResolver());

describe('`[WXG-T-566]` 三态效果', () => {
    const states = [
        ['locked', { frost: MENU_FROST.radius, gray: MENU_FROST.gray }],
        ['pushing', { grayWipe: [0, MENU_GRAY_WIPE.soft] }],
        ['cleared', undefined],
        // `[WXG-T-579]` 满星 = 全彩（差别只在珠圈框，不在灰度）。
        ['fullstar', undefined],
    ] as const;

    it('窗框就绪（单一作品腿）：同一张图按档带 fx；通关/满星不传 fx', () => {
        setMenuBitmapResolver(() => true);
        for (const [state, fx] of states) {
            expect(artOf(frame(data({ carouselState: state })))?.fx, `${state} 效果档`).toEqual(fx);
        }
    });

    it('窗框缺失（旧腿）：同一张图同一套三态档', () => {
        setMenuBitmapResolver((id) => id === ARCS[0].textureId);
        for (const [state, fx] of states) {
            expect(artOf(frame(data({ carouselState: state })))?.fx, `${state} 效果档`).toEqual(fx);
        }
    });

    it('推关揭彩比例 = 已完成小关 / 总小关（自下而上）', () => {
        setMenuBitmapResolver(() => true);
        expect(artOf(frame(data({ carouselState: 'pushing', carouselArcDone: 3, carouselArcTotal: 8 })))?.fx)
            .toEqual({ grayWipe: [0.375, MENU_GRAY_WIPE.soft] });
        expect(artOf(frame(data({ carouselState: 'pushing', carouselArcDone: 6, carouselArcTotal: 8 })))?.fx)
            .toEqual({ grayWipe: [0.75, MENU_GRAY_WIPE.soft] });
    });

    it('对页按自己的进度揭彩（⛔ 不借用主车进度）', () => {
        setMenuBitmapResolver(() => true);
        const fx = artOf(frame(data({
            carouselState: 'pushing', carouselArcDone: 6, carouselArcTotal: 8,
            carouselPeer: LEVELS[1], carouselPeerState: 'pushing',
            carouselPeerTextureId: ARCS[1].textureId,
            carouselPeerArcDone: 2, carouselPeerArcTotal: 8,
            carouselT: 0.5, carouselDx: -100,
        })), ARCS[1].textureId)?.fx;
        expect(fx).toEqual({ grayWipe: [0.25, MENU_GRAY_WIPE.soft] });
    });

    it('状态标记：locked 画锁形；满星画珠圈框；两件互斥且其余档都不画', () => {
        setMenuBitmapResolver(() => true);
        // WXG-T-567 新增：locked 态画锁形独立 Sprite（与 frost+gray 合成纹理解耦）。
        // `[WXG-T-578]` 飘带/沙漏两件已出包，其负断言随键退场。
        // `[WXG-T-579]` 新增 fullstar ⇒ 珠圈框（与锁形互斥，其余档两件都不画）。
        for (const [state] of states) {
            const ids = frame(data({ carouselState: state }))
                .filter((c) => c.kind === 'blit')
                .map((c) => (c as { textureId: string }).textureId);
            if (state === 'locked') {
                expect(ids, 'locked 画独立锁形 Sprite').toContain(MENU_LOCKED_ICON.textureId);
            } else {
                expect(ids, `${state} 不画锁形`).not.toContain(MENU_LOCKED_ICON.textureId);
            }
            if (state === 'fullstar') {
                expect(ids, 'fullstar 画珠圈框').toContain(MENU_TEXTURES.arcRing);
            } else {
                expect(ids, `${state} 不画珠圈框`).not.toContain(MENU_TEXTURES.arcRing);
            }
        }
    });

    // `[WXG-T-585]` 2026-11-07 切生产：v2 背板已烘「射灯 + 玻璃」，程序化光锥整批退场
    // （`drawCaseLight` 只在 v1 腿调用）⇒ 三态差异只剩作品灰度档（上两例）与珠圈框，
    // ⛔ 不可再叠光锥（灯下再压亮斑）。`MENU_LIGHT` 现只服务 v1 腿。
    it('柜灯由背板烘焙 ⇒ 程序化光锥零枚（三态皆然）', () => {
        setMenuBitmapResolver(() => true);
        for (const [state] of states) {
            expect(caseLight(frame(data({ carouselState: state }))), `${state} 零光锥`).toEqual([]);
        }
    });
});

describe('`[WXG-T-566]` 木牌大关进度 N/M', () => {
    const texts = (cmds: readonly DrawCommand[]): string[] =>
        cmds.filter((c) => c.kind === 'text').map((c) => (c as { text: string }).text);

    it('0 / 中间 / 满：完成数原样拼接总小关数', () => {
        setMenuBitmapResolver(() => true);
        for (const [done, total] of [[0, 8], [3, 8], [8, 8]] as const) {
            expect(texts(frame(data({ carouselArcDone: done, carouselArcTotal: total }))), `${done}/${total}`)
                .toContain(`${done}/${total}`);
        }
    });

    it('总数为 0 或缺省 ⇒ 不造进度行（空页不写 0/0）', () => {
        setMenuBitmapResolver(() => true);
        const base = texts(frame(data()));
        expect(base).not.toContain('0/0');
        expect(texts(frame(data({ carouselArcDone: 0, carouselArcTotal: 0 }))), '总数 0 = 不加行').toEqual(base);
        expect(texts(frame(data({ carouselArcDone: 3 }))), '缺总数 = 不加行').toEqual(base);
    });
});
