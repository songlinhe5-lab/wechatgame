/**
 * `[WXG-T-614]` 倒计时结束弹窗 View/ViewModel 契约（用户令「按照 view viewmodel 架构设计」）。
 * 判据只钉工程可证面：① 持续型 VM 逐帧复用同一预分配对象、钮框与命中**同引用**；
 * ② 位图腿三枚 blit（木牌带九宫格 fx）+ 文字让开烘入图标；③ 缺图 ⇒ 同几何程序化回退（零 blit）；
 * ④ 广告在播 ⇒ 主钮禁用双通道；⑤ 仅重试档牌高 404 + 说明行。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { RenderModelBuilder, nineSliceFx, type DrawCommand } from '@wxgame/framework';
import { DESIGN_H, DESIGN_W, REVIVE_BONUS_SEC, TIMEOUT_GEO, TIMEOUT_TEXTURES } from '../src/config/tuning.js';
import { failPanelLayout } from '../src/systems/fail-panel.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { setMenuBitmapResolver } from '../src/view/meta-widgets.js';
import { createTimeoutViewModel, updateTimeoutViewModel } from '../src/view/timeout-view-model.js';
import { drawTimeoutView } from '../src/view/timeout-view.js';
import type { BeadsSnapshot } from '../src/game/state.js';
import { createBeadsHarness, simpleTestLevel } from './helpers.js';

const snap = (override: Partial<BeadsSnapshot> = {}): BeadsSnapshot => {
    const harness = createBeadsHarness({
        noAssemble: true,
        levels: [simpleTestLevel()],
        saveKey: 'wxgame.beads.test.timeout.view',
    });
    while (harness.game.phase === 'playing') harness.advance(0.5);
    return { ...harness.game.snapshot, ...override };
};

const frame = (ready: (id: string) => boolean, s: BeadsSnapshot): readonly DrawCommand[] => {
    setMenuBitmapResolver(ready);
    const vm = createTimeoutViewModel();
    updateTimeoutViewModel(vm, s);
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    drawTimeoutView(b, vm, DEFAULT_PALETTE);
    return b.end().commands;
};
const blits = (cmds: readonly DrawCommand[], id: string) => cmds.filter(
    (c): c is Extract<DrawCommand, { kind: 'blit' }> => c.kind === 'blit' && c.textureId === id,
);
const texts = (cmds: readonly DrawCommand[]) => cmds.filter(
    (c): c is Extract<DrawCommand, { kind: 'text' }> => c.kind === 'text',
);

afterEach(() => setMenuBitmapResolver(undefined));

describe('WXG-T-614 倒计时结束弹窗 View/ViewModel', () => {
    it('持续型 VM：逐帧写同一预分配对象，钮框与 failPanelLayout 同引用（绘制命中同源）', () => {
        const vm = createTimeoutViewModel();
        const slot0 = vm.buttons[0];
        const s = snap();
        updateTimeoutViewModel(vm, s);
        updateTimeoutViewModel(vm, { ...s, pressedButton: 'revive' });
        expect(vm.buttons[0]).toBe(slot0);
        expect(vm.buttonCount).toBe(2);
        const layout = failPanelLayout(true);
        expect(vm.plate).toBe(layout.panel);
        expect(vm.buttons[0]!.rect).toBe(layout.buttons[0]!.rect);
        expect(vm.buttons[1]!.rect).toBe(layout.buttons[1]!.rect);
        // 按下态只动 pressDy，⛔ 不动框（命中不随按下位移）。
        expect(vm.buttons[0]!.pressDy).not.toBe(0);
        expect(vm.buttons[0]!.rect).toBe(layout.buttons[0]!.rect);
    });

    it('位图腿：木牌九宫格 + 双钮 blit，框与命中同源；主行文字让开烘入图标', () => {
        const s = snap();
        const cmds = frame(() => true, s);
        const plaque = blits(cmds, TIMEOUT_TEXTURES.plaque);
        expect(plaque).toHaveLength(1);
        expect(plaque[0]!.fx).toEqual(nineSliceFx(TIMEOUT_GEO.slice.capX, TIMEOUT_GEO.slice.capY));
        const layout = failPanelLayout(true);
        expect(plaque[0]!.x).toBe(layout.panel.xMin);
        expect(plaque[0]!.w).toBe(TIMEOUT_GEO.plate.w);
        expect(plaque[0]!.h).toBe(TIMEOUT_GEO.plate.h);
        for (const [i, id] of [TIMEOUT_TEXTURES.continueBtn, TIMEOUT_TEXTURES.retryBtn].entries()) {
            const b = blits(cmds, id);
            expect(b, id).toHaveLength(1);
            expect(b[0]!.x).toBe(layout.buttons[i]!.rect.xMin);
            expect(b[0]!.y).toBe(layout.buttons[i]!.rect.yMin);
            expect(b[0]!.w).toBe(layout.buttons[i]!.rect.xMax - layout.buttons[i]!.rect.xMin);
        }
        const geo = [TIMEOUT_GEO.continueBtn, TIMEOUT_GEO.retryBtn];
        const mains = texts(cmds).filter((t) => t.text === '继续本关' || t.text === '重试本关');
        // 描边四向垫底 + 面字 = 每行 5 条；面字横锚 = 钮左 + 稿面 textCx。
        expect(mains).toHaveLength(10);
        for (const [i, label] of ['继续本关', '重试本关'].entries()) {
            const face = mains.filter((t) => t.text === label && t.shadow !== undefined);
            expect(face, label).toHaveLength(1);
            expect(face[0]!.x).toBe(layout.buttons[i]!.rect.xMin + geo[i]!.textCx);
        }
        expect(texts(cmds).some((t) => t.text === `看广告能增加${REVIVE_BONUS_SEC}秒时间`)).toBe(true);
    });

    it('缺图 ⇒ 同几何程序化回退：零 blit、钮面纯色、文字回钮心（⛔ 不留左偏）', () => {
        const cmds = frame(() => false, snap());
        expect(cmds.filter((c) => c.kind === 'blit')).toHaveLength(0);
        const layout = failPanelLayout(true);
        const faces = cmds.filter(
            (c): c is Extract<DrawCommand, { kind: 'rect' }> => c.kind === 'rect'
                && (c.fill === DEFAULT_PALETTE.success || c.fill === DEFAULT_PALETTE.hintBlue),
        );
        expect(faces).toHaveLength(2);
        expect(faces[0]!.x).toBe(layout.buttons[0]!.rect.xMin);
        expect(faces[0]!.h).toBe(TIMEOUT_GEO.continueBtn.h);
        const mains = texts(cmds).filter((t) => (t.text === '继续本关' || t.text === '重试本关') && t.shadow !== undefined);
        for (const [i, t] of mains.entries()) {
            const r = layout.buttons[i]!.rect;
            expect(t.x).toBe((r.xMin + r.xMax) / 2);
        }
    });

    it('广告在播 ⇒ 主钮禁用双通道（woodFaceDisabled 面 + 60% 字），续时钮位图退场', () => {
        const cmds = frame(() => true, snap({ watchingAd: true }));
        expect(blits(cmds, TIMEOUT_TEXTURES.continueBtn)).toHaveLength(0);
        expect(blits(cmds, TIMEOUT_TEXTURES.retryBtn)).toHaveLength(1);
        const disabled = cmds.filter(
            (c): c is Extract<DrawCommand, { kind: 'rect' }> => c.kind === 'rect' && c.fill === DEFAULT_PALETTE.woodFaceDisabled,
        );
        expect(disabled).toHaveLength(1);
        expect(disabled[0]!.w).toBe(TIMEOUT_GEO.continueBtn.w);
        const label = texts(cmds).find((t) => t.text === '继续本关')!;
        expect(label.fill).toBe('rgba(255,246,232,0.6)');
        expect(label.shadow).toBeUndefined();
    });

    it('仅重试档：牌高 404、说明行「本关已续时」、单钮上移进主钮槽', () => {
        const s = snap({ reviveAvailable: false });
        const cmds = frame(() => true, s);
        const plaque = blits(cmds, TIMEOUT_TEXTURES.plaque)[0]!;
        expect(plaque.h).toBe(TIMEOUT_GEO.plate.hRetryOnly);
        expect(blits(cmds, TIMEOUT_TEXTURES.continueBtn)).toHaveLength(0);
        const retry = blits(cmds, TIMEOUT_TEXTURES.retryBtn)[0]!;
        const layout = failPanelLayout(false);
        expect(retry.y).toBe(layout.buttons[0]!.rect.yMin);
        expect(texts(cmds).some((t) => t.text === '本关已续时')).toBe(true);
        // 中心不变式（WXG-T-323）：两档牌中心 = 设计帧中心 + 逐机位移。
        expect(plaque.y + plaque.h / 2).toBe(DESIGN_H / 2);
    });

    it('F7⑤ 钮族固定档：largeText 只动说明行，⛔ 不动钮内主行/副行（WXG-T-617 无障碍批裁定守卫）', () => {
        const faceFont = (cmds: readonly DrawCommand[], label: string) =>
            texts(cmds).find((t) => t.text === label && t.shadow !== undefined)!.font;
        const hintFont = (cmds: readonly DrawCommand[]) =>
            texts(cmds).find((t) => t.text.startsWith('看广告能增加'))!.font;
        const normal = frame(() => true, snap());
        const large = frame(() => true, snap({ largeText: true }));
        for (const label of ['继续本关', '重试本关']) {
            expect(faceFont(large, label), label).toBe(faceFont(normal, label));
        }
        expect(hintFont(large)).toBe(hintFont(normal));
        // 说明行属说明类 ⇒ 随 largeText（仅重试档才有）：28 → 35 两档必须不同。
        const subFont = (cmds: readonly DrawCommand[]) =>
            texts(cmds).find((t) => t.text === '本关已续时')!.font;
        const subN = frame(() => true, snap({ reviveAvailable: false }));
        const subL = frame(() => true, snap({ reviveAvailable: false, largeText: true }));
        expect(subFont(subL)).not.toBe(subFont(subN));
    });
});