/**
 * T-087 feedback VFX — GAP-04 wrong/hint, GAP-03 onboarding, GAP-10 danger pulse.
 *
 * These lock the presentation-phase contract that `beads-game` writes into the
 * snapshot and `view-model` reads back (L5: render stays a pure function of the
 * snapshot). Each GAP gets a game-side phase assertion AND a command-level
 * render assertion, so neither the timer plumbing nor the ring drawing can rot
 * silently (the 假绿 class of defect this 波次 is chasing).
 */

import { describe, it, expect } from 'vitest';
import { RenderModelBuilder, type DrawCommand, type RectCommand, type TextCommand } from '@wxgame/framework';
import {
    BEAD_CELL,
    BEAD_PITCH,
    DESIGN_H,
    DESIGN_W,
    TAP_HINT_MS,
    TAP_HINT_NO_SELECTION_TEXT,
    WRONG_SHAKE_PX,
} from '../src/config/tuning.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { createBeadsHarness, placeAnyMatching, simpleTestLevel, tapInFrame } from './helpers.js';
import type { BeadsSnapshot } from '../src/game/state.js';

function renderSnap(snap: BeadsSnapshot): readonly DrawCommand[] {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    buildBeadsView(builder, snap, DEFAULT_PALETTE);
    return builder.end().commands;
}

/** A stroke-only rounded rect ring = a `drawStateRing` state outline. */
const isRing = (cmd: DrawCommand, stroke: string): boolean =>
    cmd.kind === 'rect' && cmd.stroke === stroke && cmd.fill === undefined;

describe('T-087 GAP-03 首屏引导', () => {
    it('first run (runs==0): pulses the first bead slot + hints its single matching cell', () => {
        const h = createBeadsHarness({
            levels: [simpleTestLevel()],
            saveKey: 'wxgame.beads.test.t087-first',
        });
        h.advance(1 / 60); // GAP-02 first-feed lands the first bead
        const s = h.game.snapshot;
        expect(s.phase).toBe('playing');
        expect(s.onboarding).toBe(true);
        expect(s.guideSlot).toBeGreaterThanOrEqual(0);
        expect(s.hintRow).toBeGreaterThanOrEqual(0);
        expect(s.hintCol).toBeGreaterThanOrEqual(0);

        // 首珠色 == 引导目标格要求色（单一指向，行主序最前）。
        const firstColor = s.traySlots[s.guideSlot]!.colorIdx;
        expect(h.game.grid.requiredColor(s.hintRow, s.hintCol)).toBe(firstColor);

        // 视图层：目标格画蓝呼吸环、首珠槽画蓝呼吸环（同色 accent_blue）。
        expect(renderSnap(s).some((c) => isRing(c, DEFAULT_PALETTE.hintBlue))).toBe(true);
    });

    it('clears on the first placement and never re-shows for the session', () => {
        const h = createBeadsHarness({
            levels: [simpleTestLevel()],
            saveKey: 'wxgame.beads.test.t087-clear',
        });
        h.advance(1 / 60);
        expect(h.game.snapshot.onboarding).toBe(true);

        // Legit placement: use the hinted bead on its hinted cell.
        const s = h.game.snapshot;
        const slot = s.guideSlot;
        expect(h.game.selectTraySlot(slot)).toBe(true);
        expect(h.game.tapGridCell(s.hintRow, s.hintCol)).toBe(true);
        expect(h.game.snapshot.onboarding).toBe(false);
        expect(h.game.snapshot.hintRow).toBe(-1);
        expect(h.game.snapshot.guideSlot).toBe(-1);
    });

    it('returning player (runs>0): zero onboarding from the first frame', () => {
        const first = createBeadsHarness({
            levels: [simpleTestLevel()],
            saveKey: 'wxgame.beads.test.t087-return',
        });
        const storage = first.storage;
        first.advance(1 / 60);
        const second = createBeadsHarness({
            levels: [simpleTestLevel()],
            saveKey: 'wxgame.beads.test.t087-return',
            storage,
        });
        second.advance(1 / 60);
        expect(second.game.snapshot.onboarding).toBe(false);
    });
});

describe('T-087 GAP-04 wrong 态', () => {
    it('a colour-mismatch reject arms a 200 ms danger shake on the rejected cell', () => {
        const h = createBeadsHarness({
            levels: [simpleTestLevel()],
            saveKey: 'wxgame.beads.test.t087-wrong',
        });
        const game = h.game;
        // cell (0,0) wants colour 1; feed colour 2 → mismatch reject.
        const slot = game.giveTrayBead(2);
        expect(game.selectTraySlot(slot)).toBe(true);
        expect(game.tapGridCell(0, 0)).toBe(false); // rejected
        expect(h.last<{ row: number; col: number }>('bead:rejected')).toMatchObject({ row: 0, col: 0 });

        h.advance(1 / 60); // one step → progress > 0
        const s = game.snapshot;
        expect(s.wrongRow).toBe(0);
        expect(s.wrongCol).toBe(0);
        expect(s.wrongProgress).toBeGreaterThan(0);
        expect(s.wrongProgress).toBeLessThanOrEqual(1);

        // danger ring present on that cell while animating.
        expect(renderSnap(s).some((c) => isRing(c, DEFAULT_PALETTE.danger))).toBe(true);

        // After the 200 ms budget the fx clears itself.
        h.advance(0.35);
        expect(game.snapshot.wrongProgress).toBe(0);
        expect(game.snapshot.wrongRow).toBe(-1);
    });
});

describe('T-087 GAP-10 告急脉冲', () => {
    it('urgent timer switches to danger and pulses its alpha over the 1 s loop', () => {
        const h = createBeadsHarness({
            levels: [simpleTestLevel()],
            saveKey: 'wxgame.beads.test.t087-danger',
        });
        const base = h.game.snapshot;
        // Craft two phases of the 1 s loop on an urgent clock (no real 170 s burn):
        // breathe(0)→lo(0.6), breathe(period/2)→hi(1.0). See tuning DANGER_PULSE_MS.
        const snapLo: BeadsSnapshot = { ...base, urgent: true, pulseClock: 0 };
        const snapHi: BeadsSnapshot = { ...base, urgent: true, pulseClock: 500 };

        const dangerText = (cmds: readonly DrawCommand[]) =>
            cmds.find(
                (c): c is Extract<DrawCommand, { kind: 'text' }> =>
                    c.kind === 'text' && c.fill === DEFAULT_PALETTE.danger,
            );

        const lo = dangerText(renderSnap(snapLo));
        const hi = dangerText(renderSnap(snapHi));
        expect(lo).toBeDefined();
        expect(lo!.alpha).toBeCloseTo(0.6, 5);
        expect(hi!.alpha).toBeCloseTo(1, 5);

        // Non-urgent ⇒ timer text is not danger at all.
        const calm = renderSnap({ ...base, urgent: false, pulseClock: 250 });
        expect(dangerText(calm)).toBeUndefined();

        // Clock icon present: a stroke-only circle outline above the grid band.
        expect(
            renderSnap(snapLo).some(
                (c) =>
                    c.kind === 'circle' &&
                    c.stroke !== undefined &&
                    c.fill === undefined &&
                    c.y < snapLo.gridTop,
            ),
        ).toBe(true);
    });
});

describe('WXG-T-088 D1/E2 可访问性开关消费', () => {
    const firstRect = (
        cmds: readonly DrawCommand[],
        stroke: string,
    ): RectCommand | undefined =>
        cmds.find(
            (c): c is RectCommand => c.kind === 'rect' && c.stroke === stroke && c.fill === undefined,
        );
    const textWith = (
        cmds: readonly DrawCommand[],
        pred: (t: TextCommand) => boolean,
    ): TextCommand | undefined =>
        cmds.find((c): c is TextCommand => c.kind === 'text' && pred(c));

    it('D1 reduceMotion：告急脉冲静态化（α 恒 1，不再 0.6↔1）', () => {
        const h = createBeadsHarness({ saveKey: 'wxgame.beads.test.t088-danger' });
        const base = h.game.snapshot;
        const danger = (cmds: readonly DrawCommand[]) =>
            textWith(cmds, (t) => t.fill === DEFAULT_PALETTE.danger);

        const pulsing = danger(renderSnap({ ...base, urgent: true, pulseClock: 0, reduceMotion: false }));
        const still = danger(renderSnap({ ...base, urgent: true, pulseClock: 0, reduceMotion: true }));
        expect(pulsing).toBeDefined();
        expect(pulsing!.alpha).toBeCloseTo(0.6, 5); // breathe(0) → lo
        expect(still!.alpha).toBeCloseTo(1, 5); // 减弱动效 → 静态红字
    });

    it('D1 reduceMotion：hint 呼吸描边退为静态（α 不再 0.5↔1）', () => {
        const h = createBeadsHarness({
            levels: [simpleTestLevel()],
            saveKey: 'wxgame.beads.test.t088-hint',
        });
        h.advance(1 / 60); // 首供落地，引导目标格就位
        const s = h.game.snapshot;
        expect(s.onboarding).toBe(true);

        const pulsing = firstRect(
            renderSnap({ ...s, reduceMotion: false, pulseClock: 0 }),
            DEFAULT_PALETTE.hintBlue,
        );
        const still = firstRect(
            renderSnap({ ...s, reduceMotion: true, pulseClock: 0 }),
            DEFAULT_PALETTE.hintBlue,
        );
        expect(pulsing!.alpha).toBeCloseTo(0.5, 5); // breathe(0) → lo
        expect(still!.alpha).toBeCloseTo(1, 5); // 减弱动效 → 静态描边（保留）
    });

    it('D1 reduceMotion：错误抖动位移归零（±px → 0）', () => {
        const h = createBeadsHarness({
            levels: [simpleTestLevel()],
            saveKey: 'wxgame.beads.test.t088-shake',
        });
        const game = h.game;
        const slot = game.giveTrayBead(2); // (0,0) 要求色 1，给色 2 → 色不符拒绝
        expect(game.selectTraySlot(slot)).toBe(true);
        expect(game.tapGridCell(0, 0)).toBe(false);
        h.advance(1 / 60);
        const s = game.snapshot;
        expect(s.wrongProgress).toBeGreaterThan(0);

        // 同一相位（p=0.125 → sin(π/2)=1，位移最大）对比抖动与静态。
        const shaken = firstRect(
            renderSnap({ ...s, reduceMotion: false, wrongProgress: 0.125 }),
            DEFAULT_PALETTE.danger,
        );
        const still = firstRect(
            renderSnap({ ...s, reduceMotion: true, wrongProgress: 0.125 }),
            DEFAULT_PALETTE.danger,
        );
        expect(shaken).toBeDefined();
        expect(still).toBeDefined();
        // 静态档无位移 → x 为落位；抖动档偏移一个 WRONG_SHAKE_PX。
        expect(shaken!.x - still!.x).toBeCloseTo(WRONG_SHAKE_PX, 3);
        // 减弱动效下红描边仍画（静态高亮），只是不再抖动/闪烁。
        expect(still!.alpha).toBeCloseTo(1, 5);
    });

    it('E2 largeText：正文/说明类字号放大，数字与标题不受影响', () => {
        const h = createBeadsHarness({ saveKey: 'wxgame.beads.test.t088-large' });
        const base = h.game.snapshot;
        const modeLabel = (snap: BeadsSnapshot) =>
            textWith(renderSnap(snap), (t) => t.text.startsWith('LV'));

        expect(modeLabel({ ...base, largeText: false })!.font).toBe('22px sans-serif');
        expect(modeLabel({ ...base, largeText: true })!.font).toBe('27px sans-serif');

        // 倒计时数字（正文以外）在开关下字号不变。
        const timer = (snap: BeadsSnapshot) =>
            textWith(renderSnap(snap), (t) => /^\d+:\d\d$/.test(t.text));
        expect(timer({ ...base, largeText: true })!.font).toBe('bold 44px sans-serif');
    });
});

describe('T-097 BD-16 无效落点轻提示（ux-spec §5 / input-control §8-7）', () => {
    /** 复刻 view-model 的格心公式（§3.3 冻结常量），不引内部布局对象。 */
    const cellCenter = (snap: BeadsSnapshot, row: number, col: number) => ({
        x: snap.gridLeft + BEAD_CELL / 2 + BEAD_PITCH * col,
        y: snap.gridTop - BEAD_CELL / 2 - BEAD_PITCH * row,
    });

    const textCmd = (cmds: readonly DrawCommand[], want: string): TextCommand | undefined =>
        cmds.find((c) => c.kind === 'text' && c.text === want) as TextCommand | undefined;

    it('无选中珠点可落空格 → 一次性轻提示；零请求、零事件、静默', () => {
        const h = createBeadsHarness({
            levels: [simpleTestLevel()],
            saveKey: 'wxgame.beads.test.t097-hint-on',
        });
        h.advance(1 / 60); // GAP-02 首供：托盘持珠但**未选中**
        const before = h.game.snapshot;
        expect(before.traySelected).toBe(-1);
        // §5 表头统一红线：该通道不许越过 400ms（数值真源同 tuning）。
        expect(TAP_HINT_MS).toBeLessThanOrEqual(400);

        const p = cellCenter(before, 2, 1);
        const plays = h.audio.played.length;
        tapInFrame(h, p.x, p.y);

        const s = h.game.snapshot;
        expect(s.tapHintText).toBe(TAP_HINT_NO_SELECTION_TEXT);
        expect(s.tapHintRow).toBe(2);
        expect(s.tapHintCol).toBe(1);
        // §8-7 判据：S3 计数 0 —— 前置缺口不产生任何请求；通道**静默**
        // （`audio-events §1` 无对应 clip，不得新造）。
        expect(h.count('bead:placed')).toBe(0);
        expect(h.count('bead:rejected')).toBe(0);
        expect(h.audio.played).toHaveLength(plays);

        // 视图层：文本落在被点那一格的格心（align/baseline 居中）。
        const cmd = textCmd(renderSnap(s), TAP_HINT_NO_SELECTION_TEXT);
        expect(cmd).toBeDefined();
        expect(cmd!.x).toBeCloseTo(p.x, 3);
        expect(cmd!.y).toBeCloseTo(p.y, 3);

        // 窗口内恒亮、过窗即清（一次性，不需要玩家二次输入来清除）。
        h.advance(0.2);
        expect(h.game.snapshot.tapHintText).toBe(TAP_HINT_NO_SELECTION_TEXT);
        h.advance(0.2);
        expect(h.game.snapshot.tapHintText).toBe('');
        expect(h.game.snapshot.tapHintRow).toBe(-1);
        expect(h.game.snapshot.tapHintCol).toBe(-1);
    });

    it('已填格维持 §8-5 零反馈帧：无选中再点它不给轻提示', () => {
        const h = createBeadsHarness({
            levels: [simpleTestLevel()],
            saveKey: 'wxgame.beads.test.t097-hint-filled',
        });
        h.advance(1 / 60);
        expect(placeAnyMatching(h.game)).toBe(true);

        const snap = h.game.snapshot;
        const idx = snap.cells.findIndex((c) => c.state === 'filled');
        expect(idx).toBeGreaterThanOrEqual(0);
        const row = Math.floor(idx / snap.gridCols);
        const col = idx % snap.gridCols;
        const plays = h.audio.played.length;

        tapInFrame(h, cellCenter(snap, row, col).x, cellCenter(snap, row, col).y);

        const after = h.game.snapshot;
        expect(after.cells[idx]!.state).toBe('filled'); // 世界态未被改动
        expect(after.tapHintText).toBe('');
        expect(after.tapHintRow).toBe(-1);
        expect(h.count('bead:placed')).toBe(1); // 只有此前那一次合法落子
        expect(h.count('bead:rejected')).toBe(0);
        expect(h.audio.played).toHaveLength(plays);
        expect(textCmd(renderSnap(after), TAP_HINT_NO_SELECTION_TEXT)).toBeUndefined();
    });
});
