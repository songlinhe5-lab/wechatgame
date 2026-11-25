/**
 * WXG-T-1075 · 逐帧运动节奏取样器的回归。
 *
 * 动机：真机/浏览器上「珠面拖动看起来卡顿，但性能面板帧耗时稳定」。帧耗时是
 * **每帧成本**，卡顿感是**位移在时间轴上的分布**，两者不同维度；本取样器只记
 * 后者（帧间隔 dtMs、本帧跑掉的固定步数 steps、是否真下发重绘 drew、跟踪点位移
 * dPos），并把三种典型工况判成不同 verdict，供诊断台直接读数。
 *
 * 判据一律用**合成序列**（确定性，⛔ Math.random，L4），逐工况锁住判定表。
 */
import { describe, expect, it } from 'vitest';
import {
    MotionRecorder,
    judgeMotionJudder,
    type MotionFrame,
} from '../../src/core/performance/performance.js';

/**
 * 造帧序列。`pos` 传**绝对位置**（与 `MotionRecorder.frame(pos)` 同口径），
 * 内部差分成 `dPos`；首帧无基线记 0。
 */
function series(dts: number[], steps: number[], drew: boolean[], pos: number[]): MotionFrame[] {
    return dts.map((dtMs, i) => ({
        dtMs,
        steps: steps[i]!,
        drew: drew[i]!,
        dPos: i === 0 ? 0 : pos[i]! - pos[i - 1]!,
    }));
}

describe('judgeMotionJudder · 三工况判定表', () => {
    it('帧间隔恒定 + 每帧一步 + 每帧重绘 ⇒ smooth（管线本身没问题）', () => {
        const n = 60;
        const f = series(
            Array(n).fill(1000 / 60),
            Array(n).fill(1),
            Array(n).fill(true),
            Array.from({ length: n }, (_, i) => i * 4),
        );
        const j = judgeMotionJudder(f);
        expect(j.verdict).toBe('smooth');
        expect(j.zeroStepShare).toBe(0);
        expect(j.moveIrregularity).toBeCloseTo(1, 5);
    });

    it('120Hz 屏 + 60Hz 仿真（0/1 步交替、半帧不重绘）⇒ refresh-halved', () => {
        const n = 60;
        const f = series(
            Array(n).fill(1000 / 120),
            Array.from({ length: n }, (_, i) => (i % 2 === 1 ? 1 : 0)),
            Array.from({ length: n }, (_, i) => i % 2 === 1),
            Array.from({ length: n }, (_, i) => Math.floor(i / 2) * 4),
        );
        const j = judgeMotionJudder(f);
        expect(j.verdict).toBe('refresh-halved');
        expect(j.zeroStepShare).toBeGreaterThanOrEqual(0.3);
        // 相邻两次真重绘之间的墙钟 ≈ 2 个帧间隔（同图连贴两帧的直接读数）。
        expect(j.presentGapMaxMs / j.dtMedianMs).toBeGreaterThanOrEqual(1.7);
    });

    it('60Hz 但帧间隔抖动（累加器出现 0/2 步）⇒ accumulator-jitter', () => {
        const n = 90;
        // ±2.5ms 正弦抖动：累加器被推成 1,1,1,0,2 的相位循环（真机 vsync 抖动常态）。
        const dts = Array.from({ length: n }, (_, i) => 1000 / 60 + 2.5 * Math.sin(i * 1.7));
        const steps: number[] = [];
        let acc = 0;
        for (const dt of dts) {
            acc += dt;
            const s = Math.floor(acc / (1000 / 60));
            acc -= s * (1000 / 60);
            steps.push(s);
        }
        let moved = 0;
        const f = series(
            dts,
            steps,
            steps.map((s) => s > 0),
            steps.map((s) => (moved += s * 4)),
        );
        const j = judgeMotionJudder(f);
        expect(j.dtCv).toBeGreaterThan(0.05);
        expect(j.multiStepFrames).toBeGreaterThanOrEqual(2);
        expect(j.verdict).toBe('accumulator-jitter');
    });

    it('采样太少不下结论（insufficient，⛔ 拿三五帧判卡顿）', () => {
        const j = judgeMotionJudder(series([16.7, 16.7], [1, 1], [true, true], [0, 4]));
        expect(j.verdict).toBe('insufficient');
        expect(j.n).toBe(2);
    });

    it('长帧（>40ms 掉帧）优先判 stall，别和节奏问题混成一条', () => {
        const n = 40;
        const dts = Array(n).fill(1000 / 60);
        dts[20] = 90;
        const f = series(
            dts,
            dts.map((d) => (d > 40 ? 2 : 1)),
            Array(n).fill(true),
            (() => { let m = 0; return dts.map((d) => (m += d > 40 ? 8 : 4)); })(),
        );
        expect(judgeMotionJudder(f).verdict).toBe('stall');
    });
});

describe('MotionRecorder · 环形缓冲与读报', () => {
    it('容量封顶、旧帧被覆写，且 frames() 按时间正序', () => {
        const rec = new MotionRecorder(8);
        for (let i = 0; i < 20; i += 1) rec.frame(16.7, 1, true, i * 4);
        const f = rec.frames();
        expect(f.length).toBe(8);
        // 只保留最后 8 帧 ⇒ 位移增量恒为 4，且首帧没有历史所以为 0 的旧帧已被覆盖。
        expect(f.every((x) => x.dPos === 4)).toBe(true);
    });

    it('首帧无基线 ⇒ dPos = 0（不把"开始记录"当成一次跳变）', () => {
        const rec = new MotionRecorder(4);
        rec.frame(16.7, 1, true, 100);
        expect(rec.frames()[0]!.dPos).toBe(0);
        rec.frame(16.7, 1, true, 104);
        expect(rec.frames()[1]!.dPos).toBe(4);
    });

    it('report() 出一行可粘贴文本，含判定与关键读数', () => {
        const rec = new MotionRecorder(64);
        for (let i = 0; i < 60; i += 1) {
            rec.frame(1000 / 120, i % 2, i % 2 === 1, Math.floor(i / 2) * 4);
        }
        const line = rec.report();
        expect(line).toContain('refresh-halved');
        expect(line).toContain('n=60');
    });

    it('reset() 后重新起算基线（连续两次采样互不污染）', () => {
        const rec = new MotionRecorder(32);
        rec.frame(16.7, 1, true, 500);
        rec.reset();
        rec.frame(16.7, 1, true, 0);
        expect(rec.frames().length).toBe(1);
        expect(rec.frames()[0]!.dPos).toBe(0);
    });
});
