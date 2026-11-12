/**
 * `[WXG-T-566]` 主菜单走马灯三态：大关图的灰度 / 模糊差异 + 柜灯强度
 * （木牌侧的 `N/M` 已由 `[WXG-T-598]` 摘下，见文件末节）。
 *
 * 用户 2026-11-02 裁决：
 *  - 推关 = **竖向揭彩**（`grayWipe`，彩色自下而上，比例 = 已完成小关 / 总小关）；
 *  - 通关 = 全彩（不传 fx）；
 *  - 状态标记全部退场（右上角徽标 / 通关飘带 / 居中沙漏）。
 * `[WXG-T-916]` 用户 2026-11-12 改裁：**未开启 = 锁图占位**（不画大关图、磨砂/灰度腿退场）。
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
import { DESIGN_H, DESIGN_W, MENU_GRAY_WIPE, MENU_LOCKED_ICON, MENU_TEXTURES } from '../src/config/tuning.js';

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

    // `[WXG-T-916]` 未开启 = 锁图占位（用户 2026-11-12 裁，参考选关锁格）：
    // 大关图不画（无 fx 可断言），锁形成为橱窗唯一主体；旧「磨砂 + 半透明灰」腿退场。
    it('`[WXG-T-916]` 未开启：不画大关图（无磨砂/灰度），橱窗只留锁形', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frame(data({ carouselState: 'locked' }));
        expect(artOf(cmds), '未开启不画大关图').toBeUndefined();
        const locks = cmds.filter((c) => c.kind === 'blit' && c.textureId === MENU_TEXTURES.lock);
        expect(locks, '锁图 = 橱窗唯一主体').toHaveLength(1);
        expect((locks[0] as { fx?: unknown }).fx, '锁图不做磨砂/灰度').toBeUndefined();
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

    it('状态标记：满星画珠圈框；未开启 = 锁图占位（锁形唯一）；其余档两件都不画', () => {
        setMenuBitmapResolver(() => true);
        // `[WXG-T-578]` 飘带/沙漏两件已出包，其负断言随键退场。
        // `[WXG-T-579]` fullstar ⇒ 珠圈框；`[WXG-T-916]` locked ⇒ 锁形占位（两者互斥）。
        for (const [state] of states) {
            const ids = frame(data({ carouselState: state }))
                .filter((c) => c.kind === 'blit')
                .map((c) => (c as { textureId: string }).textureId);
            expect(ids, `${state} 不画锁形`).not.toContain(MENU_LOCKED_ICON.textureId);
            if (state === 'fullstar') {
                expect(ids, 'fullstar 画珠圈框').toContain(MENU_TEXTURES.arcRing);
            } else {
                expect(ids, `${state} 不画珠圈框`).not.toContain(MENU_TEXTURES.arcRing);
            }
        }
        const lockedIds = frame(data({ carouselState: 'locked' }))
            .filter((c) => c.kind === 'blit')
            .map((c) => (c as { textureId: string }).textureId);
        expect(lockedIds, '未开启画锁形（占位主体）').toContain(MENU_LOCKED_ICON.textureId);
        expect(lockedIds, '未开启不画珠圈框').not.toContain(MENU_TEXTURES.arcRing);
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

// `[WXG-T-598]` 2026-11-07 用户令「木牌只留关名 + 关序」⇒ `N/M` 自木牌退场（推翻 WXG-T-566 的
// 「第二行直拼 N/M」）。该读数现只剩一个消费面：橱窗竖向揭彩比例（`wipeFx`）。木牌侧改守
// 「实参传了也不画」，进度侧守「揭彩比例 = 完成数 / 总数」。
describe('`[WXG-T-566]` 大关进度 N/M（`[WXG-T-598]` 起不进木牌）', () => {
    const texts = (cmds: readonly DrawCommand[]): string[] =>
        cmds.filter((c) => c.kind === 'text').map((c) => (c as { text: string }).text);

    it('传了完成度也不画 N/M（木牌只剩关名 + 关序）', () => {
        setMenuBitmapResolver(() => true);
        for (const [done, total] of [[0, 8], [3, 8], [8, 8]] as const) {
            const t = texts(frame(data({ carouselArcDone: done, carouselArcTotal: total })));
            expect(t, `${done}/${total} 不上牌`).not.toContain(`${done}/${total}`);
            expect(t, '关序仍在第二行').toContain(`第 ${LEVELS[0]!.id} 关`);
        }
    });

    // 进度数据没变成死字段：竖向揭彩按它算比例（本条守住字段仍有消费者）。
    it('进度改由橱窗揭彩消费：推关比例 = 完成数 / 总数；总数 0 / 缺省 ⇒ 0', () => {
        setMenuBitmapResolver(() => true);
        const wipe = (done: number | undefined, total?: number): number | undefined =>
            (artOf(frame(data({ carouselArcDone: done, carouselArcTotal: total })))?.fx as
                { grayWipe?: [number, number] } | undefined)?.grayWipe?.[0];
        expect(wipe(0, 8), '0 完成 = 全灰').toBe(0);
        expect(wipe(3, 8), '3/8 = 37.5% 揭彩').toBeCloseTo(0.375, 3);
        expect(wipe(8, 8), '满 = 全彩').toBe(1);
        expect(wipe(3, 0), '总数 0 不造 NaN').toBe(0);
        expect(wipe(3), '缺总数不造 NaN').toBe(0);
    });
});
