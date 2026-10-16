/**
 * 动态设计高（`dynamicHeight`，宽恒 750、高 = max(1334, 750×屏高/屏宽)）下的对局页适配（P1 / A1–A3）。
 *
 * 钉三件事：① `snap.hudDy` = 实际设计高 − 1334（此前全仓无赋值、恒 0 ⇒ HUD 浮在屏下 290px）；
 * ② 齿轮热区与 HUD 绘制同源上移（图 ≠ 热区 = 点不动设置）；③ 全屏图元（scrim）铺满真实屏高。
 * 基准档（1334）零变化由既有套件（封箱快照等）守。
 */
import { describe, expect, it } from 'vitest';
import { RenderModelBuilder, Viewport } from '@wxgame/framework';
import { DESIGN_W, GEAR_HIT_SIZE, HUD_BAND } from '../src/config/tuning.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';

/** iPhone X 级 375×812 ⇒ 设计高 round(750×812/375) = 1624。 */
const TALL_H = 1624;
const DY = TALL_H - 1334;

function tallHarness(key: string): Harness {
    const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: key });
    const vp = new Viewport(750, 1334, true);
    vp.resize(375, 812);
    (h.services as { viewport: Viewport }).viewport = vp;
    return h;
}

function frame(h: Harness): ReturnType<RenderModelBuilder['end']> {
    const b = new RenderModelBuilder(DESIGN_W, h.services.viewport.designHeight);
    b.begin();
    buildBeadsView(b, h.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS);
    return b.end();
}

describe('对局页 · 动态设计高', () => {
    it('视口前提：高屏设计高 = 1624', () => {
        expect(tallHarness('wxgame.beads.test.dh-pre').services.viewport.designHeight).toBe(TALL_H);
    });

    it('hudDy = 实际设计高 − 1334（基准档为 0）', () => {
        const base = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.dh-base' });
        base.game.buildRenderModel(new RenderModelBuilder(DESIGN_W, 1334));
        expect(base.game.snapshot.hudDy).toBe(0);

        const h = tallHarness('wxgame.beads.test.dh-dy');
        h.game.buildRenderModel(new RenderModelBuilder(DESIGN_W, TALL_H));
        expect(h.game.snapshot.hudDy).toBe(DY);
    });

    it('齿轮热区随 HUD 上移：新位置可点，旧位置不再响应', () => {
        const old = tallHarness('wxgame.beads.test.dh-gear-old');
        old.advance(1 / 60);
        const oldY = (HUD_BAND.yMin + HUD_BAND.yMax) / 2;
        old.game.tapDesign(GEAR_HIT_SIZE / 2, oldY);
        expect(old.game.phase).not.toBe('paused');

        const moved = tallHarness('wxgame.beads.test.dh-gear-new');
        moved.advance(1 / 60);
        moved.game.tapDesign(GEAR_HIT_SIZE / 2, oldY + DY);
        expect(moved.game.phase).toBe('paused');
    });

    it('暂停遮罩铺满真实屏高（不是 1334）', () => {
        const h = tallHarness('wxgame.beads.test.dh-scrim');
        h.advance(1 / 60);
        h.game.tapDesign(GEAR_HIT_SIZE / 2, (HUD_BAND.yMin + HUD_BAND.yMax) / 2 + DY);
        h.advance(1);
        const rects = frame(h).commands.filter((c) => c.kind === 'rect' && c.x === 0 && c.y === 0 && c.w === DESIGN_W);
        expect(rects.some((c) => c.kind === 'rect' && c.h === TALL_H)).toBe(true);
    });
});
