/**
 * `[WXG-T-566]` 主菜单走马灯三态：同一张大关 PNG 的灰度差异 + 柜灯强度 + 木牌 `N/M`。
 *
 * 用户 2026-11-02 裁决：
 *  - 未开启 = 整图全灰（`MENU_GRAY.locked`）；
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
import { DESIGN_H, DESIGN_W, MENU_GRAY, MENU_GRAY_WIPE, MENU_LIGHT, MENU_TEXTURES } from '../src/config/tuning.js';

/** 柜灯 α 基数（`meta-menu.ts::MENU_WARM.coneAlpha`，局部常量不在 tuning 导出）。 */
const CONE_ALPHA = 0.018;

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
        ['locked', { gray: MENU_GRAY.locked }],
        ['pushing', { grayWipe: [0, MENU_GRAY_WIPE.soft] }],
        ['cleared', undefined],
    ] as const;

    it('窗框就绪（单一作品腿）：同一张图按档带 fx；通关不传 fx', () => {
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

    it('状态标记全退场：三档都不出现飘带 / 小锁 / 沙漏', () => {
        setMenuBitmapResolver(() => true);
        const marks = [MENU_TEXTURES.sealCleared, MENU_TEXTURES.badgeLocked, MENU_TEXTURES.badgeProgress];
        for (const [state] of states) {
            const ids = frame(data({ carouselState: state }))
                .filter((c) => c.kind === 'blit')
                .map((c) => (c as { textureId: string }).textureId);
            for (const mark of marks) expect(ids, `${state} 不画 ${mark}`).not.toContain(mark);
        }
    });

    it('柜灯强度三档：0.35 / 0.70 / 1.00 只乘既有 coneAlpha', () => {
        setMenuBitmapResolver(() => true);
        for (const [state, light] of [
            ['locked', MENU_LIGHT.locked],
            ['pushing', MENU_LIGHT.pushing],
            ['cleared', MENU_LIGHT.cleared],
        ] as const) {
            const [inner, outer] = caseLight(frame(data({ carouselState: state })));
            expect(inner, `${state} 内圈`).toBeCloseTo(CONE_ALPHA * light);
            expect(outer, `${state} 外圈`).toBeCloseTo(CONE_ALPHA * light * 0.7);
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
