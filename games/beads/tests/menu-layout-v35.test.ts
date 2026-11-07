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
    DESIGN_H, DESIGN_W, MENU_SIGN_FRAME, MENU_TOPBAR_ICON_D, MENU_TOPBAR_VISUAL_D,
    MENU_V2,
    MENU_TOPBAR_ROW2_DY, MENU_TOPBAR_X, TOUCH_MIN, WALL_ROWS, menuAnchors,
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

describe('顶栏与招牌版面定案（v2 档）', () => {
    it('顶栏视觉 80（图标同画布同尺寸）且不超热区；CTA / ◀▶ 改由 `MENU_V2` 钉（见 v2 版面那组）', () => {
        // ⚠ `[WXG-T-585]` 2026-11-07 切生产后，v1 的 `MENU_PRIMARY_W`(=324) / `MENU_CTA_X`(=218) /
        // `MENU_CTA_H`(=92) / `MENU_ARROW_X` / `MENU_ARROW_VISUAL_D` 已随 v1 版面删除 ⇒
        // CTA 与翻页钮的读数改钉 `MENU_V2.cta` / `MENU_V2.prev` / `MENU_V2.next`（下方 v2 版面那组）。
        expect(MENU_TOPBAR_VISUAL_D).toBe(80);
        expect(MENU_TOPBAR_ICON_D).toBe(MENU_TOPBAR_VISUAL_D);
        expect(MENU_TOPBAR_VISUAL_D).toBeLessThanOrEqual(TOUCH_MIN);
        // `WXG-T-487`（用户裁「把好友榜放到左上设计一个图标按钮，让左上右上分别有两个按钮，
        // 平衡入口」）起顶栏 = **左列 2（settings / rank @14）+ 右列 2（mail / skins @648）**，
        // `[WXG-T-498]` 左列 24 → 14 做**左右对称**：两侧热区距屏边 14、视觉圆距屏边 18。
        // 旧「右两颗横向 pitch 88」（`mail − skins − 80 ≥ 0`）随该裁定作废 —— 现在两者同 x。
        // 同列两钮的**纵向**间距由 ROW2_DY 保证 ≥ 视觉直径 ⇒ 不互叠（热区边贴边 = 88 = TOUCH_MIN）。
        expect(MENU_TOPBAR_X.rank).toBe(MENU_TOPBAR_X.settings);
        expect(MENU_TOPBAR_X.skins).toBe(MENU_TOPBAR_X.mail);
        expect(MENU_TOPBAR_ROW2_DY).toBeGreaterThanOrEqual(MENU_TOPBAR_VISUAL_D);
        expect(MENU_TOPBAR_ROW2_DY).toBe(TOUCH_MIN);
    });

    it('招牌板体与顶栏钮净空为正（WXG-T-486 后：左列右缘 108 / mail 左缘 648）', () => {
        const k = MENU_SIGN_FRAME.w / 960;
        const boardL = MENU_SIGN_FRAME.x + 11 * k;
        const boardR = MENU_SIGN_FRAME.x + 948 * k;
        const pad = (TOUCH_MIN - MENU_TOPBAR_VISUAL_D) / 2;
        // 左列两枚（settings / rank 同 x24）视觉右缘；板体左缘须在其右。
        expect(boardL).toBeGreaterThanOrEqual(MENU_TOPBAR_X.settings + pad + MENU_TOPBAR_VISUAL_D);
        // 右列两枚（mail / skins 同 x648）视觉左缘；板体右缘须落在其左。
        // ⚠ 原断言对 `MENU_TOPBAR_X.skins`（x560）取净空 —— 板体右界 555.4 与 skins 左缘 560
        // 仅 4.6 净空，即 art-review P1-3 判定的「净空 0、字被压」根因。`skins` 两次搬移
        // （T-486 左列 → T-487 右列）后 x560 已不是任何钮的坐标，净空从 4.6 提到 ~92.6。
        expect(boardR).toBeLessThanOrEqual(MENU_TOPBAR_X.mail + pad);
        expect(MENU_TOPBAR_X.mail - boardR).toBeGreaterThan(80);
        expect(MENU_SIGN_FRAME.x * 2 + MENU_SIGN_FRAME.w).toBe(DESIGN_W); // 居中
    });
});

// `[WXG-T-585]` v1 的「招牌 / 资源条 / 橱窗 / CTA 自上而下互不相交」链式不变式已随
// 排版链（`menuAnchors` 的 gap/sign/case/cta 字段）一并删除 —— v2 版面由坐标图读数逐件钉死，
// 不再由链推导 ⇒ 相交性由设计图保证，用测试重述已无对应代码。留 CTA / 翻页钮这条活判据：
describe('五档 v2 版面（绝对坐标）', () => {
    for (const t of TIERS) {
        // `[WXG-T-585]` 2026-11-07 切生产：主界面改 v2 绝对坐标档 ⇒
        // CTA 378×179 @x186（v1 的 324×92 @x218 退场），热区与视觉同框；
        // ◀▶ = 坐标图读数 110×116 @18 / 109×116 @625（两枚读数自身差 1~2 px）⇒ 镜像按读数分辨率判（±3）。
        it(`${t.name}：CTA 热区 = 378×179 @x186 且点中心命中 start；◀▶ 热区关于屏中线镜像（±3）`, () => {
            const a = anchorsOf(t);
            const btns = metaLayout('none', WALL_ROWS, a).buttons;
            const start = btns.find((b) => b.id === 'start')!.box;
            expect(start.x).toBe(MENU_V2.cta.x);
            expect(start.w).toBe(MENU_V2.cta.w);
            expect(start.h).toBe(MENU_V2.cta.h);
            expect(start.x + start.w / 2).toBeCloseTo(DESIGN_W / 2, 6); // 水平居中
            const prev = btns.find((b) => b.id === 'carousel-prev')!.box;
            const next = btns.find((b) => b.id === 'carousel-next')!.box;
            expect(Math.abs(prev.x + prev.w / 2 + (next.x + next.w / 2) - DESIGN_W)).toBeLessThanOrEqual(3);
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
