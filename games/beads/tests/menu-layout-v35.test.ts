/**
 * 主菜单落地单 v3.5 定案钉（P2）：slogan 退场 · ◀▶ 左右镜像 660 · 顶栏视觉 80 · CTA 324×92 @x218，
 * 外加五档「元素两两不相交」版面不变式（slogan 骑资源条类问题的机械防线）。
 * 五档输入表与 `menu-anchors.test.ts` 同源（落地单 §4）。
 */
import { describe, expect, it } from 'vitest';
import {
    AudioScheduler, EventBus, InputManager, NullAssetProvider, NullAudioBackend,
    RenderModelBuilder, Viewport, createRng, type EventMap, type GameServices,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsShell } from '../src/game/beads-shell.js';
import { COPY_TOKENS } from '../src/config/copy-tokens.js';
import { metaLayout } from '../src/view/meta-view.js';
import {
    DESIGN_H, DESIGN_W, MENU_ARROW_VISUAL_D, MENU_ARROW_X, MENU_BAR_H, MENU_CASE_H, MENU_CTA_H,
    MENU_CTA_X, MENU_PRIMARY_W, MENU_SIGN_CHAIN_H, MENU_SIGN_FRAME, MENU_TOPBAR_ICON_D, MENU_TOPBAR_VISUAL_D,
    MENU_TOPBAR_X, TOUCH_MIN, WALL_ROWS, menuAnchors,
} from '../src/config/tuning.js';

const TIERS = [
    { name: 'SE', st: 20, cap: 56, sb: 0, wW: 375, H: 1334 },
    { name: 'Android 挖孔', st: 29, cap: 64, sb: 0, wW: 360, H: 1625 },
    { name: 'X-14', st: 47, cap: 80, sb: 34, wW: 375, H: 1624 },
    { name: '灵动岛', st: 54, cap: 83, sb: 34, wW: 393, H: 1626 },
    { name: '16 Pro Max', st: 54, cap: 90, sb: 34, wW: 440, H: 1630 },
] as const;

const anchorsOf = (t: (typeof TIERS)[number]) =>
    menuAnchors({ safeTopDp: t.st, capsuleBottomDp: t.cap, safeBottomDp: t.sb, windowWidthDp: t.wW, designHeight: t.H });

describe('v3.5 定案常量', () => {
    it('CTA 324×92 @x218；◀▶ 左右镜像；顶栏视觉 80（图标同画布同尺寸）且不超热区', () => {
        expect(MENU_PRIMARY_W).toBe(324);
        expect(MENU_CTA_X).toBe(218);
        expect(MENU_CTA_H).toBe(92);
        expect(MENU_ARROW_X.right).toBe(DESIGN_W - MENU_ARROW_X.left - MENU_ARROW_VISUAL_D); // 660
        expect(MENU_TOPBAR_VISUAL_D).toBe(80);
        expect(MENU_TOPBAR_ICON_D).toBe(MENU_TOPBAR_VISUAL_D);
        expect(MENU_TOPBAR_VISUAL_D).toBeLessThanOrEqual(TOUCH_MIN);
        // 右两颗热区 pitch 88 ⇒ 视觉隙 ≥ 0
        // [WXG-T-365] 中档键名 notice → skins（公告预留位升格为装扮馆入口），坐标一字未变
        expect(MENU_TOPBAR_X.mail - MENU_TOPBAR_X.skins - MENU_TOPBAR_VISUAL_D).toBeGreaterThanOrEqual(0);
    });

    it('招牌板体与顶栏钮净空为正（WXG-T-486 后：左列右缘 108 / mail 左缘 648）', () => {
        const k = MENU_SIGN_FRAME.w / 960;
        const boardL = MENU_SIGN_FRAME.x + 11 * k;
        const boardR = MENU_SIGN_FRAME.x + 948 * k;
        const pad = (TOUCH_MIN - MENU_TOPBAR_VISUAL_D) / 2;
        // 左列两枚（settings / skins 同 x）视觉右缘；板体左缘须在其右。
        expect(boardL).toBeGreaterThanOrEqual(MENU_TOPBAR_X.settings + pad + MENU_TOPBAR_VISUAL_D);
        // 右侧只剩 mail 一枚（x648）：板体右缘须落在其视觉左缘之左。
        // ⚠ 原断言对 `MENU_TOPBAR_X.skins`（x560）取净空 —— 板体右界 555.4 与 skins 左缘 560
        // 仅 4.6 净空，即 art-review P1-3 判定的「净空 0、字被压」根因。skins 改挂左列后该断言
        // 改为对 mail 取，且净空从 4.6 提到 ~92.6。
        expect(boardR).toBeLessThanOrEqual(MENU_TOPBAR_X.mail + pad);
        expect(MENU_TOPBAR_X.mail - boardR).toBeGreaterThan(80);
        expect(MENU_SIGN_FRAME.x * 2 + MENU_SIGN_FRAME.w).toBe(DESIGN_W); // 居中
    });
});

describe('五档版面不变式（y-up：上元素的下缘 ≥ 下元素的上缘）', () => {
    for (const t of TIERS) {
        it(`${t.name}：招牌 / 资源条 / 橱窗 / CTA 自上而下互不相交且全在屏内`, () => {
            const a = anchorsOf(t);
            // 各元素 [底, 顶]（y-up）
            const sign = [a.signBotY, a.signTopY];
            const bar = [a.barTopY - MENU_BAR_H, a.barTopY];
            const showcase = [a.caseBotY, a.caseTopY];
            const cta = [a.ctaBotY, a.ctaBotY + MENU_CTA_H];
            expect(sign[1]! - sign[0]!).toBe(MENU_SIGN_CHAIN_H);
            expect(showcase[1]! - showcase[0]!).toBe(MENU_CASE_H);
            expect(sign[0]!).toBeGreaterThanOrEqual(bar[1]!); // 招牌底 ≥ 条顶
            expect(bar[1]!).toBeCloseTo(showcase[1]!, 9); // 条顶 = 窗顶（v3.6 嵌窗顶）
            expect(bar[0]!).toBeGreaterThanOrEqual(showcase[0]! - 1e-9); // 条底仍在窗内
            expect(showcase[0]!).toBeGreaterThanOrEqual(cta[1]!); // 窗底 ≥ CTA 顶
            expect(cta[0]!).toBeGreaterThanOrEqual(a.sb); // CTA 不入 Home 条
            expect(sign[1]!).toBeLessThanOrEqual(a.H);
        });

        it(`${t.name}：CTA 热区 = 324 宽 @x218 且点中心命中 start；◀▶ 热区关于屏中线镜像`, () => {
            const a = anchorsOf(t);
            const btns = metaLayout('none', WALL_ROWS, a).buttons;
            const start = btns.find((b) => b.id === 'start')!.box;
            expect(start.x).toBe(MENU_CTA_X);
            expect(start.w).toBe(MENU_PRIMARY_W);
            const prev = btns.find((b) => b.id === 'carousel-prev')!.box;
            const next = btns.find((b) => b.id === 'carousel-next')!.box;
            expect(prev.x + prev.w / 2 + (next.x + next.w / 2)).toBe(DESIGN_W);
            expect(prev.y).toBe(next.y);
        });
    }
});

describe('slogan 退场', () => {
    it('菜单帧里不再有 slogan 文案', () => {
        const platform = new NodePlatform({ width: DESIGN_W, height: DESIGN_H, pixelRatio: 2 });
        const services: GameServices = {
            events: new EventBus<EventMap>(),
            input: new InputManager(),
            audio: new AudioScheduler(new NullAudioBackend()),
            storage: platform.createStorage(),
            rng: createRng('v35'),
            viewport: new Viewport(DESIGN_W, DESIGN_H),
            assets: new NullAssetProvider(),
            platform: platform.info,
            rewardedAd: platform.createRewardedAdProvider(),
        };
        const shell = createBeadsShell({ clock: () => 1_700_000_000_000, metaKey: 'test.v35.meta', play: { saveKey: 'test.v35.play' } });
        shell.init(services);
        const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        b.begin();
        shell.buildRenderModel(b);
        const texts = b.end().commands.filter((c) => c.kind === 'text').map((c) => (c as { text: string }).text);
        expect(texts).not.toContain(COPY_TOKENS.app_slogan);
        expect(texts.length).toBeGreaterThan(0); // 反例自检：确有文字帧（不是空帧恒真）
    });
});
