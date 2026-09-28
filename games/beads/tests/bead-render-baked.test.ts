import { describe, expect, it, afterEach } from 'vitest';
import { RenderModelBuilder, type BlitCommand, type CircleCommand } from '@wxgame/framework';
import { drawFilledBead, setBeadBakeRuntime, getBeadBakeRuntime, type BeadBakeRuntime } from '../src/view/bead-render.js';
import { BEAD_CARD, BEAD_CELL } from '../src/config/tuning.js';

/**
 * Stub BakeRuntime that records calls and returns deterministic texture IDs.
 */
function stubRuntime(): {
    runtime: BeadBakeRuntime;
    calls: Array<{ styleId: string; colorIdx: number; bakeSize: number }>;
} {
    const calls: Array<{ styleId: string; colorIdx: number; bakeSize: number }> = [];
    const runtime: BeadBakeRuntime = {
        getTextureId(styleId, colorIdx, bakeSize) {
            calls.push({ styleId, colorIdx, bakeSize });
            return `tex:${styleId}:${colorIdx}`;
        },
    };
    return { runtime, calls };
}

describe('bead-render baked arm (WXG-T-220)', () => {
    afterEach(() => {
        // Always clean up the runtime to avoid leaking between tests.
        setBeadBakeRuntime(undefined);
    });

    it('defaults to vector arm when no runtime is injected', () => {
        expect(getBeadBakeRuntime()).toBeUndefined();
        const b = new RenderModelBuilder(100, 100);
        b.begin();
        drawFilledBead(b, 50, 50, 1);
        const model = b.end();
        // Vector arm emits rect/polygon/circle commands, no blit.
        const kinds = model.commands.map(c => c.kind);
        expect(kinds).not.toContain('blit');
        expect(kinds.length).toBeGreaterThan(0);
    });

    it('emits blit + hole circle when runtime is injected', () => {
        const { runtime, calls } = stubRuntime();
        setBeadBakeRuntime(runtime);

        const b = new RenderModelBuilder(100, 100);
        b.begin();
        drawFilledBead(b, 50, 50, 1, { size: BEAD_CELL });
        const model = b.end();

        // Runtime was called exactly once.
        expect(calls).toHaveLength(1);
        expect(calls[0]!.styleId).toBe('facet-4');
        expect(calls[0]!.colorIdx).toBe(1);

        // Commands: 1 blit + 2 live circle（**六裁**：孔拆 pit 底 + stroke-only 环；孔不入烘焙 ADR-0025 DEC-3）。
        expect(model.commands).toHaveLength(3);
        expect(model.commands[0]!.kind).toBe('blit');
        expect(model.commands[1]!.kind).toBe('circle');
        expect(model.commands[2]!.kind).toBe('circle');

        const blit = model.commands[0] as BlitCommand;
        expect(blit.textureId).toBe('tex:facet-4:1');
        expect(blit.w).toBe(BEAD_CELL);
        expect(blit.h).toBe(BEAD_CELL);

        // commands[1] = 孔底 pit（r = 真透）；commands[2] = 孔环（r = 真透 + 边线宽，stroke-only）。
        const expectedR = Math.round((BEAD_CELL * BEAD_CARD.holeRatio) / 2);
        const hole = model.commands[1] as CircleCommand;
        expect(hole.r).toBe(expectedR);
        const ring = model.commands[2] as CircleCommand;
        expect(ring.r).toBe(expectedR + BEAD_CARD.holeStrokeWidthPx);
        expect(ring.fill).toBeUndefined(); // stroke-only
    });

    it('respects custom styleId', () => {
        const { runtime, calls } = stubRuntime();
        setBeadBakeRuntime(runtime);

        const b = new RenderModelBuilder(100, 100);
        b.begin();
        drawFilledBead(b, 50, 50, 2, { styleId: 'lineart-18' });
        b.end();

        expect(calls[0]!.styleId).toBe('lineart-18');
    });

    it('falls back to vector arm when hideHole is true', () => {
        const { runtime } = stubRuntime();
        setBeadBakeRuntime(runtime);

        const b = new RenderModelBuilder(100, 100);
        b.begin();
        drawFilledBead(b, 50, 50, 1, { hideHole: true });
        const model = b.end();

        // hideHole ⇒ baked path skipped ⇒ vector arm (no blit).
        const kinds = model.commands.map(c => c.kind);
        expect(kinds).not.toContain('blit');
    });

    it('vector arm is byte-identical with and without runtime (when runtime is undefined)', () => {
        // Baseline: no runtime.
        const b1 = new RenderModelBuilder(100, 100);
        b1.begin();
        drawFilledBead(b1, 50, 50, 1);
        const model1 = b1.end();

        // Inject then uninject runtime.
        const { runtime } = stubRuntime();
        setBeadBakeRuntime(runtime);
        setBeadBakeRuntime(undefined);

        const b2 = new RenderModelBuilder(100, 100);
        b2.begin();
        drawFilledBead(b2, 50, 50, 1);
        const model2 = b2.end();

        // Both should be identical (vector arm unchanged).
        expect(JSON.stringify(model1.commands)).toBe(JSON.stringify(model2.commands));
    });
});
