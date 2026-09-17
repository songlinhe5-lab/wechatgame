/**
 * G7 `vfx_denied_press` — 不可填格轻压（WXG-T-152 · T-128「动态质感章」落码③ · 音频原子批）。
 *
 * 规格正本：`art/assets-spec.md` §1.6.7；毫秒真源：`design/ux/ux-spec.md` §5
 * 「不可填格轻压」行（120ms、谷 0.96@40ms、**同格** 250ms 重启门、`sfx_denied`）。
 *
 * 红线判据（TC-GRID-04 / TC-INP-05 双断言）：触发帧 **事件增量 = 0 且命令流出现
 * scale < 1.00**（D1 时为 1px 静态环）——两半缺一即违 §1.6.7「极轻**非惩罚**」。
 * 三层各管一段（`solver-vfx.test.ts` 同族）：① 包络纯函数；② game 侧门与零事件；
 * ③ 命令层 scale / D1 环。⚠️ 只到 `[Node]` 层（K-037：指令流可证 ≠ 屏幕层可证，
 * 观感与真机档分别留 `[B]` / `[R]`）。
 */

import { describe, expect, it } from 'vitest';
import { RenderModelBuilder, type DrawCommand, type RectCommand } from '@wxgame/framework';
import {
    AUDIO_CLIP_DENIED,
    BEAD_CELL,
    BEAD_DRAW_INSET,
    BEAD_PITCH,
    DENIED_PRESS_MS,
    DENIED_PRESS_SCALE_TROUGH,
    DENIED_PRESS_TROUGH_MS,
    FILL_POP_MS,
    FILL_POP_PRESS_MS,
} from '../src/config/tuning.js';
import { fillPopEnvelope, type FillPopEnvelope } from '../src/view/bead-render.js';
import { deniedPressScale } from '../src/view/scene-vfx.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import { pausePanelLayout } from '../src/systems/pause-panel.js';
import type { BeadsSnapshot } from '../src/game/state.js';

const FRAME = 1 / 60;
const TROUGH_P = DENIED_PRESS_TROUGH_MS / DENIED_PRESS_MS; // 40/120 = 1/3
const s = (ms: number): number => ms / 1000;

/**
 * 测试盘：`(0,0)` = locked（`x`）、`(3,5)` = void（`.`）、其余可填。
 * `defaultSwaps` 取 (0,1)='2' 与 (0,2)='3' ⇒ 过 BOOT 校验（helpers 判例）。
 */
function mk(saveKey: string): Harness {
    return createBeadsHarness({
        noAssemble: true,
        levels: [simpleTestLevel({ pattern: ['x23123', '123123', '123123', '12312.', '231231'] })],
        saveKey,
    });
}

/** 格心设计坐标（与 `view-model.drawGrid` 同一公式，§3.3）。 */
function cellCenter(snap: BeadsSnapshot, row: number, col: number): { x: number; y: number } {
    return {
        x: snap.gridLeft + BEAD_CELL / 2 + BEAD_PITCH * col,
        y: snap.gridTop - BEAD_CELL / 2 - BEAD_PITCH * row,
    };
}

/** 真链点击（`tapDesign` → `_handleTap` → S2 路由 → 5c）。 */
function tapCell(h: Harness, row: number, col: number): void {
    const p = cellCenter(h.game.snapshot, row, col);
    h.game.tapDesign(p.x, p.y);
}

function flush(h: Harness, seconds = FRAME): void {
    h.services.audio.flush(seconds);
}

function clearPlayed(h: Harness): void {
    flush(h, 0); // 先排空迟到项（helpers/audio-dispatch 判例）
    h.audio.played.length = 0;
}

/**
 * 逐帧推进 + 逐帧 flush ⇒ scheduler 时钟与 `pulseClock` 同步（audio-dispatch 判例）。
 * ⚠️ `minInterval` 以**实际派发时刻**计（请求入队 ≠ 发声）：若只在末尾一次性 flush，
 * 两次请求会落在同一调度时刻而被 clip 级限流吞掉 ⇒ 门类断言必须走本 helper。
 */
function advFrames(h: Harness, seconds: number): void {
    const n = Math.max(1, Math.round(seconds / FRAME));
    for (let i = 0; i < n; i++) {
        h.advance(FRAME);
        flush(h, FRAME);
    }
}

function deniedCount(snap: BeadsSnapshot): number {
    return snap.deniedCount;
}

function activeSlot(snap: BeadsSnapshot, row: number, col: number): number {
    for (let k = 0; k < snap.deniedRows.length; k++) {
        if (snap.deniedRows[k] === row && snap.deniedCols[k] === col) return snap.deniedProgress[k]!;
    }
    return -1; // 不在表（空槽/过窗已被 -1 过滤）
}

function renderSnap(snap: BeadsSnapshot): readonly DrawCommand[] {
    const builder = new RenderModelBuilder(750, 1334);
    builder.begin();
    buildBeadsView(builder, snap, DEFAULT_PALETTE);
    return builder.end().commands;
}

/** 该格位图元的宽度谱（中心重合判定同 `solver-vfx.test.ts::strokesAt`）。 */
function widthsAt(
    cmds: readonly DrawCommand[],
    snap: BeadsSnapshot,
    row: number,
    col: number,
    kind: 'all' | 'fills' = 'all',
): number[] {
    const c = cellCenter(snap, row, col);
    return cmds
        .filter(
            (k): k is RectCommand =>
                k.kind === 'rect' &&
                (kind === 'all' || k.fill !== undefined) &&
                Math.abs(k.x + k.w / 2 - c.x) < 0.01 &&
                Math.abs(k.y + k.h / 2 - c.y) < 0.01,
        )
        .map((k) => k.w);
}

const countRects = (cmds: readonly DrawCommand[]): number =>
    cmds.filter((c) => c.kind === 'rect').length;

/** 覆写快照的 denied 三数组（view 判据用：不借道 game，纯造数据）。 */
function withDenied(
    snap: BeadsSnapshot,
    entries: { row: number; col: number; p: number }[],
): BeadsSnapshot {
    const rows = [-1, -1, -1, -1];
    const cols = [-1, -1, -1, -1];
    const ps = [0, 0, 0, 0];
    entries.forEach((e, i) => {
        rows[i] = e.row;
        cols[i] = e.col;
        ps[i] = e.p;
    });
    return { ...snap, deniedRows: rows, deniedCols: cols, deniedProgress: ps, deniedCount: entries.length };
}

// ───────────────────────────────────────────── ① 包络（scene-vfx 纯函数）

describe('G7 包络（assets-spec §1.6.7 逐帧公式）', () => {
    it('三个关键相位取规格值：1.00 → 谷 0.96@40ms → 1.00@120ms', () => {
        expect(deniedPressScale(0)).toBeCloseTo(1, 6);
        expect(deniedPressScale(TROUGH_P)).toBeCloseTo(DENIED_PRESS_SCALE_TROUGH, 6);
        expect(deniedPressScale(1)).toBeCloseTo(1, 6);
    });

    it('压下段非增、回弹段非减、全程 clamp [0.96, 1.00]（单谷、不二次过冲）', () => {
        let prev = Number.NaN;
        for (let i = 0; i <= 240; i++) {
            const p = i / 240;
            const v = deniedPressScale(p);
            expect(v).toBeGreaterThanOrEqual(DENIED_PRESS_SCALE_TROUGH - 1e-9);
            expect(v).toBeLessThanOrEqual(1 + 1e-9);
            if (!Number.isNaN(prev)) {
                if (p <= TROUGH_P) expect(v).toBeLessThanOrEqual(prev + 1e-9);
                else expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
            }
            prev = v;
        }
    });

    it('越界进度钳到端点（浮点尾数不致越 clamp）', () => {
        expect(deniedPressScale(-0.5)).toBeCloseTo(1, 9);
        expect(deniedPressScale(1.5)).toBeCloseTo(1, 9);
    });
});

// ────────────────────────────── ② game 侧：零事件红线 + 同格门（真链）

describe('G7 触发与红线（真链 5c · TC-GRID-04/TC-INP-05 事件半边）', () => {
    const TRACKED = [
        'bead:placed',
        'bead:rejected',
        'board:selected',
        'tray:selected',
        'tray:stored',
        'tray:expanded',
        'powerup:used',
    ] as const;

    it('点 locked 格：事件增量全 0、格态零写，但轻压槽激活 + 同帧仅播 `sfx_denied`', () => {
        const h = mk('wxgame.beads.test.g7-locked');
        h.advance(0.2); // 消化 BOOT 的 bgm 等迟到项
        clearPlayed(h);
        const before = TRACKED.map((t) => h.count(t));
        const cell = JSON.stringify(h.game.grid.cell(0, 0));
        tapCell(h, 0, 0);
        h.advance(FRAME);
        flush(h);
        expect(TRACKED.map((t) => h.count(t))).toEqual(before); // 红线：零事件
        expect(JSON.stringify(h.game.grid.cell(0, 0))).toBe(cell); // 零状态写
        const snap = h.game.snapshot;
        expect(deniedCount(snap)).toBe(1);
        expect(activeSlot(snap, 0, 0)).toBeGreaterThan(0);
        expect(h.audio.played).toEqual([AUDIO_CLIP_DENIED]);
    });

    it('点就位（filled 非错位）格：同样零事件 + 轻压起播（5c 两形态同口径）', () => {
        const h = mk('wxgame.beads.test.g7-filled');
        h.game.grid.fill(1, 0, h.game.grid.requiredColor(1, 0)); // 就位珠（非错位 ⇒ 不走 5a）
        h.advance(0.2);
        clearPlayed(h);
        const placedBefore = h.count('bead:placed');
        tapCell(h, 1, 0);
        h.advance(FRAME);
        flush(h);
        expect(h.count('bead:placed')).toBe(placedBefore);
        expect(activeSlot(h.game.snapshot, 1, 0)).toBeGreaterThan(0);
        expect(h.audio.played).toEqual([AUDIO_CLIP_DENIED]);
    });

    it('void（谜面外形格 `.`）零反馈 —— §1.6.7 非触发集（槽不落、音不放）', () => {
        const h = mk('wxgame.beads.test.g7-void');
        h.advance(0.2);
        clearPlayed(h);
        tapCell(h, 3, 5); // '.' = locked + void ⇒ 守卫拒触发
        h.advance(FRAME);
        flush(h);
        expect(deniedCount(h.game.snapshot)).toBe(0);
        expect(h.audio.played).toEqual([]);
    });

    it('同格 250ms 门两端：门内点击不重启、不再放音；过门后槽重置并再放音', () => {
        const h = mk('wxgame.beads.test.g7-gate');
        h.advance(0.2);
        clearPlayed(h);
        tapCell(h, 0, 0); // arm#1 @ T0
        advFrames(h, s(100));
        tapCell(h, 0, 0); // 门内（100 < 250）⇒ 应被吞
        const mid = activeSlot(h.game.snapshot, 0, 0);
        expect(mid).toBeGreaterThan(0.7); // ≈100/120：进度**续进**而非被重置回 0
        advFrames(h, s(200)); // T0+300：双门（视觉 250 / 音频 minInterval）均过
        tapCell(h, 0, 0); // arm#2 ⇒ 重启
        const restarted = activeSlot(h.game.snapshot, 0, 0);
        expect(restarted).toBeGreaterThanOrEqual(0);
        expect(restarted).toBeLessThan(mid); // 已从头起播
        advFrames(h, FRAME);
        expect(h.audio.played.filter((id) => id === AUDIO_CLIP_DENIED)).toHaveLength(2);
    });

    it('不同格并存（同格计口径）：同帧两格 ⇒ 两槽；音频侧受 clip 级 0.25s 限流只放 1（如实登记）', () => {
        const h = mk('wxgame.beads.test.g7-multi');
        h.game.grid.fill(1, 0, h.game.grid.requiredColor(1, 0));
        h.advance(0.2);
        clearPlayed(h);
        tapCell(h, 0, 0); // locked
        tapCell(h, 1, 0); // 就位（同一 `pulseClock`，不同格 ⇒ 互不挡门）
        const snap = h.game.snapshot;
        expect(deniedCount(snap)).toBe(2);
        expect(snap.deniedRows).toContain(0);
        expect(snap.deniedRows).toContain(1);
        h.advance(FRAME);
        flush(h);
        expect(h.audio.played.filter((id) => id === AUDIO_CLIP_DENIED)).toHaveLength(1);
    });

    it('槽容量 = `DENIED_MAX_CELLS`：同帧 5 连点 ⇒ 并存 4、逐出最早起播者', () => {
        const h = mk('wxgame.beads.test.g7-cap');
        for (let c = 0; c < 6; c++) h.game.grid.fill(1, c, h.game.grid.requiredColor(1, c));
        h.advance(0.2);
        clearPlayed(h);
        for (let c = 0; c <= 5; c++) tapCell(h, 1, c); // 6 个就位格同帧
        const snap = h.game.snapshot;
        expect(deniedCount(snap)).toBeLessThanOrEqual(4);
        expect(snap.deniedCols).toContain(5); // 最新一颗在场
        expect(snap.deniedCols).not.toContain(0); // 最早一颗被逐出（死窗记忆让位）
    });

    it('120ms 零残留：在播过滤 ⇒ 数组回 -1/0、`deniedCount` 归 0', () => {
        const h = mk('wxgame.beads.test.g7-residue');
        h.advance(0.2);
        clearPlayed(h);
        tapCell(h, 0, 0);
        h.advance(s(DENIED_PRESS_MS + 30));
        const snap = h.game.snapshot;
        expect(deniedCount(snap)).toBe(0);
        expect(snap.deniedRows.every((r) => r === -1)).toBe(true);
        expect(snap.deniedProgress.every((p) => p === 0)).toBe(true);
    });

    it('`sfxMuted` ⇒ 音静默但轻压通道照常（A05-23 双通道口径延伸到第 20 剪辑）', () => {
        const h = mk('wxgame.beads.test.g7-mute');
        h.game.onPause();
        const b = pausePanelLayout('normal').buttons.find((x) => x.id === 'toggle-sfx')!;
        h.game.tapDesign((b.rect.xMin + b.rect.xMax) / 2, (b.rect.yMin + b.rect.yMax) / 2);
        const resume = pausePanelLayout('normal').buttons.find((x) => x.id === 'resume')!;
        h.game.tapDesign((resume.rect.xMin + resume.rect.xMax) / 2, (resume.rect.yMin + resume.rect.yMax) / 2);
        expect(h.game.sfxMuted).toBe(true);
        h.advance(0.2);
        clearPlayed(h);
        tapCell(h, 0, 0);
        h.advance(FRAME);
        flush(h);
        expect(h.services.audio.pendingCount).toBe(0);
        expect(h.audio.played).toEqual([]);
        expect(activeSlot(h.game.snapshot, 0, 0)).toBeGreaterThan(0); // 视觉半边不受静音影响
    });
});

// ─────────────────────────── ③ 命令层：scale 半边 + D1 环 + 优先级

describe('G7 观感 · 命令层（TC 双断言的 scale/D1 半边）', () => {
    const near = (ws: readonly number[], v: number): boolean =>
        ws.some((w) => Math.abs(w - v) < 0.01);

    it('就位格：珠体 = 46×scale（谷帧 44.16）、L11 垫恒 50 不参与（§1.6.1 层序死结论）', () => {
        const h = mk('wxgame.beads.test.g7-body');
        h.game.grid.fill(1, 0, h.game.grid.requiredColor(1, 0));
        h.advance(FRAME);
        const snap = h.game.snapshot;
        const base = widthsAt(renderSnap(snap), snap, 1, 0);
        expect(near(base, BEAD_CELL)).toBe(true); // 垫 50
        expect(near(base, BEAD_CELL - 2 * BEAD_DRAW_INSET)).toBe(true); // 静息珠体 46
        const valley = withDenied(snap, [{ row: 1, col: 0, p: TROUGH_P }]);
        const ws = widthsAt(renderSnap(valley), valley, 1, 0);
        const body = (BEAD_CELL - 2 * BEAD_DRAW_INSET) * DENIED_PRESS_SCALE_TROUGH; // 44.16
        expect(near(ws, body)).toBe(true);
        expect(near(ws, BEAD_CELL)).toBe(true); // 垫纹丝不动
        expect(ws.every((w) => w <= BEAD_CELL + 1e-9)).toBe(true); // 永不越格（A5 零重叠前提）
    });

    it('locked 格：scale 走 `size` 形参通道 ⇒ 谷帧 50×0.96 = 48（无垫、只缩不胀）', () => {
        const h = mk('wxgame.beads.test.g7-lockedfx');
        h.advance(FRAME);
        const snap = h.game.snapshot;
        expect(near(widthsAt(renderSnap(snap), snap, 0, 0), BEAD_CELL)).toBe(true);
        const valley = withDenied(snap, [{ row: 0, col: 0, p: TROUGH_P }]);
        const ws = widthsAt(renderSnap(valley), valley, 0, 0);
        expect(near(ws, BEAD_CELL * DENIED_PRESS_SCALE_TROUGH)).toBe(true);
    });

    it('图元净口径：常态 +0（原地缩放）、D1 退化态 +1（描边环）—— §1.6.7 图元行', () => {
        const h = mk('wxgame.beads.test.g7-cost');
        h.game.grid.fill(1, 0, h.game.grid.requiredColor(1, 0));
        h.advance(FRAME);
        const snap = h.game.snapshot;
        const off = withDenied(snap, []);
        expect(countRects(renderSnap(withDenied(snap, [{ row: 1, col: 0, p: 0.5 }])))).toBe(
            countRects(renderSnap(off)),
        );
        const d1 = renderSnap(
            withDenied({ ...snap, reduceMotion: true }, [{ row: 1, col: 0, p: 0.5 }]),
        );
        expect(countRects(d1)).toBe(countRects(renderSnap(off)) + 1);
    });

    it('D1（reduceMotion）：零 scale 偏差 + 1px `slot_border` 静态环 α=1（0 往复）', () => {
        const h = mk('wxgame.beads.test.g7-d1');
        h.game.grid.fill(1, 0, h.game.grid.requiredColor(1, 0));
        h.advance(FRAME);
        const snap = h.game.snapshot;
        const off = withDenied(snap, []);
        const on = withDenied({ ...snap, reduceMotion: true }, [{ row: 1, col: 0, p: TROUGH_P }]);
        // 填充层宽度谱与静息基线逐元素相同 ⇒ scale 通道整体关停（环 = 只描边图元，不计入）
        expect(widthsAt(renderSnap(on), on, 1, 0, 'fills').sort()).toEqual(
            widthsAt(renderSnap(off), off, 1, 0, 'fills').sort(),
        );
        const rings = renderSnap(on).filter(
            (c): c is RectCommand =>
                c.kind === 'rect' &&
                c.stroke === DEFAULT_PALETTE.slotBorder &&
                Math.abs(c.x + c.w / 2 - cellCenter(on, 1, 0).x) < 0.01 &&
                Math.abs(c.y + c.h / 2 - cellCenter(on, 1, 0).y) < 0.01,
        );
        expect(rings).toHaveLength(1);
        expect(rings[0]!.lineWidth).toBe(1); // `DENIED_RING_LINEWIDTH`
        expect(rings[0]!.alpha).toBe(1); // 静态、α 恒 1（D1「抖动→静态描边」同族）
    });

    it('优先级 pop > denied：同格 G1 在播时让位（不叠两条 scale 通道）', () => {
        const h = mk('wxgame.beads.test.g7-prio');
        h.game.grid.fill(1, 0, h.game.grid.requiredColor(1, 0));
        h.advance(FRAME);
        const snap = h.game.snapshot;
        const popP = FILL_POP_PRESS_MS / FILL_POP_MS + 0.2; // 回弹段中取样
        const env: FillPopEnvelope = { scale: 1, contactAlpha: 0, contactWidth: 0, shadowAlpha: 0, shadowDy: 0 };
        fillPopEnvelope(popP, false, env);
        const onlyPop = { ...snap, placeRow: 1, placeCol: 0, placeProgress: popP };
        const both = withDenied(onlyPop, [{ row: 1, col: 0, p: TROUGH_P }]);
        expect(both.deniedCount).toBe(1); // 数据并存，但渲染让位
        expect(widthsAt(renderSnap(both), both, 1, 0).sort()).toEqual(
            widthsAt(renderSnap(onlyPop), onlyPop, 1, 0).sort(),
        );
        // 且该宽度确为 pop 包络（> 静息 46×0.96 谷 ⇒ 证明 consumed 的不是 denied 值）
        expect(near(widthsAt(renderSnap(both), both, 1, 0), (BEAD_CELL - 2 * BEAD_DRAW_INSET) * env.scale)).toBe(true);
    });

    it('谷值常量与 G1 同族不同项：G7 起点恒 1.00（无 1.06 过冲、无 L0a/L0b 联动）', () => {
        // §1.6.7「与 G1 的区别」护栏：若有人把 G7 接成 G1 通道（联动 α），包络端点会离开 1.00。
        expect(deniedPressScale(0)).toBe(1);
        expect(deniedPressScale(1)).toBe(1);
        // G1 同刻在起点 = 1.06 ⇒ 两通道不得混用
        const pop: FillPopEnvelope = { scale: 1, contactAlpha: 0, contactWidth: 0, shadowAlpha: 0, shadowDy: 0 };
        expect(fillPopEnvelope(0, false, pop).scale).toBeGreaterThan(1);
    });

    it('时序门与音频 minInterval 的一致性（两门均从**派发/起播时刻**计，逐帧同步时钟验）', () => {
        const h = mk('wxgame.beads.test.g7-audiogate');
        h.advance(0.2);
        clearPlayed(h);
        tapCell(h, 0, 0); // arm#1（派发 ≤1 帧后）
        advFrames(h, s(300)); // 300ms > 视觉门 250 + 派发滞后 ⇒ 双门均过
        tapCell(h, 0, 0); // arm#2
        advFrames(h, FRAME);
        expect(h.audio.played.filter((id) => id === AUDIO_CLIP_DENIED)).toHaveLength(2);
    });
});
