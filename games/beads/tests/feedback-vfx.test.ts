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
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import type { RewardedAdProvider } from '@wxgame/framework';
import {
    AD_PLACEHOLDER_HINT_TEXT,
    AD_HINT_TEXT_Y,
    BEAD_CELL,
    BEAD_PITCH,
    DANGER_PULSE_MS,
    DESIGN_H,
    DESIGN_W,
    EXPAND_BTN_H,
    EXPAND_BTN_HIT_H,
    EXPAND_BTN_LABEL,
    EXPAND_BTN_W,
    GEAR_HIT_SIZE,
    HUD_BAND,
    POWERUP_BAND,
    POWERUP_BADGE_SIZE,
    TAP_HINT_MS,
    TAP_HINT_NO_SELECTION_TEXT,
    TRAY_BAND,
    TRAY_BASE_SLOTS,
    TRAY_COLS,
    TRAY_HIT_SIZE,
    TRAY_FULL_PULSE_MS,
    WRONG_SHAKE_PX,
    WRONG_FX_MS,
    WRONG_FADE_IN_MS,
    WRONG_HOLD_MS,
    WRONG_FADE_OUT_MS,
    WRONG_FX_RESTART_GATE_MS,
    expandButtonLayout,
    trayLayout,
} from '../src/config/tuning.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { EXPAND_BTN_INK } from '../src/view/palette.js';
import { pausePanelLayout } from '../src/systems/pause-panel.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { createBeadsHarness, placeAnyMatching, simpleTestLevel, tapInFrame } from './helpers.js';
import type { Harness } from './helpers.js';
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

/** 按字面找一条 `text` 指令（BD-16 / BD-15 两个轻提示 describe 共用）。 */
const textCmd = (cmds: readonly DrawCommand[], want: string): TextCommand | undefined =>
    cmds.find((c) => c.kind === 'text' && c.text === want) as TextCommand | undefined;

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

describe('WXG-T-102 wrong danger 描边单次脉冲 + 500ms 重启门（BD-29）', () => {
    /** `wrong` 格的 danger 只描边环（与 view-model 的 `drawStateRing` 同形）。 */
    const dangerRing = (cmds: readonly DrawCommand[]): RectCommand | undefined =>
        cmds.find(
            (c): c is RectCommand =>
                c.kind === 'rect' && c.stroke === DEFAULT_PALETTE.danger && c.fill === undefined,
        );

    /** 给定归一化进度 `p`（0..1）时 danger 描边环的 α（无环 ⇒ 0）。 */
    const alphaAt = (base: BeadsSnapshot, p: number, reduceMotion = false): number => {
        const cmd = dangerRing(
            renderSnap({ ...base, wrongRow: 0, wrongCol: 0, wrongProgress: p, reduceMotion }),
        );
        return cmd?.alpha ?? 0;
    };

    /** 造一个「已处于 wrong 态」的快照（(0,0) 空槽、需求色 1，给色 2 → mismatch）。 */
    const wrongBase = (saveKey: string): BeadsSnapshot => {
        const h = createBeadsHarness({ levels: [simpleTestLevel()], saveKey });
        const slot = h.game.giveTrayBead(2);
        expect(h.game.selectTraySlot(slot)).toBe(true);
        expect(h.game.tapGridCell(0, 0)).toBe(false); // mismatch → 起播
        h.advance(1 / 60);
        const s = h.game.snapshot;
        expect(s.wrongRow).toBe(0);
        return s;
    };

    it('α 包络 = 淡入 60 → 保持 80 → 淡出 60，一次 fx 窗口内极值点 = 1（不往复）', () => {
        // 分段常量自洽：三段和 = `WRONG_FX_MS`（规格 ux-spec §5:180「＝200ms」）。
        expect(WRONG_FADE_IN_MS + WRONG_HOLD_MS + WRONG_FADE_OUT_MS).toBe(WRONG_FX_MS);

        const base = wrongBase('wxgame.beads.test.t102-envelope');

        // 分段锚点（ms）：淡入中点 → 0.75（ease-out）；保持中 → 1；淡出中点 → 0.75（ease-in）。
        const inMid = WRONG_FADE_IN_MS / 2;
        const holdMid = WRONG_FADE_IN_MS + WRONG_HOLD_MS / 2;
        const outMid = WRONG_FADE_IN_MS + WRONG_HOLD_MS + WRONG_FADE_OUT_MS / 2;
        expect(alphaAt(base, inMid / WRONG_FX_MS)).toBeCloseTo(0.75, 4);
        expect(alphaAt(base, holdMid / WRONG_FX_MS)).toBeCloseTo(1, 6);
        expect(alphaAt(base, outMid / WRONG_FX_MS)).toBeCloseTo(0.75, 4);
        // 两端归零：窗口入口 α≈0、出口 α=0（单次脉冲 ⇒ 起点与终点同一水平）。
        expect(alphaAt(base, 1 / WRONG_FX_MS)).toBeLessThan(0.05);
        expect(alphaAt(base, 1)).toBeCloseTo(0, 6);

        // 全窗采样 400 点：α 序列的**极值点**（峰 + 谷）计数 ≤1，且峰值命中 1。
        const N = 400;
        let prev = alphaAt(base, 1 / N);
        let dir = 0; // +1 上升 / -1 下降 / 0 平台
        let extrema = 0;
        let max = prev;
        for (let i = 2; i <= N; i++) {
            const cur = alphaAt(base, i / N);
            if (cur > max) max = cur;
            const d = cur > prev ? 1 : cur < prev ? -1 : 0;
            if (d !== 0) {
                if (dir !== 0 && d !== dir) extrema++; // 方向翻转 = 一个极值点
                dir = d;
            }
            prev = cur;
        }
        expect(extrema).toBe(1); // 旧实现 |sin(2πp)| 在此为 2 ⇒ 本断言锁死「单峰」回归
        expect(max).toBeCloseTo(1, 6);
    });

    it('reduceMotion：退静态红描边（α 恒 1，0 往复）+ 抖动位移归零', () => {
        const base = wrongBase('wxgame.beads.test.t102-reduce');

        // 静态：窗口内多处相位 α 恒 1（无任何起伏 ⇒ 0 往复）。
        for (const ms of [10, 60, 100, 140, 190]) {
            expect(alphaAt(base, ms / WRONG_FX_MS, true)).toBeCloseTo(1, 6);
        }

        // 抖动位移归零：同相位下 reduceMotion 档的环 x == 落位 x（位移通道关闭）。
        const at = (reduceMotion: boolean) =>
            renderSnap({ ...base, reduceMotion, wrongProgress: 0.125 });
        const shaken = dangerRing(at(false));
        const still = dangerRing(at(true));
        expect(shaken).toBeDefined();
        expect(still).toBeDefined();
        expect(shaken!.x - still!.x).toBeCloseTo(WRONG_SHAKE_PX, 3);
    });

    it('500ms 重启门：门内连点不重启（沿用相位 / 已结束则不给），门外重启', () => {
        const h = createBeadsHarness({
            levels: [simpleTestLevel()],
            saveKey: 'wxgame.beads.test.t102-gate',
        });
        const game = h.game;
        h.advance(1 / 60); // 进 PLAYING
        const slot = game.giveTrayBead(2);

        // t≈16.7ms：首次拒绝 → 起播 fx。此后连点都**不重新选中**（拒绝不取珠，选择留存）。
        expect(game.selectTraySlot(slot)).toBe(true);
        expect(game.tapGridCell(0, 0)).toBe(false);
        h.advance(0.1); // +100ms ⇒ 相位 ≈ 100/200
        expect(game.snapshot.wrongProgress).toBeCloseTo(0.5, 1);

        // ① 门内、fx 仍在播（距起播 100ms < 500ms）：连点**不重启** ⇒ 相位继续推进。
        expect(game.tapGridCell(0, 0)).toBe(false);
        h.advance(1 / 60);
        expect(game.snapshot.wrongRow).toBe(0);
        expect(game.snapshot.wrongProgress).toBeGreaterThan(0.5); // 若重启会回落 ≈0.08

        // ② 门内、fx 已自然结束（≈383ms，仍 <500ms）：连点**不给任何视觉反馈**。
        h.advance(0.25);
        expect(game.snapshot.wrongProgress).toBe(0); // 200ms 到点已清
        expect(game.tapGridCell(0, 0)).toBe(false);
        h.advance(1 / 60);
        expect(game.snapshot.wrongProgress).toBe(0);
        expect(game.snapshot.wrongRow).toBe(-1);

        // ③ 跨过 500ms 门（≈950ms）：连点**重启** fx ⇒ 相位从小重新起。
        h.advance(WRONG_FX_RESTART_GATE_MS / 1000 + 0.05);
        expect(game.tapGridCell(0, 0)).toBe(false);
        h.advance(1 / 60);
        expect(game.snapshot.wrongRow).toBe(0);
        expect(game.snapshot.wrongProgress).toBeGreaterThan(0);
        expect(game.snapshot.wrongProgress).toBeLessThan(0.25); // 刚起播（非沿用旧相位）
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

        // F7⑤（v1.3）：HUD 小字最小 28px（22px 作废，art-bible §6 / a11y E1 floor）。
        expect(modeLabel({ ...base, largeText: false })!.font).toBe('28px sans-serif');
        expect(modeLabel({ ...base, largeText: true })!.font).toBe('35px sans-serif'); // 28 × 1.25

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

describe('T-097 BD-15 btn_expand 路由与占位（input-control §2.1/§2.2 · powerups §2.6 布局 A）', () => {
    const eb = expandButtonLayout();
    /** 热区中心（= 视觉框中心，二者同心）。 */
    const BTN_MID = { x: eb.hitX + eb.hitW / 2, y: eb.hitBottom + eb.hitH / 2 };

    function adSpy(): { provider: RewardedAdProvider; calls: string[] } {
        const calls: string[] = [];
        const inner = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }).createRewardedAdProvider();
        const provider = new Proxy(inner, {
            get(target, prop, receiver) {
                const value = Reflect.get(target, prop, receiver);
                if (typeof value !== 'function') return value;
                return (...args: unknown[]) => {
                    calls.push(String(prop));
                    return (value as (...a: unknown[]) => unknown).apply(target, args);
                };
            },
        }) as RewardedAdProvider;
        return { provider, calls };
    }

    const mk = (provider?: RewardedAdProvider) =>
        createBeadsHarness({
            levels: [simpleTestLevel()],
            saveKey: 'wxgame.beads.test.t097-expand',
            ...(provider ? { rewardedAd: provider } : {}),
        });

    it('未扩展态点热区中心 → 吞掉 + 一次性占位轻提示，且事件学全零', () => {
        const spy = adSpy();
        const h = mk(spy.provider);
        h.advance(1 / 60); // 首供已在托盘（v1.17 GAP-02）

        const emitted = h.emitted.length;
        const capacity = h.game.tray.capacity;
        const plays = h.audio.played.length;

        tapInFrame(h, BTN_MID.x, BTN_MID.y);

        // 吞掉：路由命中优先级 3，不落到槽/格（`input-control §2.1`）。
        expect(h.game.tapDesign(BTN_MID.x, BTN_MID.y)).toBe(true);
        // 零事件、零槽变化、零扣次、不拉广告（§8-1 的 S4 出口本轮不可达，BD-37）。
        expect(h.emitted.length).toBe(emitted);
        expect(h.game.tray.expanded).toBe(false);
        expect(h.game.tray.capacity).toBe(capacity);
        expect(capacity).toBe(TRAY_BASE_SLOTS);
        expect(h.game.powerups.usedCount).toBe(0);
        expect(spy.calls.filter((c) => c === 'load' || c === 'show')).toEqual([]);
        // 静默：`audio-events §1` 无占位点击音，不得新造。
        expect(h.audio.played).toHaveLength(plays);
        // 与道具超限同文案同语义（§2.6 布局 A）。
        const snap = h.game.snapshot;
        expect(snap.tapHintText).toBe(AD_PLACEHOLDER_HINT_TEXT);
        expect(snap.tapHintAnchor).toBe('expand');
        expect(snap.tapHintRow).toBe(-1);
        expect(snap.tapHintCol).toBe(-1);
    });

    it('提示在 TAP_HINT_MS 窗口后自清（与 BD-16 同通道同上限）', () => {
        const h = mk();
        h.advance(1 / 60);
        tapInFrame(h, BTN_MID.x, BTN_MID.y);
        expect(h.game.snapshot.tapHintText).toBe(AD_PLACEHOLDER_HINT_TEXT);

        h.advance(TAP_HINT_MS / 1000 + 1 / 60);

        const snap = h.game.snapshot;
        expect(snap.tapHintText).toBe('');
        expect(textCmd(renderSnap(snap), AD_PLACEHOLDER_HINT_TEXT)).toBeUndefined();
    });

    it('已扩展态（本轮不可达）点击仍吞掉但零提示 —— 语义已完成', () => {
        const h = mk();
        h.advance(1 / 60);
        expect(h.game.expandTray()).toBe(true);
        const emitted = h.emitted.length;

        expect(h.game.tapDesign(BTN_MID.x, BTN_MID.y)).toBe(true);

        expect(h.game.snapshot.tapHintText).toBe('');
        expect(h.emitted.length).toBe(emitted);
        expect(h.game.tray.capacity).toBeGreaterThan(TRAY_BASE_SLOTS); // 未被二次改写
    });

    it('PAUSED 下点扩展零响应（遮罩吞掉，§8-1）', () => {
        const h = mk();
        h.advance(1 / 60);
        tapInFrame(h, GEAR_HIT_SIZE / 2, (HUD_BAND.yMin + HUD_BAND.yMax) / 2);
        expect(h.game.phase).toBe('paused');
        const emitted = h.emitted.length;

        tapInFrame(h, BTN_MID.x, BTN_MID.y);

        expect(h.game.snapshot.tapHintText).toBe('');
        expect(h.emitted.length).toBe(emitted);
        expect(h.game.phase).toBe('paused');
    });

    it('几何：热区 132×88（accessibility C1）、视觉同心、与槽热区/道具带零重叠', () => {
        expect([eb.hitW, eb.hitH]).toEqual([EXPAND_BTN_W, EXPAND_BTN_HIT_H]);
        expect([EXPAND_BTN_W, EXPAND_BTN_HIT_H]).toEqual([132, 88]);
        // 视觉高 48 < 88 ⇒ 只扩热区不改视觉，二者同心。
        expect([eb.w, eb.h]).toEqual([EXPAND_BTN_W, EXPAND_BTN_H]);
        expect(eb.bottom + eb.h / 2).toBeCloseTo(eb.hitBottom + eb.hitH / 2, 6);
        // 落在 `TRAY_BAND` 带下沿之内（§3.4 v1.20）。
        expect(eb.hitBottom).toBeGreaterThanOrEqual(TRAY_BAND.yMin);
        expect(eb.hitBottom + eb.hitH).toBeLessThanOrEqual(TRAY_BAND.yMax);
        // 与 `POWERUP_BAND`（顶 200）不侵。
        expect(eb.hitBottom).toBeGreaterThan(POWERUP_BAND.yMax);
        // 与托盘槽热区（基线态 / 扩展态）零重叠 ⇒ 不需 §8-2 重叠仲裁。
        const half = TRAY_HIT_SIZE / 2;
        for (const rows of [1, Math.ceil((TRAY_BASE_SLOTS + 4) / TRAY_COLS)]) {
            const lay = trayLayout(rows);
            for (let row = 0; row < rows; row++) {
                const cy = lay.slotCenterY(row);
                expect(cy - half).toBeGreaterThan(eb.hitBottom + eb.hitH);
            }
        }
        // 提示文字落在按钮下方的空白带隙，不压任何带。
        expect(AD_HINT_TEXT_Y).toBeLessThan(eb.hitBottom);
        expect(AD_HINT_TEXT_Y).toBeGreaterThan(POWERUP_BAND.yMax);
    });

    it('渲染：胶囊底 + 「扩展」白字 + 常驻 ad_badge 角标（§1.3 / §1.4）', () => {
        const h = mk();
        h.advance(1 / 60);
        const cmds = renderSnap(h.game.snapshot);
        const rects = cmds.filter((c): c is RectCommand => c.kind === 'rect');

        const capsule = rects.find(
            (r) => r.fill === EXPAND_BTN_INK && r.w === EXPAND_BTN_W && r.h === EXPAND_BTN_H,
        );
        expect(capsule).toBeDefined();
        expect(capsule!.x).toBeCloseTo(eb.x, 6);
        expect(capsule!.y).toBeCloseTo(eb.bottom, 6);

        expect(textCmd(cmds, EXPAND_BTN_LABEL)).toBeDefined();

        const badge = rects.find(
            (r) => r.fill === DEFAULT_PALETTE.adBadge && r.w === POWERUP_BADGE_SIZE,
        );
        expect(badge).toBeDefined();
        // 角标在胶囊内右上角（内缩 8,8）。
        expect(badge!.x + badge!.w).toBeLessThanOrEqual(capsule!.x + capsule!.w);
        expect(badge!.y).toBeGreaterThanOrEqual(capsule!.y);
    });
});

// ══════════════════ T-097 BD-10 满槽告警面板描边（ux-spec §5 / assets-spec §1.5）══════════════════
describe('T-097 BD-10 满槽告警面板描边', () => {
    const lay1 = trayLayout(1);

    /**
     * 面板尺寸那条 danger 描边环。`wrong` 态用的也是 `palette.danger`
     * （`drawStateRing` 单格尺寸）⇒ 只能按**几何**分辨，不按颜色。
     */
    const panelRing = (cmds: readonly DrawCommand[]): RectCommand | undefined =>
        cmds.find(
            (c): c is RectCommand =>
                c.kind === 'rect' &&
                c.fill === undefined &&
                c.stroke === DEFAULT_PALETTE.danger &&
                Math.abs(c.w - lay1.panelW) < 1e-6 &&
                Math.abs(c.h - lay1.panelH) < 1e-6,
        );

    /** 灌满基线容量（白盒给料，绕开供料节奏——本条只测表现层通道）。 */
    function mkFull(saveKey: string): Harness {
        const h = createBeadsHarness({ levels: [simpleTestLevel()], saveKey });
        h.advance(1 / 60);
        for (let i = 0; i < TRAY_BASE_SLOTS; i++) h.game.giveTrayBead(1);
        h.advance(1 / 60);
        return h;
    }

    /** 连续 `n` 帧的描边 α 序列（每帧重跑 `buildBeadsView`，L5 纯函数）。 */
    function alphaSeq(h: Harness, n: number): number[] {
        const out: number[] = [];
        for (let f = 0; f < n; f++) {
            const ring = panelRing(renderSnap(h.game.snapshot));
            out.push(ring ? ring.alpha ?? 1 : NaN);
            h.advance(1 / 60);
        }
        return out;
    }

    it('满槽：面板边缘 2px danger 描边，几何与 trayLayout() 同源', () => {
        const h = mkFull('wxgame.beads.test.t097-full');
        const s = h.game.snapshot;
        expect(s.traySlots.every((sl) => sl.state !== 'free')).toBe(true);

        const ring = panelRing(renderSnap(s));
        expect(ring).toBeDefined();
        expect(ring!.lineWidth).toBe(2);
        expect(ring!.x).toBeCloseTo(lay1.panelX, 6);
        expect(ring!.y).toBeCloseTo(lay1.panelBottom, 6);
    });

    it('未满槽：零面板描边（不得常驻红框）', () => {
        const h = createBeadsHarness({
            levels: [simpleTestLevel()],
            saveKey: 'wxgame.beads.test.t097-notfull',
        });
        h.advance(1 / 60);
        h.game.giveTrayBead(1);
        h.advance(1 / 60);
        expect(h.game.snapshot.traySlots.some((sl) => sl.state === 'free')).toBe(true);
        expect(panelRing(renderSnap(h.game.snapshot))).toBeUndefined();
    });

    it('呼吸：α 在 0.6↔1.0 间往返，周期 = TRAY_FULL_PULSE_MS（2Hz ≤3Hz）', () => {
        const h = mkFull('wxgame.beads.test.t097-breathe');
        const seq = alphaSeq(h, 90);
        expect(seq.every((a) => !Number.isNaN(a))).toBe(true);

        const periodFrames = Math.round(TRAY_FULL_PULSE_MS / (1000 / 60)); // 周期 = 30 帧
        expect(periodFrames).toBe(30);
        // 整周期同相（±0 容差 0.02）；半周期必有明显差值（三角波不会“常亮”）。
        for (let f = 0; f + periodFrames < seq.length; f++) {
            expect(Math.abs(seq[f]! - seq[f + periodFrames]!)).toBeLessThan(0.02);
        }
        const half = Math.round(periodFrames / 2); // 15 帧 = 半周期
        let maxDelta = 0;
        for (let f = 0; f + half < seq.length; f++) {
            maxDelta = Math.max(maxDelta, Math.abs(seq[f]! - seq[f + half]!));
        }
        expect(maxDelta).toBeGreaterThan(0.1);
        expect(Math.min(...seq)).toBeCloseTo(0.6, 1);
        expect(Math.max(...seq)).toBeCloseTo(1, 1);
        // 单周期 500ms ⇒ 1s 内两档往返，非「常亮」也非高频闪。
        expect(new Set(seq.slice(0, 60).map((a) => a.toFixed(3))).size).toBeGreaterThanOrEqual(2);
    });

    it('D1 减弱动效：描边保留但 α 恒 1（退静态，不消失）', () => {
        const h = mkFull('wxgame.beads.test.t097-reduce');
        // 面板驱动一律走 `tapDesign()`（= 真 `_handleTap` 路由）：真指针链在
        // 非 PLAYING 相位收不到点击（`_readInput()` 唯一调用点在 `_stepPlaying`）
        // = **BD-34 / WXG-T-100 占位未动码**；本条与 `pause-settings.test.ts`、
        // 探针 P22 同口径，**不得**据此判面板「真机可点」。
        h.game.tapDesign(GEAR_HIT_SIZE / 2, (HUD_BAND.yMin + HUD_BAND.yMax) / 2);
        expect(h.game.phase).toBe('paused');
        const center = (id: string): [number, number] => {
            const b = pausePanelLayout('normal').buttons.find((x) => x.id === id)!;
            return [(b.rect.xMin + b.rect.xMax) / 2, (b.rect.yMin + b.rect.yMax) / 2];
        };

        expect(h.game.tapDesign(...center('toggle-reduce-motion'))).toBe(true);
        expect(h.game.reduceMotion).toBe(true);
        expect(h.game.phase).toBe('paused');
        h.game.tapDesign(...center('resume'));
        expect(h.game.phase).toBe('playing');

        const seq = alphaSeq(h, 40);
        expect(seq.every((a) => !Number.isNaN(a))).toBe(true); // 通道仍在
        expect(seq.every((a) => a === 1)).toBe(true); // 但不动
    });

    /**
     * 自相关估周期：返回使 `seq[f] == seq[f+lag]` 对全部 `f` 成立的最小 `lag`（帧）。
     * 不用「签名种数 ≥2」这种弱断言（可被其它动画伪满足，探针修订 17 同口径）。
     */
    function estPeriod(seq: readonly number[], tol = 0.02): number | null {
        for (let lag = 5; lag * 2 <= seq.length; lag++) {
            let same = true;
            for (let f = 0; f + lag < seq.length; f++) {
                if (Math.abs(seq[f]! - seq[f + lag]!) > tol) {
                    same = false;
                    break;
                }
            }
            if (same) return lag;
        }
        return null;
    }

    /** HUD 时钟图标 α（`GAP-10` 通道；α 在 `stroke` 的 rgba 里，与 rect.alpha 不同源）。 */
    function hudIconAlpha(cmds: readonly DrawCommand[]): number {
        for (const c of cmds) {
            if (c.kind !== 'circle' || c.y < HUD_BAND.yMin || c.y > HUD_BAND.yMax) continue;
            const m = /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/.exec(String(c.stroke ?? ''));
            return m ? Number(m[1]) : 1;
        }
        return 1;
    }

    it('叠加（timer-gameover §8-10）：告急与满槽两区各自往复，各自 ≤3Hz', () => {
        // 单一实例内同时造出「告急 + 满槽」——两个主体同屏才有 §8-10 可谈。
        // 夹具：12 行×13 列（§3.5 最大棋盘 ⇒ demand 足够，A′ 下合法供料可自然灌满，
        // 不用 giveTrayBead——修订 21 同口径）+ 最短关 180s + 最快供料 2.0s；
        // 不落子 ⇒ 槽位只进不出，约 24s 满槽（TRAY_BASE_SLOTS=12）、170s 告急。
        const rows = Array.from({ length: 12 }, (_, i) =>
            Array.from({ length: 13 }, (_, j) => String(((i + j) % 3) + 1)).join(''),
        );
        const h = createBeadsHarness({
            levels: [simpleTestLevel({ id: 92, rows: 12, cols: 13, time: 180, spawnInterval: 2.0, pattern: rows })],
            saveKey: 'wxgame.beads.test.t097-overlay',
        });
        for (let t = 0; t < 60 && h.game.snapshot.traySlots.some((sl) => sl.state === 'free'); t++) h.advance(1);
        expect(h.game.snapshot.traySlots.every((sl) => sl.state !== 'free')).toBe(true);
        for (let t = 0; t < 200 && !h.game.snapshot.urgent; t++) h.advance(1);
        expect(h.game.snapshot.urgent).toBe(true);
        expect(h.game.phase).toBe('playing');

        const tray: number[] = [];
        const hud: number[] = [];
        for (let f = 0; f < 140; f++) {
            const cs = renderSnap(h.game.snapshot);
            const ring = panelRing(cs);
            tray.push(ring ? ring.alpha ?? 1 : NaN);
            hud.push(hudIconAlpha(cs));
            h.advance(1 / 60);
        }
        // 两主体同时在场上（满槽描边在告急期间仍存在）。
        expect(tray.every((a) => !Number.isNaN(a))).toBe(true);
        // 分区计数（`ux-spec §5` 红线口径：闪烁 = 同一区域内 α 的往复）⇒ 两区不合并。
        const trayLag = estPeriod(tray);
        const hudLag = estPeriod(hud);
        // 周期容差取 §8-10 / ux-spec §5 现文的 ±50 ms（= ±3 帧）；不自行加严。
        // HUD 实测 59 帧属量化：告急脉冲相位源 = 倒计时累计，与 `_pulseClock` 不同累加。
        const lagMs = (lag: number | null): number => (lag === null ? NaN : (lag * 1000) / 60);
        expect(Math.abs(lagMs(trayLag) - TRAY_FULL_PULSE_MS)).toBeLessThanOrEqual(50);
        expect(Math.abs(lagMs(hudLag) - DANGER_PULSE_MS)).toBeLessThanOrEqual(50);
        expect(1000 / lagMs(trayLag)).toBeLessThanOrEqual(3);
        expect(1000 / lagMs(hudLag)).toBeLessThanOrEqual(3);
        // 两区不重叠（§3.4 v1.20 带定义）⇒ 不构成「同一区域双振荡器叠加」。
        expect(TRAY_BAND.yMax).toBeLessThan(HUD_BAND.yMin);
    });
});
