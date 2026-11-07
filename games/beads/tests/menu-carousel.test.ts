/**
 * 主菜单走马灯（落地单 §8 / v3.8）。
 */
import { describe, expect, it, afterEach } from 'vitest';
import { EventBus, InputManager, AudioScheduler, NullAudioBackend, NullAssetProvider, Viewport, createRng, type EventMap, type GameServices } from '@wxgame/framework';
import { RenderModelBuilder } from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { LEVELS } from '../src/config/levels.js';
import { carouselDamp, carouselPage, plateFade } from '../src/config/menu-carousel.js';
import { ARC_COMING_SOON, ARCS } from '../src/config/arcs.js';
import { DESIGN_H, DESIGN_W, MENU_CLIP, MENU_FROST, MENU_GRAY_WIPE, MENU_TEXTURES } from '../src/config/tuning.js';
import { createBeadsShell } from '../src/game/beads-shell.js';
import { buildMetaView, setMenuBitmapResolver, type MetaViewData } from '../src/view/meta-view.js';
import { anchoredGeo } from '../src/view/meta-layout.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { UI_FONT } from '../src/view/ui-theme.js';
import type { BeadsLevelRaw } from '../src/config/levels-data.js';

const dataFor = (lv: BeadsLevelRaw, extra: Partial<MetaViewData> = {}): MetaViewData => ({
    stamina: 5, staminaMax: 5, coins: 0, overlay: 'none', signinDay: 0, canClaim: false,
    bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true,
    debugInfo: false, debugGuides: false, beadStyle: 'facet-4', beadSize: 'full', skinId: 'tokens',
    levelCount: LEVELS.length, currentLevelIndex: 0, maxUnlockedLevel: 1,
    starsByLevel: [], wallSlots: [], wallLevels: [], carouselLevel: lv, carouselState: 'pushing',
    carouselTextureId: ARCS[0].textureId,
    ...extra,
});

const frame = (data: MetaViewData) => {
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    buildMetaView(b, data, DEFAULT_PALETTE);
    return b.end().commands;
};

afterEach(() => setMenuBitmapResolver());

describe('翻页状态机', () => {
    const w = MENU_CLIP.w;

    it('过 30% 才翻，快甩无视距离，到头回 0', () => {
        expect(carouselPage(-w * 0.3 - 1, 0, 0, 3)).toBe(1);
        expect(carouselPage(-w * 0.3 + 1, 0, 0, 3)).toBe(0);
        expect(carouselPage(-10, -0.6, 0, 3)).toBe(1);
        expect(carouselPage(w, 0, 0, 3)).toBe(0);
        expect(carouselPage(-w, 0, 2, 3)).toBe(0);
    });

    it('到头只跟 0.35，并且不超过一槽', () => {
        expect(carouselDamp(100, 0, 3)).toBeCloseTo(35);
        expect(carouselDamp(-100, 0, 3)).toBe(-100);
        expect(carouselDamp(-100, 2, 3)).toBeCloseTo(-35);
        expect(carouselDamp(w + 50, 1, 3)).toBe(w);
    });

    it('木牌两段透明度不重叠', () => {
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            const [out, inn] = plateFade(t);
            expect(out === 0 || inn === 0).toBe(true);
        }
        expect(plateFade(0.25)[0]).toBeCloseTo(0.5);
        expect(plateFade(0.75)[1]).toBeCloseTo(0.5);
    });
});

describe('橱窗绘制', () => {
    const lv = LEVELS[0]!;

    it('`[WXG-T-566 / WXG-T-567]` 三态 = 同一张大关图的灰度差异 + 叠加管线；旧状态标记全退场，locked 画独立锁形', () => {
        setMenuBitmapResolver(() => true);
        const artOf = (d: MetaViewData) => frame(d).find(
            (c) => c.kind === 'blit' && (c as { textureId: string }).textureId === ARCS[0].textureId,
        ) as { fx?: Record<string, unknown> } | undefined;
        const cleared = frame(dataFor(lv, { carouselState: 'cleared' }));
        expect(artOf(dataFor(lv, { carouselState: 'cleared' }))?.fx, '通关 = 全彩（不传 fx）').toBeUndefined();
        expect(artOf(dataFor(lv, { carouselState: 'pushing' }))?.fx, '推关 = 竖向揭彩（此处进度 0）')
            .toEqual({ grayWipe: [0, MENU_GRAY_WIPE.soft] });
        expect(artOf(dataFor(lv, { carouselState: 'locked' }))?.fx, '未开启 = 磨砂玻璃+半透明灰叠加管线')
            .toEqual({ frost: MENU_FROST.radius, gray: MENU_FROST.gray });
        // cleared 态不画任何状态标记（含独立锁形——锁形只在 locked 态）。
        // `[WXG-T-578]` 旧 `frame`/`seal` 两键已删，负断言随靶子退场。
        expect(cleared.some((c) => c.kind === 'blit' && c.textureId === MENU_TEXTURES.lock)).toBe(false);
    });

    it('空橱窗只写敬请期待，不画主题图和章', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frame(dataFor(lv, { carouselLevel: undefined, carouselComingSoon: true }));
        const text = cmds.find((c) => c.kind === 'text' && c.text === ARC_COMING_SOON);
        expect(text).toBeTruthy();
        expect(cmds.filter((c) => c.kind === 'circle').length).toBeGreaterThanOrEqual(7);
        expect(cmds.some((c) => c.kind === 'blit' && c.textureId === ARCS[0].textureId)).toBe(false);
        expect(cmds.some((c) => c.kind === 'blit' && c.textureId === MENU_TEXTURES.lock)).toBe(false);
    });

    // `[WXG-T-600]` 木牌**单行槽**只有两种内容：无展示名的「第 N 关」与空橱窗的「敬请期待」。
    // 两者落同一 y（`plateSingleCy`）⇒ 字号必须同档，否则翻到空橱窗页会看出「牌面缩水一圈」。
    // 旧值 = 提示语走 `UI_FONT.button`（30）、关序走 `plateTitle`（34）。
    it('`[WXG-T-600]` 单行槽同档：敬请期待与单行关序同字型', () => {
        setMenuBitmapResolver(() => true);
        const fontOf = (d: MetaViewData, label: string) =>
            frame(d).find((c) => c.kind === 'text' && c.text === label) as { font?: string } | undefined;

        const soon = fontOf(dataFor(lv, { carouselLevel: undefined, carouselComingSoon: true }), ARC_COMING_SOON);
        // `LEVELS[0]` 无展示名（同 `menu-plate-title` 的「无展示名 ⇒ 单行关序」用例）⇒ 走单行槽。
        const seq = fontOf(dataFor(lv), `第 ${lv.id} 关`);
        expect(seq?.font, '单行关序 = plateTitle').toBe(UI_FONT.plateTitle);
        expect(soon?.font, '敬请期待同档（⛔ 退回 button 30）').toBe(seq!.font);
    });

    it('`[WXG-T-566]` 滑动时作品图跟着走；减少动效时不平移', () => {
        setMenuBitmapResolver(() => true);
        const xOf = (data: MetaViewData) => {
            const b = frame(data).find(
                (c) => c.kind === 'blit' && (c as { textureId: string }).textureId === ARCS[0].textureId,
            ) as { x: number };
            return b.x;
        };
        const cleared = { carouselState: 'cleared' as const };
        const rest = xOf(dataFor(lv, cleared));
        expect(xOf(dataFor(lv, { ...cleared, carouselDx: 80, carouselT: 0.2 }))).toBeCloseTo(rest + 80);
        expect(xOf(dataFor(lv, { ...cleared, carouselDx: 80, carouselT: 0.2, reduceMotion: true }))).toBeCloseTo(rest);
    });

    it('木牌在进度 0.25 只留旧字、0.75 只留新字', () => {
        setMenuBitmapResolver(() => true);
        const peer = { ...LEVELS[1]!, title: '小雏菊' };
        const texts = (t: number) => frame(dataFor({ ...lv, title: '曼陀罗' }, {
            carouselT: t, carouselPeer: peer, carouselPeerState: 'cleared', carouselPeerSign: 1,
        })).filter((c) => c.kind === 'text') as { text: string; alpha?: number }[];
        const early = texts(0.25);
        expect(early.find((c) => c.text === '曼陀罗')?.alpha).toBeCloseTo(0.5);
        expect(early.some((c) => c.text === '小雏菊')).toBe(false);
        const late = texts(0.75);
        expect(late.some((c) => c.text === '曼陀罗')).toBe(false);
        expect(late.find((c) => c.text === '小雏菊')?.alpha).toBeCloseTo(0.5);
    });
});

describe('玻璃上的手势', () => {
    it('移动超过 10px 松手不进选关；几乎没动才进', () => {
        const platform = new NodePlatform({ width: DESIGN_W, height: DESIGN_H, pixelRatio: 1 });
        const input = new InputManager();
        const services: GameServices = {
            events: new EventBus<EventMap>(),
            input,
            audio: new AudioScheduler(new NullAudioBackend()),
            storage: platform.createStorage(),
            rng: createRng('carousel'),
            viewport: new Viewport(DESIGN_W, DESIGN_H),
            assets: new NullAssetProvider(),
            platform: platform.info,
            rewardedAd: platform.createRewardedAdProvider(),
        };
        let now = 1_000;
        const shell = createBeadsShell({ clock: () => now, metaKey: 'test.carousel.meta', play: { saveKey: 'test.carousel.play' } });
        shell.init(services);
        const a = shell.menuAnchors!;
        // `[WXG-T-585]` 切生产：图位改由 `anchoredGeo().bossBox`（= `MENU_V2.art`）给，
        // ⛔ 不再由 `caseTopY − MENU_BOSS_SLOT.yOff` 推（v1 链已删）。
        const boss = anchoredGeo(a).bossBox;
        const cx = boss.x + boss.w / 2;
        const sy = a.H - (boss.y + boss.h / 2);
        const poke = (phase: 'down' | 'move' | 'up', x: number, y: number, t: number) => {
            now = t;
            input.push({ id: 1, phase, x, y, time: t });
            shell.update(0.016);
            input.endFrame(0.016);
        };
        poke('down', cx, sy, 1000);
        poke('move', cx - 200, sy, 1100);
        poke('up', cx - 200, sy, 1200);
        expect(shell.overlay).toBe('none');

        poke('down', cx, sy, 2000);
        poke('up', cx + 4, sy, 2016);
        expect(shell.overlay).toBe('levels');
    });
});
