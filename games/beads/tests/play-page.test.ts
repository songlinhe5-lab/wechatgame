/**
 * UI-41 · PlayPage 对局页基础场景（ADR-0032 §5 / §12）。
 *
 * 验收原文：「对局金样本对拍；棋盘输入测试全绿」。
 * - 金样本零差异由 `ui-golden.test.ts` 的 playing 态承担（本文件不复制夹具）；
 * - 本文件钉住三件：① 门面 = `drawPlayPage` + 结算层的前缀等价；② 绘制/命中同源
 *   （齿轮 / 托盘槽 / 道具卡 / 展开钮）；③ 静态门（旧文件不再自带这些 draw，且主菜单
 *   齿轮仍复用同一函数）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RenderModelBuilder, type RenderModel } from '@wxgame/framework';
import {
  DESIGN_H,
  DESIGN_W,
  HUD_BAND,
  POWERUP_TYPES,
  TRAY_BASE_SLOTS,
  expandButtonLayout,
  powerupCardRects,
  trayLayout,
} from '../src/config/tuning.js';
import { hitExpandButton, hitGear, hitPowerupCard, hitTraySlot } from '../src/game/beads-game/hit-test.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS } from '../src/view/palette.js';
import { drawPlayPage } from '../src/view/play-page.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(resolve(SRC_ROOT, rel), 'utf8');

function harness(): Harness {
    return createBeadsHarness({
        noAssemble: true,
        levels: [simpleTestLevel()],
        saveKey: 'wxgame.beads.test.ui41',
    });
}

function modelOf(fn: (b: RenderModelBuilder) => void): RenderModel {
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    fn(b);
    return b.end();
}

describe('UI-41 · PlayPage', () => {
    it('门面等价：buildBeadsView 的前缀 ≡ drawPlayPage（结算层只在其后追加）', () => {
        const h = harness();
        const full = modelOf((b) => buildBeadsView(b, h.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS));
        const play = modelOf((b) =>
            drawPlayPage(b, h.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS, h.game.snapshot.phase === 'playing'),
        );
        expect(play.commands.length).toBeGreaterThan(0);
        expect(full.commands.slice(0, play.commands.length)).toEqual(play.commands);
    });

    it('绘制 / 命中同源：齿轮、托盘槽、道具卡、展开钮的中心都能被同一布局命中', () => {
        const gearCy = (HUD_BAND.yMin + HUD_BAND.yMax) / 2;
        expect(hitGear(60, gearCy, 0)).toBe(true);

        const lay = trayLayout(Math.ceil(TRAY_BASE_SLOTS / 12), DESIGN_W);
        for (let idx = 0; idx < 6; idx++) {
            const row = Math.floor(idx / 12);
            const col = idx % 12;
            expect(hitTraySlot(lay.slotCenterX(col), lay.slotCenterY(row), TRAY_BASE_SLOTS, DESIGN_W)).toBe(idx);
        }

        const cards = powerupCardRects();
        for (let i = 0; i < cards.length; i++) {
            const r = cards[i]!;
            expect(hitPowerupCard(r.x + r.w / 2, r.bottom + r.h / 2)).toBe(POWERUP_TYPES[i]);
        }

        const btn = expandButtonLayout();
        expect(hitExpandButton(btn.x + btn.w / 2, btn.bottom + btn.h / 2, false)).toBe(true);
        expect(hitExpandButton(btn.x + btn.w / 2, btn.bottom + btn.h / 2, true)).toBe(false);
    });

    it('静态门：对局页绘制单源，旧门面不再自带 HUD / 棋盘 / 托盘 / 道具带 / 缩放', () => {
        const play = read('src/view/play-page.ts');
        const vm = read('src/view/view-model.ts');
        const order = [
            'drawHud(builder, snap, palette);',
            'drawGrid(builder, snap, palette, inks);',
            'drawZoomControls(builder, snap, palette, zoomControlsVisible);',
            'drawTray(builder, snap, palette, inks);',
            'drawExpandButton(builder, snap, palette);',
            'drawPowerupBand(builder, snap, palette);',
        ];
        let at = -1;
        for (const call of order) {
            const next = play.indexOf(call);
            expect(next).toBeGreaterThan(at);
            at = next;
        }
        expect(play).toContain('export function drawPlayPage(');
        expect(play).toContain('export function drawGear(');
        expect(vm).toContain('drawPlayPage(builder, snap, palette, inks, snap.phase === \'playing\');');
        for (const gone of ['function drawHud(', 'function drawGrid(', 'function drawTray(', 'function drawPowerupBand(', 'function drawZoomControls(', 'export function drawGear(']) {
            expect(vm).not.toContain(gone);
        }
        expect(read('src/view/meta-view.ts')).toContain("import { drawGear } from './play-page.js';");
    });
});
