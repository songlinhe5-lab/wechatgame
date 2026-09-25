/**
 * G6 `vfx_confetti` — 结算彩带（WXG-T-153 · T-128「动态质感章」落码④）。
 *
 * 规格正本：`art/assets-spec.md` §1.6.6；毫秒真源：`design/ux/ux-spec.md` §5
 * 「结算彩带」行（复用「过关庆祝」800ms 窗口，与面板入场同帧启动）。
 *
 * 零 RNG（L4）：44 枚全部由 idx 黄金比派生 ⇒ ① 段直接验分布/逐帧公式；② 段验
 * game 真链（arm 时机 = 裁定 1 延迟门开面板同帧、D1 直开不臂、800ms 自清、零事件
 * 零新 clip）；③ 段验命令层 sandwich 层序 + 禁飞带 + D1 净 0 + 色集 ⊆ 5 色。
 * ⚠️ y 公式为规格**字面移植**（上行出屏），与文案「飘落」矛盾已登记待 art 复验——
 * 本测试按公式断言单调递减，不改公式。⚠️ 只到 `[Node]` 层（K-037）。
 */

import { describe, expect, it } from 'vitest';
import { RenderModelBuilder, polygonVertices, type DrawCommand, type PolygonCommand, type RenderModel } from '@wxgame/framework';
import {
    AUDIO_CLIP_PANEL_IN,
    AUDIO_CLIP_STAR,
    CONFETTI_COUNT,
    CONFETTI_FALL_FACTOR,
    CONFETTI_FADE_START,
    CONFETTI_FG_COUNT,
    CONFETTI_GOLDEN_ANGLE,
    CONFETTI_H,
    CONFETTI_MAIN_COUNT,
    CONFETTI_MS,
    CONFETTI_NOFLY_YMAX,
    CONFETTI_NOFLY_YMIN,
    CONFETTI_SPAWN_STEP_Y,
    CONFETTI_SPIN_TURNS,
    CONFETTI_SWAY_CYCLES,
    CONFETTI_SWAY_PX,
    CONFETTI_W,
    DESIGN_H,
    DESIGN_W,
    PANEL_SCRIM_ALPHA,
    PANEL_SCRIM_RGB,
} from '../src/config/tuning.js';
import {
    confettiBaseX,
    confettiFrame,
    confettiIsForeground,
    confettiPhaseDeg,
    confettiQuad,
    confettiSpawnY,
    type ConfettiBeadState,
} from '../src/view/scene-vfx.js';
import { CONFETTI_COLORS, DEFAULT_PALETTE, DEMO_BEAD_INKS } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { clearPanelLayout } from '../src/systems/clear-panel.js';
import { pausePanelLayout } from '../src/systems/pause-panel.js';
import {
    advancePastClearWave,
    createBeadsHarness,
    simpleTestLevel,
    type Harness,
} from './helpers.js';
import type { BeadsSnapshot } from '../src/game/state.js';

const FRAME = 1 / 60;

function mk(saveKey: string): Harness {
    return createBeadsHarness({
        noAssemble: true,
        levels: [simpleTestLevel()],
        saveKey,
    });
}

/** 填满整块棋盘（clear-panel.test.ts 判例同款：通关时 ratio = 1 ⇒ 3★）。 */
function fillBoard(h: Harness): void {
    const grid = h.game.grid;
    for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
            if (!grid.isFillable(r, c)) continue;
            const slot = h.game.giveTrayBead(grid.requiredColor(r, c));
            if (slot < 0) throw new Error(`tray full at (${r},${c})`);
            h.game.selectTraySlot(slot);
            if (!h.game.tapGridCell(r, c)) throw new Error(`place failed at (${r},${c})`);
        }
    }
}

/**
 * `[WXG-T-211-A / ADR-0024]` returns the whole model, not just the command list:
 * polygon payloads live in `model.vertices` now, so any test that reads a shape
 * needs the arena alongside the command.
 */
function renderSnap(snap: BeadsSnapshot): RenderModel {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    buildBeadsView(builder, snap, DEFAULT_PALETTE, DEMO_BEAD_INKS);
    return builder.end();
}

// ───────────────────────────── ③ 命令层 helper（彩带图元识别）

const hexToRgb = (hex: string): string => {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

/** 5 色 rgb 前缀（fill 为 `rgba(r,g,b,α)`，α 逐枚可变 ⇒ 只比前三段）。 */
const CONFETTI_RGB = new Set(CONFETTI_COLORS.map(hexToRgb));
const SCRIM_FILL = `rgba(${PANEL_SCRIM_RGB.r},${PANEL_SCRIM_RGB.g},${PANEL_SCRIM_RGB.b},${PANEL_SCRIM_ALPHA})`;

/**
 * 彩带图元识别。`count !== 4` 是旧 `points.length !== 8` 的顶点数写法（8 float = 4 顶点）；
 * bbox 尺寸闸走 `polygonVertices` 视图（测试侧专用，生产热路径禁调）。
 */
function isConfettiPoly(model: RenderModel, cmd: DrawCommand): cmd is PolygonCommand {
    if (cmd.kind !== 'polygon' || cmd.count !== 4 || cmd.fill === undefined) return false;
    const m = /^rgba\((\d+,\d+,\d+),/.exec(cmd.fill);
    if (m === null || !CONFETTI_RGB.has(m[1]!)) return false;
    // 尺寸闸：6×14 彩带任意旋转的 bbox 边长 ≤ hypot(6,14) ≈ 15.3；排除 HUD 等同色斜置大图元（40×6）。
    const pts = polygonVertices(model, cmd);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let k = 0; k < 8; k += 2) {
        minX = Math.min(minX, pts[k]!);
        maxX = Math.max(maxX, pts[k]!);
        minY = Math.min(minY, pts[k + 1]!);
        maxY = Math.max(maxY, pts[k + 1]!);
    }
    return maxX - minX <= 16 && maxY - minY <= 16;
}

/** 彩带多边形在命令流中的下标（前 = MAIN 层、后 = FG 层，以 scrim 为界）。 */
function confettiIndices(model: RenderModel): number[] {
    const out: number[] = [];
    model.commands.forEach((c, i) => {
        if (isConfettiPoly(model, c)) out.push(i);
    });
    return out;
}

function scrimIndex(cmds: readonly DrawCommand[]): number {
    return cmds.findIndex(
        (c) => c.kind === 'rect' && c.w === DESIGN_W && c.h === DESIGN_H && c.fill === SCRIM_FILL,
    );
}

/** 多边形重心（禁飞带按中心点判定，与 `drawConfetti` 的 `f.y` 同口径）。 */
function centroidY(model: RenderModel, cmd: PolygonCommand): number {
    const pts = polygonVertices(model, cmd);
    return (pts[1]! + pts[3]! + pts[5]! + pts[7]!) / 4;
}

const freshState = (): ConfettiBeadState => ({ x: 0, y: 0, theta: 0, alpha: 0 });

// ────────────────────────────── ① 纯函数（§1.6.6 分布 + 逐帧公式）

describe('G6 彩带 · 纯函数（assets-spec §1.6.6，零 RNG）', () => {
    it('黄金比 x 均布：44 枚全落屏宽内，min gap > 彩带宽（实测 9.0）、max gap < 30（实测 25.5）', () => {
        const xs: number[] = [];
        for (let i = 0; i < CONFETTI_COUNT; i++) {
            const x = confettiBaseX(i);
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(DESIGN_W);
            xs.push(x);
        }
        xs.sort((a, b) => a - b);
        let min = Infinity;
        let max = 0;
        for (let i = 1; i < xs.length; i++) {
            const gap = xs[i]! - xs[i - 1]!;
            min = Math.min(min, gap);
            max = Math.max(max, gap);
        }
        expect(min).toBeGreaterThan(CONFETTI_W); // 不重叠聚团
        expect(max).toBeLessThan(30); // 不出现空洞
    });

    it('五档错高与错相：spawnY = 屏底 − (idx mod 5)×60；相位 = idx×137.5°（相邻不齐平）', () => {
        for (let i = 0; i < CONFETTI_COUNT; i++) {
            expect(confettiSpawnY(i)).toBe(DESIGN_H - (i % 5) * CONFETTI_SPAWN_STEP_Y);
            expect(confettiPhaseDeg(i)).toBeCloseTo(i * CONFETTI_GOLDEN_ANGLE, 9);
        }
        // 分层计数：MAIN 36 / FG 8 恰为 44（层归属 = idx 阈值，无第三态）
        let main = 0;
        let fg = 0;
        for (let i = 0; i < CONFETTI_COUNT; i++) (confettiIsForeground(i) ? fg++ : main++);
        expect([main, fg]).toEqual([CONFETTI_MAIN_COUNT, CONFETTI_FG_COUNT]);
        expect(confettiIsForeground(CONFETTI_MAIN_COUNT - 1)).toBe(false);
        expect(confettiIsForeground(CONFETTI_MAIN_COUNT)).toBe(true);
    });

    it('逐帧公式（字面移植）：y = spawnY − 1334×1.15×easeIn(p) 单调上行出屏；摆动 ±18px', () => {
        const st = freshState();
        for (let i = 0; i < CONFETTI_COUNT; i++) {
            let prevY = Infinity;
            confettiFrame(i, 0, st);
            expect(st.y).toBe(confettiSpawnY(i)); // p=0 落在起点（五档错高）
            expect(st.alpha).toBe(1);
            for (let k = 0; k <= 100; k++) {
                confettiFrame(i, k / 100, st);
                expect(st.y).toBeLessThanOrEqual(prevY + 1e-9); // 单调递减（公式如此，非「飘落」）
                prevY = st.y;
                expect(Math.abs(st.x - confettiBaseX(i))).toBeLessThanOrEqual(CONFETTI_SWAY_PX + 1e-9);
            }
            confettiFrame(i, 1, st);
            expect(st.y).toBeLessThan(0); // 终点全部出屏顶（spawnY ≤ 1334 < 1334×1.15）
        }
        // 摆动周期 = 2：p=0 与 p=1 摆动相位差 2×2π ⇒ 位移相同
        const a = freshState();
        const b = freshState();
        confettiFrame(7, 0, a);
        confettiFrame(7, 1, b);
        expect(b.x).toBeCloseTo(a.x, 9);
        expect(CONFETTI_SWAY_CYCLES).toBe(2);
    });

    it('旋转 1.25 转（1.25Hz < 3Hz，D2）与 α 淡出（p≥0.7 线性到 0，无硬切）', () => {
        const st = freshState();
        confettiFrame(3, 0, st);
        const theta0 = st.theta;
        confettiFrame(3, 1, st);
        expect(st.theta - theta0).toBeCloseTo(360 * CONFETTI_SPIN_TURNS, 6);

        confettiFrame(3, CONFETTI_FADE_START - 0.05, st);
        expect(st.alpha).toBe(1);
        confettiFrame(3, (1 + CONFETTI_FADE_START) / 2, st); // 淡出段中点
        expect(st.alpha).toBeCloseTo(0.5, 6);
        confettiFrame(3, 1, st);
        expect(st.alpha).toBe(0);
        let prev = Infinity; // 淡出段单调非增
        for (let k = 0; k <= 60; k++) {
            confettiFrame(3, CONFETTI_FADE_START + (1 - CONFETTI_FADE_START) * (k / 60), st);
            expect(st.alpha).toBeLessThanOrEqual(prev + 1e-9);
            prev = st.alpha;
        }
    });

    it('钳制与确定性：越界 p 钳到端点；同 (idx, p) 两次调用逐位相等（L4 零 RNG）', () => {
        const lo = freshState();
        const zero = freshState();
        confettiFrame(5, -0.5, lo);
        confettiFrame(5, 0, zero);
        expect(lo).toEqual(zero);
        const hi = freshState();
        const one = freshState();
        confettiFrame(5, 1.5, hi);
        confettiFrame(5, 1, one);
        expect(hi).toEqual(one);
        const again = freshState();
        confettiFrame(5, 0.42, again); // 跨调用同输入（新 scratch 槽）
        const src = freshState();
        confettiFrame(5, 0.42, src);
        expect(again).toEqual(src);
    });

    it('四角几何（无旋转变换通道）：θ=0 为 6×14 矩形；任意 θ 刚体保边长', () => {
        const q = confettiQuad(100, 200, 0, [0, 0, 0, 0, 0, 0, 0, 0]);
        const corners = [
            [q[0]!, q[1]!],
            [q[2]!, q[3]!],
            [q[4]!, q[5]!],
            [q[6]!, q[7]!],
        ];
        const expected = [
            [100 - CONFETTI_W / 2, 200 + CONFETTI_H / 2],
            [100 + CONFETTI_W / 2, 200 + CONFETTI_H / 2],
            [100 + CONFETTI_W / 2, 200 - CONFETTI_H / 2],
            [100 - CONFETTI_W / 2, 200 - CONFETTI_H / 2],
        ];
        corners.forEach((c, i) => {
            expect(c[0]).toBeCloseTo(expected[i]![0], 9);
            expect(c[1]).toBeCloseTo(expected[i]![1], 9);
        });
        // 刚体性：θ=45° 时相邻边长仍是 6 / 14
        const r = confettiQuad(0, 0, 45, [0, 0, 0, 0, 0, 0, 0, 0]);
        const edges: number[] = [];
        for (let i = 0; i < 4; i++) {
            const j = (i + 1) % 4;
            const dx = r[j * 2]! - r[i * 2]!;
            const dy = r[j * 2 + 1]! - r[i * 2 + 1]!;
            edges.push(Math.hypot(dx, dy));
        }
        expect(edges[0]).toBeCloseTo(CONFETTI_W, 6);
        expect(edges[1]).toBeCloseTo(CONFETTI_H, 6);
        expect(edges[2]).toBeCloseTo(CONFETTI_W, 6);
        expect(edges[3]).toBeCloseTo(CONFETTI_H, 6);
    });

    it('常量对账：总时长 = 800ms（ux-spec §5 复用「过关庆祝」）、44 = 36 + 8、禁飞带几何冻结', () => {
        expect(CONFETTI_MS).toBe(800);
        expect(CONFETTI_MAIN_COUNT + CONFETTI_FG_COUNT).toBe(CONFETTI_COUNT);
        expect(CONFETTI_FALL_FACTOR).toBeCloseTo(1.15, 9);
        expect(CONFETTI_NOFLY_YMIN).toBe(447);
        expect(CONFETTI_NOFLY_YMAX).toBe(787);
    });
});

// ──────────────────────────── ② game 真链：arm 时机 / 自清 / D1 不臂

describe('G6 彩带 · game 真链（arm = 延迟门开面板同帧 · 零事件零新 clip · 800ms 自清）', () => {
    const TRACKED = ['bead:placed', 'bead:rejected', 'powerup:used', 'level:cleared', 'tray:spawned'] as const;

    it('过关：波浪门到点开面板同帧臂起 ⇒ 进度 0→单调上行，800ms 后归零残留；触发全程零玩法事件', () => {
        const h = mk('wxgame.beads.test.g6-arm');
        fillBoard(h);
        expect(h.game.phase).toBe('level-clear');
        // 波浪期内（面板未开）不臂：0 = 未激活哨兵
        expect(h.game.snapshot.confettiProgress).toBe(0);
        const eventsBefore = TRACKED.map((t) => h.count(t));
        h.services.audio.flush(0);
        h.audio.played.length = 0;

        let armed = -1;
        for (let i = 0; i < 120; i++) {
            h.advance(FRAME);
            if (h.game.snapshot.confettiProgress > 0) {
                armed = i;
                break;
            }
        }
        expect(armed, '800ms 波浪 + 1s 内未臂').toBeGreaterThanOrEqual(0);
        expect(h.game.clearPanel.visible).toBe(true); // arm 与面板入场同帧（裁定 1 延迟门）
        const mid = h.game.snapshot.confettiProgress;
        h.advance(0.1);
        const later = h.game.snapshot.confettiProgress;
        expect(later).toBeGreaterThan(mid); // 单调上行
        expect(TRACKED.map((t) => h.count(t))).toEqual(eventsBefore); // 红线：零事件
        // 彩带零新 clip：臂帧只放行面板/星级既有音（同帧 `sfx_panel_in` + 首星叮）
        h.services.audio.flush(1);
        expect(
            h.audio.played.every((id) => id === AUDIO_CLIP_PANEL_IN || id === AUDIO_CLIP_STAR),
        ).toBe(true);

        h.advance(CONFETTI_MS / 1000 + 0.1); // 到点自清（-1 哨兵 ⇒ 快照回落 0）
        expect(h.game.snapshot.confettiProgress).toBe(0);
    });

    it('D1（reduceMotion）真链：直开面板不臂 ⇒ 全程 confettiProgress = 0（整条关停）', () => {
        const h = mk('wxgame.beads.test.g6-d1');
        h.game.onPause();
        const rm = pausePanelLayout('normal').buttons.find((b) => b.id === 'toggle-reduce-motion')!;
        h.game.tapDesign((rm.rect.xMin + rm.rect.xMax) / 2, (rm.rect.yMin + rm.rect.yMax) / 2);
        const resume = pausePanelLayout('normal').buttons.find((b) => b.id === 'resume')!;
        h.game.tapDesign((resume.rect.xMin + resume.rect.xMax) / 2, (resume.rect.yMin + resume.rect.yMax) / 2);
        expect(h.game.reduceMotion).toBe(true);

        fillBoard(h);
        expect(h.game.phase).toBe('level-clear');
        expect(h.game.clearPanel.visible).toBe(true); // D1 直开（不空等波浪）
        for (let i = 0; i < 90; i++) {
            h.advance(FRAME);
            expect(h.game.snapshot.confettiProgress).toBe(0);
        }
    });

    it('重开一关不留残值：上一关彩带自清后，新过关可再臂（计时槽回 -1 可复用）', () => {
        const h = createBeadsHarness({
            noAssemble: true,
            levels: [simpleTestLevel({ id: 91 }), simpleTestLevel({ id: 92 })],
            saveKey: 'wxgame.beads.test.g6-rearm',
        });
        fillBoard(h);
        advancePastClearWave(h);
        expect(h.game.snapshot.confettiProgress).toBeGreaterThan(0);
        h.advance(CONFETTI_MS / 1000 + 0.1);
        expect(h.game.snapshot.confettiProgress).toBe(0);

        // 「下一关」出口进第 2 关（clear-panel.test.ts 判例），面板退场干净。
        const nextBtn = clearPanelLayout({ lastLevel: false }).buttons.find((b) => b.id === 'next')!.rect;
        h.game.tapDesign((nextBtn.xMin + nextBtn.xMax) / 2, (nextBtn.yMin + nextBtn.yMax) / 2);
        expect(h.game.phase).toBe('playing');
        expect(h.game.levelIndex).toBe(1);

        // 计时槽已回 -1 哨兵 ⇒ 新关再通关可再臂（不留残值、不可一次性）。
        fillBoard(h);
        advancePastClearWave(h);
        expect(h.game.snapshot.confettiProgress).toBeGreaterThan(0);
    });
});

// ───────────────────────── ③ 命令层：sandwich / 禁飞带 / D1 净 0 / 色集

describe('G6 彩带 · 命令层（§1.6.6 sandwich 层序死规格 + 禁飞带 + 色集）', () => {
    /** 过关真链基线快照（面板已开 ⇒ scrim 在场），进度按判据覆写（view 半边不借道 game）。 */
    function baseSnap(saveKey: string): BeadsSnapshot {
        const h = mk(saveKey);
        fillBoard(h);
        advancePastClearWave(h);
        expect(h.game.clearPanel.visible).toBe(true);
        return h.game.snapshot;
    }

    it('sandwich（p=0.2）：MAIN 36 枚全部先于全屏 scrim、FG 8 枚全部在后（800ms 窗口内 44 枚在场）', () => {
        const snap = { ...baseSnap('wxgame.beads.test.g6-sandwich'), confettiProgress: 0.2 };
        const model = renderSnap(snap);
        const scrim = scrimIndex(model.commands);
        expect(scrim, '结算面板全屏遮罩缺席').toBeGreaterThan(-1);
        const idxs = confettiIndices(model);
        expect(idxs).toHaveLength(CONFETTI_COUNT); // p=0.2：α=1 且无 FG 落禁飞带 ⇒ 44 全画
        expect(idxs.filter((i) => i < scrim)).toHaveLength(CONFETTI_MAIN_COUNT);
        expect(idxs.filter((i) => i > scrim)).toHaveLength(CONFETTI_FG_COUNT);
    });

    it('禁飞带（p=0.65）：FG 中心 y ∈ [447,787] 的枚**跳过绘制**（不是淡出）；MAIN 不受限', () => {
        const p = 0.65;
        const st = freshState();
        let expectFg = 0;
        for (let i = CONFETTI_MAIN_COUNT; i < CONFETTI_COUNT; i++) {
            confettiFrame(i, p, st);
            const blocked = st.y >= CONFETTI_NOFLY_YMIN && st.y <= CONFETTI_NOFLY_YMAX;
            if (!blocked) expectFg++;
            else expect(st.alpha).toBe(1); // 被跳过的枚 α 仍 = 1 ⇒ 证明是「不画」而非「淡掉」
        }
        expect(expectFg).toBeLessThan(CONFETTI_FG_COUNT); // 该进度确实有 FG 撞带（判据非空转）
        expect(expectFg).toBeGreaterThan(0);

        const model = renderSnap({ ...baseSnap('wxgame.beads.test.g6-nofly'), confettiProgress: p });
        const cmds = model.commands;
        // 谓词需绑定本帧 arena ⇒ 闭包化（同时让 filter 的类型收窄继续成立）。
        const isPoly = (c: DrawCommand): c is PolygonCommand => isConfettiPoly(model, c);
        const scrim = scrimIndex(cmds);
        const polys = cmds.filter(isPoly);
        const fgDrawn = cmds
            .map((c, i) => ({ c, i }))
            .filter(({ c, i }) => i > scrim && isPoly(c))
            .map(({ c }) => c as PolygonCommand);
        expect(fgDrawn).toHaveLength(expectFg);
        for (const f of fgDrawn) {
            const y = centroidY(model, f);
            expect(y < CONFETTI_NOFLY_YMIN || y > CONFETTI_NOFLY_YMAX).toBe(true); // 留下的全在带外
        }
        expect(polys.length - fgDrawn.length).toBe(CONFETTI_MAIN_COUNT); // MAIN 36 枚照常
    });

    it('D1 渲染半边 + 终帧净 0：reduceMotion ⇒ 0 枚；p=1（α 全 0）⇒ 0 枚（无硬切残留）', () => {
        const base = baseSnap('wxgame.beads.test.g6-d1view');
        expect(confettiIndices(renderSnap({ ...base, reduceMotion: true, confettiProgress: 0.35 })))
            .toHaveLength(0);
        expect(confettiIndices(renderSnap({ ...base, confettiProgress: 1 }))).toHaveLength(0);
        expect(confettiIndices(renderSnap({ ...base, confettiProgress: 0 }))).toHaveLength(0);
    });

    it('色集：只用 §1.6.6 冻结 5 色（引用既有 token）、禁暖橙 #F59B23（A5 装饰层不携编码义）', () => {
        const model = renderSnap({ ...baseSnap('wxgame.beads.test.g6-colors'), confettiProgress: 0.2 });
        const polys = model.commands.filter((c) => isConfettiPoly(model, c));
        expect(polys.length).toBeGreaterThan(0);
        const warm = hexToRgb('#F59B23');
        for (const c of polys) {
            const m = /^rgba\((\d+,\d+,\d+),([\d.]+)\)$/.exec(c.fill!)!;
            expect(CONFETTI_RGB.has(m[1]!)).toBe(true);
            expect(m[1]).not.toBe(warm);
            expect(Number(m[2])).toBe(1); // p=0.2 ⇒ 淡出段前 α 恒 1
        }
    });
});
