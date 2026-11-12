/**
 * `[WXG-T-609]` 关卡详情橱窗面板（Figma `192:42`）：从稿面拆出的独立资源接入判据。
 *
 * 只钉工程可证面：① 位图就绪 ⇒ 木牌之后恰一条 `showcase` blit，几何单源同 `LEVEL_DETAIL_GEO`；
 * ② 缺图 ⇒ 零 blit（纯木纹牌仍可读，⛔ 不叠程序化第二套玻璃框）。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { DESIGN_H, DESIGN_W, HANDDRAWN_STYLE_ID, LEVEL_DETAIL_GEO, LEVEL_DETAIL_TEXTURES } from '../src/config/tuning.js';
import { LEVELS } from '../src/config/levels.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { levelDetailPlate } from '../src/view/meta-layout.js';
import { setMenuBitmapResolver } from '../src/view/meta-widgets.js';
import { drawBeadFace } from '../src/view/menu-signage.js';
import { drawLevelDetailPage } from '../src/view/meta-level-detail-page.js';
import type { MetaViewData } from '../src/view/meta-types.js';

const data = (levelIndex = 0): MetaViewData => Object.freeze({
    overlay: 'level-detail', detailLevelIndex: levelIndex, detailLevel: LEVELS[levelIndex],
    // `[WXG-T-621]` 珠面跟随当前应用风格：详情帧也用非默认档 ⇒ 切片断言同时钉住 `styleId` 透传。
    beadStyle: HANDDRAWN_STYLE_ID,
    starsByLevel: [], wallSlots: [], wallLevels: [],
    reduceMotion: false, largeText: false,
}) as unknown as MetaViewData;

const frame = (ready: (id: string) => boolean, levelIndex = 0): readonly DrawCommand[] => {
    setMenuBitmapResolver(ready);
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    drawLevelDetailPage(b, data(levelIndex), DEFAULT_PALETTE, DESIGN_H);
    return b.end().commands;
};
const panels = (cmds: readonly DrawCommand[]) => cmds.filter(
    (c) => c.kind === 'blit' && (c as { textureId: string }).textureId === LEVEL_DETAIL_TEXTURES.showcase,
) as readonly { x: number; y: number; w: number; h: number }[];

afterEach(() => setMenuBitmapResolver(undefined));

describe('WXG-T-609 关卡详情橱窗面板', () => {
    it('位图就绪：恰一条 blit，几何 = Figma 192:42（469×638，帧内 @143,376）', () => {
        const blits = panels(frame((id) => id === LEVEL_DETAIL_TEXTURES.showcase || id === LEVEL_DETAIL_TEXTURES.plaque));
        expect(blits).toHaveLength(1);
        const s = LEVEL_DETAIL_GEO.showcase;
        const plate = levelDetailPlate();
        const plateY = DESIGN_H - LEVEL_DETAIL_GEO.plate.yDown - LEVEL_DETAIL_GEO.plate.h;
        expect(blits[0]!.x).toBe(plate.x + (s.x - LEVEL_DETAIL_GEO.plate.x));
        expect(blits[0]!.y).toBe(plate.y + (DESIGN_H - s.yDown - s.h - plateY));
        expect(blits[0]!.w).toBe(s.w);
        expect(blits[0]!.h).toBe(s.h);
    });

    it('缺图 ⇒ 不叠面板（纯木纹牌仍可读），零 showcase blit', () => {
        expect(panels(frame(() => false))).toHaveLength(0);
    });

    it('`[WXG-T-619/T-620]` 橱窗珠面 = 共享 `drawBeadFace` 同腿（与选关格同一珠体通道）', () => {
        const cmds = frame(() => false);
        const thumb = LEVEL_DETAIL_GEO.thumb;
        const fit = LEVEL_DETAIL_GEO.thumbFit;
        const plate = levelDetailPlate();
        const plateY = DESIGN_H - LEVEL_DETAIL_GEO.plate.yDown - LEVEL_DETAIL_GEO.plate.h;
        // `[WXG-T-918]` 槽几何新口径：中心 = 橱窗面板轴、下缘 = 内容框底（托盘面）；
        // `[WXG-T-924]` 展示框改取 `thumbFit`（底锚仍由 `thumb` 框下缘推出）。
        const slot = {
            x: plate.x + (LEVEL_DETAIL_GEO.showcase.x + LEVEL_DETAIL_GEO.showcase.w / 2 - fit.w / 2 - LEVEL_DETAIL_GEO.plate.x),
            y: plate.y + (DESIGN_H - thumb.yDown - thumb.h - plateY),
            w: fit.w,
            h: fit.h,
        };
        const ref = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        ref.begin();
        // `[WXG-T-925]` 页面腿已带贴纸轮廓 ⇒ 参照腿同参（含轮廓），按住「同一条共享腿」判据。
        drawBeadFace(ref, LEVELS[0]!, slot.x, slot.y, slot.w, slot.h, DEFAULT_PALETTE, undefined, HANDDRAWN_STYLE_ID, undefined, 'bottom', true);
        const refCmds = ref.end().commands;
        expect(refCmds.length).toBeGreaterThan(0);
        // 详情帧内**连续命令切片**（全 kind，不止 circle）与共享腿逐条一致 ⇒ 两页绘制方式同源；
        // 帧内另有少量非珠命令（道具图标等）允许在珠流前后存在 ⇒ 用连续切片比对。
        // `[WXG-T-620]` 珠体腿 = facet-4（rect/polygon/circle 混排）⇒ 旧「只比圆流」口径退役。
        const sig = (c: DrawCommand) => JSON.stringify(c);
        const frameSigs = cmds.map(sig);
        const refSigs = refCmds.map(sig);
        const at = frameSigs.indexOf(refSigs[0]!);
        expect(at).toBeGreaterThanOrEqual(0);
        expect(frameSigs.slice(at, at + refSigs.length)).toEqual(refSigs);
    });

    // `[WXG-T-918]` 用户令「图案需要落在托盘上，而且图案要居中显示」：宽盘（第 7 关 14×8）
    // 是最能区分的样本 —— 若仍走槽内垂直居中，底缘会离托盘面（旧 240 槽为 35.7）。
    it('`[WXG-T-918]` 图案落托盘 + 居中：宽盘底缘贴托盘面、水平轴 = 橱窗轴', () => {
        const idx = 6;
        const lv = LEVELS[idx]!;
        const cmds = frame(() => false, idx);
        const plate = levelDetailPlate();
        const plateY = DESIGN_H - LEVEL_DETAIL_GEO.plate.yDown - LEVEL_DETAIL_GEO.plate.h;
        const thumb = LEVEL_DETAIL_GEO.thumb;
        const fit = LEVEL_DETAIL_GEO.thumbFit;
        const trayY = plate.y + (DESIGN_H - thumb.yDown - thumb.h - plateY);
        const slotX = plate.x + (LEVEL_DETAIL_GEO.showcase.x + LEVEL_DETAIL_GEO.showcase.w / 2 - fit.w / 2 - LEVEL_DETAIL_GEO.plate.x);
        const ref = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        ref.begin();
        drawBeadFace(ref, lv, slotX, trayY, fit.w, fit.h, DEFAULT_PALETTE, undefined, HANDDRAWN_STYLE_ID, undefined, 'bottom', true);
        const refCmds = ref.end().commands;
        const sig = (c: DrawCommand) => JSON.stringify(c);
        const at = cmds.map(sig).indexOf(sig(refCmds[0]!));
        expect(at, '页面帧必须含「底对齐」珠流（旧居中腿对宽盘会整体上浮）').toBeGreaterThanOrEqual(0);
        expect(cmds.map(sig).slice(at, at + refCmds.length)).toEqual(refCmds.map(sig));
        // 水平：珠面栅格中心 = 橱窗轴（377.5）；旧稿面内容框中心 392.5 偏轴 15。
        const pitch = Math.min(fit.w / lv.cols, fit.h / lv.rows);
        const gridCx = slotX + (fit.w - lv.cols * pitch) / 2 + (lv.cols * pitch) / 2;
        const showcaseCx = plate.x + (LEVEL_DETAIL_GEO.showcase.x + LEVEL_DETAIL_GEO.showcase.w / 2 - LEVEL_DETAIL_GEO.plate.x);
        expect(gridCx).toBeCloseTo(showcaseCx, 6);
    });
});
