/**
 * `[WXG-T-1004]` Fail 弹窗右上角 ✕ + 放弃确认对话框（用户 2026-11-17 令
 * 「右上角加叉按钮，点后弹确认退出对话框」，推翻 WXG-T-614 稿面「无关闭出口」裁定）。
 * 判据：① ✕ 恒在牌右上角（两档牌高同口径，命中与绘制同源）；② confirm 态模态——
 * 只认两钮、板外点击吞掉；③ confirm-yes 上报回菜单意图、confirm-no 回 Fail 弹窗；
 * ④ 离开 game-over 必清确认态（retry 直调也不残留）；⑤ VM 预分配复用、文字锚与
 * failConfirmLayout 单源（⛔ 视图不得私抄 tuning 数值）。
 */
import { describe, expect, it } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { DESIGN_H, DESIGN_W, TIMEOUT_GEO } from '../src/config/tuning.js';
import {
    FAIL_CONFIRM_MSG,
    FAIL_CONFIRM_NO,
    FAIL_CONFIRM_TITLE,
    FAIL_CONFIRM_YES,
    failConfirmLayout,
    failPanelLayout,
    hitFailConfirm,
    hitFailPanel,
} from '../src/systems/fail-panel.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { createTimeoutViewModel, updateTimeoutViewModel } from '../src/view/timeout-view-model.js';
import { drawTimeoutView } from '../src/view/timeout-view.js';
import type { BeadsSnapshot } from '../src/game/state.js';
import { createBeadsHarness, simpleTestLevel, tapInFrame, type Harness } from './helpers.js';

const center = (r: { xMin: number; yMin: number; xMax: number; yMax: number }) => ({
    x: (r.xMin + r.xMax) / 2,
    y: (r.yMin + r.yMax) / 2,
});

function failHarness(onMenuRequest?: () => void): Harness {
    const harness = createBeadsHarness({
        noAssemble: true,
        levels: [simpleTestLevel()],
        saveKey: 'wxgame.beads.test.fail-confirm',
        ...(onMenuRequest ? { onMenuRequest } : {}),
    });
    while (harness.game.phase === 'playing') harness.advance(0.5);
    expect(harness.game.phase).toBe('game-over');
    return harness;
}

const texts = (cmds: readonly DrawCommand[]) => cmds.filter(
    (c): c is Extract<DrawCommand, { kind: 'text' }> => c.kind === 'text',
);

function frame(s: BeadsSnapshot): readonly DrawCommand[] {
    const vm = createTimeoutViewModel();
    updateTimeoutViewModel(vm, s);
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    drawTimeoutView(b, vm, DEFAULT_PALETTE);
    return b.end().commands;
}

describe('WXG-T-1004 ✕ 命中面（右上角，两档牌高）', () => {
    it.each([true, false])('reviveAvailable=%s：✕ 贴牌右上内缘 12，56²，中心命中 dismiss', (revive) => {
        const layout = failPanelLayout(revive);
        const dr = layout.dismissRect;
        const g = TIMEOUT_GEO.dismissBtn;
        expect(dr.xMax - dr.xMin).toBe(g.r * 2);
        expect(dr.yMax - dr.yMin).toBe(g.r * 2);
        expect(dr.xMax).toBe(layout.panel.xMax - g.rightInset);
        expect(dr.yMax).toBe(layout.panel.yMax - g.topInset);
        const c = center(dr);
        expect(hitFailPanel(c.x, c.y, revive)).toBe('dismiss');
    });
});

describe('WXG-T-1004 放弃确认对话框布局与命中', () => {
    it('560×300 屏居中；左取消右确定；中心命中各自 id；板外 null', () => {
        const cl = failConfirmLayout();
        const g = TIMEOUT_GEO.confirmAbandon;
        expect(cl.plate.xMax - cl.plate.xMin).toBe(g.plate.w);
        expect(cl.plate.yMax - cl.plate.yMin).toBe(g.plate.h);
        expect((cl.plate.xMin + cl.plate.xMax) / 2).toBe(DESIGN_W / 2);
        expect((cl.plate.yMin + cl.plate.yMax) / 2).toBe(DESIGN_H / 2);
        const no = cl.buttons.find((b) => b.id === 'confirm-no')!;
        const yes = cl.buttons.find((b) => b.id === 'confirm-yes')!;
        expect(no.rect.xMax).toBeLessThan(yes.rect.xMin);
        expect(hitFailConfirm(center(no.rect).x, center(no.rect).y)).toBe('confirm-no');
        expect(hitFailConfirm(center(yes.rect).x, center(yes.rect).y)).toBe('confirm-yes');
        expect(hitFailConfirm(10, 10)).toBeNull();
        // 文字锚单源 = tuning（titleCyDown / msgCyDown）。
        expect(cl.titleY).toBe(cl.plate.yMax - g.titleCyDown);
        expect(cl.msgY).toBe(cl.plate.yMax - g.msgCyDown);
    });
});

describe('WXG-T-1004 ViewModel 契约', () => {
    it('缺省非确认态；failConfirming ⇒ 钮框与布局同引用；逐帧复用同一预分配对象', () => {
        const harness = failHarness();
        const snap = harness.game.snapshot;
        const vm = createTimeoutViewModel();
        updateTimeoutViewModel(vm, snap);
        expect(vm.confirming).toBe(false);
        const slot0 = vm.confirmButtons[0];
        const confirming: BeadsSnapshot = { ...snap, failConfirming: true, pressedButton: 'dismiss' };
        updateTimeoutViewModel(vm, confirming);
        expect(vm.confirming).toBe(true);
        expect(vm.dismissPressed).toBe(true);
        const cl = failConfirmLayout();
        expect(vm.confirmPlate).toBe(cl.plate);
        expect(vm.confirmButtons[0]!.rect).toBe(cl.buttons[0]!.rect);
        expect(vm.confirmButtons[1]!.rect).toBe(cl.buttons[1]!.rect);
        expect(vm.confirmTitleY).toBe(cl.titleY);
        expect(vm.confirmMsgY).toBe(cl.msgY);
        updateTimeoutViewModel(vm, confirming);
        expect(vm.confirmButtons[0]).toBe(slot0);
    });
});

describe('WXG-T-1004 绘制契约', () => {
    it('确认态画四文案且标题/说明锚与布局单源；非确认态零确认文案', () => {
        const harness = failHarness();
        const snap = harness.game.snapshot;
        const cl = failConfirmLayout();
        const confirming = frame({ ...snap, failConfirming: true });
        const ts = texts(confirming);
        const title = ts.find((t) => t.text === FAIL_CONFIRM_TITLE)!;
        const msg = ts.find((t) => t.text === FAIL_CONFIRM_MSG)!;
        expect(title).toBeDefined();
        expect(msg).toBeDefined();
        expect(title.y).toBe(cl.titleY);
        expect(msg.y).toBe(cl.msgY);
        expect(ts.some((t) => t.text === FAIL_CONFIRM_YES)).toBe(true);
        expect(ts.some((t) => t.text === FAIL_CONFIRM_NO)).toBe(true);
        const plain = texts(frame(snap));
        expect(plain.some((t) => t.text === FAIL_CONFIRM_TITLE)).toBe(false);
    });
});

describe('WXG-T-1004 真链路由（tap → 状态机 → 快照）', () => {
    it('✕ → 确认态；板外点击被吞；confirm-no 回 Fail；再 ✕ + confirm-yes 上报回菜单', () => {
        let menuRequests = 0;
        const harness = failHarness(() => { menuRequests += 1; });
        const dr = failPanelLayout(harness.game.snapshot.reviveAvailable).dismissRect;
        tapInFrame(harness, center(dr).x, center(dr).y);
        expect(harness.game.snapshot.failConfirming).toBe(true);
        expect(harness.game.phase).toBe('game-over');
        // 模态：板外与 Fail 主钮一律吞掉。
        tapInFrame(harness, 10, 10);
        const reviveRect = failPanelLayout(true).buttons[0]!.rect;
        tapInFrame(harness, center(reviveRect).x, center(reviveRect).y);
        expect(harness.game.snapshot.failConfirming).toBe(true);
        const cl = failConfirmLayout();
        const no = cl.buttons.find((b) => b.id === 'confirm-no')!;
        tapInFrame(harness, center(no.rect).x, center(no.rect).y);
        expect(harness.game.snapshot.failConfirming).toBe(false);
        expect(harness.game.phase).toBe('game-over');
        expect(menuRequests).toBe(0);
        tapInFrame(harness, center(dr).x, center(dr).y);
        const yes = cl.buttons.find((b) => b.id === 'confirm-yes')!;
        tapInFrame(harness, center(yes.rect).x, center(yes.rect).y);
        expect(harness.game.snapshot.failConfirming).toBe(false);
        expect(menuRequests).toBe(1);
    });

    it('确认态直调 retryLevel ⇒ 离开 game-over 必清确认态（不残留到下一局）', () => {
        const harness = failHarness();
        const dr = failPanelLayout(harness.game.snapshot.reviveAvailable).dismissRect;
        tapInFrame(harness, center(dr).x, center(dr).y);
        expect(harness.game.snapshot.failConfirming).toBe(true);
        expect(harness.game.retryLevel()).toBe(true);
        expect(harness.game.phase).toBe('playing');
        expect(harness.game.snapshot.failConfirming).toBe(false);
    });
});