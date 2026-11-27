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
import { buildBeadsFrame } from '../src/view/view-model.js';
import { setBeadTintRuntime } from '../src/view/bead-render.js';
import { createBeadsHarness, placeColor, simpleTestLevel, type Harness } from './helpers.js';

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
    it('门面等价：buildBeadsFrame 的前缀 ≡ drawPlayPage（结算层只在其后追加）', () => {
        const h = harness();
        const full = modelOf((b) => buildBeadsFrame(b, h.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS));
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

        // v1.83：第三参数语义由「已扩容」改为 **`canExpand`**（还能不能再升一档）。
        const btn = expandButtonLayout();
        expect(hitExpandButton(btn.x + btn.w / 2, btn.bottom + btn.h / 2, true)).toBe(true);
        expect(hitExpandButton(btn.x + btn.w / 2, btn.bottom + btn.h / 2, false)).toBe(false);
    });

    it('静态门：对局页绘制单源，旧门面不再自带 HUD / 棋盘 / 托盘 / 道具带 / 缩放', () => {
        const play = read('src/view/play-page.ts');
        const vm = read('src/view/view-model.ts');
        // `[WXG-T-1085 · 用户 2026-11-26 实帧「时间胶囊被珠面压住」]` `drawHud` 移到末尾：
        // 常驻 UI 恒在最上层，压在盘面珠与特效之上（旧序 HUD 先画 ⇒ 被珠盖）。
        const order = [
            'drawGrid(builder, snap, palette, inks);',
            'drawZoomControls(builder, snap, palette, zoomControlsVisible);',
            'drawTray(builder, snap, palette, inks);',
            'drawExpandButton(builder, snap, palette);',
            'drawPowerupBand(builder, snap, palette);',
            'drawHud(builder, snap, palette);',
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
        // WXG-T-420 T7：顶栏齿轮画法复用腿随 `drawTopbar` 搬到 `meta-menu.ts`（判例 K-183 ⇒ 守卫跟着迁移）。
        expect(read('src/view/meta-menu.ts')).toContain("import { drawGear } from './play-page.js';");
    });
    it('[WXG-T-1088] 托盘面板**不沉底**（提 graphics 压盘面珠），槽/珠同层走矢量', () => {
        // 用户 2026-11-26 点头：「底槽背景要盖在珠面上面」。面板必须离开 `back`（blit 之下）才压得住
        // 盘面珠；配套把托盘槽/珠 `forceVector`（否则会被面板自己盖住）。三者同层后由绘制序决定。
        const h = harness();
        const cmds = modelOf((b) =>
            drawPlayPage(b, h.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS, true),
        ).commands;
        const rows = Math.ceil(h.game.snapshot.traySlots.length / 12);
        const lay = trayLayout(rows, DESIGN_W);
        const panel = cmds.find(
            (c) => c.kind === 'rect' && c.x === lay.panelX && c.y === lay.panelBottom && c.w === lay.panelW,
        ) as { back?: boolean } | undefined;
        expect(panel, '托盘面板 rect 存在').toBeTruthy();
        expect(panel!.back ?? false, '⛔ 面板必须提层（否则压不住盘面珠）').toBe(false);
        expect(
            cmds.filter((c) => c.kind === 'line' && (c as { back?: boolean }).back === true).length,
            '托盘内阴影须与面板同层',
        ).toBe(0);
        expect(cmds.filter((c) => c.kind === 'clip').length, '⛔ 不靠裁剪盘面').toBe(0);
    });

    it('盘面轮廓必须画在珠体之下，只露外圈、不压豆面', () => {
        const h = harness();
        let placed = false;
        for (let row = 0; row < h.game.grid.rows && !placed; row++) {
            for (let col = 0; col < h.game.grid.cols && !placed; col++) {
                const cell = h.game.grid.cell(row, col);
                if (!cell || cell.void) continue;
                placed = placeColor(h.game, cell.colorIdx, row, col);
            }
        }
        expect(placed, '夹具必须至少落一颗珠').toBe(true);

        setBeadTintRuntime({
            getMaskId: (kind, gauge, styleId) => `tex:${kind}:${gauge}:${styleId}`,
            getTileMaskId: (gauge, styleId) => `tex:tile:${gauge}:${styleId}`,
        });
        try {
            const cmds = modelOf((b) =>
                drawPlayPage(b, h.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS, true),
            ).commands;
            const outline = cmds
                .map((c, i) => ({ c, i }))
                .filter((e) => e.c.kind === 'polygon' && (e.c as { fill?: string }).fill === DEFAULT_PALETTE.shadowInk)
                .map((e) => e.i);
            const beads = cmds
                .map((c, i) => ({ c, i }))
                .filter((e) => e.c.kind === 'blit' && e.c.textureId.startsWith('tex:bead:'))
                .map((e) => e.i);
            expect(outline.length, '盘面轮廓命令必须存在').toBeGreaterThan(0);
            expect(beads.length, '盘面珠体命令必须存在').toBeGreaterThan(0);
            expect(
                cmds
                    .filter((c) => c.kind === 'polygon' && (c as { fill?: string }).fill === DEFAULT_PALETTE.shadowInk)
                    .every((c) => (c as { back?: boolean }).back === true),
                'Cocos 的珠体走 BlitLayer，轮廓必须标记 back 沉到该层之下',
            ).toBe(true);
            expect(
                Math.max(...outline),
                '轮廓若在珠体之后，会像用户实帧那样压到边界豆面上',
            ).toBeLessThan(Math.min(...beads));
        } finally {
            setBeadTintRuntime(undefined);
        }
    });

    it('[WXG-T-1103] 盘面绘制序 = 背景色 → 轮廓 → 珠槽 → 珠子', () => {
        // 用户 2026-11-27 拍板「甲」：B0 背景色必须**单独成条且最先**（沉 backGraphics），
        // 轮廓画在它之后、珠槽与珠子之前 ⇒ 轮廓压得住背景色、压不住豆面。
        // tile 合并腿（B0 + 槽 一条 blit）必须从盘面退出，否则两者之间没有插入点。
        const h = harness();
        let placed = false;
        for (let row = 0; row < h.game.grid.rows && !placed; row++) {
            for (let col = 0; col < h.game.grid.cols && !placed; col++) {
                const cell = h.game.grid.cell(row, col);
                if (!cell || cell.void) continue;
                placed = placeColor(h.game, cell.colorIdx, row, col);
            }
        }
        expect(placed, '夹具必须至少落一颗珠').toBe(true);

        setBeadTintRuntime({
            getMaskId: (kind, gauge, styleId) => `tex:${kind}:${gauge}:${styleId}`,
            getTileMaskId: (gauge, styleId) => `tex:tile:${gauge}:${styleId}`,
        });
        try {
            const cmds = modelOf((b) =>
                drawPlayPage(b, h.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS, true),
            ).commands;
            const idx = (pred: (c: (typeof cmds)[number]) => boolean): number[] =>
                cmds.map((c, i) => ({ c, i })).filter((e) => pred(e.c)).map((e) => e.i);

            const base = idx((c) => c.kind === 'rect' && (c as { back?: boolean }).back === true);
            const outline = idx(
                (c) => c.kind === 'polygon' && (c as { fill?: string }).fill === DEFAULT_PALETTE.shadowInk,
            );
            const sockets = idx((c) => c.kind === 'blit' && c.textureId.startsWith('tex:cell:'));
            const beads = idx((c) => c.kind === 'blit' && c.textureId.startsWith('tex:bead:'));
            const tiles = idx((c) => c.kind === 'blit' && c.textureId.startsWith('tex:tile:'));

            expect(base.length, '背景色 B0 必须单独成条（不再与珠槽合并成 tile）').toBeGreaterThan(0);
            expect(outline.length, '盘面轮廓命令必须存在').toBeGreaterThan(0);
            expect(sockets.length, '珠槽必须走 cell mask').toBeGreaterThan(0);
            expect(beads.length, '盘面珠体命令必须存在').toBeGreaterThan(0);
            expect(tiles.length, '⛔ 盘面不再走 tile 合并腿（B0 与槽之间必须有轮廓的插入点）').toBe(0);

            expect(Math.max(...base), '背景色必须全部先于轮廓').toBeLessThan(Math.min(...outline));
            expect(Math.max(...outline), '轮廓必须先于珠槽（否则压到豆面）').toBeLessThan(Math.min(...sockets));

            // 同格不变式：珠槽先、珠子后（两者格心相同）。
            const centerOf = (c: Extract<(typeof cmds)[number], { kind: 'blit' }>): string =>
                `${Math.round(c.x + c.w / 2)}|${Math.round(c.y + c.h / 2)}`;
            const socketAt = new Map<string, number>();
            cmds.forEach((c, i) => {
                if (c.kind === 'blit' && c.textureId.startsWith('tex:cell:')) socketAt.set(centerOf(c), i);
            });
            for (const c of cmds) {
                if (c.kind !== 'blit' || !c.textureId.startsWith('tex:bead:')) continue;
                const key = centerOf(c);
                const s = socketAt.get(key);
                expect(s !== undefined && cmds.indexOf(c) > s, `格心 ${key} 的珠槽必须先于珠子`).toBe(true);
            }
        } finally {
            setBeadTintRuntime(undefined);
        }
    });
});
