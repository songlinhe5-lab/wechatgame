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
import { RenderModelBuilder, MASK_CANONICAL_SIZE, tintFxBase, type BlitCommand } from '@wxgame/framework';

import {
    drawEmptySocket,
    drawFilledBead,
    setBeadBakeRuntime,
    setBeadTintRuntime,
    getBeadTintRuntime,
    createWhitelistBeadTintRuntime,
    type BeadTintRuntime,
} from '../src/view/bead-render.js';
import { tintMaskId, tintUpscaleAllowed, whitelistedTintStyles, TINT_MASK_STYLE_ID } from '../src/view/bead-tint-mask.js';
import { BEAD_CARD, BEAD_CELL, BEAD_PITCH, BAKE_CANONICAL_SIZE, TINT_LOD_MAX_UPSCALE } from '../src/config/tuning.js';
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
        expect(tintFxBase(cmd.fx)).toBeDefined();
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
        expect(tintFxBase(cmd.fx)).toBe(beadColorOf(DEMO_BEAD_INKS, 2));
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
        expect(tintFxBase(cmd.fx)).toBe(beadColorOf(DEMO_BEAD_INKS, 2));
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

    it('`holed` 档 + hideHole ⇒ tint 臂跳过（该档 mask 自带孔，hideHole 的档没有对应形状）', () => {
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
    it('`holeless` 档 + hideHole ⇒ tint 臂**命中**（无孔 mask 就是小豆档形状；WXG-T-226 接线批修正）', () => {
        const { runtime } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const model = build((b) => {
            drawFilledBead(b, 100, 100, 1, {
                size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holeless', hideHole: true,
            });
        });
        // ⛔ 回归锚：`bead-holeless` 定稿 mask 必须有消费者（否则是死资产）
        expect(model.commands.filter((c) => c.kind === 'blit')).toHaveLength(1);
        expect(tintFxBase((model.commands[0] as BlitCommand).fx)).toBeDefined();
    });

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

    it('烘焙臂（历史归档臂）blit 命令不含 fx 效果槽（位图成品路线）', () => {
        setBeadBakeRuntime({ getTextureId: () => 'bake:tex' });
        const model = build((b) => drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL }));
        const blit = model.commands[0] as BlitCommand;
        expect(blit.kind).toBe('blit');
        expect(blit.fx).toBeUndefined();
        // `undefined` 字段不落 JSON ⇒ 既有 seal 基准零漂移
        expect(JSON.stringify(model.commands)).not.toContain('"fx"');
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

/**
 * `[WXG-T-226 EP12-B4 / ADR-0029 DEC-4]` zoom LOD 回退阀：阈值判据 + 臂序落点。
 *
 * 纪律：阈值 `null`（`[待真机]` 不落数值）⇒ **永不回退**；本组只钉机制与臂序，
 * ⛔ 不钉任何具体阈值数值（K-051：纸面推论须实测复算）。
 */
describe('EP12-B4 · 放大回退阀（DEC-4）', () => {
    it('阈值位存在但为 null（[待真机] ⇒ 不落数值）', () => {
        expect(TINT_LOD_MAX_UPSCALE).toBeNull();
    });

    it('null 阈值 ⇒ 永不回退（任意放大倍数都放行）', () => {
        expect(tintUpscaleAllowed(128)).toBe(true);
        expect(tintUpscaleAllowed(100_000)).toBe(true);
        // 缺省参数走同一个冻结常量
        expect(tintUpscaleAllowed(100_000)).toBe(tintUpscaleAllowed(100_000, TINT_LOD_MAX_UPSCALE));
    });

    it('给定阈值时按 `mask 设备像素 ≤ MASK_CANONICAL_SIZE × 阈值` 判定（1.0 = 不许放大）', () => {
        expect(tintUpscaleAllowed(128, 1.0)).toBe(true);
        expect(tintUpscaleAllowed(129, 1.0)).toBe(false);
        expect(tintUpscaleAllowed(64, 1.0)).toBe(true);
    });

    it('实测口径：dpr=2 全区间安全（zoom 2.0 ⇒ 120px = 0.94×），dpr=3 高倍才放大', () => {
        // 阈值 1.0（仅作判据算例，⛔ 非冻结值）下核对本仓真源常量
        expect(tintUpscaleAllowed(BEAD_CELL * 2.0 * 2, 1.0)).toBe(true); // 120 ≤ 128
        expect(tintUpscaleAllowed(BEAD_CELL * 2.0 * 3, 1.0)).toBe(false); // 180 > 128
        expect(MASK_CANONICAL_SIZE).toBe(BAKE_CANONICAL_SIZE); // 两套号同值（T-226 S1 已核）
    });

    it('⛔ 未实现 allowTint ⇒ tint 臂照常命中（V-5：默认阀闭合 = 今日行为）', () => {
        const { runtime } = stubTintRuntime();
        expect(runtime.allowTint).toBeUndefined();
        setBeadTintRuntime(runtime);
        const model = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        expect(model.commands).toHaveLength(1);
        expect((model.commands[0] as BlitCommand).kind).toBe('blit');
    });

    it('allowTint() ⇒ false ⇒ 本帧 tint 臂停用、落矢量臂（⛔ 零 blit）', () => {
        const { runtime } = stubTintRuntime();
        setBeadTintRuntime({ ...runtime, allowTint: () => false });
        const model = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        expect(model.commands.filter((c) => c.kind === 'blit')).toHaveLength(0);
        expect(model.commands.length).toBeGreaterThan(0);
    });

    it('allowTint() ⇒ false 时空格同样落矢量臂（4 内阴影 + 明暗线回来）', () => {
        const { runtime } = stubTintRuntime();
        setBeadTintRuntime({ ...runtime, allowTint: () => false });
        const model = build((b) => {
            drawEmptySocket(
                b, 100, 100, palette, BEAD_CELL, 2, DEMO_BEAD_INKS,
                true, 4, { maskGauge: 'holed' },
            );
        });
        expect(model.commands.filter((c) => c.kind === 'blit')).toHaveLength(0);
    });

    it('V-5 绿线锚：阀开与阀关两条矢量臂输出逐字节相同', () => {
        const { runtime } = stubTintRuntime({ hit: false });
        // 白名单未命中 ⇒ 两条路径都走矢量臂，本就同形；这里钉「关阀」不改变矢量输出
        setBeadTintRuntime({ ...runtime, allowTint: () => true });
        const open = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        setBeadTintRuntime({ ...runtime, allowTint: () => false });
        const closed = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        expect(JSON.stringify(open.commands)).toBe(JSON.stringify(closed.commands));
    });
});
