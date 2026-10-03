/**
 * `[WXG-T-226 EP12-S2 / ADR-0029 DEC-2 · DEC-5]` tint 臂：双臂分流 / 白名单回退 / 绿线锚。
 *
 * ## 本文件的判据性质
 *
 * 全部是**机检不变式**（V-4 命令流 / V-5 矢量臂逐字节不变 / 白名单显式性 / DEC-2 孔底），
 * ⛔ **不是新发设计硬判据**（EP-12 §8 验收口径：零新发硬判据）。
 * ⛔ 不改、不放宽任何现役 QA 判据与 fixture（K-051 / K-053）。
 */
import { describe, expect, it, afterEach } from 'vitest';
import { RenderModelBuilder, MASK_CANONICAL_SIZE, type BlitCommand } from '@wxgame/framework';

import {
    drawEmptySocket,
    drawFilledBead,
    setBeadBakeRuntime,
    setBeadTintRuntime,
    getBeadTintRuntime,
    createWhitelistBeadTintRuntime,
    type BeadTintRuntime,
} from '../src/view/bead-render.js';
import { tintMaskId, whitelistedTintStyles, TINT_MASK_STYLE_ID } from '../src/view/bead-tint-mask.js';
import { BEAD_CARD, BEAD_CELL, BEAD_PITCH, BAKE_CANONICAL_SIZE } from '../src/config/tuning.js';
import { beadColorOf, DEFAULT_PALETTE, DEMO_BEAD_INKS, type BeadsPalette } from '../src/view/palette.js';

/** 记录调用的 tint 运行时桩（白名单可开关）。 */
function stubTintRuntime(opts: { hit: boolean } = { hit: true }): {
    runtime: BeadTintRuntime;
    calls: Array<{ kind: string; gauge: string; styleId: string }>;
} {
    const calls: Array<{ kind: string; gauge: string; styleId: string }> = [];
    const runtime: BeadTintRuntime = {
        getMaskId(kind, gauge, styleId) {
            calls.push({ kind, gauge, styleId });
            return opts.hit ? `tex:${kind}:${gauge}:${styleId}` : undefined;
        },
    };
    return { runtime, calls };
}

const palette = DEFAULT_PALETTE as BeadsPalette;

function build(fn: (b: RenderModelBuilder) => void) {
    const b = new RenderModelBuilder(1000, 1000);
    b.begin();
    fn(b);
    return b.end();
}

afterEach(() => {
    setBeadTintRuntime(undefined);
    setBeadBakeRuntime(undefined);
});

describe('白名单（DEC-5 · 显式化）', () => {
    it('当前只有 facet-4 在白名单里', () => {
        expect(whitelistedTintStyles()).toEqual([TINT_MASK_STYLE_ID]);
    });

    it('maskId = 白名单(kind, gauge, styleId)，带 MASK_SCHEMA_VERSION', () => {
        expect(tintMaskId('bead', 'holed', 'facet-4')).toBe('mask__bead__holed__v1');
        expect(tintMaskId('cell', 'holeless', 'facet-4')).toBe('mask__grid__holeless__v1');
    });

    it('⛔ 未定稿风格一律 undefined（不得给未定稿风格偷烘 mask）', () => {
        for (const style of ['lineart-18', 'legacy-ten', 'thirteen', '', 'FACET-4']) {
            expect(tintMaskId('bead', 'holed', style)).toBeUndefined();
        }
    });

    it('createWhitelistBeadTintRuntime：白名单未命中 或 未注册 ⇒ undefined（矢量回退）', () => {
        const all = createWhitelistBeadTintRuntime(() => 'tex:x');
        expect(all.getMaskId('bead', 'holed', 'facet-4')).toBe('tex:x');
        expect(all.getMaskId('bead', 'holed', 'lineart-18')).toBeUndefined();

        const none = createWhitelistBeadTintRuntime(() => undefined);
        expect(none.getMaskId('bead', 'holed', 'facet-4')).toBeUndefined();
    });
});

describe('双臂分流（V-4 命令流 / DEC-2 孔底）', () => {
    it('tint 臂命中 ⇒ 已填格 = 1 条 blit，⛔ 无 live pit circle（孔区真透）', () => {
        const { runtime, calls } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const model = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        expect(calls).toEqual([{ kind: 'bead', gauge: 'holed', styleId: TINT_MASK_STYLE_ID }]);
        // DEC-2：孔底不再画 live `pit` circle ⇒ 只有 1 条命令（blit）。
        expect(model.commands).toHaveLength(1);
        const cmd = model.commands[0] as BlitCommand;
        expect(cmd.kind).toBe('blit');
        expect(cmd.textureId).toBe('tex:bead:holed:facet-4');
        expect(cmd.tint).toBeDefined();
        expect(cmd.w).toBe(BEAD_CELL);
        // ⛔ 孔边线环也不画（孔由 mask B 通道自带 + 0.5dp 羽化）
        expect(model.commands.filter((c) => c.kind === 'circle')).toHaveLength(0);
    });

    it('tint 基色 = 珠的**本色**（⛔ 不是 edge/pit/lit 派生色）', () => {
        const { runtime } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const model = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        const cmd = model.commands[0] as BlitCommand;
        // ⛔ 不用 `hexes[idx]` 硬编：色板索引是 **1-based**（`beadColorOf` 口径）。
        expect(cmd.tint).toBe(beadColorOf(DEMO_BEAD_INKS, 2));
    });

    it('空格（盘面格）tint 臂命中 ⇒ 1 条 blit，⛔ 无 4 内阴影 + 2 明暗线', () => {
        const { runtime, calls } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const model = build((b) => {
            drawEmptySocket(
                b, 100, 100, palette, BEAD_CELL, 2, DEMO_BEAD_INKS,
                true, // tilePainted = 盘面格
                4, // beadInset > 0 = 盘面格
                { maskGauge: 'holed' },
            );
        });
        expect(calls).toEqual([{ kind: 'cell', gauge: 'holed', styleId: TINT_MASK_STYLE_ID }]);
        expect(model.commands).toHaveLength(1);
        const cmd = model.commands[0] as BlitCommand;
        expect(cmd.textureId).toBe('tex:cell:holed:facet-4');
        expect(cmd.tint).toBe(beadColorOf(DEMO_BEAD_INKS, 2));
    });

    it('⛔ 托盘空槽（beadInset = 0）恒矢量（两档不同形，无 mask 可对应 · §3.6）', () => {
        const { runtime, calls } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const model = build((b) => {
            drawEmptySocket(
                b, 100, 100, palette, BEAD_CELL, undefined, DEMO_BEAD_INKS,
                false, 0, { maskGauge: 'holed' },
            );
        });
        expect(calls).toHaveLength(0);
        expect(model.commands.some((c) => c.kind === 'blit')).toBe(false);
    });

    it('白名单未命中 ⇒ 矢量臂（逐字节 = 今日）', () => {
        const { runtime } = stubTintRuntime({ hit: false });
        setBeadTintRuntime(runtime);
        const withMiss = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        setBeadTintRuntime(undefined);
        const baseline = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        expect(JSON.stringify(withMiss.commands)).toBe(JSON.stringify(baseline.commands));
        // 未命中时仍是矢量臂的 6 命令（facet-4 珠面）
        expect(withMiss.commands.length).toBeGreaterThan(1);
    });

    it('⛔ 不传 maskGauge ⇒ tint 臂永不命中（安全默认，矢量臂逐字节不变）', () => {
        const { runtime, calls } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const model = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2 });
        });
        expect(calls).toHaveLength(0);
        expect(model.commands.some((c) => c.kind === 'blit')).toBe(false);
    });

    it('hideHole ⇒ tint 臂跳过（孔 live 的档位没有对应 mask）', () => {
        const { runtime, calls } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed', hideHole: true });
        });
        expect(calls).toHaveLength(0);
    });

    it('臂序：tint 命中时**不**回落烘焙臂（① 优先于 ②）', () => {
        setBeadTintRuntime(stubTintRuntime().runtime);
        setBeadBakeRuntime({ getTextureId: () => 'bake:tex' });
        const model = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        expect(model.commands).toHaveLength(1);
        expect((model.commands[0] as BlitCommand).textureId).toBe('tex:bead:holed:facet-4');
    });
});

describe('绿线锚 V-5 · 矢量臂逐字节不变', () => {
    it('未注入 tint 运行时：注入前 / 注入后 / 取消注入 三次输出逐字节相同', () => {
        const draw = (b: RenderModelBuilder) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, inks: DEMO_BEAD_INKS });
        };
        const before = build(draw);
        setBeadTintRuntime(stubTintRuntime().runtime);
        const during = build(draw);
        setBeadTintRuntime(undefined);
        const after = build(draw);
        expect(JSON.stringify(during.commands)).toBe(JSON.stringify(before.commands));
        expect(JSON.stringify(after.commands)).toBe(JSON.stringify(before.commands));
    });

    it('getBeadTintRuntime 默认 undefined（= tint 臂不存在）', () => {
        expect(getBeadTintRuntime()).toBeUndefined();
    });

    it('空格矢量臂同样逐字节不变（tint 运行时在场也不改未命中路径）', () => {
        const draw = (b: RenderModelBuilder) => {
            drawEmptySocket(b, 100, 100, palette, BEAD_CELL, 2, DEMO_BEAD_INKS, true, 4);
        };
        const before = build(draw);
        setBeadTintRuntime(stubTintRuntime().runtime);
        const during = build(draw);
        expect(JSON.stringify(during.commands)).toBe(JSON.stringify(before.commands));
    });

    it('烘焙臂（历史归档臂）blit 命令不含 tint 字段（位图成品路线）', () => {
        setBeadBakeRuntime({ getTextureId: () => 'bake:tex' });
        const model = build((b) => drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL }));
        const blit = model.commands[0] as BlitCommand;
        expect(blit.kind).toBe('blit');
        expect(blit.tint).toBeUndefined();
        // `undefined` 字段不落 JSON ⇒ 既有 seal 基准零漂移
        expect(JSON.stringify(model.commands)).not.toContain('tint');
    });
});

describe('档位接线（DEC-4 · 本批只落「机制 + 可配阈值」）', () => {
    it('mask 档位与烘焙基准尺寸同源（128 = 定稿 py 的 OUT）', () => {
        // 跨包钉住：若有人改 BAKE_CANONICAL_SIZE 而没同步 MASK_CANONICAL_SIZE，此用例红。
        expect(BAKE_CANONICAL_SIZE).toBe(MASK_CANONICAL_SIZE);
    });

    it('孔径仍取 BEAD_CARD（矢量臂口径，tint 臂不改 §3 冻结量）', () => {
        const holeR = Math.round((BEAD_CELL * BEAD_CARD.holeRatio) / 2);
        const model = build((b) => drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL }));
        expect(model.commands.some((c) => c.kind === 'circle')).toBe(true);
        expect(holeR).toBeGreaterThan(0);
        expect(BEAD_PITCH).toBeGreaterThan(BEAD_CELL);
    });
});
